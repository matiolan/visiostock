import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TimelineCliente from "@/app/movimientos/TimelineCliente";

// Integración: la página de la línea de tiempo con la capa de datos real (en modo ejemplo, sin Supabase).
describe("HU-13 · línea de tiempo integrada con la capa de datos (SCRUM-56)", () => {
  it("carga los movimientos y los agrupa por día", async () => {
    render(<TimelineCliente />);
    expect(await screen.findByText(/movimientos · ↓/)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Mostrando datos de ejemplo/)).toBeInTheDocument();
  });

  it("el filtro de zona deja solo movimientos de esa zona", async () => {
    render(<TimelineCliente />);
    await screen.findByText(/movimientos · ↓/);
    fireEvent.change(screen.getByLabelText("Zona"), { target: { value: "B" } });
    const tarjetas = screen.getAllByRole("button", { name: /Zona/ });
    expect(tarjetas.length).toBeGreaterThan(0);
    for (const t of tarjetas) expect(within(t).getByText(/Zona B/)).toBeInTheDocument();
  });

  it("al hacer clic en una miniatura abre la galería en esa posición", async () => {
    render(<TimelineCliente />);
    await screen.findByText(/movimientos · ↓/);
    fireEvent.click(screen.getAllByRole("button", { name: /Zona/ })[0]);
    const galeria = screen.getByRole("dialog", { name: "Galería de evidencias" });
    expect(within(galeria).getByText(/^1 de \d+$/)).toBeInTheDocument();
  });

  it("pagina de 60 en 60 con el botón Ver más", async () => {
    render(<TimelineCliente />);
    await screen.findByText(/movimientos · ↓/);
    const total = Number(screen.getByText(/movimientos · ↓/).textContent!.split(" ")[0]);
    const visibles = screen.getAllByRole("button", { name: /Zona/ }).length;
    expect(visibles).toBe(Math.min(total, 60));
    if (total > 60) {
      fireEvent.click(screen.getByRole("button", { name: /Ver más/ }));
      expect(screen.getAllByRole("button", { name: /Zona/ }).length).toBe(Math.min(total, 120));
    }
  });
});
