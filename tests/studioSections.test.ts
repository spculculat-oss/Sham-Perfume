import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// «وصل الجديد من جوجل استوديو بدون ما نمسح القديم»: the Studio's new sections (designer lab, AR/3D studio,
// 3D pyramid, harmony analyzer) are wired into our site additively, and nothing we already had was removed.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const STUDIO_COMPONENTS = [
  'src/components/PerfumerDesignerLab.tsx',
  'src/components/OlfactoryHarmonyAnalyzer.tsx',
  'src/components/ThreePerfumeStudio.tsx',
  'src/components/FragrancePyramidAR3D.tsx',
  'src/components/DesignSimulatorsAR3D.tsx',
  'src/components/HomeARPortals.tsx',
  'src/components/AR3DSpatialStage.tsx',
  'src/components/LuxuryPortalIcon.tsx',
  'src/utils/designerSimulationEngine.ts',
];

test('every new Studio section exists and is loaded on demand, never in the first bundle', () => {
  for (const file of STUDIO_COMPONENTS) assert.ok(read(file).length > 100, `${file} exists`);
  const app = read('src/App.tsx');
  assert.match(app, /lazy\(\(\) => import\('\.\/components\/PerfumerDesignerLab'\)/, 'designer lab is lazy');
  assert.match(app, /lazy\(\(\) => import\('\.\/components\/ThreePerfumeStudio'\)/, '3D studio is lazy');
  assert.match(app, /activeTab === 'designer' &&/);
  assert.match(app, /activeTab === 'studio_3d' &&/);
  const pyramid = read('src/components/PyramidCalculator.tsx');
  assert.match(pyramid, /lazy\(\(\) => import\('\.\/FragrancePyramidAR3D'\)/, 'the AR pyramid is lazy too');
  assert.match(pyramid, /setViewMode\('ar3d'\)/);
});

test('what the site already had is still there — the Studio added sections, it did not replace them', () => {
  const app = read('src/App.tsx');
  for (const tab of ['master_ai', 'islamic_library', 'workspace', 'community', 'perfume_news', 'library']) {
    assert.match(app, new RegExp(`'${tab}'`), `the ${tab} section is still routed`);
  }
  const header = read('src/components/Header.tsx');
  for (const group of ["id: 'home'", "id: 'perfumes'", "id: 'cosmetics'", "id: 'tools'", "id: 'explore'", "id: 'master_ai'"]) {
    assert.ok(header.includes(group), `${group} is still in the navigation`);
  }
  assert.match(header, /id: 'designer'/);
  assert.match(header, /id: 'studio_3d'/);
  assert.match(header, /ISLAMIC_LIBRARY_TITLE/, 'the Islamic library link is kept');
  assert.match(header, /ps: 'د کارن حساب مینو'/, 'the 13-language header strings are kept');
});

test('the Studio’s extra libraries are declared for the real runtime', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  for (const name of ['three', '@react-three/fiber', '@react-three/drei']) {
    assert.ok(pkg.dependencies[name], `${name} is a dependency`);
  }
  assert.ok(pkg.devDependencies['@types/three'], 'the three types are declared');
});

test('the new lab reads and writes the same formulation state as the rest of the site', () => {
  const app = read('src/App.tsx');
  const start = app.indexOf('<PerfumerDesignerLab');
  const lab = app.slice(start, start + 900);
  for (const prop of ['formulaTitle={formulaTitle}', 'formulation={formulation}', 'pyramidNotes={pyramidNotes}', 'macerationDays={macerationDays}']) {
    assert.ok(lab.includes(prop), prop);
  }
});

test('the 3D room and the AR simulators are optional views inside our own pages', () => {
  const hub = read('src/components/HomeHub.tsx');
  assert.match(hub, /lazy\(\(\) => import\('\.\/HomeARPortals'\)/);
  assert.match(hub, /portalViewMode/, 'the visitor picks grid, both or the 3D room');
  assert.match(hub, /ZONE 4: THE 12 DYNAMIC PORTAL WINDOWS/, 'our portal grid is still the default view');
  const master = read('src/components/PerfumerMasterLabView.tsx');
  assert.match(master, /OlfactoryHarmonyAnalyzer/, 'the harmony analyzer is offered in the master lab');
  assert.match(master, /onApplyToPyramidCalculator=\{onApplyToPyramidCalculator\}/, 'and it feeds our pyramid tool');
});
