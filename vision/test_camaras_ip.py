import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np
from fastapi.testclient import TestClient

import app as mod
import camaras_ip
from camaras_ip import probar_camara, probar_camaras, sin_clave, url_valida

CAM = '00000000-0000-0000-0000-0000000000c1'


class Captura:
    """Cámara falsa: entrega `n` cuadros y luego se corta."""

    def __init__(self, n=5, abierta=True):
        self.n, self.abierta, self.liberada = n, abierta, False

    def isOpened(self):
        return self.abierta

    def read(self):
        if self.n <= 0:
            return False, None
        self.n -= 1
        return True, np.zeros((100, 100, 3), np.uint8)

    def release(self):
        self.liberada = True


def modelo_que_cruza():
    """Una caja (id 3) que baja de y=10 a y=90 en cinco cuadros."""
    modelo = MagicMock()
    def track(cuadro, **kw):
        y = 10 + 20 * modelo.track.call_count
        boxes = MagicMock()
        boxes.xyxy.tolist.return_value = [[10, y - 5, 30, y + 5]]
        boxes.id.int.return_value.tolist.return_value = [3]
        return [SimpleNamespace(boxes=boxes)]
    modelo.track.side_effect = track
    return modelo


class CamarasIP(unittest.TestCase):
    def test_url_valida(self):
        for url in ('rtsp://192.168.1.20:554/stream1', 'rtsps://user:clave@cam.local/live'):
            self.assertTrue(url_valida(url), url)
        for url in ('http://192.168.1.20/video', 'file:///etc/passwd', 'rtsp://', 'rtsp://cam /x', 'rtsp://' + 'a' * 600):
            self.assertFalse(url_valida(url), url)

    def test_no_muestra_la_clave(self):
        self.assertEqual(sin_clave('rtsp://lectura:secreta@192.168.1.20:554/s1'), 'rtsp://192.168.1.20:554/s1')

    def test_camara_en_linea(self):
        cap = Captura(5)
        with patch.object(camaras_ip, 'abrir', return_value=cap):
            r = probar_camara({'id': 'a', 'url': 'rtsp://x/1', 'linea': .5}, segundos=5)
        self.assertTrue(r['en_linea'])
        self.assertEqual(r['cuadros'], 5)
        self.assertTrue(r['miniatura'])
        self.assertTrue(cap.liberada)

    def test_camara_desconectada(self):
        with patch.object(camaras_ip, 'abrir', return_value=Captura(abierta=False)):
            r = probar_camara({'id': 'a', 'url': 'rtsp://x/1', 'linea': .5}, segundos=5)
        self.assertEqual((r['en_linea'], r['fps'], r['miniatura']), (False, 0.0, None))

    def test_procesar_cuenta_cruces_por_camara(self):
        with patch.object(camaras_ip, 'abrir', side_effect=lambda url: Captura(5)):
            r = probar_camaras([{'id': 'puerta', 'url': 'rtsp://x/1', 'linea': .5},
                                {'id': 'anden', 'url': 'rtsp://x/2', 'linea': .5}], 5, modelo_que_cruza, [0])
        self.assertEqual([(c['id'], [m['sentido'] for m in c['movimientos']]) for c in r],
                         [('puerta', ['entrada']), ('anden', ['entrada'])])


class Endpoint(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(mod.app)
        mod.MODELO, mod.CLASES = None, []
        mod.VISITAS.clear()

    def pedir(self, camaras, procesar=False, headers={'Authorization': 'Bearer test'}):
        return self.client.post('/camaras/probar', headers=headers, json={'camaras': camaras, 'procesar': procesar})

    def test_sin_sesion(self):
        self.assertEqual(self.pedir([{'id': CAM, 'url': 'rtsp://x/1'}], headers={}).status_code, 401)

    def test_rechaza_url_que_no_es_rtsp(self):
        with patch.object(mod, 'autorizar'), patch.object(mod, 'probar_camaras') as p:
            self.assertEqual(self.pedir([{'id': CAM, 'url': 'http://169.254.169.254/latest'}]).status_code, 422)
        p.assert_not_called()

    def test_maximo_cuatro_camaras(self):
        with patch.object(mod, 'autorizar'):
            self.assertEqual(self.pedir([{'id': CAM, 'url': 'rtsp://x/1'}] * 5).status_code, 422)

    def test_chequeo_no_necesita_modelo(self):
        with patch.object(mod, 'autorizar'), patch.object(mod, 'probar_camaras', return_value=[{'id': CAM, 'en_linea': True}]) as p:
            r = self.pedir([{'id': CAM, 'url': 'rtsp://x/1', 'linea': .4}])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(p.call_args.args[0], [{'id': CAM, 'url': 'rtsp://x/1', 'linea': .4}])

    def test_procesar_sin_modelo(self):
        with patch.object(mod, 'autorizar'):
            self.assertEqual(self.pedir([{'id': CAM, 'url': 'rtsp://x/1'}], procesar=True).status_code, 503)


if __name__ == '__main__':
    unittest.main(verbosity=2)
