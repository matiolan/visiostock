import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

const SENTIDOS = ["entrada", "salida"] as const;

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.VISION_API_KEY) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo debe ser multipart/form-data." },
      { status: 400 }
    );
  }

  const zona = form.get("zona");
  const sentido = form.get("sentido");
  const cantidadRaw = form.get("cantidad");
  const confianzaRaw = form.get("confianza");
  const foto = form.get("foto");

  if (typeof zona !== "string" || zona.trim() === "") {
    return NextResponse.json({ error: "Falta el campo 'zona'." }, { status: 400 });
  }
  if (typeof sentido !== "string" || !SENTIDOS.includes(sentido as (typeof SENTIDOS)[number])) {
    return NextResponse.json(
      { error: "El campo 'sentido' debe ser 'entrada' o 'salida'." },
      { status: 400 }
    );
  }

  const cantidad = Number(cantidadRaw ?? 1);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return NextResponse.json(
      { error: "El campo 'cantidad' debe ser un número mayor que 0." },
      { status: 400 }
    );
  }

  let confianza: number | null = null;
  if (confianzaRaw !== null && confianzaRaw !== "") {
    confianza = Number(confianzaRaw);
    if (!Number.isFinite(confianza)) {
      return NextResponse.json(
        { error: "El campo 'confianza' debe ser un número." },
        { status: 400 }
      );
    }
  }

  if (!(foto instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo 'foto'." }, { status: 400 });
  }

  const supabase = supabaseServer();

  const extension = foto.name.split(".").pop() || "jpg";
  const path = `${zona}/${Date.now()}.${extension}`;
  const bytes = await foto.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("evidencias")
    .upload(path, bytes, { contentType: foto.type || "image/jpeg" });

  if (uploadError) {
    return NextResponse.json(
      { error: `No se pudo subir la evidencia: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("evidencias").getPublicUrl(path);

  const { data, error: insertError } = await supabase
    .from("movimientos")
    .insert({
      zona,
      sentido,
      cantidad,
      confianza,
      foto_url: publicUrl,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: `No se pudo registrar el movimiento: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const zona = searchParams.get("zona");
  const limit = Number(searchParams.get("limit") ?? 50);

  const supabase = supabaseServer();

  let query = supabase
    .from("movimientos")
    .select("*")
    .order("detectado_en", { ascending: false })
    .limit(Number.isFinite(limit) && limit > 0 ? limit : 50);

  if (zona) {
    query = query.eq("zona", zona);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: `No se pudieron obtener los movimientos: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
