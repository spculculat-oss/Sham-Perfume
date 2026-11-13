/**
 * «قسم المصممين — العطور»: the material bank behind the designer's lab simulation.
 *
 * For every material: the layer it lives in, its scent families, how long it lives on skin (hours, a rough
 * evaporation life), how strong it smells (impact), its density, the regulated constituents it carries (the EU
 * cosmetic allergens and the IFRA-restricted molecules, as typical fractions of the material) and, where there is
 * one, the material's own IFRA restriction for fine fragrance (Category 4, % of the finished product).
 *
 * Honest by design: the numbers are typical compositions and reference limits (IFRA Standards, 51st Amendment, and
 * the EU Cosmetics Regulation 1223/2009 Annex III). Where a limit is not certain the lab uses a CONSERVATIVE value and
 * says so. The binding numbers are always those of the supplier's IFRA certificate for the exact lot.
 */
import type { LText } from '../../لغات/localize';

export type Layer = 'top' | 'heart' | 'base';
export type ScentTag =
  | 'citrus' | 'fresh' | 'aromatic' | 'aquatic' | 'green' | 'spicy' | 'warm' | 'floral' | 'white' | 'rose' | 'powdery'
  | 'sweet' | 'gourmand' | 'woody' | 'oud' | 'amber' | 'oriental' | 'incense' | 'smoky' | 'leather' | 'musky' | 'clean'
  | 'earthy' | 'balsamic' | 'fruity' | 'fougere' | 'creamy';

/** EU-labelled fragrance allergens (the classic 26 of Annex III) the bank tracks inside materials. */
export type Allergen =
  | 'limonene' | 'linalool' | 'citral' | 'geraniol' | 'citronellol' | 'eugenol' | 'isoeugenol' | 'coumarin' | 'cinnamal'
  | 'farnesol' | 'benzyl_benzoate' | 'benzyl_salicylate' | 'benzyl_alcohol' | 'hydroxycitronellal' | 'bmhca' | 'hicc'
  | 'oakmoss' | 'alpha_isomethyl_ionone' | 'hexyl_cinnamal';

export const ALLERGEN_INCI: Record<Allergen, string> = {
  limonene: 'Limonene', linalool: 'Linalool', citral: 'Citral', geraniol: 'Geraniol', citronellol: 'Citronellol', eugenol: 'Eugenol',
  isoeugenol: 'Isoeugenol', coumarin: 'Coumarin', cinnamal: 'Cinnamal', farnesol: 'Farnesol', benzyl_benzoate: 'Benzyl Benzoate',
  benzyl_salicylate: 'Benzyl Salicylate', benzyl_alcohol: 'Benzyl Alcohol', hydroxycitronellal: 'Hydroxycitronellal',
  bmhca: 'Butylphenyl Methylpropional', hicc: 'Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde', oakmoss: 'Evernia Prunastri Extract',
  alpha_isomethyl_ionone: 'Alpha-Isomethyl Ionone', hexyl_cinnamal: 'Hexyl Cinnamal',
};

/**
 * IFRA limits of restricted constituents in fine fragrance (Category 4, % of the finished product). A material that
 * carries one is limited by it: limit ÷ fraction. «conservative» = the lab uses a stricter value than may apply.
 */
export const CONSTITUENT_LIMITS: Partial<Record<Allergen, { limit: number; conservative?: boolean }>> = {
  citral: { limit: 0.6 },
  isoeugenol: { limit: 0.2 },
  coumarin: { limit: 1.6 },
  cinnamal: { limit: 0.05, conservative: true },
  eugenol: { limit: 0.5, conservative: true },
};

export interface PerfumeMaterial {
  id: string;
  name: LText;
  /** How a designer may type it (Arabic, English, trade names). */
  names: RegExp;
  layer: Layer;
  tags: ScentTag[];
  /** Rough evaporation life on skin, hours. */
  life: number;
  /** Odour impact (1 = weak like Iso E Super, 50 = beta-damascenone). */
  strength: number;
  density: number;
  natural?: boolean;
  /** Typical regulated constituents, as fractions of the material. */
  has?: Partial<Record<Allergen, number>>;
  /** The material's own restriction (Category 4, % of the finished product). */
  ifra?: { limit: number; kind: 'restricted' | 'phototoxic' | 'prohibited'; conservative?: boolean; why: LText };
  /** A compliant alternative with the same role. */
  swap?: string;
  /** How the material appears in a store product's note list (for «يشبه إيه» in the store). */
  storeRe?: RegExp;
  /** A short honest note shown under the material (e.g. «the natural oil carries methyl eugenol»). */
  note?: LText;
}

