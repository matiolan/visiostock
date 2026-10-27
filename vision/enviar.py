"""Envía cada movimiento detectado a la API de movimientos (HU-09) con su foto de evidencia."""

import logging

import cv2
import numpy as np
import requests

log = logging.getLogger(__name__)


def enviar_movimiento(
    api_url: str,
    api_key: str,
    zona: str,
    sentido: str,
    confianza: float,
    cuadro: np.ndarray,
    cantidad: int = 1,
) -> bool:
    ok, jpg = cv2.imencode(".jpg", cuadro)
    if not ok:
        log.error("No se pudo codificar la foto de evidencia")
        return False

    try:
        resp = requests.post(
            api_url,
            headers={"x-api-key": api_key},
            data={
                "zona": zona,
                "sentido": sentido,
                "cantidad": str(cantidad),
                "confianza": f"{confianza:.3f}",
            },
            files={"foto": ("evidencia.jpg", jpg.tobytes(), "image/jpeg")},
            timeout=10,
        )
    except requests.RequestException as e:
        log.error("No se pudo conectar con la API: %s", e)
        return False

    if resp.status_code != 201:
        log.error("La API respondió %s: %s", resp.status_code, resp.text)
        return False
    return True
