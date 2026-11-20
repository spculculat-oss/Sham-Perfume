/**
 * «سيرفر الروبوتات» — what every robot does on the robots' server (Render, 2026-11), step by step.
 *
 * The owner moved the robots off GitHub Actions (docs/ROBOT_DISTRIBUTION.md): GitHub only builds, tests and deploys
 * the site. Each entry here is the server copy of one robot workflow in .github/workflows (kept there for a manual
 * run in an emergency): the same scripts, the same settings and the same owner's switch. The timetables stay in
 * SCHEDULES (src/utils/opsLive.ts). tests/robotsServer.test.ts fails when a scheduled robot has no entry here, when
 * the robots sharing a workflow differ from its gate line, or when a step calls a script that does not exist.
 *
 * What changes on the server (and why):
 * - No publishing per robot. Every result stays on the server and goes to the site in ONE daily snapshot commit
 *   (the GitHub commitment «few, batched commits»). scripts/ci/publish.mjs only keeps the files in batch mode.
 * - No full test suite after each robot (the server is small); each robot keeps its own behaviour tests, and the
 *   whole suite still runs on GitHub before the daily snapshot is deployed (pages.yml).
 * - Steps marked `heavy` need more than the free server has (a local AI model, the photo cleaner, a phone browser,
 *   a full site build). They are skipped and say so, until the owner gives the server more room (ROBOTS_HEAVY=1).
 * - A robot that asks another robot to run (the patrol, the meeting, the scout) puts it in the server's queue
 *   instead of starting a GitHub workflow.
 * - Secrets: each robot gets only the keys its workflow gave it — never the others.
 */

/** What a step can read: the outputs of earlier steps (by id) and the environment. */
export interface StepCtx { out: Record<string, Record<string, string>>; env: Record<string, string | undefined>; cron?: string }
type EnvValue = string | ((c: StepCtx) => string | undefined);
export interface RobotStep {
  id?: string;
  name: string;
  /** A bash command, run from the repository root of the server's copy. */
  run: string;
  env?: Record<string, EnvValue>;
  when?: (c: StepCtx) => boolean;
  /** continue-on-error: a failure is logged and the robot goes on. */
  optional?: boolean;
  /** Needs more than the free server (the reason, in Arabic). Skipped unless ROBOTS_HEAVY=1. */
  heavy?: string;
  /** Runs even after an earlier step failed (cleanup). */
  always?: boolean;
  timeoutMin?: number;
}
/** Another robot to put in the queue after this one, with extra settings. */
export interface FollowUp { workflow: string; env?: Record<string, string> }
export interface Robot {
  workflow: string;
  /** The robots sharing this workflow — exactly the ids on its `gate.mjs` line. */
  bots: string[];
  nameAr: string;
  timeoutMin: number;
  /** Secrets this robot may see (from its workflow). */
  secrets?: string[];
  /** Gets the owner's GitHub token (issues, labels, pull requests, releases). */
  github?: boolean;
  env?: Record<string, EnvValue>;
  steps: RobotStep[];
  /** The whole robot needs more than the free server. */
  heavy?: string;
  /**
   * Works on its own copy of the site (it switches branches or applies code): its listed files are copied back to
   * the shared copy when it finishes.
   */
  isolated?: { keep: string[] };
  /** Robots to queue after a successful run (what the workflow used to start with `gh workflow run`). */
  then?: (c: StepCtx) => FollowUp[];
}

export const AI_KEYS = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY', 'PERPLEXITY_API_KEY'];
/** Every secret the robots use. A robot's environment never has one it did not ask for. */
export const SECRET_NAMES = [...AI_KEYS, 'SHAM_ADMIN_TOKEN', 'MANUS_API_KEY', 'BRAVE_SEARCH_API_KEY', 'SAFE_BROWSING_API_KEY',
  'GSC_SERVICE_ACCOUNT_JSON', 'BING_WEBMASTER_API_KEY', 'YANDEX_WEBMASTER_TOKEN', 'AISTUDIO_REPO_TOKEN', 'ROBOTS_GITHUB_TOKEN',
  'GITHUB_TOKEN', 'GH_TOKEN'];