const M = (m: PerfumeMaterial) => m;

export const PERFUME_MATERIALS: PerfumeMaterial[] = [
  // ── Top ──
  M({ id: 'bergamot', name: { ar: 'برغموت خالي من البيرجابتين (FCF)', en: 'Bergamot oil FCF' }, names: /برغموت|برجموت|bergamot(?!.*expressed)/i, layer: 'top', tags: ['citrus', 'fresh', 'aromatic'], life: 0.5, strength: 3, density: 0.88, natural: true, has: { limonene: 0.35, linalool: 0.1, citral: 0.005 }, storeRe: /bergamot/i }),
  M({ id: 'bergamot_expressed', name: { ar: 'برغموت معصور على البارد (فيه بيرجابتين)', en: 'Bergamot oil, expressed (not FCF)' }, names: /برغموت معصور|برغموت عادي|bergamot.*expressed|expressed bergamot/i, layer: 'top', tags: ['citrus', 'fresh'], life: 0.5, strength: 3, density: 0.88, natural: true, has: { limonene: 0.35, linalool: 0.1 }, ifra: { limit: 0.4, kind: 'phototoxic', why: { ar: 'فيه بيرجابتين (فوروكومارين) بيعمل حساسية للشمس على الجلد', en: 'contains bergapten (a furocoumarin) that makes skin react to sunlight' } }, swap: 'bergamot', storeRe: /bergamot/i }),
  M({ id: 'lemon', name: { ar: 'زيت الليمون المعصور', en: 'Lemon oil, expressed' }, names: /ليمون(?! ?جراس)|lemon(?!grass)/i, layer: 'top', tags: ['citrus', 'fresh'], life: 0.4, strength: 3, density: 0.85, natural: true, has: { limonene: 0.65, citral: 0.025 }, ifra: { limit: 2, kind: 'phototoxic', why: { ar: 'زيت الليمون المعصور فيه فوروكومارينات حساسة للشمس', en: 'expressed lemon oil carries sun-sensitising furocoumarins' } }, storeRe: /lemon/i }),
  M({ id: 'lime', name: { ar: 'زيت الليم المعصور', en: 'Lime oil, expressed' }, names: /(?<![\u0600-\u06FF])ليم(?![\u0600-\u06FF])|لايم|\blime\b/i, layer: 'top', tags: ['citrus', 'fresh', 'green'], life: 0.3, strength: 4, density: 0.86, natural: true, has: { limonene: 0.5, citral: 0.05 }, ifra: { limit: 0.7, kind: 'phototoxic', why: { ar: 'الليم المعصور من أقوى الحمضيات في الحساسية للشمس', en: 'expressed lime is one of the most sun-sensitising citrus oils' } }, storeRe: /lime/i }),
  M({ id: 'grapefruit', name: { ar: 'جريب فروت', en: 'Grapefruit oil' }, names: /جريب ?فروت|grapefruit/i, layer: 'top', tags: ['citrus', 'fresh'], life: 0.4, strength: 3, density: 0.85, natural: true, has: { limonene: 0.9 }, ifra: { limit: 4, kind: 'phototoxic', why: { ar: 'فيه فوروكومارينات بنسبة أقل من الليمون', en: 'carries furocoumarins, less than lemon' } }, storeRe: /grapefruit/i }),
  M({ id: 'orange', name: { ar: 'برتقال حلو', en: 'Sweet orange oil' }, names: /برتقال(?! ?زهر)(?!.*زهر)|orange(?! blossom)/i, layer: 'top', tags: ['citrus', 'fresh', 'fruity', 'sweet'], life: 0.4, strength: 2, density: 0.84, natural: true, has: { limonene: 0.94, linalool: 0.005 }, note: { ar: 'الليمونين بيتأكسد مع الوقت — ضيف مضاد أكسدة (فيتامين E) واحفظه بعيد عن الضوء.', en: 'Limonene oxidises with time — add an antioxidant (vitamin E) and keep away from light.' }, storeRe: /orange(?! blossom)/i }),
  M({ id: 'mandarin', name: { ar: 'يوسفي (ماندرين)', en: 'Mandarin oil' }, names: /يوسف|ماندرين|mandarin|tangerine/i, layer: 'top', tags: ['citrus', 'sweet', 'fresh', 'fruity'], life: 0.5, strength: 3, density: 0.85, natural: true, has: { limonene: 0.7 }, storeRe: /mandarin|tangerine/i }),
  M({ id: 'neroli', name: { ar: 'نيرولي', en: 'Neroli oil' }, names: /نيرولي|neroli/i, layer: 'top', tags: ['citrus', 'floral', 'fresh', 'white'], life: 0.8, strength: 5, density: 0.87, natural: true, has: { linalool: 0.4, limonene: 0.15, geraniol: 0.03, farnesol: 0.02 }, storeRe: /neroli/i }),
  M({ id: 'lavender', name: { ar: 'لافندر', en: 'Lavender oil' }, names: /لافندر|لافندير|خزامى|lavender|lavandin/i, layer: 'top', tags: ['aromatic', 'fresh', 'fougere', 'floral'], life: 1, strength: 3, density: 0.89, natural: true, has: { linalool: 0.35, limonene: 0.01, geraniol: 0.005, coumarin: 0.002 }, storeRe: /lavender/i }),
  M({ id: 'lemongrass', name: { ar: 'ليمون جراس (حشيشة الليمون)', en: 'Lemongrass oil' }, names: /ليمون ?جراس|حشيش[ةه] الليمون|lemongrass/i, layer: 'top', tags: ['citrus', 'green', 'fresh'], life: 0.6, strength: 5, density: 0.89, natural: true, has: { citral: 0.75, geraniol: 0.03, limonene: 0.02 }, storeRe: /lemongrass/i }),
  M({ id: 'pink_pepper', name: { ar: 'فلفل وردي', en: 'Pink pepper' }, names: /فلفل وردي|pink pepper/i, layer: 'top', tags: ['spicy', 'fresh', 'fruity'], life: 0.8, strength: 5, density: 0.85, natural: true, has: { limonene: 0.2 }, storeRe: /pink pepper/i }),
  M({ id: 'black_pepper', name: { ar: 'فلفل أسود', en: 'Black pepper oil' }, names: /فلفل(?! ?وردي)|black pepper|(?<!pink )pepper/i, layer: 'top', tags: ['spicy', 'woody', 'fresh'], life: 0.8, strength: 5, density: 0.87, natural: true, has: { limonene: 0.15, linalool: 0.01 }, storeRe: /black pepper/i }),
  M({ id: 'cardamom', name: { ar: 'هيل (حبهان)', en: 'Cardamom oil' }, names: /هيل|حبهان|cardamom/i, layer: 'top', tags: ['spicy', 'warm', 'aromatic', 'oriental'], life: 0.9, strength: 5, density: 0.92, natural: true, has: { linalool: 0.04, limonene: 0.03, geraniol: 0.01 }, storeRe: /cardamom/i }),
  M({ id: 'saffron', name: { ar: 'زعفران (أكورد)', en: 'Saffron accord' }, names: /زعفران|saffron/i, layer: 'top', tags: ['spicy', 'oriental', 'leather', 'warm'], life: 3, strength: 8, density: 0.98, storeRe: /saffron/i }),
  M({ id: 'apple', name: { ar: 'تفاح (أكورد)', en: 'Apple accord' }, names: /تفاح|apple/i, layer: 'top', tags: ['fruity', 'fresh', 'sweet', 'green'], life: 0.6, strength: 4, density: 0.95, storeRe: /apple/i }),
  M({ id: 'calone', name: { ar: 'كالون (نسمة البحر)', en: 'Calone' }, names: /كالون|calone|بحري|marine/i, layer: 'top', tags: ['aquatic', 'fresh', 'clean'], life: 2, strength: 20, density: 1.1, storeRe: /marine|aquatic|sea/i }),
  // ── Heart ──
  M({ id: 'rose', name: { ar: 'ورد طائفي / دمشقي (زيت)', en: 'Rose oil (Taif / damask)' }, names: /(?<!فلفل ?)ورد|روز|(?<!pink pepper )\brose\b/i, layer: 'heart', tags: ['floral', 'rose', 'oriental'], life: 4, strength: 4, density: 0.86, natural: true, has: { citronellol: 0.35, geraniol: 0.15, eugenol: 0.01, farnesol: 0.01, linalool: 0.01 }, note: { ar: 'زيت الورد الطبيعي فيه ميثيل يوجينول (مادة مقيدة) — اطلب شهادة IFRA من المورد.', en: 'Natural rose oil carries methyl eugenol (restricted) — ask the supplier for its IFRA certificate.' }, storeRe: /\brose\b/i }),
  M({ id: 'jasmine', name: { ar: 'ياسمين (أبسولوت)', en: 'Jasmine absolute' }, names: /ياسمين|(?<![\u0600-\u06FF])(?:و|ب|ل|لل|ال|بال|وال)?فل(?![\u0600-\u06FF])|jasmin/i, layer: 'heart', tags: ['floral', 'white', 'sweet'], life: 4, strength: 6, density: 0.95, natural: true, has: { benzyl_benzoate: 0.15, linalool: 0.05, benzyl_alcohol: 0.02, eugenol: 0.02, isoeugenol: 0.003, farnesol: 0.01 }, storeRe: /jasmine/i }),
  M({ id: 'orange_blossom', name: { ar: 'زهر البرتقال', en: 'Orange blossom absolute' }, names: /زهر البرتقال|زهر الليمون|orange blossom/i, layer: 'heart', tags: ['floral', 'white', 'fresh'], life: 3, strength: 5, density: 0.93, natural: true, has: { linalool: 0.3, geraniol: 0.02, farnesol: 0.03, benzyl_benzoate: 0.01 }, storeRe: /orange blossom/i }),
  M({ id: 'hedione', name: { ar: 'هيديون (إشراقة الياسمين)', en: 'Hedione' }, names: /هيديون|hedione|methyl dihydrojasmonate/i, layer: 'heart', tags: ['floral', 'fresh', 'clean'], life: 6, strength: 1, density: 1.0, storeRe: /jasmine|hedione/i }),
  M({ id: 'iris', name: { ar: 'سوسن (أوريس)', en: 'Iris (orris)' }, names: /سوسن|ايريس|إيريس|اوريس|iris|orris/i, layer: 'heart', tags: ['powdery', 'floral'], life: 8, strength: 3, density: 0.95, storeRe: /iris|orris/i }),
  M({ id: 'violet', name: { ar: 'بنفسج (أيونونات)', en: 'Violet (ionones)' }, names: /بنفسج|violet|ionone/i, layer: 'heart', tags: ['powdery', 'floral', 'green'], life: 3, strength: 4, density: 0.93, has: { alpha_isomethyl_ionone: 0.3 }, storeRe: /violet/i }),
  M({ id: 'ylang', name: { ar: 'يلانج يلانج', en: 'Ylang-ylang oil' }, names: /يلانج|ylang/i, layer: 'heart', tags: ['floral', 'white', 'sweet'], life: 4, strength: 5, density: 0.94, natural: true, has: { linalool: 0.15, benzyl_benzoate: 0.08, benzyl_salicylate: 0.04, farnesol: 0.03, geraniol: 0.01, isoeugenol: 0.005 }, storeRe: /ylang/i }),
  M({ id: 'geranium', name: { ar: 'جيرانيوم (عطرة)', en: 'Geranium oil' }, names: /جيرانيوم|عطرة|geranium/i, layer: 'heart', tags: ['floral', 'green', 'rose', 'aromatic'], life: 3, strength: 4, density: 0.89, natural: true, has: { citronellol: 0.3, geraniol: 0.15, linalool: 0.05, citral: 0.01 }, storeRe: /geranium/i }),
  M({ id: 'clary_sage', name: { ar: 'مريمية (كلاري سيج)', en: 'Clary sage oil' }, names: /مريمي|sage/i, layer: 'heart', tags: ['aromatic', 'green', 'fresh'], life: 2, strength: 4, density: 0.9, natural: true, has: { linalool: 0.15 }, storeRe: /sage/i }),
  M({ id: 'frankincense', name: { ar: 'لبان حوجري', en: 'Frankincense (Hojari)' }, names: /لبان|بخور|frankincense|olibanum|incense/i, layer: 'heart', tags: ['incense', 'smoky', 'oriental', 'fresh'], life: 3, strength: 4, density: 0.88, natural: true, has: { limonene: 0.15 }, storeRe: /frankincense|olibanum|incense/i }),
  M({ id: 'cinnamon', name: { ar: 'قرفة (زيت اللحاء)', en: 'Cinnamon bark oil' }, names: /قرف[ةه]|cinnamon/i, layer: 'heart', tags: ['spicy', 'warm', 'gourmand', 'oriental'], life: 3, strength: 7, density: 1.03, natural: true, has: { cinnamal: 0.65, eugenol: 0.07, linalool: 0.03, benzyl_benzoate: 0.01 }, storeRe: /cinnamon/i }),
  M({ id: 'clove', name: { ar: 'قرنفل (زيت البراعم)', en: 'Clove bud oil' }, names: /قرنفل|clove/i, layer: 'heart', tags: ['spicy', 'warm', 'oriental'], life: 4, strength: 6, density: 1.05, natural: true, has: { eugenol: 0.85 }, storeRe: /clove/i }),
  M({ id: 'coffee', name: { ar: 'قهوة', en: 'Coffee' }, names: /قهو[ةه]|(?<![\u0600-\u06FF])(?:و|ب|ل|لل|ال|بال|وال)?بن(?![\u0600-\u06FF])|coffee/i, layer: 'heart', tags: ['gourmand', 'warm', 'smoky'], life: 3, strength: 5, density: 0.98, storeRe: /coffee/i }),
  M({ id: 'cashmeran', name: { ar: 'كشميران', en: 'Cashmeran' }, names: /كشميران|cashmeran/i, layer: 'heart', tags: ['woody', 'musky', 'warm', 'creamy'], life: 10, strength: 4, density: 0.96, ifra: { limit: 3.8, kind: 'restricted', why: { ar: 'مقيد في معيار IFRA للفئة 4', en: 'restricted by the IFRA standard for Category 4' } }, storeRe: /cashmeran|cashmere/i }),
  M({ id: 'damascenone', name: { ar: 'بيتا داماسينون (كيتون الورد)', en: 'beta-Damascenone' }, names: /داماسينون|داماسكون|damascenone|damascone/i, layer: 'heart', tags: ['rose', 'fruity', 'floral'], life: 6, strength: 50, density: 0.95, ifra: { limit: 0.043, kind: 'restricted', why: { ar: 'كيتونات الورد مقيدة جداً في IFRA لأنها بتسبب تحسس', en: 'rose ketones are tightly restricted by IFRA as sensitisers' } }, storeRe: /\brose\b/i }),
  M({ id: 'ethyl_maltol', name: { ar: 'إيثيل مالتول (سكر مكرمل)', en: 'Ethyl maltol' }, names: /مالتول|maltol|غزل البنات|cotton candy/i, layer: 'heart', tags: ['gourmand', 'sweet', 'fruity'], life: 10, strength: 8, density: 1.15, storeRe: /caramel|sugar|candy/i }),
  M({ id: 'linalool', name: { ar: 'لينالول', en: 'Linalool' }, names: /لينالول|linalool/i, layer: 'heart', tags: ['floral', 'fresh', 'aromatic'], life: 1, strength: 2, density: 0.86, has: { linalool: 1 } }),
  // ── Base ──
  M({ id: 'oud', name: { ar: 'عود (دهن / أكورد)', en: 'Oud' }, names: /عود|oud|agarwood/i, layer: 'base', tags: ['oud', 'woody', 'smoky', 'oriental', 'warm'], life: 24, strength: 8, density: 0.98, storeRe: /oud|agarwood/i }),
  M({ id: 'sandalwood', name: { ar: 'صندل', en: 'Sandalwood' }, names: /صندل|sandal/i, layer: 'base', tags: ['woody', 'creamy', 'warm'], life: 20, strength: 2, density: 0.97, storeRe: /sandalwood/i }),
  M({ id: 'cedar', name: { ar: 'خشب الأرز', en: 'Cedarwood' }, names: /ارز|أرز|سيدر|cedar/i, layer: 'base', tags: ['woody', 'fresh', 'aromatic'], life: 12, strength: 2, density: 0.95, natural: true, storeRe: /cedar/i }),
  M({ id: 'vetiver', name: { ar: 'نجيل الهند (فيتيفر)', en: 'Vetiver oil' }, names: /نجيل|فيتيفر|vetiver/i, layer: 'base', tags: ['woody', 'earthy', 'smoky', 'fresh'], life: 20, strength: 4, density: 0.99, natural: true, storeRe: /vetiver/i }),
  M({ id: 'patchouli', name: { ar: 'باتشولي', en: 'Patchouli oil' }, names: /باتشول|patchouli/i, layer: 'base', tags: ['earthy', 'woody', 'oriental'], life: 20, strength: 5, density: 0.96, natural: true, storeRe: /patchouli/i }),
  M({ id: 'amber', name: { ar: 'عنبر (أكورد لابدانوم وبنزوين)', en: 'Amber accord' }, names: /عنبر|امبر(?!وكسان)|أمبر(?!وكسان)|\bamber\b/i, layer: 'base', tags: ['amber', 'warm', 'oriental', 'sweet', 'balsamic'], life: 18, strength: 3, density: 1.0, has: { benzyl_benzoate: 0.05 }, storeRe: /\bamber\b/i }),
  M({ id: 'vanilla', name: { ar: 'فانيليا / فانيلين', en: 'Vanilla / vanillin' }, names: /فانيل|vanill/i, layer: 'base', tags: ['gourmand', 'sweet', 'warm', 'balsamic'], life: 20, strength: 6, density: 1.06, note: { ar: 'الفانيلين بيغمّق لون العطر مع التعتيق — طبيعي ومش عيب.', en: 'Vanillin darkens the perfume as it matures — natural, not a defect.' }, storeRe: /vanilla/i }),
  M({ id: 'tonka', name: { ar: 'تونكا (أبسولوت)', en: 'Tonka bean absolute' }, names: /تونكا|tonka/i, layer: 'base', tags: ['gourmand', 'sweet', 'warm', 'fougere'], life: 16, strength: 4, density: 1.0, natural: true, has: { coumarin: 0.4 }, storeRe: /tonka/i }),
  M({ id: 'coumarin', name: { ar: 'كومارين', en: 'Coumarin' }, names: /كومارين|coumarin/i, layer: 'base', tags: ['sweet', 'fougere', 'warm', 'powdery'], life: 14, strength: 3, density: 0.94, has: { coumarin: 1 }, storeRe: /tonka|coumarin/i }),
  M({ id: 'musk', name: { ar: 'مسك أبيض (مسكات حديثة)', en: 'White musk' }, names: /(?<!جالاكسوليد )مسك(?! امبريت)|white musk|\bmusk\b(?! ambrette)/i, layer: 'base', tags: ['musky', 'clean', 'powdery'], life: 30, strength: 2, density: 1.0, storeRe: /musk/i }),
  M({ id: 'galaxolide', name: { ar: 'جالاكسوليد (مسك نظيف)', en: 'Galaxolide' }, names: /جالاكسوليد|galaxolide|hhcb/i, layer: 'base', tags: ['musky', 'clean', 'floral'], life: 30, strength: 2, density: 1.0, ifra: { limit: 4.3, kind: 'restricted', conservative: true, why: { ar: 'مقيد في IFRA (حد مرجعي محافظ)', en: 'restricted by IFRA (a conservative reference limit)' } }, storeRe: /musk/i }),
  M({ id: 'ambroxan', name: { ar: 'أمبروكسان', en: 'Ambroxan' }, names: /امبروكسان|أمبروكسان|ambrox(?!.*super)/i, layer: 'base', tags: ['amber', 'woody', 'clean', 'fresh'], life: 30, strength: 6, density: 0.94, storeRe: /ambrox|ambergris/i }),
  M({ id: 'cetalox', name: { ar: 'سيتالوكس (أمبروكس سوبر)', en: 'Cetalox' }, names: /سيتالوكس|cetalox|ambrox super/i, layer: 'base', tags: ['amber', 'woody', 'clean'], life: 36, strength: 7, density: 0.94, storeRe: /ambrox|ambergris/i }),
  M({ id: 'iso_e', name: { ar: 'إيزو إي سوبر', en: 'Iso E Super' }, names: /ايزو|إيزو|iso ?e/i, layer: 'base', tags: ['woody', 'clean'], life: 14, strength: 1.5, density: 0.96, ifra: { limit: 21.4, kind: 'restricted', why: { ar: 'مقيد في IFRA للفئة 4 بحد 21.4% من المنتج النهائي', en: 'restricted by IFRA to 21.4% of the finished Category 4 product' } }, storeRe: /iso e|woody notes/i }),
  M({ id: 'leather', name: { ar: 'جلد (أكورد)', en: 'Leather accord' }, names: /جلد|ليذر|leather/i, layer: 'base', tags: ['leather', 'smoky', 'warm'], life: 14, strength: 6, density: 0.98, storeRe: /leather/i }),
  M({ id: 'tobacco', name: { ar: 'تبغ (أكورد)', en: 'Tobacco accord' }, names: /تبغ|دخان|توباكو|tobacco/i, layer: 'base', tags: ['warm', 'sweet', 'smoky'], life: 12, strength: 5, density: 0.98, storeRe: /tobacco/i }),
  M({ id: 'myrrh', name: { ar: 'مر (مُر)', en: 'Myrrh' }, names: /(?<![\u0600-\u06FF])(?:و|ال|وال|بال)?مر(?![\u0600-\u06FF])|مُر|myrrh/i, layer: 'base', tags: ['incense', 'balsamic', 'oriental'], life: 16, strength: 4, density: 1.0, natural: true, storeRe: /myrrh/i }),
  M({ id: 'evernyl', name: { ar: 'إيفرنيل (بديل طحلب السنديان)', en: 'Evernyl (oakmoss alternative)' }, names: /ايفرنيل|إيفرنيل|evernyl|veramoss|بديل طحلب/i, layer: 'base', tags: ['earthy', 'green', 'woody'], life: 18, strength: 5, density: 1.05, storeRe: /moss/i }),
  M({ id: 'oakmoss', name: { ar: 'طحلب السنديان الطبيعي', en: 'Oakmoss absolute' }, names: /طحلب(?! بديل)|oakmoss|oak moss|treemoss|شيبر|chypre/i, layer: 'base', tags: ['earthy', 'green', 'woody'], life: 16, strength: 5, density: 1.0, natural: true, has: { oakmoss: 1 }, ifra: { limit: 0.1, kind: 'restricted', why: { ar: 'طحلب السنديان الطبيعي مقيد بشدة (أترانول وكلورأترانول بيسببوا تحسس)', en: 'natural oakmoss is tightly restricted (atranol and chloroatranol are strong sensitisers)' } }, swap: 'evernyl', storeRe: /moss/i }),
  // ── Prohibited (kept so a designer who writes them gets a clear, honest answer) ──
  M({ id: 'lilial', name: { ar: 'ليليال (BMHCA) — ممنوع', en: 'Lilial (BMHCA) — prohibited' }, names: /ليليال|lilial|bmhca|butylphenyl methylpropional/i, layer: 'heart', tags: ['floral', 'clean'], life: 6, strength: 3, density: 0.95, has: { bmhca: 1 }, ifra: { limit: 0, kind: 'prohibited', why: { ar: 'ممنوع في الاتحاد الأوروبي من 2022 (مصنف سام للإنجاب CMR) ومحظور في IFRA', en: 'banned in the EU since 2022 (classified toxic for reproduction, CMR) and prohibited by IFRA' } }, swap: 'hedione' }),
  M({ id: 'lyral', name: { ar: 'ليرال (HICC) — ممنوع', en: 'Lyral (HICC) — prohibited' }, names: /ليرال|lyral|hicc/i, layer: 'heart', tags: ['floral', 'white'], life: 8, strength: 3, density: 1.0, has: { hicc: 1 }, ifra: { limit: 0, kind: 'prohibited', why: { ar: 'ممنوع في IFRA والاتحاد الأوروبي لأنه مسبب قوي للحساسية', en: 'prohibited by IFRA and the EU as a strong allergen' } }, swap: 'hedione' }),
  M({ id: 'musk_ambrette', name: { ar: 'مسك أمبريت (نيترو مسك) — ممنوع', en: 'Musk ambrette (nitro musk) — prohibited' }, names: /مسك امبريت|musk ambrette|nitro ?musk/i, layer: 'base', tags: ['musky', 'powdery'], life: 30, strength: 3, density: 1.0, ifra: { limit: 0, kind: 'prohibited', why: { ar: 'ممنوع (حساسية ضوئية وسمية عصبية)', en: 'prohibited (photosensitisation and neurotoxicity)' } }, swap: 'musk' }),
  M({ id: 'peru_balsam', name: { ar: 'بلسم بيرو الخام — ممنوع', en: 'Crude Peru balsam — prohibited' }, names: /بلسم بيرو|peru balsam|balsam peru/i, layer: 'base', tags: ['balsamic', 'sweet', 'warm'], life: 18, strength: 4, density: 1.15, ifra: { limit: 0, kind: 'prohibited', why: { ar: 'الخام ممنوع في IFRA (مسبب حساسية) — المسموح المستخلصات المعالجة فقط', en: 'the crude balsam is prohibited by IFRA (sensitiser); only treated extracts are allowed' } }, swap: 'amber' }),
];

