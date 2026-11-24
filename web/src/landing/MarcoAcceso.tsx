// SCRUM-78 · Marco común de /acceso y /recuperar: a la izquierda la cámara en vivo (la misma
// simulación de la portada), a la derecha el formulario. Misma identidad que la landing.
import { useState, type ReactNode } from 'react';
import { ArrowLeft, ScanLine } from 'lucide-react';
import '@fontsource-variable/archivo/wdth.css';
import '../acceso.css';
import Simulacion, { type Resumen } from './Simulacion';

const GARANTIAS = ['Cada empresa ve solo sus datos', 'Verificación en dos pasos opcional', 'Evidencia en cada movimiento'];

export default function MarcoAcceso({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [quieto] = useState(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  return <div className="vs-acceso">
    <aside className="acceso-camara" aria-label="Lo que hace VisioStock">
      <a className="acceso-marca" href="/"><span className="acceso-ojo" aria-hidden="true"><ScanLine size={20} /></span>VisioStock</a>
      <div className="acceso-visor">
        <div className="acceso-pantalla"><Simulacion escenario="conteo" pausado={quieto} alCambiar={setDatos} /></div>
        <dl className="acceso-cifras">
          <div><dt>Entradas</dt><dd>{datos?.entradas ?? 0}</dd></div>
          <div><dt>Salidas</dt><dd>{datos?.salidas ?? 0}</dd></div>
          <div><dt>Stock</dt><dd>{datos?.stock ?? 120}</dd></div>
        </dl>
      </div>
      <p className="acceso-lema">Tu inventario, visto en tiempo real.</p>
      <ul className="acceso-garantias">{GARANTIAS.map(g => <li key={g}>{g}</li>)}</ul>
    </aside>
    <main className="acceso-panel">
      <a className="acceso-volver" href="/"><ArrowLeft size={16} aria-hidden="true" /> Volver al inicio</a>
      <a className="acceso-marca acceso-marca-movil" href="/"><span className="acceso-ojo" aria-hidden="true"><ScanLine size={20} /></span>VisioStock</a>
      <div className="acceso-contenido">{children}</div>
    </main>
  </div>;
}
