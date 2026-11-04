/**
 * «أسماء النوتات» — the catalogue publishes its notes in English, and the importer sometimes leaves junk in them
 * («Musky SUPREMACY PURPLE», «Patchouli "», «Musky Unisex CPO 20 ML PERFUME NOTES»). A merchant never reads a label
 * aloud like that (the owner's complaint, 2026-10-23: «القاعدة: Spicy، Musky SUPREMACY PURPLE» — «دة رد مش احترافى»).
 *
 *  - cleanNote: the note without import artefacts (product-name fragments in capitals, sizes, quotes, «notes»).
 *  - noteAr: the note in Arabic — the dictionary, then «adjective + note» («creamy woods» → «أخشاب كريمية»), then
 *    nothing: an untranslated English word is never put in an Arabic sentence.
 *  - readableNotes: the notes a reply may show, cleaned, translated, without duplicates.
 * Pure and browser-safe.
 */

/** Common note names in Arabic (the catalogue publishes them in English). */
export const NOTE_AR: Record<string, string> = {
  musk: 'مسك', 'white musk': 'مسك أبيض', amber: 'عنبر', ambergris: 'عنبر رمادي', amberwood: 'خشب العنبر', ambroxan: 'أمبروكسان',
  vanilla: 'فانيليا', bergamot: 'برغموت', patchouli: 'باتشولي', jasmine: 'ياسمين', 'jasmine sambac': 'ياسمين سمبك', rose: 'ورد',
  'turkish rose': 'ورد تركي', 'bulgarian rose': 'ورد بلغاري', 'taif rose': 'ورد طائفي', sandalwood: 'صندل', cedarwood: 'خشب الأرز', cedar: 'أرز',
  lavender: 'لافندر', saffron: 'زعفران', 'tonka bean': 'تونكا', tonka: 'تونكا', cardamom: 'هيل', oud: 'عود', 'agarwood (oud)': 'عود',
  agarwood: 'عود', 'orange blossom': 'زهر البرتقال', vetiver: 'فيتيفر', 'pink pepper': 'فلفل وردي', 'black pepper': 'فلفل أسود',
  pepper: 'فلفل', lemon: 'ليمون', citrus: 'حمضيات', cinnamon: 'قرفة', leather: 'جلد', pear: 'كمثرى', grapefruit: 'جريب فروت',
  mandarin: 'يوسفي', 'mandarin orange': 'يوسفي', tangerine: 'يوسفي', ginger: 'زنجبيل', 'woody notes': 'نفحات خشبية', woods: 'أخشاب',
  apple: 'تفاح', caramel: 'كراميل', geranium: 'جيرانيوم', nutmeg: 'جوزة الطيب', pineapple: 'أناناس', mint: 'نعناع', raspberry: 'توت',
  spices: 'توابل', orange: 'برتقال', peach: 'خوخ', labdanum: 'لابدانوم', peony: 'فاوانيا', incense: 'بخور', violet: 'بنفسج',
  praline: 'برالين', blackcurrant: 'كشمش أسود', 'black currant': 'كشمش أسود', benzoin: 'جاوي', oakmoss: 'طحلب السنديان', moss: 'طحلب',
  iris: 'سوسن', orris: 'سوسن', tuberose: 'مسك الروم', coconut: 'جوز الهند', sage: 'مريمية', 'clary sage': 'مريمية', 'guaiac wood': 'خشب الغاياك',
  'lily of the valley': 'زنبق الوادي', 'white flowers': 'زهور بيضاء', 'floral notes': 'نفحات زهرية', 'ylang-ylang': 'يلانج يلانج',
  'red berries': 'توت أحمر', coffee: 'قهوة', fig: 'تين', honey: 'عسل', 'marine notes': 'نفحات بحرية', frankincense: 'لبان', olibanum: 'لبان',
  sugar: 'سكر', heliotrope: 'هليوتروب', myrrh: 'مر', cacao: 'كاكاو', neroli: 'نيرولي', cashmeran: 'كشميران', osmanthus: 'أوسمانثوس',
  birch: 'بتولا', tobacco: 'تبغ', mango: 'مانجو', lychee: 'ليتشي', litchi: 'ليتشي', juniper: 'عرعر', cherry: 'كرز', plum: 'برقوق',
  rosemary: 'إكليل الجبل', almond: 'لوز', 'bitter almond': 'لوز مر', strawberry: 'فراولة', lime: 'ليم', apricot: 'مشمش', hazelnut: 'بندق',
  freesia: 'فريزيا', rhubarb: 'راوند', gardenia: 'جاردينيا', magnolia: 'ماجنوليا', smoke: 'دخان', resin: 'راتنج', 'whipped cream': 'كريمة',
  marshmallow: 'مارشميلو', 'blood orange': 'برتقال أحمر', davana: 'دافانا', cypress: 'سرو', ambrette: 'بذور المسك',
};

