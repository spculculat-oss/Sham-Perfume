/**
 * «السيرة الذاتية للمتجر» — before Shaheen imports a single product from a store anywhere in the world
 * (the Arab world, Europe, the Americas, East or Central Asia), he reads its «CV» and gives it a trust score
 * out of 100. Pure (no network): run.mts gathers the pages (home, contact, returns, legal notice), the domain's
 * registration date (RDAP — the official public registry record) and, when the merchant adds a key, Google
 * Safe Browsing's verdict; this file only judges them.
 *
 * Signals, in many languages (Arabic, English, French, German, Spanish, Italian, Dutch, Polish, Turkish, Russian,
 * Japanese, Chinese, Korean):
 *  - how long the domain exists (a shop opened last month is not a supplier);
 *  - a secure connection (https);
 *  - a reachable company: contact page, e-mail, phone, address, and a legal identity (company / VAT number,
 *    Impressum, mentions légales, 特定商取引法, سجل تجاري…);
 *  - customer policies: returns/refund, shipping (and whether it ships abroad), privacy, terms;
 *  - known card / wallet payments (Visa, Mastercard, PayPal, Apple Pay, Klarna, mada, Alipay, Kaspi…);
 *  - an established shop platform, official social accounts, and an «original / authorised» promise.
 * Red flags reject a store whatever its score: a domain younger than six months, no https, a site Google
 * lists as dangerous, copies («replica», «dupe», «inspired by», «تقليد»…) or payment by money transfer only.
 */

export type TrustId = 'age' | 'https' | 'contact' | 'identity' | 'returns' | 'shipping' | 'privacy' | 'terms' | 'payment' | 'platform' | 'social' | 'authentic';

export interface TrustCheck {
  id: TrustId;
  /** Arabic label for the merchant (the admin panel translates it). */
  label: string;
  /** true = found, false = missing, null = could not be checked (neutral). */
  ok: boolean | null;
  points: number;
  max: number;
  detail?: string;
}

export interface TrustProfile {
  score: number;
  verdict: 'trusted' | 'weak' | 'rejected';
  at: string;
  checks: TrustCheck[];
  /** Red flags in plain Arabic — any one of them rejects the store. */
  flags: string[];
  /** Domain registration date (RDAP), when the registry publishes it. */
  registeredAt?: string;
  region?: Region;
}

export type Region = 'arab' | 'europe' | 'americas' | 'east-asia' | 'central-asia' | 'south-asia' | 'oceania' | 'africa' | 'global';

/** The lowest score a store may have to be imported (and kept). */
export const TRUST_MIN = 60;

export interface TrustInput {
  host: string;
  /** The home page address after redirects. */
  finalUrl: string;
  homeHtml: string;
  /** Contact / returns / legal pages read from the home page's links. */
  pages?: { url: string; html: string }[];
  /** ISO date from RDAP; null = the registry does not publish it; undefined = not asked. */
  registeredAt?: string | null;
  /** Google Safe Browsing (only with the merchant's key). */
  safeBrowsing?: 'clean' | 'flagged';
  /** Pages the site has but forbids automated readers to open (robots.txt): «could not check», not «missing». */
  blocked?: TrustId[];
  /** Brands the store sells: a years-old domain that is exactly a brand's name is that brand's own house. */
  brands?: string[];
  now: number;
}

