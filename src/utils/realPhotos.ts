/** Retrieval intent, not image generation. Pure and shared by chat/server/browser. */
import type { ConversationTurn } from './conversationContext';
import { loc } from '../لغات/localize';
import type { SupportedLanguage } from '../types/i18n';

export const REAL_PHOTO_INSTRUCTION = `طلب صورة حقيقية أو فوتوغرافية أو أرشيفية يعني البحث عن صورة منشورة، لا توليد رسمة واقعية. يمكن عرض صور شخصيات عامة مثل حسني مبارك؛ لا تدّعِ أن كونك مساعداً يمنع عرضها. استخدم sham-media مع images باسم الشخص/الموضوع وimageKind بقيمة photograph. في مساحة العمل أيضاً استخدم sham-media للبحث، ولا تستخدم sham-image أو sham-video كبديل لصورة حقيقية. لا تختلق روابط أو مصدر الصورة أو تدّعي توثيق هويتها/تاريخها بصرياً. إن لم تتوفر نتيجة مناسبة أظهر تعذر العثور عليها بدلاً من توليد بديل. احتفظ بالمصدر والترخيص واسم المصور، ولا تضع توقيع sharing ai على صورة أرشيفية كأنها من توليد الموقع.`;
const fold = (value: string) => value.normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').toLowerCase();
export function wantsRealPhoto(text: string): boolean {
  const t = fold(text);
  if (/(?:^|\s)(?:ولد|ارسم|صمم|تخيل|generate|draw|design|imagine)(?=\s|$)/i.test(t) && !/(?:مش|ليست|not)\s+(?:رسمة|رسمه|مولدة|مولده|generated)/i.test(t)) return false;
  return /(?:صور[ةه]?|صورا|صوره|صور)\s+(?:فوتوغرافي[ةه]?|حقيقي[ةه]?|ارشيفي[ةه]?|اصلية|اصليه)|(?:حقيقي[ةه]?|ارشيفي[ةه]?)\s+(?:صور[ةه]?)|\b(?:real|actual|archival|original)\s+(?:photos?|photographs?|pictures?|images?)\b|\bphotographs?\b/i.test(t);
}
function subjectOf(text: string): string | undefined {
  const normalized = fold(text);
  // A known spelling alias is normalization, not a guessed identity. Other subjects stay as supplied.
  const subject = normalized
    .replace(/^(?:لا[،,]?\s*|انا\s*)?(?:(?:عاي[زظ]ه?|عاوز|محتاج|هات(?:لي)?|وريني|ابحث عن|اريد|please|i want|show me|find me|find|give me|a|an)\s+)+/i, '')
    .replace(/(?:صور[ةه]?|صورا)\s+(?:فوتوغرافي[ةه]?|حقيقي[ةه]?|ارشيفي[ةه]?|اصلي[ةه]?)|\b(?:real|actual|archival|original)\s+(?:photos?|photographs?|pictures?|images?)\b|\bphotographs?\b/gi, ' ')
    .replace(/^\s*لل/u, 'ال')
    .replace(/^\s*(?:ل(?=[\p{L}])|عن\s+|of\s+|for\s+)/u, '')
    .replace(/(?:مش|ليست|not)\s+(?:رسم[ةه]|مولد[ةه]|generated|a drawing).*$/i, '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!subject || /^(?:له|لها|ليه|ليها|ده|دي|لهذا|لهذه|him|her|it|this|that|please)$/i.test(subject)) return undefined;
  if (/^(?:(?:الرئيس|الاسبق|محمد)\s+)*(?:حسني مبارك|hosni mubarak)$/.test(subject)) return 'Hosni Mubarak';
  return subject.length >= 2 && subject.length <= 80 ? subject : undefined;
}
export function realPhotoRequest(message: string, history: ConversationTurn[] = []): { query?: string } | undefined {
  if (!wantsRealPhoto(message)) return undefined;
  const query = subjectOf(message);
  if (query) return { query };
  for (const turn of history.slice(-8).reverse()) {
    if (turn.role !== 'user') continue;
    // Resolve a correction only against an earlier explicit photo request, not an arbitrary old topic.
    if (!/(?:صور|صورة|صوره|photo|picture|image)/i.test(turn.text)) break;
    const previous = subjectOf(turn.text.replace(/(?:صورة|صوره|صور)\s+(?!حقيقي|حقيقيه|حقيقية|ارشيف|فوتوغراف)/g, 'صورة حقيقية '));
    if (previous) return { query: previous };
    break;
  }
  return {};
}
export function realPhotoReply(message: string, history: ConversationTurn[], lang: SupportedLanguage): string | undefined {
  const request = realPhotoRequest(message, history);
  if (!request) return undefined;
  if (!request.query) return loc(lang, { ar: 'تقصد صورة فوتوغرافية حقيقية لمين أو لإيه؟', en: 'Who or what should the real photograph show?', fr: 'Qui ou quoi doit montrer la vraie photographie ?', es: '¿A quién o qué debe mostrar la fotografía real?', it: 'Chi o cosa deve mostrare la fotografia reale?', de: 'Wen oder was soll das echte Foto zeigen?', ru: 'Кого или что должна показывать настоящая фотография?', zh: '真实照片应展示谁或什么？', tr: 'Gerçek fotoğraf kimi veya neyi göstermeli?', fa: 'عکس واقعی باید چه کسی یا چه چیزی را نشان دهد؟' });
  const note = loc(lang, { ar: 'هنا بحث عن صور منشورة بمصدرها وترخيصها، مش توليد رسمة. لو مفيش نتيجة مناسبة هتظهر رسالة؛ مصدر الصورة لا يعني أن هويتها أو تاريخها اتراجعوا بشكل مستقل.', en: 'This searches published images with source and license, rather than generating artwork. If no suitable result is available, a notice will appear. Attribution is not independent verification of identity or date.', fr: 'Recherche d’images publiées avec source et licence, sans génération. Un avis apparaît si aucun résultat ne convient. La source ne vérifie pas indépendamment l’identité ou la date.', es: 'Busca imágenes publicadas con fuente y licencia, sin generarlas. Si no hay resultados adecuados, se mostrará un aviso. La atribución no verifica de forma independiente la identidad o la fecha.', it: 'Cerca immagini pubblicate con fonte e licenza, senza generarle. Un avviso segnala risultati mancanti. La fonte non verifica in modo indipendente identità o data.', de: 'Sucht veröffentlichte Bilder mit Quelle und Lizenz, ohne Bilderzeugung. Bei fehlenden Treffern erscheint ein Hinweis. Quellenangaben sind keine unabhängige Prüfung von Identität oder Datum.', ru: 'Поиск опубликованных изображений с источником и лицензией, без генерации. При отсутствии результатов появится уведомление. Источник не является независимой проверкой личности или даты.', zh: '搜索带来源和许可的已发布图片，不生成绘图。没有合适结果时会显示提示。来源标注不代表独立核实身份或日期。', tr: 'Görsel üretmek yerine kaynak ve lisansıyla yayımlanmış görselleri arar. Uygun sonuç yoksa bildirim gösterilir. Kaynak, kimlik veya tarihin bağımsız doğrulaması değildir.', fa: 'تصاویر منتشرشده را با منبع و مجوز جست‌وجو می‌کند، نه تولید تصویر. اگر نتیجه مناسبی نباشد پیام نمایش داده می‌شود. ذکر منبع به معنای تأیید مستقل هویت یا تاریخ نیست.' });
  return '```sham-media\n' + JSON.stringify({ images: [request.query], imageKind: 'photograph' }) + '\n```\n' + note;
}
