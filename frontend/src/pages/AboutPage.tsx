import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getVersion } from "@tauri-apps/api/app";
import { openExternal } from "../lib/external";
import { GITHUB_URL, PRTS_URL } from "../lib/version";

const DISCLAIMER = `Rhodes Archive es un reproductor no oficial y de carácter fan/educativo para volver a ver historias de Arknights.

Los textos, ilustraciones, audio, fondos y demás recursos proceden de PRTS Wiki y sus derechos pertenecen a Arknights / Hypergryph. Rhodes Archive no distribuye estos recursos: los obtiene en tiempo de ejecución y puede almacenarlos localmente para uso personal y sin conexión.

Utiliza la aplicación de forma responsable, evita generar carga innecesaria sobre PRTS y no la uses con fines comerciales. Este proyecto no está afiliado con Hypergryph ni con PRTS Wiki.`;

const MIT = `MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

const LICENSE = `El código fuente original de Arkstage está publicado en GitHub:
${GITHUB_URL}

La aplicación utiliza componentes de código abierto:

— jQuery, PreloadJS / CreateJS, Tauri, React y React Router: licencia MIT.

${MIT}

— Noto Sans CJK: SIL Open Font License 1.1 (OFL-1.1).
  Texto completo: https://scripts.sil.org/OFL`;

const UPSTREAM = `Rhodes Archive depende de varios proyectos y recursos externos para reproducir las historias:

· ScenarioSimulator / StoryPlayer — motor de reproducción procedente de PRTS Wiki.
· jQuery — dependencia del motor (MIT).
· PreloadJS / CreateJS — carga de recursos (MIT).
· Tauri 2 — framework multiplataforma (MIT / Apache-2.0).
· React 19 y React Router — interfaz (MIT).
· Noto Sans CJK — tipografía (SIL OFL 1.1).
· Todo el contenido narrativo y artístico de Arknights © Hypergryph.`;

const SECTIONS: Record<string, { title: string; body: string }> = {
  disclaimer: { title: "Aviso legal", body: DISCLAIMER },
  license: { title: "Licencias de código abierto", body: LICENSE },
  upstream: { title: "Software y recursos externos", body: UPSTREAM },
};

export default function AboutPage() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const section = sp.get("s");
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  if (section && SECTIONS[section]) {
    const s = SECTIONS[section];
    return (
      <div className="about-page">
        <div className="about-head">
          <button className="back-icon" onClick={() => navigate(-1)} aria-label="Volver">◀</button>
          <h1>{s.title}</h1>
        </div>
        <pre className="about-text">{s.body}</pre>
      </div>
    );
  }

  return (
    <div className="about-page">
      <div className="about-head">
        <button className="back-icon" onClick={() => navigate(-1)} aria-label="Volver">◀</button>
        <h1>Acerca de</h1>
      </div>

      <div className="about-body">
        <img className="about-logo" src="/logo.png" alt="" />
        <div className="about-name">Rhodes Archive</div>
        <div className="about-ver">v{version || "…"}</div>

        <div className="about-links">
          <button className="about-link social-link" onClick={() => openExternal("https://www.youtube.com/@LOKNNE")}>YouTube · LOKNNE</button>
          <button className="about-link social-link" onClick={() => openExternal("https://www.reddit.com/user/LOKNNE/")}>Reddit · u/LOKNNE</button>
          <button className="about-link" onClick={() => openExternal(GITHUB_URL)}>Proyecto original en GitHub</button>
          <button className="about-link" onClick={() => openExternal(PRTS_URL)}>PRTS Wiki</button>
        </div>

        <div className="about-rows">
          <button className="about-row" onClick={() => setSp({ s: "disclaimer" })}>
            Aviso legal<span className="about-arrow">›</span>
          </button>
          <button className="about-row" onClick={() => setSp({ s: "license" })}>
            Licencias<span className="about-arrow">›</span>
          </button>
          <button className="about-row" onClick={() => setSp({ s: "upstream" })}>
            Software y recursos<span className="about-arrow">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