// ── words, many languages ────────────────────────────────────────────────────────────────────────────────
const WORDS: Record<'contact' | 'about' | 'returns' | 'shipping' | 'privacy' | 'terms' | 'legal', RegExp> = {
  contact: /contact|kontakt|contacto|contatti|contato|neem contact|お問い合わせ|問い合わせ|联系我们|聯絡|联系|문의|고객센터|контакт|связ|iletişim|اتصل|تواصل|اتصال/i,
  about: /about|über uns|ueber-uns|uber-uns|qui sommes|a-propos|à propos|quienes-somos|quiénes somos|chi siamo|sobre nós|over ons|o nas|会社概要|企業情報|关于我们|關於我們|회사소개|о нас|о компании|hakkımızda|hakkimizda|من نحن|عن المتجر|عن الشركة/i,
  returns: /return|refund|exchange-policy|retour|rückgabe|ruckgabe|widerruf|rücksend|devoluci|reembolso|reso|resi|rimborso|zwrot|返品|返金|退货|退款|退換|반품|환불|교환|возврат|iade|إرجاع|ارجاع|استرجاع|استبدال|الاسترداد/i,
  shipping: /shipping|delivery|livraison|versand|lieferung|envío|envio|spedizion|consegna|verzending|levering|wysyłka|dostawa|配送|送料|运费|配送|發貨|배송|доставк|kargo|teslimat|شحن|الشحن|توصيل|التوصيل/i,
  privacy: /privacy|datenschutz|confidentialit|privacidad|privacidade|riservatezza|privacybeleid|prywatno|プライバシー|个人信息|隐私|隱私|개인정보|конфиденциальн|персональн|gizlilik|kvkk|الخصوصية|سياسة الخصوصية/i,
  terms: /terms|conditions|\bagb\b|\bcgv\b|condiciones|condizioni|termos|voorwaarden|regulamin|利用規約|规约|条款|條款|이용약관|약관|услови|оферт|şartlar|kosullar|koşullar|sözleşme|الشروط|الأحكام|شروط الاستخدام/i,
  legal: /impressum|mentions[- ]l[ée]gales|aviso[- ]legal|note[- ]legali|informazioni[- ]legali|colofon|特定商取引|特商法|会社情報|legal[- ]notice|legal[- ]info|imprint|реквизит|künye|الشروط القانونية/i,
};

