"""HU-07 · Movimientos por video: cada caja que cruza la línea se asocia al SKU de su código.

Arriba → abajo = entrada; abajo → arriba = salida. El código QR o de barras se busca en el
recorte de cada caja seguida mientras está en cuadro; si nunca se lee, el movimiento queda
"NO IDENTIFICADO" con la mejor imagen de la caja como evidencia para revisión manual.
"""
import base64
import io
from dataclasses import dataclass, field

from PIL import Image

from codigos import leer_codigos

MARGEN = 0.15  # margen alrededor de la caja al recortar (fracción del tamaño)
LADO_MIN = 320  # los recortes más chicos se amplían para que el código sea legible
LADO_EVIDENCIA = 480  # tamaño máximo de la imagen de evidencia
PAUSA_MAX = 0.4  # segundos sin ver un id antes de considerarlo otra caja
BANDA = 0.05  # fracción del alto alrededor de la línea donde no cambia el lado de una caja


@dataclass
class ContadorLinea:
    """Cuenta un cruce cuando una caja pasa de un lado de la línea al otro.

    El lado solo cambia fuera de una banda alrededor de la línea, así el temblor de una caja
    detenida sobre la línea no suma movimientos, pero una caja que entra y vuelve a salir sí.
    """
    linea_y: float
    banda: float
    _lado: dict = field(default_factory=dict)

    def actualizar(self, track_id, y: float) -> str | None:
        if abs(y - self.linea_y) <= self.banda:
            return None
        lado = 'abajo' if y > self.linea_y else 'arriba'
        anterior = self._lado.get(track_id)
        self._lado[track_id] = lado
        if anterior is None or anterior == lado:
            return None
        return 'entrada' if lado == 'abajo' else 'salida'


def recortar(imagen: Image.Image, caja) -> Image.Image:
    x1, y1, x2, y2 = caja
    mx, my = (x2 - x1) * MARGEN, (y2 - y1) * MARGEN
    return imagen.crop((max(0, int(x1 - mx)), max(0, int(y1 - my)),
                        min(imagen.width, int(x2 + mx)), min(imagen.height, int(y2 + my))))


def leer_recorte(recorte: Image.Image) -> list[dict]:
    """Lee el recorte tal cual y, si no hay suerte y es pequeño, ampliado.

    Ampliar primero difumina las barras finas de un Code128, por eso va en segundo lugar.
    """
    leidos = leer_codigos(recorte)
    lado = min(recorte.size)
    if not leidos and 0 < lado < LADO_MIN:
        factor = LADO_MIN / lado
        leidos = leer_codigos(recorte.resize((round(recorte.width * factor), round(recorte.height * factor)),
                                             Image.NEAREST))
    return leidos


def jpeg_base64(imagen: Image.Image, lado: int = LADO_EVIDENCIA) -> str:
    imagen = imagen.copy()
    imagen.thumbnail((lado, lado))
    salida = io.BytesIO()
    imagen.convert('RGB').save(salida, format='JPEG', quality=80)
    return base64.b64encode(salida.getvalue()).decode()


@dataclass
class _Caja:
    codigo: dict | None = None
    evidencia: Image.Image | None = None
    area: float = 0.0
    vistas: int = 0
    pendientes: list = field(default_factory=list)  # movimientos que esperan el código de esta caja

    def cerrar(self) -> None:
        for m in self.pendientes:
            m.update(codigo=self.codigo['texto'] if self.codigo else None, tipo=self.codigo['tipo'] if self.codigo else None,
                     imagen=jpeg_base64(self.evidencia) if self.evidencia else None)
        self.pendientes.clear()


def analizar_movimientos(modelo, ruta: str, clases: list[int], conf: float, fps: float, linea: float = 0.5,
                         cuadros_por_segundo: float = 10.0, leer_cada: int = 2) -> list[dict]:
    """Sigue las cajas del video y devuelve un movimiento por cada caja que cruza la línea."""
    salto = max(1, round(fps / cuadros_por_segundo))
    cajas: dict[tuple[int, int], _Caja] = {}
    movimientos: list[dict] = []
    contador = None
    # ByteTrack puede reactivar el id de una caja que ya salió y dárselo a la siguiente. Por eso
    # un id que vuelve tras PAUSA_MAX segundos es otra caja, y al tocar el borde del cuadro (una
    # caja que sale o entra) se cierra lo leído y se empieza a leer de nuevo.
    ultima_vez: dict[int, float] = {}
    generacion: dict[int, int] = {}
    resultados = modelo.track(source=ruta, stream=True, persist=False, tracker='bytetrack.yaml', classes=clases,
                              conf=conf, vid_stride=salto, verbose=False)
    for i, r in enumerate(resultados):
        alto = r.orig_img.shape[0]
        if contador is None:
            contador = ContadorLinea(alto * linea, alto * BANDA)
        if r.boxes is None or r.boxes.id is None:
            continue
        cuadro = Image.fromarray(r.orig_img[:, :, ::-1])  # BGR → RGB
        t = i * salto / fps
        for xyxy, id_tracker in zip(r.boxes.xyxy.tolist(), r.boxes.id.int().tolist()):
            if t - ultima_vez.get(id_tracker, t) > PAUSA_MAX:
                generacion[id_tracker] = generacion.get(id_tracker, 0) + 1
            ultima_vez[id_tracker] = t
            track_id = (id_tracker, generacion.get(id_tracker, 0))
            caja = cajas.setdefault(track_id, _Caja())
            if xyxy[1] <= 2 or xyxy[3] >= alto - 2:
                caja.cerrar()
                caja = cajas[track_id] = _Caja()
            caja.vistas += 1
            area = (xyxy[2] - xyxy[0]) * (xyxy[3] - xyxy[1])
            if caja.codigo is None and (caja.vistas - 1) % leer_cada == 0:
                recorte = recortar(cuadro, xyxy)
                leidos = leer_recorte(recorte)
                if leidos:
                    caja.codigo, caja.evidencia, caja.area = leidos[0], recorte, area
            if caja.codigo is None and area > caja.area:
                caja.evidencia, caja.area = recortar(cuadro, xyxy), area
            sentido = contador.actualizar(track_id, (xyxy[1] + xyxy[3]) / 2)
            if sentido:
                movimiento = {'sentido': sentido, 'segundo': round(t, 2), 'codigo': None, 'tipo': None, 'imagen': None}
                movimientos.append(movimiento)
                caja.pendientes.append(movimiento)
    for caja in cajas.values():
        caja.cerrar()
    return movimientos
