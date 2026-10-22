/**
 * «مجلس المتخصصين»: واجهة الاستشارة المتاحة في كل أقسام الموقع وفي أي وقت —
 * حتى من غير إنترنت — عبر متصفّح الزائر نفسه: الرد من ذاكرة شاهين ثم مكتبته،
 * وإلا فجوة صريحة باسم المتخصص («هيذاكر السؤال») من غير تخمين.
 */
import { useMemo, useState } from 'react';
import { Loader2, Send, Users, X } from 'lucide-react';
import {
  consult, pickSpecialist, primaryOf, SITE_SECTIONS, SPECIALISTS, specialistOf, specialistsOf,
  type Consultation, type Specialist, type SpecialistId,
} from '../utils/shaheenSpecialists';
import { browserMemory } from '../utils/browserMemory';
import { refugeWay } from '../utils/shaheenRefuge';

const AR = {
  open: 'استشير متخصصاً',
  title: 'مجلس المتخصصين',
  subtitle: 'علوم شاهين موزعة على متخصصين — استشارة في أي وقت، في كل أقسام الموقع، حتى من غير إنترنت. واسأل «وين ألاقي…» فيوصلك الملجأ لأي حاجة.',
  currentSection: 'قسم الموقع الحالي',
  suggested: 'المقترح لقسمك',
  ask: 'اسأل متخصصك',
  placeholder: 'اكتب سؤالك هنا…',
  send: 'اسأل',
  asking: 'بيفكر…',
  sources: 'الرد من ذاكرة شاهين ومكتبته — مكتوب عليه مصدره.',
  another: 'سؤال تاني',
  sourceRefuge: 'المصدر: ملجأ شاهين (الوصول لأي حاجة)',
  sourceMemory: 'المصدر: ذاكرة شاهين',
  sourceLibrary: 'المصدر: مكتبة شاهين',
  sourceGap: 'محتاج مذاكرة — الصراحة أحسن من التخمين',
  sciences: 'العلوم',
  available: 'متاح الآن',
  pick: 'اختار المتخصص بنفسك أو اسأل والباقي على التوجيه',
  sectionsCount: 'يستشار لأقسام',
};
const EN = {
  open: 'Consult a specialist',
  title: "The specialists' board",
  subtitle: "Shaheen's sciences split among specialists — consult any time, from every section, even offline.",
  currentSection: 'Current section',
  suggested: 'Suggested for your section',
  ask: 'Ask your specialist',
  placeholder: 'Write your question here…',
  send: 'Ask',
  asking: 'Thinking…',
  sources: "Answers come from Shaheen's memory and library — each with its source.",
  another: 'Another question',
  sourceRefuge: 'Source: the refuge (reach anything)',
  sourceMemory: "Source: Shaheen's memory",
  sourceLibrary: "Source: Shaheen's library",
  sourceGap: 'Needs studying — honesty beats guessing',
  sciences: 'Sciences',
  available: 'Available now',
  pick: 'Pick a specialist yourself, or just ask and routing will choose',
  sectionsCount: 'Consults for',
};

const SOURCES = {
  refuge: (question: string, lang: string) => refugeWay(question, lang),
  recall: (question: string, lang: string) => browserMemory.recall(question, lang),
  library: (question: string, lang: string) => browserMemory.library?.(question, lang),
};

export interface SpecialistsHubProps {
  /** قسم الموقع الحالي — يقترح المستشار الرئيسي للقسم. */
  section?: string;
  lang?: string;
}

