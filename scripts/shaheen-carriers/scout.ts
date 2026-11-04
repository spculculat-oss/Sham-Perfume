/**
 * «كشّاف الشحن» — carrier scout: keeps the shipping money honest and hunts a better carrier.
 *
 * Two jobs, one report (`src/data/live/carrier-scout.json`):
 *   1. **مراجعة مستمرة**: every destination we sell to must have a **published** cost with a **date**, from a
 *      carrier that **accepts perfume** (UN1266 class 3). A destination with no rate, a rate older than
 *      `staleDays`, or a carrier whose dangerous-goods answer is unknown is an **error** — not a note.
 *   2. **أرخص بديل**: every candidate carrier that has a published rate **with its source and date** is compared
 *      destination by destination against the carrier we use today; the saving is reported per destination.
 *
 * What it never does: it does not change a price, does not promise a visitor anything, and never fills a rate it
 * did not read. A candidate without a dated source is `unverified`; an unknown dangerous-goods answer is `unknown`,
 * not «approved». Prices stay the merchant's decision (his rule, 2026-10-26).
 *
 * Pure: carriers, costs, candidates, shipping and rates are parameters (`tests/carrierScout.test.ts`).
 */
import { HOME_CURRENCY, convert, type FxTable, type ShippingCosts, type ShippingTable } from '../../src/utils/pricing';

export type CandidateState = 'verified' | 'unverified' | 'rejected';

/** A carrier we may switch to. `rates` is only filled when a human (or a verified read) put a real number there. */
export interface CarrierCandidate {
  id: string;
  nameAr: string;
  nameEn?: string;
  originCountry: string;
  scope: 'international' | 'local';
  /** Where the rate card lives — the robot reads this page, it never guesses the number. */
  ratesUrl: string;
  /** Where the carrier says what it will not carry (dangerous goods). */
  dgUrl?: string | null;
  /** `true` = accepts perfume (UN1266), `false` = refuses it, `null` = not verified yet. */
  dg: boolean | null;
  /** The published rate card, when it was read and recorded. */
  rates?: {
    currency: string;
    /** Country code → [first 500 g, each next 500 g]. */
    perCountry: Record<string, [number, number]>;
    surchargePercent?: number;
    source: string;
    checkedAt: string;
  } | null;
  noteAr?: string;
}

/** The carrier we use today for a destination, as recorded in `shipping-lanes.json`. */
export interface CurrentCarrier {
  id: string;
  nameAr: string;
  dg: boolean | null;
  source: string | null;
  checkedAt: string | null;
  originCountry?: string | null;
  scope: 'international' | 'local';
}

export interface CarrierScoutInput {
  now: number;
  /** Real cost per destination (`src/data/shipping-costs.json`), already generated from the trade report. */
  costs: ShippingCosts;
  /** The destinations we sell to (the trade report's list) with the merchant-facing name. */
  destinations: { code: string; nameAr: string }[];
  carriers: CurrentCarrier[];
  candidates: CarrierCandidate[];
  shipping: ShippingTable;
  fx: FxTable;
  /** A rate older than this many days is an error, not a price. */
  staleDays?: number;
  /** How many of the dearest destinations the plan names. */
  worstLimit?: number;
}

export type ScoutErrorKind =
  | 'no_rate' | 'stale_rate' | 'no_source' | 'dg_unknown' | 'dg_refused'
  | 'no_handling' | 'candidate_untested' | 'candidate_no_source';

export interface ScoutError {
  kind: ScoutErrorKind;
  level: 'warn' | 'note';
  /** The destination or the carrier it is about. */
  subject: string;
  whatAr: string;
  fixAr: string;
}

export interface SavingRow {
  code: string;
  nameAr: string;
  /** What the carrier we use today costs for the first bottle, in EGP. `null` = we have no published rate. */
  currentEgp: number | null;
  /** The cheapest verified candidate for this destination, in EGP. */
  candidateEgp: number;
  candidateId: string;
  candidateNameAr: string;
  /** current − candidate (positive = the candidate is cheaper for us). */
  savingEgp: number;
  savingPercent: number;
}

export interface CandidateVerdict {
  id: string;
  nameAr: string;
  originCountry: string;
  state: CandidateState;
  whyAr: string;
  ratesUrl: string;
  checkedAt: string | null;
  /** Destinations where this candidate beats the carrier we use today. */
  beatsCurrent: number;
  /** How much it would save us across those destinations, in EGP (first bottle each). */
  savingEgp: number;
}

