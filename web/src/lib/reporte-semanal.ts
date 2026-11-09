// SCRUM-24 · HU-14: reporte semanal de mermas y discrepancias.
// Lógica pura (sin red) para poder probar los totales con datos conocidos.
// Las semanas van de lunes 00:00 a domingo 23:59 en America/Lima (UTC-5, Perú no usa horario de verano).

export type MovimientoReporte = { producto_id: string; sentido: string; cantidad: number; creado_en: string };
export type VerificacionReporte = { producto_id: string; diferencia: number; creado_en: string };
export type ProductoReporte = { id: string; sku: string; nombre: string };

export type ResumenSemana = {
  entradas: number; salidas: number; movimientos: number;
  verificaciones: number; conDiferencia: number;
  unidadesFaltantes: number; unidadesSobrantes: number;
};
export type FilaSku = { producto_id: string; sku: string; nombre: string; verificaciones: number; conDiferencia: number; faltante: number; sobrante: number; neto: number };
export type Variacion = { actual: number; anterior: number; cambio: number; porcentaje: number | null };
export type ReporteSemanal = {
  inicio: Date; fin: Date; inicioAnterior: Date;
  actual: ResumenSemana; anterior: ResumenSemana;
  porSku: FilaSku[]; topMermas: FilaSku[];
  comparacion: Record<'entradas' | 'salidas' | 'conDiferencia' | 'unidadesFaltantes', Variacion>;
};

const OFFSET_LIMA_MS = 5 * 3600 * 1000;
const DIA_MS = 24 * 3600 * 1000;

type PaginaReporte<T> = { data: T[] | null; error: unknown; count: number | null };

export async function cargarPaginasReporte<T>(
  consultar: (desde: number, hasta: number) => PromiseLike<PaginaReporte<T>>,
): Promise<T[]> {
  const filas: T[] = [];
  let total: number | null = null;
  do {
    const pagina = await consultar(filas.length, filas.length + 499);
    if (pagina.error || pagina.count === null || !pagina.data) {
      throw new Error('No se pudieron leer todos los registros del reporte.');
    }
    if (total === null) total = pagina.count;
    if (!pagina.data.length && filas.length < total) {
      throw new Error('La consulta del reporte devolvió datos incompletos. Vuelve a intentarlo.');
    }
    filas.push(...pagina.data);
  } while (filas.length < total);
  return filas;
}

/** Lunes 00:00 (hora de Lima) de la semana que contiene `fecha`, como instante UTC. */
export function inicioSemana(fecha: Date): Date {
  const lima = new Date(fecha.getTime() - OFFSET_LIMA_MS);
  const diasDesdeLunes = (lima.getUTCDay() + 6) % 7;
  const lunes = Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate()) - diasDesdeLunes * DIA_MS;
  return new Date(lunes + OFFSET_LIMA_MS);
}

/** Lunes de la última semana completa (la anterior a la semana en curso). */
export function ultimaSemanaCompleta(hoy: Date = new Date()): Date {
  return new Date(inicioSemana(hoy).getTime() - 7 * DIA_MS);
}

export function sumarDias(fecha: Date, dias: number): Date { return new Date(fecha.getTime() + dias * DIA_MS); }

const enRango = (iso: string, desde: Date, hasta: Date) => { const t = Date.parse(iso); return t >= desde.getTime() && t < hasta.getTime(); };

function resumir(movs: MovimientoReporte[], vers: VerificacionReporte[]): ResumenSemana {
  const r: ResumenSemana = { entradas: 0, salidas: 0, movimientos: movs.length, verificaciones: vers.length, conDiferencia: 0, unidadesFaltantes: 0, unidadesSobrantes: 0 };
  for (const m of movs) { if (m.sentido === 'entrada') r.entradas += m.cantidad; else if (m.sentido === 'salida') r.salidas += m.cantidad; }
  for (const v of vers) {
    if (v.diferencia !== 0) r.conDiferencia++;
    if (v.diferencia < 0) r.unidadesFaltantes += -v.diferencia; else r.unidadesSobrantes += v.diferencia;
  }
  return r;
}

function variacion(actual: number, anterior: number): Variacion {
  return { actual, anterior, cambio: actual - anterior, porcentaje: anterior === 0 ? null : Math.round(((actual - anterior) / anterior) * 1000) / 10 };
}

