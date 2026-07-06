from apply_breaks_tf import break_lyrics
from fname_utils import purify

from glob import glob
from tqdm import tqdm
import os
import re

split_regex = re.compile(r"\s+|-+")

for fname in tqdm(glob("../../mesni-zpevy-texty/txt/*.txt")):
    pure_fname = purify(fname)
    target_fname = f"../data/lyrics/broken/{pure_fname}.txt"
    if os.path.isfile(target_fname):
        continue

    with open(fname, "r", encoding="utf-8") as f:
        fcont = f.read()

    song_name, lyrics = fcont.split("\n", 1)
    broken_lyrics = break_lyrics(lyrics, preserve_whitespace=True)

    lines = [l.strip() for l in broken_lyrics.split("\n")]
    len_tuples = [tuple(len(split_regex.split(p.strip())) for p in l.split(" / ")) for l in lines]
    # lens = [len(re.split(r"\s+|-+", sl.strip())) for sl in broken_lyrics.split("\n")]
    # if len(set(lens)) > 1:
    if len(set(len_tuples)) > 1:
        print(pure_fname)
        stanza_nos = [l.split(".", 1)[0] for l in lines]
        print([sum(t) for t in len_tuples])
        print(dict(zip(stanza_nos, len_tuples)))

    with open(target_fname, "w", encoding="utf-8") as f:
        f.write(song_name + "\n")
        f.write(broken_lyrics)