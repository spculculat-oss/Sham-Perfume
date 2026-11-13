/**
 * «مساحة شاهين»: a document model (markdownDoc.ts) written as Word, Excel, PowerPoint or a printable page (PDF),
 * right-to-left when the text is Arabic. Everything is made in the visitor's browser; the heavy libraries load only
 * when he asks for that kind of file.
 */
import { zipSync, strToU8 } from 'fflate';
import { cellNumber, slidesOf, tablesOf, type DocModel } from './markdownDoc';

export type OfficeKind = 'docx' | 'xlsx' | 'pptx' | 'pdf' | 'md' | 'html';
export const MIME: Record<OfficeKind, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf', md: 'text/markdown', html: 'text/html',
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Characters XML 1.0 does not allow.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
export const safeFileName = (title: string, ext: string) => `${(title || 'shaheen').replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'shaheen'}.${ext}`;

// ── Excel (written directly: a small, dependable OOXML workbook) ────────────────────────────────────────────
const column = (n: number) => { let s = ''; for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };
const sheetName = (name: string, used: Set<string>) => {
  let base = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Sheet';
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i += 1) candidate = `${base.slice(0, 25)} ${i}`;
  used.add(candidate.toLowerCase());
  return candidate;
};
export function xlsxBytes(sheets: Array<{ name: string; rows: string[][] }>, rtl = false): Uint8Array {
  const used = new Set<string>();
  const named = (sheets.length ? sheets : [{ name: 'Sheet', rows: [] }]).map((s) => ({ ...s, name: sheetName(s.name, used) }));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${named.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>'),
  };
  named.forEach((sheet, index) => {
    const widths = new Map<number, number>();
    const rows = sheet.rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => {
      widths.set(c, Math.max(widths.get(c) || 8, Math.min(60, value.length + 2)));
      const ref = `${column(c)}${r + 1}`;
      const style = r === 0 && sheet.rows.length > 1 ? ' s="1"' : '';
      const n = r > 0 || sheet.rows.length === 1 ? cellNumber(value) : undefined;
      return n !== undefined ? `<c r="${ref}"${style}><v>${n}</v></c>` : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const cols = widths.size ? `<cols>${[...widths].sort((a, b) => a[0] - b[0]).map(([c, w]) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"${rtl ? ' rightToLeft="1"' : ''}/></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`);
  });
  return zipSync(files, { level: 6 });
}

