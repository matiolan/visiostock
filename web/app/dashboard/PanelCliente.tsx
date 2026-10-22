"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import KpiCard from "@/components/KpiCard";
import MovimientoItem from "@/components/MovimientoItem";
import EvidenciaModal from "@/components/EvidenciaModal";
import { cargarPanel, datosDeEjemplo, type DatosPanel, type Movimiento } from "@/lib/panel-datos";

const INTERVALO_MS = 5000;
const CLAVE_UMBRAL = "visiostock.umbral";

function leerUmbral(): number {
  try {
    const v = Number(window.localStorage.getItem(CLAVE_UMBRAL));
    return Number.isFinite(v) && v > 0 ? v : 3;
  } catch {
    return 3;
  }
}

function conSigno(n: number) {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

export default function PanelCliente() {
  const [zona, setZona] = useState("A");
  const [umbral, setUmbral] = useState(3);
  const [datos, setDatos] = useState<DatosPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ultima, setUltima] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [seleccion, setSeleccion] = useState<Movimiento | null>(null);
  const zonaRef = useRef(zona);

  useEffect(() => setUmbral(leerUmbral()), []);

  const actualizar = useCallback(async () => {
    const z = zonaRef.current;
    try {
      const d = await cargarPanel(z);
      if (zonaRef.current !== z) return;
      setDatos(d);
      setError(null);
    } catch {
      setDatos((prev) => prev ?? datosDeEjemplo(z, "No se pudo conectar con la base de datos"));
      setError("No se pudo actualizar. Se reintentará en unos segundos.");
    } finally {
      setUltima(Date.now());
    }
  }, []);

  useEffect(() => {
    zonaRef.current = zona;
    setDatos(null);
    actualizar();
    const id = window.setInterval(actualizar, INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [zona, actualizar]);

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const cambiarUmbral = (valor: number) => {
    const v = Math.max(1, Math.round(valor) || 1);
    setUmbral(v);
    try {
      window.localStorage.setItem(CLAVE_UMBRAL, String(v));
    } catch {
      /* el umbral solo se recuerda si el navegador lo permite */
    }
  };

  const r = datos?.resumen;
  const fueraDeUmbral = r ? Math.abs(r.diferencia) >= umbral : false;
  const segundos = ultima ? Math.max(0, Math.round((ahora - ultima) / 1000)) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#E8833A]">Panel de stock</p>
          <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">
            Lo registrado frente a lo que vio la cámara
          </h1>
        </div>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1 text-[#9AA5B4]">
            Zona
            <select
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#1A2332] px-3 py-2 text-white"
            >
              {(datos?.zonas ?? [zona]).map((z) => (
                <option key={z} value={z}>
                  Zona {z}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[#9AA5B4]">
            Alertar desde
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={umbral}
                onChange={(e) => cambiarUmbral(Number(e.target.value))}
                className="w-20 rounded-lg border border-white/10 bg-[#1A2332] px-3 py-2 text-white"
              />
              <span>cajas</span>
            </span>
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#9AA5B4]">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4FA3A5] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#4FA3A5]" />
          </span>
          {segundos == null ? "Cargando…" : `Actualizado hace ${segundos} s`}
        </span>
        {datos?.esEjemplo && (
          <span
            title={datos.motivoEjemplo}
            className="rounded-full border border-[#E8833A]/40 px-3 py-0.5 text-xs font-medium text-[#F3B07A]"
          >
            Datos de ejemplo · {datos.motivoEjemplo}
          </span>
        )}
        {error && <span className="text-[#F3B07A]">{error}</span>}
      </div>

      {!r ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-[#1A2332]" />
          ))}
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Resumen de stock">
            <KpiCard
              etiqueta="Según el sistema"
              valor={String(r.stock_registrado)}
              detalle="Stock registrado en el inventario"
            />
            <KpiCard
              etiqueta="Según la cámara"
              valor={String(r.stock_detectado)}
              detalle={`${r.stock_inicial} iniciales + ${r.entradas} entradas − ${r.salidas} salidas`}
            />
            <KpiCard
              etiqueta="Diferencia"
              valor={conSigno(r.diferencia)}
              detalle={r.diferencia === 0 ? "El inventario cuadra" : "Cajas detectadas menos registradas"}
              alerta={fueraDeUmbral}
              aviso={fueraDeUmbral ? "Revisar evidencias ↓" : undefined}
            />
          </section>

          <section className="mt-4 grid gap-4 sm:grid-cols-2" aria-label="Movimientos de hoy">
            <div className="flex items-center justify-between rounded-xl bg-[#1A2332] px-5 py-4">
              <span className="text-[#9AA5B4]">Entradas hoy</span>
              <span className="text-2xl font-bold tabular-nums text-[#7CC8CA]">{datos.entradasHoy}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[#1A2332] px-5 py-4">
              <span className="text-[#9AA5B4]">Salidas hoy</span>
              <span className="text-2xl font-bold tabular-nums text-[#F3B07A]">{datos.salidasHoy}</span>
            </div>
          </section>

          <section className="mt-6 rounded-xl bg-[#1A2332] p-5" aria-label="Últimos movimientos">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-white">Últimos movimientos</h2>
              <p className="text-sm text-[#9AA5B4]">Toca un movimiento para ver la foto de evidencia</p>
            </div>
            {datos.movimientos.length === 0 ? (
              <div className="mt-6 rounded-lg border border-dashed border-white/15 px-6 py-10 text-center">
                <p className="font-medium text-white">Todavía no hay movimientos en la zona {zona}</p>
                <p className="mt-1 text-sm text-[#9AA5B4]">
                  Aparecerán aquí en cuanto la cámara detecte la primera caja.
                </p>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-white/5">
                {datos.movimientos.map((m) => (
                  <MovimientoItem key={m.id} movimiento={m} onAbrir={setSeleccion} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <EvidenciaModal movimiento={seleccion} onCerrar={() => setSeleccion(null)} />
    </main>
  );
}
