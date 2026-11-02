export type FilaImportacion = { sku: string; nombre: string; stock: number };
export type VistaCSV = { filas: FilaImportacion[]; errores: string[] };

// Admite CSV separado por coma o punto y coma, comillas escapadas y saltos dentro de celdas.
export function leerInventarioCSV(texto: string): VistaCSV {
  const errores: string[] = [];
  const input = texto.replace(/^\uFEFF/, '');
  let comillas = false, comas = 0, puntos = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') { if (comillas && input[i + 1] === '"') i++; else comillas = !comillas; }
    if (!comillas && (c === '\n' || c === '\r')) break;
    if (!comillas && c === ',') comas++;
    if (!comillas && c === ';') puntos++;
  }
  const separador = puntos > comas ? ';' : ',';
  const registros: string[][] = [];
  let fila: string[] = [], celda = '', abierta = false, cerrada = false;
  const guardarCelda = () => { fila.push(celda); celda = ''; cerrada = false; };
  const guardarFila = () => { guardarCelda(); if (fila.some(c => c.trim())) registros.push(fila); fila = []; };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (abierta) {
      if (c === '"') { if (input[i + 1] === '"') { celda += '"'; i++; } else { abierta = false; cerrada = true; } }
      else celda += c;
    } else if (c === separador) guardarCelda();
    else if (c === '\n' || c === '\r') { guardarFila(); if (c === '\r' && input[i + 1] === '\n') i++; }
    else if (c === '"' && !celda && !cerrada) abierta = true;
    else if (c === '"' || (cerrada && c.trim())) return { filas: [], errores: ['El CSV contiene comillas o separadores incorrectos.'] };
    else if (!cerrada) celda += c;
  }
  if (abierta) return { filas: [], errores: ['Hay una celda con comillas sin cerrar.'] };
  if (celda || fila.length || cerrada) guardarFila();
  if (registros.length < 2) return { filas: [], errores: ['El archivo debe tener encabezados y al menos un producto.'] };
  const cabecera = registros.shift()!.map(c => c.trim().toLowerCase());
  if (new Set(cabecera).size !== cabecera.length) return { filas: [], errores: ['Hay encabezados repetidos.'] };
  const sku = cabecera.indexOf('sku');
  const nombre = cabecera.indexOf('nombre') >= 0 ? cabecera.indexOf('nombre') : cabecera.indexOf('producto');
  const stock = cabecera.indexOf('stock_inicial') >= 0 ? cabecera.indexOf('stock_inicial') : cabecera.indexOf('stock');
  if (sku < 0 || nombre < 0 || stock < 0) return { filas: [], errores: ['Faltan columnas. Usa sku,nombre,stock_inicial o SKU,Producto,Stock.'] };
  if (registros.length > 500) return { filas: [], errores: ['El máximo por importación es de 500 productos.'] };
  const vistos = new Set<string>();
  const filas: FilaImportacion[] = [];
  registros.forEach((r, i) => {
    const n = i + 2, s = (r[sku] || '').trim(), nom = (r[nombre] || '').trim(), valor = (r[stock] || '').trim();
    if (r.length !== cabecera.length) { errores.push(`Registro ${n}: número de columnas incorrecto.`); return; }
    if (!s || s.length > 80 || !nom || nom.length > 160) { errores.push(`Registro ${n}: SKU o nombre vacío o demasiado largo.`); return; }
    if (!/^\d+$/.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) > 2147483647) { errores.push(`Registro ${n}: el stock debe ser un entero entre 0 y 2147483647.`); return; }
    if (vistos.has(s)) { errores.push(`Registro ${n}: SKU repetido (${s}).`); return; }
    vistos.add(s); filas.push({ sku: s, nombre: nom, stock: Number(valor) });
  });
  return { filas, errores };
}
