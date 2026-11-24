// SCRUM-76: la simulación de la portada cuenta bien, avisa fuera de horario y detecta caídas.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crearSimulacion, avanzar, enHorario, formatoReloj, LINEA} from '../src/lib/simulacion.ts';

test('formato de reloj y horario laboral de 07:00 a 19:00', () => {
 assert.equal(formatoReloj(10 * 60 + 5), '10:05');
 assert.equal(formatoReloj(24 * 60 + 30), '00:30');
 assert.equal(enHorario(7 * 60), true);
 assert.equal(enHorario(18 * 60 + 59.9), true);
 assert.equal(enHorario(19 * 60), false);
 assert.equal(enHorario(6 * 60 + 59), false);
});

test('misma semilla, misma simulación (determinista)', () => {
 const a = avanzar(crearSimulacion('conteo', 3), 20), b = avanzar(crearSimulacion('conteo', 3), 20);
 assert.deepEqual([a.entradas, a.salidas, a.stock], [b.entradas, b.salidas, b.stock]);
 assert.ok(a.entradas + a.salidas > 0, 'en 20 s deben cruzar cajas');
});

test('cada caja se cuenta una sola vez y el stock cuadra', () => {
 const e = crearSimulacion('conteo', 11);
 for (let i = 0; i < 600; i++) avanzar(e, 1 / 15); // 40 s en pasos de fotograma
 assert.equal(e.stock, 120 + e.entradas - e.salidas);
 // Ninguna caja contada está todavía del lado desde donde vino.
 for (const c of e.cajas.filter(c => c.contada)) {
  const centro = c.x + c.w / 2;
  assert.ok(c.v > 0 ? centro >= LINEA : centro <= LINEA);
 }
 // Las que no se contaron no cruzaron la línea.
 for (const c of e.cajas.filter(c => !c.contada && c.caida === null)) {
  const centro = c.x + c.w / 2;
  assert.ok(c.v > 0 ? centro < LINEA : centro > LINEA);
 }
});

test('un paso grande no hace que una caja salte la línea sin contarse', () => {
 const e = crearSimulacion('conteo', 5);
 avanzar(e, 30); // un solo llamado de 30 s se divide internamente en pasos de 0,1 s
 assert.equal(e.stock, 120 + e.entradas - e.salidas);
 assert.ok(e.entradas + e.salidas >= 5);
});

test('en horario no hay alertas; pasadas las 19:00 cada cruce es alerta', () => {
 const conteo = avanzar(crearSimulacion('conteo', 2), 30);
 assert.equal(conteo.alertas, 0);
 assert.ok(conteo.eventos.every(ev => ev.tipo !== 'alerta'));

 const fuera = avanzar(crearSimulacion('fuera', 2), 40); // empieza 18:57 y avanza 1 min/s
 assert.ok(fuera.reloj >= 19 * 60);
 assert.ok(fuera.alertas > 0, 'debe haber cruces después de las 19:00');
 const alertas = fuera.eventos.filter(ev => ev.tipo === 'alerta');
 assert.ok(alertas.every(ev => ev.texto.startsWith('Fuera de horario') && ev.reloj >= '19:00'));
});

test('manipulación: las cajas que se caen generan alerta y no se cuentan', () => {
 const e = avanzar(crearSimulacion('manipulacion', 4), 40);
 const caidas = e.eventos.filter(ev => ev.texto.startsWith('Caída detectada'));
 assert.ok(caidas.length > 0);
 assert.ok(e.cajas.filter(c => c.caida !== null).every(c => !c.contada));
});

test('el registro de eventos guarda como máximo 6', () => {
 const e = avanzar(crearSimulacion('conteo', 9), 60);
 assert.ok(e.eventos.length <= 6);
});
