// SCRUM-75 · HU-SEG-02: registro e inicio de sesión con Google (OAuth 2.0 vía Supabase Auth).
// Lógica pura (sin red) para poder probarla en el pipeline.

const LOCALES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** URL a la que Google/Supabase devuelven al usuario. Siempre nuestro propio origen y la ruta /acceso. */
export function destinoGoogle(origen: string): string {
  const u = new URL(origen);
  const seguro = u.protocol === 'https:' || (u.protocol === 'http:' && LOCALES.has(u.hostname));
  if (!seguro || u.username || u.password) throw new Error('Origen no permitido para el inicio con Google.');
  return `${u.origin}/acceso`;
}

/** Si Google o Supabase devolvieron un error en la URL de retorno, lo traduce a un mensaje claro. */
export function errorDeRetorno(href: string): string | null {
  const u = new URL(href);
  const p = new URLSearchParams(u.hash.replace(/^#/, ''));
  for (const [k, v] of u.searchParams) if (!p.has(k)) p.set(k, v);
  const error = p.get('error'), detalle = `${p.get('error_code') ?? ''} ${p.get('error_description') ?? ''}`.toLowerCase();
  if (!error) return null;
  if (error === 'access_denied' && !detalle.includes('signup')) return 'Cancelaste el inicio de sesión con Google.';
  if (detalle.includes('signup') || detalle.includes('sign up')) return 'El registro con Google todavía no está habilitado. Contacta al administrador.';
  return 'No pudimos iniciar sesión con Google. Inténtalo de nuevo.';
}

/** Mensaje para una cuenta recién creada (por ejemplo con Google) que aún no pertenece a ninguna empresa. */
export function mensajeSinEmpresa(correo: string | undefined): string {
  return `Tu cuenta${correo ? ` (${correo})` : ''} ya está creada, pero todavía no tiene una empresa asignada. `
    + 'Pide al administrador de VisioStock que te asigne desde Administración → Asignar cliente. Por seguridad, hasta entonces no verás ningún dato.';
}
