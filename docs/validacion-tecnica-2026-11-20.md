# Validación técnica y alcance pendiente - Mia

Fecha: 20/11/2026. Base revisada: main `ca9cc9e`. Rama local: `feature/SCRUM-12-mia-cierre-tres-entrevistas`.

## Resultado comprobado

| Comprobación | Resultado | Límite |
| --- | --- | --- |
| Pruebas web | 63/63 satisfactorias | Pruebas automatizadas del código actual; no sesiones con usuarios. |
| TypeScript y Vite | Compilación satisfactoria | Advertencia de tamaño de bundle; no implica fallo de compilación. |
| Cabeceras/CSP | 3/3 satisfactorias con la URL fija de visión | Valida configuración del repositorio. |
| Navegador local | 14/14 satisfactorias en Chromium de Chrome instalado | Portada, simulación, menú, acceso y recuperación a 360/768/1280 px; Supabase de prueba, sin login real. |
| npm audit | Cero vulnerabilidades reportadas | Estado de las dependencias consultadas el día de ejecución. |
| Pruebas Python de visión | 80/80 satisfactorias | Detector y dependencias externas simulados donde corresponde; no mide precisión real de la cámara. |
| Integración de base de datos | 12 casos nuevos satisfactorios; pruebas existentes de aislamiento, doble factor y horario también pasan | PostgreSQL embebido PGlite local con el stub mínimo de Auth/Storage de CI; no es el Supabase productivo. |
| Control negativo de RLS | T01 falla al retirar RLS de productos | Demuestra que la prueba detecta esa fuga; no se cambió producción. |
| Reversión de fixtures | Cero empresas al finalizar | Las transacciones de prueba terminan en rollback. |

La primera ejecución Python no importó zxingcpp porque faltaba en el entorno local. Tras instalar los requisitos en un directorio aislado, la suite completa pasó. No se cuenta el intento fallido como aprobado.

La descarga del navegador de Playwright agotó el tiempo de espera y el primer arranque con Edge falló en el directorio temporal restringido. Se ejecutó después con Chrome instalado y un directorio temporal de trabajo: 14/14 casos satisfactorios y capturas locales. Se corrigió el runner para invocar Vite mediante Node y usar rutas de archivo compatibles con Windows; no se modificó la configuración personal del navegador.

## Casos nuevos de SCRUM-63

T01: lectura aislada de empresa, almacén y producto A. T02: escritura cruzada rechazada. T03: almacén de otra empresa rechazado. T04: inserción de inventario propio permitida. T05: movimiento, stock y actor coherentes. T06: RPC rechaza producto ajeno. T07: escalamiento de rol denegado. T08: creación de empresa reservada a administrador. T09: aislamiento simétrico y stock B intacto. T10: alta administrativa de empresa/almacén y asignación de cliente. T11: anon no lee inventario. T12: anon no ejecuta movimientos.

Archivo: `supabase/prueba_portal_dos_empresas.sql`. Se incorporó al job `seguridad-sql` y se preparó un artefacto con su salida. El nuevo paso de GitHub Actions sigue pendiente de publicación/ejecución remota; no se afirma que ya esté verde en GitHub.

## Comprobación HTTP publicada

El 20/11 ambas portadas respondieron HTTP 200. `https://visiostock.vercel.app/` envía las cuatro cabeceras y permite la URL fija de visión en connect-src. `https://visiostock-mia.vercel.app/` responde, pero conserva una CSP que no permite el origen de visión; no debe presentarse como la misma compilación actualizada.

La petición de esta revisión a `https://vastec-portatil.tail86ca65.ts.net/estado` no completó la negociación TLS. No se deshabilitó la validación del certificado. Esto no demuestra por sí solo que el servicio esté apagado; no fue posible confirmar su estado desde esta conexión. El cierre de Matio del 10/11 documenta una comprobación anterior satisfactoria.

## Qué continúa pendiente

- SCRUM-51: cámara física y detector reales; comparar cantidades, sentido y latencia hasta dashboard por caso.
- SCRUM-63: login y flujos completos con dos empresas en la web publicada. Las pruebas SQL nuevas cubren backend, no reemplazan esa aceptación.
- SCRUM-14/SCRUM-37: sesiones con usuarios y métricas reales. El cambio a tres entrevistas no altera automáticamente las cinco sesiones previstas.
- Incorporar fechas/perfiles/consentimiento reales de las tres entrevistas si están disponibles. No se han inventado.
- Publicar esta rama y abrir PR para revisión. El conector GitHub rechazó escritura (403); el push normal no obtuvo credenciales. Los archivos y commits locales no se presentan como publicados.

La entrega documental completa el análisis y los protocolos. No acredita como realizadas las actividades físicas o de campo que requieren evidencia adicional.
