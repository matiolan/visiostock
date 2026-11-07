// SCRUM-24 · Escenario 3 (exactitud): totales conocidos deben coincidir al 100 %.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generarReporte, inicioSemana, ultimaSemanaCompleta, reporteACSV} from '../src/lib/reporte-semanal.ts';

const productos=[{id:'p1',sku:'A-1',nombre:'Caja A'},{id:'p2',sku:'B-2',nombre:'Caja B'},{id:'p3',sku:'C-3',nombre:'Caja C'},{id:'p4',sku:'D-4',nombre:'Caja D'},{id:'p5',sku:'E-5',nombre:'Caja E'},{id:'p6',sku:'F-6',nombre:'Caja F'}];
// Semana evaluada: lunes 02/11/2026 00:00 Lima (= 05:00 UTC) a lunes 09/11/2026 00:00 Lima.
const semana=new Date('2026-11-04T15:00:00Z');
const movimientos=[
 {producto_id:'p1',sentido:'entrada',cantidad:10,creado_en:'2026-11-02T05:00:00Z'}, // justo al inicio: cuenta
 {producto_id:'p1',sentido:'salida',cantidad:4,creado_en:'2026-11-03T14:00:00Z'},
 {producto_id:'p2',sentido:'entrada',cantidad:6,creado_en:'2026-11-08T23:00:00Z'}, // domingo 18:00 Lima: cuenta
 {producto_id:'p2',sentido:'salida',cantidad:5,creado_en:'2026-11-09T04:59:59Z'}, // domingo 23:59:59 Lima: cuenta
 {producto_id:'p2',sentido:'salida',cantidad:99,creado_en:'2026-11-09T05:00:00Z'}, // lunes siguiente: NO cuenta
 {producto_id:'p1',sentido:'entrada',cantidad:3,creado_en:'2026-11-02T04:59:59Z'}, // domingo previo 23:59:59: semana anterior
 {producto_id:'p1',sentido:'salida',cantidad:2,creado_en:'2026-10-28T15:00:00Z'}, // semana anterior
];
const verificaciones=[
 {producto_id:'p1',diferencia:-3,creado_en:'2026-11-03T15:00:00Z'},
 {producto_id:'p1',diferencia:-1,creado_en:'2026-11-05T15:00:00Z'},
 {producto_id:'p2',diferencia:-7,creado_en:'2026-11-04T15:00:00Z'},
 {producto_id:'p3',diferencia:2,creado_en:'2026-11-04T16:00:00Z'},
 {producto_id:'p4',diferencia:0,creado_en:'2026-11-04T17:00:00Z'},
 {producto_id:'p5',diferencia:-2,creado_en:'2026-11-06T15:00:00Z'},
 {producto_id:'p6',diferencia:-1,creado_en:'2026-11-06T16:00:00Z'},
 {producto_id:'p3',diferencia:-5,creado_en:'2026-11-07T15:00:00Z'},
 {producto_id:'p4',diferencia:-1,creado_en:'2026-11-07T16:00:00Z'},
 {producto_id:'p1',diferencia:-2,creado_en:'2026-10-29T15:00:00Z'}, // semana anterior
];

test('la semana empieza el lunes 00:00 de Lima',()=>{
 assert.equal(inicioSemana(semana).toISOString(),'2026-11-02T05:00:00.000Z');
 assert.equal(inicioSemana(new Date('2026-11-09T04:59:59Z')).toISOString(),'2026-11-02T05:00:00.000Z'); // domingo 23:59:59 Lima
 assert.equal(inicioSemana(new Date('2026-11-09T05:00:00Z')).toISOString(),'2026-11-09T05:00:00.000Z');
 assert.equal(ultimaSemanaCompleta(new Date('2026-11-09T13:00:00Z')).toISOString(),'2026-11-02T05:00:00.000Z'); // lunes 08:00 Lima
});

test('totales de entradas y salidas coinciden con el origen',()=>{
 const r=generarReporte(semana,movimientos,verificaciones,productos);
 assert.equal(r.actual.entradas,16);assert.equal(r.actual.salidas,9);assert.equal(r.actual.movimientos,4);
 assert.equal(r.anterior.entradas,3);assert.equal(r.anterior.salidas,2);
});

test('discrepancias por SKU y unidades faltantes',()=>{
 const r=generarReporte(semana,movimientos,verificaciones,productos);
 assert.equal(r.actual.verificaciones,9);assert.equal(r.actual.conDiferencia,8);
 assert.equal(r.actual.unidadesFaltantes,20);assert.equal(r.actual.unidadesSobrantes,2);
 const c=r.porSku.find(f=>f.sku==='C-3');assert.deepEqual([c.faltante,c.sobrante,c.neto,c.conDiferencia],[5,2,-3,2]);
 const d=r.porSku.find(f=>f.sku==='D-4');assert.deepEqual([d.verificaciones,d.conDiferencia,d.faltante],[2,1,1]);
 assert.equal(r.porSku.reduce((n,f)=>n+f.faltante,0),r.actual.unidadesFaltantes);
});

test('top 5 de mermas ordenado y limitado a 5',()=>{
 const r=generarReporte(semana,movimientos,verificaciones,productos);
 assert.deepEqual(r.topMermas.map(f=>[f.sku,f.faltante]),[['B-2',7],['C-3',5],['A-1',4],['E-5',2],['D-4',1]]);
});

test('comparación con la semana anterior',()=>{
 const r=generarReporte(semana,movimientos,verificaciones,productos);
 assert.deepEqual(r.comparacion.unidadesFaltantes,{actual:20,anterior:2,cambio:18,porcentaje:900});
 assert.deepEqual(r.comparacion.entradas,{actual:16,anterior:3,cambio:13,porcentaje:433.3});
 assert.equal(generarReporte(semana,[],[],productos).comparacion.salidas.porcentaje,null);
});

test('el CSV para Excel lleva los mismos totales y evita fórmulas',()=>{
 const r=generarReporte(semana,movimientos,verificaciones,[...productos,{id:'x',sku:'=HACK()',nombre:'+cmd'}]);
 const csv=reporteACSV(r);
 assert.ok(csv.startsWith('﻿'));
 assert.match(csv,/"Unidades faltantes \(merma\)","20","2","18"/);
 assert.match(csv,/"Unidades de entrada","16","3","13"/);
 assert.match(csv,/"B-2","Caja B","7"/);
 const r2=generarReporte(semana,[],[{producto_id:'x',diferencia:-1,creado_en:'2026-11-04T15:00:00Z'}],[{id:'x',sku:'=HACK()',nombre:'+cmd'}]);
 assert.match(reporteACSV(r2),/"'=HACK\(\)","'\+cmd"/);
});
