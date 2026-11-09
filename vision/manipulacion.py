"""HU-08 · Detectar manipulación incorrecta: caídas, golpes y apilamiento indebido.

Las velocidades se miden en "alturas de caja por segundo" para no depender de la
distancia de la cámara: una caja que baja 3 veces su propia altura en un segundo
cae, esté cerca o lejos.
"""
import os
from collections import deque
from dataclasses import dataclass, field
from math import hypot, inf


@dataclass(frozen=True)
class Deteccion:
    caja: tuple[float, float, float, float]  # x1, y1, x2, y2 en píxeles
    confianza: float
    track_id: int | None = None

    @property
    def centro(self) -> tuple[float, float]:
        return (self.caja[0] + self.caja[2]) / 2, (self.caja[1] + self.caja[3]) / 2


@dataclass
class Alerta:
    tipo: str  # caida, golpe o apilamiento
    segundo: float
    confianza: float
    detalle: str
    track_id: int | None = None
    imagen: str | None = None  # captura JPEG en base64 del cuadro con la caja marcada

    def json(self) -> dict:
        return {'tipo': self.tipo, 'segundo': round(self.segundo, 2), 'confianza': round(self.confianza, 3),
                'detalle': self.detalle, 'imagen': self.imagen}


@dataclass(frozen=True)
class Umbrales:
    caida_vel: float = 3.0  # alturas/s hacia abajo para considerar caída
    golpe_cambio: float = 15.0  # alturas/s² de frenado brusco para considerar golpe (medido a ~8 cuadros/s)
    golpe_vel_min: float = 1.5  # solo hay golpe si la caja venía moviéndose rápido
    max_apilado: int = int(os.getenv('VISION_MAX_APILADO', '4'))  # cajas una sobre otra permitidas
    espera_apilamiento: float = 30.0  # segundos entre alertas de apilamiento
    reaparicion_max: float = 2.0  # segundos que puede faltar una caja que cae borrosa o queda tapada en el suelo
    caida_min: float = 1.5  # alturas de caja que debe bajar entre que se pierde y reaparece


@dataclass
class _Muestra:
    t: float
    x: float
    y: float
    alto: float


@dataclass
class DetectorManipulacion:
    umbrales: Umbrales = field(default_factory=Umbrales)
    _historial: dict[int, deque] = field(default_factory=dict)
    _alertadas: set[tuple[int, str]] = field(default_factory=set)
    _ultimo_apilamiento: float = -inf
    _perdidas: dict[int, _Muestra] = field(default_factory=dict)

    def actualizar(self, t: float, detecciones: list[Deteccion]) -> list[Alerta]:
        """Recibe las detecciones del cuadro en el segundo `t` y devuelve las alertas nuevas."""
        vistas = {d.track_id for d in detecciones if d.track_id is not None}
        for track_id, hist in self._historial.items():
            if track_id not in vistas and track_id not in self._perdidas:
                self._perdidas[track_id] = hist[-1]
        nuevas = [d for d in detecciones if d.track_id is not None and d.track_id not in self._historial]
        alertas = [a for d in detecciones if d.track_id is not None and (a := self._revisar_movimiento(t, d))]
        alertas += [a for d in nuevas if (a := self._revisar_reaparicion(t, d))]
        altura = altura_maxima_pila(detecciones)
        u = self.umbrales
        if altura > u.max_apilado and t - self._ultimo_apilamiento >= u.espera_apilamiento:
            self._ultimo_apilamiento = t
            alertas.append(Alerta('apilamiento', t, 1.0, f'{altura} cajas apiladas (máximo {u.max_apilado})'))
        return alertas

    def _revisar_movimiento(self, t: float, d: Deteccion) -> Alerta | None:
        x, y = d.centro
        hist = self._historial.setdefault(d.track_id, deque(maxlen=3))
        hist.append(_Muestra(t, x, y, max(d.caja[3] - d.caja[1], 1.0)))
        if len(hist) < 2 or (d.track_id, 'caida') in self._alertadas:
            return None
        u = self.umbrales
        vx2, vy2 = _velocidad(hist[-2], hist[-1])
        if vy2 > u.caida_vel:
            self._alertadas.add((d.track_id, 'caida'))
            return Alerta('caida', t, d.confianza, f'bajó a {vy2:.1f} alturas de caja por segundo', d.track_id)
        if len(hist) == 3 and (d.track_id, 'golpe') not in self._alertadas:
            vx1, vy1 = _velocidad(hist[-3], hist[-2])
            dt = hist[-1].t - hist[-2].t
            antes, despues = hypot(vx1, vy1), hypot(vx2, vy2)
            frenado = (antes - despues) / dt if dt > 0 else 0.0
            if antes >= u.golpe_vel_min and frenado > u.golpe_cambio:
                self._alertadas.add((d.track_id, 'golpe'))
                return Alerta('golpe', t, d.confianza, f'frenó de golpe ({frenado:.0f} alturas de caja/s²)', d.track_id)
        return None


    def _revisar_reaparicion(self, t: float, d: Deteccion) -> Alerta | None:
        """Una caja que cae rápido se ve borrosa, el detector la pierde y reaparece abajo con otro id."""
        x, y = d.centro
        u = self.umbrales
        for track_id, previa in list(self._perdidas.items()):
            dt = t - previa.t
            if dt > u.reaparicion_max or dt <= 0:
                if dt > u.reaparicion_max:
                    del self._perdidas[track_id]
                continue
            bajada = (y - previa.y) / previa.alto
            if abs(x - previa.x) <= 1.5 * previa.alto and (bajada / dt > u.caida_vel or bajada >= u.caida_min):
                del self._perdidas[track_id]
                self._alertadas.update({(track_id, 'caida'), (d.track_id, 'caida')})
                return Alerta('caida', t, d.confianza,
                              f'se perdió en el aire y reapareció {(y - previa.y) / previa.alto:.1f} alturas de caja más abajo',
                              d.track_id)
        return None


