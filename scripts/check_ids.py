import os
from bs4 import BeautifulSoup
from collections import defaultdict

# Nastav cestu ke složce s HTML soubory
slozka = "../dist/"

# Slovník: id -> seznam souborů, kde se dané id vyskytuje
id_map = defaultdict(set)

# Procházení všech HTML souborů ve složce
for jmeno_souboru in os.listdir(slozka):
    if jmeno_souboru.endswith(".html"):
        cesta = os.path.join(slozka, jmeno_souboru)
        with open(cesta, "r", encoding="utf-8") as f:
            obsah = f.read()
            soup = BeautifulSoup(obsah, "html.parser")
            for element in soup.find_all(attrs={"id": True}):
                id_map[element["id"]].add(jmeno_souboru)

# Filtrování duplicitních ID
duplicity = {id_: soubory for id_, soubory in id_map.items() if len(soubory) > 1}

# Výpis výsledků
if duplicity:
    print("Nalezena duplicitní ID napříč soubory:")
    for id_, soubory in duplicity.items():
        print(f"ID: '{id_}' se vyskytuje v souborech: {', '.join(sorted(soubory))}")
else:
    print("Nebyly nalezeny žádné duplicitní ID napříč soubory.")
