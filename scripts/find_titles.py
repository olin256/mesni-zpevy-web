import os
import re

# Nastavení složky, kterou chceš prohledat
folder = "../dist/"

# Kolik nejdelších title tagů chceš zobrazit
top_n = 10

titles = []

# Projde všechny .html soubory včetně podsložek
for root, dirs, files in os.walk(folder):
    for filename in files:
        if filename.lower().endswith(".html"):
            filepath = os.path.join(root, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                match = re.search(r"<title>(.*?)</title>", content, re.IGNORECASE | re.DOTALL)
                if match:
                    title_text = match.group(1).strip()
                    titles.append((len(title_text), title_text, filepath))
            except Exception as e:
                print(f"Chyba při čtení {filepath}: {e}")

# Seřazení podle délky (od nejdelšího)
titles.sort(reverse=True, key=lambda x: x[0])

# Výpis výsledků
print(f"Nejdelších {min(top_n, len(titles))} <title> tagů:\n")
for i, (length, text, path) in enumerate(titles[:top_n], 1):
    print(f"{i}. {text} (délka: {length})")
    print(f"   Soubor: {path}\n")
