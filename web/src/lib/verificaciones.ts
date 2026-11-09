import { supabaseBrowser } from './supabase';
export type Verificacion = {id:string;producto_id:string;stock_registrado:number;conteo:number;diferencia:number;metodo:'manual'|'asistido';camara_id?:string|null;modelo:string|null;clase:string|null;evidencia:string;nota:string;creado_en:string;revisado_en:string|null;revision:string};
export type Analisis = {conteo:number;modelo:string;clase:string;cajas:{x1:number;y1:number;x2:number;y2:number;confianza:number}[];ancho:number;alto:number;apilamiento?:{altura:number;maximo:number;alerta:boolean}};
export const visionURL = (import.meta.env.VITE_VISION_URL || '').replace(/\/$/,'');
async function respuesta(r: Response) { const body=await r.json(); if(!r.ok) throw new Error(typeof body.detail==='string'?body.detail:'El servicio de visión no pudo procesar la solicitud.'); return body; }
export async function estadoVision():Promise<{listo:boolean;clases:string[];mensaje:string}> {
 if(!visionURL)return {listo:false,clases:[],mensaje:'El conteo automático aún no está conectado. Puedes registrar una revisión manual con foto.'};
 return respuesta(await fetch(visionURL+'/estado',{signal:AbortSignal.timeout(10000)}));
}
export async function analizarImagen(file:File,producto:string,clase:string):Promise<Analisis>{
 const {data:{session}}=await supabaseBrowser().auth.getSession();if(!session)throw new Error('Inicia sesión nuevamente.');
 const form=new FormData();form.append('imagen',file);form.append('producto',producto);form.append('clase',clase);
 return respuesta(await fetch(visionURL+'/analizar',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:form,signal:AbortSignal.timeout(120000)}));
}
export type Codigo={tipo:string;texto:string};
export async function identificarCodigos(file:File):Promise<Codigo[]>{
 const {data:{session}}=await supabaseBrowser().auth.getSession();if(!session)throw new Error('Inicia sesión nuevamente.');
 const form=new FormData();form.append('imagen',file);
 return (await respuesta(await fetch(visionURL+'/identificar',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:form,signal:AbortSignal.timeout(30000)}))).codigos;
}
export async function listarVerificaciones():Promise<Verificacion[]>{
 const {data,error}=await supabaseBrowser().from('vs_verificaciones').select('*').order('creado_en',{ascending:false}).limit(500);
 if(error)throw new Error('No se pudo cargar el historial. Si es tu primera vez, ejecuta supabase/02_verificaciones.sql en Supabase.');return data||[];
}
export async function guardarVerificacion(producto:{id:string;empresa_id:string},file:File,conteo:number,nota:string,analisis:Analisis|null,camara=''){
 if(!Number.isInteger(conteo)||conteo<0||conteo>2147483647)throw new Error('El conteo debe ser un entero no negativo.');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5242880)throw new Error('Usa JPG, PNG o WebP de hasta 5 MB.');
 const db=supabaseBrowser();const {data:{user},error:auth}=await db.auth.getUser();if(auth||!user)throw new Error('Inicia sesión nuevamente.');
 const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path=`${producto.empresa_id}/${user.id}/${crypto.randomUUID()}.${ext}`;
 const {error:upload}=await db.storage.from('vs-evidencias').upload(path,file,{contentType:file.type,upsert:false});
 if(upload)throw new Error('No se pudo subir la evidencia. Verifica que ejecutaste 02_verificaciones.sql y que tienes acceso a la empresa.');
 const {error}=await db.rpc('vs_guardar_verificacion',{p:producto.id,n:conteo,foto:path,met:analisis?'asistido':'manual',mod:analisis?.modelo||null,cl:analisis?.clase||null,obs:nota,...(camara?{cam:camara}:{})});
 if(error){await db.storage.from('vs-evidencias').remove([path]);throw new Error('No se pudo registrar la verificación. Actualiza tu sesión y vuelve a intentarlo.');}
}
export async function verEvidencia(path:string){const {data,error}=await supabaseBrowser().storage.from('vs-evidencias').createSignedUrl(path,60);if(error||!data)throw new Error('No se pudo abrir la evidencia.');return data.signedUrl;}
export async function revisarAlerta(id:string,nota:string){const {error}=await supabaseBrowser().rpc('vs_revisar_verificacion',{v:id,obs:nota});if(error)throw new Error('No se pudo guardar la revisión. La nota debe tener entre 5 y 1000 caracteres.');}
