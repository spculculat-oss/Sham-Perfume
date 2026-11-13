import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeFormulaPayload,
  decodeFormulaPayload,
  generateFormulaShareUrl,
  formatWhatsAppShareMessage,
  buildWhatsAppLink,
  SharedFormulaPayload,
} from '../src/utils/formulaShare';

test('formulaShare - roundtrips formula payload accurately with Arabic and English', () => {
  const samplePayload: SharedFormulaPayload = {
    title: 'سلطان العود والعنبر الملكي',
    author: 'دار شام للعطور',
    batchCode: 'SHAM-ROYAL-01',
    notes: 'تعتيق فاخر في براميل البلوط لمدة 45 يوماً',
    macerationDays: 45,
    formulation: {
      bottleVolumeMl: 100,
      batchCount: 5,
      concentrationPercent: 25,
      concentrationType: 'extrait',
      alcoholPercentage: 96,
      waterPercent: 0,
      fixativePercent: 1.5,
      oilDensity: 0.94,
      alcoholDensity: 0.8,
      unitMode: 'grams',
    },
    pyramidNotes: [
      {
        id: 'n1',
        nameAr: 'برغموت إيطالي فاخر',
        nameEn: 'Calabrian Bergamot',
        category: 'top',
        percentageOfOil: 20,
        description: 'حمضيات متلألئة',
      },
      {
        id: 'n2',
        nameAr: 'ورد دمشقي طائفي',
        nameEn: 'Taif Damask Rose',
        category: 'heart',
        percentageOfOil: 30,
        description: 'قلب أرستقراطي',
      },
      {
        id: 'n3',
        nameAr: 'دهن عود براشين معتق',
        nameEn: 'Aged Prachin Oud',
        category: 'base',
        percentageOfOil: 50,
        description: 'قاعدة بخورية عميقة',
      },
    ],
  };

  const encoded = encodeFormulaPayload(samplePayload);
  assert.ok(encoded.length > 20);

  const decoded = decodeFormulaPayload(encoded);
  assert.ok(decoded);
  assert.equal(decoded.title, samplePayload.title);
  assert.equal(decoded.author, samplePayload.author);
  assert.equal(decoded.batchCode, samplePayload.batchCode);
  assert.equal(decoded.macerationDays, samplePayload.macerationDays);
  assert.equal(decoded.formulation.concentrationPercent, 25);
  assert.equal(decoded.formulation.bottleVolumeMl, 100);
  assert.equal(decoded.formulation.batchCount, 5);
  assert.equal(decoded.pyramidNotes.length, 3);
  assert.equal(decoded.pyramidNotes[0].nameAr, 'برغموت إيطالي فاخر');
  assert.equal(decoded.pyramidNotes[2].nameAr, 'دهن عود براشين معتق');
});

test('formulaShare - generateFormulaShareUrl and decodeFormulaPayload from full URL', () => {
  const samplePayload: SharedFormulaPayload = {
    title: 'أكوا بريز الصيفي',
    macerationDays: 21,
    formulation: {
      bottleVolumeMl: 50,
      batchCount: 1,
      concentrationPercent: 18,
      concentrationType: 'edp',
      alcoholPercentage: 96,
      waterPercent: 1,
      fixativePercent: 0.5,
      oilDensity: 0.9,
      alcoholDensity: 0.8,
      unitMode: 'ml',
    },
    pyramidNotes: [
      {
        id: 'note-1',
        nameAr: 'ليمون صقلي',
        nameEn: 'Sicilian Lemon',
        category: 'top',
        percentageOfOil: 100,
      },
    ],
  };

  const url = generateFormulaShareUrl(samplePayload, 'https://sham-perfumes.app/');
  assert.ok(url.startsWith('https://sham-perfumes.app/#formula?d='));

  const decoded = decodeFormulaPayload(url);
  assert.ok(decoded);
  assert.equal(decoded.title, 'أكوا بريز الصيفي');
  assert.equal(decoded.macerationDays, 21);
});

test('formulaShare - formatWhatsAppShareMessage and buildWhatsAppLink', () => {
  const samplePayload: SharedFormulaPayload = {
    title: 'روح المسك الأبيض',
    batchCode: 'SHAM-MSK-99',
    macerationDays: 30,
    formulation: {
      bottleVolumeMl: 50,
      batchCount: 2,
      concentrationPercent: 20,
      concentrationType: 'edp',
      alcoholPercentage: 96,
      waterPercent: 0,
      fixativePercent: 0,
      oilDensity: 0.92,
      alcoholDensity: 0.8,
      unitMode: 'grams',
    },
    pyramidNotes: [
      { id: '1', nameAr: 'مسك أبيض نقي', nameEn: 'White Musk', category: 'base', percentageOfOil: 100 },
    ],
  };

  const shareUrl = 'https://sham-perfumes.app/#formula?d=test1234';
  const msgAr = formatWhatsAppShareMessage(samplePayload, shareUrl, 'ar');
  assert.ok(msgAr.includes('روح المسك الأبيض'));
  assert.ok(msgAr.includes('SHAM-MSK-99'));
  assert.ok(msgAr.includes(shareUrl));
  assert.ok(msgAr.includes('واتساب') || msgAr.includes('مختبر وحاسبة شام للعطور'));

  const link = buildWhatsAppLink(msgAr);
  assert.ok(link.startsWith('https://api.whatsapp.com/send?text='));
  assert.ok(link.includes('%D8%B1%D9%88%D8%AD')); // Encoded Arabic text
});
