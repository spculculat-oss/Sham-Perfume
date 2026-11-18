import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('the visitor clock bar belongs to the shared shell and is not restricted to the home tab', () => {
  const header = app.indexOf('<Header');
  const clock = app.indexOf('<VisitorLocalDashboard currentLang={currentLang} />');
  const firstTabContent = app.indexOf("{activeTab === 'studio' && (");
  assert.ok(header >= 0 && clock > header && firstTabContent > clock, 'the clock bar should follow the global header and precede tab-specific content');
  assert.doesNotMatch(app, /activeTab\s*===\s*'home'\s*&&\s*<VisitorLocalDashboard/, 'the clock bar must remain visible on other routes');
});
