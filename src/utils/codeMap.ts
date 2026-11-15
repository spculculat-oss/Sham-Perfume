/**
 * «خريطة الكود» — the site's code as Shaheen searches it in the owner's room: every source file with its exported
 * names, the first line of its description and the «named features» it mentions. Built at every site build
 * (vite.config.ts → code-map.json next to the site) from the repository itself, so it is always the live code.
 *
 * In the room Shaheen writes [[ابحث: …]] (Arabic or English, a feature, a word on screen, a function name) and gets
 * the files that match, before he reads any of them — the way a professional coding agent explores a codebase
 * instead of guessing file names. No network here, no AI call.
 */
import { foldText } from './thinkingCraft';

export const CODE_MAP_FILE = 'code-map.json';
/** Folders that are mapped, and what is left out (robots' data, translation packs, build output). */
export const CODE_MAP_ROOTS = ['src', 'server', 'scripts', 'tests', 'api'] as const;
export const CODE_MAP_SOURCE = /\.(tsx?|mts|cts|jsx?|mjs|cjs|css)$/;
export const CODE_MAP_SKIP = /^src\/data\/|^src\/لغات\/ai\/|(^|\/)(node_modules|dist|pages-dist|build|coverage)\//;

export interface CodeMapFile {
  /** Path from the repository root. */
  p: string;
  /** Lines in the file. */
  l: number;
  /** First line of the file's description comment. */
  d?: string;
  /** Exported / top-level names. */
  s: string[];
  /** «Named features» the file mentions (Arabic names of tools and sections). */
  n?: string[];
  /** The Arabic words the file uses most (what the visitor reads on screen), folded. */
  w?: string[];
}
export interface CodeMap { v: 1; files: CodeMapFile[] }

const DECL = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function\*?|class|interface|type|enum|const|let)\s+([A-Za-z_$][\w$]*)/;

/** One file's entry: lines, description, names. Big generated files keep their path and size only. */
export function codeMapEntry(path: string, text: string): CodeMapFile {
  const lines = text.split('\n');
  const entry: CodeMapFile = { p: path, l: lines.length, s: [] };
  if (text.length > 400_000) return entry;
  // The file's description: the first doc comment (often after the imports), else a top comment.
  const doc = text.slice(0, 20_000).match(/\/\*\*([\s\S]*?)\*\//) || text.match(/^\s*\/\*([\s\S]*?)\*\//);
  if (doc) {
    const first = doc[1]!.split('\n').map((l) => l.replace(/^\s*\*\s?/, '').trim()).find((l) => l && !l.startsWith('@'));
    if (first) entry.d = first.slice(0, 180);
  }
  const names = new Set<string>();
  for (const line of lines) {
    if (/^\s/.test(line)) continue;
    const m = line.match(DECL);
    if (m && (line.startsWith('export') || /^(?:async\s+)?function|^class/.test(line))) names.add(m[1]!);
    if (names.size >= 40) break;
  }
  entry.s = [...names];
  const features = new Set<string>();
  for (const m of text.matchAll(/«([^«»\n]{2,40})»/g)) { features.add(m[1]!.trim()); if (features.size >= 12) break; }
  if (features.size) entry.n = [...features];
  const counts = new Map<string, number>();
  for (const m of foldText(text).matchAll(/[\u0621-\u064A]{3,}/g)) {
    const w = m[0].replace(/^ال(?=[\u0621-\u064A]{3})/, '');
    if (!STOP.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
  }
  const words = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([w]) => w);
  if (words.length) entry.w = words;
  return entry;
}

/**
 * The site's sections in Arabic and the English the code names them with: «التجميل» finds CosmeticsHub.tsx.
 * Keys are folded Arabic without «ال».
 */
const SYNONYMS: Record<string, string[]> = {
  تجميل: ['cosmetic'], عطر: ['perfume', 'fragrance'], عطور: ['perfume', 'fragrance'], سله: ['cart', 'basket'], دفع: ['checkout', 'payment', 'pay'],
  صوت: ['voice', 'speech', 'audio'], متجر: ['store', 'shop'], منتج: ['product'], منتجات: ['product'], فوتر: ['footer'], هيدر: ['header'],
  زرار: ['button'], زر: ['button'], رئيسيه: ['hero', 'home'], دخول: ['login', 'auth', 'signin'], حساب: ['account', 'profile'], ترجمه: ['translat', 'l10n', 'i18n'],
  لغه: ['lang', 'l10n', 'i18n'], لغات: ['lang', 'l10n', 'i18n'], شات: ['chat'], محادثه: ['chat', 'conversation'], صوره: ['image', 'photo', 'picture'], صور: ['image', 'photo'],
  فيديو: ['video'], مدونه: ['blog'], مجتمع: ['community'], بنك: ['bank'], سعر: ['price', 'pricing'], اسعار: ['price', 'pricing'], شحن: ['shipping'],
  طلب: ['order'], طلبات: ['order'], روبوت: ['bot', 'robot'], روبوتات: ['bot', 'robot'], تصميم: ['design'], شعار: ['logo'], استوديو: ['studio'], حفظ: ['save', 'store'],
  بحث: ['search'], حاسبه: ['calculator', 'calc'], تركيبه: ['formula', 'formulat'], تركيبات: ['formula'], خامات: ['ingredient', 'material'], مكتبه: ['library'],
  اخبار: ['news'], اداره: ['admin'], صاحب: ['owner'], مالك: ['owner'], غرفه: ['room'], اعدادات: ['settings', 'config'], اشعارات: ['notif'], بريد: ['mail', 'email'],
  ايميل: ['mail', 'email'], مساحه: ['workspace'], ذاكره: ['memory'], مجلس: ['council'], دوريه: ['patrol'], دوله: ['state', 'governance'], قانوني: ['legal'],
  خصوصيه: ['privacy'], تقييم: ['review', 'rating'], تقييمات: ['review', 'rating'], خصم: ['discount', 'coupon'], كوبون: ['coupon'], مخزون: ['inventory', 'stock'],
  مورد: ['supplier'], موردين: ['supplier'], عمله: ['currency', 'fx'], عملات: ['currency', 'fx'], خريطه: ['map'], زوار: ['visitor'], زائر: ['visitor'],
};
const STOP = new Set(['في', 'من', 'على', 'عن', 'الى', 'الي', 'او', 'و', 'ال', 'اللي', 'ده', 'دي', 'دا', 'بتاع', 'بتاعت', 'فين', 'ايه', 'the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'and', 'or', 'is', 'file', 'ملف']);
/** Words of a query: Arabic folded, camelCase and snake_case split, little words dropped. */
export function queryWords(query: string): string[] {
  const spaced = query.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-./]/g, ' ');
  return [...new Set(foldText(spaced).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP.has(w)).map((w) => w.replace(/^ال(?=\p{L}{3})/u, '')))].slice(0, 8);
}

