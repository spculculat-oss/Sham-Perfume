/**
 * «شارك في المجتمع» on every section of the site: share what you made here (the section's own result when it has
 * one) or ask the community about it. The share page itself lives in the community bundle (#community/share).
 */
import React, { useEffect, useReducer, useRef } from 'react';
import { HelpCircle, Share2, Users } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { pickArEn } from '../لغات/localize';
import { hasShareable, onShareablesChange, questionDraft, registerShareable, shareableFor, startShare, type ShareDraft } from '../community/share';

/** A section with its own state tells the share bar what it would share now (the latest draft is read on click). */
export function useShareable(source: string, draft: ShareDraft | null) {
  const latest = useRef(draft);
  latest.current = draft;
  useEffect(() => registerShareable(source, () => latest.current), [source]);
}

/** A small button for one thing (an answer of Shaheen, a formula sheet…). */
export function ShareToCommunityButton({ lang, getDraft, navigate, onShared, className = '', label }: {
  lang: SupportedLanguage; getDraft: () => ShareDraft | null; navigate?: (tab: string) => void; onShared?: () => void; className?: string; label?: string;
}) {
  const text = label || pickArEn(lang, 'شارك في المجتمع', 'Share to the community');
  return (
    <button type="button" data-testid="share-to-community" title={text}
      onClick={() => { const d = getDraft(); if (d && startShare(d, navigate)) onShared?.(); }}
      className={className || 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs font-bold hover:bg-amber-100 cursor-pointer'}>
      <Share2 className="w-3.5 h-3.5" /> {text}
    </button>
  );
}

/**
 * The bar under the breadcrumbs of a section. `fallback` is what the page itself knows (the current formula of the
 * calculator…); a section with its own state registers a richer draft (registerShareable) and wins.
 */
export function CommunityShareBar({ tab, lang, navigate, fallback }: {
  tab: string; lang: SupportedLanguage; navigate: (tab: string) => void; fallback?: () => ShareDraft | null;
}) {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => onShareablesChange(refresh), []);
  const made = () => shareableFor(tab) ?? fallback?.() ?? null;
  const canShare = hasShareable(tab) || Boolean(fallback);
  const t = (ar: string, en: string) => pickArEn(lang, ar, en);
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-white to-amber-50/60 px-3 py-2.5 print:hidden" data-testid="community-share-bar">
      <span className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold text-amber-950">
        <Users className="h-4 w-4 shrink-0 text-amber-700" />
        <span>{t('شارك اللي عملته هنا مع مجتمع شام — منشور أو نقاش أو يومية', 'Share what you made here with the Sham community — a post, a discussion or a story')}</span>
      </span>
      {canShare && (
        <button type="button" data-testid="share-bar-made" onClick={() => startShare(made() ?? questionDraft(tab, lang), navigate)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-900 cursor-pointer">
          <Share2 className="h-3.5 w-3.5" /> {t('شارك النتيجة', 'Share the result')}
        </button>
      )}
      <button type="button" data-testid="share-bar-ask" onClick={() => startShare(questionDraft(tab, lang), navigate)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-50 cursor-pointer">
        <HelpCircle className="h-3.5 w-3.5" /> {t('اسأل المجتمع', 'Ask the community')}
      </button>
    </div>
  );
}
