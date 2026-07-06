from PIL import Image, ImageDraw, ImageFont
from glob import iglob
from fname_utils import purify
from tqdm import tqdm
import re
import json
import os

FONT_PATH = r"C:\Users\slavi\AppData\Local\Microsoft\Windows\Fonts\c059-roman.otf"

def text_width(draw, text, font):
    l, t, r, b = draw.textbbox((0, 0), text, font=font)
    return r - l

def _break_long_token(draw, token, font, max_width):
    """Rozseká příliš dlouhý token (např. dlouhé slovo) na kratší kusy.
       Zachová znaky včetně \xa0. Neprovádí dělení se spojovníkem."""
    if text_width(draw, token, font) <= max_width:
        return [token]
    chunks, cur = [], ""
    for ch in token:
        test = (cur + ch)
        if text_width(draw, test, font) <= max_width or cur == "":
            cur = test
        else:
            chunks.append(cur)
            cur = ch
    if cur:
        chunks.append(cur)
    return chunks

def wrap_center_avoid_widow_single(draw, text, font, max_width_px,
                                   min_last_ratio=0.25, min_last_words=1):
    """
    Zalamuje JEDINÝ odstavec textu (bez \n) do šířky max_width_px,
    respektuje nedělitelné mezery \xa0 a brání „vdově“ (příliš krátkému poslednímu řádku).
    Vrací seznam řádků (strings).
    """
    # 1) Normalizuj běžné mezery, zachovej NBSP \xa0; split jen na běžné mezery
    text = re.sub(r"[ \t]+", " ", text.strip())
    tokens = re.split(r" ", text)  # NBSP (\xa0) zůstává uvnitř tokenů

    # 2) Zalamování podle šířky (po „slovech“; token může obsahovat \xa0 uvnitř)
    lines, line_tokens = [], []
    for tok in tokens:
        # když je token extrémně dlouhý, rozsekáme ho na chunks
        tok_parts = _break_long_token(draw, tok, font, max_width_px)
        for part in tok_parts:
            candidate = (" ".join(line_tokens + [part])).strip()
            if text_width(draw, candidate, font) <= max_width_px or not line_tokens:
                line_tokens.append(part)
            else:
                lines.append(" ".join(line_tokens))
                line_tokens = [part]
    if line_tokens:
        lines.append(" ".join(line_tokens))

    # 3) Ochrana proti „vdově“ (poslední řádek moc úzký / málo slov)
    def last_too_short(ls):
        if len(ls) < 2:
            return False
        last = ls[-1].strip()
        if not last:
            return False
        too_narrow = text_width(draw, last, font) < (min_last_ratio * max_width_px)
        too_few = len(last.split(" ")) < min_last_words  # NB: dělíme jen na běžné mezery
        return too_narrow or too_few

    # Přelévat slova z předposledního na poslední, dokud to dává smysl
    while last_too_short(lines):
        prev_words = lines[-2].split(" ")
        last_words = lines[-1].split(" ")
        if len(prev_words) <= 1:
            break
        move = prev_words.pop()              # přesun 1 slova
        candidate_prev = " ".join(prev_words)
        candidate_last = " ".join([move] + last_words)
        if (text_width(draw, candidate_prev, font) <= max_width_px and
            text_width(draw, candidate_last, font) <= max_width_px):
            lines[-2] = candidate_prev
            lines[-1] = candidate_last
        else:
            break

    return lines

slugs = []
os.makedirs("../dist/assets/og-images", exist_ok=True)

for fname in iglob("../data/order/*.txt"):
    # folder = purify(fname)
    with open(fname, "r") as f:
        slugs.extend(filter(None, map(lambda x: x.strip(), f)))

for slug in tqdm(slugs):
    html_fname = f"../dist/{slug}.html"
    with open(html_fname, "r", encoding="utf-8") as hf:
        content = hf.read()
    title_match = re.search(r"<title>(.*?)</title>", content, re.IGNORECASE | re.DOTALL)
    # if not title_match:
        # continue
    title = title_match[1].split("|", 1)[0].strip()

    title = re.sub(r"(\.|\W[ksvz])\s+", "\\1\xa0", title, flags=re.IGNORECASE)

    svg_match = re.search(r'data-svg="(.*?)"', content, re.IGNORECASE | re.DOTALL)
    # if not svg_match:
        # continue

    svg_fname = svg_match[1]

    img = Image.open("../src/assets/images/og-template.png").convert("RGB")
    draw = ImageDraw.Draw(img)

    font_size = 45 if len(title) < 50 else 35
    font = ImageFont.truetype(FONT_PATH, font_size)

    max_text_width = 700
    x_left = (img.width - max_text_width) // 2
    text_start_y = 150
    lines = wrap_center_avoid_widow_single(draw, title, font, max_text_width,
                                           min_last_ratio=0.2, min_last_words=1)

    # spočítej výšku bloku (užitečné, když chceš i vertikální centrování)
    ascent, descent = font.getmetrics()
    spacing = 8
    line_height = ascent + descent + spacing
    total_text_height = len(lines) * line_height

    # vykreslení středem v rámci boxu o šířce max_text_width
    y = text_start_y
    for line in lines:
        w = text_width(draw, line, font)
        x = x_left + (max_text_width - w) // 2
        draw.text((x, y), line, font=font, fill="black")
        y += line_height

    img_margin = 20
    max_sheet_height = img.height - total_text_height - text_start_y - img_margin
    max_sheet_width = 650

    sheet_img = Image.open(f"../build/tmp/png_processed/{svg_fname}.png").convert("RGB")
    sheet_img.thumbnail((max_sheet_width, max_sheet_height), Image.LANCZOS)
    x = (img.width - sheet_img.width) // 2

    y = text_start_y + total_text_height + (max_sheet_height - sheet_img.height) // 2

    # print(x, y)
    # exit()

    img.paste(sheet_img, (x, y))

    img.save(f"../dist/assets/og-images/{slug}.png")


    # font = ImageFont.truetype("calibri.ttf", 36)




    # lines = wrap_center_avoid_widow_single(draw, text, font, max_text_width,
                                           # min_last_ratio=0.2, min_last_words=1)


    # img.save("wrapped_center_nbsp.png")
