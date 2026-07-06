import pandas as pd
import json
from pathlib import Path
from rapidfuzz import process

df = pd.read_csv("korejs_zalmy.csv")

df["cyklus"] = df["cyklus"].fillna("")

df["fullname"] = (df["prilezitost"] + " " + df["cyklus"]).str.strip()

fullnames = list(df["fullname"])

result = {}

for json_path in Path("../data/json/").rglob("*.json"):
    with open(json_path, "r", encoding="utf-8") as f:
        name = json.load(f)["name"]
    match, score, _ = process.extractOne(name, fullnames)
    result[name] = (match, score)

with open("match_korejs.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(f"{m[0]}\t{m[1][0]}\t{m[1][1]}" for m in result.items()))