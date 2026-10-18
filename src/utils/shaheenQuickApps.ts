import type { SupportedLanguage } from '../types/i18n';

/**
 * «تطبيقات شاهين السريعة» — small, exact apps for the simple tasks visitors ask most, answered in the
 * visitor's browser in milliseconds: no network, no queue, no AI quota. The same module runs on the
 * server too (other clients, old browsers), so the answer is identical everywhere.
 *
 *   alcohol        «اخفف كحول 96 ل 70 لتر»            → exact amounts + the alcohol calculator button
 *   concentration  «كام مل زيت في 50 مل تركيز 20%»   → oil / alcohol amounts + the concentration calculator
 *   units          «كام مل في 3.4 أونصة» / «100 ml to oz»
 *   thanks, identity                                  → short replies without spending a model call
 *
 * Deliberately conservative: an app answers only when the request is clear and complete; anything else
 * (designing a perfume, comparing, a missing number) goes to Shaheen's AI engines as before. The answers
 * are calculations, not imitations of the AI, and say so («⚡ حاسبة شاهين الفورية»).
 */
export type QuickAppId = 'alcohol' | 'concentration' | 'units' | 'thanks' | 'identity';
export interface QuickAnswer { app: QuickAppId; reply: string }

type Lang = 'ar' | 'en';
const OZ_ML = 29.5735;

/** Arabic-Indic / Persian digits and separators → ASCII, so «٩٦٪» reads as 96%. */
export function asciiDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.').replace(/٪/g, '%').replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2');
}

const round = (n: number, digits = 1) => { const f = 10 ** digits; return Math.round(n * f) / f; };
const fmt = (n: number, lang: Lang, digits = 1) => new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { maximumFractionDigits: digits }).format(n);
const badge = (lang: Lang) => (lang === 'ar' ? '⚡ حاسبة شاهين الفورية' : '⚡ Shaheen instant calculator');
const toolBlock = (tool: Record<string, unknown>) => `\n\n\`\`\`sham-tool\n${JSON.stringify({ tools: [tool] })}\n\`\`\``;

/** Volumes in the text, in ml («50 مل», «1 لتر», «2 liters», «100ml»). */
function volumesMl(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(مل|ملي|مللي|ميللي|ml|milliliters?|millilitres?|لتر|ليتر|l(?:iters?|itres?)?)(?![a-z])/gi;
  for (const m of text.matchAll(re)) {
    const value = Number(m[1]);
    out.push(/^(لتر|ليتر|l)/i.test(m[2]) ? value * 1000 : value);
  }
  if (!out.length && /(?:^|[\s،,])(لتر|ليتر|liter|litre)(?:$|[\s؟?.،,])/i.test(text)) out.push(1000); // «لتر» alone = 1 L
  return out.filter((v) => v > 0 && v <= 100_000);
}

/** Percentages in the text («96%», «96 درجة», «تركيز 20»). */
function percents(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(%|درجه|درجة|percent|per cent)/gi)) out.push(Number(m[1]));
  return out.filter((v) => v > 0 && v <= 100);
}

const withoutStrengths = (text: string) => text.replace(/(\d+(?:\.\d+)?)\s*(%|درجه|درجة|percent|per cent)/gi, ' ');

const ASKS_DESIGN = /صمم|تصميم|تركيبة|تركيبه|وصفة|وصفه|خلطة|خلطه|اقترح|رشح|قارن|مقارنة|ليه|لماذا|design|formula|recipe|compare|suggest|recommend|why/i;