def _velocidad(a: _Muestra, b: _Muestra) -> tuple[float, float]:
    dt = b.t - a.t
    if dt <= 0:
        return 0.0, 0.0
    alto = (a.alto + b.alto) / 2
    return (b.x - a.x) / dt / alto, (b.y - a.y) / dt / alto


def altura_maxima_pila(detecciones: list[Deteccion], solape_min: float = 0.5) -> int:
    """Cuenta cuántas cajas hay en la columna más alta (cajas que se solapan en horizontal)."""
    cajas = [d.caja for d in detecciones]
    maxima = 0
    for i, base in enumerate(cajas):
        columna = 1
        for j, otra in enumerate(cajas):
            if i == j:
                continue
            solape = min(base[2], otra[2]) - max(base[0], otra[0])
            ancho = min(base[2] - base[0], otra[2] - otra[0])
            if ancho > 0 and solape / ancho >= solape_min:
                columna += 1
        maxima = max(maxima, columna)
    return maxima


def analizar_video(modelo, ruta: str, clases: list[int], conf: float, fps: float,
                   cuadros_por_segundo: float = 8.0) -> list[Alerta]:
    """Sigue las cajas del video con ByteTrack y devuelve las alertas de manipulación."""
    salto = max(1, round(fps / cuadros_por_segundo))
    detector = DetectorManipulacion()
    alertas: list[Alerta] = []
    resultados = modelo.track(source=ruta, stream=True, persist=False, tracker='bytetrack.yaml', classes=clases,
                              conf=conf, vid_stride=salto, verbose=False)
    for i, r in enumerate(resultados):
        if r.boxes is None or not len(r.boxes):
            continue
        ids = r.boxes.id.int().tolist() if r.boxes.id is not None else [None] * len(r.boxes)
        detecciones = [Deteccion(tuple(c), float(p), t) for c, p, t in
                       zip(r.boxes.xyxy.tolist(), r.boxes.conf.tolist(), ids)]
        nuevas = detector.actualizar(i * salto / fps, detecciones)
        for alerta in nuevas:
            marcadas = [d.caja for d in detecciones if alerta.track_id is None or d.track_id == alerta.track_id]
            alerta.imagen = captura(r.orig_img, marcadas)
        alertas += nuevas
    return alertas


def captura(cuadro_bgr, cajas) -> str:
    """Evidencia de la alerta: el cuadro con las cajas involucradas marcadas en rojo."""
    from PIL import Image, ImageDraw
    from movimientos import jpeg_base64
    imagen = Image.fromarray(cuadro_bgr[:, :, ::-1])
    dibujo = ImageDraw.Draw(imagen)
    grosor = max(2, imagen.width // 200)
    for x1, y1, x2, y2 in cajas:
        dibujo.rectangle((x1, y1, x2, y2), outline=(230, 40, 40), width=grosor)
    return jpeg_base64(imagen, lado=960)
