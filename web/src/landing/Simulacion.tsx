// SCRUM-76 · Dibuja en canvas la simulación de web/src/lib/simulacion.ts.
// Sin video ni librerías externas: se dibuja en cada fotograma y se detiene cuando no está a la
// vista, cuando la pestaña está oculta o cuando el visitante la pausa.
import { useEffect, useRef } from 'react';
import { avanzar, crearSimulacion, enHorario, formatoReloj, CARRILES, LINEA, type Caja, type Escenario, type Estado } from '../lib/simulacion';

export type Resumen = Pick<Estado, 'entradas' | 'salidas' | 'stock' | 'alertas' | 'eventos'> & { reloj: string; enHorario: boolean };

const C = {
  pared: '#2a3b52', paredNoche: '#121c2b', rack: '#3a4d66', rackNoche: '#1d2a3c',
  piso: '#5d6670', faja: '#1b2533', rodillo: '#4a5a6e',
  carton: '#c08f5b', cartonOscuro: '#9c6f43', cinta: '#e2c79f', etiqueta: '#f6f6f3',
  senal: '#f5c518', alerta: '#ff5a3c', texto: '#f6f6f3',
};
const FUENTE = '"Archivo Variable", "Archivo", system-ui, sans-serif';

function resumen(e: Estado): Resumen {
  return { entradas: e.entradas, salidas: e.salidas, stock: e.stock, alertas: e.alertas, eventos: [...e.eventos], reloj: formatoReloj(e.reloj), enHorario: enHorario(e.reloj) };
}

function rack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * 0.03, h); ctx.fillRect(x + w * 0.97, y, w * 0.03, h);
  for (let i = 0; i < 4; i++) {
    const yy = y + (h / 4) * i + h / 4 - h * 0.025;
    ctx.fillRect(x, yy, w, h * 0.025);
    for (let j = 0; j < 4; j++) { // cajas guardadas en el estante
      const bw = w * 0.16, bh = h * (0.09 + ((i + j) % 3) * 0.025);
      ctx.fillRect(x + w * 0.07 + j * w * 0.22, yy - bh, bw, bh);
    }
  }
}

function dibujarCaja(ctx: CanvasRenderingContext2D, c: Caja, W: number, H: number) {
  const x = c.x * W, y = c.y * H, w = c.w * W, h = c.h * H;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(c.rot);
  ctx.fillStyle = C.carton; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = C.cartonOscuro; ctx.fillRect(w / 2 - w * 0.12, -h / 2, w * 0.12, h);  // lado en sombra
  ctx.fillStyle = C.cinta; ctx.fillRect(-w * 0.08, -h / 2, w * 0.16, h);                 // cinta de embalaje
  ctx.fillStyle = C.etiqueta; ctx.fillRect(-w * 0.38, h * 0.08, w * 0.26, h * 0.22);     // etiqueta con código
  ctx.fillStyle = '#2a2a2a';
  for (let i = 0; i < 6; i++) ctx.fillRect(-w * 0.36 + i * w * 0.04, h * 0.12, w * (i % 2 ? 0.012 : 0.02), h * 0.12);
  ctx.restore();
}

