"""«منقّح الصور» — removes the supplier's and other shops' contact marks from the store's product photos.

    python3 scripts/shaheen-images/clean.py
Runs inside the importer (.github/workflows/shaheen-import.yml) after new products arrive:
 1. every product photo not checked yet is downloaded and read (RapidOCR, English letters/digits);
 2. scripts/shaheen-images/detect.py decides which text is a source/contact mark (the supplier's site, phone,
    WhatsApp, e-mail, social handles; another shop's watermark) and which belongs to the product (kept);
 3. the marks are erased by inpainting (LaMa, an open model that redraws the background behind them — the
    product itself is untouched; OpenCV's inpainting if LaMa cannot be loaded) and the photo is read again to
    confirm nothing is left;
 4. the clean photo is saved in the site (public/store-images/…) and used instead of the supplier's link.
The result per photo is kept in src/data/live/image-clean.json, so each photo is checked once and the
importer keeps using the clean copy when it refreshes a product. Env: IMAGE_TIME_BUDGET_S (default 900),
IMAGE_ONLY (comma-separated photo links, for a test), IMAGE_WRITE_PRODUCTS (default 1).
"""
import concurrent.futures, datetime, hashlib, io, json, os, re, subprocess, sys, time, urllib.request
import numpy as np
from PIL import Image, ImageFilter, ImageOps
sys.path.insert(0, os.path.dirname(__file__))
from detect import DETECTOR_VERSION, brand_tokens, mask_boxes, plan

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PRODUCTS = os.path.join(ROOT, 'src/data/products.json')
REGISTRY = os.path.join(ROOT, 'src/data/live/image-clean.json')
OUT_DIR = 'store-images'  # inside public/: served at <site>/store-images/…
UA = {'User-Agent': 'Mozilla/5.0 (compatible; ShaheenImporter/1.0; +https://spculculat-oss.github.io/Sham-Perfume/)'}
LAMA_URL = 'https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt'
budget = float(os.environ.get('IMAGE_TIME_BUDGET_S', '900'))
only = [u.strip() for u in os.environ.get('IMAGE_ONLY', '').split(',') if u.strip()]
write_products = os.environ.get('IMAGE_WRITE_PRODUCTS', '1') != '0'
notes = []
def say(line):
    print(line, flush=True); notes.append(line)


def load_registry():
    try:
        r = json.load(open(REGISTRY))
        if r.get('detector') == DETECTOR_VERSION and isinstance(r.get('images'), dict):
            return r
    except Exception:
        pass
    return {'version': 1, 'detector': DETECTOR_VERSION, 'updatedAt': '', 'images': {}}


