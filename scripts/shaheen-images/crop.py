"""TEMP: full-resolution close-ups of chosen flagged photos."""
import io, json, urllib.request
from PIL import Image
d = json.load(open('tmp-scan/marks.json'))['marks']
items = list(d.items())
for i in (19, 17, 12, 0):
    u, ms = items[i]
    im = Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read())).convert('RGB')
    x0, y0, x1, y1 = ms[0]['box']; pad = 160
    im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))).resize(((min(im.width, x1 + pad) - max(0, x0 - pad)) * 2, (min(im.height, y1 + pad) - max(0, y0 - pad)) * 2)).save(f'tmp-scan/zoom-{i}.jpg', quality=92)