export const API = 'https://sham-perfume-49bf.vercel.app';
export const PAGES = 'https://spculculat-oss.github.io/Sham-Perfume/';
/** The owner's setting when he made one, else the workflow's default. */
const or = (name: string, fallback: string): EnvValue => (c) => c.env[name] || fallback;
const tsx = (script: string, args = '') => `node --import tsx ${script}${args ? ` ${args}` : ''}`;
const test = (...files: string[]) => `node --import tsx --import ./tests/register-assets.mjs --test ${files.join(' ')}`;
const yes = (v?: string) => Boolean(v && v !== '0');

const LLAMA = { LLAMA_BUILD: 'b11790', LLAMA_SHA256: '0e2b856ca192699fdb5c8dfe591b7896d658760bcdd48f133322236cd311c455' };
const TEACHER_HEAVY = 'المعلم المحلي نموذج ذكاء كامل محتاج ذاكرة أكبر من السيرفر المجاني';
const BROWSER_HEAVY = 'محتاج متصفح موبايل كامل وذاكرة أكبر من السيرفر المجاني';
const stopTeacher = (step: string): RobotStep => ({
  name: 'Stop the local teacher', always: true, when: (c) => Boolean(c.out[step]?.base_url),
  run: 'kill "$(cat "${RUNNER_TEMP}/teacher/server.pid")" 2>/dev/null || true',
});

/** A robot that writes its report and checks it with its own behaviour tests (most of them). */
const simple = (workflow: string, bots: string[], nameAr: string, timeoutMin: number, script: string, tests: string[], extra: Partial<Robot> = {}): Robot => ({
  workflow, bots, nameAr, timeoutMin, ...extra,
  steps: [{ name: 'Write the report', run: tsx(script) }, ...(tests.length ? [{ name: 'Behaviour tests', run: test(...tests) }] : [])],
});

