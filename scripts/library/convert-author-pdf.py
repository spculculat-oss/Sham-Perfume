"""Convert the author's PDF to a visual EPUB 3 without rewriting its contents.
Requires: pip install pymupdf==2.0 (or compatible version).
Usage: python scripts/library/convert-author-pdf.py INPUT.pdf OUTPUT.epub
The source PDF is deliberately kept outside Git. Every source page becomes one
fixed-layout XHTML page. Images preserve text, tables and art; extracted text is
screen-reader assistance only and must not replace the visible original.
"""
import argparse, hashlib, json
from html import escape
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_STORED, ZIP_DEFLATED
import pymupdf

TITLE = 'The Brilliance in the Science of Perfumes'
AUTHOR = 'Mustafa Khalifa'

def convert(source, output, report_path):
    document = pymupdf.open(source)
    if document.needs_pass: raise ValueError('Encrypted source is not supported')
    output.parent.mkdir(parents=True, exist_ok=True)
    entries = []
    def write(archive, path, content, stored=False):
        info = ZipInfo(path, (2026, 10, 21, 0, 0, 0))
        info.compress_type = ZIP_STORED if stored else ZIP_DEFLATED
        archive.writestr(info, content.encode('utf-8') if isinstance(content,str) else content)
    with ZipFile(output, 'w') as archive:
        write(archive, 'mimetype', 'application/epub+zip', True)
        write(archive, 'META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
        for index, page in enumerate(document):
            number = index + 1
            name = f'page-{number:03d}'
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(1100 / page.rect.width, 1100 / page.rect.width), alpha=False)
            image = pixmap.tobytes('jpeg', jpg_quality=80)
            write(archive, f'EPUB/images/{name}.jpg', image, True)
            # Assistance is hidden visually, not a claim of error-free OCR/accessibility.
            text = page.get_text().replace('\x00', '')
            text = ''.join(c for c in text if ord(c) >= 32 or c in '\n\t')
            body = f'''<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en"><head><title>Page {number}</title><meta name="viewport" content="width={int(page.rect.width)}, height={int(page.rect.height)}"/><style>html,body{{margin:0;padding:0;width:100%;height:100%;background:white}}img{{display:block;width:100%;height:100%;object-fit:contain}}.assist{{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}}</style></head><body><img src="images/{name}.jpg" alt="Original book page {number}"/><div class="assist">{escape(text)}</div></body></html>'''
            write(archive, f'EPUB/{name}.xhtml', body)
            entries.append((name, number, pixmap.width, pixmap.height, len(image)))
        links = ''.join(f'<li><a href="{name}.xhtml">Page {number}</a></li>' for name, number, *_ in entries)
        nav = f'''<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en"><head><title>Pages</title></head><body><nav epub:type="toc" id="toc"><h1>{escape(TITLE)}</h1><ol>{links}</ol></nav><nav epub:type="page-list" hidden="hidden"><ol>{links}</ol></nav></body></html>'''
        write(archive, 'EPUB/nav.xhtml', nav)
        manifest = '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
        for name, number, *_ in entries:
            manifest += f'<item id="{name}" href="{name}.xhtml" media-type="application/xhtml+xml"/><item id="img-{number}" href="images/{name}.jpg" media-type="image/jpeg"' + (' properties="cover-image"' if number==1 else '') + '/>'
        spine = ''.join(f'<itemref idref="{name}"/>' for name,*_ in entries)
        package = f'''<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" prefix="rendition: http://www.idpf.org/vocab/rendition/#"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:sham:mustafa-khalifa:brilliance:visual-v1</dc:identifier><dc:title>{escape(TITLE)}</dc:title><dc:creator>{AUTHOR}</dc:creator><dc:language>en</dc:language><dc:rights>Copyright retained by the author. Published with the author's permission in this conversation; no open redistribution licence is asserted.</dc:rights><dc:description>Visual fixed-layout conversion of all {len(document)} source PDF pages. Not a scientific review. Visible content is unchanged; extracted text is assistive only.</dc:description><meta property="dcterms:modified">2026-10-21T00:00:00Z</meta><meta property="rendition:layout">pre-paginated</meta><meta property="rendition:spread">none</meta><meta property="rendition:orientation">auto</meta></metadata><manifest>{manifest}</manifest><spine page-progression-direction="ltr">{spine}</spine></package>'''
        write(archive, 'EPUB/package.opf', package)
    report = {'title':TITLE, 'author':AUTHOR, 'sourcePages':len(document), 'epubPages':len(entries), 'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'epubSha256':hashlib.sha256(output.read_bytes()).hexdigest(), 'epubBytes':output.stat().st_size, 'format':'EPUB 3 fixed-layout visual', 'imageWidth':1100, 'jpegQuality':80, 'textReview':'not a scientific review; no source statements rewritten', 'navigation':'one entry per original page; original printed contents preserved', 'rights':'Author asserted ownership and requested publication in chat. No general redistribution licence granted.'}
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path);parser.add_argument('output',type=Path)
    parser.add_argument('--report',type=Path,default=Path('.data/library-intake/conversion-report.json'))
    args=parser.parse_args();convert(args.source,args.output,args.report)
