// SCRUM-79: secciones del panel, su ancla en la URL y la barra de stock.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VISTAS, hashDeVista, vistaDesdeHash, enUmbral, porcentajeStock} from '../src/lib/panel.ts';

test('cada vista va y vuelve por su ancla, sin tildes ni espacios', () => {
 assert.equal(hashDeVista('Verificación visual'), '#verificacion-visual');
 assert.equal(hashDeVista('Cámaras y zonas'), '#camaras-y-zonas');
 assert.equal(hashDeVista('Resumen'), '');
 for (const v of VISTAS) assert.equal(vistaDesdeHash(hashDeVista(v.id)), v.id, v.id);
});

test('un ancla desconocida o maliciosa abre el Resumen', () => {
 for (const malo of ['', '#', '#nada', '#<script>', '#javascript:alert(1)', '#%E0%A4%A']) {
  assert.equal(vistaDesdeHash(malo), 'Resumen', malo);
 }
});

test('las secciones están agrupadas y solo Administración es exclusiva del administrador', () => {
 assert.deepEqual([...new Set(VISTAS.map(v => v.grupo))], ['Operación', 'Vigilancia', 'Gestión']);
 assert.deepEqual(VISTAS.filter(v => v.soloAdmin).map(v => v.id), ['Administración']);
 for (const v of VISTAS) assert.ok(v.descripcion.length > 20, v.id);
});

test('umbral y barra de stock', () => {
 assert.equal(enUmbral({stock: 5, umbral: 5}), true);
 assert.equal(enUmbral({stock: 6, umbral: 5}), false);
 assert.equal(porcentajeStock({stock: 5, umbral: 5}), 50);
 assert.equal(porcentajeStock({stock: 50, umbral: 5}), 100);
 assert.equal(porcentajeStock({stock: 0, umbral: 0}), 0);
 assert.equal(porcentajeStock({stock: 3, umbral: 0}), 100);
 assert.equal(porcentajeStock({stock: -2, umbral: 4}), 0);
});
