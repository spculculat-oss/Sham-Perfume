import React, { useState, useEffect } from 'react';
import {
  Globe,
  TrendingUp,
  Sparkles,
  Search,
  Calendar,
  Clock,
  ExternalLink,
  Layers,
  FlaskConical,
  Check,
  Copy,
  Bookmark,
  Share2,
  X,
  Flame,
  ArrowRight,
  ShieldCheck,
  Award,
  BookOpen,
} from 'lucide-react';
import { PERFUME_NEWS_DATA, PerfumeNewsItem } from '../data/perfumeNews';
import { PyramidNote } from '../types/perfume';
import { ExtractedAIPerfume } from '../utils/aiFormulaExtractor';

import { SupportedLanguage } from '../types/i18n';
import { getLocalizedNewsArticle, getCommonLabel, isRTL } from '../utils/localizedContent';
import { LText, makeT, fmt, pickArEn } from '../utils/localize';


const S = {
  cat_all: {
    ar: 'جميع الأخبار والتقارير',
    en: 'All News & Reports',
    fr: 'Toutes les actualités',
    es: 'Todas las noticias',
    it: 'Tutte le notizie',
    de: 'Alle News & Berichte',
    ru: 'Все новости и отчеты',
    zh: '全部新闻与报道',
    tr: 'Tüm haberler',
    fa: 'همه اخبار و گزارش‌ها',
  },
  cat_trends: {
    ar: 'صيحات وتقارير السوق',
    en: 'Market Trends & Analytics',
    fr: 'Tendances et analyses du marché',
    es: 'Tendencias y análisis del mercado',
    it: 'Tendenze e analisi di mercato',
    de: 'Markttrends & Analysen',
    ru: 'Тренды и аналитика рынка',
    zh: '市场趋势与分析',
    tr: 'Pazar trendleri ve analizleri',
    fa: 'روندها و تحلیل‌های بازار',
  },
  cat_exhibitions: {
    ar: 'المعارض الدولية الكبرى',
    en: 'International Exhibitions',
    fr: 'Salons internationaux',
    es: 'Exposiciones internacionales',
    it: 'Esposizioni internazionali',
    de: 'Internationale Messen',
    ru: 'Международные выставки',
    zh: '国际展会',
    tr: 'Uluslararası fuarlar',
    fa: 'نمایشگاه‌های بین‌المللی',
  },
  cat_harvests: {
    ar: 'مواسم الحصاد والمواد الخام',
    en: 'Botanical Harvests & Crops',
    fr: 'Récoltes botaniques',
    es: 'Cosechas botánicas',
    it: 'Raccolte botaniche',
    de: 'Botanische Ernten',
    ru: 'Сбор урожая и сырьё',
    zh: '植物采收与原料',
    tr: 'Botanik hasatlar',
    fa: 'فصل‌های برداشت و مواد اولیه',
  },
  cat_ifra: {
    ar: 'لوائح وتحديثات IFRA',
    en: 'IFRA Regulations & Updates',
    fr: 'Réglementation IFRA',
    es: 'Reglamentos IFRA',
    it: 'Normative IFRA',
    de: 'IFRA-Richtlinien',
    ru: 'Регламенты IFRA',
    zh: 'IFRA 法规与更新',
    tr: 'IFRA yönetmelikleri',
    fa: 'مقررات IFRA',
  },
  cat_niche: {
    ar: 'ابتكارات النيش والكيمياء',
    en: 'Niche Perfumery & Chemistry',
    fr: 'Parfumerie de niche et chimie',
    es: 'Perfumería de nicho y química',
    it: 'Profumeria di nicchia e chimica',
    de: 'Nischenparfümerie & Chemie',
    ru: 'Нишевая парфюмерия и химия',
    zh: '小众香水与化学',
    tr: 'Niş parfümeri ve kimya',
    fa: 'عطرسازی نیچ و شیمی',
  },
  search_placeholder: {
    ar: 'ابحث في الأخبار، المعارض، أو المكونات...',
    en: 'Search trends, exhibitions, or notes...',
    fr: 'Rechercher tendances, salons, notes…',
    es: 'Buscar tendencias, expos, notas…',
    it: 'Cerca tendenze, fiere, note…',
    de: 'Trends, Messen, Noten suchen…',
    ru: 'Поиск трендов, выставок, нот…',
    zh: '搜索趋势、展会或香材…',
    tr: 'Trend, fuar veya nota ara…',
    fa: 'جستجوی روندها، نمایشگاه‌ها یا نت‌ها…',
  },
  transferred: {
    ar: 'تم النقل للمعمل',
    en: 'Transferred',
    fr: 'Transféré',
    es: 'Transferido',
    it: 'Trasferito',
    de: 'Übertragen',
    ru: 'Перенесено',
    zh: '已传送',
    tr: 'Aktarıldı',
    fa: 'به آزمایشگاه منتقل شد',
  },
  apply_lab: {
    ar: 'تطبيق في المعمل',
    en: 'Apply in Lab',
    fr: 'Appliquer au labo',
    es: 'Aplicar en el laboratorio',
    it: 'Applica in laboratorio',
    de: 'Im Labor anwenden',
    ru: 'Применить в лаборатории',
    zh: '应用于实验室',
    tr: 'Laboratuvarda uygula',
    fa: 'اعمال در آزمایشگاه',
  },
  read_full: {
    ar: 'قراءة كاملة',
    en: 'Read Full Report',
    fr: 'Lire le rapport',
    es: 'Leer informe completo',
    it: 'Leggi il report',
    de: 'Vollständigen Bericht lesen',
    ru: 'Читать отчет',
    zh: '阅读全文',
    tr: 'Tam raporu oku',
    fa: 'مطالعه کامل گزارش',
  },
  copy_summary: {
    ar: 'نسخ ملخص',
    en: 'Copy Summary',
    fr: 'Copier le résumé',
    es: 'Copiar resumen',
    it: 'Copia riepilogo',
    de: 'Zusammenfassung kopieren',
    ru: 'Скопировать сводку',
    zh: '复制摘要',
    tr: 'Özeti kopyala',
    fa: 'کپی خلاصه',
  },
  bookmark: {
    ar: 'حفظ',
    en: 'Bookmark',
    fr: 'Marquer',
    es: 'Marcar',
    it: 'Segnalibro',
    de: 'Lesezeichen',
    ru: 'В закладки',
    zh: '收藏',
    tr: 'Yer imi',
    fa: 'نشان‌گذاری',
  },
  pulse_title: {
    ar: 'لوحة مؤشرات سوق العطور العالمية (Global Fragrance Pulse 2026)',
    en: 'Global Fragrance Pulse & Market Indicators 2026',
    fr: 'Pulse mondial du parfum 2026',
    es: 'Pulso global de la perfumería 2026',
    it: 'Pulse globale della profumeria 2026',
    de: 'Globaler Duft-Puls 2026',
    ru: 'Мировой парфюмерный пульс 2026',
    zh: '2026 全球香水市场脉搏',
    tr: 'Küresel parfüm nabzı 2026',
    fa: 'نبض جهانی بازار عطر ۲۰۲۶',
  },
  pulse_desc: {
    ar: 'تحليل دوري معتمد لمصممي العطور والمعامل',
    en: 'Certified periodic intelligence for perfumers & compounding labs',
    fr: 'Analyses périodiques certifiées pour parfumeurs et laboratoires',
    es: 'Inteligencia periódica certificada para perfumistas y laboratorios',
    it: 'Analisi periodica certificata per profumieri e laboratori',
    de: 'Zertifizierte Periodika für Parfümeure & Labore',
    ru: 'Сертифицированная периодическая аналитика для парфюмеров и лабораторий',
    zh: '面向调香师与调配实验室的认证周期情报',
    tr: 'Parfümörler ve laboratuvarlar için sertifikalı dönemsel analizler',
    fa: 'تحلیل دوره‌ای معتبر برای عطرسازان و آزمایشگاه‌ها',
  },
  growing_notes: {
    ar: '🔥 النوتات الأسرع صعوداً في الطلب',
    en: '🔥 Fastest Growing Fragrance Notes',
    fr: '🔥 Notes les plus demandées',
    es: '🔥 Notas con mayor crecimiento',
    it: '🔥 Note in maggior crescita',
    de: '🔥 Am schnellsten wachsende Noten',
    ru: '🔥 Самые быстрорастущие ноты',
    zh: '🔥 增长最快的香调',
    tr: '🔥 En hızlı büyüyen notalar',
    fa: '🔥 نت‌های با بیشترین رشد تقاضا',
  },
  growing_notes_desc: {
    ar: 'شاي أولونغ الصيني (+45%)، الفستق الحلبي المحمص (+60%)، دهن العود المستدام المعالج بيولوجياً (+38%).',
    en: 'Chinese Oolong Tea (+45%), Roasted Pistachio (+60%), Bio-distilled Sustainable Oud (+38%).',
    fr: 'Thé Oolong chinois (+45 %), pistache grillée (+60 %), oud durable bio (+38 %).',
    es: 'Té Oolong chino (+45 %), pistacho tostado (+60 %), oud sostenible bio (+38 %).',
    it: 'Tè Oolong cinese (+45%), pistacchio tostato (+60%), oud sostenibile bio (+38%).',
    de: 'Chinesischer Oolong-Tee (+45 %), geröstete Pistazie (+60 %), bio-destilliertes Oud (+38 %).',
    ru: 'Китайский улун (+45%), жареная фисташка (+60%), экологичный уд (+38%).',
    zh: '中国乌龙茶（+45%）、烤开心果（+60%）、生物蒸馏可持续乌木（+38%）。',
    tr: 'Çin Oolong çayı (+%45), kavrulmuş Antep fıstığı (+%60), biyo-destilasyonlu sürdürülebilir oud (+%38).',
    fa: 'چای اولونگ چینی (+۴۵٪)، پسته برشته (+۶۰٪)، عود پایدار زیست‌تقطیری (+۳۸٪).',
  },
  ifra_title: {
    ar: '⚖️ الامتثال لمعايير IFRA 51',
    en: '⚖️ IFRA 51 Compliance',
    fr: '⚖️ Conformité IFRA 51',
    es: '⚖️ Cumplimiento IFRA 51',
    it: '⚖️ Conformità IFRA 51',
    de: '⚖️ IFRA-51-Konformität',
    ru: '⚖️ Соответствие IFRA 51',
    zh: '⚖️ IFRA 51 合规',
    tr: '⚖️ IFRA 51 uyumu',
    fa: '⚖️ انطباق با IFRA 51',
  },
  ifra_desc: {
    ar: 'حظر مادة الليليال بات إلزامياً دولياً؛ الاعتماد الكلي على الهيديون النقي والفلورالوزون كبدائل آمنة في النوتات الزهرية.',
    en: 'Lilial ban is strictly enforced globally; total reliance on pure Hedione and Floralozone for transparent florals.',
    fr: 'L’interdiction du Lilial est mondiale ; place au Hedione pur et au Floralozone.',
    es: 'La prohibición del Lilial es global; se impone el Hedione puro y el Floralozone.',
    it: 'Il bando al Lilial è globale; spazio a Hedione puro e Floralozone.',
    de: 'Das Lilial-Verbot gilt weltweit; Fokus auf reines Hedione und Floralozone.',
    ru: 'Запрет лилиаля действует глобально; упор на чистый гедион и Floralozone.',
    zh: '莉莉醇禁令已全球生效；透明花香完全依赖纯海利酮与 Floralozone。',
    tr: 'Lilial yasağı küresel çapta; saf Hedione ve Floralozone öne çıkıyor.',
    fa: 'ممنوعیت لیلال در سطح جهانی اجرایی شده؛ تکیه کامل بر هیدیون خالص و فلورالوزون.',
  },
  verdict_tip: {
    ar: '💡 نصيحة «معمل شام» للمصممين',
    en: '💡 Master Sham Atelier Verdict',
    fr: '💡 Le verdict de l’atelier Sham',
    es: '💡 El veredicto del atelier Sham',
    it: '💡 Il verdetto dell’atelier Sham',
    de: '💡 Urteil des Sham Ateliers',
    ru: '💡 Вердикт ателье Sham',
    zh: '💡 Sham 工作室点评',
    tr: '💡 Sham Atölyesi yorumu',
    fa: '💡 نظر کارگاه شام',
  },
  verdict_tip_desc: {
    ar: '«التوليفات الهجينة بين الانتعاش الحمضي الغربي والقواعد البخورية الشرقية هي الاتجاه الأكثر ربحية وانتشاراً عالمياً حالياً».',
    en: '«Hybrid creations merging crisp Western citrus brilliance with rich Oriental incense anchors offer the highest global market traction.»',
    fr: '«Les créations hybrides mêlant agrumes occidentaux et bases orientales encensées dominent le marché.»',
    es: '«Las creaciones híbridas que unen cítricos occidentales y bases orientales de incienso lideran el mercado.»',
    it: '«Le creazioni ibride che uniscono agrumi occidentali e basi orientali d’incenso dominano il mercato.»',
    de: '«Hybrid-Kreationen aus westlichen Zitrusnoten und orientalischen Weihrauchbasen dominieren den Markt.»',
    ru: '«Гибриды из западных цитрусов и восточных благовонных баз — самый выгодный тренд сейчас.»',
    zh: '「融合西方清爽柑橘与东方焚香基调的混搭创作，正获得最高的全球市场热度。」',
    tr: '«Batı’nın ferah narenciyesi ile Doğu’nun tütsü tabanlarını birleştiren hibrit yaratımlar piyasaya hâkim.»',
    fa: '«ترکیب‌های دورگه میان مرکبات تازه غربی و پایه‌های بخوری شرقی، سودآورترین روند جهانی امروز است.»',
  },
  source_lbl: {
    ar: 'المصدر:',
    en: 'Source:',
    fr: 'Source :',
    es: 'Fuente:',
    it: 'Fonte:',
    de: 'Quelle:',
    ru: 'Источник:',
    zh: '来源：',
    tr: 'Kaynak:',
    fa: 'منبع:',
  },
  read_time_lbl: {
    ar: 'وقت القراءة:',
    en: 'Read Time:',
    fr: 'Temps de lecture :',
    es: 'Tiempo de lectura:',
    it: 'Tempo di lettura:',
    de: 'Lesezeit:',
    ru: 'Время чтения:',
    zh: '阅读时间：',
    tr: 'Okuma süresi:',
    fa: 'زمان مطالعه:',
  },
  verdict_section: {
    ar: 'رأي خبير المعمل وتأثيره الصناعي',
    en: 'Master Perfumer Laboratory Verdict & Impact',
    fr: 'Verdict de l’expert et impact',
    es: 'Veredicto del experto e impacto',
    it: 'Verdetto dell’esperto e impatto',
    de: 'Experturteil & Marktwirkung',
    ru: 'Вердикт эксперта и влияние',
    zh: '调香大师评测与影响',
    tr: 'Uzman yorumu ve etkisi',
    fa: 'نظر خبره و تأثیر صنعتی',
  },
  market_impact_lbl: {
    ar: 'أثر السوق:',
    en: 'Market Impact:',
    fr: 'Impact marché :',
    es: 'Impacto de mercado:',
    it: 'Impatto di mercato:',
    de: 'Marktwirkung:',
    ru: 'Влияние на рынок:',
    zh: '市场影响：',
    tr: 'Pazar etkisi:',
    fa: 'تأثیر بازار:',
  },
  rec_notes: {
    ar: 'النوتات الموصى بها في هذا التقرير:',
    en: 'Recommended Notes in This Report:',
    fr: 'Notes recommandées :',
    es: 'Notas recomendadas:',
    it: 'Note consigliate:',
    de: 'Empfohlene Noten:',
    ru: 'Рекомендуемые ноты:',
    zh: '本报道推荐香材：',
    tr: 'Önerilen notalar:',
    fa: 'نت‌های پیشنهادی در این گزارش:',
  },
  export_ready: {
    ar: 'جاهزة للتصدير المباشر',
    en: 'Export Ready',
    fr: 'Prêtes à l’export',
    es: 'Listas para exportar',
    it: 'Pronte per l’export',
    de: 'Exportbereit',
    ru: 'Готово к экспорту',
    zh: '可导出',
    tr: 'Dışa aktarmaya hazır',
    fa: 'آماده انتقال',
  },
  apply_full_accord: {
    ar: 'تطبيق هذه التوليفة بالكامل في حاسبة العطور والمعمل',
    en: 'Apply Full Accord to Formulation Scale',
    fr: 'Appliquer l’accord complet',
    es: 'Aplicar el acorde completo',
    it: 'Applica l’accordo completo',
    de: 'Gesamten Akkord anwenden',
    ru: 'Применить весь аккорд',
    zh: '应用完整配方',
    tr: 'Tüm akor formüle uygulansın',
    fa: 'اعمال کامل این ترکیب در فرمول',
  },
  copy_report_summary: {
    ar: 'نسخ ملخص التقرير',
    en: 'Copy Summary',
    fr: 'Copier le résumé',
    es: 'Copiar resumen',
    it: 'Copia riepilogo',
    de: 'Zusammenfassung kopieren',
    ru: 'Скопировать сводку',
    zh: '复制摘要',
    tr: 'Özeti kopyala',
    fa: 'کپی خلاصه گزارش',
  },
  close: {
    ar: 'إغلاق',
    en: 'Close',
    fr: 'Fermer',
    es: 'Cerrar',
    it: 'Chiudi',
    de: 'Schließen',
    ru: 'Закрыть',
    zh: '关闭',
    tr: 'Kapat',
    fa: 'بستن',
  },
  clip_brand: {
    ar: 'أخبار العطور العالمية - صمم عطرك مع شام',
    en: 'World Perfume News - Sham Atelier',
    fr: 'Actualités mondiales du parfum - Sham',
    es: 'Noticias globales de perfumería - Sham',
    it: 'News mondiali della profumeria - Sham',
    de: 'Weltweite Duftnachrichten - Sham',
    ru: 'Мировые парфюмерные новости — Sham',
    zh: '全球香水新闻 - Sham',
    tr: 'Küresel parfüm haberleri - Sham',
    fa: 'اخبار جهانی عطر - شام',
  },
  clip_verdict_lbl: {
    ar: 'رأي الخبير:',
    en: 'Master Verdict:',
    fr: 'Verdict :',
    es: 'Veredicto:',
    it: 'Verdetto:',
    de: 'Urteil:',
    ru: 'Вердикт:',
    zh: '专家评语：',
    tr: 'Yorum:',
    fa: 'نظر خبره:',
  },
  inspired_by_tpl: {
    ar: 'مستوحى من تقرير: {t}',
    en: 'Inspired by: {t}',
    fr: 'Inspiré de : {t}',
    es: 'Inspirado en: {t}',
    it: 'Ispirato a: {t}',
    de: 'Inspiriert von: {t}',
    ru: 'По мотивам: {t}',
    zh: '灵感来源：{t}',
    tr: 'İlham kaynağı: {t}',
    fa: 'الهام‌گرفته از گزارش: {t}',
  },
  accord_title_tpl: {
    ar: 'توليفة تقرير: {t}',
    en: 'Report Accord: {t}',
    fr: 'Accord du rapport : {t}',
    es: 'Acuerdo del informe: {t}',
    it: 'Accordo del report: {t}',
    de: 'Berichts-Akkord: {t}',
    ru: 'Аккорд по отчёту: {t}',
    zh: '报道配方：{t}',
    tr: 'Rapor akoru: {t}',
    fa: 'آکورد گزارش: {t}',
  },
  accord_author: {
    ar: 'تقرير أخبار العطور العالمية (شام)',
    en: 'World Perfume Trends (Sham)',
    fr: 'Tendances mondiales (Sham)',
    es: 'Tendencias globales (Sham)',
    it: 'Trend mondiali (Sham)',
    de: 'Globale Trends (Sham)',
    ru: 'Мировые тренды (Sham)',
    zh: '全球香水趋势（Sham）',
    tr: 'Küresel trendler (Sham)',
    fa: 'روندهای جهانی (شام)',
  },
  accord_summary_tpl: {
    ar: 'توليفة حديثة مبنية على توجهات السوق العالمية في {t}.‏\n{v}',
    en: 'Modern formula based on global market trends in {t}.\n{v}',
    fr: 'Formule moderne basée sur les tendances mondiales : {t}.\n{v}',
    es: 'Fórmula moderna basada en tendencias globales: {t}.\n{v}',
    it: 'Formula moderna basata sui trend globali: {t}.\n{v}',
    de: 'Moderne Formel nach globalen Trends: {t}.\n{v}',
    ru: 'Современная формула по мировым трендам: {t}.\n{v}',
    zh: '基于全球市场趋势的现代配方：{t}。\n{v}',
    tr: 'Küresel pazar trendlerine dayalı modern formül: {t}.\n{v}',
    fa: 'فرمول مدرن بر پایه روندهای جهانی بازار: {t}.\n{v}',
  },
  clip_tpl: {
    ar: `📰 [{brand}]\n{title}\n📅 {date} | 🏛️ المصدر: {source}\n\n{summary}\n\nرأي الخبير: {verdict}`,
    en: `📰 [{brand}]\n{title}\n📅 {date} | 🏛️ Source: {source}\n\n{summary}\n\nMaster Verdict: {verdict}`,
    fr: `📰 [{brand}]\n{title}\n📅 {date} | 🏛️ Source : {source}\n\n{summary}\n\nVerdict : {verdict}`,
    es: `📰 [{brand}]\n{title}\n📅 {date} | 🏛️ Fuente: {source}\n\n{summary}\n\nVeredicto: {verdict}`,
    it: `📰 [{brand}]\n{title}\n📅 {date} | 🏛️ Fonte: {source}\n\n{summary}\n\nVerdetto: {verdict}`,
    de: `📰 [{brand}]\n{title}\n📅 {date} | 🏛️ Quelle: {source}\n\n{summary}\n\nUrteil: {verdict}`,
    ru: `📰 [{brand}]\n{title}\n📅 {date} | 🏛️ Источник: {source}\n\n{summary}\n\nВердикт: {verdict}`,
    zh: `📰 [{brand}]\n{title}\n📅 {date} | 🏛️ 来源：{source}\n\n{summary}\n\n专家评语：{verdict}`,
    tr: `📰 [{brand}]\n{title}\n📅 {date} | 🏛️ Kaynak: {source}\n\n{summary}\n\nYorum: {verdict}`,
    fa: `📰 [{brand}]\n{title}\n📅 {date} | 🏛️ منبع: {source}\n\n{summary}\n\nنظر خبره: {verdict}`,
  },
  news_sub: { ar: 'مساحتك المتجددة للاطلاع على قرارات منظمة IFRA العالمية، نتائج معارض ميلانو ودبي وباريس، مواسم حصاد الورود والعود النقي، مع إمكانية تحويل أي نوتات متصدرة في الأخبار مباشرة إلى معملك وحاسبة التركيب بنقرة واحدة!', en: 'Your evolving space for IFRA rulings, Milan-Dubai-Paris exhibition results, rose and pure oud harvest seasons, plus one-click transfer of trending notes straight into your compounding lab!', fr: 'Votre espace dédié : décisions IFRA, résultats des salons de Milan, Dubaï et Paris, récoltes de rose et d’oud pur, et transfert en un clic des notes tendance vers votre laboratoire !', es: 'Tu espacio dinámico: resoluciones IFRA, resultados de las ferias de Milán, Dubái y París, cosechas de rosa y oud puro, y traspaso de notas tendencia a tu laboratorio con un clic.', it: 'Il tuo spazio dinamico: deliberazioni IFRA, risultati delle fiere di Milano, Dubai e Parigi, raccolti di rosa e oud puro e trasferimento in un clic delle note di tendenza nel tuo laboratorio!', de: 'Ihr dynamischer Raum: IFRA-Entscheidungen, Ergebnisse aus Mailand, Dubai und Paris, Rosen- und Oud-Ernten sowie Ein-Klick-Transfer angesagter Noten in Ihr Labor!', ru: 'Ваше динамичное пространство: решения IFRA, итоги выставок Милана, Дубая и Парижа, сезоны сбора розы и уда, а также перенос трендовых нот в лабораторию одним кликом!', zh: '您的动态资讯空间：IFRA 决议、米兰/迪拜/巴黎展会成果、玫瑰与纯乌木采收季，并支持一键将热门香材送入调配实验室！', tr: 'Dinamik alanınız: IFRA kararları, Milano-Dubai-Paris fuar sonuçları, gül ve saf oud hasat mevsimleri ve trend notaları tek tıkla laboratuvarınıza aktarma!', fa: 'فضای پویای شما: مصوبات IFRA، نتایج نمایشگاه‌های میلان، دبی و پاریس، فصل برداشت گل محمدی و عود خالص، و انتقال یک‌کلیکی نت‌های ترند به آزمایشگاه شما!' },
  observatory_badge: { ar: 'مرصد أخبار العطور العالمية', en: 'World Fragrance News Observatory', fr: 'Observatoire des actualités parfum', es: 'Observatorio de noticias del perfume', it: 'Osservatorio delle notizie sul profumo', de: 'Duftnews-Observatorium', ru: 'Обсерватория новостей парфюмерии', zh: '全球香水资讯观察站', tr: 'Parfüm haber gözlemevi', fa: 'رصدخانه اخبار عطر جهان' },
  updates_sub: { ar: 'تحديثات حية ومواكبة دور النيش ومواسم الحصاد الدولية', en: 'Live updates tracking niche houses and international harvest seasons', fr: 'Mises à jour en direct des maisons de niche et des récoltes', es: 'Actualizaciones en vivo de las casas de nicho y cosechas', it: 'Aggiornamenti live sulle maison di nicchia e i raccolti', de: 'Live-Updates zu Nischenhäusern und Erntezeiten', ru: 'Живые обновления: нишевые дома и сезоны сбора', zh: '实时追踪小众品牌与国际采收季', tr: 'Niş evleri ve hasat mevsimleriyle canlı güncellemeler', fa: 'به‌روزرسانی زنده خانه‌های نیچ و فصل‌های برداشت جهانی' },
  news_header: { ar: 'آخر أخبار وتحولات عالم العطور وصيحات النيش الدولية', en: 'Latest fragrance world news & international niche trends', fr: 'Dernières actualités et tendances de niche', es: 'Últimas noticias y tendencias de nicho', it: 'Ultime notizie e tendenze di nicchia', de: 'Aktuelle Duftnews & Nischentrends', ru: 'Последние новости и нишевые тренды', zh: '香水界最新动态与国际小众潮流', tr: 'Son parfüm haberleri ve niş trendleri', fa: 'آخرین اخبار دنیای عطر و ترندهای نیچ جهانی' },
  top_report_lbl: { ar: 'التقرير الأبرز هذا الأسبوع', en: 'Top report this week', fr: 'Rapport phare de la semaine', es: 'Informe destacado de la semana', it: 'Report della settimana', de: 'Top-Report der Woche', ru: 'Главный обзор недели', zh: '本周焦点报道', tr: 'Bu haftanın öne çıkan raporu', fa: 'گزارش برجسته این هفته' },
  trending_notes_lbl: { ar: 'النوتات المتصدرة في التقرير:', en: 'Trending notes in this report:', fr: 'Notes en vedette :', es: 'Notas destacadas del informe:', it: 'Note in evidenza:', de: 'Trendnoten dieses Reports:', ru: 'Трендовые ноты обзора:', zh: '报道中的热门香材：', tr: 'Raportte öne çıkan notalar:', fa: 'نت‌های برتر این گزارش:' },
  sent_ok: { ar: 'تم النقل للحاسبة!', en: 'Sent to calculator!', fr: 'Envoyé au calculateur !', es: '¡Enviado a la calculadora!', it: 'Inviato al calcolatore!', de: 'Zum Rechner gesendet!', ru: 'Отправлено в калькулятор!', zh: '已发送到计算器！', tr: 'Hesaplayıcıya gönderildi!', fa: 'به ماشین‌حساب ارسال شد!' },
  apply_notes: { ar: 'تطبيق نوتات التقرير في المعمل', en: 'Apply report notes in the lab', fr: 'Appliquer les notes au laboratoire', es: 'Aplicar notas del informe en el laboratorio', it: 'Applica le note nel laboratorio', de: 'Report-Noten im Labor anwenden', ru: 'Применить ноты обзора в лаборатории', zh: '在实验室应用报道香材', tr: 'Rapor notalarını laboratuvarda uygula', fa: 'اعمال نت‌های گزارش در آزمایشگاه' },
  copy_tooltip: { ar: 'نسخ ملخص التقرير', en: 'Copy report summary', fr: 'Copier le résumé', es: 'Copiar resumen del informe', it: 'Copia riepilogo', de: 'Report-Zusammenfassung kopieren', ru: 'Скопировать сводку обзора', zh: '复制报道摘要', tr: 'Rapor özetini kopyala', fa: 'کپی خلاصه گزارش' },
  fav_tooltip: { ar: 'حفظ في المفضلة', en: 'Save to favorites', fr: 'Ajouter aux favoris', es: 'Guardar en favoritos', it: 'Salva nei preferiti', de: 'Zu Favoriten hinzufügen', ru: 'Сохранить в избранное', zh: '收藏', tr: 'Favorilere kaydet', fa: 'ذخیره در علاقه‌مندی‌ها' },
} satisfies Record<string, LText>;

