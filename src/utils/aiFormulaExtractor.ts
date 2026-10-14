import type { ConcentrationType, PyramidNote } from '../types/perfume';

export interface ExtractedAIPerfume {
  title: string;
  author: string;
  concentrationPercent: number;
  concentrationType: ConcentrationType;
  bottleVolumeMl: number;
  alcoholPercentage: number;
  waterPercent: number;
  fixativePercent: number;
  macerationDays: number;
  summary: string;
  pyramidNotes: PyramidNote[];
}
const concentrationTypes: ConcentrationType[] = ['extrait', 'edp', 'edt', 'edc', 'eau_fraiche', 'aftershave', 'mist', 'oil_pure', 'custom'];
const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 2000;

/** Never turn general advice, a safety percentage or a greeting into an invented recipe. */
export function extractFormulaFromAIMessage(text: string): ExtractedAIPerfume | null {
  if (typeof text !== 'string') return null;
  const blocks = [...text.matchAll(/```sham-formula\s*\n([\s\S]*?)```/g)];
  if (blocks.length !== 1) return null;
  try {
    const formula = JSON.parse(blocks[0][1]);
    if (!formula || typeof formula !== 'object' || Array.isArray(formula) ||
      !nonEmpty(formula.title) || !nonEmpty(formula.author) || !nonEmpty(formula.summary) ||
      !concentrationTypes.includes(formula.concentrationType) ||
      !inRange(formula.concentrationPercent, 0.01, 100) || !inRange(formula.bottleVolumeMl, 1, 10000) ||
      !inRange(formula.alcoholPercentage, 0, 100) || !inRange(formula.waterPercent, 0, 100) ||
      !inRange(formula.fixativePercent, 0, 100) || !inRange(formula.macerationDays, 0, 365) ||
      formula.concentrationPercent + formula.waterPercent + formula.fixativePercent > 100 ||
      !Array.isArray(formula.pyramidNotes) || !formula.pyramidNotes.length || formula.pyramidNotes.length > 50) return null;
    const notes: PyramidNote[] = [];
    for (const [index, note] of formula.pyramidNotes.entries()) {
      if (!note || !nonEmpty(note.nameAr) || !nonEmpty(note.nameEn) ||
        !['top', 'heart', 'base'].includes(note.category) || !inRange(note.percentageOfOil, 0.01, 100)) return null;
      notes.push({ id: `shaheen-note-${index}`, nameAr: note.nameAr.trim(), nameEn: note.nameEn.trim(),
        category: note.category, percentageOfOil: note.percentageOfOil });
    }
    if (Math.abs(notes.reduce((sum, note) => sum + note.percentageOfOil, 0) - 100) > 0.01) return null;
    return { title: formula.title.trim(), author: formula.author.trim(), summary: formula.summary.trim(),
      concentrationType: formula.concentrationType, concentrationPercent: formula.concentrationPercent,
      bottleVolumeMl: formula.bottleVolumeMl, alcoholPercentage: formula.alcoholPercentage,
      waterPercent: formula.waterPercent, fixativePercent: formula.fixativePercent,
      macerationDays: formula.macerationDays, pyramidNotes: notes };
  } catch { return null; }
}

/** Only an explicit transfer command may apply an older recipe instead of asking the AI. */
export function isFormulaTransferCommand(text: string): boolean {
  const command = text.trim().replace(/[.!؟]+$/, '').replace(/\s+/g, ' ');
  return /^(?:من فضلك )?(?:طبق|انقل|حوّل|حول)(?: (?:هذه|التركيبة|الوصفة|التوليفة|السابقة|الأخيرة))* (?:(?:على|في|إلى|الى) (?:ال)?حاسبة(?: التركيز)?|للحاسبة)$/.test(command) ||
    /^(?:please )?(?:apply|transfer|send) (?:(?:this|the|last|previous) )?(?:formula|recipe|blend) to (?:the )?calculator$/i.test(command);
}
