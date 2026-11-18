// SCRUM-76: el menú resalta la sección visible y solo navega a anclas internas.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seccionActiva, anclaValida} from '../src/lib/navegacion.ts';

const secciones = [{id: 'funciona', top: 900}, {id: 'escenarios', top: 1800}, {id: 'seguridad', top: 2600}, {id: 'preguntas', top: 3400}];

test('antes de la primera sección no hay ninguna activa', () => {
 assert.equal(seccionActiva(secciones, 0), null);
 assert.equal(seccionActiva(secciones, 818), null);
});

test('la sección activa es la última que pasó la barra fija', () => {
 assert.equal(seccionActiva(secciones, 820), 'funciona');
 assert.equal(seccionActiva(secciones, 1719), 'escenarios');
 assert.equal(seccionActiva(secciones, 5000), 'preguntas');
 assert.equal(seccionActiva([...secciones].reverse(), 2600), 'seguridad'); // orden no importa
});

test('solo anclas internas simples', () => {
 assert.equal(anclaValida('#seguridad'), 'seguridad');
 for (const malo of ['javascript:alert(1)', 'https://otro.sitio/#x', '#', '#Seguridad', '#a b', '#' + 'x'.repeat(60)]) {
  assert.equal(anclaValida(malo), null, malo);
 }
});
