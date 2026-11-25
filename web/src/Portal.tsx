// Panel de trabajo. SCRUM-79: menú lateral agrupado, cabecera por vista, resumen con lo que requiere
// atención y el mismo sistema visual de la landing. La lógica de datos y de seguridad no cambia.
import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BarChart3, Bell, Boxes, Building2, Cctv, ChevronRight, Download,
  Info, LayoutDashboard, Lock, LogOut, Menu, RefreshCw, ScanLine, Search, ShieldAlert, Upload, X,
} from 'lucide-react';
import '@fontsource-variable/archivo/wdth.css';
import './portal.css';
import Verificaciones from './Verificaciones';
import MovimientosVideo from './MovimientosVideo';
import ConteoVivo from './ConteoVivo';
import Camaras from './Camaras';
import Manipulacion from './Manipulacion';
import ImportarInventario from './ImportarInventario';
import Reportes from './Reportes';
import Seguridad from './Seguridad';
import { api } from './lib/api';
import { listarCamaras } from './lib/camaras';
import { listarVerificaciones, verEvidencia } from './lib/verificaciones';
import { listarIncidencias } from './lib/manipulacion';
import { zonasDeEmpresa, type Zona } from './lib/dispositivos';
import { supabaseBrowser } from './lib/supabase';
import { VISTAS, vistaDesdeHash, hashDeVista, enUmbral, porcentajeStock, type Vista } from './lib/panel';

type Empresa = { id: string; nombre: string }; type Almacen = Empresa & { empresa_id: string };
type Producto = Almacen & { sku: string; stock: number; umbral: number; almacen_id: string };
type Movimiento = { id: string; creado_en: string; producto_id: string; sentido: string; cantidad: number; fuera_de_horario?: boolean; foto_evidencia?: string | null };
type Horario = { id: string; empresa_id: string; zona_id: string | null; dias_semana: number[]; hora_inicio: string; hora_fin: string };
type Feriado = { id: string; empresa_id: string; fecha: string; descripcion: string };
type Datos = { usuario: string; rol: string; empresas: Empresa[]; almacenes: Almacen[]; productos: Producto[]; movimientos: Movimiento[]; horarios: Horario[]; feriados: Feriado[] };
type Pendientes = { diferencias: number; incidencias: number } | null;

const DIAS = [['1', 'Lun'], ['2', 'Mar'], ['3', 'Mié'], ['4', 'Jue'], ['5', 'Vie'], ['6', 'Sáb'], ['7', 'Dom']] as const;
const ICONOS: Record<Vista, ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  'Resumen': LayoutDashboard, 'Inventario': Boxes, 'Movimientos': ArrowLeftRight, 'Verificación visual': ScanLine,
  'Alertas': Bell, 'Manipulación': ShieldAlert, 'Cámaras y zonas': Cctv, 'Reportes': BarChart3, 'Seguridad': Lock, 'Administración': Building2,
};
const fecha = (iso: string) => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

async function salir() { await supabaseBrowser().auth.signOut(); window.location.assign('/acceso'); }

