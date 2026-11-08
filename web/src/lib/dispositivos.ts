// HU-17: funciones sin dependencias para relacionar cámaras registradas con las del equipo.
export type Zona={id:string;empresa_id:string;almacen_id:string;nombre:string};
export type Camara={id:string;empresa_id:string;zona_id:string;nombre:string;dispositivo:string;activa:boolean};
type Dispositivo={deviceId:string;label:string;kind:string};
// El deviceId cambia entre sitios y al borrar permisos; el nombre (label) del navegador es estable.
export function buscarDispositivo<T extends Dispositivo>(dispositivos:T[],guardado:string):T|null{
 const nombre=guardado.trim().toLowerCase();if(!nombre)return null;
 return dispositivos.find(d=>d.kind==='videoinput'&&d.label.trim().toLowerCase()===nombre)||null;
}
export function camarasDelAlmacen(camaras:Camara[],zonas:Zona[],almacen:string){
 const ids=new Set(zonas.filter(z=>z.almacen_id===almacen).map(z=>z.id));
 return camaras.filter(c=>c.activa&&ids.has(c.zona_id));
}
export function ubicacion(camara:Camara|undefined,zonas:Zona[],almacenes:{id:string;nombre:string}[]){
 if(!camara)return '';const zona=zonas.find(z=>z.id===camara.zona_id);
 return [almacenes.find(a=>a.id===zona?.almacen_id)?.nombre,zona?.nombre,camara.nombre].filter(Boolean).join(' · ');
}