export function generarReporte(semana: Date, movimientos: MovimientoReporte[], verificaciones: VerificacionReporte[], productos: ProductoReporte[]): ReporteSemanal {
  const inicio = inicioSemana(semana), fin = sumarDias(inicio, 7), inicioAnterior = sumarDias(inicio, -7);
  const movs = movimientos.filter(m => enRango(m.creado_en, inicio, fin));
  const vers = verificaciones.filter(v => enRango(v.creado_en, inicio, fin));
  const actual = resumir(movs, vers);
  const anterior = resumir(movimientos.filter(m => enRango(m.creado_en, inicioAnterior, inicio)), verificaciones.filter(v => enRango(v.creado_en, inicioAnterior, inicio)));

  const filas = new Map<string, FilaSku>();
  for (const v of vers) {
    const p = productos.find(x => x.id === v.producto_id);
    const f = filas.get(v.producto_id) ?? { producto_id: v.producto_id, sku: p?.sku ?? '—', nombre: p?.nombre ?? 'Producto eliminado', verificaciones: 0, conDiferencia: 0, faltante: 0, sobrante: 0, neto: 0 };
    f.verificaciones++;
    if (v.diferencia !== 0) f.conDiferencia++;
    if (v.diferencia < 0) f.faltante += -v.diferencia; else f.sobrante += v.diferencia;
    f.neto += v.diferencia;
    filas.set(v.producto_id, f);
  }
  const porSku = [...filas.values()].filter(f => f.conDiferencia > 0).sort((a, b) => b.faltante - a.faltante || a.sku.localeCompare(b.sku));
  const topMermas = porSku.filter(f => f.faltante > 0).slice(0, 5);
  return {
    inicio, fin, inicioAnterior, actual, anterior, porSku, topMermas,
    comparacion: {
      entradas: variacion(actual.entradas, anterior.entradas),
      salidas: variacion(actual.salidas, anterior.salidas),
      conDiferencia: variacion(actual.conDiferencia, anterior.conDiferencia),
      unidadesFaltantes: variacion(actual.unidadesFaltantes, anterior.unidadesFaltantes),
    },
  };
}

export function fechaLima(fecha: Date): string {
  return fecha.toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' });
}

const celda = (v: unknown) => '"' + String(v).replace(/^[\s=+@-]/, "'$&").replaceAll('"', '""') + '"';

/** CSV con BOM para Excel. Contiene exactamente los mismos totales que la vista y el PDF. */
export function reporteACSV(r: ReporteSemanal): string {
  const semana = `${fechaLima(r.inicio)} al ${fechaLima(sumarDias(r.fin, -1))}`;
  const filas: unknown[][] = [
    ['Reporte semanal de mermas y discrepancias'], ['Semana', semana], [],
    ['Indicador', 'Semana actual', 'Semana anterior', 'Cambio'],
    ['Unidades de entrada', r.comparacion.entradas.actual, r.comparacion.entradas.anterior, r.comparacion.entradas.cambio],
    ['Unidades de salida', r.comparacion.salidas.actual, r.comparacion.salidas.anterior, r.comparacion.salidas.cambio],
    ['Verificaciones con diferencia', r.comparacion.conDiferencia.actual, r.comparacion.conDiferencia.anterior, r.comparacion.conDiferencia.cambio],
    ['Unidades faltantes (merma)', r.comparacion.unidadesFaltantes.actual, r.comparacion.unidadesFaltantes.anterior, r.comparacion.unidadesFaltantes.cambio],
    [],
    ['Top 5 productos con mayor merma'], ['SKU', 'Producto', 'Unidades faltantes'],
    ...r.topMermas.map(f => [f.sku, f.nombre, f.faltante]),
    [],
    ['Discrepancias por SKU'], ['SKU', 'Producto', 'Verificaciones', 'Con diferencia', 'Faltante', 'Sobrante', 'Neto'],
    ...r.porSku.map(f => [f.sku, f.nombre, f.verificaciones, f.conDiferencia, f.faltante, f.sobrante, f.neto]),
  ];
  return '﻿' + filas.map(f => f.map(celda).join(',')).join('\r\n');
}
