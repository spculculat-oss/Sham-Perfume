/**
 * «تدقيق شاهين للغات والتصميم» — the brief and the result format of the weekly site audit that Shaheen
 * hands to his background agent (Manus). Pure functions: tests/shaheenManus.test.ts.
 */
import { SUPPORTED_LANGUAGES, type LanguageConfig } from '../../src/types/i18n';

export const SITE_URL = 'https://spculculat-oss.github.io/Sham-Perfume/';
export const AREAS = ['languages', 'design', 'store', 'shaheen', 'performance'] as const;
export const SEVERITIES = ['high', 'medium', 'low'] as const;

export interface AuditIssue {
  area: (typeof AREAS)[number];
  severity: (typeof SEVERITIES)[number];
  language: string;
  page: string;
  problem: string;
  fix: string;
}
export interface AuditResult { summaryAr: string; score: number; issues: AuditIssue[]; strengthsAr: string[] }
export interface AuditFile {
  version: 1;
  updatedAt: string;
  languages: string[];
  status: 'done' | 'running' | 'failed';
  taskId?: string;
  credits?: number;
  summaryAr?: string;
  score?: number;
  issues: AuditIssue[];
  strengthsAr: string[];
  history: { at: string; score?: number; issues: number; languages: string[] }[];
}

/** Arabic and English every week, plus 3 more languages in rotation (one right-to-left when there is one). */
export function languagesForWeek(week: number, all: LanguageConfig[] = SUPPORTED_LANGUAGES): string[] {
  const others = all.filter((l) => l.code !== 'ar' && l.code !== 'en');
  if (!others.length) return ['ar', 'en'];
  const rtl = others.filter((l) => l.dir === 'rtl');
  const ltr = others.filter((l) => l.dir !== 'rtl');
  const pick = (list: LanguageConfig[], n: number, offset: number) =>
    Array.from({ length: Math.min(n, list.length) }, (_, i) => list[(week * n + i + offset) % list.length].code);
  const chosen = rtl.length ? [...pick(ltr, 2, 0), ...pick(rtl, 1, 0)] : pick(ltr, 3, 0);
  return ['ar', 'en', ...new Set(chosen)];
}

export const weekNumber = (date: Date) => Math.floor(date.getTime() / (7 * 24 * 3600 * 1000));

const str = { type: 'string' } as const;
/** Manus structured output: every object closed, every property required. */
export const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    summaryAr: { type: 'string', description: 'Two or three sentences in Arabic: the overall state of the site languages and design.' },
    score: { type: 'integer', description: '0-100 overall quality of languages + design.' },
    strengthsAr: { type: 'array', items: str, description: 'Up to 5 things that work well, in Arabic.' },
    issues: {
      type: 'array',
      description: 'Concrete problems found, most important first (at most 25).',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string', enum: [...AREAS] },
          severity: { type: 'string', enum: [...SEVERITIES] },
          language: { type: 'string', description: 'Language code where it appears (e.g. "ar", "fr"), or "all".' },
          page: { type: 'string', description: 'Where: section/page name or URL hash.' },
          problem: { type: 'string', description: 'What is wrong, in Arabic, quoting the visible text when useful.' },
          fix: { type: 'string', description: 'The exact fix to apply, in Arabic (the corrected text for translations).' },
        },
        required: ['area', 'severity', 'language', 'page', 'problem', 'fix'],
        additionalProperties: false,
      },
    },
  },
  required: ['summaryAr', 'score', 'strengthsAr', 'issues'],
  additionalProperties: false,
};

export function auditPrompt(languages: string[], previous?: AuditFile): string {
  const names = languages.map((c) => {
    const l = SUPPORTED_LANGUAGES.find((x) => x.code === c);
    return l ? `${l.code} (${l.name}, ${l.dir})` : c;
  }).join(', ');
  const open = previous?.issues?.filter((i) => i.severity !== 'low').slice(0, 8).map((i) => `- [${i.language}] ${i.page}: ${i.problem}`) || [];
  return [
    `You are the quality auditor of "Sham Perfume" (${SITE_URL}), a perfume store and perfume-making tools site.`,
    'Open the live site in a real browser (desktop width and a phone width of ~390px) and audit the LANGUAGES and the DESIGN.',
    `Languages to check this week: ${names}. Change the language with the site's language switcher (it is saved in the browser).`,
    'For every language check: untranslated or mixed-language text, wrong or awkward translations, text cut off or overflowing,',
    'right-to-left/left-to-right direction (Arabic and other RTL languages must read right-to-left with mirrored layout),',
    'numbers, prices and units shown correctly, and buttons/menus that keep working.',
    'Design: layout breaks, overlapping elements, unreadable contrast, broken images, inconsistent fonts/colours, the phone layout.',
    'Visit at least: the home page, the store (open one product), the perfume calculator tools, and the expert chat button (just open it; do not send many messages).',
    'Rules: do not buy anything, do not fill any order or contact form, do not create accounts. Be concrete: name the page and quote the visible text.',
    'Write summaryAr, problem, fix and strengthsAr in Arabic. Keep brand and product names as they are.',
    open.length ? `Last week these problems were open; say if each one is still there:\n${open.join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Keeps only well-formed issues, trimmed — the agent's output is data, never trusted as-is. */
export function cleanAudit(raw: unknown): AuditResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const issues = (Array.isArray(r.issues) ? r.issues : []).flatMap((x): AuditIssue[] => {
    if (!x || typeof x !== 'object') return [];
    const i = x as Record<string, unknown>;
    const area = AREAS.includes(i.area as AuditIssue['area']) ? (i.area as AuditIssue['area']) : 'design';
    const severity = SEVERITIES.includes(i.severity as AuditIssue['severity']) ? (i.severity as AuditIssue['severity']) : 'low';
    const problem = clip(i.problem, 400);
    if (!problem) return [];
    return [{ area, severity, language: clip(i.language, 12) || 'all', page: clip(i.page, 120), problem, fix: clip(i.fix, 400) }];
  }).slice(0, 25);
  const score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
  const summaryAr = clip(r.summaryAr, 600);
  if (!summaryAr && !issues.length) return undefined;
  return { summaryAr, score, issues, strengthsAr: (Array.isArray(r.strengthsAr) ? r.strengthsAr : []).map((s) => clip(s, 200)).filter(Boolean).slice(0, 5) };
}

export function nextAuditFile(previous: AuditFile | undefined, run: { at: string; languages: string[]; status: AuditFile['status']; taskId?: string; credits?: number; result?: AuditResult }): AuditFile {
  const base: AuditFile = previous ?? { version: 1, updatedAt: '', languages: [], status: 'failed', issues: [], strengthsAr: [], history: [] };
  if (!run.result) {
    // A failed or unfinished run keeps the last good report.
    return { ...base, updatedAt: run.at, status: run.status, taskId: run.taskId ?? base.taskId };
  }
  return {
    version: 1, updatedAt: run.at, languages: run.languages, status: 'done', taskId: run.taskId, credits: run.credits,
    summaryAr: run.result.summaryAr, score: run.result.score, issues: run.result.issues, strengthsAr: run.result.strengthsAr,
    history: [...base.history, { at: run.at, score: run.result.score, issues: run.result.issues.length, languages: run.languages }].slice(-26),
  };
}
