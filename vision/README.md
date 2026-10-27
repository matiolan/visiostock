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
