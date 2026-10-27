import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Movimiento, Sentido } from "@/lib/panel-datos";

/** Máximo de movimientos que se traen por consulta (criterio de HU-13: hasta 1 000). */
export const LIMITE_TIMELINE = 1000;

export interface FiltrosTimeline {
  desde: string; // AAAA-MM-DD
  hasta: string; // AAAA-MM-DD
  sentido: Sentido | "todos";
  zona: string | "todas";
}

export interface DatosTimeline {
  movimientos: Movimiento[];
  zonas: string[];
  esEjemplo: boolean;
  motivoEjemplo?: string;
}

let cliente: SupabaseClient | null | undefined;

function obtenerCliente(): SupabaseClient | null {
  if (cliente !== undefined) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cliente = url && key ? createClient(url, key) : null;
  return cliente;
}

/** Fecha local en formato AAAA-MM-DD. */
export function fechaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function filtrosPorDefecto(): FiltrosTimeline {
  const hoy = new Date();
  const hace7 = new Date(hoy);
  hace7.setDate(hoy.getDate() - 6);
  return { desde: fechaLocal(hace7), hasta: fechaLocal(hoy), sentido: "todos", zona: "todas" };
}

function limites(f: FiltrosTimeline) {
  const desde = new Date(`${f.desde}T00:00:00`);
  const hasta = new Date(`${f.hasta}T23:59:59.999`);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

/**
 * Trae los movimientos del rango de fechas desde Supabase, en orden cronológico
 * descendente. El sentido y la zona se filtran en el cliente para que cambiar
 * esos filtros sea inmediato (< 2 s, criterio de aceptación de HU-13).
 */
export async function cargarTimeline(f: FiltrosTimeline): Promise<DatosTimeline> {
  const sb = obtenerCliente();
  if (!sb) return timelineDeEjemplo(f, "Faltan las variables de Supabase");

  const { desde, hasta } = limites(f);
  const { data, error } = await sb
    .from("movimientos")
    .select("id, zona, sentido, cantidad, confianza, foto_url, detectado_en")
    .gte("detectado_en", desde)
    .lte("detectado_en", hasta)
    .order("detectado_en", { ascending: false })
    .limit(LIMITE_TIMELINE);

  if (error) return timelineDeEjemplo(f, "La base de datos aún no tiene la tabla de movimientos");

  const movimientos = (data ?? []) as Movimiento[];
  const zonas = Array.from(new Set(movimientos.map((m) => m.zona))).sort();
  return { movimientos, zonas: zonas.length ? zonas : ["A"], esEjemplo: false };
}

export function aplicarFiltros(movs: Movimiento[], f: FiltrosTimeline): Movimiento[] {
  return movs.filter(
    (m) => (f.sentido === "todos" || m.sentido === f.sentido) && (f.zona === "todas" || m.zona === f.zona),
  );
}

/** Agrupa los movimientos por día (AAAA-MM-DD), conservando el orden recibido. */
export function agruparPorDia(movs: Movimiento[]): [string, Movimiento[]][] {
  const grupos = new Map<string, Movimiento[]>();
  for (const m of movs) {
    const dia = fechaLocal(new Date(m.detectado_en));
    const lista = grupos.get(dia);
    if (lista) lista.push(m);
    else grupos.set(dia, [m]);
  }
  return Array.from(grupos.entries());
}

/** Datos de demostración: varios días de movimientos en dos zonas. */
export function timelineDeEjemplo(f: FiltrosTimeline, motivo: string): DatosTimeline {
  const { desde, hasta } = limites(f);
  const tDesde = new Date(desde).getTime();
  const fin = Math.min(new Date(hasta).getTime(), Date.now());
  const movimientos: Movimiento[] = [];
  const sentidos: Sentido[] = ["salida", "entrada", "salida", "salida", "entrada", "salida"];
  let t = fin - 4 * 60_000;
  let i = 0;
  while (t > tDesde && i < 120) {
    movimientos.push({
      id: `ejemplo-tl-${i}`,
      zona: i % 3 === 0 ? "B" : "A",
      sentido: sentidos[i % sentidos.length],
      cantidad: i % 5 === 0 ? 2 : 1,
      confianza: 0.88 + ((i * 7) % 11) / 100,
      foto_url: "/demo/evidencia.svg",
      detectado_en: new Date(t).toISOString(),
    });
    t -= (17 + ((i * 13) % 50)) * 60_000;
    i++;
  }
  return { movimientos, zonas: ["A", "B"], esEjemplo: true, motivoEjemplo: motivo };
}
