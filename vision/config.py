"""Configuración del módulo de visión, leída de vision/.env."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))


def _fuente(valor: str) -> int | str:
    return int(valor) if valor.isdigit() else valor


@dataclass(frozen=True)
class Config:
    modelo: str = os.getenv("MODELO", "yolov8n.pt")
    clases: list[str] = field(
        default_factory=lambda: [c.strip() for c in os.getenv("CLASES", "").split(",") if c.strip()]
    )
    confianza_min: float = float(os.getenv("CONFIANZA_MIN", "0.4"))
    fuente: int | str = _fuente(os.getenv("FUENTE", "0"))
    linea_y: float = float(os.getenv("LINEA_Y", "0.5"))
    zona: str = os.getenv("ZONA", "A")
    api_url: str = os.getenv("VISION_API_URL", "http://localhost:3000/api/movimientos")
    api_key: str = os.getenv("VISION_API_KEY", "")
