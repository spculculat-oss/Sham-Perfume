/**
 * «مهارات شاهين» — Shaheen learns to read a store by himself.
 * When an AI reading of a product page passed the checks (its price and photos are really on the page),
 * Shaheen looks at *where* on the page each value sat — which meta tag, which element (itemprop / id / class)
 * — and keeps that as a recipe for the site (src/data/live/shaheen-skills.json). The next pages of the same
 * store are read with the recipe, without any AI call; every use is checked the same way, and a recipe that
 * keeps failing is retired (the next AI reading teaches a new one). Pure: no network, no clock unless passed.
 */
import { metaTags, squash, validateShaheenReading, type ExtractedProduct } from './extract';
import { parsePrice } from './generic';

export type Recipe =
  | { k: 'meta'; key: string }
  | { k: 'el'; tag: string; attr: 'itemprop' | 'id' | 'class'; val: string }
  | { k: 'img'; attr: 'itemprop' | 'id' | 'class' | 'alt'; val: string };

export interface SiteSkill {
  host: string;
  learnedAt: string;
  /** Learned from this page (shown to the merchant). */
  example: string;
  fields: { name: Recipe; price: Recipe; image: Recipe; description?: Recipe; brand?: Recipe };
  uses: number;
  successes: number;
  failures: number;
  /** trial → trusted after 3 good readings; retired after failing more than succeeding (≥ 3 failures). */
  status: 'trial' | 'trusted' | 'retired';
  lastUsed?: string;
}
export interface SkillsFile { version: 1; updatedAt: string; sites: Record<string, SiteSkill> }