/** Extra names the dictionary above lacks (the most frequent untranslated notes of the catalogue). */
const MORE_AR: Record<string, string> = {
  // From the store's own notes that had no Arabic name yet (catalogue scan 2026-10-26).
  balsam: 'بلسم', 'cade oil': 'زيت العرعر', mate: 'متة', 'bay leaf': 'ورق الغار', 'palo santo': 'بالو سانتو', florals: 'زهور', wood: 'خشب',
  'ambrette seed': 'بذور العنبريت', nectarine: 'نكتارين', pomegranate: 'رمان', cyclamen: 'بخور مريم', verbena: 'لويزة', oregano: 'أوريجانو',
  ozone: 'أوزون', 'pine tree': 'صنوبر', mahogany: 'ماهوجني', carnation: 'قرنفل', opoponax: 'أوبوبوناكس', papyrus: 'بردي', petitgrain: 'بيتيجرين',
  'rose water': 'ماء الورد', peppermint: 'نعناع فلفلي', yuzu: 'يوزو', angelica: 'حشيشة الملاك', immortelle: 'الخالدة', 'incense (olibanum)': 'بخور (لبان)',
  'vanilla bean extract': 'خلاصة الفانيليا', 'black vanilla husk': 'قشر الفانيليا السوداء', 'vanilla madagascar': 'فانيليا مدغشقر', 'aqueous accord': 'نفحات مائية',
  sapodilla: 'سابوتا', pitaya: 'فاكهة التنين', hedione: 'هيديون',
  thyme: 'زعتر', cumin: 'كمون', elemi: 'إليمي', rum: 'روم', dates: 'تمر', date: 'تمر', salt: 'ملح', 'sea salt': 'ملح البحر', basil: 'ريحان',
  cognac: 'كونياك', coriander: 'كزبرة', coumarin: 'كومارين', chocolate: 'شوكولاتة', 'dark chocolate': 'شوكولاتة داكنة', milk: 'حليب',
  'coconut milk': 'حليب جوز الهند', suede: 'شمواه', cassis: 'كشمش أسود', citron: 'أترج', fir: 'تنوب', 'fir balsam': 'بلسم التنوب',
  'passion fruit': 'فاكهة العاطفة', passionfruit: 'فاكهة العاطفة', pistachio: 'فستق', chestnut: 'كستناء', cocoa: 'كاكاو', lily: 'زنبق',
  orchid: 'أوركيد', hyacinth: 'سنبل', aldehydes: 'ألدهيدات', tea: 'شاي', 'green tea': 'شاي أخضر', 'black tea': 'شاي أسود', melon: 'شمام',
  licorice: 'عرق سوس', liquorice: 'عرق سوس', narcissus: 'نرجس', pimento: 'بهار', galbanum: 'قنّة', carrot: 'جزر', toffee: 'توفي',
  lotus: 'لوتس', caraway: 'كراوية', artemisia: 'شيح', mugwort: 'شيح', wormwood: 'شيح', rosewood: 'خشب الورد', 'brazilian rosewood': 'خشب الورد',
  lemongrass: 'حشيشة الليمون', berries: 'توت', 'star anise': 'ينسون نجمي', anise: 'ينسون', pomelo: 'بوملي', guava: 'جوافة', chamomile: 'بابونج',
  styrax: 'ميعة', 'juniper berries': 'حبات العرعر', 'juniper berry': 'حبات العرعر', 'violet leaf': 'ورق البنفسج', 'violet leaves': 'ورق البنفسج',
  'cashmere wood': 'خشب الكشمير', cashmere: 'كشمير', 'cotton candy': 'غزل البنات', driftwood: 'خشب البحر', 'coconut water': 'ماء جوز الهند',
  frangipani: 'فرانجيباني', 'oud wood': 'خشب العود', 'oud (agarwood)': 'عود', 'tobacco leaf': 'ورق التبغ', 'oak moss': 'طحلب السنديان',
  'may rose': 'ورد مايو', 'rose de mai': 'ورد مايو', 'bourbon vanilla': 'فانيليا بوربون', 'vanilla orchid': 'زهرة الفانيليا', 'fig leaf': 'ورق التين',
  'green apple': 'تفاح أخضر', 'red apple': 'تفاح أحمر', 'bitter orange': 'برتقال مر', 'orange flower': 'زهر البرتقال', 'lily-of-the-valley': 'زنبق الوادي',
  'water lily': 'زنبق الماء', 'egyptian jasmine': 'ياسمين مصري', sambac: 'ياسمين سمبك', 'italian lemon': 'ليمون إيطالي', 'calabrian bergamot': 'برغموت كالابريا',
  'sicilian orange': 'برتقال صقلي', 'virginia cedar': 'أرز فرجينيا', 'pink grapefruit': 'جريب فروت وردي', 'red currant': 'كشمش أحمر', 'sea breeze': 'نسيم البحر',
  'red fruits': 'فواكه حمراء', 'dried fruits': 'فواكه مجففة', fruits: 'فواكه', ylang: 'يلانج يلانج', 'clean musk': 'مسك نظيف', powder: 'بودرة',
  resins: 'راتنجات', 'gurjan balsam': 'بلسم الجورجان', gurjan: 'بلسم الجورجان', cypriol: 'سيبريول', akigalawood: 'أكيجالاوود', georgywood: 'جورجيوود',
  'iso e super': 'إيزو إي سوبر', vetyver: 'فيتيفر', 'tolu balsam': 'بلسم تولو', 'peru balsam': 'بلسم بيرو', clove: 'قرنفل', cloves: 'قرنفل',
  'white tea': 'شاي أبيض', bamboo: 'بامبو', 'black orchid': 'أوركيد أسود', truffle: 'كمأة', whiskey: 'ويسكي', wine: 'نبيذ', leaves: 'أوراق',
  // A family word left in the note list: said as the impression it gives.
  spicy: 'توابل', musky: 'مسك', woody: 'نفحات خشبية', floral: 'نفحات زهرية', fruity: 'نفحات فاكهية', sweet: 'نفحات حلوة', fresh: 'نفحات منعشة',
  powdery: 'نفحات بودرية', aromatic: 'أعشاب عطرية', citrusy: 'حمضيات', aquatic: 'نفحات بحرية', marine: 'نفحات بحرية', smoky: 'نفحات مدخّنة',
  leathery: 'جلد', gourmand: 'نفحات حلوة', oriental: 'نفحات شرقية', green: 'نفحات خضراء', 'white-floral': 'زهور بيضاء', 'white floral': 'زهور بيضاء',
};

