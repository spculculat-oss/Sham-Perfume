import type { StoreCoreWave } from './storeKeys';
import { STORE_TEXT_W1 } from './storeL10nExt1';
import { STORE_TEXT_W2 } from './storeL10nExt2';
import { STORE_TEXT_W3 } from './storeL10nExt3';
import { STORE_TEXT_W4 } from './storeL10nExt4';
import { STORE_TEXT_W5 } from './storeL10nExt5';
import { STORE_TEXT_W6 } from './storeL10nExt6';
import { STORE_TEXT_W7 } from './storeL10nExt7';
import { STORE_TEXT_W8 } from './storeL10nExt8';
import { STORE_TEXT_W9 } from './storeL10nExt9';

/**
 * The nine waves that carry the store's core strings in the platform's other ninety
 * languages — ten languages per file, so each wave stays a reviewable block.
 */
export const STORE_TEXT_WAVES: readonly StoreCoreWave[] = [
  STORE_TEXT_W1, STORE_TEXT_W2, STORE_TEXT_W3, STORE_TEXT_W4, STORE_TEXT_W5,
  STORE_TEXT_W6, STORE_TEXT_W7, STORE_TEXT_W8, STORE_TEXT_W9,
];

export { STORE_TEXT_W1, STORE_TEXT_W2, STORE_TEXT_W3, STORE_TEXT_W4, STORE_TEXT_W5 };
export { STORE_TEXT_W6, STORE_TEXT_W7, STORE_TEXT_W8, STORE_TEXT_W9 };
