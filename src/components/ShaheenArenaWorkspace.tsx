import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  Eye,
  FileCode2,
  ListChecks,
  Play,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Swords,
  ThumbsUp,
  X,
} from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import type {
  ActiveArtifactContext,
  AgentArtifact,
  AgentPlan,
  ArenaBattleResult,
  ArenaVoteChoice,
  CodeVerificationReport,
} from '../types/shaheenAgent';
import { buildArtifactPreviewHtml, verifyCodeSnippet } from '../utils/codeVerifier';
import { copyChatText } from '../utils/clipboard';
import { loc, type LText } from '../لغات/localize';
import { ShaheenMarkdown } from './ShaheenMarkdown';

const T: Record<string, LText> = {
  plan_title: { ar: 'خطة التنفيذ الهندسية', en: 'Engineering Execution Plan', fr: 'Plan d’exécution', es: 'Plan de ejecución', de: 'Ausführungsplan', fa: 'برنامه اجرای مهندسی' },
  phase_research: { ar: 'بحث', en: 'Research', fa: 'پژوهش' },
  phase_design: { ar: 'تصميم', en: 'Design', fa: 'طراحی' },
  phase_build: { ar: 'بناء', en: 'Build', fa: 'ساخت' },
  phase_verify: { ar: 'فحص', en: 'Verify', fa: 'بررسی' },
  arena_header: { ar: 'حلبة التنافس المزدوجة · شاهين المحكّم', en: 'Dual-Track Arena · Shahin Judge', fa: 'میدان رقابت دوگانه · داور شاهین' },
  arena_running: { ar: 'جاري تشغيل مساري الحل بالتوازي ومقارنتهما…', en: 'Running dual solution tracks in parallel…', fa: 'در حال اجرای هم‌زمان دو مسیر…' },
  winner_a: { ar: 'الأرجحية: المسار أ', en: 'Edge: Track A', fa: 'برتر: مسیر الف' },
  winner_b: { ar: 'الأرجحية: المسار ب', en: 'Edge: Track B', fa: 'برتر: مسیر ب' },
  winner_tie: { ar: 'تعادل متقارب', en: 'Balanced Tie', fa: 'تساوی نزدیک' },
  judge_verdict: { ar: 'خلاصة التحكيم:', en: 'Judge Verdict:', fa: 'جمع‌بندی داوری:' },
  open_in_studio: { ar: 'معاينة في الاستوديو', en: 'Open in Studio', fa: 'باز کردن در استودیو' },
  score_acc: { ar: 'الدقة', en: 'Accuracy' },
  score_arch: { ar: 'المعمارية', en: 'Architecture' },
  score_clar: { ar: 'الوضوح', en: 'Clarity' },
  score_comp: { ar: 'الاكتمال', en: 'Completeness' },
  vote_prompt: { ar: 'صوّت للحل الأنسب (تقييم الحلبة):', en: 'Cast your Arena verdict:', fa: 'رأی خود را ثبت کنید:' },
  vote_a: { ar: 'المسار أ أفضل', en: 'Track A Wins' },
  vote_b: { ar: 'المسار ب أفضل', en: 'Track B Wins' },
  vote_tie: { ar: 'تعادل', en: 'Tie' },
  vote_merged: { ar: 'الحل المدمج هو الأفضل', en: 'Merged Best' },
  studio_title: { ar: 'استوديو الإنشاء البرمجي والمعاينة الحية', en: 'Programmatic Code & Live Preview Studio', fa: 'استودیو کدنویسی و پیش‌نمایش زنده' },
  tab_preview: { ar: 'معاينة حيّة', en: 'Live Preview', fa: 'پیش‌نمایش زنده' },
  tab_code: { ar: 'الكود البرمجي', en: 'Source Code', fa: 'کد منبع' },
  tab_verify: { ar: 'فحص وتدقيق', en: 'Verify', fa: 'بررسی کد' },
  run_refresh: { ar: 'تشغيل', en: 'Run' },
  copy: { ar: 'نسخ', en: 'Copy' },
  copied: { ar: 'تم النسخ', en: 'Copied' },
  download: { ar: 'تنزيل', en: 'Download' },
  iterate: { ar: 'تطوير / إصلاح عبر شاهين', en: 'Iterate with Shahin', fa: 'بهبود با شاهین' },
  no_preview: { ar: 'هذا النوع برمجي بحت (يمكنك مراجعة الكود وتعديله وفحصه في التبويب المجاور).', en: 'Non-visual source language — inspect, edit, and verify in the Code & Verify tabs.' },
  passed_check: { ar: 'اجتاز الفحص بنجاح', en: 'Verification Passed' },
  issues_check: { ar: 'توجد ملاحظات فنية', en: 'Issues Detected' },
  reverify: { ar: 'إعادة الفحص الآن', en: 'Re-verify Now' },
  lines_lbl: { ar: 'أسطر', en: 'lines' },
  close_studio: { ar: 'إغلاق الاستوديو', en: 'Close Studio' },
  merged_note: { ar: 'تمت قراءة الحل المدمج النهائي في الرسالة الرئيسية بالأسفل.', en: 'Final merged synthesis is shown in the main reply below.' },
};

