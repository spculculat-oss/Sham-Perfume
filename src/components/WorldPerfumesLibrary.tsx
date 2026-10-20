import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Printer,
  Layers,
  Clock,
  Flame,
  Award,
  Compass,
  ShieldAlert,
} from 'lucide-react';
import { WORLD_PERFUMES, WorldPerfumeRecipe } from '../data/worldPerfumes';
import { SupportedLanguage } from '../types/i18n';
import { getLocalizedPerfume, getCommonLabel, isRTL } from '../لغات/localizedContent';
import { LText, makeT, fmt, pickArEn } from '../لغات/localize';


const S = {
  cat_all_tpl: {
    ar: 'جميع العطور العالمية ({n})',
    en: 'All Iconic Perfumes ({n})',
    fr: 'Tous les parfums emblématiques ({n})',
    es: 'Todos los perfumes icónicos ({n})',
    it: 'Tutti i profumi iconici ({n})',
    de: 'Alle ikonischen Düfte ({n})',
    ru: 'Все легендарные ароматы ({n})',
    zh: '全部经典香水（{n}）',
    tr: 'Tüm ikonik parfümler ({n})',
    fa: 'همه عطرهای مشهور جهان ({n})',
  },
  cat_oriental: {
    ar: 'شرقي وعنبر (Oriental)',
    en: 'Oriental & Amber',
    fr: 'Oriental et ambre',
    es: 'Oriental y ámbar',
    it: 'Orientale e ambrato',
    de: 'Orientalisch & Amber',
    ru: 'Восточные и амбровые',
    zh: '东方与琥珀',
    tr: 'Oryantal ve amber',
    fa: 'شرقی و عنبری',
  },
  cat_woody: {
    ar: 'خشبي وعود (Woody)',
    en: 'Woody & Oud',
    fr: 'Boisé et oud',
    es: 'Maderoso y oud',
    it: 'Legnoso e oud',
    de: 'Holzig & Oud',
    ru: 'Древесные и удовые',
    zh: '木质与乌木',
    tr: 'Odunsu ve oud',
    fa: 'چوبی و عود',
  },
  cat_citrus: {
    ar: 'حمضيات وأروماتيك (Citrus)',
    en: 'Citrus & Aromatic',
    fr: 'Agrumes et aromatiques',
    es: 'Cítrico y aromático',
    it: 'Agrumato e aromatico',
    de: 'Zitrus & Aromatisch',
    ru: 'Цитрусовые и ароматические',
    zh: '柑橘与芳香',
    tr: 'Narenciye ve aromatik',
    fa: 'مرکبات و آروماتیک',
  },
  cat_gourmand: {
    ar: 'جورماند وتوابل (Gourmand)',
    en: 'Gourmand & Spices',
    fr: 'Gourmand et épicé',
    es: 'Gourmand y especias',
    it: 'Gourmand e spezie',
    de: 'Gourmand & Gewürze',
    ru: 'Гурманские и пряные',
    zh: '美食调与香料',
    tr: 'Gurme ve baharat',
    fa: 'گورمان و ادویه',
  },
  cat_floral: {
    ar: 'زهري وألدهيدي (Floral)',
    en: 'Floral & Aldehydic',
    fr: 'Floral et aldéhydé',
    es: 'Floral y aldehídico',
    it: 'Floreale e aldeidico',
    de: 'Floral & Aldehydisch',
    ru: 'Цветочные и альдегидные',
    zh: '花香与醛香',
    tr: 'Çiçeksi ve aldehitik',
    fa: 'گلی و آلدهیدی',
  },
  cat_leather: {
    ar: 'جلود وتبغ (Leather)',
    en: 'Leather & Tobacco',
    fr: 'Cuir et tabac',
    es: 'Cuero y tabaco',
    it: 'Pelle e tabacco',
    de: 'Leder & Tabak',
    ru: 'Кожаные и табачные',
    zh: '皮革与烟草',
    tr: 'Deri ve tütün',
    fa: 'چرمی و تنباکو',
  },
  cat_aquatic: {
    ar: 'بحري ومائي (Aquatic)',
    en: 'Marine & Aquatic',
    fr: 'Marin et aquatique',
    es: 'Marino y acuático',
    it: 'Marino e acquatico',
    de: 'Maritim & Aquatisch',
    ru: 'Морские и водные',
    zh: '海洋与水生',
    tr: 'Deniz ve su',
    fa: 'دریایی و آبی',
  },
  study_model_prefix: {
    ar: 'نموذج أكورد تعليمي مستوحى — ',
    en: 'Inspired educational accord study — ',
    fr: 'Étude pédagogique d’accord inspirée — ',
    es: 'Estudio pedagógico de acorde inspirado — ',
    it: 'Studio didattico di accordo ispirato — ',
    de: 'Inspirierendes pädagogisches Akkordmodell — ',
    ru: 'Учебный аккорд, вдохновлённый ароматом — ',
    zh: '灵感教学型香调示例 — ',
    tr: 'Eğitim amaçlı ilham akoru — ',
    fa: 'نمونه آموزشی آکورد الهام‌گرفته — ',
  },
  page_title: {
    ar: 'مكتبة نماذج العطور العالمية المستوحاة',
    en: 'Inspired World Perfume Accord Studies',
    fr: 'Bibliothèque des parfums emblématiques du monde',
    es: 'Biblioteca de perfumes icónicos del mundo',
    it: 'Libreria dei profumi iconici del mondo',
    de: 'Bibliothek der ikonischen Düfte der Welt',
    ru: 'Библиотека легендарных ароматов мира',
    zh: '世界经典香水配方库',
    tr: 'Dünya ikonik parfüm kütüphanesi',
    fa: 'کتابخانه عطرهای مشهور جهان',
  },
  page_desc: {
    ar: 'أمثلة تعليمية لأكوردات مستوحاة من نوتات عطور معروفة. يمكن تحميلها كنقطة انطلاق للتجربة؛ النسب توضيحية وليست تركيبات أصلية مؤكدة أو تحليلاً مخبرياً.',
    en: 'Educational accord studies inspired by published perfume notes. Load one as a starting point for experimentation; proportions are illustrative, not verified original formulas or laboratory analyses.',
    fr: 'Études pédagogiques d’accords inspirées des notes publiées. Les proportions sont illustratives, pas des formules originales vérifiées ni des analyses de laboratoire.',
    es: 'Estudios educativos de acordes inspirados en notas publicadas. Las proporciones son ilustrativas, no fórmulas originales verificadas ni análisis de laboratorio.',
    it: 'Studi didattici di accordi ispirati a note pubblicate. Le proporzioni sono illustrative, non formule originali verificate né analisi di laboratorio.',
    de: 'Lehrbeispiele für Akkorde, inspiriert von veröffentlichten Duftnoten. Die Anteile sind veranschaulichend, keine bestätigten Originalformeln oder Laboranalysen.',
    ru: 'Учебные аккорды, вдохновлённые опубликованными нотами. Пропорции иллюстративны и не являются подтверждёнными оригинальными формулами или лабораторным анализом.',
    zh: '根据公开香调制作的教学型灵感香调示例。比例仅作说明，不是经验证的原始配方或实验室分析。',
    tr: 'Yayımlanmış nota açıklamalarından esinlenen eğitsel akor çalışmaları. Oranlar açıklayıcıdır; doğrulanmış özgün formül veya laboratuvar analizi değildir.',
    fa: 'نمونه‌های آموزشی آکورد با الهام از نت‌های منتشرشده. نسبت‌ها صرفاً illustrative هستند و فرمول اصلی تأییدشده یا تحلیل آزمایشگاهی نیستند.',
  },
  source_note: {
    ar: 'تنبيه: هذه نماذج تعليمية مستوحاة من أوصاف النوتات المنشورة. لا تمثل تركيبات الشركات الأصلية ولا تحليلاً جزيئياً أو اختبار GC‑MS؛ راجع بيانات المورد والسلامة قبل الاستخدام.',
    en: 'Source note: These are educational studies inspired by published note descriptions—not manufacturers’ original formulas, molecular analyses, or GC‑MS results. Check supplier identity and safety data before use.',
    fr: 'Avis : études pédagogiques inspirées de notes publiées — ni formules originales des fabricants, ni analyses moléculaires ou GC‑MS. Vérifiez l’identité du fournisseur et les données de sécurité avant usage.',
    es: 'Aviso: estudios educativos inspirados en notas publicadas; no son fórmulas originales de fabricantes ni análisis moleculares o GC‑MS. Verifique el proveedor y los datos de seguridad antes de usar.',
    it: 'Nota: studi didattici ispirati a note pubblicate, non formule originali dei produttori né analisi molecolari o GC‑MS. Verifica il fornitore e i dati di sicurezza prima dell’uso.',
    de: 'Hinweis: Lernbeispiele, inspiriert von veröffentlichten Duftnoten – keine Originalformeln der Hersteller und keine Molekül- oder GC‑MS-Analysen. Prüfen Sie vor der Verwendung Lieferant und Sicherheitsdaten.',
    ru: 'Примечание: учебные примеры, вдохновлённые опубликованными нотами, а не оригинальные формулы производителей и не молекулярный или GC‑MS анализ. Перед использованием проверьте поставщика и паспорт безопасности.',
    zh: '说明：这些教学示例灵感来自公开香调描述，并非制造商原始配方、分子分析或 GC‑MS 结果。使用前请核实供应商信息和安全数据。',
    tr: 'Not: Yayımlanmış nota açıklamalarından esinlenen eğitim örnekleridir; üreticilerin özgün formülleri veya moleküler/GC‑MS analizleri değildir. Kullanımdan önce tedarikçiyi ve güvenlik verilerini doğrulayın.',
    fa: 'توجه: این نمونه‌های آموزشی از توصیف نت‌های منتشرشده الهام گرفته‌اند؛ فرمول اصلی سازندگان یا تحلیل مولکولی/GC‑MS نیستند. پیش از استفاده، تأمین‌کننده و داده‌های ایمنی را بررسی کنید.',
  },
  search_placeholder: {
    ar: 'ابحث بالاسم (مثال: بكرات روج، أفينتوس، توم فورد، زعفران...)',
    en: 'Search iconic perfumes (e.g., Baccarat Rouge, Aventus, Tom Ford, Saffron...)',
    fr: 'Rechercher un parfum (ex. Baccarat Rouge, Aventus, Tom Ford…)',
    es: 'Buscar perfumes icónicos (ej. Baccarat Rouge, Aventus, Tom Ford…)',
    it: 'Cerca profumi iconici (es. Baccarat Rouge, Aventus, Tom Ford…)',
    de: 'Ikonische Düfte suchen (z. B. Baccarat Rouge, Aventus, Tom Ford…)',
    ru: 'Поиск ароматов (напр. Baccarat Rouge, Aventus, Tom Ford…)',
    zh: '搜索经典香水（如：Baccarat Rouge、Aventus、Tom Ford…）',
    tr: 'İkonik parfüm ara (ör. Baccarat Rouge, Aventus, Tom Ford…)',
    fa: 'جستجوی عطر (مثال: بکرا روژ، اونتوس، تام فورد، زعفران…)',
  },
  traditional_reference: {
    ar: 'تراثي',
    en: 'Traditional reference',
    fr: 'Référence traditionnelle',
    es: 'Referencia tradicional',
    it: 'Riferimento tradizionale',
    de: 'Traditionelle Referenz',
    ru: 'Традиционный образец',
    zh: '传统参考',
    tr: 'Geleneksel referans',
    fa: 'مرجع سنتی',
  },
  reference_target: {
    ar: 'تركيز النموذج:',
    en: 'Model target:',
    fr: 'Cible du modèle :',
    es: 'Objetivo del modelo:',
    it: 'Obiettivo del modello:',
    de: 'Modellziel:',
    ru: 'Цель модели:',
    zh: '示例目标：',
    tr: 'Model hedefi:',
    fa: 'غلظت هدف مدل:',
  },
  longevity_lbl: {
    ar: 'مرجع وصفي للثبات (غير مختبر):',
    en: 'Descriptive longevity reference (not tested):',
    fr: 'Référence descriptive de tenue (non testée) :',
    es: 'Referencia descriptiva de duración (no probada):',
    it: 'Riferimento descrittivo di persistenza (non testato):',
    de: 'Beschreibender Haltbarkeitswert (nicht getestet):',
    ru: 'Описательный ориентир стойкости (не проверено):',
    zh: '留香描述参考（未经测试）：',
    tr: 'Açıklayıcı kalıcılık referansı (test edilmedi):',
    fa: 'مرجع توصیفی ماندگاری (آزمایش‌نشده):',
  },
  sillage_lbl: {
    ar: 'مرجع وصفي للفوحان:',
    en: 'Descriptive sillage reference:',
    fr: 'Référence descriptive du sillage :',
    es: 'Referencia descriptiva de estela:',
    it: 'Riferimento descrittivo della scia:',
    de: 'Beschreibender Sillage-Richtwert:',
    ru: 'Описательный ориентир шлейфа:',
    zh: '扩散描述参考：',
    tr: 'Açıklayıcı yayılım referansı:',
    fa: 'مرجع توصیفی پخش بو:',
  },
  maceration_lbl: {
    ar: 'مدة التعتيق المقترحة للنموذج:',
    en: 'Suggested model maceration:',
    fr: 'Macération suggérée pour le modèle :',
    es: 'Maceración sugerida para el modelo:',
    it: 'Macerazione suggerita per il modello:',
    de: 'Empfohlene Reifezeit des Modells:',
    ru: 'Предлагаемая выдержка модели:',
    zh: '示例建议熟成期：',
    tr: 'Model için önerilen dinlendirme:',
    fa: 'مدت پیشنهادی برای جاافتادن مدل:',
  },
  days_word: {
    ar: 'يوماً',
    en: 'Days',
    fr: 'jours',
    es: 'días',
    it: 'giorni',
    de: 'Tage',
    ru: 'дней',
    zh: '天',
    tr: 'gün',
    fa: 'روز',
  },
  breakdown_lbl: {
    ar: 'التوزيع التوضيحي لنموذج الأكورد (100% من المركز):',
    en: 'Illustrative accord breakdown (100% of concentrate):',
    fr: 'Répartition illustrative de l’accord (100 % du concentré) :',
    es: 'Distribución ilustrativa del acorde (100 % del concentrado):',
    it: 'Ripartizione illustrativa dell’accordo (100% del concentrato):',
    de: 'Veranschaulichende Akkordverteilung (100 % des Konzentrats):',
    ru: 'Иллюстративное распределение аккорда (100% концентрата):',
    zh: '灵感香调示例的比例（占香精浓缩液 100%）：',
    tr: 'Akor örneğinin açıklayıcı dağılımı (konsantrenin %100’ü):',
    fa: 'توزیع نمونه‌ای آکورد (۱۰۰٪ از کنسانتره):',
  },
  notes_word: {
    ar: 'مكونات',
    en: 'Notes',
    fr: 'notes',
    es: 'notas',
    it: 'note',
    de: 'Noten',
    ru: 'нот',
    zh: '个香材',
    tr: 'nota',
    fa: 'ماده',
  },
  top_word: {
    ar: 'قمة',
    en: 'Top',
    fr: 'Tête',
    es: 'Salida',
    it: 'Testa',
    de: 'Kopf',
    ru: 'Верх',
    zh: '前调',
    tr: 'Üst',
    fa: 'ابتدایی',
  },
  heart_word: {
    ar: 'قلب',
    en: 'Heart',
    fr: 'Cœur',
    es: 'Corazón',
    it: 'Cuore',
    de: 'Herz',
    ru: 'Сердце',
    zh: '中调',
    tr: 'Kalp',
    fa: 'میانی',
  },
  base_word: {
    ar: 'قاعدة',
    en: 'Base',
    fr: 'Fond',
    es: 'Fondo',
    it: 'Fondo',
    de: 'Basis',
    ru: 'База',
    zh: '后调',
    tr: 'Dip',
    fa: 'پایه',
  },
  shahin_tip: {
    ar: 'نصيحة شاهين لتعديل النموذج المستوحى:',
    en: 'Shahin’s tip for adapting this inspired study:',
    fr: 'Conseil de Shahin pour adapter cette étude inspirée :',
    es: 'Consejo de Shahin para adaptar este estudio inspirado:',
    it: 'Consiglio di Shahin per adattare questo studio ispirato:',
    de: 'Shahins Tipp zur Anpassung dieses Inspirationsbeispiels:',
    ru: 'Совет Шахина по адаптации этого учебного примера:',
    zh: 'Shahin 大师对调整此灵感示例的建议：',
    tr: 'Usta Shahin’den bu ilham örneğini uyarlama önerisi:',
    fa: 'نکته استاد شاهین برای سازگارکردن این نمونه الهام‌گرفته:',
  },
  clip_tpl: {
    ar: `👑 نموذج أكورد تعليمي مستوحى: {name}
العطر المرجعي: {brand} ({year})
التصنيف: {cat} | تركيز النموذج: {conc}% ({conc_type})
الثبات والفوحان: {longevity} | {sillage}
مدة التعتيق المقترحة للنموذج: {mac} يوماً

🔺 توزيع توضيحي لأكورد المركز (100%):
{notes}

💡 نصيحة شاهين لتعديل النموذج:
{tips}

تنبيه: هذه نسب إلهامية وليست تركيبة أصلية مؤكدة أو تحليلاً مخبرياً/GC‑MS.`,
    en: `👑 Inspired educational accord: {name}
Reference perfume: {brand} ({year})
Category: {cat} | Model target concentration: {conc}% ({conc_type})
Longevity and sillage reference: {longevity} | {sillage}
Suggested model maceration: {mac} days

🔺 Illustrative accord breakdown (100%):
{notes}

💡 Shahin’s tip for adapting this study:
{tips}

Note: illustrative proportions only—not a verified original formula or laboratory/GC‑MS analysis.`,
    fr: `👑 Accord pédagogique inspiré : {name}
Parfum de référence : {brand} ({year})
Catégorie : {cat} | Concentration cible du modèle : {conc}% ({conc_type})
Tenue et sillage de référence : {longevity} | {sillage}
Macération suggérée pour le modèle : {mac} jours

🔺 Répartition illustrative de l’accord (100 %) :
{notes}

💡 Conseil de Shahin pour adapter l’étude :
{tips}

Note : proportions illustratives, pas une formule originale vérifiée ni une analyse de laboratoire/GC‑MS.`,
    es: `👑 Acorde educativo inspirado: {name}
Perfume de referencia: {brand} ({year})
Categoría: {cat} | Concentración objetivo del modelo: {conc}% ({conc_type})
Referencia de duración y estela: {longevity} | {sillage}
Maceración sugerida para el modelo: {mac} días

🔺 Distribución ilustrativa del acorde (100 %):
{notes}

💡 Consejo de Shahin para adaptar el estudio:
{tips}

Aviso: proporciones ilustrativas; no son una fórmula original verificada ni un análisis de laboratorio/GC‑MS.`,
    it: `👑 Accordo didattico ispirato: {name}
Profumo di riferimento: {brand} ({year})
Categoria: {cat} | Concentrazione obiettivo del modello: {conc}% ({conc_type})
Riferimento di persistenza e scia: {longevity} | {sillage}
Macerazione suggerita per il modello: {mac} giorni

🔺 Ripartizione illustrativa dell’accordo (100%):
{notes}

💡 Consiglio di Shahin per adattare lo studio:
{tips}

Nota: proporzioni illustrative, non una formula originale verificata né un’analisi di laboratorio/GC‑MS.`,
    de: `👑 Inspirierendes Lern-Akkordmodell: {name}
Referenzduft: {brand} ({year})
Kategorie: {cat} | Zielkonzentration des Modells: {conc}% ({conc_type})
Richtwert für Haltbarkeit und Sillage: {longevity} | {sillage}
Empfohlene Reifezeit des Modells: {mac} Tage

🔺 Veranschaulichende Akkordverteilung (100 %):
{notes}

💡 Shahins Tipp zur Anpassung dieser Studie:
{tips}

Hinweis: illustrative Anteile, keine bestätigte Originalformel oder Labor-/GC‑MS-Analyse.`,
    ru: `👑 Учебный аккорд, вдохновлённый ароматом: {name}
Аромат-ориентир: {brand} ({year})
Категория: {cat} | Целевая концентрация модели: {conc}% ({conc_type})
Справочные стойкость и шлейф: {longevity} | {sillage}
Предлагаемая выдержка модели: {mac} дней

🔺 Иллюстративное распределение аккорда (100%):
{notes}

💡 Совет Шахина по адаптации примера:
{tips}

Примечание: пропорции иллюстративны; это не подтверждённая оригинальная формула и не лабораторный/GC‑MS анализ.`,
    zh: `👑 灵感教学型香调示例：{name}
参考香水：{brand}（{year}）
类别：{cat} | 示例目标浓度：{conc}%（{conc_type}）
留香与扩散参考：{longevity} | {sillage}
示例建议熟成：{mac} 天

🔺 香调示例比例（100%）：
{notes}

💡 Shahin 大师的调整建议：
{tips}

说明：比例仅供教学参考，不是经验证的原始配方或实验室/GC‑MS 分析。`,
    tr: `👑 Eğitim amaçlı ilham akoru: {name}
Referans parfüm: {brand} ({year})
Kategori: {cat} | Model hedef konsantrasyonu: {conc}% ({conc_type})
Kalıcılık ve iz referansı: {longevity} | {sillage}
Model için önerilen dinlendirme: {mac} gün

🔺 Açıklayıcı akor dağılımı (%100):
{notes}

💡 Usta Shahin’den bu çalışmayı uyarlama önerisi:
{tips}

Not: Oranlar örnek amaçlıdır; doğrulanmış özgün formül veya laboratuvar/GC‑MS analizi değildir.`,
    fa: `👑 نمونه آموزشی آکورد الهام‌گرفته: {name}
عطر مرجع: {brand} ({year})
دسته: {cat} | غلظت هدف مدل: {conc}% ({conc_type})
مرجع ماندگاری و پخش بو: {longevity} | {sillage}
تعریف پیشنهادی برای مدل: {mac} روز

🔺 توزیع نمونه‌ای آکورد (۱۰۰٪):
{notes}

💡 نکته شاهین برای سازگارکردن نمونه:
{tips}

توجه: نسبت‌ها صرفاً آموزشی‌اند؛ فرمول اصلی تأییدشده یا تحلیل آزمایشگاهی/GC‑MS نیستند.`,
  },
} satisfies Record<string, LText>;

