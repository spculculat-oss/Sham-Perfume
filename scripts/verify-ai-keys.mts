/**
 * Sends one tiny real request to every AI provider whose key is present in the environment
 * (GitHub Actions secrets in CI) using the exact code path the site uses, and reports the result
 * as a fixed code: ok / invalid_key / no_credit / rate_limited / model_not_found / region_blocked …
 *
 * Keys and upstream messages are never printed. Exit code is always 0 unless SHAM_VERIFY_STRICT=1,
 * so a provider outage never blocks unrelated deploys.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { probeEngines } from '../server/shaheen';
import { SHAHEEN_SITE_SETTINGS } from '../server/config/shaheen';
import { manusConfigured, manusWhoAmI } from '../server/core/manus';

const LABEL: Record<string, string> = {
  ok: 'يعمل ✅',
  not_configured: 'لا يوجد مفتاح',
  invalid_key: 'المفتاح غير صالح أو ملغي',
  no_credit: 'لا يوجد رصيد / انتهت الحصة',
  rate_limited: 'تجاوز حد الطلبات مؤقتاً',
  model_not_found: 'النموذج غير متاح لهذا الحساب',
  region_blocked: 'المنطقة غير مدعومة',
  bad_request: 'المزوّد رفض صيغة الطلب',
  upstream_error: 'خدمة المزوّد متعطلة',
  rejected_or_empty: 'رد فارغ',
  timeout: 'انتهت المهلة',
  unreachable: 'تعذّر الوصول',
};

const settings = { ...SHAHEEN_SITE_SETTINGS, engines: ['gemini', 'openai', 'claude', 'deepseek', 'openrouter', 'self_hosted'] as typeof SHAHEEN_SITE_SETTINGS.engines };
const results = await probeEngines(settings, { timeoutMs: 30000 });
const rows: Array<{ id: string; name: string; model: string; ok: boolean; configured: boolean; code: string; ms: number; usedModel?: string; detail?: string }> =
  results.map((r) => ({ ...r, code: r.ok ? 'ok' : r.error || 'unreachable' }));
// Manus is a background task agent (not a chat engine): its key is checked with a free read-only call.
if (manusConfigured()) {
  const m = await manusWhoAmI({ timeoutMs: 30000 });
  rows.push({ id: 'manus', name: 'Manus (وكيل المهام الخلفية)', model: 'agent', ok: m.ok, configured: true, code: m.code, ms: m.ms });
} else rows.push({ id: 'manus', name: 'Manus (وكيل المهام الخلفية)', model: 'agent', ok: false, configured: false, code: 'not_configured', ms: 0 });
const configured = rows.filter((r) => r.configured);

const lines = [
  '## اختبار مفاتيح شاهين',
  '',
  '| المحرك | النموذج | النتيجة | الكود | الزمن |',
  '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.name} | \`${r.model}\` | ${LABEL[r.code] || r.code} | \`${r.code}\` | ${r.configured ? `${r.ms}ms` : '—'} |`),
  '',
  configured.length ? `مفاتيح موجودة: ${configured.length} · تعمل: ${configured.filter((r) => r.ok).length}` : 'لا توجد أي مفاتيح في أسرار GitHub بعد.',
];
console.log(lines.join('\n'));
if (process.env.SHAM_VERIFY_FILE) writeFileSync(process.env.SHAM_VERIFY_FILE, JSON.stringify(Object.fromEntries(configured.map((r) => [r.id, r.code]))));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
if (process.env.GITHUB_ACTIONS) {
  for (const r of configured) {
    const extra = [r.usedModel ? `answered by ${r.usedModel}` : '', r.detail || ''].filter(Boolean).join(' · ').replace(/\r?\n/g, ' ');
    console.log(`::${r.ok ? 'notice' : 'warning'} title=Shaheen key ${r.id}::${r.code} (${r.model}, ${r.ms}ms)${extra ? ` — ${extra}` : ''}`);
  }
  console.log(`::notice title=Shaheen keys summary::configured=${configured.map((r) => r.id).join(',') || 'none'} ok=${configured.filter((r) => r.ok).map((r) => r.id).join(',') || 'none'}`);
}
if (process.env.SHAM_VERIFY_STRICT === '1' && configured.some((r) => !r.ok)) process.exit(1);
