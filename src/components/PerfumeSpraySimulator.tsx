import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Wind,
  Sparkles,
  Droplets,
  Zap,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Activity,
  Flame,
  Thermometer,
  Eye,
  Maximize2,
  Minimize2,
  Waves,
  Crosshair,
  Volume2,
  VolumeX,
  Info,
  Sliders,
  CheckCircle2,
  Atom,
} from 'lucide-react';
import { PyramidNote, CalculationResult } from '../types/perfume';
import { SupportedLanguage } from '../types/i18n';
import { formatNum } from '../utils/calculations';
import { useLanguage } from '../context/LanguageContext';
import { LText, makeT, fmt, pickArEn } from '../لغات/localize';
import { uiLabel } from '../لغات/uiTextL10n';
import {
  calculateEvaporationKinetics,
  EvaporationKinetics,
  enrichPyramidNote,
  sortNotesByVolatilityOrder,
  generateCustomSprayScenario,
} from '../utils/volatilityHelper';

interface PerfumeSpraySimulatorProps {
  pyramidNotes: PyramidNote[];
  bottleVolumeMl?: number;
  concentrationPercent?: number;
  result?: CalculationResult;
  currentLang?: SupportedLanguage;
  onClose?: () => void;
}

const S = {
  sim_badge: {
    ar: 'محاكي رش العطر الفيزيائي وثباته على الجسم (Aerosol & Skin Kinetics)',
    en: 'Physics-Based Perfume Spray & Skin Fixation Simulator',
    fr: 'Simulateur physique de pulvérisation et fixation cutanée',
    es: 'Simulador físico de pulverización y fijación en la piel',
    it: 'Simulatore fisico di spruzzo e fissazione sulla pelle',
    de: 'Physikalischer Parfümsprüh- & Hautfixierungssimulator',
    ru: 'Физический симулятор распыления и фиксации на коже',
    zh: '香水喷雾物理喷射与肌肤固着模拟器',
    tr: 'Fiziksel parfüm püskürtme ve cilt sabitleme simülatörü',
    fa: 'شبیه‌ساز فیزیکی اسپری عطر و ثبات آن روی پوست',
  },
  sim_title: {
    ar: 'محاكاة خروج الرذاذ، استقراره على الجلد، وتبخره الزمني',
    en: 'Atomization, Skin Adhesion & Evaporation Kinetics',
    fr: 'Atomisation, adhésion cutanée et cinétique d’évaporation',
    es: 'Atomización, adhesión en la piel y cinética de evaporación',
    it: 'Atomizzazione, adesione cutanea e cinetica di evaporazione',
    de: 'Zerstäubung, Hautanhaftung & Verdunstungskinetik',
    ru: 'Распыление, адгезия к коже и кинетика испарения',
    zh: '雾化喷出、肌肤附着与随时间递进的挥发动力学',
    tr: 'Püskürtme, cilde tutunma ve zamana bağlı buharlaşma kinetiği',
    fa: 'شبیه‌سازی خروج ذرات، نشستن بر پوست و تبخیر تدریجی در زمان',
  },
  sim_desc: {
    ar: 'شاهد مسار جزيئات العطر من فوهة البخاخ حتى اصطدامها بمسام الجلد، تبخر الكحول الخاطف، رسو الزيوت الثقيلة، وانبعاث الهالة العطرية في الهواء مع مرور الدقائق والساعات.',
    en: 'Witness the trajectory of perfume molecules from atomizer nozzle to skin lipid barrier, alcohol flash-off, base fixation, and gradual temporal evaporation over hours.',
    fr: 'Observez la trajectoire des molécules du diffuseur à la peau, l’évaporation de l’alcool, la fixation des huiles et l’évolution dans le temps.',
    es: 'Observe la trayectoria de las moléculas desde el atomizador hasta la piel, la evaporación del alcohol, la fijación y la evaporación temporal.',
    it: 'Osserva la traiettoria delle molecole dal diffusore alla pelle, l’evaporazione dell’alcool, la fissazione delle essenze e l’evoluzione temporale.',
    de: 'Verfolgen Sie die Moleküle von der Düse zur Haut, die Alkoholverdampfung, die Ölfixierung und die zeitliche Verdunstung.',
    ru: 'Наблюдайте траекторию молекул от распылителя до кожи, испарение спирта, фиксацию масел и постепенное рассеивание во времени.',
    zh: '观察香水分子从喷头喷出、撞击肌肤脂质屏障、乙醇瞬间闪蒸、定香底香锚定，以及随时间推移的完整挥发过程。',
    tr: 'Parfüm moleküllerinin püskürtücüden cilde ulaşmasını, alkolün uçmasını, baz yağların sabitlenmesini ve saatler içindeki buharlaşmasını izleyin.',
    fa: 'مسیر مولکول‌های عطر از نازل اسپری تا نشستن بر چربی پوست، تبخیر سریع الکل و تصاعد تدریجی نت‌ها در گذر زمان را تماشا کنید.',
  },
  btn_spray: {
    ar: 'بَخّة عطر الآن (Spray)',
    en: 'Spray Now',
    fr: 'Vaporiser maintenant',
    es: 'Pulverizar ahora',
    it: 'Spruzza ora',
    de: 'Jetzt sprühen',
    ru: 'Распылить сейчас',
    zh: '立即喷洒',
    tr: 'Şimdi püskürt',
    fa: 'اکنون اسپری کنید',
  },
  btn_continuous: {
    ar: 'رش مستمر',
    en: 'Continuous Mist',
    fr: 'Brume continue',
    es: 'Rocío continuo',
    it: 'Nebulizzazione continua',
    de: 'Dauersprühen',
    ru: 'Непрерывное распыление',
    zh: '持续喷射',
    tr: 'Sürekli püskürt',
    fa: 'اسپری مداوم',
  },
  view_panoramic: {
    ar: 'مسار الرش والجلد (Panorama)',
    en: 'Atomizer & Skin Panorama',
    fr: 'Vue d’ensemble spray & peau',
    es: 'Panorama spray y piel',
    it: 'Panoramica spruzzo e pelle',
    de: 'Sprüh- & Hautpanorama',
    ru: 'Панорама: распылитель и кожа',
    zh: '全景：喷头至肌肤',
    tr: 'Püskürtücü ve cilt panoraması',
    fa: 'نمای سراسری اسپری تا پوست',
  },
  view_micro: {
    ar: 'مجهر مسام الجلد (Skin Lipid Layer)',
    en: 'Skin Pores & Lipid Layer',
    fr: 'Pores de la peau & couche lipidique',
    es: 'Poros de la piel y capa lipídica',
    it: 'Pori della pelle e strato lipidico',
    de: 'Hautporen & Lipidschicht',
    ru: 'Микроскоп: поры и липидный слой',
    zh: '微观：肌肤毛孔与皮脂膜',
    tr: 'Cilt gözenekleri ve lipit katmanı',
    fa: 'میکروسکوپ: منافذ و چربی پوست',
  },
  view_aura: {
    ar: 'هالة الفوحان المحيطية (Sillage Aura)',
    en: 'Sillage Aura & Projection',
    fr: 'Aura de sillage et projection',
    es: 'Aura de estela y proyección',
    it: 'Aura di scia e proiezione',
    de: 'Sillage-Aura & Projektion',
    ru: 'Аура шлейфа и проекция',
    zh: '香气扩散光晕与投影',
    tr: 'Koku yayılım aurası',
    fa: 'هاله انتشار و پخش بو',
  },
  target_wrist: {
    ar: 'معصم اليد (Pulse Wrist)',
    en: 'Pulse Wrist',
    fr: 'Poignet (point de pulsation)',
    es: 'Muñeca (punto de pulso)',
    it: 'Polso (punto di pulsazione)',
    de: 'Handgelenk (Pulspunkt)',
    ru: 'Запястье (пульсовая точка)',
    zh: '手腕脉搏点',
    tr: 'Bilek (nabız noktası)',
    fa: 'مچ دست (نقطه نبض)',
  },
  target_neck: {
    ar: 'العنق والرقبة (Carotid Neck)',
    en: 'Carotid Neck',
    fr: 'Cou (carotide)',
    es: 'Cuello (carótida)',
    it: 'Collo (carotide)',
    de: 'Hals (Halsschlagader)',
    ru: 'Шея (сонная артерия)',
    zh: '颈部脉搏处',
    tr: 'Boyun (şah damarı)',
    fa: 'گردن و رگ خواب',
  },
  target_elbow: {
    ar: 'ثنية الكوع (Inner Elbow)',
    en: 'Inner Elbow',
    fr: 'Pli du coude',
    es: 'Pliegue del codo',
    it: 'Interno gomito',
    de: 'Armbeuge',
    ru: 'Сгиб локтя',
    zh: '手肘内侧',
    tr: 'Dirsek içi',
    fa: 'گودی آرنج',
  },
  skin_temp_lbl: {
    ar: 'حرارة الجلد والموضع:',
    en: 'Skin Temperature & Pulse Point:',
    fr: 'Température de la peau et point de pulsation :',
    es: 'Temperatura de la piel y punto de pulso:',
    it: 'Temperatura della pelle e punto di pulsazione:',
    de: 'Hauttemperatur & Pulspunkt:',
    ru: 'Температура кожи и пульсовая точка:',
    zh: '肌肤温度与脉搏点：',
    tr: 'Cilt sıcaklığı ve nabız noktası:',
    fa: 'دمای پوست و موضع نبض:',
  },
  timeline_lbl: {
    ar: 'المؤقت الزمني للتبخر:',
    en: 'Evaporation Timeline Scrubber:',
    fr: 'Ligne de temps d’évaporation :',
    es: 'Línea de tiempo de evaporación:',
    it: 'Linea temporale di evaporazione:',
    de: 'Verdunstungs-Zeitachse:',
    ru: 'Таймлайн испарения:',
    zh: '挥发时间轴调控器：',
    tr: 'Buharlaşma zaman çizelgesi:',
    fa: 'خط زمانی تبخیر:',
  },
  telemetry_spray_state: {
    ar: 'حالة الرذاذ والانطلاق',
    en: 'Spray Release Status',
    fr: 'État de la pulvérisation',
    es: 'Estado de pulverización',
    it: 'Stato dello spruzzo',
    de: 'Sprühstatus',
    ru: 'Статус распыления',
    zh: '喷雾释放状态',
    tr: 'Püskürtme durumu',
    fa: 'وضعیت پرتاب اسپری',
  },
  telemetry_alcohol_flash: {
    ar: 'كحول إيثيلي متبقٍ',
    en: 'Remaining Alcohol',
    fr: 'Alcool restant',
    es: 'Alcohol restante',
    it: 'Alcol residuo',
    de: 'Verbleibender Alkohol',
    ru: 'Остаток спирта',
    zh: '残留乙醇比例',
    tr: 'Kalan alkol',
    fa: 'الکل باقیمانده',
  },
  telemetry_skin_oil: {
    ar: 'زيت مثبت على مسام الجلد',
    en: 'Anchored Oil on Skin',
    fr: 'Huile fixée sur la peau',
    es: 'Aceite fijado en la piel',
    it: 'Olio fissato sulla pelle',
    de: 'Fixiertes Öl auf der Haut',
    ru: 'Масло, закреплённое на коже',
    zh: '附着于肌肤皮脂的香油',
    tr: 'Cilde sabitlenen yağ',
    fa: 'روغن تثبیت‌شده روی پوست',
  },
  telemetry_evap_rate: {
    ar: 'معدل التبخر الآني',
    en: 'Current Evaporation Rate',
    fr: 'Taux d’évaporation instantané',
    es: 'Tasa de evaporación instantánea',
    it: 'Tasso di evaporazione istantaneo',
    de: 'Aktuelle Verdunstungsrate',
    ru: 'Скорость испарения',
    zh: '实时挥发速率',
    tr: 'Anlık buharlaşma hızı',
    fa: 'نرخ تبخیر لحظه‌ای',
  },
  telemetry_sillage: {
    ar: 'نصف قطر الفوحان (Sillage)',
    en: 'Sillage Radius (Projection)',
    fr: 'Rayon de sillage (projection)',
    es: 'Radio de estela (proyección)',
    it: 'Raggio della scia (proiezione)',
    de: 'Sillage-Radius (Projektion)',
    ru: 'Радиус шлейфа',
    zh: '扩散半径（投影距离）',
    tr: 'Koku yayılım yarıçapı',
    fa: 'شعاع پخش بو (سیلاژ)',
  },
  legend_top: {
    ar: 'نوتات القمة (حمضيات وفواكه - خفيفة سريعة التطاير)',
    en: 'Top Notes (Volatile Citrus & Herbs - Fast Flash)',
    fr: 'Notes de tête (agrumes & herbes - évaporation rapide)',
    es: 'Notas de salida (cítricos y hierbas - rápida evaporación)',
    it: 'Note di testa (agrumi ed erbe - rapida evaporazione)',
    de: 'Kopfnoten (Zitrus & Kräuter - schnelle Verflüchtigung)',
    ru: 'Верхние ноты (цитрусы и травы - быстрое испарение)',
    zh: '前调分子（柑橘与草本 - 高挥发性急速释放）',
    tr: 'Üst notalar (narenciye ve taze otlar - hızlı uçuş)',
    fa: 'نت‌های اولیه (مرکبات و گیاهان معطر - تبخیر سریع)',
  },
  legend_heart: {
    ar: 'نوتات القلب (زهور وتوابل - انتشار معتدل دافئ)',
    en: 'Heart Notes (Florals & Warm Spices - Balanced Bloom)',
    fr: 'Notes de cœur (fleurs & épices - diffusion équilibrée)',
    es: 'Notas de corazón (flores y especias - difusión equilibrada)',
    it: 'Note di cuore (fiori e spezie - diffusione equilibrata)',
    de: 'Herznoten (Blüten & Gewürze - ausgewogene Entfaltung)',
    ru: 'Ноты сердца (цветы и пряности - умеренное раскрытие)',
    zh: '中调分子（花香与暖香料 - 随体温温润绽放）',
    tr: 'Kalp notalar (çiçekler ve baharatlar - dengeli yayılım)',
    fa: 'نت‌های میانی (گل‌ها و ادویه‌ها - شکوفایی معتدل)',
  },
  legend_base: {
    ar: 'نوتات القاعدة والمثبتات (أخشاب وعنبر ومسك - ثبات عميق)',
    en: 'Base & Fixatives (Woods, Amber, Musks - Deep Tenacity)',
    fr: 'Notes de fond & fixateurs (bois, ambre, musc - haute ténacité)',
    es: 'Notas de fondo y fijadores (maderas, ámbar, almizcle - gran tenacidad)',
    it: 'Note di fondo e fissativi (legni, ambra, muschio - alta tenacità)',
    de: 'Basisnoten & Fixateure (Hölzer, Bernstein, Moschus - tiefe Haftung)',
    ru: 'Базовые ноты и фиксаторы (древесина, амбра, мускус - высокая стойкость)',
    zh: '后调与定香剂（木质、龙涎香、大环麝香 - 深度锚定）',
    tr: 'Dip notalar ve sabitleyiciler (odunsu, kehribar, misk - derin kalıcılık)',
    fa: 'نت‌های پایه و تثبیت‌کننده‌ها (چوب، عنبر، مشک - ماندگاری عمیق)',
  },
  sound_toggle: {
    ar: 'مؤثرات صوتية للرذاذ',
    en: 'Aerosol Sound Effects',
    fr: 'Effets sonores de pulvérisation',
    es: 'Efectos de sonido del spray',
    it: 'Effetti sonori dello spruzzo',
    de: 'Sprüh-Soundeffekte',
    ru: 'Звуковые эффекты распыления',
    zh: '喷雾气溶胶音效',
    tr: 'Püskürtme ses efektleri',
    fa: 'افکت صوتی پاشش اسپری',
  },
  reset: {
    ar: 'إعادة ضبط',
    en: 'Reset',
    fr: 'Réinitialiser',
    es: 'Reiniciar',
    it: 'Ripristina',
    de: 'Zurücksetzen',
    ru: 'Сброс',
    zh: '重置',
    tr: 'Sıfırla',
    fa: 'بازنشانی',
  },
  stage_flash_title: {
    ar: 'المرحلة 1: الانبثاق الذري وتبخر الكحول (0 - 5 دقائق)',
    en: 'Phase 1: Atomization & Alcohol Flash-Off (0 - 5 min)',
    fr: 'Phase 1 : Atomisation & flash d’alcool (0 - 5 min)',
    es: 'Fase 1: Atomización y evaporación del alcohol (0 - 5 min)',
    it: 'Fase 1: Atomizzazione e flash dell’alcol (0 - 5 min)',
    de: 'Phase 1: Zerstäubung & Alkoholverdampfung (0 - 5 Min.)',
    ru: 'Фаза 1: Распыление и мгновенное испарение спирта (0 - 5 мин)',
    zh: '阶段一：雾化喷出与乙醇闪蒸（0 - 5分钟）',
    tr: 'Aşama 1: Püskürtme ve alkolün uçması (0 - 5 dk)',
    fa: 'مرحله ۱: پاشش ذرات و تبخیر برق‌آسای الکل (۰ - ۵ دقیقه)',
  },
  stage_flash_desc: {
    ar: 'يندفع المزيج بضغط هوائي عالٍ (~50 ميكرون للقطرة). يتبخر الكحول الحامل خلال 30 ثانية ساحباً حرارة طفيفة من الجلد، بينما تتألق جزيئات القمة في أعلى درجات الفوحان.',
    en: 'Fine aerosol droplets (~50µm) strike the skin. Alcohol base evaporates within 30 seconds drawing slight latent heat, while volatile top notes explode into maximum projection.',
    fr: 'Les gouttelettes heurtent la peau. L’alcool s’évapore en 30 secondes et les notes de tête explosent avec un sillage maximal.',
    es: 'Las gotas impactan en la piel. El alcohol se evapora en 30 segundos y las notas de salida explotan con máxima proyección.',
    it: 'Le goccioline colpiscono la pelle. L’alcol evapora in 30 secondi e le note di testa esplodono con la massima proiezione.',
    de: 'Feine Aerosoltropfen treffen auf die Haut. Der Alkohol verdunstet in 30 Sekunden, während die Kopfnoten maximal strahlen.',
    ru: 'Капли попадают на кожу. Спирт испаряется за 30 секунд, а верхние ноты раскрываются на пике шлейфа.',
    zh: '约50微米的细腻微粒撞击皮肤。载体乙醇在30秒内迅速闪蒸带走微量体温，超高挥发度前调分子形成第一波强劲扩散光晕。',
    tr: 'İnce damlacıklar cilde çarpar. Taşıyıcı alkol 30 saniyede uçar ve üst notalar maksimum yayılımla patlar.',
    fa: 'قطرات ریز بر پوست می‌نشیند. الکل در ۳۰ ثانیه تبخیر شده و نت‌های اولیه با حداکثر پخش بو منفجر می‌شوند.',
  },
  stage_bloom_title: {
    ar: 'المرحلة 2: تفتح قلب العطر والاندماج مع حرارة الدم (15 - 120 دقيقة)',
    en: 'Phase 2: Heart Bloom & Pulse Thermal Diffusion (15 - 120 min)',
    fr: 'Phase 2 : Épanouissement du cœur & diffusion thermique (15 - 120 min)',
    es: 'Fase 2: Expansión del corazón y difusión térmica (15 - 120 min)',
    it: 'Phase 2: Fioritura del cuore e diffusione termica (15 - 120 min)',
    de: 'Phase 2: Herzentfaltung & thermische Diffusion (15 - 120 Min.)',
    ru: 'Фаза 2: Раскрытие сердца и тепловая диффузия (15 - 120 мин)',
    zh: '阶段二：中调盛放与脉搏体温共振扩散（15 - 120分钟）',
    tr: 'Aşama 2: Kalp notaların açılması ve termal difüzyon (15 - 120 dk)',
    fa: 'مرحله ۲: شکوفایی نت‌های میانی و گرماگیری از نبض (۱۵ - ۱۲۰ دقیقه)',
  },
  stage_bloom_desc: {
    ar: 'يهدأ الانفجار الأولي وتستقر طبقة الزيت العطري على إفرازات البشرة الدهنية. تُدفئ حرارة النبض جزيئات الزهور والتوابل لتتبخر بمعدل متوازن ومستقر.',
    en: 'Initial blast softens into a cohesive oil film on the lipid barrier. Skin pulse warmth continuously volatilizes floral and spice molecules at a steady, elegant rate.',
    fr: 'Le parfum s’installe sur le film lipidique. La chaleur du pouls libère progressivement fleurs et épices avec raffinement.',
    es: 'El perfume se asienta en la capa lipídica. El calor del pulso libera flores y especias de forma constante.',
    it: 'Il profumo si stabilizza sulla pelle. Il calore del polso diffonde fiori e spezie con eleganza uniforme.',
    de: 'Das Parfümöl verbindet sich mit der Haut. Die Pulswärme lässt Herznoten stetig und harmonisch aufsteigen.',
    ru: 'Парфюмерная плёнка взаимодействует с липидами кожи. Тепло пульса стабильно высвобождает ноты цветов и специй.',
    zh: '初始酒精刺激消退，香油形成亲脂性薄膜附着于角质层。手腕和颈部的脉搏热量促使花香与辛香料分子均匀、饱满地持续散发。',
    tr: 'İlk patlama yatışır ve parfüm yağı cilde oturur. Nabız sıcaklığı çiçek ve baharatları dengeli bir hızla buharlaştırır.',
    fa: 'انفجار اولیه آرام گرفته و لایه روغنی روی چربی پوست می‌نشیند. گرمای نبض نت‌های گلی و ادویه‌ای را یکنواخت متصاعد می‌کند.',
  },
  stage_base_title: {
    ar: 'المرحلة 3: رسو المثبتات العميقة والدراي داون (2 - 12+ ساعة)',
    en: 'Phase 3: Deep Fixative Anchoring & Drydown (2 - 12+ hours)',
    fr: 'Phase 3 : Ancrage profond des fixateurs & drydown (2 - 12+ h)',
    es: 'Fase 3: Fijación profunda y secado final (2 - 12+ horas)',
    it: 'Fase 3: Fissazione profonda e drydown (2 - 12+ ore)',
    de: 'Phase 3: Tiefe Fixierung & Drydown (2 - 12+ Std.)',
    ru: 'Фаза 3: Глубокая фиксация и шлейфовое угасание (2 - 12+ ч)',
    zh: '阶段三：深层定香锚定与尾调余韵（2 - 12+小时）',
    tr: 'Aşama 3: Derin sabitleyici tutunması ve kuruma fazı (2 - 12+ sa)',
    fa: 'مرحله ۳: لنگراندازی مولکول‌های تثبیت‌کننده و فرود نهایی (۲ - ۱۲+ ساعت)',
  },
  stage_base_desc: {
    ar: 'تتغلغل الجزيئات الكبيرة الثقيلة (المسك والعنبر والأخشاب) في الطبقة القرنية للبشرة. معدل تبخرها بطيء جداً بفعل انخفاض ضغطها البخاري، مما يمنح العطر ثباتاً أسطورياً يدوم طوال اليوم.',
    en: 'Heavy macrocyclic musks, amber resins, and woods intertwine with skin sebum. Ultra-low vapor pressure produces an intimate, all-day persistent aura.',
    fr: 'Les molécules lourdes (muscs, ambre, bois) s’ancrent dans la kératine. Leur faible tension de vapeur assure une tenue exceptionnelle.',
    es: 'Las moléculas pesadas se fijan en la queratina. Su bajísima presión de vapor garantiza una fijación duradera todo el día.',
    it: 'Le molecole pesanti si legano alla pelle. La bassissima pressione di vapore assicura una tenuta straordinaria per l’intera giornata.',
    de: 'Schwere Moleküle verbinden sich mit dem Keratin. Der extrem niedrige Dampfdruck sorgt für legendäre Ganztageshaftung.',
    ru: 'Тяжёлые молекулы мускуса и амбры проникают в роговой слой. Низкое давление пара обеспечивает стойкость на целый день.',
    zh: '大环麝香、龙涎香和木质树脂等重分子与皮脂蛋白深度交联。超低饱和蒸气压让其以极低速率缓慢释放，转化为亲肤而持久的贴身尾韵。',
    tr: 'Ağır misk ve kehribar molekülleri cilt lipitlerine bağlanır. Çok düşük buhar basıncı gün boyu süren derin bir kalıcılık sağlar.',
    fa: 'مولکول‌های سنگین مشک و عنبر و چوب با چربی پوست پیوند می‌خورند. فشار بخار بسیار پایین آن‌ها ماندگاری افسانه‌ای تمام روز را می‌آفریند.',
  },
  sprays_applied_tpl: {
    ar: 'عدد الرشات المطبقة: {n}',
    en: 'Sprays applied: {n}',
    fr: 'Pulvérisations appliquées : {n}',
    es: 'Pulverizaciones aplicadas: {n}',
    it: 'Spruzzi applicati: {n}',
    de: 'Aufgetragene Sprühstöße: {n}',
    ru: 'Нанесено распылений: {n}',
    zh: '已喷洒次数：{n}',
    tr: 'Uygulanan püskürtme: {n}',
    fa: 'تعداد پاشش‌های اعمال‌شده: {n}',
  },
  mins_tpl: {
    ar: '{m} دقيقة',
    en: '{m} mins',
    fr: '{m} min',
    es: '{m} min',
    it: '{m} min',
    de: '{m} Min.',
    ru: '{m} мин',
    zh: '{m} 分钟',
    tr: '{m} dk',
    fa: '{m} دقیقه',
  },
  hours_mins_tpl: {
    ar: '{h} ساعة و {m} د',
    en: '{h}h {m}m',
    fr: '{h} h {m} min',
    es: '{h}h {m}m',
    it: '{h}h {m}m',
    de: '{h} Std. {m} Min.',
    ru: '{h} ч {m} мин',
    zh: '{h}小时{m}分',
    tr: '{h} sa {m} dk',
    fa: '{h} ساعت و {m} دقیقه',
  },
} satisfies Record<string, LText>;

