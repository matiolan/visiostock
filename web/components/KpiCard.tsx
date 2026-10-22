interface KpiCardProps {
  etiqueta: string;
  valor: string;
  detalle?: string;
  alerta?: boolean;
  aviso?: string;
}

export default function KpiCard({ etiqueta, valor, detalle, alerta = false, aviso }: KpiCardProps) {
  return (
    <div
      className={`rounded-xl p-5 transition-colors ${
        alerta ? "bg-[#E8833A] text-[#0F1620]" : "bg-[#1A2332] text-white"
      }`}
    >
      <p className={`text-sm font-medium ${alerta ? "text-[#0F1620]/80" : "text-[#9AA5B4]"}`}>{etiqueta}</p>
      <p className="mt-2 text-5xl font-bold tabular-nums tracking-tight">{valor}</p>
      {detalle && (
        <p className={`mt-2 text-sm ${alerta ? "text-[#0F1620]/80" : "text-[#9AA5B4]"}`}>{detalle}</p>
      )}
      {aviso && <p className="mt-3 text-sm font-bold">{aviso}</p>}
    </div>
  );
}
