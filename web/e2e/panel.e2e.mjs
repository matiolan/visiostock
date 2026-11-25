// SCRUM-79 · Panel de trabajo en un navegador real con una sesión y datos simulados.
// Supabase se reemplaza interceptando las llamadas a https://ejemplo.supabase.co (la URL de prueba del
// build del pipeline): no se toca ninguna base real. Revisa navegación, menú en celular, que ninguna
// vista se desborde y la pantalla del doble factor. Guarda capturas en e2e/capturas/panel-*.png.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { abrirPanel as abrirPanelSimulado } from './supabase-simulado.mjs';

const PUERTO = 4320, DIRECCION = `http://127.0.0.1:${PUERTO}`, CAPTURAS = new URL('./capturas/', import.meta.url).pathname;
const TAMANOS = [['movil', 360, 740], ['tableta', 768, 1024], ['escritorio', 1366, 860]];
let servidor, navegador;

const abrirPanel = (ancho, alto, opciones) => abrirPanelSimulado(navegador, DIRECCION, ancho, alto, opciones);
const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString();

before(async () => {
  mkdirSync(CAPTURAS, { recursive: true });
  servidor = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PUERTO), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(DIRECCION)).ok) break; } catch { /* aún no levanta */ } await new Promise(r => setTimeout(r, 250)); }
  navegador = await chromium.launch();
});
after(async () => { await navegador?.close(); servidor?.kill(); });

const VISTAS = ['Resumen', 'Inventario', 'Movimientos', 'Verificación visual', 'Alertas', 'Manipulación', 'Cámaras y zonas', 'Reportes', 'Seguridad'];

test('escritorio: el resumen muestra indicadores, productos por reponer y movimientos', async () => {
  const { pagina, errores, contexto } = await abrirPanel(1366, 860);
  await pagina.getByRole('heading', { level: 1, name: 'Resumen' }).waitFor();
  await pagina.locator('.indicador strong').first().waitFor();
  assert.equal(await pagina.locator('.indicador').count(), 4);
  assert.equal(await pagina.locator('.indicador').nth(2).locator('strong').innerText(), '3'); // 3 productos en su mínimo
  assert.equal(await pagina.locator('.umbral-lista li').count(), 3);
  await pagina.locator('.indicador').nth(3).locator('strong', { hasText: '2' }).waitFor(); // 1 diferencia + 1 incidencia
  assert.equal(await pagina.locator('.app-nav [aria-current=page]').innerText(), 'Resumen');
  await pagina.screenshot({ path: `${CAPTURAS}panel-resumen.png` });
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('escritorio: cada sección abre con su título, su ancla y sin desbordarse', async () => {
  const { pagina, errores, contexto } = await abrirPanel(1366, 860);
  await pagina.locator('.indicador').first().waitFor();
  for (const v of VISTAS) {
    await pagina.locator('.app-nav').getByRole('button', { name: new RegExp(`^${v}`) }).click();
    await pagina.getByRole('heading', { level: 1, name: v }).waitFor();
    await pagina.waitForTimeout(400);
    assert.match(await pagina.locator('.app-nav [aria-current=page]').innerText(), new RegExp(`^${v}`));
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0, `${v} se desborda`);
    const nombre = v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await pagina.screenshot({ path: `${CAPTURAS}panel-${nombre}.png`, fullPage: true });
  }
  assert.equal(new URL(pagina.url()).hash, '#seguridad');
  await pagina.reload();
  await pagina.getByRole('heading', { level: 1, name: 'Seguridad' }).waitFor(); // al recargar vuelve a la misma vista
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('inventario: el buscador filtra y la tabla marca lo que hay que reponer', async () => {
  const { pagina, contexto } = await abrirPanel(1366, 860, { ruta: '/portal#inventario' });
  await pagina.locator('tbody tr').first().waitFor();
  assert.equal(await pagina.locator('tbody tr').count(), 9);
  await pagina.getByRole('textbox', { name: 'Buscar productos' }).fill('termo');
  assert.equal(await pagina.locator('tbody tr').count(), 1);
  assert.equal(await pagina.locator('tbody tr .vs-tag').innerText(), 'Reponer');
  await contexto.close();
});

test('movimientos: el conteo en vivo (SCRUM-80) va primero, antes del registro manual', async () => {
  const { pagina, errores, contexto } = await abrirPanel(1366, 860, { ruta: '/portal#movimientos' });
  await pagina.getByRole('heading', { level: 2, name: 'Conteo en vivo' }).waitFor();
  const orden = await pagina.locator('main h2').allInnerTexts();
  assert.ok(orden.indexOf('Conteo en vivo') < orden.indexOf('Registrar entrada o salida'), orden.join(' | '));
  assert.deepEqual(errores, []);
  await contexto.close();
});

for (const [nombre, ancho, alto] of TAMANOS) {
  test(`${nombre} (${ancho}px): resumen e inventario sin desplazamiento horizontal`, async () => {
    const { pagina, errores, contexto } = await abrirPanel(ancho, alto);
    await pagina.locator('.indicador').first().waitFor();
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0);
    await pagina.screenshot({ path: `${CAPTURAS}panel-${nombre}.png`, fullPage: true });
    await pagina.goto(`${DIRECCION}/portal#inventario`); await pagina.locator('tbody tr').first().waitFor();
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0);
    assert.deepEqual(errores, []);
    await contexto.close();
  });
}

test('celular: el menú se abre, navega, se cierra con Escape y devuelve el foco', async () => {
  const { pagina, contexto } = await abrirPanel(360, 740);
  await pagina.locator('.indicador').first().waitFor();
  const boton = pagina.getByRole('button', { name: 'Abrir menú' });
  assert.ok(await pagina.locator('.app-lateral').isHidden(), 'en celular el menú empieza cerrado');
  await boton.click();
  assert.ok(await pagina.locator('.app-lateral').isVisible());
  await pagina.waitForTimeout(300);
  await pagina.screenshot({ path: `${CAPTURAS}panel-movil-menu.png` });
  await pagina.keyboard.press('Escape');
  await pagina.locator('.app-lateral').waitFor({ state: 'hidden' });
  assert.equal(await pagina.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Abrir menú');
  await boton.click();
  await pagina.locator('.app-nav').getByRole('button', { name: /^Alertas/ }).click();
  await pagina.getByRole('heading', { level: 1, name: 'Alertas' }).waitFor();
  await pagina.locator('.app-lateral').waitFor({ state: 'hidden' });
  await contexto.close();
});

test('doble factor: con un factor verificado pide el código con el marco de acceso', async () => {
  const factor = { id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Celular', created_at: hace(100), updated_at: hace(100) };
  const { pagina, errores, contexto } = await abrirPanel(1366, 860, { factores: [factor] });
  await pagina.getByRole('heading', { name: 'Ingresa tu código' }).waitFor();
  assert.ok(await pagina.getByRole('button', { name: 'Verificar y entrar' }).isVisible());
  assert.equal(await pagina.locator('.vs-app').count(), 0, 'el panel no se muestra antes del código');
  await pagina.screenshot({ path: `${CAPTURAS}panel-doble-factor.png` });
  assert.deepEqual(errores, []);
  await contexto.close();
});
