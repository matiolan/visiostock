"""HU-06 · Conteo de cajas que cruzan una línea horizontal."""

from dataclasses import dataclass, field
from typing import Literal

Sentido = Literal["entrada", "salida"]


@dataclass
class Cruce:
    track_id: int
    sentido: Sentido
    confianza: float


@dataclass
class ContadorLinea:
    """Cuenta cada id de seguimiento una sola vez al cruzar la línea y = linea_y (en píxeles).

    Arriba → abajo = entrada; abajo → arriba = salida.
    """

    linea_y: float
    entradas: int = 0
    salidas: int = 0
    _ultima_y: dict[int, float] = field(default_factory=dict)
    _contados: set[int] = field(default_factory=set)

    def actualizar(self, track_id: int, y: float, confianza: float = 1.0) -> Cruce | None:
        anterior = self._ultima_y.get(track_id)
        self._ultima_y[track_id] = y
        if anterior is None or track_id in self._contados:
            return None

        if anterior < self.linea_y <= y:
            sentido: Sentido = "entrada"
            self.entradas += 1
        elif anterior >= self.linea_y > y:
            sentido = "salida"
            self.salidas += 1
        else:
            return None

        self._contados.add(track_id)
        return Cruce(track_id, sentido, confianza)
