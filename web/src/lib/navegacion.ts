// SCRUM-76 · Menú de la portada: qué sección está a la vista y validación de anclas.
// Lógica pura para poder probarla en el pipeline.

export type Seccion = { id: string; top: number };

/**
 * Devuelve la sección activa: la última cuyo inicio ya quedó por encima de la línea de lectura
 * (desplazamiento + alto de la barra fija). Antes de la primera sección no hay ninguna activa.
 */
export function seccionActiva(secciones: Seccion[], desplazamiento: number, barra = 80): string | null {
  const linea = desplazamiento + barra + 1;
  let activa: string | null = null;
  for (const s of [...secciones].sort((a, b) => a.top - b.top)) {
    if (s.top <= linea) activa = s.id; else break;
  }
  return activa;
}

/** Solo se aceptan anclas internas simples (#seccion): evita navegar a URLs inyectadas. */
export function anclaValida(href: string): string | null {
  return /^#[a-z][a-z0-9-]{0,40}$/.test(href) ? href.slice(1) : null;
}
