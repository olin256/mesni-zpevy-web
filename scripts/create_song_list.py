from lxml import html
from lxml.etree import SubElement, ElementTree
# from html import SubElement
from html_utils import strip_comments
import json
import re
from collections import defaultdict

def count_word(n):
    if n == 1:
        return "sloka"
    elif n <= 4:
        return "sloky"
    return "slok"

def parse_anchor(s):
    return int(s.split("-")[0])

_SHORT_RE = re.compile(r"(?<!\S)([ksvzKSVZ])\s")

def add_nonbreakable(text: str) -> str:
    return _SHORT_RE.sub("\\1\u00A0", text)

doc = html.parse("../src/templates/html_template.html")
root = doc.getroot()

strip_comments(root)

with open("../../mesni-zpevy-texty/strany_pisni.json", "r", encoding="utf-8") as f:
    page_data_raw = json.load(f)

song_names = {k: v["name"] for k, v in page_data_raw.items()}


with open("../dist/assets/data/occurrences.json", "r", encoding="utf-8") as f:
    occurrences = json.load(f)

song_links = defaultdict(list)
for occurrence in occurrences:
    song_links[occurrence["song"]].append(occurrence)

song_links = dict(
    (k, v)
    for k, v in sorted(
        song_links.items(),
        key=lambda x: (int(x[0][:-1]), x[0][-1])
    )
)

root.find(".//title").text = "Mešní zpěvy | Rejstřík písní"

main = root.find(".//main")

SubElement(main, "h1").text = "Rejstřík písní"

info_p = html.fromstring(
    '<p>Kliknutím na číslo písně zobrazíte odkazy na další soubory a výřez ze skenu rejstříku. '
    'Kompletní rejstřík je k\u00A0nalezení na <a href="sken.html?pg=1005">skenu str. 1005</a> a dále.</p>'
)

main.append(info_p)

table = SubElement(main, "table", attrib={
    "class": "song-index",
    "id": "songIndex"
})

thead = SubElement(table, "thead")
head_tr = SubElement(thead, "tr")
for col, label in [("number", "Číslo"), ("title", "Jméno")]:
    th = SubElement(head_tr, "th", scope="col")
    SubElement(th, "button", attrib={
        "type": "button",
        "data-sort": col
    }).text = label
SubElement(head_tr, "th", scope="col").text = "Výskyty"

tbody = SubElement(table, "tbody")

for song, links in song_links.items():
    song_name = song_names[song]

    tr = SubElement(tbody, "tr", attrib={
        "class": "song-row"
    })

    first_td = SubElement(tr, "td")
    SubElement(first_td, "button", attrib={
        "type": "button",
        "class": "song-toggle",
        "aria-expanded": "false",
        "aria-controls": f"song-info-{song}"
    }).text = song

    SubElement(tr, "td").text = add_nonbreakable(song_name)

    occurences = defaultdict(list)

    for link in links:
        occurences[link["stanzas"]].append(link)

    for occ in occurences.values():
        occ.sort(key=lambda x: parse_anchor(x["anchor"]))

    occurences = list(occurences.items())
    occurences.sort(key=lambda x: parse_anchor(x[1][0]["anchor"]))
    occurences = dict(occurences)

    occurence_strs = []

    for stanzas, occ in occurences.items():
        occ_str = ", ".join(
            f'<a href="{o["slug"]}.html#pg{o["anchor"]}" title="{add_nonbreakable(o["title"])}">{parse_anchor(o["anchor"])}</a>'
            for o in occ
        )
        stanza_count = stanzas.count(",")+1
        occ_str += f" ({stanza_count} {count_word(stanza_count)})"
        occurence_strs.append(occ_str)

    occurence_td = html.fromstring(f"<td>{'<br>'.join(occurence_strs)}</td>")
    tr.append(occurence_td)


SubElement(main.getparent(), "script", src="assets/js/table.js")

SubElement(root.find("head"), "link", rel="stylesheet", href="assets/css/table.css")

with open(f"../dist/rejstrik.html", "w", encoding="utf-8") as f:
    f.write(html.tostring(doc, pretty_print=True, method="html", encoding="unicode"))
