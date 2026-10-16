import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MessageCircle, Radio, RefreshCw } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { fmt, LOCALE_MAP, makeT, type LText } from '../لغات/localize';
import { loadLiveNews, relativeTime, type NewsFile } from '../utils/liveNews';

const S = {
  title: { ar: 'أخبار العطور الحقيقية من الإنترنت', en: 'Real perfume news from the web', fr: 'Vraies actualités parfum du web', es: 'Noticias reales de perfumería', de: 'Echte Parfüm-News aus dem Netz', tr: 'Web’den gerçek parfüm haberleri' },
  badge: { ar: 'يجمعها الخبير شاهين تلقائياً كل {h} ساعة', en: 'Collected automatically by Master Shahin every {h} hours', fr: 'Collectées par Maître Shahin toutes les {h} heures', es: 'Recopiladas por el Maestro Shahin cada {h} horas', de: 'Alle {h} Stunden von Meister Shahin gesammelt', tr: 'Usta Şahin her {h} saatte bir toplar' },
  updated: { ar: 'آخر تحديث {t}', en: 'Updated {t}', fr: 'Mis à jour {t}', es: 'Actualizado {t}', de: 'Aktualisiert {t}', tr: 'Güncellendi {t}' },
  next: { ar: 'التحديث القادم {t}', en: 'Next update {t}', fr: 'Prochaine mise à jour {t}', es: 'Próxima actualización {t}', de: 'Nächstes Update {t}', tr: 'Sonraki güncelleme {t}' },
  nextSoon: { ar: 'التحديث القادم خلال دقائق', en: 'Next update in a few minutes', fr: 'Prochaine mise à jour sous peu', es: 'Próxima actualización en minutos', de: 'Nächstes Update in Kürze', tr: 'Sonraki güncelleme birkaç dakika içinde' },
  digest: { ar: 'خلاصة الخبير شاهين', en: 'Master Shahin’s digest', fr: 'Synthèse du Maître Shahin', es: 'Resumen del Maestro Shahin', de: 'Meister Shahins Überblick', tr: 'Usta Şahin’in özeti' },
  note: { ar: 'رأي شاهين:', en: 'Shahin’s take:', fr: 'L’avis de Shahin :', es: 'Opinión de Shahin:', de: 'Shahins Einschätzung:', tr: 'Şahin’in yorumu:' },
  read: { ar: 'اقرأ الخبر من مصدره', en: 'Read at the source', fr: 'Lire à la source', es: 'Leer en la fuente', de: 'Bei der Quelle lesen', tr: 'Kaynakta oku' },
  more: { ar: 'عرض المزيد من الأخبار', en: 'Show more news', fr: 'Plus d’actualités', es: 'Ver más noticias', de: 'Mehr News', tr: 'Daha fazla haber' },
  all: { ar: 'الكل', en: 'All', fr: 'Tout', es: 'Todo', de: 'Alle', tr: 'Tümü' },
  loading: { ar: 'الخبير شاهين يجلب آخر الأخبار…', en: 'Master Shahin is fetching the latest news…', fr: 'Maître Shahin récupère les actualités…', es: 'El Maestro Shahin trae las noticias…', de: 'Meister Shahin holt die News…', tr: 'Usta Şahin haberleri getiriyor…' },
  empty: { ar: 'الخبير شاهين يجهّز أول نشرة الآن من مواقع الأخبار حول العالم، وستظهر هنا خلال دقائق ثم تتحدث كل 12 ساعة.', en: 'Master Shahin is preparing the first bulletin from news sites around the world. It will appear here in a few minutes and refresh every 12 hours.', fr: 'Maître Shahin prépare le premier bulletin ; il apparaîtra ici dans quelques minutes.', es: 'El Maestro Shahin prepara el primer boletín; aparecerá aquí en unos minutos.', de: 'Meister Shahin bereitet das erste Bulletin vor; es erscheint hier in wenigen Minuten.', tr: 'Usta Şahin ilk bülteni hazırlıyor; birkaç dakika içinde burada görünecek.' },
  headlines: { ar: 'العناوين كما نشرتها مصادرها الأصلية.', en: 'Headlines as published by their sources.', fr: 'Titres tels que publiés par leurs sources.', es: 'Titulares tal como los publicaron sus fuentes.', de: 'Schlagzeilen wie von den Quellen veröffentlicht.', tr: 'Başlıklar kaynaklarının yayımladığı gibi.' },
  disclaimer: { ar: 'الأخبار من مواقعها الأصلية والملخصات من إعداد الخبير شاهين؛ راجع المصدر للتفاصيل الكاملة.', en: 'News comes from the original sites and the summaries are by Master Shahin; check the source for full details.', fr: 'Les actualités viennent des sites d’origine ; résumés par Maître Shahin.', es: 'Las noticias vienen de sus sitios originales; resúmenes del Maestro Shahin.', de: 'News von den Originalseiten, Zusammenfassungen von Meister Shahin.', tr: 'Haberler orijinal sitelerden, özetler Usta Şahin’den.' },
  cat_launch: { ar: 'إطلاقات جديدة', en: 'Launches', fr: 'Lancements', es: 'Lanzamientos', de: 'Neuheiten', tr: 'Lansmanlar' },
  cat_industry: { ar: 'صناعة العطور', en: 'Industry', fr: 'Industrie', es: 'Industria', de: 'Branche', tr: 'Sektör' },
  cat_ingredients: { ar: 'المواد الخام', en: 'Ingredients', fr: 'Matières premières', es: 'Ingredientes', de: 'Rohstoffe', tr: 'Hammaddeler' },
  cat_market: { ar: 'السوق والاقتصاد', en: 'Market', fr: 'Marché', es: 'Mercado', de: 'Markt', tr: 'Pazar' },
  cat_events: { ar: 'معارض وجوائز', en: 'Events & awards', fr: 'Salons et prix', es: 'Ferias y premios', de: 'Messen & Preise', tr: 'Fuarlar ve ödüller' },
  cat_regulation: { ar: 'لوائح وسلامة', en: 'Regulation', fr: 'Réglementation', es: 'Regulación', de: 'Regulierung', tr: 'Mevzuat' },
  cat_culture: { ar: 'ثقافة وتراث', en: 'Culture & heritage', fr: 'Culture', es: 'Cultura', de: 'Kultur', tr: 'Kültür' },
} satisfies Record<string, LText>;

