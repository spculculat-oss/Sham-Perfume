#!/usr/bin/env python3
"""
Share cards for «صمم عطرك مع شام».

One 1200×630 Open Graph image per tool page (plus the home and media pages), and tall 1000×1500
pins for the three tools people search for most. WhatsApp, Facebook, X, Telegram, LinkedIn and
Pinterest all read `og:image`; a card with the tool's own Arabic title gets noticeably more clicks
than a generic logo, which is the whole point of this file.

The images are **committed** (public/og/*.png), so builds never need Python or ImageMagick. Re-run
this only when the copy changes:

    pip install --break-system-packages pillow arabic-reshaper python-bidi
    python3 scripts/seo-og/generate.py

Arabic is a joined script: PIL draws glyphs left-to-right, so every string goes through
`arabic_reshaper` (with `use_unshaped_instead_of_isolated=True` because Cairo maps isolated forms to
standard U+06xx codepoints) and then the bidi algorithm (visual order). The font is Cairo (SIL OFL,
see fonts/OFL.txt) — the same family the site loads from Google Fonts.
"""
from __future__ import annotations

import pathlib
import sys

import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
FONTS = pathlib.Path(__file__).resolve().parent / 'fonts'
OUT = ROOT / 'public' / 'og'

RESHAPER = arabic_reshaper.ArabicReshaper(
    configuration={'use_unshaped_instead_of_isolated': True}
)

WEIGHTS = {
    '400': 'Cairo_400Regular.ttf',
    '600': 'Cairo_600SemiBold.ttf',
    '700': 'Cairo_700Bold.ttf',
    '900': 'Cairo_900Black.ttf',
}

INK = (18, 16, 13)
CREAM = (255, 250, 244)
GOLD = (251, 191, 36)
GOLD_DEEP = (217, 119, 6)
MUTED = (214, 205, 196)

SITE = 'صمم عطرك مع شام'
KICKER = 'معمل شام · أدوات تركيب العطور'

# id → (title, subtitle) — matches the page ids in src/seo/pages.ts plus 'home' and 'media'.
TOOLS: dict[str, tuple[str, str]] = {
    'home': ('صمم عطرك مع شام', 'حاسبات المعمل، الهرم العطري، التعتيق، المواد الخام، ومتجر العطور'),
    'media': ('الملف الإعلامي لمعمل شام', 'نصوص جاهزة للاقتباس وروابط الأدوات والشعار الرسمي للمدونات والصحافة'),
    'concentration': ('حاسبة تركيب العطور', 'نسب الزيت والكحول والماء بدقة 0.01 جرام لأي حجم وتركيز'),
    'alcohol': ('حاسبة تخفيف الكحول', 'من 96% إلى 80% أو 70% — كمية الماء المقطر بدقة'),
    'pyramid': ('الهرم العطري ومحاكاة الرش', 'رتّب المقدمة والقلب والقاعدة وشاهد العطر على الجلد'),
    'molecule_studio': ('مختبر تركيب وتحليل العطور', 'المكونات والنسب ومراحل الهرم وموعد التعتيق'),
    'maceration_simulator': ('محاكي التعتيق الزمني', 'تاريخ النضج المتوقع ومراحل التعتيق حتى الاستخدام'),
    'costing': ('حاسبة تكلفة العطر والربح', 'سعر الزجاجة وهامش الربح وسعر الجملة قبل التصنيع'),
    'raw_materials': ('موسوعة المواد الخام', 'العود والورد والمسك والعنبر: العائلات والثبات والنسب'),
    'world_perfumes': ('مكتبة العطور العالمية', 'عطور أيقونية بنوتاتها وأفكارها لتصميم نسختك'),
    'perfume_news': ('مرصد أخبار العطور', 'اتجاهات التصميم والمعارض والمواد الخام بالعربي'),
    'guide': ('دليل التعتيق والمثبتات', 'كيف يطول ثبات العطر وتُخزَّن التركيبة بشكل صحيح'),
    'library': ('مكتبة الوصفات العطرية', 'احفظ تركيباتك وافتحها في الحاسبة أو بطاقة التصنيع'),
    'master_ai': ('الخبير شاهين', 'مساعدك في تصميم العطر: نوتات ونسب واختيار الأدوات'),
    'store': ('متجر شام', 'عطور مختارة بعناية بالصور والنوتات والأسعار'),
}

