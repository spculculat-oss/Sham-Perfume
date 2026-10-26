/**
 * 「الانعكاس」 builder — turns the price engine's own numbers into instant answers.
 *
 * The numbers are **computed by the same functions the checkout uses** (`shippingCost`, `realShipping`,
 * `handlingFee`), so a reflex answer can never quote a price the site would not charge. Each entry keeps its
 * source and the date it was built, and says out loud what is still «يتأكد قبل الدفع».
 *
 * Pure: the tables and the rates are parameters (`tests/shaheenMindLoop.test.ts`).
 */
import {
  convert, handlingFee, realShipping, shippingCost, shippingZone, type FxTable, type ShippingTable,
} from '../../src/utils/pricing';
import type { ReflexEntry, ReflexFile } from '../../src/utils/shaheenReflex';

export interface ReflexInput {
  now: number;
  shipping: ShippingTable;
  fx: FxTable;
  destinations: {
    code: string; nameAr: string;
    carrierNameAr: string | null; carrierSource: string | null; carrierCheckedAt: string | null;
    carrierDg: boolean | null;
    customsVerified: boolean; vatPercent: number | null; customsSource: string | null;
  }[];
  tradeSpecialistId: string;
}

const money = (value: number) => Math.round(value * 100) / 100;

export function buildReflex(input: ReflexInput): ReflexFile {
  const entries: ReflexEntry[] = [];
  const inEgp = (usd: number) => money(convert(usd, input.shipping.currency, 'EGP', input.fx));

  for (const d of input.destinations) {
    const real = realShipping(d.code, 1, input.shipping);
    const charged = shippingCost(d.code, 1, input.shipping);
    const date = d.carrierCheckedAt || new Date(input.now).toISOString().slice(0, 10);
    const source = d.carrierSource || 'src/data/shipping-costs.json';

    if (real !== null) {
      const fee = handlingFee(real, input.shipping);
      const vat = d.customsVerified && d.vatPercent !== null ? `الجمارك: ضريبة ${d.vatPercent}% بتتضاف في بلدك والعميل بيتحملها.` : 'الجمارك: مش متأكدين من رقمها — بتتأكد قبل الدفع.';
      const answerAr = [
        `الشحن لأول زجاجة لـ${d.nameAr}: ${Math.round(inEgp(charged))} ج.م.`,
        `الرقم مبني على تكلفة الشركة المنشورة (${Math.round(inEgp(real))} ج.م) + هامش تجهيز ${Math.round(inEgp(fee))} ج.م — يعني مكسب المتجر 50% بيفضل صافي.`,
        vat,
        d.carrierNameAr ? `الشركة: ${d.carrierNameAr} — العطر UN1266 (سائل قابل للاشتعال)، والسعر النهائي بيتأكد قبل الدفع.` : 'العطر UN1266 (سائل قابل للاشتعال)، والسعر النهائي بيتأكد قبل الدفع.',
        `المصدر: ${source} · ${date}`,
      ].join('\n');
      const answerEn = [
        `Shipping for the first bottle to ${d.nameAr}: ${Math.round(inEgp(charged))} EGP.`,
        `Built on the carrier's published cost (${Math.round(inEgp(real))} EGP) + a ${Math.round(inEgp(fee))} EGP handling margin — so the store's 50% stays net.`,
        d.customsVerified && d.vatPercent !== null ? `Customs: ${d.vatPercent}% VAT is added in your country.` : 'Customs: not verified yet — confirmed before payment.',
        'Perfume is UN1266 (flammable); the final price is confirmed before payment.',
        `Source: ${source} · ${date}`,
      ].join('\n');
      entries.push({
        id: `reflex-ship-${d.code}`, kind: 'shipping', nameAr: d.nameAr, code: d.code, lang: 'ar',
        question: `الشحن لـ${d.nameAr} بكام؟`, answerAr, answerEn, source, checkedAt: date, specialistId: input.tradeSpecialistId,
      });
    } else {
      // مفيش تعريفة شركة منشورة للمسار: بنقول سعر المنطقة اللي الموقع بيحصّله فعلًا، ونقول صريح إنه تقديري —
      // الزائر مش هيفضل من غير إجابة، وإحنا مش بنخترع رقم شركة.
      const zone = shippingZone(d.code, input.shipping);
      const charged = shippingCost(d.code, 1, input.shipping);
      const date = new Date(input.now).toISOString().slice(0, 10);
      const vat = d.customsVerified && d.vatPercent !== null ? `الجمارك: ضريبة ${d.vatPercent}% بتتضاف في بلدك والعميل بيتحملها.` : 'الجمارك: مش متأكدين من رقمها — بتتأكد قبل الدفع.';
      entries.push({
        id: `reflex-ship-${d.code}`, kind: 'shipping', nameAr: d.nameAr, code: d.code, lang: 'ar',
        question: `الشحن لـ${d.nameAr} بكام؟`,
        answerAr: [
          `الشحن لأول زجاجة لـ${d.nameAr}: ${Math.round(inEgp(charged))} ج.م (سعر منطقة «${zone.name.ar}»).`,
          'المسار ده لسه من غير تعريفة شركة منشورة، فالرقم تقديري من جدول المناطق وبيتأكد قبل الدفع — مفيش رقم شركة مخترع.',
          vat,
          'العطر UN1266 (سائل قابل للاشتعال) — القبول على المسار بيتأكد قبل الدفع.',
          `المصدر: src/data/shipping.json · ${date}`,
        ].join('\n'),
        answerEn: [
          `Shipping for the first bottle to ${d.nameAr}: ${Math.round(inEgp(charged))} EGP (zone «${zone.name.en}»).`,
          'No published carrier rate covers this lane yet, so this is an estimate from the zone table — confirmed before payment.',
          d.customsVerified && d.vatPercent !== null ? `Customs: ${d.vatPercent}% VAT is added in your country.` : 'Customs: not verified yet — confirmed before payment.',
          'Perfume is UN1266 (flammable); the final price is confirmed before payment.',
          `Source: src/data/shipping.json · ${date}`,
        ].join('\n'),
        source: 'src/data/shipping.json', checkedAt: date, specialistId: input.tradeSpecialistId,
      });
    }

    if (d.customsVerified && d.vatPercent !== null) {
      const customsSource = d.customsSource || 'src/data/customs.json';
      entries.push({
        id: `reflex-customs-${d.code}`, kind: 'customs', nameAr: d.nameAr, code: d.code, lang: 'ar',
        question: `جمارك ${d.nameAr} كام؟`,
        answerAr: [
          `جمارك ${d.nameAr}: ضريبة قيمة مضافة ${d.vatPercent}% على الطرد، والعميل بيتحملها فوق سعر الشحن.`,
          'الرسوم الجمركية بتتحدد بالبند وبلد المنشأ، وبتتأكد قبل الدفع — مفيش رقم مخترع.',
          `المصدر: ${customsSource}`,
        ].join('\n'),
        answerEn: `Customs for ${d.nameAr}: ${d.vatPercent}% VAT on the parcel, paid by the buyer on top of shipping. Duties depend on the item and the origin and are confirmed before payment.\nSource: ${customsSource}`,
        source: customsSource, checkedAt: d.carrierCheckedAt || new Date(input.now).toISOString().slice(0, 10), specialistId: input.tradeSpecialistId,
      });
    }
  }

  // «بتشحنوا العطر؟» — القاعدة واحدة لكل الوجهات، ومصدرها ملف الشحن.
  const carrier = input.destinations.find((d) => d.carrierNameAr && d.carrierDg !== true);
  if (carrier?.carrierNameAr) {
    entries.push({
      id: 'reflex-dg', kind: 'perfume_on_board', nameAr: carrier.carrierNameAr, code: 'dg', lang: 'ar',
      question: 'بتشحنوا العطر؟ العطر مادة خطرة؟',
      answerAr: [
        'العطر سائل قابل للاشتعال ومصنّف UN1266 (Class 3) — الشحن الجوي بيخضع لحدود IATA، وشركات كتير بترفضه إلا بتصريح مواد خطرة.',
        `الشركة اللي بنستخدمها (${carrier.carrierNameAr}) لسه بنتأكد إنها بتقبل العطور على المسار — ولحد ما نتأكد، مفيش وعد شحن دولي قبل التأكيد.`,
        'القاعدة: السعر والتوصيل بيتأكدوا قبل الدفع، مش بعديه.',
        `المصدر: ${carrier.carrierSource || 'src/data/shipping-lanes.json'} · ${carrier.carrierCheckedAt || '—'}`,
      ].join('\n'),
      answerEn: 'Perfume is UN1266 (Class 3, flammable) — air shipping follows IATA limits and many carriers refuse it without a dangerous-goods declaration. We confirm the carrier accepts it on your lane before promising delivery.\nSource: src/data/shipping-lanes.json',
      source: carrier.carrierSource || 'src/data/shipping-lanes.json',
      checkedAt: carrier.carrierCheckedAt || new Date(input.now).toISOString().slice(0, 10),
      specialistId: input.tradeSpecialistId,
    });
  }

  return { version: 1, updatedAt: new Date(input.now).toISOString(), entries };
}

export const isReflexReport = (v: unknown): v is ReflexFile => {
  const f = v as ReflexFile | undefined;
  return Boolean(f && f.version === 1 && typeof f.updatedAt === 'string' && Array.isArray(f.entries) && f.entries.length > 0);
};
