from pathlib import Path
from bs4 import BeautifulSoup
from collections import defaultdict
from itertools import combinations
import argparse


def find_h2_ids(html_file: Path) -> set[str]:
    try:
        content = html_file.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = html_file.read_text(encoding="cp1250", errors="replace")

    soup = BeautifulSoup(content, "html.parser")

    ids = set()
    for h2 in soup.find_all("h2"):
        h2_id = h2.get("id")
        if h2_id:
            ids.add(h2_id)

    return ids


def main():
    parser = argparse.ArgumentParser(
        description="Najde dvojice HTML souborů, které obsahují <h2> se stejným id."
    )
    parser.add_argument(
        "folder",
        help="Složka s HTML soubory"
    )
    parser.add_argument(
        "-r", "--recursive",
        action="store_true",
        help="Procházet složku rekurzivně"
    )

    args = parser.parse_args()
    folder = Path(args.folder)

    if not folder.is_dir():
        raise SystemExit(f"Chyba: {folder} není složka.")

    pattern = "**/*.html" if args.recursive else "*.html"
    html_files = sorted(folder.glob(pattern))

    id_to_files = defaultdict(list)

    for html_file in html_files:
        h2_ids = find_h2_ids(html_file)
        for h2_id in h2_ids:
            id_to_files[h2_id].append(html_file)

    found = False

    for h2_id, files in sorted(id_to_files.items()):
        if len(files) < 2:
            continue

        for file1, file2 in combinations(files, 2):
            found = True
            print(f'id="{h2_id}"')
            print(f"  {file1}")
            print(f"  {file2}")
            print()

    if not found:
        print("Nenalezeny žádné dvojice souborů se stejným id u elementu <h2>.")


if __name__ == "__main__":
    main()