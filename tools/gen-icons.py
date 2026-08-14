#!/usr/bin/env python3
"""
Generate app icons.

Design: a stylised loaded barbell over a dark ground — readable at 40px on a home
screen, which rules out anything with fine detail or text.

The apple-touch-icon MUST be opaque with no alpha channel. iOS composites
transparency against black and the result looks broken, so it gets a flat
background rather than the rounded/transparent treatment used elsewhere.
Maskable icons keep all content inside the inner 80% safe zone, since Android
crops them to whatever shape the launcher wants.
"""

from PIL import Image, ImageDraw
import os

BG = (13, 13, 13)
PLATE = (57, 135, 229)
BAR = (240, 240, 238)
ACCENT = (25, 158, 112)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "icons")
os.makedirs(OUT, exist_ok=True)


def draw_icon(size, safe=1.0, rounded=False, opaque=True):
    """safe<1 shrinks the artwork into the maskable safe zone."""
    ss = 4  # supersample for clean edges
    s = size * ss
    img = Image.new("RGBA", (s, s), BG + (255,) if opaque else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if not opaque and rounded:
        r = int(s * 0.22)
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=BG + (255,))

    cx = cy = s / 2
    scale = safe

    bar_h = s * 0.055 * scale
    bar_w = s * 0.62 * scale
    d.rounded_rectangle(
        [cx - bar_w / 2, cy - bar_h / 2, cx + bar_w / 2, cy + bar_h / 2],
        radius=bar_h / 2,
        fill=BAR,
    )

    # Inner (large) plates, then outer (smaller) plates — reads as a loaded bar.
    for sign in (-1, 1):
        ix = cx + sign * s * 0.20 * scale
        ih = s * 0.42 * scale
        iw = s * 0.075 * scale
        d.rounded_rectangle(
            [ix - iw / 2, cy - ih / 2, ix + iw / 2, cy + ih / 2],
            radius=iw * 0.35,
            fill=PLATE,
        )

        ox = cx + sign * s * 0.295 * scale
        oh = s * 0.27 * scale
        ow = s * 0.062 * scale
        d.rounded_rectangle(
            [ox - ow / 2, cy - oh / 2, ox + ow / 2, cy + oh / 2],
            radius=ow * 0.35,
            fill=ACCENT,
        )

    return img.resize((size, size), Image.LANCZOS)


def save(img, name, opaque):
    path = os.path.join(OUT, name)
    if opaque:
        # Flatten to RGB — no alpha channel at all, which is what iOS needs.
        bg = Image.new("RGB", img.size, BG)
        bg.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)
        bg.save(path, "PNG", optimize=True)
    else:
        img.save(path, "PNG", optimize=True)
    print(f"  {name}  {os.path.getsize(path):,}b")


print("icons:")
save(draw_icon(180, opaque=True), "apple-touch-icon-180.png", True)
save(draw_icon(192, opaque=True), "icon-192.png", True)
save(draw_icon(512, opaque=True), "icon-512.png", True)
save(draw_icon(512, safe=0.72, opaque=True), "icon-512-maskable.png", True)

SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0d0d0d"/>
  <rect x="12" y="30.2" width="40" height="3.6" rx="1.8" fill="#f0f0ee"/>
  <rect x="19.6" y="18.6" width="4.8" height="26.8" rx="1.7" fill="#3987e5"/>
  <rect x="39.6" y="18.6" width="4.8" height="26.8" rx="1.7" fill="#3987e5"/>
  <rect x="12.9" y="23.4" width="4" height="17.2" rx="1.4" fill="#199e70"/>
  <rect x="47.1" y="23.4" width="4" height="17.2" rx="1.4" fill="#199e70"/>
</svg>
"""
with open(os.path.join(OUT, "favicon.svg"), "w") as f:
    f.write(SVG)
print("  favicon.svg")
