/**
 * «نشرة شاهين» — GitHub Actions runs this every 12 hours (.github/workflows/shaheen-news.yml):
 *   node --import tsx scripts/shaheen-news/run.mts
 * 1. Collects the latest perfume news from the web (Google News searches + specialist feeds).
 * 2. «الخبير شاهين» picks the real perfume stories and writes Arabic/English titles, summaries and a comment.
 * 3. Shaheen trains «مساعد شام»: a few perfumery lessons per run, answers to the questions the assistant
 *    could not answer (with SHAM_ADMIN_TOKEN), and the latest-news digest.
 * Writes src/data/live/shaheen-news.json and src/data/live/sham-training.json; the workflow commits them.
 * Works without any AI key too (real headlines, no summaries) and never empties the page on a bad run.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { FEEDS, fetchFeed, type RawItem } from './feeds';
import {
  buildNewsFile, buildTrainingFile, docsFromTrainer, editorPrompt, EDITOR_SYSTEM, gapPrompt, isPerfumeNews, itemsFromEditor,
  itemsFromFeeds, lessonPrompt, mergeNews, newsDoc, nextLessons, parseJson, selectCandidates, TRAINER_SYSTEM,
  type Ask, type NewsFile, type TrainingDoc, type TrainingFile,
} from './curate';
import { makeAsk } from '../doctor/agent';

const DIR = new URL('../../src/data/live/', import.meta.url);
const NEWS = new URL('shaheen-news.json', DIR);
const TRAINING = new URL('sham-training.json', DIR);
const env = process.env;
const log: string[] = [];
const say = (line: string) => { console.log(line); log.push(line); };
const read = <T,>(url: URL): T | undefined => { try { return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) as T : undefined; } catch { return undefined; } };

const previousNews = read<NewsFile>(NEWS);
const previousTraining = read<TrainingFile>(TRAINING)?.docs || [];
const now = new Date();

// 1) Collect
const results = await Promise.allSettled(FEEDS.map((feed) => fetchFeed(feed)));
const raw: RawItem[] = [];
results.forEach((r, i) => {
  if (r.status === 'fulfilled') { raw.push(...r.value); say(`✓ ${FEEDS[i].name}: ${r.value.length} items (${r.value.filter(isPerfumeNews).length} about perfume)`); }
  else say(`✗ ${FEEDS[i].name}: ${String((r.reason as Error)?.message || r.reason).slice(0, 120)}`);
});
const candidates = selectCandidates(raw, now.getTime());
say(`Candidates after filtering and de-duplication: ${candidates.length}`);

// 2) Shaheen edits
let ask: Ask | undefined;
try { ask = await makeAsk(env); } catch { ask = undefined; }
const askJson = async (system: string, prompt: string) => parseJson(await ask!(system, prompt));
let editor: NewsFile['editor'] = 'feeds';
let fresh = itemsFromFeeds(candidates);
let digest = previousNews?.digest;
if (ask && candidates.length) {
  try {
    const edited = itemsFromEditor(await askJson(EDITOR_SYSTEM, editorPrompt(candidates, now)), candidates);
    if (edited.items.length >= 3) { fresh = edited.items.sort((a, b) => b.importance - a.importance); digest = edited.digest || digest; editor = 'shaheen'; }
    say(`Shaheen edited ${edited.items.length} stories`);
  } catch (error) { say(`Shaheen could not edit this run (${(error as Error).message.slice(0, 120)}); publishing headlines only`); }
} else if (!ask) say('No AI key configured: publishing real headlines without summaries');

const items = mergeNews(fresh, previousNews?.items, now.getTime());
const newsFile = items.length ? buildNewsFile(items, editor, editor === 'shaheen' ? digest : previousNews?.digest, now)
  : previousNews ? { ...previousNews, nextUpdateAt: new Date(now.getTime() + 12 * 3600_000).toISOString() } : buildNewsFile([], 'feeds', undefined, now);
say(`News file: ${newsFile.items.length} stories, editor=${newsFile.editor}`);

// 3) Shaheen trains the Sham assistant
const lessons: TrainingDoc[] = [];
if (ask) {
  const topics = nextLessons(previousTraining, Number(env.SHAHEEN_LESSONS_PER_RUN || 4));
  try {
    lessons.push(...docsFromTrainer(await askJson(TRAINER_SYSTEM, lessonPrompt(topics)), 'curriculum', topics.map((t) => t.id), now));
    say(`Lessons written for «مساعد شام»: ${lessons.map((d) => d.title).join(' · ') || 'none'}`);
  } catch (error) { say(`Lessons skipped this run (${(error as Error).message.slice(0, 120)})`); }

  const site = (env.SHAM_SITE_URL || 'https://sham-perfume-49bf.vercel.app').replace(/\/$/, '');
  if (env.SHAM_ADMIN_TOKEN) {
    try {
      const response = await fetch(`${site}/api/admin/gaps`, { headers: { Authorization: `Bearer ${env.SHAM_ADMIN_TOKEN}` }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const gaps = ((await response.json()) as { items?: { id: string; question: string; status: string }[] }).items || [];
      const open = gaps.filter((g) => g.status === 'open' && g.question?.trim()).slice(0, 8);
      if (open.length) {
        const answered = docsFromTrainer(await askJson(TRAINER_SYSTEM, gapPrompt(open.map((g) => g.question.slice(0, 300)))), 'gap', open.map((g) => g.id), now);
        lessons.push(...answered);
        say(`Answered ${answered.length} of ${open.length} open questions the assistant could not answer`);
      } else say('No open questions waiting for an answer');
    } catch (error) { say(`Unanswered questions skipped (${(error as Error).message.slice(0, 120)})`); }
  } else say('SHAM_ADMIN_TOKEN not set: skipping the assistant’s unanswered questions');
}
const digestDoc = newsDoc(newsFile);
const trainingFile = buildTrainingFile(previousTraining, [...lessons, ...(digestDoc ? [digestDoc] : [])], now);
say(`Training file: ${trainingFile.docs.length} lessons for «مساعد شام»`);

mkdirSync(DIR, { recursive: true });
writeFileSync(NEWS, `${JSON.stringify(newsFile, null, 1)}\n`);
writeFileSync(TRAINING, `${JSON.stringify(trainingFile, null, 1)}\n`);

if (env.GITHUB_STEP_SUMMARY) {
  const top = newsFile.items.slice(0, 12).map((i) => `- **${i.title.ar}** — ${i.source}${i.publishedAt ? ` (${i.publishedAt.slice(0, 10)})` : ''}`);
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## نشرة شاهين — ${now.toISOString()}\n\n${log.map((l) => `- ${l}`).join('\n')}\n\n### أبرز الأخبار\n${top.join('\n')}\n`);
}
if (env.GITHUB_ACTIONS) {
  console.log(`::notice title=Shaheen news::${newsFile.items.length} stories (editor ${newsFile.editor}), ${lessons.length} new lessons, ${trainingFile.docs.length} lessons total`);
  const clean = (t: string) => t.replace(/[\r\n%]/g, ' ');
  console.log(`::notice title=Sources::${clean(log.filter((l) => /^[✓✗]/.test(l)).join(' | '))}`);
  console.log(`::notice title=Training::${clean(log.filter((l) => /Lessons|questions|SHAM_ADMIN_TOKEN/.test(l)).join(' | ') || 'no AI key')}`);
  newsFile.items.slice(0, 6).forEach((i, n) => console.log(`::notice title=Story ${n + 1}::${i.title.ar.replace(/[\r\n%]/g, ' ')} — ${i.source}`));
}
