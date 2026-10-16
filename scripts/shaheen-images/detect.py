"""Which text on a product photo is a source/contact mark to remove (pure rules; OCR is done by the caller).

A photo copied around the internet can carry the supplier's or another shop's contact details printed over
it (e.g. «SOUQSCENT.COM», «www.joveychic.net / instagram : joveychic»). Those are removed. Text that belongs
to the product stays: the brand's or maker's own site printed on the box (www.lattafa.com, afnan.com,
mahabubperfumes.com…), the names, sizes and the box's decorative patterns.

    boxes = [{'text', 'score', 'box': [x0, y0, x1, y1]}, ...]   # every OCR line of the photo
    plan(boxes, brand_tokens) -> {'remove': [boxes to erase], 'marks': [texts removed], 'review': [texts left for a human]}
"""
import re
from difflib import SequenceMatcher

DETECTOR_VERSION = 2

# The supplier itself (shamperfume.com, its phone/WhatsApp, e-mail and social handles): always removed.
SOURCE = re.compile(
    r'sham\s*-?\s*perfum|shamperf|shamp[ae]rf|'
    r'(?:\+?\s*6\s*0|0)\s*1\s*7\s*[-\s.]*8\s*7\s*3\s*[-\s.]*6\s*8\s*7\s*7|873\s*[-\s.]?\s*6877|'
    r'support@|@\s*sham', re.I)
# Any contact overlay: a web address, a social network, a handle, a phone number.
CONTACT = re.compile(
    r'www\s*\.|https?\s*:|\.(?:com|net|my|co|shop|store|org)\b|wa\.me|whats\s*app|instagram|facebook|tiktok|telegram|'
    r'(?<![\w.])@[a-z0-9_.]{3,}|(?:\+|00)\s*\d[\d\s-]{8,}\d|\b0\d{2}[-\s]?\d{3,4}[-\s]?\d{3,4}\b', re.I)
SOCIAL_WORD = re.compile(r'instagram|facebook|tiktok|telegram|whats\s*app', re.I)
# Makers whose site is printed on the boxes of the brands we sell (besides the brand names themselves).
MAKERS = ['lattafa', 'lattafaperfumes', 'afnan', 'armaf', 'sterling', 'sterlingparfums', 'mahabub', 'mahabubperfumes',
          'rasasi', 'zimaya', 'alhambra', 'maisonalhambra', 'ardalzaafaran', 'zaafaran', 'alrehab', 'crownperfumes',
          'gulforchid', 'alwataniah', 'grandeur', 'grandeurelite', 'volare', 'ruebroca', 'maisonasrar', 'shama', 'khadlaj',
          'fragranceworld', 'paris corner', 'emper', 'dior', 'ysl', 'baccarat']
MIN_SCORE = 0.85  # a clean read: misread tiny print («wwtaba.com», «o.com») is never erased on a guess


def letters(text):
    return re.sub(r'[^a-z]', '', text.lower())


def brand_tokens(brands):
    tokens = {letters(t) for t in MAKERS}
    for b in brands:
        if b and b != 'Unknown':
            tokens.add(letters(b))
            tokens.update(letters(w) for w in b.split() if len(letters(w)) >= 4)
    return {t for t in tokens if len(t) >= 3}


def core(text):
    """The name in a web address / handle: «www.souqscent.com» -> «souqscent»."""
    t = text.lower()
    t = re.sub(r'https?\s*:\s*/*|www\s*\.?', '', t)
    t = re.sub(r'\.(com|net|my|co|shop|store|org)\b.*$', '', t)
    t = re.sub(r'instagram|facebook|tiktok|telegram|whats\s*app|follow|us\b', '', t)
    return letters(t)


def is_packaging(text, tokens):
    c = core(text)
    if not c:
        return False
    for t in tokens:
        if len(t) >= 4 and (t in c or (len(c) >= 5 and c in t)):
            return True
        if len(t) >= 4 and SequenceMatcher(None, c, t).ratio() >= 0.8:
            return True
    return False


def meaningful(text):
    """A real contact, not a misread pattern: a name of 4+ letters, a social network, or a varied phone number."""
    if SOURCE.search(text) or SOCIAL_WORD.search(text):
        return True
    digits = re.sub(r'\D', '', text)
    if len(digits) >= 8 and not core(text):
        return len(set(digits)) >= 4
    return len(core(text)) >= 4


