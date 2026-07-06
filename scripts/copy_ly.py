from glob import iglob
from fname_utils import purify
import os
import re
import argparse

parser = argparse.ArgumentParser()
parser.add_argument(
    '--all',
    '-a',
    action='store_true',
    default=False
)
args = parser.parse_args()

for fname in iglob("../../mesni-zpevy-doprovody/ly/*.ly"):
    pure_fname = purify(fname)
    if not pure_fname.isdigit():
        continue

    with open(fname, "r", encoding="utf-8") as f:
        ly_fcont = f.read()

    free_time = "% TIME" not in ly_fcont
    music = re.search(r"(soprano = \{.*?\})\s+alto =", ly_fcont, flags=re.DOTALL)[1]
    music = music.replace("!", "").replace("?", "")

    target_ly = f"../data/lilypond/melodies/{pure_fname}.ly"
    if os.path.isfile(target_ly) and not args.all:
        continue
    with open(f"../data/lilypond/melodies/{pure_fname}.ly", "w", encoding="utf-8") as f:
        if free_time:
            f.write("% FREE_TIME\n")
        f.write(music)
