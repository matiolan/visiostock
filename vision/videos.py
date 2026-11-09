"""Utilidades para los videos cortos que envía la web (MP4, MOV o WebM de hasta 5 MB)."""
import os
import tempfile
from contextlib import contextmanager


def extension_video(raw: bytes) -> str | None:
    """Devuelve la extensión si los primeros bytes son de un MP4/MOV o WebM."""
    if raw[4:8] == b'ftyp':
        return '.mp4'
    if raw[:4] == b'\x1a\x45\xdf\xa3':
        return '.webm'
    return None


@contextmanager
def video_temporal(raw: bytes, extension: str):
    """Guarda el video en un archivo temporal (OpenCV lee rutas, no bytes) y lo borra al terminar."""
    archivo = tempfile.NamedTemporaryFile(suffix=extension, delete=False)
    try:
        with archivo:
            archivo.write(raw)
        yield archivo.name
    finally:
        os.unlink(archivo.name)


def propiedades_video(ruta: str) -> tuple[float, float]:
    """Devuelve (cuadros por segundo, duración en segundos), o (0, 0) si no se puede leer."""
    import cv2  # solo se usa con el modelo instalado; las pruebas no lo necesitan
    captura = cv2.VideoCapture(ruta)
    try:
        if not captura.isOpened():
            return 0.0, 0.0
        fps = captura.get(cv2.CAP_PROP_FPS) or 0.0
        cuadros = captura.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0
        if fps <= 0 or fps > 240:
            return 0.0, 0.0
        if cuadros <= 0:  # los WebM grabados en el navegador no siempre indican la cantidad de cuadros
            cuadros = 0
            while captura.grab():
                cuadros += 1
        return fps, cuadros / fps
    finally:
        captura.release()
