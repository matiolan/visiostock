// Conteo en vivo: sigue las cajas entre dos zonas. A (afuera) → B (almacén) = entrada; B → A = salida.
// Funciona en cualquier dirección y no cuenta una caja que vuelve por la misma zona.
export type Rect=[number,number,number,number]; // x1,y1,x2,y2 en fracciones del cuadro
export type Zonas=[Rect,Rect];
export type Caja={x1:number;y1:number;x2:number;y2:number;confianza:number;danada?:boolean}; // en píxeles
export type Cruce={sentido:'entrada'|'salida';caja:Caja;id:number};
type Pista={id:number;caja:Caja;x:number;y:number;vx:number;vy:number;tam:number;t:number;zona:'A'|'B'|null};
const CONF_NUEVA=.45; // con menos confianza, una detección solo continúa una caja que ya se seguía
const MEMORIA=2; // segundos en que una caja perdida (tapada, borrosa) conserva su historia
export function zonasValidas(z:unknown):z is Zonas{
 return Array.isArray(z)&&z.length===2&&z.every(r=>Array.isArray(r)&&r.length===4&&r.every(v=>typeof v==='number'&&v>=0&&v<=1)&&r[2]-r[0]>=.03&&r[3]-r[1]>=.03);
}
export function rectDesde(a:{x:number;y:number},b:{x:number;y:number}):Rect{
 const f=(v:number)=>Math.min(1,Math.max(0,v));
 return [f(Math.min(a.x,b.x)),f(Math.min(a.y,b.y)),f(Math.max(a.x,b.x)),f(Math.max(a.y,b.y))];
}
const dentro=(x:number,y:number,r:Rect)=>x>=r[0]&&x<=r[2]&&y>=r[1]&&y<=r[3];
// Área que cubre ambas zonas con un margen: analizar solo eso agranda las cajas lejanas y las detecta mejor.
export function recorte([a,b]:Zonas,ancho:number,alto:number,margen=.12){
 const x1=Math.min(a[0],b[0]),y1=Math.min(a[1],b[1]),x2=Math.max(a[2],b[2]),y2=Math.max(a[3],b[3]),mx=(x2-x1)*margen,my=(y2-y1)*margen;
 const x=Math.floor(Math.max(0,x1-mx)*ancho),y=Math.floor(Math.max(0,y1-my)*alto);
 return {x,y,ancho:Math.max(1,Math.ceil(Math.min(1,x2+mx)*ancho)-x),alto:Math.max(1,Math.ceil(Math.min(1,y2+my)*alto)-y)};
}
export class ContadorZonas{
 private pistas:Pista[]=[];private siguiente=1;
 visibles:{id:number;caja:Caja}[]=[];
 reiniciar(){this.pistas=[];this.visibles=[];}
 actualizar(cajas:Caja[],t:number,[a,b]:Zonas,ancho:number,alto:number):Cruce[]{
  this.pistas=this.pistas.filter(p=>t-p.t<=MEMORIA);
  // Cada caja se une a la pista más cercana a su posición esperada (por velocidad).
  const pares:{d:number;i:number;p:Pista}[]=[];
  cajas.forEach((c,i)=>{const x=(c.x1+c.x2)/2,y=(c.y1+c.y2)/2,tam=Math.max(c.x2-c.x1,c.y2-c.y1);
   for(const p of this.pistas){const dt=Math.min(t-p.t,.8),razon=tam/Math.max(p.tam,1);if(razon<.5||razon>2)continue;
    const d=Math.hypot(x-p.x-p.vx*dt,y-p.y-p.vy*dt)/Math.max(tam,p.tam);if(d<1.1)pares.push({d,i,p});}});
  pares.sort((m,n)=>m.d-n.d);
  const deCaja=new Map<number,Pista>(),usadas=new Set<Pista>();
  for(const {i,p} of pares)if(!deCaja.has(i)&&!usadas.has(p)){deCaja.set(i,p);usadas.add(p);}
  const cruces:Cruce[]=[];this.visibles=[];
  cajas.forEach((c,i)=>{const x=(c.x1+c.x2)/2,y=(c.y1+c.y2)/2,tam=Math.max(c.x2-c.x1,c.y2-c.y1);let p=deCaja.get(i);
   if(p){const dt=t-p.t;if(dt>0){p.vx=(x-p.x)/dt;p.vy=(y-p.y)/dt;}}
   else{if(c.confianza<CONF_NUEVA)return;p={id:this.siguiente++,caja:c,x,y,vx:0,vy:0,tam,t,zona:null};this.pistas.push(p);}
   p.caja=c;p.x=x;p.y=y;p.tam=tam;p.t=t;
   const zona=dentro(x/ancho,y/alto,a)?'A':dentro(x/ancho,y/alto,b)?'B':null;
   if(zona){if(p.zona&&p.zona!==zona)cruces.push({sentido:zona==='B'?'entrada':'salida',caja:c,id:p.id});p.zona=zona;}
   this.visibles.push({id:p.id,caja:c});});
  return cruces;
 }
}
