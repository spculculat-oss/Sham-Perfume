import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Shaheen answers with whatever engines the admin enabled (often just one).
// Marketing copy must never promise a fixed set of vendors or a fixed count.
const FORBIDDEN: RegExp[] = [
  /Gemini \+ DeepSeek \+ ChatGPT \+ Claude/,
  /Gemini \+ Claude \+ DeepSeek/,
  /Multi-AI Ensemble/,
  /\(4 (models|نماذج|modèles|modelos|modelli|Modelle|модели|model|مدل|۴ مدل)\)/,
  /4 نماذج متزامنة|4 parallel models|دمج مؤتمت 4 محركات|Automated 4-engine blend/,
  /الذكاء الاصطناعي الأربعة|four AI engines/,
  /تصدير نصي مشفر|Encrypted text export|100% IFRA Compliance/,
  /تمت تغذية الخبير بأمهات كتب/,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|html)$/.test(name) ? [path] : [];
  });
}

test('site copy does not advertise fake multi-vendor AI claims', () => {
  const offenders: string[] = [];
  for (const file of [...files('src'), 'index.html']) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN) if (pattern.test(text)) offenders.push(`${file}: ${pattern}`);
  }
  assert.deepEqual(offenders, []);
});
