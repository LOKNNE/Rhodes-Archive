import { parse } from "acorn";
import type { Node } from "acorn";
import { init, parse as parseImports } from "es-module-lexer";

export interface StoryPlayerSnapshot {
  entry: string;
  prelude?: string[];
  modules: Record<string, string>;
  styles: Record<string, string>;
  data: Record<string, Record<string, unknown>>;
}

export const STORY_PLAYER_DATA = [
  "https://torappu.prts.wiki/assets/avg/character.json",
  "https://torappu.prts.wiki/assets/avg/background.json",
  "https://torappu.prts.wiki/gamedata/latest/story/story_variables.json",
] as const;

export function validateStoryPlayer(snapshot: StoryPlayerSnapshot): string[] {
  const errors: string[] = [];
  if (!snapshot?.modules?.[snapshot.entry]) errors.push("StoryPlayer 入口模块缺失");
  for (const url of snapshot?.prelude ?? []) if (!snapshot.modules[url]) errors.push(`StoryPlayer polyfill 缺失: ${url}`);
  if (!Object.keys(snapshot?.styles ?? {}).length) errors.push("StoryPlayer 样式缺失");
  for (const url of STORY_PLAYER_DATA) {
    if (Object.keys(snapshot?.data?.[url] ?? {}).length < 10) errors.push(`StoryPlayer 数据表缺失: ${url}`);
  }
  return errors;
}

/** The wiki entry doesn't export an embedding API. Locate its own functions by
 * their context/manifest contracts, not minified identifiers or a fixed hash.
 * Any ambiguous/changed contract rejects promotion to last-known-good.
 */
export function adaptStoryPlayerEntry(source: string): string {
  const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const functions = ast.body.filter((node) => node.type === "FunctionDeclaration");
  const context = functions.filter((node) => {
    const body = source.slice(node.start, node.end);
    return /\bscriptText\s*:/.test(body) && /\baudioVariables\s*:/.test(body) && /\bbackgroundPpuMap\s*:/.test(body);
  });
  const manifest = functions.filter((node) => {
    const body = source.slice(node.start, node.end);
    return /\bfaceAssets\s*:/.test(body) && /\burls\s*:/.test(body) && body.includes("charMap");
  });
  if (context.length !== 1 || manifest.length !== 1) throw new Error("StoryPlayer context/manifest 接口发生变化");
  let mount: { start: number; end: number; replacement: string } | undefined;
  const edits: Array<{ start: number; end: number; replacement: string }> = [];
  // Generic traversal keeps this adapter independent of Acorn's optional walker.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function visit(node: any): void {
    if (!node || typeof node !== "object") return;
    if (node.type === "CallExpression" && node.callee?.type === "MemberExpression"
      && node.callee.property?.name === "init") {
      const options = node.arguments[0];
      if (options?.type === "ObjectExpression") {
        for (const prop of options.properties) {
          if (prop.key?.name === "preference" && /^["'`]webgpu["'`]$/.test(source.slice(prop.value.start, prop.value.end))) {
            // PRTS currently prefers WebGPU. Pixi 8.20's cached texture batch
            // bind groups retain destroyed dialogue/face textures. WebGL avoids
            // that backend's stale bindings without suppressing resource errors.
            edits.push({ start: prop.value.start, end: prop.value.end, replacement: '"webgl"' });
          }
        }
      }
    }
    if (node.type === "CallExpression" && node.callee?.type === "MemberExpression"
      && node.callee.property?.name === "mount" && node.callee.object?.type === "CallExpression") {
      const args = node.callee.object.arguments;
      const props = args[1];
      if (props?.type === "ObjectExpression" && props.properties.some((p: { key?: { name?: string } }) => p.key?.name === "script")) {
        if (mount) throw new Error("StoryPlayer 包含多个入口");
        const app = node.callee.object;
        const create = source.slice(app.start, props.end - 1) + ",autoStart:true" + source.slice(props.end - 1, app.end);
        const call = `(window.__arkstageVueApp=${create})` + source.slice(app.end, node.end);
        mount = { start: node.start, end: node.end, replacement: `(window.__arkstageMount=()=>{window.__arkstageApp=${call}})` };
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  }
  visit(ast as Node);
  if (!mount) throw new Error("StoryPlayer mount 接口发生变化");
  edits.push(mount);
  let adapted = source;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    adapted = adapted.slice(0, edit.start) + edit.replacement + adapted.slice(edit.end);
  return adapted + `\nwindow.__arkstageAPI={loadContext:${context[0].id!.name},collectManifest:${manifest[0].id!.name}};`;
}

/** Normalize imports before blob loading; the import map preserves cycles and
 * shared module identity, including Pixi's lazy renderer chunks.
 */
export async function prepareModule(source: string, url: string, modules: Record<string, string>): Promise<string> {
  await init;
  const [imports] = parseImports(source);
  let result = source;
  for (const item of [...imports].reverse()) {
    if (item.type === "import-meta") {
      // Only rewrite the actual syntax node, never strings/comments mentioning it.
      if (source.slice(item.end, item.end + 4) === ".url") {
        result = result.slice(0, item.start) + JSON.stringify(url) + result.slice(item.end + 4);
      }
      continue;
    }
    if (!item.specifier || (item.type === "dynamic" && item.glob)) throw new Error(`StoryPlayer 使用了无法缓存的动态模块导入: ${url}`);
    const target = new URL(item.specifier, url).href;
    if (!modules[target]) throw new Error(`StoryPlayer 模块依赖缺失: ${target}`);
    const replacement = item.type === "dynamic" ? JSON.stringify(target) : target;
    result = result.slice(0, item.start) + replacement + result.slice(item.end);
  }
  return result;
}

/** UI textures and the canvas font are runtime dependencies too. They must be
 * present in predownload manifests even though upstream hides them in Export.
 */
export function storyPlayerStaticAssets(snapshot: StoryPlayerSnapshot): string[] {
  const urls = new Set<string>();
  for (const [base, source] of [...Object.entries(snapshot.modules), ...Object.entries(snapshot.styles)]) {
    for (const m of source.matchAll(/https:\/\/[^\s"'`<>\\)]+\.(?:png|webp|woff2?|ttf|mp3)(?:\?[^\s"'`<>\\)]*)?/g)) urls.add(m[0]);
    for (const m of source.matchAll(/new URL\(\s*["'`]([^"'`]+)["'`]\s*,\s*import\.meta\.url\s*\)/g)) {
      const url = new URL(m[1], base).href;
      if (url.startsWith("https:")) urls.add(url);
    }
    for (const m of (base.endsWith(".css") ? source : "").matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)/g)) {
      if (!m[1].includes("${")) {
        const url = new URL(m[1], base).href;
        if (url.startsWith("https:")) urls.add(url);
      }
    }
  }
  return [...urls];
}
