"use client";

import { useState } from "react";
import Link from "next/link";

const pasos = [
  { n: "1", titulo: "Cuenta", texto: "La cámara detecta cada caja y cuenta cuando cruza la línea de la zona: entrada o salida." },
  { n: "2", titulo: "Guarda la prueba", texto: "Cada movimiento queda registrado con su foto, hora y nivel de confianza." },
  { n: "3", titulo: "Compara", texto: "El panel contrasta lo que dice el sistema con lo que vio la cámara y marca la diferencia." },
];

const cifras = [
  { valor: "65 %", texto: "de los registros de inventario no coincide con la realidad." },
  { valor: "S/ 700 M+", texto: "perdidos por mermas en el retail peruano en 2025." },
  { valor: "52 %", texto: "de esa merma es desconocida: nadie sabe dónde se perdió." },
];

export default function Inicio() {
  const [enviado, setEnviado] = useState(false);

  return (
    <main className="min-h-screen bg-[#0F1620] text-white">
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold sm:text-6xl">
          Tu almacén, <span className="text-[#E8833A]">contado y con prueba.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">
          Una cámara con visión artificial que cuenta cada caja que entra o sale y guarda la foto de cada movimiento.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/dashboard" className="rounded-lg bg-[#E8833A] px-6 py-3 font-semibold text-[#0F1620]">
            Ver el panel
          </Link>
          <a href="#piloto" className="rounded-lg border border-[#E8833A] px-6 py-3 font-semibold text-[#E8833A]">
            Solicitar un piloto
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-8 text-2xl font-bold">El problema: lo que no se cuenta, se pierde</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {cifras.map((c) => (
            <div key={c.valor} className="rounded-xl bg-[#1A2332] p-6">
              <p className="text-3xl font-bold text-[#E8833A]">{c.valor}</p>
              <p className="mt-2 text-gray-300">{c.texto}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-400">
          Fuentes: DeHoratius y Raman, <em>Management Science</em> (2008); ISEG, 2.º Estudio de Mermas en el Perú,
          citado por El Comercio (feb. 2026).
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-8 text-2xl font-bold">Cómo funciona</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {pasos.map((p) => (
            <div key={p.n} className="rounded-xl bg-[#1A2332] p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8833A] font-bold text-[#0F1620]">
                {p.n}
              </span>
              <h3 className="mt-4 text-xl font-semibold">{p.titulo}</h3>
              <p className="mt-2 text-gray-300">{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-8 text-2xl font-bold">Precios</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-[#1A2332] p-6">
            <p className="text-gray-400">Instalación</p>
            <p className="text-3xl font-bold text-[#E8833A]">S/ 1,200</p>
          </div>
          <div className="rounded-xl bg-[#1A2332] p-6">
            <p className="text-gray-400">Servicio mensual por zona</p>
            <p className="text-3xl font-bold text-[#E8833A]">S/ 250 al mes</p>
          </div>
        </div>
      </section>

      <section id="piloto" className="mx-auto max-w-xl px-6 py-16">
        <h2 className="mb-6 text-center text-2xl font-bold">Solicita un piloto de 30 días</h2>
        {enviado ? (
          <p className="rounded-xl bg-[#1A2332] p-6 text-center text-[#E8833A]">
            ¡Gracias! Recibimos tu solicitud y te contactaremos pronto.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setEnviado(true);
            }}
            className="space-y-4 rounded-xl bg-[#1A2332] p-6"
          >
            {["Nombre", "Empresa", "Teléfono"].map((campo) => (
              <input
                key={campo}
                required
                placeholder={campo}
                type={campo === "Teléfono" ? "tel" : "text"}
                className="w-full rounded-lg border border-gray-600 bg-[#0F1620] px-4 py-3 text-white outline-none focus:border-[#E8833A]"
              />
            ))}
            <button type="submit" className="w-full rounded-lg bg-[#E8833A] py-3 font-semibold text-[#0F1620]">
              Solicitar piloto
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
