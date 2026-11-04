/**
 * «مختبر عقل شاهين» — the public report (src/data/live/shaheen-brain.json): the training data card, every exam,
 * the current model's mark, and the approved brain the school's local teacher runs (shaheen-school-clock.yml reads
 * `approved`). Only model links and fingerprints live here — never a key or a token. Pure.
 */
import type { BrainCard } from './dataset';
import type { ExamResult } from './exam';

export const BRAIN_REPORT = 'src/data/live/shaheen-brain.json';
/** Where the weekly robot publishes the training files (a GitHub release: public, outside the repo history). */
export const DATA_RELEASE = 'shaheen-brain-data';
export const DATA_URL = (file: string) => `https://github.com/spculculat-oss/Sham-Perfume/releases/download/${DATA_RELEASE}/${file}`;
/** The current local teacher (scripts/shaheen-school/teacher.sh default) — the mark every candidate must reach. */
export const DEFAULT_TEACHER = {
  name: 'qwen2.5-7b-instruct',
  url: 'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
  sha256: '65b8fcd92af6b4fefa935c625d1ac27ea29dcb6ee14589c55a8f115ceaaa1423',
} as const;

export interface BrainModel { name: string; url: string; sha256: string }
export interface BrainExam { at: string; role: 'baseline' | 'candidate'; model: BrainModel; evalSha: string; result: ExamResult; approved?: boolean; whyAr?: string }
export interface BrainReport {
  version: 1;
  updatedAt: string;
  dataset?: BrainCard & { files?: { train: string; eval: string } };
  baseline?: BrainExam;
  approved?: BrainModel & { score: number; at: string };
  exams: BrainExam[];
}

const SHA = /^[a-f0-9]{64}$/;
const SAFE_URL = /^https:\/\/(?:huggingface\.co|github\.com)\/[A-Za-z0-9._~\/-]+\.gguf$/;
const NAME = /^[A-Za-z0-9._:-]{1,80}$/;
/** A model the runner may download: an https .gguf link on Hugging Face or GitHub, a SHA-256, a plain name. */
export const validModel = (m: Partial<BrainModel> | undefined): m is BrainModel =>
  Boolean(m && typeof m.url === 'string' && SAFE_URL.test(m.url) && !/[?#]/.test(m.url) && typeof m.sha256 === 'string' && SHA.test(m.sha256) && typeof m.name === 'string' && NAME.test(m.name));

export function emptyReport(now = new Date()): BrainReport { return { version: 1, updatedAt: now.toISOString(), exams: [] }; }

export function readReport(raw: unknown): BrainReport {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<BrainReport>;
  return {
    version: 1, updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date(0).toISOString(),
    ...(r.dataset ? { dataset: r.dataset } : {}),
    ...(r.baseline ? { baseline: r.baseline } : {}),
    ...(r.approved && validModel(r.approved) ? { approved: r.approved } : {}),
    exams: Array.isArray(r.exams) ? r.exams.slice(-20) : [],
  };
}

/** The mark to beat: the approved brain's own exam, else the default teacher's — on the same exam paper only. */
export function markToBeat(report: BrainReport, evalSha: string): BrainExam | undefined {
  const current = report.approved?.sha256 || DEFAULT_TEACHER.sha256;
  return [...report.exams].reverse().find((e) => e.evalSha === evalSha && e.model.sha256 === current)
    || (report.baseline && report.baseline.evalSha === evalSha && report.baseline.model.sha256 === current ? report.baseline : undefined);
}

/** The model the school's teacher should run now (the approved brain, else the default teacher). */
export const currentTeacher = (report: BrainReport): BrainModel => (report.approved && validModel(report.approved)
  ? { name: report.approved.name, url: report.approved.url, sha256: report.approved.sha256 } : { ...DEFAULT_TEACHER });

export function recordExam(report: BrainReport, exam: BrainExam, now = new Date()): BrainReport {
  const next: BrainReport = { ...report, updatedAt: now.toISOString(), exams: [...report.exams, exam].slice(-20) };
  if (exam.role === 'baseline') next.baseline = exam;
  if (exam.role === 'candidate' && exam.approved) next.approved = { ...exam.model, score: exam.result.score, at: exam.at };
  return next;
}
