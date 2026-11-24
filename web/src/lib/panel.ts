// SCRUM-79 · Secciones del panel, su dirección (#inventario) y el cálculo del umbral de stock.
export type Vista = 'Resumen' | 'Inventario' | 'Movimientos' | 'Verificación visual' | 'Alertas' | 'Manipulación' | 'Cámaras y zonas' | 'Reportes' | 'Seguridad' | 'Administración';
export type Grupo = 'Operación' | 'Vigilancia' | 'Gestión';

export const VISTAS: { id: Vista; grupo: Grupo; descripcion: string; soloAdmin?: boolean }[] = [
  { id: 'Resumen', grupo: 'Operación', descripcion: 'Lo más importante de tu almacén: stock, alertas y últimos movimientos.' },
  { id: 'Inventario', grupo: 'Operación', descripcion: 'Productos y stock por almacén. Registra productos o impórtalos desde un CSV.' },
  { id: 'Movimientos', grupo: 'Operación', descripcion: 'Entradas y salidas registradas a mano o detectadas en video.' },
  { id: 'Verificación visual', grupo: 'Operación', descripcion: 'Toma una foto, cuenta las cajas y compáralas con el stock registrado.' },
  { id: 'Alertas', grupo: 'Vigilancia', descripcion: 'Diferencias de stock y movimientos fuera de horario que alguien debe revisar.' },
  { id: 'Manipulación', grupo: 'Vigilancia', descripcion: 'Caídas, golpes y pilas demasiado altas detectadas en video.' },
  { id: 'Cámaras y zonas', grupo: 'Vigilancia', descripcion: 'Zonas de cada almacén y las cámaras que las vigilan.' },
  { id: 'Reportes', grupo: 'Gestión', descripcion: 'Reporte semanal de mermas y discrepancias, listo para Excel o PDF.' },
  { id: 'Seguridad', grupo: 'Gestión', descripcion: 'Protege tu cuenta con la verificación en dos pasos.' },
  { id: 'Administración', grupo: 'Gestión', descripcion: 'Empresas, almacenes, clientes, horarios laborales y feriados.', soloAdmin: true },
];

const slug = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// El Resumen no lleva ancla; el resto sí, para que al recargar o compartir el enlace se abra la misma vista.
export function hashDeVista(v: Vista) { return v === 'Resumen' ? '' : `#${slug(v)}`; }

export function vistaDesdeHash(hash: string): Vista {
  let buscado = hash.replace(/^#/, '');
  try { buscado = decodeURIComponent(buscado); } catch { return 'Resumen'; }
  return VISTAS.find(v => slug(v.id) === buscado)?.id ?? 'Resumen';
}

export const enUmbral = (p: { stock: number; umbral: number }) => p.stock <= p.umbral;

// Qué tan lleno está el producto respecto al doble de su mínimo (0–100), para la barra de stock.
export function porcentajeStock(p: { stock: number; umbral: number }) {
  const referencia = Math.max(p.umbral * 2, 1);
  return Math.max(0, Math.min(100, Math.round((p.stock / referencia) * 100)));
}