export interface CodeHit { path: string; matched?: number; score: number; lines: number; symbols: string[]; doc?: string; features?: string[] }

/** The files that best match a query, best first: most words matched, then the strongest matches. */
export function searchCodeMap(map: CodeMap, query: string, max = 8): CodeHit[] {
  const words = queryWords(query);
  if (!words.length) return [];
  const hits: CodeHit[] = [];
  for (const f of map.files) {
    const path = foldText(f.p.replace(/([a-z])([A-Z])/g, '$1 $2'));
    const doc = f.d ? foldText(f.d) : '';
    const features = (f.n || []).map(foldText);
    let score = 0;
    let matched = 0;
    const symbols = new Set<string>();
    for (const word of words) {
      let best = 0;
      for (const w of [word, ...(SYNONYMS[word] || [])]) {
        if (path.includes(w)) best = Math.max(best, 3);
        for (const s of f.s) {
          const name = foldText(s.replace(/([a-z])([A-Z])/g, '$1 $2'));
          if (name.replace(/\s/g, '') === w) { best = Math.max(best, 6); symbols.add(s); } else if (name.includes(w)) { best = Math.max(best, 3); symbols.add(s); }
        }
        if (features.some((x) => x.includes(w))) best = Math.max(best, 4);
        if (doc.includes(w)) best = Math.max(best, 2);
        if (f.w?.includes(w)) best = Math.max(best, 2);
      }
      if (best) { matched++; score += best; }
    }
    if (!matched || matched * 3 < words.length) continue;
    // The owner's words name one feature of this file («قسم التجميل» ⊂ «قسم مستحضرات التجميل»): that file owns it.
    if (words.length > 1 && features.some((x) => words.every((w) => x.includes(w)))) score += 3;
    if (words.length > 1 && doc && words.every((w) => doc.includes(w))) score += 1;
    // Tests and scripts rank below the site's own code for the same words.
    if (/^tests\//.test(f.p)) score -= 1;
    hits.push({ path: f.p, matched, score, lines: f.l, symbols: [...symbols].slice(0, 6), ...(f.d ? { doc: f.d } : {}), ...(f.n?.length ? { features: f.n.slice(0, 4) } : {}) });
  }
  return hits.sort((a, b) => (b.matched || 0) - (a.matched || 0) || b.score - a.score || a.lines - b.lines).slice(0, max).map(({ matched: _m, ...h }) => h);
}

/** Without the map (an older deployment, the map not reachable): the file paths alone. */
export function searchPaths(paths: string[], query: string, max = 8): CodeHit[] {
  return searchCodeMap({ v: 1, files: paths.filter((p) => CODE_MAP_SOURCE.test(p) && !CODE_MAP_SKIP.test(p)).map((p) => ({ p, l: 0, s: [] })) }, query, max);
}

/** The results as Shaheen reads them in the room. */
export function formatHits(query: string, hits: CodeHit[]): string {
  if (!hits.length) return `🔎 «${query}»: مفيش ملفات مطابقة — جرّب كلمة تانية (اسم دالة، كلمة إنجليزي، أو اسم القسم).`;
  return [`🔎 «${query}»:`, ...hits.map((h) => `- ${h.path}${h.lines ? ` (${h.lines} سطر)` : ''}${h.doc ? ` — ${h.doc}` : ''}${h.symbols.length ? ` · ${h.symbols.join(', ')}` : ''}${h.features?.length ? ` · «${h.features.join('»، «')}»` : ''}`)].join('\n');
}

/** Checks a downloaded map before it is trusted. */
export function readCodeMap(x: unknown): CodeMap | undefined {
  const m = x as CodeMap;
  if (!m || m.v !== 1 || !Array.isArray(m.files)) return undefined;
  const files = m.files.filter((f) => f && typeof f.p === 'string' && Array.isArray(f.s)).slice(0, 5000);
  return { v: 1, files };
}
