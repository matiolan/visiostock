"""HU-05 · Detección de cajas en cada cuadro con YOLOv8n."""

from dataclasses import dataclass

import numpy as np
from ultralytics import YOLO


@dataclass
class Deteccion:
    caja: tuple[float, float, float, float]  # x1, y1, x2, y2 en píxeles
    confianza: float
    clase: str
    track_id: int | None = None

    @property
    def centro(self) -> tuple[float, float]:
        x1, y1, x2, y2 = self.caja
        return (x1 + x2) / 2, (y1 + y2) / 2


class DetectorCajas:
    def __init__(self, modelo: str, clases: list[str] | None = None, confianza_min: float = 0.4):
        self.modelo = YOLO(modelo)
        self.confianza_min = confianza_min
        nombres = self.modelo.names
        if clases:
            desconocidas = [c for c in clases if c not in nombres.values()]
            if desconocidas:
                raise ValueError(f"El modelo no tiene las clases: {', '.join(desconocidas)}")
            self.ids_clases = [i for i, n in nombres.items() if n in clases]
        else:
            self.ids_clases = None

    def detectar(self, cuadro: np.ndarray) -> list[Deteccion]:
        """Detecta cajas en un cuadro, sin seguimiento."""
        resultado = self.modelo.predict(
            cuadro, conf=self.confianza_min, classes=self.ids_clases, verbose=False
        )[0]
        return self._convertir(resultado)

    def seguir(self, cuadro: np.ndarray) -> list[Deteccion]:
        """Detecta y asigna un id estable a cada caja entre cuadros (ByteTrack)."""
        resultado = self.modelo.track(
            cuadro,
            conf=self.confianza_min,
            classes=self.ids_clases,
            tracker="bytetrack.yaml",
            persist=True,
            verbose=False,
        )[0]
        return self._convertir(resultado)

    def _convertir(self, resultado) -> list[Deteccion]:
        cajas = resultado.boxes
        if cajas is None or len(cajas) == 0:
            return []
        ids = cajas.id.int().tolist() if cajas.id is not None else [None] * len(cajas)
        return [
            Deteccion(
                caja=tuple(xyxy),
                confianza=float(conf),
                clase=resultado.names[int(cls)],
                track_id=tid,
            )
            for xyxy, conf, cls, tid in zip(
                cajas.xyxy.tolist(), cajas.conf.tolist(), cajas.cls.tolist(), ids
            )
        ]
