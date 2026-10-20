// The bots publish through scripts/ci/publish.mjs. git prints non-ASCII paths quoted and escaped by default,
// which made every publish of the translator's packs (src/لغات/ai) crash — the translations never reached main.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const PUBLISH = resolve('scripts/ci/publish.mjs');
const run = (cwd: string, cmd: string, args: string[]) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const clone = (root: string, origin: string, name: string) => {
  run(root, 'git', ['clone', '-q', origin, name]);
  const dir = join(root, name);
  run(dir, 'git', ['config', 'user.email', 'bot@example.com']);
  run(dir, 'git', ['config', 'user.name', 'bot']);
  return dir;
};

test('publish.mjs publishes files under an Arabic folder, also when another bot pushed the same file first', () => {
  const root = mkdtempSync(join(tmpdir(), 'publish-ar-'));
  try {
    const origin = join(root, 'origin.git');
    run(root, 'git', ['init', '-q', '--bare', '-b', 'main', origin]);
    const a = clone(root, origin, 'a');
    run(a, 'git', ['checkout', '-q', '-b', 'main']);
    writeFileSync(join(a, 'seed.json'), '{}\n');
    run(a, 'git', ['add', '.']); run(a, 'git', ['commit', '-qm', 'seed']); run(a, 'git', ['push', '-q', 'origin', 'main']);

    const pack = join('src', 'لغات', 'ai');
    mkdirSync(join(a, pack), { recursive: true });
    writeFileSync(join(a, pack, 'fr.json'), '{"x":1}\n');
    assert.match(run(a, 'node', [PUBLISH, 'first', pack]), /Published on main/);

    const b = clone(root, origin, 'b');
    writeFileSync(join(b, pack, 'fr.json'), '{"x":"other bot"}\n');
    run(b, 'git', ['commit', '-qam', 'other bot']); run(b, 'git', ['push', '-q', 'origin', 'main']);

    writeFileSync(join(a, pack, 'fr.json'), '{"x":"this run"}\n');
    writeFileSync(join(a, pack, 'de.json'), '{"y":1}\n');
    assert.match(run(a, 'node', [PUBLISH, 'second', pack]), /Published on main/);

    const check = clone(root, origin, 'check');
    assert.equal(readFileSync(join(check, pack, 'fr.json'), 'utf8'), '{"x":"this run"}\n');
    assert.equal(readFileSync(join(check, pack, 'de.json'), 'utf8'), '{"y":1}\n');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
