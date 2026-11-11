"""Dibuja en una hoja PNG los sprites de un archivo de arte (src/game/sprites/art/*.ts) para revisarlos.

Uso: python scripts/render_sprites.py src/game/sprites/art/enemies.ts salida.png [zoom]
Lee la paleta de src/game/sprites/data.ts. Requiere Pillow.
"""
import re
import sys
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
zoom = int(sys.argv[3]) if len(sys.argv) > 3 else 6
data = open('src/game/sprites/data.ts', encoding='utf-8').read()
pal_block = data[data.index('export const PALETTE'):data.index('};', data.index('export const PALETTE'))]
palette = {k: v for k, v in re.findall(r"^\s+'?(\w)'?: '(#[0-9a-fA-F]{6})'", pal_block, re.M)}
text = open(src, encoding='utf-8').read()
sprites = []
for name, body in re.findall(r"^\s+(\w+): \[(.*?)\]", text, re.S | re.M):
    rows = re.findall(r"'([^']*)'", body)
    if rows:
        sprites.append((name, rows))
if not sprites:
    sys.exit('No hay sprites en ' + src)
cell_w = max(len(r[0]) for _, r in sprites) * zoom + 16
cell_h = max(len(r) for _, r in sprites) * zoom + 30
cols = max(1, min(8, 1600 // cell_w))
rows_n = (len(sprites) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cell_w, rows_n * cell_h), '#1d1938')
draw = ImageDraw.Draw(sheet)
for i, (name, rows) in enumerate(sprites):
    x0, y0 = (i % cols) * cell_w + 8, (i // cols) * cell_h + 6
    bad = len({len(r) for r in rows}) > 1
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            color = palette.get(ch)
            if color is None:
                bad = True
                color = '#ff00ff'
            draw.rectangle([x0 + x * zoom, y0 + y * zoom, x0 + (x + 1) * zoom - 1, y0 + (y + 1) * zoom - 1], fill=color)
    label = f"{name} {len(rows[0])}x{len(rows)}" + (' ¡ERROR!' if bad else '')
    draw.text((x0, y0 + len(rows) * zoom + 4), label, fill='#ff6b6b' if bad else '#d8d4e8')
sheet.save(out)
print(f'{len(sprites)} sprites -> {out}')
