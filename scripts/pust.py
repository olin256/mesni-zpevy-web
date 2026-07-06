import json
from glob import glob
import re
import os
from fname_utils import purify

with open("../../mesni-zpevy-texty/strany_pisni.json", "r", encoding="utf-8") as f:
    page_data = json.load(f)

song_names = {k: v["name"] for k, v in page_data.items()}

pattern = re.compile(r".*_X\d\.txt$")

fnames = [fn for fn in glob("../sections/pust/*.txt") if pattern.search(fn)]

file_regex = re.compile(
    (
        r"(.*?)\s*"
        r"VSTUP\s+(.*?)\s+"
        r"EVANGELIUM\s+(.*?)\s+"
        r"PRŮVOD\s+(.*?)\s+"
        r"PŘIJÍMÁNÍ\s+(.*?)\s*"
        "$"
    ),
    flags=re.DOTALL
)

for fname in fnames:
    pure_fname = purify(fname)
    with open(fname, "r", encoding="utf-8") as f:
        fcont = f.read()
    if "JAKO" in fcont:
        _, new_fname = fcont.split("JAKO", 1)
        new_fname = new_fname.strip()
        new_fname = os.path.join("../sections/pust", f"{new_fname}.txt")
        with open(new_fname, "r", encoding="utf-8") as f:
            fcont = f.read()
    m = file_regex.match(fcont)
    # print(m.groups())
    # continue
    outp = [pure_fname]
    for part in m.groups()[1:]:
        songs = [f"{song_names[s]} ({s})" for s in re.findall(r"\s(\d+[a-z])(?:\s|$)", part)]
        outp.append(" / ".join(songs))
    print("\t".join(outp))