export default function Portal() {
  const [datos, setDatos] = useState<Datos | null>(null), [error, setError] = useState(''), [mensaje, setMensaje] = useState('');
  const [vista, setVistaEstado] = useState<Vista>(() => vistaDesdeHash(window.location.hash));
  const [filtro, setFiltro] = useState(''), [busy, setBusy] = useState(false), [menu, setMenu] = useState(false);
  const [diasHorario, setDiasHorario] = useState<string[]>(['1', '2', '3', '4', '5', '6']), [empresaHorario, setEmpresaHorario] = useState('');
  const [zonas, setZonas] = useState<Zona[]>([]), [pendientes, setPendientes] = useState<Pendientes>(null);
  const lateral = useRef<HTMLElement>(null), botonMenu = useRef<HTMLButtonElement>(null);

  async function cargar() {
    try { setDatos(await api() as Datos); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el panel.'); }
  }
  async function cargarPendientes() {
    const [v, i] = await Promise.allSettled([listarVerificaciones(), listarIncidencias()]);
    setPendientes({
      diferencias: v.status === 'fulfilled' ? v.value.filter(x => x.diferencia !== 0 && !x.revisado_en).length : 0,
      incidencias: i.status === 'fulfilled' ? i.value.filter(x => !x.revisado_en).length : 0,
    });
  }
  useEffect(() => {
    void cargar(); void cargarPendientes();
    listarCamaras().then(r => setZonas(r.zonas)).catch(() => undefined);
    const alCambiarHash = () => setVistaEstado(vistaDesdeHash(window.location.hash));
    window.addEventListener('hashchange', alCambiarHash);
    return () => window.removeEventListener('hashchange', alCambiarHash);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Menú en celular: Escape lo cierra y el foco vuelve al botón que lo abrió.
  useEffect(() => {
    if (!menu) return;
    lateral.current?.querySelector<HTMLButtonElement>('[aria-current=page]')?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); botonMenu.current?.focus(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [menu]);

  function ir(v: Vista) {
    setVistaEstado(v); setMenu(false); setMensaje('');
    window.history.replaceState(null, '', hashDeVista(v) || window.location.pathname);
    window.scrollTo({ top: 0 });
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>, accion: string, ok = 'Cambios guardados.') {
    e.preventDefault(); setBusy(true); const form = e.currentTarget;
    const b: Record<string, unknown> = Object.fromEntries(new FormData(form));
    for (const k of ['stock', 'cantidad']) if (k in b) b[k] = Number(b[k]);
    try { await api({ ...b, accion }); form.reset(); await cargar(); setMensaje(ok); }
    catch (err) { setMensaje(err instanceof Error ? err.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  async function guardarHorario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!diasHorario.length) { setMensaje('Selecciona al menos un día laboral.'); return; }
    setBusy(true); const f = new FormData(e.currentTarget);
    try { await api({ accion: 'horario', empresa: f.get('empresa'), zona: f.get('zona') || null, dias: diasHorario.map(Number), inicio: f.get('inicio'), fin: f.get('fin') }); setMensaje('Horario laboral guardado.'); await cargar(); }
    catch (err) { setMensaje(err instanceof Error ? err.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }

  const esAdmin = datos?.rol === 'administrador';
  const visibles = VISTAS.filter(v => !v.soloAdmin || esAdmin);
  const actual = visibles.find(v => v.id === vista) ?? VISTAS[0];
  const productos = datos?.productos.filter(p => `${p.nombre} ${p.sku}`.toLowerCase().includes(filtro.toLowerCase())) || [];
  const bajos = datos?.productos.filter(enUmbral).sort((a, b) => porcentajeStock(a) - porcentajeStock(b)) || [];
  const recientes = datos?.movimientos.slice().sort((a, b) => b.creado_en.localeCompare(a.creado_en)) || [];
  const alertas = pendientes ? pendientes.diferencias + pendientes.incidencias : 0;
  const contador: Partial<Record<Vista, number>> = { Inventario: bajos.length, Alertas: pendientes?.diferencias, Manipulación: pendientes?.incidencias };
  const empresas = <>{datos?.empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}</>;
  const nombreAlmacen = (id: string) => datos?.almacenes.find(a => a.id === id)?.nombre || 'Almacén';

  function exportar() {
    const cell = (v: unknown) => '"' + String(v).replace(/^[\s=+@-]/, "'" + '$&').replaceAll('"', '""') + '"';
    const csv = '﻿' + [['SKU', 'Producto', 'Almacén', 'Stock'], ...productos.map(p => [p.sku, p.nombre, nombreAlmacen(p.almacen_id), p.stock])].map(r => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'inventario.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const marca = <a className="app-marca" href="/"><span className="app-ojo" aria-hidden="true"><ScanLine size={20} /></span>VisioStock</a>;

  return <div className="vs-app">
    <header className="app-movil no-print">
      {marca}
      <button ref={botonMenu} type="button" aria-label="Abrir menú" aria-expanded={menu} aria-controls="app-lateral" onClick={() => setMenu(true)}><Menu size={22} /></button>
    </header>
    {menu && <button type="button" className="app-fondo" aria-label="Cerrar menú" tabIndex={-1} onClick={() => setMenu(false)} />}

    <aside id="app-lateral" ref={lateral} className={menu ? 'app-lateral abierto' : 'app-lateral'} aria-label="Menú del panel">
      {marca}
      {datos && <div className="app-empresa"><strong>{datos.empresas.length === 1 ? datos.empresas[0].nombre : `${datos.empresas.length} empresas`}</strong>{datos.almacenes.length} {datos.almacenes.length === 1 ? 'almacén' : 'almacenes'}</div>}
      <nav className="app-nav" aria-label="Secciones">
        {['Operación', 'Vigilancia', 'Gestión'].map(g => <div key={g} role="group" aria-labelledby={`grupo-${g}`}>
          <p className="app-grupo" id={`grupo-${g}`}>{g}</p>
          {visibles.filter(v => v.grupo === g).map(v => {
            const Icono = ICONOS[v.id], n = contador[v.id];
            return <button key={v.id} type="button" aria-current={v.id === actual.id ? 'page' : undefined} onClick={() => ir(v.id)}>
              <Icono size={18} aria-hidden={true} /><span>{v.id}</span>{!!n && <span className="app-contador" aria-label={`${n} pendientes`}>{n}</span>}
            </button>;
          })}
        </div>)}
      </nav>
      <div className="app-cuenta">
        <span className="app-avatar" aria-hidden="true">{datos?.usuario?.[0] ?? '·'}</span>
        <strong title={datos?.usuario}>{datos?.usuario ?? 'Cargando…'}</strong>
        <span>{esAdmin ? 'Administrador de plataforma' : 'Cliente'}</span>
        <button type="button" onClick={() => void salir()}><LogOut size={16} aria-hidden="true" /> Cerrar sesión</button>
      </div>
    </aside>

    <div className="app-principal">
      <header className="app-cabecera no-print">
        <div><h1>{actual.id}</h1><p>{actual.descripcion}</p></div>
        <div className="app-acciones">
          <button type="button" className="boton-linea" onClick={() => { void cargar(); void cargarPendientes(); setMensaje('Datos actualizados.'); }}><RefreshCw size={16} aria-hidden="true" /> Actualizar</button>
        </div>
      </header>

      <main className="app-contenido">
        {mensaje && <div className="app-aviso" role="status"><Info size={18} aria-hidden="true" /><p>{mensaje}</p><button type="button" aria-label="Cerrar aviso" onClick={() => setMensaje('')}><X size={16} /></button></div>}
        {error && <div className="csv-errors" role="alert"><p>{error}</p></div>}
        {!datos && !error && <p className="app-cargando" role="status">Cargando tu almacén…</p>}

        {datos && <>
          {actual.id === 'Resumen' && <>
            <section className="indicadores" aria-label="Indicadores">
              <article className="indicador"><small>Stock total</small><strong>{datos.productos.reduce((n, p) => n + p.stock, 0).toLocaleString('es-PE')}</strong><span>unidades registradas</span></article>
              <article className="indicador"><small>Productos</small><strong>{datos.productos.length}</strong><span>en {datos.almacenes.length} {datos.almacenes.length === 1 ? 'almacén' : 'almacenes'}</span></article>
              <article className={bajos.length ? 'indicador atencion' : 'indicador'}><small>En umbral mínimo</small><strong>{bajos.length}</strong><span>{bajos.length ? 'conviene reponer' : 'todo con stock suficiente'}</span></article>
              <article className={alertas ? 'indicador alerta' : 'indicador'}><small>Alertas por revisar</small><strong>{pendientes ? alertas : '—'}</strong><span>{pendientes ? `${plural(pendientes.diferencias, 'diferencia', 'diferencias')} · ${plural(pendientes.incidencias, 'incidencia', 'incidencias')}` : 'consultando…'}</span></article>
            </section>
            <div className="resumen-rejilla">
              <section className="tarjeta">
                <div className="tarjeta-titulo"><h2>Últimos movimientos</h2><button type="button" className="text-button" onClick={() => ir('Movimientos')}>Ver todos</button></div>
                <TablaMovimientos movimientos={recientes.slice(0, 8)} productos={datos.productos} />
              </section>
              <div className="resumen-lado">
                <section className="tarjeta">
                  <div className="tarjeta-titulo"><h2>Accesos rápidos</h2></div>
                  <div className="atajos">
                    <button type="button" className="boton-senal" onClick={() => ir('Verificación visual')}><ScanLine size={18} aria-hidden="true" /><span>Verificar un producto con foto</span><ChevronRight size={18} aria-hidden="true" /></button>
                    <button type="button" onClick={() => ir('Movimientos')}><ArrowLeftRight size={18} aria-hidden="true" /><span>Registrar entrada o salida</span><ChevronRight size={18} aria-hidden="true" /></button>
                    <button type="button" onClick={() => ir('Inventario')}><Upload size={18} aria-hidden="true" /><span>Importar inventario CSV</span><ChevronRight size={18} aria-hidden="true" /></button>
                    <button type="button" onClick={() => ir('Alertas')}><Bell size={18} aria-hidden="true" /><span>Revisar alertas</span><ChevronRight size={18} aria-hidden="true" /></button>
                  </div>
                </section>
                <section className="tarjeta">
                  <div className="tarjeta-titulo"><h2>Requieren atención</h2>{bajos.length > 5 && <button type="button" className="text-button" onClick={() => ir('Inventario')}>Ver {bajos.length}</button>}</div>
                  {bajos.length ? <ul className="umbral-lista">{bajos.slice(0, 5).map(p => <li key={p.id}>
                    <span><strong>{p.nombre}</strong><br /><small>{p.sku} · {nombreAlmacen(p.almacen_id)}</small></span>
                    <b>{p.stock} / {p.umbral}</b>
                    <span className="barra-stock" aria-hidden="true"><i className="bajo" style={{ width: `${porcentajeStock(p)}%` }} /></span>
                  </li>)}</ul> : <p className="vs-empty">Ningún producto está en su umbral mínimo.</p>}
                </section>
              </div>
            </div>
          </>}

          {(actual.id === 'Verificación visual' || actual.id === 'Alertas') && <Verificaciones key={actual.id} productos={datos.productos} almacenes={datos.almacenes} soloAlertas={actual.id === 'Alertas'} />}
          {actual.id === 'Alertas' && <AlertasHorario empresas={datos.empresas} productos={datos.productos} />}
          {actual.id === 'Cámaras y zonas' && <Camaras almacenes={datos.almacenes} />}
          {actual.id === 'Manipulación' && <Manipulacion productos={datos.productos} almacenes={datos.almacenes} />}
          {actual.id === 'Seguridad' && <Seguridad />}
          {actual.id === 'Reportes' && <Reportes productos={datos.productos} empresa={datos.empresas.length === 1 ? datos.empresas[0].nombre : ''} />}

          {actual.id === 'Inventario' && <>
            <div className="herramientas">
              <div className="buscador"><Search size={18} aria-hidden="true" /><input aria-label="Buscar productos" placeholder="Buscar por nombre o SKU" value={filtro} onChange={e => setFiltro(e.target.value)} /></div>
              <span className="cuenta">{productos.length} de {datos.productos.length} productos</span>
              <button type="button" className="boton-linea" onClick={exportar} disabled={!productos.length}><Download size={16} aria-hidden="true" /> Exportar CSV</button>
            </div>
            <div className="vs-table-wrap"><table>
              <thead><tr><th>SKU</th><th>Producto</th><th>Almacén</th><th className="num">Stock</th><th className="num">Mínimo</th><th>Estado</th></tr></thead>
              <tbody>{productos.map(p => <tr key={p.id}>
                <td>{p.sku}</td><td><strong>{p.nombre}</strong></td><td>{nombreAlmacen(p.almacen_id)}</td>
                <td className="num"><span className="celda-stock">{p.stock}<span className="barra-stock" aria-hidden="true"><i className={enUmbral(p) ? 'bajo' : ''} style={{ width: `${porcentajeStock(p)}%` }} /></span></span></td>
                <td className="num">{p.umbral}</td>
                <td><span className={enUmbral(p) ? 'vs-tag warn' : 'vs-tag'}>{enUmbral(p) ? 'Reponer' : 'Disponible'}</span></td>
              </tr>)}</tbody>
            </table>{!productos.length && <p className="vs-empty"><Boxes size={28} aria-hidden="true" />{datos.productos.length ? 'Ningún producto coincide con la búsqueda.' : 'Aún no hay productos. Regístralos abajo o importa un CSV.'}</p>}</div>
            <div className="dos-columnas">
              <section className="tarjeta">
                <div className="tarjeta-titulo"><h2>Nuevo producto</h2></div>
                <form className="vs-form-grid" onSubmit={e => guardar(e, 'producto', 'Producto registrado.')}>
                  <label>Empresa<select name="empresa" required>{empresas}</select></label>
                  <label>Almacén<select name="almacen" required>{datos.almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre} · {datos.empresas.find(e => e.id === a.empresa_id)?.nombre}</option>)}</select></label>
                  <label>SKU<input name="sku" required maxLength={80} placeholder="LALI-001" /></label>
                  <label>Nombre<input name="nombre" required maxLength={160} placeholder="Tomatodo 750 ml" /></label>
                  <label>Stock inicial<input name="stock" type="number" min="0" step="1" required /></label>
                  <button disabled={busy}>Registrar producto</button>
                </form>
              </section>
              <ImportarInventario empresas={datos.empresas} almacenes={datos.almacenes} alTerminar={cargar} />
            </div>
          </>}

          {actual.id === 'Movimientos' && <>
            <ConteoVivo productos={datos.productos} almacenes={datos.almacenes} empresas={datos.empresas} alTerminar={cargar} />
            <section className="tarjeta">
              <div className="tarjeta-titulo"><h2>Registrar entrada o salida</h2></div>
              <form className="vs-form-grid" onSubmit={e => guardar(e, 'movimiento', 'Movimiento registrado y stock actualizado.')}>
                <label>Producto<select name="producto" required>{datos.productos.map(p => <option key={p.id} value={p.id}>{p.sku} · {p.nombre}</option>)}</select></label>
                <label>Tipo<select name="sentido"><option value="entrada">Entrada</option><option value="salida">Salida</option></select></label>
                <label>Cantidad<input name="cantidad" type="number" min="1" step="1" required /></label>
                <button disabled={busy}>Guardar movimiento</button>
              </form>
            </section>
            <div className="vs-section-title"><h2>Historial</h2><span>{recientes.length} movimientos · hora de Lima</span></div>
            <TablaMovimientos movimientos={recientes} productos={datos.productos} />
            <MovimientosVideo productos={datos.productos} almacenes={datos.almacenes} alTerminar={cargar} />
          </>}

          {actual.id === 'Administración' && esAdmin && <div className="vs-admin-grid">
            <section><h2>Nueva empresa</h2><form onSubmit={e => guardar(e, 'empresa', 'Empresa creada.')}><label>Razón social<input name="nombre" minLength={2} maxLength={150} required /></label><button disabled={busy}>Crear empresa</button></form></section>
            <section><h2>Nuevo almacén</h2><form onSubmit={e => guardar(e, 'almacen', 'Almacén creado.')}><label>Empresa<select name="empresa" required>{empresas}</select></label><label>Nombre<input name="nombre" required /></label><label>Dirección<input name="direccion" /></label><button disabled={busy}>Crear almacén</button></form></section>
            <section><h2>Asignar cliente</h2><form onSubmit={e => guardar(e, 'asignar', 'Cliente asignado a su empresa.')}><label>Empresa<select name="empresa" required>{empresas}</select></label><label>Correo<input type="email" name="email" required /></label><button disabled={busy}>Asignar a empresa</button></form><small>La persona entra primero con Google o se crea su cuenta en Supabase → Authentication → Users. Aquí asignas ese correo a su empresa; no se envía una invitación.</small></section>
            <section><h2>Horario laboral</h2><form onSubmit={guardarHorario}>
              <label>Empresa<select name="empresa" required value={empresaHorario || datos.empresas[0]?.id || ''} onChange={e => setEmpresaHorario(e.target.value)}>{empresas}</select></label>
              <label>Zona (opcional)<select name="zona" key={empresaHorario || datos.empresas[0]?.id}><option value="">Horario general de la empresa</option>{zonasDeEmpresa(zonas, empresaHorario || datos.empresas[0]?.id || '').map(z => <option key={z.id} value={z.id}>{nombreAlmacen(z.almacen_id)} · {z.nombre}</option>)}</select></label>
              <fieldset><legend>Días laborales</legend><div className="dias">{DIAS.map(([v, l]) => <label key={v}><input type="checkbox" checked={diasHorario.includes(v)} onChange={e => setDiasHorario(e.target.checked ? [...diasHorario, v] : diasHorario.filter(d => d !== v))} /> {l}</label>)}</div></fieldset>
              <div className="dos-columnas" style={{ gap: 12 }}><label>Inicio<input name="inicio" type="time" defaultValue="07:00" required /></label><label>Fin<input name="fin" type="time" defaultValue="19:00" required /></label></div>
              <button disabled={busy}>Guardar horario</button>
            </form><small>Sin zona, aplica a toda la empresa; con zona, la sobreescribe solo ahí. Lo que se mueva fuera de estos días u horas (hora de Lima) queda marcado como fuera de horario, sin bloquearse.</small></section>
            <section><h2>Feriados</h2><form onSubmit={e => guardar(e, 'feriado', 'Feriado agregado.')}><label>Empresa<select name="empresa" required>{empresas}</select></label><label>Fecha<input name="fecha" type="date" required /></label><label>Descripción<input name="descripcion" maxLength={160} /></label><button disabled={busy}>Agregar feriado</button></form>
              {!!datos.feriados.length && <ul className="vs-empty">{datos.feriados.map(f => <li key={f.id}>{f.fecha} · {datos.empresas.find(e => e.id === f.empresa_id)?.nombre} · {f.descripcion}</li>)}</ul>}</section>
          </div>}
        </>}
      </main>
    </div>
  </div>;
}

function TablaMovimientos({ movimientos, productos }: { movimientos: Movimiento[]; productos: Producto[] }) {
  return <div className="vs-table-wrap"><table className="tabla-apilada">
    <thead><tr><th>Fecha y hora</th><th>Producto</th><th>Tipo</th><th className="num">Cantidad</th></tr></thead>
    <tbody>{movimientos.map(m => { const p = productos.find(x => x.id === m.producto_id); return <tr key={m.id}>
      <td>{fecha(m.creado_en)}</td>
      <td><strong>{p?.nombre || 'Producto'}</strong>{p && <small style={{ color: 'var(--gris)' }}> · {p.sku}</small>}</td>
      <td><span className="tipo-celda"><span className={`sentido ${m.sentido}`}>{m.sentido === 'entrada' ? <ArrowDownLeft size={16} aria-hidden="true" /> : <ArrowUpRight size={16} aria-hidden="true" />}{m.sentido === 'entrada' ? 'Entrada' : 'Salida'}</span>{m.fuera_de_horario && <span className="vs-tag alerta">Fuera de horario</span>}</span></td>
      <td className="num">{m.cantidad}</td>
    </tr>; })}</tbody>
  </table>{!movimientos.length && <p className="vs-empty"><ArrowLeftRight size={28} aria-hidden="true" />Aún no hay movimientos registrados.</p>}</div>;
}

// SCRUM-26: movimientos marcados fuera de horario (vs_alertas_horario), con su foto si la tiene.
function AlertasHorario({ empresas, productos }: { empresas: Empresa[]; productos: Producto[] }) {
  const [alertas, setAlertas] = useState<Movimiento[]>([]), [cargando, setCargando] = useState(true), [error, setError] = useState('');
  async function cargar() {
    setCargando(true);
    try {
      const db = supabaseBrowser(); const rr = await Promise.all(empresas.map(e => db.rpc('vs_alertas_horario', { empresa: e.id })));
      if (rr.some(r => r.error)) throw new Error('No se pudieron cargar las alertas de horario.');
      setAlertas((rr.flatMap(r => r.data || []) as Movimiento[]).sort((a, b) => b.creado_en.localeCompare(a.creado_en))); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las alertas de horario.'); }
    finally { setCargando(false); }
  }
  useEffect(() => { void cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    <div className="vs-section-title"><h2>Movimientos fuera de horario</h2><button className="export-button" onClick={() => void cargar()}><RefreshCw size={16} aria-hidden="true" /> Actualizar</button></div>
    {error && <p role="alert" className="csv-errors">{error}</p>}
    <div className="vs-table-wrap"><table>
      <thead><tr><th>Fecha y hora</th><th>Producto</th><th>Tipo</th><th className="num">Cantidad</th><th>Evidencia</th></tr></thead>
      <tbody>{alertas.map(m => <tr key={m.id}>
        <td>{fecha(m.creado_en)}</td><td><strong>{productos.find(p => p.id === m.producto_id)?.nombre || 'Producto'}</strong></td>
        <td><span className="vs-tag alerta">{m.sentido === 'entrada' ? 'Entrada' : 'Salida'}</span></td><td className="num">{m.cantidad}</td>
        <td>{m.foto_evidencia ? <button className="text-button" onClick={async () => { try { window.open(await verEvidencia(m.foto_evidencia as string), '_blank', 'noopener'); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir la evidencia.'); } }}>Ver foto</button> : <span style={{ color: 'var(--gris)' }}>Sin evidencia</span>}</td>
      </tr>)}</tbody>
    </table>{!alertas.length && !cargando && <p className="vs-empty"><Bell size={28} aria-hidden="true" />No hay movimientos fuera de horario.</p>}</div>
  </>;
}
