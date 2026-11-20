import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('the visitor clock stays in the shared shell, with the news desk above it only on the news route', () => {
  const header = app.indexOf('<Header');
  const clock = app.indexOf('{!inNews && clockDashboard}');
  const firstTabContent = app.indexOf("{activeTab === 'studio' && (");
  assert.ok(header >= 0 && clock > header && firstTabContent > clock, 'regular routes still have the clock just below the header');
  assert.match(app, /const inNews = activeTab === 'perfume_news';/);
  assert.match(app, /const clockDashboard = <VisitorLocalDashboard currentLang=\{currentLang\} showHomeDetails=\{activeTab === 'home'\}/);
  const news = app.indexOf('<WorldPerfumeNews');
  const clockBelow = app.indexOf('{inNews && clockDashboard}');
  assert.ok(news >= 0 && clockBelow > news, 'the same shared clock remains available underneath the news desk');
  assert.match(app.slice(clockBelow), /<Footer\b/, 'the clock remains above the shared footer');
});
