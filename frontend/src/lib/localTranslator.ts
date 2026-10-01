import { env, pipeline } from "@huggingface/transformers";

const MODEL_ID = "Xenova/nllb-200-distilled-600M";
const SRC_LANG = "zho_Hans";
const TGT_LANG = "spa_Latn";
const CJK = /[\u3400-\u9fff]/;
const BATCH_SIZE = 6;

// Transformers.js uses the browser Cache API when available. After the first
// model download, Arkstage can reuse the cached files locally.
env.useBrowserCache = true;
env.cacheKey = "arkstage-nllb-cache";

type Translator = Awaited<ReturnType<typeof pipeline>>;
let translatorPromise: Promise<Translator> | null = null;

const exactNames: Record<string, string> = {
  "结城理": "Makoto Yuki",
  "岳羽由加莉": "Yukari Takeba",
  "天田乾": "Ken Amada",
  "虎狼丸": "Koromaru",
  "裘里奥": "Giulio",
  "吉阿达": "Giada",
  "学生": "Estudiante",
  "班主任": "Tutor",
  "班长": "Delegada",
  "？？？": "???",
};

const glossary: Array<[string, string]> = [
  ["结城理", "Makoto Yuki"],
  ["岳羽由加莉", "Yukari Takeba"],
  ["天田乾", "Ken Amada"],
  ["虎狼丸", "Koromaru"],
  ["裘里奥", "Giulio"],
  ["吉阿达", "Giada"],
  ["拉特兰", "Laterano"],
  ["萨科塔", "Sankta"],
  ["黎博利", "Liberi"],
  ["塔尔塔罗斯", "Tártaro"],
  ["影时间", "Hora Oscura"],
  ["暗影", "Sombras"],
  ["公证所", "Salón Notarial"],
  ["执行者", "Ejecutor"],
];

function prepareForModel(text: string): string {
  let out = text.replaceAll("{@nickname}", "LOKNNE");
  for (const [zh, es] of glossary) out = out.replaceAll(zh, es);
  return out;
}

function normalizeResult(text: string): string {
  return text
    .replaceAll("LOKNNE", "LOKNNE")
    .replace(/\bLaterano\b/gi, "Laterano")
    .replace(/\bSankta\b/gi, "Sankta")
    .replace(/\bLiberi\b/gi, "Liberi")
    .replace(/\bTártaro\b/gi, "Tártaro")
    .replace(/\bHora Oscura\b/gi, "Hora Oscura")
    .replace(/\bS\.?\s*E\.?\s*E\.?\s*S\.?\b/gi, "S.E.E.S.");
}

function needsTranslation(text: string): boolean {
  return CJK.test(text);
}

function collectVisibleSegments(script: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const add = (value: string | undefined) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed || !needsTranslation(trimmed) || seen.has(trimmed)) return;
    seen.add(trimmed);
    found.push(trimmed);
  };

  for (const line of script.split(/\r?\n/)) {
    let m = line.match(/^\s*\[name\s*=\s*"([^"]+)"/i);
    if (m) add(m[1]);

    m = line.match(/^\s*\[multiline\([^]]*\bname\s*=\s*"([^"]+)"/i);
    if (m) add(m[1]);

    m = line.match(/^\s*\[Decision\([^]]*\boptions\s*=\s*"([^"]*)"/i);
    if (m) for (const option of m[1].split(";")) add(option);

    if (/^\s*\[(Sticker|Subtitle)\b/i.test(line)) {
      const tm = line.match(/\btext\s*=\s*"([^"]*)"/i);
      if (tm) add(tm[1]);
    }

    const close = line.lastIndexOf("]");
    if (close >= 0) {
      add(line.slice(close + 1));
    } else if (!line.trimStart().startsWith("[")) {
      add(line);
    }
  }

  return found;
}

