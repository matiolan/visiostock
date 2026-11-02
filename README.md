# VisioStock

Gestión de inventario y verificación visual por empresa. La web renovada reemplaza el prototipo anterior y conserva el historial del repositorio.

- `web/`: React, TypeScript y Vite. Portada pública y panel privado con login Supabase, inventario, CSV, movimientos, verificaciones con foto y alertas.
- `supabase/`: esquema inicial y migración de verificaciones, con acceso por empresa y evidencia privada.
- `vision/`: servicio Python de análisis de fotografías y pruebas. Requiere pesos de un detector validado; no se incluyen resultados simulados como detecciones reales.
- `docs/`: documentación académica conservada del proyecto.

## Ejecutar la web

Desde `web/`: `npm ci`, copiar `.env.example` a `.env`, configurar las dos variables públicas de Supabase y ejecutar `npm run dev`.

Si tu base ya está configurada, no repitas el esquema inicial. Ejecuta únicamente las migraciones que te falten. La migración `supabase/02_verificaciones.sql` ya fue aplicada al proyecto Supabase configurado durante la renovación.

## Publicar en Vercel

Utiliza el proyecto existente conectado a este repositorio. Root Directory: `web`. Framework: Vite. Build: `npm run build`. Output: `dist`. Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_VISION_URL` se configura cuando el servicio Python esté desplegado por HTTPS. `web/vercel.json` conserva las rutas de la aplicación al recargar.

Configura en Supabase Authentication → URL Configuration la URL pública y la redirección `/recuperar`.

## Comprobar

En `web/`, `npm test` comprueba el lector CSV y `npm run build` valida TypeScript y la compilación. Para las pruebas del servicio: instala `vision/requirements-test.txt` y ejecuta `python -m unittest discover -s vision -p "test_*.py"`. Estas pruebas usan un detector simulado; no evalúan la precisión de pesos reales.

El conteo automático necesita modelo y servicio activos. La captura y el conteo manual con evidencia pueden usarse sin YOLO. Consulta `vision/README.md` para configurar el detector.