export function ShaheenPlanCard({
  plan,
  language,
}: {
  plan?: AgentPlan;
  language: SupportedLanguage;
}) {
  if (!plan || !plan.tasks?.length) return null;
  const doneCount = plan.tasks.filter((t) => t.status === 'done').length;
  const phaseMap: Record<string, string> = {
    research: loc(language, T.phase_research),
    design: loc(language, T.phase_design),
    build: loc(language, T.phase_build),
    verify: loc(language, T.phase_verify),
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/90 p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200/80 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-stone-900">
          <ListChecks className="w-4 h-4 text-amber-800 shrink-0" />
          <span>{loc(language, T.plan_title)}</span>
        </div>
        <span className="font-mono-numbers tabular-nums text-[11px] font-semibold text-stone-600">
          {doneCount}/{plan.tasks.length}
        </span>
      </div>
      <p className="text-[11px] font-semibold text-amber-950">{plan.goal}</p>
      <div className="space-y-1.5">
        {plan.tasks.map((task, idx) => (
          <div key={task.id || idx} className="flex items-start gap-2 rounded-lg bg-white px-2.5 py-1.5 border border-stone-200/80">
            <span className="mt-0.5 shrink-0">
              {task.status === 'done' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <span className="inline-flex w-3.5 h-3.5 items-center justify-center rounded border border-amber-500 text-[9px] font-bold text-amber-800 tabular-nums">
                  {idx + 1}
                </span>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-stone-900">{task.title}</span>
                <span className="text-[10px] font-semibold text-stone-500 shrink-0">
                  {phaseMap[task.phase] || task.phase}
                </span>
              </div>
              {task.detail && <p className="text-[10px] text-stone-500 mt-0.5">{task.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShaheenArenaDuelCard({
  arena,
  language,
  isStreaming,
  onOpenArtifact,
  onVote,
}: {
  arena?: ArenaBattleResult;
  language: SupportedLanguage;
  isStreaming?: boolean;
  onOpenArtifact?: (artifact: AgentArtifact) => void;
  onVote?: (vote: ArenaVoteChoice) => void;
}) {
  const [activeTab, setActiveTab] = useState<'split' | 'a' | 'b'>('split');
  if (!arena) return null;

  const contenderA = arena.contenders.find((c) => c.id === 'a');
  const contenderB = arena.contenders.find((c) => c.id === 'b');
  const totals = arena.voteTotals || { a: 0, b: 0, tie: 0, merged: 0 };

  return (
    <div className="rounded-2xl border border-amber-300/80 bg-stone-50 p-3 sm:p-4 space-y-3 text-xs">
      {/* Arena Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2.5">
        <div className="flex items-center gap-2 font-bold text-stone-900">
          <Swords className="w-4 h-4 text-amber-800 shrink-0" />
          <span>{loc(language, T.arena_header)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {arena.contenders.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 font-semibold text-[11px] border border-amber-200">
              <Award className="w-3 h-3 text-amber-700" />
              <span>
                {arena.winner === 'a'
                  ? loc(language, T.winner_a)
                  : arena.winner === 'b'
                    ? loc(language, T.winner_b)
                    : loc(language, T.winner_tie)}
              </span>
            </span>
          )}
          <div className="flex bg-white border border-stone-200 rounded-lg p-0.5 text-[10px] font-semibold">
            {(['split', 'a', 'b'] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setActiveTab(view)}
                className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                  activeTab === view ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {view === 'split' ? 'A | B' : view === 'a' ? 'A' : 'B'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isStreaming && arena.contenders.length === 0 && (
        <div className="py-4 text-center text-stone-600 font-medium">
          {loc(language, T.arena_running)}
        </div>
      )}

      {/* Side-by-Side Contenders */}
      {arena.contenders.length > 0 && (
        <div className={`grid gap-3 ${activeTab === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {[contenderA, contenderB]
            .filter((c): c is NonNullable<typeof c> => Boolean(c))
            .filter((c) => activeTab === 'split' || activeTab === c.id)
            .map((c) => {
              const isWinner = arena.winner === c.id;
              return (
                <div
                  key={c.id}
                  className={`rounded-xl border bg-white p-3 space-y-2.5 flex flex-col justify-between ${
                    isWinner ? 'border-amber-500 ring-1 ring-amber-200' : 'border-stone-200'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-2">
                      <div>
                        <div className="font-bold text-stone-900 text-xs">{c.label}</div>
                        <div className="text-[10px] text-stone-500">{c.styleTag}</div>
                      </div>
                      <div className="text-end shrink-0">
                        <div className="font-mono-numbers tabular-nums text-xs font-bold text-amber-900">
                          {c.score.overall}/100
                        </div>
                        <div className="font-mono-numbers tabular-nums text-[10px] text-stone-400">
                          {c.durationMs}ms
                        </div>
                      </div>
                    </div>

                    {/* Numeric Axis Breakdown */}
                    <div className="grid grid-cols-4 gap-1 bg-stone-50 rounded-lg p-1.5 text-[10px] text-center border border-stone-100 font-mono-numbers tabular-nums">
                      <div>
                        <div className="text-stone-400">{loc(language, T.score_acc)}</div>
                        <div className="font-bold text-stone-800">{c.score.accuracy}</div>
                      </div>
                      <div>
                        <div className="text-stone-400">{loc(language, T.score_arch)}</div>
                        <div className="font-bold text-stone-800">{c.score.architecture}</div>
                      </div>
                      <div>
                        <div className="text-stone-400">{loc(language, T.score_clar)}</div>
                        <div className="font-bold text-stone-800">{c.score.clarity}</div>
                      </div>
                      <div>
                        <div className="text-stone-400">{loc(language, T.score_comp)}</div>
                        <div className="font-bold text-stone-800">{c.score.completeness}</div>
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto pe-1 text-[11px] leading-relaxed text-stone-700">
                      <ShaheenMarkdown text={c.reply} />
                    </div>
                  </div>

                  {c.artifacts.length > 0 && onOpenArtifact && (
                    <div className="pt-2 border-t border-stone-100 flex flex-wrap gap-1.5">
                      {c.artifacts.map((art) => (
                        <button
                          key={art.id}
                          type="button"
                          onClick={() => onOpenArtifact(art)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-[10px] font-semibold cursor-pointer"
                        >
                          <Code2 className="w-3 h-3 text-amber-400" />
                          <span>{art.filename}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Judge Verdict & Arena Vote Controls */}
      {arena.judgeSummary && (
        <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-2.5 space-y-2">
          <div className="flex items-start gap-2 text-[11px] text-amber-950">
            <Scale className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">{loc(language, T.judge_verdict)} </span>
              <span>{arena.judgeSummary}</span>
              <span className="block text-[10px] text-amber-800/80 mt-0.5">{loc(language, T.merged_note)}</span>
            </div>
          </div>

          {onVote && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200/70">
              <span className="text-[10px] font-bold text-stone-700 flex items-center gap-1">
                <ThumbsUp className="w-3 h-3 text-amber-800" />
                <span>{loc(language, T.vote_prompt)}</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['a', T.vote_a, totals.a],
                    ['b', T.vote_b, totals.b],
                    ['tie', T.vote_tie, totals.tie],
                    ['merged', T.vote_merged, totals.merged],
                  ] as const
                ).map(([choice, lbl, count]) => {
                  const selected = arena.userVote === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => onVote(choice)}
                      aria-pressed={selected}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer tabular-nums ${
                        selected
                          ? 'bg-stone-900 text-amber-300 border-stone-900'
                          : 'bg-white hover:bg-amber-100 text-stone-800 border-amber-200'
                      }`}
                    >
                      <span>{loc(language, lbl)}</span>
                      {count > 0 && <span className="opacity-75">({count})</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ShaheenCodeStudioPanel({
  artifacts,
  selectedArtifactId,
  onSelectArtifact,
  onClose,
  onIterateWithShaheen,
  language,
  className = '',
}: {
  artifacts: AgentArtifact[];
  selectedArtifactId?: string;
  onSelectArtifact: (id: string) => void;
  onClose: () => void;
  onIterateWithShaheen?: (artifact: ActiveArtifactContext) => void;
  language: SupportedLanguage;
  className?: string;
}) {
  const active = useMemo(
    () => artifacts.find((a) => a.id === selectedArtifactId) || artifacts[artifacts.length - 1],
    [artifacts, selectedArtifactId],
  );

  const [editedCode, setEditedCode] = useState(active?.code || '');
  const [tab, setTab] = useState<'preview' | 'code' | 'verify'>(active?.runnable ? 'preview' : 'code');
  const [runCounter, setRunCounter] = useState(0);
  const [copied, setCopied] = useState(false);
  const [liveReport, setLiveReport] = useState<CodeVerificationReport | undefined>(active?.verification);

  useEffect(() => {
    if (!active) return;
    setEditedCode(active.code);
    setLiveReport(active.verification || verifyCodeSnippet(active.language, active.code));
    setTab(active.runnable ? 'preview' : 'code');
  }, [active?.id]);

  if (!active) return null;

  const isModified = editedCode !== active.code;
  const previewSrcDoc = buildArtifactPreviewHtml(active, isModified ? editedCode : undefined);

  const handleCopy = async () => {
    if (await copyChatText(editedCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([editedCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = active.filename || 'artifact.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReverify = () => {
    setLiveReport(verifyCodeSnippet(active.language, editedCode));
  };

  return (
    <div className={`flex flex-col bg-stone-950 text-stone-100 rounded-2xl border border-stone-800 overflow-hidden shadow-lg ${className}`}>
      {/* Top Studio Header */}
      <div className="px-3 py-2.5 bg-stone-900 border-b border-stone-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Code2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-bold text-xs text-stone-100 truncate">{loc(language, T.studio_title)}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-stone-400 hover:text-white rounded-md cursor-pointer"
          title={loc(language, T.close_studio)}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Artifact Switcher Strip */}
      <div className="px-2.5 py-1.5 bg-stone-900/60 border-b border-stone-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {artifacts.map((art) => {
          const isCurrent = art.id === active.id;
          return (
            <button
              key={art.id}
              type="button"
              onClick={() => onSelectArtifact(art.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer border transition-colors ${
                isCurrent
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold'
                  : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
              }`}
            >
              <FileCode2 className="w-3 h-3 shrink-0" />
              <span dir="ltr">{art.filename}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-toolbar: View Mode + Actions */}
      <div className="px-3 py-2 bg-stone-900/90 border-b border-stone-800 flex flex-wrap items-center justify-between gap-2 shrink-0 text-[11px]">
        <div className="flex items-center gap-1 bg-stone-950 p-0.5 rounded-lg border border-stone-800">
          {previewSrcDoc && (
            <button
              type="button"
              onClick={() => setTab('preview')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer font-semibold ${
                tab === 'preview' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>{loc(language, T.tab_preview)}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('code')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer font-semibold ${
              tab === 'code' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Code2 className="w-3 h-3" />
            <span>{loc(language, T.tab_code)}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleReverify();
              setTab('verify');
            }}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer font-semibold ${
              tab === 'verify' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>{loc(language, T.tab_verify)}</span>
            {liveReport && (
              <span className={`font-mono-numbers tabular-nums text-[9px] px-1 rounded ${
                liveReport.valid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {liveReport.score}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {previewSrcDoc && tab === 'preview' && (
            <button
              type="button"
              onClick={() => setRunCounter((c) => c + 1)}
              className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white flex items-center gap-1 cursor-pointer font-semibold"
            >
              <Play className="w-3 h-3" />
              <span>{loc(language, T.run_refresh)}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center gap-1 cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? loc(language, T.copied) : loc(language, T.copy)}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">{loc(language, T.download)}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden bg-stone-950 relative">
        {tab === 'preview' && (
          previewSrcDoc ? (
            <iframe
              key={`${active.id}-${runCounter}-${editedCode.length}`}
              title={active.title}
              sandbox="allow-scripts"
              srcDoc={previewSrcDoc}
              className="w-full h-full bg-white border-0"
            />
          ) : (
            <div className="p-6 text-center text-xs text-stone-400 flex items-center justify-center h-full">
              {loc(language, T.no_preview)}
            </div>
          )
        )}

        {tab === 'code' && (
          <div className="h-full flex flex-col">
            <div className="px-3 py-1 bg-stone-900/50 border-b border-stone-800 flex items-center justify-between text-[10px] text-stone-400 font-mono-numbers tabular-nums">
              <span dir="ltr">{active.language.toUpperCase()} · {active.filename}</span>
              <span>{editedCode.split('\n').length} {loc(language, T.lines_lbl)}</span>
            </div>
            <textarea
              dir="ltr"
              spellCheck={false}
              value={editedCode}
              onChange={(e) => setEditedCode(e.target.value)}
              className="flex-1 w-full bg-stone-950 text-stone-100 font-mono text-[12px] leading-relaxed p-3 resize-none focus:outline-none"
            />
          </div>
        )}

        {tab === 'verify' && (
          <div className="h-full overflow-y-auto p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2 bg-stone-900 border border-stone-800 rounded-xl p-3">
              <div className="flex items-center gap-2">
                {liveReport?.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-stone-100">
                    {liveReport?.valid ? loc(language, T.passed_check) : loc(language, T.issues_check)}
                  </div>
                  <div className="text-[11px] text-stone-400 font-mono-numbers tabular-nums">
                    Score: {liveReport?.score ?? 0}/100 · {liveReport?.metrics.lines ?? 0} lines · ~{liveReport?.metrics.functionsEstimate ?? 0} blocks
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReverify}
                className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{loc(language, T.reverify)}</span>
              </button>
            </div>

            <div className="space-y-2">
              {liveReport?.diagnostics.map((d, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-2.5 text-[11px] ${
                    d.level === 'error'
                      ? 'bg-rose-950/50 border-rose-700/70 text-rose-200'
                      : d.level === 'warning'
                        ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                        : 'bg-stone-900 border-stone-800 text-stone-300'
                  }`}
                >
                  <span className="font-bold uppercase text-[10px] me-2">[{d.level}]</span>
                  <span>{d.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Iteration CTA */}
      {onIterateWithShaheen && (
        <div className="px-3 py-2 bg-stone-900 border-t border-stone-800 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-stone-400 truncate">{active.summary}</span>
          <button
            type="button"
            onClick={() =>
              onIterateWithShaheen({
                id: active.id,
                filename: active.filename,
                language: active.language,
                code: editedCode,
              })
            }
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{loc(language, T.iterate)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
