"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect } from "react";
import type { Movimiento } from "@/lib/panel-datos";
import { formatoFecha, formatoHora } from "./MovimientoItem";

interface Props {
  movimiento: Movimiento | null;
  onCerrar: () => void;
}

export default function EvidenciaModal({ movimiento: m, onCerrar }: Props) {
  useEffect(() => {
    if (!m) return;
    const alPresionar = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [m, onCerrar]);

  if (!m) return null;
  const entrada = m.sentido === "entrada";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Evidencia del movimiento"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl bg-[#1A2332] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {m.foto_url ? (
          <img src={m.foto_url} alt={`Evidencia de ${m.sentido}`} className="max-h-[60vh] w-full bg-black object-contain" />
        ) : (
          <div className="flex h-56 items-center justify-center text-[#9AA5B4]">Este movimiento no tiene foto</div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <p className={`text-sm font-bold uppercase tracking-widest ${entrada ? "text-[#7CC8CA]" : "text-[#E8833A]"}`}>
              {entrada ? "Entrada" : "Salida"} · Zona {m.zona}
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {m.cantidad} {m.cantidad === 1 ? "caja" : "cajas"}
            </p>
            <p className="mt-1 text-[#9AA5B4]">
              {formatoFecha(m.detectado_en)}, {formatoHora(m.detectado_en)}
              {m.confianza != null && ` · confianza ${Math.round(m.confianza * 100)} %`}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
