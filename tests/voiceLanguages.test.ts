/**
 * «شاهين بيتكلم بكل لغات الموقع ولهجاتها على حسب بلد الزائر» — every site language and Arabic dialect, drilled.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../src/types/i18n';
import { deviceLacksVoice, nearLocale, pickShaheenVoice, speaksLanguage, speechLocaleFor } from '../src/utils/shaheenVoice';
import { voiceOptions } from '../src/utils/voiceChoice';
import { everydayWords, numberInWords, spokenReply, wantsMore } from '../src/utils/spokenReply';
import { arabicBrandNames, MORE_WORLD, sayPrice, speakWorldNumbers, worldTerms } from '../src/utils/spokenWorld';
import { regionalLocale, regionInstruction } from '../src/utils/languageRegion';
import { DIALECTS } from '../src/utils/arabicDialect';
import { systemInstruction, validateChatRequest } from '../server/shaheen';
import { drillDialect, drillLanguage, languageScore, YES_SAMPLES } from '../scripts/language-drill';

test('every site language has a valid speech locale and asks «go on?» in its own words', () => {
  assert.equal(SUPPORTED_LANGUAGES.length, 100);
  for (const { code } of SUPPORTED_LANGUAGES) {
    const locale = speechLocaleFor(code);
    assert.equal(Intl.getCanonicalLocales(locale).length, 1, `${code} → ${locale}`);
    if (code === 'ar') continue;
    const more = MORE_WORLD[code as Exclude<SupportedLanguage, 'ar'>];
    assert.ok(more && more.length > 1, `${code} has «go on?»`);
    if (code !== 'en') assert.notEqual(more, MORE_WORLD.en, `${code} is not asked in English`);
    const long = spokenReply('This is a sentence about perfume. '.repeat(30), { language: code, words: 20 });
    assert.ok(long.say.endsWith(more), `${code}: ${long.say.slice(-40)}`);
  }
});

test('the visitor’s country picks his own accent of the language; another country keeps the language’s home accent', () => {
  const expect: [SupportedLanguage, string, string][] = [
    ['fr', 'CA', 'fr-CA'], ['fr', 'BE', 'fr-BE'], ['fr', 'FR', 'fr-FR'], ['fr', 'EG', 'fr-FR'], ['es', 'MX', 'es-MX'], ['es', 'AR', 'es-AR'],
    ['es', 'ES', 'es-ES'], ['pt', 'BR', 'pt-BR'], ['pt', 'PT', 'pt-PT'], ['en', 'US', 'en-US'], ['en', 'AU', 'en-AU'], ['en', 'EG', 'en-GB'],
    ['de', 'AT', 'de-AT'], ['de', 'CH', 'de-CH'], ['zh', 'TW', 'zh-TW'], ['zh', 'CN', 'zh-CN'], ['tl', 'PH', 'fil-PH'], ['no', 'NO', 'nb-NO'],
    ['ar', 'EG', 'ar-EG'], ['ar', 'SA', 'ar-SA'], ['ar', 'AE', 'ar-AE'], ['ar', 'MA', 'ar-MA'], ['ar', 'TN', 'ar-TN'], ['ar', 'IQ', 'ar-IQ'],
    ['ar', 'LB', 'ar-LB'], ['ar', 'SD', 'ar-EG'], ['ar', 'FR', 'ar-EG'],
  ];
  for (const [language, country, locale] of expect) assert.equal(speechLocaleFor(language, country), locale, `${language} in ${country}`);
  // His own dialect pick wins over the country (a Saudi visitor who chose Egyptian).
  assert.equal(speechLocaleFor('ar', 'SA', 'egyptian'), 'ar-EG');
  assert.equal(speechLocaleFor('ar', 'EG', 'levantine'), 'ar-JO');
  assert.equal(regionalLocale('ar', 'EG'), undefined);
});

test('the voice picker: aliases, the nearest accent, Cantonese only as a last resort, and «no voice» is honest', () => {
  const voices = [
    { name: 'Google español', lang: 'es-ES' }, { name: 'Google español de Estados Unidos', lang: 'es-US' }, { name: 'Filipino', lang: 'fil-PH' },
    { name: 'Hebrew old', lang: 'iw-IL' }, { name: 'Norsk', lang: 'nb-NO' }, { name: 'Mandarin', lang: 'zh-CN' }, { name: 'Cantonese', lang: 'zh-HK' },
    { name: 'Arabic Saudi', lang: 'ar-SA' }, { name: 'Arabic Algeria', lang: 'ar-DZ' }, { name: 'English', lang: 'en-US' },
  ];
  assert.equal(pickShaheenVoice(voices, 'es-MX', 'es')?.name, 'Google español de Estados Unidos', 'Mexico → the Latin American voice');
  assert.equal(pickShaheenVoice(voices, 'fil-PH', 'tl')?.name, 'Filipino');
  assert.equal(pickShaheenVoice(voices, 'he-IL', 'he')?.name, 'Hebrew old');
  assert.equal(pickShaheenVoice(voices, 'nb-NO', 'no')?.name, 'Norsk');
  assert.equal(pickShaheenVoice(voices, 'zh-TW', 'zh')?.name, 'Mandarin', 'Taiwan speaks Mandarin: not the Cantonese voice');
  assert.equal(pickShaheenVoice(voices, 'zh-SG', 'zh')?.name, 'Mandarin', 'Singapore: Mandarin over Cantonese');
  assert.equal(pickShaheenVoice(voices, 'ar-MA', 'ar')?.name, 'Arabic Algeria', 'Morocco → the Maghrebi voice, not the Saudi one');
  assert.equal(voiceOptions(voices, 'fil-PH', 'tl').length, 1);
  assert.ok(nearLocale('ar-MA', 'ar-TN') && !nearLocale('ar-MA', 'ar-SA'));
  assert.ok(speaksLanguage('fil_PH', 'tl') && speaksLanguage('ar-EG', 'ar') && !speaksLanguage('fr-FR', 'co') && !speaksLanguage('en-US', 'ar'));
  assert.equal(deviceLacksVoice(voices, 'hi'), true, 'Hindi with only these voices: written, not mumbled');
  assert.equal(deviceLacksVoice(voices, 'es'), false);
  assert.equal(deviceLacksVoice([], 'hi'), false, 'an empty list is «not loaded yet»');
});

test('prices, units, percentages and ranges are said in the visitor’s language', () => {
  const say = (language: SupportedLanguage, locale: string, text: string) => speakWorldNumbers(text, language, locale).replace(/[\u00A0\u202F]/g, ' ');
  assert.equal(say('en', 'en-US', 'It costs 1,250.50 EGP for 50 ml (20% oil), lasts 6-8 hours.'), 'It costs 1,250.50 Egyptian pounds for 50 milliliters (20 percent oil), lasts 6 to 8 hours.');
  assert.equal(say('fr', 'fr-FR', 'Il coûte 1,250.50 EGP pour 50 ml, 20%, 6-8 heures.'), 'Il coûte 1 250,50 livres égyptiennes pour 50 millilitres, 20 pour cent, 6 à 8 heures.');
  assert.equal(say('de', 'de-DE', '€21 für 100 ml'), '21 Euro für 100 Milliliter');
  assert.equal(say('es', 'es-MX', 'Cuesta $25'), 'Cuesta 25 dólares estadounidenses');
  assert.equal(say('tr', 'tr-TR', '$25'), '25 ABD doları', 'the broken Turkish pattern is rebuilt');
  assert.equal(say('fr', 'fr-FR', 'environ 3.4 onces'), 'environ 3,4 onces', 'an English decimal point read the French way');
  assert.equal(say('en', 'en-US', 'about 3.4 ounces and 1,250 people'), 'about 3.4 ounces and 1,250 people', 'English stays English');
  assert.equal(say('de', 'de-DE', 'Termin am 14.10.2026, Telefon 0100-1234567'), 'Termin am 14.10.2026, Telefon 0100-1234567', 'dates and phone numbers untouched');
  assert.equal(say('en', 'en-US', 'TOP 10 picks'), 'TOP 10 picks', 'a code that is a word is not a currency');
  assert.equal(say('en', 'en-US', 'Kuwait: 12.500 KWD'), 'Kuwait: 12.500 Kuwaiti dinars', 'three-decimal currencies keep their decimals');
  assert.equal(sayPrice(90, 'SAR', 'ar-SA') !== undefined, true);
  // Every language with currency names in the platform says «EGP» as a name (the few without keep it, honestly).
  const named = SUPPORTED_LANGUAGES.filter(({ code }) => code !== 'ar' && !/EGP/.test(say(code, speechLocaleFor(code), '1,250 EGP')));
  assert.ok(named.length >= 90, `${named.length} languages say the currency's name`);
});

test('perfume words and brand names: EDP in each language, Latin brands in Arabic letters with the dialect’s «g»', () => {
  assert.equal(worldTerms('Sauvage EDP', 'fr'), 'Sauvage Eau de Parfum');
  assert.equal(worldTerms('Sauvage EDP', 'ru'), 'Sauvage о де парфюм');
  assert.equal(worldTerms('EDT', 'zh'), '淡香水');
  assert.equal(worldTerms('EDP by Hermès', 'en'), 'Eau de Parfum by Air-mez');
  assert.equal(worldTerms('EDP by Hermès', 'fr'), 'Eau de Parfum by Hermès', 'a French voice says Hermès right');
  assert.equal(arabicBrandNames('عطر Gucci Bloom من Dior', 'egyptian'), 'عطر جوتشي Bloom من ديور');
  assert.equal(arabicBrandNames('عطر Gucci Bloom من Dior', 'gulf'), 'عطر غوتشي Bloom من ديور');
  assert.equal(arabicBrandNames('Yves Saint Laurent و Bvlgari', 'levantine'), 'إيف سان لوران و بولغاري');
  assert.equal(arabicBrandNames('Oud Royal', 'egyptian'), 'Oud Royal', 'everyday words inside a product name stay as written');
  assert.match(spokenReply('عطر Tom Ford Oud Wood سعره 4500 جنيه.', { language: 'ar', dialect: 'egyptian', words: Infinity }).say, /^عطر توم فورد Oud Wood سعره أربع تلاف وخمسمية جنيه/);
});

test('each Arabic dialect says numbers and everyday words its own way', () => {
  assert.equal(numberInWords(11, 'egyptian'), 'حداشر');
  assert.equal(numberInWords(12, 'levantine'), 'تنعش');
  assert.equal(numberInWords(2, 'maghrebi'), 'زوج');
  assert.equal(numberInWords(12, 'maghrebi'), 'طناش');
  assert.equal(numberInWords(11, 'iraqi'), 'دعش');
  assert.equal(numberInWords(300, 'iraqi'), 'ثلثمية');
  assert.equal(numberInWords(11, 'sudanese'), 'حداشر');
  assert.equal(numberInWords(11, 'msa'), 'أحد عشر');
  assert.match(spokenReply('النسبة 20%.', { language: 'ar', dialect: 'maghrebi', words: Infinity }).say, /عشرين فالمية/);
  assert.equal(everydayWords('لا يوجد غيره هناك', 'iraqi'), 'ماكو غيره أكو');
  assert.equal(everydayWords('يوجد عطر جيد', 'maghrebi'), 'كاين عطر مزيان');
  assert.equal(everydayWords('أريد هذا', 'sudanese'), 'داير ده');
  assert.equal(everydayWords('لا يوجد غيره', 'yemeni'), 'مابش غيره');
  assert.equal(everydayWords('بهذا السعر', 'levantine'), 'بهاد السعر');
  assert.equal(everydayWords('بهذا السعر', 'egyptian'), 'بالسعر ده');
  assert.equal(everydayWords('ويمكنك أن تجربه', 'levantine'), 'وفيك تجربه');
  assert.equal(everydayWords('لا بنعم', 'levantine'), 'لا بنعم', '«ب» is not split off ordinary words');
  // «سوف يثبت»: the future joins the verb the dialect's way (talkStyle + everydayWords together).
  const future = (dialect: (typeof DIALECTS)[number]) => spokenReply('سوف يثبت.', { language: 'ar', dialect, words: Infinity }).say;
  assert.equal(future('egyptian'), 'هيثبت.');
  assert.equal(future('levantine'), 'رح يثبت.');
  assert.equal(future('maghrebi'), 'غادي يثبت.');
});

test('«yes / go on» is understood in the site’s languages, and «no» is not', () => {
  for (const [language, said] of Object.entries(YES_SAMPLES)) assert.equal(wantsMore(said!), true, `${language}: ${said}`);
  for (const said of ['non merci', 'nein danke', 'não', 'いいえ', 'нет', 'hayır', 'لا شكراً', 'no thanks', 'nie', 'όχι']) assert.equal(wantsMore(said), false, said);
});

test('the server answers in the visitor’s own variant of his language, and Arabic stays with its dialects', () => {
  assert.equal(validateChatRequest({ message: 'salut', language: 'fr' }, 'CA').region, 'CA');
  assert.equal(validateChatRequest({ message: 'hola', language: 'es' }, 'mx').region, 'MX');
  assert.equal(validateChatRequest({ message: 'bonjour', language: 'fr' }, 'EG').region, undefined, 'an Egyptian who picked French: plain French');
  assert.equal(validateChatRequest({ message: 'مرحبا', language: 'ar' }, 'SA').region, undefined);
  assert.equal(validateChatRequest({ message: 'مرحبا', language: 'ar' }, 'SA').dialect, 'gulf');
  const fr = systemInstruction('fr', '', undefined, { region: 'CA' });
  assert.match(fr, /بفرنسية كندا/);
  assert.match(regionInstruction('pt', 'BR'), /البرازيلية/);
  assert.match(regionInstruction('zh', 'TW'), /التقليدية/);
  assert.equal(regionInstruction('fr', 'EG'), '');
  assert.doesNotMatch(systemInstruction('fr'), /وبالكلمات وطريقة الكلام المعتادة/);
  // A voice conversation in another language: the talk rules in that language, not Arabic examples.
  const voice = systemInstruction('de', '', undefined, { voice: {} });
  assert.match(voice, /بلغته هو مش بالعربي/);
  assert.doesNotMatch(voice, /عنبر الليل/);
});

test('the language drill: every language and dialect, with an honest score', () => {
  const rows = SUPPORTED_LANGUAGES.map(({ code }) => drillLanguage(code));
  for (const row of rows) {
    assert.ok(row.locale, `${row.language} locale`);
    assert.ok(row.more, `${row.language} «go on?»`);
    if (row.yes !== null) assert.ok(row.yes, `${row.language} «yes»`);
  }
  const { checks, passed } = languageScore(rows);
  assert.ok(passed / checks >= 0.94, `${passed}/${checks}`);
  for (const dialect of DIALECTS) for (const [check, ok] of Object.entries(drillDialect(dialect).checks)) assert.ok(ok, `${dialect} ${check}`);
});

test('a reply already said is not changed when the rest is said later (idempotent)', () => {
  for (const [language, locale] of [['fr', 'fr-CA'], ['de', 'de-DE'], ['en', 'en-US'], ['ru', 'ru-RU'], ['tr', 'tr-TR']] as const) {
    const once = spokenReply('It costs 1,250.50 EGP for 50 ml, 20% oil, 6-8 hours.', { language, words: Infinity, locale }).say;
    assert.equal(spokenReply(once, { language, words: Infinity, locale }).say, once, language);
  }
});
