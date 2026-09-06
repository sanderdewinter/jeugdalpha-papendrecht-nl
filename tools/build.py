#!/usr/bin/env python3
"""Assemble the static site from src/ + data/.

This is NOT a deploy step. GitHub Pages serves the committed .html files
directly. Run this only when you change a template, the header/footer, or
data/animatieteam.json, then commit the regenerated HTML:

    python3 tools/build.py

Everything that changes per season (data/events.json) is read by the browser
at runtime, so a new season needs no build at all.
"""
import datetime
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
YEAR = str(datetime.date.today().year)


def read(p):
    return (SRC / p).read_text(encoding="utf-8")


def fill(template, values):
    """Replace {{key}} placeholders. Unknown placeholders are an error."""
    def sub(m):
        key = m.group(1)
        if key not in values:
            raise KeyError(f"no value for {{{{{key}}}}}")
        return str(values[key])
    return re.sub(r"\{\{(\w+)\}\}", sub, template)


def front_matter(text):
    """`key: value` lines, then a `---` line, then the body."""
    head, _, body = text.partition("\n---\n")
    meta = {}
    for line in head.splitlines():
        if not line.strip():
            continue
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    return meta, body.strip()


def write(rel_path, content):
    out = ROOT / rel_path.lstrip("/")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(content, encoding="utf-8")
    return out


# --------------------------------------------------------------------------
LAYOUT = read("layout.html")
HEADER = read("partials/header.html")
FOOTER = fill(read("partials/footer.html"), {"year": YEAR})


def render_page(meta, body):
    values = {
        "title_tag": meta.get("title_tag") or meta["title"],
        "description": meta["description"],
        "canonical": meta.get("canonical", "/"),
        "header": HEADER,
        "footer": FOOTER,
        "body": body,
    }
    page = fill(LAYOUT, values)
    if meta.get("noindex"):
        page = page.replace(
            '<meta name="theme-color"',
            '<meta name="robots" content="noindex">\n<meta name="theme-color"',
        )
    return page


# ------------------------------------------------------------- animatieteam
AT = json.loads((ROOT / "data" / "animatieteam.json").read_text(encoding="utf-8"))
SERIES = AT["series"]

EMBED_LABEL = {
    "yt": "YouTube",
    "vimeo": "Vimeo",
    "drive": "Google Drive",
    "spotify": "Spotify",
}


def e(s):
    return html.escape(str(s), quote=True)


def series_url(slug):
    return "/het-animatieteam/" + slug + "/"


def poster_img(s, sizes, extra=""):
    """<img> with a srcset built from the sizes WordPress already generated."""
    if not s.get("poster"):
        return None
    base = s["poster"]
    widths = s.get("posterWidths") or []
    if not widths:
        return None
    # Find the real filenames so a missing derivative fails loudly at build time.
    srcset = []
    for w in widths:
        matches = sorted((ROOT).glob(f"{base}-{w}x*.png"))
        if not matches:
            raise SystemExit(f"missing poster derivative: {base}-{w}x*.png")
        srcset.append(f"/{matches[0].relative_to(ROOT)} {w}w")
    default = srcset[0].split(" ")[0]
    return (
        f'<img src="{e(default)}" srcset="{e(", ".join(srcset))}" sizes="{e(sizes)}" '
        f'width="1100" height="800" loading="lazy" decoding="async" alt="" {extra}>'
    )


def card(slug):
    s = SERIES[slug]
    img = poster_img(s, "(min-width: 900px) 300px, (min-width: 700px) 45vw, 90vw")
    art = (
        f'<div class="series-card__art">{img}</div>'
        if img
        else f'<div class="series-card__art series-card__art--empty">{e(s["title"])}</div>'
    )
    badge = f'<span class="series-card__badge">{e(s["badge"])}</span>' if s.get("badge") else ""
    n = len(s["episodes"])
    return (
        f'<a class="series-card" href="{e(series_url(slug))}">{badge}{art}'
        f'<div class="series-card__body">'
        f'<h3 class="series-card__title">{e(s["title"])}</h3>'
        f'<p class="series-card__meta"><b>{e(s["match"])}</b> &middot; {e(s["era"])}</p>'
        f'<p class="series-card__meta">{n} {"aflevering" if n == 1 else "afleveringen"}</p>'
        f"</div></a>"
    )


def video_block(ep, title):
    label = EMBED_LABEL.get(ep["kind"], "video")
    return (
        f'<div class="video" data-video-kind="{e(ep["kind"])}" data-video-id="{e(ep["id"])}" '
        f'data-video-title="{e(title)}">'
        f'<button class="video__btn" type="button">'
        f"<span>{e(label)} laden en spelen</span></button></div>"
    )