export default function SpecialistsHub({ section, lang }: SpecialistsHubProps) {
  const isEn = (lang ?? 'ar').startsWith('en');
  const t = isEn ? EN : AR;
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SpecialistId | undefined>(undefined);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Consultation | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const sectionInfo = useMemo(() => SITE_SECTIONS.find((s) => s.id === section), [section]);
  const suggested = useMemo(() => (section ? primaryOf(section) : undefined), [section]);
  const active = useMemo<Specialist | undefined>(
    () => (picked && specialistOf(picked)) || (question.trim() ? pickSpecialist(question, section) : suggested),
    [picked, question, section, suggested],
  );

  const ask = async () => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      setAnswer(await consult(q, isEn ? 'en' : 'ar', SOURCES, section, picked));
    } finally { setBusy(false); }
  };

  const sourceLabel = (c: Consultation) => (c.source === 'refuge' ? t.sourceRefuge : c.source === 'memory' ? t.sourceMemory : c.source === 'library' ? t.sourceLibrary : t.sourceGap);

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 no-print">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white shadow-xl px-5 py-3 text-sm font-bold"
          aria-label={t.open}
        >
          <Users className="w-5 h-5" />
          <span>{t.open}</span>
        </button>
      </div>

      {open && (
        <div
          dir={isEn ? 'ltr' : 'rtl'}
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,540px)] h-[min(72vh,600px)] bg-stone-50 rounded-3xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden no-print`}
        >
          <div className="flex items-start justify-between gap-2 px-4 py-3 bg-emerald-800 text-white">
            <div>
              <h2 className="font-bold text-sm">{t.title}</h2>
              <p className="text-[11px] text-emerald-100 leading-relaxed">{t.subtitle}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-white/15" aria-label="close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {sectionInfo && (
              <p className="text-[11px] text-stone-500">
                {t.currentSection}: <b className="text-stone-700">{isEn ? sectionInfo.titleEn : sectionInfo.titleAr}</b>
                {suggested && <> — {t.suggested}: <b className="text-emerald-800">{isEn ? suggested.nameEn.split(' — ')[0] : suggested.nameAr}</b></>}
              </p>
            )}

            {answer ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-emerald-900">
                  {isEn ? answer.specialist.nameEn : answer.specialist.nameAr} — {isEn ? answer.specialist.fieldEn : answer.specialist.fieldAr}
                </p>
                <p className="text-xs text-stone-500">{answer.question}</p>
                <div className="rounded-2xl bg-white border border-stone-200 p-3 text-sm leading-relaxed text-stone-800 whitespace-pre-wrap">{answer.answer}</div>
                <p className={`text-[11px] font-bold ${answer.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{sourceLabel(answer)}</p>
                <button type="button" onClick={() => { setAnswer(undefined); setQuestion(''); }} className="text-xs font-bold text-emerald-800 underline">
                  {t.another}
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {specialistsOf(section ?? '').map((s) => (
                    <span key={s.id} className="text-[10px] rounded-full bg-emerald-100 text-emerald-900 px-2 py-0.5">
                      {isEn ? s.nameEn.split(' — ')[0] : s.nameAr}
                    </span>
                  ))}
                </div>
                <div className="space-y-2">
                  {SITE_SECTIONS.length > 0 && (
                    <p className="text-[11px] text-stone-500">{t.pick}</p>
                  )}
                  {active && (
                    <p className="text-xs text-stone-600">
                      {isEn ? active.nameEn : active.nameAr} — <span className="text-stone-500">{isEn ? active.sciencesEn : active.sciencesAr}</span>
                      <span className="block text-[10px] text-emerald-700 font-bold">{t.available}</span>
                    </p>
                  )}
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={t.placeholder}
                    aria-label={t.ask}
                    rows={3}
                    className="w-full rounded-2xl border border-stone-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void ask()}
                      disabled={busy || !question.trim()}
                      className="flex items-center gap-2 rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-4 py-2 text-sm font-bold"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {busy ? t.asking : t.send}
                    </button>
                    <span className="text-[10px] text-stone-500">{t.sources}</span>
                  </div>
                </div>

                <div className="border-t border-stone-200 pt-2">
                  <p className="text-[11px] font-bold text-stone-500 mb-1">{t.title}</p>
                  <ul className="space-y-1.5">
                    {SPECIALISTS.map((s) => {
                      const owns = SITE_SECTIONS.filter((sec) => sec.consultants.includes(s.id));
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => setPicked(picked === s.id ? undefined : s.id)}
                            className={`w-full text-start rounded-2xl border p-2.5 transition ${picked === s.id ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200 bg-white hover:border-emerald-400'}`}
                          >
                            <p className="text-xs font-bold text-stone-800">
                              {isEn ? s.nameEn : s.nameAr} — {isEn ? s.fieldEn : s.fieldAr}
                              <span className={`text-[9px] rounded-full px-1.5 py-0.5 ms-2 ${picked === s.id ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-500'}`}>
                                {t.sectionsCount} {owns.length}
                              </span>
                            </p>
                            <p className="text-[10px] text-stone-500 leading-relaxed">{isEn ? s.sciencesEn : s.sciencesAr}</p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
