import type { Metadata } from "next";
import PanelCliente from "./PanelCliente";

export const metadata: Metadata = {
  title: "Panel · VisioStock",
  description: "Stock registrado frente al stock detectado por la cámara, con la evidencia de cada movimiento.",
};

export default function DashboardPage() {
  return <PanelCliente />;
}
