// SCRUM-76 · Simulación de la portada: cajas que cruzan la línea de conteo de una cámara.
// Lógica pura y determinista (con semilla) para poder probarla sin navegador; el dibujo
// en canvas vive en web/src/landing/Simulacion.tsx.
// Coordenadas normalizadas: x e y van de 0 a 1 sobre el ancho y el alto de la escena.

export type Escenario = 'conteo' | 'fuera' | 'manipulacion';
export type TipoEvento = 'entrada' | 'salida' | 'alerta';

export type Caja = {
  id: number; sku: string; conf: number;
  x: number; y: number; w: number; h: number;
  v: number;               // velocidad en ancho de escena por segundo; > 0 entra, < 0 sale
  contada: boolean;
  fuera: boolean;          // cruzó la línea fuera del horario laboral
  cae: boolean;            // está marcada para caerse (escenario de manipulación)
  caida: number | null;    // segundos desde que empezó a caer
  rot: number;
};
export type Evento = { id: number; reloj: string; texto: string; tipo: TipoEvento };
export type Estado = {
  escenario: Escenario; t: number; reloj: number;
  cajas: Caja[]; eventos: Evento[];
  entradas: number; salidas: number; stock: number; alertas: number;
  siguiente: number; entrantes: number; proxima: number; semilla: number;
};

export const LINEA = 0.5;                       // x de la línea de conteo
export const CARRILES = { entrada: 0.78, salida: 0.56 } as const; // y de la base de cada carril
export const HORARIO = { inicio: 7 * 60, fin: 19 * 60 } as const; // 07:00 a 19:00, hora de Lima
const SKUS = ['CAJ-014', 'CAJ-022', 'CAJ-031', 'CAJ-047', 'CAJ-058'];
const MAX_EVENTOS = 6;

const CONFIG: Record<Escenario, { reloj: number; minutosPorSegundo: number; cadencia: number }> = {
  conteo: { reloj: 10 * 60 + 12, minutosPorSegundo: 0.5, cadencia: 1.7 },
  fuera: { reloj: 18 * 60 + 57, minutosPorSegundo: 1, cadencia: 1.9 },
  manipulacion: { reloj: 15 * 60 + 40, minutosPorSegundo: 0.5, cadencia: 1.8 },
};

/** Generador pseudoaleatorio con semilla (mulberry32): misma semilla, misma simulación. */
function azar(e: Estado): number {
  e.semilla = (e.semilla + 0x6d2b79f5) | 0;
  let t = e.semilla;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function formatoReloj(minutos: number): string {
  const m = ((Math.floor(minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function enHorario(minutos: number): boolean {
  const m = ((minutos % 1440) + 1440) % 1440;
  return m >= HORARIO.inicio && m < HORARIO.fin;
}

export function crearSimulacion(escenario: Escenario, semilla = 7): Estado {
  return {
    escenario, t: 0, reloj: CONFIG[escenario].reloj,
    cajas: [], eventos: [], entradas: 0, salidas: 0, stock: 120, alertas: 0,
    siguiente: 1, entrantes: 0, proxima: 0.2, semilla,
  };
}

function nuevaCaja(e: Estado): Caja {
  const entra = azar(e) < 0.62;
  const w = 0.085 + azar(e) * 0.035, h = 0.15 + azar(e) * 0.07;
  const id = e.siguiente++;
  if (entra) e.entrantes++;
  return {
    id, sku: SKUS[Math.floor(azar(e) * SKUS.length)], conf: Math.round((0.88 + azar(e) * 0.11) * 100) / 100,
    x: entra ? -w : 1 + w, y: (entra ? CARRILES.entrada : CARRILES.salida) - h, w, h,
    v: (entra ? 1 : -1) * 0.12, // misma velocidad por carril: las cajas no se enciman
    contada: false, fuera: false,
    // En "manipulación" una de cada dos cajas que entran se cae antes de la línea.
    cae: e.escenario === 'manipulacion' && entra && e.entrantes % 2 === 0,
    caida: null, rot: 0,
  };
}

function registrar(e: Estado, tipo: TipoEvento, texto: string) {
  e.eventos.unshift({ id: e.t * 1000 + e.eventos.length, reloj: formatoReloj(e.reloj), texto, tipo });
  if (e.eventos.length > MAX_EVENTOS) e.eventos.length = MAX_EVENTOS;
}

/** Avanza la simulación dt segundos (se limita a 0,1 s por paso para que nada salte la línea). */
export function avanzar(e: Estado, dt: number): Estado {
  let resto = Math.max(0, dt);
  while (resto > 0) {
    const paso = Math.min(resto, 0.1);
    resto -= paso;
    e.t += paso;
    e.reloj += paso * CONFIG[e.escenario].minutosPorSegundo;

    e.proxima -= paso;
    if (e.proxima <= 0) { e.cajas.push(nuevaCaja(e)); e.proxima = CONFIG[e.escenario].cadencia * (0.75 + azar(e) * 0.5); }

    for (const c of e.cajas) {
      if (c.caida !== null) {               // cayendo: rota y baja hasta el piso
        c.caida += paso;
        c.rot = Math.min(Math.PI / 2, c.caida * 3.2);
        c.y = Math.min(0.97 - c.w, c.y + paso * 0.9);
        continue;
      }
      const antes = c.x + c.w / 2;
      c.x += c.v * paso;
      const centro = c.x + c.w / 2;
      if (c.cae && centro >= 0.34) {
        c.caida = 0;
        e.alertas++;
        registrar(e, 'alerta', `Caída detectada: ${c.sku} cayó de la faja`);
        continue;
      }
      const cruzo = c.v > 0 ? antes < LINEA && centro >= LINEA : antes > LINEA && centro <= LINEA;
      if (cruzo && !c.contada) {
        c.contada = true;
        const sentido: TipoEvento = c.v > 0 ? 'entrada' : 'salida';
        if (sentido === 'entrada') { e.entradas++; e.stock++; } else { e.salidas++; e.stock--; }
        if (!enHorario(e.reloj)) {
          c.fuera = true;
          e.alertas++;
          registrar(e, 'alerta', `Fuera de horario: ${sentido} de ${c.sku}`);
        } else {
          registrar(e, sentido, `${sentido === 'entrada' ? 'Entrada' : 'Salida'} de ${c.sku} (${Math.round(c.conf * 100)} %)`);
        }
      }
    }
    // Las cajas que salieron de la escena o llevan un rato en el piso se retiran.
    e.cajas = e.cajas.filter(c => (c.caida === null ? c.x > -0.3 && c.x < 1.3 : c.caida < 6));
  }
  return e;
}
