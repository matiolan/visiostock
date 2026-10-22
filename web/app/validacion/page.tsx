import { validacion as v, type Estado } from "./data";

const color: Record<Estado, string> = {
  validada: "bg-green-600",
  "en validación": "bg-[#E8833A]",
  "no validada": "bg-red-600",
};

export default function Validacion() {
  return (
    <main className="min-h-screen bg-[#0F1620] px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl space-y-12">
        <header>
          <h1 className="text-3xl font-bold sm:text-4xl">
            Lo que aprendimos de los <span className="text-[#E8833A]">jefes de almacén</span>
          </h1>
          <p className="mt-4 text-gray-300">
            {v.entrevistas} entrevistas · {v.perfil}
          </p>
        </header>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">Hallazgos principales</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {v.hallazgos.map((h) => (
              <article key={h.titulo} className="rounded-xl bg-[#1A2332] p-5">
                <h3 className="font-semibold text-[#E8833A]">{h.titulo}</h3>
                <blockquote className="mt-2 text-gray-300">
                  “{h.cita}”
                  <footer className="mt-1 text-sm text-gray-400">— {h.autor}</footer>
                </blockquote>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#E8833A] p-6">
          <h2 className="mb-2 text-xl font-semibold">Declaración POV</h2>
          <p className="text-gray-200">{v.pov}</p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">Hipótesis</h2>
          <ul className="space-y-3">
            {v.hipotesis.map((h) => (
              <li key={h.tipo} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#1A2332] p-4">
                <span>
                  <strong>{h.tipo}:</strong> {h.texto}
                </span>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${color[h.estado]}`}>{h.estado}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl bg-[#1A2332] p-6">
          <h2 className="mb-2 text-xl font-semibold">Decisión: perseverar o pivotar</h2>
          <p className="text-gray-200">{v.decision}</p>
        </section>
      </div>
    </main>
  );
}