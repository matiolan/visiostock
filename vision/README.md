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

### Identificar el producto por código (HU-07)

Con una foto cargada, **Identificar por código** envía la imagen a `POST /identificar`, que lee códigos QR, DataMatrix, EAN/UPC, Code128, Code39, Code93 e ITF con zxing-cpp. La web busca el SKU leído entre los productos que el usuario puede ver (RLS) y lo selecciona; si el SKU existe en varios almacenes, pide elegir el correcto. El código puede contener solo el SKU, `SKU:ABC-1` o un enlace con `?sku=ABC-1`. Este endpoint no necesita el modelo YOLO, solo una sesión válida.

**Movimientos por video.** En **Movimientos → Registrar movimientos por video** se graba hasta 10 s o se carga un video (máx. 5 MB y 30 s) y `POST /movimientos` sigue las cajas con ByteTrack. Cada caja que cruza la línea (arriba → abajo = entrada) es un movimiento, y el SKU se lee del recorte de esa caja. Si el código no se lee, el movimiento queda **NO IDENTIFICADO** con la imagen de la caja (`supabase/05_movimientos_sin_sku.sql`) y no cambia el stock hasta que alguien asigna el producto.

Para medir la tasa de lectura (criterio ≥ 90 %) con un video controlado y un CSV `orden,sentido,sku`:

```powershell
python vision/evaluar_sku.py video.mp4 esperado.csv --modelo vision/models/best.pt
```

Con un video sintético de 50 cajas (QR y Code128, 3 sin código legible) el resultado fue 50/50. Falta medirlo con cajas reales.

### Cámaras IP y zonas (HU-17)

En **Cámaras y zonas** se registran cámaras del equipo o cámaras IP con su URL RTSP y su línea virtual. `POST /camaras/probar` recibe hasta 4 cámaras y atiende cada una en su propio hilo con su copia del modelo:

- **Chequeo** (`procesar: false`): abre la URL y lee unos segundos. La web lo repite cada 15 s mientras **Monitorear cámaras IP** está activo y guarda la señal con `vs_senal_camara`. Una cámara con más de 60 s sin señal queda **desconectada**, aparece una alerta (y una notificación del navegador si se permitió) y su zona queda **sin monitoreo** si no tiene otra cámara IP en línea.
- **Procesamiento simultáneo** (`procesar: true`): detecta, sigue y cuenta cruces en cada cámara durante 10 s y devuelve los FPS de cada una. Los movimientos se atribuyen a la cámara (y por lo tanto a su zona) que los vio. Con 4 transmisiones RTSP simuladas (mediamtx) en un CPU de escritorio, a resolución de inferencia 416, cada cámara procesó entre 11,4 y 13,6 FPS; a 640 no llegaba a 10.

Solo se aceptan URLs `rtsp://` o `rtsps://`. El servicio se conecta a la dirección que indique el usuario autenticado, así que debe ejecutarse en la red del almacén y no tener acceso a servicios internos sensibles. Usa en cada cámara una cuenta que solo pueda ver video.
### Manipulación incorrecta (HU-08)

La vista **Manipulación** graba hasta 10 s con la cámara o carga un video MP4, MOV o WebM (máximo 5 MB y 30 s) y lo envía a `POST /manipulacion`. El servicio sigue cada caja con ByteTrack a unos 8 cuadros por segundo y avisa:

- **Caída:** la caja baja más de 3 alturas de caja por segundo, o se pierde en el aire y reaparece al menos 1,5 alturas más abajo en menos de 2 s (pasa cuando el movimiento la vuelve borrosa o queda tapada en el suelo).
- **Golpe:** venía a más de 1,5 alturas por segundo y frena más de 15 alturas/s² entre dos cuadros.
- **Apilamiento indebido:** más de `VISION_MAX_APILADO` cajas (4 por defecto) en una misma columna. En una foto, `POST /analizar` también lo informa.

