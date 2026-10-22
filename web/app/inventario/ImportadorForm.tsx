"use client";

import { useState } from "react";
import Papa from "papaparse";
import { importarInventario, type FilaInventario, type ResultadoImportacion } from "./actions";

const COLUMNAS_ESPERADAS = ["sku", "nombre", "zona", "stock_registrado", "stock_inicial"];

type FilaCruda = Record<string, string>;

function aFilaInventario(fila: FilaCruda): FilaInventario {
  return {
    sku: fila.sku ?? "",
    nombre: fila.nombre ?? "",
    zona: fila.zona ?? "",
    stock_registrado: Number(fila.stock_registrado),
    stock_inicial: Number(fila.stock_inicial),
  };
}

export default function ImportadorForm() {
  const [filas, setFilas] = useState<FilaCruda[]>([]);
  const [columnasFaltantes, setColumnasFaltantes] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);

  function manejarArchivo(archivo: File) {
    setResultado(null);
    setErrorArchivo(null);

    Papa.parse<FilaCruda>(archivo, {
      header: true,
      skipEmptyLines: true,
      complete: (resultadoParseo) => {
        const columnas = resultadoParseo.meta.fields ?? [];
        const faltantes = COLUMNAS_ESPERADAS.filter((c) => !columnas.includes(c));
        setColumnasFaltantes(faltantes);
        setFilas(faltantes.length === 0 ? resultadoParseo.data : []);
      },
      error: (error) => {
        setErrorArchivo(`No se pudo leer el archivo: ${error.message}`);
      },
    });
  }

  async function manejarImportar() {
    setCargando(true);
    setResultado(null);
    try {
      const datos = filas.map(aFilaInventario);
      const resultadoImportacion = await importarInventario(datos);
      setResultado(resultadoImportacion);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-white/10 bg-[#1A2332] p-6">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-white/70">
            Archivo CSV con columnas: {COLUMNAS_ESPERADAS.join(", ")}
          </span>
          <input
            type="file"
            accept=".csv"
            className="text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[#E8833A] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#0F1620] hover:file:bg-[#f09854]"
            onChange={(evento) => {
              const archivo = evento.target.files?.[0];
              if (archivo) manejarArchivo(archivo);
            }}
          />
        </label>

        {errorArchivo && (
          <p className="mt-3 text-sm text-red-400">{errorArchivo}</p>
        )}

        {columnasFaltantes.length > 0 && (
          <p className="mt-3 text-sm text-red-400">
            Faltan columnas: {columnasFaltantes.join(", ")}
          </p>
        )}
      </div>

      {filas.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-[#1A2332] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">
              Vista previa ({filas.length} {filas.length === 1 ? "fila" : "filas"})
            </h2>
            <button
              onClick={manejarImportar}
              disabled={cargando}
              className="rounded-md bg-[#E8833A] px-4 py-2 text-sm font-medium text-[#0F1620] hover:bg-[#f09854] disabled:opacity-50"
            >
              {cargando ? "Importando…" : "Importar"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/60">
                  {COLUMNAS_ESPERADAS.map((columna) => (
                    <th key={columna} className="px-3 py-2">
                      {columna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, 20).map((fila, indice) => (
                  <tr key={indice} className="border-b border-white/5">
                    {COLUMNAS_ESPERADAS.map((columna) => (
                      <td key={columna} className="px-3 py-2">
                        {fila[columna]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {filas.length > 20 && (
              <p className="mt-2 text-xs text-white/50">
                Mostrando las primeras 20 filas de {filas.length}.
              </p>
            )}
          </div>
        </div>
      )}

      {resultado && (
        <div className="rounded-lg border border-white/10 bg-[#1A2332] p-6">
          <p className="text-sm">
            Se importaron <span className="font-medium text-[#E8833A]">{resultado.importadas}</span>{" "}
            filas.
          </p>
          {resultado.errores.length > 0 && (
            <div className="mt-3">
              <p className="text-sm text-red-400">
                {resultado.errores.length} {resultado.errores.length === 1 ? "error" : "errores"}:
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-red-300">
                {resultado.errores.map((error, indice) => (
                  <li key={indice}>
                    {error.fila > 0 ? `Fila ${error.fila}: ` : ""}
                    {error.mensaje}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
