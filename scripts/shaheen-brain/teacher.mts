/**
 * Which model the school's local teacher runs (shaheen-school-clock.yml, before scripts/shaheen-school/teacher.sh):
 *   1. the owner's repository variables TEACHER_MODEL_URL + TEACHER_MODEL_SHA256 (+ TEACHER_MODEL_NAME), if set;
 *   2. else the brain «مختبر عقل شاهين» approved after its exam (src/data/live/shaheen-brain.json → approved);
 *   3. else the default open teacher (Qwen2.5-7B-Instruct, Apache-2.0).
 * Step outputs: url, sha256, name.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { BRAIN_REPORT, currentTeacher, emptyReport, readReport } from './report';

const env = process.env;
const path = new URL(`../../${BRAIN_REPORT}`, import.meta.url);
const report = existsSync(path) ? readReport(JSON.parse(readFileSync(path, 'utf8'))) : emptyReport();
const owner = env.VAR_URL?.trim() && env.VAR_SHA256?.trim()
  ? { url: env.VAR_URL.trim(), sha256: env.VAR_SHA256.trim(), name: env.VAR_NAME?.trim() || 'teacher' } : undefined;
const pick = owner || currentTeacher(report);
console.log(`المعلم المحلي: ${pick.name}${owner ? ' (من إعدادات صاحب الموقع)' : report.approved ? ' (عقل شاهين المعتمد بعد الامتحان)' : ''}`);
const text = `url=${pick.url}\nsha256=${pick.sha256}\nname=${pick.name}\n`;
if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, text); else process.stdout.write(text);
