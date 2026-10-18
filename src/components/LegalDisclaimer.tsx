import React from 'react';
import { AlertTriangle, FlaskConical, Scale, Bot } from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { LText, makeT } from '../لغات/localize';

/**
 * إخلاءات قانونية جاهزة — تُلصق فوق الحاسبات وردود AI
 * تستوفي: EU Cosmetics 1223/2009، REACH/CLP، IFRA، AI Act Art.50، FTC
 */

const S = {
  chem_title: {
    ar: 'تنبيه سلامة كيميائية — إخلاء مسؤولية',
    en: 'Chemical Safety Notice — Disclaimer',
    fr: 'Avis de sécurité chimique',
    es: 'Aviso de seguridad química',
    de: 'Chemischer Sicherheitshinweis',
  },
  chem_body: {
    ar: 'هذه الحاسبات تعليمية فقط، ليست نصيحة طبية أو كيميائية. التزم بمعايير IFRA (ifrafragrance.org) وREACH/CLP. بعض المكونات قد تسبب حساسية (Citral, Limonene, Linalool...). اختبر على مساحة صغيرة من الجلد، استخدم قفازات ونظارات، احفظ بعيدًا عن الأطفال والحرارة، لا تتناول. المنصة غير مسؤولة عن إساءة الاستخدام.',
    en: 'These calculators are educational only, not medical/chemical advice. Follow IFRA (ifrafragrance.org) & REACH/CLP. Some ingredients may cause allergies (Citral, Limonene, Linalool...). Patch-test, use gloves/goggles, keep away from children/heat, do not ingest. Platform not liable for misuse.',
    fr: 'Ces calculateurs sont éducatifs uniquement, pas un avis médical/chimique. Suivez IFRA & REACH/CLP. Certains ingrédients peuvent provoquer des allergies. Test cutané, gants/lunettes, hors de portée des enfants.',
    es: 'Estas calculadoras son solo educativas, no consejo médico/químico. Siga IFRA y REACH/CLP. Algunos ingredientes pueden causar alergias. Prueba cutánea, guantes/gafas, fuera del alcance de niños.',
    de: 'Diese Rechner sind nur zu Bildungszwecken, keine medizinische/chemische Beratung. Befolgen Sie IFRA & REACH/CLP. Manche Stoffe können Allergien auslösen. Patch-Test, Handschuhe/Brille, von Kindern fernhalten.',
  },
  ai_title: {
    ar: 'رد مولد بالذكاء الاصطناعي',
    en: 'AI-Generated Response',
    fr: 'Réponse générée par IA',
    es: 'Respuesta generada por IA',
    de: 'KI-generierte Antwort',
  },
  ai_body: {
    ar: 'هذا الرد مولد بالذكاء الاصطناعي، قد يحتوي أخطاء. ليس بديلاً عن استشارة خبير عطور مرخص أو صيدلي أو طبيب جلدية. راجع دائمًا معايير IFRA قبل التصنيع.',
    en: 'This response is AI-generated and may contain errors. Not a substitute for a licensed perfumer, pharmacist, or dermatologist. Always check IFRA standards before manufacturing.',
    fr: 'Cette réponse est générée par IA et peut contenir des erreurs. Ne remplace pas un parfumeur/pharmacien/dermatologue agréé.',
    es: 'Esta respuesta es generada por IA y puede contener errores. No sustituye a un perfumista/farmacéutico/dermatólogo autorizado.',
    de: 'Diese Antwort ist KI-generiert und kann Fehler enthalten. Kein Ersatz für einen zugelassenen Parfümeur/Apotheker/Dermatologen.',
  },
  dg_title: {
    ar: 'تحذير مواد خطرة — UN1266',
    en: 'Dangerous Goods Warning — UN1266',
    fr: 'Avertissement marchandises dangereuses — UN1266',
    es: 'Advertencia mercancías peligrosas — UN1266',
    de: 'Gefahrgutwarnung — UN1266',
  },
  dg_body: {
    ar: 'العطور سائل قابل للاشتعال (UN1266, Class 3). شحن جوي محدود (IATA DGR): 60L للشحن الجوي، 5L للركاب. العميل مسؤول عن الامتثال الجمركي في بلده. بعض الدول تحظر استيراد عطور كحولية.',
    en: 'Perfumes are flammable liquid (UN1266, Class 3). Air shipment limited (IATA DGR): 60L Cargo, 5L Passenger. Customer responsible for customs compliance. Some countries ban alcohol perfumes.',
    fr: 'Les parfums sont liquides inflammables (UN1266, Classe 3). Expédition aérienne limitée (IATA DGR). Le client est responsable de la conformité douanière.',
    es: 'Los perfumes son líquido inflamable (UN1266, Clase 3). Envío aéreo limitado (IATA DGR). El cliente es responsable del cumplimiento aduanero.',
    de: 'Parfüms sind entzündbare Flüssigkeiten (UN1266, Klasse 3). Luftversand begrenzt (IATA DGR). Kunde verantwortlich für Zollkonformität.',
  },
  learn_more: {
    ar: 'اعرف المزيد',
    en: 'Learn more',
    fr: 'En savoir plus',
    es: 'Más info',
    de: 'Mehr erfahren',
  },
};

