import base64
import io
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

import numpy as np
import zxingcpp
from PIL import Image

from evaluar_sku import comparar
from movimientos import ContadorLinea, analizar_movimientos, leer_recorte

ALTO, ANCHO = 480, 640


def etiqueta(texto, formato=zxingcpp.BarcodeFormat.QRCode, escala=3):
    m = memoryview(zxingcpp.create_barcode(texto, formato).to_image(scale=escala))
    return Image.frombytes('L', (m.shape[1], m.shape[0]), m.tobytes()).convert('RGB')


def cuadro(cajas):
    """Fondo gris con cajas (x, y, texto) de 200x160; texto None = caja sin código."""
    img = Image.new('RGB', (ANCHO, ALTO), (200, 200, 200))
    for x, y, texto in cajas:
        img.paste((150, 110, 70), (x, y, x + 200, y + 160))
        if texto:
            e = etiqueta(texto)
            img.paste(e, (x + (200 - e.width) // 2, y + (160 - e.height) // 2))
    return np.asarray(img)[:, :, ::-1].copy()  # el tracker entrega BGR


def resultado(cajas, ids):
    boxes = MagicMock()
    boxes.xyxy.tolist.return_value = [[x, max(y, 0), x + 200, min(y + 160, ALTO)] for x, y, _ in cajas]
    boxes.id = MagicMock() if ids else None
    if ids:
        boxes.id.int.return_value.tolist.return_value = ids
    return SimpleNamespace(boxes=boxes, orig_img=cuadro(cajas))


def recorrido(texto, desde, hasta, pasos=12, x=200):
    return [(x, int(desde + (hasta - desde) * k / (pasos - 1)), texto) for k in range(pasos)]


class Contador(unittest.TestCase):
    def test_entrada_y_salida(self):
        c = ContadorLinea(240, 20)
        self.assertEqual([c.actualizar(1, y) for y in (100, 200, 300)], [None, None, 'entrada'])
        self.assertEqual([c.actualizar(2, y) for y in (400, 300, 150)], [None, None, 'salida'])

    def test_temblor_sobre_la_linea_no_cuenta(self):
        c = ContadorLinea(240, 20)
        self.assertEqual([c.actualizar(1, y) for y in (100, 235, 250, 230, 255, 245)], [None] * 6)

    def test_ida_y_vuelta_son_dos_movimientos(self):
        c = ContadorLinea(240, 20)
        self.assertEqual([c.actualizar(1, y) for y in (100, 300, 100)], [None, 'entrada', 'salida'])


class Movimientos(unittest.TestCase):
    def analizar(self, cuadros):
        modelo = MagicMock()
        modelo.track.return_value = iter(cuadros)
        return analizar_movimientos(modelo, 'video.mp4', [0], .5, fps=10, linea=.5, cuadros_por_segundo=10,
                                    leer_cada=1)

    def test_asocia_el_sku_al_movimiento(self):
        m = self.analizar([resultado([p], [1]) for p in recorrido('LALI-001', 20, 300)])
        self.assertEqual([(x['sentido'], x['codigo'], x['tipo']) for x in m], [('entrada', 'LALI-001', 'QR')])
        Image.open(io.BytesIO(base64.b64decode(m[0]['imagen']))).verify()  # evidencia JPEG válida

    def test_codigo_ilegible_queda_sin_identificar_con_evidencia(self):
        m = self.analizar([resultado([p], [1]) for p in recorrido(None, 300, 20)])
        self.assertEqual([(x['sentido'], x['codigo']) for x in m], [('salida', None)])
        self.assertTrue(m[0]['imagen'])

    def test_id_reutilizado_por_otra_caja(self):
        # la primera sale por arriba y la siguiente entra por arriba con el mismo id del tracker
        cuadros = [resultado([p], [7]) for p in recorrido('LALI-001', 300, -20)]
        cuadros += [resultado([p], [7]) for p in recorrido('LALI-002', -20, 300)]
        m = self.analizar(cuadros)
        self.assertEqual([(x['sentido'], x['codigo']) for x in m], [('salida', 'LALI-001'), ('entrada', 'LALI-002')])

    def test_cuadros_sin_seguimiento(self):
        self.assertEqual(self.analizar([resultado([(200, 100, None)], None)] * 3), [])


class Lectura(unittest.TestCase):
    def test_code128_pequeno_se_lee_sin_difuminar(self):
        recorte = Image.new('RGB', (260, 120), 'white')
        recorte.paste(etiqueta('LALI-TOM-750', zxingcpp.BarcodeFormat.Code128, 1), (20, 20))
        self.assertEqual(leer_recorte(recorte)[0]['texto'], 'LALI-TOM-750')


class Evaluacion(unittest.TestCase):
    def test_tasa_de_lectura(self):
        esperados = [{'sentido': 'entrada', 'sku': 'A'}, {'sentido': 'salida', 'sku': 'NO IDENTIFICADO'},
                     {'sentido': 'entrada', 'sku': 'C'}]
        detectados = [{'sentido': 'entrada', 'codigo': 'a'}, {'sentido': 'salida', 'codigo': None},
                      {'sentido': 'entrada', 'codigo': 'X'}]
        r = comparar(esperados, detectados)
        self.assertEqual((r['correctos'], round(r['tasa'], 2)), (2, .67))


if __name__ == '__main__':
    unittest.main(verbosity=2)
