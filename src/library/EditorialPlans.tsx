import React from 'react';
import type { SupportedLanguage } from '../types/i18n';
import { loc, makeT } from '../لغات/localize';
import { ORIGINAL_BOOK_PLANS } from './editorial';
const TEXT = {
  title: { ar: 'وحدة التأليف والمراجعة العلمية — تحت إشراف شاهين', en: 'Original writing & scientific review — supervised by Shaheen' },
  status: { ar: 'خطة عمل فقط: لم تُراجع نصوص المراجع ولم تُكتب الكتب بعد. الموافقة العلمية والقانونية واعتماد شاهين جميعها معلّقة.', en: 'Plans only: reference texts have not been reviewed and books have not been written. Scientific review, legal approval and Shaheen sign-off are all pending.' },
  process: { ar: 'المسار: توثيق حقوق المصادر ← تقييم الأدلة الحديثة لكل ادعاء ← تأليف مستقل ← مراجعة علمية متخصصة ← اعتماد المدير القانوني ← اعتماد شاهين للنشر. مراجعة أي نسخة لا تعتمد التعديلات أو الترجمات اللاحقة تلقائياً.', en: 'Process: document source rights → assess current evidence for each claim → independent writing → qualified scientific review → legal manager approval → Shaheen publication sign-off. Later revisions and translations require renewed review.' },
};
export function EditorialPlans({ currentLang }: { currentLang: SupportedLanguage }) {
  const L = makeT(currentLang, TEXT);
  return <section aria-labelledby="editorial-title" className="space-y-3 rounded-xl border border-amber-500/30 p-4">
    <h3 id="editorial-title" className="text-xl font-bold text-amber-300">{L('title')}</h3>
    <p className="text-sm">{L('status')}</p><p className="text-sm text-stone-300">{L('process')}</p>
    <div className="grid gap-3 lg:grid-cols-3">{ORIGINAL_BOOK_PLANS.map(plan => <article key={plan.id} className="rounded-lg border border-stone-700 p-3">
      <h4 className="font-bold">{loc(currentLang, plan.title)}</h4>
      <ul className="list-disc ps-5 text-sm space-y-2 mt-3">{plan.chapters.map(chapter => <li key={chapter.en}>{loc(currentLang, chapter)}</li>)}</ul>
    </article>)}</div>
  </section>;
}
