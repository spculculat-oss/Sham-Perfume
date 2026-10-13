import { ConcentrationType, PyramidNote } from '../types/perfume';

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

export function extractFormulaFromAIMessage(text: string): ExtractedAIPerfume | null {
  if (!text || typeof text !== 'string') return null;

  // Check if text looks like a perfume recipe / formula recommendation
  const hasKeywords =
    text.includes('تركيز') ||
    text.includes('EDP') ||
    text.includes('Extrait') ||
    text.includes('زيت') ||
    text.includes('كحول') ||
    text.includes('افتتاحية') ||
    text.includes('قاعدة') ||
    text.includes('نوتات') ||
    text.includes('formula') ||
    text.includes('concentration');

  if (!hasKeywords) return null;

  // Detect concentration %
  let concentration = 20;
  const concMatch = text.match(/(\d{1,2})\s*%/);
  if (concMatch) {
    const val = parseInt(concMatch[1], 10);
    if (val >= 2 && val <= 45) {
      concentration = val;
    }
  }

  // Detect concentration type
  let concType: ConcentrationType = 'edp';
  if (concentration >= 25 || /extrait|اكستري/i.test(text)) {
    concType = 'extrait';
  } else if (concentration <= 14 && /edt|تواليت/i.test(text)) {
    concType = 'edt';
  } else if (concentration <= 5 && /edc|كولونيا/i.test(text)) {
    concType = 'edc';
  }

  // Detect bottle volume
  let bottleVolume = 50;
  const volMatch = text.match(/(\d{2,3})\s*(?:مل|ml)/i);
  if (volMatch) {
    const v = parseInt(volMatch[1], 10);
    if ([10, 15, 30, 50, 100, 200].includes(v)) {
      bottleVolume = v;
    }
  }

  // Detect title
  let title = 'تركيبة الخبير شاهين المخصصة';
  const titleMatch = text.match(/(?:عطر|تركيبة|اسم العطر|توليفة)[:\s]+([^\n,.،]+)/);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }

  // Extract or synthesize default notes from text
  const pyramidNotes: PyramidNote[] = [];

  if (/برغموت|ليمون|حمضيات|فواكه|bergamot|citrus/i.test(text)) {
    pyramidNotes.push({
      id: 'ai-note-top-1',
      nameAr: 'برغموت إيطالي فوار',
      nameEn: 'Italian Bergamot',
      category: 'top',
      percentageOfOil: 20,
      description: 'افتتاحية منعشة وفواحة',
    });
  }
  if (/زعفران|هيل|فلفل|قرفة|saffron|cardamom/i.test(text)) {
    pyramidNotes.push({
      id: 'ai-note-top-2',
      nameAr: 'زعفران أحمر وتوابل منعشة',
      nameEn: 'Red Saffron & Spices',
      category: 'top',
      percentageOfOil: 15,
      description: 'حرارة تابلية راقية',
    });
  }
  if (/ورد|ياسمين|زهور|لافندر|rose|jasmine|lavender/i.test(text)) {
    pyramidNotes.push({
      id: 'ai-note-heart-1',
      nameAr: 'ورد دمشقي وياسمين فاخر',
      nameEn: 'Damask Rose & Jasmine',
      category: 'heart',
      percentageOfOil: 25,
      description: 'قلب زهري أرستقراطي ناعم',
    });
  }
  if (/أرز|صندل|خشب|cedar|sandalwood/i.test(text)) {
    pyramidNotes.push({
      id: 'ai-note-heart-2',
      nameAr: 'خشب الأرز الأطلسي',
      nameEn: 'Atlas Cedarwood',
      category: 'heart',
      percentageOfOil: 15,
      description: 'عمق خشبي كلاسيكي',
    });
  }
  if (/عود|بخور|oud|agarwood/i.test(text)) {
    pyramidNotes.push({
      id: 'ai-note-base-1',
      nameAr: 'دهن عود معتق ملكي',
      nameEn: 'Royal Aged Oud',
      category: 'base',
      percentageOfOil: 15,
      description: 'قاعدة شرقية آسرة',
    });
  }
  if (/عنبر|أمبروكسان|amber|ambroxan/i.test(text)) {
    pyramidNotes.push({
      id: 'ai-note-base-2',
      nameAr: 'عنبر حوتي وأمبروكسان نقي',
      nameEn: 'Ambergris & Ambroxan',
      category: 'base',
      percentageOfOil: 10,
      description: 'إشعاع وثبات فائق لأكثر من 24 ساعة',
    });
  }

  // If no notes matched, provide balanced default set
  if (pyramidNotes.length === 0) {
    pyramidNotes.push(
      {
        id: 'ai-n1',
        nameAr: 'برغموت ونوتات حمضية فوارة',
        nameEn: 'Sparkling Citrus Bergamot',
        category: 'top',
        percentageOfOil: 25,
      },
      {
        id: 'ai-n2',
        nameAr: 'قلب زهري وتوابل ناعمة',
        nameEn: 'Floral Heart & Soft Spices',
        category: 'heart',
        percentageOfOil: 35,
      },
      {
        id: 'ai-n3',
        nameAr: 'خشب الصندل وعنبر ومسك',
        nameEn: 'Sandalwood Amber Musk',
        category: 'base',
        percentageOfOil: 40,
      }
    );
  }

  return {
    title,
    author: 'الخبير شاهين (AI Master)',
    concentrationPercent: concentration,
    concentrationType: concType,
    bottleVolumeMl: bottleVolume,
    alcoholPercentage: 96,
    waterPercent: 0,
    fixativePercent: 1.5,
    macerationDays: 30,
    summary: text.slice(0, 160) + '...',
    pyramidNotes,
  };
}