/** «creamy woods», «warm spices», «fruity notes»: the noun and its describing word, in Arabic. */
const HEAD_AR: Record<string, string> = {
  woods: 'أخشاب', wood: 'خشب', florals: 'زهور', flowers: 'زهور', flower: 'زهور', spices: 'توابل', spice: 'توابل', fruits: 'فواكه', notes: 'نفحات',
  accords: 'نفحات', accord: 'نفحات', nuances: 'لمسات', herbs: 'أعشاب', amber: 'عنبر', musk: 'مسك', musks: 'مسك', vanilla: 'فانيليا', citrus: 'حمضيات',
  leather: 'جلد', resins: 'راتنجات', berries: 'توت', tea: 'شاي', rose: 'ورد', jasmine: 'ياسمين', oud: 'عود', patchouli: 'باتشولي', tobacco: 'تبغ',
};
/** The describing word, feminine (the plural nouns above take the feminine in Arabic) and masculine. */
const ADJ_AR: Record<string, [string, string]> = {
  soft: ['ناعمة', 'ناعم'], creamy: ['كريمية', 'كريمي'], dry: ['جافة', 'جاف'], smoky: ['مدخّنة', 'مدخّن'], warm: ['دافئة', 'دافئ'], light: ['خفيفة', 'خفيف'],
  fresh: ['منعشة', 'منعش'], sweet: ['حلوة', 'حلو'], clean: ['نظيفة', 'نظيف'], dark: ['داكنة', 'داكن'], green: ['خضراء', 'أخضر'], red: ['حمراء', 'أحمر'],
  black: ['سوداء', 'أسود'], white: ['بيضاء', 'أبيض'], aromatic: ['عطرية', 'عطري'], powdery: ['بودرية', 'بودري'], spicy: ['حارّة', 'حارّ'],
  fruity: ['فاكهية', 'فاكهي'], floral: ['زهرية', 'زهري'], woody: ['خشبية', 'خشبي'], woodsy: ['خشبية', 'خشبي'], ambery: ['عنبرية', 'عنبري'],
  amber: ['عنبرية', 'عنبري'], resinous: ['راتنجية', 'راتنجي'], balsamic: ['بلسمية', 'بلسمي'], herbal: ['عشبية', 'عشبي'], mineral: ['معدنية', 'معدني'],
  solar: ['شمسية', 'شمسي'], watery: ['مائية', 'مائي'], aquatic: ['بحرية', 'بحري'], sea: ['بحرية', 'بحري'], marine: ['بحرية', 'بحري'],
  citrus: ['حمضية', 'حمضي'], musky: ['مسكية', 'مسكي'], gourmand: ['حلوة', 'حلو'], oriental: ['شرقية', 'شرقي'], exotic: ['استوائية', 'استوائي'],
  tropical: ['استوائية', 'استوائي'], wild: ['برية', 'بري'], rich: ['غنية', 'غني'], deep: ['عميقة', 'عميق'], precious: ['ثمينة', 'ثمين'],
  sparkling: ['فوّارة', 'فوّار'], juicy: ['عصيرية', 'عصيري'], bitter: ['مُرّة', 'مُرّ'], salty: ['مالحة', 'مالح'], earthy: ['ترابية', 'ترابي'],
  leathery: ['جلدية', 'جلدي'], mossy: ['طحلبية', 'طحلبي'], velvety: ['مخملية', 'مخملي'], luminous: ['مضيئة', 'مضيء'],
};
const MASCULINE_HEAD = new Set(['خشب', 'عنبر', 'مسك', 'جلد', 'توت', 'شاي', 'ورد', 'ياسمين', 'عود', 'باتشولي', 'تبغ']);

