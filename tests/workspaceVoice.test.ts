import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { voiceTurns, type ChatItem } from '../src/workspace/ChatPanel';

test('«صوت شاهين في المساحة»: the voice sees finished turns with steady ids, never a reply still being written', () => {
  const items: ChatItem[] = [
    { role: 'user', text: 'أهلاً' },
    { role: 'assistant', text: 'أهلاً بيك!', id: 'draft-1' },
    { role: 'user', text: 'اكتبلي قصيدة' },
    { role: 'assistant', text: 'نص لسه بيتكتب', id: 'draft-2', streaming: true },
  ];
  const turns = voiceTurns(items);
  assert.deepEqual(turns.map((t) => t.id), ['ws-user-0', 'draft-1', 'ws-user-2']);
  assert.deepEqual(voiceTurns(items).map((t) => t.id), turns.map((t) => t.id), 'the same items give the same ids (a new turn is told apart by its id)');
  const done = voiceTurns([...items.slice(0, 3), { role: 'assistant', text: 'القصيدة كاملة', id: 'draft-2' }]);
  assert.equal(done.at(-1)?.id, 'draft-2');
  assert.equal(done.at(-1)?.text, 'القصيدة كاملة');
});

test('the workspace chat carries the same voice button and stage as the site chat', () => {
  const panel = readFileSync(new URL('../src/workspace/ChatPanel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /useShaheenVoiceMode\(/);
  assert.match(panel, /<ShaheenVoiceModeButton /);
  assert.match(panel, /<ShaheenVoiceStage /);
  assert.match(panel, /voice\.beginOutgoingTurn\(\)/, 'a typed message during the voice conversation is answered aloud too');
});