export const worldPerfumeStudyTitle = (name: string, lang: SupportedLanguage = 'ar') =>
  `${makeT(lang, S)('study_model_prefix')}${name}`;

export const worldPerfumeStudyDisclaimer = (lang: SupportedLanguage = 'ar') =>
  makeT(lang, S)('source_note');

const referenceBrand = (recipe: WorldPerfumeRecipe, lang: SupportedLanguage) => {
  if (lang === 'ar' || !/[\u0600-\u06FF]/.test(recipe.brand)) return recipe.brand;
  return recipe.nameEn.split(/\s[-–—]\s/)[0]?.trim() || recipe.nameEn || recipe.brand;
};

const referenceYear = (recipe: WorldPerfumeRecipe, lang: SupportedLanguage) => {
  const L = makeT(lang, S);
  return /^\d{4}$/.test(recipe.year) ? recipe.year : L('traditional_reference');
};

export const formatWorldPerfumeReference = (recipe: WorldPerfumeRecipe, lang: SupportedLanguage = 'ar') => {
  const L = makeT(lang, S);
  const localized = getLocalizedPerfume(recipe, lang);
  const notes = localized.pyramidNotes
    .map((note) => {
      const category = note.category === 'top' ? L('top_word') : note.category === 'heart' ? L('heart_word') : L('base_word');
      return `• [${category}] ${pickArEn(lang, note.nameAr, note.nameEn || note.nameAr)}: ${note.percentageOfOil}%`;
    })
    .join('\n');

  return fmt(L('clip_tpl'), {
    name: localized.nameAr,
    brand: referenceBrand(localized, lang),
    year: referenceYear(localized, lang),
    cat: localized.categoryAr,
    conc: localized.targetConcentration,
    conc_type: localized.concentrationTypeAr,
    longevity: localized.longevity,
    sillage: localized.sillage,
    mac: localized.macerationDays,
    notes,
    tips: localized.compoundingTips,
  });
};

