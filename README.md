# VisioStock

Tu almacén, contado y con prueba. Una cámara con visión artificial que cuenta cada caja que entra o sale de una zona del almacén y guarda la foto de cada movimiento.

Proyecto Final de Carrera III · USIL · Grupo 4

| Carpeta | Contenido | Responsable |
| --- | --- | --- |
| `web/` | App Next.js (inicio, panel, inventario, API), desplegada en Vercel | Todo el equipo |
| `web/app/dashboard` | Panel de stock registrado vs. detectado (HU-12) | Matio Peña |
| `web/app/api`, `web/app/inventario`, `supabase/` | API de movimientos e importador (HU-09, HU-10) | Alvaro Chavez |
| `vision/` | Detección, seguimiento y conteo de cajas con YOLO (HU-05, HU-06) | Henry Pillpe |
| `web/app/page.tsx`, `web/app/validacion`, `docs/` | Página de inicio e investigación con clientes (HU-01 a HU-04) | Mia Saavedra |

## Desarrollo local

```bash
cd web
cp .env.example .env.local   # pegar las claves que comparte el equipo
npm install
npm run dev
```

Cada integrante trabaja en su rama (`feature/nombre-hu-xx`) y une sus cambios a `main` con un Pull Request. Al unirse, Vercel publica el cambio en producción.
