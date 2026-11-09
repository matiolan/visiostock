import { supabaseBrowser } from './supabase';
export async function registrarMovimiento(producto:{id:string;empresa_id:string},foto:File,sentido:'entrada'|'salida',cantidad:number,zona:string){
 if(!Number.isInteger(cantidad)||cantidad<=0)throw new Error('La cantidad debe ser un entero mayor que 0.');
 if(!['image/jpeg','image/png','image/webp'].includes(foto.type)||foto.size>5242880)throw new Error('Usa JPG, PNG o WebP de hasta 5 MB.');
 const db=supabaseBrowser();const {data:{user},error:auth}=await db.auth.getUser();if(auth||!user)throw new Error('Inicia sesión nuevamente.');
 const ext=foto.type==='image/png'?'png':foto.type==='image/webp'?'webp':'jpg';const path=`${producto.empresa_id}/${user.id}/${crypto.randomUUID()}.${ext}`;
 const {error:upload}=await db.storage.from('vs-evidencias').upload(path,foto,{contentType:foto.type,upsert:false});
 if(upload)throw new Error('No se pudo subir la evidencia. Verifica que tienes acceso a la empresa.');
 const {error}=await db.rpc('vs_registrar_movimiento',{p:producto.id,s:sentido,n:cantidad,foto:path,zona:zona.trim()||'A'});
 if(error){await db.storage.from('vs-evidencias').remove([path]);if(error.message.includes('Stock insuficiente'))throw new Error('Stock insuficiente para registrar esa salida.');throw new Error('No se pudo registrar el movimiento.');}
}
