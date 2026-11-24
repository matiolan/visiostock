// Configurar o recuperar la contraseña. SCRUM-78: mismo marco que /acceso y dos pasos claros:
// pedir el enlace por correo y, al abrir ese enlace, escribir la contraseña nueva.
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import MarcoAcceso from './landing/MarcoAcceso';
import { supabaseBrowser } from './lib/supabase';

export default function Recuperar() {
  // Supabase deja type=recovery en la URL cuando se abre el enlace del correo.
  const [nueva, setNueva] = useState(() => /type=recovery/.test(window.location.hash));
  const [mensaje, setMensaje] = useState(''), [listo, setListo] = useState(false), [cargando, setCargando] = useState(false);

  useEffect(() => {
    try {
      const { data } = supabaseBrowser().auth.onAuthStateChange(evento => { if (evento === 'PASSWORD_RECOVERY') setNueva(true); });
      return () => data.subscription.unsubscribe();
    } catch { return undefined; }
  }, []);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setCargando(true); setMensaje('');
    const f = new FormData(e.currentTarget);
    try {
      const db = supabaseBrowser();
      if (nueva) {
        const { error } = await db.auth.updateUser({ password: String(f.get('password')) });
        if (error) setMensaje('El enlace venció o no es válido. Pide uno nuevo.'); else setListo(true);
      } else {
        await db.auth.resetPasswordForEmail(String(f.get('email')), { redirectTo: window.location.origin + '/recuperar' });
        setListo(true);
      }
    } catch { setMensaje('El servicio no está disponible ahora. Inténtalo más tarde.'); }
    finally { setCargando(false); }
  }

  return <MarcoAcceso>
    {nueva ? <>
      <h1>Crea tu contraseña</h1>
      <p className="acceso-intro">Usa al menos 12 caracteres. La necesitarás cuando entres con tu correo.</p>
    </> : <>
      <h1>Recupera tu acceso</h1>
      <p className="acceso-intro">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p>
    </>}
    {listo
      ? <div className="acceso-exito" role="status">
          {nueva
            ? <><p>Contraseña guardada.</p><a className="acceso-principal" href="/portal">Ir a mi almacén</a></>
            : <p>Si el correo tiene una cuenta, te llegará un enlace en unos minutos. Revisa también la carpeta de spam.</p>}
        </div>
      : <form onSubmit={enviar} className="acceso-form">
          {nueva
            ? <label>Contraseña nueva<input type="password" name="password" minLength={12} autoComplete="new-password" required /></label>
            : <label>Correo de trabajo<input type="email" name="email" autoComplete="username" placeholder="nombre@empresa.com" required /></label>}
          {mensaje && <p className="acceso-aviso" role="alert">{mensaje}</p>}
          <button className="acceso-principal" disabled={cargando}>{cargando ? 'Enviando…' : nueva ? 'Guardar contraseña' : 'Enviar enlace'}</button>
        </form>}
    <a className="acceso-secundario" href="/acceso"><ArrowLeft size={18} aria-hidden="true" /> Volver a iniciar sesión</a>
  </MarcoAcceso>;
}
