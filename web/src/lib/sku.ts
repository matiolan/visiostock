// HU-07: el código impreso puede ser solo el SKU, "SKU:ABC-1" o un enlace con ?sku=ABC-1.
export function skuDesdeCodigo(texto:string){
 const t=texto.trim();const m=t.match(/(?:^|[?&;,\s])sku\s*[:=]\s*([^&;,\s]+)/i);
 if(!m)return t;try{return decodeURIComponent(m[1]).trim();}catch{return m[1].trim();}
}
const normal=(s:string)=>s.trim().toUpperCase();
export function productosPorCodigo<T extends {id:string;sku:string}>(productos:T[],codigos:string[]):T[]{
 const buscados=new Set(codigos.map(c=>normal(skuDesdeCodigo(c))).filter(Boolean));
 return productos.filter(p=>buscados.has(normal(p.sku)));
}
// Movimientos leídos de un video: se registran solo los que tienen un único producto del almacén con ese SKU.
export type MovimientoVideo={sentido:'entrada'|'salida';segundo:number;codigo:string|null;tipo:string|null;imagen:string|null};
export function clasificarMovimientos<T extends {id:string;sku:string;almacen_id:string}>(movs:MovimientoVideo[],productos:T[],almacen:string){
 const delAlmacen=productos.filter(p=>p.almacen_id===almacen);
 return movs.map(m=>{const encontrados=m.codigo?productosPorCodigo(delAlmacen,[m.codigo]):[];
  return {...m,producto:encontrados.length===1?encontrados[0]:null,motivo:!m.codigo?'NO IDENTIFICADO':encontrados.length?'':'Código sin producto en este almacén'};});
}
