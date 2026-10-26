import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../src/types/i18n';
import { NEWS_KEYS, type NewsRow } from '../src/لغات/newsKeys';
import { NEWS_PACKS, makeNewsT, newsLanguages, newsText } from '../src/لغات/newsL10n';
import { PERFUME_NEWS_DATA } from '../src/data/perfumeNews';
import { getLocalizedNewsArticle } from '../src/لغات/localizedContent';
import { storeLocalized } from '../src/لغات/storeL10n';
import { WorldPerfumeNews } from '../src/components/WorldPerfumeNews';
import { ShaheenLiveNews } from '../src/components/ShaheenLiveNews';

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
// Languages whose own script is Arabic-based: Arabic-range characters are their text, not a leak.
const ARABIC_SCRIPT_HOME = new Set<SupportedLanguage>(['ar', 'fa', 'ur', 'ps', 'sd']);

// The bug class of this pack's authoring: a foreign script mid-sentence. One cell may mix Latin
// (proper names) with ONE home script — two different non-Latin scripts never belong together
// (except Japanese, where kanji+kana do). The Indic danda lives in the Devanagari block yet is
// ordinary punctuation across Indic scripts, so it is stripped before counting.
const SCRIPT_RANGES: [string, RegExp][] = [
  ['grek', /[\u0370-\u03FF]/], ['cyrl', /[\u0400-\u04FF]/], ['armn', /[\u0530-\u058F]/], ['hebr', /[\u0590-\u05FF]/], ['arab', /[\u0600-\u06FF]/],
  ['deva', /[\u0900-\u097F]/], ['beng', /[\u0980-\u09FF]/], ['guru', /[\u0A00-\u0A7F]/], ['gujr', /[\u0A80-\u0AFF]/], ['orya', /[\u0B00-\u0B7F]/],
  ['taml', /[\u0B80-\u0BFF]/], ['telu', /[\u0C00-\u0C7F]/], ['knda', /[\u0C80-\u0CFF]/], ['mlym', /[\u0D00-\u0D7F]/], ['sinh', /[\u0D80-\u0DFF]/],
  ['thai', /[\u0E00-\u0E7F]/], ['laoo', /[\u0E80-\u0EFF]/], ['tibt', /[\u0F00-\u0FFF]/], ['mymr', /[\u1000-\u109F]/], ['geor', /[\u10A0-\u10FF]/],
  ['ethi', /[\u1200-\u137F]/], ['khmr', /[\u1780-\u17FF]/], ['mong', /[\u1800-\u18AF]/], ['kana', /[\u3040-\u30FF\u31F0-\u31FF]/], ['hani', /[\u4E00-\u9FFF]/],
  ['hang', /[\u1100-\u11FF\uAC00-\uD7AF]/],
];
const scriptsIn = (s: string) => {
  const clean = s.replace(/[।॥]/g, '');
  return SCRIPT_RANGES.filter(([, re]) => re.test(clean)).map(([name]) => name);
};
// Where a Latin letter glued straight onto a home-script letter is never legitimate in our copy
// (the "Иic"-style slips). CJK legitimately glues to Latin acronyms, and Tibetic (bo/dz) attaches
// case suffixes to proper names, as do the Ethiopic languages (am/ti: "GC-MSን"), so those are
// exempt too. Punctuation (e.g. the Arabic comma after a Latin acronym) is not a letter and
// never counts as glue.
const NO_GLUE_LANGS = new Set<SupportedLanguage>([
  'el', 'ru', 'uk', 'bg', 'sr', 'mk', 'be', 'kk', 'ky', 'tg', 'mn', 'ka', 'hy', 'he',
  'ar', 'fa', 'ur', 'ps', 'sd', 'hi', 'bn', 'mr', 'gu', 'pa', 'kn', 'ml', 'or', 'ta', 'te', 'ne', 'si', 'as',
  'th', 'lo', 'km', 'my',
]);
const isLatinLetter = (c: string) => /[A-Za-z]/.test(c);
const isScriptLetter = (c: string) => /\p{L}/u.test(c) && (c.codePointAt(0) ?? 0) >= 0x370;
const hasGluedLatin = (s: string) => {
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i]!, b = s[i + 1]!;
    if ((isLatinLetter(a) && isScriptLetter(b)) || (isScriptLetter(a) && isLatinLetter(b))) return true;
  }
  return false;
};

