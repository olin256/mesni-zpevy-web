import json
import sys

page_no = int(sys.argv[1])

with open("../../mesni-zpevy-texty/strany_pisni.json", "r", encoding="utf-8") as f:
    page_data = json.load(f)

for key, data in page_data.items():
    for m in data["matches"]:
        if page_no in set(int(x) for x in m[1].split(",")):
            print(key, data["name"], m[0])