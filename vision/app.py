"""Conteo de una fotografía. No modifica stock ni usa una service_role.

El token de Supabase se valida con Auth y se usa para consultar el producto con RLS.
Requiere pesos locales de un detector validado, nunca descarga un modelo genérico.
"""
import io
import os
import threading
import time
import warnings
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError

load_dotenv(Path(__file__).with_name('.env'))
MODELO = None
CLASES: list[str] = []
MOTIVO = 'Falta configurar un modelo validado para los productos del almacén.'
LOCK = threading.Lock()
Image.MAX_IMAGE_PIXELS = 20_000_000
MAX_PETICION = 5 * 1024 * 1024 + 64 * 1024  # imagen de 5 MB más los campos del formulario
POR_MINUTO = int(os.getenv('VISION_LIMITE_POR_MINUTO', '20'))
VISITAS: dict[str, deque] = {}


def espera_frecuencia(ip: str) -> int:
    """Ventana de 60 s por IP. Devuelve los segundos de espera, o 0 si la petición pasa."""
    ahora = time.monotonic()
    if len(VISITAS) > 10_000:
        for clave in [c for c, v in VISITAS.items() if not v or v[-1] <= ahora - 60]:
            del VISITAS[clave]
    visitas = VISITAS.setdefault(ip, deque())
    while visitas and visitas[0] <= ahora - 60:
        visitas.popleft()
    if len(visitas) >= POR_MINUTO:
        return int(visitas[0] + 60 - ahora) + 1 if visitas else 60
    visitas.append(ahora)
    return 0


