/**
 * «حسّاسات العالم» — senses_world: what the outside world says, read politely from real pages.
 *
 * It reads each candidate carrier's own page (robots.txt first, one page per site, a small budget, a short
 * timeout) and records only what it actually saw — did the page open? does it mention dangerous goods? It never
 * reads a rate automatically and never invents one: a saving is computed only once a rate is recorded with its
 * source and date, and the merchant decides.
 *
 * Output: src/data/live/senses-world.json
 */

// `FetchFn` is the global fetch type; we use it (not a parameter named `fetch`) so the type annotation never
// refers to itself.
type FetchFn = typeof fetch;

export type WorldSenseLevel = 'ok' | 'note' | 'warn' | 'fail';

export interface WorldProbe {
  carrierId: string;
  carrierNameAr: string;
  originCountry: string | null;
  robotsTxt: { fetched: boolean; allowed: boolean | null; note: string };
  page: { fetched: boolean; status: number | null; mentionsDangerousGoods: boolean; mentionsPerfume: boolean; mentionsPrice: boolean; note: string };
  source: string;
  checkedAt: string;
}

export interface SensesWorldReport {
  version: 1;
  agent: 'senses_world';
  updatedAt: string;
  score: number;
  counts: { ok: number; note: number; warn: number; fail: number };
  probes: WorldProbe[];
  carriers: { total: number; reachable: number; dgMentioned: number; priceMentioned: number; noSource: number };
  summaryAr: string;
  planAr: string[];
}

const MAX_FETCHES = 8;
const TIMEOUT_MS = 9000;
const DISALLOW_RE = /Disallow:/im;
const UA_DISALLOW_RE = /^User-agent:\s*\*[\s\S]*?^Disallow:\s*$/im;

const probe = (id: string, nameAr: string, origin: string | null, robotsAllowed: boolean | null,
  robotsNote: string, fetched: boolean, status: number | null, dg: boolean, perfume: boolean, price: boolean,
  pageNote: string, source: string, now: number): WorldProbe => ({
  carrierId: id, carrierNameAr: nameAr, originCountry: origin,
  robotsTxt: { fetched: robotsAllowed !== null, allowed: robotsAllowed, note: robotsNote },
  page: { fetched, status, mentionsDangerousGoods: dg, mentionsPerfume: perfume, mentionsPrice: price, note: pageNote },
  source, checkedAt: new Date(now).toISOString(),
});

