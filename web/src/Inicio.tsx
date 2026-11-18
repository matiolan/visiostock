// SCRUM-76 · Página de inicio: simulación de la cámara, menú interactivo y diseño responsive.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Pause, Play, ScanLine, X } from 'lucide-react';
import '@fontsource-variable/archivo/wdth.css';
import './inicio.css';
import Simulacion, { type Resumen } from './landing/Simulacion';
import { anclaValida, seccionActiva } from './lib/navegacion';
import type { Escenario } from './lib/simulacion';

const SECCIONES = [
  { id: 'simulacion', texto: 'Simulación' },
  { id: 'funciona', texto: 'Cómo funciona' },
  { id: 'seguridad', texto: 'Seguridad' },
  { id: 'preguntas', texto: 'Preguntas' },
];

const ESCENARIOS: { id: Escenario; texto: string; detalle: string }[] = [
  { id: 'conteo', texto: 'Conteo', detalle: 'Cada caja que cruza la línea suma una entrada o una salida, y el stock se actualiza solo.' },
  { id: 'fuera', texto: 'Fuera de horario', detalle: 'Son las 18:57. Desde las 19:00, cualquier caja que se mueva queda marcada como alerta para el gerente.' },
  { id: 'manipulacion', texto: 'Manipulación', detalle: 'Si una caja se cae de la faja, la cámara lo detecta y lo registra antes de que llegue al conteo.' },
];

const PASOS = [
  ['Registra tu inventario', 'Crea tus almacenes y zonas, y carga tus productos desde un archivo CSV. Cada empresa trabaja en su propio espacio.'],
  ['La cámara observa', 'Graba o sube un video del muelle de carga. El servicio de visión reconoce las cajas y su código, cuadro por cuadro.'],
  ['VisioStock cuenta y compara', 'Las cajas que cruzan la línea se registran como entradas o salidas, y el conteo se contrasta con el stock del sistema.'],
  ['Revisas la evidencia', 'Las diferencias, caídas y movimientos fuera de horario llegan a Alertas con su foto, listas para que decidas.'],
];

const CONTROLES = [
  ['Cada empresa ve solo lo suyo', 'Las reglas de acceso de la base de datos separan los datos por empresa. Una cuenta nueva no ve nada hasta que el administrador la asigna.'],
  ['Verificación en dos pasos', 'Activa Google Authenticator en tu cuenta. Sin el código de 6 dígitos no se leen ni se cambian datos, ni siquiera llamando a la API.'],
  ['Entra con Google', 'Usa tu cuenta de Google en lugar de otra contraseña más que recordar.'],
  ['Revisado en cada cambio', 'Cada cambio pasa por análisis de código, revisión de dependencias, búsqueda de secretos y pruebas de las reglas de acceso antes de publicarse.'],
];

const PREGUNTAS = [
  ['¿Cómo accedo al inventario de mi empresa?', 'Entra con la cuenta que te asignó el administrador o regístrate con Google y pídele que te asigne a tu empresa.'],
  ['¿Puedo cargar el inventario que ya tengo?', 'Sí. En Inventario puedes importar un CSV con SKU, nombre y stock inicial; la vista previa marca los errores antes de guardar.'],
  ['¿La cámara reconoce cualquier producto?', 'Reconoce las clases para las que se entrenó el modelo (hoy, cajas) y lee códigos QR o de barras. Si no puede leer el código, el movimiento queda para revisión manual con su foto.'],
  ['¿Una diferencia cambia el stock automáticamente?', 'No. La verificación deja evidencia y una alerta. Los ajustes se registran como entradas o salidas para que todo quede trazable.'],
];