function alcoholApp(text: string, lang: Lang): QuickAnswer | undefined {
  if (!/كحول|الكحول|ايثانول|إيثانول|alcohol|ethanol/i.test(text)) return undefined;
  if (!/خفف|اخفف|أخفف|تخفيف|اخف|أحول|احول|تحويل|اوصل|أوصل|اعمل|أعمل|dilut|reduce|bring|make|convert/i.test(text)) return undefined;
  let [from, to] = percents(text);
  if (from === undefined || to === undefined) {
    // «من 96 ل 70» / «96 to 70» without the % sign.
    const m = text.match(/(\d{2}(?:\.\d+)?)\s*(?:%|درجة)?\s*(?:ل|لـ|الى|إلى|الي|to|→|-)\s*(\d{1,2}(?:\.\d+)?)/i);
    if (m) { from = Number(m[1]); to = Number(m[2]); }
  }
  if (!(from > 0 && to > 0) || from > 100 || to >= from) return undefined;
  // The strengths are not volumes: «96 ل 70 لتر» is 1 litre at 70%, not 70 litres.
  const rest = withoutStrengths(text).replace(/(\d{2}(?:\.\d+)?)\s*(?:ل|لـ|الى|إلى|الي|to|→|-)\s*(\d{1,2}(?:\.\d+)?)(?!\s*(?:مل|ml))/i, ' ');
  const volume = volumesMl(rest)[0] ?? 1000;
  const strong = round((volume * to) / from);
  const water = round(volume - strong);
  const tool = toolBlock({ tool: 'alcohol', alcoholFrom: from, alcoholTo: to, finalVolumeMl: volume });
  if (lang === 'ar') {
    return { app: 'alcohol', reply: `### تخفيف الكحول من ${fmt(from, lang)}% إلى ${fmt(to, lang)}%\n\nلعمل **${fmt(volume, lang)} مل** كحول ${fmt(to, lang)}%:\n\n| المكوّن | الكمية |\n|---|---|\n| كحول ${fmt(from, lang)}% | **${fmt(strong, lang)} مل** |\n| ماء مقطّر (تقريباً) | **${fmt(water, lang)} مل** |\n\nالحساب: ${fmt(volume, lang)} × ${fmt(to, lang)} ÷ ${fmt(from, lang)} ≈ ${fmt(strong, lang)} مل.\n\n**طريقة الخلط الأدق:** ضع ${fmt(strong, lang)} مل من كحول ${fmt(from, lang)}% في دورق مدرّج ثم كمّل بالماء المقطّر حتى علامة ${fmt(volume, lang)} مل (لأن خليط الكحول والماء ينكمش قليلاً). قِس الدرجة بمقياس الكحول إن توفر.\n\n${badge(lang)}${tool}` };
  }
  return { app: 'alcohol', reply: `### Diluting alcohol from ${fmt(from, lang)}% to ${fmt(to, lang)}%\n\nFor **${fmt(volume, lang)} ml** of ${fmt(to, lang)}% alcohol:\n\n| Ingredient | Amount |\n|---|---|\n| ${fmt(from, lang)}% alcohol | **${fmt(strong, lang)} ml** |\n| Distilled water (approx.) | **${fmt(water, lang)} ml** |\n\nCalculation: ${fmt(volume, lang)} × ${fmt(to, lang)} ÷ ${fmt(from, lang)} ≈ ${fmt(strong, lang)} ml.\n\n**Most accurate method:** pour ${fmt(strong, lang)} ml of ${fmt(from, lang)}% alcohol into a graduated cylinder, then top up with distilled water to the ${fmt(volume, lang)} ml mark (alcohol and water shrink slightly when mixed). Check with an alcoholmeter if you have one.\n\n${badge(lang)}${tool}` };
}

const TYPE_PERCENT: [RegExp, number, string][] = [
  [/extrait|parfum|برفان|بارفان|بيرفيوم|اكستريت|إكستريت/i, 25, 'parfum'],
  [/\bedp\b|eau de parfum|او دو بارفان|أو دو بارفان/i, 20, 'edp'],
  [/\bedt\b|eau de toilette|او دو تواليت|أو دو تواليت/i, 12, 'edt'],
  [/\bedc\b|eau de cologne|كولونيا/i, 5, 'edc'],
];

