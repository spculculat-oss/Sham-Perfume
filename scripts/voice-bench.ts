/**
 * «مقياس شاهين الصوتي»: scores the voice conversation on the training corpus (turn ends, who is being spoken to,
 * misheard words, clean sentences left alone, his own echo). `npm run voice:bench` prints the scoreboard and every miss.
 */
import { TURN_CASES, ADDRESS_CASES, CLEAN_SENTENCES, MISHEARD_CASES, ECHO_CASES } from '../tests/fixtures/voiceCorpus';
import { addressee, turnState } from '../src/utils/turnTaking';
import { planVoiceTurn } from '../src/utils/heardFix';
import { bargeIn } from '../src/utils/shaheenVoice';

export interface BenchScore { name: string; right: number; total: number; misses: string[] }
const score = (name: string, results: Array<[boolean, string]>): BenchScore => ({
  name, right: results.filter(([ok]) => ok).length, total: results.length, misses: results.filter(([ok]) => !ok).map(([, why]) => why),
});

export function runVoiceBench(): BenchScore[] {
  return benchOn({ turns: TURN_CASES, address: ADDRESS_CASES, clean: CLEAN_SENTENCES, misheard: MISHEARD_CASES, echo: ECHO_CASES });
}

interface Corpus {
  turns: typeof TURN_CASES; address: typeof ADDRESS_CASES; clean: readonly string[]; misheard: typeof MISHEARD_CASES; echo: typeof ECHO_CASES;
}
function benchOn({ turns, address, clean, misheard, echo }: Corpus): BenchScore[] {
  const language = (text: string) => (/[a-z]/i.test(text) && !/[\u0600-\u06FF]/u.test(text) ? (/[éèàç]|livraison|parfum|coûte/u.test(text) ? 'fr' : 'en') : 'ar') as 'ar' | 'en' | 'fr';
  return [
    score('نهاية كلام الزائر', turns.map(([said, want, options]) => { const got = turnState(said, options); return [got === want, `«${said}» → ${got} (المطلوب ${want})`]; })),
    score('الكلام موجّه لمين', address.map(([said, want]) => { const got = addressee(said).to; return [got === want, `«${said}» → ${got} (المطلوب ${want})`]; })),
    score('جمل سليمة متتلمسش', clean.map((said) => {
      const plan = planVoiceTurn(said, { language: language(said) });
      const ok = plan.action === 'send' && plan.text === said;
      return [ok, `«${said}» → ${plan.action === 'send' ? plan.text : `${plan.action}: ${plan.say}`}`];
    })),
    score('كلمات اتسمعت غلط', misheard.map(({ said, meant, context }) => {
      const plan = planVoiceTurn(said, { language: language(said), ...(context ? { context: [context] } : {}) });
      // Fixed at once, or asked about with the right word: both count (asking is right when unsure).
      const right = meant.split('|');
      const ok = (plan.action === 'send' && right.includes(plan.text)) || (plan.action === 'ask' && right.includes(plan.pending.corrected));
      return [ok, `«${said}» → ${plan.action === 'send' ? plan.text : plan.action === 'ask' ? `سؤال: ${plan.pending.corrected}` : plan.say} (المطلوب «${meant}»)`];
    })),
    score('صدى صوته مش مقاطعة', echo.map(({ reply, heard, barge }) => { const got = bargeIn(heard, reply).barge; return [got === barge, `«${heard}» → ${got ? 'قطع' : 'كمّل'}`]; })),
  ].filter((part) => part.total > 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let right = 0; let total = 0;
  for (const part of runVoiceBench()) {
    right += part.right; total += part.total;
    console.log(`${part.name}: ${part.right}/${part.total} (${Math.round((part.right / part.total) * 100)}%)`);
    for (const miss of part.misses) console.log(`   ✗ ${miss}`);
  }
  console.log(`الإجمالي: ${right}/${total} (${Math.round((right / total) * 100)}%)`);
  console.log('\n— الامتحان (حالات جديدة متدربش عليها) —');
  let hRight = 0; let hTotal = 0;
  for (const part of await runHoldout()) {
    hRight += part.right; hTotal += part.total;
    console.log(`${part.name}: ${part.right}/${part.total} (${Math.round((part.right / part.total) * 100)}%)`);
    for (const miss of part.misses) console.log(`   ✗ ${miss}`);
  }
  console.log(`الامتحان: ${hRight}/${hTotal} (${Math.round((hRight / hTotal) * 100)}%)`);
}

/** The held-out exam (never tuned on). */
export async function runHoldout(): Promise<BenchScore[]> {
  const { HOLDOUT_TURNS, HOLDOUT_ADDRESS, HOLDOUT_CLEAN, HOLDOUT_MISHEARD } = await import('../tests/fixtures/voiceHoldout');
  return benchOn({ turns: HOLDOUT_TURNS, address: HOLDOUT_ADDRESS, clean: HOLDOUT_CLEAN, misheard: HOLDOUT_MISHEARD, echo: [] });
}

/** The second exam (written after the first exam's fixes; never tuned on). */
export async function runExam2(): Promise<BenchScore[]> {
  const { EXAM2_TURNS, EXAM2_ADDRESS, EXAM2_CLEAN, EXAM2_MISHEARD } = await import('../tests/fixtures/voiceExam2');
  return benchOn({ turns: EXAM2_TURNS, address: EXAM2_ADDRESS, clean: EXAM2_CLEAN, misheard: EXAM2_MISHEARD, echo: [] });
}
