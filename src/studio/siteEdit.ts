/**
 * «استوديو شاهين — التعديل بالكلام»: «خلي اللون أزرق»، «وضع ليلي»، «ضيف قسم أسئلة»، «احذف المعرض»، «غير الاسم لـ نور»،
 * «رقم الواتساب 0100…»، «ضيف صفحة الخدمات» — the common changes done instantly on the device, so editing a site works
 * even with no AI open. Anything else goes to the AI platforms with the whole site (task «site»); pictures already
 * drawn are swapped for short markers before sending and put back after, so the request stays small.
 */
import { FONT_PAIRS, MOODS } from './palette';
import { briefToSpec, cleanSiteSpec, cloneSpec, jsonFrom, newId, type Section, type SectionType, type SiteSpec } from './siteSpec';

export type EditDone = 'color' | 'dark' | 'light' | 'font' | 'radius' | 'add_section' | 'remove_section' | 'add_page' | 'remove_page' | 'name' | 'title' | 'contact' | 'one_page';
export interface LocalEdit { spec: SiteSpec; done: EditDone[] }

const COLORS: Record<string, string> = {
  أزرق: '#1d4ed8', ازرق: '#1d4ed8', blue: '#1d4ed8', سماوي: '#0284c7', لبني: '#0284c7', sky: '#0284c7', كحلي: '#1e3a8a', navy: '#1e3a8a',
  أحمر: '#b91c1c', احمر: '#b91c1c', red: '#b91c1c', نبيتي: '#7f1d1d', عنابي: '#7f1d1d', burgundy: '#7f1d1d', maroon: '#7f1d1d',
  أخضر: '#15803d', اخضر: '#15803d', green: '#15803d', زيتي: '#4d5d23', olive: '#4d5d23', فيروزي: '#0f766e', تركواز: '#0f766e', teal: '#0f766e', mint: '#0f766e',
  أصفر: '#ca8a04', اصفر: '#ca8a04', yellow: '#ca8a04', ذهبي: '#a16207', gold: '#a16207', golden: '#a16207', برتقالي: '#c2410c', orange: '#c2410c',
  بنفسجي: '#7e22ce', موف: '#7e22ce', purple: '#7e22ce', violet: '#7e22ce', بمبي: '#db2777', وردي: '#db2777', روز: '#be185d', pink: '#db2777', rose: '#be185d',
  بني: '#7c4a21', بنى: '#7c4a21', brown: '#7c4a21', بيج: '#a8875b', beige: '#a8875b', رمادي: '#475569', رصاصي: '#475569', gray: '#475569', grey: '#475569',
  أسود: '#1c1917', اسود: '#1c1917', black: '#1c1917', فضي: '#64748b', silver: '#64748b',
};
const SECTION_WORDS: Array<[SectionType, RegExp]> = [
  ['faq', /أسئلة|اسئلة|الأسئلة|الاسئلة|faq|questions/i], ['gallery', /معرض|صور|جاليري|gallery|portfolio/i], ['products', /منتجات|المنتجات|خدمات|الخدمات|منيو|المنيو|products|services|menu/i],
  ['steps', /خطوات|الخطوات|ازاي بنشتغل|إزاي بنشتغل|steps|how it works/i], ['contact', /تواصل|التواصل|اتصال|كونتاكت|contact/i], ['features', /مميزات|المميزات|ليه تختارنا|features|why/i],
  ['about', /من نحن|عننا|about/i], ['cta', /دعوة|زرار|زر|cta|call to action/i], ['hero', /واجهة|الواجهة|البانر|hero|banner/i], ['text', /نص|فقرة|كلام|text|paragraph/i],
];
const sectionOf = (text: string): SectionType | undefined => SECTION_WORDS.find(([, re]) => re.test(text))?.[0];
const after = (text: string, words: RegExp) => text.match(words)?.[1]?.trim().replace(/^[«"“']|[»"”'.!؟?]$/g, '').trim();

/** The changes we understand without AI. `page` is the page open in the builder. */
export function localEdit(input: string, current: SiteSpec, page = 'index'): LocalEdit {
  const text = input.trim();
  const spec = cloneSpec(current);
  const done: EditDone[] = [];
  const pg = spec.pages.find((p) => p.slug === page) || spec.pages[0]!;
  const ar = spec.dir === 'rtl';

  const hex = text.match(/#[0-9a-f]{6}\b/i)?.[0];
  const colorWord = Object.keys(COLORS).find((c) => new RegExp(`(?<![\\p{L}])${c}(?![\\p{L}])`, 'iu').test(text));
  const mood = Object.keys(MOODS).find((m) => new RegExp(`\\b${m}\\b`, 'i').test(text));
  if ((hex || colorWord || mood) && /لون|ألوان|الوان|اللون|color|colour|theme|خلي|خليه|اجعل|غير|make|change/i.test(text)) {
    spec.theme.base = (hex || (colorWord ? COLORS[colorWord] : MOODS[mood!]))!.toLowerCase();
    done.push('color');
  }
  if (/(?:وضع|مود|ثيم)\s*(?:ليلي|ليلى|غامق|داكن)|دارك|dark (?:mode|theme)|\bdark\b|خلفية (?:غامقة|سودا|سوداء)/i.test(text) && !/فاتح|light/i.test(text)) { spec.theme.dark = true; done.push('dark'); }
  else if (/(?:وضع|مود|ثيم)\s*(?:نهاري|فاتح)|light (?:mode|theme)|\blight\b|خلفية (?:فاتحة|بيضا|بيضاء)/i.test(text)) { spec.theme.dark = false; done.push('light'); }
  const font = /خط|فونت|font/i.test(text) && (FONT_PAIRS.find((f) => new RegExp(f.id, 'i').test(text) || new RegExp(f.heading, 'i').test(text))
    || (/كوفي|kufi/i.test(text) ? FONT_PAIRS.find((f) => f.id === 'reem') : /أميري|اميري|كلاسيك|نسخ|amiri|classic/i.test(text) ? FONT_PAIRS.find((f) => f.id === (ar ? 'amiri' : 'serif')) : /حديث|modern/i.test(text) ? FONT_PAIRS.find((f) => f.id === (ar ? 'tajawal' : 'grotesk')) : undefined)
    || (/غير|تاني|change|another/i.test(text) ? (() => { const list = FONT_PAIRS.filter((f) => f.arabic === ar); const i = list.findIndex((f) => f.id === spec.theme.font); return list[(i + 1) % list.length]; })() : undefined));
  if (font) { spec.theme.font = font.id; done.push('font'); }
  if (/حواف|زوايا|corners|rounded|radius/i.test(text)) {
    spec.theme.radius = /حادة|حاده|مربعة|sharp|square/i.test(text) ? 'sharp' : /دائرية|دايرية|مدورة|round/i.test(text) ? 'round' : 'soft';
    done.push('radius');
  }

  const name = after(text, /(?:غير|غيّر|خلي|خلّي|بدل)\s*(?:اسم الموقع|الاسم|اسمه)\s*(?:لـ|ل(?=\s)|إلى|الى|يبقى|يكون|:)?\s*(.{2,40})$/i) || after(text, /(?:rename(?: the site)?|change the name|site name)\s*(?:to|:)?\s*(.{2,40})$/i);
  if (name) { spec.name = name; const hero = spec.pages[0]!.sections.find((s) => s.type === 'hero'); if (hero && hero.title === current.name) hero.title = name; done.push('name'); }
  const title = !name && (after(text, /(?:غير|غيّر|خلي|خلّي)\s*(?:العنوان|عنوان الصفحة|العنوان الرئيسي)\s*(?:لـ|ل(?=\s)|إلى|الى|يبقى|يكون|:)?\s*(.{2,120})$/i) || after(text, /(?:change the (?:headline|title))\s*(?:to|:)?\s*(.{2,120})$/i));
  if (title) { const hero = pg.sections.find((s) => s.type === 'hero') || pg.sections[0]; if (hero) { hero.title = title; done.push('title'); } }

  const contact = () => {
    let c = spec.pages.flatMap((p) => p.sections).find((s) => s.type === 'contact');
    if (!c) { c = { id: 'contact', type: 'contact', title: ar ? 'تواصل معنا' : 'Contact' }; pg.sections.push(c); }
    return c;
  };
  const mail = text.match(/[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}/i)?.[0];
  const num = text.match(/\+?\d[\d\s-]{6,16}\d/)?.[0]?.replace(/\s+/g, ' ');
  if (mail && /ايميل|إيميل|بريد|email|mail/i.test(text)) { contact().email = mail; done.push('contact'); }
  if (num && /واتس|واتساب|whatsapp/i.test(text)) { contact().whatsapp = num; done.push('contact'); }
  else if (num && /رقم|تليفون|موبايل|هاتف|phone|tel/i.test(text)) { contact().phone = num; done.push('contact'); }
  const address = after(text, /(?:العنوان|عنواننا|address)\s*(?:هو|:)\s*(.{4,200})$/i);
  if (address) { contact().address = address; done.push('contact'); }

  const kind = sectionOf(text);
  if (/^(?:ضيف|أضف|اضف|زود|زوّد|حط|add|insert)(?![\p{L}])/iu.test(text) && /صفحة|صفحه|page/i.test(text)) {
    const title = after(text, /(?:صفحة|صفحه|page)\s*(?:اسمها|باسم|عن|named|called|for)?\s*(.{2,40})$/i) || (ar ? 'صفحة جديدة' : 'New page');
    let slug = (title.match(/[a-z0-9]+/gi)?.join('-').toLowerCase() || `page-${spec.pages.length + 1}`).slice(0, 30);
    while (spec.pages.some((p) => p.slug === slug)) slug = `${slug}-2`;
    const sample = briefToSpec(`${title} ${spec.name}`, { language: spec.lang, base: spec.theme.base, onePage: true }).pages[0]!.sections;
    const body = kind ? sample.filter((s) => s.type === kind) : sample.filter((s) => s.type === 'text' || s.type === 'features');
    spec.pages.push({ slug, title, sections: [{ id: newId(), type: 'text', title, text: ar ? 'اكتب هنا محتوى الصفحة.' : 'Write the page content here.' }, ...body.map((s) => ({ ...s, id: newId() }))] });
    done.push('add_page');
  } else if (/^(?:ضيف|أضف|اضف|زود|زوّد|حط|add|insert)(?![\p{L}])/iu.test(text) && kind) {
    const sample = briefToSpec(spec.name, { language: spec.lang, base: spec.theme.base, onePage: true }).pages[0]!.sections.find((s) => s.type === kind);
    const section: Section = sample ? { ...sample, id: newId() } : { id: newId(), type: kind, title: ar ? 'قسم جديد' : 'New section', text: ar ? 'اكتب هنا.' : 'Write here.' };
    const contactAt = pg.sections.findIndex((s) => s.type === 'contact');
    if (contactAt >= 0 && kind !== 'contact') pg.sections.splice(contactAt, 0, section); else pg.sections.push(section);
    done.push('add_section');
  } else if (/^(?:احذف|امسح|شيل|الغي|ألغي|remove|delete)(?![\p{L}])/iu.test(text)) {
    const pageHit = /صفحة|صفحه|page/i.test(text) && spec.pages.find((p) => p.slug !== 'index' && (text.includes(p.title) || new RegExp(`\\b${p.slug}\\b`, 'i').test(text)));
    if (pageHit) { spec.pages = spec.pages.filter((p) => p !== pageHit); done.push('remove_page'); }
    else if (kind) {
      const at = pg.sections.map((s) => s.type).lastIndexOf(kind);
      if (at >= 0 && pg.sections.length > 1) { pg.sections.splice(at, 1); done.push('remove_section'); }
    }
  }
  if (/صفحة واحدة|صفحه واحده|one[- ]page|single page/i.test(text) && /خلي|خليه|اجعل|حول|حوّل|make|turn/i.test(text) && spec.pages.length > 1) {
    const all = spec.pages.flatMap((p) => p.sections);
    const seen = new Set<string>();
    spec.pages = [{ slug: 'index', title: spec.pages[0]!.title, sections: all.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true))).map((s) => ({ ...s, link: s.link?.replace(/^contact\.html$/, '#contact').replace(/^[a-z0-9-]+\.html$/, '#') })) }];
    done.push('one_page');
  }
  return { spec, done: [...new Set(done)] };
}

