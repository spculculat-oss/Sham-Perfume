# The Brilliance in the Science of Perfumes — author publication

## Source and authorization
The merchant stated that they authored the book and expressly requested EPUB conversion and publication in this conversation. Source Drive file ID: `1sJKWm8Gno2VvODFrjQoKxv1ylNIzg3-R`. Title/author are taken from PDF metadata and the title page: **The Brilliance in the Science of Perfumes**, **Mustafa Khalifa**. No open licence or independent rights certification is asserted.

The 19,151,598-byte source PDF is stored locally in ignored `.data/library-intake/source.pdf`, not committed. SHA-256 and conversion details are recorded in `content/library/brilliance-conversion.json`.

## Conversion choice
- 359 source pages → 359 EPUB spine items, with all original pages retained, including blank/artwork pages.
- EPUB 3 fixed-layout visual edition, left-to-right, English. Each page is rendered as a 1,100-pixel-wide JPEG at quality 80. Page images are resampled/compressed, not byte-identical to PDF artwork.
- This preserves the appearance/reading order of the visible source, including tables and illustrations, rather than publishing an unreliable automatic reflow.
- There is no original PDF bookmark tree. The EPUB offers page-number navigation; the author's printed contents remain in the page images. No fabricated chapter links.
- Extracted text is included as assistive text only. It was not manually proofread, and this is **not** a fully accessible/reflowable text edition. Readers needing font resizing, search or editable text should request the original Word/manuscript for a separately checked text edition. Fixed-layout readers with zoom are recommended for small screens.
- Conversion is not scientific/medical review, endorsement, or rewriting of any claims or recipes.

## Rebuild
Use Python with PyMuPDF in a local virtual environment:

```
python3 -m venv .venv
.venv/bin/pip install pymupdf==2.0
.venv/bin/python scripts/library/convert-author-pdf.py .data/library-intake/source.pdf public/books/brilliance-science-perfumes.epub --report content/library/brilliance-conversion.json
```

The generated file is about 55 MiB. Published EPUBs have a 64 MiB client limit and a longer loading timeout; user-selected files retain their existing 20 MiB limit. The site serves the checked-in EPUB at the correct Pages base path and exposes read/download controls in a separate author-book section. No source-PDF download, AI-generated-author attribution or false scientific approval is attached to this book.

## Checks
- `tests/authorEpub.test.ts`: source/output counts, SHA-256, file size, all 359 XHTMLs and JPEGs, OPF and navigation XML.
- `scripts/check-author-epub.mjs`: browser test of cover and pages 2/180/359 on desktop/mobile, image decoding and close/reopen. Run against a local built Pages preview with `BROWSER_EXECUTABLE` and `READER_BASE_URL`.
- `npm run lint`, `npm test`, `npm run build:pages`.
