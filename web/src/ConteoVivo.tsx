import { useEffect, useRef, useState } from 'react';
import { Film, Play, Square, Video } from 'lucide-react';
import { supabaseBrowser } from './lib/supabase';
import { estadoVision, visionURL } from './lib/verificaciones';
import { abrirCamara, cambiarCamara, listarCamaras } from './lib/camaras';
import { camarasDelAlmacen, type Camara, type Zona } from './lib/dispositivos';
import { registrarMovimiento } from './lib/movimientos-video';
import { ContadorZonas, recorte, rectDesde, zonasValidas, type Caja, type Rect, type Zonas } from './lib/conteo-vivo';
type Producto={id:string;almacen_id:string;empresa_id:string;sku:string;nombre:string;stock:number};
type Almacen={id:string;nombre:string;empresa_id:string};
type Evento={n:number;sentido:'entrada'|'salida';hora:string;imagen:string;danada:boolean;prueba:boolean;estado:'pendiente'|'guardando'|'registrado'|'error'};
const INICIALES:Zonas=[[.02,.05,.35,.95],[.65,.05,.98,.95]];
const PASO=.2; // segundos entre cuadros al analizar un video de prueba
const clave=(almacen:string,camara:string)=>`vs-zonas-${almacen}-${camara||'local'}`;
function leerLocal(k:string):Zonas|null{try{const z:unknown=JSON.parse(localStorage.getItem(k)||'null');return zonasValidas(z)?z:null;}catch{return null;}}
async function detectar(imagen:Blob,clase:string):Promise<Caja[]|null>{
 const {data:{session}}=await supabaseBrowser().auth.getSession();if(!session)throw new Error('Inicia sesión nuevamente.');
 const form=new FormData();form.append('imagen',imagen,'cuadro.jpg');form.append('clase',clase);
 const r=await fetch(visionURL+'/detectar',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:form,signal:AbortSignal.timeout(15000)});
 if(r.status===429)return null; // detector ocupado: se sigue con el próximo cuadro
 if(r.status===404)throw new Error('El servicio de visión aún no tiene el conteo en vivo. Actualízalo y vuelve a intentar.');
 const body=await r.json();if(!r.ok)throw new Error(typeof body.detail==='string'?body.detail:'El servicio de visión no respondió.');return body.cajas;
}
// Cuenta las cajas que pasan entre dos zonas. No hace falta un código: cada caja se registra en el producto
// elegido para la sesión. Un video cargado sirve para probar y no cambia el stock.
export default function ConteoVivo({productos,almacenes,empresas,alTerminar}:{productos:Producto[];almacenes:Almacen[];empresas:{id:string;nombre:string}[];alTerminar:()=>Promise<void>}){
 const [almacenId,setAlmacenId]=useState(''),[productoId,setProductoId]=useState(''),[camaraId,setCamaraId]=useState('');
 const [lugares,setLugares]=useState<{zonas:Zona[];camaras:Camara[]}>({zonas:[],camaras:[]}),[listo,setListo]=useState(false),[clase,setClase]=useState('');
 const [fuente,setFuente]=useState<'camara'|'video'|null>(null),[zonas,setZonas]=useState<Zonas>(INICIALES),[dibujo,setDibujo]=useState<0|1|null>(null),[borrador,setBorrador]=useState<Rect|null>(null);
 const [contando,setContando]=useState(false),[cajas,setCajas]=useState<{id:number;caja:Caja}[]>([]),[tam,setTam]=useState({w:16,h:9}),[ritmo,setRitmo]=useState(0);
 const [eventos,setEventos]=useState<Evento[]>([]),[auto,setAuto]=useState(false),[busy,setBusy]=useState(false),[mensaje,setMensaje]=useState('');
 const video=useRef<HTMLVideoElement>(null),flujo=useRef<MediaStream|null>(null),url=useRef(''),activo=useRef(0),inicio=useRef<{x:number;y:number}|null>(null),contador=useRef(new ContadorZonas()),numero=useRef(0),enCurso=useRef(0);
 // El bucle de conteo es largo: lee los valores actuales desde aquí.
 const ahora=useRef({zonas,auto,producto:undefined as Producto|undefined,zonaId:null as string|null});
 const producto=productos.find(p=>p.id===productoId),camaras=camarasDelAlmacen(lugares.camaras,lugares.zonas,almacenId),camara=camaras.find(c=>c.id===camaraId);
 ahora.current={zonas,auto:auto&&fuente==='camara',producto,zonaId:camara?.zona_id||null};
 const entradas=eventos.filter(e=>e.sentido==='entrada').length,salidas=eventos.length-entradas,pendientes=eventos.filter(e=>!e.prueba&&(e.estado==='pendiente'||e.estado==='error'));
 function detener(){activo.current++;setContando(false);setCajas([]);if(url.current)video.current?.pause();}
 function cerrar(){detener();flujo.current?.getTracks().forEach(t=>t.stop());flujo.current=null;if(url.current)URL.revokeObjectURL(url.current);url.current='';setFuente(null);}
 useEffect(()=>{void estadoVision().then(v=>{setListo(v.listo);setClase(v.clases[0]||'');}).catch(()=>setListo(false));void listarCamaras().then(setLugares).catch(()=>undefined);
  return()=>{activo.current++;flujo.current?.getTracks().forEach(t=>t.stop());if(url.current)URL.revokeObjectURL(url.current);};},[]);
 useEffect(()=>{const guardada=camara?.zonas_conteo;setZonas(zonasValidas(guardada)?guardada:leerLocal(clave(almacenId,camaraId))||INICIALES);},[almacenId,camaraId,camara]);
 useEffect(()=>{const v=video.current;if(!v||!fuente)return;if(fuente==='camara'){v.srcObject=flujo.current;void v.play().catch(()=>undefined);}else{v.srcObject=null;v.src=url.current;}},[fuente]);
 function cambiarLugar(a:string,c:string){if(a!==almacenId)setProductoId('');if(fuente==='camara')cerrar();else detener();setAlmacenId(a);setCamaraId(c);}
 async function abrir(){cerrar();setEventos(l=>l.filter(e=>!e.prueba));setMensaje('');const turno=activo.current;try{const s=await abrirCamara(camara);if(turno!==activo.current){s.getTracks().forEach(t=>t.stop());return;}flujo.current=s;setFuente('camara');}catch(e){setMensaje(e instanceof Error&&e.message.startsWith('La cámara')?e.message:'No se pudo abrir la cámara. Permite su uso o carga un video de prueba.');}}
 function cargar(f:File|null){if(!f)return;cerrar();setEventos([]);setMensaje('');url.current=URL.createObjectURL(f);setFuente('video');}
 async function guardarZonas(z:Zonas){setZonas(z);contador.current.reiniciar();
  try{localStorage.setItem(clave(almacenId,camaraId),JSON.stringify(z));}catch{/* sin almacenamiento local */}
  if(!camara)return setMensaje('Zonas guardadas en este navegador. Elige una cámara registrada para guardarlas para toda la empresa.');
  try{await cambiarCamara(camara.id,{zonas_conteo:z});setLugares(l=>({...l,camaras:l.camaras.map(c=>c.id===camara.id?{...c,zonas_conteo:z}:c)}));setMensaje(`Zonas guardadas en la cámara «${camara.nombre}».`);}
  catch{setMensaje('Zonas guardadas solo en este navegador: falta ejecutar supabase/12_zonas_conteo.sql o no tienes permiso.');}}
 const punto=(e:React.PointerEvent)=>{const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
 function soltar(e:React.PointerEvent){if(dibujo===null||!inicio.current)return;const r=rectDesde(inicio.current,punto(e));inicio.current=null;setBorrador(null);
  const nuevas:Zonas=dibujo===0?[r,zonas[1]]:[zonas[0],r];if(!zonasValidas(nuevas)){setMensaje('La zona es muy pequeña. Arrastra un recuadro más grande.');return;}
  setDibujo(null);void guardarZonas(nuevas);}
 async function registrar(ev:Evento,p:Producto,zonaId:string|null){if(ev.prueba)return false;setEventos(l=>l.map(x=>x.n===ev.n?{...x,estado:'guardando'}:x));
  try{await registrarMovimiento(p.id,ev.sentido,p.empresa_id,ev.imagen,zonaId);setEventos(l=>l.map(x=>x.n===ev.n?{...x,estado:'registrado'}:x));return true;}
  catch(e){setEventos(l=>l.map(x=>x.n===ev.n?{...x,estado:'error'}:x));setMensaje(e instanceof Error?e.message:'No se pudo registrar.');return false;}}
 async function registrarTodos(){if(!producto)return;setBusy(true);let ok=0;try{for(const ev of pendientes)if(await registrar(ev,producto,camara?.zona_id||null))ok++;if(ok===pendientes.length)setMensaje(`${ok} movimiento(s) registrados en ${producto.sku}.`);}finally{setBusy(false);await alTerminar();}}
 async function contar(){const v=video.current;if(!v||!v.videoWidth){setMensaje('La imagen aún no está lista.');return;}
  const turno=++activo.current,esVideo=fuente==='video',lienzo=document.createElement('canvas'),foto=document.createElement('canvas'),t0=performance.now();contador.current.reiniciar();setContando(true);setMensaje(esVideo?'Analizando el video de prueba…':'');
  if(esVideo){v.pause();if(v.duration-v.currentTime<PASO)v.currentTime=0;}
  let fallas=0,previo=performance.now();
  while(activo.current===turno){
   try{
    const W=v.videoWidth,H=v.videoHeight,z=ahora.current.zonas,c=recorte(z,W,H),escala=Math.min(1,960/Math.max(c.ancho,c.alto));
    const t=esVideo?v.currentTime:(performance.now()-t0)/1000;
    lienzo.width=Math.round(c.ancho*escala);lienzo.height=Math.round(c.alto*escala);lienzo.getContext('2d')!.drawImage(v,c.x,c.y,c.ancho,c.alto,0,0,lienzo.width,lienzo.height);
    const ef=Math.min(1,640/W);foto.width=Math.round(W*ef);foto.height=Math.round(H*ef);foto.getContext('2d')!.drawImage(v,0,0,foto.width,foto.height); // mismo cuadro, para la evidencia
    // toBlob se frena a un cuadro por segundo cuando la pestaña queda en segundo plano.
    const blob=new Blob([Uint8Array.from(atob(lienzo.toDataURL('image/jpeg',.85).split(',')[1]),k=>k.charCodeAt(0))],{type:'image/jpeg'});
    const halladas=await detectar(blob,clase);if(activo.current!==turno)return;
    fallas=0;
    if(halladas){const enCuadro=halladas.map(k=>({...k,x1:k.x1/escala+c.x,y1:k.y1/escala+c.y,x2:k.x2/escala+c.x,y2:k.y2/escala+c.y}));
     const cruces=contador.current.actualizar(enCuadro,t,z,W,H);setCajas(contador.current.visibles);const n=performance.now();setRitmo(1000/Math.max(1,n-previo));previo=n;
     for(const k of cruces){const g=document.createElement('canvas');g.width=foto.width;g.height=foto.height;const x=g.getContext('2d')!;x.drawImage(foto,0,0);x.strokeStyle='#51f0ae';x.lineWidth=3;x.strokeRect(k.caja.x1*ef,k.caja.y1*ef,(k.caja.x2-k.caja.x1)*ef,(k.caja.y2-k.caja.y1)*ef);
      const ev:Evento={n:++numero.current,sentido:k.sentido,hora:esVideo?`${t.toFixed(1)} s`:new Date().toLocaleTimeString('es-PE',{timeZone:'America/Lima'}),imagen:g.toDataURL('image/jpeg',.8).split(',')[1],danada:!!k.caja.danada,prueba:esVideo,estado:'pendiente'};
      setEventos(l=>[ev,...l]);const {auto:a,producto:p,zonaId}=ahora.current;
      if(a&&p){enCurso.current++;void registrar(ev,p,zonaId).finally(()=>{if(--enCurso.current===0)void alTerminar();});}}
    }else await new Promise(r=>setTimeout(r,300));
    if(esVideo&&halladas){if(v.currentTime+PASO>=v.duration){setMensaje('Video de prueba terminado. El stock no cambió.');break;}
     await new Promise<void>(r=>{const fin=()=>{window.clearTimeout(tope);v.removeEventListener('seeked',fin);r();};const tope=window.setTimeout(fin,3000);v.addEventListener('seeked',fin);v.currentTime+=PASO;});}
   }catch(e){if(activo.current!==turno)return;if(++fallas>=3){setMensaje(e instanceof Error&&e.name!=='TimeoutError'&&!(e instanceof TypeError)?e.message:'Se perdió la conexión con el servicio de visión. El conteo se detuvo.');break;}await new Promise(r=>setTimeout(r,1000));}
  }
  if(activo.current===turno)detener();}
 const pinta=(r:Rect,color:string,texto:string)=><g key={texto}><rect x={r[0]*tam.w} y={r[1]*tam.h} width={(r[2]-r[0])*tam.w} height={(r[3]-r[1])*tam.h} fill={color} fillOpacity=".12" stroke={color} strokeWidth={tam.w/320}/><text x={r[0]*tam.w+tam.w/90} y={r[1]*tam.h+tam.w/34} fill={color} fontSize={tam.w/42} fontWeight="700">{texto}</text></g>;
 const color=(id:number,c:Caja)=>c.danada?'#ff5c5c':'#51f0ae';
 return <section className="live-count"><div className="vs-section-title"><h2>Conteo en vivo</h2><span>Entradas y salidas por zonas, sin escanear códigos</span></div>
 {!visionURL||!listo?<div className="vision-status"><Video size={20}/><p>El conteo en vivo necesita el servicio de visión con el modelo cargado.</p></div>:
 <div className="verification-grid"><div className="verification-card"><p className="vs-eyebrow">Paso 1 · Cámara y zonas</p>
 <label>Almacén<select disabled={contando||busy||pendientes.length>0} value={almacenId} onChange={e=>cambiarLugar(e.target.value,'')}><option value="">Selecciona el almacén</option>{almacenes.map(a=><option key={a.id} value={a.id}>{empresas.length>1?`${empresas.find(e=>e.id===a.empresa_id)?.nombre||''} · `:''}{a.nombre}</option>)}</select></label>
 <label>Producto que pasa por esta cámara<select disabled={contando||busy||!almacenId||pendientes.length>0} value={productoId} onChange={e=>setProductoId(e.target.value)}><option value="">Selecciona el producto</option>{productos.filter(p=>p.almacen_id===almacenId).map(p=><option key={p.id} value={p.id}>{p.sku} · {p.nombre}</option>)}</select></label>
 <label>Cámara<select disabled={contando||busy||!almacenId||pendientes.length>0} value={camaraId} onChange={e=>cambiarLugar(almacenId,e.target.value)}><option value="">Cámara de este equipo</option>{camaras.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
 <div className="photo-actions"><button disabled={!almacenId||contando||fuente==='camara'} onClick={()=>void abrir()}><Video size={16}/> Abrir cámara</button><label className="photo-upload"><Film size={16}/> Probar con un video<input disabled={contando||!almacenId} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e=>{cargar(e.target.files?.[0]||null);e.target.value='';}}/></label>{fuente&&<button className="export-button" onClick={cerrar}>Cerrar</button>}</div>
 {fuente?<><div className={dibujo===null?'live-view':'live-view drawing'} onPointerDown={e=>{if(dibujo===null)return;e.currentTarget.setPointerCapture(e.pointerId);inicio.current=punto(e);}} onPointerMove={e=>{if(dibujo!==null&&inicio.current)setBorrador(rectDesde(inicio.current,punto(e)));}} onPointerUp={soltar} onPointerCancel={()=>{inicio.current=null;setBorrador(null);}}>
  <video ref={video} muted playsInline onLoadedMetadata={e=>setTam({w:e.currentTarget.videoWidth,h:e.currentTarget.videoHeight})} onError={()=>setMensaje('Este navegador no puede leer el video. Usa MP4 (H.264) o WebM.')}/>
  <svg viewBox={`0 0 ${tam.w} ${tam.h}`} aria-hidden="true">{pinta(dibujo===0&&borrador||zonas[0],'#ffc53d','A · AFUERA')}{pinta(dibujo===1&&borrador||zonas[1],'#5aa9ff','B · ALMACÉN')}
  {cajas.map(({id,caja:c})=><g key={id}><rect x={c.x1} y={c.y1} width={c.x2-c.x1} height={c.y2-c.y1} fill="none" stroke={color(id,c)} strokeWidth={tam.w/240}/><text x={c.x1} y={Math.max(tam.w/45,c.y1-tam.w/160)} fill={color(id,c)} fontSize={tam.w/48} fontWeight="700">{c.danada?'Dañada':'Caja'} {Math.round(c.confianza*100)}%</text></g>)}</svg></div>
 <div className="photo-actions"><button className="export-button" disabled={contando} onClick={()=>setDibujo(dibujo===0?null:0)}>{dibujo===0?'Arrastra sobre la imagen…':'Dibujar zona A'}</button><button className="export-button" disabled={contando} onClick={()=>setDibujo(dibujo===1?null:1)}>{dibujo===1?'Arrastra sobre la imagen…':'Dibujar zona B'}</button><button className="export-button" disabled={contando} onClick={()=>void guardarZonas([zonas[1],zonas[0]])}>Invertir A y B</button>
 {contando?<button onClick={detener}><Square size={16}/> Detener conteo</button>:<button disabled={!clase||dibujo!==null||(fuente==='camara'&&!producto)} onClick={()=>void contar()}><Play size={16}/> Iniciar conteo</button>}</div></>:
 <div className="photo-empty"><Video size={34}/><p>Elige el almacén y abre la cámara para definir las zonas.</p><small>La cámara debe estar fija y ver completas ambas zonas.</small></div>}
 <p className="csv-help">De A hacia B cuenta como entrada; de B hacia A, como salida, en cualquier dirección. No hace falta un código en la caja.</p></div>
 <div className="verification-card"><p className="vs-eyebrow">Paso 2 · Movimientos contados</p>
 <div className="live-totals" aria-live="polite"><div><strong>{entradas}</strong><span>Entradas</span></div><div><strong>{salidas}</strong><span>Salidas</span></div><div><strong>{cajas.length}</strong><span>En cuadro{contando&&ritmo?` · ${ritmo.toFixed(1)} c/s`:''}</span></div></div>
 {fuente==='video'?<div className="vision-status"><Film size={18}/><p>Video de prueba: los movimientos no se registran y el stock no cambia.</p></div>:<label className="live-check"><input type="checkbox" checked={auto} disabled={!producto} onChange={e=>setAuto(e.target.checked)}/> Registrar automáticamente cada caja que cruza</label>}
 {eventos.length>0?<><ul className="movement-list">{eventos.map(e=><li key={e.n}><img src={`data:image/jpeg;base64,${e.imagen}`} alt={`Movimiento ${e.n}`}/><div><span className={e.sentido==='entrada'?'vs-tag':'vs-tag warn'}>{e.sentido==='entrada'?'Entrada':'Salida'} · {e.hora}</span><strong>{producto?`${producto.sku} · ${producto.nombre}`:'Caja detectada'}{e.danada?' · Dañada':''}</strong><small>{e.prueba?'Prueba':e.estado==='registrado'?'Registrado':e.estado==='guardando'?'Guardando…':e.estado==='error'?'No se pudo registrar':'Pendiente de registrar'}</small></div>{(e.estado==='pendiente'||e.estado==='error')&&<button className="text-button" disabled={busy} onClick={()=>setEventos(l=>l.filter(x=>x.n!==e.n))}>Descartar</button>}</li>)}</ul>
 {pendientes.length>0&&<button disabled={busy||!producto||auto&&contando} onClick={()=>void registrarTodos()}>Registrar {pendientes.length} movimiento(s)</button>}<button className="export-button" disabled={contando||busy} onClick={()=>setEventos([])}>Limpiar lista</button></>:<p className="vs-empty">Las cajas que crucen aparecerán aquí con su foto.</p>}</div></div>}
 <p className="status" role="status">{mensaje}</p></section>;
}