type Variant = 'chemical' | 'ai' | 'dangerous';

interface Props {
  variant: Variant;
  currentLang?: SupportedLanguage;
  onLearnMore?: () => void;
  compact?: boolean;
}

export const LegalDisclaimer: React.FC<Props> = ({ variant, currentLang = 'ar', onLearnMore, compact = false }) => {
  const rtl = isRTL(currentLang);
  const T = makeT(currentLang, S);

  const config = {
    chemical: {
      icon: <FlaskConical className="w-4 h-4 text-amber-700" />,
      titleKey: 'chem_title' as const,
      bodyKey: 'chem_body' as const,
      bg: 'bg-amber-50 border-amber-200',
      titleColor: 'text-amber-900',
    },
    ai: {
      icon: <Bot className="w-4 h-4 text-blue-700" />,
      titleKey: 'ai_title' as const,
      bodyKey: 'ai_body' as const,
      bg: 'bg-blue-50 border-blue-200',
      titleColor: 'text-blue-900',
    },
    dangerous: {
      icon: <AlertTriangle className="w-4 h-4 text-red-700" />,
      titleKey: 'dg_title' as const,
      bodyKey: 'dg_body' as const,
      bg: 'bg-red-50 border-red-200',
      titleColor: 'text-red-900',
    },
  }[variant];

  if (compact) {
    return (
      <div className={`flex items-start gap-2 p-2.5 rounded-xl border ${config.bg} text-[11px] leading-relaxed`} dir={rtl ? 'rtl' : 'ltr'}>
        <span className="shrink-0 mt-0.5">{config.icon}</span>
        <span className={`font-semibold ${config.titleColor}`}>{T(config.titleKey)}</span>
        <span className="text-stone-600">— {T(config.bodyKey)}</span>
        {onLearnMore && (
          <button onClick={onLearnMore} className="text-amber-700 underline shrink-0">
            {T('learn_more')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`p-3 sm:p-4 rounded-2xl border ${config.bg} flex gap-3`} dir={rtl ? 'rtl' : 'ltr'}>
      <div className="shrink-0 w-8 h-8 rounded-xl bg-white border border-stone-200 flex items-center justify-center">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <h4 className={`font-bold text-xs ${config.titleColor} flex items-center gap-1.5`}>
          {T(config.titleKey)}
        </h4>
        <p className="text-[11px] sm:text-xs text-stone-600 leading-relaxed mt-1">{T(config.bodyKey)}</p>
        {onLearnMore && (
          <button onClick={onLearnMore} className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-800 underline">
            {T('learn_more')} →
          </button>
        )}
      </div>
    </div>
  );
};

export default LegalDisclaimer;
