// SCRUM-79 · Supabase simulado para probar el panel sin tocar ninguna base real: una sesión de
// prueba en localStorage y respuestas fijas para https://ejemplo.supabase.co (URL del build de prueba).
const SUPABASE = 'https://ejemplo.supabase.co';
// ── Datos de ejemplo (ficticios) ──
const E = 'e1', A1 = 'a1', A2 = 'a2', U = 'u1';
const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const PRODUCTOS = [
  ['LALI-001', 'Tomatodo 750 ml', 60, 10], ['LALI-002', 'Taper hermético 1 L', 4, 8], ['LALI-003', 'Jarra medidora 500 ml', 32, 6],
  ['LALI-004', 'Set de cubiertos x24', 2, 5], ['LALI-005', 'Olla a presión 6 L', 14, 4], ['LALI-006', 'Sartén antiadherente 28 cm', 7, 6],
  ['LALI-007', 'Escurridor de platos', 21, 5], ['LALI-008', 'Termo acero 1 L', 3, 6], ['LALI-009', 'Tabla de picar bambú', 45, 8],
].map(([sku, nombre, stock, umbral], i) => ({ id: `p${i}`, empresa_id: E, almacen_id: i % 3 ? A1 : A2, sku, nombre, stock, umbral }));
const MOVIMIENTOS = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, producto_id: `p${i % 9}`, sentido: i % 3 ? 'salida' : 'entrada', cantidad: 1 + (i * 7) % 12, creado_en: hace(i * 5 + 1), fuera_de_horario: i === 2, foto_evidencia: null }));
const TABLAS = {
  vs_empresas: [{ id: E, nombre: 'Distribuidora Lali S.A.C.' }],
  vs_almacenes: [{ id: A1, empresa_id: E, nombre: 'Almacén Ate' }, { id: A2, empresa_id: E, nombre: 'Almacén Callao' }],
  vs_productos: PRODUCTOS, vs_movimientos: MOVIMIENTOS, vs_horarios_laborales: [], vs_feriados: [],
  vs_verificaciones: [
    { id: 'v1', producto_id: 'p1', empresa_id: E, stock_registrado: 6, conteo: 4, diferencia: -2, metodo: 'asistido', modelo: 'yolo11s-v2', clase: 'caja', evidencia: 'x.jpg', nota: 'Pasillo B', creado_en: hace(3), revisado_en: null },
    { id: 'v2', producto_id: 'p0', empresa_id: E, stock_registrado: 60, conteo: 60, diferencia: 0, metodo: 'manual', evidencia: 'y.jpg', nota: '', creado_en: hace(20), revisado_en: null },
  ],
  vs_incidencias: [{ id: 'i1', producto_id: 'p4', empresa_id: E, tipo: 'caida', origen: 'video', segundo: 4.2, confianza: .87, detalle: 'La caja cayó 1,4 alturas', creado_en: hace(6), revisado_en: null }],
  vs_zonas: [{ id: 'z1', empresa_id: E, almacen_id: A1, nombre: 'Recepción' }, { id: 'z2', empresa_id: E, almacen_id: A1, nombre: 'Despacho' }],
  vs_camaras: [{ id: 'c1', empresa_id: E, zona_id: 'z1', nombre: 'Puerta principal', activa: true, dispositivo: '' }],
  vs_movimientos_sin_sku: [],
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sesion(aal = 'aal1', factores = []) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: U, aud: 'authenticated', role: 'authenticated', email: 'jefe.almacen@lali.pe', app_metadata: {}, user_metadata: {}, factors: factores, created_at: hace(500) };
  const access_token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aal, amr: [{ method: 'password', timestamp: exp - 3600 }], exp, session_id: 's1' })}.${Buffer.from('firma de prueba').toString('base64url')}`;
  return { access_token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
}

export async function abrirPanel(navegador, DIRECCION, ancho, alto, { ruta = '/portal', factores = [] } = {}) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto } });
  const s = sesion('aal1', factores);
  await contexto.addInitScript(v => localStorage.setItem('sb-ejemplo-auth-token', v), JSON.stringify(s));
  await contexto.route(`${SUPABASE}/**`, ruta => {
    const url = new URL(ruta.request().url()), json = (cuerpo, h = {}) => ruta.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...h }, body: JSON.stringify(cuerpo) });
    if (url.pathname === '/auth/v1/user') return json(s.user);
    if (url.pathname.startsWith('/rest/v1/rpc/')) return json([]);
    const tabla = url.pathname.replace('/rest/v1/', '');
    if (tabla === 'vs_miembros') return json({ user_id: U, empresa_id: E, rol: 'cliente' });
    const filas = TABLAS[tabla] ?? [];
    return json(filas, { 'content-range': filas.length ? `0-${filas.length - 1}/${filas.length}` : '*/0' });
  });
  const pagina = await contexto.newPage(), errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  await pagina.goto(DIRECCION + ruta);
  return { pagina, errores, contexto };
}

