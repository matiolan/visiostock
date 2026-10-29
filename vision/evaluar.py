"""Precisión de conteo sobre videos con conteo manual conocido (meta del Sprint 1: ≥ 85 %).

El CSV tiene una fila por video, con las rutas relativas al CSV:
    video,entradas,salidas
    videos/prueba1.mp4,12,4

Uso:
    python evaluar.py datos/etiquetas.csv
"""

import argparse
import csv
import sys
from pathlib import Path

META = 0.85


def precision_conteo(real_e: int, real_s: int, pred_e: int, pred_s: int) -> float:
    """1 − error absoluto relativo, sumando entradas y salidas. Va de 0 a 1."""
    total = real_e + real_s
    if total == 0:
        return 1.0 if pred_e + pred_s == 0 else 0.0
    error = abs(pred_e - real_e) + abs(pred_s - real_s)
    return max(0.0, 1 - error / total)


def main() -> None:
    parser = argparse.ArgumentParser(description="Evalúa la precisión de conteo de VisioStock")
    parser.add_argument("csv", type=Path, help="CSV con columnas video,entradas,salidas")
    args = parser.parse_args()

    from config import Config
    from main import contar

    cfg = Config()
    filas = list(csv.DictReader(args.csv.open(encoding="utf-8")))
    if not filas:
        sys.exit("El CSV no tiene filas.")

    suma_real = suma_error = 0
    print(f"{'video':<30} {'real E/S':>9} {'pred E/S':>9} {'precisión':>10}")
    for fila in filas:
        video = args.csv.parent / fila["video"]
        real_e, real_s = int(fila["entradas"]), int(fila["salidas"])
        contador = contar(str(video), cfg, enviar=False)
        p = precision_conteo(real_e, real_s, contador.entradas, contador.salidas)
        suma_real += real_e + real_s
        suma_error += abs(contador.entradas - real_e) + abs(contador.salidas - real_s)
        print(f"{fila['video']:<30} {real_e:>4}/{real_s:<4} {contador.entradas:>4}/{contador.salidas:<4} {p:>9.1%}")

    global_ = max(0.0, 1 - suma_error / suma_real) if suma_real else 1.0
    estado = "cumple" if global_ >= META else "no cumple"
    print(f"\nPrecisión global: {global_:.1%} ({estado} la meta de {META:.0%})")


if __name__ == "__main__":
    main()
