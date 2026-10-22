import ImportadorForm from "./ImportadorForm";

export const metadata = {
  title: "Importar inventario · VisioStock",
};

export default function InventarioPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Importar inventario</h1>
      <p className="mt-2 text-sm text-white/70">
        Sube el inventario inicial desde un archivo CSV. Puedes descargar{" "}
        <a
          href="/inventario-ejemplo.csv"
          className="text-[#E8833A] underline hover:no-underline"
        >
          el CSV de ejemplo
        </a>{" "}
        como referencia de formato.
      </p>

      <div className="mt-8">
        <ImportadorForm />
      </div>
    </main>
  );
}