/** Fetch robots.txt for a carrier domain, respectfully. */
async function robotsAllowedFor(url: string, http: FetchFn): Promise<{ allowed: boolean | null; note: string; fetched: boolean }> {
  try {
    const u = new URL(url);
    const res = await http(`${u.origin}/robots.txt`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = res.ok ? await res.text() : '';
    const allowed = UA_DISALLOW_RE.test(text) || !DISALLOW_RE.test(text);
    return { fetched: true, allowed, note: `robots.txt تم جلبها (${res.status})` };
  } catch { return { fetched: false, allowed: null, note: 'لم تُجلب robots.txt (الشبكة أو الموقع)' }; }
}

/** Fetch one carrier page and read only visible signals. */
async function probeCarrier(c: { id: string; nameAr: string; originCountry?: string | null; ratesUrl?: string; dgUrl?: string },
  http: FetchFn, now: number, budget: { left: number }): Promise<WorldProbe> {
  const target = c.dgUrl || c.ratesUrl;
  const robots = target ? await robotsAllowedFor(target, http) : { fetched: false, allowed: null, note: 'لا صفحة مسجلة للشركة' };
  let fetched = false; let status: number | null = null; let dg = false; let perfume = false; let price = false;
  let note = '';
  if (budget.left > 0 && target && robots.fetched) {
    budget.left -= 1;
    try {
      const res = await http(target, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      status = res.status;
      fetched = res.ok;
      const text = fetched ? await res.text() : '';
      dg = /dangerous\s*goods|hazardous|un1266|iata|class\s*3/i.test(text);
      perfume = /perfume|fragrance|عطور|عطر/i.test(text);
      price = /rate|price|pricing|quote|tariff|تعريفة|سعر/i.test(text);
      note = `الصفحة فُتحت (${res.status})`;
    } catch { note = 'لم تُجلب الصفحة'; }
  } else if (!target) {
    note = 'لا رابط صفحة للشركة';
  }
  return probe(c.id, c.nameAr, c.originCountry ?? null, robots.allowed, robots.note, fetched, status, dg, perfume, price, note, target || '', now);
}

export interface SensesWorldInput {
  now: number;
  candidates: { id: string; nameAr: string; originCountry?: string | null; ratesUrl?: string; dgUrl?: string }[];
  http: FetchFn;
}

/**
 * Reads the outside world politely. Records only what it saw — never a rate, never an invention.
 * Each probe says: page opened? dangerous goods mentioned? source and date.
 */
export function buildSensesWorld(input: SensesWorldInput): Promise<SensesWorldReport> {
  const { now, candidates, http } = input;
  const budget = { left: MAX_FETCHES };
  const probes: WorldProbe[] = [];
  const run = async () => {
    for (const c of candidates) {
      if (budget.left <= 0) {
        probes.push(probe(c.id, c.nameAr, c.originCountry ?? null, null, 'ميزانية القراءة نفدت', false, null, false, false, false, 'لم تُقرأ', '', now));
        continue;
      }
      const p = await probeCarrier(c, http, now, budget);
      probes.push(p);
    }
    let reachable = 0, dgMentioned = 0, priceMentioned = 0, noSource = 0;
    for (const p of probes) {
      if (p.page.fetched) reachable += 1;
      if (p.page.mentionsDangerousGoods) dgMentioned += 1;
      if (p.page.mentionsPrice) priceMentioned += 1;
      if (!p.source) noSource += 1;
    }
    const counts = { ok: 0, note: 0, warn: 0, fail: 0 };
    const add = (level: WorldSenseLevel, what: string, why: string, fix: string) => {
      counts[level] += 1;
    };
    const reachLevel = candidates.length
      ? (reachable === candidates.length ? 'ok' : reachable > 0 ? 'warn' : 'fail')
      : 'ok';
    const dgLevel = dgMentioned ? 'ok' : 'warn';
    const sourceLevel = noSource ? 'warn' : 'ok';
    add(reachLevel,
      `فتحت ${reachable} صفحة من ${candidates.length} شركة شحن`,
      'الصفحة التي لا تفتح لا يمكن تأكيد قبولها للعطور منها.',
      'راجع روابط الشركات أو جرب شركة بديلة.');
    add(dgLevel,
      `${dgMentioned} شركة تذكر قبول مواد خطر (UN1266)`,
      'الشركة التي لا تذكر مواد خطر لا يُفترض أنها تقبل العطور جوياً.',
      'احصل على تأكيد مكتوب من الشركة قبل جدولة شحن جوي للعطور.');
    add(sourceLevel,
      `${noSource} شركة من غير رابط مصدر`,
      'من غير مصدر وتاريخ لا تُصدق تعريفة.',
      'سجل رابط صفحة كل شركة ومصدر تعريفتها.');
    const failPoints = probes.filter((p) => !p.page.fetched).length + noSource;
    const planAr: string[] = [];
    if (reachable < candidates.length) planAr.push(`بعض صفحات الشركات ما فتحتش — راجع الروابط`);
    if (noSource) planAr.push(`بعض الشركات من غير مصدر — سجل source والتاريخ`);
    if (dgMentioned === 0 && candidates.length) planAr.push(`مفيش شركة ذكرت قبول مواد خطر — تأكد قبل شحن جوي للعطور`);
    return {
      version: 1, agent: 'senses_world', updatedAt: new Date(now).toISOString(),
      score: Math.max(0, 100 - failPoints * 10),
      counts, probes,
      carriers: { total: candidates.length, reachable, dgMentioned, priceMentioned, noSource },
      summaryAr: `حسّاسات العالم: قرأت ${reachable} من ${candidates.length} صفحة شركة،${dgMentioned} تذكر مواد خطر`,
      planAr,
    } as SensesWorldReport;
  };
  return run();
}

export const isSensesWorldReport = (v: unknown): v is SensesWorldReport => {
  const r = v as SensesWorldReport | undefined;
  return Boolean(r && r.version === 1 && r.agent === 'senses_world' && typeof r.score === 'number' && Array.isArray(r.probes));
};