// ── A printable page (the browser saves it as PDF, with Arabic shaped correctly) ────────────────────────────
export function printHtml(model: DocModel): string {
  const body = model.blocks.map((b) => {
    if (b.type === 'heading') return `<h${b.level}>${esc(b.text)}</h${b.level}>`;
    if (b.type === 'paragraph') return `<p>${esc(b.text)}</p>`;
    if (b.type === 'list') return `<${b.ordered ? 'ol' : 'ul'}>${b.items.map((x) => `<li>${esc(x)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`;
    if (b.type === 'table') return `<table>${b.rows.map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('')}</table>`;
    return `<pre dir="ltr">${esc(b.text)}</pre>`;
  }).join('\n');
  const hasTitle = model.blocks[0]?.type === 'heading';
  return `<!doctype html><html dir="${model.rtl ? 'rtl' : 'ltr'}" lang="${model.rtl ? 'ar' : 'en'}"><head><meta charset="utf-8"><title>${esc(model.title)}</title><style>
@page{margin:18mm}body{font-family:'Segoe UI',Tahoma,'Noto Naskh Arabic','Noto Sans Arabic',Arial,sans-serif;color:#1c1917;line-height:1.7;font-size:12pt;max-width:800px;margin:0 auto;padding:16px}
h1{font-size:22pt;border-bottom:2px solid #b45309;padding-bottom:6px}h2{font-size:16pt;color:#78350f;margin-top:22px}h3{font-size:13pt}
table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #d6d3d1;padding:6px 8px;text-align:start}th{background:#fef3c7}
pre{background:#f5f5f4;padding:10px;border-radius:6px;white-space:pre-wrap;font-family:Consolas,monospace;font-size:10pt}
</style></head><body>${hasTitle ? '' : `<h1>${esc(model.title)}</h1>`}${body}</body></html>`;
}

// ── Word and PowerPoint (libraries loaded on demand) ────────────────────────────────────────────────────────
export async function docxBlob(model: DocModel): Promise<Blob> {
  const d = await import('docx');
  const rtl = model.rtl;
  const run = (text: string, extra: Record<string, unknown> = {}) => new d.TextRun({ text, rightToLeft: rtl, font: rtl ? 'Arial' : 'Calibri', ...extra });
  const children: Array<InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>> = [];
  const levels = { 1: d.HeadingLevel.HEADING_1, 2: d.HeadingLevel.HEADING_2, 3: d.HeadingLevel.HEADING_3 } as const;
  const align = rtl ? d.AlignmentType.RIGHT : d.AlignmentType.LEFT;
  if (model.blocks[0]?.type !== 'heading') children.push(new d.Paragraph({ heading: d.HeadingLevel.TITLE, bidirectional: rtl, alignment: align, children: [run(model.title)] }));
  for (const b of model.blocks) {
    if (b.type === 'heading') children.push(new d.Paragraph({ heading: levels[b.level], bidirectional: rtl, alignment: align, children: [run(b.text)] }));
    else if (b.type === 'paragraph') children.push(new d.Paragraph({ bidirectional: rtl, alignment: align, spacing: { after: 120 }, children: [run(b.text)] }));
    else if (b.type === 'list') b.items.forEach((item, i) => children.push(new d.Paragraph({ bidirectional: rtl, alignment: align, ...(b.ordered ? {} : { bullet: { level: 0 } }), children: [run(b.ordered ? `${i + 1}. ${item}` : item)] })));
    else if (b.type === 'code') b.text.split('\n').forEach((line) => children.push(new d.Paragraph({ children: [new d.TextRun({ text: line || ' ', font: 'Consolas', size: 18 })] })));
    else if (b.type === 'table') {
      const width = Math.max(...b.rows.map((r) => r.length));
      children.push(new d.Table({
        visuallyRightToLeft: rtl, width: { size: 100, type: d.WidthType.PERCENTAGE },
        rows: b.rows.map((r, i) => new d.TableRow({ tableHeader: i === 0, children: Array.from({ length: width }, (_, c) => new d.TableCell({ children: [new d.Paragraph({ bidirectional: rtl, alignment: align, children: [run(r[c] || '', i === 0 ? { bold: true } : {})] })] })) })),
      }));
      children.push(new d.Paragraph({ children: [] }));
    }
  }
  const doc = new d.Document({ creator: 'Shaheen — Sham', title: model.title, sections: [{ properties: {}, children }] });
  return d.Packer.toBlob(doc);
}

export async function pptxBlob(model: DocModel): Promise<Blob> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.rtlMode = model.rtl;
  pptx.title = model.title;
  const align: 'right' | 'left' = model.rtl ? 'right' : 'left';
  const font = model.rtl ? 'Arial' : 'Calibri';
  const cover = pptx.addSlide();
  cover.background = { color: '1C1917' };
  cover.addText(model.title, { x: 0.6, y: 2.4, w: 12.1, h: 1.6, fontSize: 40, bold: true, color: 'FBBF24', align: 'center', fontFace: font, rtlMode: model.rtl });
  cover.addText('Shaheen · Sham', { x: 0.6, y: 4.2, w: 12.1, h: 0.6, fontSize: 16, color: 'D6D3D1', align: 'center', fontFace: font });
  for (const s of slidesOf(model)) {
    const slide = pptx.addSlide();
    slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: 'B45309' } });
    slide.addText(s.title, { x: 0.6, y: 0.35, w: 12.1, h: 0.9, fontSize: 28, bold: true, color: '1C1917', align, fontFace: font, rtlMode: model.rtl });
    const top = 1.4;
    if (s.bullets.length) {
      slide.addText(s.bullets.map((text) => ({ text, options: { bullet: true, rtlMode: model.rtl, align, paraSpaceAfter: 8 } })), {
        x: 0.6, y: top, w: s.table ? 6 : 12.1, h: 5.4, fontSize: s.bullets.length > 5 ? 16 : 20, color: '292524', fontFace: font, valign: 'top', rtlMode: model.rtl, align,
      });
    }
    if (s.table) {
      const rows = s.table.map((r, i) => r.map((text) => ({ text, options: { bold: i === 0, fill: { color: i === 0 ? 'FEF3C7' : 'FFFFFF' }, align, rtlMode: model.rtl } })));
      slide.addTable(rows, { x: s.bullets.length ? 6.9 : 0.6, y: top, w: s.bullets.length ? 5.8 : 12.1, fontSize: 12, fontFace: font, border: { type: 'solid', pt: 0.5, color: 'D6D3D1' } });
    }
  }
  return await pptx.write({ outputType: 'blob' }) as Blob;
}

/** The file of the chosen kind (a PDF is the printable page; the browser's print dialog saves it as PDF). */
export async function writeOffice(kind: OfficeKind, model: DocModel, markdown: string): Promise<{ blob: Blob; name: string }> {
  if (kind === 'docx') return { blob: await docxBlob(model), name: safeFileName(model.title, 'docx') };
  if (kind === 'pptx') return { blob: await pptxBlob(model), name: safeFileName(model.title, 'pptx') };
  if (kind === 'xlsx') { const bytes = xlsxBytes(tablesOf(model), model.rtl); return { blob: new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: MIME.xlsx }), name: safeFileName(model.title, 'xlsx') }; }
  if (kind === 'html' || kind === 'pdf') return { blob: new Blob([printHtml(model)], { type: MIME.html }), name: safeFileName(model.title, 'html') };
  return { blob: new Blob([markdown], { type: MIME.md }), name: safeFileName(model.title, 'md') };
}

/** Opens the print dialog on the printable page («حفظ كـ PDF»). */
export function printAsPdf(model: DocModel) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);
  const win = frame.contentWindow!;
  win.document.open();
  win.document.write(printHtml(model));
  win.document.close();
  setTimeout(() => { try { win.focus(); win.print(); } finally { setTimeout(() => frame.remove(), 60_000); } }, 350);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