class Protecciones:
    """Frena el abuso antes de consultar Supabase o usar el detector.

    Va dentro de CORS para que el navegador pueda leer el error. El cuerpo se acumula
    aquí porque FastAPI convertiría en 400 un error lanzado mientras lee el formulario.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        if scope['method'] == 'POST' and scope['path'] == '/analizar':
            espera = espera_frecuencia((scope.get('client') or ('desconocido',))[0])
            if espera:
                respuesta = JSONResponse({'detail': 'Demasiados análisis seguidos. Inténtalo en un minuto.'}, 429,
                                         headers={'Retry-After': str(espera)})
                return await respuesta(scope, receive, send)
        muy_grande = JSONResponse({'detail': 'La petición supera el límite de 5 MB.'}, 413)
        largo = dict(scope['headers']).get(b'content-length', b'0')
        if largo.isdigit() and int(largo) > MAX_PETICION:
            return await muy_grande(scope, receive, send)
        partes, total = [], 0
        while True:
            mensaje = await receive()
            if mensaje['type'] != 'http.request':
                return
            total += len(mensaje.get('body', b''))
            if total > MAX_PETICION:  # chunked: no declara Content-Length
                return await muy_grande(scope, receive, send)
            partes.append(mensaje.get('body', b''))
            if not mensaje.get('more_body'):
                break
        entregado = False

        async def repetir():
            nonlocal entregado
            if entregado:
                return await receive()
            entregado = True
            return {'type': 'http.request', 'body': b''.join(partes), 'more_body': False}

        await self.app(scope, repetir, send)


def abrir_imagen(raw: bytes):
    if not raw or len(raw) > 5 * 1024 * 1024:
        raise HTTPException(413, 'La imagen debe tener entre 1 byte y 5 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as original:
                if original.format not in ('JPEG', 'PNG', 'WEBP'):
                    raise HTTPException(415, 'Solo se admiten imágenes JPG, PNG o WebP.')
                original.load()
                return ImageOps.exif_transpose(original).convert('RGB')
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, 'La imagen no es válida o su resolución es demasiado grande.') from None


def autorizar(token: str, producto: str):
    url = os.getenv('SUPABASE_URL', '').rstrip('/')
    key = os.getenv('SUPABASE_PUBLISHABLE_KEY', '')
    if not url or not key:
        raise HTTPException(503, 'El servicio de visión necesita la conexión a Supabase.')
    headers = {'apikey': key, 'Authorization': f'Bearer {token}'}
    try:
        with httpx.Client(timeout=12) as client:
            user = client.get(url + '/auth/v1/user', headers=headers)
            if user.status_code != 200:
                raise HTTPException(401, 'Tu sesión no es válida. Inicia sesión de nuevo.')
            # RLS verifica el acceso a la empresa; no se acepta empresa del formulario.
            result = client.get(url + '/rest/v1/vs_productos', headers=headers,
                                params={'select': 'id', 'id': f'eq.{producto}'})
            if result.status_code != 200 or not result.json():
                raise HTTPException(403, 'No tienes acceso al producto seleccionado.')
    except httpx.HTTPError:
        raise HTTPException(503, 'No se pudo verificar la sesión con Supabase.') from None


@asynccontextmanager
async def lifespan(app):
    global MODELO, CLASES, MOTIVO
    ruta = Path(os.getenv('VISION_MODELO', 'models/best.pt'))
    if not ruta.is_absolute():
        ruta = Path(__file__).parent / ruta
    permitidas = [c.strip() for c in os.getenv('VISION_CLASES', '').split(',') if c.strip()]
    if ruta.is_file() and permitidas:
        try:
            from ultralytics import YOLO
            modelo = YOLO(str(ruta))
            if not set(permitidas).issubset(set(modelo.names.values())):
                raise ValueError('Clases desconocidas')
            if modelo.task != 'detect':
                raise ValueError('Se requiere un detector')
            MODELO, CLASES = modelo, permitidas
            MOTIVO = 'Modelo disponible. Verifica que la clase elegida corresponda al producto.'
        except Exception:
            MOTIVO = 'No se pudo cargar el modelo o sus clases. Revisa la configuración del servicio.'
    yield


app = FastAPI(title='VisioStock · Servicio de visión', lifespan=lifespan)
app.add_middleware(Protecciones)
app.add_middleware(CORSMiddleware,
    allow_origins=[s.strip() for s in os.getenv('VISION_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if s.strip()],
    allow_methods=['GET', 'POST'], allow_headers=['Authorization', 'Content-Type'])


@app.get('/estado')
def estado():
    return {'listo': MODELO is not None, 'clases': CLASES, 'mensaje': MOTIVO}


@app.post('/analizar')
def analizar(imagen: UploadFile = File(...), producto: UUID = Form(...), clase: str = Form(...),
             authorization: str = Header(default='')):
    if not authorization.startswith('Bearer ') or not authorization[7:].strip():
        raise HTTPException(401, 'Falta la sesión de acceso.')
    autorizar(authorization[7:], str(producto))
    if MODELO is None:
        raise HTTPException(503, MOTIVO)
    if clase not in CLASES:
        raise HTTPException(422, 'Selecciona una clase habilitada en el modelo.')
    imagen_rgb = abrir_imagen(imagen.file.read(5 * 1024 * 1024 + 1))
    ids = [i for i, nombre in MODELO.names.items() if nombre == clase]
    if not LOCK.acquire(blocking=False):
        raise HTTPException(429, 'El detector está procesando otra imagen. Inténtalo en unos segundos.')
    try:
        resultado = MODELO.predict(imagen_rgb, classes=ids, conf=.5, max_det=500, verbose=False)[0]
        cajas = []
        if resultado.boxes is not None:
            for xy, confianza in zip(resultado.boxes.xyxy.tolist(), resultado.boxes.conf.tolist()):
                x1, y1, x2, y2 = xy
                cajas.append({'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'confianza': float(confianza)})
        return {'conteo': len(cajas), 'cajas': cajas, 'clase': clase,
                'modelo': os.getenv('VISION_MODELO_NOMBRE', 'Detector del almacén')[:160],
                'ancho': imagen_rgb.width, 'alto': imagen_rgb.height}
    except Exception:
        raise HTTPException(503, 'No se pudo completar el análisis con el modelo instalado.') from None
    finally:
        LOCK.release()
