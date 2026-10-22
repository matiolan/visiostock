export type Estado = "validada" | "en validación" | "no validada";

export const validacion = {
  entrevistas: 3, // de las 5 previstas en HU-01
  perfil: "Encargados de almacén (Juan Martín Torres, Luis Enciso Quispe, Alfredo Roque Juárez), entrevistados por llamada.",
  hallazgos: [
    { titulo: "El registro es manual o llega tarde", cita: "A veces se nos acumulan las guías físicas 2 o 3 días antes de que alguien se siente a registrarlas formalmente.", autor: "Alfredo Roque Juárez" },
    { titulo: "Los descuadres no se pueden rastrear", cita: "Es muy difícil rastrearlo si pasaron más de 3 días.", autor: "Juan Martín Torres" },
    { titulo: "El inventario físico es caro", cita: "Nos toma todo un fin de semana completo (sábado y domingo), congelando totalmente la operación y pagando horas extra a 8 personas.", autor: "Juan Martín Torres" },
    { titulo: "Las herramientas actuales no cierran el problema", cita: "El problema fue que el personal no las usaba de forma consistente o se olvidaban de escanear las salidas rápidas, así que el sistema volvió a desactualizarse.", autor: "Luis Enciso Quispe" },
    { titulo: "La adopción preocupa tanto como la tecnología", cita: "Nos preocuparía la resistencia del personal; podrían sentir que los están 'espiando' o persiguiendo.", autor: "Luis Enciso Quispe" },
  ],
  pov: "Un jefe de almacén necesita saber qué entra y sale de su zona con prueba, porque hoy registra a mano o con retraso y descubre las diferencias de stock tarde y sin poder explicarlas.",
  hipotesis: [
    { tipo: "Valor", texto: "Pagarían por zona al mes si la cámara muestra con prueba la diferencia entre el stock del sistema y el real (los tres dieron un monto, entre US$ 40 y 300)", estado: "en validación" as Estado },
    { tipo: "Técnica", texto: "El modelo YOLOv8n con ByteTrack cuenta cajas con una precisión de 85 % o más", estado: "en validación" as Estado },
    { tipo: "Comportamiento", texto: "Hoy registran a mano o con retraso y detectan los descuadres tarde, sin evidencia de cuándo ocurrieron (descrito por los tres)", estado: "validada" as Estado },
  ],
  decision: "Perseverar (borrador, a confirmar con el equipo): el problema aparece en las tres entrevistas y los tres aceptarían pagar. Condiciones a vigilar: precisión del conteo, rechazo del personal y precio frente a lo que dijo el entrevistado más pequeño.",
};