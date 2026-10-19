/**
 * «المترجم الذكي» — one run of the AI translation (engines injected, so tests run without any network).
 * Honest by construction: nothing is ever filled with English or a guess; a string waits for the next
 * run until an engine translates it and the checks (and the reviewer, when there is one) accept it.
 */
import { createHash } from 'node:crypto';
import type { TranslationSection } from './audit';
import {
  glossaryFor, mergePack, missingFor, planWork, readReview, readTranslations, reviewPrompt, reviewSystem, translatePrompt,
  translateSystem, type AiPackFile, type TextUnit,
} from './translator';

type Ask = (system: string, prompt: string) => Promise<string>;
export interface SmartDeps {
  languages: readonly { code: string; name: string; nativeName: string }[];
  units: readonly TextUnit[];
  own: (lang: string, unit: TextUnit) => string | undefined;
  readPack: (lang: string) => AiPackFile;
  writePack: (lang: string, pack: AiPackFile) => void;
  /** Absent = no engine configured. */
  ask?: Ask;
  /** A second opinion (another engine when there is one). */
  review?: Ask;
  engines: string[];
  usedEngines?: () => string[];
  priority: readonly string[];
  maxCalls: number;
  deadline: number;
  now: () => number;
  previous?: TranslationSection;
  glossary?: (lang: string) => [string, string][];
  guidance?: string;
}

const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 10);
const rejectKey = (lang: string, u: TextUnit) => `${lang}|${u.pack}|${hash(u.key)}`;

function measure(deps: SmartDeps, rejectCounts: Record<string, number>) {
  const gaps: Record<string, TextUnit[]> = {};
  let remaining = 0; let covered = 0;
  const byTier: Record<string, number> = { 1: 0, 2: 0, 3: 0 };
  for (const { code } of deps.languages) {
    if (code === 'ar' || code === 'en') continue;
    const pack = deps.readPack(code);
    for (const p of ['ui', 'store', 'text'] as const) covered += Object.keys(pack[p] || {}).length;
    const missing = missingFor(code, deps.units, (u) => deps.own(code, u), pack);
    remaining += missing.length;
    for (const u of missing) byTier[u.tier] += 1;
    gaps[code] = missing.filter((u) => (rejectCounts[rejectKey(code, u)] || 0) < 2);
  }
  return { gaps, remaining, covered, byTier };
}

export async function smartTranslate(deps: SmartDeps): Promise<TranslationSection> {
  const at = new Date(deps.now()).toISOString();
  const rejectCounts: Record<string, number> = { ...(deps.previous?.rejectCounts || {}) };
  const rejectReasons: Record<string, number> = {};
  const run: TranslationSection['run'] = { calls: 0, translated: 0, rejected: 0, droppedByReview: 0, reviewed: false, engines: [], languages: [] };
  const before = measure(deps, rejectCounts);
  let status: TranslationSection['status'] = before.remaining ? 'budget' : 'idle';

  if (before.remaining && deps.maxCalls <= 0) status = 'off';
  else if (before.remaining && !deps.ask) status = 'no_engine';
  else if (before.remaining && deps.ask) {
    const names = new Map(deps.languages.map((l) => [l.code, l]));
    const order = deps.languages.map((l) => l.code);
    const work = planWork(before.gaps, order, deps.priority);
    status = work.length ? 'budget' : 'idle';
    let finished = true;
    for (const item of work) {
      if (run.calls >= deps.maxCalls || deps.now() > deps.deadline) { finished = false; break; }
      const info = names.get(item.lang)!;
      try {
        run.calls++;
        const reply = await deps.ask(translateSystem(info.name, info.nativeName, item.lang, deps.guidance || ''), translatePrompt(item.units, deps.glossary?.(item.lang) || []));
        let { accepted, rejected } = readTranslations(item.lang, item.units, reply);
        // A second opinion drops what a reviewer rejects; an unreadable review is not a verdict.
        if (accepted.length && deps.review && run.calls < deps.maxCalls) {
          try {
            run.calls++;
            const bad = readReview(await deps.review(reviewSystem(info.name), reviewPrompt(accepted.map((a) => ({ en: a.unit.en, text: a.text })))), accepted.length);
            if (bad) {
              run.reviewed = true;
              const dropped = accepted.filter((_, i) => bad.has(i));
              accepted = accepted.filter((_, i) => !bad.has(i));
              run.droppedByReview += dropped.length;
              rejected = [...rejected, ...dropped.map((a) => ({ unit: a.unit, reason: 'review' }))];
            }
          } catch (error) {
            if ((error as Error).name === 'QuotaExhaustedError') throw error;
            // The reviewer failed: the strict checks already passed, keep the batch.
          }
        }
        if (accepted.length) {
          deps.writePack(item.lang, mergePack(deps.readPack(item.lang), accepted));
          run.translated += accepted.length;
          if (!run.languages.includes(item.lang)) run.languages.push(item.lang);
        }
        for (const r of rejected) {
          run.rejected++;
          rejectReasons[r.reason] = (rejectReasons[r.reason] || 0) + 1;
          const key = rejectKey(item.lang, r.unit);
          rejectCounts[key] = (rejectCounts[key] || 0) + 1;
        }
      } catch (error) {
        finished = false;
        const e = error as Error & { resumeAt?: number };
        if (e.name === 'QuotaExhaustedError') { status = 'quota'; if (e.resumeAt) run.resumeAt = new Date(e.resumeAt).toISOString(); }
        else status = 'engines_failed';
        break;
      }
    }
    // done = this run translated something (or finished everything); budget = time/calls ran out first.
    if (status === 'budget' && (finished || run.translated)) status = 'done';
  }

  run.engines = deps.usedEngines?.() || [];
  const after = measure(deps, rejectCounts);
  // Keep the set-aside list small: only units still missing.
  const pruned = Object.fromEntries(Object.entries(rejectCounts).slice(-3000));
  return {
    at, status, remaining: after.remaining, covered: after.covered, remainingByTier: after.byTier,
    worstLanguages: Object.entries(after.gaps).map(([lang, g]) => ({ lang, remaining: g.length })).filter((x) => x.remaining)
      .sort((a, b) => b.remaining - a.remaining).slice(0, 8),
    run, rejectReasons, rejectCounts: pruned,
  };
}

export { glossaryFor };
