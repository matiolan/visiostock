"""HU-08 · Mide la detección de manipulación incorrecta con clips etiquetados.

Criterio: con 20 eventos de manipulación simulados y 20 movimientos normales, detectar
≥ 75 % de los eventos con una tasa de falsos positivos ≤ 15 %.

El CSV tiene una fila por clip (rutas relativas al CSV):
    archivo,esperado
    caida_01.mp4,caida
    golpe_01.mp4,golpe
    pila_01.mp4,apilamiento
    normal_01.mp4,normal

Un evento cuenta como detectado si el clip genera una alerta de su mismo tipo; un clip normal
con cualquier alerta es un falso positivo.

Uso:
    python evaluar_manipulacion.py clips.csv [--modelo models/best.pt]
"""
import argparse
import csv
from pathlib import Path


def resumir(filas: list[dict]) -> dict:
    eventos = [f for f in filas if f['esperado'] != 'normal']
    normales = [f for f in filas if f['esperado'] == 'normal']
    detectados = sum(1 for f in eventos if f['esperado'] in f['alertas'])
    falsos = sum(1 for f in normales if f['alertas'])
    return {'eventos': len(eventos), 'detectados': detectados, 'normales': len(normales), 'falsos': falsos,
            'deteccion': detectados / len(eventos) if eventos else 0.0,
            'falsos_positivos': falsos / len(normales) if normales else 0.0}


def main() -> None:
    parser = argparse.ArgumentParser(description='Precisión de la detección de manipulación')
    parser.add_argument('clips')
    parser.add_argument('--modelo', default='models/best.pt')
    parser.add_argument('--clase', default='caja')
    args = parser.parse_args()

    from ultralytics import YOLO
    from manipulacion import analizar_video
    from videos import propiedades_video

    modelo = YOLO(args.modelo)
    ids = [i for i, n in modelo.names.items() if n == args.clase]
    base = Path(args.clips).parent
    filas = []
    with open(args.clips, newline='', encoding='utf-8') as f:
        for fila in csv.DictReader(f):
            ruta = str(base / fila['archivo'])
            fps, _ = propiedades_video(ruta)
            tipos = sorted({a.tipo for a in analizar_video(modelo, ruta, ids, .5, fps)})
            filas.append({'archivo': fila['archivo'], 'esperado': fila['esperado'], 'alertas': tipos})
            ok = (fila['esperado'] in tipos) if fila['esperado'] != 'normal' else not tipos
            print(f"{'✓' if ok else '✗'} {fila['archivo']:<22} esperado {fila['esperado']:<12} alertas {', '.join(tipos) or '—'}")
    r = resumir(filas)
    cumple = r['deteccion'] >= .75 and r['falsos_positivos'] <= .15
    print(f"\nEventos detectados: {r['detectados']}/{r['eventos']} = {r['deteccion']:.0%} (meta ≥ 75 %)")
    print(f"Falsos positivos:   {r['falsos']}/{r['normales']} = {r['falsos_positivos']:.0%} (meta ≤ 15 %)")
    print('CUMPLE' if cumple else 'NO CUMPLE')


if __name__ == '__main__':
    main()
