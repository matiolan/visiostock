import io, os, unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from PIL import Image
import zxingcpp
import app as mod
b=io.BytesIO();Image.new('RGB',(40,30),'white').save(b,format='JPEG');raw=b.getvalue()
PID='00000000-0000-0000-0000-000000000001'
class VisionTests(unittest.TestCase):
 def setUp(self):
  self.client=TestClient(mod.app);mod.MODELO=None;mod.CLASES=[];mod.VISITAS.clear()
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
 def test_peticion_grande_declarada(self):
  r=self.client.post('/analizar',headers={'Authorization':'Bearer test','Origin':'http://localhost:5173'},content=b'x'*(mod.MAX_PETICION+1))
  self.assertEqual(r.status_code,413);self.assertEqual(r.headers['access-control-allow-origin'],'http://localhost:5173')
 def test_peticion_grande_chunked(self):
  def trozos():
   for _ in range(6):yield b'x'*(1024*1024)
  with patch.object(mod,'autorizar') as auth:r=self.client.post('/analizar',headers={'Authorization':'Bearer test'},content=trozos())
  self.assertEqual(r.status_code,413);auth.assert_not_called()
 def test_imagen_al_limite_pasa(self):
  self.model();b=io.BytesIO();Image.new('RGB',(40,30),'white').save(b,format='PNG');pesada=b.getvalue()+b'\0'*(5*1024*1024-len(b.getvalue()))
  with patch.object(mod,'autorizar'):self.assertEqual(self.request(raw_image=pesada).status_code,200)
 def test_limite_frecuencia(self):
  with patch.object(mod,'POR_MINUTO',2),patch.object(mod,'autorizar') as auth:
   self.assertEqual(self.request().status_code,503);self.assertEqual(self.request().status_code,503)
   r=self.request();self.assertEqual(r.status_code,429);self.assertGreater(int(r.headers['retry-after']),0);self.assertEqual(auth.call_count,2)
 def test_frecuencia_es_por_ip(self):
  with patch.object(mod,'POR_MINUTO',1),patch.object(mod,'autorizar'):
   self.assertEqual(self.request().status_code,503);self.assertEqual(self.request().status_code,429)
   otra=TestClient(mod.app,client=('203.0.113.9',5000))
   self.assertEqual(otra.post('/analizar',headers={'Authorization':'Bearer test'},data={'producto':PID,'clase':'caja'},files={'imagen':('foto.jpg',raw,'image/jpeg')}).status_code,503)
 def test_frecuencia_vence(self):
  with patch.object(mod,'POR_MINUTO',1),patch.object(mod.time,'monotonic',side_effect=[100,120,161]):
   self.assertEqual(mod.espera_frecuencia('ip'),0);self.assertEqual(mod.espera_frecuencia('ip'),41);self.assertEqual(mod.espera_frecuencia('ip'),0)
 def test_estado_sin_limite(self):
  with patch.object(mod,'POR_MINUTO',0):self.assertEqual(self.client.get('/estado').status_code,200)
 def codigo(self,texto,formato,escala=4):
  m=memoryview(zxingcpp.create_barcode(texto,formato).to_image(scale=escala));Image.frombytes('L',(m.shape[1],m.shape[0]),m.tobytes()).convert('RGB').save(b:=io.BytesIO(),format='PNG');return b.getvalue()
 def identificar(self,raw_image,headers={'Authorization':'Bearer test'}):
  return self.client.post('/identificar',headers=headers,files={'imagen':('codigo.png',raw_image,'image/png')})
 def test_identificar_qr(self):
  with patch.object(mod,'autorizar') as auth:r=self.identificar(self.codigo('CAJA-001',zxingcpp.BarcodeFormat.QRCode))
  self.assertEqual(r.status_code,200);self.assertEqual(r.json()['codigos'],[{'tipo':'QR','texto':'CAJA-001'}]);auth.assert_called_once_with('test')
 def test_identificar_barras(self):
  with patch.object(mod,'autorizar'):
   self.assertEqual(self.identificar(self.codigo('LALI-TOM-750',zxingcpp.BarcodeFormat.Code128,3)).json()['codigos'],[{'tipo':'Code128','texto':'LALI-TOM-750'}])
   self.assertEqual(self.identificar(self.codigo('7751234567892',zxingcpp.BarcodeFormat.EAN13,3)).json()['codigos'],[{'tipo':'EAN-13','texto':'7751234567892'}])
 def test_identificar_sin_codigo(self):
  with patch.object(mod,'autorizar'):r=self.identificar(raw)
  self.assertEqual(r.status_code,200);self.assertEqual(r.json()['codigos'],[])
 def test_identificar_no_requiere_modelo(self):
  self.assertIsNone(mod.MODELO)
  with patch.object(mod,'autorizar'):self.assertEqual(self.identificar(raw).status_code,200)
 def test_identificar_sin_sesion(self):
  self.assertEqual(self.identificar(raw,headers={}).status_code,401)
 def test_identificar_archivo_falso(self):
  with patch.object(mod,'autorizar'):self.assertEqual(self.identificar(b'no-es-imagen').status_code,422)
 def test_identificar_con_limite_frecuencia(self):
  with patch.object(mod,'POR_MINUTO',1),patch.object(mod,'autorizar'):
   self.assertEqual(self.identificar(raw).status_code,200);self.assertEqual(self.identificar(raw).status_code,429)
 def test_sesion_sin_producto_no_consulta_rls(self):
  with patch.dict(os.environ,{'SUPABASE_URL':'https://example.supabase.co','SUPABASE_PUBLISHABLE_KEY':'public'}),patch.object(mod.httpx,'Client') as client:
   get=client.return_value.__enter__.return_value.get;get.return_value.status_code=200
   mod.autorizar('token');self.assertEqual(get.call_count,1)
if __name__=='__main__':unittest.main(verbosity=2)
