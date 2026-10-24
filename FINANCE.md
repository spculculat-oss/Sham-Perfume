# أمين شاهين — المالية والدفع والشراء المباشر

## لصاحب المتجر

- من لوحة الإدارة افتح **«المالية»**: تقارير يومية وأسبوعية وشهرية، سجل القيود، مراجعة الدفع، وبلاغات لشاهين.
- فواتير وإيصالات وملخصات طلبات العميل تعرض أسعار البيع والكميات والشحن والضرائب والرسوم المطبقة والإجمالي، بدون هامش المنصة أو نسبته أو تفصيل تكلفة المورد. حسابات التسعير والأرباح الداخلية لا تتغير.
- **التحصيل ليس صافي الربح.** لو تكلفة البضاعة أو الشحن الفعلي أو الرسوم أو الضرائب أو مراجعة المصروفات ناقصة، يظهر الناتج المسجل كمؤشر مبدئي، وليس صافي ربح.
- **شراء مباشر** بجوار **أضف إلى السلة** في المتجر وصفحة المنتج. يفتح إتمام الطلب للمنتج والكمية المختارين فقط؛ لا يضيفهما إلى السلة ولا يمسح مشترياتها الأخرى. هذا ليس خصماً بضغطة واحدة.
- تفعيل الدفع الحقيقي يحتاج حساب بوابة معتمداً وتخزيناً دائماً وإعدادات الخادم. البحث عن وسيلة دفع أو وجود مفتاح لا يعني اعتمادها. لا ترسل مفاتيح أو بيانات بنك أو بطاقات في الشات أو نموذج الملاحظات.
- الوكيل تحت إشراف شاهين، لكنه **لا يحوّل أموالاً، ولا ينفذ استرداداً، ولا يفتح حسابات تجار، ولا يغيّر بيانات التسوية**. قرارات الاعتماد والتكاليف الفعلية تبقى لصاحب المتجر.

## بنك شام — التحصيل المباشر بدون وسيط

- من لوحة الإدارة افتح **«بنك شام والمالية» ← «بنك شام»**. بوابة الدفع (كاشير) أصبحت اختيارية ومتوقفة؛ البيع يتم بدونها.
- **التحصيل المباشر:** أضف حساباتك (إنستاباي، تحويل بنكي/IBAN، محفظة موبايل، الدفع عند الاستلام) مع العملات والدول ومدة الحجز. تظهر للعميل في السلة فقط بعد تخزين دائم.
- **دورة الطلب:** العميل يحجز الطلب ← يحوّل لحسابك بنفسه ← يكتب اسم المحوِّل ورقم العملية ← أنت تراجع حسابك وتضغط «وصل المبلغ — أكّد». لا يُسجَّل أي بيع قبل تأكيدك، والسعر يُحسب في الخادم فقط.
- **علامات خطر تلقائية:** مبلغ مختلف، رقم عملية مكرر، تحويل قبل الطلب، طلبات مفتوحة كثيرة لنفس العميل، مبلغ أعلى من المعتاد.
- **مطابقة كشف الحساب:** الصق كشف CSV من تطبيق البنك؛ شاهين يقترح المطابقات ولا يحفظ الكشف، والتأكيد لك.
- **المستحقات علينا، الميزانيات الشهرية (تنبيه عند ٨٠٪ وعند التجاوز)، توقع السيولة ٣٠ يوماً، أرباح المنتجات والدول، سجل تدقيق، و«شاهين المحاسب»** يجيب من أرقام الدفتر فقط.
- **الخصوصية:** بيانات العميل تُحفظ كبصمة (hash) في البنك، ولا تُقبل كلمات سر أو أرقام بطاقات أو رموز تحقق في تعليمات الحسابات. حساب التاجر في المتصفح لم يعد يحفظ رقم الحساب أو الآيبان.
- **حدود قانونية بصدق:** الموقع **لا يقبل بطاقات ائتمان مباشرة** ولا يحتفظ بأموال لأحد؛ استقبال البطاقات يحتاج جهة مرخّصة (PCI DSS وترخيص البنك المركزي). بنك شام دفتر وأدوات إدارة، والأموال تذهب مباشرة إلى حساباتك الحقيقية.
- **تشغيله على الموقع الحي يحتاج قاعدة بيانات دائمة** (نفس قاعدة المجتمع: `DATABASE_URL` من Neon على محرك فيرسال). بدونها تبقى وسائل الدفع المباشر مخفية عن العملاء تلقائياً حتى لا يضيع أي طلب.

