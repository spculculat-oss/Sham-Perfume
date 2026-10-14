import assert from 'node:assert/strict';
import test from 'node:test';
import { copyChatText } from '../src/utils/clipboard';

test('copy reports success only after the browser accepts the clipboard write', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    let copied = '';
    Object.defineProperty(globalThis, 'navigator', { configurable: true,
      value: { clipboard: { writeText: async (text: string) => { copied = text; } } } });
    assert.equal(await copyChatText('My conversation'), true);
    assert.equal(copied, 'My conversation');
    Object.defineProperty(globalThis, 'navigator', { configurable: true,
      value: { clipboard: { writeText: async () => { throw new Error('Permission denied'); } } } });
    assert.equal(await copyChatText('Denied'), false);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    assert.equal(await copyChatText('Unavailable'), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete (globalThis as any).navigator;
  }
});