export interface CarrierScoutReport {
  version: 1;
  agent: 'carrier-scout';
  updatedAt: string;
  rules: { staleDays: number; handlingPercent: number; netMarginPercent: number };
  coverage: {
    destinations: number;
    /** Destinations whose cost came from a published rate. */
    priced: number;
    /** Destinations with no published rate — they fall back to the zone price and promise nothing. */
    uncovered: { code: string; nameAr: string; zoneFirstItemEgp: number | null }[];
  };
  carriersInUse: { id: string; nameAr: string; destinations: number; dg: boolean | null; checkedAt: string | null }[];
  candidates: CandidateVerdict[];
  savings: { rows: SavingRow[]; destinations: number; totalEgp: number; medianPercent: number | null; bestEgp: number | null };
  /** What the scout saw when it opened each candidate's own page (status + the words it found). No rates are read here. */
  probes?: { id: string; url: string; status: number | null; reached: boolean; signals: string[]; noteAr: string }[];
  errors: ScoutError[];
  score: number;
  summaryAr: string;
  planAr: string[];
  notesAr: string[];
}

const round = (n: number) => Math.round(n * 100) / 100;
const DAY = 86_400_000;

/** The cheapest candidate that may legally carry perfume to this destination, with its price in EGP. */
function cheapestCandidate(code: string, candidates: CarrierCandidate[], fx: FxTable): { candidate: CarrierCandidate; egp: number } | null {
  let best: { candidate: CarrierCandidate; egp: number } | null = null;
  for (const c of candidates) {
    const rates = c.rates;
    if (!rates || c.dg !== true) continue;
    if (c.scope === 'local' && !(c.originCountry === code)) continue;
    const row = rates.perCountry[code];
    if (!row || !(row[0] > 0)) continue;
    const lift = 1 + (Number(rates.surchargePercent) || 0) / 100;
    const egp = convert(row[0] * lift, rates.currency, HOME_CURRENCY, fx);
    if (!best || egp < best.egp) best = { candidate: c, egp: round(egp) };
  }
  return best;
}

/** Does a candidate have everything a price needs: a rate, a source and a date? */
function isPriced(c: CarrierCandidate): boolean {
  const r = c.rates;
  return Boolean(r && r.source && /^\d{4}-\d{2}-\d{2}$/.test(String(r.checkedAt)) && Object.keys(r.perCountry || {}).length);
}