export const emptySkills = (): SkillsFile => ({ version: 1, updatedAt: new Date(0).toISOString(), sites: {} });
export const isSkillsFile = (d: unknown): d is SkillsFile => Boolean(d && typeof d === 'object' && (d as SkillsFile).version === 1 && typeof (d as SkillsFile).sites === 'object');
export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stripTags = (html: string) => squash(html.replace(/<[^>]+>/g, ' '));
const attrOf = (tag: string, name: string) => (tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')) || [])[1];
const TEXT_TAGS = 'h1|h2|h3|h4|span|p|strong|b|bdi|ins|div|td|dd|li|a';

/** The value a recipe points at on this page (first match), or undefined. */
export function applyRecipe(html: string, base: string, r: Recipe): string | undefined {
  if (r.k === 'meta') return metaTags(html)[r.key];
  if (r.k === 'img') {
    const re = new RegExp(`<img\\b[^>]*\\b${r.attr}\\s*=\\s*["'](?:[^"']*\\s)?${esc(r.val)}(?:\\s[^"']*)?["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const src = tag && (attrOf(tag, 'data-zoom-image') || attrOf(tag, 'data-large_image') || attrOf(tag, 'data-src') || attrOf(tag, 'src'));
    if (!src) return undefined;
    try { return new URL(src, base).href; } catch { return undefined; }
  }
  const open = new RegExp(`<(${r.tag})\\b[^>]*\\b${r.attr}\\s*=\\s*["'](?:[^"']*\\s)?${esc(r.val)}(?:\\s[^"']*)?["'][^>]*>`, 'i');
  const m = html.match(open);
  if (!m) return undefined;
  const tag = m[0];
  const content = attrOf(tag, 'content');
  if (content !== undefined) return squash(content);
  const rest = html.slice((m.index ?? 0) + tag.length);
  // Inner text up to the matching close tag (nested tags of the same name are counted).
  const re = new RegExp(`<(/?)${m[1]}\\b[^>]*>`, 'gi');
  let depth = 1; let end = -1; let x: RegExpExecArray | null;
  while ((x = re.exec(rest)) && x.index < 4000) { depth += x[1] ? -1 : 1; if (depth === 0) { end = x.index; break; } }
  return end > 0 ? stripTags(rest.slice(0, end)) : undefined;
}

/** Candidate recipes for the element(s) whose text (or content attribute) satisfies `test`; most specific first. */
function elementRecipes(html: string, test: (text: string) => boolean): Recipe[] {
  const out: Recipe[] = [];
  const re = new RegExp(`<(${TEXT_TAGS}|meta)\\b[^>]*>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 12) {
    const tag = m[0]; const name = m[1].toLowerCase();
    if (name === 'meta') continue;
    const ids: Recipe[] = [];
    const ip = attrOf(tag, 'itemprop'); const id = attrOf(tag, 'id'); const cls = attrOf(tag, 'class');
    if (ip) ids.push({ k: 'el', tag: name, attr: 'itemprop', val: ip.trim().split(/\s+/)[0] });
    if (id && !/\d{4,}/.test(id)) ids.push({ k: 'el', tag: name, attr: 'id', val: id.trim() });
    // Class tokens that describe the role («product-title», «price») beat layout ones («col-6», «mt-2»).
    const tokens = (cls || '').trim().split(/\s+/).filter((t) => t && !/^(?:col|row|mt|mb|ml|mr|pt|pb|px|py|p|m|d|flex|grid|text|font|w|h|js|is|has)[-_]?/i.test(t) && !/\d{3,}/.test(t));
    tokens.sort((a, b) => Number(/title|name|price|amount|brand|desc|product/i.test(b)) - Number(/title|name|price|amount|brand|desc|product/i.test(a)));
    for (const t of tokens.slice(0, 2)) ids.push({ k: 'el', tag: name, attr: 'class', val: t });
    for (const r of ids) {
      const v = applyRecipe(html, 'https://x/', r);
      if (v !== undefined && test(v)) { out.push(r); break; }
    }
  }
  return out;
}

const samePrice = (text: string, price: number) => {
  if (text.length > 60) return false;
  const n = parsePrice(text);
  return n !== undefined && Math.abs(n - price) < 0.005;
};

/**
 * Learns a site skill from a reading that already passed the checks. Every recipe is verified to give back
 * exactly the reading's value on the same page; without a verified name, price and photo recipe → null.
 */
export function learnSkill(html: string, reading: ExtractedProduct, now = new Date().toISOString()): SiteSkill | null {
  const meta = metaTags(html);
  const metaKey = (test: (v: string) => boolean, prefer: string[]) => {
    const keys = Object.keys(meta).filter((k) => test(meta[k]));
    keys.sort((a, b) => Number(prefer.includes(b)) - Number(prefer.includes(a)));
    return keys[0];
  };
  const name = reading.name;
  const nameKey = metaKey((v) => squash(v) === name, ['og:title', 'twitter:title']);
  const nameRecipe: Recipe | undefined = elementRecipes(html, (t) => t === name)[0] || (nameKey ? { k: 'meta', key: nameKey } : undefined);

  const priceKey = metaKey((v) => samePrice(v, reading.price), ['product:price:amount', 'og:price:amount']);
  const priceRecipe: Recipe | undefined = priceKey ? { k: 'meta', key: priceKey } : elementRecipes(html, (t) => samePrice(t, reading.price))[0];

  const image = reading.images[0];
  let imageRecipe: Recipe | undefined;
  const imgKey = metaKey((v) => { try { return new URL(v, reading.url).href === image; } catch { return false; } }, ['og:image']);
  if (imgKey) imageRecipe = { k: 'meta', key: imgKey };
  else {
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = m[0];
      const src = attrOf(tag, 'data-zoom-image') || attrOf(tag, 'data-large_image') || attrOf(tag, 'data-src') || attrOf(tag, 'src');
      let abs = ''; try { abs = src ? new URL(src, reading.url).href : ''; } catch { abs = ''; }
      if (abs !== image) continue;
      for (const a of ['itemprop', 'id', 'class'] as const) {
        const v = attrOf(tag, a)?.trim().split(/\s+/)[0];
        if (!v) continue;
        const r: Recipe = { k: 'img', attr: a, val: v };
        if (applyRecipe(html, reading.url, r) === image) { imageRecipe = r; break; }
      }
      if (imageRecipe) break;
    }
  }
  if (!nameRecipe || !priceRecipe || !imageRecipe) return null;

  const descKey = reading.description.length > 30 ? metaKey((v) => squash(v).slice(0, 60) === squash(reading.description).slice(0, 60), ['og:description', 'description']) : undefined;
  const brandRecipe = reading.brand ? (elementRecipes(html, (t) => t === reading.brand)[0]) : undefined;
  return {
    host: hostOf(reading.url), learnedAt: now, example: reading.url,
    fields: { name: nameRecipe, price: priceRecipe, image: imageRecipe, ...(descKey ? { description: { k: 'meta', key: descKey } as Recipe } : {}), ...(brandRecipe ? { brand: brandRecipe } : {}) },
    uses: 0, successes: 0, failures: 0, status: 'trial',
  };
}

/** Reads a page with a learned skill; the result is checked exactly like an AI reading (price + photos on the page). */
export function readWithSkill(html: string, url: string, skill: SiteSkill, currency: string): ExtractedProduct | null {
  if (skill.status === 'retired') return null;
  const f = skill.fields;
  const raw = {
    name: applyRecipe(html, url, f.name),
    price: parsePrice(applyRecipe(html, url, f.price)),
    images: [applyRecipe(html, url, f.image)].filter(Boolean),
    description: f.description ? applyRecipe(html, url, f.description) : '',
    brand: f.brand ? applyRecipe(html, url, f.brand) : undefined,
  };
  if (!raw.name || !raw.price) return null;
  const metaPrice = f.price.k === 'meta';
  // A price from a meta tag is not in the visible text: check it against the tag itself instead.
  const checked = validateShaheenReading(raw, metaPrice ? `${html}<p>${raw.price}</p>` : html, url, currency);
  return checked ? { ...checked, via: 'skill' } : null;
}

/** Book-keeping for one site: every reading with the skill counts; repeated failures retire it. */
export function recordUse(skill: SiteSkill, ok: boolean, now = new Date().toISOString()) {
  skill.uses += 1; skill.lastUsed = now;
  if (ok) skill.successes += 1; else skill.failures += 1;
  if (skill.failures >= 3 && skill.failures > skill.successes) skill.status = 'retired';
  else if (skill.successes >= 3 && skill.status === 'trial') skill.status = 'trusted';
}

/** Keeps a newly learned skill unless the site already has a trusted one that still works. */
export function adoptSkill(file: SkillsFile, skill: SiteSkill): boolean {
  const old = file.sites[skill.host];
  if (old && old.status === 'trusted' && old.failures <= old.successes / 4) return false;
  file.sites[skill.host] = skill;
  file.updatedAt = skill.learnedAt;
  return true;
}

export function skillsSummary(file: SkillsFile) {
  const all = Object.values(file.sites);
  return {
    sites: all.length,
    trusted: all.filter((s) => s.status === 'trusted').length,
    trial: all.filter((s) => s.status === 'trial').length,
    retired: all.filter((s) => s.status === 'retired').length,
    readings: all.reduce((n, s) => n + s.successes, 0),
  };
}
