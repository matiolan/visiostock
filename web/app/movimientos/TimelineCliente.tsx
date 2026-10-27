"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import GaleriaModal from "@/components/GaleriaModal";
import { formatoHora } from "@/components/MovimientoItem";
import type { Movimiento } from "@/lib/panel-datos";
import {
  agruparPorDia,
  aplicarFiltros,
  cargarTimeline,
  filtrosPorDefecto,
  LIMITE_TIMELINE,
  type DatosTimeline,
  type FiltrosTimeline,
} from "@/lib/timeline-datos";

const POR_PAGINA = 60;

function tituloDia(dia: string) {
  const fecha = new Date(`${dia}T12:00:00`);
  const texto = fecha.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function TimelineCliente() {
  const [filtros, setFiltros] = useState<FiltrosTimeline>(filtrosPorDefecto);
  const [datos, setDatos] = useState<DatosTimeline | null>(null);
  const [cargando, setCargando] = useState(true);
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [indice, setIndice] = useState<number | null>(null);

  // El rango de fechas se consulta a la base de datos; sentido y zona se filtran en memoria.
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    cargarTimeline(filtros)
      .then((d) => vigente && setDatos(d))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.desde, filtros.hasta]);

  useEffect(() => setVisibles(POR_PAGINA), [filtros]);

  const filtrados = useMemo(() => aplicarFiltros(datos?.movimientos ?? [], filtros), [datos, filtros]);
  const mostrados = filtrados.slice(0, visibles);
  const grupos = useMemo(() => agruparPorDia(mostrados), [mostrados]);
  const posicion = useMemo(() => new Map(filtrados.map((m, i) => [m.id, i])), [filtrados]);

  const totales = useMemo(() => {
    let entradas = 0;
    let salidas = 0;
    for (const m of filtrados) {
      if (m.sentido === "entrada") entradas += m.cantidad;
      else salidas += m.cantidad;
    }
    return { entradas, salidas };
  }, [filtrados]);

  const cambiar = <K extends keyof FiltrosTimeline>(clave: K, valor: FiltrosTimeline[K]) =>
    setFiltros((f) => ({ ...f, [clave]: valor }));

  const abrir = useCallback((m: Movimiento) => setIndice(posicion.get(m.id) ?? null), [posicion]);
  const cerrar = useCallback(() => setIndice(null), []);

  const campo =
    "rounded-lg border border-white/10 bg-[#1A2332] px-3 py-2 text-sm text-white focus:border-[#E8833A] focus:outline-none";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-[#E8833A]">HU-13 · Trazabilidad</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Línea de tiempo de movimientos</h1>
          <p className="mt-2 max-w-2xl text-[#9AA5B4]">
            Cada entrada y salida detectada por la cámara, en orden cronológico y con su foto de evidencia.
            Haz clic en una miniatura para ampliarla y usa las flechas del teclado para recorrer la galería.
          </p>
        </div>
      </header>

      {datos?.esEjemplo && (
        <p className="mt-6 rounded-lg border border-[#E8833A]/30 bg-[#E8833A]/10 px-4 py-3 text-sm text-[#F3B07A]">
          Mostrando datos de ejemplo: {datos.motivoEjemplo}.
        </p>
      )}

      <section aria-label="Filtros" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl bg-[#141C28] p-4">
        <label className="flex flex-col gap-1 text-xs text-[#9AA5B4]">
          Desde
          <input
            type="date"
            className={campo}
            value={filtros.desde}
            max={filtros.hasta}
            onChange={(e) => e.target.value && cambiar("desde", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#9AA5B4]">
          Hasta
          <input
            type="date"
            className={campo}
            value={filtros.hasta}
            min={filtros.desde}
            onChange={(e) => e.target.value && cambiar("hasta", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#9AA5B4]">
          Sentido
          <select
            className={campo}
            value={filtros.sentido}
            onChange={(e) => cambiar("sentido", e.target.value as FiltrosTimeline["sentido"])}
          >
            <option value="todos">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="salida">Salidas</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#9AA5B4]">
          Zona
          <select className={campo} value={filtros.zona} onChange={(e) => cambiar("zona", e.target.value)}>
            <option value="todas">Todas</option>
            {(datos?.zonas ?? []).map((z) => (
              <option key={z} value={z}>
                Zona {z}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setFiltros(filtrosPorDefecto())}
          className="rounded-lg px-3 py-2 text-sm text-[#9AA5B4] hover:text-white"
        >
          Limpiar filtros
        </button>
        <p className="ml-auto text-sm text-[#9AA5B4]" aria-live="polite">
          {cargando
            ? "Cargando…"
            : `${filtrados.length} movimientos · ↓ ${totales.entradas} entradas · ↑ ${totales.salidas} salidas`}
        </p>
      </section>

      {datos && datos.movimientos.length >= LIMITE_TIMELINE && (
        <p className="mt-3 text-sm text-[#9AA5B4]">
          Se muestran los {LIMITE_TIMELINE} movimientos más recientes del rango. Acota las fechas para ver los demás.
        </p>
      )}

      {!cargando && filtrados.length === 0 && (
        <p className="mt-10 text-center text-[#9AA5B4]">No hay movimientos con estos filtros.</p>
      )}

      <ol className="mt-8 space-y-10">
        {grupos.map(([dia, movs]) => (
          <li key={dia}>
            <h2 className="sticky top-14 z-10 -mx-2 bg-[#0F1620]/95 px-2 py-2 text-lg font-semibold text-white backdrop-blur">
              {tituloDia(dia)} <span className="text-sm font-normal text-[#5B6676]">· {movs.length} movimientos</span>
            </h2>
            <ol className="relative mt-3 space-y-3 border-l border-white/10 pl-6">
              {movs.map((m) => {
                const entrada = m.sentido === "entrada";
                return (
                  <li key={m.id} className="relative">
                    <span
                      aria-hidden
                      className={`absolute -left-[31px] top-5 h-3 w-3 rounded-full ring-4 ring-[#0F1620] ${
                        entrada ? "bg-[#4FA3A5]" : "bg-[#E8833A]"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => abrir(m)}
                      className="flex w-full items-center gap-4 rounded-xl bg-[#141C28] p-3 text-left transition-colors hover:bg-[#1A2332] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8833A]"
                    >
                      {m.foto_url ? (
                        <img
                          src={m.foto_url}
                          alt={`Evidencia de ${m.sentido}`}
                          loading="lazy"
                          className="h-16 w-28 shrink-0 rounded-md border border-white/10 object-cover"
                        />
                      ) : (
                        <span className="flex h-16 w-28 shrink-0 items-center justify-center rounded-md border border-dashed border-white/15 text-xs text-[#5B6676]">
                          Sin foto
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm text-[#9AA5B4]">{formatoHora(m.detectado_en)}</span>
                        <span className="block font-medium text-white">
                          {entrada ? "Entrada" : "Salida"} · {m.cantidad} {m.cantidad === 1 ? "caja" : "cajas"}
                        </span>
                        <span className="block text-sm text-[#5B6676]">
                          Zona {m.zona}
                          {m.confianza != null && ` · confianza ${Math.round(m.confianza * 100)} %`}
                        </span>
                      </span>
                      <span
                        className={`hidden rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider sm:block ${
                          entrada ? "bg-[#4FA3A5]/15 text-[#7CC8CA]" : "bg-[#E8833A]/15 text-[#F3B07A]"
                        }`}
                      >
                        {entrada ? "↓ Entrada" : "↑ Salida"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>

      {visibles < filtrados.length && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setVisibles((v) => v + POR_PAGINA)}
            className="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            Ver más ({filtrados.length - visibles} restantes)
          </button>
        </div>
      )}

      <GaleriaModal movimientos={filtrados} indice={indice} onCambiar={setIndice} onCerrar={cerrar} />
    </main>
  );
}
