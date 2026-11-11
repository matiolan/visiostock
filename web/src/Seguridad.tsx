// SCRUM-74 · HU-SEG-01: activar o desactivar el doble factor (TOTP) de la cuenta.
import { useEffect, useState } from 'react';
import { supabaseBrowser } from './lib/supabase';
import { factorActivo, factoresPendientes, mensajeError, nombreFactor, normalizarCodigo, type Factor } from './lib/doble-factor';

type Alta = { factorId: string; qr: string; secreto: string };

export default function Seguridad() {
  const [activo, setActivo] = useState<Factor | null>(null), [alta, setAlta] = useState<Alta | null>(null);
  const [cargando, setCargando] = useState(true), [ocupado, setOcupado] = useState(false), [mensaje, setMensaje] = useState('');

  async function cargar() {
    const { data, error } = await supabaseBrowser().auth.mfa.listFactors();
    if (error) setMensaje(mensajeError(error)); else setActivo(factorActivo(data.all));
    setCargando(false);
  }
  useEffect(() => { void cargar(); }, []);

  async function empezar() {
    setOcupado(true); setMensaje('');
    try {
      const db = supabaseBrowser();
      const { data: lista } = await db.auth.mfa.listFactors();
      for (const f of factoresPendientes(lista?.all ?? [])) await db.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: nombreFactor(), issuer: 'VisioStock' });
      if (error || !data) { setMensaje(mensajeError(error)); return; }
      setAlta({ factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret });
    } finally { setOcupado(false); }
  }

  async function confirmar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!alta) return; setMensaje('');
    const codigo = normalizarCodigo(String(new FormData(e.currentTarget).get('codigo') ?? ''));
    if (!codigo) { setMensaje('Escribe los 6 dígitos que muestra tu app.'); return; }
    setOcupado(true);
    try {
      const { error } = await supabaseBrowser().auth.mfa.challengeAndVerify({ factorId: alta.factorId, code: codigo });
      if (error) { setMensaje(mensajeError(error)); return; }
      setAlta(null); await cargar();
      setMensaje('Doble factor activado. Desde ahora te pediremos el código cada vez que inicies sesión.');
    } finally { setOcupado(false); }
  }

  async function cancelar() {
    if (alta) await supabaseBrowser().auth.mfa.unenroll({ factorId: alta.factorId });
    setAlta(null); setMensaje('');
  }

  async function desactivar() {
    if (!activo || !window.confirm('¿Desactivar el doble factor? Tu cuenta quedará protegida solo por tu contraseña o tu cuenta de Google.')) return;
    setOcupado(true); setMensaje('');
    try {
      const { error } = await supabaseBrowser().auth.mfa.unenroll({ factorId: activo.id });
      if (error) { setMensaje(mensajeError(error)); return; }
      await supabaseBrowser().auth.refreshSession(); await cargar();
      setMensaje('Doble factor desactivado.');
    } finally { setOcupado(false); }
  }

  if (cargando) return <p className="status" role="status">Cargando…</p>;
  return <div className="vs-seguridad">
    <div className="vs-section-title"><h2>Verificación en dos pasos (doble factor)</h2>
      <span className={activo ? 'vs-tag' : 'vs-tag warn'}>{activo ? 'ACTIVADO' : 'DESACTIVADO'}</span></div>
    <p className="csv-help">Además de tu contraseña o tu cuenta de Google, te pediremos un código de 6 dígitos que cambia cada 30 segundos.
      Funciona con Google Authenticator, Microsoft Authenticator, Authy y otras apps compatibles con TOTP.</p>
    {activo && <>
      <p>Activado el {activo.created_at ? new Date(activo.created_at).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : '—'} · {activo.friendly_name}</p>
      <button className="export-button" onClick={desactivar} disabled={ocupado}>Desactivar doble factor</button>
    </>}
    {!activo && !alta && <button onClick={empezar} disabled={ocupado}>{ocupado ? 'Preparando…' : 'Activar doble factor'}</button>}
    {alta && <div className="vs-doble-factor-alta">
      <ol>
        <li>Abre Google Authenticator y toca <b>+</b> → <b>Escanear un código QR</b>.</li>
        <li>Escanea este código (o escribe la clave a mano).</li>
        <li>Escribe el código de 6 dígitos que aparece en la app.</li>
      </ol>
      <img src={alta.qr} alt="Código QR para la app de autenticación" width={200} height={200} />
      <p className="csv-help">Clave para ingresar a mano: <code>{alta.secreto}</code></p>
      <form className="vs-form-grid" onSubmit={confirmar}>
        <label>Código de 6 dígitos<input name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus /></label>
        <button disabled={ocupado}>Confirmar y activar</button>
        <button type="button" onClick={cancelar} disabled={ocupado}>Cancelar</button>
      </form>
    </div>}
    <p role="status" className="status">{mensaje}</p>
  </div>;
}