/** A company number / tax number / legal notice written on the page. */
const LEGAL_ID = new RegExp([
  'impressum', 'mentions l[ée]gales', 'aviso legal', '特定商取引法', '特商法に基づく',
  'company (?:no|number|reg(?:istration)?)', 'trade (?:number|licen[cs]e|register)', 'business registration', 'tax (?:number|registration)', 'registered (?:in|office|number|company)', 'company registration', 'registration (?:no|number)', 'reg\\.? no',
  'vat (?:no|number|reg|id)', 'vat:', 'ust-?id(?:nr)?', 'umsatzsteuer', 'handelsregister', 'hrb ?\\d', 'siret', 'siren', 'rcs ', 'tva intracom',
  'p\\.? ?iva', 'partita iva', 'c\\.?f\\.? ?\\d', 'cif:? ?[a-z]?\\d', 'nif:? ?[a-z]?\\d', 'kvk', 'btw', 'nip:? ?\\d', 'krs', 'regon',
  '\\babn\\b', '\\bacn\\b', 'gstin', 'gst (?:no|reg)', '\\bein\\b', 'tax id', 'cr no', 'c\\.r\\.? ?no', 'commercial registration', 'trade licen[cs]e',
  'سجل تجاري', 'السجل التجاري', 'الرقم الضريبي', 'رقم ضريبي', 'رخصة تجارية', 'الرقم الموحد',
  'инн', 'огрн', 'бин', 'бсн', 'vergi (?:no|dairesi)', 'mersis', '사업자등록번호', '통신판매업', '统一社会信用代码', '营业执照', 'icp备', '法人番号', '古物商',
].join('|'), 'i');
const ADDRESS = /\baddress\b|adresse|anschrift|dirección|direccion|indirizzo|endereço|adres|siedziba|所在地|住所|地址|주소|адрес|العنوان|عنوان المتجر|ص\.ب|p\.?o\.? box|\bsuite\b|\bstreet\b|\bstr\.|\bstraße\b|\brue\b|\bcalle\b|\bvia\b|\bavenue\b|\broad\b/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const EMAIL_NOISE = /example\.|sentry|wixpress|domain\.com|email\.com|yourstore|@2x|\.png|\.jpe?g|\.webp|\.svg|\.gif|u003e/i;
const PHONE = /(?:tel:|\+)\s?\d[\d\s().-]{7,18}\d|(?:phone|tel|telefon|téléphone|teléfono|telefono|電話|电话|전화|телефон|هاتف|جوال|الهاتف)[^\d+]{0,12}[+(]?\d[\d\s().-]{6,18}\d/i;

const PAYMENTS: [string, RegExp][] = [
  ['Visa', /\bvisa\b/i], ['Mastercard', /master ?card|\bmaestro\b/i], ['American Express', /american express|\bamex\b/i], ['PayPal', /paypal/i],
  ['Apple Pay', /apple ?pay/i], ['Google Pay', /google ?pay|\bgpay\b/i], ['Shop Pay', /shop ?pay/i], ['Klarna', /klarna/i], ['Afterpay', /afterpay|clearpay/i],
  ['Stripe', /stripe/i], ['Adyen', /adyen/i], ['iDEAL', /\bideal\b/i], ['Bancontact', /bancontact/i], ['Sofort', /sofort/i], ['Giropay', /giropay/i], ['Przelewy24', /przelewy24|\bblik\b/i],
  ['JCB', /\bjcb\b/i], ['UnionPay', /union ?pay|银联/i], ['Alipay', /alipay|支付宝/i], ['WeChat Pay', /wechat ?pay|微信支付/i], ['Kakao Pay', /kakao ?pay/i], ['Naver Pay', /naver ?pay/i], ['PayPay', /paypay/i], ['Konbini', /コンビニ決済/i],
  ['mada', /\bmada\b|مدى/i], ['Tabby', /tabby|تابي/i], ['Tamara', /tamara|تمارا/i], ['STC Pay', /stc ?pay/i], ['KNET', /\bknet\b/i], ['Fawry', /fawry|فوري/i], ['Benefit', /benefit ?pay/i],
  ['Kaspi', /kaspi/i], ['Payme', /\bpayme\b/i], ['Click', /click\.uz|click up/i], ['Mir', /\bмир\b|mir pay/i], ['Iyzico', /iyzico/i], ['Razorpay', /razorpay/i], ['Paytm', /paytm/i], ['UPI', /\bupi\b/i],
];
const RISKY_PAYMENT = /western union|moneygram|bitcoin only|crypto(?:currency)? only|pay (?:with|by) gift ?cards?|bank transfer only|wire transfer only/i;
const PLATFORMS: [string, RegExp][] = [
  ['Shopify', /cdn\.shopify\.com|Shopify\.(?:theme|shop|routes|locale)|myshopify\.com|\/cdn\/shop\/(?:files|products|t)\/|shopify-section|window\.Shopify/i], ['WooCommerce', /woocommerce/i], ['Magento', /Magento|mage\/cookies|\/static\/version\d+\//i],
  ['Salla', /salla\.(?:sa|network)|cdn\.salla/i], ['Zid', /zid\.(?:sa|store)|zidcdn/i], ['BigCommerce', /bigcommerce/i], ['Shopware', /shopware/i], ['PrestaShop', /prestashop/i],
  ['Salesforce Commerce', /demandware|\/on\/demandware\.store/i], ['commercetools', /commercetools/i], ['Wix Stores', /wixstatic|wix-ecommerce/i], ['Squarespace', /squarespace/i],
  ['Ecwid', /ecwid/i], ['OpenCart', /route=product\/product|catalog\/view\/theme/i], ['YouCan', /youcan\.shop/i], ['Cafe24', /cafe24/i], ['MakeShop', /makeshop/i], ['Shopline', /shopline/i],
];
const SOCIAL = /(?:instagram\.com|facebook\.com|tiktok\.com\/@|(?:twitter|x)\.com\/[a-z0-9_]|youtube\.com\/(?:@|c\/|channel)|linkedin\.com\/company|pinterest\.[a-z.]+\/[a-z0-9_]|vk\.com\/|line\.me\/|weibo\.com\/|xiaohongshu\.com|snapchat\.com\/add|t\.me\/)/i;
const AUTHENTIC = /100\s?% (?:authentic|original|genuine)|authori[sz]ed (?:retailer|dealer|stockist|distributor|reseller)|official (?:store|retailer|stockist|online store|distributor)|genuine products|guaranteed (?:authentic|original)|garantiert original|originalware|100\s?% original|authentiques?|productos originales|prodotti originali|produtos originais|oryginaln|正規品|正規取扱|正品|정품|оригинальн|orijinal ürün|أصلي|أصلية|منتجات أصلية|الوكيل الرسمي|موزع معتمد/i;
/** Copies of other houses' perfumes: what the store's home page or its product names say. */
const COPIES = /\breplica\b|\breplicas\b|\bdupes?\b|\bclones?\b|inspired by|impression of|our (?:version|take) of|smells like|knock-?offs?|alternative to|equivalent (?:of|to)|similar to (?:the )?(?:scent|smell|fragrance)|parfum[- ]?(?:générique|equivalence)|duftzwilling|parfum[- ]?zwilling|contratipo|equivalencia|imitaci[oó]n|imitazione|тестер-копия|копия|реплика|репліка|仿香|复刻|高仿|레플리카|عطر تقليد|تقليد|مستوحى من|نسخة طبق الأصل|بديل عطر/i;

const TLD_RISKY = /\.(?:xyz|top|shop|click|buzz|icu|cyou|rest|monster|sbs|cfd|bond|quest|live|online|site|store|fun|space|website|club|vip|win|loan|work|gq|ml|cf|tk|ga)$/i;

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────
const textOf = (html: string) => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ');

/** Every link of a page: its address and its visible text (for «Returns», «Impressum», «اتصل بنا»…). */
export function anchors(html: string, base: string): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = [];
  // Every <a href>, even when its content is a long icon (svg): the text is whatever comes before </a>.
  for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"'#][^"']*)["'][^>]*>/gi)) {
    try {
      const href = new URL(m[1].replace(/&amp;/g, '&'), base).href;
      if (!/^https?:/i.test(href)) continue;
      const rest = html.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 4000);
      const end = rest.search(/<\/a>/i);
      out.push({ href, text: textOf(end >= 0 ? rest.slice(0, end) : '').trim().slice(0, 80) });
    } catch { /* not a link */ }
  }
  return out;
}

