import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Header } from '../src/components/Header';
import { ToastNotification } from '../src/components/ToastNotification';
import type { SupportedLanguage } from '../src/types/i18n';
import type { UserEnvironmentProfile } from '../src/utils/environmentAdapter';

const headerSource = readFileSync(new URL('../src/components/Header.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const calculatorSource = readFileSync(new URL('../src/components/ConcentrationCalculator.tsx', import.meta.url), 'utf8');

const environment: UserEnvironmentProfile = {
  countryCode: 'EG',
  countryNameAr: 'مصر',
  countryNameEn: 'Egypt',
  countryFlag: '🇪🇬',
  currencyCode: 'EGP',
  currencySymbolAr: 'ج.م',
  currencySymbolEn: 'EGP',
  regionId: 'north-africa',
  climateType: 'hot_arid',
  climateLabelAr: 'حار وجاف',
  climateLabelEn: 'Hot and dry',
  recommendedConcentrationPercent: 20,
  recommendedConcentrationType: 'edp',
  recommendedFixativePercent: 2,
  climateAdviceAr: 'اختبار',
  climateAdviceEn: 'Test',
};

function renderHeader(currentUser: React.ComponentProps<typeof Header>['currentUser'] = null, currentLang: SupportedLanguage = 'ar') {
  return renderToStaticMarkup(React.createElement(Header, {
    activeTab: 'concentration',
    setActiveTab: () => {},
    onOpenPrintModal: () => {},
    currentLang,
    onSelectLanguage: () => {},
    onAutoDetectLanguage: () => {},
    currentUser,
    onOpenAuthModal: () => {},
    onLogout: () => {},
    currentEnvironment: environment,
    onOpenEnvironmentModal: () => {},
    onOpenPrivacyModal: () => {},
    onOpenProfilePage: () => {},
  }));
}

test('mobile header keeps its actions compact and navigation reachable by touch and keyboard', () => {
  const markup = renderHeader();
  assert.match(markup, /class="hidden sm:flex[^\"]*bg-amber-800/, 'the duplicate quick-home action stays off the narrow header row');
  assert.match(markup, /class="hidden sm:inline-flex[^\"]*font-mono/, 'currency detail yields to the country flag on narrow screens');
  assert.match(markup, /role="region" aria-label="اسحب أفقياً لاستعراض بقية عناصر التنقل" tabindex="0"/);
  assert.match(markup, /overflow-x-auto[^\"]*no-scrollbar/);
  assert.match(markup, /aria-hidden="true" class="pointer-events-none absolute inset-y-2 start-0/);
  assert.match(markup, /aria-label="التنقل الرئيسي" class="xl:hidden relative"/);
});

test('user formulations are reachable from both the calculator list and the tools menu', () => {
  assert.match(calculatorSource, /onNavigateToTab\('library'\)/);
  assert.match(calculatorSource, /uiLabel\('user_formulations', effectiveLang\)/);
  const toolsGroup = headerSource.split("id: 'tools'")[1]?.split("id: 'explore'")[0] || '';
  assert.match(toolsGroup, /id: 'library', label: uiLabel\('user_formulations', currentLang\)/);
  assert.match(appSource, /activeTab === 'library'/, 'the library route still renders the saved formulations page');
});

test('audited Icelandic, Albanian and Pashto navigation labels no longer fall back to English', () => {
  const cases: Record<'is' | 'sq' | 'ps', string[]> = {
    is: ['Verkfæri', 'Skoða', 'Samfélag', 'Verslun', 'Skrunaðu lárétt', 'Aðalvalmynd', 'Öll tungumál'],
    sq: ['Mjetet', 'Eksploro', 'Komuniteti', 'Dyqani', 'Rrëshqit horizontalisht', 'Navigimi kryesor', 'Të gjitha gjuhët'],
    ps: ['وسایل', 'سپړنه', 'ټولنه', 'پلورنځی', 'افقي سکرول', 'اصلي نیویګیشن', 'ټولې ژبې'],
  };
  for (const [language, labels] of Object.entries(cases) as Array<[keyof typeof cases, string[]]>) {
    const markup = renderHeader(null, language);
    for (const label of labels) assert.ok(markup.includes(label), `${language} header is missing: ${label}`);
  }
});

test('the mobile profile shortcut remains available from the account menu', () => {
  const markup = renderHeader({
    id: 'member-1',
    name: 'Perfumer',
    email: 'perfumer@example.test',
    craftLevel: 'hobbyist',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  assert.match(markup, /aria-haspopup="true" aria-expanded="false"/);
  assert.match(markup, /class="hidden sm:flex[^\"]*bg-emerald-700/);
  assert.match(headerSource, /setIsUserMenuOpen\(false\);\s*onOpenProfilePage\(\)/, 'the user menu still routes to the profile page');
});

test('toast status is announced, wraps long localized text, and does not intercept taps', () => {
  const markup = renderToStaticMarkup(React.createElement(ToastNotification, { message: 'تم تغيير اللغة إلى العربية' }));
  assert.match(markup, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(markup, /pointer-events-none fixed left-1\/2/);
  assert.match(markup, /top:calc\(/);
  assert.match(markup, /dir="auto" class="min-w-0 break-words"/);
  assert.equal(renderToStaticMarkup(React.createElement(ToastNotification, { message: null })), '');
});

test('language-change notices use the destination language and replace stale dismissal timers', () => {
  assert.match(appSource, /makeT\(lang, S\)\('toast_lang_tpl'\)/);
  assert.match(appSource, /makeT\(geo\.detectedLanguage, S\)\('toast_geo_tpl'\)/);
  assert.match(appSource, /Tungumáli vettvangsins var breytt í/);
  assert.match(appSource, /Gjuha e platformës u ndryshua në/);
  assert.match(appSource, /د پلیټفارم ژبه بدله شوه/);
  assert.match(appSource, /if \(toastTimeoutRef\.current\) clearTimeout\(toastTimeoutRef\.current\)/);
  assert.match(appSource, /toastTimeoutRef\.current = setTimeout\(/);
});
