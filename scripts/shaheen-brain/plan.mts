/**
 * «امتحان عقل شاهين» — what to examine this run (no AI, before any model is downloaded):
 *   - the candidate: the model given to the workflow by hand (CANDIDATE_URL / CANDIDATE_SHA256 / CANDIDATE_NAME),
 *     else the newest one the trainer published (latest.json in the Hugging Face repo SHAHEEN_BRAIN_HF_REPO);
 *   - skipped when that exact model already sat this exact paper (EVAL_SHA);
 *   - the current brain is examined first when its mark on this paper is missing.
 * Step outputs: run, cand_name, cand_url, cand_sha, need_baseline, base_name, base_url, base_sha.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { BRAIN_REPORT, currentTeacher, emptyReport, markToBeat, readReport, validModel, type BrainModel } from './report';

const env = process.env;
const out = (pairs: Record<string, string>) => {
  const text = Object.entries(pairs).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, text); else process.stdout.write(text);
};
const path = new URL(`../../${BRAIN_REPORT}`, import.meta.url);
const report = existsSync(path) ? readReport(JSON.parse(readFileSync(path, 'utf8'))) : emptyReport();
const evalSha = env.EVAL_SHA?.trim() || '';

let candidate: Partial<BrainModel> | undefined;
if (env.CANDIDATE_URL?.trim()) {
  candidate = { name: env.CANDIDATE_NAME?.trim() || 'shaheen-brain', url: env.CANDIDATE_URL.trim(), sha256: (env.CANDIDATE_SHA256 || '').trim().toLowerCase() };
} else if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.SHAHEEN_BRAIN_HF_REPO?.trim() || '')) {
  try {
    const r = await fetch(`https://huggingface.co/${env.SHAHEEN_BRAIN_HF_REPO!.trim()}/resolve/main/latest.json`, { signal: AbortSignal.timeout(20_000) });
    if (r.ok) { const j = await r.json() as Partial<BrainModel>; candidate = { name: j.name, url: j.url, sha256: String(j.sha256 || '').toLowerCase() }; }
    else console.log(`latest.json: HTTP ${r.status}`);
  } catch (e) { console.log(`latest.json unreadable: ${(e as Error).message}`); }
}

if (!candidate) { console.log('مفيش عقل جديد يتامتحن (لا رابط يدوي ولا latest.json)'); out({ run: 'false' }); process.exit(0); }
if (!validModel(candidate)) { console.log('::warning title=امتحان عقل شاهين::بيانات العقل الجديد مش صالحة (رابط https لملف .gguf على Hugging Face أو GitHub + بصمة SHA-256 من 64 حرف)'); out({ run: 'false' }); process.exit(0); }
if (report.exams.some((e) => e.role === 'candidate' && e.model.sha256 === candidate!.sha256 && e.evalSha === evalSha)) {
  console.log(`«${candidate.name}» اتامتحن قبل كده على نفس الورقة — مفيش داعي يتعاد`); out({ run: 'false' }); process.exit(0);
}
if (report.approved?.sha256 === candidate.sha256) { console.log('ده العقل المعتمد حالياً'); out({ run: 'false' }); process.exit(0); }

const base = currentTeacher(report);
const needBaseline = !markToBeat(report, evalSha);
console.log(`العقل الجديد: ${candidate.name}${needBaseline ? ` — والعقل الحالي «${base.name}» هيتامتحن الأول على نفس الورقة` : ''}`);
out({ run: 'true', cand_name: candidate.name!, cand_url: candidate.url!, cand_sha: candidate.sha256!, need_baseline: needBaseline ? 'true' : 'false', base_name: base.name, base_url: base.url, base_sha: base.sha256 });
