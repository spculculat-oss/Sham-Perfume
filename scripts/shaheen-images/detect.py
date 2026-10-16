"""Finds the supplier's contact marks (site, phone/WhatsApp, e-mail, social handles) printed on a product photo.

    marks = find_marks(engine, image)   # [{'text', 'kind', 'box': [x0, y0, x1, y1], 'score'}]

kind = 'source'  : the supplier itself (shamperfume, its phone, its handles) — always removed
       'contact' : any other contact overlay (www/http, @handle, wa.me, a phone number) — removed too,
                   except text that belongs to the product (the brand's own site printed on the box is kept
                   because it does not match a contact pattern on its own: «LATTAFA» is not a contact).
"""
import re

SOURCE = re.compile(
    r'sham\s*-?\s*perfum|shamperf|perfume\s*store|shamp[ae]rf|'
    r'(?:\+?\s*6\s*0|0)\s*1\s*7\s*[-\s.]*8\s*7\s*3\s*[-\s.]*6\s*8\s*7\s*7|873\s*[-\s.]?\s*6877|'
    r'support@|@\s*sham', re.I)
CONTACT = re.compile(
    r'www\s*\.|https?\s*:|\.com\b|\.my\b|\.net\b|wa\.me|whats\s*app|instagram|facebook|tiktok|telegram|'
    r'(?<![\w.])@[a-z0-9_.]{3,}|'
    r'(?:\+|00)\s*\d[\d\s-]{8,}\d|\b0\d{2}[-\s]?\d{3,4}[-\s]?\d{3,4}\b', re.I)


def classify(text):
    if SOURCE.search(text):
        return 'source'
    if CONTACT.search(text):
        return 'contact'
    return None


def find_marks(engine, image):
    """`engine` is a rapidocr_onnxruntime.RapidOCR; `image` a numpy RGB array or a path."""
    result, _ = engine(image)
    marks = []
    for box, text, score in result or []:
        kind = classify(text)
        if not kind or float(score) < 0.5:
            continue
        xs = [p[0] for p in box]; ys = [p[1] for p in box]
        marks.append({'text': text, 'kind': kind, 'score': round(float(score), 2),
                      'box': [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]})
    return marks
