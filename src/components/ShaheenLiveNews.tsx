import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MessageCircle, Radio, RefreshCw } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { fmt, LOCALE_MAP } from '../لغات/localize';
import { makeNewsT } from '../لغات/newsL10n';
import type { NewsTextKey } from '../لغات/newsKeys';
import { storeLocalized } from '../لغات/storeL10n';
import { loadLiveNews, relativeTime, type NewsFile } from '../utils/liveNews';


export function ShaheenLiveNews({ currentLang = 'ar' }: { currentLang?: SupportedLanguage }) {
  const L = makeNewsT(currentLang);
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
            {L('live_title')}
          </h2>
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800"><Radio className="h-3.5 w-3.5" aria-hidden />{fmt(L('live_badge'), { h: news?.intervalHours || 12 })}</p>
        </div>
        {news && news.items.length > 0 && (
          <div className="flex flex-col items-end gap-0.5 text-[11px] text-stone-600">
            <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" aria-hidden />{fmt(L('live_updated'), { t: relativeTime(news.updatedAt, locale) })}</span>
            <span>{nextIn > 5 * 60_000 ? fmt(L('live_next'), { t: relativeTime(news.nextUpdateAt, locale) }) : L('live_nextSoon')}</span>
          </div>
        )}
      </div>

      {!news && <p className="mt-4 animate-pulse text-sm text-stone-500">{L('live_loading')}</p>}
      {news && !news.items.length && <p className="mt-4 rounded-xl bg-white p-4 text-sm leading-relaxed text-stone-700 ring-1 ring-amber-100">{L('live_empty')}</p>}

      {news && news.items.length > 0 && (
        <>
          {news.editor === 'shaheen' && news.digest && (
            <div className="mt-4 rounded-2xl bg-stone-900 p-4 text-sm leading-relaxed text-amber-50">
              <p className="mb-1 text-xs font-extrabold text-amber-400">👑 {L('live_digest')}</p>
              <p dir="auto">{storeLocalized(news.digest, currentLang)}</p>
            </div>
          )}
          {news.editor === 'feeds' && <p className="mt-3 text-xs text-stone-500">{L('live_headlines')}</p>}

          {categories.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-1.5" role="tablist">
              {['all', ...categories].map((c) => (
                <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => { setCategory(c); setShown(8); }}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-bold transition ${category === c ? 'border-amber-700 bg-amber-700 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-amber-400'}`}>
                  {c === 'all' ? L('live_all') : L(`live_cat_${c}` as NewsTextKey)}
                </button>
              ))}
            </div>
          )}

          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {items.slice(0, shown).map((item) => (
              <li key={item.id} className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-xs transition hover:border-amber-300 hover:shadow-md">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-900">{L(`live_cat_${item.category}` as NewsTextKey)}</span>
                    <span className="font-bold text-stone-700">{item.source}</span>
                    {item.publishedAt && <time dateTime={item.publishedAt}>{relativeTime(item.publishedAt, locale)}</time>}
                  </div>
                  <h3 className="text-[15px] font-extrabold leading-snug text-stone-900" dir="auto">{storeLocalized(item.title, currentLang)}</h3>
                  {storeLocalized(item.summary, currentLang) !== storeLocalized(item.title, currentLang) && (
                    <p className="text-sm leading-relaxed text-stone-700" dir="auto">{storeLocalized(item.summary, currentLang)}</p>
                  )}
                  {item.note && (
                    <p className="flex gap-1.5 rounded-xl bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-950" dir="auto">
                      <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
                      <span><b>{L('live_note')}</b> {storeLocalized(item.note, currentLang)}</span>
                    </p>
                  )}
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-1 self-start text-xs font-bold text-amber-800 hover:text-amber-950 hover:underline">
                  {L('live_read')} <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </li>
            ))}
          </ol>
          {items.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + 8)} className="mt-4 w-full cursor-pointer rounded-xl border border-amber-300 bg-white py-2 text-sm font-bold text-amber-900 hover:bg-amber-50">{L('live_more')}</button>
          )}
          <p className="mt-3 text-[11px] text-stone-500">{L('live_disclaimer')}</p>
        </>
      )}
    </section>
  );
}
