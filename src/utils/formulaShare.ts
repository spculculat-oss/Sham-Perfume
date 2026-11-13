import { FormulationState, PyramidNote } from '../types/perfume';
import { formatNum } from './calculations';

export interface SharedFormulaPayload {
  title: string;
  author?: string;
  batchCode?: string;
  notes?: string;
  macerationDays: number;
  formulation: FormulationState;
  pyramidNotes: PyramidNote[];
}

interface CompactFormulaJSON {
  t: string;
  a?: string;
  b?: string;
  n?: string;
  m?: number;
  f: {
    v: number;
    c: number;
    p: number;
    y: string;
    al: number;
    w?: number;
    fx?: number;
    od?: number;
    ad?: number;
    u?: string;
  };
  pn: Array<{
    id: string;
    a: string;
    e: string;
    c: 'top' | 'heart' | 'base';
    p: number;
    d?: string;
  }>;
}

export function toUrlSafeBase64(str: string): string {
  if (typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  const b64 = Buffer.from(str, 'utf-8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromUrlSafeBase64(base64: string): string {
  let normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4 !== 0) {
    normalized += '=';
  }
  if (typeof TextDecoder !== 'undefined') {
    const binary = typeof atob === 'function' ? atob(normalized) : Buffer.from(normalized, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

/**
 * Compacts and encodes a perfume formula into a URL-safe sharing token.
 */
export function encodeFormulaPayload(payload: SharedFormulaPayload): string {
  const compact: CompactFormulaJSON = {
    t: payload.title || 'تركيبة عطرية خاصة',
    a: payload.author || undefined,
    b: payload.batchCode || undefined,
    n: payload.notes || undefined,
    m: payload.macerationDays || 30,
    f: {
      v: payload.formulation.bottleVolumeMl,
      c: payload.formulation.batchCount,
      p: payload.formulation.concentrationPercent,
      y: payload.formulation.concentrationType,
      al: payload.formulation.alcoholPercentage,
      w: payload.formulation.waterPercent,
      fx: payload.formulation.fixativePercent,
      od: payload.formulation.oilDensity,
      ad: payload.formulation.alcoholDensity,
      u: payload.formulation.unitMode,
    },
    pn: (payload.pyramidNotes || []).map((note) => ({
      id: note.id,
      a: note.nameAr,
      e: note.nameEn,
      c: note.category,
      p: note.percentageOfOil,
      d: note.description,
    })),
  };

  const json = JSON.stringify(compact);
  return toUrlSafeBase64(json);
}

/**
 * Generates a full absolute URL for sharing the formula directly.
 */
export function generateFormulaShareUrl(payload: SharedFormulaPayload, baseUrl?: string): string {
  const token = encodeFormulaPayload(payload);
  const origin = baseUrl || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://sham-perfumes.app');
  return `${origin}#formula?d=${token}`;
}

/**
 * Decodes a formula payload from a URL token or query/hash string.
 */
export function decodeFormulaPayload(rawString: string): SharedFormulaPayload | null {
  try {
    let token = rawString.trim();
    if (!token) return null;

    // Check if full URL or hash/query was passed
    if (token.includes('#') || token.includes('?')) {
      const parts = token.split(/[#?&]/);
      for (const part of parts) {
        if (part.startsWith('d=') || part.startsWith('formula=')) {
          token = part.split('=')[1];
          break;
        }
      }
    }

    if (!token) return null;

    // Decode base64
    const jsonStr = fromUrlSafeBase64(token);
    const parsed = JSON.parse(jsonStr);

    // Support compact format
    if (parsed && parsed.t && parsed.f) {
      const compact = parsed as CompactFormulaJSON;
      const formulation: FormulationState = {
        bottleVolumeMl: Number(compact.f.v) || 50,
        batchCount: Number(compact.f.c) || 1,
        concentrationPercent: Number(compact.f.p) || 20,
        concentrationType: (compact.f.y as any) || 'edp',
        alcoholPercentage: Number(compact.f.al) || 96,
        waterPercent: Number(compact.f.w) || 0,
        fixativePercent: Number(compact.f.fx) || 0,
        oilDensity: Number(compact.f.od) || 0.92,
        alcoholDensity: Number(compact.f.ad) || 0.8,
        unitMode: (compact.f.u as any) || 'grams',
      };

      const pyramidNotes: PyramidNote[] = (compact.pn || []).map((item, idx) => ({
        id: item.id || `shared-note-${idx}`,
        nameAr: item.a || item.e || 'نوتة عطرية',
        nameEn: item.e || item.a || 'Fragrance Note',
        category: item.c || 'heart',
        percentageOfOil: Number(item.p) || 0,
        description: item.d,
      }));

      return {
        title: compact.t,
        author: compact.a,
        batchCode: compact.b,
        notes: compact.n,
        macerationDays: Number(compact.m) || 30,
        formulation,
        pyramidNotes,
      };
    }

    // Support direct uncompressed format if passed
    if (parsed && parsed.title && parsed.formulation) {
      return parsed as SharedFormulaPayload;
    }

    return null;
  } catch (err) {
    console.error('Failed to decode formula payload:', err);
    return null;
  }
}

/**
 * Formats a WhatsApp-ready sharing message with luxury emojis, formula summary,
 * pyramid breakdown, and direct clickable link.
 */
export function formatWhatsAppShareMessage(
  payload: SharedFormulaPayload,
  shareUrl: string,
  lang: string = 'ar'
): string {
  const isArabic = !lang || lang === 'ar' || lang === 'fa';
  const title = payload.title || (isArabic ? 'تركيبة عطرية خاصة' : 'Custom Fragrance Formula');
  const code = payload.batchCode || 'SHAM-BATCH';
  const conc = `${payload.formulation.concentrationPercent}% (${payload.formulation.concentrationType.toUpperCase()})`;
  const days = payload.macerationDays || 30;

  // Group pyramid notes
  const topNotes = payload.pyramidNotes.filter((n) => n.category === 'top').map((n) => isArabic ? n.nameAr : n.nameEn).filter(Boolean);
  const heartNotes = payload.pyramidNotes.filter((n) => n.category === 'heart').map((n) => isArabic ? n.nameAr : n.nameEn).filter(Boolean);
  const baseNotes = payload.pyramidNotes.filter((n) => n.category === 'base').map((n) => isArabic ? n.nameAr : n.nameEn).filter(Boolean);

  if (isArabic) {
    const lines = [
      `🌟 *بطاقة تركيبة عطر ومواصفات تصنيع رسمية*`,
      `━━━━━━━━━━━━━━━━━━`,
      `🏷️ *اسم العطر:* ${title}`,
      `📦 *كود التشغيلة (Batch):* ${code}`,
      payload.author ? `👤 *المبتكر:* ${payload.author}` : null,
      `🧪 *التركيز:* ${conc}`,
      `⏳ *مدة التعتيق المطلوبة:* ${days} يوماً`,
      `🧴 *حجم العبوة:* ${payload.formulation.bottleVolumeMl} مل (عدد: ${payload.formulation.batchCount})`,
      ``,
      `🌸 *الهرم العطري والمكونات:*`,
      topNotes.length > 0 ? `• *القمة (Top):* ${topNotes.join(' ، ')}` : null,
      heartNotes.length > 0 ? `• *القلب (Heart):* ${heartNotes.join(' ، ')}` : null,
      baseNotes.length > 0 ? `• *القاعدة (Base):* ${baseNotes.join(' ، ')}` : null,
      payload.notes ? `\n📝 *ملاحظات:* ${payload.notes}` : null,
      ``,
      `🔗 *افتح بطاقة المواصفات والتصنيع مباشرة عبر الرابط التالي:*`,
      shareUrl,
      `━━━━━━━━━━━━━━━━━━`,
      `✨ *مختبر وحاسبة شام للعطور (Sham Perfumes)*`,
    ].filter((line): line is string => line !== null);

    return lines.join('\n');
  }

  // English fallback
  const lines = [
    `🌟 *Official Perfume Batch Spec Sheet & Formula*`,
    `━━━━━━━━━━━━━━━━━━`,
    `🏷️ *Fragrance Title:* ${title}`,
    `📦 *Batch Code:* ${code}`,
    payload.author ? `👤 *Perfumer:* ${payload.author}` : null,
    `🧪 *Concentration:* ${conc}`,
    `⏳ *Maceration Time:* ${days} days`,
    `🧴 *Volume:* ${payload.formulation.bottleVolumeMl} ml (Count: ${payload.formulation.batchCount})`,
    ``,
    `🌸 *Fragrance Pyramid:*`,
    topNotes.length > 0 ? `• *Top:* ${topNotes.join(', ')}` : null,
    heartNotes.length > 0 ? `• *Heart:* ${heartNotes.join(', ')}` : null,
    baseNotes.length > 0 ? `• *Base:* ${baseNotes.join(', ')}` : null,
    payload.notes ? `\n📝 *Notes:* ${payload.notes}` : null,
    ``,
    `🔗 *View manufacturing spec sheet directly via this link:*`,
    shareUrl,
    `━━━━━━━━━━━━━━━━━━`,
    `✨ *Sham Perfumes Compounding Atelier*`,
  ].filter((line): line is string => line !== null);

  return lines.join('\n');
}

/**
 * Builds the direct WhatsApp Web/App intent link.
 */
export function buildWhatsAppLink(message: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}
