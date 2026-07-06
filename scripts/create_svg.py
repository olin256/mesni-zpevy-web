from glob import glob
from tqdm import tqdm
from subprocess import run
from itertools import islice
from fname_utils import purify
from collections import defaultdict

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
    '--all',
    '-a',
    action='store_true',
    default=False
)
parser.add_argument(
    '--ignore-system-counts',
    '-i',
    action='store_true',
    default=False
)
parser.add_argument(
    '--png',
    '-p',
    action='store_true',
    default=False
)
parser.add_argument(
    '--first-only',
    '-f',
    action='store_true',
    default=False
)
parser.add_argument(
    '--resolution',
    '-r',
    type=int,
    default=300
)
args = parser.parse_args()

fmt = "png" if args.png else "svg"
os.makedirs(f"../build/tmp/{fmt}", exist_ok=True)
os.makedirs("../build/tmp/ly_svg", exist_ok=True)

roman = (
    "I,II,III,IV,V,VI,VII,VIII,IX,X,XI,XII,XIII,XIV,XV,XVI,"
    "XV,XVI,XVII,XVIII,XIX,XX,XXI,XXII,XXIII,XXIV,XXV"
).split(",")

with open("../build/generated/lilypond/system_counts.json", "r") as f:
    system_counts = json.load(f)

with open("../data/lilypond/rules/compact_songs.json", "r") as f:
    compact_songs = json.load(f)

with open("../data/lilypond/rules/ly_replacements.json", "r") as f:
    ly_replacements = json.load(f)

with open("../data/lilypond/template.ly", "r", encoding="utf-8") as f:
    template_fcont = f.read()

ly_template, score_template = template_fcont.split("% SCORE", 1)

with open("../../mesni-zpevy-texty/strany_pisni.json", "r", encoding="utf-8") as f:
    song_data = json.load(f)

lyrics_regex = re.compile(r"\S+(?: --)?")
option_regex = re.compile(r"\[(.*?)\]")

def lily_stanza(s, n, rep):
    def replace_option(m):
        global placeholders
        options = m[1].split("|")
        if rep is None:
            options = [
                re.sub(r"#([^\s#]*)", r' ".\1"', o)
                # o.replace("#", ' "."') 
                for o in options if "#" in o
            ]
            if len(options) == 1:
                return options[0]
            measure_option = options[0].replace("-", " ")
            option_syllable_count = len(measure_option.split())
            placeholders[n] = [
                re.sub(r"-+", " -- ", o)
                for o in options
            ]
            return "--".join([n]*option_syllable_count)
        rep_str = rep.get(n, "x--x--x")
        syllable_count = (rep_str.count("--")+1)*bool(rep_str)
        for option in options:
            if option.count("#") == syllable_count:
                if syllable_count:
                    return option.replace(syllable_count*"#", rep_str, 1)
                else:
                    return option
        return "?"
    s = s.strip()
    if "#" in s:
        # if rep == None:
            # rep = dict()
        # rep_str = rep.get(n, "x--x--x")
        # syllable_count = (rep_str.count("--")+1)*bool(rep_str)
        s = option_regex.sub(replace_option, s)
    s = s.replace(" / ", "\n")
    s = re.sub(r"-+", " -- ", s)
    s = lyrics_regex.findall(s)
    return s

def stanza_str(rom, lyrics, music_lengths, stanza_no=""):
    global placeholders
    lyrics = lyrics[:]
    ret = f"sloka{rom} = \\lyricmode {{\n"
    ret += f'\\set stanza = "{stanza_no}."\n'

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

    for n, options in placeholders.items():
        # print(n, options, f"{n}(?: -- {n})*")
        # exit()
        extra_lyrics = "\n".join((
            f"    \\\\new Lyrics {{\n"
            f'        \\\\set associatedVoice = "soprano"\n'
            f"        {option}\n"
            f"    }}"
        ) for option in options[1:])
        replace_str = (
            f"\n<<\n"
            f"    {{ {options[0]} }}\n"
            f"    {extra_lyrics}\n"
            f">>\n"
        )
        ret = re.sub(f"{n}(?: -- {n})*", replace_str, ret)

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

note_pattern = r"[a-g](?:is|es)?[,']*[\?!]?(?:[248]|16?)\.?"

repeat_regex = re.compile(r"\\repeat volta 2 \{(.*?)\}", flags=re.DOTALL)
note_slur_regex = re.compile(note_pattern + r"|[\(\)\[\]]")

def count_notes(music):
    ret = 0
    lig_open = False
    brace_open = False
    for m in note_slur_regex.finditer(music):
        mm = m[0]
        if mm == ")":
            lig_open = False
        elif mm == "]":
            brace_open = False
        elif mm == "(":
            lig_open = True
        elif mm == "[":
            brace_open = True
        elif not (lig_open or brace_open):
            ret += 1
    return ret

replacements = defaultdict(dict)

