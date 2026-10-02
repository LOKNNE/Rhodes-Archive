import { createWriteStream, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const outDir = join(root, "src-tauri", "resources", "local-ai");
const tmpDir = join(root, "build", "local-ai-tmp");

const LLAMA_TAG = "b10938";
const LLAMA_ZIP = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_TAG}/llama-${LLAMA_TAG}-bin-win-cpu-x64.zip`;
const MODEL_URL = "https://huggingface.co/ggml-org/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_0.gguf";
const MODEL_NAME = "Qwen3-0.6B-Q4_0.gguf";
const MODEL_MIN_BYTES = 400_000_000;

function okRuntime() {
  return existsSync(join(outDir, "llama-server.exe"));
}

function okModel() {
  const p = join(outDir, MODEL_NAME);
  return existsSync(p) && statSync(p).size >= MODEL_MIN_BYTES;
}

async function download(url, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  console.log(`[local-ai] Descargando ${url}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} al descargar ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
}

async function prepareRuntime() {
  if (process.platform !== "win32") {
    console.log("[local-ai] Preparación automática configurada por ahora para Windows x64.");
    return;
  }

  mkdirSync(outDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  if (!okRuntime()) {
    const zipPath = join(tmpDir, "llama-win-x64.zip");
    const extracted = join(tmpDir, "llama");
    if (!existsSync(zipPath)) await download(LLAMA_ZIP, zipPath);
    rmSync(extracted, { recursive: true, force: true });
    mkdirSync(extracted, { recursive: true });

    const escapedZip = zipPath.replaceAll("'", "''");
    const escapedOut = extracted.replaceAll("'", "''");
    const ps = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedOut}' -Force`],
      { stdio: "inherit" },
    );
    if (ps.status !== 0) throw new Error("No se pudo extraer llama.cpp");

    const copy = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `Copy-Item -Path '${escapedOut}\\*' -Destination '${outDir.replaceAll("'", "''")}' -Recurse -Force`],
      { stdio: "inherit" },
    );
    if (copy.status !== 0 || !okRuntime()) {
      throw new Error("No se encontró llama-server.exe después de extraer llama.cpp");
    }
  } else {
    console.log("[local-ai] llama.cpp ya está preparado.");
  }

  if (!okModel()) {
    await download(MODEL_URL, join(outDir, MODEL_NAME));
  } else {
    console.log("[local-ai] El modelo local ya está preparado.");
  }

  // License notices are downloaded beside the redistributed binaries/model.
  const notices = [
    ["LICENSE-llama.cpp.txt", "https://raw.githubusercontent.com/ggml-org/llama.cpp/master/LICENSE"],
    ["LICENSE-Qwen3.txt", "https://huggingface.co/Qwen/Qwen3-0.6B/resolve/main/LICENSE"],
  ];
  for (const [name, url] of notices) {
    const dest = join(outDir, name);
    if (!existsSync(dest)) {
      try { await download(url, dest); } catch (e) { console.warn(`[local-ai] No se pudo descargar ${name}:`, e.message); }
    }
  }

  console.log("[local-ai] Listo: el instalador incluirá el traductor local.");
}

prepareRuntime().catch((error) => {
  console.error("[local-ai] ERROR:", error);
  process.exit(1);
});
