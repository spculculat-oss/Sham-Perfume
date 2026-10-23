/**
 * «مكتبة خامات التجميل» — the cosmetic ingredient library behind the cosmetics formulator.
 *
 * Numbers only (role, phase, usual range, hard maximum, flags); every word a visitor reads about an ingredient lives in
 * src/لغات/cosmeticsL10n.ts (COSMETIC_INGREDIENT_TEXT, keyed by the same id) so it reaches every site language.
 *
 * The ranges follow the common practice of small-batch cosmetic formulation and the published limits where there is
 * one (e.g. phenoxyethanol ≤ 1 % in the EU Cosmetics Regulation 1223/2009 Annex V). They are conservative on purpose:
 * this is a teaching tool for home and workshop batches, never a licence to sell an untested product.
 */

export type CosmeticRole =
  | 'solvent' | 'humectant' | 'soothing' | 'active' | 'thickener' | 'chelator'
  | 'oil' | 'butter' | 'wax' | 'fatty_alcohol' | 'emulsifier' | 'surfactant'
  | 'antioxidant' | 'preservative' | 'ph_adjuster' | 'essential_oil';

/** Where it goes in a process: A = heated water phase, B = heated oil phase, C = cool-down (below 40 °C). */
export type CosmeticPhase = 'A' | 'B' | 'C';

export interface CosmeticIngredient {
  id: string;
  /** International (INCI) name, the one printed on labels. */
  inci: string;
  role: CosmeticRole;
  phase: CosmeticPhase;
  /** The usual use level, % w/w. */
  typical: [number, number];
  /** The level never exceeded by the formulator (leave-on use). */
  max: number;
  /** Lower ceiling for leave-on face products when it differs. */
  faceMax?: number;
  /** Heat-sensitive: always added at cool-down. */
  heatSensitive?: boolean;
  /** Known allergen / sensitiser: kept out of «sensitive skin» formulas. */
  sensitiser?: boolean;
  /** Tree-nut origin: flagged for nut allergies. */
  nut?: boolean;
  /** Clogs pores for many acne-prone faces: kept out of oily/acne face formulas. */
  comedogenic?: boolean;
}

const I = (
  id: string, inci: string, role: CosmeticRole, phase: CosmeticPhase, typical: [number, number], max: number,
  extra: Partial<CosmeticIngredient> = {},
): CosmeticIngredient => ({ id, inci, role, phase, typical, max, ...extra });

