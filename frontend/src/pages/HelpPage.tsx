import { useNavigate } from "react-router-dom";

export default function HelpPage() {
  const navigate = useNavigate();

  return (
    <div className="help-page">
      <div className="help-head">
        <button className="back-icon" onClick={() => navigate(-1)} aria-label="Volver">◀</button>
        <h1>Ayuda</h1>
      </div>
      <div className="help-md">
        <h2>Cómo usar Rhodes Archive</h2>
        <p>Entra en <strong>Historias</strong>, elige una colección o capítulo y abre la historia que quieras reproducir.</p>

        <h2>Traducciones</h2>
        <p>La sección <strong>Traducciones</strong> muestra los archivos <code>.txt</code> que Arkstage puede cargar. Cada traducción debe empezar por:</p>
        <pre><code>#ARKSTAGE_TITLE=PAGE_TITLE_DE_LA_HISTORIA</code></pre>
        <p>Debajo va el script completo. Si existe una traducción para ese capítulo, Arkstage la cargará automáticamente; si no, utilizará el texto original.</p>

        <h2>Modo sin conexión</h2>
        <p>Rhodes Archive puede guardar recursos localmente. Desde <strong>Ajustes</strong> puedes administrar la caché, cambiar la carpeta de recursos y configurar las descargas.</p>

        <h2>Reproductor</h2>
        <p>El reproductor se abre a pantalla completa. La tecla <strong>A</strong> activa o desactiva el modo automático cuando el StoryPlayer lo permite.</p>

        <h2>Proyecto fan</h2>
        <p>Rhodes Archive es una herramienta no oficial. Los derechos de Arknights y de sus recursos pertenecen a sus respectivos propietarios.</p>
      </div>
    </div>
  );
}
