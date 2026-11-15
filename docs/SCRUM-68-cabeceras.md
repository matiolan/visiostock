# SCRUM-68: cabeceras de seguridad de la web

Las cuatro cabeceras de `web/vercel.json` se aplican a todas las rutas y archivos estáticos del despliegue en Vercel.

| Cabecera | Configuración y finalidad |
| --- | --- |
| Content-Security-Policy | Scripts del propio sitio; fuentes de Google Fonts; conexiones e imágenes del proyecto Supabase autorizado. Bloquea plugins, marcos, cambios de URL base y scripts inline/eval. |
| X-Frame-Options | `DENY`: impide incrustar la aplicación en un iframe. Se complementa con `frame-ancestors 'none'`. |
| X-Content-Type-Options | `nosniff`: exige respetar el tipo de contenido declarado. |
| Referrer-Policy | `strict-origin-when-cross-origin`: limita la información de la URL enviada a otros orígenes. |

La CSP permite imágenes locales `blob:`/`data:` y el almacenamiento del proyecto `bkedmoshqaulckhvnclx`, así como HTTPS y WebSocket hacia ese mismo proyecto. No permite todos los subdominios de Supabase. Google Fonts utiliza `fonts.googleapis.com` para CSS y `fonts.gstatic.com` para tipografías. La cámara conserva su control normal de permisos.

El 10 de noviembre de 2026 el túnel temporal de Cloudflare se reemplazó por Tailscale Funnel, con la dirección fija `VITE_VISION_URL=https://vastec-portatil.tail86ca65.ts.net` en Vercel. Esta corrección incorpora ese origen HTTPS exacto a `connect-src`. El pipeline valida su presencia usando la variable del repositorio o esta URL como valor predeterminado. Antes de cambiar el túnel o el proyecto Supabase, se deben actualizar tanto la variable de Vercel como la CSP y repetir la validación. No se debe resolver permitiendo cualquier origen o scripts inline. La disponibilidad del túnel depende del equipo que ejecuta Docker; guardar la URL no demuestra que el servicio esté accesible.

## Publicación y comprobación

1. Ejecutar `npm ci`, `npm test` y `npm run build` desde `web/`; revisar los análisis de seguridad del pipeline de la rama/PR.
2. Revisar y fusionar esta corrección respetando la protección de `main`. El proyecto de Vercel utiliza Vite y Root Directory `web`. La conexión nativa de Git sigue pendiente de la autorización del propietario de `matiolan/visiostock`; Mia eligió esperar esa conexión y no crear un token ni un workflow alternativo de publicación. Tras conectarlo, confirmar un despliegue del commit de `main` con las variables públicas de Supabase y visión configuradas. Hasta entonces, no considerar esta corrección publicada.
3. Comprobar por HTTPS las cuatro cabeceras en `/`, `/acceso`, `/recuperar`, `/portal` y un archivo JS/CSS. Se quitó la redirección de `visiostock.vercel.app` a la publicación manual `visiostock-mia.vercel.app`: el dominio principal sirve el despliegue de `main` y el servicio de visión admite ambos orígenes.
4. Abrir portada, login y recuperación; comprobar que cargan los estilos/fuentes y que no aparecen bloqueos CSP de recursos legítimos. Con una cuenta autorizada, repetir la revisión de una foto y su almacenamiento.

La corrección de la vista previa mediante canvas pertenece a la PR #8 de Matio. Esta entrega añade las cabeceras y no atribuye esa implementación a Mia. La evidencia final de despliegue y comprobaciones se registra en SCRUM-68.