function replaceVisibleSegments(script: string, translations: Map<string, string>): string {
  const tr = (value: string) => {
    if (exactNames[value]) return exactNames[value];
    if (value.includes("{@nickname}")) value = value.replaceAll("{@nickname}", "LOKNNE");
    return translations.get(value.trim()) ?? value;
  };

  return script
    .split(/\r?\n/)
    .map((originalLine) => {
      let line = originalLine.replaceAll("{@nickname}", "LOKNNE");

      line = line.replace(
        /^(\s*\[name\s*=\s*")([^"]+)(")/i,
        (_all, a, value, b) => `${a}${tr(value)}${b}`,
      );

      line = line.replace(
        /^(\s*\[multiline\([^]]*\bname\s*=\s*")([^"]+)(")/i,
        (_all, a, value, b) => `${a}${tr(value)}${b}`,
      );

      line = line.replace(
        /^(\s*\[Decision\([^]]*\boptions\s*=\s*")([^"]*)(")/i,
        (_all, a, value, b) => `${a}${value.split(";").map((v) => tr(v)).join(";")}${b}`,
      );

      if (/^\s*\[(Sticker|Subtitle)\b/i.test(line)) {
        line = line.replace(
          /(\btext\s*=\s*")([^"]*)(")/i,
          (_all, a, value, b) => `${a}${tr(value)}${b}`,
        );
      }

      const close = line.lastIndexOf("]");
      if (close >= 0) {
        const head = line.slice(0, close + 1);
        const tail = line.slice(close + 1);
        if (needsTranslation(tail)) {
          const leading = tail.match(/^\s*/)?.[0] ?? "";
          const trailing = tail.match(/\s*$/)?.[0] ?? "";
          line = head + leading + tr(tail.trim()) + trailing;
        }
      } else if (!line.trimStart().startsWith("[") && needsTranslation(line)) {
        const leading = line.match(/^\s*/)?.[0] ?? "";
        const trailing = line.match(/\s*$/)?.[0] ?? "";
        line = leading + tr(line.trim()) + trailing;
      }

      return line;
    })
    .join("\n");
}

// ---- Persistent cache for finished translated scripts ----

const DB_NAME = "arkstage-local-translations";
const STORE = "scripts";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function cacheKey(title: string, sourceScript: string): Promise<string> {
  return `${title}::${await sha256(sourceScript)}`;
}

async function readCached(title: string, sourceScript: string): Promise<string | null> {
  const db = await openDb();
  const key = await cacheKey(title, sourceScript);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
    req.onerror = () => reject(req.error);
  });
}

async function writeCached(title: string, sourceScript: string, translated: string): Promise<void> {
  const db = await openDb();
  const key = await cacheKey(title, sourceScript);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(translated, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getTranslator(
  onStatus?: (message: string) => void,
): Promise<Translator> {
  if (!translatorPromise) {
    onStatus?.("Preparando traductor local... La primera vez descargará el modelo (~1 GB).");

    translatorPromise = pipeline(
      "translation",
      MODEL_ID,
      {
        device: "wasm",
        dtype: "q8",
        progress_callback: (info: unknown) => {
          const p = info as { status?: string; progress?: number; file?: string };
          if (typeof p.progress === "number") {
            onStatus?.(`Descargando modelo local... ${Math.round(p.progress)}%`);
          } else if (p.status === "ready") {
            onStatus?.("Traductor local preparado.");
          }
        },
      } as never,
    ) as Promise<Translator>;
  }
  return translatorPromise;
}

export async function getLocalSpanishTranslation(
  title: string,
  sourceScript: string,
  onStatus?: (message: string) => void,
): Promise<string> {
  const cached = await readCached(title, sourceScript);
  if (cached) {
    onStatus?.("Usando traducción local guardada...");
    return cached;
  }

  const preparedScript = sourceScript.replaceAll("{@nickname}", "LOKNNE");
  const segments = collectVisibleSegments(preparedScript);
  if (!segments.length) return preparedScript;

  const translations = new Map<string, string>();
  const pending: string[] = [];

  for (const segment of segments) {
    if (exactNames[segment]) {
      translations.set(segment, exactNames[segment]);
    } else {
      pending.push(segment);
    }
  }

  const translator = await getTranslator(onStatus);
  const totalBatches = Math.max(1, Math.ceil(pending.length / BATCH_SIZE));

  for (let start = 0, batch = 0; start < pending.length; start += BATCH_SIZE) {
    batch++;
    const group = pending.slice(start, start + BATCH_SIZE);
    onStatus?.(`Traduciendo localmente... ${batch}/${totalBatches}`);

    const modelInput = group.map(prepareForModel);
    const output = await translator(modelInput, {
      src_lang: SRC_LANG,
      tgt_lang: TGT_LANG,
      max_new_tokens: 256,
    } as never);

    const rows = Array.isArray(output) ? output : [output];

    if (rows.length !== group.length) {
      // Some pipeline versions nest batched outputs once more.
      const flattened = rows.flat?.() ?? rows;
      if (flattened.length !== group.length) {
        throw new Error(`El traductor local devolvió ${flattened.length} resultados para ${group.length} textos.`);
      }
      flattened.forEach((row: any, i: number) => {
        translations.set(group[i], normalizeResult(String(row.translation_text ?? group[i])));
      });
    } else {
      rows.forEach((row: any, i: number) => {
        const item = Array.isArray(row) ? row[0] : row;
        translations.set(group[i], normalizeResult(String(item?.translation_text ?? group[i])));
      });
    }

    // Yield to the UI so the loading/progress text stays responsive.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const translated = replaceVisibleSegments(preparedScript, translations);
  await writeCached(title, sourceScript, translated);
  onStatus?.("Traducción local terminada.");

  return translated;
}