function concentrationApp(text: string, lang: Lang): QuickAnswer | undefined {
  if (!/زيت|زيوت|الزيت|oil|essence|concentrate|فراجرانس|fragrance/i.test(text)) return undefined;
  if (!/كام|كم|قد ايه|قدايه|كمية|كميه|احسب|أحسب|محتاج|احتاج|أحتاج|how much|how many|calculate|amount|need/i.test(text)) return undefined;
  if (/كحول.*(خفف|تخفيف|اخفف)|dilut/i.test(text)) return undefined; // that is the alcohol app
  const volume = volumesMl(withoutStrengths(text))[0];
  if (!volume || volume > 10_000) return undefined;
  const typed = TYPE_PERCENT.find(([re]) => re.test(text));
  const percent = percents(text).find((p) => p <= 40) ?? typed?.[1];
  if (!percent) return undefined;
  const oil = round((volume * percent) / 100);
  const alcohol = round(volume - oil);
  const type = typed?.[2] || (percent >= 22 ? 'parfum' : percent >= 15 ? 'edp' : percent >= 8 ? 'edt' : 'edc');
  const tool = toolBlock({ tool: 'concentration', bottleVolumeMl: volume, concentrationPercent: percent, concentrationType: type, alcoholPercentage: 96, waterPercent: 0, fixativePercent: 0 });
  if (lang === 'ar') {
    return { app: 'concentration', reply: `### زجاجة ${fmt(volume, lang)} مل بتركيز ${fmt(percent, lang)}%\n\n| المكوّن | الكمية |\n|---|---|\n| زيت عطري | **${fmt(oil, lang)} مل** |\n| كحول عطور | **${fmt(alcohol, lang)} مل** |\n\nالحساب: ${fmt(volume, lang)} × ${fmt(percent, lang)} ÷ 100 = ${fmt(oil, lang)} مل زيت، والباقي كحول.\n\nلو هتضيف مثبّت أو ماء فاطرح كميتهم من الكحول، وافتح الحاسبة تحت لتعديل النسب وحفظ الوصفة. اترك الخليط يتعتّق من أسبوعين إلى 4 أسابيع قبل الاستخدام.\n\n${badge(lang)}${tool}` };
  }
  return { app: 'concentration', reply: `### A ${fmt(volume, lang)} ml bottle at ${fmt(percent, lang)}%\n\n| Ingredient | Amount |\n|---|---|\n| Fragrance oil | **${fmt(oil, lang)} ml** |\n| Perfumer's alcohol | **${fmt(alcohol, lang)} ml** |\n\nCalculation: ${fmt(volume, lang)} × ${fmt(percent, lang)} ÷ 100 = ${fmt(oil, lang)} ml oil, the rest alcohol.\n\nIf you add a fixative or water, take their amount out of the alcohol; open the calculator below to adjust and save the recipe. Let it macerate for 2–4 weeks before use.\n\n${badge(lang)}${tool}` };
}

function unitsApp(text: string, lang: Lang): QuickAnswer | undefined {
  const oz = text.match(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?(oz|ounces?|اونصة|أونصة|اونصه|أونصه|اونص|أونص|اوقية|أوقية)/i);
  const ml = volumesMl(text)[0];
  const wantsMl = /كام مل|كم مل|بالمل|to ml|in ml|into ml|how many ml/i.test(text);
  const wantsOz = /كام اونص|كم اونص|كام أونص|كم أونص|بالاونص|بالأونص|to oz|in oz|into oz|how many oz|ounces\?/i.test(text);
  if (oz && (wantsMl || !wantsOz)) {
    const value = Number(oz[1]);
    const result = round(value * OZ_ML);
    return { app: 'units', reply: lang === 'ar'
      ? `**${fmt(value, lang)} أونصة سائلة ≈ ${fmt(result, lang)} مل** (الأونصة السائلة الأمريكية = 29.57 مل).\n\nللعلم: زجاجات العطور المكتوب عليها 3.4 oz حجمها 100 مل، و1.7 oz = 50 مل، و1 oz = 30 مل.\n\n${badge(lang)}`
      : `**${fmt(value, lang)} fl oz ≈ ${fmt(result, lang)} ml** (1 US fluid ounce = 29.57 ml).\n\nFor reference: perfume bottles labelled 3.4 oz hold 100 ml, 1.7 oz = 50 ml, and 1 oz = 30 ml.\n\n${badge(lang)}` };
  }
  if (ml && wantsOz) {
    const result = round(ml / OZ_ML, 2);
    return { app: 'units', reply: lang === 'ar'
      ? `**${fmt(ml, lang)} مل ≈ ${fmt(result, lang, 2)} أونصة سائلة** (الأونصة السائلة الأمريكية = 29.57 مل).\n\n${badge(lang)}`
      : `**${fmt(ml, lang)} ml ≈ ${fmt(result, lang, 2)} fl oz** (1 US fluid ounce = 29.57 ml).\n\n${badge(lang)}` };
  }
  return undefined;
}

