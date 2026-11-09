// HU-17: funciones sin dependencias para relacionar cámaras registradas con las del equipo.
export type Zona={id:string;empresa_id:string;almacen_id:string;nombre:string};
export type Camara={id:string;empresa_id:string;zona_id:string;nombre:string;dispositivo:string;activa:boolean;tipo?:'navegador'|'rtsp';url?:string;linea?:number;ultima_senal?:string|null;fps?:number|null};
type Dispositivo={deviceId:string;label:string;kind:string};
export const SIN_SENAL_MS=60000;
// El deviceId cambia entre sitios y al borrar permisos; el nombre (label) del navegador es estable.
export function buscarDispositivo<T extends Dispositivo>(dispositivos:T[],guardado:string):T|null{
 const nombre=guardado.trim().toLowerCase();if(!nombre)return null;
 return dispositivos.find(d=>d.kind==='videoinput'&&d.label.trim().toLowerCase()===nombre)||null;
}
export const esIP=(c:Camara)=>c.tipo==='rtsp';
// Solo las cámaras del navegador se pueden abrir en la página; las IP las lee el servicio de visión.
export function camarasDelAlmacen(camaras:Camara[],zonas:Zona[],almacen:string){
 const ids=new Set(zonas.filter(z=>z.almacen_id===almacen).map(z=>z.id));
 return camaras.filter(c=>c.activa&&!esIP(c)&&ids.has(c.zona_id));
}
export function ubicacion(camara:Camara|undefined,zonas:Zona[],almacenes:{id:string;nombre:string}[]){
 if(!camara)return '';const zona=zonas.find(z=>z.id===camara.zona_id);
 return [almacenes.find(a=>a.id===zona?.almacen_id)?.nombre,zona?.nombre,camara.nombre].filter(Boolean).join(' · ');
}
export type Estado='en línea'|'desconectada'|'inactiva'|'en el equipo';
export function estadoCamara(c:Camara,ahora:number):Estado{
 if(!c.activa)return 'inactiva';if(!esIP(c))return 'en el equipo';
 return c.ultima_senal&&ahora-Date.parse(c.ultima_senal)<=SIN_SENAL_MS?'en línea':'desconectada';
}
// Una zona queda sin monitoreo cuando todas sus cámaras IP activas llevan más de 60 s sin señal.
export function zonasSinMonitoreo(zonas:Zona[],camaras:Camara[],ahora:number){
 return zonas.filter(z=>{const ip=camaras.filter(c=>c.zona_id===z.id&&c.activa&&esIP(c));return ip.length>0&&ip.every(c=>estadoCamara(c,ahora)==='desconectada');});
}
// Para mostrar la URL sin usuario ni clave.
export function urlSinClave(url:string){try{const u=new URL(url);u.username='';u.password='';return u.toString();}catch{return '';}}
export const urlRtspValida=(url:string)=>/^rtsps?:\/\/[^\s/]+\S*$/.test(url.trim())&&url.trim().length<=500;
