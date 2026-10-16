"""TEMP reconnaissance: what source marks are on the supplier's product photos?
Downloads every product image, OCRs it (English + Arabic) and writes:
  tmp-scan/report.json   url -> words found (text, conf, box) + image size
  tmp-scan/tokens.txt    most frequent OCR tokens across all images
  tmp-scan/sheet-*.jpg   contact sheets (flagged images first, then a random sample)
"""
import json, os, random, re, sys, io, collections, concurrent.futures, urllib.request
from PIL import Image, ImageDraw
import pytesseract

OUT = 'tmp-scan'
os.makedirs(f'{OUT}/img', exist_ok=True)
products = json.load(open('src/data/products.json'))['products']
urls = []
for p in products:
    for u in [p.get('imageUrl')] + list(p.get('images') or []):
        if isinstance(u, str) and u.startswith('http') and u not in urls:
            urls.append(u)
print(len(urls), 'images', flush=True)

UA = {'User-Agent': 'Mozilla/5.0 (compatible; ShamPerfumeBot/1.0)'}
def fetch(u):
    path = f"{OUT}/img/{abs(hash(u)) % 10**12}.img"
    if os.path.exists(path):
        return u, path
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40) as r:
            data = r.read()
        open(path, 'wb').write(data)
        return u, path
    except Exception as e:
        return u, None

FLAG = re.compile(r'(sham|shamperfume|perfume\.com|www|\.com|\.my|http|@|whats|wa\.me|insta|facebook|tiktok|shopee|lazada|\+?6?01\d|شام)', re.I)

def ocr(item):
    u, path = item
    if not path:
        return u, {'error': 'download'}
    try:
        img = Image.open(path).convert('RGB')
    except Exception:
        return u, {'error': 'decode'}
    w, h = img.size
    scale = 1600 / max(w, h) if max(w, h) < 1600 else 1
    big = img.resize((int(w * scale), int(h * scale))) if scale != 1 else img
    words = []
    for lang in ('eng', 'ara'):
        d = pytesseract.image_to_data(big, lang=lang, output_type=pytesseract.Output.DICT, config='--psm 11')
        for i, t in enumerate(d['text']):
            t = t.strip()
            if len(t) >= 2 and float(d['conf'][i]) >= 55:
                words.append({'t': t, 'c': round(float(d['conf'][i])), 'l': lang,
                              'b': [round(d['left'][i] / scale), round(d['top'][i] / scale), round(d['width'][i] / scale), round(d['height'][i] / scale)]})
    return u, {'size': [w, h], 'words': words, 'flag': any(FLAG.search(x['t']) for x in words), 'file': path}

with concurrent.futures.ThreadPoolExecutor(12) as ex:
    items = list(ex.map(fetch, urls))
print('downloaded', sum(1 for _, p in items if p), flush=True)
report = {}
with concurrent.futures.ProcessPoolExecutor(os.cpu_count() or 4) as ex:
    for n, (u, r) in enumerate(ex.map(ocr, items, chunksize=8)):
        report[u] = r
        if n % 500 == 0:
            print('ocr', n, flush=True)

json.dump({u: {k: v for k, v in r.items() if k != 'file'} for u, r in report.items()}, open(f'{OUT}/report.json', 'w'), ensure_ascii=False)
tokens = collections.Counter(x['t'].lower() for r in report.values() for x in r.get('words', []))
open(f'{OUT}/tokens.txt', 'w').write('\n'.join(f'{c}\t{t}' for t, c in tokens.most_common(400)))
sizes = collections.Counter(tuple(r['size']) for r in report.values() if 'size' in r)
flagged = [u for u, r in report.items() if r.get('flag')]
print('flagged', len(flagged), 'sizes', sizes.most_common(5), flush=True)
open(f'{OUT}/summary.txt', 'w').write(f"images {len(urls)}\nflagged {len(flagged)}\nerrors {sum(1 for r in report.values() if 'error' in r)}\nsizes {sizes.most_common(8)}\n")

def sheet(name, chosen, cell=300, cols=6):
    rows = (len(chosen) + cols - 1) // cols
    canvas = Image.new('RGB', (cols * cell, rows * (cell + 16)), 'white')
    draw = ImageDraw.Draw(canvas)
    for i, u in enumerate(chosen):
        r = report[u]
        try:
            im = Image.open(r['file']).convert('RGB')
        except Exception:
            continue
        im.thumbnail((cell, cell))
        x, y = (i % cols) * cell, (i // cols) * (cell + 16)
        canvas.paste(im, (x, y))
        draw.text((x + 2, y + cell + 2), f"{i} {u.rsplit('/', 1)[-1][:40]}", fill='black')
    canvas.save(f'{OUT}/{name}.jpg', quality=80)

random.seed(7)
others = [u for u in report if not report[u].get('flag') and 'file' in report[u]]
sheet('sheet-flagged-1', flagged[:36])
sheet('sheet-flagged-2', flagged[36:72])
sheet('sheet-random-1', random.sample(others, min(36, len(others))))
sheet('sheet-random-2', random.sample(others, min(36, len(others))))
# Full-size copies of a few flagged images, to see the marks in detail.
for i, u in enumerate(flagged[:6]):
    Image.open(report[u]['file']).convert('RGB').save(f'{OUT}/full-flag-{i}.jpg', quality=88)
for i, u in enumerate(random.sample(others, min(4, len(others)))):
    Image.open(report[u]['file']).convert('RGB').save(f'{OUT}/full-other-{i}.jpg', quality=88)