const TOKENS = (s: string) => (s.match(/\{[a-z]\}/g) || []).sort().join(' ');

test('every platform language carries the full news page, translated, with no Arabic or script mixing', () => {
  assert.equal(NEWS_KEYS.length, 79);
  assert.deepEqual(newsLanguages(), SUPPORTED_LANGUAGES.map((l) => l.code));
  const english = NEWS_PACKS.en as NewsRow;
  for (const { code } of SUPPORTED_LANGUAGES) {
    const row = NEWS_PACKS[code] as NewsRow | undefined;
    assert.ok(row, `<${code}> has no news row`);
    assert.equal(row.length, NEWS_KEYS.length, `<${code}> news row is short`);
    for (let i = 0; i < NEWS_KEYS.length; i++) {
      const value: string = row[i] as string;
      assert.ok(value && value.trim().length > 0, `<${code}:${NEWS_KEYS[i]}> is empty`);
      assert.notEqual(value, NEWS_KEYS[i], `<${code}:${NEWS_KEYS[i]}> shows the raw key`);
      assert.equal(TOKENS(value), TOKENS(english![i]!), `<${code}:${NEWS_KEYS[i]}> lost its placeholders`);
      if (code === 'ar') {
        assert.ok(ARABIC.test(value), `Arabic news lost its Arabic at ${NEWS_KEYS[i]}`);
      } else if (!ARABIC_SCRIPT_HOME.has(code)) {
        assert.ok(!ARABIC.test(value), `<${code}:${NEWS_KEYS[i]}> leaked Arabic: ${value}`);
      }
      const scripts = scriptsIn(value);
      const allowed = code === 'ja' ? 2 : 1;
      assert.ok(scripts.length <= allowed, `<${code}:${NEWS_KEYS[i]}> mixes ${scripts.join('+')}: ${value}`);
      if (NO_GLUE_LANGS.has(code)) {
        assert.ok(!hasGluedLatin(value), `<${code}:${NEWS_KEYS[i]}> has glued Latin: ${value}`);
      }
    }
    assert.ok(newsText(code, 'summary_tpl').includes('\n'), `<${code}:summary_tpl> lost its newline`);
    assert.ok(newsText(code, 'briefing_title').includes('👑'), `<${code}:briefing_title> lost its crown`);
    // Templates keep their slots exactly as the components fill them.
    const slots: [Parameters<typeof newsText>[1], string][] = [
      ['today_tpl', '{d}'], ['active_coverage_tpl', '{d}'], ['inspired_tpl', '{t}'], ['accord_title_tpl', '{t}'],
      ['summary_tpl', '{v}'], ['reports_count_tpl', '{n}'], ['live_badge', '{h}'], ['live_updated', '{t}'], ['live_next', '{t}'],
    ];
    for (const [key, slot] of slots) assert.ok(newsText(code, key).includes(slot), `<${code}:${key}> lost ${slot}`);
  }
});

test('newsText keeps the Arabic and English originals and resolves the visitor language first', () => {
  assert.equal(newsText('ar', 'briefing_title'), '👑 نشرة الخبير شاهين اليومية المصورة');
  assert.equal(newsText('ar', 'shahin_role'), 'شيخ العطارين ورئيس التحرير');
  assert.equal(newsText('en', 'briefing_title'), '👑 Master Shahin’s Daily Illustrated Bulletin');
  assert.equal(newsText('en', 'urgent_today'), 'URGENT TODAY');
  assert.equal(newsText('en', 'live_title'), 'Real perfume news from the web');
  assert.equal(newsText('tr', 'live_note'), 'Şahin’in yorumu:');
  assert.equal(newsText('fr', 'live_cat_culture'), 'Culture');
  assert.equal(makeNewsT('de')('close_lbl'), newsText('de', 'close_lbl'));
  for (const { code } of SUPPORTED_LANGUAGES) {
    for (const key of NEWS_KEYS) {
      assert.notEqual(newsText(code, key), key, `<${code}:${key}> fell through to the raw key`);
    }
  }
});