## إدارة المبيعات — قسم جوه «بنك شام»

- من لوحة الإدارة: **«بنك شام والمالية» ← «بنك شام» ← «إدارة المبيعات»**. المكتب بيقرأ التحصيل المؤكد من دفتر بنك شام بس — الحجز مش إيراد.
- **خط الأنابيب:** فرصة باسم مختصر ومرحلة (اهتمام ← احتياجه واضح ← عرض سعر ← تفاوض ← اتقفلت) وقيمة واحتمالية. القيمة الموزونة = القيمة × احتمالية المرحلة، ودي **توقع** مش فلوس مضمونة.
- **هدف الشهر:** لكل عملة، مع الإيقاع (سابق/على/متأخر)، الفجوة اليومية، والتوقع من الأيام اللي عدت — والتحصيل من الدفتر المؤكد.
- **إيقاع اليوم:** تأكيد التحويلات المستنية ← متابعات الفرص المتأخرة ← فجوة الهدف ← مراجعة مخزون الأكثر مبيعاً ← درس المنهج. كل مهمة مكتوب معاها مكان تنفيذها والرقم الحقيقي اللي جابها.
- **المنهج:** 16 درساً في ٤ وحدات (كتيب المنصة، فن البيع، النمو والقياس، الأمانة والخصوصية)، كل درس مكتوب مصدره في الكتيب وفي «علم البيع»، ومعاه تمرين وسؤال ونتيجة بتتحفظ. الملف الكامل: `SALES_PLAYBOOK.md` (بيتولد من `src/sales/playbook.ts`).
- **«مدير المبيعات»** روبوت مسجّل في هيكل شاهين: بيذاكر درس اليوم ويسجّل الإجابة، وبيقرا المكتب كل ٦ ساعات، وتقريره `src/data/live/shaheen-sales.json` — **أعداد بس**: مفيش مبالغ ولا أسماء عملاء ولا أرقام طلبات ولا بيانات تواصل.
- **الخصوصية:** النظام بيرفض أي رقم تليفون أو إيميل أو عنوان في حقول الفرصة. بيانات التواصل مكانها حساب العميل وطلبه، والمبالغ مكانها السجل الخاص في بنك شام.
- **الحدود:** المكتب مايأكدش دفع (ده في «التحصيل المباشر» بعد رؤية الفلوس)، ومايوعدش بخصم، ومايخترعش استعجال مزيف أو رقم متخمن. الخصومات والشراكات والتغيير الكبير قرار صاحب الموقع.

## Implemented boundaries

This is a deterministic, supervised accounting agent, **not a newly trained financial model**. Integer minor-unit arithmetic, gateway evidence and ledger entries determine amounts; an LLM cannot invent collections or post money. `finance_agent` is registered in `src/utils/aiTools.ts`, Shaheen's supervisor probes, and the leadership group in `src/utils/shaheenOrg.ts`. The pre-meeting check reads only its redacted supervisor health, never the private ledger.

