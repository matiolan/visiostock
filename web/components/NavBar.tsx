"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const enlaces = [
  { href: "/", texto: "Inicio" },
  { href: "/dashboard", texto: "Panel" },
  { href: "/inventario", texto: "Inventario" },
  { href: "/validacion", texto: "Validación" },
];

export default function NavBar() {
  const ruta = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0F1620]/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          <span className="text-[#E8833A]">Visio</span>
          <span className="text-white">Stock</span>
        </Link>
        <ul className="flex items-center gap-1 overflow-x-auto text-sm">
          {enlaces.map((e) => {
            const activo = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
            return (
              <li key={e.href}>
                <Link
                  href={e.href}
                  className={`block rounded-md px-3 py-1.5 whitespace-nowrap transition-colors ${
                    activo ? "bg-[#1A2332] text-white" : "text-[#9AA5B4] hover:text-white"
                  }`}
                >
                  {e.texto}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
