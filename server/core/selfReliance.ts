/**
 * «شاهين معتمد على نفسه» — the owner's switch (src/data/owner/controls.json → aiPlatforms, rule O-10).
 *
 * Three positions:
 *   off  — nothing in this process may reach an outside AI platform (below).
 *   auto — the owner's choice: use configured platforms while they work; external search results stay cited visitor
 *          answers until reviewed and never enter school memory automatically. When no platform works (no key, no
 *          credit, a limit, an outage), Shaheen answers on his own — his agent, designer, library and memory — without
 *          an error or waiting on an engine already known to be down.
 *   on   — the platforms first; when they fail, his memory and library (the older behaviour).
 *
 * When it is off, nothing in this process may reach an outside AI platform: every hosted engine counts as not
 * configured (so the chat, the robots and the admin tools all fall back to Shaheen's own brain), Manus is not
 * called, and an open model is used only when it runs on our own machine (the teacher on the robots' runner).
 * The owner's word wins over the environment: a deployment variable can't turn the platforms back on.
 */
import bundled from '../../src/data/owner/controls.json';
import { readControls } from '../../src/utils/ownerAuthority';

type Env = Record<string, string | undefined>;
export const AI_PLATFORMS_VAR = 'SHAM_AI_PLATFORMS';

const owner = readControls(bundled).aiPlatforms;
if (owner === 'off' || owner === 'auto') process.env[AI_PLATFORMS_VAR] = owner;

export type PlatformsMode = 'off' | 'auto' | 'on';
/** The switch as this process sees it (the owner's file, or what this environment says, e.g. a test). */
export function platformsMode(env: Env = process.env): PlatformsMode {
  const v = env[AI_PLATFORMS_VAR]?.trim().toLowerCase();
  return v === 'off' ? 'off' : v === 'auto' ? 'auto' : 'on';
}
/** True when the owner closed every outside AI platform (or this environment says so, e.g. a test). */
export const platformsOff = (env: Env = process.env) => platformsMode(env) === 'off';
/** «تلقائي»: the platforms while they work, Shaheen on his own the moment they don't. */
export const platformsAuto = (env: Env = process.env) => platformsMode(env) === 'auto';

/** An address on this very machine: a model served here is ours, not a platform. */
export function isOwnMachine(url: string | undefined): boolean {
  try {
    const host = new URL(url || '').hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0' || host.endsWith('.localhost');
  } catch { return false; }
}