function dibujarDeteccion(ctx: CanvasRenderingContext2D, c: Caja, W: number, H: number, escala: number) {
  const alerta = c.fuera || c.caida !== null;
  const color = alerta ? C.alerta : C.senal;
  // Con la caja cayendo, el recuadro sigue a la caja ya girada.
  const girada = c.rot > 0.4;
  const bw = (girada ? c.h * H : c.w * W) + 10 * escala, bh = (girada ? c.w * W : c.h * H) + 10 * escala;
  const cx = (c.x + c.w / 2) * W, cy = (c.y + c.h / 2) * H;
  const x = cx - bw / 2, y = cy - bh / 2, k = Math.min(bw, bh) * 0.28;
  ctx.strokeStyle = color; ctx.lineWidth = 2 * escala;
  ctx.beginPath(); // esquinas del recuadro de detección
  ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y);
  ctx.moveTo(x + bw - k, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw, y + k);
  ctx.moveTo(x + bw, y + bh - k); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x + bw - k, y + bh);
  ctx.moveTo(x + k, y + bh); ctx.lineTo(x, y + bh); ctx.lineTo(x, y + bh - k);
  ctx.stroke();
  ctx.globalAlpha = 0.35; ctx.lineWidth = 1 * escala; ctx.strokeRect(x, y, bw, bh); ctx.globalAlpha = 1;
  const texto = c.caida !== null ? 'caída' : c.fuera ? 'fuera de horario' : `caja ${Math.round(c.conf * 100)} %`;
  ctx.font = `600 ${11 * escala}px ${FUENTE}`;
  const tw = ctx.measureText(texto).width + 10 * escala;
  ctx.fillStyle = color; ctx.fillRect(x, y - 17 * escala, tw, 16 * escala);
  ctx.fillStyle = alerta ? C.texto : '#142640'; ctx.fillText(texto, x + 5 * escala, y - 5 * escala);
}

