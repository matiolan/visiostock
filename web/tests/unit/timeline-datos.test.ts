import { afterEach, describe, expect, it, vi } from "vitest";
import type { Movimiento } from "@/lib/panel-datos";
import {
  agruparPorDia,
  aplicarFiltros,
  cargarTimeline,
  fechaLocal,
  filtrosPorDefecto,
  LIMITE_TIMELINE,
  timelineDeEjemplo,
} from "@/lib/timeline-datos";

function mov(id: string, detectado_en: string, sentido: "entrada" | "salida", zona = "A"): Movimiento {
  return { id, zona, sentido, cantidad: 1, confianza: 0.9, foto_url: null, detectado_en };
}

const lista: Movimiento[] = [
  mov("1", "2026-10-27T15:00:00-05:00", "salida", "A"),
  mov("2", "2026-10-27T09:30:00-05:00", "entrada", "B"),
  mov("3", "2026-10-26T18:10:00-05:00", "salida", "B"),
  mov("4", "2026-10-26T08:05:00-05:00", "entrada", "A"),
];

describe("HU-13 · consulta de movimientos (SCRUM-54)", () => {
  afterEach(() => vi.useRealTimers());

  it("formatea la fecha local como AAAA-MM-DD", () => {
    expect(fechaLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("propone por defecto los últimos 7 días con todos los sentidos y zonas", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00-05:00"));
    expect(filtrosPorDefecto()).toEqual({
      desde: "2026-10-22",
      hasta: "2026-10-28",
      sentido: "todos",
      zona: "todas",
    });
  });

  it("filtra por sentido", () => {
    const r = aplicarFiltros(lista, { desde: "", hasta: "", sentido: "entrada", zona: "todas" });
    expect(r.map((m) => m.id)).toEqual(["2", "4"]);
  });

  it("filtra por zona", () => {
    const r = aplicarFiltros(lista, { desde: "", hasta: "", sentido: "todos", zona: "B" });
    expect(r.map((m) => m.id)).toEqual(["2", "3"]);
  });

  it("combina sentido y zona", () => {
    const r = aplicarFiltros(lista, { desde: "", hasta: "", sentido: "salida", zona: "A" });
    expect(r.map((m) => m.id)).toEqual(["1"]);
  });

  it("agrupa por día local conservando el orden cronológico", () => {
    const grupos = agruparPorDia(lista);
    expect(grupos.map(([dia]) => dia)).toEqual(["2026-10-27", "2026-10-26"]);
    expect(grupos[0][1].map((m) => m.id)).toEqual(["1", "2"]);
    expect(grupos[1][1].map((m) => m.id)).toEqual(["3", "4"]);
  });

  it("filtra 1 000 movimientos en menos de 2 segundos (criterio de aceptación)", () => {
    const mil = Array.from({ length: LIMITE_TIMELINE }, (_, i) =>
      mov(String(i), new Date(Date.UTC(2026, 9, 20) + i * 60_000).toISOString(), i % 2 ? "entrada" : "salida", i % 3 ? "A" : "B"),
    );
    const t0 = performance.now();
    const r = aplicarFiltros(mil, { desde: "", hasta: "", sentido: "salida", zona: "A" });
    agruparPorDia(r);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(r.every((m) => m.sentido === "salida" && m.zona === "A")).toBe(true);
  });

  it("sin variables de Supabase devuelve datos de ejemplo dentro del rango pedido", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00-05:00"));
    const f = { desde: "2026-10-26", hasta: "2026-10-28", sentido: "todos" as const, zona: "todas" };
    const d = await cargarTimeline(f);
    expect(d.esEjemplo).toBe(true);
    expect(d.movimientos.length).toBeGreaterThan(0);
    const desde = new Date("2026-10-26T00:00:00-05:00").getTime();
    for (const m of d.movimientos) {
      const t = new Date(m.detectado_en).getTime();
      expect(t).toBeGreaterThanOrEqual(desde);
      expect(t).toBeLessThanOrEqual(Date.now());
    }
  });

  it("los datos de ejemplo vienen en orden cronológico descendente", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00-05:00"));
    const d = timelineDeEjemplo({ desde: "2026-10-27", hasta: "2026-10-28", sentido: "todos", zona: "todas" }, "prueba");
    const tiempos = d.movimientos.map((m) => new Date(m.detectado_en).getTime());
    expect([...tiempos].sort((a, b) => b - a)).toEqual(tiempos);
  });
});