/** The site as the AI sees it: pictures already drawn become markers («img:3») so the request stays small. */
export function forAi(spec: SiteSpec): { json: string; restore: (back: SiteSpec) => SiteSpec } {
  const pictures: string[] = [];
  const json = JSON.stringify(spec, (key, value) => {
    if (key === 'src' && typeof value === 'string' && value.length > 300) { pictures.push(value); return `img:${pictures.length - 1}`; }
    if (key === 'logo') return undefined;
    return value;
  });
  const restore = (back: SiteSpec) => {
    const out = cloneSpec(back);
    const fix = (ref?: { src?: string }) => { const m = ref?.src?.match(/^img:(\d+)$/); if (ref && m) { if (pictures[+m[1]!]) ref.src = pictures[+m[1]!]; else delete ref.src; } };
    for (const p of out.pages) for (const s of p.sections) { fix(s.image); (s.items || []).forEach((it) => fix(it.image)); }
    if (spec.logo && !out.logo) out.logo = spec.logo;
    return out;
  };
  return { json, restore };
}
/** «img:3» markers pass the cleaner: they are not URLs, so the cleaner would drop them; keep them as prompts-free refs. */
export function siteFromReply(reply: string, lang: string, restore?: (s: SiteSpec) => SiteSpec): SiteSpec | undefined {
  const raw = jsonFrom(reply);
  if (!raw || typeof raw !== 'object') return undefined;
  // Markers survive cleaning by riding in the alt-free «src» slot as data the cleaner allows: swap them before cleaning.
  const marked = JSON.parse(JSON.stringify(raw, (k, v) => (k === 'src' && typeof v === 'string' && /^img:\d+$/.test(v) ? `https://studio.invalid/${v.slice(4)}` : v)));
  const clean = cleanSiteSpec(marked, lang);
  if (!clean) return undefined;
  const back = JSON.parse(JSON.stringify(clean, (k, v) => (k === 'src' && typeof v === 'string' && /^https:\/\/studio\.invalid\/\d+$/.test(v) ? `img:${v.split('/').pop()}` : v))) as SiteSpec;
  return restore ? restore(back) : back;
}
