import React, { useState } from 'react';
import {
  Scale,
  Droplets,
  Layers,
  Sparkles,
  Beaker,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ArrowDown,
  Info,
  Sliders,
} from 'lucide-react';
import { CalculationResult, FormulationState, PyramidNote } from '../types/perfume';
import { SupportedLanguage } from '../types/i18n';
import { formatNum } from '../utils/calculations';
import { isRTL } from '../لغات/localizedContent';
import { LText, loc, makeT, fmt, pickArEn } from '../لغات/localize';

interface VisualScaleSimulatorProps {
  formulation: FormulationState;
  result: CalculationResult;
  pyramidNotes?: PyramidNote[];
  currentLang?: SupportedLanguage;
}

const S = {
  badge: {
    ar: 'محاكي ميزان الصياغة البصري (0.01g Digital Balance)',
    en: 'Visual Laboratory Balance Simulator (0.01g)',
    fr: 'Simulateur visuel de balance de laboratoire (0.01g)',
    es: 'Simulador visual de balanza de laboratorio (0.01g)',
    it: 'Simulatore visivo di bilancia di laboratorio (0.01g)',
    de: 'Visueller Laborwaagen-Simulator (0.01g)',
    ru: 'Визуальный симулятор лабораторных весов (0.01g)',
    zh: '可视化实验室天平模拟器（0.01g）',
    tr: 'Görsel laboratuvar terazi simülatörü (0.01g)',
    fa: 'شبیه‌ساز بصری ترازوی آزمایشگاهی (۰.۰۱g)',
  },
  title: {
    ar: 'توزين المواد الخام بدقة الميزان والقطارة',
    en: 'Precision Gravimetric Weighing & Beaker Simulator',
    fr: 'Pesée gravimétrique de précision et bécher simulé',
    es: 'Pesada gravimétrica de precisión y vaso simulado',
    it: 'Pesatura gravimetrica di precisione e beaker simulato',
    de: 'Präzise gravimetrische Wägung & Bechersimulator',
    ru: 'Точное гравиметрическое взвешивание и симуляция стакана',
    zh: '高精度重量称量与烧杯模拟',
    tr: 'Hassas gravimetrik tartım ve beher simülatörü',
    fa: 'توزین دقیق مواد اولیه با ترازو و قطره‌چکان',
  },
  desc_tpl: {
    ar: 'محاكاة بصرية حية لمقادير زجاجة {v} مل بتركيز {c}% مع حساب القطرات وقيم التصفير (Tare).',
    en: 'Live visual simulation for a {v}ml bottle @ {c}% with drops and tare values.',
    fr: 'Simulation visuelle en direct d’un flacon de {v} ml à {c} % avec gouttes et tare.',
    es: 'Simulación visual en vivo de un frasco de {v} ml al {c}% con gotas y tara.',
    it: 'Simulazione visiva in diretta di un flacone da {v} ml al {c}% con gocce e tara.',
    de: 'Live-Simulation eines {v}-ml-Flakons bei {c}% mit Tropfen und Tarawerten.',
    ru: 'Наглядная симуляция флакона {v} мл при {c}% с подсчётом капель и тарой.',
    zh: '{v} 毫升瓶装 @{c}% 的实时可视化模拟，含滴数与去皮值。',
    tr: '{v} ml şişe için %{c} konsantrasyonla canlı görsel simülasyon, damla ve tare değerleriyle.',
    fa: 'شبیه‌سازی بصری زنده برای بطری {v} میلی‌لیتری با غلظت {c}٪ همراه با محاسبه قطره و مقدار صفر کردن (Tare).',
  },
  mode_all: {
    ar: '📊 النظرة الشاملة',
    en: '📊 Overall Mass',
    fr: '📊 Vue d’ensemble',
    es: '📊 Vista general',
    it: '📊 Panoramica',
    de: '📊 Gesamtübersicht',
    ru: '📊 Общая масса',
    zh: '📊 总览',
    tr: '📊 Genel Kütle',
    fa: '📊 نمای کلی',
  },
  mode_step: {
    ar: '🧪 خطوة بخطوة (التصفير)',
    en: '🧪 Step-by-Step (Tare)',
    fr: '🧪 Étape par étape (tare)',
    es: '🧪 Paso a paso (tara)',
    it: '🧪 Passo per passo (tara)',
    de: '🧪 Schritt für Schritt (Tara)',
    ru: '🧪 Пошагово (тара)',
    zh: '🧪 分步操作（去皮）',
    tr: '🧪 Adım adım (tare)',
    fa: '🧪 گام‌به‌گام (صفر کردن)',
  },
  net_mass: {
    ar: 'إجمالي وزن التركيبة الصافي',
    en: 'Net Formulation Mass',
    fr: 'Masse nette de la formule',
    es: 'Masa neta de la fórmula',
    it: 'Massa netta della formula',
    de: 'Netto-Formelmasse',
    ru: 'Чистая масса формулы',
    zh: '配方净重',
    tr: 'Net formülasyon kütlesi',
    fa: 'وزن خالص کل ترکیب',
  },
  vol: {
    ar: 'الحجم:',
    en: 'Vol:',
    fr: 'Vol. :',
    es: 'Vol:',
    it: 'Vol:',
    de: 'Vol:',
    ru: 'Объём:',
    zh: '容量：',
    tr: 'Hac:',
    fa: 'حجم:',
  },
  conc: {
    ar: 'التركيز:',
    en: 'Conc:',
    fr: 'Conc. :',
    es: 'Conc:',
    it: 'Conc:',
    de: 'Konz:',
    ru: 'Конц.:',
    zh: '浓度：',
    tr: 'Kons:',
    fa: 'غلظت:',
  },
  density: {
    ar: 'كثافة المركب: ~0.83 جم/مل',
    en: 'Blend Dens: ~0.83 g/ml',
    fr: 'Densité du mélange : ~0,83 g/ml',
    es: 'Densidad de la mezcla: ~0.83 g/ml',
    it: 'Densità del blend: ~0.83 g/ml',
    de: 'Mischungsdichte: ~0.83 g/ml',
    ru: 'Плотность смеси: ~0.83 г/мл',
    zh: '混合液密度：约 0.83 g/ml',
    tr: 'Karışım yoğunluğu: ~0.83 g/ml',
    fa: 'چگالی ترکیب: ~۰.۸۳ گرم/میلی‌لیتر',
  },
  oil: {
    ar: 'الزيت العطري',
    en: 'Fragrance Oil',
    fr: 'Huile de parfum',
    es: 'Aceite de fragancia',
    it: 'Olio aromatico',
    de: 'Duftöl',
    ru: 'Парфюмерное масло',
    zh: '香精油',
    tr: 'Esans yağı',
    fa: 'روغن عطری',
  },
  ethanol96: {
    ar: 'كحول إيثيلي',
    en: 'Ethanol 96%',
    fr: 'Éthanol 96%',
    es: 'Etanol 96%',
    it: 'Etanolo 96%',
    de: 'Ethanol 96%',
    ru: 'Этанол 96%',
    zh: '96% 乙醇',
    tr: '%96 Etanol',
    fa: 'اتانول ۹۶٪',
  },
  fixative: {
    ar: 'المثبت العطري',
    en: 'Fixative',
    fr: 'Fixateur',
    es: 'Fijador',
    it: 'Fissativo',
    de: 'Fixateur',
    ru: 'Фиксатор',
    zh: '定香剂',
    tr: 'Fiksatör',
    fa: 'تثبیت‌کننده',
  },
  water: {
    ar: 'ماء مقطر',
    en: 'Distilled Water',
    fr: 'Eau distillée',
    es: 'Agua destilada',
    it: 'Acqua distillata',
    de: 'Destilliertes Wasser',
    ru: 'Дистиллированная вода',
    zh: '蒸馏水',
    tr: 'Distile su',
    fa: 'آب مقطر',
  },
  water_completion: {
    ar: 'الماء المقطر / الإتمام',
    en: 'Water / Completion',
    fr: 'Eau / Finalisation',
    es: 'Agua / Finalización',
    it: 'Acqua / Completamento',
    de: 'Wasser / Abschluss',
    ru: 'Вода / Завершение',
    zh: '水 / 完成',
    tr: 'Su / Tamamlama',
    fa: 'آب مقطر / تکمیل',
  },
  step1_title: {
    ar: 'الخطوة 1: وضع وعاء الخلط وتصفير الميزان (Tare)',
    en: 'Step 1: Place Beaker on Scale & Tare (Zero)',
    fr: 'Étape 1 : poser le bécher et tarer la balance',
    es: 'Paso 1: colocar el vaso y tarar la balanza',
    it: 'Passo 1: posizionare il beaker e azzerare la bilancia',
    de: 'Schritt 1: Becher aufstellen und Waage tarieren',
    ru: 'Шаг 1: поставить стакан и обнулить весы',
    zh: '步骤 1：放置烧杯并去皮归零',
    tr: 'Adım 1: becheri koy ve teraziyi tare et',
    fa: 'مرحله ۱: قرار دادن ظرف ترکیب و صفر کردن ترازو (Tare)',
  },
  step1_desc: {
    ar: 'ضع الزجاجة الفارغة أو كاس الخلط الزجاجي (Beaker) على سطح الميزان ثم اضغط زر TARE ليصبح الوزن 0.00 جم.',
    en: 'Place the empty bottle or beaker onto the balance pan, then press TARE to reset to 0.00 g.',
    fr: 'Posez le flacon vide ou le bécher sur le plateau, puis appuyez sur TARE pour remettre à 0,00 g.',
    es: 'Coloque el frasco vacío o el vaso sobre el plato y pulse TARA para volver a 0.00 g.',
    it: 'Posiziona il flacone vuoto o il beaker sul piatto, poi premi TARA per azzerare a 0.00 g.',
    de: 'Stellen Sie das leere Flakon oder den Becher auf die Waage und drücken Sie TARA für 0.00 g.',
    ru: 'Поставьте пустой флакон или стакан на чашу весов и нажмите TARE, чтобы обнулить до 0.00 г.',
    zh: '将空瓶或烧杯放在秤盘上，按 TARE 键归零至 0.00 g。',
    tr: 'Boş şişeyi veya becheri terazinin üzerine koyun, sonra TARE tuşuna basarak 0.00 g’a sıfırlayın.',
    fa: 'بطری خالی یا بشر شیشه‌ای را روی صفحه ترازو بگذارید، سپس دکمه TARE را فشار دهید تا وزن ۰.۰۰ گرم شود.',
  },
  step2_title: {
    ar: 'الخطوة 2: وزن الزيت العطري الخام بالقطارة',
    en: 'Step 2: Weigh Fragrance Oil via Pipette',
    fr: 'Étape 2 : peser l’huile de parfum à la pipette',
    es: 'Paso 2: pesar el aceite de fragancia con pipeta',
    it: 'Passo 2: pesare l’olio aromatico con la pipetta',
    de: 'Schritt 2: Duftöl mit der Pipette abwiegen',
    ru: 'Шаг 2: взвесить парфюмерное масло пипеткой',
    zh: '步骤 2：用移液枪称量香精油',
    tr: 'Adım 2: esans yağını pipetle tartın',
    fa: 'مرحله ۲: توزین روغن عطری با قطره‌چکان',
  },
  step2_desc_tpl: {
    ar: 'أضف قطرات الزيت العطري الخام ببطء حتى يصل المؤشر بدقة إلى {g} جم.',
    en: 'Add pure fragrance oil slowly using a graduated pipette until the balance displays exactly {g} g.',
    fr: 'Ajoutez lentement l’huile de parfum pure à la pipette graduée jusqu’à lire exactement {g} g.',
    es: 'Añada lentamente el aceite puro con una pipeta graduada hasta que la balanza marque exactamente {g} g.',
    it: 'Aggiungi lentamente l’olio puro con una pipetta graduata finché la bilancia mostra esattamente {g} g.',
    de: 'Geben Sie das reine Duftöl langsam mit einer Messpipette zu, bis die Waage exakt {g} g anzeigt.',
    ru: 'Медленно добавляйте чистое парфюмерное масло градуированной пипеткой, пока весы не покажут ровно {g} г.',
    zh: '用刻度移液管缓慢加入纯香精油，直至天平精确显示 {g} g。',
    tr: 'Dereceli pipetle saf esans yağını yavaşça ekleyin; terazi tam {g} g gösterene kadar devam edin.',
    fa: 'روغن عطری خالص را با قطره‌چکان مدرج به‌آرامی اضافه کنید تا نمایشگر دقیقاً {g} گرم را نشان دهد.',
  },
  step3_title: {
    ar: 'الخطوة 3: إضافة المثبت العطري (إن وجد)',
    en: 'Step 3: Add Fixative (if applicable)',
    fr: 'Étape 3 : ajouter le fixateur (le cas échéant)',
    es: 'Paso 3: añadir el fijador (si aplica)',
    it: 'Passo 3: aggiungere il fissativo (se previsto)',
    de: 'Schritt 3: Fixateur zugeben (falls vorhanden)',
    ru: 'Шаг 3: добавить фиксатор (если требуется)',
    zh: '步骤 3：添加定香剂（如有）',
    tr: 'Adım 3: fiksatör ekleyin (varsa)',
    fa: 'مرحله ۳: افزودن تثبیت‌کننده (در صورت وجود)',
  },
  step3_desc_tpl: {
    ar: 'أضف المثبت ({g} جم) ليصبح المجموع التراكمي {t} جم.',
    en: 'Weigh fixative ({g} g) bringing cumulative mass to {t} g.',
    fr: 'Pesez le fixateur ({g} g) pour porter la masse cumulée à {t} g.',
    es: 'Pese el fijador ({g} g) llevando la masa acumulada a {t} g.',
    it: 'Pesa il fissativo ({g} g) portando la massa cumulativa a {t} g.',
    de: 'Wiegen Sie den Fixateur ({g} g) ab, sodass die Gesamtmasse {t} g beträgt.',
    ru: 'Взвесьте фиксатор ({g} г), доведя накопленную массу до {t} г.',
    zh: '称量定香剂（{g} g），使累计质量达到 {t} g。',
    tr: 'Fiksatörü tartın ({g} g); toplam kütle {t} g olacak.',
    fa: 'تثبیت‌کننده ({g} گرم) را اضافه کنید تا جرم تجمعی به {t} گرم برسد.',
  },
  step3_zero: {
    ar: 'لا يوجد مثبت محدد لهذه التركيبة (0 جم). يمكنك الانتقال للخطوة التالية.',
    en: 'No fixative required for this formula (0 g). Proceed to next step.',
    fr: 'Aucun fixateur requis pour cette formule (0 g). Passez à l’étape suivante.',
    es: 'No se requiere fijador para esta fórmula (0 g). Continúe con el siguiente paso.',
    it: 'Nessun fissativo richiesto per questa formula (0 g). Procedi al passo successivo.',
    de: 'Für diese Formel ist kein Fixateur erforderlich (0 g). Fahren Sie mit dem nächsten Schritt fort.',
    ru: 'Фиксатор для этой формулы не требуется (0 г). Переходите к следующему шагу.',
    zh: '此配方无需定香剂（0 g）。请进入下一步。',
    tr: 'Bu formül için fiksatör gerekmez (0 g). Sonraki adıma geçin.',
    fa: 'برای این ترکیب تثبیت‌کننده‌ای لازم نیست (۰ گرم). به مرحله بعد بروید.',
  },
  step4_title: {
    ar: 'الخطوة 4: صب الكحول الإيثيلي المتبقي',
    en: 'Step 4: Pour Ethyl Alcohol (Ethanol)',
    fr: 'Étape 4 : verser l’alcool éthylique (éthanol)',
    es: 'Paso 4: verter el alcohol etílico (etanol)',
    it: 'Passo 4: versare l’alcol etilico (etanolo)',
    de: 'Schritt 4: Ethylalkohol (Ethanol) eingießen',
    ru: 'Шаг 4: влить оставшийся этиловый спирт',
    zh: '步骤 4：倒入剩余的乙醇',
    tr: 'Adım 4: etil alkolü (etanol) dökün',
    fa: 'مرحله ۴: ریختن الکل اتیلی باقی‌مانده',
  },
  step4_desc_tpl: {
    ar: 'صب الكحول بحذر حتى يصل الوزن الإجمالي التراكمي إلى {g} جم.',
    en: 'Carefully pour ethanol alcohol until the balance reads {g} g.',
    fr: 'Versez prudemment l’éthanol jusqu’à ce que la balance indique {g} g.',
    es: 'Vierta el etanol con cuidado hasta que la balanza marque {g} g.',
    it: 'Versa con cautela l’etanolo finché la bilancia segna {g} g.',
    de: 'Gießen Sie das Ethanol vorsichtig ein, bis die Waage {g} g anzeigt.',
    ru: 'Осторожно вливайте этанол, пока весы не покажут {g} г.',
    zh: '小心倒入乙醇，直至天平读数为 {g} g。',
    tr: 'Terazi {g} g gösterene kadar etanolü dikkatle dökün.',
    fa: 'الکل را با احتیاط بریزید تا وزن تجمعی کل به {g} گرم برسد.',
  },
  step5_title: {
    ar: 'الخطوة 5: إضافة الماء المقطر (إن وجد) وإحكام الإغلاق',
    en: 'Step 5: Add Distilled Water & Seal',
    fr: 'Étape 5 : ajouter l’eau distillée et sceller',
    es: 'Paso 5: añadir agua destilada y sellar',
    it: 'Passo 5: aggiungere acqua distillata e sigillare',
    de: 'Schritt 5: destilliertes Wasser zugeben und versiegeln',
    ru: 'Шаг 5: добавить дистиллированную воду и герметично закрыть',
    zh: '步骤 5：添加蒸馏水并密封',
    tr: 'Adım 5: distile su ekleyin ve kapatın',
    fa: 'مرحله ۵: افزودن آب مقطر (در صورت وجود) و دربندی محکم',
  },
  step5_desc_tpl: {
    ar: 'أضف الماء المقطر ({g} جم). الوزن النهائي الكامل للزجاجة: {t} جم.',
    en: 'Add distilled water ({g} g). Final net formulation weight: {t} g.',
    fr: 'Ajoutez l’eau distillée ({g} g). Poids net final : {t} g.',
    es: 'Añada agua destilada ({g} g). Peso neto final: {t} g.',
    it: 'Aggiungi acqua distillata ({g} g). Peso netto finale: {t} g.',
    de: 'Destilliertes Wasser zugeben ({g} g). Endgültiges Nettogewicht: {t} g.',
    ru: 'Добавьте дистиллированную воду ({g} г). Итоговый чистый вес: {t} г.',
    zh: '加入蒸馏水（{g} g）。最终配方净重：{t} g。',
    tr: 'Distile su ekleyin ({g} g). Nihai net ağırlık: {t} g.',
    fa: 'آب مقطر ({g} گرم) را اضافه کنید. وزن نهایی کامل بطری: {t} گرم.',
  },
  step5_done_tpl: {
    ar: 'اكتمل وزن التركيبة بالكامل! الوزن الصافي النهائي: {t} جم. رج الزجاجة بلطف ودعها للتعتيق.',
    en: 'Formula compounding completed! Final net bottle weight: {t} g. Shake gently and set for maceration.',
    fr: 'Formulation terminée ! Poids net final du flacon : {t} g. Agitez doucement et laissez macérer.',
    es: '¡Formulación completada! Peso neto final: {t} g. Agite suavemente y deje macerar.',
    it: 'Formulazione completata! Peso netto finale: {t} g. Agita delicatamente e lascia macerare.',
    de: 'Formulierung abgeschlossen! Endgültiges Nettogewicht: {t} g. Sanft schütteln und zur Reifung stellen.',
    ru: 'Формула готова! Итоговый чистый вес флакона: {t} г. Осторожно встряхните и отправьте на мацерацию.',
    zh: '配方调配完成！最终净重：{t} g。轻轻摇匀后开始陈化。',
    tr: 'Formülasyon tamamlandı! Nihai net ağırlık: {t} g. Yavaşça çalkalayın ve dinlendirmeye bırakın.',
    fa: 'توزین ترکیب کامل شد! وزن خالص نهایی: {t} گرم. بطری را ملایم تکان دهید و برای کهنه‌سازی بگذارید.',
  },
  previous: {
    ar: 'السابق',
    en: 'Previous',
    fr: 'Précédent',
    es: 'Anterior',
    it: 'Precedente',
    de: 'Zurück',
    ru: 'Назад',
    zh: '上一步',
    tr: 'Önceki',
    fa: 'قبلی',
  },
  next: {
    ar: 'التالي',
    en: 'Next',
    fr: 'Suivant',
    es: 'Siguiente',
    it: 'Successivo',
    de: 'Weiter',
    ru: 'Далее',
    zh: '下一步',
    tr: 'Sonraki',
    fa: 'بعدی',
  },
  beaker_title: {
    ar: 'مستوى الامتلاء في وعاء الخلط',
    en: 'Glass Beaker Stratified Fill',
    fr: 'Remplissage stratifié du bécher',
    es: 'Llenado estratificado del vaso',
    it: 'Riempimento stratificato del beaker',
    de: 'Geschichtetes Becherfüllniveau',
    ru: 'Послойное заполнение стакана',
    zh: '烧杯分层填充',
    tr: 'Becher tabakalı doluluk',
    fa: 'سطح پرشدگی ظرف ترکیب',
  },
  headspace: {
    ar: 'فراغ هوائي 4%',
    en: 'Headspace 4%',
    fr: ' Vide de tête 4%',
    es: 'Espacio de cabeza 4%',
    it: 'Spazio di testa 4%',
    de: 'Headspace 4%',
    ru: 'Воздушный зазор 4%',
    zh: '顶部空隙 4%',
    tr: 'Hava boşluğu %4',
    fa: 'فضای خالی ۴٪',
  },
  oil_short: {
    ar: 'زيت خام',
    en: 'Oil',
    fr: 'Huile',
    es: 'Aceite',
    it: 'Olio',
    de: 'Öl',
    ru: 'Масло',
    zh: '油',
    tr: 'Yağ',
    fa: 'روغن',
  },
  fix_short: {
    ar: 'مثبت',
    en: 'Fix',
    fr: 'Fix.',
    es: 'Fij.',
    it: 'Fiss.',
    de: 'Fix.',
    ru: 'Фикс.',
    zh: '定香',
    tr: 'Fiks.',
    fa: 'تثبیت',
  },
  water_short: {
    ar: 'ماء',
    en: 'H₂O',
    fr: 'H₂O',
    es: 'H₂O',
    it: 'H₂O',
    de: 'H₂O',
    ru: 'H₂O',
    zh: '水',
    tr: 'Su',
    fa: 'آب',
  },
  alcohol_short: {
    ar: 'كحول 96%',
    en: 'Ethanol',
    fr: 'Éthanol',
    es: 'Etanol',
    it: 'Etanolo',
    de: 'Ethanol',
    ru: 'Этанол',
    zh: '乙醇',
    tr: 'Etanol',
    fa: 'الکل ۹۶٪',
  },
  total_contents: {
    ar: 'إجمالي السائل في الزجاجة:',
    en: 'Total Bottle Contents:',
    fr: 'Contenu total du flacon :',
    es: 'Contenido total del frasco:',
    it: 'Contenuto totale del flacone:',
    de: 'Gesamtinhalt des Flakons:',
    ru: 'Общее содержимое флакона:',
    zh: '瓶内液体总量：',
    tr: 'Şişedeki toplam sıvı:',
    fa: 'کل مایع در بطری:',
  },
  notes_heading_tpl: {
    ar: 'أوزان نوتات الهرم العطري بالجرام (من أصل {g} جم زيت خام):',
    en: 'Individual Pyramid Notes Mass Breakdown (out of {g}g total oil):',
    fr: 'Détail des masses des notes de la pyramide (sur {g} g d’huile totale) :',
    es: 'Desglose de masa de las notas de la pirámide (de {g} g de aceite total):',
    it: 'Ripartizione della massa delle note della piramide (su {g} g di olio totale):',
    de: 'Massenaufschlüsselung der Pyramidennoten (von {g} g Gesamtöl):',
    ru: 'Разбивка массы нот пирамиды (из {g} г общего масла):',
    zh: '香调金字塔各香材克重（总油量 {g} g）：',
    tr: 'Piramit notalarının kütle dökümü (toplam {g} g yağdan):',
    fa: 'وزن نت‌های هرم عطری به گرم (از مجموع {g} گرم روغن):',
  },
  accords: {
    ar: 'مكونات عطرية',
    en: 'accords',
    fr: 'accords',
    es: 'acordes',
    it: 'accordi',
    de: 'Akkorde',
    ru: 'аккордов',
    zh: '个香材',
    tr: 'akor',
    fa: 'جزء عطری',
  },
  of_oil: {
    ar: 'من الزيت',
    en: 'of oil',
    fr: 'de l’huile',
    es: 'del aceite',
    it: 'dell’olio',
    de: 'des Öls',
    ru: 'от масла',
    zh: '占油比',
    tr: 'yağ oranı',
    fa: 'از روغن',
  },
  rule_title: {
    ar: 'القاعدة الذهبية لصياغة العطور الاحترافية:',
    en: 'Master Perfumer Golden Weighing Rule:',
    fr: 'Règle d’or du pesage en parfumerie :',
    es: 'Regla de oro del maestro perfumista:',
    it: 'Regola d’oro del mastro profumiere:',
    de: 'Goldene Wägeregel des Meister-Parfümeurs:',
    ru: 'Золотое правило взвешивания мастера-парфюмера:',
    zh: '调香师黄金称量法则：',
    tr: 'Usta parfümörün altın tartım kuralı:',
    fa: 'قانون طلایی توزین در عطرسازی حرفه‌ای:',
  },
  rule_text: {
    ar: 'احرص دائماً على صب الزيت العطري أولاً في الزجاجة أو الوعاء، ثم إضافة الكحول فوقه، وليس العكس؛ حيث يضمن ذلك امتزاج جزيئات الزيت الثقيلة مع الكحول بسرعة ومنع حدوث أي تعكر أو انفصال طبقي.',
    en: 'Always add fragrance oils to the vessel first, then pour alcohol over them, not vice versa. This optimizes molecular diffusion and prevents clouding or phase separation.',
    fr: 'Versez toujours d’abord les huiles dans le récipient, puis l’alcool par-dessus, jamais l’inverse. Cela optimise la diffusion moléculaire et évite tout trouble ou séparation de phases.',
    es: 'Añada siempre primero los aceites al recipiente y después el alcohol, nunca al revés. Esto optimiza la difusión molecular y evita turbidez o separación de fases.',
    it: 'Aggiungi sempre prima gli oli nel contenitore e poi versa l’alcol sopra, mai il contrario. Ottimizza la diffusione molecolare e previene torbidità o separazione di fase.',
    de: 'Geben Sie immer zuerst die Duftöle ins Gefäß und gießen Sie dann den Alkohol darüber — niemals umgekehrt. Das optimiert die molekulare Diffusion und verhindert Trübung oder Phasentrennung.',
    ru: 'Всегда сначала наливайте масла в сосуд, а затем спирт поверх них, но не наоборот. Это оптимизирует молекулярную диффузию и предотвращает помутнение или расслоение.',
    zh: '务必先将香精油倒入容器，再将酒精覆盖其上，顺序不可颠倒。这样能优化分子扩散，防止浑浊或分层。',
    tr: 'Önce yağları kaba koyun, üzerine alkolü dökün; asla tersini yapmayın. Bu, moleküler difüzyonu optimize eder ve bulanıklığı veya faz ayrımını önler.',
    fa: 'همیشه ابتدا روغن‌های عطری را در ظرف بریزید و سپس الکل را روی آن اضافه کنید، نه برعکس؛ این کار نفوذ مولکولی را بهینه می‌کند و از کدورت یا جدایی فازی جلوگیری می‌کند.',
  },
  drops_unit: {
    ar: 'قطرات',
    en: 'drops',
    fr: 'gouttes',
    es: 'gotas',
    it: 'gocce',
    de: 'Tropfen',
    ru: 'капель',
    zh: '滴',
    tr: 'damla',
    fa: 'قطره',
  },
} satisfies Record<string, LText>;

