import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Sentido = "entrada" | "salida";

export interface ResumenZona {
  zona: string;
  stock_registrado: number;
  stock_inicial: number;
  entradas: number;
  salidas: number;
  stock_detectado: number;
  diferencia: number;
}

export interface Movimiento {
  id: string;
  zona: string;
  sentido: Sentido;
  cantidad: number;
  confianza: number | null;
  foto_url: string | null;
  detectado_en: string;
}

export interface DatosPanel {
  zonas: string[];
  resumen: ResumenZona;
  movimientos: Movimiento[];
  entradasHoy: number;
  salidasHoy: number;
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

function inicioDelDia(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function cargarPanel(zona: string): Promise<DatosPanel> {
  const sb = obtenerCliente();
  if (!sb) return datosDeEjemplo(zona, "Faltan las variables de Supabase");

  const [resResumen, resMovs, resHoy] = await Promise.all([
    sb.from("resumen_zona").select("*"),
    sb
      .from("movimientos")
      .select("id, zona, sentido, cantidad, confianza, foto_url, detectado_en")
      .eq("zona", zona)
      .order("detectado_en", { ascending: false })
      .limit(20),
    sb
      .from("movimientos")
      .select("sentido, cantidad")
      .eq("zona", zona)
      .gte("detectado_en", inicioDelDia())
      .limit(5000),
  ]);

  if (resResumen.error || resMovs.error || resHoy.error) {
    return datosDeEjemplo(zona, "La base de datos aún no tiene las tablas del panel");
  }

  const filas = (resResumen.data ?? []) as ResumenZona[];
  const zonas = filas.length ? filas.map((f) => f.zona).sort() : [zona];
  const resumen =
    filas.find((f) => f.zona === zona) ?? {
      zona,
      stock_registrado: 0,
      stock_inicial: 0,
      entradas: 0,
      salidas: 0,
      stock_detectado: 0,
      diferencia: 0,
    };

  let entradasHoy = 0;
  let salidasHoy = 0;
  for (const m of (resHoy.data ?? []) as Pick<Movimiento, "sentido" | "cantidad">[]) {
    if (m.sentido === "entrada") entradasHoy += m.cantidad;
    else salidasHoy += m.cantidad;
  }

  return {
    zonas,
    resumen: normalizar(resumen),
    movimientos: (resMovs.data ?? []) as Movimiento[],
    entradasHoy,
    salidasHoy,
    esEjemplo: false,
  };
}

function normalizar(r: ResumenZona): ResumenZona {
  return {
    zona: r.zona,
    stock_registrado: Number(r.stock_registrado) || 0,
    stock_inicial: Number(r.stock_inicial) || 0,
    entradas: Number(r.entradas) || 0,
    salidas: Number(r.salidas) || 0,
    stock_detectado: Number(r.stock_detectado) || 0,
    diferencia: Number(r.diferencia) || 0,
  };
}

export function datosDeEjemplo(zona: string, motivo: string): DatosPanel {
  const ahora = Date.now();
  const sentidos: Sentido[] = ["salida", "salida", "entrada", "salida", "salida", "entrada", "salida", "salida", "salida", "entrada"];
  const movimientos: Movimiento[] = Array.from({ length: 20 }, (_, i) => ({
    id: `ejemplo-${i}`,
    zona,
    sentido: sentidos[i % sentidos.length],
    cantidad: i % 4 === 0 ? 3 : 1,
    confianza: 0.9 + ((i * 7) % 9) / 100,
    foto_url: "/demo/evidencia.svg",
    detectado_en: new Date(ahora - (i * 11 + 2) * 60_000).toISOString(),
  }));
  return {
    zonas: ["A", "B"],
    resumen: {
      zona,
      stock_registrado: 100,
      stock_inicial: 100,
      entradas: 6,
      salidas: 14,
      stock_detectado: 92,
      diferencia: -8,
    },
    movimientos,
    entradasHoy: 6,
    salidasHoy: 14,
    esEjemplo: true,
    motivoEjemplo: motivo,
  };
}
