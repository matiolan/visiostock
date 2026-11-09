import { useEffect, useRef, useState } from 'react';
import { registrarMovimiento } from './lib/movimientos';
type Producto={id:string;empresa_id:string;sku:string;nombre:string;stock:number};
type Movimiento={id:string;creado_en:string;producto_id:string;sentido:string;cantidad:number;zona?:string};
export default function Movimientos({productos,movimientos,alTerminar}:{productos:Producto[];movimientos:Movimiento[];alTerminar:()=>Promise<void>}){
 const [productoId,setProductoId]=useState(''),[sentido,setSentido]=useState<'entrada'|'salida'>('entrada'),[cantidad,setCantidad]=useState('');
 const [zona,setZona]=useState('A'),[foto,setFoto]=useState<File|null>(null);
 const [mensaje,setMensaje]=useState(''),[busy,setBusy]=useState(false);
 const lienzo=useRef<HTMLCanvasElement>(null);
 const producto=productos.find(p=>p.id===productoId);
 function elegir(file:File|null){setMensaje('');if(file&&(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5242880)){setFoto(null);setMensaje('Usa una imagen JPG, PNG o WebP de hasta 5 MB.');return;}setFoto(file);}
 // La vista previa se dibuja en un canvas a partir de los píxeles del archivo; ningún dato elegido por el usuario llega a un atributo src (evita XSS a través del DOM).
 useEffect(()=>{if(!foto)return;let vigente=true;void createImageBitmap(foto,{imageOrientation:'from-image'}).then(b=>{const c=lienzo.current,ctx=c?.getContext('2d');if(vigente&&c&&ctx){c.width=b.width;c.height=b.height;ctx.drawImage(b,0,0);}b.close();}).catch(()=>{if(vigente)setMensaje('No se pudo mostrar la imagen seleccionada.');});return()=>{vigente=false;};},[foto]);
 async function enviar(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(!producto||!foto)return;setBusy(true);setMensaje('');try{await registrarMovimiento(producto,foto,sentido,Number(cantidad),zona);setCantidad('');elegir(null);await alTerminar();setMensaje('Movimiento guardado con evidencia.');}catch(err){setMensaje(err instanceof Error?err.message:'No se pudo guardar.');}finally{setBusy(false);}}
 return <><h2>Registrar entrada o salida</h2><form className="vs-form-grid" onSubmit={enviar}>
 <label>Producto<select value={productoId} disabled={busy} onChange={e=>setProductoId(e.target.value)} required><option value="">Selecciona un producto</option>{productos.map(p=><option key={p.id} value={p.id}>{p.sku} · {p.nombre}</option>)}</select></label>
 <label>Zona<input value={zona} disabled={busy} onChange={e=>setZona(e.target.value)} maxLength={20} required/></label>
 <label>Sentido<select value={sentido} disabled={busy} onChange={e=>setSentido(e.target.value as 'entrada'|'salida')}><option value="entrada">Entrada</option><option value="salida">Salida</option></select></label>
 <label>Cantidad<input value={cantidad} disabled={busy} onChange={e=>setCantidad(e.target.value)} type="number" min="1" step="1" required/></label>
 <label className="photo-upload">Evidencia (foto)<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{elegir(e.target.files?.[0]||null);e.target.value='';}}/></label>
 {foto&&<div className="photo-preview"><canvas ref={lienzo} role="img" aria-label="Evidencia del movimiento"/></div>}
 <button disabled={busy||!producto||!foto}>{busy?'Guardando…':'Guardar movimiento'}</button>
 </form><p className="status" role="status">{mensaje}</p><Lista movimientos={movimientos} productos={productos}/></>;
}
function Lista({movimientos,productos}:{movimientos:Movimiento[];productos:Producto[]}){return <div className="vs-table-wrap"><table><thead><tr><th>Fecha y hora</th><th>Producto</th><th>Zona</th><th>Movimiento</th><th>Cantidad</th></tr></thead><tbody>{movimientos.map(m=><tr key={m.id}><td>{new Date(m.creado_en).toLocaleString('es-PE',{timeZone:'America/Lima'})}</td><td>{productos.find(p=>p.id===m.producto_id)?.nombre||'Producto'}</td><td>{m.zona||'—'}</td><td><span className="vs-tag">{m.sentido}</span></td><td>{m.cantidad}</td></tr>)}</tbody></table>{!movimientos.length&&<p className="vs-empty">Aún no hay movimientos registrados.</p>}</div>;}
