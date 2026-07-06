from glob import glob
from tqdm import tqdm
from lxml import etree
from subprocess import run, Popen, PIPE

from fname_utils import purify

import argparse
import os

FULL_WIDTH = "68.287"

parser = argparse.ArgumentParser()
parser.add_argument(
    '--all',
    '-a',
    action='store_true',
    default=False
)
parser.add_argument(
    '--dir',
    '-d',
    type=str,
    default="svg"
)
args = parser.parse_args()
dir = args.dir
dist_dir = f"../dist/assets/{dir}"
os.makedirs(dist_dir, exist_ok=True)

processed = set(purify(fn) for fn in glob(f"{dist_dir}/*.svg"))

attr_to_remove = {
    "text": ["font-family", "font-size", "text-anchor", "fill"],
    # "path": ["fill"],
    "rect": ["fill"],
    "line": ["stroke-linejoin", "stroke-linecap", "stroke-width", "stroke"]
}
ns = 'http://www.w3.org/2000/svg'

def true_tag(t):
    return t.split("}", 1)[1]

with open("../src/svg/svg_style.css", "r", encoding="utf-8") as f:
    style = f.read()

to_process = []
for fname in glob(f"../build/tmp/{dir}/*.svg"):
    pure_fname = purify(fname)
    if args.all or (pure_fname not in processed):
        to_process.append((fname, pure_fname))

for fname, pure_fname in tqdm(to_process):
# for fname in ["../build/tmp/svg/001a-1.svg"]:

    svgo1 = Popen(["svgo", fname, "-o", "-"], shell=True, stdout=PIPE)

    inkscape = Popen([
        "inkscape",
        "--pipe",
        "--export-area-drawing",
        "--export-plain-svg",
        "--export-type=svg",
        "--export-filename=-"
    ], stdin=svgo1.stdout, stdout=PIPE)

    svgo1.stdout.close()

    xml, err = inkscape.communicate()

    root = etree.fromstring(xml)

    root.find(f"{{{ns}}}style").text = style

    root.attrib.pop("width")
    root.attrib.pop("height")
    viewbox_parts = root.attrib["viewBox"].split()
    if float(viewbox_parts[2]) < float(FULL_WIDTH):
        viewbox_parts[2] = FULL_WIDTH
    root.attrib["viewBox"] = " ".join(viewbox_parts)

    for el in root.iter(*(f"{{{ns}}}{t}" for t in attr_to_remove.keys())):
        tag = true_tag(el.tag)
        for attr in attr_to_remove[tag]:
            if attr in el.attrib:
                del el.attrib[attr]

    for el in root.iter(f"{{{ns}}}path"):
        if "fill" in el.attrib:
            del el.attrib["fill"]
        else:
            el.attrib["fill"] = "none"

    for el in root.iter(f"{{{ns}}}tspan"):
        parent = el.getparent()
        parent.text = el.text
        parent.remove(el)

    for el in root.iter():
        if "id" in el.attrib:
            del el.attrib["id"]

    dot_text = root.find(f'.//{{{ns}}}text[@font-weight="bold"]')
    if dot_text is not None:
        dot_text.attrib["style"] = "text-anchor: end"

    xml = etree.tostring(root)

    run(
        ["svgo", "-", "-o", f"{dist_dir}/{pure_fname}.svg"],
        shell=True, capture_output=True, input=xml
    )
