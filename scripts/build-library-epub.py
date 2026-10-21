"""Build the site's original short reading guide. Never converts catalogue blurbs into reference books.
Run: python3 scripts/build-library-epub.py
"""
from pathlib import Path
import json
from html import escape
from zipfile import ZipFile, ZipInfo, ZIP_STORED, ZIP_DEFLATED
ROOT = Path(__file__).resolve().parent.parent
source = json.loads((ROOT / 'content/library/reading-guide.json').read_text())
output = ROOT / 'public/books/sham-reading-guide.epub'
output.parent.mkdir(parents=True, exist_ok=True)
def xhtml(title, body):
    return f'''<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ar" xml:lang="ar" dir="rtl"><head><title>{escape(title)}</title><style>body{{font-family:serif;line-height:1.9;padding:1em;color:#202020;background:white}}h1{{font-size:1.6em}}p{{margin-bottom:1em}}</style></head><body>{body}</body></html>'''
files = {'mimetype': 'application/epub+zip', 'META-INF/container.xml': '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'}
items, refs, links = [], [], []
for i, chapter in enumerate(source['chapters'], 1):
    name = f'chapter-{i}.xhtml'
    files[f'EPUB/{name}'] = xhtml(chapter['title'], '<h1>' + escape(chapter['title']) + '</h1>' + (f'<p>{escape(source["description"])}</p>' if i == 1 else '') + ''.join('<p>' + escape(p) + '</p>' for p in chapter['paragraphs']))
    items.append(f'<item id="c{i}" href="{name}" media-type="application/xhtml+xml"/>')
    refs.append(f'<itemref idref="c{i}"/>')
    links.append(f'<li><a href="{name}">{escape(chapter["title"])}</a></li>')
files['EPUB/nav.xhtml'] = xhtml('الفهرس', '<nav epub:type="toc" id="toc"><h1>الفهرس</h1><ol>' + ''.join(links) + '</ol></nav>')
files['EPUB/package.opf'] = f'''<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">{source['id']}</dc:identifier><dc:title>{escape(source['title'])}</dc:title><dc:language>ar</dc:language><dc:creator>مكتبة شام — إعداد بمساعدة الذكاء الاصطناعي</dc:creator><dc:description>{escape(source['description'])}</dc:description><meta property="dcterms:modified">2026-10-21T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>{''.join(items)}</manifest><spine page-progression-direction="rtl">{''.join(refs)}</spine></package>'''
with ZipFile(output, 'w') as archive:
    for name, text in files.items():
        info = ZipInfo(name, (2026, 10, 21, 0, 0, 0))
        info.compress_type = ZIP_STORED if name == 'mimetype' else ZIP_DEFLATED
        archive.writestr(info, text.encode('utf-8'))
print(output.relative_to(ROOT))
