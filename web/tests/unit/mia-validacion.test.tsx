import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { validacion as v } from "@/app/validacion/data";
import Validacion from "@/app/validacion/page";
import Inicio from "@/app/page";

const entrevistas = readFileSync(resolve(process.cwd(), "../docs/entrevistas.md"), "utf8");
// Las fuentes usan comillas dobles o simples para la misma palabra citada.
const normalizar = (s: string) => s.replace(/[“”«»‘’"']/g, "").replace(/\s+/g, " ").trim();

describe("SCRUM-58 · unitarias de validación", () => {
  it("TU-01: el número de entrevistas coincide con el registro documental", () => {
    const cantidad = entrevistas.match(/Entrevistas realizadas:\*\*\s*(\d+)/);
    expect(cantidad).not.toBeNull();
    expect(v.entrevistas).toBe(Number(cantidad![1]));
    expect(v.entrevistas).toBeGreaterThan(0);
  });
  it("TU-02: los hallazgos tienen título, cita y autor únicos", () => {
    expect(v.hallazgos.length).toBeGreaterThan(0);
    expect(new Set(v.hallazgos.map(h => h.titulo)).size).toBe(v.hallazgos.length);
    for (const h of v.hallazgos) for (const valor of [h.titulo, h.cita, h.autor]) expect(valor.trim()).not.toBe("");
  });
  it("TU-03: los autores están documentados y forman parte del perfil", () => {
    for (const h of v.hallazgos) {
      expect(entrevistas).toContain(h.autor);
      expect(v.perfil).toContain(h.autor);
    }
  });
  it("TU-04: cada hipótesis tiene tipo único y estado permitido", () => {
    expect(new Set(v.hipotesis.map(h => h.tipo)).size).toBe(v.hipotesis.length);
    for (const h of v.hipotesis) {
      expect(h.tipo.trim()).not.toBe("");
      expect(h.texto.trim()).not.toBe("");
      expect(["validada", "en validación", "no validada"]).toContain(h.estado);
    }
  });
  it("TU-05: POV y decisión indican la necesidad y su carácter provisional", () => {
    expect(v.pov).toMatch(/necesita/);
    expect(v.pov).toMatch(/porque/);
    expect(v.decision).toMatch(/borrador.*confirmar con el equipo/);
  });
});

describe("SCRUM-58 · integración de página, datos y documentos", () => {
  it("TI-01: presenta el número de entrevistas y el perfil", () => {
    render(<Validacion />);
    expect(screen.getByText(`${v.entrevistas} entrevistas · ${v.perfil}`)).toBeInTheDocument();
  });
  it("TI-02: muestra cada hallazgo con su cita y autor", () => {
    render(<Validacion />);
    for (const h of v.hallazgos) {
      const articulo = screen.getByRole("heading", { name: h.titulo }).closest("article")!;
      expect(normalizar(articulo.textContent!)).toContain(normalizar(h.cita));
      expect(within(articulo).getByText(`— ${h.autor}`)).toBeInTheDocument();
    }
  });
  it("TI-03: las citas publicadas coinciden con las entrevistas", () => {
    render(<Validacion />);
    for (const h of v.hallazgos) {
      expect(normalizar(entrevistas)).toContain(normalizar(h.cita));
      expect(normalizar(screen.getByRole("heading", { name: h.titulo }).closest("article")!.textContent!)).toContain(normalizar(h.cita));
    }
  });
  it("TI-04: presenta POV, hipótesis, estados y decisión desde los datos", () => {
    render(<Validacion />);
    expect(screen.getByText(v.pov)).toBeInTheDocument();
    expect(screen.getByText(v.decision)).toBeInTheDocument();
    for (const h of v.hipotesis) {
      const fila = screen.getByText(`${h.tipo}:`).closest("li")!;
      expect(fila).toHaveTextContent(h.texto);
      expect(within(fila).getByText(h.estado)).toBeInTheDocument();
    }
  });
});

describe("SCRUM-58 · funcionales de Inicio en DOM (no E2E)", () => {
  it("TF-01: presenta propuesta de valor y pasos", () => {
    render(<Inicio />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tu almacén, contado y con prueba.");
    for (const paso of ["Cuenta", "Guarda la prueba", "Compara"]) expect(screen.getByRole("heading", { name: paso, exact: true })).toBeInTheDocument();
  });
  it("TF-02: muestra cifras y atribución de fuentes", () => {
    render(<Inicio />);
    for (const cifra of ["65 %", "S/ 700 M+", "52 %"]) expect(screen.getByText(cifra)).toBeInTheDocument();
    expect(screen.getByText(/Fuentes: DeHoratius y Raman/)).toHaveTextContent("ISEG");
  });
  it("TF-03: muestra instalación y mensualidad", () => {
    render(<Inicio />);
    expect(screen.getByText("S/ 1,200")).toBeInTheDocument();
    expect(screen.getByText("S/ 250 al mes")).toBeInTheDocument();
  });
  it("TF-04: los accesos apuntan al panel y a una sección de piloto existente", () => {
    render(<Inicio />);
    expect(screen.getByRole("link", { name: "Ver el panel" })).toHaveAttribute("href", "/dashboard");
    const acceso = screen.getByRole("link", { name: "Solicitar un piloto" });
    expect(acceso).toHaveAttribute("href", "#piloto");
    expect(document.querySelector(acceso.getAttribute("href")!)).toContainElement(screen.getByRole("button", { name: "Solicitar piloto" }));
  });
  it("TF-05: no permite enviar el formulario vacío", async () => {
    render(<Inicio />);
    for (const campo of ["Nombre", "Empresa", "Teléfono"]) expect(screen.getByPlaceholderText(campo)).toBeRequired();
    await userEvent.click(screen.getByRole("button", { name: "Solicitar piloto" }));
    expect(screen.queryByText(/¡Gracias!/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nombre")).toBeInvalid();
  });
  it("TF-06: con datos completos muestra confirmación visual y retira el formulario", async () => {
    render(<Inicio />);
    const user = userEvent.setup();
    for (const [campo, texto] of [["Nombre", "Usuario de prueba"], ["Empresa", "Empresa de prueba"], ["Teléfono", "000000000"]]) await user.type(screen.getByPlaceholderText(campo), texto);
    await user.click(screen.getByRole("button", { name: "Solicitar piloto" }));
    expect(screen.getByText(/¡Gracias! Recibimos tu solicitud/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Solicitar piloto" })).not.toBeInTheDocument();
    // El componente solo cambia su estado local; este caso no acredita persistencia ni envío.
  });
});
