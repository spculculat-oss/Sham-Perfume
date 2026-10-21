import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MAX_EPUB_BYTES, MAX_PUBLISHED_EPUB_BYTES } from '../src/library/EpubReader';

test('author conversion retains all source pages and stays within published reader limit', () => {
  const report = JSON.parse(readFileSync(new URL('../content/library/brilliance-conversion.json', import.meta.url), 'utf8'));
  const book = new URL('../public/books/brilliance-science-perfumes.epub', import.meta.url);
  assert.equal(report.sourcePages, 359);
  assert.equal(report.epubPages, report.sourcePages);
  assert.equal(statSync(book).size, report.epubBytes);
  assert.equal(createHash('sha256').update(readFileSync(book)).digest('hex'), report.epubSha256);
  assert.ok(report.epubBytes <= MAX_PUBLISHED_EPUB_BYTES);
  assert.ok(MAX_EPUB_BYTES < MAX_PUBLISHED_EPUB_BYTES, 'Local-file limit must not silently grow');
});
test('EPUB package, navigation, spine and all page images are present and well-formed', () => {
  execFileSync('python3', ['-c', `
from zipfile import ZipFile
from xml.etree import ElementTree as E
with ZipFile('public/books/brilliance-science-perfumes.epub') as z:
 assert z.namelist()[0]=='mimetype' and z.getinfo('mimetype').compress_type==0
 assert z.read('mimetype')==b'application/epub+zip'
 ns={'p':'http://www.idpf.org/2007/opf'}
 package=E.fromstring(z.read('EPUB/package.opf'))
 assert len(package.findall('.//p:spine/p:itemref',ns))==359
 assert package.find('.//p:meta[@property="rendition:layout"]',ns).text=='pre-paginated'
 assert len([n for n in z.namelist() if n.startswith('EPUB/images/')])==359
 for i in range(1,360):
  name=f'page-{i:03d}'
  E.fromstring(z.read(f'EPUB/{name}.xhtml'))
  assert z.read(f'EPUB/images/{name}.jpg')[:2]==bytes([255,216])
 E.fromstring(z.read('EPUB/nav.xhtml'))
`], { cwd: new URL('../', import.meta.url), stdio: 'pipe' });
});
