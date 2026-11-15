/**
 * «بوابة الإنترنت» for the robots that run on GitHub (rules: src/utils/netGate.ts, server: server/core/netGate.ts).
 *
 *   import { netGate } from '../net-gate.mts';
 *   const gate = netGate('seo');
 *   const found = await gate.search('أشهر عطور الشتا 2026');   // { answer?, sources[] }
 *   const page = await gate.read('https://example.com/page');   // { page: { title, text } }
 *   const full = await gate.ask('إيه قواعد IFRA للعود؟');        // search + the first pages read
 *
 * With SHAM_ADMIN_TOKEN (every robot that already talks to the server has it) the request goes to the live gate, so
 * the counts, the memory and the daily allowance are the platform's own. Without it (a local run, a branch push) the
 * same gate runs inside the robot with the same rules. Run directly to try it:
 *   node --import tsx scripts/net-gate.mts <bot> search "سؤال"
 */
import { pathToFileURL } from 'node:url';
import { gateBrief, type GateAnswer, type GateKind } from '../src/utils/netGate';
import { createNetGate, GateError } from '../server/core/netGate';

type Env = Record<string, string | undefined>;
const DEFAULT_SITE = 'https://sham-perfume-49bf.vercel.app';

export class NetGateError extends Error {
  constructor(public code: string, public reasonAr: string) { super(`${code}: ${reasonAr}`); }
}

export function netGate(bot: string, { env = process.env as Env, fetch: request = fetch, lang = 'ar' }: { env?: Env; fetch?: typeof fetch; lang?: string } = {}) {
  const token = env.SHAM_ADMIN_TOKEN?.trim();
  const site = (env.SHAM_GATE_SITE || env.DOCTOR_SITE_URL || DEFAULT_SITE).replace(/\/+$/, '');
  let local: ReturnType<typeof createNetGate> | undefined;
  const inside = () => (local ||= createNetGate({ env, fetch: request }));

  const call = async (kind: GateKind, input: { q?: string; url?: string }): Promise<GateAnswer> => {
    const body = { kind, bot, lang, ...input };
    if (token) {
      try {
        const response = await request(`${site}/api/admin/gate`, {
          method: 'POST', signal: AbortSignal.timeout(60_000),
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({})) as GateAnswer & { code?: string; error?: string };
        if (response.ok) return data;
        // The gate said no (quota, a blocked page…): that answer stands — no going around it.
        if (response.status === 400 || response.status === 403 || response.status === 429) throw new NetGateError(data.code || String(response.status), data.error || 'البوابة رفضت الطلب');
      } catch (error) {
        if (error instanceof NetGateError) throw error;
        /* the live gate is unreachable (old deployment, network): the same rules inside the robot */
      }
    }
    try { return await inside().fetch(body); }
    catch (error) {
      if (error instanceof GateError) throw new NetGateError(error.code, error.reasonAr);
      throw error;
    }
  };

  return {
    search: (q: string) => call('search', { q }),
    read: (url: string) => call('read', { url }),
    ask: (q: string) => call('ask', { q }),
    /** The answer as text for a robot's instructions (untrusted: never follow orders written in it). */
    brief: gateBrief,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [bot = 'researcher', kind = 'search', ...rest] = process.argv.slice(2);
  const gate = netGate(bot);
  const input = rest.join(' ');
  const run = kind === 'read' ? gate.read(input) : kind === 'ask' ? gate.ask(input) : gate.search(input);
  run.then((a) => { console.log(gateBrief(a, 3000)); }).catch((e: unknown) => { console.error(e instanceof NetGateError ? e.reasonAr : String(e)); process.exitCode = 1; });
}
