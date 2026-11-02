# VisioStock · Verificación visual

El navegador captura una foto o carga una imagen. El servicio Python detecta objetos de una clase y devuelve cantidad, confianza y coordenadas; la web dibuja las detecciones. El usuario confirma la revisión y Supabase conserva la foto privada, el stock de referencia y la diferencia. Una verificación no modifica el inventario.

## Lo que funciona sin YOLO

Después de ejecutar `supabase/02_verificaciones.sql`, puedes guardar revisiones manuales con foto, consultar evidencia e historial y documentar alertas. El método queda identificado como manual.

## Activar conteo asistido

Desde la raíz del proyecto, en una terminal de VS Code:

```powershell
py -m venv vision/.venv
vision/.venv/Scripts/python.exe -m pip install -r vision/requirements.txt
Copy-Item vision/.env.example vision/.env
```

Configura `vision/.env` con la URL y clave pública del MISMO Supabase de la web. No uses service_role. Añade los pesos de tu modelo en `vision/models/best.pt` y escribe en `VISION_CLASES` los nombres exactos de sus clases. `VISION_MODELO_NOMBRE` debe identificar la versión evaluada del detector.

No se incluyen pesos ni un conjunto de datos entrenado. No se descarga un modelo genérico para presentarlo como detector de productos de Lali. Antes de usarlo con stock real, valida el modelo con imágenes representativas, productos separados, iluminación y distancias del almacén. Una clase genérica como caja no identifica automáticamente el SKU.

Inicia el servicio:

```powershell
vision/.venv/Scripts/python.exe -m uvicorn app:app --app-dir vision --host 127.0.0.1 --port 8000
```

En el `.env` de la web agrega `VITE_VISION_URL=http://127.0.0.1:8000` y reinicia `npm run dev`. Mantén abiertas ambas terminales. El panel muestra si el servicio y el modelo están disponibles.

En Verificación visual: elige producto, foto y clase, pulsa Analizar imagen, revisa las cajas y guarda. Si corriges la cantidad, el registro pasa a manual. Solo se cuenta la clase elegida, no todas las referencias mezcladas en una foto. Una fotografía parcial no permite comparar el stock total de un almacén.

## Servidor y Vercel

La aplicación Vite puede publicarse en Vercel con las variables de Supabase y `VITE_VISION_URL`. Este servicio Python con Ultralytics debe ejecutarse en un servidor independiente con memoria suficiente para el modelo; no se incorpora al frontend estático. Publica el servicio por HTTPS, configura `VISION_ORIGINS` con el dominio exacto de la web y establece el límite de petición en 5 MB en el proxy. Reinicia el servicio al cambiar el modelo o las variables. Usa un solo proceso por modelo para controlar la concurrencia o añade una cola al escalar.

La cámara funciona en localhost o HTTPS y solicita permiso al usuario. Nunca se abre al cargar la portada. Las imágenes del historial se consultan mediante enlaces firmados de 60 segundos.

## Alcance y validación

Esta integración realiza verificación de fotografías, no seguimiento continuo de video ni conteo de cruces por línea. El motor anterior de video necesita una integración separada de dispositivos autenticados para evitar movimientos duplicados. No presenta conteos simulados como detecciones reales.

Se probaron rutas de autenticación, rechazo de productos ajenos por la consulta RLS, imágenes inválidas, límites, clases permitidas, respuesta sin modelo y conteos/coordenadas con un detector simulado. La precisión y el rendimiento del detector real deben medirse con sus pesos y datos; esas pruebas aún no se han realizado.

Documentación: [Ultralytics Predict](https://docs.ultralytics.com/modes/predict/), [Supabase Auth](https://supabase.com/docs/reference/python/auth-getuser), [Storage privado](https://supabase.com/docs/guides/storage/buckets/fundamentals).
