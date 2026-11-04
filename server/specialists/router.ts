/**
 * واجهة «مجلس المتخصصين» على السيرفر:
 *   GET  /api/specialists/board    — المجلس وأدواته (هل الوكيل شغال بمحرك دلوقتي ولا الرد من الأدوات بس)
 *   POST /api/specialists/consult  — سؤال الزائر للوكيل (server/specialists/agent.ts)
 *
 * نفس قواعد باقي واجهات الزوار: حد على عدد الطلبات لكل زائر (IP + معرف المتصفح)، ومفيش في الرد
 * اسم مزوّد أو منصة، وكل رد مكتوب عليه مصدره والأدوات اللي اشتغلت فيه.
 */
import express from 'express';
import { RAW_MATERIALS_DATABASE } from '../../src/data/rawMaterials';
import { createResearchSpider } from '../../src/utils/researchSpider';
import { RESEARCH_USER_AGENT } from '../../src/utils/webResearch';
import {
  SITE_SECTIONS, SPECIALISTS, specialistsOf, type SpecialistId,
} from '../../src/utils/shaheenSpecialists';
import { capacityConfig, VISITOR_ID } from '../core/capacity';
import { engineStatuses } from '../core/engines';
import { trainedKnowledge } from '../core/liveData';
import type { ShaheenMemory } from '../core/memory';
import type { Repository } from '../core/repository';
import { clientKey, RateLimiter } from '../core/rateLimit';
import { platformsOff } from '../core/selfReliance';
import type { ShaheenRuntime } from '../core/maintenance';
import type { LibrarySources } from '../../src/utils/shaheenLibrary';
import type { Research } from '../../src/utils/webResearch';
import { publicSpecialist, runSpecialistAgent, SpecialistsError, validateConsultInput } from './agent';
import { SPECIALIST_TOOLS, toolCatalogue, toolsFor } from './tools';

type Env = Record<string, string | undefined>;

export interface SpecialistsRouterOptions {
  repo: Repository;
  memory?: ShaheenMemory;
  runtime?: ShaheenRuntime;
  env?: Env;
  fetch?: typeof fetch;
  /** «مكتبة شاهين» (الاختبارات بتحقنها؛ الافتراضي: الدروس + موسوعة المواد + الذاكرة). */
  library?: () => Promise<LibrarySources>;
  /** «باحث شاهين» (الاختبارات بتحقنه؛ الافتراضي: ويكيبيديا من الواجهة العامة). */
  research?: (question: string, lang: string) => Promise<Research | undefined>;
  /** البحث في المصادر المفتوحة مقفول (لاختبار الرد المحلي بس). */
  researchOff?: boolean;
}

