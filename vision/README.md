# vision · Detección y conteo de cajas

Responsable: Henry Pillpe (HU-05, HU-06).

## Instalación

```bash
cd vision
python -m venv .venv
.venv\Scripts\activate        # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env          # completar VISION_API_KEY y la fuente de video
```

## HU-05 · Detección

`detector.py` envuelve YOLOv8n. `yolov8n.pt` (COCO) se descarga solo y sirve para probar el flujo; para contar cajas reales se usa un modelo entrenado con cajas (`MODELO=cajas.pt`, `CLASES=caja`). Los `.pt` no se suben al repo.

## HU-06 · Seguimiento y conteo

`main.py` sigue cada caja con ByteTrack (id estable entre cuadros) y `contador.py` la cuenta una sola vez cuando su centro cruza la línea `LINEA_Y`: de arriba hacia abajo es **entrada**, de abajo hacia arriba es **salida**. Cada cruce se envía a `POST /api/movimientos` con la foto del momento (`enviar.py`).

```bash
python main.py --fuente video.mp4 --mostrar --sin-envio   # probar sin tocar la base
python main.py                                            # cámara de .env, enviando a la API
pytest tests                                              # pruebas del contador
```
