import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  FlaskConical,
  Layers,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  Timer,
} from 'lucide-react';
import { ApiError, ApiUnavailableError, requestApi } from '../utils/api';
import type { ExtractedAIPerfume } from '../utils/aiFormulaExtractor';
import type { ConcentrationType, PyramidNote } from '../types/perfume';
import type { LabContextSnapshot } from '../types/shaheenAgent';
import type { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { LText, fmt, makeT } from '../لغات/localize';

export type HarmonyVerdictStatus =
  | 'balanced'
  | 'needs_bridge'
  | 'top_heavy'
  | 'base_heavy'
  | 'clashing';

export interface OlfactoryHarmonyReport {
  harmonyScore: number;
  verdictStatus: HarmonyVerdictStatus;
  olfactoryProfile: string;
  executiveSummary: string;
  volatilityCurveSummary: string;
  tierAssessment: {
    top: string;
    heart: string;
    base: string;
  };
  synergies: { pair: string; effect: string }[];
  tensions: { issue: string; suggestion: string }[];
  recommendedAdditions: {
    name: string;
    category: 'top' | 'heart' | 'base';
    suggestedPct: number;
    rationale: string;
  }[];
  macerationAdvice: string;
}

interface HarmonyApiResponse {
  success: boolean;
  analyzedAt: string;
  tierTotals: { top: number; heart: number; base: number; total: number };
  noteCount: number;
  report: OlfactoryHarmonyReport;
}

interface OlfactoryHarmonyAnalyzerProps {
  currentLang: SupportedLanguage;
  labContext?: LabContextSnapshot;
  isStaticHosting: boolean;
  onAskShaheenFollowUp?: (prompt: string) => void;
  onOpenPyramidTool?: () => void;
  onApplyToPyramidCalculator?: (formula: ExtractedAIPerfume) => void;
}

const VALID_CONC_TYPES = new Set<ConcentrationType>([
  'extrait',
  'edp',
  'edt',
  'edc',
  'eau_fraiche',
  'aftershave',
  'mist',
  'oil_pure',
  'custom',
]);

const S = {
  title: {
    ar: 'محلل التناسق العطري الذكي',
    en: 'Olfactory Harmony Analyzer',
    fr: 'Analyseur d’harmonie olfactive',
    es: 'Analizador de armonía olfativa',
    it: 'Analizzatore di armonia olfattiva',
    de: 'Duft-Harmonie-Analysator',
    ru: 'Анализатор ольфакторной гармонии',
    zh: '香调和谐度智能分析仪',
    tr: 'Koku Uyumu Analizörü',
    fa: 'تحلیلگر هوشمند هارمونی عطری',
  },
  subtitle: {
    ar: 'يقرأ النوتات المضافة حالياً في المختبر ونسبها ليقيّم التوازن والالتحام الكيميائي والفجوات العطرية.',
    en: 'Reads your active lab pyramid notes and ratios to evaluate accord balance, volatility bridges, and tensions.',
    fr: 'Lit vos notes actives et leurs ratios pour évaluer l’équilibre, les ponts de volatilité et les tensions.',
    es: 'Lee las notas activas de tu laboratorio y sus porcentajes para evaluar equilibrio y puentes aromáticos.',
    it: 'Legge le note attive nel laboratorio e le loro percentuali per valutare equilibrio, ponti e tensioni.',
    de: 'Liest Ihre aktiven Labornoten und Anteile zur Bewertung von Pyramidenbalance, Brücken und Spannungen.',
    ru: 'Считывает текущие ноты в лаборатории и их доли для оценки баланса, переходов и конфликтов.',
    zh: '读取当前实验室的香调与比例，评估金字塔平衡、挥发桥接与潜在冲突。',
    tr: 'Laboratuvardaki mevcut notaları ve oranları okuyarak koku dengesini ve geçiş köprülerini değerlendirir.',
    fa: 'نت‌ها و درصدهای فعال آزمایشگاه را بررسی کرده و تعادل هرم، پیوندهای بویایی و تنش‌ها را ارزیابی می‌کند.',
  },
  analyze_btn: {
    ar: 'طلب تحليل التناسق العطري',
    en: 'Analyze Olfactory Harmony',
    fr: 'Analyser l’harmonie olfactive',
    es: 'Analizar armonía olfativa',
    it: 'Analizza armonia olfattiva',
    de: 'Duft-Harmonie analysieren',
    ru: 'Проанализировать гармонию',
    zh: '请求香调和谐分析',
    tr: 'Koku Uyumunu Analiz Et',
    fa: 'درخواست تحلیل هارمونی عطری',
  },
  refresh_btn: {
    ar: 'إعادة التحليل',
    en: 'Re-analyze Formula',
    fr: 'Réanalyser',
    es: 'Reanalizar',
    it: 'Rianalizza',
    de: 'Neu analysieren',
    ru: 'Повторить анализ',
    zh: '重新分析',
    tr: 'Yeniden Analiz Et',
    fa: 'تحلیل مجدد',
  },
  analyzing: {
    ar: 'جارٍ فحص التداخل الجزيئي والهرم العطري...',
    en: 'Evaluating molecular bridges & pyramid balance...',
    fr: 'Analyse des ponts aromatiques et de la pyramide…',
    es: 'Evaluando puentes aromáticos y pirámide…',
    it: 'Valutazione dei ponti olfattivi e della piramide…',
    de: 'Bewerte Duftbrücken und Pyramidenbalance…',
    ru: 'Оценка ароматических связок и баланса…',
    zh: '正在评估分子桥接与香调金字塔平衡……',
    tr: 'Koku köprüleri ve piramit dengesi değerlendiriliyor…',
    fa: 'در حال بررسی پیوندهای مولکولی و تعادل هرم...',
  },
  active_notes_lbl: {
    ar: 'النوتات النشطة في المعمل حالياً',
    en: 'Active Notes in Lab',
    fr: 'Notes actives au labo',
    es: 'Notas activas en laboratorio',
    it: 'Note attive in laboratorio',
    de: 'Aktive Labornoten',
    ru: 'Активные ноты в лаборатории',
    zh: '当前实验室香调',
    tr: 'Laboratuvardaki Aktif Notalar',
    fa: 'نت‌های فعال فعلی آزمایشگاه',
  },
  no_notes_title: {
    ar: 'لا توجد نوتات مضافة في الهرم العطري حالياً',
    en: 'No fragrance notes added in the lab yet',
    fr: 'Aucune note ajoutée au laboratoire',
    es: 'Aún no hay notas en el laboratorio',
    it: 'Nessuna nota aggiunta nel laboratorio',
    de: 'Noch keine Duftnoten im Labor hinzugefügt',
    ru: 'В лаборатории пока нет добавленных нот',
    zh: '实验室中尚未添加香调',
    tr: 'Laboratuvarda henüz koku notası yok',
    fa: 'هنوز نتی در هرم عطری آزمایشگاه ثبت نشده است',
  },
  no_notes_desc: {
    ar: 'أضف نوتات القمة والقلب والقاعدة في حاسبة الهرم العطري ثم عُد هنا للحصول على قراءة دقيقة لتناسق العطر.',
    en: 'Add Top, Heart, and Base notes in the Pyramid Calculator, then return here for a precision harmony evaluation.',
    fr: 'Ajoutez des notes de tête, cœur et fond dans le calculateur de pyramide pour lancer l’analyse.',
    es: 'Añade notas de salida, corazón y fondo en la pirámide para evaluar su armonía aquí.',
    it: 'Aggiungi note di testa, cuore e fondo nella piramide per ottenere una valutazione di armonia.',
    de: 'Fügen Sie Kopf-, Herz- und Basisnoten im Pyramidenrechner hinzu, um hier die Harmonie zu prüfen.',
    ru: 'Добавьте верхние, сердечные и базовые ноты в калькуляторе пирамиды для точного анализа.',
    zh: '请先在香调金字塔计算器中添加前调、中调和基调，然后在此获取精准和谐度分析。',
    tr: 'Piramit Hesaplayıcıda üst, kalp ve baz notaları ekleyin; ardından burada uyum analizi alın.',
    fa: 'نت‌های آغازین، میانی و پایه را در ماشین‌حساب هرم اضافه کنید تا تحلیل دقیق هارمونی انجام شود.',
  },
  open_pyramid: {
    ar: 'فتح حاسبة الهرم العطري',
    en: 'Open Pyramid Calculator',
    fr: 'Ouvrir la pyramide',
    es: 'Abrir pirámide',
    it: 'Apri piramide',
    de: 'Pyramide öffnen',
    ru: 'Открыть пирамиду',
    zh: '打开香调金字塔',
    tr: 'Piramit Aracını Aç',
    fa: 'باز کردن ماشین‌حساب هرم',
  },
  tier_top: { ar: 'قمة', en: 'Top', fr: 'Tête', es: 'Salida', it: 'Testa', de: 'Kopf', ru: 'Верх', zh: '前调', tr: 'Üst', fa: 'آغازین' },
  tier_heart: { ar: 'قلب', en: 'Heart', fr: 'Cœur', es: 'Corazón', it: 'Cuore', de: 'Herz', ru: 'Сердце', zh: '中调', tr: 'Kalp', fa: 'میانی' },
  tier_base: { ar: 'قاعدة', en: 'Base', fr: 'Fond', es: 'Fondo', it: 'Fondo', de: 'Basis', ru: 'База', zh: '基调', tr: 'Baz', fa: 'پایه' },
  score_lbl: { ar: 'مؤشر التناسق', en: 'Harmony Index', fr: 'Indice d’harmonie', es: 'Índice de armonía', it: 'Indice armonia', de: 'Harmonie-Index', ru: 'Индекс гармонии', zh: '和谐指数', tr: 'Uyum Endeksi', fa: 'شاخص هارمونی' },
  verdict_balanced: { ar: 'بنية متوازنة', en: 'Balanced Structure', fr: 'Structure équilibrée', es: 'Estructura equilibrada', it: 'Struttura equilibrata', de: 'Ausgewogene Struktur', ru: 'Сбалансировано', zh: '结构均衡', tr: 'Dengeli Yapı', fa: 'ساختار متعادل' },
  verdict_needs_bridge: { ar: 'يحتاج نوتة ربط', en: 'Needs Bridge Note', fr: 'Pont nécessaire', es: 'Requiere puente', it: 'Richiede ponte', de: 'Brückennote nötig', ru: 'Нужен связующий аккорд', zh: '需桥接香调', tr: 'Köprü Nota Gerekli', fa: 'نیازمند نت پیوندی' },
  verdict_top_heavy: { ar: 'قمة مرتفعة', en: 'Top-Heavy Weighting', fr: 'Tête dominante', es: 'Salida dominante', it: 'Testa dominante', de: 'Kopflastig', ru: 'Перевес верха', zh: '前调偏重', tr: 'Üst Nota Ağırlıklı', fa: 'سنگینی در نت آغازین' },
  verdict_base_heavy: { ar: 'قاعدة ثقيلة', en: 'Base-Heavy Weighting', fr: 'Fond dominant', es: 'Fondo dominante', it: 'Fondo dominante', de: 'Basislastig', ru: 'Перевес базы', zh: '基调偏重', tr: 'Baz Nota Ağırlıklı', fa: 'سنگینی در نت پایه' },
  verdict_clashing: { ar: 'تعارض عطري', en: 'Olfactory Clash Risk', fr: 'Risque de conflit', es: 'Riesgo de choque', it: 'Rischio conflitto', de: 'Duftkonflikt-Risiko', ru: 'Риск диссонанса', zh: '存在气味冲突', tr: 'Koku Çatışması Riski', fa: 'تعارض احتمالی نت‌ها' },
  stale_warn: {
    ar: 'تم تعديل نوتات المختبر بعد هذا التقرير — أعد التحليل لمزامنة النتائج.',
    en: 'Lab notes changed after this report — re-analyze to sync.',
    fr: 'Les notes ont changé — réanalysez pour actualiser.',
    es: 'Las notas cambiaron — reanaliza para actualizar.',
    it: 'Le note sono cambiate — rianalizza per aggiornare.',
    de: 'Labornoten geändert — für Aktualisierung neu analysieren.',
    ru: 'Ноты изменились — повторите анализ.',
    zh: '实验室香调已变动，请重新分析以同步。',
    tr: 'Notlar değişti — güncellemek için yeniden analiz edin.',
    fa: 'نت‌های آزمایشگاه تغییر کرده‌اند؛ برای همگام‌سازی دوباره تحلیل کنید.',
  },
  volatility_lbl: {
    ar: 'منحنى التطاير الزمني (الافتتاحية → القلب → الثبات)',
    en: 'Volatility & Evaporation Curve (Opening → Heart → Dry-down)',
    fr: 'Courbe d’évaporation (Ouverture → Cœur → Sillage)',
    es: 'Curva de volatilidad (Salida → Corazón → Secado)',
    it: 'Curva di volatilità (Apertura → Cuore → Fondo)',
    de: 'Flüchtigkeitskurve (Auftakt → Herz → Ausklang)',
    ru: 'Кривая испарения (Старт → Сердце → Шлейф)',
    zh: '挥发演变曲线（前调 → 中调 → 尾调）',
    tr: 'Uçuculuk Eğrisi (Açılış → Kalp → Dip)',
    fa: 'منحنی فرّاریت زمانی (گشایش → قلب → ماندگاری)',
  },
  synergies_lbl: {
    ar: 'نقاط التناغم والتآزر',
    en: 'Accord Synergies',
    fr: 'Synergies olfactives',
    es: 'Sinergias de acordes',
    it: 'Sinergie olfattive',
    de: 'Akkord-Synergien',
    ru: 'Синергия нот',
    zh: '香调协同效应',
    tr: 'Koku Sinerjileri',
    fa: 'نقاط هم‌افزایی و هارمونی',
  },
  tensions_lbl: {
    ar: 'نقاط التوتر والتوصيات الإصلاحية',
    en: 'Structural Tensions & Fixes',
    fr: 'Tensions et ajustements',
    es: 'Tensiones y ajustes',
    it: 'Tensioni e correzioni',
    de: 'Spannungen & Korrekturen',
    ru: 'Дисбалансы и правки',
    zh: '结构失衡与优化建议',
    tr: 'Uyumsuzluklar ve Çözümler',
    fa: 'تنش‌های ساختاری و اصلاحات',
  },
  bridges_lbl: {
    ar: 'نوتات ربط مقترحة لرفع التناغم',
    en: 'Recommended Bridge Additions',
    fr: 'Ajouts de ponts recommandés',
    es: 'Notas puente recomendadas',
    it: 'Note ponte consigliate',
    de: 'Empfohlene Brückennoten',
    ru: 'Рекомендуемые связующие ноты',
    zh: '建议补充的桥接香调',
    tr: 'Önerilen Köprü Notalar',
    fa: 'نت‌های پیوندی پیشنهادی',
  },
  add_to_pyramid: {
    ar: 'أضف للهرم العطري',
    en: 'Add to Pyramid',
    fr: 'Ajouter à la pyramide',
    es: 'Añadir a la pirámide',
    it: 'Aggiungi alla piramide',
    de: 'Zur Pyramide hinzufügen',
    ru: 'Добавить в пирамиду',
    zh: '添加到金字塔',
    tr: 'Piramite Ekle',
    fa: 'افزودن به هرم عطری',
  },
  added_to_pyramid: {
    ar: 'أُضيفت للهرم',
    en: 'Added',
    fr: 'Ajoutée',
    es: 'Añadida',
    it: 'Aggiunta',
    de: 'Hinzugefügt',
    ru: 'Добавлено',
    zh: '已添加',
    tr: 'Eklendi',
    fa: 'اضافه شد',
  },
  maceration_lbl: {
    ar: 'توصية التعتيق والتثبيت',
    en: 'Maceration & Fixation Guidance',
    fr: 'Conseil de macération et fixation',
    es: 'Guía de maceración y fijación',
    it: 'Consiglio su macerazione e fissazione',
    de: 'Mazerations- & Fixierhinweis',
    ru: 'Совет по мацерации и фиксации',
    zh: '浸置与定香建议',
    tr: 'Maserasyon ve Sabitleme Tavsiyesi',
    fa: 'توصیه جاافتادگی و تثبیت',
  },
  ask_shahin_btn: {
    ar: 'مناقشة التحليل وتعديل التركيبة مع الخبير شاهين',
    en: 'Discuss & Refine Formula with Master Shahin',
    fr: 'Affiner la formule avec Maître Shahin',
    es: 'Ajustar fórmula con el Maestro Shahin',
    it: 'Affina la formula con il Maestro Shahin',
    de: 'Mit Meister Shahin weiter verfeinern',
    ru: 'Обсудить правки с Мастером Шахином',
    zh: '与 Shahin 大师深入微调配方',
    tr: 'Usta Shahin ile Formülü İyileştir',
    fa: 'گفتگو با استاد شاهین برای اصلاح فرمول',
  },
  err_static: {
    ar: 'يتطلب التحليل بالذكاء الاصطناعي خادماً متصلاً؛ هذه النسخة ثابتة للعرض فقط.',
    en: 'AI harmony analysis requires a live server connection.',
    fr: 'L’analyse nécessite un serveur actif.',
    es: 'El análisis requiere conexión con el servidor.',
    it: 'L’analisi richiede una connessione al server.',
    de: 'Für die Analyse ist ein aktiver Server erforderlich.',
    ru: 'Требуется подключение к серверу.',
    zh: '需要连接实时服务器才能进行香调分析。',
    tr: 'Analiz için aktif sunucu bağlantısı gerekir.',
    fa: 'تحلیل هوشمند نیازمند اتصال به سرور زنده است.',
  },
  err_missing_key: {
    ar: 'مفتاح الذكاء الاصطناعي غير مضبوط على الخادم حالياً. أضف GEMINI_API_KEY في إعدادات الخادم لتفعيل التحليل.',
    en: 'Server AI key is not configured. Configure GEMINI_API_KEY on the server to enable analysis.',
    fr: 'La clé serveur n’est pas configurée pour l’analyse.',
    es: 'La clave de servidor no está configurada.',
    it: 'La chiave server non è configurata.',
    de: 'Der Server-Schlüssel ist nicht konfiguriert.',
    ru: 'Ключ сервера не настроен.',
    zh: '服务器尚未配置分析密钥。',
    tr: 'Sunucu analiz anahtarı yapılandırılmamış.',
    fa: 'کلید سرور برای تحلیل هوشمند تنظیم نشده است.',
  },
  err_rate: {
    ar: 'تم تجاوز الحد المؤقت لطلبات التحليل. أعد المحاولة بعد قليل.',
    en: 'Analysis request limit reached temporarily. Please wait a moment.',
    fr: 'Limite de requêtes atteinte, réessayez sous peu.',
    es: 'Límite de análisis alcanzado temporalmente.',
    it: 'Limite richieste raggiunto temporaneamente.',
    de: 'Anfragelimit vorübergehend erreicht.',
    ru: 'Лимит запросов временно исчерпан.',
    zh: '分析请求过于频繁，请稍后再试。',
    tr: 'İstek sınırına ulaşıldı, lütfen biraz sonra deneyin.',
    fa: 'سقف موقت درخواست تحلیل پر شده است؛ کمی بعد تلاش کنید.',
  },
  err_generic: {
    ar: 'تعذر إكمال تحليل التناسق العطري الآن. تحقق من الاتصال وأعد المحاولة.',
    en: 'Could not complete olfactory harmony analysis. Please try again.',
    fr: 'Impossible de terminer l’analyse olfactive.',
    es: 'No se pudo completar el análisis olfativo.',
    it: 'Impossibile completare l’analisi olfattiva.',
    de: 'Duftanalyse konnte nicht abgeschlossen werden.',
    ru: 'Не удалось завершить анализ гармонии.',
    zh: '暂时无法完成香调分析，请重试。',
    tr: 'Koku uyumu analizi tamamlanamadı.',
    fa: 'امکان تکمیل تحلیل هارمونی وجود نداشت؛ دوباره تلاش کنید.',
  },
  days_lbl: { ar: 'يوم تعتيق', en: 'days', fr: 'j', es: 'd', it: 'g', de: 'T', ru: 'дн.', zh: '天', tr: 'gün', fa: 'روز' },
  notes_count_tpl: {
    ar: '{n} نوتات',
    en: '{n} notes',
    fr: '{n} notes',
    es: '{n} notas',
    it: '{n} note',
    de: '{n} Noten',
    ru: '{n} нот',
    zh: '{n} 种香调',
    tr: '{n} nota',
    fa: '{n} نت',
  },
} as const satisfies Record<string, LText>;

export const OlfactoryHarmonyAnalyzer: React.FC<OlfactoryHarmonyAnalyzerProps> = ({
  currentLang,
  labContext,
  isStaticHosting,
  onAskShaheenFollowUp,
  onOpenPyramidTool,
  onApplyToPyramidCalculator,
}) => {
  const L = makeT(currentLang, S);
  const rtl = isRTL(currentLang);

  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<HarmonyApiResponse | null>(null);
  const [analyzedFingerprint, setAnalyzedFingerprint] = useState<string | null>(null);
  const [addedNoteNames, setAddedNoteNames] = useState<string[]>([]);

  const notes = labContext?.pyramidNotes ?? [];
  const formulation = labContext?.formulation;
  const formulaTitle = labContext?.formulaTitle?.trim() || (currentLang === 'ar' ? 'تركيبة المعمل النشطة' : 'Active Lab Formula');
  const macerationDays = labContext?.macerationDays ?? 30;

  const tierTotals = useMemo(() => {
    return notes.reduce(
      (acc, n) => {
        const pct = Number.isFinite(Number(n.percentageOfOil)) ? Number(n.percentageOfOil) : 0;
        acc[n.category] = +(acc[n.category] + pct).toFixed(1);
        acc.total = +(acc.total + pct).toFixed(1);
        return acc;
      },
      { top: 0, heart: 0, base: 0, total: 0 },
    );
  }, [notes]);

  const currentFingerprint = useMemo(
    () =>
      JSON.stringify({
        notes: notes.map((n) => [n.nameAr, n.nameEn, n.category, n.percentageOfOil]),
        conc: formulation?.concentrationPercent,
        fix: formulation?.fixativePercent,
        days: macerationDays,
        lang: currentLang,
      }),
    [notes, formulation?.concentrationPercent, formulation?.fixativePercent, macerationDays, currentLang],
  );

  const isStale = Boolean(result && analyzedFingerprint && analyzedFingerprint !== currentFingerprint);

  const noteDisplayName = (n: { nameAr: string; nameEn?: string }) =>
    currentLang === 'ar' || currentLang === 'fa' ? n.nameAr || n.nameEn || '' : n.nameEn || n.nameAr || '';

  const tierLabel = (cat: 'top' | 'heart' | 'base') =>
    cat === 'top' ? L('tier_top') : cat === 'heart' ? L('tier_heart') : L('tier_base');

  const tierBadgeClass = (cat: 'top' | 'heart' | 'base') =>
    cat === 'top'
      ? 'bg-amber-50 border-amber-300/80 text-amber-950'
      : cat === 'heart'
      ? 'bg-rose-50 border-rose-300/80 text-rose-950'
      : 'bg-stone-100 border-stone-300 text-stone-900';

  const verdictMeta = (status: HarmonyVerdictStatus) => {
    switch (status) {
      case 'balanced':
        return {
          label: L('verdict_balanced'),
          pill: 'bg-emerald-50 border-emerald-300 text-emerald-900',
          stroke: '#059669',
          Icon: CheckCircle2,
        };
      case 'needs_bridge':
        return {
          label: L('verdict_needs_bridge'),
          pill: 'bg-amber-50 border-amber-300 text-amber-900',
          stroke: '#d97706',
          Icon: Layers,
        };
      case 'top_heavy':
        return {
          label: L('verdict_top_heavy'),
          pill: 'bg-sky-50 border-sky-300 text-sky-900',
          stroke: '#0284c7',
          Icon: Activity,
        };
      case 'base_heavy':
        return {
          label: L('verdict_base_heavy'),
          pill: 'bg-stone-100 border-stone-300 text-stone-900',
          stroke: '#78716c',
          Icon: Scale,
        };
      case 'clashing':
      default:
        return {
          label: L('verdict_clashing'),
          pill: 'bg-rose-50 border-rose-300 text-rose-900',
          stroke: '#e11d48',
          Icon: ShieldAlert,
        };
    }
  };

  const handleAnalyze = async () => {
    if (notes.length === 0 || loading) return;
    if (isStaticHosting) {
      setErrorMsg(L('err_static'));
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setExpanded(true);

    try {
      const data = await requestApi<HarmonyApiResponse>(
        '/api/ai/harmony',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes,
            formulaTitle,
            formulation,
            macerationDays,
            language: currentLang,
          }),
        },
        45_000,
      );
      setResult(data);
      setAnalyzedFingerprint(currentFingerprint);
      setAddedNoteNames([]);
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        setErrorMsg(L('err_static'));
      } else if (err instanceof ApiError) {
        if (err.code === 'MISSING_API_KEY' || err.status === 503) setErrorMsg(L('err_missing_key'));
        else if (err.code === 'RATE_LIMITED' || err.status === 429) setErrorMsg(L('err_rate'));
        else setErrorMsg(L('err_generic'));
      } else {
        setErrorMsg(L('err_generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAddition = (addition: {
    name: string;
    category: 'top' | 'heart' | 'base';
    suggestedPct: number;
  }) => {
    if (!onApplyToPyramidCalculator) return;

    const existingConverted: PyramidNote[] = notes.map((n, idx) => ({
      id: `lab-note-${idx}-${Date.now()}`,
      nameAr: n.nameAr || n.nameEn || 'نوتة',
      nameEn: n.nameEn || n.nameAr || 'Note',
      category: n.category,
      percentageOfOil: n.percentageOfOil,
    }));

    const newNote: PyramidNote = {
      id: `harmony-bridge-${Date.now()}`,
      nameAr: addition.name,
      nameEn: addition.name,
      category: addition.category,
      percentageOfOil: addition.suggestedPct,
    };

    const rawConcType = (formulation?.concentrationType || 'edp') as ConcentrationType;
    const concType: ConcentrationType = VALID_CONC_TYPES.has(rawConcType) ? rawConcType : 'edp';

    onApplyToPyramidCalculator({
      title: formulaTitle,
      author: 'Sham Lab Harmony Bridge',
      concentrationPercent: formulation?.concentrationPercent ?? 20,
      concentrationType: concType,
      bottleVolumeMl: formulation?.bottleVolumeMl ?? 50,
      alcoholPercentage: formulation?.alcoholPercentage ?? 96,
      waterPercent: formulation?.waterPercent ?? 0,
      fixativePercent: formulation?.fixativePercent ?? 2,
      macerationDays,
      summary: result?.report?.executiveSummary || formulaTitle,
      pyramidNotes: [...existingConverted, newNote],
    });
    setAddedNoteNames((prev) => (prev.includes(addition.name) ? prev : [...prev, addition.name]));
  };

  const handleDiscussWithShahin = () => {
    if (!onAskShaheenFollowUp || !result) return;
    const r = result.report;
    const noteList = notes.map((n) => `${noteDisplayName(n)} (${n.percentageOfOil}%)`).join('، ');
    const prompt =
      currentLang === 'ar' || currentLang === 'fa'
        ? `بناءً على تحليل التناسق العطري لتركيبة "${formulaTitle}" (المؤشر: ${r.harmonyScore}/100 - ${r.olfactoryProfile}):\nالنوتات الحالية: ${noteList}.\nالتوترات المرصودة: ${r.tensions.map((t) => t.issue).join('؛ ') || 'لا يوجد'}.\nاقترح عليّ خطة عملية لتعديل النسب ودمج نوتات الربط المناسبة للوصول لأعلى ثبات وتناغم.`
        : `Based on the Olfactory Harmony report for "${formulaTitle}" (Index: ${r.harmonyScore}/100 — ${r.olfactoryProfile}):\nActive notes: ${noteList}.\nObserved tensions: ${r.tensions.map((t) => t.issue).join('; ') || 'None'}.\nPropose an exact revised formula ratio and blending sequence to maximize harmony and longevity.`;
    onAskShaheenFollowUp(prompt);
  };

  const totalBarDenom = Math.max(tierTotals.total, 1);
  const topWidth = Math.round((tierTotals.top / totalBarDenom) * 100);
  const heartWidth = Math.round((tierTotals.heart / totalBarDenom) * 100);
  const baseWidth = Math.max(0, 100 - topWidth - heartWidth);

  return (
    <section
      dir={rtl ? 'rtl' : 'ltr'}
      aria-label={L('title')}
      className="bg-white rounded-2xl border border-stone-200/95 shadow-xs overflow-hidden"
    >
      {/* Analytical Header Bar */}
      <div className="bg-stone-950 text-stone-100 px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-stone-800">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-stone-900 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Activity className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {L('title')}
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-stone-900 border border-stone-700 text-[11px] font-mono tabular-nums text-amber-300">
                {fmt(L('notes_count_tpl'), { n: notes.length })}
              </span>
              {formulation && (
                <span className="px-2 py-0.5 rounded-md bg-stone-900 border border-stone-800 text-[11px] font-mono tabular-nums text-stone-300">
                  {formulation.concentrationPercent}% · {macerationDays} {L('days_lbl')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">
              {L('subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={loading || notes.length === 0 || isStaticHosting}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{result ? L('refresh_btn') : L('analyze_btn')}</span>
          </button>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 transition-colors cursor-pointer"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Active Lab Snapshot Strip */}
          {notes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-stone-200 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-stone-900">{L('no_notes_title')}</p>
                  <p className="text-xs text-stone-600 mt-0.5">{L('no_notes_desc')}</p>
                </div>
              </div>
              {onOpenPyramidTool && (
                <button
                  type="button"
                  onClick={onOpenPyramidTool}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <span>{L('open_pyramid')}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-stone-800">
                  <Droplets className="w-3.5 h-3.5 text-amber-700" />
                  <span>{L('active_notes_lbl')}:</span>
                  <span className="text-stone-500 font-normal">{formulaTitle}</span>
                </div>

                <div className="flex items-center gap-2 font-mono tabular-nums text-[11px]">
                  <span className="text-amber-800">
                    {L('tier_top')} {tierTotals.top}%
                  </span>
                  <span className="text-stone-300">|</span>
                  <span className="text-rose-800">
                    {L('tier_heart')} {tierTotals.heart}%
                  </span>
                  <span className="text-stone-300">|</span>
                  <span className="text-stone-700">
                    {L('tier_base')} {tierTotals.base}%
                  </span>
                </div>
              </div>

              {/* 3-Tier Proportion Bar */}
              <div className="h-2 w-full rounded-full overflow-hidden bg-stone-200 flex">
                {topWidth > 0 && (
                  <div style={{ width: `${topWidth}%` }} className="bg-amber-500 transition-all" />
                )}
                {heartWidth > 0 && (
                  <div style={{ width: `${heartWidth}%` }} className="bg-rose-500 transition-all" />
                )}
                {baseWidth > 0 && (
                  <div style={{ width: `${baseWidth}%` }} className="bg-stone-700 transition-all" />
                )}
              </div>

              {/* Note Badges */}
              <div className="flex flex-wrap gap-1.5">
                {notes.map((n, idx) => (
                  <span
                    key={`${n.nameAr}-${n.category}-${idx}`}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${tierBadgeClass(
                      n.category,
                    )}`}
                  >
                    <span className="opacity-70 text-[10px] font-semibold">{tierLabel(n.category)}</span>
                    <span>{noteDisplayName(n)}</span>
                    <span className="font-mono tabular-nums font-bold">{n.percentageOfOil}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 flex items-center gap-3 text-xs text-amber-950 font-medium">
              <RefreshCw className="w-4 h-4 text-amber-700 animate-spin shrink-0" />
              <span>{L('analyzing')}</span>
            </div>
          )}

          {/* Error Banner (honest error propagation) */}
          {errorMsg && !loading && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 flex items-center justify-between gap-3 text-xs text-rose-900">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              {notes.length > 0 && !isStaticHosting && (
                <button
                  type="button"
                  onClick={() => void handleAnalyze()}
                  className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 hover:bg-rose-100 font-semibold shrink-0 cursor-pointer"
                >
                  {L('refresh_btn')}
                </button>
              )}
            </div>
          )}

          {/* Stale Notification */}
          {isStale && !loading && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 flex items-center justify-between gap-2 text-xs text-amber-950">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>{L('stale_warn')}</span>
              </span>
              <button
                type="button"
                onClick={() => void handleAnalyze()}
                className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold text-[11px] shrink-0 cursor-pointer"
              >
                {L('refresh_btn')}
              </button>
            </div>
          )}

          {/* Structured Harmony Analysis Results */}
          {result && !loading && (() => {
            const report = result.report;
            const meta = verdictMeta(report.verdictStatus);
            const VerdictIcon = meta.Icon;
            const radius = 34;
            const circumference = 2 * Math.PI * radius;
            const dashOffset = circumference - (report.harmonyScore / 100) * circumference;

            return (
              <div className="space-y-4">
                {/* Score & Executive Summary Row */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                  <div className="lg:col-span-4 rounded-xl border border-stone-200 bg-stone-50 p-3.5 flex items-center gap-3.5">
                    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 84 84" className="w-20 h-20 -rotate-90">
                        <circle
                          cx="42"
                          cy="42"
                          r={radius}
                          fill="none"
                          stroke="#e7e5e4"
                          strokeWidth="7"
                        />
                        <circle
                          cx="42"
                          cy="42"
                          r={radius}
                          fill="none"
                          stroke={meta.stroke}
                          strokeWidth="7"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={dashOffset}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-extrabold font-mono tabular-nums text-stone-950 leading-none">
                          {report.harmonyScore}
                        </span>
                        <span className="text-[10px] font-mono text-stone-500">/100</span>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-500">
                        {L('score_lbl')}
                      </div>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${meta.pill}`}>
                        <VerdictIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{meta.label}</span>
                      </div>
                      <div className="text-xs font-semibold text-stone-800 truncate">
                        {report.olfactoryProfile}
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-8 rounded-xl border border-stone-200 bg-white p-3.5 space-y-2.5">
                    <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium">
                      {report.executiveSummary}
                    </p>
                    <div className="pt-2 border-t border-stone-100">
                      <div className="text-[11px] font-bold text-stone-600 mb-1 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-amber-700" />
                        <span>{L('volatility_lbl')}</span>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        {report.volatilityCurveSummary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tier Diagnostics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {(['top', 'heart', 'base'] as const).map((tier) => (
                    <div
                      key={tier}
                      className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-stone-900">
                        <span>{tierLabel(tier)}</span>
                        <span className="font-mono tabular-nums text-stone-600">
                          {result.tierTotals[tier]}%
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        {report.tierAssessment[tier]}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Synergies vs Tensions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>{L('synergies_lbl')}</span>
                    </h4>
                    <div className="space-y-2">
                      {report.synergies.map((syn, idx) => (
                        <div key={idx} className="bg-white rounded-lg border border-emerald-100 p-2.5 text-xs">
                          <div className="font-bold text-emerald-950">{syn.pair}</div>
                          <div className="text-stone-600 mt-0.5 leading-relaxed">{syn.effect}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5 space-y-2">
                    <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      <span>{L('tensions_lbl')}</span>
                    </h4>
                    <div className="space-y-2">
                      {report.tensions.map((ten, idx) => (
                        <div key={idx} className="bg-white rounded-lg border border-amber-100 p-2.5 text-xs">
                          <div className="font-bold text-stone-900">{ten.issue}</div>
                          <div className="text-amber-900 mt-0.5 leading-relaxed">{ten.suggestion}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recommended Bridge Additions */}
                {report.recommendedAdditions.length > 0 && (
                  <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2.5">
                    <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-amber-700" />
                      <span>{L('bridges_lbl')}</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {report.recommendedAdditions.map((rec, idx) => {
                        const wasAdded = addedNoteNames.includes(rec.name);
                        return (
                          <div
                            key={idx}
                            className="bg-white rounded-xl border border-stone-200 p-3 flex flex-col justify-between gap-2.5"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-xs text-stone-900">{rec.name}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-md border text-[10px] font-mono tabular-nums font-bold ${tierBadgeClass(
                                    rec.category,
                                  )}`}
                                >
                                  {tierLabel(rec.category)} · {rec.suggestedPct}%
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-600 leading-relaxed">
                                {rec.rationale}
                              </p>
                            </div>
                            {onApplyToPyramidCalculator && (
                              <button
                                type="button"
                                onClick={() => handleApplyAddition(rec)}
                                disabled={wasAdded}
                                className={`w-full py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer border ${
                                  wasAdded
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 cursor-default'
                                    : 'bg-stone-900 hover:bg-stone-800 border-stone-900 text-white'
                                }`}
                              >
                                <Plus className="w-3 h-3" />
                                <span>{wasAdded ? L('added_to_pyramid') : L('add_to_pyramid')}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Maceration Advice + Direct Shahin Follow-up CTA */}
                <div className="rounded-xl border border-stone-200 bg-stone-900 text-stone-100 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 text-xs">
                    <Timer className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-300">{L('maceration_lbl')}</div>
                      <p className="text-stone-300 mt-0.5 leading-relaxed">{report.macerationAdvice}</p>
                    </div>
                  </div>

                  {onAskShaheenFollowUp && (
                    <button
                      type="button"
                      onClick={handleDiscussWithShahin}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span>{L('ask_shahin_btn')}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </section>
  );
};
