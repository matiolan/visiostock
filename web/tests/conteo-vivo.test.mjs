import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ContadorZonas,recorte,rectDesde,zonasValidas} from '../src/lib/conteo-vivo.ts';
const W=1000,H=600,horizontal=[[0,0,.3,1],[.7,0,1,1]],vertical=[[0,0,1,.3],[0,.7,1,1]];
const caja=(x,y,l=100)=>({x1:x-l/2,y1:y-l/2,x2:x+l/2,y2:y+l/2,confianza:.9});
// Recorre los puntos a 3 cuadros por segundo; null = la caja no se detectó en ese cuadro.
function pasar(cuadros,zonas=horizontal,c=new ContadorZonas()){return cuadros.flatMap((pts,i)=>c.actualizar(pts.filter(Boolean).map(([x,y])=>caja(x,y)),i/3,zonas,W,H).map(k=>k.sentido));}
const ir=(a,b,paso)=>{const r=[];for(let v=a;a<b?v<=b:v>=b;v+=paso)r.push(v);return r;};
test('A → B es entrada y B → A es salida',()=>{
 assert.deepEqual(pasar(ir(100,900,80).map(x=>[[x,300]])),['entrada']);
 assert.deepEqual(pasar(ir(900,100,-80).map(x=>[[x,300]])),['salida']);});
test('cuenta en vertical y en diagonal',()=>{
 assert.deepEqual(pasar(ir(50,550,60).map(y=>[[500,y]]),vertical),['entrada']);
 assert.deepEqual(pasar(ir(100,900,80).map(x=>[[x,x*.5]])),['entrada']);});
test('asomarse y volver por la misma zona no cuenta',()=>assert.deepEqual(pasar([...ir(100,600,80),...ir(600,100,-80)].map(x=>[[x,300]])),[]));
test('quedarse quieta o temblar en el borde no cuenta',()=>assert.deepEqual(pasar([298,302,297,303,299,301].map(x=>[[x,300]])),[]));
test('ida y vuelta completa son dos movimientos',()=>assert.deepEqual(pasar([...ir(100,900,80),...ir(900,100,-80)].map(x=>[[x,300]])),['entrada','salida']));
test('no pierde una caja que deja de verse unos cuadros',()=>assert.deepEqual(pasar(ir(100,900,80).map((x,i)=>[i===4||i===5?null:[x,300]])),['entrada']));
test('dos cajas a la vez, una entra y otra sale',()=>assert.deepEqual(pasar(ir(100,900,80).map(x=>[[x,150],[1000-x,450]])).sort(),['entrada','salida']));
test('cajas en fila no se confunden',()=>assert.deepEqual(pasar(ir(100,1200,60).map(x=>[[x,300],[x-160,300],[x-320,300]].filter(p=>p[0]>0&&p[0]<1000))).length,3));
test('una caja que aparece sin pasar por A no cuenta',()=>assert.deepEqual(pasar(ir(500,900,80).map(x=>[[x,300]])),[]));
test('una detección débil continúa una caja seguida, pero no crea una nueva',()=>{
 const c=new ContadorZonas(),r=[];ir(100,900,80).forEach((x,i)=>r.push(...c.actualizar([{...caja(x,300),confianza:i?.32:.9}],i/3,horizontal,W,H)));assert.equal(r.length,1);
 const d=new ContadorZonas();ir(100,900,80).forEach((x,i)=>r.push(...d.actualizar([{...caja(x,300),confianza:.32}],i/3,horizontal,W,H)));assert.equal(r.length,1);});
test('valida y ordena las zonas',()=>{
 assert.deepEqual(rectDesde({x:.8,y:1.2},{x:.2,y:.1}),[.2,.1,.8,1]);
 assert.equal(zonasValidas(horizontal),true);assert.equal(zonasValidas([[0,0,.01,1],[.7,0,1,1]]),false);assert.equal(zonasValidas(null),false);assert.equal(zonasValidas([[0,0,.3,2],[.7,0,1,1]]),false);});
test('el recorte cubre las dos zonas y no sale del cuadro',()=>{
 assert.deepEqual(recorte(horizontal,W,H),{x:0,y:0,ancho:W,alto:H});
 const r=recorte([[.4,.4,.5,.6],[.6,.4,.7,.6]],W,H);assert(r.x<400&&r.x+r.ancho>700&&r.y<240&&r.alto<H);});
