"""Splits web/src/assets/recapp-icon.png into one full-size layer per page, for the page-flip animation.

The pages are separated by transparent gaps, so each page is one connected region of visible pixels.
Run again whenever the icon artwork changes:  .venv/bin/python scripts/split_recapp_icon.py
"""

from collections import deque
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "web" / "src" / "assets"
PAGES = 6

icon = Image.open(ASSETS / "recapp-icon.png").convert("RGBA")
w, h = icon.size
alpha = icon.getchannel("A").load()
label = [[-1] * w for _ in range(h)]

regions: list[list[tuple[int, int]]] = []
for y0 in range(h):
    for x0 in range(w):
        if alpha[x0, y0] == 0 or label[y0][x0] != -1:
            continue
        pixels, queue = [], deque([(x0, y0)])
        label[y0][x0] = len(regions)
        while queue:
            x, y = queue.popleft()
            pixels.append((x, y))
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and alpha[nx, ny] and label[ny][nx] == -1:
                    label[ny][nx] = len(regions)
                    queue.append((nx, ny))
        regions.append(pixels)

regions.sort(key=len, reverse=True)
pages, specks = regions[:PAGES], regions[PAGES:]
pages.sort(key=lambda px: min(x for x, _ in px))  # front (left) page first


def nearest_page(x: int, y: int) -> int:
    return min(range(PAGES), key=lambda i: min(abs(x - px) + abs(y - py) for px, py in pages[i][:: max(1, len(pages[i]) // 400)]))


for speck in specks:  # stray anti-aliased pixels join the closest page
    pages[nearest_page(*speck[0])].extend(speck)

src = icon.load()
for i, pixels in enumerate(pages, start=1):
    layer = Image.new("RGBA", icon.size)
    out = layer.load()
    for x, y in pixels:
        out[x, y] = src[x, y]
    layer.save(ASSETS / f"recapp-page-{i}.png", optimize=True)
    left = min(x for x, _ in pixels)
    print(f"recapp-page-{i}.png  {len(pixels)} px, left edge {left / w:.1%}")
