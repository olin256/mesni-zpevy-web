#!/usr/bin/env python3
"""
find_invalid_json.py – Najde JSON soubory s chybou při parsování.

Použití:
    python find_invalid_json.py /cesta/k/složce
    (bez argumentu prohledá aktuální adresář)
"""

from pathlib import Path
import json
import argparse
import sys

def check_json_files(root: Path) -> None:
    """
    Projde všechny *.json soubory pod složkou root a vypíše ty,
    které nelze načíst, včetně řádku a sloupce chyby.
    """
    for json_path in root.rglob("*.json"):  # glob rekurzivně
        try:
            with json_path.open("r", encoding="utf-8") as fh:
                json.load(fh)
        except json.JSONDecodeError as err:
            # err.lineno a err.colno jsou indexované od 1
            print(f"{json_path} – řádek {err.lineno}, sloupec {err.colno}: {err.msg}")

def main(argv=None) -> None:
    parser = argparse.ArgumentParser(
        description="Vyhledá nevalidní JSON soubory a vypíše místo chyby.")
    parser.add_argument(
        "dir",
        nargs="?",
        default=".",
        help="Kořenová složka pro prohledávání (výchozí: aktuální).")
    args = parser.parse_args(argv)

    root = Path(args.dir).resolve()
    if not root.is_dir():
        sys.exit(f"Zadaná cesta není složka: {root}")

    check_json_files(root)

if __name__ == "__main__":
    main()
