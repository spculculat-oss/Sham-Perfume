/**
 * «مفتاح صاحب الموقع» — the first job of every robot's workflow asks here whether the owner lets it run:
 *   node scripts/owner/gate.mjs <bot id>...   (the robots that share this workflow)
 * Stopped when the owner froze every robot or paused one of them (src/data/owner/controls.json, changed only
 * from his GitHub account through «مكتب صاحب الموقع»). Branch rehearsals and pull-request checks always run:
 * the switches govern what robots do on the live site. Plain Node, no dependencies (runs before any install).
 */
import { appendFileSync, readFileSync } from 'node:fs';

const bots = process.argv.slice(2);
let controls = {};
try { controls = JSON.parse(readFileSync(new URL('../../src/data/owner/controls.json', import.meta.url), 'utf8')); }
catch { console.log('::warning title=مفتاح صاحب الموقع::controls.json unreadable — running as usual'); }
const live = (process.env.GITHUB_REF || 'refs/heads/main') === 'refs/heads/main';
const paused = Array.isArray(controls.paused) ? bots.filter((b) => controls.paused.includes(b)) : [];
const stopped = live && (controls.frozen === true || paused.length > 0);
const why = controls.frozen === true ? 'كل الروبوتات موقوفة بأمر صاحب الموقع (فرامل الطوارئ)' : `موقوف بأمر صاحب الموقع: ${paused.join('، ')}`;
if (stopped) console.log(`::notice title=مفتاح صاحب الموقع::${why} — مش هيشتغل لحد ما صاحب الموقع يرجعه`);
else console.log(`Owner's switch: ${bots.join(', ') || 'robot'} may run`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `allowed=${stopped ? 'false' : 'true'}\n`);
