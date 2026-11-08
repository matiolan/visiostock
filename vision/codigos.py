"""HU-07 · Lectura de códigos QR y de barras para identificar el SKU del producto.

Solo devuelve el texto leído. La búsqueda del producto se hace en la web, que ya tiene
los productos que el usuario puede ver gracias a RLS.

Se usa zxing-cpp en lugar de OpenCV porque OpenCV solo lee EAN/UPC y los SKU internos
suelen imprimirse en Code128 o Code39.
"""
import zxingcpp

FORMATOS = {'QRCode': 'QR', 'MicroQRCode': 'QR', 'DataMatrix': 'DataMatrix', 'EAN13': 'EAN-13', 'EAN8': 'EAN-8',
            'UPCA': 'UPC-A', 'UPCE': 'UPC-E', 'Code128': 'Code128', 'Code39': 'Code39', 'Code93': 'Code93',
            'ITF': 'ITF'}


def leer_codigos(imagen) -> list[dict]:
    """Devuelve los códigos legibles de la imagen RGB como [{'tipo', 'texto'}], sin repetidos."""
    codigos: dict[str, str] = {}
    for leido in zxingcpp.read_barcodes(imagen):
        texto = leido.text.strip()
        if leido.valid and texto:
            codigos.setdefault(texto, FORMATOS.get(leido.format.name, leido.format.name))
    return [{'tipo': tipo, 'texto': texto[:200]} for texto, tipo in codigos.items()]
