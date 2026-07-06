#!/usr/bin/env python3
"""
update_json_dates.py – Přepíše pole "date" v JSON souborech podle názvu souboru.

Použití:
    python update_json_dates.py /cesta/k/složce
    (bez argumentu prohledá aktuální adresář)

Předpoklad názvu:  MM_DD[libovolné_další_znaky].json
Např. 03_15.json   → 15. března
      12_01_copy.json → 1. prosince
"""

from pathlib import Path
import argparse
import json
import re
import sys

# Měsíce v češtině (2-ciferný řetězec → měsíc v genitivu)
MONTHS_CZ = {
    "01": "ledna",
    "02": "února",
    "03": "března",
    "04": "dubna",
    "05": "května",
    "06": "června",
    "07": "července",
    "08": "srpna",
    "09": "září",
    "10": "října",
    "11": "listopadu",
    "12": "prosince",
}

FILENAME_RE = re.compile(r"(?P<month>\d{2})_(?P<day>\d{2}).*\.json$", re.IGNORECASE)


def extract_date_from_filename(filename: str) -> str | None:
    """
    Vrátí řetězec 'DD. měsíc' na základě názvu souboru (MM_DD*.json).
    Pokud formát neodpovídá, vrátí None.
    """
    match = FILENAME_RE.fullmatch(filename)
    if not match:
        return None

    month, day = match.group("month"), match.group("day")
    # Odstraň úvodní nulu u dne
    day_int = int(day)
    month_name = MONTHS_CZ.get(month)
    if month_name is None:
        return None
    return f"{day_int}. {month_name}"


def update_file(json_path: Path, new_date: str) -> None:
    """
    Načte JSON, přepíše klíč 'date' a zapíše soubor zpět (UTF-8, nemění strukturu).
    """
    try:
        with json_path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
    except json.JSONDecodeError as err:
        print(f"⚠️  Přeskočeno, nevalidní JSON: {json_path} – řádek {err.lineno}, sloupec {err.colno}")
        return

    # Přepiš / přidej klíč 'date'
    data["date"] = new_date

    # Zapiš zpět se zachováním diakritiky
    with json_path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=4, ensure_ascii=False)
    print(f"✓ Aktualizováno: {json_path}  →  \"date\": \"{new_date}\"")


def process_directory(root: Path) -> None:
    for json_path in root.rglob("*.json"):
        new_date = extract_date_from_filename(json_path.name)
        if new_date:
            update_file(json_path, new_date)
        else:
            print(f"⏩  Vynechán (neodpovídá vzoru): {json_path}")


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(
        description="Najde JSON soubory a přepíše v nich pole 'date' podle názvu souboru."
    )
    parser.add_argument(
        "dir",
        nargs="?",
        default=".",
        help="Kořenová složka pro prohledávání (výchozí: aktuální).",
    )
    args = parser.parse_args(argv)

    root = Path(args.dir).resolve()
    if not root.is_dir():
        sys.exit(f"Zadaná cesta není složka: {root}")
    process_directory(root)


if __name__ == "__main__":
    main()
