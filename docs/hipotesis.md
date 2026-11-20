# Hipótesis medibles y priorización

Actualización del 20/11/2026. Investigación: tres entrevistas. Prueba de usabilidad: actividad distinta cuyo alcance original de cinco usuarios no se cambia por reducir las entrevistas.

| Tipo | Hipótesis | Métrica y criterio | Método | Evidencia y estado |
| --- | --- | --- | --- | --- |
| Problema | Los responsables de la muestra consideran relevantes las diferencias de inventario y su difícil rastreo. | Al menos 80 % de la muestra reporta descuadres; con n=3, equivale a 3 de 3. Registrar frecuencia/costo como lo expresa cada entrevistado. | Codificación E01-E03, P3/P4/P5. | 3/3 notas describen descuadres y costos. Apoyo cualitativo en esta muestra; fechas y consentimiento no acreditados aquí. |
| Valor | La evidencia integrada justifica que un responsable acepte probar el sistema bajo condiciones explícitas. | Propuesta de validación: al menos 2 de los 3 entrevistados aceptan un piloto con alcance, soporte y precio informados. | Demostración y registro de aceptación/rechazo; no inferir aceptación de una respuesta de precio. | P8 contiene montos condicionales en dólares. Piloto y conversión comercial pendientes. |
| Técnica | El detector cuenta cajas con precisión suficiente y registra oportunamente el movimiento. | Meta de conteo >=85 %; acierto de sentido y errores reportados; latencia detección-dashboard <5 s según SCRUM-51. | Conjunto de casos etiquetados y cámara real; comparar conteo esperado/obtenido y tiempos por caso. | Las pruebas con detector simulado verifican lógica, no precisión del detector real. Validación integral pendiente. |
| Comportamiento | El usuario consulta la evidencia antes de decidir un ajuste y puede interpretar la diferencia. | Criterio original HU-04: al menos 3 de 5 usuarios abren evidencia; utilidad >=4/5 en al menos 3 de 5 y satisfacción media >=4/5. | Cinco sesiones moderadas con tareas, tiempos, éxito y cuestionario, sin sustituir participantes por automatización. | Sin resultados de cinco sesiones en el material disponible. Protocolo preparado; pendiente ejecución real. |

## Prioridad de riesgo

1. Técnica: un conteo incorrecto puede introducir diferencias; se vincula con SCRUM-51 y las historias de detección del equipo. Es la hipótesis más riesgosa para el funcionamiento.
2. Comportamiento: sin comprensión y uso de evidencia no se valida la propuesta; SCRUM-14/SCRUM-37.
3. Valor: aceptación de piloto y precio; requiere respuesta real, no inferencia a partir de P8.
4. Problema: existe respaldo cualitativo en tres notas, con límites de tamaño y documentación de la muestra.

## POV

Ver [POV y preguntas HMW](pov-hmw.md). Las necesidades se trazan a respuestas concretas; las inferencias se distinguen de citas.

## Recomendación provisional

Perseverar en un piloto controlado, condicionado a medir la hipótesis técnica y ejecutar la validación de uso. No se presenta como decisión aprobada en Sprint Review ni como hipótesis técnica/comercial confirmada. El análisis de cierre se detalla en [analisis-validacion.md](analisis-validacion.md).
