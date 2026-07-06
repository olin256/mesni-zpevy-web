import re
import json
import os
from glob import glob
from fname_utils import purify
from itertools import batched
from compact_json_encoder import CompactJSONEncoder

def link_file_to_dict(fcont):
    out_dict = dict()
    out_dict["type"] = "same_as"

    info, target = (l.strip() for l in fcont.split("JAKO", 1))
    info = info.split("\n", 1)
    out_dict["name"] = info[0]
    if len(info) != 1:
        out_dict["info"] = info[1]
    out_dict["target"] = target

    return out_dict




def section_file_to_dict(fcont):
    out_dict = dict()
    out_dict["type"] = "full"

    song_data_parts = re.split(r"(^#.*$)", fcont, flags=re.MULTILINE)
    info = song_data_parts[0].strip()
    info = info.split("\n", 1)
    out_dict["name"] = info[0]
    if len(info) != 1:
        out_dict["info"] = info[1]

    del song_data_parts[0]

    song_data = {
        t[1:].strip():
        [x.strip().split("\n") for x in part.split("NEBO")]
        for t, part in batched(song_data_parts, n=2)
    }

    out_dict["parts"] = []

    for part_title, sd in song_data.items():
        current_part = dict()
        current_part["title"] = part_title
        current_part["songs"] = []

        for song in sd:
            current_song = dict()
            current_song["page"] = song[-2]
            melody_parts = song[-1].split("-", 1)
            current_song["melody"] = melody_parts[0]
            if len(melody_parts) > 1:
                current_song["stanza_set"] = [int(s) for s in melody_parts[1].split(",")]
            if len(song) == 3:
                current_song["link"] = song[0]

            current_part["songs"].append(current_song)

        out_dict["parts"].append(current_part)

    return out_dict


section_files = [fn for fn in glob("../sections/**/*.txt") if purify(fn) != "_poradi"]

for fname in section_files:
    pure_fname = purify(fname)
    print(fname)
    section_dir = os.path.basename((os.path.dirname(fname)))

    with open(fname, "r", encoding="utf-8") as f:
        fcont = f.read()

    if "#" in fcont:
        out_dict = section_file_to_dict(fcont)
    else:
        out_dict = link_file_to_dict(fcont)

    out_dir = os.path.join("../data/json/", section_dir)
    out_fname = os.path.join(out_dir, f"{pure_fname}.json")

    os.makedirs(out_dir, exist_ok=True)
    with open(out_fname, "w", encoding="utf-8") as f:
        json.dump(out_dict, f, ensure_ascii=False, cls=CompactJSONEncoder)