/**
 * «مكتب صاحب الموقع» — applies one order of the owner to src/data/owner/controls.json.
 *   OWNER_ACTION=pause OWNER_BOT=news OWNER_BY=<github login> node --import tsx scripts/owner/control.mts
 * The workflow (owner-control.yml) runs only for the repository owner's own GitHub account and then publishes
 * the file; every robot's first job reads it (scripts/owner/gate.mjs).
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { BOTS, type BotId } from '../../src/utils/shaheenOrg';
import { applyOwnerCommand, OWNER_ACTIONS, readControls, type OwnerAction } from '../../src/utils/ownerAuthority';

const FILE = 'src/data/owner/controls.json';
const action = (process.env.OWNER_ACTION || '') as OwnerAction;
const botRaw = (process.env.OWNER_BOT || '').trim();
const by = (process.env.OWNER_BY || 'owner').trim();
const out = (k: string, v: string) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };

if (!(action in OWNER_ACTIONS)) { console.error(`::error::Unknown order «${action}»`); process.exit(2); }
const bot = botRaw && botRaw !== 'none' ? (BOTS.find((b) => b.id === botRaw)?.id as BotId | undefined) : undefined;
if (botRaw && botRaw !== 'none' && !bot) { console.error(`::error::Unknown robot «${botRaw}»`); process.exit(2); }

const before = readControls(JSON.parse(readFileSync(FILE, 'utf8')));
const { controls, changed, noteAr } = applyOwnerCommand(before, action, bot, by);
const name = bot ? BOTS.find((b) => b.id === bot)?.nameAr ?? bot : '';
const line = `${OWNER_ACTIONS[action]}${name ? ` — ${name}` : ''}: ${noteAr}`;
if ((action === 'pause' || action === 'resume') && !bot) { console.error(`::error::${noteAr}`); process.exit(2); }
if (changed) writeFileSync(FILE, `${JSON.stringify(controls, null, 1)}\n`);
console.log(`::notice title=أمر صاحب الموقع::${line}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const paused = controls.paused.map((id) => `- ${BOTS.find((b) => b.id === id)?.nameAr ?? id}`).join('\n') || '- مفيش';
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## أمر صاحب الموقع\n\n${line}\n\n**فرامل الطوارئ:** ${controls.frozen ? 'شغالة (كل الروبوتات واقفة)' : 'مش شغالة'}\n\n**التطوير الذاتي:** ${controls.selfDevelopment === 'safe_auto' ? 'الصغير الآمن تلقائي، والباقي بموافقتك' : 'كل تغيير بموافقتك'}\n\n**الروبوتات الموقوفة:**\n${paused}\n`);
}
out('changed', changed ? 'true' : 'false');
