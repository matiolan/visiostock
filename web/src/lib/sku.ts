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
