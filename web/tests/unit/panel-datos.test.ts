import { describe, expect, it } from "vitest";
import { cargarPanel, datosDeEjemplo } from "@/lib/panel-datos";

describe("HU-12 · datos del panel de stock (SCRUM-50)", () => {
  it("el stock detectado es el inicial más entradas menos salidas", () => {
    const { resumen: r } = datosDeEjemplo("A", "prueba");
    expect(r.stock_detectado).toBe(r.stock_inicial + r.entradas - r.salidas);
  });

  it("la diferencia es lo detectado menos lo registrado", () => {
    const { resumen: r } = datosDeEjemplo("A", "prueba");
    expect(r.diferencia).toBe(r.stock_detectado - r.stock_registrado);
  });

  it("los últimos movimientos son 20, de la zona pedida y del más reciente al más antiguo", () => {
    const d = datosDeEjemplo("B", "prueba");
    expect(d.movimientos).toHaveLength(20);
    expect(d.movimientos.every((m) => m.zona === "B")).toBe(true);
    const t = d.movimientos.map((m) => new Date(m.detectado_en).getTime());
    expect([...t].sort((a, b) => b - a)).toEqual(t);
  });

  it("cada movimiento tiene foto de evidencia, sentido y confianza válida", () => {
    for (const m of datosDeEjemplo("A", "prueba").movimientos) {
      expect(m.foto_url).toBeTruthy();
      expect(["entrada", "salida"]).toContain(m.sentido);
      expect(m.confianza).toBeGreaterThan(0);
      expect(m.confianza).toBeLessThanOrEqual(1);
    }
  });

  it("sin conexión a Supabase cae a datos de ejemplo e informa el motivo", async () => {
    const d = await cargarPanel("A");
    expect(d.esEjemplo).toBe(true);
    expect(d.motivoEjemplo).toMatch(/Supabase/);
  });
});