/** A note without import artefacts: product-name fragments in capitals, sizes, quotes, «perfume notes», stray words. */
export function cleanNote(note: string): string {
  let n = String(note || '')
    .replace(/["“”«»]/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:ml|مل)(?![a-z\u0600-\u06FF])/gi, ' ')
    .replace(/\b(?:perfume|fragrance)?\s*notes?\s*:?\s*$/i, (m) => (/perfume|fragrance/i.test(m) ? ' ' : m))
    .replace(/\b(?:unisex|for (?:men|women|him|her)|pour (?:homme|femme)|edp|edt|parfum)\b/gi, ' ');
  // «Musky SUPREMACY PURPLE»: a run of capitalised words after a real note is the product's name, not a note.
  const words = n.split(/\s+/).filter(Boolean);
  const shout = (w: string) => w.length >= 3 && /^[A-Z0-9&'-]+$/.test(w) && /[A-Z]{3}/.test(w);
  if (words.some((w) => !shout(w))) n = words.filter((w) => !shout(w)).join(' ');
  return n.replace(/[()]\s*[()]/g, ' ').replace(/\s+/g, ' ').replace(/^[\s,،.:;-]+|[\s,،.:;-]+$/g, '').trim();
}

/** The note in Arabic, or undefined when he does not know it (never an English word inside an Arabic sentence). */
export function noteAr(note: string): string | undefined {
  const n = cleanNote(note).toLowerCase();
  if (!n || n.length < 2) return undefined;
  if (/^[\u0600-\u06FF\s]+$/.test(n)) return n;
  const direct = NOTE_AR[n] || MORE_AR[n];
  if (direct) return direct;
  const words = n.replace(/-/g, ' ').split(/\s+/);
  // «Turkish rose», «Indonesian patchouli»: the origin is a detail; the note itself is what the visitor smells.
  const last = words[words.length - 1];
  const lastAr = NOTE_AR[last] || MORE_AR[last] || HEAD_AR[last];
  if (words.length >= 2 && lastAr) {
    const adj = ADJ_AR[words[words.length - 2]];
    if (adj) return `${lastAr} ${MASCULINE_HEAD.has(lastAr) ? adj[1] : adj[0]}`;
    if (HEAD_AR[last] === 'نفحات' || HEAD_AR[last] === 'لمسات') return undefined;
    return lastAr;
  }
  return undefined;
}

/** The notes a reply may show: cleaned, translated (Arabic) or tidied (English), no repeats, at most `max`. */
export function readableNotes(notes: readonly string[], lang: 'ar' | 'en', max = 4): string[] {
  const out: string[] = [];
  for (const raw of notes) {
    const name = lang === 'ar' ? noteAr(raw) : cleanNote(raw);
    if (!name || name.length < 2 || /^notes?$/i.test(name)) continue;
    const pretty = lang === 'en' ? name.replace(/\b([a-z])/g, (c) => c.toUpperCase()) : name;
    if (!out.some((o) => o.toLowerCase() === pretty.toLowerCase())) out.push(pretty);
    if (out.length >= max) break;
  }
  return out;
}
