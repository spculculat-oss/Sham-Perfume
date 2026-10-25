/**
 * «تجارب الصفحات» (A/B tests) — Facebook never guesses which version of a page sells better: it shows two versions
 * to two halves of its visitors and reads the numbers. Here the same, within the law:
 *   - only a visitor who accepted «التحليل» is split between versions (and his version is recorded in his vault);
 *     everyone else sees the first version (the control) and nothing is recorded;
 *   - the split is stable (same visitor → same version), from his visitor id — no extra identifier;
 *   - both versions are honest: a test changes layout or wording, never a price, a promise or a scarcity claim;
 *   - the administration reads the results in «خزنة فهم الزوار» (src/utils/visitorInsights.ts → experimentResults),
 *     and no winner is called before each version has 30 people.
 */
import { visitorId } from './api';
import { analyticsAccepted, trackInsight } from './insightsTracker';

export const EXPERIMENTS = {
  /** How «اختبار ذوقك» is offered in the store: a full invitation card, or a small button beside the search. */
  quiz_prompt: ['card', 'chip'],
} as const;
export type ExperimentId = keyof typeof EXPERIMENTS;

/** FNV-1a: a stable, even split from a string. */
export function bucket(text: string, versions: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % versions;
}

const exposed = new Set<string>();

/** The version this visitor sees; the first (control) for anyone who has not accepted «التحليل». */
export function variantOf<T extends ExperimentId>(id: T): typeof EXPERIMENTS[T][number] {
  const versions = EXPERIMENTS[id];
  if (typeof window === 'undefined' || !analyticsAccepted()) return versions[0];
  const version = versions[bucket(`${visitorId()}:${id}`, versions.length)];
  if (!exposed.has(id)) { exposed.add(id); trackInsight('exp', { value: `${id}:${version}` }); }
  return version;
}
