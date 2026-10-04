import { invoke } from "@tauri-apps/api/core";

const CJK = /[\u3400-\u9fff]/;
const BATCH_SIZE = 45;

const fixedTermsByLanguage: Record<"es" | "en", Record<string, string>> = {
  es: {
    "拉特兰": "Laterano",
    "萨科塔": "Sankta",
    "黎博利": "Liberi",
    "塔尔塔罗斯": "Tártaro",
    "公证所": "Salón Notarial",
    "执行者": "Ejecutor",
    "？？？": "???",
  },
  en: {
    "拉特兰": "Laterano",
    "萨科塔": "Sankta",
    "黎博利": "Liberi",
    "塔尔塔罗斯": "Tartarus",
    "公证所": "Notarial Hall",
    "执行者": "Executor",
    "？？？": "???",
  },
};

function needsTranslation(text: string): boolean {
  return CJK.test(text);
}

function collectSegments(script: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const add = (value: string | undefined) => {
    if (!value || !needsTranslation(value) || seen.has(value)) return;
    seen.add(value);
    found.push(value);
  };

  for (const line of script.split(/\r?\n/)) {
    let m = line.match(/^\s*\[name\s*=\s*"([^"]+)"/i);
    if (m) add(m[1]);

    m = line.match(/^\s*\[multiline\([^]]*\bname\s*=\s*"([^"]+)"/i);
    if (m) add(m[1]);

    m = line.match(/^\s*\[Decision\([^]]*\boptions\s*=\s*"([^"]*)"/i);
    if (m) for (const option of m[1].split(";")) add(option);

    if (/^\s*\[(Sticker|Subtitle)\b/i.test(line)) {
      const textMatch = line.match(/\btext\s*=\s*"([^"]*)"/i);
      if (textMatch) add(textMatch[1]);
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

function applyFixedTerms(value: string, targetLanguage: "es" | "en"): string {
  const nickname = localStorage.getItem("prts-nickname") || "Doctor";
  let out = value.replaceAll("{@nickname}", nickname);

  const fixedTerms = fixedTermsByLanguage[targetLanguage];
  for (const [from, to] of Object.entries(fixedTerms)) {
    if (out === from) return to;
  }

  return out;
}

function replaceVisibleSegments(
  script: string,
  translations: Map<string, string>,
  targetLanguage: "es" | "en",
): string {
  const tr = (value: string) => {
    const fixed = applyFixedTerms(value, targetLanguage);
    if (fixed !== value) return fixed;
    return translations.get(value) ?? value;
  };

  return script
    .split(/\r?\n/)
    .map((originalLine) => {
      let line = originalLine.replaceAll(
        "{@nickname}",
        localStorage.getItem("prts-nickname") || "Doctor",
      );

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
        (_all, a, value, b) => `${a}${value.split(";").map(tr).join(";")}${b}`,
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
        if (needsTranslation(tail)) line = head + tr(tail);
      } else if (!line.trimStart().startsWith("[") && needsTranslation(line)) {
        line = tr(line);
      }

      return line;
    })
    .join("\n");
}

export async function getAutomaticTranslation(
  title: string,
  sourceScript: string,
  targetLanguage: "es" | "en",
  onStatus?: (message: string) => void,
): Promise<string> {
  const cached = await invoke<string | null>("translation_cache_get", {
    title,
    sourceScript,
    targetLanguage,
  });

  if (cached) {
    onStatus?.(
      targetLanguage === "es"
        ? "Usando traducción guardada..."
        : "Using saved translation...",
    );
    return cached;
  }

  const prepared = sourceScript.replaceAll(
    "{@nickname}",
    localStorage.getItem("prts-nickname") || "Doctor",
  );

  const segments = collectSegments(prepared);
  if (segments.length === 0) return prepared;

  const translations = new Map<string, string>();

  for (const segment of segments) {
    const fixed = applyFixedTerms(segment, targetLanguage);
    if (fixed !== segment) translations.set(segment, fixed);
  }

  const pending = segments.filter((segment) => !translations.has(segment));
  const batches = Math.ceil(pending.length / BATCH_SIZE);

  for (let start = 0, batch = 0; start < pending.length; start += BATCH_SIZE) {
    batch += 1;
    const group = pending.slice(start, start + BATCH_SIZE);

    onStatus?.(
      targetLanguage === "es"
        ? `Traduciendo con LibreTranslate... ${batch}/${batches}`
        : `Translating with LibreTranslate... ${batch}/${batches}`,
    );

    const result = await invoke<string[]>("translate_segments", {
      title,
      segments: group,
      targetLanguage,
    });

    if (result.length !== group.length) {
      throw new Error(
        targetLanguage === "es"
          ? "LibreTranslate devolvió una cantidad incorrecta de líneas."
          : "LibreTranslate returned an incorrect number of lines.",
      );
    }

    group.forEach((source, index) => translations.set(source, result[index]));
  }

  const translatedScript = replaceVisibleSegments(
    prepared,
    translations,
    targetLanguage,
  );

  await invoke("translation_cache_put", {
    title,
    sourceScript,
    translatedScript,
    targetLanguage,
  });

  return translatedScript;
}

export function getAutomaticSpanishTranslation(
  title: string,
  sourceScript: string,
  onStatus?: (message: string) => void,
) {
  return getAutomaticTranslation(title, sourceScript, "es", onStatus);
}
