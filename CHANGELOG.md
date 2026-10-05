# Changelog

Todos los cambios importantes de **Rhodes Archive** se documentarán aquí.

## [1.2.4] - 2026-10-05

### Añadido
- Botón **Reintentar traducción** cuando la traducción automática falla.
- Botón **Reintentar** en errores generales de carga del reproductor.
- Acceso directo para **Abrir carpeta** desde Traducciones personalizadas.

### Mejorado
- Estados de traducción más claros durante la carga: comprobación de caché, carga desde caché, conexión con el servidor, traducción del capítulo y guardado en caché.
- Mensaje específico cuando se está usando una **traducción personalizada**.
- Presentación más limpia del proyecto y navegación más clara hacia las traducciones personalizadas.

### Cambiado
- El acceso principal pasa a llamarse **Traducciones personalizadas**.
- El acceso flotante a traducciones deja de aparecer en Historias, Ajustes y otras pantallas secundarias.
- Limpieza general de metadatos y archivos auxiliares del repositorio.

---

## [1.2.3] - 2026-10-04

### Añadido
- Traducción automática de historias mediante **LibreTranslate**.
- Soporte de traducción automática a **español** e **inglés**.
- Servidor público de traducción para que los usuarios no necesiten instalar Docker, LibreTranslate ni configurar una API key.
- Caché local de traducciones automáticas para evitar volver a traducir un capítulo ya procesado.
- Mensajes internos del reproductor preparados para mostrarse en español o inglés.

### Traducciones personalizadas
- La antigua sección de traducciones `.txt` pasa a tratarse como **Traducciones personalizadas**.
- Los archivos `.txt` personalizados se mantienen como una capa editable para corregir nombres, términos de lore o frases que no queden bien con la traducción automática.
- Las traducciones personalizadas tienen prioridad sobre la traducción automática cuando existe un archivo compatible para el capítulo.
- Se añade un acceso **Editar .txt** desde la lista de traducciones personalizadas.
- Se mantienen `#ARKSTAGE_TITLE=` y `#LANG=es` / `#LANG=en` como metadatos de los archivos personalizados.

### Importante sobre la primera traducción
- El servidor gratuito de traducción puede entrar en reposo después de un periodo sin uso.
- Cuando está dormido, el primer acceso puede tardar aproximadamente **30–90 segundos** en despertar.
- Una vez despierto, la primera traducción completa de un capítulo puede tardar desde **alrededor de 1 minuto hasta varios minutos**, según la longitud del capítulo y la carga del servidor.
- Los capítulos ya traducidos deberían abrir mucho más rápido gracias a la caché local.

### Cambiado
- La traducción automática pasa a utilizar el servidor público de LibreTranslate.
- Los usuarios finales no necesitan ninguna API key.

---

## [1.2.2] - 2026-10-02

### Añadido
- Botón **Continuar viendo** en la pantalla de inicio.
- Historial de historias recientes.
- Progreso de lectura por categoría/evento con porcentaje.
- Botón **Importar .txt** desde la sección de Traducciones.
- Validación del archivo antes de importarlo.

### Mejorado
- La biblioteca muestra cuántas historias se han leído de cada categoría.
- Importar traducciones ya no requiere copiar manualmente el archivo a la carpeta `translations`.
- Si un archivo importado ya existe, Rhodes Archive conserva ambos con un nombre alternativo.

## [1.2.1] - 2026-10-02

### Añadido
- Filtros por nombre, personaje, estado de traducción e idioma.
- Soporte para metadatos `#LANG=` en archivos de traducción.
- Detección de personajes desde los scripts de traducción.
- Favoritos persistentes para colecciones/historias.
- Filtro para mostrar solo favoritos.
- Badges visuales de idioma, lectura y descarga en las tarjetas.

### Mejorado
- Navegación de la biblioteca y búsqueda de historias.
- Información visual del estado de cada colección.

### Corregido
- Eliminada la traducción automática experimental para volver al sistema estable de archivos `.txt` manuales.

## [1.2.0-alpha] - 2026-10-01

### Añadido
- Primera versión pública alpha de Rhodes Archive.
- Interfaz principal en español.
- Soporte para traducciones externas mediante archivos `.txt`.
- Sección propia de traducciones.
- StoryPlayer a pantalla completa.
- Caché local para acelerar la carga de historias ya abiertas.
- Instalador de Windows x64.
- Branding de Rhodes Archive y logo personalizado.

### Mejorado
- Flujo de carga de historias y compatibilidad con StoryPlayer.
- Manejo de caché y recursos locales.
- Integración de traducciones personalizadas.
