from lxml import html
from lxml.etree import SubElement, ElementTree
from html_utils import strip_comments
import json

with open("../src/templates/html_template.html", "r", encoding="utf-8") as f:
    html_template = f.read()

with open("../src/templates/index_elements.html", "r", encoding="utf-8") as f:
    index_elements = f.read()

html_full = html_template.replace("</main>", f"{index_elements}\n</main>", 1)

doc = ElementTree(html.document_fromstring(html_full))
root = doc.getroot()

root.find(".//title").text = "Mešní zpěvy"

for h2_el in list(root.iter("h2")):
    next_el = h2_el.getnext()
    if not isinstance(next_el, html.HtmlComment):
        continue
    directory = next_el.text
    ul_el = html.Element("ul")
    with open(f"../data/order/{directory}.txt", "r", encoding="utf-8") as f:
        files = [l.strip() for l in f]
    for fname in files:
        # with open(f"../sections/{directory}/{fname}.txt", "r", encoding="utf-8") as f:
        with open(f"../data/json/{directory}/{fname}.json", "r", encoding="utf-8") as f:
            page_data = json.load(f)
            # fcont = f.read()
        name = page_data["name"]
        extra = page_data.get("date") or page_data.get("subtitle")
        # if "date" in page_data:
        if extra:
            name += f" ({extra})"
        # elif "info" in page_data:
            # name += f" ({page_data["info"].split("\n", 1)[0]})"
        li_el = SubElement(ul_el, "li")
        a_el = SubElement(li_el, "a", href=f"{fname}.html")
        a_el.text = name
        if "parts" in page_data:
            has_pages = False
            min_page = 10000
            max_page = 0
            for part in page_data["parts"]:
                for s in part.get("songs", []):
                    if ("link" not in s) and ("page" in s):
                        has_pages = True
                        curr_pages = [int(pg) for pg in s["page"].split("/", 1)]
                        min_page = min(min_page, curr_pages[0])
                        max_page = max(max_page, curr_pages[-1])
            if has_pages:
                if max_page == min_page:
                    a_el.tail = f" ({min_page})"
                else:
                    a_el.tail = f" ({min_page}–{max_page})"

    section_el = html.Element("section")
    section_el.set("class", "index-section")
    section_el.set("data-index-section", directory)

    parent_el = h2_el.getparent()
    section_index = parent_el.index(h2_el)
    parent_el.insert(section_index, section_el)

    section_el.append(h2_el)
    section_el.append(next_el)
    section_el.append(ul_el)

body_el = root.find(".//body")
SubElement(body_el, "script", src="assets/js/collapsible-content.js")

strip_comments(root)

with open(f"../dist/index.html", "w", encoding="utf-8") as f:
    f.write(html.tostring(doc, pretty_print=True, method="html", encoding="unicode"))
