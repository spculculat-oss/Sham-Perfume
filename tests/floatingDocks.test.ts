import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FLOATING_DOCKS_KEY,
  FLOATING_DOCK_IDS,
  __resetDockCacheForTests,
  clampOffset,
  getDockStates,
  moveDock,
  placementOf,
  readDockStates,
  registerDock,
  mountedDocks,
  resetAllDocks,
  setDockHidden,
  showAllDocks,
  subscribeDocks,
} from '../src/utils/floatingDocks';

const memory = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => { memory.set(k, v); },
    removeItem: (k: string) => { memory.delete(k); },
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};

test('every floating icon on the site is wrapped in the movable, hideable dock', () => {
  const wrapped: Record<string, string> = {
    shaheen: 'src/components/PerfumerAIChatbot.tsx',
    assistant: 'src/assistant/ShamAssistant.tsx',
    specialists: 'src/components/SpecialistsHub.tsx',
    messenger: 'src/community/FloatingMessengerDock.tsx',
    spec_close: 'src/components/ManufacturingSpecSheet.tsx',
  };
  assert.deepEqual(Object.keys(wrapped).sort(), [...FLOATING_DOCK_IDS].sort());
  for (const [id, file] of Object.entries(wrapped)) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(src, new RegExp(`<FloatingDock id="${id}"`), `${file} wraps its launcher`);
  }
  // The manager (bring back / reset) is on the public site and in the admin screens.
  assert.match(readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), /<FloatingDockManager lang=\{currentLang\} \/>/);
  assert.match(readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8'), /<FloatingDockManager /);
  const dock = readFileSync(new URL('../src/components/FloatingDock.tsx', import.meta.url), 'utf8');
  assert.match(dock, /onClickCapture/, 'a drag never counts as a tap');
  assert.match(dock, /window\.addEventListener\('pointermove'/, 'a quick finger is followed on the window');
  assert.match(dock, /touch-none/, 'a finger drag moves the icon, not the page');
});

test('clampOffset keeps an icon fully on screen, whatever the drag', () => {
  const base = { left: 300, top: 754, width: 66, height: 66 };
  assert.deepEqual(clampOffset(base, -200, -400, 390, 844), { dx: -200, dy: -400 });
  assert.deepEqual(clampOffset(base, -5000, -5000, 390, 844), { dx: 10 - 300, dy: 10 - 754 });
  assert.deepEqual(clampOffset(base, 5000, 5000, 390, 844), { dx: 390 - 10 - 366, dy: 844 - 10 - 820 });
  // A screen smaller than the icon: pinned to the start edge instead of an impossible range.
  assert.deepEqual(clampOffset({ left: 0, top: 0, width: 500, height: 40 }, 50, 0, 300, 600), { dx: 10, dy: 10 });
});

test('positions and hidden icons are remembered in this browser, shown again and reset', () => {
  memory.clear();
  __resetDockCacheForTests();
  let heard = 0;
  const stop = subscribeDocks(() => { heard += 1; });
  const unregister = registerDock('assistant');
  assert.deepEqual(mountedDocks(), ['assistant']);

  moveDock('shaheen', -120.4, -300.6);
  setDockHidden('assistant', true);
  setDockHidden('specialists', true);
  assert.deepEqual(placementOf('shaheen'), { dx: -120, dy: -301, hidden: false });
  assert.equal(placementOf('assistant').hidden, true);
  assert.ok(heard >= 4);

  __resetDockCacheForTests();
  memory.set(FLOATING_DOCKS_KEY, memory.get(FLOATING_DOCKS_KEY)!);
  assert.deepEqual(readDockStates(memory.get(FLOATING_DOCKS_KEY)), getDockStates());
  assert.equal(placementOf('assistant').hidden, true, 'survives a reload');

  showAllDocks();
  assert.equal(placementOf('assistant').hidden, false);
  assert.equal(placementOf('specialists').hidden, false);
  assert.equal(placementOf('shaheen').dx, -120, 'showing does not move anything');

  resetAllDocks();
  assert.deepEqual(getDockStates(), {});
  assert.equal(memory.has(FLOATING_DOCKS_KEY), false, 'nothing left behind once everything is back');
  unregister();
  stop();
});

test('a broken or foreign saved value never breaks the page', () => {
  assert.deepEqual(readDockStates('not json'), {});
  assert.deepEqual(readDockStates('[1,2]'), {});
  assert.deepEqual(readDockStates(JSON.stringify({ evil: { dx: 1 }, shaheen: { dx: 'x', dy: 5, hidden: 'yes' } })), { shaheen: { dx: 0, dy: 5, hidden: false } });
});
