// SCRUM-74: si la cuenta tiene doble factor, pide el código antes de mostrar el portal.
// La base de datos también lo exige (10_doble_factor.sql): esta pantalla solo guía al usuario.
import { useEffect, useState, type ReactNode } from 'react';
import { supabaseBrowser } from './lib/supabase';
import { factorActivo, mensajeError, normalizarCodigo, requiereCodigo } from './lib/doble-factor';

export default function PuertaDobleFactor({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<'revisando' | 'codigo' | 'listo'>('revisando');
  const [mensaje, setMensaje] = useState(''), [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vigente = true;
    supabaseBrowser().auth.mfa.getAuthenticatorAssuranceLevel()
      .then(({ data, error }) => { if (vigente) setEstado(!error && data && requiereCodigo(data) ? 'codigo' : 'listo'); })
      .catch(() => { if (vigente) setEstado('listo'); }); // sin sesión: el portal redirige a /acceso
    return () => { vigente = false; };
  }, []);

  async function verificar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMensaje('');
    const codigo = normalizarCodigo(String(new FormData(e.currentTarget).get('codigo') ?? ''));
    if (!codigo) { setMensaje('Escribe los 6 dígitos que muestra tu app de autenticación.'); return; }
    setEnviando(true);
    try {
      const db = supabaseBrowser();
      const { data: lista, error: errLista } = await db.auth.mfa.listFactors();
      const factor = errLista ? null : factorActivo(lista.all);
      if (!factor) { setMensaje(mensajeError(errLista)); return; }
      const { error } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code: codigo });
      if (error) setMensaje(mensajeError(error)); else setEstado('listo');
    } catch (err) { setMensaje(mensajeError(err as { message?: string })); }
    finally { setEnviando(false); }
  }

  async function salir() { await supabaseBrowser().auth.signOut(); window.location.assign('/acceso'); }

  if (estado === 'revisando') return <main className="vs-recovery"><p role="status">Comprobando tu sesión…</p></main>;
  if (estado === 'listo') return <>{children}</>;
  return <main className="vs-recovery">
    <p className="vs-eyebrow">VERIFICACIÓN EN DOS PASOS</p>
    <h1>Ingresa tu código</h1>
    <p>Tu cuenta tiene activado el doble factor. Abre Google Authenticator (u otra app de autenticación) y escribe el código de 6 dígitos de VisioStock.</p>
    <form onSubmit={verificar}>
      <label>Código de 6 dígitos<input name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus /></label>
      <button disabled={enviando}>{enviando ? 'Verificando…' : 'Verificar y entrar →'}</button>
      <p role="status">{mensaje}</p>
    </form>
    <button type="button" className="vs-link-button" onClick={salir}>Cerrar sesión</button>
  </main>;
}
