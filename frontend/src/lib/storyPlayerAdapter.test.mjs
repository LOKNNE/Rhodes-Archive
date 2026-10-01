import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { adaptStoryPlayerEntry, prepareModule, storyPlayerStaticAssets, validateStoryPlayer, STORY_PLAYER_DATA } from "../../../build/test/storyPlayerAdapter.js";

test("adapts renamed upstream functions, defers mount, and exposes teardown", () => {
  const source = `
async function renamedContext(script){return {scriptText : script,audioVariables : {},backgroundPpuMap : {}}}
function renamedManifest(context){const ignored=context.charMap;return {faceAssets : [],urls : []}}
const script='hello',root={},Component={};
const renderer={init(options){window.rendererOptions=options}};
renderer.init({preference:'webgpu',antialias:true});
function createApp(component, props){return {unmount(){},mount(){return {props}}}}
createApp(Component,{script}).mount(root);`;
  const realm = { window: {} };
  vm.runInNewContext(adaptStoryPlayerEntry(source), realm);
  assert.equal(typeof realm.window.__arkstageAPI.loadContext, "function");
  assert.equal(realm.window.__arkstageApp, undefined);
  realm.window.__arkstageMount();
  assert.equal(realm.window.__arkstageApp.props.autoStart, true);
  assert.equal(typeof realm.window.__arkstageVueApp.unmount, "function");
  assert.equal(realm.window.rendererOptions.preference, "webgl");
  assert.equal(realm.window.rendererOptions.antialias, true);
  assert.throws(() => adaptStoryPlayerEntry(source.replace("backgroundPpuMap", "futureFormat")), /接口发生变化/);
});

test("preserves cyclic/static/lazy imports and asset base without changing literals", async () => {
  const base="https://static.prts.wiki/widgets/production/entry.1.js";
  const dep="https://static.prts.wiki/widgets/production/dep.2.js";
  const source=`import './dep.2.js'; const lazy=()=>import('./dep.2.js');const base=import.meta.url;const literal='import.meta.url';`;
  const result=await prepareModule(source,base,{[base]:source,[dep]:"import './entry.1.js'"});
  assert.ok(result.includes(`import '${dep}'`));
  assert.ok(result.includes(`import("${dep}")`));
  assert.ok(result.includes(`const base="${base}"`));
  assert.ok(result.includes("const literal='import.meta.url'"));
  await assert.rejects(prepareModule(source,base,{}),/模块依赖缺失/);
  await assert.rejects(prepareModule('import(variable)',base,{}),/动态模块导入/);
});

test("offline asset manifest includes font/UI textures but excludes data URLs", () => {
  const snapshot={entry:'',data:{},modules:{'https://static.prts.wiki/widgets/production/entry.1.js':
    'const face=new URL("frame.png",import.meta.url);const embedded=new URL("data:image/png;base64,AA",import.meta.url);const font="https://static.prts.wiki/font.woff2";const expr=`url(${font})`'},styles:{}};
  assert.deepEqual(storyPlayerStaticAssets(snapshot).sort(),['https://static.prts.wiki/font.woff2','https://static.prts.wiki/widgets/production/frame.png']);
  assert.equal(validateStoryPlayer(snapshot).length,5);
});

test("live exported module graph satisfies the adapter and all imports", {skip:!process.env.PRTS_RUNTIME_OUTPUT},async()=>{
  const runtime=JSON.parse(fs.readFileSync(process.env.PRTS_RUNTIME_OUTPUT,'utf8'));
  const snapshot=runtime.bundle.story_player;
  assert.ok(adaptStoryPlayerEntry(snapshot.modules[snapshot.entry]).includes('preference:"webgl"'));
  assert.deepEqual(validateStoryPlayer(snapshot),[]);
  for(const url of STORY_PLAYER_DATA)assert.ok(snapshot.data[url]);
  for(const [url,source] of Object.entries(snapshot.modules))
    await prepareModule(url===snapshot.entry?adaptStoryPlayerEntry(source):source,url,snapshot.modules);
});
