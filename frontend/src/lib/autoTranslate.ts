import { invoke } from "@tauri-apps/api/core";

const CJK = /[\u3400-\u9fff]/;
const BATCH_SIZE = 45;

const fixedTerms: Record<string, string> = {
  "结城理": "Makoto Yuki",
  "岳羽由加莉": "Yukari Takeba",
  "天田乾": "Ken Amada",
  "虎狼丸": "Koromaru",
  "裘里奥": "Giulio",
  "吉阿达": "Giada",
  "班主任": "Tutor",
  "班长": "Delegada",
  "学生": "Estudiante",
  "？？？": "???",
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
    // Visible speaker names only. Do NOT touch technical name= fields such as charslot.
    let m = line.match(/^\s*\[name\s*=\s*"([^"]+)"/i);
    if (m) add(m[1]);

    m = line.match(/^\s*\[multiline\([^]]*\bname\s*=\s*"([^"]+)"/i);
    if (m) add(m[1]);

    // Player choices.
    m = line.match(/^\s*\[Decision\([^]]*\boptions\s*=\s*"([^"]*)"/i);
    if (m) for (const option of m[1].split(";")) add(option);

    // Visible text embedded in commands such as Sticker/Subtitle.
    if (/^\s*\[(Sticker|Subtitle)\b/i.test(line)) {
      const textMatch = line.match(/\btext\s*=\s*"([^"]*)"/i);
      if (textMatch) add(textMatch[1]);
    }

    // Dialogue after a command, e.g. [name="..."]你好
    const close = line.lastIndexOf("]");
    if (close >= 0) {
      add(line.slice(close + 1));
    } else if (!line.trimStart().startsWith("[")) {
      // Plain narration.
      add(line);
    }
  }

  return found;
}

function applyFixedTerms(value: string): string {
  let out = value.replaceAll("{@nickname}", "LOKNNE");
  for (const [from, to] of Object.entries(fixedTerms)) {
    if (out === from) return to;
  }
  return out;
}

function replaceVisibleSegments(script: string, translations: Map<string, string>): string {
  const tr = (value: string) => {
    const fixed = applyFixedTerms(value);
    if (fixed !== value) return fixed;
    return translations.get(value) ?? value;
  };

  return script
    .split(/\r?\n/)
    .map((originalLine) => {
      let line = originalLine.replaceAll("{@nickname}", "LOKNNE");

      // [name="..."] visible speaker.
      line = line.replace(
        /^(\s*\[name\s*=\s*")([^"]+)(")/i,
        (_all, a, value, b) => `${a}${tr(value)}${b}`,
      );

      // [multiline(name="...")]
      line = line.replace(
        /^(\s*\[multiline\([^]]*\bname\s*=\s*")([^"]+)(")/i,
        (_all, a, value, b) => `${a}${tr(value)}${b}`,
      );

      // Decision options, preserving semicolon separators exactly.
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

      // Replace only the text after the last closing command bracket.
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

export async function getAutomaticSpanishTranslation(
  title: string,
  sourceScript: string,
  onStatus?: (message: string) => void,
): Promise<string> {
  const cached = await invoke<string | null>("translation_cache_get", {
    title,
    sourceScript,
  });
  if (cached) {
    onStatus?.("Usando traducción española guardada...");
    return cached;
  }

  const prepared = sourceScript.replaceAll("{@nickname}", "LOKNNE");
  const segments = collectSegments(prepared);

  if (segments.length === 0) return prepared;

  const translations = new Map<string, string>();

  // Resolve names we know locally, so they never cost an API call and remain consistent.
  for (const segment of segments) {
    const fixed = applyFixedTerms(segment);
    if (fixed !== segment) translations.set(segment, fixed);
  }

  const pending = segments.filter((s) => !translations.has(s));
  const batches = Math.ceil(pending.length / BATCH_SIZE);

  for (let start = 0, batch = 0; start < pending.length; start += BATCH_SIZE) {
    batch++;
    const group = pending.slice(start, start + BATCH_SIZE);
    onStatus?.(`Traduciendo al español con OpenAI... ${batch}/${batches}`);

    const result = await invoke<string[]>("translate_segments", {
      title,
      segments: group,
    });

    if (result.length !== group.length) {
      throw new Error("El traductor devolvió una cantidad incorrecta de líneas.");
    }

    group.forEach((source, i) => translations.set(source, result[i]));
  }

  const translatedScript = replaceVisibleSegments(prepared, translations);

  await invoke("translation_cache_put", {
    title,
    sourceScript,
    translatedScript,
  });

  return translatedScript;
}
