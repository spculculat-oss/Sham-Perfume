import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import type { StoreProduct } from '../utils/storeCatalog';
import { isRTL } from '../لغات/localizedContent';
import { SafeImage, photoSources } from './SafeImage';
import { sellerText } from '../لغات/sellerL10n';
import { fmt, loc } from '../لغات/localize';
import { storeLocalized } from '../لغات/storeL10n';
import { trackInsight } from '../utils/insightsTracker';
import { priceYardstick } from '../utils/visitorInsights';
import { QUIZ, QUIZ_UI, rankForTaste, saveAnswers, savedAnswers, tasteFromAnswers, tasteLine, tasteScore, type QuizAnswers } from '../utils/tasteQuiz';

interface Props {
  products: StoreProduct[];
  lang: SupportedLanguage;
  price: (egp: number) => string;
  onAdd: (p: StoreProduct) => void;
  onOpen: (p: StoreProduct) => void;
  onClose: () => void;
}

/**
 * «اختبار ذوقك» — five questions, then picks for his taste. The answers stay on his device (they sort the store for
 * him); with «التحليل» accepted, each answer also reaches the administration's vault as declared taste.
 */
export default function TasteQuiz({ products, lang, price, onAdd, onOpen, onClose }: Props) {
  const [answers, setAnswers] = useState<QuizAnswers>(() => savedAnswers() || {});
  const [step, setStep] = useState(0);
  const [added, setAdded] = useState<string[]>([]);
  const t = (x: { ar: string; en: string }) => loc(lang, x);
  const rtl = isRTL(lang);
  const finished = step >= QUIZ.length;
  const q = QUIZ[Math.min(step, QUIZ.length - 1)];
  const chosen = answers[q.kind] || [];
  const yardstick = useMemo(() => priceYardstick(products), [products]);
  const taste = useMemo(() => tasteFromAnswers(answers), [answers]);
  const picks = useMemo(() => (finished ? rankForTaste(products, taste, yardstick).filter((p) => tasteScore(p, taste, yardstick) > 2).slice(0, 6) : []), [finished, products, taste, yardstick]);

  const finish = (final: QuizAnswers = answers) => {
    saveAnswers(final);
    for (const k of Object.keys(final) as (keyof QuizAnswers)[]) (final[k] || []).forEach((v) => trackInsight('quiz', { value: `${k}:${v}` }));
    setStep(QUIZ.length);
  };
  const choose = (id: string) => {
    const now = answers[q.kind] || [];
    const next: QuizAnswers = { ...answers, [q.kind]: q.multi ? (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]) : [id] };
    setAnswers(next);
    if (q.multi) return;
    // A one-answer question moves on by itself; the last one shows the result (and saves it).
    setTimeout(() => (step >= QUIZ.length - 1 ? finish(next) : setStep((s) => s + 1)), 180);
  };
  const Next = rtl ? ArrowLeft : ArrowRight;
  const Back = rtl ? ArrowRight : ArrowLeft;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" dir={rtl ? 'rtl' : 'ltr'} data-testid="taste-quiz">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-extrabold text-stone-900 flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-600" />{finished ? t(QUIZ_UI.resultTitle) : t(QUIZ_UI.open)}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer" aria-label={t(QUIZ_UI.close)}><X className="w-5 h-5" /></button>
        </div>

        {!finished && (
          <>
            <div className="flex items-center gap-1" aria-hidden="true">
              {QUIZ.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-amber-500' : 'bg-stone-200'}`} />)}
            </div>
            <p className="text-[11px] text-stone-500">{fmt(t(QUIZ_UI.step), { n: step + 1, total: QUIZ.length })}</p>
            <div>
              <h3 className="text-lg font-bold text-stone-900">{t(q.title)}</h3>
              {q.hint && <p className="text-xs text-stone-500">{t(q.hint)}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {q.options.map((o) => {
                const on = chosen.includes(o.id);
                return (
                  <button key={o.id} type="button" onClick={() => choose(o.id)} aria-pressed={on}
                    className={`rounded-2xl border p-3 text-start flex items-center gap-2 cursor-pointer transition ${on ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300' : 'border-stone-200 hover:border-amber-300'}`}>
                    <span className="text-xl" aria-hidden="true">{o.emoji}</span>
                    <span className="text-sm font-semibold text-stone-800">{t(o.label)}</span>
                    {on && <Check className="w-4 h-4 text-amber-600 ms-auto" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="px-3 py-2 rounded-xl text-sm text-stone-600 disabled:opacity-30 flex items-center gap-1 cursor-pointer"><Back className="w-4 h-4" />{t(QUIZ_UI.back)}</button>
              {step < QUIZ.length - 1 ? (
                <button type="button" onClick={() => setStep((s) => s + 1)} className="px-4 py-2 rounded-xl bg-stone-900 text-white text-sm font-bold flex items-center gap-1 cursor-pointer">{chosen.length ? t(QUIZ_UI.next) : t(QUIZ_UI.skip)}<Next className="w-4 h-4" /></button>
              ) : (
                <button type="button" onClick={() => finish()} className="px-4 py-2 rounded-xl bg-amber-500 text-stone-950 text-sm font-extrabold cursor-pointer">{t(QUIZ_UI.done)}</button>
              )}
            </div>
          </>
        )}

        {finished && (
          <div className="space-y-3">
            <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm font-semibold text-amber-950">{tasteLine(taste, t) || '—'}</p>
            <h3 className="font-bold text-stone-900 text-sm">{t(QUIZ_UI.resultPicks)}</h3>
            {!picks.length && <p className="text-xs text-stone-500">{t(QUIZ_UI.empty)}</p>}
            <div className="grid grid-cols-2 gap-2">
              {picks.map((p) => (
                <div key={p.sku} className="rounded-2xl border border-stone-200 p-2 flex flex-col gap-1">
                  <button type="button" onClick={() => onOpen(p)} className="text-start cursor-pointer">
                    <SafeImage sources={photoSources(p.imageUrl, p.images)} alt={p.name.ar} className="w-full aspect-square rounded-xl" />
                    <p className="text-xs font-bold text-stone-900 line-clamp-2 mt-1">{storeLocalized(p.name, lang)}</p>
                  </button>
                  <p className="text-xs text-amber-800 font-bold font-mono-numbers">{price(p.price)}</p>
                  <button type="button" onClick={() => { onAdd(p); setAdded((a) => [...a, p.sku]); }} disabled={added.includes(p.sku) || p.inStock === false} aria-label={sellerText(lang, added.includes(p.sku) ? 'added' : 'add')}
                    className="mt-auto rounded-xl bg-stone-900 text-white text-xs font-bold py-1.5 flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer">
                    {added.includes(p.sku) ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-stone-500">{t(QUIZ_UI.saved)}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(0)} className="flex-1 px-3 py-2 rounded-xl border border-stone-300 text-sm cursor-pointer">{t(QUIZ_UI.retake)}</button>
              <button type="button" onClick={onClose} className="flex-1 px-3 py-2 rounded-xl bg-amber-500 text-stone-950 text-sm font-bold cursor-pointer">{t(QUIZ_UI.close)}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
