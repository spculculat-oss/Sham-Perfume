"""TEMP reconnaissance (fast): download a random sample of product photos and make contact sheets."""
import json, os, random, time, concurrent.futures, urllib.request
from PIL import Image, ImageDraw

OUT = 'tmp-scan'
os.makedirs(OUT, exist_ok=True)
products = json.load(open('src/data/products.json'))['products']
urls = []
for p in products:
    for u in list(p.get('images') or []):
        if isinstance(u, str) and u.startswith('http') and u not in urls:
            urls.append(u)
random.seed(5)
sample = random.sample(urls, 72)
UA = {'User-Agent': 'Mozilla/5.0 (compatible; ShaheenImporter/1.0; +https://spculculat-oss.github.io/Sham-Perfume/)'}
def fetch(u):
    t = time.time()
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=20) as r:
            data = r.read()
        return u, data, round(time.time() - t, 1), None
    except Exception as e:
        return u, None, round(time.time() - t, 1), str(e)[:80]
start = time.time()
with concurrent.futures.ThreadPoolExecutor(12) as ex:
    got = list(ex.map(fetch, sample))
ok = [(u, d) for u, d, _, e in got if d]
times = sorted(t for _, _, t, _ in got)
errs = [e for *_, e in got if e]
imgs = []
for u, d in ok:
    try:
        import io
        im = Image.open(io.BytesIO(d)); im.load(); imgs.append((u, im.convert('RGB'), len(d)))
    except Exception as e:
        errs.append('decode ' + str(e)[:40])
sizes = [f"{im.size[0]}x{im.size[1]}/{n//1024}KB" for _, im, n in imgs[:12]]
print(f"::notice title=download::{len(ok)}/{len(sample)} ok in {round(time.time()-start)}s; median {times[len(times)//2]}s max {times[-1]}s; errors {errs[:3]}")
print(f"::notice title=sizes::{' '.join(sizes)}")
def sheet(name, chosen, cell=380, cols=4):
    rows = (len(chosen) + cols - 1) // cols
    canvas = Image.new('RGB', (cols * cell, rows * (cell + 14)), 'white')
    draw = ImageDraw.Draw(canvas)
    for i, (u, im, _) in enumerate(chosen):
        t = im.copy(); t.thumbnail((cell - 4, cell - 4))
        x, y = (i % cols) * cell, (i // cols) * (cell + 14)
        canvas.paste(t, (x, y)); draw.text((x + 2, y + cell), f"{i}", fill='red')
    canvas.save(f'{OUT}/{name}.jpg', quality=82)
for k in range(0, len(imgs), 16):
    sheet(f'sheet-{k//16}', imgs[k:k + 16])
json.dump([u for u, _, _ in imgs], open(f'{OUT}/sample.json', 'w'), indent=0)
for i, (u, im, _) in enumerate(imgs[:6]):
    c = im.copy(); c.thumbnail((1200, 1200)); c.save(f'{OUT}/full-{i}.jpg', quality=88)
