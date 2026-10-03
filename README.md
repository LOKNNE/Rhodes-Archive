<div align="center">

<img src="frontend/public/logo.png" width="150" alt="Rhodes Archive logo" />

# Rhodes Archive

### Archivo fan de historias de Arknights

Explora historias, reproduce escenas y carga traducciones fan en una interfaz pensada para disfrutarlas de forma cómoda.

[![Platform](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows)](../../releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange)](ROADMAP.md)

### ⬇️ Descargar para Windows

[![Download for Windows](https://img.shields.io/badge/Descargar-Rhodes%20Archive-2ea44f?style=for-the-badge&logo=windows)](../../releases/latest)

[Versiones](../../releases) · [Changelog](CHANGELOG.md) · [Roadmap](ROADMAP.md) · [Contribuir](CONTRIBUTING.md)

[X / Twitter](https://x.com/LOKNNE) · [YouTube](https://www.youtube.com/@LOKNNE)

</div>

---

## 📖 ¿Qué es Rhodes Archive?

**Rhodes Archive** es un proyecto fan no oficial basado en el proyecto open-source **Arkstage**. Su objetivo es ofrecer una forma cómoda de navegar y reproducir historias de **Arknights**, con especial atención al soporte para traducciones fan y a una experiencia adaptada al español.

La aplicación utiliza StoryPlayer y recursos procedentes de PRTS Wiki para reconstruir las escenas dentro del reproductor.

> El proyecto se encuentra en fase **alpha**. Puede haber historias incompatibles, recursos que tarden en cargar o secciones todavía sin traducir completamente.

---

## 📸 Capturas

<table>
  <tr>
    <td align="center"><strong>Inicio</strong></td>
    <td align="center"><strong>Biblioteca</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/1.png" alt="Pantalla principal de Rhodes Archive" /></td>
    <td><img src="docs/screenshots/2.png" alt="Biblioteca de historias de Rhodes Archive" /></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><strong>Traducciones</strong></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/3.png" alt="Gestor de traducciones de Rhodes Archive" /></td>
  </tr>
</table>

---

## ✨ Funciones

- 🇪🇸 Interfaz principal en español
- 📖 Reproducción de historias mediante StoryPlayer
- 🌐 Traducciones externas mediante archivos `.txt`
- 🎬 Reproductor a pantalla completa
- ⏩ Modo automático mediante la tecla `A` cuando está disponible
- 💾 Caché local de recursos
- 📦 Gestión y compresión de recursos
- 🗂️ Sección propia de **Traducciones**
- 🎨 Interfaz y branding personalizados de Rhodes Archive
- 🧩 Si no existe traducción para un capítulo, se reproduce el texto original

---

## 🚀 Inicio rápido

1. Descarga la versión más reciente desde **Releases**.
2. Instala Rhodes Archive en Windows.
3. Abre la biblioteca y selecciona una historia.
4. Si existe una traducción compatible en la carpeta `translations`, Rhodes Archive la cargará automáticamente.

No necesitas modificar los archivos originales del juego.

---

## 🌍 Traducciones fan

Las traducciones se guardan como archivos `.txt` independientes.

La primera línea del archivo identifica exactamente la página de PRTS a la que pertenece:

```txt
#ARKSTAGE_TITLE=PAGE_TITLE
```

Debajo se incluye el script completo traducido de la historia.

Ejemplo:

```text
translations/
├── Ave Mujica Cap.1.txt
└── Ave Mujica Cap 2.txt
```

Rhodes Archive compara `PAGE_TITLE` con la historia seleccionada:

```text
traducción encontrada  →  carga el .txt
sin traducción         →  usa el texto original
```

Esto permite añadir, corregir o compartir traducciones sin modificar el reproductor.

---

## ⚠️ Problemas conocidos

Rhodes Archive sigue en desarrollo. Actualmente pueden aparecer, entre otros, estos problemas:

- La primera carga de una historia puede tardar mientras se obtienen y guardan recursos.
- Algunas historias pueden fallar si PRTS no responde correctamente.
- Algunas partes secundarias de la interfaz todavía pueden aparecer en chino o inglés.
- Determinadas historias pueden presentar incompatibilidades con StoryPlayer.
- Un archivo de traducción con comandos modificados o dañados puede provocar errores en la reproducción.

Si encuentras un fallo, abre un **Issue** e indica la historia, qué estabas haciendo y, si puedes, adjunta una captura.

---

## 🛠️ Desarrollo

Tecnologías principales:

<p>
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" />
  <img src="https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
</p>

Para ejecutarlo en desarrollo:

```bash
npm install
npm run tauri dev
```

Para colaborar, consulta [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 🗺️ Proyecto

- 📋 [Roadmap](ROADMAP.md)
- 📝 [Changelog](CHANGELOG.md)
- 🐞 [Reportar un problema](../../issues/new/choose)
- 💡 [Proponer una mejora](../../issues/new/choose)
- 🌐 [Proponer o corregir una traducción](../../issues/new/choose)

---

## 🔗 Enlaces oficiales

- [X / Twitter — @LOKNNE](https://x.com/LOKNNE)
- [YouTube — @LOKNNE](https://www.youtube.com/@LOKNNE)

---

## ❤️ Créditos

Rhodes Archive está basado en **Arkstage** y utiliza tecnología y recursos relacionados con **PRTS Wiki / StoryPlayer**.

Gracias a sus desarrolladores y a las comunidades que han hecho posibles estas herramientas.

---

## ⚠️ Aviso legal

Rhodes Archive es un proyecto fan **no oficial** y no está afiliado con Hypergryph, Gryphline ni PRTS Wiki.

**Arknights**, sus personajes, historias, ilustraciones, música, audio y demás recursos pertenecen a **Hypergryph** y a sus respectivos propietarios.

El repositorio no reclama propiedad sobre ningún recurso original de Arknights.

---

## 📄 Licencia

El código propio y las modificaciones originales de este repositorio se publican bajo la [MIT License](LICENSE).

La licencia MIT **no se aplica** a textos, imágenes, audio, música ni otros recursos protegidos pertenecientes a Hypergryph u otros titulares de derechos.

---

<div align="center">

**Rhodes Archive**

</div>