def fetch(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
                return url, r.read()
        except Exception:
            time.sleep(2 * (attempt + 1))
    return url, None


def ocr(engine, rgb):
    result, _ = engine(rgb)
    out = []
    for points, text, score in result or []:
        xs = [p[0] for p in points]; ys = [p[1] for p in points]
        out.append({'text': text, 'score': round(float(score), 3), 'box': [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]})
    return out


def zoom_read(engine, rgb, around):
    """Read again around the marks found, 3× larger and with more contrast: a semi-transparent watermark is
    often read only in part at full size (Al Qannas: «instagram» but not «www.joveychic.net»)."""
    H, W = rgb.shape[:2]
    out = []
    for b in around:
        x0, y0, x1, y1 = b['box']
        h, w = max(y1 - y0, 8), x1 - x0
        X0, X1 = max(0, x0 - int(1.5 * w) - 4 * h), min(W, x1 + int(1.5 * w) + 4 * h)
        Y0, Y1 = max(0, y0 - 3 * h), min(H, y1 + 3 * h)
        crop = Image.fromarray(rgb[Y0:Y1, X0:X1])
        for img in (crop, ImageOps.autocontrast(crop.convert('L'), cutoff=1).convert('RGB')):
            big = img.resize((img.width * 3, img.height * 3), Image.LANCZOS)
            for z in ocr(engine, np.array(big)):
                bx0, by0, bx1, by1 = z['box']
                out.append({**z, 'box': [X0 + bx0 // 3, Y0 + by0 // 3, X0 + -(-bx1 // 3), Y0 + -(-by1 // 3)]})
    return out


def find(engine, rgb, tokens, around=()):
    """The marks on a photo: the full-size read, plus a zoomed read around every mark (or former mark)."""
    boxes = ocr(engine, rgb)
    p = plan(boxes, tokens)
    look = list(around) + p['remove']
    if look:
        p = plan(boxes + zoom_read(engine, rgb, look), tokens)
    return p


class Inpainter:
    """LaMa (big-lama TorchScript) on CPU; OpenCV Telea when torch or the model is unavailable."""
    def __init__(self):
        self.model = None
        self.kind = 'opencv'
        try:
            try:
                import torch  # noqa: F401
            except ImportError:
                subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'torch', '--index-url', 'https://download.pytorch.org/whl/cpu'], check=True, timeout=600)
            import torch
            path = os.environ.get('LAMA_MODEL') or os.path.expanduser('~/.cache/lama/big-lama.pt')
            if not os.path.exists(path):
                os.makedirs(os.path.dirname(path), exist_ok=True)
                urllib.request.urlretrieve(LAMA_URL, path + '.part'); os.replace(path + '.part', path)
            self.torch = torch
            self.model = torch.jit.load(path, map_location='cpu').eval()
            self.kind = 'lama'
        except Exception as e:
            say(f'LaMa unavailable ({str(e)[:100]}): using OpenCV inpainting')

    def __call__(self, rgb, mask):
        """rgb HxWx3 uint8, mask HxW uint8 (255 = erase) -> HxWx3 uint8."""
        if self.model is None:
            import cv2
            return cv2.inpaint(rgb, mask, 5, cv2.INPAINT_TELEA)
        torch = self.torch
        h, w = mask.shape
        ph, pw = (8 - h % 8) % 8, (8 - w % 8) % 8
        img = np.pad(rgb, ((0, ph), (0, pw), (0, 0)), mode='symmetric').astype(np.float32) / 255
        m = np.pad((mask > 0).astype(np.float32), ((0, ph), (0, pw)), mode='symmetric')
        with torch.inference_mode():
            res = self.model(torch.from_numpy(img).permute(2, 0, 1)[None], torch.from_numpy(m)[None, None])
        out = np.clip(res[0].permute(1, 2, 0).numpy() * 255, 0, 255).astype(np.uint8)[:h, :w]
        return out


def erase(inpaint, rgb, rects):
    h, w = rgb.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    for x0, y0, x1, y1 in rects:
        mask[y0:y1, x0:x1] = 255
    filled = inpaint(rgb, mask)
    # Only the masked area changes (soft edge), every other pixel stays the original photo.
    soft = np.array(Image.fromarray(mask).filter(ImageFilter.GaussianBlur(2)), np.float32)[..., None] / 255
    return (filled * soft + rgb * (1 - soft)).astype(np.uint8)


def file_name(url):
    base = re.sub(r'[^a-z0-9-]+', '-', url.rsplit('/', 1)[-1].rsplit('.', 1)[0].lower()).strip('-')[:70] or 'photo'
    return f"{OUT_DIR}/{base}-{hashlib.sha1(url.encode()).hexdigest()[:8]}.jpg"


def product_urls(products):
    seen = []
    for p in products:
        for u in [p.get('imageUrl')] + list(p.get('images') or []):
            if isinstance(u, str) and u.startswith('https://') and u not in seen:
                seen.append(u)
    return seen


def apply(products, registry):
    """Every product uses the clean copy of a photo that was edited (the importer does the same)."""
    def mapped(u):
        v = registry['images'].get(u)
        return v['f'] if isinstance(v, dict) and v.get('f') else u
    changed = 0
    for p in products:
        imgs = list(p.get('images') or [])
        new = [mapped(u) for u in imgs]
        first = mapped(p['imageUrl']) if p.get('imageUrl') else p.get('imageUrl')
        if new != imgs or first != p.get('imageUrl'):
            p['images'], p['imageUrl'] = new, first
            changed += 1
    return changed


def main():
    start = time.time()
    raw = open(PRODUCTS).read()
    data = json.loads(raw)
    products = data['products']
    registry = load_registry()
    tokens = brand_tokens({p.get('brand') for p in products})
    pending = only or [u for u in product_urls(products) if u not in registry['images']]
    say(f'Photos: {len(product_urls(products))} supplier links, {len(pending)} not checked yet')
    from rapidocr_onnxruntime import RapidOCR
    engine = RapidOCR()
    inpaint = None
    today = datetime.date.today().isoformat()
    checked = edited = review = failed = 0
    def downloads(pool):
        # In batches: when the time budget ends no more photos are being downloaded for nothing.
        for i in range(0, len(pending), 32):
            if time.time() - start > budget:
                return
            yield from pool.map(fetch, pending[i:i + 32])

    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        for url, blob in downloads(pool):
            if time.time() - start > budget:
                break
            if not blob:
                failed += 1; continue
            try:
                rgb = np.array(Image.open(io.BytesIO(blob)).convert('RGB'))
            except Exception:
                failed += 1; continue
            checked += 1
            p = find(engine, rgb, tokens)
            if not p['remove']:
                registry['images'][url] = {'s': 'review', 'm': p['review'][:4], 'at': today} if p['review'] else 'ok'
                review += bool(p['review'])
                continue
            inpaint = inpaint or Inpainter()
            h, w = rgb.shape[:2]
            clean = erase(inpaint, rgb, mask_boxes(p['remove'], w, h))
            # Checked again (zoomed where the marks were): a second pass for anything not fully covered.
            left = find(engine, clean, tokens, p['remove'])
            if left['remove']:
                clean = erase(inpaint, clean, mask_boxes(left['remove'], w, h))
                left = find(engine, clean, tokens, p['remove'])
            name = file_name(url)
            os.makedirs(os.path.join(ROOT, 'public', OUT_DIR), exist_ok=True)
            Image.fromarray(clean).save(os.path.join(ROOT, 'public', name), quality=92, optimize=True, progressive=True)
            entry = {'s': 'edited', 'f': name, 'm': p['marks'][:6], 'by': inpaint.kind, 'at': today}
            if left['remove']:
                entry['left'] = left['marks'][:4]
            registry['images'][url] = entry
            edited += 1
            say(f"Cleaned {url.rsplit('/', 1)[-1]}: removed «{' / '.join(p['marks'])[:120]}»{' — check: ' + ' / '.join(left['marks']) if left['remove'] else ''}")
    left_over = len([u for u in product_urls(products) if u not in registry['images']])
    registry['updatedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
    with open(REGISTRY, 'w') as f:
        json.dump(registry, f, ensure_ascii=False, indent=0, sort_keys=True); f.write('\n')
    if write_products and apply(products, registry):
        with open(PRODUCTS, 'w') as f:
            f.write(json.dumps(data, ensure_ascii=False, indent=2) + ('\n' if raw.endswith('\n') else ''))
    total_edited = sum(1 for v in registry['images'].values() if isinstance(v, dict) and v.get('s') == 'edited')
    say(f'Checked {checked} photos in {round(time.time() - start)}s: {edited} cleaned, {review} unclear (left as is), {failed} not downloaded; '
        f'{left_over} wait for the next run; {total_edited} clean copies in the store so far')
    if os.environ.get('GITHUB_ACTIONS'):
        for n in notes[-9:]:
            print(f'::notice title=منقّح الصور::{n[:900]}')
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
            f.write('## منقّح الصور (إزالة بيانات تواصل المصدر)\n\n' + '\n'.join(f'- {n}' for n in notes) + '\n')


if __name__ == '__main__':
    main()
