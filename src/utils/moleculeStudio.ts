import type { PyramidNote } from '../types/perfume';
import type { RawMaterialItem } from '../data/rawMaterials';
import { parseLocalizedNumber } from '../لغات/numerals';

export type FragrancePhase = 'top' | 'heart' | 'base';
export type MaterialMatchStatus = 'matched' | 'ambiguous' | 'unmatched';

export interface IngredientAnalysisRow {
  id: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  phase?: FragrancePhase;
  percentage?: number;
  percentageIssue?: 'outside-range';
  matchStatus: MaterialMatchStatus;
  material?: RawMaterialItem;
  candidates?: RawMaterialItem[];
}

export interface IngredientAnalysisParseResult {
  rows: IngredientAnalysisRow[];
  issues: string[];
}

/**
 * Compare names conservatively: only exact database names/aliases or an exact CAS
 * value count as a match. A note accord is not silently treated as a molecule.
 */
function normalizedName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function normalizedCas(value: string): string {
  return value.replace(/[\s‐‑‒–—−]/g, '').toLowerCase();
}

function aliasesFor(item: RawMaterialItem): string[] {
  const englishWithoutParentheses = item.nameEn.split('(')[0]?.trim();
  const arabicWithoutEnglishParentheses = item.nameAr.split('(')[0]?.trim();
  return [item.nameAr, item.nameEn, englishWithoutParentheses, arabicWithoutEnglishParentheses]
    .filter((value): value is string => Boolean(value))
    .map(normalizedName)
    .filter(Boolean);
}

export function matchRawMaterialName(
  query: string,
  database: readonly RawMaterialItem[],
): { status: MaterialMatchStatus; material?: RawMaterialItem; candidates?: RawMaterialItem[] } {
  const name = normalizedName(query);
  const cas = normalizedCas(query);
  if (!name) return { status: 'unmatched' };

  const matches = database.filter((item) => {
    const casNumbers = item.casNumber.split(/[;,/]+/).map(normalizedCas).filter(Boolean);
    return aliasesFor(item).includes(name) || (casNumbers.length > 0 && casNumbers.includes(cas));
  });

  if (matches.length === 1) return { status: 'matched', material: matches[0] };
  if (matches.length > 1) return { status: 'ambiguous', candidates: matches };
  return { status: 'unmatched' };
}

function parsePhase(value: string): FragrancePhase | undefined {
  const normalized = normalizedName(value);
  if (/^(top|head|opening|top notes|upper|قمة|عليا|افتتاحية|مقدمة)$/.test(normalized)) return 'top';
  if (/^(heart|middle|mid|heart notes|قلب|وسط|وسطى)$/.test(normalized)) return 'heart';
  if (/^(base|drydown|bottom|base notes|قاعدة|قاعدية|أساسية)$/.test(normalized)) return 'base';
  return undefined;
}

function parsePercentage(value: string): number | undefined {
  const cleaned = value.trim().replace(/[%٪]/g, '').trim();
  if (!cleaned) return undefined;
  const parsed = parseLocalizedNumber(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Parse a pasted ingredient list. Accepted examples:
 *   Hedione | heart | 12%
 *   Ambroxan; base; 8
 *   Bergamot ١٠٪
 *
 * Missing percentages and phases remain missing; the parser never invents them.
 */
export function parsePerfumeIngredientList(
  text: string,
  database: readonly RawMaterialItem[],
): IngredientAnalysisParseResult {
  const rows: IngredientAnalysisRow[] = [];
  const issues: string[] = [];

  text.split(/\r?\n/).forEach((originalLine, index) => {
    const lineNumber = index + 1;
    const trimmed = originalLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    let fields: string[];
    let percentage: number | undefined;

    // Parse a marked percentage before splitting on commas so a localized
    // decimal such as “12,5%” remains one number.
    const markedPercentage = trimmed.match(/[-+]?[0-9٠-٩۰-۹]+(?:[.,٫][0-9٠-٩۰-۹]+)?\s*[%٪]/u);
    if (markedPercentage) {
      percentage = parsePercentage(markedPercentage[0]);
      const withoutPercent = trimmed.replace(markedPercentage[0], '').trim();
      fields = withoutPercent.split(/[|;\t,]/).map((part) => part.trim()).filter(Boolean);
    } else {
      fields = trimmed.split(/[|;\t,]/).map((part) => part.trim()).filter(Boolean);
      if (fields.length > 1) {
        const lastFieldValue = parsePercentage(fields[fields.length - 1]);
        if (lastFieldValue !== undefined) {
          percentage = lastFieldValue;
          fields.pop();
        }
      }
    }

    let phase: FragrancePhase | undefined;
    const phaseIndex = fields.findIndex((field) => parsePhase(field) !== undefined);
    if (phaseIndex >= 0) {
      phase = parsePhase(fields[phaseIndex]);
      fields.splice(phaseIndex, 1);
    }

    const name = fields.join(' ').replace(/^[\s:–—-]+|[\s:–—-]+$/g, '').trim();
    if (!name) {
      issues.push(`Line ${lineNumber}: ingredient name is missing.`);
      return;
    }

    const match = matchRawMaterialName(name, database);
    const row: IngredientAnalysisRow = {
      id: `line-${lineNumber}`,
      name,
      phase,
      percentage,
      matchStatus: match.status,
      ...(match.material ? { material: match.material } : {}),
      ...(match.candidates ? { candidates: match.candidates } : {}),
    };
    if (percentage !== undefined && (percentage < 0 || percentage > 100)) {
      row.percentageIssue = 'outside-range';
      issues.push(`Line ${lineNumber}: percentage must be between 0 and 100.`);
    }
    rows.push(row);
  });

  return { rows, issues };
}

export function analyzePyramidNotes(
  notes: readonly PyramidNote[],
  database: readonly RawMaterialItem[],
): IngredientAnalysisRow[] {
  return notes.map((note, index) => {
    const name = note.nameEn || note.nameAr;
    const match = matchRawMaterialName(name, database);
    return {
      id: note.id || `draft-${index + 1}`,
      name,
      nameAr: note.nameAr,
      nameEn: note.nameEn,
      phase: note.category,
      percentage: note.percentageOfOil,
      matchStatus: match.status,
      ...(match.material ? { material: match.material } : {}),
      ...(match.candidates ? { candidates: match.candidates } : {}),
    };
  });
}

export function calculateIngredientMassGrams(percentage: number | undefined, totalConcentrateGrams: number): number | undefined {
  if (percentage === undefined || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) return undefined;
  if (!Number.isFinite(totalConcentrateGrams) || totalConcentrateGrams < 0) return undefined;
  return (percentage / 100) * totalConcentrateGrams;
}
