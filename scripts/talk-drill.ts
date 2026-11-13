/**
 * «تمارين الكلام الطبيعي»: runs whole voice conversations (tests/fixtures/talkDrills.ts) through what the voice
 * conversation really does — who the words are for, «كمّل», the mood, and the written reply turned into talk — and
 * scores each spoken turn with the naturalness meter (src/utils/talkScore.ts).
 * `npm run voice:talk` prints the scoreboard for both sets and the worst turns of the training set.
 */
import { TALK_TRAINING, TALK_HELDOUT, TALK_EXAM2, TALK_EXAM3, type Drill } from '../tests/fixtures/talkDrills';
import { spokenReply, wantsMore } from '../src/utils/spokenReply';
import { talkScore } from '../src/utils/talkScore';
import { addressee, settleUnsure } from '../src/utils/turnTaking';
import { moodOf } from '../src/utils/voiceMood';

export interface DrillPart { name: string; right: number; total: number; misses: string[] }
export interface DrillReport { conversations: number; turns: number; averageScore: number; parts: DrillPart[]; worst: string[] }

export function runTalkDrill(set: readonly Drill[]): DrillReport {
  const parts: Record<string, DrillPart> = {};
  const part = (name: string) => (parts[name] ||= { name, right: 0, total: 0, misses: [] });
  const mark = (name: string, ok: boolean, why: string) => { const p = part(name); p.total += 1; if (ok) p.right += 1; else p.misses.push(why); };
  const scored: Array<{ score: number; line: string }> = [];
  let turns = 0;
  for (const drill of set) {
    const said: string[] = [];
    let rest = '';
    for (const turn of drill.turns) {
      turns += 1;
      const where = `${drill.id} «${turn.said}»`;
      if (turn.expect.action === 'aside') {
        const to = addressee(turn.said).to;
        const decided = to === 'unsure' ? settleUnsure() : to;
        mark('الكلام لمين (يكمّل لو مش ليه)', decided === 'other', `${where} → ${to}`);
        continue;
      }
      said.push(turn.said);
      if (turn.expect.mood) {
        const mood = moodOf(said);
        mark('المزاج', mood === turn.expect.mood, `${where} → ${mood} (المطلوب ${turn.expect.mood})`);
      }
      if (turn.expect.action === 'more') {
        mark('«كمّل» مفهومة', wantsMore(turn.said), `${where} → مش فاهم إنه عايز يكمّل`);
        if (rest) {
          const next = spokenReply(rest, { language: drill.language, dialect: drill.dialect, words: 90 });
          const s = talkScore(next.say, { language: drill.language, dialect: drill.dialect });
          mark('طبيعي', s.natural, `${where} → ${s.score}: ${s.issues.join(' / ')} ⟵ «${next.say}»`);
          scored.push({ score: s.score, line: `${s.score} ${where} ⟵ «${next.say}» [${s.issues.join(' / ')}]` });
          rest = next.rest;
        }
        continue;
      }
      if (!turn.written) continue;
      const spoken = spokenReply(turn.written, { language: drill.language, dialect: drill.dialect, words: 90, opener: true });
      rest = spoken.rest;
      const s = talkScore(spoken.say, { language: drill.language, dialect: drill.dialect });
      mark('طبيعي', s.natural, `${where} → ${s.score}: ${s.issues.join(' / ')} ⟵ «${spoken.say}»`);
      mark('الطول', !s.issues.some((i) => i.startsWith('طويل')), `${where} → طويل`);
      if (turn.expect.refer) mark('السياق (بيسمّي اللي اتسأل عنه)', spoken.say.includes(turn.expect.refer), `${where} → ما ذكرش «${turn.expect.refer}» ⟵ «${spoken.say}»`);
      scored.push({ score: s.score, line: `${s.score} ${where} ⟵ «${spoken.say}» [${s.issues.join(' / ')}]` });
    }
  }
  const averageScore = scored.length ? Math.round((scored.reduce((sum, x) => sum + x.score, 0) / scored.length) * 10) / 10 : 0;
  return {
    conversations: set.length, turns, averageScore, parts: Object.values(parts),
    worst: [...scored].sort((a, b) => a.score - b.score).slice(0, 25).map((x) => x.line),
  };
}

export const runTalkTraining = () => runTalkDrill(TALK_TRAINING);
export const runTalkHeldout = () => runTalkDrill(TALK_HELDOUT);
export const runTalkExam2 = () => runTalkDrill(TALK_EXAM2);
export const runTalkExam3 = () => runTalkDrill(TALK_EXAM3);

const print = (title: string, report: DrillReport, worst: boolean) => {
  console.log(`\n${title}: ${report.conversations} محادثة، ${report.turns} دور — متوسط الطبيعية ${report.averageScore}/100`);
  for (const p of report.parts) console.log(`  ${p.name}: ${p.right}/${p.total} (${Math.round((p.right / p.total) * 100)}%)`);
  if (worst) for (const line of report.worst) console.log(`    ${line}`);
};
if (process.argv[1] && /talk-drill\.ts$/.test(process.argv[1])) {
  print('تمارين التدريب', runTalkTraining(), process.argv.includes('--worst'));
  print('الامتحان (محادثات مخفية)', runTalkHeldout(), process.argv.includes('--worst-exam'));
  print('الامتحان التاني (لهجات وأسلوب جديد)', runTalkExam2(), process.argv.includes('--worst-exam2'));
  print('الامتحان التالت (اتكتب في الآخر)', runTalkExam3(), process.argv.includes('--worst-exam3'));
}
