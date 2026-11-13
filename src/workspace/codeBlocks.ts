/**
 * «مساحة شاهين»: the code blocks in a reply — which can run here (a web page, JavaScript, Python), how a page is
 * previewed, and the image a reply asks for (```sham-image). Pure (no DOM).
 */
export type Runnable = 'html' | 'javascript' | 'python';
export interface CodeBlock { lang: string; code: string; runnable?: Runnable }

const LANG_ALIASES: Record<string, Runnable> = {
  html: 'html', htm: 'html', xhtml: 'html', svg: 'html', css: 'html',
  js: 'javascript', javascript: 'javascript', mjs: 'javascript', jsx: 'javascript',
  py: 'python', python: 'python', python3: 'python',
};
export const runnableOf = (lang: string): Runnable | undefined => LANG_ALIASES[lang.trim().toLowerCase()];

/** Every fenced block in a reply, in order (the site's own blocks — sham-formula, sham-tool… — are left out). */
export function codeBlocks(text: string): CodeBlock[] {
  const out: CodeBlock[] = [];
  const re = /^[ \t]*(```|~~~)[ \t]*([\w+#.-]*)[^\n]*\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const lang = (m[2] || '').toLowerCase();
    if (lang.startsWith('sham-')) continue;
    const code = m[3]!.replace(/\n$/, '');
    if (!code.trim()) continue;
    const runnable = runnableOf(lang) || (!lang && /^\s*<(!doctype|html|body|div|svg)/i.test(code) ? 'html' : undefined);
    out.push({ lang: lang || (runnable || 'text'), code, ...(runnable ? { runnable } : {}) });
  }
  return out;
}

/** A page to preview: a whole document as it is; a fragment, CSS or SVG wrapped in a page. */
export function previewDocument(block: Pick<CodeBlock, 'lang' | 'code'>, rtl = false): string {
  const lang = block.lang.toLowerCase();
  if (/<html[\s>]|<!doctype/i.test(block.code)) return block.code;
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,'Segoe UI',Tahoma,sans-serif;margin:16px}</style>`;
  if (lang === 'css') return `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}"><head>${head}<style>${block.code}</style></head><body><h1>Heading</h1><p>Paragraph <a href="#">link</a></p><button>Button</button></body></html>`;
  return `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}"><head>${head}</head><body>${block.code}</body></html>`;
}

/** The file name a block is saved under. */
export function fileNameFor(block: Pick<CodeBlock, 'lang'>, index = 1): string {
  const ext: Record<string, string> = { html: 'html', htm: 'html', css: 'css', javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx', python: 'py', py: 'py',
    json: 'json', sql: 'sql', bash: 'sh', sh: 'sh', shell: 'sh', java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', cs: 'cs', go: 'go', rust: 'rs', php: 'php',
    ruby: 'rb', kotlin: 'kt', swift: 'swift', yaml: 'yml', yml: 'yml', xml: 'xml', svg: 'svg', markdown: 'md', md: 'md', csv: 'csv', text: 'txt' };
  return `${block.lang === 'html' ? 'index' : `code-${index}`}.${ext[block.lang.toLowerCase()] || 'txt'}`;
}

/** «```sham-image» — the English description of the image the reply asks the site to draw. */
export function imageRequest(text: string): string | undefined {
  const m = text.match(/```[ \t]*(?:sham-image|sham-video)[^\n]*\n([\s\S]*?)```/i);
  const prompt = m?.[1]?.replace(/\s+/g, ' ').trim();
  return prompt ? prompt.slice(0, 900) : undefined;
}
export const stripImageRequest = (text: string) => text.replace(/\n?```[ \t]*(?:sham-image|sham-video)[^\n]*\n[\s\S]*?```\n?/gi, '\n').trim();

export type Segment = { kind: 'text'; text: string } | { kind: 'code'; block: CodeBlock };
/** A reply cut into its prose and its code blocks, in order (an unclosed last fence still shows as code). */
export function segments(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /^[ \t]*(```|~~~)[ \t]*([\w+#.-]*)[^\n]*\n([\s\S]*?)(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gm;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[0] === '') { re.lastIndex += 1; continue; }
    const lang = (m[2] || '').toLowerCase();
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    last = m.index + m[0].length;
    const code = (m[3] || '').replace(/\n$/, '');
    if (lang.startsWith('sham-') || !code.trim()) continue;
    const runnable = runnableOf(lang) || (!lang && /^\s*<(!doctype|html|body|div|svg)/i.test(code) ? 'html' : undefined);
    out.push({ kind: 'code', block: { lang: lang || (runnable || 'text'), code, ...(runnable ? { runnable } : {}) } });
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out.filter((s) => s.kind === 'code' || s.text.trim());
}
