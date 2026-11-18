export type PostViolationCategory = 'explicit_sexual' | 'obscene_profanity';
export interface PostViolation { category: PostViolationCategory; ruleCode: string }

const cleanForReview = (text: string) => text.normalize('NFKC').toLowerCase()
  .replace(/[\u064B-\u065F\u0670\u0640]/gu, '')
  .replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ة/gu, 'ه')
  .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/gu, ' ')
  .replace(/\s+/gu, ' ').trim();

const explicitSexualTerms = [
  'porn', 'pornography', 'blowjob', 'handjob', 'gangbang', 'cocksucker', 'motherfucker', 'cunt', 'pussy',
  'اباحي', 'اباحيه', 'بورنو', 'سكس', 'قحبه', 'شرموط', 'شرموطه', 'متناك', 'منيوك', 'طيز', 'نيك', 'زب', 'كس',
];
const profanityTerms = ['fuck', 'fucking', 'fucked', 'shit', 'bitch', 'slut', 'whore', 'asshole', 'motherfucker', 'cunt'];

function hasTerm(text: string, term: string) {
  return text.split(/[^\p{L}\p{N}]+/u).includes(term);
}

/**
 * Conservative, on-server text checks for clearly explicit terms only. No post text is sent to an
 * outside model/provider. This is not image moderation, contextual understanding, or an exhaustive
 * abuse detector; ambiguous language is deliberately not auto-penalized.
 */
export function classifyCommunityPost(text: string): PostViolation | null {
  const normalized = cleanForReview(text);
  if (!normalized) return null;
  if (explicitSexualTerms.some((term) => hasTerm(normalized, cleanForReview(term)))) return { category: 'explicit_sexual', ruleCode: 'explicit_lexicon_v1' };
  if (profanityTerms.some((term) => hasTerm(normalized, term))) return { category: 'obscene_profanity', ruleCode: 'profanity_lexicon_v1' };
  return null;
}
