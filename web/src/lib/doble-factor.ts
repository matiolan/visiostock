// SCRUM-74 · HU-SEG-01: doble factor TOTP (Google Authenticator, Microsoft Authenticator, Authy…).
// Lógica pura (sin red) para poder probarla en el pipeline.

export type NivelSesion = string | null | undefined; // 'aal1' | 'aal2'
export type Factor = { id: string; factor_type: string; status: string; friendly_name?: string | null; created_at?: string };

/** Hay que pedir el código si la cuenta tiene un factor verificado y la sesión aún no lo usó. */
export function requiereCodigo(nivel: { currentLevel: NivelSesion; nextLevel: NivelSesion }): boolean {
  return nivel.currentLevel === 'aal1' && nivel.nextLevel === 'aal2';
}

/** Acepta "123456" o "123 456"; devuelve los 6 dígitos o null si no es un código válido. */
export function normalizarCodigo(texto: string): string | null {
  const limpio = texto.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(limpio) ? limpio : null;
}

export function factorActivo(factores: Factor[]): Factor | null {
  return factores.find(f => f.factor_type === 'totp' && f.status === 'verified') ?? null;
}

/** Factores TOTP que se crearon pero nunca se confirmaron: se borran antes de crear uno nuevo. */
export function factoresPendientes(factores: Factor[]): Factor[] {
  return factores.filter(f => f.factor_type === 'totp' && f.status !== 'verified');
}

/** Nombre único para la app de autenticación (Supabase rechaza nombres repetidos). */
export function nombreFactor(ahora: Date = new Date()): string {
  return `VisioStock ${ahora.toISOString().slice(0, 16).replace('T', ' ')}`;
}

/** Mensajes de error claros para el usuario, sin exponer detalles internos. */
export function mensajeError(error: { message?: string; code?: string } | null | undefined): string {
  const m = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();
  if (m.includes('invalid') || m.includes('mfa_verification_failed')) return 'El código no es correcto o ya venció. Escribe el código que muestra ahora tu app.';
  if (m.includes('aal2') || m.includes('insufficient_aal')) return 'Para hacer este cambio primero ingresa tu código de doble factor.';
  if (m.includes('rate') || m.includes('too many')) return 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.';
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}