interface WorldPerfumesLibraryProps {
  currentLang?: SupportedLanguage;
  onLoadWorldFormula: (recipe: WorldPerfumeRecipe) => void;
  onPrintWorldFormula: (recipe: WorldPerfumeRecipe) => void;
}

export const WorldPerfumesLibrary: React.FC<WorldPerfumesLibraryProps> = ({
  currentLang = 'ar',
  onLoadWorldFormula,
  onPrintWorldFormula,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
  const ActionArrow = rtl ? ArrowLeft : ArrowRight;

  const categories = [
    { id: 'all', label: fmt(L('cat_all_tpl'), { n: WORLD_PERFUMES.length }) },
    { id: 'oriental', label: L('cat_oriental') },
    { id: 'woody', label: L('cat_woody') },
    { id: 'citrus', label: L('cat_citrus') },
    { id: 'gourmand', label: L('cat_gourmand') },
    { id: 'floral', label: L('cat_floral') },
    { id: 'leather', label: L('cat_leather') },
    { id: 'aquatic', label: L('cat_aquatic') },
  ];

  const filtered = WORLD_PERFUMES.filter((perfume) => {
    const localized = getLocalizedPerfume(perfume, currentLang);
    const matchesSearch =
      localized.nameAr.toLowerCase().includes(search.toLowerCase()) ||
      localized.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      localized.brand.toLowerCase().includes(search.toLowerCase()) ||
      localized.pyramidNotes.some((n) => n.nameAr.toLowerCase().includes(search.toLowerCase()) || n.nameEn.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' || perfume.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleCopyRecipe = (recipe: WorldPerfumeRecipe) => {
    navigator.clipboard.writeText(formatWorldPerfumeReference(recipe, currentLang));
    setCopiedId(recipe.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-stone-200/80 pb-5">
        <div className="flex items-center gap-2">
          <Award className="w-6 h-6 text-amber-700" />
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-serif-luxury">
            {L('page_title')}
          </h2>
        </div>
        <p className="text-stone-500 text-sm mt-1">
          {L('page_desc')}
        </p>
        <div role="note" className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-6 text-amber-950">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
          <span>{L('source_note')}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className={`w-4 h-4 text-stone-400 absolute ${rtl ? 'right-3' : 'left-3'} top-3 pointer-events-none`} />
          <input
            type="text"
            placeholder={L('search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${rtl ? 'pr-9 pl-4 text-right' : 'pl-9 pr-4 text-left'} py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700 shadow-2xs`}
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-stone-100 rounded-xl text-xs no-scrollbar">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                selectedCategory === c.id
                  ? 'bg-stone-900 text-white font-semibold shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Famous Perfumes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filtered.map((perfume) => {
          const localized = getLocalizedPerfume(perfume, currentLang);
          return (
            <div
              key={perfume.id}
              className="bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              {/* Card Body */}
              <div className="p-6 space-y-5">
                
                {/* Header Info */}
                <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-amber-800 font-semibold mb-1">
                      <span>{referenceBrand(localized, currentLang)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-numbers">{referenceYear(localized, currentLang)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{localized.categoryAr}</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-stone-950 font-serif-luxury">
                      {localized.nameAr}
                    </h3>
                    <div className="text-xs text-stone-400 font-mono-numbers mt-0.5">
                      {localized.nameEn}
                    </div>
                  </div>

                  <div className="text-left shrink-0 font-mono-numbers bg-stone-50 border border-stone-200/80 p-2.5 rounded-xl">
                    <div className="mb-1 text-[9px] font-sans text-stone-500">{L('reference_target')}</div>
                    <div className="text-sm font-bold text-amber-900">
                      {localized.targetConcentration}%
                    </div>
                    <div className="text-[10px] text-stone-500">{localized.concentrationType.toUpperCase()}</div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  {localized.descriptionAr}
                </p>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-stone-50 rounded-2xl text-xs">
                  <div>
                    <span className="text-[10px] text-stone-400 block">{L('longevity_lbl')}</span>
                    <span className="font-semibold text-stone-900">{localized.longevity}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">{L('sillage_lbl')}</span>
                    <span className="font-semibold text-stone-900">{localized.sillage}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">{L('maceration_lbl')}</span>
                    <span className="font-bold text-amber-900 font-mono-numbers">{localized.macerationDays} {L('days_word')}</span>
                  </div>
                </div>

                {/* Pyramid Breakdown Table */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-stone-900 flex items-center justify-between">
                    <span>{L('breakdown_lbl')}</span>
                    <span className="text-[11px] text-stone-500 font-mono-numbers">
                      {localized.pyramidNotes.length} {L('notes_word')}
                    </span>
                  </div>

                  <div className="border border-stone-200/80 rounded-xl overflow-hidden divide-y divide-stone-100 text-xs">
                    {localized.pyramidNotes.map((note) => (
                      <div
                        key={note.id}
                        className="px-3.5 py-2 flex items-center justify-between hover:bg-stone-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              note.category === 'top'
                                ? 'bg-amber-500'
                                : note.category === 'heart'
                                ? 'bg-stone-600'
                                : 'bg-stone-950'
                            }`}
                          />
                          <span className="font-medium text-stone-900 truncate">
                            {pickArEn(currentLang, note.nameAr, note.nameEn || note.nameAr)}
                          </span>
                          <span className="text-[10px] text-stone-400 hidden sm:inline">
                            ({note.category === 'top' ? L('top_word') : note.category === 'heart' ? L('heart_word') : L('base_word')})
                          </span>
                        </div>
                        <div className="font-mono-numbers font-bold text-amber-900 shrink-0 text-left">
                          {note.percentageOfOil}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Master Compounding Advice */}
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs space-y-1">
                  <span className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>{L('shahin_tip')}</span>
                  </span>
                  <p className="text-[11px] text-stone-700 leading-relaxed">
                    {localized.compoundingTips}
                  </p>
                </div>

              </div>

              {/* Bottom Actions */}
              <div className="p-4 bg-stone-50/80 border-t border-stone-200 flex items-center justify-between gap-3">
                <button
                  onClick={() => onLoadWorldFormula(localized)}
                  className="flex-1 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <span>{getCommonLabel('load_in_lab', currentLang)}</span>
                  <ActionArrow className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleCopyRecipe(localized)}
                  className="py-2.5 px-3 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title={getCommonLabel('copy', currentLang)}
                >
                  {copiedId === perfume.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">{getCommonLabel('copied', currentLang)}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{getCommonLabel('copy', currentLang)}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => onPrintWorldFormula(localized)}
                  className="p-2.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl transition-colors cursor-pointer"
                  title={getCommonLabel('print', currentLang)}
                >
                  <Printer className="w-4 h-4 text-amber-800" />
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
