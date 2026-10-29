import type { Metadata } from "next";
import TimelineCliente from "./TimelineCliente";

export const metadata: Metadata = {
  title: "Movimientos · VisioStock",
  description: "Línea de tiempo de los movimientos del almacén con la galería de evidencias de cada uno.",
};

export default function MovimientosPage() {
  return <TimelineCliente />;
}