Cada alerta trae la captura del cuadro con la caja marcada en rojo. Al registrarla, la captura se sube como evidencia privada y queda en la incidencia (`supabase/07_manipulacion.sql`); se revisa desde el historial. Medir en alturas de caja hace que los umbrales no dependan de la distancia de la cámara.

Para medir la precisión (criterio: ≥ 75 % de eventos detectados con ≤ 15 % de falsos positivos) con clips etiquetados en un CSV `archivo,esperado`:

```powershell
python vision/evaluar_manipulacion.py clips/clips.csv --modelo vision/models/best.pt
```

Con 20 eventos sintéticos (8 caídas, 6 golpes, 6 pilas) y 20 movimientos normales se detectó el 90 % (18/20) con 0 % de falsos positivos. Falta repetir la medición con videos reales del almacén y ajustar los umbrales si hace falta.

## Servidor y Vercel

La aplicación Vite puede publicarse en Vercel con las variables de Supabase y `VITE_VISION_URL`. Este servicio Python con Ultralytics debe ejecutarse en un servidor independiente con memoria suficiente para el modelo; no se incorpora al frontend estático. Reinicia el servicio al cambiar el modelo o las variables. Usa un solo proceso por modelo para controlar la concurrencia o añade una cola al escalar.

### Límites contra abuso

- **Tamaño:** una petición de más de 5 MB (más 64 KB del formulario) recibe 413, aunque no declare `Content-Length`.
- **Frecuencia:** `POST /analizar` admite `VISION_LIMITE_POR_MINUTO` análisis por minuto y por IP (20 por defecto); después responde 429 con `Retry-After`. El contador vive en memoria, por eso requiere un solo proceso, y detrás de un proxy necesita `--proxy-headers`.

### Despliegue por HTTPS

`vision/Dockerfile` construye el servicio con PyTorch para CPU. Los pesos no están en Git: coloca `vision/models/best.pt` antes de construir. El túnel de Cloudflare da la URL HTTPS sin abrir puertos ni usar una cuenta, y comparte la red del contenedor porque el servicio solo acepta `X-Forwarded-For` desde `127.0.0.1`. La URL aparece en el registro del túnel, cambia cada vez que este se reinicia y deja de responder si el equipo se apaga.

```powershell
docker build -t visiostock-vision vision
docker run -d --name visiostock-vision --env-file vision/.env visiostock-vision
docker run -d --name visiostock-tunel --network container:visiostock-vision cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://127.0.0.1:7860
docker logs visiostock-tunel
```

Al tener la URL pública del servicio:

1. Configura `VISION_ORIGINS` con el dominio exacto de la web.
2. Agrega la URL al `connect-src` de la CSP en `web/vercel.json`; sin esto el navegador bloquea las llamadas.
3. Define `VITE_VISION_URL` en Vercel y vuelve a publicar la web: el valor se fija al compilar.

La cámara funciona en localhost o HTTPS y solicita permiso al usuario. Nunca se abre al cargar la portada. Las imágenes del historial se consultan mediante enlaces firmados de 60 segundos.

## Alcance y validación

Esta integración realiza verificación de fotografías, no seguimiento continuo de video ni conteo de cruces por línea. El motor anterior de video necesita una integración separada de dispositivos autenticados para evitar movimientos duplicados. No presenta conteos simulados como detecciones reales.

Se probaron rutas de autenticación, rechazo de productos ajenos por la consulta RLS, imágenes inválidas, límites, clases permitidas, respuesta sin modelo y conteos/coordenadas con un detector simulado. La precisión y el rendimiento del detector real deben medirse con sus pesos y datos; esas pruebas aún no se han realizado.

Documentación: [Ultralytics Predict](https://docs.ultralytics.com/modes/predict/), [Supabase Auth](https://supabase.com/docs/reference/python/auth-getuser), [Storage privado](https://supabase.com/docs/guides/storage/buckets/fundamentals).
