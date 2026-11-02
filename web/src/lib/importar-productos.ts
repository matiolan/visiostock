import { supabaseBrowser } from './supabase';
import type { FilaImportacion } from './csv-inventario';
export async function importarProductos(empresa: string, almacen: string, filas: FilaImportacion[]) {
  if (!empresa || !almacen || !filas.length || filas.length > 500) throw new Error('Selecciona el destino y entre 1 y 500 productos.');
  if (filas.some(p => !p.sku.trim() || p.sku.length > 80 || !p.nombre.trim() || p.nombre.length > 160 || !Number.isSafeInteger(p.stock) || p.stock < 0 || p.stock > 2147483647) || new Set(filas.map(p => p.sku)).size !== filas.length) throw new Error('Hay productos inválidos o repetidos.');
  const db = supabaseBrowser();
  const { data: { user }, error: auth } = await db.auth.getUser();
  if (auth || !user) throw new Error('Tu sesión venció. Inicia sesión de nuevo.');
  const { data: miembro, error: em } = await db.from('vs_miembros').select('empresa_id,rol').eq('user_id', user.id).single();
  if (em || !miembro || (miembro.rol !== 'administrador' && miembro.empresa_id !== empresa)) throw new Error('No tienes acceso a esa empresa.');
  const { data: destino, error: ea } = await db.from('vs_almacenes').select('id').eq('id', almacen).eq('empresa_id', empresa).single();
  if (ea || !destino) throw new Error('El almacén no pertenece a la empresa seleccionada o no tienes acceso.');
  const existentes: { sku: string }[] = [];
  for (let i = 0; i < filas.length; i += 50) {
    const { data, error: ex } = await db.from('vs_productos').select('sku').eq('empresa_id', empresa).eq('almacen_id', almacen).in('sku', filas.slice(i, i + 50).map(p => p.sku));
    if (ex) throw new Error('No se pudo comprobar si los productos ya existen.');
    existentes.push(...(data || []));
  }
  if (existentes?.length) throw new Error(`No se importó ningún producto. Ya existen estos SKU en el almacén: ${existentes.slice(0,10).map(p => p.sku).join(', ')}. Elimina esas filas del CSV para agregar los demás.`);
  // Una sola solicitud INSERT: PostgreSQL guarda el lote completo o lo revierte.
  // RLS y la clave foránea compuesta siguen comprobando empresa y almacén en la base.
  const { error, count } = await db.from('vs_productos').insert(filas.map(p => ({ empresa_id: empresa, almacen_id: almacen, sku: p.sku, nombre: p.nombre, stock: p.stock })), { count: 'exact' });
  if (error) throw new Error(error.code === '23505' ? 'No se importó el lote: uno de los SKU acaba de ser registrado. Actualiza el inventario y revisa el archivo.' : 'No se pudo guardar el lote. Revisa los permisos y la conexión.');
  return count ?? filas.length;
}
