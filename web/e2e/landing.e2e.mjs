// SCRUM-76 · Prueba de la página de inicio en un navegador real (Chromium + Playwright).
// Requiere el build (npm run build). Levanta `vite preview`, revisa responsive, menú,
// escenarios y movimiento reducido, y guarda capturas en e2e/capturas/ como evidencia.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PUERTO = 4319, DIRECCION = `http://127.0.0.1:${PUERTO}/`, CAPTURAS = new URL('./capturas/', import.meta.url).pathname;
const TAMANOS = [['movil', 360, 740], ['tableta', 768, 1024], ['escritorio', 1280, 800]];
let servidor, navegador;

before(async () => {
  mkdirSync(CAPTURAS, { recursive: true });
  servidor = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PUERTO), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { // espera hasta 15 s a que responda
    try { if ((await fetch(DIRECCION)).ok) break; } catch { /* aún no levanta */ }
    await new Promise(r => setTimeout(r, 250));
  }
  navegador = await chromium.launch();
});
after(async () => { await navegador?.close(); servidor?.kill(); });

async function abrir(ancho, alto, opciones = {}) {
  const pagina = await navegador.newPage({ viewport: { width: ancho, height: alto }, ...opciones });
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  await pagina.goto(DIRECCION);
  await pagina.waitForSelector('canvas.sim-lienzo');
  return { pagina, errores };
}

for (const [nombre, ancho, alto] of TAMANOS) {
  test(`${nombre} (${ancho}px): sin desplazamiento horizontal y la simulación dibuja`, async () => {
    const { pagina, errores } = await abrir(ancho, alto);
    await pagina.waitForTimeout(2500);
    const sobra = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.equal(sobra, 0, `hay ${sobra}px de desplazamiento horizontal`);
    // El canvas tiene contenido: se leen píxeles y debe haber más de un color.
    const colores = await pagina.evaluate(() => {
      const c = document.querySelector('canvas.sim-lienzo');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, vistos = new Set();
      for (let i = 0; i < d.length; i += 4 * 97) vistos.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      return vistos.size;
    });
    assert.ok(colores > 10, `el canvas parece vacío (${colores} colores)`);
    // Los botones de los escenarios caben en pantalla.
    for (const tab of await pagina.getByRole('tab').all()) {
      const caja = await tab.boundingBox();
      assert.ok(caja && caja.x >= 0 && caja.x + caja.width <= ancho + 1, 'un escenario se sale de la pantalla');
    }
    await pagina.screenshot({ path: `${CAPTURAS}${nombre}.png` });
    assert.deepEqual(errores, []);
    await pagina.close();
  });
}

test('móvil: el menú se abre, se cierra con Escape y devuelve el foco', async () => {
  const { pagina } = await abrir(360, 740);
  const boton = pagina.getByRole('button', { name: 'Abrir menú' });
  assert.ok(await boton.isVisible(), 'en celular debe verse el botón del menú');
  await boton.click();
  const panel = pagina.getByRole('dialog', { name: 'Menú' });
  assert.ok(await panel.isVisible());
  assert.equal(await boton.getAttribute('aria-expanded'), 'true');
  await pagina.screenshot({ path: `${CAPTURAS}movil-menu.png` });
  await pagina.keyboard.press('Escape');
  assert.ok(await panel.isHidden());
  assert.equal(await pagina.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Abrir menú');
  // Un enlace del panel lleva a su sección y cierra el menú.
  await boton.click();
  await panel.getByRole('link', { name: 'Seguridad' }).click();
  assert.ok(await panel.isHidden());
  await pagina.waitForFunction(() => Math.abs(document.getElementById('seguridad').getBoundingClientRect().top - 72) < 40);
  await pagina.close();
});

test('escritorio: el menú resalta la sección a la que se llega', async () => {
  const { pagina } = await abrir(1280, 800);
  assert.ok(await pagina.getByRole('button', { name: 'Abrir menú' }).isHidden(), 'en escritorio el menú va en la barra');
  const barra = pagina.getByRole('navigation', { name: 'Secciones', exact: true });
  await barra.getByRole('link', { name: 'Preguntas' }).click();
  await pagina.waitForFunction(() => document.querySelector('.menu a[href="#preguntas"]')?.getAttribute('aria-current') === 'true');
  await barra.getByRole('link', { name: 'Cómo funciona' }).click();
  await pagina.waitForFunction(() => document.querySelector('.menu a[href="#funciona"]')?.getAttribute('aria-current') === 'true');
  await pagina.close();
});

test('escenarios: "Fuera de horario" genera alertas y "Pausar" detiene la simulación', async () => {
  const { pagina } = await abrir(1280, 800);
  const tab = pagina.getByRole('tab', { name: 'Fuera de horario' });
  await tab.click();
  assert.equal(await tab.getAttribute('aria-selected'), 'true');
  await pagina.waitForFunction(() => Number(document.querySelector('.con-alerta dd')?.textContent) > 0, null, { timeout: 15000 });
  await pagina.locator('#simulacion').screenshot({ path: `${CAPTURAS}escenario-fuera-de-horario.png` });
  await pagina.getByRole('button', { name: 'Pausar' }).click();
  const antes = await pagina.locator('.cifras').innerText();
  await pagina.waitForTimeout(2500);
  assert.equal(await pagina.locator('.cifras').innerText(), antes, 'en pausa los contadores no deben cambiar');
  await pagina.close();
});

test('movimiento reducido: la simulación empieza en pausa', async () => {
  const { pagina } = await abrir(1280, 800, { reducedMotion: 'reduce' });
  assert.ok(await pagina.getByRole('button', { name: 'Reproducir' }).isVisible());
  await pagina.close();
});
