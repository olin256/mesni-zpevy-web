from glob import glob
from PIL import Image, ImageChops, ImageOps
from ordered_set import OrderedSet
from tqdm import tqdm
import os

from fname_utils import purify

def trim_image(img):
    # Odečtení bílé barvy od obrázku k získání minimálního ohraničujícího boxu
    bg = Image.new(img.mode, img.size, (255, 255, 255))
    diff = ImageChops.difference(img, bg)
    diff = ImageChops.add(diff, diff)
    bbox = diff.getbbox()
    if bbox:
        return img.crop(bbox)  # Oříznutí na oblast obsahu
    return img  # Pokud není co ořezávat, vrátí původní obrázek

def load_and_trim_images(image_paths):
    images = []
    max_width, max_height = 0, 0

    # Načtení a trimování obrázků, zjištění maximálních rozměrů
    for path in image_paths:
        img = Image.open(path)
        trimmed_img = trim_image(img)  # Použití funkce trim_image
        # trimmed_img = ImageOps.crop(img, border=0)  # Trimování bílých okrajů
        images.append(trimmed_img)

        # Aktualizace maximálních rozměrů
        max_width = max(max_width, trimmed_img.width)
        max_height = max(max_height, trimmed_img.height)

    return images, max_width, max_height

def resize_and_pad_images(images, max_width, max_height):
    processed_images = []

    for img in images:
        # Vytvoření plátna s bílým pozadím na maximální rozměry
        new_img = Image.new("RGB", (max_width, max_height), (255, 255, 255))
        new_img.paste(img, (0, 0))  # Umístění obrázku do levého horního rohu
        processed_images.append(new_img)

    return processed_images

def process_images(image_paths):
    # Načtení a trimování obrázků, zjištění maximálních rozměrů
    images, max_width, max_height = load_and_trim_images(image_paths)
    # Změna velikosti obrázků a přidání bílých okrajů
    processed_images = resize_and_pad_images(images, max_width, max_height)

    # Uložení upravených obrázků
    for idx, img in enumerate(processed_images):
        img.save(f"processed_image_{idx + 1}.png")

os.makedirs("../build/tmp/png_processed", exist_ok=True)

png_files = glob("../build/tmp/png/*.png")
songs = OrderedSet(purify(fn).split("-", 1)[0] for fn in png_files)

for song in tqdm(songs):
    image_fnames = glob(f"../build/tmp/png/{song}-*")
    images, max_width, max_height = load_and_trim_images(image_fnames)
    processed_images = resize_and_pad_images(images, max_width, max_height)

    for img, fname in zip(processed_images, image_fnames):
        new_fname = purify(fname).replace("-page", "_")
        new_fname = f"../build/tmp/png_processed/{new_fname}.png"
        img.save(new_fname)
