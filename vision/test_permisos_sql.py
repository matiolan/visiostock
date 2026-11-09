"""SCRUM-72: toda función SECURITY DEFINER del esquema debe quitar EXECUTE al rol anon.

Supabase concede EXECUTE a anon de forma separada a PUBLIC, así que revocar solo a PUBLIC
deja la función invocable sin sesión (hallazgo "Public Can Execute" del Security Advisor).
"""
import re
import unittest
from pathlib import Path

SQL = Path(__file__).resolve().parent.parent / "supabase"


def sentencias():
    texto = "\n".join(p.read_text(encoding="utf-8") for p in sorted(SQL.glob("*.sql")))
    texto = re.sub(r"\$\$.*?\$\$", "$$", texto, flags=re.S)  # ignora el cuerpo de las funciones
    texto = re.sub(r"--[^\n]*", "", texto)
    return [s.strip().lower() for s in texto.split(";") if s.strip()]


class PermisosFunciones(unittest.TestCase):
    def test_hay_funciones_security_definer(self):
        self.assertGreaterEqual(len(self.definers()), 7)

    def test_ninguna_queda_ejecutable_sin_sesion(self):
        revocadas = set()
        for s in sentencias():
            if s.startswith("revoke") and re.search(r"\banon\b", s.split(" from ")[-1]):
                revocadas.update(re.findall(r"(?:public\.)?(vs_\w+)\s*\(", s))
        faltan = sorted(self.definers() - revocadas)
        self.assertEqual(faltan, [], f"Funciones SECURITY DEFINER sin revoke a anon: {faltan}")

    def definers(self):
        nombres = set()
        for s in sentencias():
            m = re.match(r"create (?:or replace )?function (?:public\.)?(vs_\w+)\s*\(", s)
            if m and "security definer" in s:
                nombres.add(m.group(1))
        return nombres


if __name__ == "__main__":
    unittest.main()
