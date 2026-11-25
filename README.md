# VisioStock

Gestión de inventario y verificación visual por empresa: una cámara con visión artificial cuenta las cajas que entran y salen de cada zona del almacén, guarda la foto de cada movimiento y el panel compara el stock del sistema con lo detectado.

**Web publicada: https://visiostock.vercel.app** (despliegue de `main`). La publicación manual anterior sigue en https://visiostock-mia.vercel.app.

- `web/`: React, TypeScript y Vite. Portada pública con simulación y panel privado: inventario con importación CSV, movimientos (manuales, por video y conteo en vivo por zonas), verificaciones con foto, alertas, horario laboral, cámaras y zonas, manipulación incorrecta, reportes y seguridad (doble factor). Acceso con Google.
- `supabase/`: esquema y migraciones numeradas, con acceso por empresa (RLS), evidencia privada y pruebas SQL con datos ficticios.
- `vision/`: servicio Python (FastAPI + YOLO) de conteo, lectura de códigos, seguimiento en video, cámaras IP y detección de cajas dañadas. Requiere pesos de un detector validado; no se incluyen resultados simulados como detecciones reales.
- `docs/`: documentación académica (entrevistas, hipótesis, Lean Canvas, mapa de empatía) y de arquitectura y seguridad.

## Ejecutar la web

Desde `web/`: `npm ci`, copiar `.env.example` a `.env`, configurar las dos variables públicas de Supabase y ejecutar `npm run dev`.

Si tu base ya está configurada, no repitas el esquema inicial. Ejecuta únicamente las migraciones que te falten. La migración `supabase/02_verificaciones.sql` ya fue aplicada al proyecto Supabase configurado durante la renovación.

Orden de los scripts de `supabase/` (todos se ejecutan en el SQL Editor como postgres). Cada uno se puede repetir sin borrar datos. La columna de estado solo registra lo que el equipo confirmó: **confirma en tu proyecto antes de repetir o saltarte uno**.

| Script | Contenido | Estado en producción |
| --- | --- | --- |
| `esquema.sql` | Tablas, RLS y funciones base | Aplicado |
| `02_verificaciones.sql` | Verificaciones con evidencia | Aplicado |
| `03_endurecer_seguridad.sql` | Quita EXECUTE a `anon` (SCRUM-72). Vuelve a correrlo al final cuando agregues migraciones con funciones nuevas | Aplicado el 07/11/2026 |
| `04_reporte_semanal.sql` | Reporte semanal automático con pg_cron, lunes 08:00 Lima (SCRUM-71) | Aplicado el 07/11/2026 |
| `05_movimientos_sin_sku.sql` | Movimientos por video sin código legible, con su imagen, hasta asignarles producto (HU-07) | Por confirmar |
| `06_camaras_zonas.sql` | Zonas por almacén y cámaras por zona (HU-17) | Por confirmar |
| `07_manipulacion.sql` | Incidencias de manipulación incorrecta con evidencia (HU-08) | Por confirmar |
| `08_auditoria_inmutable.sql` y `09_corregir_cadena_hash.sql` | Auditoría inmodificable con cadena de hash (HU-11, SCRUM-21). En revisión en el PR #19: todavía no están en `main` | Pendiente |
| `10_doble_factor.sql` | Doble factor TOTP exigido por la base (SCRUM-74) | Por confirmar |
| `11_horario_laboral.sql` | Horario laboral, feriados, zona y evidencia opcional en movimientos (HU-16, SCRUM-26) | Por confirmar |
| `12_zonas_conteo.sql` | Guarda las zonas A/B del conteo en vivo por cámara (SCRUM-80). Sin ella quedan solo en el navegador | Por confirmar |

Orden recomendado si aplicas varias de una vez: `06`, `10`, `11`, `12`, luego `08` y `09` cuando el #19 esté en `main`, y `03` al final.

Pruebas con datos ficticios y `rollback` (no dejan datos): `prueba_aislamiento.sql`, `prueba_reporte_semanal.sql`, `prueba_doble_factor.sql` y `prueba_horario_laboral.sql`. El pipeline las corre contra PostgreSQL 16 real.

Las vistas de la web que usan cada migración están descritas en `vision/README.md`: **Cámaras y zonas** (cámaras del equipo o IP por RTSP, activarlas o verlas en vivo), **Manipulación** y **Movimientos** (por video y conteo en vivo).

## Publicar en Vercel

El repositorio está conectado a Vercel: cada PR recibe una vista previa y `main` se publica en https://visiostock.vercel.app. Configuración del proyecto: Root Directory `web`, framework Vite, build `npm run build`, salida `dist`. Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y, para el servicio de visión publicado por HTTPS, `VITE_VISION_URL`. `web/vercel.json` conserva las rutas de la aplicación al recargar y define las cabeceras de seguridad (ver `docs/SCRUM-68-cabeceras.md`).

Configura en Supabase Authentication → URL Configuration la URL pública y la redirección `/recuperar`. Las vistas previas de Vercel están protegidas por inicio de sesión de Vercel.

## Comprobar

En `web/`, `npm test` corre las pruebas de la lógica de la web (CSV, SKU, conteo en vivo, cámaras, acceso, panel…) y `npm run build` valida TypeScript y la compilación. Para las pruebas del servicio: instala `vision/requirements-test.txt` y ejecuta `python -m unittest discover -s vision -p "test_*.py"`. Estas pruebas usan un detector simulado; no evalúan la precisión de pesos reales.

El conteo automático necesita modelo y servicio activos. La captura y el conteo manual con evidencia pueden usarse sin YOLO. Consulta `vision/README.md` para configurar el detector.

## Pruebas de seguridad en el pipeline (SCRUM-65)

El workflow `Comprobar VisioStock` corre en cada push de **cualquier rama** y en cada PR hacia `main`. Además de las pruebas funcionales ejecuta cuatro controles de seguridad; si cualquiera encuentra un problema, el pipeline falla y el PR no debe fusionarse:

| Job | Herramienta | Qué revisa |
| --- | --- | --- |
| Seguridad · dependencias web | `npm audit --audit-level=moderate` | Vulnerabilidades conocidas en paquetes de `web/` |
| Seguridad · dependencias visión | `pip-audit` | Vulnerabilidades conocidas en `vision/requirements*.txt` |
| Seguridad · secretos expuestos | gitleaks | Claves, tokens o contraseñas en el código y el historial |
| Seguridad · análisis estático | CodeQL (`security-extended`) | Inyecciones, XSS, rutas inseguras y otros patrones en JS/TS y Python |

Flujo de trabajo: crea tu rama `feature/SCRUM-xx-...`, haz push y revisa la pestaña **Actions**. Si un job de seguridad falla, corrige en tu misma rama (el log indica el paquete o la línea) y vuelve a hacer push hasta que todo esté en verde; recién entonces abre o fusiona el PR. Las alertas de CodeQL también quedan en **Security → Code scanning**.