const decoded = (u: string) => { try { return decodeURIComponent(u); } catch { return u; } };

/**
 * Where a platform publishes its standard pages even when the home page does not link them (menus built by
 * script): every Shopify shop has /policies/… (refund, shipping, privacy, terms and «contact information» —
 * the legal name, address, phone, e-mail and tax number); WooCommerce creates «refund_returns».
 */
const STANDARD_PAGES: Record<string, Partial<Record<keyof typeof WORDS, string[]>>> = {
  Shopify: {
    contact: ['/policies/contact-information', '/pages/contact'], legal: ['/policies/legal-notice'], returns: ['/policies/refund-policy'],
    shipping: ['/policies/shipping-policy'], privacy: ['/policies/privacy-policy'], terms: ['/policies/terms-of-service'],
  },
  WooCommerce: { contact: ['/contact-us/', '/contact/'], returns: ['/refund_returns/'], privacy: ['/privacy-policy/'] },
  any: { contact: ['/contact-us', '/contact'], returns: ['/returns', '/refund-policy'] },
};

/**
 * The store's own pages worth reading for its CV (same site only), most telling first: contact (with the
 * legal details on Shopify), returns/refund, legal notice (Impressum…), shipping, about — from the home page's
 * links, else the platform's standard addresses. At most `limit`.
 */
export function trustLinks(homeHtml: string, base: string, limit = 6): string[] {
  let host = '';
  try { host = new URL(base).hostname.replace(/^www\./, ''); } catch { return []; }
  const own = anchors(homeHtml, base).filter((a) => { try { const h = new URL(a.href).hostname.replace(/^www\./, ''); return h === host || h.endsWith(`.${host}`); } catch { return false; } });
  const platform = PLATFORMS.find(([, re]) => re.test(homeHtml))?.[0];
  const standard = STANDARD_PAGES[platform || ''] || STANDARD_PAGES.any;
  const pick: string[] = [];
  const add = (u?: string) => { if (u && !pick.includes(u)) pick.push(u); };
  for (const kind of ['contact', 'returns', 'legal', 'shipping', 'about'] as const) {
    const hit = own.find((a) => WORDS[kind].test(`${decoded(a.href)} ${a.text}`) && !pick.includes(a.href) && !/\.(?:pdf|jpe?g|png)$/i.test(a.href));
    if (hit) add(hit.href);
    // Shopify's «contact information» policy carries the company's legal details: read it as well.
    if (!hit || (platform === 'Shopify' && kind === 'contact')) add(standard[kind]?.map((p) => new URL(p, base).href)[0]);
  }
  // Privacy and terms usually sit in the footer; only when they are not linked, their standard page.
  for (const kind of ['privacy', 'terms'] as const) if (!own.some((a) => WORDS[kind].test(`${decoded(a.href)} ${a.text}`))) add(standard[kind]?.map((p) => new URL(p, base).href)[0]);
  return pick.slice(0, limit);
}

