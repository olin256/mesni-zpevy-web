from glob import glob
from lxml import etree
from itertools import groupby
from pathlib import Path

from fname_utils import purify

import json

ns = 'http://www.w3.org/2000/svg'

clef_data = "M266 -635h-6c-108 0 -195 88"

data = dict()

def song_no(fname):
    return purify(fname)[:4]

for sn, fnames in groupby(glob("../build/tmp/svg/*.svg"), song_no):
    max_systems = 0
    for fname in fnames:
        systems = 0
        tree = etree.parse(fname)
        root = tree.getroot()
        for path in root.iter(f"{{{ns}}}path"):
            if path.attrib["d"].startswith(clef_data):
                systems += 1
        max_systems = max(max_systems, systems)

    data[sn] = max_systems

out = Path("../build/generated/lilypond/system_counts.json")
out.parent.mkdir(parents=True, exist_ok=True)
with out.open("w") as f:
    json.dump(data, f, indent=4)