- Private admin finance dashboard and authenticated API.
- Immutable order snapshots and an append-only collection/cost/refund ledger.
- Verified hosted Kashier card/wallet checkout, separated live and test records.
- Calendar reports in `Africa/Cairo` by default, including DST; Monday-based weeks and calendar months.
- Read-only reconciliation of stored sessions, payment API health measurements, missing-cost/configuration checks, and issues assigned to `shaheen`.
- Source-linked **partial** payment-method research by buyer country, with merchant-country restrictions and onboarding checklists. Only Kashier `card` / `wallet` are integrated; other candidates remain `not_implemented` even when environment variables are present.
- Desktop/mobile buy-now flow with an isolated checkout and a one-shot, 15-minute SKU/quantity handoff from product details. Product-detail quantity is respected. Normal-cart payment removes only the paid snapshot quantities after verified **live** success, preserving later additions and unrelated items.
- Removed browser-fabricated payment success, synthetic saved-payment aliases and unsupported PCI/tokenization/network claims. Local legacy payment records are unverified and are not financial evidence. Card, CVV and wallet authentication are handled only on the provider-hosted page, not by this storefront.

The separate merchant/mediation catalog and generated static SEO product pages are not turned into retail checkout by this change. Stock and prices are always revalidated by the server.

## Live rollout checklist — intentionally fail-closed

**Behaviour change:** pre-existing live keys alone no longer enable payment. Before rollout, arrange a controlled cutover: reconcile/close outstanding sessions from the old implementation against provider statements. Those sessions have no immutable finance snapshot; they are not silently imported, treated as paid, or manufactured into historical revenue. Untracked callbacks are rejected and flagged for private review. Keep the old deployment available for resolving legitimate pre-cutover orders; do not deploy over pending payments without a reconciliation plan.