export const ROBOTS: Robot[] = [
  {
    workflow: 'aistudio-bridge.yml', bots: ['studio_bridge'], nameAr: 'بوابة جوجل استوديو', timeoutMin: 25,
    heavy: 'بيبني الموقع كله ويختبره قبل ما ينشر كود — محتاج سيرفر أكبر (لحد كده بيشتغل يدوي من GitHub)',
    secrets: ['AISTUDIO_REPO_TOKEN'], github: true, isolated: { keep: ['src/data/live/aistudio-bridge.json'] },
    env: { STUDIO_REPO: or('AISTUDIO_REPO', 'spculculat-oss/Sham-new'), BRIDGE_PUBLISH: 'true', BRIDGE_FILE: 'src/data/live/aistudio-bridge.json' },
    steps: [
      { id: 'plan', name: 'Filter the studio changes', run: 'git fetch -q --unshallow origin main 2>/dev/null || true; ' + tsx('scripts/aistudio/bridge.mts', 'plan') },
      { name: 'Publish, or park for approval', run: 'export BRIDGE_AUTHOR="Sham Perfume <$(printf \'%s\' "${AISTUDIO_AUTHORS:-s.p.culculat@gmail.com}" | cut -d, -f1 | tr -d \' \')>"; ' + tsx('scripts/aistudio/bridge.mts', 'finish') },
    ],
  },
  {
    workflow: 'platform-census.yml', bots: ['census'], nameAr: 'روبوت التعداد', timeoutMin: 15,
    env: { PUBLISH: 'true', SHAM_API_BASE_URL: (c) => c.env.PAGES_API_BASE_URL || c.env.VITE_API_BASE_URL || c.env.SHAM_API_BASE_URL || API },
    steps: [{ name: 'Sync the visit ledger', run: tsx('scripts/state/census.mts') }],
  },
  {
    workflow: 'platform-state.yml', bots: ['state'], nameAr: 'دولة المنصة', timeoutMin: 60, github: true,
    // It checks robots' pull requests out to review them: never on the shared copy that holds the day's results.
    isolated: { keep: ['src/data/live/platform-state.json', 'src/data/owner/state-orders.json', 'SHAHEEN_HANDBOOK.md', 'SHAHEEN_ORG.md'] },
    env: { STATE_ACT: 'true' },
    steps: [{ name: 'Vote, check, decide, and keep the log', run: tsx('scripts/state/run.mts') }],
  },
  {
    workflow: 'product-pages-check.yml', bots: ['product_pages'], nameAr: 'فحص صفحات المنتجات', timeoutMin: 20, heavy: BROWSER_HEAVY,
    env: { INSPECT_SITE: or('PAGES_SITE_URL', PAGES), INSPECT_SHOTS: '/tmp/shots', PUPPETEER_PATH: '/tmp/pp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js' },
    steps: [
      { name: 'Install headless browser driver', run: 'mkdir -p /tmp/pp && cd /tmp/pp && npm init -y >/dev/null && npm i --no-audit --no-fund puppeteer-core@24 >/dev/null' },
      { name: 'Product pages and store on a phone', run: 'node scripts/inspect/products.mjs' },
    ],
  },
  {
    workflow: 'shaheen-council.yml', bots: ['council'], nameAr: 'مجلس شاهين', timeoutMin: 20, secrets: AI_KEYS, github: true,
    env: { COUNCIL_COMMIT: 'true', COUNCIL_ISSUES: 'true', COUNCIL_MAX_TASKS: or('COUNCIL_MAX_TASKS', '3') },
    steps: [{ id: 'council', name: 'Shaheen holds the meeting', run: tsx('scripts/shaheen-council/run.mts') }],
    then: (c) => words(c.out.council?.reruns).filter((w) => ['shaheen-import.yml', 'shaheen-discover.yml', 'shaheen-news.yml', 'shaheen-seo.yml'].includes(w)).map((workflow) => ({ workflow })),
  },
  {
    workflow: 'shaheen-discover.yml', bots: ['scout', 'teacher', 'school'], nameAr: 'كشّاف المصادر ومدرسة شاهين', timeoutMin: 70,
    secrets: [...AI_KEYS, 'BRAVE_SEARCH_API_KEY', 'SAFE_BROWSING_API_KEY', 'SHAM_ADMIN_TOKEN'],
    env: {
      PUBLISH: 'true', DISCOVER_MAX_ACTIVE: or('DISCOVER_MAX_ACTIVE', '20'), DISCOVER_VET_PER_RUN: or('DISCOVER_VET_PER_RUN', '10'),
      DISCOVER_QUERIES: or('DISCOVER_QUERIES', '4'), DISCOVER_TIME_BUDGET_S: '900', SCHOOL_MAX_STUDY: or('SCHOOL_MAX_STUDY', '10'), SCHOOL_INTENSIVE: or('SCHOOL_INTENSIVE', '1'),
    },
    steps: [
      { id: 'scout', name: '«كشّاف المصادر» finds and checks perfume stores', optional: true, run: tsx('scripts/shaheen-discover/run.mts') },
      {
        id: 'teacher', name: '«المعلم المحلي» — an open model on this server', optional: true, timeoutMin: 15, heavy: TEACHER_HEAVY, run: 'bash scripts/shaheen-school/teacher.sh',
        env: {
          ...LLAMA, TEACHER_MODEL_URL: or('TEACHER_MODEL_URL', 'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf'),
          TEACHER_MODEL_SHA256: (c) => (c.env.TEACHER_MODEL_URL ? c.env.TEACHER_MODEL_SHA256 : '65b8fcd92af6b4fefa935c625d1ac27ea29dcb6ee14589c55a8f115ceaaa1423'),
          TEACHER_MODEL_NAME: or('TEACHER_MODEL_NAME', 'qwen2.5-7b-instruct'),
        },
      },
      {
        name: '«مدرسة شاهين» — exam, self-study, study with the local teacher or AI', optional: true, timeoutMin: 25, run: tsx('scripts/shaheen-school/run.mts'),
        env: { SHAM_LLM_BASE_URL: (c) => c.out.teacher?.base_url, SHAM_LLM_MODEL: (c) => c.out.teacher?.model, SCHOOL_PREFER: or('SCHOOL_PREFER', 'self_hosted'), SCHOOL_BUDGET_MIN: '18' },
      },
      stopTeacher('teacher'),
    ],
    then: (c) => (yes(c.out.scout?.activated) ? [{ workflow: 'shaheen-import.yml' }] : []),
  },
  {
    workflow: 'shaheen-doctor.yml', bots: ['doctor'], nameAr: 'دكتور شاهين', timeoutMin: 5,
    env: { DOCTOR_DAEMON: '0', CHECK_TYPE: 'full' },
    steps: [{ name: 'Run Shaheen Doctor', run: 'python3 scripts/doctor/shaheen_doctor.py' }],
  },
  {
    workflow: 'shaheen-finance.yml', bots: ['finance'], nameAr: 'المراجعة المالية', timeoutMin: 5, secrets: ['SHAM_ADMIN_TOKEN'],
    env: { SHAM_FINANCE_API_URL: or('SHAM_FINANCE_API_URL', API) },
    steps: [{ name: 'Run private finance audit', run: tsx('scripts/shaheen-finance/run.mts') }],
  },
  simple('shaheen-finance-shield.yml', ['finance_shield'], 'حارس المدفوعات والعمولات', 15, 'scripts/shaheen-finance/shield-run.mts', ['tests/financeShield.test.ts'],
    { env: { SHAM_SHIELD_API_URL: or('SHAM_SHIELD_API_URL', API) } }),
  simple('shaheen-catalog-review.yml', ['catalog_review'], 'مراجعة المنتجات', 15, 'scripts/shaheen-catalog/run.mts', ['tests/catalogReview.test.ts'],
    { env: { SHAM_HOME_COUNTRY: or('SHAM_HOME_COUNTRY', 'EG') } }),
  {
    workflow: 'shaheen-import.yml', bots: ['importer', 'images'], nameAr: 'مستورد شاهين', timeoutMin: 50, secrets: [...AI_KEYS, 'SHAM_ADMIN_TOKEN'],
    // L-03: the importer still obeys the owner's import pause — SHAM_ALLOW_SCRAPE is his setting only, never set here.
    env: {
      IMPORT_COMMIT: 'true', IMPORT_MAX_NEW: or('IMPORT_MAX_NEW', '150'), IMPORT_MAX_REFRESH: or('IMPORT_MAX_REFRESH', '25'), IMPORT_MAX_TOTAL: or('IMPORT_MAX_TOTAL', '5000'),
      IMPORT_MAX_PER_SOURCE: or('IMPORT_MAX_PER_SOURCE', '1500'), SHAM_API_BASE: or('SHAM_API_BASE', API), IMPORT_MARKUP: or('IMPORT_MARKUP', '1.5'), STORE_MAX_BATCHES: or('STORE_MAX_BATCHES', '8'),
    },
    steps: [
      { name: 'Shaheen imports the products and «مراجع الصفحات» reviews them', run: tsx('scripts/shaheen-import/run.mts') },
      {
        name: '«منقّح الصور» removes other sources\' contact marks from the product photos', optional: true, timeoutMin: 25,
        heavy: 'منقّح الصور بيشغّل نماذج صور محتاجة ذاكرة أكبر من السيرفر المجاني', env: { IMAGE_TIME_BUDGET_S: or('IMAGE_TIME_BUDGET_S', '900') },
        run: 'pip install -q --break-system-packages rapidocr_onnxruntime pillow numpy && python3 scripts/shaheen-images/test_detect.py && python3 scripts/shaheen-images/clean.py',
      },
      { name: '«تسعير شام» refreshes the exchange rates', optional: true, run: tsx('scripts/shaheen-store/fx.mts') },
      { name: 'Shaheen writes the Arabic names and descriptions of the new products', optional: true, run: tsx('scripts/shaheen-store/run.mts') },
      { name: '«ذاكرة شاهين» collects and curates what Shaheen learned', optional: true, run: tsx('scripts/shaheen-memory/run.mts') },
      { name: 'Every product gets its own page (build check)', run: `${tsx('scripts/product-pages.mts', '/tmp/robots-pages')} && ls /tmp/robots-pages/p | wc -l; rm -rf /tmp/robots-pages` },
    ],
  },
  simple('shaheen-trade.yml', ['trade_lanes'], 'الشحن والتجارة الدولية', 15, 'scripts/shaheen-trade/run.mts', ['tests/tradeLanes.test.ts', 'tests/shaheenMindLoop.test.ts', 'tests/shippingNet.test.ts']),
  simple('shaheen-weave.yml', ['weaver', 'curator'], 'الناسج والمؤرشف', 15, 'scripts/shaheen-memory/weave.mts', ['tests/shaheenWeave.test.ts']),
  simple('shaheen-carriers.yml', ['carriers'], 'كشّاف الشحن', 15, 'scripts/shaheen-carriers/run.mts', ['tests/carrierScout.test.ts']),
  simple('shaheen-synapse.yml', ['synapse', 'immune'], 'شبكة العقل والمناعة', 20, 'scripts/shaheen-synapse/run.mts', ['tests/shaheenMind.test.ts']),
  simple('shaheen-mind.yml', ['ears', 'tutor', 'examiner', 'reflex'], 'حلقة التعلّم', 25, 'scripts/shaheen-mind/run.mts', ['tests/shaheenMindLoop.test.ts']),
  simple('shaheen-inventory.yml', ['inventory'], 'إدارة المخزون', 10, 'scripts/shaheen-inventory/run.mts', ['tests/shaheenInventory.test.ts'],
    { secrets: ['SHAM_ADMIN_TOKEN'], env: { SHAM_INVENTORY_API_URL: or('SHAM_INVENTORY_API_URL', API) } }),
  simple('shaheen-lab.yml', ['lab'], 'المُجرِّب', 20, 'scripts/shaheen-lab/run.mts', []),
  simple('shaheen-localization.yml', ['localization_audit'], 'جودة الترجمة واللغات', 15, 'scripts/shaheen-localization/run.mts', ['tests/localizationAudit.test.ts']),
  simple('shaheen-scent.yml', ['scent_behavior'], 'سلوك الزائر العطري', 10, 'scripts/shaheen-scent/run.mts', ['tests/scentBehavior.test.ts'],
    { secrets: ['SHAM_ADMIN_TOKEN'], env: { SHAM_SCENT_API_URL: or('SHAM_SCENT_API_URL', API) } }),
  simple('shaheen-senses.yml', ['senses_site', 'senses_world'], 'حسّاسات الموقع والعالم', 15, 'scripts/shaheen-senses/run.mts', ['tests/shaheenSenses.test.ts']),
  {
    workflow: 'shaheen-brain.yml', bots: ['brain'], nameAr: 'مختبر عقل شاهين', timeoutMin: 150, github: true,
    env: { PUBLISH: 'true', DO_EXAM: 'true', ...LLAMA },
    steps: [
      { id: 'data', name: 'The training files (no AI, no personal data, no prices)', run: tsx('scripts/shaheen-brain/dataset.mts'), env: { BRAIN_OUT: (c) => `${c.env.RUNNER_TEMP}/shaheen-brain`, BRAIN_REPORT: 'write' } },
      {
        name: 'Publish the training files (GitHub release «shaheen-brain-data»)', env: { DIR: (c) => c.out.data?.dir },
        run: 'gh release view shaheen-brain-data >/dev/null 2>&1 || gh release create shaheen-brain-data --latest=false --title "Shaheen brain — training data" '
          + '--notes "Training files for Shaheen\'s own model (scripts/shaheen-brain). Rebuilt weekly from his reviewed memory; no personal data, no prices."; '
          + 'gh release upload shaheen-brain-data "$DIR/shaheen-train.jsonl" "$DIR/shaheen-eval.jsonl" "$DIR/shaheen-card.json" --clobber',
      },
      {
        id: 'plan', name: 'What to examine? (no AI)', run: tsx('scripts/shaheen-brain/plan.mts'),
        env: { EVAL_SHA: (c) => c.out.data?.eval_sha },
      },
      {
        id: 'cand_server', name: 'The new brain on this server', optional: true, timeoutMin: 15, heavy: TEACHER_HEAVY, when: (c) => c.out.plan?.run === 'true',
        run: 'bash scripts/shaheen-school/teacher.sh',
        env: { TEACHER_MODEL_URL: (c) => c.out.plan?.cand_url, TEACHER_MODEL_SHA256: (c) => c.out.plan?.cand_sha, TEACHER_MODEL_NAME: (c) => c.out.plan?.cand_name },
      },
      {
        name: 'Exam of the new brain', optional: true, timeoutMin: 40, heavy: TEACHER_HEAVY, when: (c) => c.out.plan?.run === 'true',
        run: tsx('scripts/shaheen-brain/exam.mts'),
        env: {
          SHAM_LLM_BASE_URL: (c) => c.out.cand_server?.base_url, SHAM_LLM_MODEL: (c) => c.out.cand_server?.model, EXAM_ROLE: 'candidate',
          EXAM_MODEL_NAME: (c) => c.out.plan?.cand_name, EXAM_MODEL_URL: (c) => c.out.plan?.cand_url, EXAM_MODEL_SHA256: (c) => c.out.plan?.cand_sha, BRAIN_OUT: (c) => c.out.data?.dir,
        },
      },
      stopTeacher('cand_server'),
    ],
  },
  {
    workflow: 'shaheen-languages.yml', bots: ['languages'], nameAr: 'اللغات والمترجم الذكي', timeoutMin: 30, secrets: AI_KEYS,
    env: { LANG_AI_MAX_CALLS: or('LANG_AI_MAX_CALLS', '20'), LANG_AI_TIME_BUDGET_S: '900' },
    steps: [{ name: 'Audit the languages + «المترجم الذكي»', run: tsx('scripts/shaheen-languages/run.mts') }],
  },
  {
    workflow: 'shaheen-maneuver.yml', bots: ['maneuver'], nameAr: 'مناورة التخصصات', timeoutMin: 25, secrets: AI_KEYS,
    // The browser pass needs a phone browser: without one the maneuver skips it by itself and walks the rest.
    env: { MANEUVER_ACT: 'true', PUPPETEER_PATH: (c) => (c.env.ROBOTS_HEAVY === '1' ? '/tmp/pp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js' : '') },
    steps: [
      { name: 'Install the phone browser driver (outside the project)', heavy: BROWSER_HEAVY, optional: true, run: 'mkdir -p /tmp/pp && cd /tmp/pp && npm init -y >/dev/null && npm i --no-audit --no-fund puppeteer-core@24 >/dev/null' },
      { id: 'maneuver', name: 'Walk the live site and talk with Shaheen', run: tsx('scripts/shaheen-maneuver/run.mts') },
    ],
  },
  {
    workflow: 'shaheen-manus.yml', bots: ['design_audit', 'visitor_tour', 'verifier'], nameAr: 'وكيل شاهين الخلفي', timeoutMin: 45, secrets: ['MANUS_API_KEY'],
    env: { MANUS_PROFILE: or('MANUS_PROFILE', 'lite'), MANUS_WAIT_MIN: or('MANUS_WAIT_MIN', '30'), MANUS_MONTHLY_CREDITS: or('MANUS_MONTHLY_CREDITS', '2000'), MANUS_SCHEDULE: (c) => c.cron },
    steps: [{ name: 'Shaheen\'s agent runs its mission', run: tsx('scripts/shaheen-manus/run.mts') }],
  },
  {
    workflow: 'shaheen-news.yml', bots: ['secretary', 'catalog', 'news'], nameAr: 'نشرة شاهين والمشرف', timeoutMin: 45, secrets: [...AI_KEYS, 'SHAM_ADMIN_TOKEN'],
    env: { NEWS_COMMIT: 'true', SUPERVISOR_COMMIT: 'true', SHAM_SITE_URL: or('DOCTOR_SITE_URL', API) },
    steps: [
      { name: 'Collect news and train «مساعد شام»', run: tsx('scripts/shaheen-news/run.mts') },
      { name: 'Shaheen trains «متجر شام» (product catalog)', optional: true, run: tsx('scripts/shaheen-store/run.mts') },
      { name: 'Shaheen tests, scores and guides every AI tool', run: tsx('scripts/shaheen-supervisor/run.mts') },
    ],
  },
  {
    workflow: 'shaheen-patrol.yml', bots: ['patrol'], nameAr: 'الدورية بالتناوب', timeoutMin: 15, secrets: AI_KEYS, github: true,
    env: { PATROL_ACT: 'true' },
    steps: [{ id: 'patrol', name: 'Every tool inspects its work', run: tsx('scripts/shaheen-patrol/run.mts') }],
    then: (c) => words(c.out.patrol?.reruns).filter((w) => PATROL_RERUNS.has(w)).map((workflow) => ({ workflow })),
  },
  {
    workflow: 'shaheen-precheck.yml', bots: ['precheck'], nameAr: 'الفحص الشامل قبل الاجتماع', timeoutMin: 10, github: true,
    env: { PRECHECK_COMMIT: 'true' },
    steps: [{ name: 'Full check of every tool', run: tsx('scripts/shaheen-council/precheck.mts') }],
  },
  {
    workflow: 'shaheen-school-clock.yml', bots: ['academy'], nameAr: 'أكاديمية شاهين', timeoutMin: 75, secrets: ['GEMINI_API_KEY', 'SHAM_ADMIN_TOKEN'],
    env: { PUBLISH: 'true', SCHOOL_FOCUS: 'experts', SCHOOL_MAX_STUDY: or('SCHOOL_CLOCK_MAX_STUDY', '8'), ...LLAMA },
    steps: [
      { id: 'backlog', name: 'What is left to study? (no AI)', run: tsx('scripts/shaheen-school/backlog.mts') },
      {
        id: 'pick', name: 'Which teacher?', when: (c) => c.out.backlog?.todo !== '0', run: tsx('scripts/shaheen-brain/teacher.mts'),
        env: { VAR_URL: (c) => c.env.TEACHER_MODEL_URL, VAR_SHA256: (c) => c.env.TEACHER_MODEL_SHA256, VAR_NAME: (c) => c.env.TEACHER_MODEL_NAME },
      },
      {
        id: 'teacher', name: '«المعلم المحلي» — an open model on this server', optional: true, timeoutMin: 15, heavy: TEACHER_HEAVY, when: (c) => c.out.backlog?.todo !== '0',
        run: 'bash scripts/shaheen-school/teacher.sh',
        env: { TEACHER_MODEL_URL: (c) => c.out.pick?.url, TEACHER_MODEL_SHA256: (c) => c.out.pick?.sha256, TEACHER_MODEL_NAME: (c) => c.out.pick?.name, TEACHER_MODEL_CACHE: (c) => `${c.env.RUNNER_TEMP}/teacher-model` },
      },
      {
        name: '«مدرسة شاهين» — the experts\' syllabus first', optional: true, timeoutMin: 30, when: (c) => c.out.backlog?.todo !== '0', run: tsx('scripts/shaheen-school/run.mts'),
        env: { SHAM_LLM_BASE_URL: (c) => c.out.teacher?.base_url, SHAM_LLM_MODEL: (c) => c.out.teacher?.model, SCHOOL_PREFER: 'self_hosted', SCHOOL_BUDGET_MIN: '25' },
      },
      stopTeacher('teacher'),
      { id: 'harvest', name: '«حصّاد شاهين» — answers ready before the packages run out', optional: true, timeoutMin: 16, run: tsx('scripts/shaheen-harvest/run.mts'), env: { HARVEST_BUDGET_MIN: '12' } },
    ],
  },
  {
    workflow: 'shaheen-seo.yml', bots: ['seo'], nameAr: 'منارة شاهين (SEO)', timeoutMin: 45, github: true,
    secrets: [...AI_KEYS, 'BING_WEBMASTER_API_KEY', 'GSC_SERVICE_ACCOUNT_JSON', 'YANDEX_WEBMASTER_TOKEN'],
    env: { SEO_COMMIT: 'true', SEO_SUBMIT: '1', SEO_SITE_URL: or('SEO_SITE_URL', PAGES), SEO_WEEKLY_ISSUE: '1' },
    steps: [
      { name: 'Run one Manaret Shaheen cycle', run: tsx('scripts/seo-agent/run.mts') },
      { name: 'Write visibility and growth summary', run: tsx('scripts/seo-agent/weekly-report.mts') },
    ],
  },
  simple('shaheen-service.yml', ['service'], 'مكتب خدمة العملاء', 10, 'scripts/shaheen-service/run.mts', ['tests/shaheenService.test.ts'],
    { secrets: ['SHAM_ADMIN_TOKEN'], env: { SHAM_SERVICE_API_URL: or('SHAM_SERVICE_API_URL', API) } }),
  {
    workflow: 'shaheen-sales.yml', bots: ['sales'], nameAr: 'إدارة المبيعات', timeoutMin: 10, secrets: ['SHAM_ADMIN_TOKEN'],
    env: { SHAM_SALES_API_URL: or('SHAM_SALES_API_URL', API) },
    steps: [
      { name: 'Regenerate the playbook', run: tsx('scripts/shaheen-sales/playbook-doc.mts') },
      { name: 'Study and write the sales report (real numbers only)', run: tsx('scripts/shaheen-sales/run.mts') },
      { name: 'Behaviour tests', run: test('tests/salesManager.test.ts') },
    ],
  },
];

/** What the patrol may start (the same list as its workflow). */
export const PATROL_RERUNS = new Set(['shaheen-import.yml', 'shaheen-discover.yml', 'shaheen-news.yml', 'shaheen-seo.yml', 'shaheen-service.yml',
  'shaheen-inventory.yml', 'shaheen-languages.yml', 'shaheen-precheck.yml']);
const words = (s?: string) => (s || '').split(/\s+/).filter(Boolean);

export const robotOf = (workflow: string) => ROBOTS.find((r) => r.workflow === workflow);

/**
 * The files the robots may change on the site — and so the only ones the daily snapshot may carry.
 * Code is never in it: the robots' results only.
 */
export const SNAPSHOT_PATHS = ['src/data/', 'src/لغات/', 'public/store-images/', 'SALES_PLAYBOOK.md', 'SHAHEEN_HANDBOOK.md', 'SHAHEEN_ORG.md'];
/** Never carried by the snapshot: the owner's switches are written from his GitHub account only. */
export const NEVER_IN_SNAPSHOT = ['src/data/owner/controls.json'];
export const inSnapshot = (path: string) => !NEVER_IN_SNAPSHOT.includes(path) && SNAPSHOT_PATHS.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p));
