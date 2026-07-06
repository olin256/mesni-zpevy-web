import pandas as pd
import json

df = pd.read_csv("korejs_zalmy.csv")
df = df[df["prilezitost"].str.endswith("neděle v mezidobí")]

df["nedele"] = df["prilezitost"].str.extract(r"^(\d+)", expand=False).astype(int)

for ned in range(2, 34):
    for cyklus in "ABC":
        vyber = df[(df["nedele"]==ned) & (df["cyklus"]==cyklus)]
        # print(ned, cyklus, len(vyber))
        zpev_dict = {"title": "Zpěv po prvním čtení"}
        songs = []
        # rows = list(vyber.itertuples(index=False))
        last_response = None
        for row in vyber.itertuples(index=False):
            response = row.odpoved
            curr_link = {
                "filename": row.id,
                "kb_page": str(int(row.kb)) if not pd.isna(row.kb) else "?"
            }
            if response == last_response:
                songs[-1]["links"].append(curr_link)
            else:
                songs.append({
                    "response": response,
                    "links": [curr_link]
                })
            last_response = response
        # print(ned, cyklus)
        zpev_dict["songs"] = songs
        json_path = f"../data/json/mezidobi/mezidobi_{ned:02}_{cyklus}.json"
        with open(json_path, "r", encoding="utf_8") as f:
            sect_data = json.load(f)

        if sect_data["parts"][1]["title"] == "Zpěv po prvním čtení":
            sect_data["parts"][1] = zpev_dict
        else:
            sect_data["parts"].insert(1, zpev_dict)
        with open(json_path, "w", encoding="utf_8") as f:
            json.dump(sect_data, f, ensure_ascii=False, indent=4)
