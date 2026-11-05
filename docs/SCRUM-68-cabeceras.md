# SCRUM-68: cabeceras de seguridad de la web

Las cuatro cabeceras de `web/vercel.json` se aplican a todas las rutas y archivos estáticos del despliegue en Vercel.

| Cabecera | Configuración y finalidad |
| --- | --- |
| Content-Security-Policy | Scripts del propio sitio; fuentes de Google Fonts; conexiones e imágenes del proyecto Supabase autorizado. Bloquea plugins, marcos, cambios de URL base y scripts inline/eval. |
| X-Frame-Options | `DENY`: impide incrustar la aplicación en un iframe. Se complementa con `frame-ancestors 'none'`. |
| X-Content-Type-Options | `nosniff`: exige respetar el tipo de contenido declarado. |
| Referrer-Policy | `strict-origin-when-cross-origin`: limita la información de la URL enviada a otros orígenes. |

La CSP permite imágenes locales `blob:`/`data:` y el almacenamiento del proyecto `bkedmoshqaulckhvnclx`, así como HTTPS y WebSocket hacia ese mismo proyecto. No permite todos los subdominios de Supabase. Google Fonts utiliza `fonts.googleapis.com` para CSS y `fonts.gstatic.com` para tipografías. La cámara conserva su control normal de permisos.

`VITE_VISION_URL` todavía no está configurada en producción. Antes de activar el servicio de visión o cambiar de proyecto Supabase, se debe añadir su origen HTTPS exacto a `connect-src` y repetir la validación. No se debe resolver permitiendo cualquier origen o scripts inline.

## Publicación y comprobación

1. Ejecutar `npm ci`, `npm test` y `npm run build` desde `web/`; revisar los análisis de seguridad del pipeline de la rama/PR.
2. Publicar la configuración junto con la compilación. En el proyecto de Vercel Drop, subir únicamente `dist/` y un `vercel.json` con `headers`, `redirects` y `rewrites`; el archivo de despliegue estático no necesita volver a ejecutar el build.
3. Comprobar por HTTPS las cuatro cabeceras en `/`, `/acceso`, `/recuperar`, `/portal` y un archivo JS/CSS. El dominio anterior conserva la redirección a `visiostock-mia.vercel.app`.
4. Abrir portada, login y recuperación; comprobar que cargan los estilos/fuentes y que no aparecen bloqueos CSP de recursos legítimos. Con una cuenta autorizada, repetir la revisión de una foto y su almacenamiento.

La corrección de la vista previa mediante canvas pertenece a la PR #8 de Matio. Esta entrega añade las cabeceras y no atribuye esa implementación a Mia. La evidencia final de despliegue y comprobaciones se registra en SCRUM-68.
