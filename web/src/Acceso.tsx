// Acceso a la plataforma. SCRUM-78: rediseño con la identidad de la landing; la lógica de
// sesión (correo, Google con retorno seguro y doble factor en el portal) no cambia.
import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import MarcoAcceso from './landing/MarcoAcceso';
import { supabaseBrowser } from './lib/supabase';
import { destinoGoogle, errorDeRetorno } from './lib/acceso-google';

export default function Acceso() {
  const [mensaje, setMensaje] = useState(''), [cargando, setCargando] = useState(false);

  // SCRUM-75: al volver de Google, Supabase deja la sesión en la URL; si hay sesión pasamos al portal.
  useEffect(() => {
    const error = errorDeRetorno(window.location.href);
    if (error) { setMensaje(error); window.history.replaceState(null, '', window.location.pathname); return; }
    supabaseBrowser().auth.getSession().then(({ data }) => { if (data.session) window.location.assign('/portal'); }).catch(() => {});
  }, []);

  async function conGoogle() {
    setCargando(true); setMensaje('');
    try {
      const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: destinoGoogle(window.location.origin), queryParams: { prompt: 'select_account' } } });
      if (error) { setMensaje('No pudimos conectar con Google. Inténtalo de nuevo.'); setCargando(false); }
    } catch { setMensaje('El acceso con Google no está disponible ahora.'); setCargando(false); }
  }

  async function conCorreo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setCargando(true); setMensaje('');
    const f = new FormData(e.currentTarget);
    try {
      const { error } = await supabaseBrowser().auth.signInWithPassword({ email: String(f.get('email')), password: String(f.get('password')) });
      if (error) setMensaje('No pudimos iniciar sesión. Revisa tu correo y contraseña.');
      else window.location.assign('/portal');
    } catch { setMensaje('El acceso está pendiente de configuración. Contacta al administrador.'); }
    finally { setCargando(false); }
  }

  return <MarcoAcceso>
    <h1>Entra a tu almacén</h1>
    <p className="acceso-intro">Usa tu cuenta de Google o el correo que registró tu administrador.</p>
    <button type="button" className="acceso-google" onClick={conGoogle} disabled={cargando}>Continuar con Google</button>
    <p className="acceso-separador"><span>o con tu correo</span></p>
    <form onSubmit={conCorreo} className="acceso-form">
      <label>Correo de trabajo<input name="email" type="email" autoComplete="username" placeholder="nombre@empresa.com" required /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
      {mensaje && <p className="acceso-aviso" role="alert">{mensaje}</p>}
      <button className="acceso-principal" disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
    </form>
    <a className="acceso-secundario" href="/recuperar"><KeyRound size={18} aria-hidden="true" /> Recuperar contraseña</a>
    <p className="acceso-nota">¿Primera vez? Entra con Google y pide a tu administrador que te asigne a tu empresa. Hasta entonces, por seguridad, no verás ningún dato.</p>
  </MarcoAcceso>;
}
