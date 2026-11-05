/** Browser speech helpers for Shaheen's optional voice-conversation mode. */
import type { SupportedLanguage } from '../types/i18n';
import { LOCALE_MAP } from '../لغات/localize';
import { removeMediaBlocks } from './mediaBlock';
import { removeFormulaBlocks } from './aiFormulaExtractor';
import { removeToolBlocks } from './shaheenTools';
import { plainMath } from './shaheenText';

/** Use the site's locale map, with Egyptian Arabic as the Arabic default. */
export function shaheenSpeechLocale(language: SupportedLanguage): string {
  return LOCALE_MAP[language] || (language === 'ar' ? 'ar-EG' : language);
}

/** Remove machine-oriented Markdown before speaking; keep readable labels and prose. */
export function prepareShaheenSpeech(text: string): string {
  const displayText = plainMath(removeToolBlocks(removeFormulaBlocks(removeMediaBlocks(text))));
  return displayText
    .replace(/^[ \t]*```[^\n]*\n[\s\S]*?(?:^[ \t]*```[ \t]*$|$)/gm, ' ')
    .replace(/^[ \t]*~~~[^\n]*\n[\s\S]*?(?:^[ \t]*~~~[ \t]*$|$)/gm, ' ')
    .replace(/^[ \t]*(```|~~~)[\w-]*[ \t]*\n(?:[ \t]*\n)*[ \t]*\1[ \t]*$/gm, ' ')
    .replace(/\n[ \t]*(```|~~~)[\w-]*[ \t]*$/, '')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\u2045([^\u2046]*)\u2046/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/gm, ' ')
    .replace(/^\s*\|([^\n]+)\|\s*$/gm, (_line, cells: string) => cells.replace(/\s*\|\s*/g, '، '))
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/[\\*_~`>#|]+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split long replies into sentence/word-safe chunks so browser speech engines do not truncate them. */
export function splitShaheenSpeech(text: string, maxChars = 220): string[] {
  const clean = prepareShaheenSpeech(text);
  if (!clean) return [];
  const limit = Math.max(20, Math.floor(maxChars));
  const sentences = clean.split(/(?<=[.!?؟؛。])\s+/u).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  const flush = () => {
    if (current) chunks.push(current);
    current = '';
  };
  const appendWord = (word: string) => {
    if (!word) return;
    if (word.length > limit) {
      flush();
      for (let offset = 0; offset < word.length; offset += limit) chunks.push(word.slice(offset, offset + limit));
      return;
    }
    if (!current) current = word;
    else if (current.length + 1 + word.length <= limit) current += ` ${word}`;
    else { flush(); current = word; }
  };
  for (const sentence of sentences) {
    if (sentence.length <= limit) {
      if (!current) current = sentence;
      else if (current.length + 1 + sentence.length <= limit) current += ` ${sentence}`;
      else { flush(); current = sentence; }
      continue;
    }
    flush();
    for (const word of sentence.split(/\s+/)) appendWord(word);
    flush();
  }
  flush();
  return chunks;
}
