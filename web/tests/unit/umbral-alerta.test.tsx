import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import PanelCliente from "@/app/dashboard/PanelCliente";

// Sin variables de Supabase el panel usa datos de ejemplo con diferencia de −8 cajas.
describe("HU-15 · alerta por umbral configurable (SCRUM-25)", () => {
  beforeEach(() => window.localStorage.clear());

  it("con el umbral por defecto (3) marca la diferencia de −8 como alerta", async () => {
    render(<PanelCliente />);
    expect(await screen.findByText("Revisar evidencias ↓")).toBeInTheDocument();
    expect(screen.getByText("−8")).toBeInTheDocument();
  });

  it("si el umbral sube a 10 la alerta desaparece y el valor se recuerda", async () => {
    render(<PanelCliente />);
    await screen.findByText("Revisar evidencias ↓");
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "10" } });
    expect(screen.queryByText("Revisar evidencias ↓")).toBeNull();
    expect(window.localStorage.getItem("visiostock.umbral")).toBe("10");
  });

  it("el umbral nunca baja de 1", async () => {
    render(<PanelCliente />);
    await screen.findByText("Revisar evidencias ↓");
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "0" } });
    expect(screen.getByRole("spinbutton")).toHaveValue(1);
  });
});
