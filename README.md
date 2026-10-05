<div align="center">

<img src="frontend/public/logo.png" width="150" alt="Rhodes Archive logo" />

# Rhodes Archive

### Archivo fan de historias de Arknights

Explora historias, reproduce escenas y utiliza traducción automática o traducciones personalizadas `.txt` en una interfaz pensada para disfrutarlas de forma cómoda.

[![Platform](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows)](../../releases)
[![Version](https://img.shields.io/badge/version-1.2.4-2ea44f)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange)](ROADMAP.md)

### ⬇️ Descargar para Windows

[![Download for Windows](https://img.shields.io/badge/Descargar-Rhodes%20Archive-2ea44f?style=for-the-badge&logo=windows)](../../releases/latest)

[Versiones](../../releases) · [Changelog](CHANGELOG.md) · [Roadmap](ROADMAP.md) · [Contribuir](CONTRIBUTING.md)

[X / Twitter](https://x.com/LOKNNE) · [YouTube](https://www.youtube.com/@LOKNNE)

</div>

---

## 📖 ¿Qué es Rhodes Archive?

**Rhodes Archive** es un proyecto fan no oficial basado en el proyecto open-source **Arkstage**. Su objetivo es ofrecer una forma cómoda de navegar y reproducir historias de **Arknights**, con especial atención a las traducciones y a una experiencia adaptada a español e inglés.

La aplicación utiliza StoryPlayer y recursos procedentes de PRTS Wiki para reconstruir las escenas dentro del reproductor.

> El proyecto se encuentra en fase **alpha**. Puede haber historias incompatibles, recursos que tarden en cargar o secciones todavía sin traducir completamente.

---

## ✨ Novedades de la versión 1.2.4

- ✏️ El acceso principal pasa a llamarse **Traducciones personalizadas**.
- 🧹 El botón flotante de traducciones ya no aparece en Historias, Ajustes ni otras pantallas secundarias.
- 🗂️ Navegación más limpia y presentación general del proyecto mejorada.
- 🌐 Se mantiene la traducción automática mediante **LibreTranslate**.
- 🇪🇸🇬🇧 Traducción de historias a español o inglés.
- 💾 Las traducciones automáticas se guardan en caché para no repetir el trabajo cada vez.
- ⭐ Una traducción personalizada compatible tiene prioridad sobre la traducción automática.

Consulta todos los cambios en [CHANGELOG.md](CHANGELOG.md).

---

## ⏳ Primera traducción y tiempo de espera

La traducción automática utiliza un servidor de LibreTranslate alojado para Rhodes Archive.

El servidor puede entrar en reposo cuando lleva un tiempo sin recibir tráfico. Si eso ocurre, la **primera carga** puede ser bastante más lenta de lo normal:

- **Despertar del servidor:** aproximadamente **30–90 segundos**.
- **Primera traducción de un capítulo:** desde **~1 minuto hasta varios minutos**, dependiendo de la longitud de la historia y de la carga del servidor.
- **Capítulos ya traducidos:** deberían abrir mucho más rápido gracias a la caché local.

Si la primera traducción parece parada, espera un poco antes de cerrar el capítulo. En versiones futuras se mejorará el indicador de progreso.

---

## 🌐 Traducción automática

Cuando un capítulo no tiene una traducción personalizada compatible, Rhodes Archive puede generar una traducción automática mediante LibreTranslate.

Flujo general:

```text
traducción personalizada compatible
            ↓ si existe
       usar el .txt
            ↓ si no existe
       LibreTranslate
            ↓
       caché local
```

El objetivo es que un usuario normal pueda instalar Rhodes Archive y usar las traducciones sin configurar claves, servidores ni herramientas adicionales.

---

## ✏️ Traducciones personalizadas

Los archivos `.txt` se mantienen como una capa **personalizada y editable**.

Son especialmente útiles para:

- corregir nombres propios;
- mejorar términos de lore;
- ajustar frases mal traducidas automáticamente;
- preparar traducciones revisadas manualmente;
- compartir una versión personalizada de un capítulo.

Las traducciones personalizadas tienen prioridad sobre la traducción automática cuando coinciden con el capítulo.

Cada archivo debe comenzar por:

```txt
#ARKSTAGE_TITLE=PAGE_TITLE
```

Y puede indicar el idioma con:

```txt
#LANG=es
```

o:

```txt
#LANG=en
```

Después se incluye el script traducido.

> Puedes editar diálogos, nombres y textos visibles, pero evita modificar comandos, identificadores o parámetros técnicos del guion, ya que una modificación incorrecta puede romper la reproducción.

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
    <td colspan="2" align="center"><strong>Traducciones personalizadas</strong></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/3.png" alt="Gestor de traducciones personalizadas de Rhodes Archive" /></td>
  </tr>
</table>

---

## ✨ Funciones

- 📖 Reproducción de historias mediante StoryPlayer
- 🌐 Traducción automática con LibreTranslate
- ✏️ Traducciones personalizadas mediante archivos `.txt`
- 🎬 Reproductor a pantalla completa
- ⏩ Modo automático mediante la tecla `A` cuando está disponible
- 💾 Caché local de recursos y traducciones
- 📦 Gestión y compresión de recursos
- 🗂️ Sección propia de **Traducciones personalizadas**
- 🎨 Interfaz y branding personalizados de Rhodes Archive

---

## 🚀 Inicio rápido

1. Descarga la versión más reciente desde **Releases**.
2. Instala Rhodes Archive en Windows.
3. Abre la biblioteca y selecciona una historia.
4. Si existe una traducción personalizada compatible, Rhodes Archive la usa.
5. Si no existe, puede generar la traducción automática correspondiente.

No necesitas modificar los archivos originales del juego ni configurar claves externas.

---

## ⚠️ Problemas conocidos

Rhodes Archive sigue en desarrollo. Actualmente pueden aparecer, entre otros, estos problemas:

- La primera traducción puede tardar si el servidor necesita despertar.
- Algunas historias pueden fallar si PRTS no responde correctamente.
- Algunas partes secundarias de la interfaz todavía pueden aparecer en chino o inglés.
- Determinadas historias pueden presentar incompatibilidades con StoryPlayer.
- Una traducción personalizada con comandos modificados o dañados puede provocar errores en la reproducción.
- La calidad de una traducción automática puede variar, especialmente con nombres propios y terminología de lore.

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

**Rhodes Archive 1.2.4**

</div>
