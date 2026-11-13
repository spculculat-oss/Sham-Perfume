import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { epubAssetUrl } from '../src/library/epubAssets';

test('original booklets have real full chapters, explicit scope and matching EPUBs', () => {
  for (const slug of ['scent-observation', 'evidence-notebook']) {
    const text = JSON.parse(readFileSync(new URL(`../content/library/${slug}.json`, import.meta.url), 'utf8'));
    assert.equal(text.language, 'ar');
    assert.equal(text.chapters.length, 6);
    assert.ok(text.description.includes('الذكاء الاصطناعي'));
    assert.ok(text.description.includes('تمهيدي'));
    for (const chapter of text.chapters) {
      assert.equal(chapter.paragraphs.length, 3);
      assert.ok(chapter.paragraphs.every((p: string) => p.length > 100));
    }
    assert.ok(existsSync(new URL(`../public/books/sham-${slug}.epub`, import.meta.url)));
    assert.equal(epubAssetUrl(`books/sham-${slug}.epub`, '/Sham-Perfume/'), `/Sham-Perfume/books/sham-${slug}.epub`);
  }
});
test('generated EPUBs contain valid container, navigation and six full chapters and are reproducible', () => {
  const program = `
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as E
import json, runpy, sys
root=Path.cwd()
paths=list((root/'public/books').glob('*.epub'))
before={p:p.read_bytes() for p in paths}
sys.argv=['scripts/build-library-epub.py','--all']
runpy.run_path('scripts/build-library-epub.py',run_name='__main__')
assert all(p.read_bytes()==data for p,data in before.items())
for slug in ('scent-observation','evidence-notebook'):
 text=json.loads((root/f'content/library/{slug}.json').read_text())
 with ZipFile(root/f'public/books/sham-{slug}.epub') as z:
  assert z.namelist()[0]=='mimetype' and z.getinfo('mimetype').compress_type==0
  assert z.read('mimetype')==b'application/epub+zip'
  for name in z.namelist():
   if name.endswith(('.xml','.opf','.xhtml')): E.fromstring(z.read(name))
  assert sum(name.startswith('EPUB/chapter-') for name in z.namelist())==6
  for i,c in enumerate(text['chapters'],1):
   body=z.read(f'EPUB/chapter-{i}.xhtml').decode()
   assert all(p in body for p in c['paragraphs'])
`;
  execFileSync('python3', ['-c', program], { cwd: new URL('../', import.meta.url), stdio: 'pipe' });
});
