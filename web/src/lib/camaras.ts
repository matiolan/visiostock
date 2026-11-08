import { supabaseBrowser } from './supabase';
import { buscarDispositivo, type Camara, type Zona } from './dispositivos';
import { visionURL } from './verificaciones';
const sinMigracion='No se pudieron cargar las cámaras. Si es tu primera vez, ejecuta supabase/06_camaras_zonas.sql en Supabase.';
export async function listarCamaras():Promise<{zonas:Zona[];camaras:Camara[]}>{
 const db=supabaseBrowser();const [z,c]=await Promise.all([db.from('vs_zonas').select('*').order('nombre'),db.from('vs_camaras').select('*').order('nombre')]);
 if(z.error||c.error)throw new Error(sinMigracion);return {zonas:z.data||[],camaras:c.data||[]};
}
function error(e:{code?:string}|null){if(!e)return;if(e.code==='23505')throw new Error('Ya existe un registro con ese nombre en el mismo lugar.');throw new Error('No se pudo guardar. Comprueba tu permiso y que ejecutaste 06_camaras_zonas.sql.');}
export async function crearZona(almacen:{id:string;empresa_id:string},nombre:string){
 const {error:e}=await supabaseBrowser().from('vs_zonas').insert({empresa_id:almacen.empresa_id,almacen_id:almacen.id,nombre:nombre.trim()});error(e);
}
export async function crearCamara(zona:Zona,nombre:string,dispositivo:string,ip?:{url:string;linea:number}){
 const datos=ip?{tipo:'rtsp',url:ip.url.trim(),linea:ip.linea}:{dispositivo:dispositivo.trim()};
 const {error:e}=await supabaseBrowser().from('vs_camaras').insert({empresa_id:zona.empresa_id,zona_id:zona.id,nombre:nombre.trim(),...datos});error(e);
}
export async function informarSenal(id:string,ok:boolean,fps:number|null){
 const {error:e}=await supabaseBrowser().rpc('vs_senal_camara',{cam:id,ok,cuadros:fps});if(e)throw new Error('No se pudo guardar el estado de la cámara.');
}
export type PruebaIP={id:string;en_linea:boolean;fps:number;cuadros:number;movimientos:{sentido:'entrada'|'salida';segundo:number}[];miniatura:string|null};
// HU-17: el servicio de visión lee las cámaras RTSP (hasta 4 a la vez) y, si se pide, detecta y cuenta en cada una.
export async function probarCamarasIP(camaras:Camara[],procesar=false,segundos=2):Promise<PruebaIP[]>{
 const {data:{session}}=await supabaseBrowser().auth.getSession();if(!session)throw new Error('Inicia sesión nuevamente.');
 const r=await fetch(visionURL+'/camaras/probar',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},
  body:JSON.stringify({camaras:camaras.map(c=>({id:c.id,url:c.url,linea:c.linea??.5})),procesar,segundos}),signal:AbortSignal.timeout((segundos+20)*1000)});
 const body=await r.json();if(!r.ok)throw new Error(typeof body.detail==='string'?body.detail:'El servicio de visión no pudo revisar las cámaras.');return body.camaras;
}
export async function cambiarCamara(id:string,cambios:Partial<Pick<Camara,'activa'|'dispositivo'|'zona_id'>>){
 const {error:e}=await supabaseBrowser().from('vs_camaras').update(cambios).eq('id',id);error(e);
}
// Los nombres de las cámaras solo aparecen después de conceder el permiso una vez.
export async function camarasDelEquipo(){
 if(!navigator.mediaDevices?.enumerateDevices)throw new Error('Este navegador no permite listar cámaras.');
 let lista=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
 if(lista.some(d=>!d.label)){const s=await navigator.mediaDevices.getUserMedia({video:true,audio:false});s.getTracks().forEach(t=>t.stop());lista=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');}
 return lista;
}
export async function abrirCamara(camara?:Camara){
 if(!navigator.mediaDevices?.getUserMedia)throw new Error('Este navegador no permite usar la cámara.');
 if(!camara?.dispositivo)return navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
 const d=buscarDispositivo(await camarasDelEquipo(),camara.dispositivo);
 if(!d)throw new Error(`La cámara «${camara.nombre}» no está conectada a este equipo.`);
 return navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:d.deviceId}},audio:false});
}