const TWO_LEVEL = /\.(?:co|com|org|net|gov|edu|ac|or|ne|go)\.(?:uk|jp|kr|au|nz|my|sg|id|th|in|za|tr|sa|eg|ae|kw|qa|bh|om|jo|lb|ma|ng|ke|br|mx|ar|co|cn|hk|tw|ua|il|pk|ph|vn|pe|cl|ve|ec|uy|kz|uz)$/i;
/** The domain a registry records: shop.example.co.uk → example.co.uk; www.parfum.de → parfum.de. */
export function registrableDomain(host: string): string {
  const h = host.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const parts = h.split('.');
  const keep = TWO_LEVEL.test(h) ? 3 : 2;
  return parts.slice(-keep).join('.');
}

/** Which CV check a page address is for (contact, returns, legal → identity, shipping, privacy, terms). */
export function pageKind(url: string): TrustId | undefined {
  const u = decoded(url);
  if (WORDS.legal.test(u) || /contact-information/i.test(u)) return 'identity';
  for (const k of ['returns', 'shipping', 'privacy', 'terms', 'contact'] as const) if (WORDS[k].test(u)) return k;
  return undefined;
}

const brandKey = (b: string) => b.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
/** The brand whose official domain this is (afnan.com ← «Afnan», lattafa-perfumes.com ← «Lattafa Perfumes»). */
export function officialBrandOf(host: string, brands: string[]): string | undefined {
  const label = registrableDomain(host).split('.')[0].replace(/-/g, '');
  if (label.length < 4) return undefined;
  return brands.find((b) => {
    const k = brandKey(b);
    return k.length >= 4 && (label === k || label === `${k}perfumes` || label === `${k}parfums` || label === `${k}perfume` || label === k.replace(/(?:perfumes?|parfums?)$/, ''));
  });
}

/** The registration date in an RDAP answer (events → «registration»). */
export function rdapRegistered(json: unknown): string | undefined {
  const events = (json as { events?: { eventAction?: string; eventDate?: string }[] })?.events;
  const reg = Array.isArray(events) ? events.find((e) => /registration/i.test(e?.eventAction || '')) : undefined;
  return reg?.eventDate && !Number.isNaN(Date.parse(reg.eventDate)) ? new Date(reg.eventDate).toISOString() : undefined;
}

