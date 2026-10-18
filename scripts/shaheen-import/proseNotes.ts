/**
 * Notes a supplier wrote in prose («opens with apple and bergamot… in the heart rose… musk and amber define
 * the base»), read without AI. Shaheen never invents notes: every note returned is a known perfume material
 * that literally appears in the supplier's own text, in a sentence that says which layer it belongs to.
 * Anything uncertain is left out (a sentence with no layer word, a comparison with another perfume, a text
 * that names fewer than 3 notes) — an empty pyramid is better than a wrong one.
 */

/** Perfume materials (English, singular), multi-word ones first so «orange blossom» never reads as «orange». */
const MATERIALS = [
  'lily of the valley', 'orange blossom', 'orange flower', 'neroli', 'tonka bean', 'tonka', 'pink pepper', 'black pepper', 'white pepper', 'sichuan pepper',
  'star anise', 'green apple', 'red apple', 'blood orange', 'bitter orange', 'sweet orange', 'mandarin orange', 'pink grapefruit', 'black currant', 'blackcurrant',
  'red berries', 'wild berries', 'passion fruit', 'white musk', 'white flowers', 'white floral', 'sea salt', 'sea notes', 'marine notes', 'aquatic notes', 'ozonic notes',
  'green notes', 'green leaves', 'fig leaf', 'violet leaf', 'tea', 'green tea', 'black tea', 'cashmere wood', 'cashmeran', 'guaiac wood', 'cedar wood', 'cedarwood', 'sandal wood',
  'sandalwood', 'rosewood', 'driftwood', 'agarwood', 'oud', 'oudh', 'birch tar', 'birch', 'tobacco leaf', 'tobacco', 'coffee bean', 'coffee', 'cacao', 'cocoa', 'dark chocolate', 'chocolate',
  'praline', 'caramel', 'toffee', 'honey', 'brown sugar', 'sugar', 'cotton candy', 'marshmallow', 'almond', 'bitter almond', 'pistachio', 'hazelnut', 'chestnut', 'coconut', 'milk', 'cream',
  'rum', 'whiskey', 'cognac', 'wine', 'champagne', 'vanilla', 'bourbon vanilla', 'benzoin', 'labdanum', 'myrrh', 'frankincense', 'incense', 'olibanum', 'elemi', 'opoponax', 'styrax',
  'amber', 'ambergris', 'ambroxan', 'ambrette', 'musk', 'musks', 'civet', 'castoreum', 'leather', 'suede', 'oakmoss', 'moss', 'patchouli', 'vetiver', 'cypriol', 'papyrus', 'cedar', 'pine',
  'fir', 'cypress', 'juniper', 'juniper berries', 'bergamot', 'lemon', 'lime', 'grapefruit', 'mandarin', 'tangerine', 'orange', 'yuzu', 'citron', 'petitgrain', 'apple', 'pear', 'peach',
  'apricot', 'plum', 'cherry', 'raspberry', 'strawberry', 'blackberry', 'blueberry', 'pineapple', 'mango', 'melon', 'watermelon', 'lychee', 'litchi', 'pomegranate', 'fig', 'dates',
  'quince', 'banana', 'cassis', 'rhubarb', 'saffron', 'cardamom', 'cinnamon', 'clove', 'nutmeg', 'ginger', 'cumin', 'pepper', 'coriander', 'anise', 'licorice', 'liquorice', 'lavender',
  'rosemary', 'sage', 'clary sage', 'basil', 'mint', 'peppermint', 'thyme', 'artemisia', 'davana', 'geranium', 'violet', 'iris', 'orris', 'rose', 'damask rose', 'jasmine', 'sambac',
  'tuberose', 'gardenia', 'magnolia', 'peony', 'freesia', 'lily', 'lotus', 'orchid', 'ylang-ylang', 'ylang ylang', 'heliotrope', 'mimosa', 'osmanthus', 'frangipani', 'carnation',
  'cyclamen', 'hyacinth', 'narcissus', 'honeysuckle', 'lilac', 'cotton flower', 'cashmere', 'aldehydes', 'iso e super', 'galbanum', 'hay', 'tolu balsam', 'balsam', 'resins',
].sort((a, b) => b.length - a.length);

const NOTE = new RegExp(`\\b(${MATERIALS.map((m) => m.replace(/[-\s]/g, '[-\\s]')).join('|')})\\b`, 'gi');
/** Layer words → the layer the following notes belong to. */
const LAYERS: [RegExp, 'top' | 'heart' | 'base'][] = [
  [/\b(?:top(?: notes?)?|head notes?|opens?|opening|opener|starts?|begins?|introduces?|first impression|initial)\b/gi, 'top'],
  [/\b(?:heart(?: notes?)?|middle(?: notes?)?|cent(?:re|er)|core|mid-?notes?)\b/gi, 'heart'],
  [/\b(?:base(?: notes?)?|dry-?\s?down|drydown|finish(?:es)?|foundation|settles?|settling|lingers?|trail)\b/gi, 'base'],
];
/** A clause that compares with something else: its notes are not in this perfume. */
const COMPARISON = /\b(?:replacing|instead of|rather than|unlike|compared (?:to|with)|than|without|in place of|reminiscent of|like the original)\b[^,;.]*/gi;
const TITLE = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

export interface ProseNotes { top: string[]; heart: string[]; base: string[] }

export function proseNotes(text: string): ProseNotes {
  const out: ProseNotes = { top: [], heart: [], base: [] };
  const seen = new Set<string>();
  const sentences = (text || '').replace(/\s+/g, ' ').split(/(?<=[.!?;])\s+/);
  for (const raw of sentences) {
    const sentence = raw.replace(COMPARISON, ' ');
    const marks: { at: number; layer: keyof ProseNotes }[] = [];
    for (const [re, layer] of LAYERS) for (const m of sentence.matchAll(re)) marks.push({ at: m.index!, layer });
    if (!marks.length) continue;
    marks.sort((a, b) => a.at - b.at);
    for (const m of sentence.matchAll(NOTE)) {
      // The nearest layer word before the note, else the first one after it in the same sentence.
      const before = marks.filter((k) => k.at <= m.index!).at(-1);
      const layer = (before || marks[0]!).layer;
      const name = TITLE(m[1]!.replace(/-/g, ' ') === 'ylang ylang' ? 'ylang-ylang' : m[1]!);
      const key = name.toLowerCase().replace(/s$/, '');
      if (seen.has(key)) continue;
      seen.add(key);
      if (out[layer].length < 8) out[layer].push(name);
    }
  }
  const total = out.top.length + out.heart.length + out.base.length;
  const layers = [out.top, out.heart, out.base].filter((l) => l.length).length;
  return total >= 3 && layers >= 2 ? out : { top: [], heart: [], base: [] };
}
