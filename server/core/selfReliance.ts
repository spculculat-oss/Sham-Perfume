/**
 * «شاهين معتمد على نفسه» — the owner's switch (src/data/owner/controls.json → aiPlatforms, rule O-10).
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

if (readControls(bundled).aiPlatforms === 'off') process.env[AI_PLATFORMS_VAR] = 'off';

/** True when the owner closed every outside AI platform (or this environment says so, e.g. a test). */
export const platformsOff = (env: Env = process.env) => env[AI_PLATFORMS_VAR]?.trim().toLowerCase() === 'off';

/** An address on this very machine: a model served here is ours, not a platform. */
export function isOwnMachine(url: string | undefined): boolean {
  try {
    const host = new URL(url || '').hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0' || host.endsWith('.localhost');
  } catch { return false; }
}