test('every page string is wired into the two news components (no orphan pack keys)', () => {
  const page = readFileSync(new URL('../src/components/WorldPerfumeNews.tsx', import.meta.url), 'utf8');
  const live = readFileSync(new URL('../src/components/ShaheenLiveNews.tsx', import.meta.url), 'utf8');
  assert.ok(page.includes("makeNewsT(currentLang)"), 'WorldPerfumeNews resolves with the shared pack');
  assert.ok(live.includes("makeNewsT(currentLang)"), 'ShaheenLiveNews resolves with the shared pack');
  for (const [name, src] of [['WorldPerfumeNews', page], ['ShaheenLiveNews', live]] as const) {
    assert.ok(!src.includes('makeT(currentLang, S)'), `${name} still carries the old local dictionary clamp`);
    assert.ok(!/satisfies Record<string, LText>/.test(src), `${name} still carries a local translation dictionary`);
  }
  const used = new Set([...(page + live).matchAll(/L\('([A-Za-z_0-9]+)'\)/g)].map((m) => m[1] as string));
  for (const c of ['launch', 'industry', 'ingredients', 'market', 'events', 'regulation', 'culture']) used.add(`live_cat_${c}`);
  // today_tpl / refresh_local_ok arrived with the original dictionary; the page kept them translated for reuse.
  const dormant = new Set(['today_tpl', 'refresh_local_ok']);
  const orphans = NEWS_KEYS.filter((k) => !used.has(k) && !dormant.has(k));
  assert.deepEqual(orphans, [], 'pack keys nobody renders: ' + orphans.join(', '));
  const unknown = [...used].filter((k) => !(NEWS_KEYS as readonly string[]).includes(k));
  assert.deepEqual(unknown, [], 'components ask for keys the pack does not define: ' + unknown.join(', '));
});

test('seed articles reach every non-Arabic visitor in English, never in Arabic', () => {
  assert.ok(PERFUME_NEWS_DATA.length >= 6);
  for (const lang of SUPPORTED_LANGUAGES.map((l) => l.code).filter((c) => c !== 'ar')) {
    for (const item of PERFUME_NEWS_DATA) {
      const loc = getLocalizedNewsArticle(item, lang);
      for (const field of [loc.titleAr, loc.summaryAr, loc.contentAr, loc.expertVerdict, loc.marketImpact] as const) {
        assert.ok(field === undefined || !ARABIC.test(field), `<${lang}:${item.id}> leaked Arabic article text: ${String(field).slice(0, 60)}`);
      }
      assert.ok(loc.titleAr && loc.titleAr.length > 0, `<${lang}:${item.id}> lost its title`);
      assert.ok(loc.summaryAr && !ARABIC.test(loc.summaryAr), `<${lang}:${item.id}> summary is not an English-floor summary`);
      assert.ok(loc.expertVerdict && loc.expertVerdict.length > 0, `<${lang}:${item.id}> lost the master verdict`);
      if (!ARABIC_SCRIPT_HOME.has(lang)) {
        assert.ok(!loc.readTime || !ARABIC.test(loc.readTime), `<${lang}:${item.id}> read time is Arabic: ${loc.readTime}`);
        assert.ok(!ARABIC.test(loc.categoryLabelAr), `<${lang}:${item.id}> category label is Arabic: ${loc.categoryLabelAr}`);
      }
      for (const note of item.keyNotes || []) assert.ok(note.nameEn, `<${item.id}> note has no English name`);
    }
  }
  // …and Arabic visitors keep the Arabic original, untouched.
  const arabic = getLocalizedNewsArticle(PERFUME_NEWS_DATA[0]!, 'ar');
  assert.equal(arabic, PERFUME_NEWS_DATA[0]);
  assert.ok(ARABIC.test(arabic.summaryAr));
});

