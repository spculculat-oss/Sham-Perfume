/**
 * The patrol's hands-on tests on the live sites: the main site (GitHub Pages) and the engine (server).
 * Each test opens real pages the way a visitor would; the expert reviewer uses bigger samples (deep).
 * `request` is injectable so the tests never touch the network.
 */
import type { ProbeId, ProbeResult } from './patrol';

export interface LiveTargets {
  pages: string;
  engine: string;
  /** Visible products: slug, price (EGP) and photos — the samples rotate every hour. */
  products: { sku: string; slug: string; price: number; images: string[] }[];
  hour: number;
  deep?: Partial<Record<ProbeId, boolean>>;
  request?: typeof fetch;
}

const UA = 'Mozilla/5.0 (Linux; Android 14) ShamPatrol/1.0';
async function get(t: LiveTargets, url: string, init: RequestInit = {}): Promise<{ status: number; type: string; text: string }> {
  const r = await (t.request || fetch)(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  const type = r.headers.get('content-type') || '';
  const text = init.method === 'HEAD' || /^image\//.test(type) ? '' : await r.text().catch(() => '');
  return { status: r.status, type, text };
}
const safe = async (id: ProbeId, fn: () => Promise<ProbeResult>): Promise<ProbeResult> => {
  try { return await fn(); } catch (e) { return { id, level: 'fail', checked: 1, failed: 1, noteAr: `الاختبار ماوصلش: ${String((e as Error)?.name || e).slice(0, 60)}` }; }
};
/** A rotating sample: a different slice of the catalogue every hour. */
export function sample<T>(list: T[], size: number, hour: number): T[] {
  if (list.length <= size) return list;
  const start = (hour * size) % list.length;
  return [...list.slice(start), ...list.slice(0, start)].slice(0, size);
}
/** Absolute URL: full links as they are, «/x» from the origin, «x» / «./x» from the site's folder. */
export const abs = (base: string, path: string) => (/^https?:/.test(path) ? path : new URL(path.startsWith('/') ? path : path.replace(/^\.\//, ''), base).toString());

export async function probeSite(t: LiveTargets): Promise<ProbeResult> {
  return safe('site', async () => {
    const home = await get(t, t.pages);
    if (home.status !== 200 || !/id="root"/.test(home.text)) return { id: 'site', level: 'fail', checked: 1, failed: 1, noteAr: `الصفحة الرئيسية رجعت ${home.status}` };
    const asset = home.text.match(/src="([^"]+\/assets\/[^"]+\.js)"/)?.[1];
    if (!asset) return { id: 'site', level: 'warn', checked: 1, failed: 1, noteAr: 'الصفحة فتحت بس من غير ملف التشغيل' };
    const js = await get(t, abs(t.pages, asset), { method: 'HEAD' });
    return js.status === 200 ? { id: 'site', level: 'ok', checked: 2, failed: 0, noteAr: 'الصفحة الرئيسية وملف التشغيل بيفتحوا' } : { id: 'site', level: 'fail', checked: 2, failed: 1, noteAr: `ملف تشغيل الموقع رجع ${js.status}` };
  });
}

/** Product pages: open, show the same price as the catalogue, and the visitor-currency table exists. */
export async function probeProductPages(t: LiveTargets): Promise<ProbeResult> {
  return safe('product_pages', async () => {
    const deep = Boolean(t.deep?.product_pages);
    const bad: string[] = [];
    const money = await get(t, abs(t.pages, 'p/money.json'));
    let moneyOk = false;
    try { moneyOk = money.status === 200 && typeof (JSON.parse(money.text) as { rates?: unknown }).rates === 'object'; } catch { moneyOk = false; }
    if (!moneyOk) bad.push(`p/money.json: ${money.status}`);
    const picks = sample(t.products, deep ? 10 : 4, t.hour);
    let priceDrift = 0;
    for (const p of picks) {
      const page = await get(t, abs(t.pages, `p/${p.slug}.html`));
      if (page.status !== 200) { bad.push(`${p.slug}: ${page.status}`); continue; }
      const shown = Number(page.text.match(/class="price" data-price="([\d.]+)"/)?.[1]);
      if (!Number.isFinite(shown)) bad.push(`${p.slug}: من غير سعر`);
      else if (Math.abs(shown - p.price) > 0.01) priceDrift++;
    }
    const level = bad.length ? 'fail' : priceDrift ? 'warn' : 'ok';
    return {
      id: 'product_pages', level, checked: picks.length + 1, failed: bad.length + priceDrift, deep,
      noteAr: bad.length ? `${bad.length} صفحة/ملف فيه مشكلة` : priceDrift ? `${priceDrift} صفحة سعرها لسه القديم (النشر متأخر عن الكتالوج)` : `${picks.length} صفحة منتج فتحت بنفس سعر الكتالوج + جدول العملات موجود`,
      ...(bad.length ? { samples: bad.slice(0, 5) } : {}),
    };
  });
}

/** Product photos open as images (a small range request — cheaper than downloading the photo). */
export async function probeImages(t: LiveTargets): Promise<ProbeResult> {
  return safe('images', async () => {
    const deep = Boolean(t.deep?.images);
    const urls = sample(t.products.filter((p) => p.images[0]).map((p) => ({ sku: p.sku, url: abs(t.pages, p.images[0]) })), deep ? 25 : 10, t.hour);
    const bad: string[] = [];
    await Promise.all(urls.map(async ({ sku, url }) => {
      try {
        const r = await get(t, url, { headers: { Range: 'bytes=0-1023' } });
        if (!(r.status === 200 || r.status === 206) || !/^image\//.test(r.type)) bad.push(`${sku}: ${r.status}`);
      } catch { bad.push(`${sku}: ماوصلش`); }
    }));
    const level = !bad.length ? 'ok' : bad.length > urls.length * 0.2 ? 'fail' : 'warn';
    return { id: 'images', level, checked: urls.length, failed: bad.length, deep, noteAr: bad.length ? `${bad.length} من ${urls.length} صورة مش بتفتح` : `${urls.length} صورة فتحت`, ...(bad.length ? { samples: bad.slice(0, 5) } : {}) };
  });
}

export async function probeSitemap(t: LiveTargets): Promise<ProbeResult> {
  return safe('sitemap', async () => {
    const r = await get(t, abs(t.pages, 'sitemap.xml'));
    if (r.status !== 200) return { id: 'sitemap', level: 'fail', checked: 1, failed: 1, noteAr: `خريطة الموقع رجعت ${r.status}` };
    const pages = (r.text.match(/<loc>[^<]*\/p\/[^<]+<\/loc>/g) || []).length;
    const want = t.products.length;
    const level = pages >= want * 0.9 ? 'ok' : pages >= want * 0.5 ? 'warn' : 'fail';
    return { id: 'sitemap', level, checked: want, failed: Math.max(0, want - pages), noteAr: `${pages} صفحة منتج في خريطة الموقع من ${want}` };
  });
}

export async function probeEngine(t: LiveTargets): Promise<ProbeResult> {
  return safe('engine', async () => {
    const r = await get(t, abs(t.engine, 'api/health'));
    let ok = false;
    try { ok = r.status === 200 && (JSON.parse(r.text) as { status?: string }).status === 'ok'; } catch { ok = false; }
    return ok ? { id: 'engine', level: 'ok', checked: 1, failed: 0, noteAr: 'الخادم بيرد' } : { id: 'engine', level: 'fail', checked: 1, failed: 1, noteAr: `الخادم رجع ${r.status}` };
  });
}

export async function probeNewsApi(t: LiveTargets): Promise<ProbeResult> {
  return safe('news_api', async () => {
    const r = await get(t, abs(t.engine, 'api/news'));
    let items = 0;
    try { const d = JSON.parse(r.text) as { items?: unknown[]; articles?: unknown[] }; items = (d.items || d.articles || []).length; } catch { items = 0; }
    if (r.status === 200 && items) return { id: 'news_api', level: 'ok', checked: items, failed: 0, noteAr: `النشرة على الموقع فيها ${items} خبر` };
    return { id: 'news_api', level: r.status === 200 ? 'warn' : 'fail', checked: 1, failed: 1, noteAr: r.status === 200 ? 'النشرة على الموقع فاضية' : `النشرة رجعت ${r.status}` };
  });
}

/** Payment methods for Egypt — only whether any is active (never accounts or amounts). */
export async function probePayments(t: LiveTargets): Promise<ProbeResult> {
  return safe('payments', async () => {
    const r = await get(t, abs(t.engine, 'api/store/payments?country=EG'));
    if (r.status !== 200) return { id: 'payments', level: 'fail', checked: 1, failed: 1, noteAr: `صفحة طرق الدفع رجعت ${r.status}` };
    let methods = 0;
    try { const d = JSON.parse(r.text) as { methods?: unknown[]; direct?: unknown[] }; methods = (d.methods || []).length + (d.direct || []).length; } catch { return { id: 'payments', level: 'fail', checked: 1, failed: 1, noteAr: 'رد طرق الدفع مش مفهوم' }; }
    return methods
      ? { id: 'payments', level: 'ok', checked: 1, failed: 0, noteAr: `${methods} طريقة دفع فعالة` }
      : { id: 'payments', level: 'warn', checked: 1, failed: 1, owner: true, noteAr: 'مفيش طريقة دفع إلكتروني فعالة — الطلبات بتوصل بالإيميل لحد ما يتفعل البنك الداخلي' };
  });
}

const LIVE: Partial<Record<ProbeId, (t: LiveTargets) => Promise<ProbeResult>>> = {
  site: probeSite, product_pages: probeProductPages, images: probeImages, sitemap: probeSitemap, engine: probeEngine, news_api: probeNewsApi, payments: probePayments,
};
/** The live tests of one shift (all of them when `only` is absent). */
export async function liveProbes(t: LiveTargets, only?: ProbeId[]): Promise<ProbeResult[]> {
  const ids = (Object.keys(LIVE) as ProbeId[]).filter((id) => !only || only.includes(id));
  return Promise.all(ids.map((id) => LIVE[id]!(t)));
}
