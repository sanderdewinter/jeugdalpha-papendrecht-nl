#!/usr/bin/env python3
"""Regenerate data/albums.json from the photo folders.

Run after dropping a new album into wp-content/uploads/Fotos/<Name>/:

    python3 tools/scan-photos.py

Titles and descriptions already in data/albums.json are kept, so you only
have to write them once. New albums get a placeholder description.

Add the folder to ALBUM_DIRS below to include it.
"""
import json
import os
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "albums.json"

# Folder → default title. Order here is the order on the page.
ALBUM_DIRS = [
    ("wp-content/uploads/Fotos/Startbarbecue", "Startbarbecue"),
    ("wp-content/uploads/Fotos/Alphaweekend/Alphaweekend-najaar-2019", "Alphaweekend najaar 2019"),
]

THUMB_RANGE = (430, 560)   # WordPress derivative to use as grid thumbnail
MAX_FULL_WIDTH = 1600      # never point the lightbox at a multi-MB original


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def scan(rel_dir):
    directory = ROOT / rel_dir
    if not directory.is_dir():
        raise SystemExit(f"not a directory: {rel_dir}")

    bases = {}
    for entry in os.listdir(directory):
        m = re.match(r"^(.*?)(?:-(\d+)x(\d+))?\.(jpg|jpeg|png)$", entry, re.I)
        if not m:
            continue
        base, w, h, _ = m.groups()
        slot = bases.setdefault(base, {"original": None, "variants": []})
        if w is None:
            slot["original"] = entry
        else:
            slot["variants"].append((int(w), int(h), entry))

    def sort_key(base):
        digits = re.findall(r"\d+", base)
        return (int(digits[-1]) if digits else 0, base)

    photos = []
    for base in sorted(bases, key=sort_key):
        variants = sorted(bases[base]["variants"])
        original = bases[base]["original"]
        if not variants and not original:
            continue

        thumb = next(
            (f for w, _, f in variants if THUMB_RANGE[0] <= w <= THUMB_RANGE[1]),
            variants[-1][2] if variants else original,
        )
        full = next(
            (f for w, _, f in reversed(variants) if w <= MAX_FULL_WIDTH),
            original,
        )
        size = next(((w, h) for w, h, f in variants if f == full), (None, None))
        photos.append(
            {"thumb": f"{rel_dir}/{thumb}", "full": f"{rel_dir}/{full}",
             "w": size[0], "h": size[1]}
        )
    return photos


def main():
    existing = {}
    if OUT.exists():
        for album in json.loads(OUT.read_text(encoding="utf-8")).get("albums", []):
            existing[album["slug"]] = album

    albums = []
    for rel_dir, title in ALBUM_DIRS:
        slug = slugify(title)
        previous = existing.get(slug, {})
        photos = scan(rel_dir)
        albums.append(
            {
                "slug": slug,
                "title": previous.get("title", title),
                "description": previous.get("description", "TODO: beschrijf dit album."),
                "photos": photos,
            }
        )
        print(f"{slug}: {len(photos)} foto's")

    OUT.write_text(
        json.dumps({"albums": albums}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
