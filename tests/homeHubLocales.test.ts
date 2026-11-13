import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeHub } from '../src/components/HomeHub';
import type { SupportedLanguage } from '../src/types/i18n';
import type { FormulationState } from '../src/types/perfume';
import type { UserDetailedAddress } from '../src/types/address';
import { REGIONAL_ENVIRONMENTS } from '../src/utils/environmentAdapter';

const formulation: FormulationState = {
  bottleVolumeMl: 50,
  batchCount: 1,
  concentrationPercent: 20,
  concentrationType: 'edp',
  alcoholPercentage: 80,
  waterPercent: 0,
  fixativePercent: 2,
  oilDensity: 0.9,
  alcoholDensity: 0.79,
  unitMode: 'ml',
};

const detailedAddress: UserDetailedAddress = {
  facilityName: '',
  facilityType: 'home_studio',
  countryCode: 'EG',
  cityName: '',
  districtName: '',
  streetAddress: '',
  postalCode: '',
  taxOrCommercialId: '',
  phone: '',
  email: '',
};

function renderHomeHub(currentLang: SupportedLanguage) {
  const originalConsoleError = console.error;
  console.error = (...args: Parameters<typeof console.error>) => {
    if (String(args[0]).startsWith('An empty string (')) return;
    originalConsoleError(...args);
  };

  try {
    return renderToStaticMarkup(React.createElement(HomeHub, {
      onNavigate: () => {},
      currentLang,
      formulation,
      pyramidNotes: [],
      savedFormulas: [],
      currentEnvironment: REGIONAL_ENVIRONMENTS.egypt,
      detailedAddress,
      currentUser: null,
      onOpenEnvironmentModal: () => {},
      onOpenPrivacyModal: () => {},
      onOpenAuthModal: () => {},
      onOpenSpecModal: () => {},
    }));
  } finally {
    console.error = originalConsoleError;
  }
}

test('home hub hero, live status, filters and portal actions use Icelandic, Albanian and Pashto', () => {
  const cases: Record<'is' | 'sq' | 'ps', { labels: string[] }> = {
    is: {
      labels: [
        'Samþætt stjórnstöð fyrir allar rannsóknarstofu- og ilmvatnsgáttir',
        'Hannaðu ilmvatnið þitt með Sham',
        'Samstillt í beinni',
        'Alþjóðlegir ilmstraumar',
        'Opna reiknivél rannsóknarstofu',
        'Opna gátt',
        'Allar gáttir (12)',
        'Rannsóknarstofa og blöndun (4)',
        'Byrja nýja formúlu',
      ],
    },
    sq: {
      labels: [
        'Qendra e integruar për të gjitha portalet e laboratorit dhe parfumerisë',
        'Dizajnoni parfumin tuaj me Sham',
        'Sinkronizim në kohë reale',
        'Prirjet globale të aromave',
        'Hap kalkulatorin e laboratorit',
        'Hyr në portal',
        'Të gjitha portalet (12)',
        'Laboratori dhe formulimi (4)',
        'Fillo një formulim të ri',
      ],
    },
    ps: {
      labels: [
        'د لابراتوار او عطرونو د ټولو پورټلونو یوځای شوی مرکز',
        'خپل عطر له شام سره ډیزاین کړئ',
        'په ژوندۍ بڼه هممهاله',
        'د عطرو نړیوال بهیرونه',
        'د لابراتوار محاسبه پرانیزئ',
        'پورټل ته ننوځئ',
        'ټول پورټلونه (12)',
        'لابراتوار او فورمول جوړونه (4)',
        'نوی فورمول پیل کړئ',
      ],
    },
  };

  for (const [language, { labels }] of Object.entries(cases) as Array<[keyof typeof cases, (typeof cases)[keyof typeof cases]]>) {
    const markup = renderHomeHub(language);
    for (const label of labels) assert.ok(markup.includes(label), `${language} home hub is missing: ${label}`);
    for (const fallback of [
      'Integrated Master Command Suite for All Laboratory & Perfume Portals',
      'Live Sync',
      'Enter Portal',
      'All Portals (12)',
      'Lab & Compounding (4)',
      'Global Fragrance Trends',
      'Open Lab Calculator',
    ]) {
      assert.ok(!markup.includes(fallback), `${language} home hub unexpectedly falls back to: ${fallback}`);
    }
  }
});

test('the world-perfume hub card labels its samples as inspired examples, never exact/original ratios', () => {
  const ar = renderHomeHub('ar');
  assert.ok(ar.includes('نسب توضيحية لا تركيبات أصلية'));
  assert.ok(ar.includes('٨ نماذج مستوحاة'));
  assert.ok(ar.includes('نموذج تعليمي مستوحى'));
  assert.ok(!ar.includes('بنسب المعمل الدقيقة'));
  assert.ok(!ar.includes('وصفة معتمدة'));

  const en = renderHomeHub('en');
  assert.ok(en.includes('illustrative proportions, not original formulas'));
  assert.ok(en.includes('8 inspired studies'));
  assert.ok(en.includes('inspired accord study'));
  assert.ok(!en.includes('exact lab ratios'));
  assert.ok(!en.includes('Master Formula'));
});
