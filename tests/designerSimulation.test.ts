import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateDesignerTrial } from '../src/utils/designerSimulationEngine';
import type { FormulationState } from '../src/types/perfume';

// «جديد من جوجل استوديو»: the designer lab's IFRA/louching audit and its safety patches, in our own suite.
test('evaluateDesignerTrial detects IFRA violations, louching risk, and generates 1-click patches', () => {
  const baseFormulation: FormulationState = {
    bottleVolumeMl: 50,
    batchCount: 1,
    concentrationPercent: 25,
    concentrationType: 'extrait',
    alcoholPercentage: 96,
    waterPercent: 1,
    fixativePercent: 1.5,
    oilDensity: 0.92,
    alcoholDensity: 0.8,
    unitMode: 'grams',
  };

  // 1. Healthy formula produces valid kinetics & radar
  const healthy = evaluateDesignerTrial({
    formulation: baseFormulation,
    pyramidNotes: [
      { id: '1', nameAr: 'برغموت', nameEn: 'Bergamot FCF', category: 'top', percentageOfOil: 18 },
      { id: '2', nameAr: 'هيديون', nameEn: 'Hedione', category: 'heart', percentageOfOil: 32 },
      { id: '3', nameAr: 'أمبروكسان', nameEn: 'Ambroxan Pure', category: 'base', percentageOfOil: 50 },
    ],
    macerationDays: 35,
    ambientTempC: 25,
    humidityPct: 45,
  });
  assert.equal(healthy.evaporationCurve.length, 10);
  assert.equal(healthy.clarityStatus, 'pass');
  assert.ok(healthy.estimatedLongevityHours > 4);
  assert.ok(healthy.radar.baseTenacity >= 0 && healthy.radar.baseTenacity <= 100);

  // 2. Excess Damascenone + watery low-proof alcohol triggers critical failures & fixes
  const risky = evaluateDesignerTrial({
    formulation: {
      ...baseFormulation,
      alcoholPercentage: 80,
      waterPercent: 9,
      fixativePercent: 0,
    },
    pyramidNotes: [
      { id: 'd1', nameAr: 'داماسينون بيتا', nameEn: 'Beta Damascenone', category: 'heart', percentageOfOil: 12 },
      { id: 'd2', nameAr: 'برغموت', nameEn: 'Bergamot FCF', category: 'top', percentageOfOil: 88 },
    ],
    macerationDays: 5,
    ambientTempC: 38,
    humidityPct: 80,
  });
  assert.equal(risky.safetyVerdict, 'fail');
  assert.equal(risky.clarityStatus, 'fail');
  assert.ok(risky.suggestions.some((s) => s.area === 'safety' && s.severity === 'critical'));
  assert.ok(risky.suggestions.some((s) => s.area === 'solubility'));
});