export function ShaheenLiveNews({ currentLang = 'ar' }: { currentLang?: SupportedLanguage }) {
  const L = makeT(currentLang, S);
  const ar = currentLang === 'ar';
  const locale = LOCALE_MAP[currentLang] || 'en';
  const [news, setNews] = useState<NewsFile | null>(null);
  const [category, setCategory] = useState('all');
  const [shown, setShown] = useState(8);
  const [, tick] = useState(0);

  useEffect(() => {
    let alive = true;
    loadLiveNews().then((data) => { if (alive) setNews(data); }, () => {});
    const timer = setInterval(() => tick((n) => n + 1), 60_000); // keeps «منذ…» current
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const categories = useMemo(() => [...new Set((news?.items || []).map((i) => i.category))], [news]);
  const items = (news?.items || []).filter((i) => category === 'all' || i.category === category);
  const nextIn = news ? Date.parse(news.nextUpdateAt) - Date.now() : 0;

  return (
    <section className="rounded-3xl border border-amber-200 bg-gradient-to-b from-amber-50/70 to-white p-4 shadow-sm sm:p-6" data-testid="shaheen-live-news" aria-labelledby="shaheen-live-news-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <h2 id="shaheen-live-news-title" className="flex items-center gap-2 text-lg font-extrabold text-stone-900 sm:text-xl">
            <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" /></span>
            {L('title')}
          </h2>
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800"><Radio className="h-3.5 w-3.5" aria-hidden />{fmt(L('badge'), { h: news?.intervalHours || 12 })}</p>
        </div>
        {news && news.items.length > 0 && (
          <div className="flex flex-col items-end gap-0.5 text-[11px] text-stone-600">
            <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" aria-hidden />{fmt(L('updated'), { t: relativeTime(news.updatedAt, locale) })}</span>
            <span>{nextIn > 5 * 60_000 ? fmt(L('next'), { t: relativeTime(news.nextUpdateAt, locale) }) : L('nextSoon')}</span>
          </div>
        )}
      </div>

      {!news && <p className="mt-4 animate-pulse text-sm text-stone-500">{L('loading')}</p>}
      {news && !news.items.length && <p className="mt-4 rounded-xl bg-white p-4 text-sm leading-relaxed text-stone-700 ring-1 ring-amber-100">{L('empty')}</p>}

      {news && news.items.length > 0 && (
        <>
          {news.editor === 'shaheen' && news.digest && (
            <div className="mt-4 rounded-2xl bg-stone-900 p-4 text-sm leading-relaxed text-amber-50">
              <p className="mb-1 text-xs font-extrabold text-amber-400">👑 {L('digest')}</p>
              <p dir="auto">{ar ? news.digest.ar : news.digest.en}</p>
            </div>
          )}
          {news.editor === 'feeds' && <p className="mt-3 text-xs text-stone-500">{L('headlines')}</p>}

          {categories.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-1.5" role="tablist">
              {['all', ...categories].map((c) => (
                <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => { setCategory(c); setShown(8); }}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-bold transition ${category === c ? 'border-amber-700 bg-amber-700 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-amber-400'}`}>
                  {c === 'all' ? L('all') : L(`cat_${c}` as keyof typeof S)}
                </button>
              ))}
            </div>
          )}

          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {items.slice(0, shown).map((item) => (
              <li key={item.id} className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-xs transition hover:border-amber-300 hover:shadow-md">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-900">{L(`cat_${item.category}` as keyof typeof S)}</span>
                    <span className="font-bold text-stone-700">{item.source}</span>
                    {item.publishedAt && <time dateTime={item.publishedAt}>{relativeTime(item.publishedAt, locale)}</time>}
                  </div>
                  <h3 className="text-[15px] font-extrabold leading-snug text-stone-900" dir="auto">{ar ? item.title.ar : item.title.en}</h3>
                  {(ar ? item.summary.ar : item.summary.en) !== (ar ? item.title.ar : item.title.en) && (
                    <p className="text-sm leading-relaxed text-stone-700" dir="auto">{ar ? item.summary.ar : item.summary.en}</p>
                  )}
                  {item.note && (
                    <p className="flex gap-1.5 rounded-xl bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-950" dir="auto">
                      <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
                      <span><b>{L('note')}</b> {ar ? item.note.ar : item.note.en}</span>
                    </p>
                  )}
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-1 self-start text-xs font-bold text-amber-800 hover:text-amber-950 hover:underline">
                  {L('read')} <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </li>
            ))}
          </ol>
          {items.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + 8)} className="mt-4 w-full cursor-pointer rounded-xl border border-amber-300 bg-white py-2 text-sm font-bold text-amber-900 hover:bg-amber-50">{L('more')}</button>
          )}
          <p className="mt-3 text-[11px] text-stone-500">{L('disclaimer')}</p>
        </>
      )}
    </section>
  );
}