const CC_REGION: [RegExp, Region][] = [
  [/\.(?:sa|ae|kw|qa|bh|om|eg|jo|lb|iq|ma|dz|tn|ly|sd|ye|ps|sy)$/, 'arab'],
  [/\.(?:uk|de|fr|it|es|nl|be|ch|at|se|no|dk|fi|ie|pt|pl|cz|sk|hu|ro|bg|gr|hr|si|lt|lv|ee|lu|is|eu|tr|ua|rs|ba|mk|al|me|md|cy|mt)$/, 'europe'],
  [/\.(?:us|ca|mx|br|ar|cl|co|pe|uy|ve|ec|bo|py)$/, 'americas'],
  [/\.(?:jp|kr|cn|hk|tw|mo|sg|my|th|vn|id|ph|mn)$/, 'east-asia'],
  [/\.(?:kz|uz|kg|tj|tm|az|ge|am)$/, 'central-asia'],
  [/\.(?:in|pk|bd|lk|np)$/, 'south-asia'],
  [/\.(?:au|nz)$/, 'oceania'],
  [/\.(?:za|ng|ke|gh|tz|et|sn|ci)$/, 'africa'],
];
const CUR_REGION: Record<string, Region> = {
  SAR: 'arab', AED: 'arab', KWD: 'arab', QAR: 'arab', BHD: 'arab', OMR: 'arab', EGP: 'arab', JOD: 'arab', MAD: 'arab', LBP: 'arab', IQD: 'arab', TND: 'arab', DZD: 'arab',
  EUR: 'europe', GBP: 'europe', CHF: 'europe', SEK: 'europe', NOK: 'europe', DKK: 'europe', PLN: 'europe', CZK: 'europe', HUF: 'europe', RON: 'europe', BGN: 'europe', TRY: 'europe', UAH: 'europe', ISK: 'europe',
  USD: 'americas', CAD: 'americas', MXN: 'americas', BRL: 'americas', ARS: 'americas', CLP: 'americas', COP: 'americas', PEN: 'americas',
  JPY: 'east-asia', KRW: 'east-asia', CNY: 'east-asia', HKD: 'east-asia', TWD: 'east-asia', SGD: 'east-asia', MYR: 'east-asia', THB: 'east-asia', VND: 'east-asia', IDR: 'east-asia', PHP: 'east-asia',
  KZT: 'central-asia', UZS: 'central-asia', KGS: 'central-asia', TJS: 'central-asia', AZN: 'central-asia', GEL: 'central-asia', AMD: 'central-asia',
  INR: 'south-asia', PKR: 'south-asia', BDT: 'south-asia', LKR: 'south-asia', AUD: 'oceania', NZD: 'oceania', ZAR: 'africa', NGN: 'africa', KES: 'africa',
};
/** Where a store sells from: its country domain first, else its currency (a .com in USD → the Americas). */
export function regionOf(host: string, currency?: string): Region {
  const h = host.toLowerCase();
  for (const [re, r] of CC_REGION) if (re.test(h)) return r;
  return (currency && CUR_REGION[currency.toUpperCase()]) || 'global';
}
export const REGION_LABEL: Record<Region, string> = {
  arab: 'الخليج والعالم العربي', europe: 'أوروبا', americas: 'الأمريكتان', 'east-asia': 'شرق آسيا', 'central-asia': 'وسط آسيا',
  'south-asia': 'جنوب آسيا', oceania: 'أستراليا ونيوزيلندا', africa: 'أفريقيا', global: 'عالمي',
};

