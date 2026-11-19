import React, { useMemo, useState } from 'react';
import {
  BookOpen, Check, ChevronDown, ChevronUp, Code2, Copy, ExternalLink,
  FileText, Globe, Hash, ListChecks, Maximize2, Mic, Radio, Sparkles, Table2, Volume2, X,
} from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { formatLocalizedNumber } from '../لغات/numerals';
import { ShaheenMarkdown } from '../components/ShaheenMarkdown';
import { previewDocument, type CodeBlock } from './codeBlocks';
import { CodeCard, PreviewFrame } from './CodeCard';
import { ExportMenu } from './ExportMenu';
import { SignedImage } from './SignedImage';
import { extractLiveInfo, matchSpokenSegment, spokenProgress, type LiveSource } from './liveInfo';
import { wsText } from './strings';
import type { WsSource } from './workspaceApi';

export type LivePanelTab = 'brief' | 'canvas' | 'sources';

export interface LiveDisplayState {
  text: string;
  sources: WsSource[];
  image?: string;
  streaming: boolean;
  stage: string;
  spokenText: string;
  interimSpeech: string;
  voiceActive: boolean;
  focusedCode?: CodeBlock | null;
}

/** Compact inline web-source pills (shows domain + title the instant sources arrive). */
export function SourcePills({ sources, lang, onOpenAll }: {
  sources: readonly WsSource[];
  lang: SupportedLanguage;
  onOpenAll?: () => void;
}) {
  const enriched = useMemo<LiveSource[]>(() => extractLiveInfo('', sources).sources, [sources]);
  if (!enriched.length) return null;
  const visible = enriched.slice(0, 4);
  const rest = enriched.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label={wsText(lang, 'sources')}>
      <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--ws-muted)]">
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        {wsText(lang, 'sources')}
      </span>
      {visible.map((s) => (
        <a
          key={`${s.index}-${s.url}`}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          role="listitem"
          title={s.title}
          className="sham-ws-card-in group inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-[var(--ws-border)] bg-[var(--ws-surface)] px-2.5 py-1 text-[11.5px] text-[var(--ws-ink-soft)] transition hover:border-[var(--ws-border-strong)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)]"
        >
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--ws-hover)] text-[10px] font-bold text-[var(--ws-muted)] group-hover:bg-[var(--ws-cta-bg)] group-hover:text-[var(--ws-cta-ink)]">
            {formatLocalizedNumber(lang, s.index)}
          </span>
          <span className="truncate font-medium">{s.domain}</span>
        </a>
      ))}
      {(rest > 0 || onOpenAll) && onOpenAll && (
        <button
          type="button"
          onClick={onOpenAll}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--ws-border)] bg-transparent px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ws-muted)] transition hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
        >
          {rest > 0 ? `+${formatLocalizedNumber(lang, rest)}` : wsText(lang, 'show_details')}
        </button>
      )}
    </div>
  );
}

/** Smooth shimmer stage line while Shaheen searches, thinks, draws or writes. */
export function LiveStageIndicator({ stage, sourceCount = 0, lang }: {
  stage: string;
  sourceCount?: number;
  lang: SupportedLanguage;
}) {
  if (!stage) return null;
  return (
    <div
      className="inline-flex flex-wrap items-center gap-2 py-1 text-[13.5px] font-medium"
      data-testid="ws-writing"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="sham-ws-shimmer font-medium">{stage}</span>
      {sourceCount > 0 && (
        <span className="rounded-full border border-[var(--ws-border)] bg-[var(--ws-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ws-muted)]">
          {formatLocalizedNumber(lang, sourceCount)} {wsText(lang, 'sources')}
        </span>
      )}
    </div>
  );
}

/**
 * Companion board displayed directly under the live voice stage (or while reading a reply aloud):
 * shows the visitor's live words, the exact sentence Shaheen is saying, extracted figures, key points
 * highlighted in sync with his voice, tables, images and sources — so talking shows everything visually.
 */