for fname in glob("../data/json/**/*.json"):
    pure_fname = purify(fname)
    try:
        with open(fname, "r", encoding="utf-8") as f:
            json_data = json.load(f)
    except Exception:
        continue
    if not (parts := json_data.get("parts")):
        continue
    for part in parts:
        for song in part["songs"]:
            if (reps := song.get("replacements")):
                replacements[song["melody"].zfill(4)][pure_fname] = reps


existing_svg = set(purify(fn).split("-")[0] for fn in glob(f"../build/tmp/{fmt}/*.{fmt}"))

available_texts = glob("../data/lyrics/broken/*.txt")
available_all = []
for fname in available_texts:
    pure_fname = purify(fname)
    if (not args.all) and (pure_fname in existing_svg):
        continue
    song_no = pure_fname[:-1]
    # ly_fname = f"../../mesni-zpevy/ly/{song_no}.ly"
    ly_fname = f"../data/lilypond/melodies/{song_no}.ly"
    if not os.path.isfile(ly_fname):
        continue
    if pure_fname in replacements:
        for json_fname, rep in replacements[pure_fname].items():
            if rep == "show_all":
                out_fname = pure_fname
                rep = None
            else:
                out_fname = f"{pure_fname}_{json_fname}"
            if args.all or (out_fname not in existing_svg):
                available_all.append((fname, pure_fname, out_fname, ly_fname, rep))
    else:
        available_all.append((fname, pure_fname, pure_fname, ly_fname, None))

processed = set()

for fname, pure_fname, out_fname, ly_fname, rep in tqdm(available_all):
    
    if out_fname in processed:
        continue
    processed.add(out_fname)

    compact = pure_fname in compact_songs

    with open(ly_fname, "r", encoding="utf-8") as f:
        music = f.read()

    # free_time = "% TIME" not in ly_fcont
    free_time = "% FREE_TIME" in music

    if free_time:
        music = music.split("\n", 1)[1]

    for replacement in ly_replacements.get(pure_fname, []):
        music = music.replace(*replacement)

    # music = re.search(r"(soprano = \{.*?\})\s+alto =", ly_fcont, flags=re.DOTALL)[1]

    repeat_split = repeat_regex.split(music)
    music_lengths = [count_notes(m) for m in repeat_split]

    if free_time:
        music_lines = music.split("|\n")
        new_music_lines = []
        for ml in music_lines:
            line_parts = re.split(f"({note_pattern})", ml)
            if len(line_parts) >= 5:
                line_parts[-2] = "\\once \\autoLineBreaksOff " + line_parts[-2]
            if len(line_parts) >= 7:
                line_parts[3] = "\\once \\autoLineBreaksOff " + line_parts[3]
            new_music_lines.append("".join(line_parts))

        music = "|\n".join(new_music_lines)

    music_template = ly_template

    if free_time:
        music_template = music_template.replace("% TIME", "\\omit TimeSignature", 1)
        music_template = music_template.replace("% BREAKS", "forbidBreakBetweenBarLines = ##f", 1)

    music_template = music_template.replace("% MUSIC", music, 1)

    if (pure_fname in system_counts) and not args.ignore_system_counts:
        music_template = music_template.replace(
            "% SYSTEM_COUNT",
            f"system-count = {system_counts[pure_fname]}",
            1
        )

    placeholders = dict()
    with open(fname, "r", encoding="utf-8") as f:
        stanzas = {
            int(n): lily_stanza(t, n, rep)
            for n, t in
            (l.split(". ", 1) for l in islice(f, 1, None))
        }

    if compact:
        total_lyrics = list()
        for i, stanza in enumerate(stanzas.values(), 1):
            if i != 1:
                stanza[0] = f'\\set stanza = "{i}." {stanza[0]}'
            total_lyrics.extend(stanza)
        stanzas = {1: total_lyrics}

    if args.first_only:
        stanzas = dict([next(iter(stanzas.items()))])

    lyrics_str = "\n\n".join(
        stanza_str(
            r, l, music_lengths,
            "1" if (args.first_only or compact) else ""
        )
        for r, l
        in zip(roman, stanzas.values())
    )

    curr_template = music_template.replace("% LYRICS", lyrics_str, 1)

    curr_template += "\n\\pageBreak\n".join(score_copy(r) for r in roman[:len(stanzas)])

    svg_fname = f"../build/tmp/{fmt}/{out_fname}"
    if len(stanzas) == 1:
        svg_fname += "-1"

    if args.lily:
         run([
                "lilypond",
                "-fpng" if args.png else "--svg",
                f"-dresolution={args.resolution}",
                "-o", svg_fname, "-"
            ],
            shell=True, encoding="utf-8", text=True, capture_output=True,
            input=curr_template
        )
    else:
        with open(f"../build/tmp/ly_svg/{out_fname}.ly", "w", encoding="utf-8") as f:
            f.write(curr_template)
