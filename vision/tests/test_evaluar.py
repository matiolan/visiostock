import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from evaluar import precision_conteo


def test_conteo_exacto():
    assert precision_conteo(10, 5, 10, 5) == 1.0


def test_error_relativo():
    assert precision_conteo(10, 10, 9, 8) == 0.85


def test_nunca_negativa():
    assert precision_conteo(2, 0, 10, 0) == 0.0


def test_sin_movimientos():
    assert precision_conteo(0, 0, 0, 0) == 1.0
    assert precision_conteo(0, 0, 1, 0) == 0.0
