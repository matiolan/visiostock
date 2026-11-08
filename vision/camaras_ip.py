"""HU-17 · Cámaras IP por RTSP: chequeo de señal y procesamiento simultáneo con conteo por zona.

Cada cámara se atiende en su propio hilo con su propia copia del modelo, porque un modelo YOLO
con seguimiento guarda estado y no se puede compartir entre hilos.
"""
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

from PIL import Image

from movimientos import BANDA, ContadorLinea, jpeg_base64

MAX_CAMARAS = 4
ESPERA_MS = 5000  # tiempo máximo para conectar o recibir un cuadro
IMGSZ = 416  # resolución de inferencia en video: con 4 cámaras en CPU, 640 no llega a 10 FPS


def url_valida(url: str) -> bool:
    try:
        partes = urlsplit(url)
    except ValueError:
        return False
    return partes.scheme in ('rtsp', 'rtsps') and bool(partes.hostname) and len(url) <= 500 and not any(c.isspace() for c in url)


def sin_clave(url: str) -> str:
    """La URL sin usuario ni clave, para mostrarla en mensajes."""
    partes = urlsplit(url)
    return partes._replace(netloc=partes.hostname + (f':{partes.port}' if partes.port else '')).geturl()


def abrir(url: str):
    import cv2
    return cv2.VideoCapture(url, cv2.CAP_FFMPEG, [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, ESPERA_MS,
                                                   cv2.CAP_PROP_READ_TIMEOUT_MSEC, ESPERA_MS])


def probar_camara(camara: dict, segundos: float, cargar_modelo=None, clases=None, conf: float = .5) -> dict:
    """Lee la cámara durante `segundos`. Con `cargar_modelo`, además detecta, sigue y cuenta cruces."""
    resultado = {'id': camara['id'], 'en_linea': False, 'fps': 0.0, 'cuadros': 0, 'movimientos': [], 'miniatura': None}
    captura = abrir(camara['url'])
    try:
        if not captura.isOpened():
            return resultado
        modelo = cargar_modelo() if cargar_modelo else None
        contador, ultimo, cuadros = None, None, 0
        inicio = time.monotonic()
        while time.monotonic() - inicio < segundos:
            ok, cuadro = captura.read()
            if not ok:
                break
            cuadros += 1
            ultimo = cuadro
            if modelo is None:
                continue
            alto = cuadro.shape[0]
            contador = contador or ContadorLinea(alto * camara['linea'], alto * BANDA)
            r = modelo.track(cuadro, persist=True, tracker='bytetrack.yaml', classes=clases, conf=conf, imgsz=IMGSZ,
                             verbose=False)[0]
            if r.boxes is None or r.boxes.id is None:
                continue
            for xyxy, track_id in zip(r.boxes.xyxy.tolist(), r.boxes.id.int().tolist()):
                sentido = contador.actualizar(track_id, (xyxy[1] + xyxy[3]) / 2)
                if sentido:
                    resultado['movimientos'].append({'sentido': sentido, 'segundo': round(time.monotonic() - inicio, 2)})
        transcurrido = time.monotonic() - inicio
        if cuadros:
            resultado.update(en_linea=True, cuadros=cuadros, fps=round(cuadros / max(transcurrido, 1e-6), 1),
                             miniatura=jpeg_base64(Image.fromarray(ultimo[:, :, ::-1])))
        return resultado
    finally:
        captura.release()


def probar_camaras(camaras: list[dict], segundos: float, cargar_modelo=None, clases=None, conf: float = .5) -> list[dict]:
    """Atiende hasta MAX_CAMARAS a la vez, cada una en su hilo."""
    with ThreadPoolExecutor(max_workers=MAX_CAMARAS) as hilos:
        return list(hilos.map(lambda c: probar_camara(c, segundos, cargar_modelo, clases, conf), camaras))
