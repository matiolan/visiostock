import { supabaseBrowser } from './supabase';
import { buscarDispositivo, type Camara, type Zona } from './dispositivos';
const sinMigracion='No se pudieron cargar las cámaras. Si es tu primera vez, ejecuta supabase/05_camaras_zonas.sql en Supabase.';
export async function listarCamaras():Promise<{zonas:Zona[];camaras:Camara[]}>{
 const db=supabaseBrowser();const [z,c]=await Promise.all([db.from('vs_zonas').select('*').order('nombre'),db.from('vs_camaras').select('*').order('nombre')]);
 if(z.error||c.error)throw new Error(sinMigracion);return {zonas:z.data||[],camaras:c.data||[]};
}
function error(e:{code?:string}|null){if(!e)return;if(e.code==='23505')throw new Error('Ya existe un registro con ese nombre en el mismo lugar.');throw new Error('No se pudo guardar. Comprueba tu permiso y que ejecutaste 05_camaras_zonas.sql.');}
export async function crearZona(almacen:{id:string;empresa_id:string},nombre:string){
 const {error:e}=await supabaseBrowser().from('vs_zonas').insert({empresa_id:almacen.empresa_id,almacen_id:almacen.id,nombre:nombre.trim()});error(e);
}
export async function crearCamara(zona:Zona,nombre:string,dispositivo:string){
 const {error:e}=await supabaseBrowser().from('vs_camaras').insert({empresa_id:zona.empresa_id,zona_id:zona.id,nombre:nombre.trim(),dispositivo:dispositivo.trim()});error(e);
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
