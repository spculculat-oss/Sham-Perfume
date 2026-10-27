export interface ChatSource { title: string; url: string }

const SOURCE_TERM = '(?:المصادر|مصادر|المصدر|مصدر|المراجع|مراجع|المرجع|مرجع|الروابط|روابط|الرابط|رابط|اللينكات|لينكات|لينك|sources?|references?|citations?|links?)(?:ك|كم|ي|نا)?';
const SOURCE_FOLLOW_UP = new RegExp(
  `^(?:(?:ممكن|لو\\s+سمحت|من\\s+فضلك|هات(?:لي)?|ابعت(?:لي)?|ابعث(?:لي)?|ارسل(?:ي)?|أرسل(?:ي)?|وريني|اعرض|اذكر|فين|اين|أين|ايه|إيه|ما|please|can\\s+you|show(?:\\s+me)?|give\\s+me|where\\s+(?:is|are)|what\\s+(?:is|are)(?:\\s+your)?|what(?:'s|\\s+is)\\s+your)\\s+)*(?:تجيب|تبعت|تبعث|ترسل|تذكر|توريني|تقولي|تديني|تكتب|تحط|provide|send|cite|list)?\\s*(?:لي\\s+|لنا\\s+|your\\s+|the\\s+)?${SOURCE_TERM}(?:\\s+(?:من\\s+فضلك|لو\\s+سمحت|please))?[؟?!.،,؛:]*$`, 'iu',
);
const SOURCE_ACTION = /(?:هات(?:لي)?|ابعت(?:لي)?|ابعث(?:لي)?|ارسل(?:ي)?|أرسل(?:ي)?|وريني|اعرض|اذكر|تجيب|تبعت|تبعث|ترسل|تذكر|توريني|تقولي|تديني|تكتب|تحط|show(?:\s+me)?|give\s+me|list|provide|send|cite|link|share)\s*(?:لي\s+|لنا\s+|me\s+|the\s+)?(?:المصادر|مصادر|المصدر|مصدر|المراجع|مراجع|المرجع|مرجع|الروابط|روابط|الرابط|رابط|اللينكات|لينكات|لينك|sources?|references?|citations?|links?)/iu;
const SOURCE_QUESTION = /^(?:(?:ممكن\s+)?(?:اعرف|أعرف)\s+|(?:(?:ما|ايه|إيه)\s+(?:(?:هي|هو)\s+)?)?)?(?:المصادر|مصادر|المصدر|مصدر|المراجع|مراجع|المرجع|مرجع|المصادر(?:ك|كم|نا)?|مصادر(?:ك|كم|نا)?|المصدر(?:ك|كم|نا)?|مصدر(?:ك|كم|نا)?)(?:\s+(?:للرد|للإجابة|للاجابة|الجواب|اللي\s+استخدمتها|that\s+answer))?[؟?!.]*$/iu;
const SOURCE_USAGE = /^(?:what|which)\s+(?:(?:are|were)\s+)?(?:the\s+)?(?:sources?|references?|citations?)\s+(?:did\s+you\s+use|were\s+used|support(?:s|ed)?\s+that)(?:\s+answer)?[?!.]*$/iu;
const WHERE_FROM = /^(?:منين\s+جبت|من\s+اين\s+جبت|أين\s+وجدت|فين\s+لقيت|where\s+did\s+you\s+get|where\s+did\s+that\s+come\s+from|how\s+do\s+you\s+know)(?:\s+(?:المعلومة|الكلام|ده|ذلك|this|that|it))?[؟?!.]*$/iu;

export function isSourcesFollowUp(text: string): boolean {
  const trimmed = text.trim().replaceAll(String.fromCharCode(0x200f), '').replaceAll(String.fromCharCode(0x200e), '');
  return SOURCE_FOLLOW_UP.test(trimmed) || WHERE_FROM.test(trimmed) || SOURCE_QUESTION.test(trimmed) || SOURCE_USAGE.test(trimmed);
}

/** An explicit request for citations, not a topic question such as «what are sources of energy?». */
export function asksForSources(text: string): boolean {
  return isSourcesFollowUp(text) || SOURCE_ACTION.test(text.trim());
}

