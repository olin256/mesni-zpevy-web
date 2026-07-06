# Refactored version of the original `create_html.py`
# ------------------------------------------------------
#   • keeps PEP 8 ≤ 88‑char lines
#   • introduces `section_path_map` so an alias can point to a file in a
#     *different* sub‑folder than its slug‑name
#   • `collect_section_paths()` now returns *both* list of paths (in order)
#     and the mapping {slug → Path}
#   • `AppContext` updated with the mapping; alias resolution consults it
# ------------------------------------------------------

from __future__ import annotations

from dataclasses import dataclass, field
from glob import glob
from itertools import islice
from collections import defaultdict
from pathlib import Path
from copy import deepcopy
from typing import Dict as _D, List as _L, Sequence as _S, Tuple as _T
import json
import os
import re

from fname_utils import purify
from html_utils import strip_comments
from lxml import html
from lxml.etree import SubElement
from multivaluedict import MultiValueDict

# ---------------------------------------------------------------------------
# ──────────────── Low‑level helpers (pure + easily testable) ────────────────
# ---------------------------------------------------------------------------

_OPTION_RE = re.compile(r"\[(.*?)\]")
_SHORT_RE = re.compile(r"(?<!\S)([ksvzKSVZ])\s")

_IntList = _L[int]
_PageToStanzas = _D[int, _IntList]


def stanza_list(spec: str) -> _IntList:
    """Expand stanza spec like "1,3‑5" ➜ [1, 3, 4, 5]."""
    out: _IntList = []
    for part in spec.split(","):
        start, *rest = part.split("-", 1)
        if not rest:
            if start.isdigit():  # ignore trash like "X‑Y"
                out.append(int(start))
            continue
        end: str = rest[0]
        out.extend(range(int(start), int(end) + 1))
    return out


def matches_to_stanza_lists(matches: _S[_S[str]],) -> _D[int, _IntList]:
    """Convert tuples ("1,3‑4", "12,13") ➜ {page: [stanzas]}."""
    result: _PageToStanzas = MultiValueDict()
    for spec, pages in matches:
        stanza_ids = stanza_list(spec)
        for p in pages.split(","):
            result[int(p)] = stanza_ids
    return result


def add_nonbreakable(text: str) -> str:
    return _SHORT_RE.sub("\\1\u00A0", text)


def replace_stanza_options(text: str, stanza_no: str,
                           replacements: _D[str, str] | None,) -> str:
    """Apply option‑replacement logic inside stanza line."""

    def _replace_option(match: re.Match[str]) -> str:  # noqa: ANN001
        options = match[1].split("|")
        if replacements is None:
            filtered_options = [o for o in options if "#" in o]
            options_str = "|".join(filtered_options)
            if len(filtered_options) == 1:
                return options_str
            else:
                return f"[{options_str}]"
        syl = (replacements or {}).get(stanza_no, "x--x--x")
        n = syl.count("--") + 1 if syl else 0
        clean = syl.replace("--", "")
        for option in options:
            if option.count("#") == n:
                return option.replace("#" * n, clean, 1) if n else option
        return "?"

    text = text.strip()
    if "#" not in text:
        return text

    return _OPTION_RE.sub(_replace_option, text)

# ---------------------------------------------------------------------------
# ─────────────────────────────── Data classes ───────────────────────────────
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class AppConfig:
    """Static configuration & path map."""

    root: Path = Path(__file__).resolve().parent

    template_html: Path = field(init=False)
    compact_songs_json: Path = field(init=False)
    page_data_json: Path = field(init=False)
    svg_dir: Path = field(init=False)
    lyrics_dir: Path = field(init=False)
    orders_dir: Path = field(init=False)
    json_dir: Path = field(init=False)
    html_out_dir: Path = field(init=False)
    assets_data_dir: Path = field(init=False)

    def __post_init__(self) -> None:  # noqa: D401
        r = self.root
        self.template_html = r / "../src/templates/html_template.html"
        self.compact_songs_json = r / "../data/lilypond/rules/compact_songs.json"
        self.page_data_json = r / "../../mesni-zpevy-texty/strany_pisni.json"
        self.svg_dir = r / "../build/tmp/svg"
        self.lyrics_dir = r / "../../mesni-zpevy-texty/txt"
        self.orders_dir = r / "../data/order"
        self.json_dir = r / "../data/json"
        self.html_out_dir = r / "../dist"
        self.assets_data_dir = self.html_out_dir / "assets/data"
        # self.html_out_dir = r / "../html_check"
        self.html_out_dir.mkdir(parents=True, exist_ok=True)
        self.assets_data_dir.mkdir(parents=True, exist_ok=True)


