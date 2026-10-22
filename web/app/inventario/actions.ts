"use server";

import { supabaseServer } from "@/lib/supabase-server";

export type FilaInventario = {
  sku: string;
  nombre: string;
  zona: string;
  stock_registrado: number;
  stock_inicial: number;
};

export type ResultadoImportacion = {
  importadas: number;
  errores: { fila: number; mensaje: string }[];
};

export async function importarInventario(
  filas: FilaInventario[]
): Promise<ResultadoImportacion> {
  const errores: ResultadoImportacion["errores"] = [];
  const validas: FilaInventario[] = [];

  filas.forEach((fila, indice) => {
    const numeroFila = indice + 2; // +1 por índice base 1, +1 por la fila de encabezado

    if (!fila.sku || fila.sku.trim() === "") {
      errores.push({ fila: numeroFila, mensaje: "Falta el SKU." });
      return;
    }
    if (!fila.nombre || fila.nombre.trim() === "") {
      errores.push({ fila: numeroFila, mensaje: "Falta el nombre." });
      return;
    }
    if (!Number.isFinite(fila.stock_registrado) || fila.stock_registrado < 0) {
      errores.push({ fila: numeroFila, mensaje: "stock_registrado inválido." });
      return;
    }
    if (!Number.isFinite(fila.stock_inicial) || fila.stock_inicial < 0) {
      errores.push({ fila: numeroFila, mensaje: "stock_inicial inválido." });
      return;
    }

    validas.push({
      sku: fila.sku.trim(),
      nombre: fila.nombre.trim(),
      zona: fila.zona?.trim() || "A",
      stock_registrado: fila.stock_registrado,
      stock_inicial: fila.stock_inicial,
    });
  });

  if (validas.length === 0) {
    return { importadas: 0, errores };
  }

  const supabase = supabaseServer();
  const { error, count } = await supabase
    .from("productos")
    .upsert(validas, { onConflict: "sku", count: "exact" });

  if (error) {
    errores.push({ fila: 0, mensaje: `Error al guardar en Supabase: ${error.message}` });
    return { importadas: 0, errores };
  }

  return { importadas: count ?? validas.length, errores };
}
