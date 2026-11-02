import io, os, unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from PIL import Image
import app as mod
b=io.BytesIO();Image.new('RGB',(40,30),'white').save(b,format='JPEG');raw=b.getvalue()
PID='00000000-0000-0000-0000-000000000001'
class VisionTests(unittest.TestCase):
 def setUp(self):
  self.client=TestClient(mod.app);mod.MODELO=None;mod.CLASES=[]
 def request(self,raw_image=raw,headers={'Authorization':'Bearer test'},clase='caja'):
  return self.client.post('/analizar',headers=headers,data={'producto':PID,'clase':clase},files={'imagen':('foto.jpg',raw_image,'image/jpeg')})
 def test_estado_sin_modelo(self):
  r=self.client.get('/estado');self.assertEqual(r.status_code,200);self.assertFalse(r.json()['listo'])
 def test_rechaza_sin_sesion(self):
  self.assertEqual(self.request(headers={}).status_code,401)
 def test_uuid_invalido(self):
  r=self.client.post('/analizar',data={'producto':'no-uuid','clase':'caja'},files={'imagen':('foto.jpg',raw)});self.assertEqual(r.status_code,422)
 def test_no_fabrica_conteo_sin_modelo(self):
  with patch.object(mod,'autorizar'): self.assertEqual(self.request().status_code,503)
 def model(self):
  model=MagicMock();model.names={0:'caja'}
  result=MagicMock();result.boxes.xyxy.tolist.return_value=[[1,2,12,18],[15,2,30,20]];result.boxes.conf.tolist.return_value=[.91,.82]
  model.predict.return_value=[result];mod.MODELO=model;mod.CLASES=['caja'];return model
 def test_conteo_y_coordenadas(self):
  model=self.model()
  with patch.object(mod,'autorizar') as auth:r=self.request()
  self.assertEqual(r.status_code,200);self.assertEqual(r.json()['conteo'],2);self.assertEqual(r.json()['ancho'],40);self.assertEqual(r.json()['alto'],30);auth.assert_called_once_with('test',PID);self.assertEqual(model.predict.call_args.kwargs['classes'],[0])
 def test_clase_ajena(self):
  self.model()
  with patch.object(mod,'autorizar'):self.assertEqual(self.request(clase='tomatodo').status_code,422)
 def test_archivo_falso(self):
  self.model()
  with patch.object(mod,'autorizar'):self.assertEqual(self.request(raw_image=b'no-es-imagen').status_code,422)
 def test_limite_archivo(self):
  with self.assertRaises(mod.HTTPException) as e:mod.abrir_imagen(b'x'*(5242880+1))
  self.assertEqual(e.exception.status_code,413)
 def test_producto_de_otra_empresa(self):
  self.model()
  with patch.object(mod,'autorizar',side_effect=mod.HTTPException(403,'Sin acceso')):self.assertEqual(self.request().status_code,403)
 def test_sesion_auth_invalida(self):
  with patch.dict(os.environ,{'SUPABASE_URL':'https://example.supabase.co','SUPABASE_PUBLISHABLE_KEY':'public'}),patch.object(mod.httpx,'Client') as client:
   client.return_value.__enter__.return_value.get.return_value.status_code=401
   with self.assertRaises(mod.HTTPException) as e:mod.autorizar('bad',PID)
   self.assertEqual(e.exception.status_code,401)
 def test_rls_no_devuelve_producto(self):
  with patch.dict(os.environ,{'SUPABASE_URL':'https://example.supabase.co','SUPABASE_PUBLISHABLE_KEY':'public'}),patch.object(mod.httpx,'Client') as client:
   a=MagicMock(status_code=200);r=MagicMock(status_code=200);r.json.return_value=[];client.return_value.__enter__.return_value.get.side_effect=[a,r]
   with self.assertRaises(mod.HTTPException) as e:mod.autorizar('token',PID)
   self.assertEqual(e.exception.status_code,403)
 def test_detector_ocupado(self):
  self.model();mod.LOCK.acquire()
  try:
   with patch.object(mod,'autorizar'):self.assertEqual(self.request().status_code,429)
  finally:mod.LOCK.release()
if __name__=='__main__':unittest.main(verbosity=2)