@dataclass(slots=True)
class AppContext:
    """Dynamic data loaded once for the whole run."""

    cfg: AppConfig
    compact_songs: set[str]
    song_names: _D[str, str]
    song_stanza_lists: _D[str, _PageToStanzas]
    available_songs: set[str]
    section_files: _L[Path]
    section_path_map: _D[str, Path]  # NEW: slug → absolute JSON path

# ---------------------------------------------------------------------------
# ──────────────────── Top‑level loading & preparation steps ─────────────────
# ---------------------------------------------------------------------------


def load_json(path: Path):  # noqa: ANN001
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def build_available_songs(svg_dir: Path, lyrics_dir: Path) -> set[str]:
    svg_ids = {purify(p.name)[:4] for p in svg_dir.glob("*.svg")}
    lyrics_ids = {purify(p.name) for p in lyrics_dir.glob("*.txt")}
    return {sid.lstrip("0") for sid in svg_ids & lyrics_ids}



def collect_section_paths(cfg: AppConfig):  # -> tuple[list[Path], dict[str,Path]]
    """Resolve order files ➜ ordered list and slug→path map."""
    ordered: _L[Path] = []
    slug_map: _D[str, Path] = {}
    for order in cfg.orders_dir.glob("*.txt"):
        sec_dir = cfg.json_dir / purify(order.name)
        with order.open(encoding="utf-8") as f:
            for raw in f:
                slug = raw.strip()
                if not slug:
                    continue
                full = sec_dir / f"{slug}.json"
                ordered.append(full)
                slug_map[slug] = full
    return ordered, slug_map


def build_context(cfg: AppConfig) -> AppContext:
    page_data = load_json(cfg.page_data_json)
    compact = set(load_json(cfg.compact_songs_json))
    names = {k: v["name"] for k, v in page_data.items()}
    song_stanza_lists = {
        k: matches_to_stanza_lists(v["matches"])
        for k, v in page_data.items()
    }
    available = build_available_songs(cfg.svg_dir, cfg.lyrics_dir)
    section_files, path_map = collect_section_paths(cfg)
    return AppContext(cfg, compact, names, song_stanza_lists, available,
                      section_files, path_map)

# ---------------------------------------------------------------------------
# ──────────────────────────── HTML generation core ──────────────────────────
# ---------------------------------------------------------------------------


