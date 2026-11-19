/**
 * «مفتاح صاحب الموقع» — the first job of every robot's workflow asks here whether the owner lets it run:
 *   node scripts/owner/gate.mjs <bot id>...   (the robots that share this workflow)
 * Stopped when the owner froze every robot or paused one of them (src/data/owner/controls.json, changed only
 * from his GitHub account through «مكتب صاحب الموقع»), or when «دولة المنصة» paused it (src/data/owner/state-orders.json,
 * written only by the State's robot; the owner's «رجّع» from his desk clears it). Branch rehearsals and pull-request checks always run:
 * the switches govern what robots do on the live site. Plain Node, no dependencies (runs before any install).
 * The rule itself is in gateRule.mjs — the robots' server (scripts/robots) asks the same one.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { ownerDecision } from './gateRule.mjs';

const bots = process.argv.slice(2);
let controls = {};
try { controls = JSON.parse(readFileSync(new URL('../../src/data/owner/controls.json', import.meta.url), 'utf8')); }
catch { console.log('::warning title=مفتاح صاحب الموقع::controls.json unreadable — running as usual'); }
let stateOrders = {};
try { stateOrders = JSON.parse(readFileSync(new URL('../../src/data/owner/state-orders.json', import.meta.url), 'utf8')); }
catch { /* no orders from the State */ }
const live = (process.env.GITHUB_REF || 'refs/heads/main') === 'refs/heads/main';
const { allowed, why, who } = ownerDecision(bots, controls, stateOrders, live);
if (!allowed) console.log(`::notice title=مفتاح صاحب الموقع::${why} — مش هيشتغل لحد ما ${who} يرجعه`);
else console.log(`Owner's switch: ${bots.join(', ') || 'robot'} may run`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `allowed=${allowed ? 'true' : 'false'}\n`);