# Pinterest reads the tall card; these three are the tools with the clearest search intent.
PINS: dict[str, tuple[str, str, list[str]]] = {
    'concentration': (
        'حاسبة تركيب العطور',
        'احسب كل مكوّن بالجرام قبل أن تخلط',
        ['Parfum 20–30%', 'EDP 15–20%', 'EDT 8–12%'],
    ),
    'alcohol': (
        'تخفيف الكحول للعطور',
        'من 96% إلى النسبة التي تريدها',
        ['ماء مقطر', 'بلا تعكّر', 'بدقة مل'],
    ),
    'maceration_simulator': (
        'تعتيق العطر',
        'كم يوماً تحتاج تركيبتك لتنضج؟',
        ['21–45 يوماً', 'مكان بارد', 'تاريخ النضج'],
    ),
}

BULLETS = ['مجاناً', 'بلا تسجيل', 'يعمل على الهاتف']


def ar(text: str) -> str:
    """Arabic shaping + bidi, the two steps PIL cannot do on its own."""
    return get_display(RESHAPER.reshape(text))


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    """`weight` is the numeric CSS weight; the file names carry the style suffix."""
    name = WEIGHTS.get(weight, WEIGHTS['400'])
    return ImageFont.truetype(str(FONTS / name), size)


def gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    width, height = size
    base = Image.new('RGB', (1, height))
    for y in range(height):
        t = y / max(height - 1, 1)
        base.putpixel((0, y), tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return base.resize((width, height), Image.BILINEAR)


def glow(size: tuple[int, int], center: tuple[int, int], radius: int, color: tuple[int, int, int], strength: float) -> Image.Image:
    """A soft radial light, used behind the bottle so the card has depth."""
    layer = Image.new('RGB', size, (0, 0, 0))
    draw = ImageDraw.Draw(layer)
    steps = 26
    for step in range(steps, 0, -1):
        r = int(radius * step / steps)
        alpha = strength * (1 - step / steps) ** 2
        draw.ellipse(
            [center[0] - r, center[1] - r, center[0] + r, center[1] + r],
            fill=tuple(int(c * alpha) for c in color),
        )
    return layer.filter(ImageFilter.GaussianBlur(radius // 6))


def bottle(size: tuple[int, int], scale: float, cx: int | None = None, body_top: int | None = None) -> Image.Image:
    """A flacon drawn from primitives — no photo, no licensing, and it scales cleanly."""
    width, height = size
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cx = cx if cx is not None else width // 2
    body_w = int(150 * scale)
    body_h = int(230 * scale)
    body_top = body_top if body_top is not None else int(height * 0.42)
    radius = int(30 * scale)
    # glass body
    draw.rounded_rectangle(
        [cx - body_w // 2, body_top, cx + body_w // 2, body_top + body_h],
        radius=radius,
        fill=(251, 191, 36, 26),
        outline=(251, 191, 36, 150),
        width=max(2, int(2 * scale)),
    )
    # liquid
    liquid_top = body_top + int(body_h * 0.42)
    draw.rounded_rectangle(
        [
            cx - body_w // 2 + int(6 * scale),
            liquid_top,
            cx + body_w // 2 - int(6 * scale),
            body_top + body_h - int(6 * scale),
        ],
        radius=int(radius * 0.8),
        fill=(217, 119, 6, 130),
    )
    # neck + collar
    neck_w = int(46 * scale)
    draw.rectangle(
        [cx - neck_w // 2, body_top - int(46 * scale), cx + neck_w // 2, body_top],
        fill=(251, 191, 36, 65),
        outline=(251, 191, 36, 160),
        width=max(2, int(2 * scale)),
    )
    # cap
    cap_w, cap_h = int(74 * scale), int(58 * scale)
    draw.rounded_rectangle(
        [cx - cap_w // 2, body_top - int(46 * scale) - cap_h, cx + cap_w // 2, body_top - int(46 * scale)],
        radius=int(8 * scale),
        fill=(251, 191, 36, 220),
    )
    # label
    label_w, label_h = int(body_w * 0.62), int(body_h * 0.20)
    draw.rounded_rectangle(
        [
            cx - label_w // 2,
            body_top + int(body_h * 0.13),
            cx + label_w // 2,
            body_top + int(body_h * 0.13) + label_h,
        ],
        radius=int(6 * scale),
        fill=(255, 250, 244, 225),
    )
    return layer


def wrap(text: str, fnt: ImageFont.FreeTypeFont, max_width: int, limit: int) -> list[str]:
    """Wrap on the logical (unshaped) string so word order stays natural, then shape each line."""
    words = text.split()
    lines: list[str] = []
    current = ''
    probe = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    for idx, word in enumerate(words):
        candidate = f'{current} {word}'.strip()
        if probe.textlength(ar(candidate), font=fnt) <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
            if len(lines) == limit - 1:
                current = ' '.join(words[idx:])
                break
    if current:
        lines.append(current)
    return lines[:limit]


def fit_lines(lines: list[str], weight: str, start: int, max_width: int, limit: int) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    size = start
    probe = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    while size > 26:
        fnt = font(weight, size)
        if max(probe.textlength(ar(line), font=fnt) for line in lines) <= max_width and len(lines) <= limit:
            return fnt, lines
        size -= 2
    return font(weight, size), lines


def card_og(title: str, subtitle: str) -> Image.Image:
    width, height = 1200, 630
    image = gradient((width, height), (26, 21, 16), (10, 9, 8)).convert('RGB')
    image = Image.blend(image, glow((width, height), (210, 340), 420, (217, 119, 6), 0.9), 0.36)

    # Place flacon on the visual left so right-aligned Arabic copy has full breathing room
    flacon = bottle((width, height), 0.98, cx=205, body_top=230)
    image.paste(flacon, (0, 0), flacon)

    draw = ImageDraw.Draw(image, 'RGBA')

    # frame
    draw.rounded_rectangle([28, 28, width - 28, height - 28], radius=26, outline=(251, 191, 36, 220), width=2)
    draw.rounded_rectangle([36, 36, width - 36, height - 36], radius=22, outline=(251, 191, 36, 55), width=1)

    right = width - 84
    text_max_w = 740

    # kicker + site subtitle
    kicker = font('700', 29)
    draw.text((right, 84), ar(KICKER), font=kicker, fill=GOLD, anchor='ra')
    small = font('400', 25)
    draw.text((right, 126), ar(SITE), font=small, fill=MUTED, anchor='ra')

    # title (up to 2 lines)
    title_fnt = font('900', 72)
    lines = wrap(title, title_fnt, text_max_w, 2)
    title_fnt, lines = fit_lines(lines, '900', 72, text_max_w, 2)
    y = 198
    for line in lines:
        draw.text((right, y), ar(line), font=title_fnt, fill=CREAM, anchor='ra')
        y += int(title_fnt.size * 1.28)

    # gold rule
    draw.rounded_rectangle([right - 210, y + 12, right, y + 18], radius=3, fill=GOLD)

    # subtitle (up to 2 lines)
    sub_fnt = font('400', 32)
    sub_lines = wrap(subtitle, sub_fnt, text_max_w, 2)
    y += 42
    for line in sub_lines:
        draw.text((right, y), ar(line), font=sub_fnt, fill=MUTED, anchor='ra')
        y += int(sub_fnt.size * 1.42)

    # translucent badge pills along the bottom-right
    chip_fnt = font('600', 24)
    x = right
    pill_top, pill_bottom = height - 118, height - 66
    for label in BULLETS:
        text = ar(label)
        tw = draw.textlength(text, font=chip_fnt)
        box_w = int(tw + 44)
        draw.rounded_rectangle(
            [x - box_w, pill_top, x, pill_bottom],
            radius=26,
            fill=(251, 191, 36, 36),
            outline=(251, 191, 36, 155),
            width=2,
        )
        draw.text((x - box_w // 2, (pill_top + pill_bottom) // 2), text, font=chip_fnt, fill=GOLD, anchor='mm')
        x -= box_w + 16

    # url on bottom-left
    url_fnt = font('600', 22)
    draw.text((84, height - 92), 'spculculat-oss.github.io/Sham-Perfume', font=url_fnt, fill=(168, 156, 144), anchor='lm')
    return image.convert('RGB')


def card_pin(title: str, subtitle: str, bullets: list[str]) -> Image.Image:
    width, height = 1000, 1500
    image = gradient((width, height), (26, 21, 16), (9, 8, 7)).convert('RGB')
    image = Image.blend(image, glow((width, height), (500, 820), 560, (217, 119, 6), 0.9), 0.34)

    flacon = bottle((width, height), 1.04, cx=width // 2, body_top=755)
    image.paste(flacon, (0, 0), flacon)

    draw = ImageDraw.Draw(image, 'RGBA')

    draw.rounded_rectangle([30, 30, width - 30, height - 30], radius=30, outline=(251, 191, 36, 230), width=3)

    draw.text((width // 2, 108), ar(KICKER), font=font('700', 34), fill=GOLD, anchor='ma')
    draw.text((width // 2, 164), ar(SITE), font=font('400', 28), fill=MUTED, anchor='ma')

    title_lines = wrap(title, font('900', 88), 780, 2)
    title_fnt, title_lines = fit_lines(title_lines, '900', 88, 780, 2)
    y = 250
    for line in title_lines:
        draw.text((width // 2, y), ar(line), font=title_fnt, fill=CREAM, anchor='ma')
        y += int(title_fnt.size * 1.28)

    draw.rounded_rectangle([width // 2 - 120, y + 20, width // 2 + 120, y + 28], radius=4, fill=GOLD)

    sub_lines = wrap(subtitle, font('400', 38), 760, 2)
    y += 62
    for line in sub_lines:
        draw.text((width // 2, y), ar(line), font=font('400', 38), fill=MUTED, anchor='ma')
        y += 56

    chip_fnt = font('700', 32)
    y = height - 410
    for label in bullets:
        text = ar(label)
        tw = draw.textlength(text, font=chip_fnt)
        box_w = int(tw + 76)
        draw.rounded_rectangle(
            [width // 2 - box_w // 2, y, width // 2 + box_w // 2, y + 66],
            radius=33,
            fill=(251, 191, 36, 38),
            outline=(251, 191, 36, 165),
            width=2,
        )
        draw.text((width // 2, y + 33), text, font=chip_fnt, fill=GOLD, anchor='mm')
        y += 82

    draw.text((width // 2, height - 148), ar('مجاناً في متصفحك'), font=font('600', 30), fill=MUTED, anchor='ma')
    draw.text((width // 2, height - 98), 'spculculat-oss.github.io/Sham-Perfume', font=font('600', 24), fill=(158, 148, 138), anchor='ma')
    return image.convert('RGB')


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    written = 0
    for page_id, (title, subtitle) in TOOLS.items():
        path = OUT / f'{page_id}.png'
        card_og(title, subtitle).save(path, 'PNG', optimize=True)
        written += 1
    for page_id, (title, subtitle, bullets) in PINS.items():
        path = OUT / f'pin-{page_id}.png'
        card_pin(title, subtitle, bullets).save(path, 'PNG', optimize=True)
        written += 1
    print(f'{written} share cards written to {OUT.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
