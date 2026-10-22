# Hipótesis · VisioStock

| Tipo | Hipótesis | Estado | Evidencia |
| --- | --- | --- | --- |
| Valor | Pagarían por zona al mes si la cámara muestra con prueba la diferencia entre el stock del sistema y el real. | en validación | Los 3 entrevistados dieron un monto (US$ 40–70, 80–150 y 150–300); falta convertir y comparar con S/ 250. |
| Técnica | YOLOv8n + ByteTrack cuenta cajas con precisión de conteo ≥ 85 %. | en validación | Pendiente `vision/evaluar.py` (Henry). Preocupación de entrevistados: cajas apiladas o tapadas. |
| Comportamiento | Registran a mano o con retraso y detectan los descuadres tarde, sin evidencia de cuándo ocurrieron. | validada | Los 3 entrevistados describen registro manual o tardío. |

## POV
Un jefe de almacén necesita saber qué entra y sale de su zona con prueba, porque hoy registra a mano o con retraso y descubre las diferencias de stock tarde y sin poder explicarlas.

## Decisión: perseverar o pivotar
**Perseverar** (borrador, a confirmar con el equipo). Condiciones: precisión del conteo, resistencia del personal e integración con sistemas existentes, y precio frente a empresas pequeñas.