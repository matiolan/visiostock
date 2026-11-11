import {supabaseBrowser} from './supabase';
import {mensajeSinEmpresa} from './acceso-google';
export async function api(body?:Record<string,unknown>){
 const db=supabaseBrowser();const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user){window.location.assign('/acceso');throw new Error('Inicia sesión.');}
 const {data:m,error:me}=await db.from('vs_miembros').select('*').eq('user_id',user.id).single();
 if(me||!m)throw new Error(mensajeSinEmpresa(user.email));
 if(!body){const rr=await Promise.all(['vs_empresas','vs_almacenes','vs_productos','vs_movimientos'].map(t=>db.from(t).select('*').limit(1000)));if(rr.some(x=>x.error))throw new Error('No se pudieron cargar los datos. Comprueba que ejecutaste supabase/esquema.sql.');return{usuario:user.email,rol:m.rol,empresas:rr[0].data||[],almacenes:rr[1].data||[],productos:rr[2].data||[],movimientos:rr[3].data||[]};}
 let result;
 switch(body.accion){
 case 'empresa':result=await db.from('vs_empresas').insert({nombre:String(body.nombre).trim()});break;
 case 'almacen':result=await db.from('vs_almacenes').insert({empresa_id:body.empresa,nombre:String(body.nombre).trim(),direccion:body.direccion||''});break;
 case 'producto':{
 if(!Number.isSafeInteger(body.stock)||Number(body.stock)<0)throw new Error('El stock debe ser un entero no negativo.');
 result=await db.from('vs_productos').insert({empresa_id:m.rol==='administrador'?body.empresa:m.empresa_id,almacen_id:body.almacen,sku:String(body.sku).trim(),nombre:String(body.nombre).trim(),stock:body.stock});break;}
 case 'movimiento':result=await db.rpc('vs_registrar_movimiento',{p:body.producto,s:body.sentido,n:body.cantidad});break;
 case 'asignar':result=await db.rpc('vs_asignar_cliente',{correo:String(body.email).trim().toLowerCase(),empresa:body.empresa});break;
 default:throw new Error('Operación no disponible.');}
 if(result.error){if(result.error.message.includes('Stock insuficiente'))throw new Error('Stock insuficiente para registrar esa salida.');if(result.error.code==='23505')throw new Error('Ya existe un registro con esos datos.');throw new Error('No se pudo guardar. Comprueba tu permiso, los datos y que el almacén pertenezca a la empresa seleccionada.');}return{ok:true};
}
