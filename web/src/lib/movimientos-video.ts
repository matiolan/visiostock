import { supabaseBrowser } from './supabase';
import { visionURL } from './verificaciones';
import type { MovimientoVideo } from './sku';
export type SinSku={id:string;empresa_id:string;almacen_id:string;sentido:'entrada'|'salida';cantidad:number;codigo_leido:string;evidencia:string;segundo:number;creado_en:string;resuelto_en:string|null;producto_id:string|null};
async function respuesta(r:Response){const body=await r.json();if(!r.ok)throw new Error(typeof body.detail==='string'?body.detail:'El servicio de visión no pudo procesar el video.');return body;}
export async function movimientosDeVideo(file:File,clase:string,linea:number):Promise<{movimientos:MovimientoVideo[];modelo:string}>{
 const {data:{session}}=await supabaseBrowser().auth.getSession();if(!session)throw new Error('Inicia sesión nuevamente.');
 const form=new FormData();form.append('video',file);form.append('clase',clase);form.append('linea',String(linea));
 return respuesta(await fetch(visionURL+'/movimientos',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:form,signal:AbortSignal.timeout(180000)}));
}
export async function registrarMovimiento(producto:string,sentido:string){
 const {error}=await supabaseBrowser().rpc('vs_registrar_movimiento',{p:producto,s:sentido,n:1});
 if(error)throw new Error(error.message.includes('Stock insuficiente')?'Stock insuficiente para registrar una de las salidas.':'No se pudo registrar el movimiento.');
}
// HU-07: la imagen de la caja sin código legible se guarda como evidencia privada para revisarla.
export async function registrarSinSku(almacen:{id:string;empresa_id:string},m:MovimientoVideo){
 const db=supabaseBrowser();const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Inicia sesión nuevamente.');
 if(!m.imagen)throw new Error('Falta la imagen de evidencia del movimiento.');
 const bytes=Uint8Array.from(atob(m.imagen),c=>c.charCodeAt(0));const path=`${almacen.empresa_id}/${user.id}/${crypto.randomUUID()}.jpg`;
 const {error:subida}=await db.storage.from('vs-evidencias').upload(path,new Blob([bytes],{type:'image/jpeg'}),{contentType:'image/jpeg',upsert:false});
 if(subida)throw new Error('No se pudo subir la evidencia del movimiento sin SKU.');
 const {error}=await db.rpc('vs_registrar_sin_sku',{a:almacen.id,s:m.sentido,n:1,cod:m.codigo||'',foto:path,seg:m.segundo});
 if(error){await db.storage.from('vs-evidencias').remove([path]);throw new Error('No se pudo registrar el movimiento sin SKU. Ejecuta supabase/05_movimientos_sin_sku.sql si es la primera vez.');}
}
export async function listarSinSku():Promise<SinSku[]>{
 const {data,error}=await supabaseBrowser().from('vs_movimientos_sin_sku').select('*').is('resuelto_en',null).order('creado_en',{ascending:false}).limit(200);
 if(error)throw new Error('No se pudieron cargar los movimientos por revisar. Si es tu primera vez, ejecuta supabase/05_movimientos_sin_sku.sql en Supabase.');return data||[];
}
export async function resolverSinSku(id:string,producto:string){
 const {error}=await supabaseBrowser().rpc('vs_resolver_sin_sku',{i:id,p:producto});
 if(error)throw new Error(error.message.includes('Stock insuficiente')?'Stock insuficiente para registrar esa salida.':'No se pudo asignar el producto.');
}
