/** The owner's switches as the robots' scripts read them (missing or broken file = nothing paused). */
import { readFileSync } from 'node:fs';
import { defaultControls, readControls, type OwnerControls } from '../../src/utils/ownerAuthority';

export function loadOwnerControls(file = 'src/data/owner/controls.json'): OwnerControls {
  try { return readControls(JSON.parse(readFileSync(file, 'utf8'))); } catch { return defaultControls(); }
}