export function createSpecialistsRouter(options: SpecialistsRouterOptions) {
  const env = options.env || process.env;
  const capacity = capacityConfig(env);
  const router = express.Router();
  // نفس حدود شات شاهين: لكل زائر (IP + معرف المتصفح) ولكل IP.
  const limiter = new RateLimiter(capacity.perVisitorPerMin, 60_000);
  const ipLimiter = new RateLimiter(capacity.perIpPerMin, 60_000);

  const library = options.library || (async (): Promise<LibrarySources> => ({
    lessons: await trainedKnowledge(env, options.fetch).catch(() => []),
    materials: RAW_MATERIALS_DATABASE,
    memory: options.memory ? await options.memory.all().catch(() => undefined) : undefined,
  }));

  const researchFlag = env.SHAM_WEB_RESEARCH?.trim().toLowerCase();
  const researchOn = !options.researchOff && researchFlag !== '0' && researchFlag !== 'off'
    && (researchFlag === 'on' || researchFlag === '1' || Boolean(env.VERCEL) || env.NODE_ENV === 'production' || Boolean(options.fetch));
  const spider = createResearchSpider((options.fetch || fetch) as never, { userAgent: RESEARCH_USER_AGENT, timeoutMs: 8000 });
  const research = options.research || (!researchOn ? undefined : spider.search);

  /** هل الوكيل يقدر يشتغل بمحرك دلوقتي؟ (من غير أي اسم مزوّد — نعم أو لا بس). */
  const agentLive = async () => {
    if (platformsOff(env)) return false;
    const settings = await options.repo.settings().catch(() => undefined);
    if (settings && !settings.shaheen.enabled) return false;
    const configured = new Set(engineStatuses(env).filter((e) => e.configured).map((e) => e.id));
    return (settings?.shaheen.engines || []).some((id) => configured.has(id));
  };

  router.get('/board', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const ai = await agentLive();
      res.json({
        ai,
        specialists: SPECIALISTS.map((s) => ({ ...publicSpecialist(s), sections: SITE_SECTIONS.filter((x) => x.consultants.includes(s.id)).length })),
        sections: SITE_SECTIONS.map((s) => ({ id: s.id, titleAr: s.titleAr, titleEn: s.titleEn, consultants: s.consultants })),
        tools: SPECIALIST_TOOLS.map((t) => ({ id: t.name, labelAr: t.labelAr, labelEn: t.labelEn, descriptionAr: t.descriptionAr, descriptionEn: t.descriptionEn })),
        toolCount: SPECIALIST_TOOLS.length,
      });
    } catch {
      res.status(500).json({ error: 'The board is unavailable', code: 'BOARD_UNAVAILABLE' });
    }
  });

  /** أدوات متخصص بعينه — اللوحة الإدارية ومراجع الصفحات بيقروها. */
  router.get('/tools', (req, res) => {
    const id = typeof req.query.specialist === 'string' ? req.query.specialist : '';
    const specialist = SPECIALISTS.find((s) => s.id === id) || SPECIALISTS[0];
    res.setHeader('Cache-Control', 'no-store');
    res.json({ specialist: publicSpecialist(specialist), tools: toolCatalogue(specialist), count: toolsFor(specialist).length });
  });

  /** استشاريّو قسم من أقسام الموقع (الواجهة بتقراه عشان تقترح المتخصص). */
  router.get('/section/:id', (req, res) => {
    const section = SITE_SECTIONS.find((s) => s.id === req.params.id);
    if (!section) { res.status(404).json({ error: 'Unknown section', code: 'SECTION_NOT_FOUND' }); return; }
    res.json({ id: section.id, titleAr: section.titleAr, titleEn: section.titleEn, specialists: specialistsOf(section.id).map(publicSpecialist) });
  });

  router.post('/consult', async (req, res) => {
    const started = Date.now();
    res.setHeader('Cache-Control', 'no-store');
    try {
      const input = validateConsultInput(req.body);
      const ip = clientKey(req);
      const browser = req.get('x-sham-visitor') || (typeof req.body?.visitorId === 'string' ? req.body.visitorId : undefined);
      const visitor = browser && VISITOR_ID.test(browser) ? `${ip}|${browser}` : ip;
      if (!limiter.allow(visitor) || !ipLimiter.allow(ip)) {
        throw new SpecialistsError('RATE_LIMITED', 'Too many questions, please wait a minute', 429, 60_000);
      }
      const result = await runSpecialistAgent(input, {
        repo: options.repo, memory: options.memory, env, fetch: options.fetch,
        library, research, health: options.runtime?.health,
      });
      options.runtime?.record({ ms: Date.now() - started, status: 200 });
      if (!res.destroyed) res.json(result);
    } catch (error) {
      if (error instanceof SpecialistsError) {
        if (error.retryAfterMs) res.setHeader('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)));
        options.runtime?.record({ ms: Date.now() - started, status: error.status, code: error.code });
        res.status(error.status).json({ error: error.message, code: error.code });
        return;
      }
      console.error('[Specialists]', error instanceof Error ? error.message : error);
      options.runtime?.record({ ms: Date.now() - started, status: 500, code: 'INTERNAL' });
      if (!res.headersSent) res.status(500).json({ error: 'Internal error', code: 'INTERNAL' });
    }
  });

  return router;
}

export type { SpecialistId };
