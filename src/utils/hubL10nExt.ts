import type { SupportedLanguage } from '../types/i18n';
import { HUB_L10N_EXT_1 } from './hubL10nExt1';
import { HUB_L10N_EXT_2 } from './hubL10nExt2';
import { HUB_L10N_EXT_3 } from './hubL10nExt3';
import { HUB_L10N_EXT_4 } from './hubL10nExt4';
import { HUB_L10N_EXT_5 } from './hubL10nExt5';
import { HUB_L10N_EXT_6 } from './hubL10nExt6';
import { HUB_L10N_EXT_7 } from './hubL10nExt7';
import { HUB_L10N_EXT_8 } from './hubL10nExt8';
import { HUB_L10N_EXT_9 } from './hubL10nExt9';
import { HUB_L10N_EXT_10 } from './hubL10nExt10';
import { HUB_L10N_EXT_11 } from './hubL10nExt11';
import { HUB_L10N_EXT_12 } from './hubL10nExt12';
import { HUB_L10N_EXT_13 } from './hubL10nExt13';
import { HUB_L10N_EXT_14 } from './hubL10nExt14';
import { HUB_L10N_EXT_15 } from './hubL10nExt15';
import { HUB_L10N_EXT_16 } from './hubL10nExt16';
import { HUB_L10N_EXT_17 } from './hubL10nExt17';
import { HUB_L10N_EXT_18 } from './hubL10nExt18';
import { HUB_L10N_EXT_19 } from './hubL10nExt19';
import { HUB_L10N_EXT_20 } from './hubL10nExt20';
import { HUB_L10N_EXT_21 } from './hubL10nExt21';
import { HUB_L10N_EXT_22 } from './hubL10nExt22';
import { HUB_L10N_EXT_23 } from './hubL10nExt23';
import { HUB_L10N_EXT_24 } from './hubL10nExt24';
import { HUB_L10N_EXT_25 } from './hubL10nExt25';
import { HUB_L10N_EXT_26 } from './hubL10nExt26';
import { HUB_L10N_EXT_27 } from './hubL10nExt27';
import { HUB_L10N_EXT_28 } from './hubL10nExt28';
import { HUB_L10N_EXT_29 } from './hubL10nExt29';
import { HUB_L10N_EXT_30 } from './hubL10nExt30';
import { HUB_L10N_EXT_31 } from './hubL10nExt31';
import { HUB_L10N_EXT_32 } from './hubL10nExt32';
import { HUB_L10N_EXT_33 } from './hubL10nExt33';
import { HUB_L10N_EXT_34 } from './hubL10nExt34';
import { HUB_L10N_EXT_35 } from './hubL10nExt35';
import { HUB_L10N_EXT_36 } from './hubL10nExt36';
import { HUB_L10N_EXT_37 } from './hubL10nExt37';
import { HUB_L10N_EXT_38 } from './hubL10nExt38';
import { HUB_L10N_EXT_39 } from './hubL10nExt39';
import { HUB_L10N_EXT_40 } from './hubL10nExt40';
import { HUB_L10N_EXT_41 } from './hubL10nExt41';
import { HUB_L10N_EXT_42 } from './hubL10nExt42';

// =========================================
// HUB L10N — EXTENSION AGGREGATOR & MERGE
// Extension files add languages on top of the 10-language base
// in hubL10n.ts / hubL10n2.ts / hubL10n3.ts. Entries are keyed
// exactly like the base (portal ids or "portal:card" composite keys)
// and carry only the languages they extend, so the base fallback
// chain (exact -> en -> ar) keeps working for anything missing.
// =========================================

export type HubL10nField = 'title' | 'subtitle' | 'badge' | 'description' | 'metric' | 'timestamp' | 'actionHint';
export type HubL10nExtEntry = Partial<Record<HubL10nField, Partial<Record<SupportedLanguage, string>>>>;
export type HubL10nExt = Record<string, HubL10nExtEntry>;

/** All extension language packs, in merge order. */
export const HUB_L10N_EXTS: HubL10nExt[] = [HUB_L10N_EXT_1, HUB_L10N_EXT_2, HUB_L10N_EXT_3, HUB_L10N_EXT_4, HUB_L10N_EXT_5, HUB_L10N_EXT_6, HUB_L10N_EXT_7, HUB_L10N_EXT_8, HUB_L10N_EXT_9, HUB_L10N_EXT_10, HUB_L10N_EXT_11, HUB_L10N_EXT_12, HUB_L10N_EXT_13, HUB_L10N_EXT_14, HUB_L10N_EXT_15, HUB_L10N_EXT_16, HUB_L10N_EXT_17, HUB_L10N_EXT_18, HUB_L10N_EXT_19, HUB_L10N_EXT_20, HUB_L10N_EXT_21, HUB_L10N_EXT_22, HUB_L10N_EXT_23, HUB_L10N_EXT_24, HUB_L10N_EXT_25, HUB_L10N_EXT_26, HUB_L10N_EXT_27, HUB_L10N_EXT_28, HUB_L10N_EXT_29, HUB_L10N_EXT_30, HUB_L10N_EXT_31, HUB_L10N_EXT_32, HUB_L10N_EXT_33, HUB_L10N_EXT_34, HUB_L10N_EXT_35, HUB_L10N_EXT_36, HUB_L10N_EXT_37, HUB_L10N_EXT_38, HUB_L10N_EXT_39, HUB_L10N_EXT_40, HUB_L10N_EXT_41, HUB_L10N_EXT_42];

/**
 * Merge one or more base hub dictionaries with the extension packs.
 * Base entries are copied first; extensions are merged field-by-field and
 * language-by-language so each language pack only adds what it translates.
 */
export function mergeHubL10n(
  bases: Record<string, any>[],
  exts: HubL10nExt[] = HUB_L10N_EXTS,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const base of bases) {
    for (const key of Object.keys(base)) {
      out[key] = { ...(base[key] as Record<string, unknown>) };
    }
  }
  for (const ext of exts) {
    for (const [key, fields] of Object.entries(ext)) {
      const current = (out[key] = (out[key] as Record<string, unknown>) ?? {});
      for (const [field, pack] of Object.entries(fields)) {
        current[field] = { ...((current[field] as Record<string, string>) ?? {}), ...pack };
      }
    }
  }
  return out;
}
