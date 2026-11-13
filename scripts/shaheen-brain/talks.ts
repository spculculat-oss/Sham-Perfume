/**
 * «مختبر عقل شاهين» — Shaheen's own way with people, as training conversations.
 * Every case of his relations engine (src/utils/shaheenRelations.ts: late order, damaged bottle, anger, gifts …) and
 * every field drill (src/utils/maneuverDrills.ts) is run through his own brain; only conversations that pass their
 * own grading and stay on the relations route (no product list, so no price) become examples. Pure: no network.
 */
import { RELATIONS_DRILLS, relationsAnswer, runDrills } from '../../src/utils/shaheenRelations';
import { MANEUVER_DRILLS, brainReply, gradeTurn } from '../../src/utils/maneuverDrills';
import type { StoreProduct } from '../../src/utils/storeCatalog';
import type { RelationsTalk } from './dataset';

type Turn = { role: 'user' | 'assistant'; text: string };

export function relationsTalks(products: StoreProduct[]): RelationsTalk[] {
  const talks: RelationsTalk[] = [];
  const graded = runDrills(RELATIONS_DRILLS).results;
  RELATIONS_DRILLS.forEach((d, i) => {
    if (!graded[i]?.passed) return;
    const a = relationsAnswer({ text: d.say, followUp: false, said: [d.say] }, d.lang);
    if (a) talks.push({ lang: d.lang, turns: [{ user: d.say, assistant: a.reply }] });
  });
  for (const drill of MANEUVER_DRILLS) {
    if (drill.language !== 'ar' && drill.language !== 'en') continue;
    const history: Turn[] = [];
    const turns: RelationsTalk['turns'] = [];
    let previousReply: string | undefined;
    let clean = true;
    drill.turns.forEach((t, index) => {
      if (!clean) return;
      const say = typeof t === 'string' ? t : t.say;
      const mine = brainReply(products, say, history, drill.language);
      if (!mine || !mine.route.startsWith('relations:')) { clean = false; return; }
      if (gradeTurn({ drill, index, reply: mine.reply, route: mine.route, previousReply, source: 'brain', offline: true }).length) { clean = false; return; }
      turns.push({ user: say, assistant: mine.reply });
      history.push({ role: 'user', text: say }, { role: 'assistant', text: mine.reply });
      previousReply = mine.reply;
    });
    if (clean && turns.length) talks.push({ lang: drill.language, turns });
  }
  return talks;
}
