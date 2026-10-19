/**
 * «ربط التعاقدات» — بعد اعتماد عقد (C-10) فوراً:
 * 1) «كونتاكت مع شاهين» ليَنزّله على المتجر (حارس الاستيراد يقرأ approvedDomains)
 * 2) ربط ومراجعة مع الإدارة المالية (FINANCE.md: ledger + مراجعة مصاريف)
 *
 * — شاهين: إشعار داخلي + (اختياري) dispatch فوري لمستورد شاهين عبر GitHub Actions
 * — المالية: فتح issue مالي + إشعار council/مالية لمراجعة التسعير قبل أول طلب
 */

import { createNotifier, type Notifier } from '../core/notify';
import type { FinanceService } from '../finance/service';
import type { ContractsCtx } from './service';

type Env = Record<string, string | undefined>;

// ── Helpers ────────────────────────────────────────────────────────────────

function financeIdForContract(domain: string, id: string) {
  // financeId is deterministic SHA256 — we reuse FinanceService logic via its store
  // Here we just build a readable ref for the issue
  return `${domain}#${id.slice(0, 8)}`;
}

// Trigger GitHub Actions shaheen-import dispatch (best-effort, never blocks approval)
async function dispatchShaheenImport(env: Env, fetchFn: typeof fetch, domain: string): Promise<{ dispatched: boolean; reason?: string }> {
  const token = env.GITHUB_TOKEN?.trim() || env.SH_GITHUB_TOKEN?.trim() || '';
  const repo = env.SHAM_GITHUB_REPO?.trim() || env.GITHUB_REPOSITORY?.trim() || 'spculculat-oss/Sham-Perfume';
  if (!token) return { dispatched: false, reason: 'no_github_token' };
  // Workflow file as in .github/workflows/shaheen-import.yml
  const workflow = env.SHAM_IMPORT_WORKFLOW?.trim() || 'shaheen-import.yml';
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Sham-Perfume-Contracts',
      },
      body: JSON.stringify({ ref: env.SHAM_IMPORT_REF?.trim() || 'main', inputs: { domain } }),
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 204) return { dispatched: true };
    return { dispatched: false, reason: `github_${res.status}` };
  } catch (e) {
    return { dispatched: false, reason: e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120) };
  }
}

// ── Public API ──────────────────────────────────────────────────────────

export interface IntegrationDeps {
  finance?: FinanceService;
  env?: Env;
  fetch?: typeof fetch;
  notifier?: Notifier;
}

export interface ApproveSideEffects {
  shaheenNotified: boolean;
  shaheenDispatched: boolean;
  financeLinked: boolean;
  details: Record<string, unknown>;
}

/**
 * Called immediately after approve() succeeds (C-10). Never throws — failures are logged
 * and returned in details so approval itself is never rolled back.
 */
