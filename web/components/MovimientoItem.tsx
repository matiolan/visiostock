/* eslint-disable @next/next/no-img-element */
import type { Movimiento } from "@/lib/panel-datos";

export function formatoHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

export function formatoFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

interface Props {
  movimiento: Movimiento;
  onAbrir: (m: Movimiento) => void;
}

export default function MovimientoItem({ movimiento: m, onAbrir }: Props) {
  const entrada = m.sentido === "entrada";
  return (
    <li>
      <button
        type="button"
        onClick={() => onAbrir(m)}
        className="flex w-full items-center gap-4 rounded-lg p-2 text-left transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
      >
        <span
          aria-hidden
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
            entrada ? "bg-[#4FA3A5]/20 text-[#7CC8CA]" : "bg-[#E8833A]/20 text-[#F3B07A]"
          }`}
        >
          {entrada ? "↓" : "↑"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-white">
            {entrada ? "Entrada" : "Salida"} · {m.cantidad} {m.cantidad === 1 ? "caja" : "cajas"}
          </span>
          <span className="block text-sm text-[#9AA5B4]">
            {formatoHora(m.detectado_en)}
            {m.confianza != null && ` · confianza ${Math.round(m.confianza * 100)} %`}
          </span>
        </span>
        {m.foto_url ? (
          <img
            src={m.foto_url}
            alt={`Evidencia de ${m.sentido}`}
            className="h-12 w-20 shrink-0 rounded-md border border-white/10 object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-white/15 text-xs text-[#5B6676]">
            Sin foto
          </span>
        )}
      </button>
    </li>
  );
}
