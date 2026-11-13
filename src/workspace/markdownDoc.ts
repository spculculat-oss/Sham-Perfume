/**
 * «مساحة شاهين»: a reply (Markdown) read as a document — title, sections, paragraphs, points, tables, code — so it
 * can become Word, Excel, PowerPoint or PDF. Pure (no DOM).
 */
export type DocBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'code'; lang: string; text: string };
export interface DocModel { title: string; blocks: DocBlock[]; rtl: boolean }

/** **bold**, *italic*, `code` and [links](url) as plain words (the writers style headings themselves). */
export const plainInline = (text: string) => text
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
  .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1')
  .replace(/(?<![\p{L}\d])\*([^*\n]+)\*(?![\p{L}\d])/gu, '$1').replace(/`([^`]+)`/g, '$1')
  .trim();

const cells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => plainInline(c.trim()));
export const isRtlText = (text: string) => {
  const rtl = (text.match(/[\u0590-\u08FF]/g) || []).length;
  const ltr = (text.match(/[A-Za-z]/g) || []).length;
  return rtl > ltr;
};

export function parseMarkdown(text: string, fallbackTitle = 'Shaheen'): DocModel {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: DocBlock[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ type: 'paragraph', text: plainInline(para.join(' ')) }); para = []; } };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const fence = line.match(/^\s*(```|~~~)\s*([\w+#.-]*)/);
    if (fence) {
      flush();
      const body: string[] = [];
      for (i += 1; i < lines.length && !lines[i]!.trim().startsWith(fence[1]!); i += 1) body.push(lines[i]!);
      const lang = (fence[2] || '').toLowerCase();
      if (!lang.startsWith('sham-')) blocks.push({ type: 'code', lang, text: body.join('\n') });
      continue;
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) { flush(); blocks.push({ type: 'heading', level: Math.min(3, heading[1]!.length) as 1 | 2 | 3, text: plainInline(heading[2]!) }); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      const rows: string[][] = [];
      for (; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]!); i += 1) {
        if (/^\s*\|?\s*:?-{2,}/.test(lines[i]!)) continue;
        rows.push(cells(lines[i]!));
      }
      i -= 1;
      if (rows.length) blocks.push({ type: 'table', rows });
      continue;
    }
    const item = line.match(/^\s*([-*+•]|\d+[.)])\s+(.+)$/);
    if (item) {
      flush();
      const ordered = /\d/.test(item[1]!);
      const items: string[] = [];
      for (; i < lines.length; i += 1) {
        const m = lines[i]!.match(/^\s*([-*+•]|\d+[.)])\s+(.+)$/);
        if (!m) { if (lines[i]!.trim() && /^\s{2,}\S/.test(lines[i]!) && items.length) { items[items.length - 1] += ` ${plainInline(lines[i]!)}`; continue; } break; }
        items.push(plainInline(m[2]!));
      }
      i -= 1;
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { flush(); continue; }
    if (!line.trim()) { flush(); continue; }
    para.push(line.trim().replace(/^>\s?/, ''));
  }
  flush();
  const first = blocks.find((b) => b.type === 'heading');
  const title = first && first.type === 'heading' ? first.text : (blocks.find((b) => b.type === 'paragraph') as { text: string } | undefined)?.text.slice(0, 60) || fallbackTitle;
  return { title, blocks, rtl: isRtlText(text) };
}

export interface Slide { title: string; bullets: string[]; table?: string[][] }
/** A presentation: every ## section (or # when there are no ##) is a slide; a title slide first. */
export function slidesOf(model: DocModel): Slide[] {
  const level = model.blocks.some((b) => b.type === 'heading' && b.level === 2) ? 2 : 1;
  const slides: Slide[] = [];
  let current: Slide | undefined;
  for (const block of model.blocks) {
    if (block.type === 'heading' && block.level <= level) {
      if (block.level < level) continue; // the document title (the title slide says it)
      current = { title: block.text, bullets: [] };
      slides.push(current);
      continue;
    }
    if (!current) { current = { title: model.title, bullets: [] }; slides.push(current); }
    if (block.type === 'paragraph') current.bullets.push(block.text);
    else if (block.type === 'list') current.bullets.push(...block.items);
    else if (block.type === 'heading') current.bullets.push(block.text);
    else if (block.type === 'table' && !current.table) current.table = block.rows.slice(0, 12).map((r) => r.slice(0, 6));
  }
  // A long slide is split so nothing runs off it.
  return slides.flatMap((s) => {
    if (s.bullets.length <= 7) return [s];
    const parts: Slide[] = [];
    for (let i = 0; i < s.bullets.length; i += 7) parts.push({ title: i ? `${s.title} (${i / 7 + 1})` : s.title, bullets: s.bullets.slice(i, i + 7), ...(i === 0 && s.table ? { table: s.table } : {}) });
    return parts;
  });
}

/** The tables of a document (for Excel); a document without tables becomes one column of its lines. */
export function tablesOf(model: DocModel): Array<{ name: string; rows: string[][] }> {
  const tables: Array<{ name: string; rows: string[][] }> = [];
  let heading = model.title;
  for (const block of model.blocks) {
    if (block.type === 'heading') heading = block.text;
    if (block.type === 'table') tables.push({ name: heading, rows: block.rows });
  }
  if (tables.length) return tables;
  const rows = model.blocks.flatMap((b) => (b.type === 'heading' || b.type === 'paragraph' ? [[b.text]] : b.type === 'list' ? b.items.map((x) => [x]) : b.type === 'code' ? b.text.split('\n').map((x) => [x]) : []));
  return [{ name: model.title, rows }];
}

/** A number in a cell («1,250», «20%», «٣٥») read as a number for the sheet; otherwise undefined. */
export function cellNumber(value: string): number | undefined {
  const latin = value.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/٫/g, '.').replace(/٬/g, ',');
  if (!/^-?[\d,]+(\.\d+)?$/.test(latin)) return undefined;
  const n = Number(latin.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}
