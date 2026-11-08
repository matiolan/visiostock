// HU-08: funciones sin dependencias para el análisis de manipulación.
export type TipoIncidencia='caida'|'golpe'|'apilamiento';
export type AlertaManipulacion={tipo:TipoIncidencia;segundo:number;confianza:number;detalle:string};
export const TIPOS:Record<TipoIncidencia,string>={caida:'Caída',golpe:'Golpe',apilamiento:'Apilamiento indebido'};
export const MAX_VIDEO=5242880,MAX_GRABACION=10;
export function validarVideo(file:{type:string;size:number}){
 if(!['video/mp4','video/webm','video/quicktime'].includes(file.type.split(';')[0]))return 'Usa un video MP4, MOV o WebM.';
 if(!file.size||file.size>MAX_VIDEO)return 'El video debe pesar como máximo 5 MB (unos 10 a 20 segundos).';
 return '';
}
export function momento(segundos:number){const s=Math.max(0,segundos);return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`;}
// El navegador elige el formato de grabación; se prefiere WebM y se usa MP4 en Safari.
export function formatoGrabacion(soporta:(tipo:string)=>boolean){return ['video/webm;codecs=vp9','video/webm','video/mp4'].find(soporta)||'';}
export function resumen(alertas:AlertaManipulacion[]){
 if(!alertas.length)return 'Sin caídas, golpes ni apilamiento indebido en el video.';
 const n=(t:TipoIncidencia)=>alertas.filter(a=>a.tipo===t).length;
 return (Object.keys(TIPOS) as TipoIncidencia[]).filter(n).map(t=>`${n(t)} ${TIPOS[t].toLowerCase()}`).join(' · ');
}
