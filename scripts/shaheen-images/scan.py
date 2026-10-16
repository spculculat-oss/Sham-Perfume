"""TEMP: scan shard N/M of every product photo for the supplier's contact marks.
    python3 scripts/shaheen-images/scan.py <shard> <shards>   -> tmp-scan/shard-<n>.json
"""
import io, json, os, sys, time, concurrent.futures, urllib.request
import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR
sys.path.insert(0, os.path.dirname(__file__))
from detect import find_marks

shard, shards = int(sys.argv[1]), int(sys.argv[2])
products = json.load(open('src/data/products.json'))['products']
urls = []
for p in products:
    for u in [p.get('imageUrl')] + list(p.get('images') or []):
        if isinstance(u, str) and u.startswith('http') and u not in urls:
            urls.append(u)
mine = urls[shard::shards]
UA = {'User-Agent': 'Mozilla/5.0 (compatible; ShaheenImporter/1.0; +https://spculculat-oss.github.io/Sham-Perfume/)'}

def fetch(u):
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=20) as r:
                return u, r.read()
        except Exception:
            time.sleep(2)
    return u, None

engine = RapidOCR()
out = {'scanned': 0, 'errors': [], 'marks': {}, 'texts': {}}
start = time.time()
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for u, data in ex.map(fetch, mine):
        if not data:
            out['errors'].append(u); continue
        try:
            img = np.array(Image.open(io.BytesIO(data)).convert('RGB'))
        except Exception:
            out['errors'].append(u); continue
        marks = find_marks(engine, img)
        out['scanned'] += 1
        if marks:
            out['marks'][u] = marks
        if out['scanned'] % 200 == 0:
            print(f"shard {shard}: {out['scanned']}/{len(mine)} in {round(time.time()-start)}s, flagged {len(out['marks'])}", flush=True)
os.makedirs('tmp-scan', exist_ok=True)
json.dump(out, open(f'tmp-scan/shard-{shard}.json', 'w'), ensure_ascii=False)
print(f"::notice title=shard {shard}::{out['scanned']}/{len(mine)} scanned in {round(time.time()-start)}s; flagged {len(out['marks'])}; errors {len(out['errors'])}")
