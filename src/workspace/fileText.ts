/**
 * The text inside a visitor's file, read in his browser so it can go with his question: plain text and code as they
 * are; Word, PowerPoint and Excel from their XML; PDF through the PDF reader (loaded only when needed).
 */
import { unzipSync, strFromU8 } from 'fflate';

export const MAX_TEXT = 60_000;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|html?|css|js|mjs|cjs|jsx|ts|tsx|py|java|c|cc|cpp|h|hpp|cs|go|rs|php|rb|kt|swift|sql|sh|bat|ps1|ya?ml|toml|ini|env|log|srt|vtt|tex|r|m|dart|lua|pl|scala|vue|svelte)$/i;

/** XML text runs: <w:t> (Word), <a:t> (PowerPoint), paragraphs on their own lines. */
export function xmlText(xml: string, tag: 'w' | 'a'): string {
  return xml
    .replace(new RegExp(`</${tag}:p>`, 'g'), '\n')
    .replace(tag === 'w' ? /<w:tab\/>/g : /<a:br\/>/g, tag === 'w' ? '\t' : '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** An .xlsx workbook as tab-separated rows, sheet after sheet. */
export function xlsxText(files: Record<string, Uint8Array>): string {
  const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const shared = files['xl/sharedStrings.xml'] ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decode((m[1]!.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(''))) : [];
  const sheets = Object.keys(files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  return sheets.map((name, i) => {
    const xml = strFromU8(files[name]!);
    const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) => [...row[1]!.matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((c) => {
      const attrs = c[1] || '';
      const body = c[2] || '';
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (/t="s"/.test(attrs) && v !== undefined) return shared[Number(v)] ?? '';
      if (/t="inlineStr"/.test(attrs)) return decode((body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1]) || '');
      return v !== undefined ? decode(v) : '';
    }).join('\t'));
    return `${sheets.length > 1 ? `# ${i + 1}\n` : ''}${rows.join('\n')}`;
  }).join('\n\n').trim();
}

export function officeText(bytes: Uint8Array, name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const files = unzipSync(bytes, { filter: (f) => /^(word\/document\.xml|ppt\/slides\/slide\d+\.xml|xl\/sharedStrings\.xml|xl\/worksheets\/sheet\d+\.xml)$/.test(f.name) });
  if (ext === 'docx') return files['word/document.xml'] ? xmlText(strFromU8(files['word/document.xml']), 'w') : '';
  if (ext === 'pptx') {
    return Object.keys(files).filter((n) => n.startsWith('ppt/slides/')).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
      .map((n, i) => `## ${i + 1}\n${xmlText(strFromU8(files[n]!), 'a')}`).join('\n\n');
  }
  if (ext === 'xlsx') return xlsxText(files);
  return '';
}

export const isTextLike = (name: string, type: string) => TEXT_EXT.test(name) || type.startsWith('text/') || /json|xml|javascript/.test(type);

/** The file's text (capped), or '' when it has none (an image, audio…). */
export async function fileText(blob: Blob, name: string): Promise<string> {
  const type = blob.type || '';
  if (isTextLike(name, type)) return (await blob.text()).slice(0, MAX_TEXT);
  if (/\.(docx|pptx|xlsx)$/i.test(name)) {
    try { return officeText(new Uint8Array(await blob.arrayBuffer()), name).slice(0, MAX_TEXT); } catch { return ''; }
  }
  if (/\.pdf$/i.test(name) || type === 'application/pdf') {
    try {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: true });
      return String(text || '').slice(0, MAX_TEXT);
    } catch { return ''; }
  }
  return '';
}
