import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import NavBar from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "VisioStock",
  description: "Tu almacén, contado y con prueba.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${GeistSans.variable} ${GeistMono.variable} flex min-h-screen flex-col antialiased`}>
        <NavBar />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-white/10 py-6 text-center text-sm text-[#5B6676]">
          VisioStock · Grupo 4 · Proyecto Final de Carrera III · USIL
        </footer>
      </body>
    </html>
  );
}
