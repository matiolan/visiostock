import { supabaseBrowser } from './supabase';
import { visionURL } from './verificaciones';
import type { AlertaManipulacion, TipoIncidencia } from './incidencias';
export type Incidencia={id:string;producto_id:string;camara_id:string|null;tipo:TipoIncidencia;origen:'video'|'foto';segundo:number;confianza:number;detalle:string;evidencia:string|null;modelo:string;creado_en:string;revisado_en:string|null;revision:string};
async function respuesta(r:Response){const body=await r.json();if(!r.ok)throw new Error(typeof body.detail==='string'?body.detail:'El servicio de visión no pudo procesar el video.');return body;}
export async function analizarVideo(file:File,producto:string,clase:string):Promise<{alertas:AlertaManipulacion[];duracion:number;modelo:string}>{
 const {data:{session}}=await supabaseBrowser().auth.getSession();if(!session)throw new Error('Inicia sesión nuevamente.');
 const form=new FormData();form.append('video',file);form.append('producto',producto);form.append('clase',clase);
 return respuesta(await fetch(visionURL+'/manipulacion',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:form,signal:AbortSignal.timeout(180000)}));
}
// HU-08: cada incidencia guarda la captura del momento como evidencia privada.
async function subirCaptura(empresa:string,imagen:string){
 const db=supabaseBrowser();const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Inicia sesión nuevamente.');
 const path=`${empresa}/${user.id}/${crypto.randomUUID()}.jpg`;const bytes=Uint8Array.from(atob(imagen),c=>c.charCodeAt(0));
 const {error}=await db.storage.from('vs-evidencias').upload(path,new Blob([bytes],{type:'image/jpeg'}),{contentType:'image/jpeg',upsert:false});
 if(error)throw new Error('No se pudo subir la captura de la incidencia.');return path;
}
export async function registrarIncidencias(producto:{id:string;empresa_id:string},alertas:AlertaManipulacion[],origen:'video'|'foto',modelo:string,camara=''){
 const db=supabaseBrowser();
 for(const a of alertas){const foto=a.imagen?await subirCaptura(producto.empresa_id,a.imagen):null;
  const {error}=await db.rpc('vs_registrar_incidencia',{p:producto.id,t:a.tipo,ori:origen,seg:a.segundo,conf:a.confianza,det:a.detalle.slice(0,300),mod:modelo.slice(0,160),...(camara?{cam:camara}:{}),...(foto?{foto}:{})});
  if(error){if(foto)await db.storage.from('vs-evidencias').remove([foto]);throw new Error('No se pudo registrar la incidencia. Comprueba tu acceso y que ejecutaste supabase/07_manipulacion.sql.');}}
}
export async function listarIncidencias():Promise<Incidencia[]>{
 const {data,error}=await supabaseBrowser().from('vs_incidencias').select('*').order('creado_en',{ascending:false}).limit(500);
 if(error)throw new Error('No se pudo cargar el historial. Si es tu primera vez, ejecuta supabase/07_manipulacion.sql en Supabase.');return data||[];
}
export async function revisarIncidencia(id:string,nota:string){const {error}=await supabaseBrowser().rpc('vs_revisar_incidencia',{i:id,obs:nota});if(error)throw new Error('No se pudo guardar la revisión. La nota debe tener entre 5 y 1000 caracteres.');}
