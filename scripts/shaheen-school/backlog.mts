/**
 * «أكاديمية شاهين» — before the hourly school (.github/workflows/shaheen-school-clock.yml) downloads the local teacher,
 * it asks here whether anything is left to study (no AI, no network): the experts' syllabus and the perfume bank,
 * against his memory. Nothing left → the hour is skipped (the robot slows itself down instead of burning the runner).
 * Visitors' questions waiting on the live server are counted as work too (they are fetched by run.mts).
 *   node --import tsx scripts/shaheen-school/backlog.mts   → step outputs: todo=<n>, experts=<n>
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { emptyMemory, isMemoryFile } from '../../src/utils/shaheenMemory';
import { RAW_MATERIALS_DATABASE } from '../../src/data/rawMaterials';
import { councilStudy, readCouncil } from '../shaheen-council/council';
import { buildBank, exam, materialDocs, type TrainingDoc } from './school';

const live = (name: string) => new URL(`../../src/data/live/${name}`, import.meta.url);
const read = (name: string): unknown => { try { return existsSync(live(name)) ? JSON.parse(readFileSync(live(name), 'utf8')) : undefined; } catch { return undefined; } };
const raw = read('shaheen-memory.json');
const memory = isMemoryFile(raw) ? raw : emptyMemory();
const docs = ((read('sham-training.json') as { docs?: TrainingDoc[] } | undefined)?.docs) || [];
const bank = buildBank(docs, councilStudy(readCouncil(), Date.now()), [], RAW_MATERIALS_DATABASE);
const { results } = exam(bank, memory, [...docs, ...materialDocs(RAW_MATERIALS_DATABASE)]);
// The same gaps pickStudy chooses from: not answered by himself and no lesson of his own to learn from.
const todo = results.filter((r) => !r.covered && !r.lesson).map((r) => r.question);
const experts = todo.filter((b) => b.topic.startsWith('expert:')).length;
const visitorsMaybe = Boolean(process.env.SHAM_ADMIN_TOKEN?.trim());
const work = todo.length + (visitorsMaybe ? 1 : 0);
console.log(`Left to study: ${todo.length} questions (${experts} in the experts' syllabus)${visitorsMaybe ? ' + visitors\' questions on the live server' : ''}`);
if (!work) console.log('::notice title=أكاديمية شاهين::مفيش حاجة باقية يذاكرها — الساعة دي هتعدي من غير ما يشغّل المعلم المحلي');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `todo=${work}\nexperts=${experts}\n`);