/** Share of product names that sell copies of other houses (0–1). */
export function copyShare(names: string[]): number {
  const list = names.filter(Boolean);
  return list.length ? list.filter((n) => COPIES.test(n)).length / list.length : 0;
}
/** The home page sells copies openly («designer dupes», «inspired by Dior», «عطور تقليد»…). */
export const sellsCopies = (html: string): boolean => {
  const t = textOf(html);
  return /(?:designer|perfume|fragrance|parfum)s? (?:dupes?|clones?|replicas?)|(?:dupes?|clones?|replicas?) (?:perfumes?|fragrances?|parfums?)|inspired by (?:designer|luxury|famous|top)|عطور تقليد|عطور مقلدة|نسخ طبق الأصل|duftzwillinge|contratipos|parfums? (?:génériques|d'équivalence)/i.test(t);
};

// ── the judgement ────────────────────────────────────────────────────────────────────────────────────────
export function assessTrust(i: TrustInput): TrustProfile {
  const pages = i.pages || [];
  const allHtml = [i.homeHtml, ...pages.map((p) => p.html)].join('\n');
  const text = textOf(allHtml);
  const links = [...anchors(i.homeHtml, i.finalUrl), ...pages.flatMap((p) => anchors(p.html, p.url))];
  const linkText = links.map((a) => `${decoded(a.href)} ${a.text}`).join('\n');
  const has = (kind: keyof typeof WORDS) => WORDS[kind].test(linkText) || pages.some((p) => WORDS[kind].test(decoded(p.url)));
  const blocked = new Set(i.blocked || []);
  let years: number | undefined;
  if (i.registeredAt) years = (i.now - Date.parse(i.registeredAt)) / (365.25 * 86_400_000);
  // Benefit of the doubt only for an established site (3+ years): a young shop that hides its pages gets none.
  const half = (max: number) => (years !== undefined && years >= 3 ? Math.ceil(max / 2) : 0);
  const HIDDEN = 'الموقع يمنع قراءة الصفحة آلياً';
  /** Found → full points; forbidden to read → «?» (half points for an established site); else missing. */
  const policy = (id: TrustId, label: string, found: boolean, max: number): TrustCheck => (found
    ? { id, label, ok: true, points: max, max }
    : blocked.has(id) ? { id, label, ok: null, points: half(max), max, detail: HIDDEN } : { id, label, ok: false, points: 0, max });
  const checks: TrustCheck[] = [];
  const flags: string[] = [];
  const add = (c: TrustCheck) => checks.push(c);

  // 1. Domain age (RDAP).
  if (years === undefined) add({ id: 'age', label: 'عمر النطاق', ok: null, points: 8, max: 20, detail: 'السجل لا ينشر تاريخ التسجيل' });
  else {
    const pts = years >= 5 ? 20 : years >= 3 ? 16 : years >= 1 ? 10 : years >= 0.5 ? 4 : 0;
    add({ id: 'age', label: 'عمر النطاق', ok: years >= 1, points: pts, max: 20, detail: years >= 1 ? `${Math.floor(years)} سنة` : `${Math.max(0, Math.round(years * 12))} شهر` });
    if (years < 0.5) flags.push('نطاق جديد جداً (أقل من ستة أشهر)');
  }

  // 2. Secure connection.
  const https = /^https:\/\//i.test(i.finalUrl);
  add({ id: 'https', label: 'اتصال آمن (https)', ok: https, points: https ? 5 : 0, max: 5 });
  if (!https) flags.push('لا يستخدم اتصالاً آمناً (https)');

  // 3. Reachable: contact page, e-mail, phone.
  const emails = [...new Set((allHtml.match(EMAIL) || []).map((e) => e.toLowerCase()).filter((e) => !EMAIL_NOISE.test(e)))];
  const phone = PHONE.test(text) || /href=["']tel:/i.test(allHtml);
  const contactPage = has('contact');
  const contactPts = (emails.length ? 4 : 0) + (phone ? 4 : 0) + (contactPage ? 2 : 0);
  if (contactPts < 6 && blocked.has('contact')) add({ id: 'contact', label: 'بيانات التواصل', ok: null, points: Math.max(contactPts, half(10)), max: 10, detail: HIDDEN });
  else add({ id: 'contact', label: 'بيانات التواصل', ok: contactPts >= 6, points: Math.min(10, contactPts), max: 10, detail: [contactPage && 'صفحة تواصل', emails.length && 'بريد', phone && 'هاتف'].filter(Boolean).join(' + ') || 'لا توجد' });

  // 4. Legal identity: company / tax number, legal notice, address.
  const legalId = LEGAL_ID.test(text) || has('legal');
  const address = ADDRESS.test(text);
  // The brand's own house: a domain that is exactly the brand's name, registered years ago.
  const brand = years !== undefined && years >= 3 ? officialBrandOf(i.host, i.brands || []) : undefined;
  const idPts = (legalId || brand ? 10 : 0) + (address ? 5 : 0);
  const idCheck: TrustCheck = { id: 'identity', label: 'هوية الشركة (سجل/رقم ضريبي/عنوان)', ok: legalId || Boolean(brand), points: idPts, max: 15, detail: [legalId && 'بيانات قانونية', brand && `الموقع الرسمي لماركة ${brand}`, address && 'عنوان'].filter(Boolean).join(' + ') || 'لا توجد' };
  if (!idCheck.ok && blocked.has('identity')) Object.assign(idCheck, { ok: null, points: Math.max(idPts, half(10)), detail: HIDDEN });
  add(idCheck);

  // 5–8. Customer policies.
  const returns = has('returns') || /(?:return|refund|retour|rückgabe|widerruf|devoluci|reso|返品|退货|반품|возврат|iade|إرجاع|استرجاع)[^.]{0,60}(?:policy|polic|richtlinie|politique|política|politica|ポリシー|政策|정책|политик|politika|سياسة)/i.test(text);
  add(policy('returns', 'سياسة الإرجاع والاسترداد', returns, 10));
  const shippingPage = has('shipping');
  const worldwide = /ship(?:s|ping)? (?:worldwide|internationally|to over \d+ countries|to \d+\+? countries)|international (?:shipping|delivery)|worldwide (?:shipping|delivery)|livraison (?:internationale|dans le monde)|weltweite?r? versand|internationaler versand|envío internacional|envíos internacionales|spedizione internazionale|spedizioni in tutto il mondo|海外発送|海外配送|国际运输|全球配送|해외배송|международная доставка|yurt ?dışı kargo|شحن دولي|الشحن الدولي|شحن لجميع الدول|نشحن لجميع/i.test(text);
  add(shippingPage || worldwide || !blocked.has('shipping')
    ? { id: 'shipping', label: 'سياسة الشحن', ok: shippingPage || worldwide, points: (shippingPage ? 3 : 0) + (worldwide ? 2 : 0), max: 5, detail: worldwide ? 'يشحن دولياً' : shippingPage ? 'محلي أو غير مذكور' : undefined }
    : policy('shipping', 'سياسة الشحن', false, 5));
  add(policy('privacy', 'سياسة الخصوصية', has('privacy'), 5));
  add(policy('terms', 'الشروط والأحكام', has('terms'), 5));

  // 9. Payment methods.
  // Payment logos are pictures: their file names / alt texts count too (scripts do not).
  const markup = allHtml.slice(0, 3_000_000).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
  const pay = PAYMENTS.filter(([, re]) => re.test(text) || re.test(markup)).map(([n]) => n);
  add({ id: 'payment', label: 'وسائل دفع معروفة', ok: pay.length > 0, points: pay.length >= 2 ? 10 : pay.length ? 6 : 0, max: 10, detail: pay.slice(0, 6).join('، ') || undefined });
  if (!pay.length && RISKY_PAYMENT.test(text)) flags.push('يطلب الدفع بالحوالات أو العملات الرقمية فقط');

  // 10–12. Platform, social accounts, «original» promise.
  const platform = PLATFORMS.find(([, re]) => re.test(i.homeHtml))?.[0];
  add({ id: 'platform', label: 'منصة متاجر معروفة', ok: platform ? true : null, points: platform ? 5 : 2, max: 5, detail: platform });
  const social = links.some((a) => SOCIAL.test(a.href));
  add({ id: 'social', label: 'حسابات رسمية على التواصل', ok: social, points: social ? 5 : 0, max: 5 });
  const authentic = AUTHENTIC.test(text);
  add({ id: 'authentic', label: 'يضمن أن المنتجات أصلية', ok: authentic, points: authentic ? 5 : 0, max: 5 });

  if (sellsCopies(i.homeHtml)) flags.push('يبيع عطوراً مقلّدة أو «مستوحاة» من ماركات أخرى');
  if (i.safeBrowsing === 'flagged') flags.push('مُدرج لدى Google كموقع خطر');
  if (TLD_RISKY.test(i.host) && years !== undefined && years < 2) flags.push('امتداد نطاق شائع في المتاجر الوهمية ونطاق حديث');

  const score = Math.max(0, Math.min(100, checks.reduce((n, c) => n + c.points, 0)));
  return {
    score,
    verdict: flags.length ? 'rejected' : score >= TRUST_MIN ? 'trusted' : 'weak',
    at: new Date(i.now).toISOString(),
    checks,
    flags,
    registeredAt: i.registeredAt || undefined,
  };
}

/** One line for the merchant: why the store's CV failed (the red flag, or the weakest missing checks). */
export function trustReason(p: TrustProfile): string {
  if (p.flags.length) return `ملف الثقة: ${p.flags[0]}`;
  const missing = p.checks.filter((c) => c.ok === false).sort((a, b) => b.max - a.max).slice(0, 3).map((c) => c.label);
  return `ملف الثقة ضعيف (${p.score}/100)${missing.length ? `: ينقصه ${missing.join('، ')}` : ''}`;
}
