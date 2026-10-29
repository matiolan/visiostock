"""Cámara → detección y seguimiento → conteo por línea → API de movimientos.

Uso:
    python main.py                # usa FUENTE de .env
    python main.py --fuente video.mp4 --mostrar --sin-envio
"""

import argparse
import logging

import cv2

from config import Config
from contador import ContadorLinea
from detector import DetectorCajas
from enviar import enviar_movimiento

log = logging.getLogger("visiostock")


def dibujar(cuadro, detecciones, contador: ContadorLinea) -> None:
    alto, ancho = cuadro.shape[:2]
    y = int(contador.linea_y)
    cv2.line(cuadro, (0, y), (ancho, y), (0, 200, 255), 2)
    for d in detecciones:
        x1, y1, x2, y2 = map(int, d.caja)
        cv2.rectangle(cuadro, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(cuadro, f"#{d.track_id} {d.confianza:.2f}", (x1, y1 - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
    cv2.putText(cuadro, f"Entradas: {contador.entradas}  Salidas: {contador.salidas}",
                (10, alto - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)


def contar(fuente, cfg: Config, enviar: bool = True, mostrar: bool = False) -> ContadorLinea:
    detector = DetectorCajas(cfg.modelo, cfg.clases, cfg.confianza_min)
    captura = cv2.VideoCapture(fuente)
    if not captura.isOpened():
        raise RuntimeError(f"No se pudo abrir la fuente de video: {fuente}")

    contador: ContadorLinea | None = None
    try:
        while True:
            ok, cuadro = captura.read()
            if not ok:
                break
            if contador is None:
                contador = ContadorLinea(linea_y=cfg.linea_y * cuadro.shape[0])

            detecciones = detector.seguir(cuadro)
            for d in detecciones:
                if d.track_id is None:
                    continue
                cruce = contador.actualizar(d.track_id, d.centro[1], d.confianza)
                if cruce:
                    log.info("Caja #%s: %s", cruce.track_id, cruce.sentido)
                    if enviar:
                        enviar_movimiento(cfg.api_url, cfg.api_key, cfg.zona,
                                          cruce.sentido, cruce.confianza, cuadro)

            if mostrar:
                dibujar(cuadro, detecciones, contador)
                cv2.imshow("VisioStock", cuadro)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    finally:
        captura.release()
        if mostrar:
            cv2.destroyAllWindows()

    return contador or ContadorLinea(linea_y=0)


def main() -> None:
    parser = argparse.ArgumentParser(description="Conteo de cajas VisioStock")
    parser.add_argument("--fuente", help="Cámara (0), video o URL RTSP; por defecto FUENTE de .env")
    parser.add_argument("--mostrar", action="store_true", help="Muestra el video con las detecciones")
    parser.add_argument("--sin-envio", action="store_true", help="No envía los movimientos a la API")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cfg = Config()
    fuente = cfg.fuente if args.fuente is None else (int(args.fuente) if args.fuente.isdigit() else args.fuente)
    if not args.sin_envio and not cfg.api_key:
        parser.error("Falta VISION_API_KEY en .env (o usa --sin-envio)")

    contador = contar(fuente, cfg, enviar=not args.sin_envio, mostrar=args.mostrar)
    log.info("Total · entradas: %s, salidas: %s", contador.entradas, contador.salidas)


if __name__ == "__main__":
    main()
