from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
DIST_ASSETS = DIST / "assets"


def copy_tree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    if src.exists():
        shutil.copytree(src, dst)


DIST.mkdir(parents=True, exist_ok=True)
DIST_ASSETS.mkdir(parents=True, exist_ok=True)

for item in (SRC / "assets").iterdir():
    target = DIST_ASSETS / item.name
    if item.is_dir():
        copy_tree(item, target)
    else:
        shutil.copy2(item, target)

copy_tree(SRC / "css", DIST_ASSETS / "css")
copy_tree(SRC / "js", DIST_ASSETS / "js")

manifest = DIST_ASSETS / "manifest.json"
if manifest.exists():
    shutil.copy2(manifest, DIST / "manifest.json")