// Physical particle in the simulation canvas
interface SprayParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  tier: 'alcohol' | 'top' | 'heart' | 'base';
  alpha: number;
  maxLife: number;
  life: number;
  landed: boolean;
  evaporating: boolean;
}

export const PerfumeSpraySimulator: React.FC<PerfumeSpraySimulatorProps> = ({
  pyramidNotes,
  bottleVolumeMl = 50,
  concentrationPercent = 20,
  currentLang: propLang,
  onClose,
}) => {
  const { currentLang: ctxLang } = useLanguage();
  const effectiveLang = propLang || ctxLang || 'ar';
  const isRTL = effectiveLang === 'ar' || effectiveLang === 'fa';
  const L = makeT(effectiveLang, S);

  // Simulation Controls State
  const [currentMinutes, setCurrentMinutes] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2);
  const [skinTemp, setSkinTemp] = useState<number>(36.5);
  const [pulsePoint, setPulsePoint] = useState<'wrist' | 'neck' | 'elbow'>('wrist');
  const [activeView, setActiveView] = useState<'panoramic' | 'micro' | 'aura'>('panoramic');
  const [sprayCount, setSprayCount] = useState<number>(1);
  const [isAtomizerPressed, setIsAtomizerPressed] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isContinuous, setIsContinuous] = useState<boolean>(false);

  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<SprayParticle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Categorize formulation notes
  const enrichedNotes = pyramidNotes.map((note) => enrichPyramidNote(note, effectiveLang));
  const sortedNotes = sortNotesByVolatilityOrder(enrichedNotes);
  const topNotes = sortedNotes.filter((n) => n.category === 'top');
  const heartNotes = sortedNotes.filter((n) => n.category === 'heart');
  const baseNotes = sortedNotes.filter((n) => n.category === 'base');

  const topRatio = topNotes.reduce((acc, n) => acc + (n.percentageOfOil || 0), 0) || 30;
  const heartRatio = heartNotes.reduce((acc, n) => acc + (n.percentageOfOil || 0), 0) || 50;
  const baseRatio = baseNotes.reduce((acc, n) => acc + (n.percentageOfOil || 0), 0) || 20;

  // Real-time Thermodynamic Evaporation Kinetics
  const kinetics: EvaporationKinetics = calculateEvaporationKinetics(
    currentMinutes,
    concentrationPercent,
    skinTemp,
    topRatio,
    heartRatio,
    baseRatio
  );

  // Synthetic spray audio generator using Web Audio API white noise + lowpass filter
  const playSprayAudio = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Generate 0.3s of filtered pink/white noise for realistic pressurized aerosol hiss
      const bufferSize = ctx.sampleRate * 0.35;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Pink noise filtering
        lastOut = (lastOut * 0.94) + (white * 0.06);
        data[i] = lastOut * 1.8;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200, ctx.currentTime);
      filter.Q.setValueAtTime(1.2, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch {
      // AudioContext policy safe fallback
    }
  }, [soundEnabled]);

  // Emit a burst of particles from the atomizer nozzle
  const triggerSprayBurst = useCallback(() => {
    setIsAtomizerPressed(true);
    setSprayCount((prev) => Math.min(5, prev + 1));
    playSprayAudio();

    setTimeout(() => {
      setIsAtomizerPressed(false);
    }, 280);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    // Origin: nozzle position
    // RTL: bottle at right (w - 70), spraying leftward (-vx)
    // LTR: bottle at left (70), spraying rightward (+vx)
    const originX = isRTL ? w - 85 : 85;
    const originY = h * 0.48;
    const direction = isRTL ? -1 : 1;

    // Create 70 aerosol particles per burst
    const newParticles: SprayParticle[] = [];
    const burstCount = 65;

    for (let i = 0; i < burstCount; i++) {
      const spreadAngle = (Math.random() - 0.5) * 0.52; // ~30 deg spray cone
      const speed = 4.5 + Math.random() * 6.5;

      // Tier allocation based on formulation
      const roll = Math.random() * 100;
      let tier: 'alcohol' | 'top' | 'heart' | 'base' = 'alcohol';
      // 80% alcohol carrier in 20% perfume
      const alcoholPct = Math.max(50, 100 - concentrationPercent);
      if (roll < alcoholPct) {
        tier = 'alcohol';
      } else {
        const oilRoll = Math.random() * (topRatio + heartRatio + baseRatio);
        if (oilRoll < topRatio) tier = 'top';
        else if (oilRoll < topRatio + heartRatio) tier = 'heart';
        else tier = 'base';
      }

      newParticles.push({
        id: Date.now() + i + Math.random(),
        x: originX,
        y: originY,
        vx: Math.cos(spreadAngle) * speed * direction,
        vy: Math.sin(spreadAngle) * speed + (Math.random() - 0.5) * 1.2,
        size: tier === 'alcohol' ? 1.5 + Math.random() * 1.5 : tier === 'base' ? 3.0 + Math.random() * 2 : 2.2 + Math.random() * 1.8,
        tier,
        alpha: 0.95,
        maxLife: 70 + Math.random() * 40,
        life: 0,
        landed: false,
        evaporating: false,
      });
    }

    particlesRef.current = [...particlesRef.current, ...newParticles];
  }, [concentrationPercent, isRTL, playSprayAudio, topRatio, heartRatio, baseRatio]);

  // Continuous spray interval
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isContinuous) {
      triggerSprayBurst();
      timer = setInterval(() => {
        triggerSprayBurst();
      }, 400);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isContinuous, triggerSprayBurst]);

  // Playback loop for timeline minutes
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentMinutes((prev) => {
          if (prev >= 720) {
            setIsPlaying(false);
            return 720;
          }
          const step = playbackSpeed === 1 ? 5 : playbackSpeed === 2 ? 15 : playbackSpeed === 5 ? 35 : 75;
          return Math.min(720, prev + step);
        });
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackSpeed]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      const w = canvas.width;
      const h = canvas.height;

      // Clear Canvas with rich dark gradient
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#0c0a09');
      bgGrad.addColorStop(0.5, '#141210');
      bgGrad.addColorStop(1, '#080706');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Decorative subtle grid
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // -----------------------------------------------------------------------
      // VIEW MODE 1: PANORAMIC (BOTTLE ➔ ATOMIZER MIST CONE ➔ SKIN PULSE POINT)
      // -----------------------------------------------------------------------
      if (activeView === 'panoramic') {
        const bottleX = isRTL ? w - 90 : 90;
        const bottleY = h * 0.48;
        const skinX = isRTL ? 110 : w - 110;
        const skinY = h * 0.48;

        // 1. Draw Perfume Flacon & Atomizer
        ctx.save();
        ctx.translate(bottleX, bottleY);

        // Flacon Glass Body
        const bottleGrad = ctx.createLinearGradient(-30, 0, 30, 0);
        bottleGrad.addColorStop(0, 'rgba(217, 119, 6, 0.35)');
        bottleGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.65)');
        bottleGrad.addColorStop(1, 'rgba(180, 83, 9, 0.4)');

        ctx.fillStyle = bottleGrad;
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-24, -20, 48, 80, 10);
        ctx.fill();
        ctx.stroke();

        // Liquid level inside bottle
        ctx.fillStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.beginPath();
        ctx.roundRect(-20, 0, 40, 56, 6);
        ctx.fill();

        // Glass reflection stripe
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-14, -12);
        ctx.lineTo(-14, 52);
        ctx.stroke();

        // Metallic Collar & Pump
        ctx.fillStyle = '#d4af37'; // Gold collar
        ctx.fillRect(-12, -32, 24, 12);

        // Atomizer Push Actuator (depresses when pressed)
        const pressOffset = isAtomizerPressed ? 6 : 0;
        ctx.fillStyle = '#f3f4f6';
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-8, -46 + pressOffset, 16, 14, [4, 4, 1, 1]);
        ctx.fill();
        ctx.stroke();

        // Nozzle Hole & Spray Sparkle
        const nozzleX = isRTL ? -8 : 8;
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(nozzleX, -38 + pressOffset, 1.8, 0, Math.PI * 2);
        ctx.fill();

        if (isAtomizerPressed) {
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
          ctx.beginPath();
          ctx.arc(nozzleX, -38 + pressOffset, 8, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();

        // 2. Draw Target Anatomy: Wrist / Arm / Skin Barrier
        ctx.save();
        ctx.translate(skinX, skinY);

        // Skin Tone Gradient (Warm organic tone)
        const skinGrad = ctx.createLinearGradient(-40, 0, 40, 0);
        skinGrad.addColorStop(0, '#e29d78');
        skinGrad.addColorStop(0.5, '#f4b896');
        skinGrad.addColorStop(1, '#cb835d');

        // Arm / Wrist Column
        ctx.fillStyle = skinGrad;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(-30, -75, 60, 150, 20);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Subcutaneous Pulse Wave (Radial pulsation)
        const pulseCycle = (Date.now() / 600) % 1;
        const pulseAlpha = Math.max(0, 1 - pulseCycle);
        ctx.strokeStyle = `rgba(239, 68, 68, ${pulseAlpha * 0.45})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 12 + pulseCycle * 28, 0, Math.PI * 2);
        ctx.stroke();

        // Pulse Center point (Artery)
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Skin Surface Temperature Heat Shimmer
        if (skinTemp > 36.5) {
          ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 22, -Math.PI * 0.4, Math.PI * 0.4);
          ctx.stroke();
        }

        // Wet Oil Film Glistening on Skin
        const wetSheenAlpha = kinetics.oilRemainingOnSkinPct / 100;
        if (wetSheenAlpha > 0.05) {
          ctx.fillStyle = `rgba(245, 158, 11, ${wetSheenAlpha * 0.35})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, 26, 45, 0, 0, Math.PI * 2);
          ctx.fill();

          // Specular highlights
          ctx.fillStyle = `rgba(255, 255, 255, ${wetSheenAlpha * 0.4})`;
          ctx.beginPath();
          ctx.ellipse(-6, -10, 4, 8, Math.PI * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        // 3. Update & Draw Particles in Flight + Landing
        const currentParticles = particlesRef.current;
        const remainingParticles: SprayParticle[] = [];

        for (let i = 0; i < currentParticles.length; i++) {
          const p = currentParticles[i];
          p.life++;

          // Physics update
          if (!p.landed) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.985; // Air drag
            p.vy += 0.04;  // Slight gravity

            // Collision check with skin surface
            const distToSkin = Math.hypot(p.x - skinX, p.y - skinY);
            if (distToSkin < 38) {
              p.landed = true;
              p.vx = 0;
              p.vy = 0;
              // Stick to skin surface with small random offset
              p.x = skinX + (Math.random() - 0.5) * 28;
              p.y = skinY + (Math.random() - 0.5) * 65;
            }
          } else {
            // Once landed, particles behave according to temporal evaporation rate
            // Alcohol flashes off very fast
            if (p.tier === 'alcohol') {
              p.alpha -= 0.04;
            } else if (p.tier === 'top') {
              // Top notes evaporate steadily, creating rising vapor
              p.y -= 0.4 * (skinTemp / 36.5);
              p.x += (Math.random() - 0.5) * 0.6;
              p.alpha -= 0.008;
            } else if (p.tier === 'heart') {
              p.y -= 0.25 * (skinTemp / 36.5);
              p.alpha -= 0.004;
            } else {
              // Base notes anchor firmly and linger
              p.alpha -= 0.0015;
            }
          }

          if (p.life < p.maxLife * 3 && p.alpha > 0.02) {
            remainingParticles.push(p);

            // Render Particle
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

            if (p.tier === 'alcohol') {
              ctx.fillStyle = '#67e8f9'; // Translucent cyan/white
              ctx.shadowColor = '#38bdf8';
              ctx.shadowBlur = 4;
            } else if (p.tier === 'top') {
              ctx.fillStyle = '#fde047'; // Radiant gold/citrus
              ctx.shadowColor = '#eab308';
              ctx.shadowBlur = 6;
            } else if (p.tier === 'heart') {
              ctx.fillStyle = '#f43f5e'; // Rose / warm spice
              ctx.shadowColor = '#fb7185';
              ctx.shadowBlur = 5;
            } else {
              ctx.fillStyle = '#d97706'; // Rich amber/wood base
              ctx.shadowColor = '#b45309';
              ctx.shadowBlur = 6;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
        particlesRef.current = remainingParticles;

        // 4. Rising Evaporation Vapor Plumes from Skin into Air
        const plumeAlpha = (kinetics.evaporationRateMgPerHour / 3.0) * 0.45;
        if (plumeAlpha > 0.02) {
          ctx.save();
          const vaporGrad = ctx.createRadialGradient(skinX, skinY - 30, 5, skinX, skinY - 80, 75);
          if (kinetics.dominantVaporTier === 'top') {
            vaporGrad.addColorStop(0, `rgba(253, 224, 71, ${plumeAlpha})`);
            vaporGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
          } else if (kinetics.dominantVaporTier === 'heart') {
            vaporGrad.addColorStop(0, `rgba(244, 63, 94, ${plumeAlpha})`);
            vaporGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
          } else {
            vaporGrad.addColorStop(0, `rgba(217, 119, 6, ${plumeAlpha})`);
            vaporGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
          }
          ctx.fillStyle = vaporGrad;
          ctx.beginPath();
          ctx.ellipse(skinX, skinY - 60, 45, 70, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // -----------------------------------------------------------------------
      // VIEW MODE 2: MICROSCOPIC (SKIN LIPID LAYER & PORE FIXATION MATRIX)
      // -----------------------------------------------------------------------
      else if (activeView === 'micro') {
        const centerX = w / 2;
        const centerY = h * 0.65;

        // Stratum Corneum Cellular Matrix (Skin surface cross-section)
        ctx.fillStyle = '#292524';
        ctx.fillRect(0, centerY, w, h - centerY);

        // Cellular tile bricks
        ctx.strokeStyle = '#44403c';
        ctx.lineWidth = 1.5;
        for (let row = 0; row < 5; row++) {
          const y = centerY + row * 26;
          const offset = (row % 2) * 35;
          for (let x = -40; x < w + 40; x += 70) {
            ctx.strokeRect(x + offset, y, 68, 24);
          }
        }

        // Pores & Sebaceous lipid ducts
        const porePositions = [w * 0.25, w * 0.5, w * 0.75];
        porePositions.forEach((px) => {
          ctx.fillStyle = '#1c1917';
          ctx.beginPath();
          ctx.ellipse(px, centerY + 10, 16, 25, 0, 0, Math.PI * 2);
          ctx.fill();
        });

        // Lipidic Sebum Layer (Natural oils on skin)
        const lipidAlpha = Math.min(0.7, 0.25 + (kinetics.skinAdsorptionPercent / 100) * 0.45);
        ctx.fillStyle = `rgba(245, 158, 11, ${lipidAlpha})`;
        ctx.fillRect(0, centerY - 14, w, 14);

        // Perfume Oil Molecules Anchored inside Lipids
        const moleculeCount = Math.round(kinetics.oilRemainingOnSkinPct * 0.8);
        for (let i = 0; i < moleculeCount; i++) {
          const mx = (i * 37 + (currentMinutes * 3)) % (w - 40) + 20;
          const my = centerY - 6 + Math.sin(i * 1.5) * 8;

          // Base note fixatives anchor deepest
          if (i % 3 === 0) {
            ctx.fillStyle = '#d97706'; // Base fixative anchor
            ctx.beginPath();
            ctx.arc(mx, my + 4, 3.5, 0, Math.PI * 2);
            ctx.fill();
            // Anchor lock symbol
            ctx.strokeStyle = '#fef3c7';
            ctx.lineWidth = 1;
            ctx.strokeRect(mx - 2, my + 2, 4, 4);
          } else if (i % 3 === 1) {
            ctx.fillStyle = '#f43f5e'; // Heart
            ctx.beginPath();
            ctx.arc(mx, my, 3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = '#fde047'; // Top
            ctx.beginPath();
            ctx.arc(mx, my - 4, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Escaping Vapor Molecules ascending into atmosphere
        const escapingRate = Math.min(45, Math.round(kinetics.evaporationRateMgPerHour * 18));
        for (let j = 0; j < escapingRate; j++) {
          const ex = (j * 53 + (Date.now() / 30)) % w;
          const ey = centerY - 25 - ((Date.now() / 25 + j * 45) % (centerY - 40));
          ctx.fillStyle = kinetics.dominantVaporTier === 'top' ? '#fde047' : kinetics.dominantVaporTier === 'heart' ? '#f43f5e' : '#d97706';
          ctx.globalAlpha = 0.75;
          ctx.beginPath();
          ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }

        // Label annotation in canvas
        ctx.fillStyle = '#f3f4f6';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          pickArEn(
            effectiveLang,
            `الطبقة الدهنية والمسامات · نسبة الامتصاص والرسو: ${kinetics.skinAdsorptionPercent}%`,
            `Skin Lipid Barrier & Pores · Anchoring: ${kinetics.skinAdsorptionPercent}%`
          ),
          centerX,
          centerY + 70
        );
      }

      // -----------------------------------------------------------------------
      // VIEW MODE 3: SILLAGE AURA (SPATIAL 3D PROJECTION BUBBLE)
      // -----------------------------------------------------------------------
      else if (activeView === 'aura') {
        const centerX = w / 2;
        const centerY = h / 2;

        // Human Silhouette in Center
        ctx.fillStyle = '#44403c';
        ctx.beginPath();
        // Head
        ctx.arc(centerX, centerY - 32, 14, 0, Math.PI * 2);
        ctx.fill();
        // Torso
        ctx.beginPath();
        ctx.roundRect(centerX - 18, centerY - 14, 36, 65, [14, 14, 6, 6]);
        ctx.fill();

        // Radiating 3D Scent Bubbles scaled to sillageRadiusMeters
        const radiusPixels = Math.min(w * 0.46, kinetics.sillageRadiusMeters * 55);

        // Concentric Rings
        [0.35, 0.65, 1.0].forEach((ratio, idx) => {
          const r = radiusPixels * ratio;
          const auraGrad = ctx.createRadialGradient(centerX, centerY, r * 0.6, centerX, centerY, r);

          if (kinetics.dominantVaporTier === 'top') {
            auraGrad.addColorStop(0, `rgba(253, 224, 71, ${0.15 / (idx + 1)})`);
            auraGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
          } else if (kinetics.dominantVaporTier === 'heart') {
            auraGrad.addColorStop(0, `rgba(244, 63, 94, ${0.18 / (idx + 1)})`);
            auraGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
          } else {
            auraGrad.addColorStop(0, `rgba(217, 119, 6, ${0.22 / (idx + 1)})`);
            auraGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
          }

          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = idx === 2 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(255, 255, 255, 0.15)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        });

        // Radius meter tag
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${kinetics.sillageRadiusMeters}m Radius`, centerX, centerY - radiusPixels - 8);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [activeView, currentMinutes, isAtomizerPressed, isRTL, kinetics, skinTemp, effectiveLang]);

  // Stage narrative texts
  const currentStageInfo =
    currentMinutes < 5
      ? { title: L('stage_flash_title'), desc: L('stage_flash_desc'), icon: Zap, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
      : currentMinutes < 120
      ? { title: L('stage_bloom_title'), desc: L('stage_bloom_desc'), icon: Sparkles, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' }
      : { title: L('stage_base_title'), desc: L('stage_base_desc'), icon: Activity, color: 'text-amber-300 bg-amber-950/40 border-amber-800/40' };

  return (
    <div className="bg-stone-950 text-white rounded-3xl border border-amber-500/30 shadow-2xl overflow-hidden space-y-6 p-5 sm:p-7 relative font-sans">
      
      {/* Background ambient light */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold">
            <Atom className="w-3.5 h-3.5 animate-spin" />
            <span>{L('sim_badge')}</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black font-serif-luxury text-white tracking-wide">
            {L('sim_title')}
          </h3>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
            {L('sim_desc')}
          </p>
        </div>

        {/* View Perspective Switcher & Audio Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-stone-900 border border-stone-800 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setActiveView('panoramic')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'panoramic' ? 'bg-amber-600 text-white font-bold shadow-xs' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{L('view_panoramic')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('micro')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'micro' ? 'bg-amber-600 text-white font-bold shadow-xs' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{L('view_micro')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('aura')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'aura' ? 'bg-amber-600 text-white font-bold shadow-xs' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Waves className="w-3.5 h-3.5" />
              <span>{L('view_aura')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              soundEnabled ? 'bg-amber-500/20 border-amber-400/40 text-amber-300' : 'bg-stone-900 border-stone-800 text-stone-500'
            }`}
            title={L('sound_toggle')}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Interactive Stage: Simulation Canvas */}
      <div className="relative rounded-2xl overflow-hidden border border-amber-500/25 bg-stone-950 shadow-inner">
        <canvas
          ref={canvasRef}
          width={840}
          height={340}
          className="w-full h-[280px] sm:h-[340px] block cursor-crosshair"
          onClick={triggerSprayBurst}
        />

        {/* Floating Direct Spray Action HUD */}
        <div className="absolute top-4 start-4 flex flex-wrap items-center gap-2.5 z-20">
          <button
            type="button"
            onClick={triggerSprayBurst}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-stone-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Wind className="w-4 h-4 animate-pulse" />
            <span>{L('btn_spray')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsContinuous(!isContinuous)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              isContinuous
                ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30 animate-pulse'
                : 'bg-stone-900/80 hover:bg-stone-800 text-stone-200 border-stone-700'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>{L('btn_continuous')}</span>
          </button>

          <span className="text-[11px] font-mono-numbers px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-stone-300">
            {fmt(L('sprays_applied_tpl'), { n: sprayCount })}
          </span>
        </div>

        {/* Floating Anatomical Pulse Point Selector */}
        <div className="absolute bottom-4 start-4 flex items-center gap-1.5 z-20 bg-black/70 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 text-[11px]">
          <span className="text-stone-400 font-semibold">{L('skin_temp_lbl')}</span>
          <button
            type="button"
            onClick={() => setPulsePoint('wrist')}
            className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
              pulsePoint === 'wrist' ? 'bg-amber-600 text-white font-bold' : 'text-stone-300 hover:bg-white/10'
            }`}
          >
            {L('target_wrist')}
          </button>
          <button
            type="button"
            onClick={() => setPulsePoint('neck')}
            className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
              pulsePoint === 'neck' ? 'bg-amber-600 text-white font-bold' : 'text-stone-300 hover:bg-white/10'
            }`}
          >
            {L('target_neck')}
          </button>
          <button
            type="button"
            onClick={() => setPulsePoint('elbow')}
            className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
              pulsePoint === 'elbow' ? 'bg-amber-600 text-white font-bold' : 'text-stone-300 hover:bg-white/10'
            }`}
          >
            {L('target_elbow')}
          </button>
        </div>

        {/* Floating Skin Temperature Slider */}
        <div className="absolute bottom-4 end-4 flex items-center gap-2 z-20 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[11px]">
          <Thermometer className="w-3.5 h-3.5 text-rose-400" />
          <span className="font-mono-numbers font-bold text-amber-300">{skinTemp.toFixed(1)}°C</span>
          <input
            type="range"
            min="33"
            max="39"
            step="0.5"
            value={skinTemp}
            onChange={(e) => setSkinTemp(parseFloat(e.target.value))}
            className="w-16 accent-amber-500 cursor-pointer h-1.5 bg-stone-700 rounded-lg"
          />
        </div>
      </div>

      {/* 5-Column Live Telemetry Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        
        {/* Metric 1: Remaining Alcohol */}
        <div className="bg-stone-900/90 p-3.5 rounded-2xl border border-stone-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-stone-400">
            <span>{L('telemetry_alcohol_flash')}</span>
            <Droplets className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-cyan-300">
            {kinetics.alcoholRemainingPct}%
          </div>
          <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-cyan-400 h-full transition-all duration-300"
              style={{ width: `${kinetics.alcoholRemainingPct}%` }}
            />
          </div>
          <span className="text-[10px] text-stone-500 block">
            {kinetics.alcoholRemainingPct === 0 ? uiLabel('alcohol_evaporated', effectiveLang) : uiLabel('alcohol_flash', effectiveLang)}
          </span>
        </div>

        {/* Metric 2: Anchored Oil on Skin */}
        <div className="bg-stone-900/90 p-3.5 rounded-2xl border border-stone-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-stone-400">
            <span>{L('telemetry_skin_oil')}</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-amber-300">
            {kinetics.oilRemainingOnSkinPct}%
          </div>
          <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{ width: `${kinetics.oilRemainingOnSkinPct}%` }}
            />
          </div>
          <span className="text-[10px] text-stone-500 block">
            {uiLabel('skin_residue', effectiveLang)}
          </span>
        </div>

        {/* Metric 3: Evaporation Rate */}
        <div className="bg-stone-900/90 p-3.5 rounded-2xl border border-stone-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-stone-400">
            <span>{L('telemetry_evap_rate')}</span>
            <Wind className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-rose-300">
            {kinetics.evaporationRateMgPerHour} <span className="text-xs font-normal text-stone-400">mg/cm²/h</span>
          </div>
          <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-rose-500 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, kinetics.evaporationRateMgPerHour * 35)}%` }}
            />
          </div>
          <span className="text-[10px] text-stone-500 block">
            {kinetics.evaporationRateMgPerHour > 1.0 ? uiLabel('emissive_active', effectiveLang) : uiLabel('velvet_drift', effectiveLang)}
          </span>
        </div>

        {/* Metric 4: Sillage Projection */}
        <div className="bg-stone-900/90 p-3.5 rounded-2xl border border-stone-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-stone-400">
            <span>{L('telemetry_sillage')}</span>
            <Waves className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-amber-400">
            {kinetics.sillageRadiusMeters} <span className="text-xs font-normal text-stone-400">m</span>
          </div>
          <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-amber-700 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, (kinetics.sillageRadiusMeters / 3.5) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-stone-500 block">
            {kinetics.sillageRadiusMeters >= 2.0 ? uiLabel('sillage_huge', effectiveLang) : kinetics.sillageRadiusMeters >= 1.0 ? uiLabel('aura_elegant', effectiveLang) : uiLabel('skin_close', effectiveLang)}
          </span>
        </div>

        {/* Metric 5: Active Vapor Dominance */}
        <div className="bg-stone-900/90 p-3.5 rounded-2xl border border-stone-800 space-y-1.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[11px] text-stone-400">
            <span>{uiLabel('air_aura', effectiveLang)}</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          </div>
          <div className="font-mono-numbers text-base font-bold text-white flex items-center gap-1.5">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                kinetics.dominantVaporTier === 'top'
                  ? 'bg-yellow-400 shadow-md shadow-yellow-400/50'
                  : kinetics.dominantVaporTier === 'heart'
                  ? 'bg-rose-500 shadow-md shadow-rose-500/50'
                  : 'bg-amber-600 shadow-md shadow-amber-600/50'
              }`}
            />
            <span className="truncate">
              {kinetics.dominantVaporTier === 'top'
                ? uiLabel('tier_top', effectiveLang)
                : kinetics.dominantVaporTier === 'heart'
                ? uiLabel('tier_heart', effectiveLang)
                : uiLabel('tier_base', effectiveLang)}
            </span>
          </div>
          <div className="text-[10px] text-stone-400 font-mono-numbers pt-1 flex justify-between">
            <span>T:{kinetics.vaporComposition.topPct}%</span>
            <span>H:{kinetics.vaporComposition.heartPct}%</span>
            <span>B:{kinetics.vaporComposition.basePct}%</span>
          </div>
        </div>

      </div>

      {/* Interactive Timeline Scrubber & Controller */}
      <div className="bg-stone-900/90 p-4 sm:p-5 rounded-2xl border border-stone-800 space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="font-bold text-stone-200 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>{L('timeline_lbl')}</span>
            <span className="text-amber-400 font-mono-numbers font-bold text-sm bg-black/60 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
              {currentMinutes < 60
                ? fmt(L('mins_tpl'), { m: currentMinutes })
                : fmt(L('hours_mins_tpl'), { h: Math.floor(currentMinutes / 60), m: currentMinutes % 60 })}
            </span>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold transition-all cursor-pointer flex items-center gap-1 text-xs"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'إيقاف' : 'تشغيل المحاكاة'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setCurrentMinutes(0);
              }}
              className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors cursor-pointer border border-stone-700"
              title={L('reset')}
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="px-2 py-1 bg-stone-800 border border-stone-700 rounded-lg text-xs font-mono-numbers text-stone-200 focus:outline-none"
            >
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
              <option value={15}>15x Fast</option>
            </select>
          </div>
        </div>

        {/* Range Scrubber */}
        <div className="space-y-1">
          <input
            type="range"
            min="0"
            max="720"
            step="5"
            value={currentMinutes}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentMinutes(Number(e.target.value));
            }}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-stone-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-stone-400 font-mono-numbers">
            <span>0m ({uiLabel('tl_spray', effectiveLang)})</span>
            <span>15m ({uiLabel('tl_top', effectiveLang)})</span>
            <span>1h ({uiLabel('tl_heart', effectiveLang)})</span>
            <span>4h ({uiLabel('tl_base', effectiveLang)})</span>
            <span>8h ({uiLabel('tl_drydown', effectiveLang)})</span>
            <span>12h+ ({uiLabel('tl_trail', effectiveLang)})</span>
          </div>
        </div>

        {/* Quick Jump Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
          {[
            { m: 0, label: '0m رذاذ أولي' },
            { m: 15, label: '15m فوران القمة' },
            { m: 60, label: '1h تفتح القلب' },
            { m: 180, label: '3h رسو القاعدة' },
            { m: 480, label: '8h دراي داون' },
            { m: 720, label: '12h+ أثر جلدي' },
          ].map((preset) => (
            <button
              key={preset.m}
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setCurrentMinutes(preset.m);
              }}
              className={`py-1.5 px-2 rounded-xl text-[11px] font-medium text-center transition-all cursor-pointer truncate border ${
                Math.abs(currentMinutes - preset.m) < 15
                  ? 'bg-amber-600 text-white font-bold border-amber-400 shadow-sm'
                  : 'bg-stone-950/60 border-stone-800 text-stone-300 hover:bg-stone-800'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stage Narrative Callout Card */}
      <div className={`p-4 rounded-2xl border ${currentStageInfo.color} space-y-2`}>
        <div className="flex items-center gap-2">
          <currentStageInfo.icon className="w-4 h-4 shrink-0" />
          <h4 className="font-bold text-sm font-serif-luxury text-white">
            {currentStageInfo.title}
          </h4>
        </div>
        <p className="text-xs text-stone-200 leading-relaxed font-sans">
          {currentStageInfo.desc}
        </p>
      </div>

      {/* Molecular Volatility Legend */}
      <div className="p-3.5 bg-stone-900/60 rounded-xl border border-stone-800/80 text-[11px] space-y-1.5 text-stone-400">
        <div className="font-semibold text-stone-300 mb-1 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-amber-400" />
          <span>{uiLabel('evap_legend', effectiveLang)} (Molecular Evaporation Legend):</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
            <span>{L('legend_top')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span>{L('legend_heart')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0" />
            <span>{L('legend_base')}</span>
          </div>
        </div>
      </div>

    </div>
  );
};
