# Servicio de visión para desplegar detrás de un proxy HTTPS (SCRUM-67).
# Los pesos no están en Git: coloca models/best.pt antes de construir.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt
COPY app.py .
COPY models/best.pt models/best.pt

RUN useradd -m -u 1000 vision
USER vision
ENV YOLO_CONFIG_DIR=/tmp/ultralytics PORT=7860
EXPOSE 7860

# Un solo proceso: el modelo y el límite de frecuencia viven en memoria.
# Solo se confía en X-Forwarded-For de un proxy en 127.0.0.1 (el túnel comparte la red del
# contenedor): con --forwarded-allow-ips=* un cliente podría falsear su IP y evadir el límite.
CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port $PORT --workers 1 --proxy-headers"]
