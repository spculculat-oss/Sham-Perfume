/**
 * Wikimedia file titles often read like codes to a visitor: «Blackwell E 1750 pl 82 Rosa damascena 4500px»,
 * «Glass perfume bottle MET DP108895», «HK Soft drink … April 2019 SSG 08». This keeps the words a person
 * reads (Rosa damascena, Glass perfume bottle) and drops catalogue numbers, sizes, dates and short codes.
 * Used by the media server and again by the chat (older cached answers).
 */
const MONTHS = /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;
const KEEP_SHORT = /^(?:de|la|le|du|of|in|el|al|di|da|et|à)$/i;
const SYMBOL = /^[×&+]$/; // «Rosa × damascena»
const bare = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, '');

export function tidyCaption(title: string, fallback = ''): string {
  const words = title.replace(/[_]+/g, ' ').replace(/[-–](?=\d)/g, ' ').replace(/\s+/g, ' ').trim().split(' ')
    .map((w) => w.replace(/[-–]+$/, ''))
    .map((w) => w.replace(/\d+$/, (d) => (/\p{L}{3,}$/u.test(w.slice(0, -d.length)) ? '' : d))) // damascena5 → damascena
    .filter((w) => SYMBOL.test(w) || (bare(w) && !/\d/.test(w)))                  // DP108895, 4500px, 2015-05-14, 18.02
    .filter((w) => !/^\p{Lu}{2,5}$/u.test(bare(w)))            // MET, SSG, HK, (AM, PMMA
    .filter((w) => !MONTHS.test(bare(w)))
    .filter((w) => SYMBOL.test(w) || bare(w).length > 2 || KEEP_SHORT.test(bare(w)) || /[\u0600-\u06FF]/.test(w));
  // Drop dangling joiners left at the edges ("de", "-", "of").
  while (words.length && (KEEP_SHORT.test(words[0]) || /^[-–—,.()]+$/.test(words[0]))) words.shift();
  while (words.length && (KEEP_SHORT.test(words[words.length - 1]) || /^[-–—,.()]+$/.test(words[words.length - 1]))) words.pop();
  let out = words.join(' ');
  // An opening bracket whose content was all code: «Beaker, measuring (AM 1949.59-1)» → «Beaker, measuring».
  if ((out.match(/\(/g) || []).length > (out.match(/\)/g) || []).length) out = out.slice(0, out.lastIndexOf('('));
  out = out.replace(/\s+([,.)])/g, '$1').replace(/[(\[]\s*[)\]]/g, '').replace(/[\s,.;:–—-]+$/, '').trim();
  return (out.match(/\p{L}/gu) || []).length >= 4 ? out : fallback || out;
}

/**
 * Commons matches «oud» inside Dutch place names (Oud-Zevenaar, Oud-Beijerland): a topic word counts only
 * when it is not the first half of a capitalised hyphenated name (the second half stays: Damaszener-Rose → Rose).
 */
export const withoutPlaceCompounds = (title: string) => title.replace(/\p{Lu}\p{Ll}*-(?=\p{Lu})/gu, ' ');

const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3);
/** True when the searched topic appears in the title only inside such a place name (Oud-Zevenaar for «oud»). */
export function topicOnlyInPlaceName(title: string, topic: string): boolean {
  const wanted = words(topic);
  if (!wanted.length) return false;
  const inTitle = (t: string) => wanted.some((w) => words(t).includes(w));
  return inTitle(title) && !inTitle(withoutPlaceCompounds(title));
}