test('a stale article with no English fields still never shows its Arabic body abroad', () => {
  const stale = {
    ...PERFUME_NEWS_DATA[0]!,
    id: 'stale-cache-fixture',
    summaryEn: undefined, contentEn: undefined, verdictEn: undefined, impactEn: undefined,
    titleEn: 'Cached English headline',
  };
  const loc = getLocalizedNewsArticle(stale, 'de');
  assert.equal(loc.titleAr, 'Cached English headline');
  assert.ok(!ARABIC.test(loc.summaryAr), `stale summary leaked Arabic: ${loc.summaryAr.slice(0, 60)}`);
  assert.equal(loc.contentAr, loc.summaryAr, 'body falls back to the resolved (English) summary');
  assert.equal(loc.expertVerdict, '', 'no English verdict → hidden, never Arabic');
  assert.equal(loc.marketImpact, '', 'no English impact → hidden, never Arabic');
});

test('live news items resolve through the sanctioned pair with the English floor', () => {
  const file = JSON.parse(readFileSync(new URL('../src/data/live/shaheen-news.json', import.meta.url), 'utf8')) as {
    digest?: { ar: string; en: string } | null;
    items: { title: { ar: string; en: string }; summary: { ar: string; en: string }; note: { ar: string; en: string } | null }[];
  };
  assert.ok(Array.isArray(file.items));
  for (const item of file.items) {
    for (const pair of [item.title, item.summary, ...(item.note ? [item.note] : [])]) {
      assert.ok(pair.en.trim().length > 0, 'a live item misses its English text');
      assert.equal(storeLocalized(pair, 'de'), pair.en);
      assert.equal(storeLocalized(pair, 'fr'), pair.en);
      assert.equal(storeLocalized(pair, 'ar'), pair.ar);
      // Feed items sometimes carry the verbatim headline on both sides; otherwise the ar side is Arabic.
      if (pair.ar.trim() && pair.ar !== pair.en) assert.ok(ARABIC.test(pair.ar), 'the Arabic side of the pair is not Arabic');
    }
  }
  if (file.digest) assert.equal(storeLocalized(file.digest, 'ja'), file.digest.en);
});

test('the news page itself renders in the visitor language without Arabic for non-Arabic visitors', () => {
  // React SSR escapes &, <, > (and quotes) — compare against the escaped form.
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  for (const code of ['ar', 'en', 'fr', 'de', 'ja', 'sw', 'ig'] as SupportedLanguage[]) {
    const html = renderToString(
      React.createElement(WorldPerfumeNews, {
        currentLang: code,
        onApplyNewsNotesToCalculator: () => {},
        onAddNoteToPyramid: () => {},
      }),
    );
    assert.ok(html.length > 2000, `${code} news page rendered empty`);
    if (code !== 'ar' && !ARABIC_SCRIPT_HOME.has(code)) {
      assert.ok(!ARABIC.test(html), `<${code} news page> leaked Arabic into the page`);
    }
    for (const key of ['briefing_title', 'observatory_title', 'live_title', 'live_loading', 'urgent_today'] as const) {
      assert.ok(html.includes(esc(newsText(code, key))), `the ${code} news page lost its ${key} copy`);
    }
  }
  const live = renderToString(React.createElement(ShaheenLiveNews, { currentLang: 'de' }));
  assert.ok(live.includes(esc(newsText('de', 'live_title'))), 'the live strip lost its title');
  const badge = newsText('de', 'live_badge');
  assert.ok(live.includes(esc(badge.replace('{h}', '12'))), 'the live strip lost its collected-every badge');
});