function dibujar(ctx: CanvasRenderingContext2D, e: Estado, W: number, H: number, escala: number) {
  const noche = !enHorario(e.reloj);
  // Pared y estantes del fondo; fuera de horario el almacén queda a oscuras.
  const fondo = ctx.createLinearGradient(0, 0, 0, H);
  fondo.addColorStop(0, noche ? C.paredNoche : C.pared); fondo.addColorStop(1, noche ? '#0d1520' : '#22324a');
  ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 5; i++) rack(ctx, W * (0.03 + i * 0.2), H * 0.06, W * 0.16, H * 0.42, noche ? C.rackNoche : C.rack);
  // Piso con la franja amarilla y negra que delimita la zona de detección.
  ctx.fillStyle = noche ? '#2e353d' : C.piso; ctx.fillRect(0, H * 0.86, W, H * 0.14);
  const fy = H * 0.86, fh = H * 0.025, paso = 18 * escala;
  ctx.save(); ctx.beginPath(); ctx.rect(0, fy, W, fh); ctx.clip();
  ctx.fillStyle = '#16120a'; ctx.fillRect(0, fy, W, fh); ctx.fillStyle = C.senal;
  for (let x = -paso; x < W + paso; x += paso * 2) { ctx.beginPath(); ctx.moveTo(x, fy + fh); ctx.lineTo(x + paso, fy); ctx.lineTo(x + paso * 2, fy); ctx.lineTo(x + paso, fy + fh); ctx.fill(); }
  ctx.restore();
  // Fajas transportadoras con rodillos que avanzan en el sentido de cada carril.
  for (const [base, sentido] of [[CARRILES.salida, -1], [CARRILES.entrada, 1]] as const) {
    const y = base * H, alto = H * 0.035;
    ctx.fillStyle = C.faja; ctx.fillRect(0, y, W, alto);
    ctx.fillStyle = C.rodillo;
    const sep = 26 * escala, desfase = ((e.t * 0.13 * W * sentido) % sep + sep) % sep;
    for (let x = desfase - sep; x < W + sep; x += sep) { ctx.beginPath(); ctx.arc(x, y + alto / 2, alto * 0.28, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#0e1520'; ctx.fillRect(0, y + alto, W, H * 0.012);
  }
  // Línea de conteo.
  ctx.save();
  ctx.strokeStyle = C.senal; ctx.lineWidth = 2 * escala; ctx.setLineDash([8 * escala, 6 * escala]);
  ctx.beginPath(); ctx.moveTo(LINEA * W, H * 0.2); ctx.lineTo(LINEA * W, H * 0.86); ctx.stroke();
  ctx.restore();
  ctx.font = `600 ${11 * escala}px ${FUENTE}`; ctx.fillStyle = C.senal;
  ctx.fillText('línea de conteo', LINEA * W + 6 * escala, H * 0.2 + 4 * escala);

  for (const c of e.cajas) dibujarCaja(ctx, c, W, H);
  for (const c of e.cajas) if (c.x + c.w > 0 && c.x < 1) dibujarDeteccion(ctx, c, W, H, escala);

  // Datos de la cámara.
  ctx.font = `600 ${12 * escala}px ${FUENTE}`;
  ctx.fillStyle = 'rgba(14,21,32,.72)'; ctx.fillRect(10 * escala, 10 * escala, 186 * escala, 24 * escala);
  ctx.fillStyle = C.texto; ctx.fillText('Cámara 2, muelle de carga', 18 * escala, 26 * escala);
  const reloj = formatoReloj(e.reloj), rw = ctx.measureText(reloj).width + 34 * escala;
  ctx.fillStyle = 'rgba(14,21,32,.72)'; ctx.fillRect(W - rw - 10 * escala, 10 * escala, rw, 24 * escala);
  ctx.fillStyle = Math.floor(e.t * 2) % 2 ? C.alerta : '#7a2a1e';
  ctx.beginPath(); ctx.arc(W - rw + 2 * escala, 22 * escala, 4.5 * escala, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = noche ? C.alerta : C.texto; ctx.fillText(reloj, W - rw + 14 * escala, 26 * escala);
}

export default function Simulacion({ escenario, pausado, alCambiar }: { escenario: Escenario; pausado: boolean; alCambiar: (r: Resumen) => void }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const estado = useRef<Estado | null>(null) as React.MutableRefObject<Estado>;
  if (!estado.current) estado.current = avanzar(crearSimulacion(escenario), 3);
  const avisar = useRef(alCambiar); avisar.current = alCambiar;

  useEffect(() => {
    // Al cambiar de escenario se reinicia y se adelanta 3 s para que la escena no empiece vacía.
    estado.current = avanzar(crearSimulacion(escenario), 3);
    avisar.current(resumen(estado.current));
  }, [escenario]);

  useEffect(() => {
    const canvas = lienzo.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let ancho = 0, alto = 0, escala = 1, cuadro = 0, anterior = 0, ultimoAviso = 0, visible = true;

    const medir = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = Math.max(1, Math.round(r.width * dpr)); alto = Math.max(1, Math.round(r.height * dpr));
      canvas.width = ancho; canvas.height = alto;
      escala = dpr * Math.max(0.75, Math.min(1.35, r.width / 760));
      dibujar(ctx, estado.current, ancho, alto, escala);
    };
    const bucle = (ahora: number) => {
      const dt = anterior ? Math.min((ahora - anterior) / 1000, 0.1) : 0;
      anterior = ahora;
      avanzar(estado.current, dt);
      dibujar(ctx, estado.current, ancho, alto, escala);
      if (ahora - ultimoAviso > 250) { ultimoAviso = ahora; avisar.current(resumen(estado.current)); }
      cuadro = requestAnimationFrame(bucle);
    };
    const arrancar = () => { if (!cuadro && !pausado && visible && !document.hidden) { anterior = 0; cuadro = requestAnimationFrame(bucle); } };
    const parar = () => { if (cuadro) cancelAnimationFrame(cuadro); cuadro = 0; };

    const tamano = new ResizeObserver(medir); tamano.observe(canvas);
    const vista = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) arrancar(); else parar(); });
    vista.observe(canvas);
    const pestana = () => (document.hidden ? parar() : arrancar());
    document.addEventListener('visibilitychange', pestana);
    medir(); avisar.current(resumen(estado.current)); arrancar();
    return () => { parar(); tamano.disconnect(); vista.disconnect(); document.removeEventListener('visibilitychange', pestana); };
  }, [pausado, escenario]);

  return <canvas ref={lienzo} className="sim-lienzo" role="img"
    aria-label="Simulación: cajas que pasan por dos fajas frente a una cámara; cada caja aparece enmarcada y se cuenta al cruzar la línea amarilla." />;
}