interface WorldPerfumeNewsProps {
  currentLang?: SupportedLanguage;
  onApplyNewsNotesToCalculator: (formula: ExtractedAIPerfume) => void;
  onAddNoteToPyramid: (note: PyramidNote) => void;
}

export const WorldPerfumeNews: React.FC<WorldPerfumeNewsProps> = ({
  currentLang = 'ar',
  onApplyNewsNotesToCalculator,
  onAddNoteToPyramid,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<PerfumeNewsItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [transferSuccessId, setTransferSuccessId] = useState<string | null>(null);

  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);

  const openArticleReader = (article: PerfumeNewsItem) => {
    setSelectedArticle(article);
    try {
      window.history.pushState(
        { articleModal: true, articleId: article.id },
        '',
        window.location.hash || '#perfume_news'
      );
    } catch {}
  };

  const closeArticleReader = () => {
    setSelectedArticle(null);
    if (window.history.state?.articleModal) {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (!event.state?.articleModal) {
        setSelectedArticle(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const categories = [
    { id: 'all', label: L('cat_all') },
    { id: 'trends', label: L('cat_trends') },
    { id: 'exhibitions', label: L('cat_exhibitions') },
    { id: 'harvests', label: L('cat_harvests') },
    { id: 'ifra', label: L('cat_ifra') },
    { id: 'niche', label: L('cat_niche') },
  ];

  // Filtering
  const filteredNews = PERFUME_NEWS_DATA.filter((item) => {
    const loc = getLocalizedNewsArticle(item, currentLang);
    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      loc.titleAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summaryAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.tags ? item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) : false);
    return matchesCategory && matchesSearch;
  });

  const handleCopySummary = (item: PerfumeNewsItem) => {
    const loc = getLocalizedNewsArticle(item, currentLang);
    const text = fmt(L('clip_tpl'), { brand: L('clip_brand'), title: loc.titleAr, date: item.date || '', source: item.source || '', summary: item.summaryAr, verdict: item.expertVerdict || '' });
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleToggleBookmark = (id: string) => {
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleTransferToWorkbench = (item: PerfumeNewsItem) => {
    if (!item.keyNotes || item.keyNotes.length === 0) return;
    const loc = getLocalizedNewsArticle(item, currentLang);

    const transformedNotes: PyramidNote[] = (item.keyNotes || []).map((k: any, index: number) => ({
      id: `news-note-${item.id}-${index}`,
      nameAr: k.nameAr || 'نوتة عطرية',
      nameEn: k.nameEn || k.nameAr || 'Aromatic Note',
      category: (k.type === 'top' || k.type === 'heart' || k.type === 'base' ? k.type : 'heart') as 'top' | 'heart' | 'base',
      percentageOfOil: k.percentageHint || 25,
      description: fmt(L('inspired_by_tpl'), { t: loc.titleAr }),
    }));

    const formula: ExtractedAIPerfume = {
      title: `${fmt(L('accord_title_tpl'), { t: loc.titleAr.slice(0, 32) })}...`,
      author: L('accord_author'),
      bottleVolumeMl: 50,
      concentrationPercent: 20,
      concentrationType: 'edp',
      alcoholPercentage: 96,
      waterPercent: 0,
      fixativePercent: 1.5,
      macerationDays: 35,
      summary: fmt(L('accord_summary_tpl'), { t: loc.titleAr, v: item.expertVerdict || '' }),
      pyramidNotes: transformedNotes,
    };

    onApplyNewsNotesToCalculator(formula);
    setTransferSuccessId(item.id);
    setTimeout(() => setTransferSuccessId(null), 3000);
  };

  const rawFeatured = PERFUME_NEWS_DATA.find((n) => n.isHot) || PERFUME_NEWS_DATA[0];
  const featuredHotNews = getLocalizedNewsArticle(rawFeatured, currentLang);

  return (
    <div className="space-y-10">
      
      {/* Top Header with High Graphics luxury aesthetic */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-10 border border-amber-900/40 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-700/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>{L('observatory_badge')}</span>
            </span>
            <span className="text-stone-400 text-xs flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{L('updates_sub')}</span>
            </span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold font-serif-luxury tracking-tight text-white leading-tight">
            {L('news_header')}
          </h2>

          <p className="text-stone-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
            {L('news_sub')}
          </p>

          {/* Quick Breaking Ticker */}
          <div className="pt-2 flex items-center gap-3 bg-stone-900/80 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-stone-800 text-xs text-stone-300">
            <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold text-[10px] uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Flame className="w-3 h-3" />
              عاجل
            </span>
            <div className="truncate flex-1 font-medium">
              «إيسنس ميلانو» يؤكد صعود عطور الشاي المدخن والأمبروكسان المعدني، وحصاد استثنائي لورد غراس والطائف لعام 2026.
            </div>
          </div>
        </div>
      </div>

      {/* Featured Spotlight Card */}
      {featuredHotNews && (
        <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-lg hover:shadow-xl transition-all">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-5 relative aspect-[16/10] lg:aspect-auto">
              <img
                src={featuredHotNews.imageUrl}
                alt={featuredHotNews.titleAr}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-stone-900/80 backdrop-blur-md text-amber-400 text-xs font-semibold flex items-center gap-1.5 shadow-md">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>{L('top_report_lbl')}</span>
              </div>
            </div>

            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-stone-500">
                  <span className="font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                    {featuredHotNews.categoryLabelAr}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{featuredHotNews.date}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{featuredHotNews.readTime}</span>
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold font-serif-luxury text-stone-950 leading-snug">
                  {featuredHotNews.titleAr}
                </h3>

                <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
                  {featuredHotNews.summaryAr}
                </p>

                {/* Key notes preview */}
                {featuredHotNews.keyNotes && (
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-stone-700 block mb-2">
                      {L('trending_notes_lbl')}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {featuredHotNews.keyNotes.map((note, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 text-xs font-medium border border-stone-200 flex items-center gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                          <span>{note.nameAr}</span>
                          <span className="text-stone-400 text-[10px]">({note.percentageHint}%)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTransferToWorkbench(featuredHotNews)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    {transferSuccessId === featuredHotNews.id ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>{L('sent_ok')}</span>
                      </>
                    ) : (
                      <>
                        <FlaskConical className="w-4 h-4 text-amber-300" />
                        <span>{L('apply_notes')}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => openArticleReader(featuredHotNews)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-all cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-stone-600" />
                    <span>{L('read_full')}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopySummary(featuredHotNews)}
                    className="p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                    title={L('copy_tooltip')}
                  >
                    {copiedId === featuredHotNews.id ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleBookmark(featuredHotNews.id)}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      bookmarkedIds.includes(featuredHotNews.id)
                        ? 'text-amber-700 bg-amber-50'
                        : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
                    }`}
                    title={L('fav_tooltip')}
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className={`w-4 h-4 absolute ${rtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-stone-400`} />
          <input
            type="text"
            placeholder={L('search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full ${rtl ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700 shadow-xs`}
          />
        </div>
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNews.map((item) => {
          const loc = getLocalizedNewsArticle(item, currentLang);
          const isBookmarked = bookmarkedIds.includes(item.id);
          const isCopied = copiedId === item.id;
          const isTransferred = transferSuccessId === item.id;

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Article Image */}
                <div className="relative aspect-[16/10] overflow-hidden bg-stone-100">
                  <img
                    src={item.imageUrl}
                    alt={loc.titleAr}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className={`absolute top-2.5 ${rtl ? 'right-2.5' : 'left-2.5'} px-2.5 py-1 rounded-md bg-stone-900/80 backdrop-blur-xs text-amber-300 text-[10px] font-semibold`}>
                    {loc.categoryLabelAr}
                  </div>
                  <div className={`absolute bottom-2.5 ${rtl ? 'left-2.5' : 'right-2.5'} px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white text-[10px] flex items-center gap-1 font-mono-numbers`}>
                    <Clock className="w-3 h-3 text-stone-300" />
                    <span>{item.readTime}</span>
                  </div>
                </div>

                {/* Article Content */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      <span>{item.date}</span>
                    </span>
                    <span className="truncate max-w-[140px] text-stone-400">
                      {item.source}
                    </span>
                  </div>

                  <h4
                    onClick={() => openArticleReader(item)}
                    className="text-base font-bold font-serif-luxury text-stone-950 group-hover:text-amber-900 transition-colors line-clamp-2 cursor-pointer leading-snug"
                  >
                    {loc.titleAr}
                  </h4>

                  <p className="text-stone-600 text-xs line-clamp-3 leading-relaxed">
                    {item.summaryAr}
                  </p>

                  {/* Notes Tag list */}
                  {item.keyNotes && item.keyNotes.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {item.keyNotes.slice(0, 3).map((note, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-stone-50 text-stone-700 text-[10px] font-medium border border-stone-200"
                        >
                          {pickArEn(currentLang, note.nameAr, note.nameEn)}
                        </span>
                      ))}
                      {item.keyNotes.length > 3 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-stone-400">
                          +{item.keyNotes.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="p-4 bg-stone-50/80 border-t border-stone-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleTransferToWorkbench(item)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-[11px] font-semibold transition-all shadow-xs cursor-pointer"
                >
                  {isTransferred ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{L('transferred')}</span>
                    </>
                  ) : (
                    <>
                      <FlaskConical className="w-3.5 h-3.5 text-amber-300" />
                      <span>{L('apply_lab')}</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openArticleReader(item)}
                    className="p-1.5 text-stone-600 hover:text-stone-950 hover:bg-stone-200 rounded-lg text-xs font-medium cursor-pointer"
                    title={L('read_full')}
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCopySummary(item)}
                    className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded-lg cursor-pointer"
                    title={L('copy_summary')}
                  >
                    {isCopied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleBookmark(item.id)}
                    className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                      isBookmarked
                        ? 'text-amber-700 bg-amber-100'
                        : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200'
                    }`}
                    title={L('bookmark')}
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Market Pulse & Trends Summary */}
      <div className="mt-12 rounded-3xl bg-stone-900 text-white p-6 sm:p-8 border border-stone-800 space-y-6">
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold font-serif-luxury text-white">
              {L('pulse_title')}
            </h3>
          </div>
          <span className="text-xs text-stone-400 hidden sm:inline">
            {L('pulse_desc')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60 space-y-2">
            <div className="text-amber-400 font-bold text-sm flex items-center gap-1.5">
              <span>{L('growing_notes')}</span>
            </div>
            <p className="text-stone-300 leading-relaxed">
              {L('growing_notes_desc')}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60 space-y-2">
            <div className="text-amber-400 font-bold text-sm flex items-center gap-1.5">
              <span>{L('ifra_title')}</span>
            </div>
            <p className="text-stone-300 leading-relaxed">
              {L('ifra_desc')}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60 space-y-2">
            <div className="text-amber-400 font-bold text-sm flex items-center gap-1.5">
              <span>{L('verdict_tip')}</span>
            </div>
            <p className="text-stone-300 leading-relaxed">
              {L('verdict_tip_desc')}
            </p>
          </div>
        </div>
      </div>

      {/* Full Article Reader Modal */}
      {selectedArticle && (() => {
        const modalLoc = getLocalizedNewsArticle(selectedArticle, currentLang);
        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
              {/* Header Image */}
              <div className="relative aspect-[16/9] w-full">
                <img
                  src={selectedArticle.imageUrl}
                  alt={modalLoc.titleAr}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={closeArticleReader}
                  className={`absolute top-4 ${rtl ? 'left-4' : 'right-4'} p-2 rounded-full bg-black/60 hover:bg-black text-white transition-colors cursor-pointer`}
                >
                  <X className="w-5 h-5" />
                </button>
                <div className={`absolute bottom-4 ${rtl ? 'right-4' : 'left-4'} px-3 py-1 rounded-lg bg-stone-900/90 text-amber-300 text-xs font-semibold`}>
                  {modalLoc.categoryLabelAr}
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 sm:p-8 space-y-5 text-stone-800">
                <div className="flex items-center gap-3 text-xs text-stone-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{selectedArticle.date}</span>
                  </span>
                  <span>·</span>
                  <span>{L('source_lbl')} {selectedArticle.source}</span>
                  <span>·</span>
                  <span>{L('read_time_lbl')} {selectedArticle.readTime}</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold font-serif-luxury text-stone-950 leading-snug">
                  {modalLoc.titleAr}
                </h3>

                <div className="prose text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                  {selectedArticle.contentAr}
                </div>

                {/* Expert Verdict Box */}
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-700" />
                    <span>{L('verdict_section')}</span>
                  </span>
                  <p className="text-xs text-amber-950 leading-relaxed italic">
                    {selectedArticle.expertVerdict}
                  </p>
                  <div className="text-[11px] text-amber-800 pt-1 font-medium">
                    📊 {L('market_impact_lbl')} {selectedArticle.marketImpact}
                  </div>
                </div>

                {/* Mentioned Key Notes breakdown with button */}
                {selectedArticle.keyNotes && selectedArticle.keyNotes.length > 0 && (
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">
                        {L('rec_notes')}
                      </span>
                      <span className="text-[10px] text-stone-500">
                        {L('export_ready')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selectedArticle.keyNotes.map((note, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-stone-900">{pickArEn(currentLang, note.nameAr, note.nameEn)}</div>
                            <div className="text-[10px] text-stone-400 font-mono">{note.nameEn}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono-numbers text-xs font-bold">
                            {note.percentageHint}%
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        handleTransferToWorkbench(selectedArticle);
                        closeArticleReader();
                      }}
                      className="w-full py-3 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <FlaskConical className="w-4 h-4 text-amber-300" />
                      <span>{L('apply_full_accord')}</span>
                    </button>
                  </div>
                )}

                {/* Bottom modal close */}
                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={() => handleCopySummary(selectedArticle)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-medium text-stone-700 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{L('copy_report_summary')}</span>
                  </button>

                  <button
                    onClick={closeArticleReader}
                    className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    {L('close')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
