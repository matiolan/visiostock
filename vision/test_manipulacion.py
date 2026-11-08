import base64
import io
import unittest
from types import SimpleNamespace

import numpy as np
from PIL import Image
from unittest.mock import MagicMock
from evaluar_manipulacion import resumir
from manipulacion import Deteccion, DetectorManipulacion, Umbrales, altura_maxima_pila, analizar_video


def caja(x, y, lado=50, track=1, conf=.9):
    return Deteccion((x, y, x + lado, y + lado), conf, track)


def pila(n, x=100):
    return [caja(x, 400 - i * 50, track=i + 10) for i in range(n)]


class Manipulacion(unittest.TestCase):
    def setUp(self):
        self.d = DetectorManipulacion(Umbrales(max_apilado=4))

    def test_caida(self):
        # baja 4 alturas por segundo (200 px/s con cajas de 50 px)
        alertas = [a for t in range(4) for a in self.d.actualizar(t * .25, [caja(100, 100 + t * 50)])]
        self.assertEqual([a.tipo for a in alertas], ['caida'])
        self.assertEqual(alertas[0].segundo, .25)

    def test_caida_se_avisa_una_vez(self):
        alertas = [a for t in range(10) for a in self.d.actualizar(t * .1, [caja(100, t * 40)])]
        self.assertEqual(len(alertas), 1)

    def test_movimiento_normal_no_alerta(self):
        # una caja llevada a mano: 1 altura por segundo en diagonal
        alertas = [a for t in range(20) for a in self.d.actualizar(t * .1, [caja(100 + t * 5, 100 + t * 5)])]
        self.assertEqual(alertas, [])

    def test_golpe(self):
        posiciones = [(0, 0), (.1, 25), (.2, 25)]  # venía a 5 alturas/s y se detiene en 0.1 s
        alertas = [a for t, x in posiciones for a in self.d.actualizar(t, [caja(100 + x, 100)])]
        self.assertEqual([a.tipo for a in alertas], ['golpe'])

    def test_frenado_suave_no_es_golpe(self):
        posiciones = [(0, 0), (.5, 25), (1.0, 40), (1.5, 45)]
        alertas = [a for t, x in posiciones for a in self.d.actualizar(t, [caja(100 + x, 100)])]
        self.assertEqual(alertas, [])

    def test_caida_borrosa_reaparece_con_otro_id(self):
        cuadros = [(0, [caja(100, 50, track=1)]), (.25, [caja(100, 50, track=1)]), (.5, []), (.75, [caja(105, 350, track=2)]),
                   (1.0, [caja(105, 350, track=2)])]
        alertas = [a for t, ds in cuadros for a in self.d.actualizar(t, ds)]
        self.assertEqual([a.tipo for a in alertas], ['caida'])
        self.assertIn('6.0 alturas', alertas[0].detalle)

    def test_caida_que_queda_oculta_en_el_suelo(self):
        # se pierde al caer y el detector tarda 1.5 s en volver a verla, 3 alturas más abajo
        cuadros = [(0, [caja(100, 50, track=1)]), (.2, [caja(100, 60, track=1)]), (.4, []), (1.9, [caja(110, 210, track=2)])]
        self.assertEqual([a.tipo for t, ds in cuadros for a in self.d.actualizar(t, ds)], ['caida'])

    def test_resumen_de_precision(self):
        filas = [{'esperado': 'caida', 'alertas': ['caida']}, {'esperado': 'golpe', 'alertas': []},
                 {'esperado': 'apilamiento', 'alertas': ['apilamiento', 'caida']}, {'esperado': 'normal', 'alertas': []},
                 {'esperado': 'normal', 'alertas': ['golpe']}]
        r = resumir(filas)
        self.assertEqual((r['detectados'], r['eventos'], r['falsos'], r['normales']), (2, 3, 1, 2))

    def test_caja_que_sale_y_entra_lejos_no_es_caida(self):
        cuadros = [(0, [caja(100, 50, track=1)]), (.5, []), (1.0, [caja(500, 350, track=2)]),  # en otra columna
                   (3.0, [caja(100, 400, track=3)])]  # demasiado tarde
        self.assertEqual([a for t, ds in cuadros for a in self.d.actualizar(t, ds)], [])

    def test_sin_seguimiento_no_mide_movimiento(self):
        alertas = [a for t in range(4) for a in self.d.actualizar(t * .1, [caja(100, t * 100, track=None)])]
        self.assertEqual(alertas, [])

    def test_apilamiento_excesivo(self):
        alertas = self.d.actualizar(0, pila(5))
        self.assertEqual([a.tipo for a in alertas], ['apilamiento'])
        self.assertIn('5 cajas', alertas[0].detalle)

    def test_apilamiento_permitido(self):
        self.assertEqual(self.d.actualizar(0, pila(4)), [])

    def test_apilamiento_espera_entre_alertas(self):
        self.assertEqual(len(self.d.actualizar(0, pila(5))), 1)
        self.assertEqual(self.d.actualizar(10, pila(5)), [])
        self.assertEqual(len(self.d.actualizar(31, pila(5))), 1)

    def test_altura_de_pila(self):
        self.assertEqual(altura_maxima_pila([]), 0)
        self.assertEqual(altura_maxima_pila([caja(0, 0), caja(100, 0), caja(200, 0)]), 1)  # en fila
        self.assertEqual(altura_maxima_pila(pila(3) + pila(2, x=300)), 3)
        self.assertEqual(altura_maxima_pila([caja(0, 0), caja(40, 50)]), 1)  # solape menor al 50 %

    def test_analizar_video_usa_el_tiempo_real(self):
        def resultado(y):
            boxes = MagicMock()
            boxes.__len__.return_value = 1
            boxes.xyxy.tolist.return_value = [[100, y, 150, y + 50]]
            boxes.conf.tolist.return_value = [.9]
            boxes.id.int.return_value.tolist.return_value = [7]
            return SimpleNamespace(boxes=boxes, orig_img=np.full((400, 300, 3), 200, np.uint8))
        modelo = MagicMock()
        modelo.track.return_value = iter([resultado(100), resultado(150), resultado(200)])
        alertas = analizar_video(modelo, 'video.mp4', [0], .5, fps=30)
        self.assertEqual(modelo.track.call_args.kwargs['vid_stride'], 4)  # ~8 cuadros por segundo
        self.assertFalse(modelo.track.call_args.kwargs['persist'])
        self.assertEqual([(a.tipo, round(a.segundo, 3)) for a in alertas], [('caida', .133)])
        # la evidencia es el cuadro con la caja que cayó marcada en rojo
        evidencia = Image.open(io.BytesIO(base64.b64decode(alertas[0].imagen))).convert('RGB')
        self.assertEqual(evidencia.size, (300, 400))
        r, g, b = evidencia.getpixel((100, 175))  # borde izquierdo de la caja en y=150..200
        self.assertTrue(r > 180 and g < 90 and b < 90, (r, g, b))


if __name__ == '__main__':
    unittest.main(verbosity=2)