/** Keep only safe, public HTTPS links before source metadata crosses a client/server boundary. */
export function safeChatSources(value: unknown, max = 5): ChatSource[] | undefined {
  if (!Array.isArray(value) || value.length > max) return undefined;
  const out: ChatSource[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') return undefined;
    const source = item as { title?: unknown; url?: unknown };
    if (typeof source.title !== 'string' || typeof source.url !== 'string' || source.title.length > 160 || source.url.length > 2000) return undefined;
    let parsed: URL;
    try { parsed = new URL(source.url); } catch { return undefined; }
    const host = parsed.hostname.toLowerCase();
    const octets = host.split('.');
    const ipLiteral = octets.length === 4 && octets.every((part) => part !== '' && Number.isInteger(Number(part)) && Number(part) >= 0 && Number(part) <= 255);
    const privateHost = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.includes(':') || ipLiteral;
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || privateHost) return undefined;
    const url = parsed.href;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title: source.title.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim() || host, url });
  }
  return out;
}

function markdownLink(source: ChatSource): string {
  const title = source.title.replace(/[\\`*_{}\[\]()<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || new URL(source.url).hostname;
  const url = source.url.replace(/[\s()[\]<>\\`]/g, (character) => encodeURIComponent(character));
  return `[${title}](${url})`;
}

export function requestedSourcesReply(sources: readonly ChatSource[], language: string): string {
  const safe = safeChatSources(sources);
  const ar = language === 'ar' || language === 'fa';
  if (!safe?.length) return ar
    ? 'مش لاقي روابط أقدر أنسبها للرد اللي فات، ومش هخترع مصدر. ابعتيلي السؤال تاني لو تحبي أراجعه.'
    : "I don't have links I can reliably attach to the previous answer, and I won't invent a source. Send the question again if you'd like me to check it.";
  const links = safe.map((source) => `- ${markdownLink(source)}`).join('\n');
  const intro = ar ? 'أكيد، دي الروابط اللي رجعتلها:' : 'Sure — these are the links I checked:';
  const caveat = ar ? 'الروابط دي مش اعتماداً من متخصص.' : 'These links are not expert approval.';
  const license = safe.some((source) => new URL(source.url).hostname.endsWith('wikipedia.org'))
    ? (ar ? ' محتوى ويكيبيديا مرخص برخصة CC BY-SA.' : ' Wikipedia content is licensed under CC BY-SA.') : '';
  const gap = String.fromCharCode(10).repeat(2);
  return `${intro}${gap}${gap}${links}${gap}${gap}_${caveat}${license}_`;
}

function isStoreProductLink(value: string): boolean {
  try { return /\/p\/[a-z0-9-]+\.html$/i.test(new URL(value).pathname); } catch { return false; }
}

/** Strip citation-style links from a visible reply when the visitor did not ask for them. */
export function hideUnrequestedSources(answer: string): string {
  const stripText = (text: string) => text
    .replace(/^\s*(?:#{1,6}\s*)?(?:sources?|references?|citations?|المصادر|المصدر|المراجع|المرجع)\s*(?:[:：].*)?$/gim, '')
    .replace(/\[[^\]\n]{1,300}\]\(\s*(https?:\/\/[^)\s]+)\s*\)/gi, (link, url: string) => isStoreProductLink(url) ? link : '')
    .replace(/<https?:\/\/[^>\s]+>/gi, '')
    .replace(/https?:\/\/[^\s<>()\]]+/gi, (url) => isStoreProductLink(url) ? url : '')
    .replace(/\s+\[\d+(?:\s*[,،]\s*\d+)*\]/g, '')
    .replace(/^[ \t]*[-*+][ \t]*$/gm, '')
    .replace(/[ \t]+([,.;:!?،؛؟])/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
  return answer.split(/(```[\s\S]*?```)/g).map((part, index) => index % 2 ? part : stripText(part)).join('').trim();
}

export function appendRequestedSources(answer: string, sources: readonly ChatSource[], language: string): string {
  const safe = safeChatSources(sources);
  const ar = language === 'ar' || language === 'fa';
  if (!safe?.length) return `${answer}\n\n_${ar ? 'ما لقيتش روابط مناسبة أقدر أستند لها، ومش هخترع مراجع.' : "I couldn't find suitable links to support this, and won't invent references."}_`;
  const links = safe.slice(0, 5).map(markdownLink).join(' · ');
  const license = safe.some((source) => new URL(source.url).hostname.endsWith('wikipedia.org'))
    ? (ar ? ' محتوى ويكيبيديا مرخص برخصة CC BY-SA.' : ' Wikipedia content is licensed under CC BY-SA.') : '';
  const gap = String.fromCharCode(10).repeat(2);
  return `${answer}${gap}${ar ? 'المصادر:' : 'Sources:'} ${links}${gap}_${ar ? 'الروابط دي مش اعتماداً من متخصص.' : 'These links are not expert approval.'}${license}_`;
}