def episode_block(slug, ep):
    s = SERIES[slug]
    title = f'{s["title"]} — {ep["label"]}'
    note = f'<p class="episode__note">{e(ep["note"])}</p>' if ep.get("note") else ""
    hint = (
        '<p class="video__hint">Het laden kan even duren.</p>'
        if ep["kind"] == "drive"
        else ""
    )
    return (
        f'<article class="episode">'
        f'<h2 class="episode__label">{e(ep["label"])}</h2>'
        f"{note}{video_block(ep, title)}{hint}</article>"
    )


def season_links(slug):
    s = SERIES[slug]
    out = []
    for key, cls in (("prevSeason", "btn btn--ghost"), ("nextSeason", "btn")):
        link = s.get(key)
        if link:
            out.append(f'<a class="{cls}" href="{e(series_url(link["slug"]))}">{e(link["label"])}</a>')
    if not out:
        return ""
    return '<div class="btn-row">' + "".join(out) + "</div>"


def build_animatieteam_index(meta, body):
    sections = []
    for sec in AT["sections"]:
        cards = "".join(card(slug) for slug in sec["slugs"])
        band = "band--white" if len(sections) % 2 == 0 else "band--paper"
        sections.append(
            f'<section class="band {band}" id="{e(sec["id"])}">'
            f'<div class="container stack-lg">'
            f'<h2 class="display d2">{e(sec["title"])}</h2>'
            f'<div class="series-grid">{cards}</div>'
            f"</div></section>"
        )
    filled = fill(
        body,
        {
            "intro": e(AT["intro"]),
            "channel_url": e(AT["channelUrl"]),
            "series_count": len(SERIES),
            "episode_count": sum(len(s["episodes"]) for s in SERIES.values()),
            "series_sections": "\n".join(sections),
        },
    )
    return render_page(meta, filled)


def build_series_pages():
    template = read("series.html")
    order = [slug for sec in AT["sections"] for slug in sec["slugs"]]
    written = []
    for slug in order:
        s = SERIES[slug]
        others = [x for x in order if x != slug][:4]
        # Prefer siblings from the same section, then fill up from the rest.
        section = next(sec for sec in AT["sections"] if slug in sec["slugs"])
        siblings = [x for x in section["slugs"] if x != slug]
        picks = (siblings + [x for x in order if x not in siblings and x != slug])[:4]
        body = fill(
            template,
            {
                "title": e(s["title"]),
                "era": e(s["era"]),
                "match": e(s["match"]),
                "meta": e(s["meta"]),
                "description": e(s["description"]),
                "season_links": season_links(slug),
                "episodes": "\n".join(episode_block(slug, ep) for ep in s["episodes"]),
                "suggestions": "".join(card(x) for x in picks),
            },
        )
        meta = {
            "title": s["title"],
            "title_tag": f'{s["title"]} — Het Animatieteam — Jeugdalpha Papendrecht',
            "description": s["description"][:300],
            "canonical": series_url(slug),
        }
        written.append(write(series_url(slug) + "index.html", render_page(meta, body)))
    return written


# -------------------------------------------------------------------- sitemap
def build_sitemap(paths):
    urls = sorted({p for p in paths if not p.endswith("404.html")})
    body = "\n".join(
        f"  <url><loc>https://jeugdalpha-papendrecht.nl{u}</loc></url>" for u in urls
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.w3.org/1999/sitemaps-schema/0.9">\n'
        f"{body}\n</urlset>\n"
    ).replace("sitemaps-schema/0.9", "sitemap/0.9")


# ------------------------------------------------------------------------ run
def main():
    written, canonicals = [], []
    for page_file in sorted((SRC / "pages").glob("*.html")):
        meta, body = front_matter(page_file.read_text(encoding="utf-8"))
        if "path" not in meta:
            raise SystemExit(f"{page_file.name}: missing `path:`")
        if page_file.name == "het-animatieteam.html":
            page = build_animatieteam_index(meta, body)
        else:
            page = render_page(meta, body)
        written.append(write(meta["path"], page))
        if not meta.get("noindex"):
            canonicals.append(meta.get("canonical", "/"))

    series_files = build_series_pages()
    written += series_files
    canonicals += [
        "/het-animatieteam/" + slug + "/"
        for sec in AT["sections"]
        for slug in sec["slugs"]
    ]

    write("/sitemap.xml", build_sitemap(canonicals))
    print(f"{len(written)} pages + sitemap.xml")
    for p in written:
        print("  ", p.relative_to(ROOT))


if __name__ == "__main__":
    sys.exit(main())
