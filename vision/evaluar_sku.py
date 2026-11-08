"""HU-07 · Mide la tasa de lectura del SKU en un video controlado (criterio: ≥ 90 %).

El CSV esperado tiene una fila por caja en el orden en que cruza la línea:
    orden,sentido,sku
    1,entrada,LALI-001
    2,salida,NO IDENTIFICADO      ← caja sin código legible a propósito

Uso:
    python evaluar_sku.py video.mp4 esperado.csv [--modelo models/best.pt] [--linea 0.5]

No tiene el límite de 30 s del servicio, así que sirve para el video de 50 cajas.
"""
import argparse
import csv


def comparar(esperados: list[dict], detectados: list[dict]) -> dict:
    """Compara en orden de cruce. Un movimiento es correcto si coinciden el sentido y el SKU."""
    correctos = sum(1 for e, d in zip(esperados, detectados)
                    if e['sentido'] == d['sentido'] and e['sku'].strip().upper() == (d['codigo'] or 'NO IDENTIFICADO').upper())
    total = len(esperados)
    return {'esperados': total, 'detectados': len(detectados), 'correctos': correctos,
            'tasa': correctos / total if total else 0.0}


def main() -> None:
    parser = argparse.ArgumentParser(description='Tasa de identificación del SKU por video')
    parser.add_argument('video')
    parser.add_argument('esperado')
    parser.add_argument('--modelo', default='models/best.pt')
    parser.add_argument('--clase', default='caja')
    parser.add_argument('--linea', type=float, default=.5)
    parser.add_argument('--meta', type=float, default=.9)
    args = parser.parse_args()

    from ultralytics import YOLO
    from movimientos import analizar_movimientos
    from videos import propiedades_video

    modelo = YOLO(args.modelo)
    ids = [i for i, n in modelo.names.items() if n == args.clase]
    fps, duracion = propiedades_video(args.video)
    detectados = analizar_movimientos(modelo, args.video, ids, .5, fps, args.linea)
    with open(args.esperado, newline='', encoding='utf-8') as f:
        esperados = list(csv.DictReader(f))
    r = comparar(esperados, detectados)
    for e, d in zip(esperados, detectados):
        marca = '✓' if e['sentido'] == d['sentido'] and e['sku'].upper() == (d['codigo'] or 'NO IDENTIFICADO').upper() else '✗'
        print(f"{marca} {e['orden']:>3} esperado {e['sentido']:<8} {e['sku']:<16} → {d['sentido']:<8} {d['codigo'] or 'NO IDENTIFICADO'}")
    print(f"\nVideo de {duracion:.1f} s · {r['esperados']} cajas esperadas · {r['detectados']} movimientos detectados")
    print(f"SKU correcto en {r['correctos']}/{r['esperados']} = {r['tasa']:.1%} (meta {args.meta:.0%}) → "
          f"{'CUMPLE' if r['tasa'] >= args.meta and r['detectados'] == r['esperados'] else 'NO CUMPLE'}")


if __name__ == '__main__':
    main()
