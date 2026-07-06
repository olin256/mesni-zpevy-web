#!/usr/bin/env python3
"""
Vygeneruje dist/assets/data/search_index.json pro klientské hledání.

Zdrojový formát písně:
  1. řádek = název
  další řádky = sloky, číslo sloky je na začátku řádku, např. "9. Dnes vám..."
  části verše mohou být oddělené znakem /
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SONGS_DIR = ROOT.parent / "mesni-zpevy-texty" / "txt"
DEFAULT_OUTPUT = ROOT / "dist" / "assets" / "data" / "search_index.json"
STANZA_RE = re.compile(r"^\s*(\d+[a-zA-Z]?)\.\s*(.*)$", re.UNICODE)


def strip_diacritics(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(
        ch for ch in decomposed if unicodedata.category(ch) != "Mn"
    )


def normalize_text(text: str) -> str:
    text = strip_diacritics(text.casefold())
    tokens = re.findall(r"[0-9a-zA-Z]+", text)
    return " ".join(tokens)


def tokenize(text: str) -> list[str]:
    normalized = normalize_text(text)
    return normalized.split() if normalized else []


def song_id_from_filename(path: Path) -> str:
    stem = path.stem.strip().lower()
    stem = re.sub(r"\s*\([^)]*\)\s*$", "", stem)

    match = re.match(r"^0*(\d+[a-z]?)$", stem)
    if match:
        return match.group(1)

    match = re.match(r"^0*(\d+[a-z]?)(?:[^0-9a-z].*)?$", stem)
    if match:
        return match.group(1)

    return stem


def split_segments(stanza_text: str) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for part in re.split(r"\s*/\s*", stanza_text):
        part = part.strip()
        if part:
            out.append({"text": part, "text_norm": normalize_text(part)})
    return out


def read_song(path: Path) -> dict[str, Any] | None:
    raw = path.read_text(encoding="utf-8-sig", errors="replace")
    raw = raw.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw:
        return None

    lines = [line.strip() for line in raw.split("\n") if line.strip()]
    if not lines:
        return None

    title = lines[0]
    stanzas: list[dict[str, Any]] = []

    for line_no, line in enumerate(lines[1:], start=2):
        match = STANZA_RE.match(line)
        if match:
            number = match.group(1)
            text = match.group(2).strip()
        else:
            number = None
            text = line.strip()
            print(
                f"Varování: {path.name}:{line_no} nemá číslo sloky na začátku",
                file=sys.stderr,
            )

        stanzas.append({
            "number": number,
            "text": text,
            "text_norm": normalize_text(text),
            "tokens": tokenize(text),
            "segments": split_segments(text),
        })

    title_tokens = tokenize(title)
    return {
        "id": song_id_from_filename(path),
        "file": path.name,
        "title": title,
        "title_norm": normalize_text(title),
        "title_tokens": title_tokens,
        "stanzas": stanzas,
    }


def build_index(songs_dir: Path) -> dict[str, Any]:
    files = sorted(songs_dir.glob("*.txt"), key=lambda p: p.name.lower())
    songs: list[dict[str, Any]] = []
    seen: dict[str, Path] = {}

    for path in files:
        song = read_song(path)
        if song is None:
            continue

        song_id = song["id"]
        if song_id in seen:
            print(
                f"Varování: duplicitní ID {song_id!r}: "
                f"{seen[song_id].name} a {path.name}",
                file=sys.stderr,
            )
        seen[song_id] = path
        songs.append(song)

    vocabulary = sorted(
        {
            token
            for song in songs
            for stanza in song["stanzas"]
            for token in stanza["tokens"]
        }
        | {
            token
            for song in songs
            for token in song["title_tokens"]
        }
    )

    return {
        "version": 2,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "song_count": len(songs),
        "songs": songs,
        "vocabulary": vocabulary,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Vygeneruje JSON index pro klientské hledání v písních."
    )
    parser.add_argument(
        "--songs-dir",
        default=str(DEFAULT_SONGS_DIR),
        help="Složka se zdrojovými .txt soubory písní",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Cílový JSON soubor",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Vygenerovat čitelně odsazený JSON",
    )
    args = parser.parse_args()

    songs_dir = Path(args.songs_dir)
    output = Path(args.output)

    if not songs_dir.is_dir():
        print(f"Chyba: složka s písněmi neexistuje: {songs_dir}", file=sys.stderr)
        return 1

    index = build_index(songs_dir)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            index,
            ensure_ascii=False,
            indent=2 if args.pretty else None,
            separators=None if args.pretty else (",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"Vygenerováno {index['song_count']} písní do {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