const THANKS = /^(?:شكرا|شكراً|شكرًا|متشكر|متشكرة|متشكرين|تسلم|تسلمي|تسلم ايدك|تسلم إيدك|ميرسي|مرسي|الف شكر|ألف شكر|جزاك الله خير[اً]?|thanks?|thank you|thx|merci)(?:\s+(?:يا\s*)?(?:شاهين|جدا|جداً|كتير|ليك|لك|so much|a lot|shaheen))*[\s!.؟?❤️🙏🌹]*$/i;
const IDENTITY = /^(?:(?:انت|إنت|أنت|انتا)\s+(?:مين|مين؟|ايه|إيه|بتعمل ايه)|مين\s+(?:انت|إنت|أنت)|من\s+(?:انت|أنت)|عرفني بنفسك|who are you|what are you|what can you do)[\s؟?!.]*$/i;

function chatApp(text: string, lang: Lang): QuickAnswer | undefined {
  if (THANKS.test(text)) {
    return { app: 'thanks', reply: lang === 'ar' ? 'العفو، ده واجبي! 🌹 لو عندك أي سؤال تاني عن العطور أو التركيبات أو الحسابات أنا موجود.' : "You're welcome! 🌹 Ask me anything else about perfumes, formulas or calculations." };
  }
  if (IDENTITY.test(text)) {
    return { app: 'identity', reply: lang === 'ar'
      ? 'أنا **الخبير شاهين**، خبير العطور الخاص بمنصة «صمم عطرك مع شام». أقدر أساعدك في:\n\n- تصميم تركيبة عطر بنِسب واضحة ونقلها للحاسبة\n- حسابات التركيز وتخفيف الكحول والتعتيق والتكلفة\n- شرح المواد الخام والعائلات العطرية\n- ترشيح عطور جاهزة من «متجر شام»\n\nاكتب سؤالك مباشرة.'
      : "I'm **Master Shahin**, the perfume expert of «Design your perfume with Sham». I can help you:\n\n- design a perfume formula with clear ratios and send it to the calculator\n- calculate concentration, alcohol dilution, maceration and cost\n- explain raw materials and fragrance families\n- recommend ready perfumes from the Sham store\n\nJust ask." };
  }
  return undefined;
}

/**
 * The instant answer for a simple task, or undefined (→ Shaheen's AI). Arabic and English only, so a
 * visitor writing in another language always gets an answer in that language from the AI.
 */
export function quickAnswer(text: string, language: SupportedLanguage): QuickAnswer | undefined {
  const lang: Lang | undefined = language === 'ar' ? 'ar' : language === 'en' ? 'en' : undefined;
  if (!lang) return undefined;
  const clean = asciiDigits(text.trim());
  if (!clean || clean.length > 220) return undefined;
  const chat = chatApp(clean, lang);
  if (chat) return chat;
  if (ASKS_DESIGN.test(clean)) return undefined; // a real design question deserves the full expert
  return alcoholApp(clean, lang) || concentrationApp(clean, lang) || unitsApp(clean, lang);
}

/** Labels for the admin dashboard and the supervisor's report. */
export const QUICK_APPS: Record<QuickAppId, { ar: string; en: string }> = {
  alcohol: { ar: 'تخفيف الكحول', en: 'Alcohol dilution' },
  concentration: { ar: 'كميات الزيت والكحول', en: 'Oil and alcohol amounts' },
  units: { ar: 'تحويل الأونصة والمل', en: 'Ounce ↔ ml' },
  thanks: { ar: 'الرد على الشكر', en: 'Thanks' },
  identity: { ar: 'التعريف بشاهين', en: 'Who is Shaheen' },
};