1. Configure a strong `SHAM_ADMIN_TOKEN` (minimum 12 characters) on the API. Use the existing authenticated admin interface. Never put a token into URLs, browser build variables, documentation, Git or chat.
2. Configure **durable storage** on the API:
   - On Vercel/serverless: `SHAM_STORE=firestore` with `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and optionally `SHAM_FIRESTORE_PREFIX`.
   - On a single Node/VPS process with durable disk: `SHAM_STORE=file` and a private, backed-up `SHAM_DATA_FILE`. File inserts/writes are serialized within one process; this is **not** a multi-process/distributed database.
   - `memory` is for previews/tests. Explicit `file` on Vercel or `SHAM_SERVERLESS` is also rejected as durable finance storage. Files created by the file adapter use owner-only permissions. Do not expose `.data/` through static hosting.
   - `persistent` identifies a suitable adapter; it does not prove remote database credentials/permissions/backups. Test writes and recovery before accepting live orders. Deny direct browser access to private Firestore collections and limit service-account access.
3. Set runtime server variables (names only; see `.env.example`):
   - `KASHIER_MERCHANT_ID`, `KASHIER_API_KEY`, `KASHIER_SECRET_KEY` from the **same** provider environment.
   - `KASHIER_MODE=test` during rehearsal; use `live` only after provider approval and an explicitly planned live test.
   - `KASHIER_CURRENCIES` containing only currencies approved for this account (default `EGP`). Invalid mode/currency/key shape is an error, not a silent fallback.
   - `SHAM_PUBLIC_API_URL`: the HTTPS **API origin**, without a path/query/credentials, not the GitHub Pages origin. The callback is `/api/store/kashier/webhook`; it is never inferred from a visitor's Host header.
   - Optional `SHAM_FINANCE_TIMEZONE`, default `Africa/Cairo`.
4. In Admin → Finance → Payments, review the real provider account and save the owner attestation: legal entity, settlement bank, website/policies, live account/method approvals. Select only contract-approved buyer countries and methods. The current merchant configuration is Egyptian; initial buyer scope is Egypt, and wallets require Egypt/EGP. Renew the attestation every 90 days.
5. Rehearse with test keys, test-mode browser returns and signed callbacks. Test payments do **not** fulfil orders or enter real profit reports. Then perform an owner-authorized live acceptance test with the provider, verify settlement/fees against statements, and check the private ledger and order handling. This PR's automated tests use mocks; they do not certify a live provider account or bank settlement.
6. Activate the scheduler and alerts below. Review missing costs and enter actual figures; do not copy retail prices or assume missing expenses are zero.

`authentication: not_probed` is deliberate: the readiness screen validates configuration and records owner attestations, not an automatic KYC/bank check. An actual API request can still fail. Missing prerequisites hide the corresponding online payment methods; the assistant order-enquiry path remains available **without** calling the order paid.

The existing key-sync workflow handles only its explicit allowlist. It does not automatically provision the new storage, callback origin, admin token or finance scheduler settings. Its production key verification/sync/redeploy job is now **main-only**; a feature-branch PR must not change production payment configuration. The separate payment verifier uses the configured mode only and no longer probes the opposite mode on an authentication error.

## Scheduling, supervision and private alerts

`.github/workflows/shaheen-finance.yml` runs at **03:15 UTC daily** and can be dispatched manually on `main` only. It calls `scripts/shaheen-finance/run.mts`; it does not run from a feature-branch push.

Configure in repository Actions settings:

| Setting | Type | Purpose |
| --- | --- | --- |
| `SHAM_FINANCE_API_URL` | Repository variable | Deployed API HTTPS origin, no path/query |
| `SHAM_ADMIN_TOKEN` | Repository secret | Same admin credential as the deployed API |

The runner refuses redirects, has a 110-second request timeout and prints neither response bodies nor financial amounts/secrets. It does not edit repository data or create charges. Missing settings fail clearly rather than reporting a completed audit. The API host must allow the job and have sufficient execution time; the serverless function still has its own limit. GitHub schedules can be delayed, so this is not a precise-time SLA.

Each run:

1. Polls at most 20 unresolved stored sessions in batches of five, oldest-check-first, including rotating past API failures. It never resubmits a payment. Larger backlogs need further runs and operational review.
2. Checks configuration, missing cost categories, over-refunds, stale sessions/research and actual live API latency/failure rates. At least five API attempts are needed for performance alerts; these are API metrics, not browser checkout latency or a statistical guarantee.
3. Archives the previous closed day, previous closed week and previous closed month. It catches up at most 31 missed daily periods since the last run; first run starts with the previous day. Older history and missed weeks/months are not automatically backfilled in full. The dashboard selects current/previous periods; older periods can be recomputed through the authenticated API.
4. Stores issues/runs/reports privately. Repeated identical report snapshots and sale receipts use deterministic IDs. Acknowledging an issue does not resolve its condition. Automatic issues resolve only after checks pass; manual/account/fulfilment problems need human action.
5. Optionally sends the existing signed `finance.alert` notification through `SHAM_WEBHOOK_URL` / `SHAM_WEBHOOK_SECRET`. Only summary counts and safe diagnostic codes are sent, not a ledger dump. A failed notification is not marked delivered and is retried on a later run.

Shaheen's supervisor reads authenticated `/api/admin/finance/status`, containing only persistence, last-run/overdue status and issue counts. It skips when no admin token is configured; it does not export amounts, order references, reasons or customer data into public AI reports. A run is overdue after 36 hours. The finance scheduler is not considered activated until the deployed API and repository settings have been configured and a real scheduled run has succeeded.

## Accounting rules and corrections

- Money is stored as safe integer minor units, with explicit supported-currency precision and overflow checks. Currency totals are **separate**; there is no invented FX conversion or combined worldwide-profit figure.
- A saved order must match provider **order, session, amount and currency**. Browser redirect text is not evidence. Signed webhook fields include the financial fields; the server additionally retrieves the stored session's payment from the provider. Authorization-only/`APPROVED` is not collection.
- A deterministic sale ID is inserted atomically once per `(mode, order reference)`, even when return verification, webhook and reconciliation race. Firestore uses a server-side nonexistence precondition. FileStore has single-process concurrency guarantees only.
- The reporting basis is **posted ledger**, not inventory accrual, bank balance, settlement reconciliation, or an audited financial statement. Without a trusted provider timestamp, a collection uses its first server-verified receipt time. The period is half-open `[from, to)` in the chosen timezone.
- Recorded result = collections − refunds − chargebacks − cost of goods − actual shipping − gateway fees − taxes − operating expenses. Customer shipping collected is already part of the order total, not an extra invented receipt.
- Net profit remains `null` until the period is closed, each sale has explicit cost/shipping/fee/tax entries **in that reporting period**, and an administrator confirms the period's expenses against the report fingerprint. Confirmed zero is allowed for a genuinely inapplicable cost category. Missing costs are not inferred from supplier listings.
- Late/backdated postings or reversals change the fingerprint and invalidate the expense review. Archived reports remain immutable **as-generated snapshots**, not silently rewritten history; recompute and review the relevant period after a correction. Historical figures are only as complete as the verified ledger and actual expenses supplied.
- Admin entries are bookkeeping of **already completed real events**. They cannot create a sale, mark an order paid, issue a refund, or initiate a payout. Reuse the same idempotency key after a network error. A different payload under the same key is rejected.
- Mistakes are corrected by one idempotent reversing entry with a reason; the original remains visible. Gateway sales cannot be erased. Cumulative refunds/chargebacks above the collection are flagged and block reviewed profit; conflicting manual postings require reconciliation, not an automatic money transfer.
- Captured orders with failed downstream fulfilment synchronization retain the sale and raise `PAID_SYNC_FAILED` for manual review. Do not re-charge the customer to fix order handling. Refund/chargeback detection requires separate statement-backed bookkeeping; this is not a full provider event/accounting import.

## Privacy, API and limitations

All routes below are behind the existing constant-time admin-token authentication and return `Cache-Control: private, no-store`:

- `GET /api/admin/finance` (`period=daily|weekly|monthly`, `offset=0..-366`, `country=EG`)
- `GET /api/admin/finance/status`
- `POST /api/admin/finance/run`
- `PUT /api/admin/finance/registration`
- `POST /api/admin/finance/entries`
- `POST /api/admin/finance/entries/:id/reverse`
- `POST /api/admin/finance/issues/:id/acknowledge`
- `POST /api/admin/finance/review`
- `GET /api/admin/finance/export`

Private collections: `financeOrders`, `financeSessions`, `financeEntries`, `financeAttempts`, `financeReports`, `financeReviews`, `financeIssues`, `financeRuns`, `paymentRegistrations`. They have no fields for cards, CVV, bank account details or customer contacts. Keep free-text reasons free of personal data and secrets. Export files are private operational data; keep them out of Git and public reports. The export is not a replacement for a tested database backup/restore procedure. The existing single admin credential is not multi-user RBAC or individual accountant attribution.

Research sources and the actual review date are recorded in `src/finance/paymentCatalog.ts` and shown in Admin. The directory is non-exhaustive, has explicit `partial` / `needs_research` coverage and a stale-research warning after 90 days. It does **not** crawl every country continuously, certify account approval, automatically sign up for a service, or activate unimplemented rails. Review official sources/contracts before each new integration; customer-country availability must not be confused with merchant eligibility.

Reports currently scan stored collections; reconciliation/report catch-up is bounded, but this is not a large-volume analytics warehouse. Monitor storage size, API execution time, scheduler health and backups as volume grows. Public HTTP endpoints cannot replace bank/provider statement review.

## Local verification

```sh
bun install --frozen-lockfile
npm run lint
npm test
npm run build
```

Focused tests: `tests/finance.test.ts`, `tests/directPurchase.test.ts`, `tests/storeCheckout.test.ts`, `tests/customerPaymentVault.test.ts`. They cover exact money, Cairo/DST periods, idempotency/concurrency, persistence, verification mismatches, test isolation, incomplete profit, corrections, protected routes, bounded reconciliation and isolated buy-now/cart returns. Provider/network/database behavior is mocked where needed; no real payment, refund or transfer is executed.
