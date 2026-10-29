import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GaleriaModal from "@/components/GaleriaModal";
import type { Movimiento } from "@/lib/panel-datos";

const movs: Movimiento[] = [0, 1, 2].map((i) => ({
  id: `m${i}`,
  zona: "A",
  sentido: i === 1 ? "entrada" : "salida",
  cantidad: i + 1,
  confianza: 0.95,
  foto_url: `/demo/evidencia.svg?${i}`,
  detectado_en: `2026-10-27T1${i}:00:00-05:00`,
}));

function montar(indice: number | null) {
  const onCambiar = vi.fn();
  const onCerrar = vi.fn();
  render(<GaleriaModal movimientos={movs} indice={indice} onCambiar={onCambiar} onCerrar={onCerrar} />);
  return { onCambiar, onCerrar };
}

describe("HU-13 · galería de evidencias (SCRUM-55)", () => {
  it("no muestra nada si no hay una evidencia seleccionada", () => {
    montar(null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("muestra la imagen ampliada con su posición en la galería", () => {
    montar(1);
    expect(screen.getByRole("dialog", { name: "Galería de evidencias" })).toBeInTheDocument();
    expect(screen.getByText("2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "/demo/evidencia.svg?1");
    expect(screen.getByText(/Entrada · Zona A/)).toBeInTheDocument();
  });

  it("la flecha derecha pasa a la siguiente y la izquierda a la anterior", () => {
    const { onCambiar } = montar(1);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onCambiar).toHaveBeenNthCalledWith(1, 2);
    expect(onCambiar).toHaveBeenNthCalledWith(2, 0);
  });

  it("no sale de los límites en la primera y la última evidencia", () => {
    const primera = montar(0);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(primera.onCambiar).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Evidencia anterior" })).toBeDisabled();
  });

  it("Escape y el botón Cerrar cierran la galería", () => {
    const { onCerrar } = montar(2);
    expect(screen.getByRole("button", { name: "Evidencia siguiente" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });
});
