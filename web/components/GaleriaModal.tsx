"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect } from "react";
import type { Movimiento } from "@/lib/panel-datos";
import { formatoFecha, formatoHora } from "./MovimientoItem";

interface Props {
  movimientos: Movimiento[];
  indice: number | null;
  onCambiar: (indice: number) => void;
  onCerrar: () => void;
}

/** Visor de evidencias con navegación anterior/siguiente (flechas del teclado). */
export default function GaleriaModal({ movimientos, indice, onCambiar, onCerrar }: Props) {
  const total = movimientos.length;
  const abierto = indice !== null && indice >= 0 && indice < total;

  useEffect(() => {
    if (!abierto || indice === null) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      else if (e.key === "ArrowLeft" && indice > 0) onCambiar(indice - 1);
      else if (e.key === "ArrowRight" && indice < total - 1) onCambiar(indice + 1);
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [abierto, indice, total, onCambiar, onCerrar]);

  if (!abierto || indice === null) return null;
  const m = movimientos[indice];
  const entrada = m.sentido === "entrada";

  const botonNav =
    "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Galería de evidencias"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onCerrar}
    >
      <div className="flex w-full max-w-3xl items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Evidencia anterior"
          className={botonNav}
          disabled={indice === 0}
          onClick={() => onCambiar(indice - 1)}
        >
          ‹
        </button>

        <div className="min-w-0 flex-1 overflow-hidden rounded-xl bg-[#1A2332] shadow-2xl">
          {m.foto_url ? (
            <img
              src={m.foto_url}
              alt={`Evidencia de ${m.sentido} del ${formatoFecha(m.detectado_en)}`}
              className="max-h-[60vh] w-full bg-black object-contain"
            />
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
            <div className="text-right">
              <p className="text-sm text-[#9AA5B4]">
                {indice + 1} de {total}
              </p>
              <button
                type="button"
                onClick={onCerrar}
                className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Evidencia siguiente"
          className={botonNav}
          disabled={indice === total - 1}
          onClick={() => onCambiar(indice + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
