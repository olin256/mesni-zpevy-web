from pathlib import Path
import argparse
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument("songs", nargs="+")
args = parser.parse_args()
masks = [f"{s}*.svg" for s in args.songs]

for folder in ["build/tmp/svg", "dist/assets/svg"]:
    for mask in masks:
        for file in Path(f"../{folder}").glob(mask):
            if file.is_file():
                file.unlink()

scripts = [
    ["create_svg.py", "--lily"],
    ["process_svgs.py"],
    ["create_html.py"]
]

for script in scripts:
    subprocess.run([sys.executable, *script], check=True)