export function scoutCarriers(input: CarrierScoutInput): CarrierScoutReport {
  const staleDays = Number(input.staleDays) || 120;
  const fx = input.fx;
  const now = input.now;
  const handlingPercent = Number(input.shipping.handling?.percent) || 0;
  const netMarginPercent = Number(input.shipping.netMarginPercent) || 50;
  const errors: ScoutError[] = [];
  const notesAr: string[] = [];
  const planAr: string[] = [];

  const inUse = new Map<string, number>();
  const uncovered: CarrierScoutReport['coverage']['uncovered'] = [];
  const byCarrier = new Map<string, CurrentCarrier>(input.carriers.map((c) => [c.id, c]));

  for (const d of input.destinations) {
    const row = input.costs.countries?.[d.code];
    if (!row) {
      const zone = (input.shipping.zones || []).find((z) => z.countries?.includes(d.code)) || input.shipping.default;
      const zoneEgp = zone ? round(convert(zone.firstItem, input.shipping.currency, HOME_CURRENCY, fx)) : null;
      uncovered.push({ code: d.code, nameAr: d.nameAr, zoneFirstItemEgp: zoneEgp });
      errors.push({
        kind: 'no_rate', level: 'warn', subject: d.code,
        whatAr: `${d.nameAr}: مفيش تعريفة شحن منشورة — بتاخد سعر المنطقة (${zoneEgp ?? '—'} ج.م) ومافيش وعد إنه يغطي التكلفة`,
        fixAr: 'أضف الشركة وتعريفتها بمصدرها وتاريخها في src/data/shipping-lanes.json',
      });
      continue;
    }
    if (row.carrier) inUse.set(row.carrier, (inUse.get(row.carrier) || 0) + 1);
  }

  // ── الشركة نفسها: خطأ واحد لكل شركة (مش خطأ لكل وجهة) ──────────────────────────────────────────────
  const dgUnknownCarriers: string[] = [];
  for (const [id, count] of inUse.entries()) {
    const carrier = byCarrier.get(id);
    if (!carrier) continue;
    const where = `${count} وجهة`;
    if (carrier.dg === null) {
      dgUnknownCarriers.push(carrier.nameAr);
      errors.push({
        kind: 'dg_unknown', level: 'warn', subject: carrier.id,
        whatAr: `«${carrier.nameAr}» لسه مش متأكدين إنها بتقبل العطور (UN1266) — وهي اللي بتحمل ${where}`,
        fixAr: 'اقرا صفحة المواد الخطرة عند الشركة أو خد رد مكتوب، وحدّث dg في shipping-lanes.json',
      });
    } else if (carrier.dg === false) {
      errors.push({
        kind: 'dg_refused', level: 'warn', subject: carrier.id,
        whatAr: `«${carrier.nameAr}» بترفض العطور (UN1266) — مينفعش تفضل سعر شحن للعطر في ${where}`,
        fixAr: 'شيلها من ممرات العطور واستبدلها بشركة بتقبل UN1266',
      });
    }
    if (!carrier.source) {
      errors.push({
        kind: 'no_source', level: 'warn', subject: carrier.id,
        whatAr: `«${carrier.nameAr}» تعريفتها مسجلة من غير رابط مصدر (${where})`,
        fixAr: 'سجّل رابط التعريفة المنشورة في shipping-lanes.json',
      });
    }
    const checked = Date.parse(String(carrier.checkedAt || ''));
    if (Number.isFinite(checked) && now - checked > staleDays * DAY) {
      errors.push({
        kind: 'stale_rate', level: 'warn', subject: carrier.id,
        whatAr: `تعريفة «${carrier.nameAr}» قديمة (${Math.floor((now - checked) / DAY)} يوم عن آخر تأكيد) — السعر مش مضمون`,
        fixAr: 'راجع التعريفة وحدّث checkedAt بعد ما تتأكد من الرقم',
      });
    }
  }

  if (!(handlingPercent > 0)) {
    errors.push({
      kind: 'no_handling', level: 'note', subject: 'shipping.json',
      whatAr: 'مفيش هامش تجهيز على الشحن — الشحن بيتحصّل بتكلفته بالظبط، يعني مكسب الشحن صفر',
      fixAr: 'حدّد handling.percent (بحد أقصى للطرد) في src/data/shipping.json — القرار لصاحب المتجر',
    });
  }

  // ── الشروط اللي الشركة لازم تستوفيها قبل ما سعرها يتحسب ──────────────────────────────────────────
  const verdicts: CandidateVerdict[] = [];
  const savingsRows: SavingRow[] = [];
  for (const c of input.candidates) {
    const priced = isPriced(c);
    let state: CandidateState; let whyAr: string;
    if (!priced) {
      state = 'unverified';
      whyAr = !c.rates ? 'مفيش تعريفة مسجلة — الكشّاف قرا الصفحة بس، والرقم محتاج مراجعة بشر'
        : !c.rates.source ? 'في تعريفة من غير رابط مصدر — مش سعر'
          : 'التعريفة من غير تاريخ — ممكن تكون قديمة';
      errors.push({
        kind: 'candidate_untested', level: 'note', subject: c.id,
        whatAr: `بديل لسه من غير سعر موثّق: «${c.nameAr}» (${c.originCountry})`,
        fixAr: `اقرا ${c.ratesUrl} وسجّل التعريفة بمصدرها وتاريخها في src/data/carrier-candidates.json`,
      });
    } else if (c.dg !== true) {
      state = 'unverified';
      whyAr = c.dg === false ? 'بترفض العطور (UN1266) — مش بديل لشحن العطر' : 'مفيش تأكيد إنها بتقبل العطور (UN1266)';
    } else {
      state = 'verified';
      whyAr = 'سعر منشور بتاريخه + بتقبل العطور';
    }
    if (!c.ratesUrl || !/^https:\/\//.test(c.ratesUrl)) {
      errors.push({ kind: 'candidate_no_source', level: 'warn', subject: c.id, whatAr: `«${c.nameAr}» من غير رابط تعريفة`, fixAr: 'ضيف ratesUrl حقيقي' });
      state = 'rejected';
    }

    let beats = 0; let saving = 0;
    if (state === 'verified') {
      for (const d of input.destinations) {
        const best = cheapestCandidate(d.code, [c], fx);
        if (!best) continue;
        const row = input.costs.countries?.[d.code];
        const currentEgp = row ? round(convert(row.firstItem, input.costs.currency, HOME_CURRENCY, fx)) : null;
        if (currentEgp === null) continue;
        savingsRows.push({
          code: d.code, nameAr: d.nameAr, currentEgp, candidateEgp: best.egp,
          candidateId: c.id, candidateNameAr: c.nameAr,
          savingEgp: round(currentEgp - best.egp),
          savingPercent: currentEgp > 0 ? Math.round(((currentEgp - best.egp) / currentEgp) * 1000) / 10 : 0,
        });
        if (currentEgp - best.egp > 0) { beats += 1; saving += currentEgp - best.egp; }
      }
    }
    verdicts.push({
      id: c.id, nameAr: c.nameAr, originCountry: c.originCountry, state, whyAr,
      ratesUrl: c.ratesUrl, checkedAt: c.rates?.checkedAt || null,
      beatsCurrent: beats, savingEgp: round(saving),
    });
  }

  // لكل وجهة: أحسن بديل واحد بس (أرخص بديل موثّق)
  const bestPerDestination = new Map<string, SavingRow>();
  for (const row of savingsRows) {
    const prev = bestPerDestination.get(row.code);
    if (!prev || row.candidateEgp < prev.candidateEgp) bestPerDestination.set(row.code, row);
  }
  const rows = [...bestPerDestination.values()].filter((r) => r.savingEgp > 0).sort((a, b) => b.savingEgp - a.savingEgp);
  const percents = rows.map((r) => r.savingPercent).sort((a, b) => a - b);

  const pricedCount = input.destinations.length - uncovered.length;
  const carriersInUse = [...inUse.entries()]
    .map(([id, destinations]) => {
      const c = byCarrier.get(id);
      return { id, nameAr: c?.nameAr || id, destinations, dg: c?.dg ?? null, checkedAt: c?.checkedAt ?? null };
    })
    .sort((a, b) => b.destinations - a.destinations);

  // ── الدرجة: تغطية + أمان المواد الخطرة + بديل أرخص ────────────────────────────────────────────────
  const dgUnknown = dgUnknownCarriers.length;
  const verifiedCandidates = verdicts.filter((v) => v.state === 'verified').length;
  let score = 100;
  score -= Math.round((uncovered.length / Math.max(1, input.destinations.length)) * 40);
  score -= Math.min(20, dgUnknown * 4);
  score -= errors.filter((e) => e.kind === 'stale_rate').length * 5;
  score -= errors.filter((e) => e.kind === 'no_source' || e.kind === 'dg_refused').length * 5;
  if (!verifiedCandidates) score -= 10;
  score = Math.max(0, Math.min(100, score));

  if (uncovered.length) planAr.push(`${uncovered.length} وجهة من غير تعريفة منشورة (${uncovered.slice(0, 4).map((u) => u.nameAr).join('، ')}) — سعرها منطقة، ومافيش وعد إنه يغطي التكلفة.`);
  if (dgUnknown) planAr.push(`${dgUnknown} شركة شحن لسه مش متأكدين من قبولها للعطور (UN1266): ${dgUnknownCarriers.join('، ')} — قبل أي وعد توصيل دولي لازم رد مكتوب منها.`);
  if (rows.length) planAr.push(`فيه بديل أرخص موثّق في ${rows.length} وجهة — أوفرها ${Math.round(rows[0].savingEgp)} ج.م (${rows[0].nameAr} عبر «${rows[0].candidateNameAr}»). القرار لصاحب المتجر.`);
  else if (verifiedCandidates) planAr.push('مفيش بديل أرخص موثّق دلوقتي — اللي بنستخدمه هو الأرخص من اللي عندنا تعريفة له.');
  else planAr.push('لسه مفيش أي بديل بتعريفة موثّقة — الكشّاف بيقرا صفحات الشركات ويطلب من صاحب المتجر يثبّت الأرقام.');

  const summaryAr = `كشّاف الشحن: ${input.destinations.length} وجهة — ${pricedCount} بسعر موثّق و${uncovered.length} من غير تعريفة`
    + (dgUnknown ? ` · ${dgUnknown} شركة قبولها للعطور لسه مش متأكد` : '')
    + (rows.length ? ` · بديل أرخص في ${rows.length} وجهة` : ' · مفيش بديل أرخص موثّق لسه')
    + (verifiedCandidates ? ` · ${verifiedCandidates} شركة بديلة جاهزة للمقارنة` : ' · صفر شركة بديلة موثّقة');

  return {
    version: 1, agent: 'carrier-scout', updatedAt: new Date(now).toISOString(),
    rules: { staleDays, handlingPercent, netMarginPercent },
    coverage: { destinations: input.destinations.length, priced: pricedCount, uncovered },
    carriersInUse,
    candidates: verdicts,
    savings: {
      rows: rows.slice(0, 40), destinations: rows.length,
      totalEgp: round(rows.reduce((s, r) => s + r.savingEgp, 0)),
      medianPercent: percents.length ? percents[Math.floor(percents.length / 2)] : null,
      bestEgp: rows.length ? rows[0].savingEgp : null,
    },
    errors,
    score,
    summaryAr,
    planAr,
    notesAr: [
      ...(notesAr.length ? notesAr : []),
      'الكشّاف مايغيّرش أي سعر: بيقارن ويقترح، والسعر اللي الزائر بيشوفه في shipping.json + shipping-costs.json بس.',
      'كل رقم في التقرير له مصدر وتاريخ. الشركة اللي قبولها للعطور مش مؤكد بتفضل «مش متأكد»، مش «مقبولة».',
    ],
  };
}

/** The guard the workflow uses: a report is only published when it is dated and counted. */
export const isCarrierScoutReport = (v: unknown): v is CarrierScoutReport => {
  const r = v as CarrierScoutReport | undefined;
  return Boolean(r && r.version === 1 && r.agent === 'carrier-scout' && typeof r.updatedAt === 'string' && Array.isArray(r.candidates) && Array.isArray(r.errors) && typeof r.score === 'number');
};