export const VisualScaleSimulator: React.FC<VisualScaleSimulatorProps> = ({
  formulation,
  result,
  pyramidNotes = [],
  currentLang = 'ar',
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
  const NextArrow = rtl ? ChevronLeft : ChevronRight;
  const PrevArrow = rtl ? ChevronRight : ChevronLeft;

  // Simulator Modes: 'all' (Overall View) or 'step' (Step-by-step Weighing Walkthrough)
  const [simulatorMode, setSimulatorMode] = useState<'all' | 'step'>('all');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isTared, setIsTared] = useState<boolean>(false);
  const [pipetteDropMode, setPipetteDropMode] = useState<'drops' | 'grams'>('grams');

  // Drops conversion factor (standard laboratory pipette: ~20 to 25 drops per gram of oil, ~30 drops per gram of ethanol)
  const OIL_DROPS_PER_GRAM = 24;
  const ALCOHOL_DROPS_PER_GRAM = 32;

  // Weighing Steps Definition
  const steps = [
    {
      id: 'tare_beaker',
      title: L('step1_title'),
      desc: L('step1_desc'),
      targetGrams: 0,
      cumulativeGrams: 0,
      color: 'bg-stone-300',
      tag: 'TARE 0.00g',
    },
    {
      id: 'oil',
      title: L('step2_title'),
      desc: fmt(L('step2_desc_tpl'), { g: formatNum(result.oilWeightGrams) }),
      targetGrams: result.oilWeightGrams,
      cumulativeGrams: result.oilWeightGrams,
      volumeMl: result.oilVolumeMl,
      color: 'bg-amber-500',
      tag: L('oil'),
    },
    {
      id: 'fixative',
      title: L('step3_title'),
      desc: result.fixativeWeightGrams > 0
        ? fmt(L('step3_desc_tpl'), {
            g: formatNum(result.fixativeWeightGrams),
            t: formatNum(result.oilWeightGrams + result.fixativeWeightGrams),
          })
        : L('step3_zero'),
      targetGrams: result.fixativeWeightGrams,
      cumulativeGrams: result.oilWeightGrams + result.fixativeWeightGrams,
      volumeMl: result.fixativeVolumeMl,
      color: 'bg-emerald-500',
      tag: L('fixative'),
    },
    {
      id: 'alcohol',
      title: L('step4_title'),
      desc: fmt(L('step4_desc_tpl'), { g: formatNum(result.totalWeightGrams - result.waterWeightGrams) }),
      targetGrams: result.alcoholWeightGrams,
      cumulativeGrams: result.oilWeightGrams + result.fixativeWeightGrams + result.alcoholWeightGrams,
      volumeMl: result.alcoholVolumeMl,
      color: 'bg-cyan-500',
      tag: L('ethanol96'),
    },
    {
      id: 'water',
      title: L('step5_title'),
      desc: result.waterWeightGrams > 0
        ? fmt(L('step5_desc_tpl'), { g: formatNum(result.waterWeightGrams), t: formatNum(result.totalWeightGrams) })
        : fmt(L('step5_done_tpl'), { t: formatNum(result.totalWeightGrams) }),
      targetGrams: result.waterWeightGrams,
      cumulativeGrams: result.totalWeightGrams,
      volumeMl: result.waterVolumeMl,
      color: 'bg-blue-400',
      tag: L('water_completion'),
    },
  ];

  const activeStepObj = steps[currentStep];

  // Visual percentages inside the beaker
  const oilHeightPct = Math.max(8, (result.oilVolumeMl / result.totalVolumeMl) * 100);
  const alcoholHeightPct = Math.max(15, (result.alcoholVolumeMl / result.totalVolumeMl) * 100);
  const waterHeightPct = result.waterVolumeMl > 0 ? (result.waterVolumeMl / result.totalVolumeMl) * 100 : 0;
  const fixativeHeightPct = result.fixativeVolumeMl > 0 ? (result.fixativeVolumeMl / result.totalVolumeMl) * 100 : 0;

  return (
    <div className="bg-white rounded-3xl border border-stone-200/90 shadow-md p-5 sm:p-7 space-y-6 animate-in fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200 mb-1">
            <Scale className="w-3.5 h-3.5 text-amber-800" />
            <span>{L('badge')}</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-stone-950 font-serif-luxury">
            {L('title')}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            {fmt(L('desc_tpl'), { v: formulation.bottleVolumeMl, c: formulation.concentrationPercent })}
          </p>
        </div>

        {/* Mode switcher tabs */}
        <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setSimulatorMode('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              simulatorMode === 'all'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {L('mode_all')}
          </button>
          <button
            type="button"
            onClick={() => {
              setSimulatorMode('step');
              setCurrentStep(1);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              simulatorMode === 'step'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {L('mode_step')}
          </button>
        </div>
      </div>

      {/* Main Interactive Stage: Scale LCD on Left, Glass Beaker on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        
        {/* Left: The Virtual Digital Balance Display */}
        <div className="lg:col-span-7 bg-stone-950 rounded-2xl p-5 sm:p-6 text-white border border-stone-800 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-xs font-bold text-stone-300 tracking-wider">
                SHAM PRECISION LAB BALANCE · 0.01g
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-stone-400">
              <button
                type="button"
                onClick={() => setIsTared(!isTared)}
                className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  isTared
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                    : 'bg-stone-800 border-stone-700 hover:bg-stone-700 text-stone-300'
                }`}
              >
                [TARE] {isTared ? 'TARED' : 'ZERO'}
              </button>
              <button
                type="button"
                onClick={() => setPipetteDropMode(pipetteDropMode === 'grams' ? 'drops' : 'grams')}
                className="px-2 py-0.5 rounded bg-stone-800 border border-stone-700 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                {pipetteDropMode === 'grams' ? 'UNIT: g' : `UNIT: ${L('drops_unit').toUpperCase()}`}
              </button>
            </div>
          </div>

          {/* Large Glow LCD Readout */}
          <div className="bg-stone-900/90 rounded-xl p-4 sm:p-5 border border-stone-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-stone-400 uppercase tracking-wider mb-1">
                {simulatorMode === 'all'
                  ? L('net_mass')
                  : activeStepObj.tag}
              </div>
              <div className="text-3xl sm:text-5xl font-mono-numbers font-black tracking-tight text-amber-400 flex items-baseline gap-2">
                <span>
                  {simulatorMode === 'all'
                    ? formatNum(result.totalWeightGrams, 2)
                    : isTared
                    ? '0.00'
                    : formatNum(activeStepObj.cumulativeGrams, 2)}
                </span>
                <span className="text-lg sm:text-2xl font-light text-stone-500 font-sans">
                  {pipetteDropMode === 'grams' ? 'g' : L('drops_unit')}
                </span>
              </div>
            </div>

            <div className={`${rtl ? 'text-left' : 'text-right'} font-mono text-xs space-y-1`}>
              <div className="text-stone-400">
                {L('vol')}{' '}
                <span className="text-white font-bold">{formulation.bottleVolumeMl} ml</span>
              </div>
              <div className="text-stone-400">
                {L('conc')}{' '}
                <span className="text-amber-300 font-bold">{formulation.concentrationPercent}%</span>
              </div>
              <div className="text-stone-500 text-[10px]">
                {L('density')}
              </div>
            </div>
          </div>

          {/* Interactive Material Mass Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Fragrance Oil Card */}
            <div className="p-3 bg-stone-900/80 rounded-xl border border-amber-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="truncate">{L('oil')}</span>
              </div>
              <div className="text-base sm:text-lg font-mono-numbers font-extrabold text-amber-200">
                {formatNum(result.oilWeightGrams)} g
              </div>
              <div className="text-[10px] text-stone-400 font-mono-numbers flex justify-between">
                <span>{formatNum(result.oilVolumeMl)} ml</span>
                <span>~{Math.round(result.oilWeightGrams * OIL_DROPS_PER_GRAM)} 💧</span>
              </div>
            </div>

            {/* Alcohol Card */}
            <div className="p-3 bg-stone-900/80 rounded-xl border border-cyan-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="truncate">{L('ethanol96')}</span>
              </div>
              <div className="text-base sm:text-lg font-mono-numbers font-extrabold text-cyan-200">
                {formatNum(result.alcoholWeightGrams)} g
              </div>
              <div className="text-[10px] text-stone-400 font-mono-numbers flex justify-between">
                <span>{formatNum(result.alcoholVolumeMl)} ml</span>
                <span>~{Math.round(result.alcoholWeightGrams * ALCOHOL_DROPS_PER_GRAM)} 💧</span>
              </div>
            </div>

            {/* Fixative Card */}
            <div className="p-3 bg-stone-900/80 rounded-xl border border-emerald-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="truncate">{L('fixative')}</span>
              </div>
              <div className="text-base sm:text-lg font-mono-numbers font-extrabold text-emerald-200">
                {formatNum(result.fixativeWeightGrams)} g
              </div>
              <div className="text-[10px] text-stone-400 font-mono-numbers flex justify-between">
                <span>{formatNum(result.fixativeVolumeMl)} ml</span>
                <span>~{Math.round(result.fixativeWeightGrams * OIL_DROPS_PER_GRAM)} 💧</span>
              </div>
            </div>

            {/* Distilled Water Card */}
            <div className="p-3 bg-stone-900/80 rounded-xl border border-blue-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="truncate">{L('water')}</span>
              </div>
              <div className="text-base sm:text-lg font-mono-numbers font-extrabold text-blue-200">
                {formatNum(result.waterWeightGrams)} g
              </div>
              <div className="text-[10px] text-stone-400 font-mono-numbers flex justify-between">
                <span>{formatNum(result.waterVolumeMl)} ml</span>
                <span>~{Math.round(result.waterWeightGrams * 20)} 💧</span>
              </div>
            </div>
          </div>

          {/* Step-by-Step Navigation if active */}
          {simulatorMode === 'step' && (
            <div className="pt-2 border-t border-stone-800 space-y-3">
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="font-bold text-amber-300">
                  {activeStepObj.title}
                </span>
                <span className="font-mono text-stone-400 shrink-0">
                  {currentStep + 1} / {steps.length}
                </span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed bg-stone-900/60 p-2.5 rounded-lg border border-stone-800">
                {activeStepObj.desc}
              </p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={currentStep === 0}
                  onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <PrevArrow className="w-3.5 h-3.5" />
                  <span>{L('previous')}</span>
                </button>

                <div className="flex items-center gap-1">
                  {steps.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setCurrentStep(idx)}
                      className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                        currentStep === idx
                          ? 'bg-amber-400 w-5'
                          : 'bg-stone-700 hover:bg-stone-500'
                      }`}
                      title={s.title}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  disabled={currentStep === steps.length - 1}
                  onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>{L('next')}</span>
                  <NextArrow className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Realistic Glass Laboratory Beaker with Layer Fill */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-stone-50 rounded-2xl border border-stone-200">
          <div className="text-xs font-bold text-stone-700 mb-2 flex items-center gap-1.5">
            <Beaker className="w-4 h-4 text-amber-700" />
            <span>{L('beaker_title')}</span>
          </div>

          {/* Visual Glass Beaker Body */}
          <div className="relative w-44 h-64 border-4 border-t-0 border-stone-300 rounded-b-3xl bg-stone-100/50 overflow-hidden shadow-inner flex flex-col justify-end">
            
            {/* Beaker Measurement Ticks (Graduations) */}
            <div className={`absolute inset-y-0 ${rtl ? 'left-1' : 'right-1'} flex flex-col justify-between py-4 text-[9px] font-mono font-bold text-stone-400 pointer-events-none select-none`}>
              <span>{formulation.bottleVolumeMl}ml —</span>
              <span>{Math.round(formulation.bottleVolumeMl * 0.75)}ml —</span>
              <span>{Math.round(formulation.bottleVolumeMl * 0.50)}ml —</span>
              <span>{Math.round(formulation.bottleVolumeMl * 0.25)}ml —</span>
              <span>0ml —</span>
            </div>

            {/* Headspace indicator line */}
            <div className={`absolute top-2 ${rtl ? 'right-2' : 'left-2'} text-[9px] text-stone-400 font-mono flex items-center gap-1`}>
              <span>↑ {L('headspace')}</span>
            </div>

            {/* Liquid Layers Stack from Bottom to Top */}
            {/* Layer 1: Fragrance Oil (Bottom Layer) */}
            <div
              style={{ height: `${oilHeightPct}%` }}
              className="w-full bg-gradient-to-t from-amber-600 to-amber-500 transition-all duration-500 relative flex items-center justify-center text-amber-950 font-bold text-[10px] shadow-sm border-t border-amber-400/50"
              title={`${L('oil')}: ${formatNum(result.oilWeightGrams)}g`}
            >
              <span className="truncate px-1 drop-shadow-xs">
                {L('oil_short')} ({formatNum(result.oilWeightGrams)}g)
              </span>
            </div>

            {/* Layer 2: Fixative (if present) */}
            {result.fixativeWeightGrams > 0 && (
              <div
                style={{ height: `${Math.max(6, fixativeHeightPct)}%` }}
                className="w-full bg-gradient-to-t from-emerald-600 to-emerald-500 transition-all duration-500 relative flex items-center justify-center text-emerald-950 font-bold text-[9px] border-t border-emerald-400/50"
                title={`${L('fixative')}: ${formatNum(result.fixativeWeightGrams)}g`}
              >
                <span className="truncate px-1 drop-shadow-xs">
                  {L('fix_short')} ({formatNum(result.fixativeWeightGrams)}g)
                </span>
              </div>
            )}

            {/* Layer 3: Distilled Water (if present) */}
            {result.waterWeightGrams > 0 && (
              <div
                style={{ height: `${Math.max(6, waterHeightPct)}%` }}
                className="w-full bg-gradient-to-t from-blue-400 to-blue-300 transition-all duration-500 relative flex items-center justify-center text-blue-950 font-bold text-[9px] border-t border-blue-200/50"
                title={`${L('water')}: ${formatNum(result.waterWeightGrams)}g`}
              >
                <span className="truncate px-1">
                  {L('water_short')} ({formatNum(result.waterWeightGrams)}g)
                </span>
              </div>
            )}

            {/* Layer 4: Ethanol Alcohol (Upper Carrier Layer) */}
            <div
              style={{ height: `${alcoholHeightPct}%` }}
              className="w-full bg-gradient-to-t from-cyan-300/80 to-cyan-200/60 transition-all duration-500 relative flex items-center justify-center text-cyan-950 font-bold text-[10px] border-t border-cyan-100"
              title={`${L('ethanol96')}: ${formatNum(result.alcoholWeightGrams)}g`}
            >
              <span className="truncate px-1 drop-shadow-xs">
                {L('alcohol_short')} ({formatNum(result.alcoholWeightGrams)}g)
              </span>
            </div>

          </div>

          <div className="mt-3 text-center">
            <span className="text-[11px] font-bold text-stone-800 block">
              {L('total_contents')}
            </span>
            <span className="text-xs font-mono-numbers font-extrabold text-amber-900">
              {formatNum(result.totalWeightGrams)} g · {formulation.bottleVolumeMl} ml
            </span>
          </div>
        </div>

      </div>

      {/* Individual Pyramid Notes Detailed Grams Breakdown (if Pyramid Notes exist) */}
      {pyramidNotes.length > 0 && (
        <div className="pt-4 border-t border-stone-100 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-700" />
              <h4 className="text-xs sm:text-sm font-bold text-stone-900">
                {fmt(L('notes_heading_tpl'), { g: formatNum(result.oilWeightGrams) })}
              </h4>
            </div>
            <span className="text-[11px] text-stone-500 font-mono-numbers shrink-0">
              {pyramidNotes.length} {L('accords')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {pyramidNotes.map((note) => {
              // Exact note grams in this specific bottle volume
              const noteGrams = (result.oilWeightGrams * note.percentageOfOil) / 100;
              const noteDrops = Math.round(noteGrams * OIL_DROPS_PER_GRAM);

              return (
                <div
                  key={note.id}
                  className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex items-center justify-between hover:bg-stone-100/80 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        note.category === 'top'
                          ? 'bg-amber-500'
                          : note.category === 'heart'
                          ? 'bg-stone-600'
                          : 'bg-stone-950'
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-stone-900 block truncate">
                        {pickArEn(currentLang, note.nameAr, note.nameEn)}
                      </span>
                      <span className="text-[10px] text-stone-400 block font-mono-numbers">
                        {note.percentageOfOil}% {L('of_oil')}
                      </span>
                    </div>
                  </div>

                  <div className={`${rtl ? 'text-right' : 'text-left'} font-mono-numbers shrink-0`}>
                    <div className="text-xs font-extrabold text-amber-900">
                      {formatNum(noteGrams, 3)} g
                    </div>
                    <div className="text-[10px] text-stone-500">
                      ~{noteDrops} 💧
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Laboratory Tip banner */}
      <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/70 flex items-start gap-2.5 text-xs text-amber-950">
        <Info className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
        <div className="leading-relaxed text-[11px]">
          <span className="font-bold block mb-0.5">
            {L('rule_title')}
          </span>
          {L('rule_text')}
        </div>
      </div>
    </div>
  );
};
