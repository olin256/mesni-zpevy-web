# Mešní zpěvy online

Webový zpěvník pro **Mešní zpěvy**. Cílem projektu je vytvořit obdobu
[kancional.cz](https://kancional.cz/) pro zpěvník Mešní zpěvy: přehledné
online stránky s texty, notami, rejstříkem písní, vyhledáváním a odkazy na
další materiály.

Projekt vzniká pod patronátem [Společnosti pro duchovní hudbu](https://sdh.cz/).
Veřejná verze je dostupná na [mesnizpevy.cz](https://mesnizpevy.cz/).

## Stav obsahu

Aktuálně je zpracovaná a funkční tato část zpěvníku:

- Písně pro liturgické doby, strany 11–185
- Písně o svatých a posvěcení kostela, strany 549–984
- Písně k různým příležitostem, strany 787–792

Zatím chybí:

- Mešní řád (včetně ordinárií), strany 389–945
- část od Litanií dál, strany 895–5101

## Co web umí

- zobrazuje písně podle liturgických období, slavností, svátků a dalších
  příležitostí,
- kombinuje texty písní s notovými výřezy v SVG,
- nabízí rejstřík písní a odkazy na jejich výskyt ve zpěvníku,
- obsahuje klientské vyhledávání v textech písní,
- publikuje statický výstup do složky `dist`.

## Struktura projektu

- `src/pages` - ručně psané statické stránky, např. `o_projektu.html`
- `src/templates` - HTML šablony pro generované stránky
- `src/css`, `src/js`, `src/assets` - styly, skripty a veřejné assety webu
- `data/json` - strukturovaná data jednotlivých liturgických příležitostí
- `data/order` - pořadí položek v hlavním rozcestníku
- `data/lilypond` - šablony a pravidla pro generování not
- `scripts` - skripty pro generování webu, rejstříku, hledání a not
- `build` - dočasně generované soubory
- `dist` - hotový statický web připravený k nasazení

Některá data jsou načítána ze sousedního repozitáře `mesni-zpevy-texty`, který
má být umístěn vedle tohoto projektu:

```text
parent-folder/
  mesni-zpevy-web/
  mesni-zpevy-texty/
```

## Vygenerování webu

Základní obnovení HTML výstupu:

```bash
cd scripts
./refresh_html.sh
```

Skript postupně:

1. zkopíruje assety do `dist/assets`,
2. vygeneruje HTML stránky písní,
3. vytvoří vyhledávací index,
4. obnoví hlavní rozcestník,
5. vygeneruje ostatní statické stránky,
6. vygeneruje rejstřík písní.

Na Windows lze spustit stejné kroky ručně z adresáře `scripts`, například:

```powershell
python copy_assets.py
python create_html.py
python generate_search_index.py
python create_index.py
python create_other_pages.py
python create_song_list.py
```

## Generování not

Notové SVG se generuje přes LilyPond a dále čistí přes `svgo` a `inkscape`.
Typické použití pro jednu nebo více písní:

```bash
cd scripts
python refresh_song.py 001a 002a
```

Pro kompletní práci s notami jsou potřeba zejména:

- Python 3
- `lxml`
- `tqdm`
- LilyPond
- SVGO
- Inkscape

## Přidání nebo úprava obsahu

1. Upravte odpovídající JSON v `data/json`.
2. Pokud se mění pořadí v rozcestníku, upravte soubor v `data/order`.
3. Pokud se mění texty písní, aktualizujte zdrojová data v `mesni-zpevy-texty`.
4. Přegenerujte web pomocí skriptu `scripts/refresh_html.sh`.
5. Zkontrolujte výsledek v `dist`.

## Související odkazy

- [Digitalizované texty](https://github.com/olin256/mesni-zpevy-texty)
- [Digitalizované varhanní doprovody](https://github.com/olin256/mesni-zpevy-doprovody)
- [FB skupina Máme rádi Mešní zpěvy](https://www.facebook.com/groups/mameradimesnizpevy/)

## Licence

Kód projektu je zveřejněn pod licencí MIT; viz `LICENSE`.

Texty, noty, skeny, PDF/SVG výstupy a další obsah převzatý ze zpěvníku
Mešní zpěvy nejsou touto licencí pokryty. Jejich další použití se řídí
právy autorů a vydavatelů.
