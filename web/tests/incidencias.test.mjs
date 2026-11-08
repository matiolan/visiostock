import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validarVideo as validar,momento,formatoGrabacion as formato,resumen} from '../src/lib/incidencias.ts';
test('acepta MP4, MOV y WebM de hasta 5 MB',()=>{for(const type of ['video/mp4','video/quicktime','video/webm;codecs=vp9'])assert.equal(validar({type,size:1000}),'');});
test('rechaza otros formatos, vacíos y pesados',()=>{assert.ok(validar({type:'image/jpeg',size:10}));assert.ok(validar({type:'video/mp4',size:0}));assert.ok(validar({type:'video/mp4',size:5242881}));});
test('muestra el momento del video',()=>{assert.equal(momento(1.25),'0:01.3');assert.equal(momento(75),'1:15.0');assert.equal(momento(-2),'0:00.0');});
test('elige el formato de grabación disponible',()=>{assert.equal(formato(t=>t==='video/webm'),'video/webm');assert.equal(formato(t=>t==='video/mp4'),'video/mp4');assert.equal(formato(()=>false),'');});
test('resume las alertas por tipo',()=>{assert.equal(resumen([]),'Sin caídas, golpes ni apilamiento indebido en el video.');assert.equal(resumen([{tipo:'caida',segundo:1,confianza:.8,detalle:''},{tipo:'caida',segundo:2,confianza:.8,detalle:''},{tipo:'apilamiento',segundo:3,confianza:1,detalle:''}]),'2 caída · 1 apilamiento indebido');});