export default function Inicio() {
  const [menu, setMenu] = useState(false);
  const [activa, setActiva] = useState<string | null>(null);
  const [escenario, setEscenario] = useState<Escenario>('conteo');
  const [pausado, setPausado] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [paso, setPaso] = useState(0);
  const enlaces = useRef<Record<string, HTMLAnchorElement | null>>({});
  const indicador = useRef<HTMLSpanElement>(null);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pasos = useRef<(HTMLLIElement | null)[]>([]);

  // Sección activa y paso visible según el desplazamiento.
  useEffect(() => {
    let pendiente = 0;
    const revisar = () => {
      pendiente = 0;
      const y = window.scrollY;
      setActiva(seccionActiva(SECCIONES.map(s => ({ id: s.id, top: (document.getElementById(s.id)?.getBoundingClientRect().top ?? Infinity) + y })), y));
      const mitad = y + window.innerHeight * 0.55;
      let p = 0;
      pasos.current.forEach((el, i) => { if (el && el.getBoundingClientRect().top + y <= mitad) p = i; });
      setPaso(p);
    };
    const alDesplazar = () => { if (!pendiente) pendiente = requestAnimationFrame(revisar); };
    revisar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', alDesplazar);
    return () => { window.removeEventListener('scroll', alDesplazar); window.removeEventListener('resize', alDesplazar); cancelAnimationFrame(pendiente); };
  }, []);

  // La línea bajo el menú se desliza hasta el enlace activo.
  useEffect(() => {
    const el = activa ? enlaces.current[activa] : null, barra = indicador.current;
    if (!barra) return;
    if (!el) { barra.style.opacity = '0'; return; }
    barra.style.opacity = '1';
    barra.style.width = `${el.offsetWidth}px`;
    barra.style.transform = `translateX(${el.offsetLeft}px)`;
  }, [activa]);

  // Menú de celular: Escape lo cierra, el foco entra y vuelve al botón, y la página no se desplaza detrás.
  useEffect(() => {
    if (!menu) return;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('nav a')?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenu(false); botonMenu.current?.focus(); }
      if (e.key === 'Tab' && panel.current) { // el foco no sale del panel mientras está abierto
        const focos = [...panel.current.querySelectorAll<HTMLElement>('a,button')];
        const primero = focos[0], ultimo = focos[focos.length - 1];
        if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
      }
    };
    document.addEventListener('keydown', tecla);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', tecla); };
  }, [menu]);

  const ir = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const id = anclaValida(e.currentTarget.getAttribute('href') ?? '');
    const destino = id ? document.getElementById(id) : null;
    if (!destino) return;
    e.preventDefault();
    setMenu(false);
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: destino.getBoundingClientRect().top + window.scrollY - 72, behavior: suave ? 'smooth' : 'auto' });
    history.replaceState(null, '', `#${id}`);
  }, []);

  const actual = ESCENARIOS.find(x => x.id === escenario)!;

  return <div className="vs-home">
    <a className="saltar" href="#simulacion" onClick={ir}>Saltar al contenido</a>
    <header className="barra">
      <a className="marca" href="/" aria-label="VisioStock, inicio"><span className="marca-ojo" aria-hidden="true"><ScanLine size={20} /></span>VisioStock</a>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(s => <a key={s.id} href={`#${s.id}`} onClick={ir} ref={el => { enlaces.current[s.id] = el; }} aria-current={activa === s.id ? 'true' : undefined}>{s.texto}</a>)}
        <span className="menu-linea" ref={indicador} aria-hidden="true" />
      </nav>
      <a className="boton boton-claro barra-entrar" href="/acceso">Entrar</a>
      <button ref={botonMenu} className="menu-boton" onClick={() => setMenu(true)} aria-expanded={menu} aria-controls="menu-movil" aria-label="Abrir menú"><Menu size={22} /></button>
    </header>

    <div id="menu-movil" ref={panel} className={menu ? 'panel abierto' : 'panel'} role="dialog" aria-modal="true" aria-label="Menú" hidden={!menu}>
      <button className="panel-cerrar" onClick={() => { setMenu(false); botonMenu.current?.focus(); }} aria-label="Cerrar menú"><X size={24} /></button>
      <nav aria-label="Secciones del menú">
        {SECCIONES.map((s, i) => <a key={s.id} href={`#${s.id}`} onClick={ir} style={{ '--i': i } as React.CSSProperties} aria-current={activa === s.id ? 'true' : undefined}>{s.texto}</a>)}
      </nav>
      <a className="boton boton-senal" href="/acceso">Entrar a mi empresa</a>
    </div>

    <main>
      <section className="portada">
        <div className="portada-texto">
          <h1>Cada caja que cruza la línea, contada.</h1>
          <p>VisioStock mira tu muelle de carga: reconoce las cajas, cuenta las entradas y salidas, y te avisa cuando algo se mueve fuera de horario o se cae.</p>
          <div className="acciones">
            <a className="boton boton-senal" href="/acceso">Entrar a mi empresa</a>
            <a className="boton boton-linea" href="#funciona" onClick={ir}>Ver cómo funciona</a>
          </div>
        </div>

        <div id="simulacion" className="visor">
          <div className="visor-controles">
            <div role="tablist" aria-label="Escenarios de la simulación" className="escenarios">
              {ESCENARIOS.map(x => <button key={x.id} role="tab" aria-selected={escenario === x.id} aria-controls="visor-panel" onClick={() => setEscenario(x.id)}>{x.texto}</button>)}
            </div>
            <button className="pausa" onClick={() => setPausado(p => !p)} aria-pressed={pausado}>{pausado ? <><Play size={16} /> Reproducir</> : <><Pause size={16} /> Pausar</>}</button>
          </div>
          <div id="visor-panel" role="tabpanel" className="visor-cuerpo">
            <div className="visor-pantalla"><Simulacion escenario={escenario} pausado={pausado} alCambiar={setDatos} /></div>
            <aside className="tablero" aria-label="Lo que registra VisioStock">
              <p className="tablero-detalle">{actual.detalle}</p>
              <dl className="cifras">
                <div><dt>Entradas</dt><dd>{datos?.entradas ?? 0}</dd></div>
                <div><dt>Salidas</dt><dd>{datos?.salidas ?? 0}</dd></div>
                <div><dt>Stock</dt><dd>{datos?.stock ?? 120}</dd></div>
                <div className={datos?.alertas ? 'con-alerta' : ''}><dt>Alertas</dt><dd>{datos?.alertas ?? 0}</dd></div>
              </dl>
              <ol className="registro" aria-label="Últimos eventos">
                {(datos?.eventos ?? []).map(ev => <li key={ev.id} className={ev.tipo}><time>{ev.reloj}</time>{ev.texto}</li>)}
              </ol>
            </aside>
          </div>
          <p className="visor-nota">Simulación ilustrativa con datos ficticios. En VisioStock el conteo sale de los videos que subes en Movimientos.</p>
        </div>
      </section>

      <section id="funciona" className="seccion funciona">
        <h2>Cómo funciona</h2>
        <ol className="pasos" style={{ '--avance': (paso + 1) / PASOS.length } as React.CSSProperties}>
          {PASOS.map(([titulo, texto], i) => <li key={titulo} ref={el => { pasos.current[i] = el; }} className={i <= paso ? 'hecho' : ''}>
            <span className="paso-num" aria-hidden="true">{i + 1}</span>
            <div><h3>{titulo}</h3><p>{texto}</p></div>
          </li>)}
        </ol>
      </section>

      <section id="seguridad" className="seccion seguridad">
        <div className="seguridad-intro">
          <h2>Tus datos, solo para tu empresa</h2>
          <p>Seguridad pensada para un almacén real: quién entra, qué ve y cómo se revisa cada cambio del sistema.</p>
        </div>
        <ul className="controles">
          {CONTROLES.map(([titulo, texto]) => <li key={titulo}><h3>{titulo}</h3><p>{texto}</p></li>)}
        </ul>
      </section>

      <section id="preguntas" className="seccion preguntas">
        <h2>Preguntas frecuentes</h2>
        <div>{PREGUNTAS.map(([p, r]) => <details key={p}><summary>{p}</summary><p>{r}</p></details>)}</div>
      </section>

      <section className="cierre">
        <h2>Tu próximo conteo, con evidencia.</h2>
        <a className="boton boton-senal" href="/acceso">Entrar a mi empresa</a>
      </section>
    </main>

    <footer className="pie">
      <a className="marca" href="/"><span className="marca-ojo" aria-hidden="true"><ScanLine size={18} /></span>VisioStock</a>
      <p>Gestión de inventario con visión artificial. Proyecto de USIL, 2026.</p>
      <a href="/acceso">Acceso a la plataforma</a>
    </footer>
  </div>;
}
