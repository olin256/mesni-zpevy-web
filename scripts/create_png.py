from glob import glob
from tqdm import tqdm
from subprocess import run
from itertools import islice
from fname_utils import purify

import re
import os
import json
import argparse

parser = argparse.ArgumentParser()
parser.add_argument(
    '--lily',
    '-l',
    action='store_true',
    default=False
)
parser.add_argument(
    '--first',
    '-f',
    action='store_true',
    default=False
)
args = parser.parse_args()
os.makedirs("../build/tmp/png", exist_ok=True)

roman = (
    "I,II,III,IV,V,VI,VII,VIII,IX,X,XI,XII,XIII,XIV,XV,XVI,"
    "XV,XVI,XVII,XVIII,XIX,XX,XXI,XXII,XXIII,XXIV,XXV"
).split(",")

with open("../data/lilypond/template.ly", "r", encoding="utf-8") as f:
    template_fcont = f.read()

ly_template, score_template = template_fcont.split("% SCORE", 1)

with open("../../mesni-zpevy-texty/strany_pisni.json", "r", encoding="utf-8") as f:
    song_data = json.load(f)

lyrics_regex = re.compile(r"\S+(?: --)?")

def lily_stanza(s):
    s = s.strip()
    s = s.replace(" / ", "\n")
    s = re.sub(r"-+", " -- ", s)
    s = lyrics_regex.findall(s)
    return s

def stanza_str(i, rom, lyrics, music_lengths):
    lyrics = lyrics[:]
    ret = f"sloka{rom} = \\lyricmode {{\n"
    ret += f'\\set stanza = "{i}."\n'

    repeat = True
    for ml in music_lengths:
        repeat = not repeat
        if not ml:
            continue
        if repeat:
            take, take_rep, lyrics = lyrics[:ml], lyrics[ml:2*ml], lyrics[2*ml:]
            ret += (
                f"<<\n"
                f"    {{ {" ".join(take)} }}\n"
                f"    \\new Lyrics {{\n"
                f'        \\set associatedVoice = "soprano"\n'
                f"        {" ".join(take_rep)}\n"
                f"    }}\n"
                f">>\n"
            )
        else:
            take, lyrics = lyrics[:ml], lyrics[ml:]
            ret += " ".join(take) + "\n"

    ret += "}"
    return ret

def stanza_list(s):
    ret = []
    for p in s.split(","):
        pp = p.split("-", 1)
        if len(pp) == 1:
            ret.append(int(p))
        else:
            ret.extend(range(int(pp[0]), int(pp[1])+1))
    return ret

def score_copy(rom):
    return score_template.replace("% VERSE", f"\\sloka{rom}", 1)

repeat_regex = re.compile(r"\\repeat volta 2 \{(.*?)\}", flags=re.DOTALL)
note_regex = re.compile(r"[a-g](?:is|es)?[,']*[\?!]?[1248]|\(|\)|\[|\]")

def count_notes(music):
    ret = 0
    lig_open = False
    brace_open = False
    for m in note_regex.finditer(music):
        mm = m[0]
        if mm == ")":
            lig_open = False
            ret += not brace_open
        elif mm == "]":
            brace_open = False
            ret += not lig_open
        elif mm == "(":
            lig_open = True
        elif mm == "[":
            brace_open = True
        elif not (lig_open or brace_open):
            ret += 1
    return ret

for fname in tqdm(glob("../data/lyrics/broken/*.txt")):
    pure_fname = purify(fname)
    song_no = pure_fname[:-1]
    ly_fname = f"../../mesni-zpevy-doprovody/ly/{song_no}.ly"
    if not os.path.isfile(ly_fname):
        continue

    with open(ly_fname, "r", encoding="utf-8") as f:
        ly_fcont = f.read()

    free_time = "% TIME" not in ly_fcont

    music = re.search(r"(soprano = \{.*?\})\s+alto =", ly_fcont, flags=re.DOTALL)[1]

    repeat_split = repeat_regex.split(music)
    music_lengths = [count_notes(m) for m in repeat_split]

    music_template = ly_template

    if free_time:
        music_template = music_template.replace("% TIME", "\\omit TimeSignature", 1)

    music_template = music_template.replace("% MUSIC", music, 1)

    with open(fname, "r", encoding="utf-8") as f:
        stanzas = {
            int(n): lily_stanza(t)
            for n, t in
            (l.split(". ", 1) for l in islice(f, 1, None))
        }

    matches = song_data[pure_fname.lstrip("0")]["matches"]
    stanza_lists = [stanza_list(s) for s, _ in matches]

    for i, sl in enumerate(stanza_lists, 1):
        curr_stanzas = [stanzas[j] for j in sl]

        lyrics_str = "\n\n".join(
            stanza_str(j, r, l, music_lengths)
            for j, (r, l)
            in enumerate(zip(roman, curr_stanzas), 1)
        )

        curr_template = music_template.replace("% LYRICS", lyrics_str, 1)

        curr_template += "\n\\pageBreak\n".join(score_copy(r) for r in roman[:len(sl)])

        png_fname = f"../build/tmp/png/{pure_fname}_{i}"

        resolution = 300

        if args.lily:
             run([
                    "lilypond",
                    "-fpng",
                    f"-dresolution={resolution}",
                    "-o", png_fname, "-"
                ],
                shell=True, encoding="utf-8", text=True, capture_output=True,
                input=curr_template
            )
        else:
            with open(f"../data/lilypond/melodies/{pure_fname}_{i}.ly", "w", encoding="utf-8") as f:
                f.write(curr_template)