export function VoiceLiveInfoBoard({ lang, state, onOpenFullPanel }: {
  lang: SupportedLanguage;
  state: LiveDisplayState;
  onOpenFullPanel?: (tab?: LivePanelTab) => void;
}) {
  const w = (k: Parameters<typeof wsText>[1]) => wsText(lang, k);
  const [collapsed, setCollapsed] = useState(false);
  const info = useMemo(
    () => extractLiveInfo(state.text, state.sources, state.image),
    [state.text, state.sources, state.image],
  );
  const activePoint = useMemo(
    () => matchSpokenSegment(info.keyPoints, state.spokenText),
    [info.keyPoints, state.spokenText],
  );
  const progress = useMemo(
    () => spokenProgress(state.text, state.spokenText),
    [state.text, state.spokenText],
  );

  const hasContent = Boolean(
    state.interimSpeech.trim()
    || state.stage
    || state.spokenText.trim()
    || info.keyPoints.length
    || info.facts.length
    || info.tables.length
    || info.sources.length
    || info.image
    || info.codeBlocks.length,
  );
  if (!hasContent) return null;

  const rtl = lang === 'ar' || lang === 'fa';
  const htmlBlock = info.codeBlocks.find((b) => b.runnable === 'html');

  return (
    <section
      data-testid="ws-voice-live-info"
      aria-label={w('voice_board_title')}
      className="sham-ws-card-in overflow-hidden rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-elevated)] shadow-sm"
    >
      {/* Top status strip */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ws-border)] bg-[var(--ws-surface)] px-3.5 py-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ws-ink)]">
          <Radio className={`h-3.5 w-3.5 ${state.streaming || state.spokenText ? 'text-emerald-500 motion-safe:animate-pulse' : 'text-[var(--ws-muted)]'}`} aria-hidden="true" />
          {w('voice_board_title')}
        </span>
        {(state.spokenText || state.streaming) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-600">
            {state.spokenText ? <Volume2 className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
            {state.spokenText ? w('live_speaking_now') : w('live_streaming_now')}
          </span>
        )}
        <span className="flex-1" />
        {onOpenFullPanel && (
          <button
            type="button"
            onClick={() => onOpenFullPanel(htmlBlock ? 'canvas' : 'brief')}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--ws-muted)] transition hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
          >
            <Maximize2 className="h-3 w-3" />
            <span className="hidden sm:inline">{w('live_panel')}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--ws-muted)] transition hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          <span>{collapsed ? w('show_details') : w('hide_details')}</span>
        </button>
      </div>

      {/* Live spoken progress bar */}
      {progress > 0 && (
        <div className="h-0.5 w-full bg-[var(--ws-border)]" aria-hidden="true">
          <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      {!collapsed && (
        <div className="space-y-3 p-3.5">
          {/* Live interim speech transcript while the visitor is talking */}
          {state.interimSpeech.trim() && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-[var(--ws-speak-bg)] px-3 py-2" aria-live="polite">
              <Mic className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 motion-safe:animate-pulse" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-semibold text-[var(--ws-muted)]">{w('live_you_saying')}</p>
                <p dir="auto" className="text-[14px] font-medium leading-relaxed text-[var(--ws-ink)]">
                  {state.interimSpeech}
                  <span className="sham-ws-caret" aria-hidden="true" />
                </p>
              </div>
            </div>
          )}

          {/* Stage shimmer while thinking/searching during voice conversation */}
          {state.streaming && state.stage && !state.text.trim() && (
            <div className="px-1">
              <span className="sham-ws-shimmer text-[13px] font-medium">{state.stage}</span>
            </div>
          )}

          {/* Key quantitative figures at a glance */}
          {info.facts.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {info.facts.slice(0, 3).map((fact, idx) => (
                <div key={`${fact.value}-${idx}`} className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface)] px-3 py-2">
                  <p dir="auto" className="text-[15px] font-bold tabular-nums text-[var(--ws-ink)]">{fact.value}</p>
                  <p dir="auto" className="mt-0.5 line-clamp-1 text-[11px] text-[var(--ws-muted)]">{fact.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Key points highlighted sentence-by-sentence as Shaheen speaks */}
          {info.keyPoints.length > 0 && (
            <ul className="space-y-1.5">
              {info.keyPoints.slice(0, 5).map((point, idx) => {
                const speaking = idx === activePoint;
                return (
                  <li
                    key={idx}
                    data-speaking={speaking || undefined}
                    className={`flex items-start gap-2 rounded-xl px-2.5 py-1.5 text-[13.5px] leading-relaxed transition ${
                      speaking
                        ? 'border-s-2 border-emerald-500 bg-[var(--ws-speak-bg)] font-medium text-[var(--ws-ink)]'
                        : 'text-[var(--ws-ink-soft)]'
                    }`}
                  >
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${speaking ? 'bg-emerald-500 motion-safe:animate-ping' : 'bg-[var(--ws-muted)]'}`} aria-hidden="true" />
                    <span dir="auto" className="flex-1">{point}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* First extracted comparison/data table */}
          {info.tables[0] && (
            <div className="sham-ws-table-wrap">
              <table className="sham-ws-table min-w-full border-collapse">
                <thead>
                  <tr>{info.tables[0].headers.map((h, i) => <th key={i} className="text-start">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {info.tables[0].rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Live HTML preview or generated image if part of the spoken reply */}
          {htmlBlock && (
            <PreviewFrame html={previewDocument(htmlBlock, rtl)} title={w('preview')} height={220} />
          )}
          {info.image && (
            <SignedImage src={info.image} lang={lang} />
          )}

          {/* Live clickable sources */}
          {info.sources.length > 0 && (
            <SourcePills
              sources={state.sources}
              lang={lang}
              onOpenAll={onOpenFullPanel ? () => onOpenFullPanel('sources') : undefined}
            />
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Split-screen Live Info & Canvas side panel (side-by-side on desktop, smooth drawer on mobile):
 * updates continuously as Shaheen streams text, searches sources, writes code or speaks aloud.
 */
export function LiveInfoPanel({ lang, state, tab, onTab, onClose, onOpenEditor }: {
  lang: SupportedLanguage;
  state: LiveDisplayState;
  tab: LivePanelTab;
  onTab: (tab: LivePanelTab) => void;
  onClose: () => void;
  onOpenEditor: (block: CodeBlock) => void;
}) {
  const w = (k: Parameters<typeof wsText>[1]) => wsText(lang, k);
  const [copied, setCopied] = useState(false);
  const info = useMemo(
    () => extractLiveInfo(state.text, state.sources, state.image),
    [state.text, state.sources, state.image],
  );
  const activePoint = useMemo(
    () => matchSpokenSegment(info.keyPoints, state.spokenText),
    [info.keyPoints, state.spokenText],
  );
  const progress = useMemo(
    () => spokenProgress(state.text, state.spokenText),
    [state.text, state.spokenText],
  );
  const rtl = lang === 'ar' || lang === 'fa';
  const previewBlock = state.focusedCode?.runnable === 'html'
    ? state.focusedCode
    : info.codeBlocks.find((b) => b.runnable === 'html');

  const copyAll = () => {
    if (!state.text.trim()) return;
    void navigator.clipboard?.writeText(state.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }, () => undefined);
  };

  const tabs: Array<{ id: LivePanelTab; label: string; Icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { id: 'brief', label: w('live_tab_brief'), Icon: ListChecks },
    { id: 'canvas', label: w('live_tab_canvas'), Icon: info.codeBlocks.length ? Code2 : FileText, badge: info.codeBlocks.length || undefined },
    { id: 'sources', label: w('sources'), Icon: BookOpen, badge: info.sources.length || undefined },
  ];

  const empty = !state.text.trim() && !info.sources.length && !state.interimSpeech.trim() && !state.stage;

  return (
    <aside
      data-testid="ws-live-panel"
      aria-label={w('live_panel')}
      className="flex h-full flex-col border-s border-[var(--ws-border)] bg-[var(--ws-bg)] text-[var(--ws-ink)]"
    >
      {/* Panel header */}
      <div className="flex items-center gap-2 border-b border-[var(--ws-border)] px-4 py-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${state.streaming || state.spokenText || state.interimSpeech ? 'bg-emerald-500 motion-safe:animate-pulse' : 'bg-[var(--ws-muted)]/50'}`} aria-hidden="true" />
        <h3 className="truncate text-[13.5px] font-semibold text-[var(--ws-ink)]">{info.title || w('live_panel')}</h3>
        <span className="flex-1" />
        {(state.spokenText || state.streaming) && (
          <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-600">
            {state.spokenText ? w('live_speaking_now') : w('live_streaming_now')}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          title={w('close')}
          aria-label={w('close')}
          className="grid h-7 w-7 place-items-center rounded-lg text-[var(--ws-muted)] transition hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Live reading progress */}
      {progress > 0 && (
        <div className="h-0.5 w-full bg-[var(--ws-border)]" aria-hidden="true">
          <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Segmented sub-tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--ws-border)] bg-[var(--ws-surface)] px-3 py-1.5" role="tablist">
        {tabs.map(({ id, label, Icon, badge }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition cursor-pointer ${
                active
                  ? 'bg-[var(--ws-elevated)] text-[var(--ws-ink)] shadow-xs ring-1 ring-[var(--ws-border)]'
                  : 'text-[var(--ws-muted)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-ink)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
              {badge ? (
                <span className="rounded-full bg-[var(--ws-hover)] px-1.5 text-[10px] font-bold tabular-nums text-[var(--ws-ink-soft)]">
                  {formatLocalizedNumber(lang, badge)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Panel body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {empty ? (
          <div className="flex h-full min-h-[14rem] flex-col items-center justify-center px-4 text-center">
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface)] text-[var(--ws-muted)]">
              <Radio className="h-5 w-5" />
            </span>
            <p className="text-[13.5px] font-semibold text-[var(--ws-ink)]">{w('live_panel')}</p>
            <p className="mt-1 max-w-xs text-[12.5px] leading-relaxed text-[var(--ws-muted)]">{w('live_empty')}</p>
          </div>
        ) : tab === 'brief' ? (
          <>
            {/* Live user voice words */}
            {state.interimSpeech.trim() && (
              <div className="rounded-2xl border border-emerald-500/30 bg-[var(--ws-speak-bg)] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                  <Mic className="h-3.5 w-3.5 motion-safe:animate-pulse" />
                  {w('live_you_saying')}
                </p>
                <p dir="auto" className="mt-1 text-[13.5px] font-medium text-[var(--ws-ink)]">
                  {state.interimSpeech}
                  <span className="sham-ws-caret" aria-hidden="true" />
                </p>
              </div>
            )}

            {/* Currently spoken sentence spotlight */}
            {state.spokenText.trim() && (
              <div className="rounded-2xl border border-emerald-500/30 bg-[var(--ws-speak-bg)] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                  <Volume2 className="h-3.5 w-3.5" />
                  {w('live_speaking_now')}
                </p>
                <p dir="auto" className="mt-1 text-[13.5px] leading-relaxed text-[var(--ws-ink)]">{state.spokenText}</p>
              </div>
            )}

            {/* Streaming stage indicator */}
            {state.streaming && state.stage && (
              <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface)] px-3 py-2">
                <span className="sham-ws-shimmer text-[12.5px] font-medium">{state.stage}</span>
              </div>
            )}

            {/* Prominent figures */}
            {info.facts.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ws-muted)]">
                  <Hash className="h-3.5 w-3.5" />
                  {w('live_key_facts')}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {info.facts.map((fact, idx) => (
                    <div key={`${fact.value}-${idx}`} className="sham-ws-card-in rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface)] p-2.5">
                      <p dir="auto" className="text-[16px] font-bold tabular-nums text-[var(--ws-ink)]">{fact.value}</p>
                      <p dir="auto" className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[var(--ws-muted)]">{fact.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key points synced with speech & stream */}
            {info.keyPoints.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ws-muted)]">
                  <ListChecks className="h-3.5 w-3.5" />
                  {w('live_key_points')}
                </h4>
                <ul className="space-y-1.5">
                  {info.keyPoints.map((point, idx) => {
                    const speaking = idx === activePoint;
                    return (
                      <li
                        key={idx}
                        data-speaking={speaking || undefined}
                        className={`sham-ws-card-in flex items-start gap-2.5 rounded-xl border px-3 py-2 text-[13px] leading-relaxed transition ${
                          speaking
                            ? 'border-emerald-500/50 bg-[var(--ws-speak-bg)] font-medium text-[var(--ws-ink)]'
                            : 'border-[var(--ws-border)] bg-[var(--ws-surface)] text-[var(--ws-ink-soft)]'
                        }`}
                      >
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--ws-hover)] text-[10.5px] font-bold tabular-nums text-[var(--ws-muted)]">
                          {formatLocalizedNumber(lang, idx + 1)}
                        </span>
                        <span dir="auto" className="flex-1">{point}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Data tables */}
            {info.tables.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ws-muted)]">
                  <Table2 className="h-3.5 w-3.5" />
                  {w('live_tables')}
                </h4>
                {info.tables.map((table, ti) => (
                  <div key={ti} className="space-y-1">
                    {table.title && <p dir="auto" className="text-[12px] font-semibold text-[var(--ws-ink)]">{table.title}</p>}
                    <div className="sham-ws-table-wrap">
                      <table className="sham-ws-table min-w-full border-collapse">
                        <thead>
                          <tr>{table.headers.map((h, i) => <th key={i} className="text-start">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, ri) => (
                            <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Generated image */}
            {info.image && (
              <SignedImage src={info.image} lang={lang} />
            )}

            {/* Quick jump to live preview when code exists */}
            {previewBlock && (
              <button
                type="button"
                onClick={() => onTab('canvas')}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface)] px-3 py-2.5 text-[12.5px] font-semibold text-[var(--ws-ink)] transition hover:bg-[var(--ws-hover)] cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-emerald-500" />
                  {w('preview')}
                </span>
                <span className="text-[11px] text-[var(--ws-muted)]">{w('open_canvas')}</span>
              </button>
            )}

            {/* Quick source pills */}
            {info.sources.length > 0 && (
              <SourcePills sources={state.sources} lang={lang} onOpenAll={() => onTab('sources')} />
            )}
          </>
        ) : tab === 'canvas' ? (
          <div className="space-y-4">
            {state.text.trim() && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--ws-border)] pb-3">
                <button
                  type="button"
                  onClick={copyAll}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ws-ink)] transition hover:bg-[var(--ws-hover)] cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? w('copied') : w('copy')}
                </button>
                <ExportMenu markdown={state.text} lang={lang} compact />
              </div>
            )}
            {previewBlock && (
              <div className="space-y-1.5">
                <p className="text-[11.5px] font-semibold text-[var(--ws-muted)]">{w('preview')}</p>
                <PreviewFrame html={previewDocument(previewBlock, rtl)} title={w('preview')} height={340} />
              </div>
            )}
            {info.codeBlocks.map((block, bi) => (
              <CodeCard key={bi} block={block} lang={lang} index={bi + 1} onOpenEditor={onOpenEditor} />
            ))}
            {state.text.trim() && !info.codeBlocks.length && (
              <div className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-elevated)] p-4">
                <ShaheenMarkdown
                  text={state.text}
                  variant="workspace"
                  sources={state.sources}
                  spokenText={state.spokenText}
                />
                {state.streaming && <span className="sham-ws-caret" aria-hidden="true" />}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {info.sources.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-[var(--ws-muted)]">{w('no_results')}</p>
            ) : (
              info.sources.map((s) => (
                <a
                  key={`${s.index}-${s.url}`}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="sham-ws-card-in block rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-surface)] p-3 transition hover:border-[var(--ws-border-strong)] hover:bg-[var(--ws-hover)]"
                >
                  <div className="flex items-center gap-2 text-[11px] text-[var(--ws-muted)]">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--ws-elevated)] text-[10.5px] font-bold tabular-nums text-[var(--ws-ink)] ring-1 ring-[var(--ws-border)]">
                      {formatLocalizedNumber(lang, s.index)}
                    </span>
                    <span dir="ltr" className="truncate font-medium">{s.domain}</span>
                    <ExternalLink className="ms-auto h-3 w-3 shrink-0 opacity-70" />
                  </div>
                  <p dir="auto" className="mt-1.5 text-[13px] font-semibold leading-snug text-[var(--ws-ink)]">{s.title}</p>
                  {s.snippet && <p dir="auto" className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-[var(--ws-muted)]">{s.snippet}</p>}
                </a>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
