"""TEMP: merge the shard results and draw the flagged photos (marks boxed in red) for review."""
import glob, io, json, urllib.request, collections
from PIL import Image, ImageDraw

merged = {'scanned': 0, 'errors': [], 'marks': {}}
for f in sorted(glob.glob('tmp-scan/shard-*.json')):
    d = json.load(open(f))
    merged['scanned'] += d['scanned']; merged['errors'] += d['errors']; merged['marks'].update(d['marks'])
json.dump(merged, open('tmp-scan/marks.json', 'w'), ensure_ascii=False, indent=1)
kinds = collections.Counter(m['kind'] for ms in merged['marks'].values() for m in ms)
texts = collections.Counter(m['text'] for ms in merged['marks'].values() for m in ms)
print(f"::notice title=scan::scanned {merged['scanned']}, flagged {len(merged['marks'])} photos, marks {dict(kinds)}, errors {len(merged['errors'])}")
print(f"::notice title=texts::{' ¦ '.join(f'{t} ×{c}' for t, c in texts.most_common(25))}"[:3900])
UA = {'User-Agent': 'Mozilla/5.0 (compatible; ShaheenImporter/1.0)'}
flagged = sorted(merged['marks'], key=lambda u: -max(1 if m['kind'] == 'source' else 0 for m in merged['marks'][u]))
cell, cols = 380, 4
for k in range(0, min(len(flagged), 64), 16):
    chunk = flagged[k:k + 16]
    rows = (len(chunk) + cols - 1) // cols
    canvas = Image.new('RGB', (cols * cell, rows * (cell + 28)), 'white')
    draw = ImageDraw.Draw(canvas)
    for i, u in enumerate(chunk):
        im = Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read())).convert('RGB')
        d = ImageDraw.Draw(im)
        for m in merged['marks'][u]:
            d.rectangle(m['box'], outline='red' if m['kind'] == 'source' else 'blue', width=5)
        im.thumbnail((cell - 4, cell - 4))
        x, y = (i % cols) * cell, (i // cols) * (cell + 28)
        canvas.paste(im, (x, y))
        draw.text((x + 2, y + cell - 2), f"{k + i} " + ' | '.join(m['text'] for m in merged['marks'][u])[:60], fill='black')
    canvas.save(f'tmp-scan/flagged-{k // 16}.jpg', quality=82)
# Close-ups of the first marks, at full resolution.
for i, u in enumerate(flagged[:8]):
    im = Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read())).convert('RGB')
    x0, y0, x1, y1 = merged['marks'][u][0]['box']
    pad = 120
    im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))).save(f'tmp-scan/closeup-{i}.jpg', quality=90)
