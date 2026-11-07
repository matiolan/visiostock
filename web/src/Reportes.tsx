// SCRUM-24 · HU-14: vista del reporte semanal con exportación a Excel (CSV) y PDF (impresión).
import { useEffect, useState } from 'react';
import { supabaseBrowser } from './lib/supabase';
import { fechaLima, generarReporte, reporteACSV, sumarDias, ultimaSemanaCompleta, inicioSemana, type ReporteSemanal, type ProductoReporte, type Variacion } from './lib/reporte-semanal';

async function cargarDatos(inicio: Date) {
  const db = supabaseBrowser(), desde = sumarDias(inicio, -7).toISOString(), hasta = sumarDias(inicio, 7).toISOString();
  const [m, v] = await Promise.all([
    db.from('vs_movimientos').select('producto_id,sentido,cantidad,creado_en').gte('creado_en', desde).lt('creado_en', hasta).limit(10000),
    db.from('vs_verificaciones').select('producto_id,diferencia,creado_en').gte('creado_en', desde).lt('creado_en', hasta).limit(10000),
  ]);
  if (m.error || v.error) throw new Error('No se pudieron leer los movimientos o verificaciones de esas semanas.');
  return { movimientos: m.data ?? [], verificaciones: v.data ?? [] };
}

const signo = (n: number) => (n > 0 ? '+' : '') + n;
function Cambio({ v, malo }: { v: Variacion; malo: 'sube' | 'neutro' }) {
  const clase = malo === 'sube' && v.cambio > 0 ? 'vs-tag warn' : 'vs-tag';
  return <span className={clase}>{signo(v.cambio)}{v.porcentaje === null ? '' : ` (${signo(v.porcentaje)} %)`}</span>;
}

export default function Reportes({ productos, empresa }: { productos: ProductoReporte[]; empresa: string }) {
  const [semana, setSemana] = useState(() => ultimaSemanaCompleta());
  const [reporte, setReporte] = useState<ReporteSemanal | null>(null), [error, setError] = useState(''), [cargando, setCargando] = useState(true);
  const enCurso = semana.getTime() >= inicioSemana(new Date()).getTime();

  useEffect(() => {
    let vigente = true; setCargando(true); setError('');
    cargarDatos(semana)
      .then(d => { if (vigente) setReporte(generarReporte(semana, d.movimientos, d.verificaciones, productos)); })
      .catch(e => { if (vigente) { setReporte(null); setError(e instanceof Error ? e.message : 'No se pudo generar el reporte.'); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [semana, productos]);

  function descargarExcel() {
    if (!reporte) return;
    const url = URL.createObjectURL(new Blob([reporteACSV(reporte)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `reporte-semanal-${reporte.inicio.toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const r = reporte;
  return <div className="reporte-semanal">
    <div className="reporte-controles no-print">
      <button onClick={() => setSemana(s => sumarDias(s, -7))} disabled={cargando}>‹ Semana anterior</button>
      <button onClick={() => setSemana(s => sumarDias(s, 7))} disabled={cargando || enCurso}>Semana siguiente ›</button>
      <button className="export-button" onClick={descargarExcel} disabled={!r}>Descargar Excel (CSV)</button>
      <button className="export-button" onClick={() => window.print()} disabled={!r}>Descargar PDF</button>
    </div>
    <p className="vs-eyebrow">REPORTE SEMANAL DE MERMAS Y DISCREPANCIAS{empresa ? ` · ${empresa.toUpperCase()}` : ''}</p>
    <h2>Semana del {fechaLima(semana)} al {fechaLima(sumarDias(semana, 6))}{enCurso ? ' (en curso)' : ''}</h2>
    <p className="csv-help">Lunes 00:00 a domingo 23:59, hora de Lima. Merma = unidades faltantes detectadas en las verificaciones (conteo menor que el stock registrado).</p>
    {cargando && <p className="status" role="status">Generando reporte…</p>}
    {error && <p role="alert" className="csv-errors">{error}</p>}
    {r && !cargando && <>
      <div className="vs-metrics reporte-metricas">
        <article><small>Entradas</small><strong>{r.actual.entradas}</strong><span>unidades · {r.actual.movimientos} movimientos</span></article>
        <article><small>Salidas</small><strong>{r.actual.salidas}</strong><span>unidades</span></article>
        <article><small>Merma</small><strong>{r.actual.unidadesFaltantes}</strong><span>unidades faltantes · {r.actual.conDiferencia} de {r.actual.verificaciones} verificaciones con diferencia</span></article>
      </div>
      <div className="vs-section-title"><h2>Comparación con la semana anterior</h2><span>DEL {fechaLima(r.inicioAnterior)}</span></div>
      <div className="vs-table-wrap"><table><thead><tr><th>Indicador</th><th>Esta semana</th><th>Semana anterior</th><th>Cambio</th></tr></thead><tbody>
        <tr><td>Unidades de entrada</td><td>{r.comparacion.entradas.actual}</td><td>{r.comparacion.entradas.anterior}</td><td><Cambio v={r.comparacion.entradas} malo="neutro" /></td></tr>
        <tr><td>Unidades de salida</td><td>{r.comparacion.salidas.actual}</td><td>{r.comparacion.salidas.anterior}</td><td><Cambio v={r.comparacion.salidas} malo="neutro" /></td></tr>
        <tr><td>Verificaciones con diferencia</td><td>{r.comparacion.conDiferencia.actual}</td><td>{r.comparacion.conDiferencia.anterior}</td><td><Cambio v={r.comparacion.conDiferencia} malo="sube" /></td></tr>
        <tr><td>Unidades faltantes (merma)</td><td>{r.comparacion.unidadesFaltantes.actual}</td><td>{r.comparacion.unidadesFaltantes.anterior}</td><td><Cambio v={r.comparacion.unidadesFaltantes} malo="sube" /></td></tr>
      </tbody></table></div>
      <div className="vs-section-title"><h2>Top 5 productos con mayor merma</h2></div>
      <div className="vs-table-wrap"><table><thead><tr><th>#</th><th>SKU</th><th>Producto</th><th>Unidades faltantes</th></tr></thead><tbody>
        {r.topMermas.map((f, i) => <tr key={f.producto_id}><td>{i + 1}</td><td>{f.sku}</td><td>{f.nombre}</td><td>{f.faltante}</td></tr>)}
      </tbody></table>{!r.topMermas.length && <p className="vs-empty">Sin mermas registradas esta semana.</p>}</div>
      <div className="vs-section-title"><h2>Discrepancias por SKU</h2></div>
      <div className="vs-table-wrap"><table><thead><tr><th>SKU</th><th>Producto</th><th>Verificaciones</th><th>Con diferencia</th><th>Faltante</th><th>Sobrante</th><th>Neto</th></tr></thead><tbody>
        {r.porSku.map(f => <tr key={f.producto_id}><td>{f.sku}</td><td>{f.nombre}</td><td>{f.verificaciones}</td><td>{f.conDiferencia}</td><td>{f.faltante}</td><td>{f.sobrante}</td><td>{signo(f.neto)}</td></tr>)}
      </tbody></table>{!r.porSku.length && <p className="vs-empty">No hubo discrepancias en las verificaciones de esta semana.</p>}</div>
      <p className="csv-help">Generado el {new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })} · VisioStock</p>
    </>}
  </div>;
}