const BY_ID = new Map(PERFUME_MATERIALS.map((m) => [m.id, m]));
export const perfumeMaterial = (id: string): PerfumeMaterial | undefined => BY_ID.get(id);

/** A designer's typed name → the bank's material (the most specific match wins), or undefined. */
export function findPerfumeMaterial(text: string): PerfumeMaterial | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const exact = PERFUME_MATERIALS.find((m) => m.id === t || m.name.ar === t || m.name.en.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  // Specific names first: «برغموت معصور» before «برغموت», «ليمون جراس» before «ليمون», «مسك امبريت» before «مسك».
  const hits = PERFUME_MATERIALS.filter((m) => m.names.test(t));
  return hits.sort((a, b) => specificity(b, t) - specificity(a, t))[0];
}
const specificity = (m: PerfumeMaterial, t: string) => {
  const match = t.match(m.names);
  return (match?.[0].length || 0) + (m.ifra?.kind === 'prohibited' ? 0.5 : 0);
};

export const TAG_LABEL: Record<ScentTag, LText> = {
  citrus: { ar: 'حمضي', en: 'Citrus' }, fresh: { ar: 'منعش', en: 'Fresh' }, aromatic: { ar: 'عطري عشبي', en: 'Aromatic' },
  aquatic: { ar: 'مائي بحري', en: 'Aquatic' }, green: { ar: 'أخضر', en: 'Green' }, spicy: { ar: 'توابل', en: 'Spicy' },
  warm: { ar: 'دافئ', en: 'Warm' }, floral: { ar: 'زهري', en: 'Floral' }, white: { ar: 'زهور بيضاء', en: 'White floral' },
  rose: { ar: 'وردي', en: 'Rosy' }, powdery: { ar: 'بودري', en: 'Powdery' }, sweet: { ar: 'حلو', en: 'Sweet' },
  gourmand: { ar: 'جورماند', en: 'Gourmand' }, woody: { ar: 'خشبي', en: 'Woody' }, oud: { ar: 'عود', en: 'Oud' },
  amber: { ar: 'عنبري', en: 'Amber' }, oriental: { ar: 'شرقي', en: 'Oriental' }, incense: { ar: 'بخوري', en: 'Incense' },
  smoky: { ar: 'مدخّن', en: 'Smoky' }, leather: { ar: 'جلدي', en: 'Leather' }, musky: { ar: 'مسكي', en: 'Musky' },
  clean: { ar: 'نظيف', en: 'Clean' }, earthy: { ar: 'ترابي', en: 'Earthy' }, balsamic: { ar: 'بلسمي', en: 'Balsamic' },
  fruity: { ar: 'فاكهي', en: 'Fruity' }, fougere: { ar: 'فوجير', en: 'Fougère' }, creamy: { ar: 'كريمي', en: 'Creamy' },
};

export const LAYER_LABEL: Record<Layer, LText> = { top: { ar: 'القمة', en: 'Top' }, heart: { ar: 'القلب', en: 'Heart' }, base: { ar: 'القاعدة', en: 'Base' } };
