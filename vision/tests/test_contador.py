import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from contador import ContadorLinea


def test_cruce_hacia_abajo_es_entrada():
    c = ContadorLinea(linea_y=100)
    assert c.actualizar(1, 80) is None
    cruce = c.actualizar(1, 120, 0.9)
    assert cruce.sentido == "entrada" and cruce.confianza == 0.9
    assert (c.entradas, c.salidas) == (1, 0)


def test_cruce_hacia_arriba_es_salida():
    c = ContadorLinea(linea_y=100)
    c.actualizar(1, 130)
    assert c.actualizar(1, 90).sentido == "salida"
    assert (c.entradas, c.salidas) == (0, 1)


def test_cada_caja_se_cuenta_una_vez():
    c = ContadorLinea(linea_y=100)
    for y in (80, 120, 90, 130):
        c.actualizar(1, y)
    assert (c.entradas, c.salidas) == (1, 0)


def test_sin_cruce_no_cuenta():
    c = ContadorLinea(linea_y=100)
    for y in (10, 40, 70, 99):
        assert c.actualizar(1, y) is None
    assert (c.entradas, c.salidas) == (0, 0)


def test_cajas_distintas_se_cuentan_por_separado():
    c = ContadorLinea(linea_y=100)
    c.actualizar(1, 50)
    c.actualizar(2, 150)
    c.actualizar(1, 150)
    c.actualizar(2, 50)
    assert (c.entradas, c.salidas) == (1, 1)