def classify(box, tokens):
    """'source' | 'contact' (both removed) | 'review' (contact-like but not sure) | None."""
    text, score = box['text'], float(box['score'])
    if SOURCE.search(text) and score >= 0.4:
        return 'source'
    if not CONTACT.search(text):
        return None
    if is_packaging(text, tokens) or not meaningful(text):
        return None
    return 'contact' if score >= MIN_SCORE else 'review'


def _h(b):
    return b['box'][3] - b['box'][1]


def _near(a, b):
    """b is the next/previous line of the same overlay block as a."""
    ax0, ay0, ax1, ay1 = a['box']; bx0, by0, bx1, by1 = b['box']
    line = max(_h(a), 8)
    gap = max(by0 - ay1, ay0 - by1)
    overlap = min(ax1, bx1) - max(ax0, bx0)
    return gap <= 1.2 * line and overlap > 0 and _h(b) <= 2.2 * line


COMMON = {'instagram', 'facebook', 'tiktok', 'telegram', 'whatsapp', 'follow', 'https', 'store', 'shop', 'perfume', 'perfumes'}


def names(text):
    """The shop's own name in a mark: «instagram : joveychic» -> {'joveychic'}."""
    return {w for w in re.findall(r'[a-z]{5,}', re.sub(r'www|\.(?:com|net|my|co|shop|store|org)\b', ' ', text.lower())) if w not in COMMON}


def _same_line(a, b):
    """b continues a's line (e.g. «: joveychic» read apart from «instagram»)."""
    ax0, ay0, ax1, ay1 = a['box']; bx0, by0, bx1, by1 = b['box']
    line = max(min(_h(a), _h(b)), 8)
    v = min(ay1, by1) - max(ay0, by0)
    gap = max(bx0 - ax1, ax0 - bx1)
    return v >= 0.5 * line and gap <= 2 * max(_h(a), 8) and _h(b) <= 2.2 * max(_h(a), 8)


def _shares_name(text, marks):
    t = letters(text)
    return len(t) >= 5 and any(n in t or SequenceMatcher(None, n, t).find_longest_match(0, len(n), 0, len(t)).size >= 5 for m in marks for n in names(m))


def plan(boxes, tokens):
    kinds = [classify(b, tokens) for b in boxes]
    remove = [i for i, k in enumerate(kinds) if k in ('source', 'contact')]
    # The rest of the same overlay: the rest of its line, and the lines next to it that the OCR could not
    # read cleanly, that are contacts too, or that repeat the shop's name — until nothing more joins.
    grew = True
    while grew:
        grew = False
        marks = [boxes[i]['text'] for i in remove]
        for i in list(remove):
            for j, b in enumerate(boxes):
                if j in remove or kinds[j] is None and is_packaging(b['text'], tokens) and not _shares_name(b['text'], marks):
                    continue
                joins = (float(b['score']) < MIN_SCORE or kinds[j] in ('review', 'source', 'contact') or bool(CONTACT.search(b['text']))
                         or _shares_name(b['text'], marks))
                if (_same_line(boxes[i], b) and (joins or re.match(r'\s*[:@|/-]', b['text']))) or (_near(boxes[i], b) and joins):
                    remove.append(j); grew = True
    review = [boxes[i]['text'] for i, k in enumerate(kinds) if k == 'review' and i not in remove]
    marks = []
    for i in remove:
        if boxes[i]['text'] not in marks:
            marks.append(boxes[i]['text'])
    return {'remove': [boxes[i] for i in remove], 'marks': marks, 'review': review}


def mask_boxes(remove, width, height):
    """Rectangles to erase, padded so no edge of a letter is left behind. Wider along the line: the faint ends
    of a semi-transparent watermark line are often not read (Al Qannas: «…chic» after «instagram : jove»)."""
    out = []
    for b in remove:
        x0, y0, x1, y1 = b['box']
        h = max(y1 - y0, 8)
        pad, side = max(5, int(0.4 * h)), max(8, 2 * h)
        out.append([max(0, x0 - side), max(0, y0 - pad), min(width, x1 + side), min(height, y1 + pad)])
    return out