export async function onContractApproved(ctx: ContractsCtx, id: string, deps: IntegrationDeps = {}): Promise<ApproveSideEffects> {
  const env = deps.env || ctx.env || process.env;
  const fetchFn = deps.fetch || ctx.fetch || fetch;
  const finance = deps.finance;
  const notifier = deps.notifier || createNotifier(env as Record<string, string | undefined>, fetchFn);

  // Fetch contract row directly — getContract requires base URL, we just need domain/storeName
  let domain = '';
  let storeName: string = id;
  try {
    const rows = await ctx.sql.query<{ domain: string; store_name: string }>(`SELECT domain, store_name FROM supplier_contracts WHERE id = $1`, [id]);
    if (rows[0]) { domain = rows[0].domain || ''; storeName = rows[0].store_name || domain || id; }
  } catch { /* ignore */ }
  if (!domain) domain = id; // fallback so finance still links if row missing in tests

  const details: Record<string, unknown> = { domain, storeName, contractId: id };

  // 1) Finance linking — create a finance issue so «أمين شاهين» dashboard shows it
  let financeLinked = false;
  if (finance && domain) {
    try {
      // CONTRACT_APPROVED: warns finance to enter costs before first order
      await finance.issue(
        'CONTRACT_APPROVED',
        `عقد معتمد: ${storeName} (${domain}) — بانتظار إعداد التسعير`,
        `راجع لوحة المالية: سجل تكلفة البضاعة والشحن والرسوم/الضريبة للعقد ${domain} قبل أول طلب. صافي الربح وحساب الهامش معلق حتى اكتمال التكاليف.`,
        'warning',
        financeIdForContract(domain, id),
        false,
      );
      // Also open a dedicated cost-missing issue for ledger completeness
      await finance.issue(
        'MISSING_COSTS',
        `تكاليف ناقصة لعقد معتمد: ${domain}`,
        `العقد ${domain} اعتُمد للتو. أدخل القيود المحاسبية (cost/shipping/fee/tax) في المالية؛ التقارير ستظهر incomplete حتى ذلك.`,
        'warning',
        financeIdForContract(domain, id) + ':costs',
        true,
      );
      financeLinked = true;
      details.finance = 'issues_created';
    } catch (e) {
      details.financeError = e instanceof Error ? e.message : String(e);
    }
  } else {
    details.finance = finance ? 'no_domain' : 'no_finance_service';
  }

  // 2) Contact Shaheen — notify + optionally dispatch import
  let shaheenNotified = false;
  let shaheenDispatched = false;
  try {
    const text = `✅ عقد مكتمل: ${storeName} (${domain}) — اعتُمد من مسؤول التعاقدات (C-10). جاهز للنقل إلى المتجر ومراجعة المالية.`;
    shaheenNotified = await notifier.send('contract.approved', text, {
      owner: 'shaheen',
      contractId: id,
      domain,
      storeName,
      at: new Date().toISOString(),
    });
    details.notifier = shaheenNotified ? 'sent' : (notifier.configured ? 'failed' : 'not_configured');
  } catch (e) {
    details.notifierError = e instanceof Error ? e.message : String(e);
  }

  // 3) Immediate Shaheen import dispatch (GitHub Actions) — best effort
  try {
    const disp = await dispatchShaheenImport(env as Record<string, string | undefined>, fetchFn, domain);
    shaheenDispatched = disp.dispatched;
    details.dispatch = disp;
  } catch (e) {
    details.dispatchError = e instanceof Error ? e.message : String(e);
  }

  // 4) Audit trail: record in contract_meta or contracts timeline (append to note)
  try {
    const stamp = `[auto] contract.approved → shaheen:${shaheenNotified ? 'notified' : 'pending'} finance:${financeLinked ? 'linked' : 'pending'} dispatch:${shaheenDispatched ? 'yes' : 'no'} @${new Date().toISOString()}`;
    await ctx.sql.query(`UPDATE supplier_contracts SET note = COALESCE(note,'') || $2 WHERE id = $1`, [id, `\n${stamp}`]);
  } catch {
    // non-critical
  }

  console.log(`[contracts/integration] approved ${domain} (${id}) → shaheen notified=${shaheenNotified} dispatched=${shaheenDispatched} finance=${financeLinked}`);
  return { shaheenNotified, shaheenDispatched, financeLinked, details };
}

export async function onContractRevoked(ctx: ContractsCtx, id: string, deps: IntegrationDeps = {}): Promise<void> {
  const env = deps.env || ctx.env || process.env;
  const finance = deps.finance;
  const fetchFn = deps.fetch || ctx.fetch || fetch;
  const notifier = deps.notifier || createNotifier(env as Record<string, string | undefined>, fetchFn);
  let domain = '';
  let storeName: string = id;
  try {
    const rows = await ctx.sql.query<{ domain: string; store_name: string }>(`SELECT domain, store_name FROM supplier_contracts WHERE id = $1`, [id]);
    if (rows[0]) { domain = rows[0].domain || ''; storeName = rows[0].store_name || domain || id; }
  } catch { /* ignore */ }

  // Finance: resolve the contract issues
  if (finance && domain) {
    try {
      // Resolve by marking the issue resolved (store.put with resolvedAt)
      // FinanceService doesn't expose resolve-by-code; we resolve via direct store
      const ref = financeIdForContract(domain, id);
      // These ids are SHA256 hashes — we need to fetch and resolve matching issues
      const issues = await finance.store.list('financeIssues');
      for (const iss of issues) {
        if (iss.ref === ref || iss.ref === ref + ':costs' || iss.ref?.includes(domain)) {
          if (!iss.resolvedAt) {
            await finance.store.put('financeIssues', iss.id, { ...iss, resolvedAt: new Date().toISOString() });
          }
        }
      }
    } catch { /* ignore */ }
  }

  try {
    await notifier.send('contract.revoked', `🚫 عقد أُلغي: ${storeName} (${domain}) — إزالة من المتجر خلال 48 ساعة (C-07).`, {
      owner: 'shaheen', contractId: id, domain, storeName,
    });
  } catch { /* ignore */ }

  try {
    const stamp = `[auto] contract.revoked → shaheen:remove finance:resolved @${new Date().toISOString()}`;
    await ctx.sql.query(`UPDATE supplier_contracts SET note = COALESCE(note,'') || $2 WHERE id = $1`, [id, `\n${stamp}`]);
  } catch { /* ignore */ }
}