class HtmlGenerator:  # noqa: D101
    def __init__(self, ctx: AppContext) -> None:
        self.ctx = ctx
        self.page_links: _D[int, str] = {}
        self.occurrences: _L[_D[str, str | int]] = []
        self.song_links: _D[str, _L[_D[str, str]]] = defaultdict(list)
        self.section_names: _D[str, str] = {}
        self.current_head = None

    # ───────── public API ─────────

    def render_all(self) -> None:  # noqa: D401
        self._collect_section_names()
        for fp in self.ctx.section_files:
            self._render_section(fp)
        self._derive_legacy_links()
        self._dump_occurrences()
        self._dump_page_links()
        self._dump_song_links()

    # ───────── implementation ─────────

    def _collect_section_names(self) -> None:
        for fp in self.ctx.section_files:
            data = load_json(fp)
            # extra = data.get("date") or data.get("info", "").split("\n", 1)[0]
            # extra = data.get("date") or data.get("subtitle")
            # name = f"{data['name']} ({extra})" if extra else data["name"]
            self.section_names[purify(fp.name)] = self._page_title(data)

    def _get_section_name(self, link_slug: str) -> str:
        section_name = self.section_names.get(link_slug, "?")
        if section_name == "?":
            print(f"missing link: {link_slug}")
        return section_name

    def _render_section(self, path: Path) -> None:
        data = load_json(path)
        slug = purify(path.name)
        section = path.parent.name
        doc = html.parse(str(self.ctx.cfg.template_html))
        root = doc.getroot()
        strip_comments(root)

        title = self._page_title(data)
        full_title = f"{title} | Mešní zpěvy online"
        root.find(".//title").text = full_title
        for title_prop in ["@property='og:title'", "@name='twitter:title'"]:
            title_el = root.xpath(f"//meta[{title_prop}]")[0]
            title_el.set("content", full_title)
        description = (
            f"Noty a texty písní ze zpěvníku "
            f"Mešní zpěvy pro příležitost: {title}"
        )
        for desc_prop in [
            "@property='og:description'",
            "@name='description'",
            "@name='twitter:description'"
        ]:
            desc_el = root.xpath(f"//meta[{desc_prop}]")[0]
            desc_el.set("content", description)
        og_img_url = f"https://mesnizpevy.cz/assets/og-images/{slug}.png"
        for img_prop in ["@property='og:image'", "@name='twitter:image'"]:
            image_el = root.xpath(f"//meta[{img_prop}]")[0]
            image_el.set("content", og_img_url)
        url_el = root.xpath(f"//meta[@property='og:url']")[0]
        url_el.set("content", f"https://mesnizpevy.cz/{slug}.html")

        body = root.find("body")
        for src in [
            "https://unpkg.com/swiper/swiper-bundle.min.js",
            "assets/js/score-viewer.js",
            "assets/js/collapsible-content.js"
        ]:
            SubElement(body, "script", src=src)

        main = root.find(".//main")
        header = html.fromstring(f"<div>{self._build_header(data)}</div>")
        main.insert(0, header)

        last_sec, prev_page, page_counter = header, None, 0
        linked = False

        if data.get("type") == "same_as":  # resolve alias via map
            linked = True
            target_slug = data["target"]
            target_path = self.ctx.section_path_map.get(target_slug)
            if not target_path:
                raise FileNotFoundError(f"Alias target '{target_slug}' unknown")
            data = load_json(target_path)

        song_stanza_lists = deepcopy(self.ctx.song_stanza_lists)

        for part in data["parts"]:
            sec = html.Element("section"); last_sec.addnext(sec); last_sec = sec
            part_title = part.get("title")
            self.current_head = SubElement(sec, "h2")
            if part_title:
                self.current_head.text = f"{part_title} "  # type: ignore
            first_option = True
            for song in part["songs"]:
                if "response" in song:
                    self._render_psalm(sec, first_option, song, slug)
                else:
                    prev_page, page_counter = self._render_song(
                        sec, first_option, song, slug,
                        section, linked, prev_page, page_counter, song_stanza_lists
                    )
                first_option = False

        if (alternatives := data.get("alternatives")):
            if data["type"] == "partial":
                intro = "Ostatní písně jako"
            else:
                intro = "Nebo písně"
            alt_links = " anebo ".join(
                f"<a href='{alt}.html'>{self._get_section_name(alt)}</a>"
                for alt in alternatives
            )
            alternative_p = html.fromstring(
                f"<p>{intro}: {alt_links}</p>"
            )
            last_sec.addnext(alternative_p)

        out = self.ctx.cfg.html_out_dir / f"{slug}.html"
        out.write_text(html.tostring(doc, pretty_print=True, method="html",
                                     encoding="unicode"), encoding="utf-8")
        print("✔", out)

    def _load_lyrics(self, melody_padded: str,
                     replacements: _D[str, str] | None,) -> _D[int, _T[int, str]]:
        song_path = self.ctx.cfg.lyrics_dir / f"{melody_padded}.txt"
        lines = song_path.read_text(encoding="utf-8").splitlines()[1:]
        return {
            int(n): (i, replace_stanza_options(t, n, replacements))
            for i, (n, t) in
            ((i, l.split(". ", 1)) for i, l in enumerate(lines, 1))
        }

    def _create_slides(
        self,
        svg_fname: str,
        start_stanza: int,
        stanza_svgs: _L[str],
        use_swiper: bool,
    ) -> _L[html.Element]:
        if not use_swiper:
            stanza_svgs = stanza_svgs[:1]
        return [html.Element(
            "div",
            attrib={
                "data-svg": f"{svg_fname}-{st}",
                "data-num": str(i),
                "class": "swiper-slide"
            }
        ) for i, st in enumerate(stanza_svgs, start_stanza)]

    def _create_lyric_list(
        self,
        start_stanza: int,
        stanza_info: _D[str, str] | None,
        stanza_list: _L[int],
        stanza_lyrics: _D[int, _T[int, str]],
    ) -> html.Element:
        stanza_info = stanza_info or {}
        ol_el = html.Element("ol")
        if start_stanza != 1:
            ol_el.set("start", str(start_stanza))
        for i, st in enumerate(stanza_list, start_stanza):
            li_el = SubElement(ol_el, "li")
            curr_stanza_lyrics = add_nonbreakable(stanza_lyrics[st][1])
            if (curr_stanza_info := stanza_info.get(str(i))):
                stanza_info_span = SubElement(
                    li_el,
                    "span",
                    attrib={"class": "stanza-info"}
                )
                stanza_info_span.text = curr_stanza_info
                stanza_info_span.tail = f" {curr_stanza_lyrics}"
            else:
                li_el.text = curr_stanza_lyrics

        return ol_el

    def _create_organ_info(
        self,
        melody: str,
    ) -> html.Element:
        melody_common = melody.zfill(4)[:-1]
        return html.fromstring(
            f"<p class='organ-info'>Píseň {melody}; "
            f"<a href='midi_voice/{melody_common}_voice.mid'>MIDI hlas</a> "
            f"<a href='midi_organ/{melody_common}_organ.mid'>MIDI varhany</a> "
            f"<a href='https://olin256.github.io/mesni-zpevy-doprovody/pdf/{melody_common}.pdf'>"
            "PDF varhany</a></p>"
        )

    def _render_song(
        self,
        parent: html.Element,
        first_option: bool,
        song: _L[_D[str, str]],
        slug: str,
        section: str,
        linked: bool,
        prev_page: int | None,
        page_counter: int,
        song_stanza_lists: _D[str, _PageToStanzas],
    ) -> int | None:
        """Insert song block and return its final page number."""
        melody = song["melody"]
        if melody not in self.ctx.available_songs:
            print(f"missing: {melody}")
            return prev_page, page_counter  # skip missing song

        melody_padded = melody.zfill(4)

        page = int(song["page"].split("/", 1)[0])
        link_slug = song.get("link")
        is_compact = melody in self.ctx.compact_songs
        is_hidden = link_slug and (not first_option)

        replacements = song.get("replacements")
        if replacements == "show_all":
            replacements = None
        stanza_lyrics = self._load_lyrics(melody_padded, replacements)
        stanza_list = song_stanza_lists[melody][page]
        stanza_list_str = ",".join(f"{s}" for s in stanza_list)

        if (stanza_set := song.get("stanza_set")):
            start_stanza = stanza_set[0]
            stanza_list = [stanza_list[i-1] for i in stanza_set]
        else:
            start_stanza = 1

        stanza_svgs = [stanza_lyrics[st][0] for st in stanza_list]

        if not first_option:
            self.current_head = SubElement(parent, "h3")
            self.current_head.text = "Nebo "

        page_no_el = SubElement(
            self.current_head,
            "span",
            attrib={"class": "page-number"}
        )
        page_no_el.text = f"({page})"

        if not (link_slug or linked):
            anchor = f"{page}"
            if prev_page == page:
                page_counter += 1
            else:
                page_counter = 0
            prev_page = page
            if page_counter:
                anchor += f"-{page_counter}"
            self.current_head.attrib["id"] = f"pg{anchor}"
            self.occurrences.append({
                "song": melody,
                "page": page,
                "slug": slug,
                "anchor": anchor,
                "stanzas": stanza_list_str,
                "title": self._get_section_name(slug),
                "section": section,
            })
        # if not any([
            # link_slug,
            # linked,
            # prev_page == page,
            # page in self.page_links
        # ]):
            # self.current_head.attrib["id"] = f"pg{page}"
            # self.page_links[page] = slug

        if (info_before := song.get("info_before")):
            info_before_p = SubElement(parent, "p")
            info_before_p.text = info_before

        use_swiper = (len(stanza_list) > 1) and (not is_compact)

        swiper_container = html.Element(
            "div",
            attrib={"class": "swiper-container" if use_swiper else "single-container"}
        )
        swiper_wrapper = SubElement(
            swiper_container,
            "div",
            attrib={"class": "swiper-wrapper"}
        )
        svg_fname = melody_padded
        if replacements:
            svg_fname += f"_{slug}"

        for slide in self._create_slides(
            svg_fname, start_stanza, stanza_svgs, use_swiper
        ):
            swiper_wrapper.append(slide)

        if use_swiper:
            for direction in ["next", "prev"]:
                SubElement(
                    swiper_container,
                    "div",
                    attrib={"class": f"swiper-button-{direction}"}
                )

        lyrics_ol = self._create_lyric_list(
            start_stanza,
            song.get("stanza_info"),
            stanza_list,
            stanza_lyrics,
        )

        organ_info_p = self._create_organ_info(melody)

        if is_hidden:
            link_info_p = html.fromstring(
                f"<p class='link-info'>"
                f"{self.ctx.song_names[melody]}… "
                f"(jako při: <a href='{link_slug}.html'>"
                f"{self._get_section_name(link_slug)}</a>"
                f" – str. {page})"
                f"</p>"
            )
            hidden_div = html.Element("div", attrib={"class": "hidden"})
            hidden_div.append(swiper_container)
            hidden_div.append(lyrics_ol)
            hidden_div.append(organ_info_p)

            parent.append(link_info_p)
            parent.append(hidden_div)
        else:
            parent.append(swiper_container)
            parent.append(lyrics_ol)
            parent.append(organ_info_p)

        return prev_page, page_counter


    def _render_psalm(
        self,
        parent: html.Element,
        first_option: bool,
        song: _L[_D[str, str]],
        slug: str,
    ) -> int | None:
        if not first_option:
            self.current_head = SubElement(parent, "h3")
            self.current_head.text = "Nebo"

        if (info_before := song.get("info_before")):
            info_before_p = SubElement(parent, "p")
            info_before_p.text = info_before

        response = song["response"].zfill(2)
        swiper_container = SubElement(
            parent,
            "div",
            attrib={"class": "single-container"}
        )
        swiper_wrapper = SubElement(
            swiper_container,
            "div",
            attrib={"class": "swiper-wrapper"}
        )
        slide = SubElement(
            swiper_wrapper,
            "div",
            attrib={
                "data-svg": f"K{response}",
                "class": "swiper-slide"
            }
        )
        organ_links = " nebo ".join(
            (
                f"{l.get("info", "")} žaltář str. {l["kb_page"]} "
                f"<a href='http://sdh.cz/korejs/zalmy/{l["filename"]}.pdf'>"
                f"Verše a varhanní doprovod</a>"
            ) for l in song["links"]
        ).strip()
        organ_info_p = html.fromstring(
            f"<p class='organ-info'>Odpověď K{song["response"]}; {organ_links}</p>"
        )
        parent.append(organ_info_p)

    def _derive_legacy_links(self) -> None:
        """Derive grouped legacy indexes from the flat occurrence list."""
        self.page_links = {}
        self.song_links = defaultdict(list)

        for occurrence in self.occurrences:
            page = int(occurrence["page"])
            if page not in self.page_links:
                self.page_links[page] = str(occurrence["slug"])

            self.song_links[str(occurrence["song"])].append({
                "slug": str(occurrence["slug"]),
                "anchor": str(occurrence["anchor"]),
                "stanzas": str(occurrence["stanzas"]),
                "title": str(occurrence["title"]),
            })

    def _dump_occurrences(self) -> None:
        """Export flat song/page occurrences as JSON."""
        out = self.ctx.cfg.assets_data_dir / "occurrences.json"
        with out.open("w", encoding="utf-8") as f:
            json.dump(self.occurrences, f, ensure_ascii=False, indent=2)

    def _dump_page_links(self) -> None:
        """Export {page → link} mapping as JSON."""
        out = self.ctx.cfg.assets_data_dir / "page_links.json"
        with out.open("w", encoding="utf-8") as f:
            json.dump(self.page_links, f, ensure_ascii=False, indent=2)

    def _dump_song_links(self) -> None:
        """Export {melody → links} mapping as JSON."""
        out = self.ctx.cfg.assets_data_dir / "song_links.json"
        with out.open("w", encoding="utf-8") as f:
            json.dump(self.song_links, f, ensure_ascii=False, indent=2)


    # ───────── helpers ─────────

    @staticmethod
    def _build_header(data: dict) -> str:  # noqa: ANN001
        title = data["name"]
        info_lines = filter(None, data.get("info", "").split("\n"))
        sub = ", ".join(filter(
            None,
            (data.get(p) for p in ["date", "subtitle", "rank"])
        ))
        parts = [f"<h1>{title}</h1>"]
        if sub:
            parts.append(f"<p class='subheading'>{sub}</p>")
        parts.extend(l if l.startswith("<") else f"<p>{l}</p>" for l in info_lines)
        return "".join(parts)

    @staticmethod
    def _page_title(data: dict) -> str:  # noqa: ANN001
        extra = data.get("date") or data.get("subtitle")
        title = f"{data['name']} ({extra})" if extra else data["name"]
        return title

# ---------------------------------------------------------------------------
# ─────────────────────────────── Entry point ───────────────────────────────
# ---------------------------------------------------------------------------


def main() -> None:  # noqa: D401
    HtmlGenerator(build_context(AppConfig())).render_all()


if __name__ == "__main__":  # noqa: D401
    main()