export const COSMETIC_INGREDIENTS: CosmeticIngredient[] = [
  // ── Water phase ──
  I('water', 'Aqua (distilled water)', 'solvent', 'A', [40, 85], 95),
  I('rose_water', 'Rosa Damascena Flower Water', 'solvent', 'A', [5, 30], 50),
  I('aloe', 'Aloe Barbadensis Leaf Juice', 'soothing', 'A', [5, 20], 50),
  I('glycerin', 'Glycerin', 'humectant', 'A', [2, 5], 10),
  I('propanediol', 'Propanediol', 'humectant', 'A', [2, 5], 10),
  I('hyaluronic', 'Sodium Hyaluronate (powder)', 'humectant', 'A', [0.1, 0.5], 1),
  I('allantoin', 'Allantoin', 'soothing', 'A', [0.1, 0.5], 0.5),
  I('xanthan', 'Xanthan Gum', 'thickener', 'A', [0.2, 0.5], 1),
  I('phytate', 'Sodium Phytate', 'chelator', 'A', [0.05, 0.1], 0.2),
  I('decyl_glucoside', 'Decyl Glucoside (≈50 % active)', 'surfactant', 'A', [10, 25], 30),
  I('betaine', 'Cocamidopropyl Betaine (≈30 % active)', 'surfactant', 'A', [5, 15], 20),
  // ── Oil phase ──
  I('jojoba', 'Simmondsia Chinensis Seed Oil', 'oil', 'B', [2, 15], 100),
  I('argan', 'Argania Spinosa Kernel Oil', 'oil', 'B', [2, 10], 100, { nut: true }),
  I('almond', 'Prunus Amygdalus Dulcis Oil', 'oil', 'B', [3, 15], 100, { nut: true }),
  I('squalane', 'Squalane (plant)', 'oil', 'B', [2, 10], 100),
  I('grapeseed', 'Vitis Vinifera Seed Oil', 'oil', 'B', [2, 15], 100),
  I('rosehip', 'Rosa Canina Fruit Oil', 'oil', 'B', [1, 5], 20, { heatSensitive: true }),
  I('olive', 'Olea Europaea Fruit Oil', 'oil', 'B', [2, 10], 100, { comedogenic: true }),
  I('cct', 'Caprylic/Capric Triglyceride', 'oil', 'B', [2, 15], 100),
  I('castor', 'Ricinus Communis Seed Oil', 'oil', 'B', [5, 20], 40),
  I('black_seed', 'Nigella Sativa Seed Oil', 'oil', 'B', [0.5, 3], 5, { sensitiser: true }),
  I('shea', 'Butyrospermum Parkii Butter', 'butter', 'B', [2, 10], 70, { nut: true }),
  I('cocoa', 'Theobroma Cacao Seed Butter', 'butter', 'B', [2, 10], 40, { comedogenic: true }),
  I('mango', 'Mangifera Indica Seed Butter', 'butter', 'B', [2, 10], 40),
  I('beeswax', 'Cera Alba', 'wax', 'B', [15, 30], 35),
  I('candelilla', 'Euphorbia Cerifera Cera', 'wax', 'B', [8, 15], 20),
  I('cetyl', 'Cetyl Alcohol', 'fatty_alcohol', 'B', [1, 3], 5),
  I('olive_emulsifier', 'Cetearyl Olivate, Sorbitan Olivate', 'emulsifier', 'B', [3, 6], 8),
  I('ewax', 'Cetearyl Alcohol, Polysorbate 60', 'emulsifier', 'B', [4, 7], 10),
  // ── Cool-down ──
  I('panthenol', 'Panthenol (pro-vitamin B5)', 'soothing', 'C', [1, 5], 5),
  I('niacinamide', 'Niacinamide (vitamin B3)', 'active', 'C', [2, 5], 10, { faceMax: 5 }),
  I('zinc_pca', 'Zinc PCA', 'active', 'C', [0.1, 1], 1),
  I('urea', 'Urea', 'humectant', 'C', [2, 5], 10, { faceMax: 5 }),
  I('bisabolol', 'Bisabolol', 'soothing', 'C', [0.1, 1], 1),
  I('vitamin_e', 'Tocopherol (vitamin E)', 'antioxidant', 'C', [0.2, 1], 1),
  I('preservative', 'Phenoxyethanol, Ethylhexylglycerin', 'preservative', 'C', [0.5, 1], 1),
  I('citric', 'Citric Acid (10 % solution)', 'ph_adjuster', 'C', [0, 0.5], 1),
  I('lavender', 'Lavandula Angustifolia Oil', 'essential_oil', 'C', [0.1, 0.5], 1, { faceMax: 0.5, sensitiser: true }),
  I('tea_tree', 'Melaleuca Alternifolia Leaf Oil', 'essential_oil', 'C', [0.2, 0.5], 1, { faceMax: 0.5, sensitiser: true }),
];

const BY_ID = new Map(COSMETIC_INGREDIENTS.map((x) => [x.id, x]));
export const cosmeticIngredient = (id: string): CosmeticIngredient => {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`unknown cosmetic ingredient: ${id}`);
  return found;
};

/** The roles in the order the library shows them. */
export const COSMETIC_ROLES: CosmeticRole[] = [
  'solvent', 'humectant', 'soothing', 'active', 'thickener', 'chelator', 'oil', 'butter', 'wax', 'fatty_alcohol',
  'emulsifier', 'surfactant', 'antioxidant', 'preservative', 'ph_adjuster', 'essential_oil',
];
