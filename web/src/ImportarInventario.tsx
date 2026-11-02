import { useState } from 'react';
import { leerInventarioCSV, type VistaCSV } from './lib/csv-inventario';
import { importarProductos } from './lib/importar-productos';

type Empresa = { id: string; nombre: string };
type Almacen = Empresa & { empresa_id: string };
export default function ImportarInventario({ empresas, almacenes, alTerminar }: { empresas: Empresa[]; almacenes: Almacen[]; alTerminar: () => Promise<void> }) {
  const [empresa, setEmpresa] = useState(empresas[0]?.id || '');
  const [almacen, setAlmacen] = useState('');
  const [vista, setVista] = useState<VistaCSV | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [archivo, setArchivo] = useState('');
  async function leer(file?: File) {
    setVista(null); setMensaje(''); setArchivo(file?.name || '');
    if (!file) return;
    if (file.size > 1024 * 1024) { setMensaje('El archivo no puede superar 1 MB.'); return; }
    setOcupado(true);
    try { setVista(leerInventarioCSV(await file.text())); }
    catch { setMensaje('No se pudo leer el archivo. Guárdalo como CSV UTF-8.'); }
    finally { setOcupado(false); }
  }
  function plantilla() {
    const url = URL.createObjectURL(new Blob(['\uFEFFsku,nombre,stock_inicial\r\nLALI-001,Tomatodo 750 ml,60\r\n'], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_inventario.csv'; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="csv-import"><div className="vs-section-title"><h2>Importar inventario CSV</h2><button className="export-button" onClick={plantilla}>Descargar plantilla</button></div>
    <p>Selecciona la empresa y su almacén. Solo se agregarán productos nuevos; no se reemplazará el stock existente.</p>
    <div className="csv-fields"><label>Empresa<select disabled={ocupado} value={empresa} onChange={e => { setEmpresa(e.target.value); setAlmacen(''); setMensaje(''); }}>{empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label>
      <label>Almacén de destino<select disabled={ocupado} value={almacen} onChange={e => { setAlmacen(e.target.value); setMensaje(''); }}><option value="">Selecciona un almacén</option>{almacenes.filter(a => a.empresa_id === empresa).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
      <label>Archivo CSV<input disabled={ocupado} type="file" accept=".csv,text/csv" onChange={e => void leer(e.target.files?.[0])} /></label></div>
    <p className="csv-help">Máximo: 500 productos y 1 MB. Columnas: sku, nombre y stock_inicial. También acepta SKU, Producto, Stock. En el CSV de Lali se utiliza stock_inicial; zona y stock_registrado no se importan. Todos los productos se guardan en el almacén seleccionado.</p>
    {vista && <><p><strong>{archivo}</strong> · {vista.filas.length} productos válidos · {vista.errores.length} errores.</p>
      {vista.errores.length > 0 && <div className="csv-errors" role="alert"><strong>Corrige todos los errores antes de importar:</strong><ul>{vista.errores.slice(0,20).map((e,i) => <li key={i}>{e}</li>)}</ul>{vista.errores.length > 20 && <p>Se muestran los primeros 20 errores.</p>}</div>}
      {!!vista.filas.length && <div className="vs-table-wrap"><table><thead><tr><th>SKU</th><th>Producto</th><th>Stock inicial</th></tr></thead><tbody>{vista.filas.slice(0,20).map(p => <tr key={p.sku}><td>{p.sku}</td><td>{p.nombre}</td><td>{p.stock}</td></tr>)}</tbody></table>{vista.filas.length>20 && <p className="csv-help">Vista previa de los primeros 20 productos.</p>}</div>}
      <button disabled={ocupado || !empresa || !almacen || !vista.filas.length || !!vista.errores.length} onClick={async () => {
        if (!vista || ocupado) return; setOcupado(true); setMensaje('');
        try { const n = await importarProductos(empresa, almacen, vista.filas); setVista(null); await alTerminar(); setMensaje(`Importación completada: ${n} productos guardados.`); }
        catch(e) { setMensaje(e instanceof Error ? e.message : 'No se pudo guardar el inventario.'); }
        finally { setOcupado(false); }
      }}>{ocupado ? 'Procesando…' : `Importar ${vista.filas.length} productos`}</button></>}
    <p className="status" role="status">{mensaje}</p></section>;
}
