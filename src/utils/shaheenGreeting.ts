import type { SupportedLanguage } from '../types/i18n';
import { loc, type LText } from './localize';

/**
 * A message that is only a greeting («هاي», «السلام عليكم», «ازيك يا شاهين», "hi") is answered right in
 * the browser: instantly, the same on every site, and without spending AI quota. Seen live: the AI
 * answered «هاي» and «السلام عليكم» with the same unrelated tip about DPG and maceration.
 */
const strip = (text: string) => text.normalize('NFKC').toLowerCase()
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, ' ')
  .replace(/[!?.,،؛;:؟…~\-_*"'()]+/g, ' ')
  .replace(/\s+/g, ' ').trim();

const SALAM = /^(?:ال)?سلام(?: عليكم| عليكو| عليك)?(?: و ?رحمه الله)?(?: و ?بركاته)?$/;
const GREETING_WORDS = [
  'هاي', 'هاى', 'هلا', 'هلو', 'هالو', 'هلا والله', 'يا هلا', 'مرحبا', 'مرحبتين', 'مرحب', 'اهلا', 'اهلين', 'اهلا وسهلا', 'اهلا بيك', 'اهلا بك',
  'صباح الخير', 'صباح النور', 'مساء الخير', 'مساء النور', 'سلام', 'السلام عليكم', 'ازيك', 'ازيكم', 'عامل ايه', 'عاملين ايه', 'كيفك', 'كيف حالك',
  'شلونك', 'اخبارك', 'اخبارك ايه', 'ايه الاخبار', 'هاي يا شاهين',
  'hi', 'hii', 'hello', 'helo', 'hey', 'heya', 'yo', 'good morning', 'good evening', 'good afternoon', 'how are you', 'whats up', 'sup',
  'bonjour', 'salut', 'bonsoir', 'hola', 'buenos dias', 'buenas', 'hallo', 'guten tag', 'ciao', 'buongiorno', 'merhaba', 'selam', 'salam',
  'privet', 'привет', 'здравствуйте', '你好', 'نمستے', 'namaste', 'درود', 'سلام علیکم',
];
const ADDRESS = new RegExp('(?:^| )(?:يا )?(?:شاهين|الخبير شاهين|خبير|استاذ|يا باشا|باشا|يا معلم|معلم|يا غالي|حبيبي|صديقي|shahin|shaheen|master shahin|there|everyone)(?= |$)', 'g');

/** 'salam' for «السلام عليكم» (answered «وعليكم السلام»), 'hello' for other greetings, undefined for real questions. */
export function greetingKind(text: string): 'salam' | 'hello' | undefined {
  const t = strip(text);
  if (!t || t.length > 60) return undefined;
  const core = t.replace(ADDRESS, ' ').replace(/\s+/g, ' ').trim();
  // A greeting followed by a real question («السلام عليكم، عايز تركيبة…») goes to the AI as usual.
  const parts = core.split(/ (?=(?:و ?)?(?:ازيك|عامل|كيف|اخبار|صباح|مساء|how|good))/).map((p) => p.replace(/^و ?/, '').trim()).filter(Boolean);
  if (!parts.length) return undefined;
  const isGreeting = (p: string) => SALAM.test(p) || GREETING_WORDS.includes(p) || /^(?:ه+ا+ي+|ه+ل+ا+|hi+|hey+|hello+)$/.test(p);
  if (!parts.every(isGreeting)) return undefined;
  return parts.some((p) => SALAM.test(p) || /سلام/.test(p)) ? 'salam' : 'hello';
}

const REPLY: Record<'salam' | 'hello', LText> = {
  salam: {
    ar: 'وعليكم السلام ورحمة الله وبركاته 🌹\nأنا **الخبير شاهين**، خبير العطور في شام. اسألني عن تصميم تركيبة، نِسب التركيز، تخفيف الكحول، التعتيق أو حساب التكلفة، وأنا أحسبها لك خطوة بخطوة.',
    en: 'Wa alaykum as-salam 🌹\nI am **Master Shahin**, Sham’s perfumery expert. Ask me to design a formula, work out concentrations, dilute alcohol, plan maceration or cost a batch, and I will walk you through it step by step.',
    fr: 'Wa alaykum as-salam 🌹\nJe suis **Maître Shahin**, l’expert parfumeur de Sham. Demandez-moi une formule, un calcul de concentration, une dilution d’alcool, une macération ou un coût de revient.',
    es: 'Wa alaykum as-salam 🌹\nSoy el **Maestro Shahin**, el experto perfumista de Sham. Pídeme una fórmula, concentraciones, dilución de alcohol, maceración o costes, y te guío paso a paso.',
    de: 'Wa alaykum as-salam 🌹\nIch bin **Meister Shahin**, Shams Parfümexperte. Frag mich nach einer Formel, Konzentrationen, Alkoholverdünnung, Reifung oder Kosten – Schritt für Schritt.',
    tr: 'Ve aleyküm selam 🌹\nBen **Usta Şahin**, Sham’ın parfüm uzmanı. Formül tasarımı, konsantrasyon, alkol seyreltme, dinlendirme veya maliyet sorabilirsin; adım adım hesaplarım.',
    fa: 'و علیکم السلام 🌹\nمن **استاد شاهین**، کارشناس عطر شام هستم. درباره طراحی فرمول، غلظت، رقیق‌سازی الکل، تعتیق یا هزینه بپرسید تا قدم‌به‌قدم حساب کنم.',
  },
  hello: {
    ar: 'أهلاً وسهلاً بك 🌹\nأنا **الخبير شاهين**، خبير العطور في شام. تقدر تسألني مثلاً:\n- صمّم لي عطر شرقي بالعود والورد 50 مل\n- عايز أخفف كحول 96% إلى 70%\n- كام يوم أعتّق عطر العود؟',
    en: 'Hello and welcome 🌹\nI am **Master Shahin**, Sham’s perfumery expert. You can ask me, for example:\n- Design an oriental oud & rose perfume, 50 ml\n- Dilute 96% alcohol down to 70%\n- How long should an oud perfume macerate?',
    fr: 'Bonjour et bienvenue 🌹\nJe suis **Maître Shahin**, l’expert parfumeur de Sham. Par exemple :\n- Crée-moi un parfum oriental oud & rose, 50 ml\n- Diluer de l’alcool 96 % à 70 %\n- Combien de temps faire macérer un parfum à l’oud ?',
    es: 'Hola y bienvenido 🌹\nSoy el **Maestro Shahin**, el experto perfumista de Sham. Puedes preguntarme, por ejemplo:\n- Diseña un perfume oriental de oud y rosa, 50 ml\n- Diluir alcohol del 96 % al 70 %\n- ¿Cuánto tiempo macerar un perfume de oud?',
    de: 'Hallo und willkommen 🌹\nIch bin **Meister Shahin**, Shams Parfümexperte. Frag mich zum Beispiel:\n- Entwirf ein orientalisches Oud-Rosen-Parfüm, 50 ml\n- 96 % Alkohol auf 70 % verdünnen\n- Wie lange sollte ein Oud-Parfüm reifen?',
    tr: 'Merhaba, hoş geldin 🌹\nBen **Usta Şahin**, Sham’ın parfüm uzmanı. Örneğin şunları sorabilirsin:\n- 50 ml oryantal ud ve gül parfümü tasarla\n- %96 alkolü %70’e seyrelt\n- Ud parfümü kaç gün dinlendirilmeli?',
    fa: 'سلام، خوش آمدید 🌹\nمن **استاد شاهین**، کارشناس عطر شام هستم. مثلاً بپرسید:\n- یک عطر شرقی عود و گل رز ۵۰ میل طراحی کن\n- رقیق کردن الکل ۹۶٪ به ۷۰٪\n- عطر عود چند روز باید تعتیق شود؟',
  },
};

/** The reply for a greeting in the visitor's language (other languages fall back like the rest of the site). */
export const greetingReply = (kind: 'salam' | 'hello', language: SupportedLanguage) => loc(language, REPLY[kind]);
