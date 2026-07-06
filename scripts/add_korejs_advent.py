import pandas as pd
import json

df = pd.read_csv("korejs_zalmy.csv")
df = df[df["prilezitost"].str.endswith("neděle adventní")]

df["nedele"] = df["prilezitost"].str.extract(r"^(\d+)", expand=False).astype(int)

for ned in range(1, 5):
    vyber = df[(df["nedele"]==ned)]
    zpev_dict = {"title": "Zpěv po prvním čtení"}
    songs = []
    for row in vyber.itertuples(index=False):
        curr_link = {
            "filename": row.id,
            "kb_page": str(int(row.kb)) if not pd.isna(row.kb) else "?"
        }
        songs.append({
            "info_before": f"V ročním cyklu {row.cyklus}:",
            "response": row.odpoved,
            "links": [curr_link]
        })
    zpev_dict["songs"] = songs
    
    json_path = f"../data/json/advent/advent_{ned}.json"
    with open(json_path, "r", encoding="utf_8") as f:
        sect_data = json.load(f)

    if sect_data["parts"][1]["title"] == "Zpěv po prvním čtení":
        sect_data["parts"][1] = zpev_dict
    else:
        sect_data["parts"].insert(1, zpev_dict)
    with open(json_path, "w", encoding="utf_8") as f:
        json.dump(sect_data, f, ensure_ascii=False, indent=4)
