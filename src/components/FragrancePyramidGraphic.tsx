import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Wind,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Activity,
  Layers,
  Award,
  ShieldCheck,
  CheckCircle2,
  Droplets,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Share2,
  Sliders,
  Scale,
} from 'lucide-react';
import { PyramidNote, CalculationResult } from '../types/perfume';
import { SupportedLanguage } from '../types/i18n';
import { formatNum } from '../utils/calculations';
import { useLanguage } from '../context/LanguageContext';
import { LText, makeT, fmt, pickArEn } from '../utils/localize';
import {
  enrichPyramidNote,
  sortNotesByVolatilityOrder,
  generateCustomSprayScenario,
  getNoteActivityAtMinute,
  EvolutionScenarioStage,
} from '../utils/volatilityHelper';


const S = {
  clip_tpl: {
    ar: `🧪 السيناريو التخيلي لعطر ({vol} مل - تركيز {conc}%):
{story}

المرحلة الحالية [{time}]:
• الفوحان: {rating} ({sillage}%)
• ما يحدث: {happens}
• الانطباع الشمي: {perception}
• نصيحة العطار: {advice}

توزيع الهرم العطري:
- القمة ({top}%): {top_notes}
- القلب ({heart}%): {heart_notes}
- القاعدة ({base}%): {base_notes}`,
    en: `🧪 Fragrance Evolution Scenario ({vol}ml - {conc}% Conc):
{story}

Current Phase [{time}]:
• Sillage: {rating} ({sillage}%)
• What happens: {happens}
• Olfactory perception: {perception}
• Perfumer advice: {advice}

Pyramid Distribution:
- Top ({top}%): {top_notes}
- Heart ({heart}%): {heart_notes}
- Base ({base}%): {base_notes}`,
    fr: `🧪 Scénario d’évolution ({vol} ml - {conc} %) :
{story}

Phase actuelle [{time}] :
• Sillage : {rating} ({sillage} %)
• Ce qui se passe : {happens}
• Perception olfactive : {perception}
• Conseil du parfumeur : {advice}

Répartition de la pyramide :
- Tête ({top} %) : {top_notes}
- Cœur ({heart} %) : {heart_notes}
- Fond ({base} %) : {base_notes}`,
    es: `🧪 Escenario de evolución ({vol} ml - {conc} %):
{story}

Fase actual [{time}]:
• Estela: {rating} ({sillage}%)
• Qué ocurre: {happens}
• Percepción olfativa: {perception}
• Consejo del perfumista: {advice}

Distribución de la pirámide:
- Salida ({top}%): {top_notes}
- Corazón ({heart}%): {heart_notes}
- Fondo ({base}%): {base_notes}`,
    it: `🧪 Scenario di evoluzione ({vol} ml - {conc}%):
{story}

Fase attuale [{time}]:
• Scia: {rating} ({sillage}%)
• Cosa accade: {happens}
• Percezione olfattiva: {perception}
• Consiglio del profumiere: {advice}

Ripartizione della piramide:
- Testa ({top}%): {top_notes}
- Cuore ({heart}%): {heart_notes}
- Fondo ({base}%): {base_notes}`,
    de: `🧪 Duftentwicklungsszenario ({vol} ml - {conc} %):
{story}

Aktuelle Phase [{time}]:
• Sillage: {rating} ({sillage} %)
• Was geschieht: {happens}
• Olfaktorische Wahrnehmung: {perception}
• Parfümeurrat: {advice}

Pyramidenverteilung:
- Kopf ({top} %): {top_notes}
- Herz ({heart} %): {heart_notes}
- Basis ({base} %): {base_notes}`,
    ru: `🧪 Сценарий развития аромата ({vol} мл — {conc}%):
{story}

Текущая фаза [{time}]:
• Шлейф: {rating} ({sillage}%)
• Что происходит: {happens}
• Восприятие: {perception}
• Совет парфюмера: {advice}

Структура пирамиды:
- Верх ({top}%): {top_notes}
- Сердце ({heart}%): {heart_notes}
- База ({base}%): {base_notes}`,
    zh: `🧪 香水演变情景（{vol}ml - {conc}%）：
{story}

当前阶段【{time}】：
• 扩散：{rating}（{sillage}%）
• 正在发生：{happens}
• 嗅觉印象：{perception}
• 调香建议：{advice}

金字塔分布：
- 前调（{top}%）：{top_notes}
- 中调（{heart}%）：{heart_notes}
- 后调（{base}%）：{base_notes}`,
    tr: `🧪 Koku gelişim senaryosu ({vol} ml - %{conc}):
{story}

Mevcut faz [{time}]:
• İz: {rating} (%{sillage})
• Ne oluyor: {happens}
• Koku algısı: {perception}
• Parfümör tavsiyesi: {advice}

Piramit dağılımı:
- Üst (%{top}): {top_notes}
- Kalp (%{heart}): {heart_notes}
- Dip (%{base}): {base_notes}`,
    fa: `🧪 سناریوی تحول عطر ({vol} میلی‌لیتر - {conc}٪):
{story}

فاز فعلی [{time}]:
• انتشار: {rating} ({sillage}٪)
• چه می‌گذرد: {happens}
• ادراک بویایی: {perception}
• توصیه عطرساز: {advice}

توزیع هرم:
- ابتدایی ({top}٪): {top_notes}
- میانی ({heart}٪): {heart_notes}
- پایانی ({base}٪): {base_notes}`,
  },
  badge_1: { ar: 'تطاير فوري (أول 15 دقيقة) 💨', en: 'Instant Flash (0-15m) 💨', fr: 'Éclat immédiat (0-15 min) 💨', es: 'Destello instantáneo (0-15m) 💨', it: 'Flash istantaneo (0-15m) 💨', de: 'Sofortblitz (0-15 Min.) 💨', ru: 'Мгновенный всплеск (0-15 мин) 💨', zh: '瞬间迸发（0-15分钟）💨', tr: 'Anında parlama (0-15 dk) 💨', fa: 'شعله‌ور لحظه‌ای (۰-۱۵ دقیقه) 💨' },
  badge_2: { ar: 'تطاير سريع (15-45 دقيقة) ⚡', en: 'Fast Evaporation (15-45m) ⚡', fr: 'Évaporation rapide (15-45 min) ⚡', es: 'Evaporación rápida (15-45m) ⚡', it: 'Evaporazione rapida (15-45m) ⚡', de: 'Schnelle Verdunstung (15-45 Min.) ⚡', ru: 'Быстрое испарение (15-45 мин) ⚡', zh: '快速挥发（15-45分钟）⚡', tr: 'Hızlı buharlaşma (15-45 dk) ⚡', fa: 'تبخیر سریع (۱۵-۴۵ دقیقه) ⚡' },
  badge_3: { ar: 'تبخر متزن (1-4 ساعات) 🌸', en: 'Balanced Mid Bloom (1-4h) 🌸', fr: 'Floraison équilibrée (1-4 h) 🌸', es: 'Floración equilibrada (1-4h) 🌸', it: 'Fioritura equilibrata (1-4h) 🌸', de: 'Ausgewogene Blüte (1-4 Std.) 🌸', ru: 'Сбалансированное цветение (1-4 ч) 🌸', zh: '均衡绽放（1-4小时）🌸', tr: 'Dengeli açılım (1-4 sa) 🌸', fa: 'شکوفایی متعادل (۱-۴ ساعت) 🌸' },
  badge_4: { ar: 'تبخر بطيء (4-8 ساعات) ⏳', en: 'Slow Drydown (4-8h) ⏳', fr: 'Séchage lent (4-8 h) ⏳', es: 'Secado lento (4-8h) ⏳', it: 'Asciugatura lenta (4-8h) ⏳', de: 'Langsames Abtrocknen (4-8 Std.) ⏳', ru: 'Медленное высыхание (4-8 ч) ⏳', zh: '缓慢收干（4-8小时）⏳', tr: 'Yavaş kuruma (4-8 sa) ⏳', fa: 'خشک‌شدن آرام (۴-۸ ساعت) ⏳' },
  badge_5: { ar: 'ثبات أقصى (12-24+ ساعة) ⚓', en: 'Maximum Tenacity (12-24h+) ⚓', fr: 'Tenacité maximale (12-24 h+) ⚓', es: 'Tenacidad máxima (12-24h+) ⚓', it: 'Tenacia massima (12-24h+) ⚓', de: 'Maximale Haftfestigkeit (12-24 Std.+) ⚓', ru: 'Максимальная стойкость (12-24 ч+) ⚓', zh: '极致持久（12-24小时+）⚓', tr: 'Maksimum kalıcılık (12-24 sa+) ⚓', fa: 'ماندگاری حداکثر (۱۲-۲۴+ ساعت) ⚓' },
  atomized: { ar: 'تم ضغط رذاذ العطر! (Atomization Flash)', en: 'Perfume Atomized! (Atomization Flash)', fr: 'Parfum pulvérisé ! (Flash d’atomisation)', es: '¡Perfume atomizado! (Flash de atomización)', it: 'Profumo nebulizzato! (Flash di atomizzazione)', de: 'Parfüm zerstäubt! (Zerstäubungsblitz)', ru: 'Духи распылены! (Вспышка распыления)', zh: '香水已喷出！（雾化闪光）', tr: 'Parfüm püskürtüldü! (Atomizasyon flaşı)', fa: 'عطر اسپری شد! (پالس اتمیزاسیون)' },
  atomized_desc_tpl: { ar: 'تفتت السائل إلى ملايين الجزيئات الدقيقة، انطلاق أسرع الجزيئات طيراناً «{n}» في محيط 3 أمتار، وبدء العداد الزمني لمسار التبخر...', en: 'The liquid shatters into millions of micro-droplets; fastest flyer «{n}» launches across a ~3-meter radius as the evaporation clock starts...', fr: 'Le liquide se fractionne en millions de gouttelettes ; « {n} », la plus volatile, s’élance sur ~3 mètres…', es: 'El líquido se fragmenta en millones de microgotas; «{n}», la más volátil, se lanza a ~3 metros…', it: 'Il liquido si frammenta in milioni di microgocce; «{n}», la più volatile, si diffonde per ~3 metri…', de: 'Die Flüssigkeit zerfällt in Millionen Mikrotröpfchen; «{n}», der flüchtigste Duft, strahlt ~3 Meter weit…', ru: 'Жидкость распадается на миллионы микрокапель; самый летучий «{n}» разлетается на ~3 метра…', zh: '液体碎裂为数百万微滴；最快挥发的「{n}」向约 3 米范围扩散……', tr: 'Sıvı milyonlarca mikro damlaya bölünür; en uçucu olan «{n}» ~3 metre yayılır…', fa: 'مایع به میلیون‌ها قطره ریز تبدیل می‌شود؛ فرّارترین یعنی «{n}» در شعاع ۳ متری پخش می‌شود…' },
  badge_top: { ar: 'جرافيك الهرم العطري التفاعلي ومحاكي التطور الشمي', en: 'Interactive Fragrance Pyramid & Olfactory Evolution', fr: 'Pyramide interactive & évolution olfactive', es: 'Pirámide interactiva y evolución olfativa', it: 'Piramide interattiva ed evoluzione olfattiva', de: 'Interaktive Duftpyramide & olfaktorische Entwicklung', ru: 'Интерактивная пирамида и ольфакторная динамика', zh: '交互式香调金字塔与嗅觉演变', tr: 'Etkileşimli koku piramidi ve evrim', fa: 'هرم عطری تعاملی و تحول بویایی' },
  page_desc_tpl: { ar: 'توزيع جزيئات الزيت العطري ({w} جم) مرتبة هندسياً حسب سرعة التطاير، مع إدراج نسب كل مكون وسيناريو تخيلي حي لما يحدث على مدار 24 ساعة.', en: 'Aromachemical distribution ({w}g concentrate) ordered by molecular volatility rates, featuring real-time 24-hour spray evolution scenario.', fr: 'Distribution des molécules ({w} g de concentré) selon leur volatilité, avec scénario d’évolution sur 24 heures.', es: 'Distribución de moléculas ({w} g de concentrado) según volatilidad, con escenario de evolución de 24 horas.', it: 'Distribuzione delle molecole ({w} g di concentrato) secondo la volatilità, con scenario di evoluzione di 24 ore.', de: 'Verteilung der Moleküle ({w} g Konzentrat) nach Flüchtigkeit, mit 24-Stunden-Evolutionsszenario.', ru: 'Распределение молекул ({w} г концентрата) по летучести, со сценарием 24-часовой эволюции.', zh: '按分子挥发性排列的成分分布（{w}g 浓缩物），并附 24 小时实时演变情景。', tr: 'Moleküllerin uçuculuğa göre dağılımı ({w} g konsantre), 24 saatlik evrim senaryosu ile.', fa: 'توزیع مولکول‌ها ({w} گرم کنسانتره) بر اساس فراریت، همراه با سناریوی ۲۴ ساعته تحول.' },
  simulate_cta: { ar: 'محاكاة رش العطر الآن 💨', en: 'Simulate Perfume Spray 💨', fr: 'Simuler la pulvérisation 💨', es: 'Simular pulverización 💨', it: 'Simula lo spray 💨', de: 'Sprühvorgang simulieren 💨', ru: 'Смоделировать распыление 💨', zh: '立即模拟喷洒 💨', tr: 'Püskürtmeyi simüle et 💨', fa: 'شبیه‌سازی اسپری عطر 💨' },
  copy_scenario_tooltip: { ar: 'نسخ ملخص السيناريو التخيلي', en: 'Copy scenario summary', fr: 'Copier le résumé du scénario', es: 'Copiar resumen del escenario', it: 'Copia riepilogo scenario', de: 'Szenario-Zusammenfassung kopieren', ru: 'Скопировать сводку сценария', zh: '复制情景摘要', tr: 'Senaryo özetini kopyala', fa: 'کپی خلاصه سناریو' },
  copied_ok: { ar: 'تم النسخ بنجاح!', en: 'Copied Successfully!', fr: 'Copié !', es: '¡Copiado!', it: 'Copiato!', de: 'Kopiert!', ru: 'Скопировано!', zh: '已复制！', tr: 'Kopyalandı!', fa: 'با موفقیت کپی شد!' },
  share_scenario: { ar: 'مشاركة السيناريو', en: 'Share Scenario', fr: 'Partager le scénario', es: 'Compartir escenario', it: 'Condividi scenario', de: 'Szenario teilen', ru: 'Поделиться сценарием', zh: '分享情景', tr: 'Senaryoyu paylaş', fa: 'همرسانی سناریو' },
  total_ratio: { ar: 'مجموع نسب الهرم:', en: 'Pyramid Total Ratio:', fr: 'Ratio total de la pyramide :', es: 'Proporción total:', it: 'Rapporto totale:', de: 'Gesamtverhältnis:', ru: 'Сумма долей:', zh: '金字塔总占比：', tr: 'Piramit toplam oranı:', fa: 'مجموع نسبت‌های هرم:' },
  balanced: { ar: '✓ موزون بالكامل 100%', en: '✓ Perfectly Balanced 100%', fr: '✓ Parfaitement équilibré 100 %', es: '✓ Perfectamente equilibrado 100%', it: '✓ Perfettamente bilanciato 100%', de: '✓ Perfekt ausbalanciert 100 %', ru: '✓ Идеальный баланс 100%', zh: '✓ 完美均衡 100%', tr: '✓ Mükemmel dengeli %100', fa: '✓ کاملاً متعادل ۱۰۰٪' },
  needs_adjust: { ar: '⚠ يحتاج ضبط للوصول لـ 100%', en: '⚠ Adjust to reach 100%', fr: '⚠ Ajustez pour atteindre 100 %', es: '⚠ Ajuste para llegar al 100%', it: '⚠ Regola per arrivare al 100%', de: '⚠ Auf 100 % anpassen', ru: '⚠ Отрегулируйте до 100%', zh: '⚠ 需调整至 100%', tr: '⚠ %100’e ulaşmak için ayarlayın', fa: '⚠ برای رسیدن به ۱۰۰٪ تنظیم کنید' },
  fastest_lbl: { ar: 'أسرع مكون طيراناً:', en: 'Fastest Volatile Note:', fr: 'Note la plus volatile :', es: 'Nota más volátil:', it: 'Nota più volatile:', de: 'Flüchtigste Note:', ru: 'Самая летучая нота:', zh: '最易挥发香材：', tr: 'En uçucu nota:', fa: 'فرّارترین ماده:' },
  fastest_desc: { ar: 'يتبخر خلال أول 15 دقيقة', en: 'Evaporates in first 15 mins', fr: 'S’évapore dans les 15 premières minutes', es: 'Se evapora en los primeros 15 minutos', it: 'Si evapora nei primi 15 minuti', de: 'Verdunstet in den ersten 15 Minuten', ru: 'Испаряется в первые 15 минут', zh: '前 15 分钟内挥发', tr: 'İlk 15 dakikada buharlaşır', fa: 'در ۱۵ دقیقه نخست تبخیر می‌شود' },
  anchor_lbl: { ar: 'أثقل مكون ثباتاً:', en: 'Deepest Foundation Anchor:', fr: 'Ancrage le plus profond :', es: 'Anclaje más profundo:', it: 'Ancoraggio più profondo:', de: 'Tiefste Basis:', ru: 'Глубочайший якорь базы:', zh: '最深沉的锚定香材：', tr: 'En derin sabitleyici:', fa: 'پایدارترین ماده:' },
  anchor_desc: { ar: 'يرسو ويدوم حتى 24+ ساعة', en: 'Anchors & lasts 24+ hours', fr: 'S’ancre et tient 24 h et plus', es: 'Ancla y dura 24+ horas', it: 'Ancora e dura 24+ ore', de: 'Verankert & hält 24+ Stunden', ru: 'Держится более 24 часов', zh: '锚定并持续 24+ 小时', tr: 'Sabitler ve 24+ saat kalır', fa: 'تا بیش از ۲۴ ساعت می‌ماند' },
  count_lbl: { ar: 'عدد مكونات الزيت:', en: 'Oil Ingredients Count:', fr: 'Nombre d’ingrédients :', es: 'Número de ingredientes:', it: 'Numero di ingredienti:', de: 'Anzahl der Zutaten:', ru: 'Количество ингредиентов:', zh: '香材数量：', tr: 'Malzeme sayısı:', fa: 'تعداد مواد:' },
  notes_word: { ar: 'نوتة', en: 'notes', fr: 'notes', es: 'notas', it: 'note', de: 'Noten', ru: 'нот', zh: '个香材', tr: 'nota', fa: 'نت' },
  top_word: { ar: 'قمة', en: 'top', fr: 'tête', es: 'salida', it: 'testa', de: 'Kopf', ru: 'верх', zh: '前调', tr: 'üst', fa: 'ابتدایی' },
  heart_word: { ar: 'قلب', en: 'heart', fr: 'cœur', es: 'corazón', it: 'cuore', de: 'Herz', ru: 'сердце', zh: '中调', tr: 'kalp', fa: 'میانی' },
  base_word: { ar: 'قاعدة', en: 'base', fr: 'fond', es: 'fondo', it: 'fondo', de: 'Basis', ru: 'база', zh: '后调', tr: 'dip', fa: 'پایه' },
  pyramid_diagram_lbl: { ar: 'الرسم التخطيطي للهرم العطري (Fragrance Pyramid)', en: 'Fragrance Olfactory Pyramid Architecture', fr: 'Architecture de la pyramide olfactive', es: 'Arquitectura de la pirámide olfativa', it: 'Architettura della piramide olfattiva', de: 'Duftpyramiden-Architektur', ru: 'Структура ольфакторной пирамиды', zh: '香调金字塔结构图', tr: 'Koku piramidi mimarisi', fa: 'ساختار هرم بویایی' },
  diagram_desc: { ar: 'مرتبة من قمة الهرم (الأسرع طيراناً أولاً) إلى القاعدة الراسخة', en: 'Ordered from apex (fastest flyers first) to the anchored base', fr: 'De l’apex (plus volatil) à la base ancrée', es: 'Del ápice (más volátil) a la base anclada', it: 'Dall’apice (più volatile) alla base ancorata', de: 'Von der Spitze (flüchtigste zuerst) zur verankerten Basis', ru: 'От вершины (самые летучие) к якорной базе', zh: '从顶端（最快挥发）到稳固基底', tr: 'Tepeden (en uçucu) sabit tabana', fa: 'از قله (فرّارترین) تا پایه مستحکم' },
  full_pyramid: { ar: 'كامل الهرم', en: 'Full Pyramid', fr: 'Pyramide complète', es: 'Pirámide completa', it: 'Piramide completa', de: 'Ganze Pyramide', ru: 'Вся пирамида', zh: '完整金字塔', tr: 'Tüm piramit', fa: 'کل هرم' },
  layers_lbl: { ar: 'المخطط الهندسي لطبقات الهرم (انقر للتصفية)', en: 'Geometric Pyramid Architecture (Click to filter)', fr: 'Architecture géométrique (cliquer pour filtrer)', es: 'Arquitectura geométrica (clic para filtrar)', it: 'Architettura geometrica (clic per filtrare)', de: 'Geometrische Architektur (zum Filtern klicken)', ru: 'Геометрия пирамиды (клик для фильтра)', zh: '金字塔层结构（点击筛选）', tr: 'Geometrik mimari (filtrelemek için tıkla)', fa: 'ساختار لایه‌های هرم (کلیک برای فیلتر)' },
  active_phase_tpl: { ar: 'الطبقة الفاعلة حالياً ({m}د): ', en: 'Active Phase at ({m}m): ', fr: 'Phase active ({m} min) : ', es: 'Fase activa ({m}m): ', it: 'Fase attuale ({m}m): ', de: 'Aktive Phase ({m} Min.): ', ru: 'Активная фаза ({m} мин): ', zh: '当前活跃层（{m}分）：', tr: 'Aktif faz ({m} dk): ', fa: 'لایه فعال ({m} دقیقه): ' },
  apex_lbl: { ar: 'قمة الهرم (Apex) 💨', en: 'Apex (Top Notes) 💨', fr: 'Apex (notes de tête) 💨', es: 'Ápice (notas de salida) 💨', it: 'Apice (note di testa) 💨', de: 'Spitze (Kopfnoten) 💨', ru: 'Вершина (верхние ноты) 💨', zh: '顶端（前调）💨', tr: 'Tepe (üst notalar) 💨', fa: 'قله (نت‌های ابتدایی) 💨' },
  core_lbl: { ar: 'قلب العطر (Heart) 🌸', en: 'Core Bouquet (Heart) 🌸', fr: 'Bouquet central (cœur) 🌸', es: 'Ramo central (corazón) 🌸', it: 'Bouquet centrale (cuore) 🌸', de: 'Herzbouquet 🌸', ru: 'Ядро букета (сердце) 🌸', zh: '核心花束（中调）🌸', tr: 'Çekirdek buket (kalp) 🌸', fa: 'دسته‌گل مرکزی (قلب) 🌸' },
  deep_lbl: { ar: 'قاعدة العطر (Base) ⚓', en: 'Deep Base (Foundation) ⚓', fr: 'Fond profond ⚓', es: 'Fondo profundo ⚓', it: 'Fondo profondo ⚓', de: 'Tiefe Basis ⚓', ru: 'Глубокая база ⚓', zh: '深邃基底（后调）⚓', tr: 'Derin dip ⚓', fa: 'پایه عمیق ⚓' },
  top_notes_lbl: { ar: 'قمة العطر (Top)', en: 'Top Notes (Apex)', fr: 'Notes de tête', es: 'Notas de salida', it: 'Note di testa', de: 'Kopfnoten', ru: 'Верхние ноты', zh: '前调', tr: 'Üst notalar', fa: 'نت‌های ابتدایی' },
  top_notes_desc: { ar: 'تطاير فوري', en: 'Instant Flash', fr: 'Éclat immédiat', es: 'Destello instantáneo', it: 'Flash istantaneo', de: 'Sofortblitz', ru: 'Мгновенный всплеск', zh: '瞬间迸发', tr: 'Anında parlama', fa: 'شعله‌ور لحظه‌ای' },
  heart_notes_lbl: { ar: 'قلب العطر (Heart)', en: 'Heart Notes (Bloom)', fr: 'Notes de cœur', es: 'Notas de corazón', it: 'Note di cuore', de: 'Herznoten', ru: 'Ноты сердца', zh: '中调', tr: 'Kalp notaları', fa: 'نت‌های میانی' },
  heart_notes_desc: { ar: 'زهور وتوابل', en: 'Florals & Spices', fr: 'Floraux et épicés', es: 'Florales y especias', it: 'Floreali e speziate', de: 'Floral & Würzig', ru: 'Цветы и специи', zh: '花香与香料', tr: 'Çiçeksi ve baharat', fa: 'گل‌ها و ادویه‌ها' },
  base_notes_lbl: { ar: 'قاعدة العطر (Base)', en: 'Base Notes (Anchorage)', fr: 'Notes de fond', es: 'Notas de fondo', it: 'Note di fondo', de: 'Basisnoten', ru: 'Базовые ноты', zh: '后调', tr: 'Dip notaları', fa: 'نت‌های پایه' },
  base_notes_desc: { ar: 'أخشاب وعنبر ومسك', en: 'Woods, Amber & Musks', fr: 'Boisés, ambres et muscs', es: 'Maderas, ámbar y almizcles', it: 'Legnosi, ambre e muschi', de: 'Hölzer, Amber & Moschus', ru: 'Дерево, амбра и мускус', zh: '木质、琥珀与麝香', tr: 'Odunsu, amber ve misk', fa: 'چوب، عنبر و مشک' },
  top_active_badge: { ar: 'في أوج النشاط 💨', en: 'Active Flash 💨', fr: 'Éclat actif 💨', es: 'Destello activo 💨', it: 'Flash attivo 💨', de: 'Aktiver Blitz 💨', ru: 'Активный всплеск 💨', zh: '活跃迸发 💨', tr: 'Aktif parlama 💨', fa: 'در اوج فعالیت 💨' },
  top_section_desc: { ar: 'أسرع الجزيئات طيراناً (Monoterpenes) · أول ما يشم عند الرش (0 - 15 دقيقة)', en: 'Fastest volatilization (Monoterpenes) · First impression upon spraying (0 - 15m)', fr: 'Volatilisation la plus rapide (monoterpènes) · première impression (0-15 min)', es: 'Volatilización más rápida (monoterpenos) · primera impresión (0-15m)', it: 'Volatilizzazione più rapida (monoterpeni) · prima impressione (0-15m)', de: 'Schnellste Verdunstung (Monoterpene) · erster Eindruck (0-15 Min.)', ru: 'Самое быстрое испарение (монотерпены) · первое впечатление (0-15 мин)', zh: '最快挥发（单萜烯）· 喷洒后的第一印象（0-15分钟）', tr: 'En hızlı uçuculuk (monoterpenler) · ilk izlenim (0-15 dk)', fa: 'سریع‌ترین تبخیر (مونوترپن‌ها) · اولین برداشت (۰-۱۵ دقیقه)' },
  heart_active_badge: { ar: 'في ذروة الفوحان 🌸', en: 'Peak Heart Bloom 🌸', fr: 'Pic du cœur 🌸', es: 'Plenitud del corazón 🌸', it: 'Apice del cuore 🌸', de: 'Höhepunkt des Herzens 🌸', ru: 'Пик сердечных нот 🌸', zh: '中调盛放 🌸', tr: 'Kalbin zirvesi 🌸', fa: 'اوج شکوفایی قلب 🌸' },
  heart_section_desc: { ar: 'الزهور والتوابل والفواكه · الرائحة السائدة التي يلاحظها الجميع (2 - 6 ساعات)', en: 'Florals, spices, and aromatics · Signature heart perceived by everyone (2 - 6h)', fr: 'Fleurs, épices et fruits · cœur caractéristique perçu par tous (2-6 h)', es: 'Flores, especias y frutas · corazón característico que todos perciben (2-6h)', it: 'Fiori, spezie e frutti · cuore caratteristico percepito da tutti (2-6h)', de: 'Blüten, Gewürze und Früchte · markantes Herz, das alle wahrnehmen (2-6 Std.)', ru: 'Цветы, специи и фрукты · фирменное сердце, которое слышат все (2-6 ч)', zh: '花香、香料与果香 · 人人可感的标志性中调（2-6小时）', tr: 'Çiçek, baharat ve meyveler · herkesin algıladığı imza kalp (2-6 sa)', fa: 'گل، ادویه و میوه · قلب شاخصی که همه حس می‌کنند (۲-۶ ساعت)' },
  base_active_badge: { ar: 'رسو وثبات أسطوري ⚓', en: 'Deep Anchorage ⚓', fr: 'Ancrage profond ⚓', es: 'Anclaje profundo ⚓', it: 'Ancoraggio profondo ⚓', de: 'Tiefe Verankerung ⚓', ru: 'Глубокая якорная стоянка ⚓', zh: '深沉锚定 ⚓', tr: 'Derin sabitlenme ⚓', fa: 'لنگراندازی عمیق ⚓' },
  base_section_desc: { ar: 'أثقل الجزيئات (Macrocyclics) · أساس التثبيت والفوحان الحميم (6 - 24+ ساعة)', en: 'Heavy high-boiling macrocyclics · Deep foundation & intimate trail (6 - 24h+)', fr: 'Macrocycles lourds · fond profond et sillage intime (6-24 h+)', es: 'Macrociclos pesados · fondo profundo y estela íntima (6-24h+)', it: 'Macrocicli pesanti · fondo profondo e scia intima (6-24h+)', de: 'Schwere Makrozyklen · tiefe Basis & intime Spur (6-24 Std.+)', ru: 'Тяжёлые макроциклы · глубокая база и интимный шлейф (6-24 ч+)', zh: '大环分子 · 深邃基底与贴肤余韵（6-24+小时）', tr: 'Ağır makrosiklikler · derin taban ve ten yakını iz (6-24+ sa)', fa: 'ماکروسیکل‌های سنگین · پایه عمیق و رد صمیمی (۶-۲۴+ ساعت)' },
  no_top: { ar: 'لم يتم إدراج نوتات قمة بعد.', en: 'No top notes added yet.', fr: 'Aucune note de tête ajoutée.', es: 'Aún no hay notas de salida.', it: 'Nessuna nota di testa aggiunta.', de: 'Noch keine Kopfnoten hinzugefügt.', ru: 'Верхние ноты ещё не добавлены.', zh: '尚未添加前调香材。', tr: 'Henüz üst nota eklenmedi.', fa: 'هنوز نت ابتدایی اضافه نشده است.' },
  no_heart: { ar: 'لم يتم إدراج نوتات قلب بعد.', en: 'No heart notes added yet.', fr: 'Aucune note de cœur ajoutée.', es: 'Aún no hay notas de corazón.', it: 'Nessuna nota di cuore aggiunta.', de: 'Noch keine Herznoten hinzugefügt.', ru: 'Ноты сердца ещё не добавлены.', zh: '尚未添加中调香材。', tr: 'Henüz kalp notası eklenmedi.', fa: 'هنوز نت میانی اضافه نشده است.' },
  no_base: { ar: 'لم يتم إدراج نوتات قاعدة بعد.', en: 'No base notes added yet.', fr: 'Aucune note de fond ajoutée.', es: 'Aún no hay notas de fondo.', it: 'Nessuna nota di fondo aggiunta.', de: 'Noch keine Basisnoten hinzugefügt.', ru: 'Базовые ноты ещё не добавлены.', zh: '尚未添加后调香材。', tr: 'Henüz dip notası eklenmedi.', fa: 'هنوز نت پایه اضافه نشده است.' },
  lifespan_tpl: { ar: 'مدة التبخر: {v}', en: 'Lifespan: {v}', fr: 'Durée de vie : {v}', es: 'Duración: {v}', it: 'Durata: {v}', de: 'Lebensdauer: {v}', ru: 'Время жизни: {v}', zh: '存续时间：{v}', tr: 'Yaşam süresi: {v}', fa: 'مدت تبخیر: {v}' },
  tenacity_tpl: { ar: 'مدة الثبات: {v}', en: 'Tenacity: {v}', fr: 'Tenacité : {v}', es: 'Tenacidad: {v}', it: 'Tenacia: {v}', de: 'Haftfestigkeit: {v}', ru: 'Стойкость: {v}', zh: '持久时间：{v}', tr: 'Kalıcılık: {v}', fa: 'مدت ماندگاری: {v}' },
  presence_tpl: { ar: 'حالة النوتة عند ({m}د):', en: 'Presence at ({m}m):', fr: 'Présence à ({m} min) :', es: 'Presencia a los ({m}m):', it: 'Presenza a ({m}m):', de: 'Präsenz bei ({m} Min.):', ru: 'Присутствие на ({m} мин):', zh: '在 {m} 分钟时的状态：', tr: '({m} dk) durumundaki varlık:', fa: 'حالت نت در ({m} دقیقه):' },
  active_tpl: { ar: 'النشاط الشمي: {v}%', en: 'Active: {v}%', fr: 'Actif : {v} %', es: 'Activo: {v}%', it: 'Attivo: {v}%', de: 'Aktiv: {v} %', ru: 'Активность: {v}%', zh: '活跃度：{v}%', tr: 'Aktif: %{v}', fa: 'فعالیت بویایی: {v}٪' },
  evaporated_tpl: { ar: 'المتبخر: {v}%', en: 'Evaporated: {v}%', fr: 'Évaporé : {v} %', es: 'Evaporado: {v}%', it: 'Evaporato: {v}%', de: 'Verdunstet: {v} %', ru: 'Испарилось: {v}%', zh: '已挥发：{v}%', tr: 'Buharlaşan: %{v}', fa: 'تبخیرشده: {v}٪' },
  scenario_lbl: { ar: 'السيناريو التخيلي: ماذا يحدث بعد رش العطر؟', en: 'Virtual Scenario: What happens after spraying?', fr: 'Scénario virtuel : que se passe-t-il après la pulvérisation ?', es: 'Escenario virtual: ¿qué ocurre tras pulverizar?', it: 'Scenario virtuale: cosa accade dopo lo spray?', de: 'Virtuelles Szenario: Was passiert nach dem Sprühen?', ru: 'Виртуальный сценарий: что происходит после распыления?', zh: '虚拟情景：喷洒后会发生什么？', tr: 'Sanal senaryo: püskürtmeden sonra ne olur?', fa: 'سناریوی مجازی: پس از اسپری چه می‌گذرد؟' },
  scenario_desc: { ar: 'محاكاة حسية لرحلة تبخر الجزيئات وتناوب النوتات وتفاعلها مع كيمياء البشرة.', en: 'Sensory simulation of molecular evaporation, olfactory succession, and skin chemistry interaction.', fr: 'Simulation sensorielle de l’évaporation, de la succession des notes et de la chimie de la peau.', es: 'Simulación sensorial de la evaporación, la sucesión de notas y la química de la piel.', it: 'Simulazione sensoriale dell’evaporazione, della successione delle note e della chimica della pelle.', de: 'Sinnliche Simulation von Verdunstung, Notenwechsel und Hautchemie.', ru: 'Сенсорная симуляция испарения, смены нот и химии кожи.', zh: '分子挥发、香调更迭与肌肤化学反应的感官模拟。', tr: 'Buharlaşma, nota değişimi ve cilt kimyasının duyusal simülasyonu.', fa: 'شبیه‌سازی حسی تبخیر مولکول‌ها، جانشینی نت‌ها و برهم‌کنش شیمیایی پوست.' },
  mins_tpl: { ar: '{m} دقيقة', en: '{m} mins', fr: '{m} min', es: '{m} min', it: '{m} min', de: '{m} Min.', ru: '{m} мин', zh: '{m} 分钟', tr: '{m} dk', fa: '{m} دقیقه' },
  hours_mins_tpl: { ar: '{h} ساعة و {m} د', en: '{h}h {m}m', fr: '{h} h {m} min', es: '{h}h {m}m', it: '{h}h {m}m', de: '{h} Std. {m} Min.', ru: '{h} ч {m} мин', zh: '{h}小时{m}分', tr: '{h} sa {m} dk', fa: '{h} ساعت و {m} دقیقه' },
  timeline_lbl: { ar: 'المؤقت الزمني للمحاكاة:', en: 'Simulation Timeline:', fr: 'Chronologie de la simulation :', es: 'Línea de tiempo:', it: 'Sequenza temporale:', de: 'Simulationszeitleiste:', ru: 'Таймлайн симуляции:', zh: '模拟时间轴：', tr: 'Simülasyon zaman çizelgesi:', fa: 'خط زمانی شبیه‌سازی:' },
  pause: { ar: 'إيقاف', en: 'Pause', fr: 'Pause', es: 'Pausa', it: 'Pausa', de: 'Pause', ru: 'Пауза', zh: '暂停', tr: 'Duraklat', fa: 'توقف' },
  play: { ar: 'تشغيل', en: 'Play', fr: 'Lecture', es: 'Reproducir', it: 'Riproduci', de: 'Abspielen', ru: 'Играть', zh: '播放', tr: 'Oynat', fa: 'پخش' },
  reset_tooltip: { ar: 'إعادة للبداية', en: 'Reset to start', fr: 'Recommencer', es: 'Reiniciar', it: 'Riavvia', de: 'Zum Start zurücksetzen', ru: 'Сброс к началу', zh: '重置到起点', tr: 'Başa dön', fa: 'بازگشت به شروع' },
  spray_word: { ar: 'الرش', en: 'Spray', fr: 'Pulvérisation', es: 'Pulverización', it: 'Spray', de: 'Sprühen', ru: 'Распыление', zh: '喷洒', tr: 'Püskürtme', fa: 'اسپری' },
  elapsed_tpl: { ar: 'الوقت الفعلي: {t}', en: 'Elapsed: {t}', fr: 'Écoulé : {t}', es: 'Transcurrido: {t}', it: 'Trascorso: {t}', de: 'Vergangen: {t}', ru: 'Прошло: {t}', zh: '已进行：{t}', tr: 'Geçen: {t}', fa: 'زمان سپری‌شده: {t}' },
  phase_lbl: { ar: 'المرحلة: ', en: 'Phase: ', fr: 'Phase : ', es: 'Fase: ', it: 'Fase: ', de: 'Phase: ', ru: 'Фаза: ', zh: '阶段：', tr: 'Faz: ', fa: 'مرحله: ' },
  phase_top: { ar: 'القمة', en: 'Top Notes', fr: 'Notes de tête', es: 'Notas de salida', it: 'Note di testa', de: 'Kopfnoten', ru: 'Верхние ноты', zh: '前调', tr: 'Üst notalar', fa: 'نت‌های ابتدایی' },
  phase_heart: { ar: 'القلب', en: 'Heart Notes', fr: 'Notes de cœur', es: 'Notas de corazón', it: 'Note di cuore', de: 'Herznoten', ru: 'Ноты сердца', zh: '中调', tr: 'Kalp notaları', fa: 'نت‌های میانی' },
  phase_base: { ar: 'القاعدة والجفاف', en: 'Base & Drydown', fr: 'Fond et séchage', es: 'Fondo y secado', it: 'Fondo e asciugatura', de: 'Basis & Abtrocknen', ru: 'База и высыхание', zh: '后调与收干', tr: 'Dip ve kuruma', fa: 'پایه و خشک‌شدن' },
  sillage_metric_lbl: { ar: 'مؤشر الفوحان والانتشار (Sillage):', en: 'Sillage & Projection Metric:', fr: 'Indicateur de sillage :', es: 'Métrica de estela:', it: 'Metrica della scia:', de: 'Sillage-Kennzahl:', ru: 'Показатель шлейфа:', zh: '扩散力指标：', tr: 'İz ve yayılım göstergesi:', fa: 'شاخص انتشار:' },
  skin_tpl: { ar: 'الأثر على الجلد: {v}% متبقٍ', en: 'Skin adhesion: {v}% remaining', fr: 'Adhésion cutanée : {v} % restant', es: 'Adhesión cutánea: {v}% restante', it: 'Adesione cutanea: {v}% rimanente', de: 'Haftung auf der Haut: {v} % verbleibend', ru: 'Сцепление с кожей: осталось {v}%', zh: '肌肤附着：剩余 {v}%', tr: 'Cilt tutunması: %{v} kaldı', fa: 'چسبندگی به پوست: {v}٪ باقی' },
  radar_lbl: { ar: 'رادار ومحيط انتشار الرائحة (Scent Aura Radar)', en: 'Scent Sillage Aura Radar', fr: 'Radar d’aura du sillage', es: 'Radar del aura de estela', it: 'Radar dell’aura della scia', de: 'Duft-Aura-Radar', ru: 'Радар ауры шлейфа', zh: '香气光晕雷达', tr: 'Koku aurası radarı', fa: 'رادار هاله رایحه' },
  radius_3: { ar: 'محيط الفوحان: ~3.0 أمتار', en: 'Projection Radius: ~3.0 meters', fr: 'Rayon de sillage : ~3,0 m', es: 'Radio de proyección: ~3,0 m', it: 'Raggio di proiezione: ~3,0 m', de: 'Projektionsradius: ~3,0 m', ru: 'Радиус шлейфа: ~3,0 м', zh: '扩散半径：约 3.0 米', tr: 'Yayılım yarıçapı: ~3,0 m', fa: 'شعاع انتشار: ~۳.۰ متر' },
  radius_2: { ar: 'محيط الفوحان: ~2.0 أمتار', en: 'Projection Radius: ~2.0 meters', fr: 'Rayon de sillage : ~2,0 m', es: 'Radio de proyección: ~2,0 m', it: 'Raggio di proiezione: ~2,0 m', de: 'Projektionsradius: ~2,0 m', ru: 'Радиус шлейфа: ~2,0 м', zh: '扩散半径：约 2.0 米', tr: 'Yayılım yarıçapı: ~2,0 m', fa: 'شعاع انتشار: ~۲.۰ متر' },
  radius_12: { ar: 'محيط الفوحان: ~1.2 أمتار', en: 'Projection Radius: ~1.2 meters', fr: 'Rayon de sillage : ~1,2 m', es: 'Radio de proyección: ~1,2 m', it: 'Raggio di proiezione: ~1,2 m', de: 'Projektionsradius: ~1,2 m', ru: 'Радиус шлейфа: ~1,2 м', zh: '扩散半径：约 1.2 米', tr: 'Yayılım yarıçapı: ~1,2 m', fa: 'شعاع انتشار: ~۱.۲ متر' },
  radius_05: { ar: 'محيط الفوحان: ~0.5 متر', en: 'Projection Radius: ~0.5 meter', fr: 'Rayon de sillage : ~0,5 m', es: 'Radio de proyección: ~0,5 m', it: 'Raggio di proiezione: ~0,5 m', de: 'Projektionsradius: ~0,5 m', ru: 'Радиус шлейфа: ~0,5 м', zh: '扩散半径：约 0.5 米', tr: 'Yayılım yarıçapı: ~0,5 m', fa: 'شعاع انتشار: ~۰.۵ متر' },
  skin_close: { ar: 'ملاصق للبشرة (~0.1 م)', en: 'Skin-Close (~0.1m)', fr: 'Près de la peau (~0,1 m)', es: 'Junto a la piel (~0,1 m)', it: 'Vicino alla pelle (~0,1 m)', de: 'Hautnah (~0,1 m)', ru: 'У самой кожи (~0,1 м)', zh: '贴肤（约 0.1 米）', tr: 'Cilt yakını (~0,1 m)', fa: 'چسبیده به پوست (~۰.۱ متر)' },
  burst: { ar: 'انفجاري', en: 'Burst', fr: 'Explosif', es: 'Explosivo', it: 'Esplosivo', de: 'Explosiv', ru: 'Взрывной', zh: '爆发', tr: 'Patlayıcı', fa: 'انفجاری' },
  wide: { ar: 'واسع', en: 'Wide', fr: 'Large', es: 'Amplio', it: 'Ampio', de: 'Weit', ru: 'Широкий', zh: '宽广', tr: 'Geniş', fa: 'گسترده' },
  intimate: { ar: 'حميمي', en: 'Intimate', fr: 'Intime', es: 'Íntimo', it: 'Intimo', de: 'Intim', ru: 'Интимный', zh: '贴身', tr: 'Samimi', fa: 'صمیمی' },
  skin: { ar: 'ملاصق', en: 'Skin', fr: 'Peau', es: 'Piel', it: 'Pelle', de: 'Haut', ru: 'Кожа', zh: '贴肤', tr: 'Cilt', fa: 'چسبیده' },
  chemistry_lbl: { ar: 'ماذا يحدث كيميائياً وفي الأجواء؟', en: 'What happens chemically & in the air?', fr: 'Que se passe-t-il chimiquement ?', es: '¿Qué ocurre químicamente?', it: 'Cosa accade chimicamente?', de: 'Was geschieht chemisch?', ru: 'Что происходит химически?', zh: '化学层面发生了什么？', tr: 'Kimyasal olarak ne oluyor?', fa: 'از نظر شیمیایی چه می‌گذرد؟' },
  perception_lbl: { ar: 'الانطباع الشمي للمحيطين بك (ما يشمه الأنف الآن):', en: 'Olfactory Perception (What observers perceive):', fr: 'Perception olfactive (ce que les autres sentent) :', es: 'Percepción olfativa (lo que otros perciben):', it: 'Percezione olfattiva (ciò che gli altri avvertono):', de: 'Olfaktorische Wahrnehmung (was andere riechen):', ru: 'Восприятие окружающих (что чувствуют носы):', zh: '嗅觉印象（旁人此刻所闻）：', tr: 'Koku algısı (etrafındakilerin duyduğu):', fa: 'ادراک بویایی اطرافیان (آنچه بینی‌ها اکنون می‌بوید):' },
  advice_lbl: { ar: 'نصيحة العطار لهذه المرحلة:', en: 'Master Perfumer Advice for this phase:', fr: 'Conseil du parfumeur pour cette phase :', es: 'Consejo del perfumista para esta fase:', it: 'Consiglio del profumiere per questa fase:', de: 'Parfümeurrat für diese Phase:', ru: 'Совет парфюмера для этой фазы:', zh: '此阶段的调香师建议：', tr: 'Bu faz için usta parfümör tavsiyesi:', fa: 'توصیه عطرساز برای این مرحله:' },
} satisfies Record<string, LText>;

interface FragrancePyramidGraphicProps {
  pyramidNotes: PyramidNote[];
  setPyramidNotes: React.Dispatch<React.SetStateAction<PyramidNote[]>>;
  result: CalculationResult;
  bottleVolumeMl?: number;
  concentrationPercent?: number;
  currentLang?: SupportedLanguage;
}

export const FragrancePyramidGraphic: React.FC<FragrancePyramidGraphicProps> = ({
  pyramidNotes,
  setPyramidNotes,
  result,
  bottleVolumeMl = 100,
  concentrationPercent = 20,
  currentLang: propLang,
}) => {
  const { currentLang: ctxLang, t } = useLanguage();
  const effectiveLang = propLang || ctxLang || 'ar';
  const isRTL = effectiveLang === 'ar' || effectiveLang === 'fa';
  const L = makeT(effectiveLang, S);

  // Enriched and volatility-sorted notes
  const enrichedNotes = pyramidNotes.map(enrichPyramidNote);
  const sortedNotes = sortNotesByVolatilityOrder(enrichedNotes);

  const topNotes = sortedNotes.filter((n) => n.category === 'top');
  const heartNotes = sortedNotes.filter((n) => n.category === 'heart');
  const baseNotes = sortedNotes.filter((n) => n.category === 'base');

  const topPct = topNotes.reduce((acc, n) => acc + (n.percentageOfOil || 0), 0);
  const heartPct = heartNotes.reduce((acc, n) => acc + (n.percentageOfOil || 0), 0);
  const basePct = baseNotes.reduce((acc, n) => acc + (n.percentageOfOil || 0), 0);
  const totalPct = topPct + heartPct + basePct;
  const isBalanced100 = Math.abs(totalPct - 100) < 0.1;

  // Selected tier for inspection
  const [selectedTier, setSelectedTier] = useState<'all' | 'top' | 'heart' | 'base'>('all');

  // Simulation state: minutes elapsed (0 to 720)
  const [currentMinutes, setCurrentMinutes] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [sprayAnimationActive, setSprayAnimationActive] = useState<boolean>(false);
  const [copiedScenario, setCopiedScenario] = useState<boolean>(false);

  // Scenario generation
  const scenario = generateCustomSprayScenario(pyramidNotes, bottleVolumeMl, concentrationPercent);
  const { stages } = scenario;

  // Determine active stage based on currentMinutes
  const activeStage = stages.reduce((prev, curr) => {
    return currentMinutes >= curr.timeMinutes ? curr : prev;
  }, stages[0]);

  // Animation timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentMinutes((prev) => {
          if (prev >= 720) {
            setIsPlaying(false);
            return 720;
          }
          const increment = playbackSpeed === 1 ? 5 : playbackSpeed === 2 ? 15 : 45;
          return Math.min(720, prev + increment);
        });
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackSpeed]);

  const handleTriggerSpray = () => {
    setSprayAnimationActive(true);
    setCurrentMinutes(0);
    setIsPlaying(true);
    setTimeout(() => {
      setSprayAnimationActive(false);
    }, 1800);
  };

  const handleResetSimulation = () => {
    setIsPlaying(false);
    setCurrentMinutes(0);
  };

  const handleUpdateNotePct = (id: string, pct: number) => {
    setPyramidNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, percentageOfOil: Math.max(0, pct) } : n))
    );
  };

  const handleCopyScenario = () => {
    const text = fmt(L('clip_tpl'), {
      vol: bottleVolumeMl,
      conc: concentrationPercent,
      story: pickArEn(effectiveLang, scenario.summaryStory, scenario.summaryStoryEn || scenario.summaryStory),
      time: pickArEn(effectiveLang, activeStage.timeLabelAr, activeStage.timeLabelEn || activeStage.timeLabelAr),
      rating: pickArEn(effectiveLang, activeStage.sillageRating, activeStage.sillageRatingEn || activeStage.sillageRating),
      sillage: activeStage.sillagePercent,
      happens: pickArEn(effectiveLang, activeStage.whatHappensTextAr, activeStage.whatHappensTextEn || activeStage.whatHappensTextAr),
      perception: pickArEn(effectiveLang, activeStage.olfactoryPerceptionTextAr, activeStage.olfactoryPerceptionTextEn || activeStage.olfactoryPerceptionTextAr),
      advice: pickArEn(effectiveLang, activeStage.adviceForWearerAr, activeStage.adviceForWearerEn || activeStage.adviceForWearerAr),
      top: topPct,
      heart: heartPct,
      base: basePct,
      top_notes: topNotes.map((n) => `${pickArEn(effectiveLang, n.nameAr, n.nameEn || n.nameAr)} ${n.percentageOfOil}%`).join(', '),
      heart_notes: heartNotes.map((n) => `${pickArEn(effectiveLang, n.nameAr, n.nameEn || n.nameAr)} ${n.percentageOfOil}%`).join(', '),
      base_notes: baseNotes.map((n) => `${pickArEn(effectiveLang, n.nameAr, n.nameEn || n.nameAr)} ${n.percentageOfOil}%`).join(', '),
    });

    navigator.clipboard.writeText(text);
    setCopiedScenario(true);
    setTimeout(() => setCopiedScenario(false), 2500);
  };

  const getNoteWeightGrams = (pct: number) => {
    return (result.oilWeightGrams * pct) / 100;
  };

  const getNoteVolumeMl = (pct: number) => {
    return (result.oilVolumeMl * pct) / 100;
  };

  // Volatility color badge
  const getVolatilityBadge = (rank: number) => {
    if (rank <= 2) {
      return {
        bg: 'bg-amber-100 text-amber-900 border-amber-300',
        text: L('badge_1'),
        highlight: 'text-amber-600',
      };
    } else if (rank <= 4) {
      return {
        bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        text: L('badge_2'),
        highlight: 'text-emerald-600',
      };
    } else if (rank <= 6) {
      return {
        bg: 'bg-sky-100 text-sky-900 border-sky-300',
        text: L('badge_3'),
        highlight: 'text-sky-600',
      };
    } else if (rank <= 8) {
      return {
        bg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
        text: L('badge_4'),
        highlight: 'text-indigo-600',
      };
    } else {
      return {
        bg: 'bg-stone-900 text-amber-300 border-stone-700',
        text: L('badge_5'),
        highlight: 'text-amber-400',
      };
    }
  };

  // Active layer illumination during simulation
  const isTopActive = currentMinutes < 45;
  const isHeartActive = currentMinutes >= 15 && currentMinutes < 300;
  const isBaseActive = currentMinutes >= 120;

  return (
    <div className="space-y-8">
      {/* Visual Pyramid Top Banner & Interactive Controls */}
      <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-8 rounded-3xl border border-amber-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Spray Particle Mist Effect */}
        {sprayAnimationActive && (
          <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center z-30 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
            <div className="text-center space-y-3 p-6 max-w-md">
              <div className="flex items-center justify-center gap-2 text-4xl animate-bounce">
                <span>💨</span>
                <span className="animate-spin text-amber-300">✨</span>
                <span>💧</span>
              </div>
              <div className="text-amber-300 font-extrabold text-xl font-serif-luxury tracking-wide drop-shadow-md">
                {L('atomized')}
              </div>
              <p className="text-xs text-stone-200 leading-relaxed font-sans">
                {fmt(L('atomized_desc_tpl'), { n: pickArEn(effectiveLang, scenario.fastestFlyerName, scenario.fastestFlyerNameEn || scenario.fastestFlyerName) })}
              </p>
              <div className="flex justify-center gap-1.5 pt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-pulse" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-200" />
              </div>
            </div>
          </div>
        )}

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {L('badge_top')}
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-serif-luxury tracking-wide text-white">
              {t('pyramid_title', 'الهرم العطري وسيناريو ما بعد الرش')}
            </h3>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
              {fmt(L('page_desc_tpl'), { w: formatNum(result.oilWeightGrams) })}
            </p>
          </div>

          {/* Quick Spray Simulation CTA */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button
              type="button"
              onClick={handleTriggerSpray}
              className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Wind className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>{L('simulate_cta')}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyScenario}
              className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-stone-200 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              title={L('copy_scenario_tooltip')}
            >
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {copiedScenario
                  ? L('copied_ok')
                  : L('share_scenario')}
              </span>
            </button>
          </div>
        </div>

        {/* Live Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-white/10 text-xs">
          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <span className="text-stone-400 block text-[11px]">{L('total_ratio')}</span>
            <span
              className={`font-mono-numbers text-base font-bold ${
                isBalanced100 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {formatNum(totalPct, 1)}%
            </span>
            <span className="text-[10px] text-stone-400 block mt-0.5">
              {isBalanced100
                ? L('balanced')
                : L('needs_adjust')}
            </span>
          </div>

          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <span className="text-stone-400 block text-[11px]">{L('fastest_lbl')}</span>
            <span className="text-amber-300 font-semibold truncate block">
              {pickArEn(effectiveLang, scenario.fastestFlyerName, scenario.fastestFlyerNameEn || scenario.fastestFlyerName)}
            </span>
            <span className="text-[10px] text-stone-400 block mt-0.5">
              {L('fastest_desc')}
            </span>
          </div>

          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <span className="text-stone-400 block text-[11px]">{L('anchor_lbl')}</span>
            <span className="text-amber-300 font-semibold truncate block">
              {pickArEn(effectiveLang, scenario.deepestAnchorName, scenario.deepestAnchorNameEn || scenario.deepestAnchorName)}
            </span>
            <span className="text-[10px] text-stone-400 block mt-0.5">
              {L('anchor_desc')}
            </span>
          </div>

          <div className="bg-black/30 p-3 rounded-xl border border-white/5">
            <span className="text-stone-400 block text-[11px]">{L('count_lbl')}</span>
            <span className="text-white font-mono-numbers text-base font-bold">
              {pyramidNotes.length} {L('notes_word')}
            </span>
            <span className="text-[10px] text-stone-400 block mt-0.5">
              {topNotes.length} {L('top_word')} · {heartNotes.length} {L('heart_word')} · {baseNotes.length} {L('base_word')}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Visual Graphic Pyramid (Left) + Interactive Scenario Simulation (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: THE GRAPHIC PYRAMID WITH EMBEDDED INGREDIENTS */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-7 space-y-6">
            
            {/* Pyramid Section Header & Tier Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>{L('pyramid_diagram_lbl')}</span>
                </span>
                <span className="text-[11px] text-stone-500 block">
                  {L('diagram_desc')}
                </span>
              </div>

              {/* Tier Filter Tabs */}
              <div className="inline-flex p-1 bg-stone-100 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setSelectedTier('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedTier === 'all'
                      ? 'bg-white text-stone-900 shadow-xs font-bold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {L('full_pyramid')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTier('top')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedTier === 'top'
                      ? 'bg-amber-500 text-stone-950 shadow-xs font-bold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {L('top_word')} ({formatNum(topPct, 1)}%)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTier('heart')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedTier === 'heart'
                      ? 'bg-stone-800 text-white shadow-xs font-bold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {L('heart_word')} ({formatNum(heartPct, 1)}%)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTier('base')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    selectedTier === 'base'
                      ? 'bg-amber-950 text-amber-300 shadow-xs font-bold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {L('base_word')} ({formatNum(basePct, 1)}%)
                </button>
              </div>
            </div>

            {/* THE VISUAL GRAPHIC PYRAMID STRUCTURE */}
            <div className="space-y-5">

              {/* 3D Geometric Isometric Pyramid Diagram */}
              <div className="bg-gradient-to-b from-stone-900 via-stone-950 to-stone-900 p-4 sm:p-5 rounded-2xl border border-amber-500/25 shadow-lg relative overflow-hidden text-center">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-300 pb-3 mb-2 border-b border-stone-800">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{L('layers_lbl')}</span>
                  </span>
                  <span className="text-[11px] text-stone-400 font-mono-numbers">
                    {fmt(L('active_phase_tpl'), { m: currentMinutes })}
                    <span className="text-amber-400 font-bold">
                      {isTopActive
                        ? L('apex_lbl')
                        : isHeartActive
                        ? L('core_lbl')
                        : L('deep_lbl')}
                    </span>
                  </span>
                </div>

                <div className="relative max-w-[340px] mx-auto py-2">
                  <svg viewBox="0 0 320 230" className="w-full h-auto drop-shadow-2xl select-none">
                    <defs>
                      <linearGradient id="apexGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#d97706" />
                      </linearGradient>
                      <linearGradient id="heartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f472b6" />
                        <stop offset="100%" stopColor="#be185d" />
                      </linearGradient>
                      <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#78350f" />
                      </linearGradient>
                      <filter id="glowGold" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* TIER 1: APEX TRIANGLE (Top) */}
                    <polygon
                      points="160,15 215,80 105,80"
                      fill="url(#apexGrad)"
                      stroke="#fde68a"
                      strokeWidth={isTopActive ? '3.5' : '1'}
                      filter={isTopActive ? 'url(#glowGold)' : undefined}
                      className="cursor-pointer transition-all hover:opacity-90"
                      onClick={() => setSelectedTier('top')}
                    />
                    <text x="160" y="52" textAnchor="middle" fill="#1c1917" fontSize="11" fontWeight="800">
                      {L('top_notes_lbl')}
                    </text>
                    <text x="160" y="68" textAnchor="middle" fill="#451a03" fontSize="10" fontWeight="700">
                      {formatNum(topPct, 1)}% · {L('top_notes_desc')}
                    </text>

                    {/* TIER 2: HEART TRAPEZOID */}
                    <polygon
                      points="102,86 218,86 260,150 60,150"
                      fill="url(#heartGrad)"
                      stroke="#fbcfe8"
                      strokeWidth={isHeartActive ? '3.5' : '1'}
                      filter={isHeartActive ? 'url(#glowGold)' : undefined}
                      className="cursor-pointer transition-all hover:opacity-90"
                      onClick={() => setSelectedTier('heart')}
                    />
                    <text x="160" y="115" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="800">
                      {L('heart_notes_lbl')}
                    </text>
                    <text x="160" y="132" textAnchor="middle" fill="#fdf2f8" fontSize="11" fontWeight="700">
                      {formatNum(heartPct, 1)}% · {L('heart_notes_desc')}
                    </text>

                    {/* TIER 3: BASE TRAPEZOID */}
                    <polygon
                      points="58,156 262,156 308,220 12,220"
                      fill="url(#baseGrad)"
                      stroke="#fed7aa"
                      strokeWidth={isBaseActive ? '3.5' : '1'}
                      filter={isBaseActive ? 'url(#glowGold)' : undefined}
                      className="cursor-pointer transition-all hover:opacity-90"
                      onClick={() => setSelectedTier('base')}
                    />
                    <text x="160" y="185" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">
                      {L('base_notes_lbl')}
                    </text>
                    <text x="160" y="203" textAnchor="middle" fill="#fef3c7" fontSize="11" fontWeight="700">
                      {formatNum(basePct, 1)}% · {L('base_notes_desc')}
                    </text>
                  </svg>
                </div>
              </div>

              {/* TIER 1 LIST: TOP NOTES */}
              {(selectedTier === 'all' || selectedTier === 'top') && (
                <div
                  className={`p-5 rounded-2xl border transition-all space-y-4 ${
                    isTopActive
                      ? 'bg-amber-500/10 border-amber-400 shadow-md ring-2 ring-amber-400/20'
                      : 'bg-stone-50/80 border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 font-extrabold text-sm flex items-center justify-center shadow-xs">
                        1
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-stone-900">
                            {t('pyramid_top_title', 'النوتات الافتتاحية (العليا - Top Notes)')}
                          </h4>
                          {isTopActive && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 text-[10px] font-bold animate-pulse">
                              {L('top_active_badge')}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-600">
                          {L('top_section_desc')}
                        </span>
                      </div>
                    </div>

                    <div className="text-left font-mono-numbers">
                      <div className="text-base font-extrabold text-amber-900">
                        {formatNum(topPct, 1)}%
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {formatNum(getNoteWeightGrams(topPct))} g · {formatNum(getNoteVolumeMl(topPct))} ml
                      </div>
                    </div>
                  </div>

                  {/* Notes embedded inside Top Tier */}
                  {topNotes.length === 0 ? (
                    <div className="text-center py-4 text-stone-400 text-xs italic">
                      {L('no_top')}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {topNotes.map((note, idx) => {
                        const badge = getVolatilityBadge(note.volatilityRank || 2);
                        const weight = getNoteWeightGrams(note.percentageOfOil);
                        const volume = getNoteVolumeMl(note.percentageOfOil);
                        const displayName = pickArEn(effectiveLang, note.nameAr, note.nameEn || note.nameAr);

                        return (
                          <div
                            key={note.id}
                            className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs hover:border-amber-400 transition-all space-y-2 group"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-stone-900 group-hover:text-amber-800 transition-colors">
                                    {displayName}
                                    {note.nameEn && isRTL && (
                                      <span className="text-[10px] text-stone-400 font-normal mr-1.5 font-sans">
                                        ({note.nameEn})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-stone-500 font-medium">
                                      {note.scentFamily}
                                    </span>
                                    <span className="text-[9px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                      {note.qualityGrade}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-left font-mono-numbers">
                                  <div className="text-xs font-extrabold text-amber-900">
                                    {formatNum(weight)} g
                                  </div>
                                  <div className="text-[10px] text-stone-400">
                                    {formatNum(volume)} ml
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-lg border border-stone-200">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={note.percentageOfOil}
                                    onChange={(e) =>
                                      handleUpdateNotePct(note.id, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-11 text-center font-mono-numbers text-xs font-bold text-stone-900 bg-transparent focus:outline-none"
                                  />
                                  <span className="text-[10px] font-bold text-stone-600">%</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-stone-100 text-stone-500">
                              <span className="flex items-center gap-1">
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${badge.bg}`}>
                                  {badge.text}
                                </span>
                                <span>{fmt(L('lifespan_tpl'), { v: note.evaporationTime })}</span>
                              </span>
                              <span className="text-stone-400">
                                {note.diffusionRadius}
                              </span>
                            </div>

                            {/* Dynamic Note Activity */}
                            {(() => {
                              const activity = getNoteActivityAtMinute(note.volatilityRank || 2, currentMinutes);
                              return (
                                <div className="p-2 rounded-lg bg-stone-50 border border-stone-100 text-[10px] space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-stone-700 flex items-center gap-1">
                                      <Activity className="w-3 h-3 text-amber-600" />
                                      <span>{fmt(L('presence_tpl'), { m: currentMinutes })}</span>
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${activity.statusBadgeClass}`}>
                                      {activity.statusTextAr}
                                    </span>
                                  </div>
                                  <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                                      style={{ width: `${activity.activePercent}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-stone-400 text-[9px] font-mono-numbers">
                                    <span>{fmt(L('active_tpl'), { v: activity.activePercent })}</span>
                                    <span>{fmt(L('evaporated_tpl'), { v: activity.evaporatedPercent })}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TIER 2 LIST: HEART NOTES */}
              {(selectedTier === 'all' || selectedTier === 'heart') && (
                <div
                  className={`p-5 rounded-2xl border transition-all space-y-4 ${
                    isHeartActive
                      ? 'bg-rose-500/10 border-rose-400 shadow-md ring-2 ring-rose-400/20'
                      : 'bg-stone-50/80 border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-stone-800 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                        2
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-stone-900">
                            {t('pyramid_heart_title', 'نوتات القلب (الوسطى - Heart Notes)')}
                          </h4>
                          {isHeartActive && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-950 text-[10px] font-bold animate-pulse">
                              {L('heart_active_badge')}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-600">
                          {L('heart_section_desc')}
                        </span>
                      </div>
                    </div>

                    <div className="text-left font-mono-numbers">
                      <div className="text-base font-extrabold text-stone-900">
                        {formatNum(heartPct, 1)}%
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {formatNum(getNoteWeightGrams(heartPct))} g · {formatNum(getNoteVolumeMl(heartPct))} ml
                      </div>
                    </div>
                  </div>

                  {/* Notes embedded inside Heart Tier */}
                  {heartNotes.length === 0 ? (
                    <div className="text-center py-4 text-stone-400 text-xs italic">
                      {L('no_heart')}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {heartNotes.map((note, idx) => {
                        const badge = getVolatilityBadge(note.volatilityRank || 5);
                        const weight = getNoteWeightGrams(note.percentageOfOil);
                        const volume = getNoteVolumeMl(note.percentageOfOil);
                        const displayName = pickArEn(effectiveLang, note.nameAr, note.nameEn || note.nameAr);

                        return (
                          <div
                            key={note.id}
                            className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs hover:border-stone-400 transition-all space-y-2 group"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-900 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-stone-900 group-hover:text-amber-800 transition-colors">
                                    {displayName}
                                    {note.nameEn && isRTL && (
                                      <span className="text-[10px] text-stone-400 font-normal mr-1.5 font-sans">
                                        ({note.nameEn})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-stone-500 font-medium">
                                      {note.scentFamily}
                                    </span>
                                    <span className="text-[9px] text-stone-700 bg-stone-100 px-1.5 py-0.2 rounded border border-stone-200">
                                      {note.qualityGrade}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-left font-mono-numbers">
                                  <div className="text-xs font-extrabold text-stone-900">
                                    {formatNum(weight)} g
                                  </div>
                                  <div className="text-[10px] text-stone-400">
                                    {formatNum(volume)} ml
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-lg border border-stone-200">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={note.percentageOfOil}
                                    onChange={(e) =>
                                      handleUpdateNotePct(note.id, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-11 text-center font-mono-numbers text-xs font-bold text-stone-900 bg-transparent focus:outline-none"
                                  />
                                  <span className="text-[10px] font-bold text-stone-600">%</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-stone-100 text-stone-500">
                              <span className="flex items-center gap-1">
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${badge.bg}`}>
                                  {badge.text}
                                </span>
                                <span>{fmt(L('lifespan_tpl'), { v: note.evaporationTime })}</span>
                              </span>
                              <span className="text-stone-400">
                                {note.diffusionRadius}
                              </span>
                            </div>

                            {/* Dynamic Activity */}
                            {(() => {
                              const activity = getNoteActivityAtMinute(note.volatilityRank || 5, currentMinutes);
                              return (
                                <div className="p-2 rounded-lg bg-stone-50 border border-stone-100 text-[10px] space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-stone-700 flex items-center gap-1">
                                      <Activity className="w-3 h-3 text-rose-600" />
                                      <span>{fmt(L('presence_tpl'), { m: currentMinutes })}</span>
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${activity.statusBadgeClass}`}>
                                      {activity.statusTextAr}
                                    </span>
                                  </div>
                                  <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-rose-500 h-full rounded-full transition-all duration-300"
                                      style={{ width: `${activity.activePercent}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-stone-400 text-[9px] font-mono-numbers">
                                    <span>{fmt(L('active_tpl'), { v: activity.activePercent })}</span>
                                    <span>{fmt(L('evaporated_tpl'), { v: activity.evaporatedPercent })}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TIER 3 LIST: BASE NOTES */}
              {(selectedTier === 'all' || selectedTier === 'base') && (
                <div
                  className={`p-5 rounded-2xl border transition-all space-y-4 ${
                    isBaseActive
                      ? 'bg-amber-950/20 border-amber-600 shadow-md ring-2 ring-amber-600/20'
                      : 'bg-stone-900 border-stone-800 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 font-extrabold text-sm flex items-center justify-center shadow-xs">
                        3
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-amber-200">
                            {t('pyramid_base_title', 'نوتات القاعدة (الأساسية - Base Notes)')}
                          </h4>
                          {isBaseActive && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-bold animate-pulse">
                              {L('base_active_badge')}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-400">
                          {L('base_section_desc')}
                        </span>
                      </div>
                    </div>

                    <div className="text-left font-mono-numbers">
                      <div className="text-base font-extrabold text-amber-400">
                        {formatNum(basePct, 1)}%
                      </div>
                      <div className="text-[10px] text-stone-400">
                        {formatNum(getNoteWeightGrams(basePct))} g · {formatNum(getNoteVolumeMl(basePct))} ml
                      </div>
                    </div>
                  </div>

                  {/* Notes embedded inside Base Tier */}
                  {baseNotes.length === 0 ? (
                    <div className="text-center py-4 text-stone-500 text-xs italic">
                      {L('no_base')}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {baseNotes.map((note, idx) => {
                        const badge = getVolatilityBadge(note.volatilityRank || 9);
                        const weight = getNoteWeightGrams(note.percentageOfOil);
                        const volume = getNoteVolumeMl(note.percentageOfOil);
                        const displayName = pickArEn(effectiveLang, note.nameAr, note.nameEn || note.nameAr);

                        return (
                          <div
                            key={note.id}
                            className="bg-stone-950/80 p-3.5 rounded-xl border border-stone-800 shadow-xs hover:border-amber-500/50 transition-all space-y-2 group"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-stone-100 group-hover:text-amber-300 transition-colors">
                                    {displayName}
                                    {note.nameEn && isRTL && (
                                      <span className="text-[10px] text-stone-400 font-normal mr-1.5 font-sans">
                                        ({note.nameEn})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-stone-400 font-medium">
                                      {note.scentFamily}
                                    </span>
                                    <span className="text-[9px] text-amber-400 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-800/60">
                                      {note.qualityGrade}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-left font-mono-numbers">
                                  <div className="text-xs font-extrabold text-amber-400">
                                    {formatNum(weight)} g
                                  </div>
                                  <div className="text-[10px] text-stone-400">
                                    {formatNum(volume)} ml
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 bg-stone-900 px-2 py-1 rounded-lg border border-stone-700">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={note.percentageOfOil}
                                    onChange={(e) =>
                                      handleUpdateNotePct(note.id, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-11 text-center font-mono-numbers text-xs font-bold text-amber-300 bg-transparent focus:outline-none"
                                  />
                                  <span className="text-[10px] font-bold text-amber-400">%</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-stone-800 text-stone-400">
                              <span className="flex items-center gap-1">
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${badge.bg}`}>
                                  {badge.text}
                                </span>
                                <span>{fmt(L('tenacity_tpl'), { v: note.evaporationTime })}</span>
                              </span>
                              <span className="text-stone-400">
                                {note.diffusionRadius}
                              </span>
                            </div>

                            {/* Dynamic Activity */}
                            {(() => {
                              const activity = getNoteActivityAtMinute(note.volatilityRank || 9, currentMinutes);
                              return (
                                <div className="p-2 rounded-lg bg-stone-900 border border-stone-800 text-[10px] space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-stone-300 flex items-center gap-1">
                                      <Activity className="w-3 h-3 text-amber-400" />
                                      <span>{fmt(L('presence_tpl'), { m: currentMinutes })}</span>
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${activity.statusBadgeClass}`}>
                                      {activity.statusTextAr}
                                    </span>
                                  </div>
                                  <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-amber-400 h-full rounded-full transition-all duration-300"
                                      style={{ width: `${activity.activePercent}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-stone-500 text-[9px] font-mono-numbers">
                                    <span>{fmt(L('active_tpl'), { v: activity.activePercent })}</span>
                                    <span>{fmt(L('evaporated_tpl'), { v: activity.evaporatedPercent })}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: IMAGINARY POST-SPRAY EVOLUTION SCENARIO & LIVE SIMULATOR */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-6">
            
            {/* Header */}
            <div className="border-b border-stone-100 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-amber-600" />
                  <span>
                    {L('scenario_lbl')}
                  </span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono-numbers font-medium">
                  {currentMinutes < 60
                    ? fmt(L('mins_tpl'), { m: currentMinutes })
                    : fmt(L('hours_mins_tpl'), { h: Math.floor(currentMinutes / 60), m: currentMinutes % 60 })}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                {L('scenario_desc')}
              </p>
            </div>

            {/* Interactive Timeline Scrubber & Player Controls */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>{L('timeline_lbl')}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? L('pause') : L('play')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSimulation}
                    className="p-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 transition-colors cursor-pointer"
                    title={L('reset_tooltip')}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    className="px-2 py-1 bg-white border border-stone-300 rounded text-[10px] font-mono-numbers text-stone-800 focus:outline-none"
                  >
                    <option value={1}>1x Speed</option>
                    <option value={2}>2x Speed</option>
                    <option value={5}>5x Speed</option>
                  </select>
                </div>
              </div>

              {/* Slider Scrubber */}
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
                  className="w-full accent-amber-600 cursor-pointer h-2 bg-stone-200 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[9px] text-stone-400 font-mono-numbers">
                  <span>0m ({L('spray_word')})</span>
                  <span>1h</span>
                  <span>4h</span>
                  <span>8h</span>
                  <span>12h+</span>
                </div>
              </div>

              {/* Quick Jump Buttons */}
              <div className="grid grid-cols-5 gap-1 pt-1">
                {stages.map((stg) => (
                  <button
                    key={stg.id}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentMinutes(stg.timeMinutes);
                    }}
                    className={`p-1 rounded text-[9px] text-center transition-all cursor-pointer truncate ${
                      activeStage.id === stg.id
                        ? 'bg-amber-700 text-white font-bold shadow-xs'
                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-amber-50'
                    }`}
                  >
                    {stg.timeMinutes === 0
                      ? L('spray_word')
                      : stg.timeMinutes < 60
                      ? `${stg.timeMinutes}m`
                      : `${Math.round(stg.timeMinutes / 60)}h`}
                  </button>
                ))}
              </div>

              {/* Fine Control Steppers */}
              <div className="flex items-center justify-between gap-1 pt-2 border-t border-stone-200/60 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentMinutes((prev) => Math.max(0, prev - 15));
                    }}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono transition-colors cursor-pointer border border-stone-200"
                  >
                    -15m
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentMinutes((prev) => Math.min(720, prev + 15));
                    }}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono transition-colors cursor-pointer border border-stone-200"
                  >
                    +15m
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentMinutes((prev) => Math.min(720, prev + 60));
                    }}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono transition-colors cursor-pointer border border-stone-200"
                  >
                    +60m
                  </button>
                </div>
                <span className="text-[10px] text-stone-500 font-mono">
                  {fmt(L('elapsed_tpl'), { t: currentMinutes < 60 ? fmt(L('mins_tpl'), { m: currentMinutes }) : fmt(L('hours_mins_tpl'), { h: Math.floor(currentMinutes / 60), m: currentMinutes % 60 }) })}
                </span>
              </div>
            </div>

            {/* DYNAMIC SCENARIO STAGE DISPLAY CARD */}
            <div className="space-y-4">
              
              {/* Stage Badge & Title */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                    {pickArEn(effectiveLang, activeStage.timeLabelAr, activeStage.timeLabelEn || activeStage.timeLabelAr)}
                  </span>
                  <span className="text-[10px] text-stone-500 font-semibold">
                    {L('phase_lbl')}
                    {activeStage.dominantPhase === 'top'
                      ? L('phase_top')
                      : activeStage.dominantPhase === 'heart'
                      ? L('phase_heart')
                      : L('phase_base')}
                  </span>
                </div>

                <h4 className="font-bold text-stone-900 text-sm font-serif-luxury">
                  {pickArEn(effectiveLang, activeStage.stageNameAr, activeStage.stageNameEn || activeStage.stageNameAr)}
                </h4>
                <p className="text-[11px] text-amber-900/90 font-medium">
                  {pickArEn(effectiveLang, activeStage.stageSubtitleAr, activeStage.stageSubtitleEn || activeStage.stageSubtitleAr)}
                </p>
              </div>

              {/* Live Sillage & Projection Meter */}
              <div className="space-y-2 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-700" />
                    <span>{L('sillage_metric_lbl')}</span>
                  </span>
                  <span className="font-bold text-amber-900 text-[11px]">
                    {pickArEn(effectiveLang, activeStage.sillageRating, activeStage.sillageRatingEn || activeStage.sillageRating)} ({activeStage.sillagePercent}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-stone-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-700 transition-all duration-300"
                    style={{ width: `${activeStage.sillagePercent}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-stone-500 pt-0.5">
                  <span>
                    {fmt(L('skin_tpl'), { v: activeStage.skinAdhesionPercent ?? 0 })}
                  </span>
                  <span>
                    {pickArEn(effectiveLang, activeStage.evaporationStateAr, activeStage.evaporationStateEn || activeStage.evaporationStateAr)}
                  </span>
                </div>
              </div>

              {/* Visual Scent Radius Radar Aura Graphic */}
              <div className="bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 rounded-2xl p-4 border border-stone-800 text-white space-y-3 relative overflow-hidden shadow-inner">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    <span>{L('radar_lbl')}</span>
                  </span>
                  <span className="font-mono-numbers text-xs text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-800/80 font-bold">
                    {currentMinutes === 0
                      ? L('radius_3')
                      : currentMinutes <= 30
                      ? L('radius_2')
                      : currentMinutes <= 120
                      ? L('radius_12')
                      : currentMinutes <= 360
                      ? L('radius_05')
                      : L('skin_close')}
                  </span>
                </div>

                {/* Animated Radar concentric circles */}
                <div className="relative w-40 h-40 mx-auto flex items-center justify-center my-1 select-none">
                  {/* Outer Ring 3m */}
                  <div
                    className={`absolute w-40 h-40 rounded-full border border-dashed transition-all duration-700 flex items-center justify-center ${
                      activeStage.sillagePercent >= 85
                        ? 'border-amber-400/60 bg-amber-500/10 shadow-lg shadow-amber-500/20'
                        : 'border-stone-800/50'
                    }`}
                  >
                    <span className="absolute top-1 text-[8px] text-stone-500 font-mono">3.0m</span>
                  </div>

                  {/* Middle Ring 1.5m */}
                  <div
                    className={`absolute w-28 h-28 rounded-full border border-dashed transition-all duration-700 flex items-center justify-center ${
                      activeStage.sillagePercent >= 60
                        ? 'border-amber-400/80 bg-amber-400/15 shadow-md shadow-amber-400/20'
                        : 'border-stone-800/60'
                    }`}
                  >
                    <span className="absolute top-1 text-[8px] text-stone-400 font-mono">1.5m</span>
                  </div>

                  {/* Inner Intimate Ring 0.5m */}
                  <div
                    className={`absolute w-16 h-16 rounded-full border border-dashed transition-all duration-700 flex items-center justify-center ${
                      activeStage.sillagePercent >= 35
                        ? 'border-amber-300 bg-amber-300/20'
                        : 'border-stone-800'
                    }`}
                  >
                    <span className="absolute top-0.5 text-[8px] text-stone-400 font-mono">0.5m</span>
                  </div>

                  {/* Center Silhouette */}
                  <div className="relative z-10 w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center shadow-lg shadow-amber-500/50 border border-amber-200">
                    👤
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] text-stone-400 pt-1 border-t border-stone-800 font-mono">
                  <span>3m ({L('burst')})</span>
                  <span>1.5m ({L('wide')})</span>
                  <span>0.5m ({L('intimate')})</span>
                  <span>0.1m ({L('skin')})</span>
                </div>
              </div>

              {/* Narrative 1: What happens */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-white border border-stone-200/90">
                <span className="text-[11px] font-bold text-stone-900 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-600" />
                  <span>{L('chemistry_lbl')}</span>
                </span>
                <p className="text-xs text-stone-700 leading-relaxed">
                  {pickArEn(effectiveLang, activeStage.whatHappensTextAr, activeStage.whatHappensTextEn || activeStage.whatHappensTextAr)}
                </p>
              </div>

              {/* Narrative 2: Olfactory Perception */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-stone-900 text-white border border-stone-800">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>
                    {L('perception_lbl')}
                  </span>
                </span>
                <p className="text-xs text-stone-200 leading-relaxed">
                  {pickArEn(effectiveLang, activeStage.olfactoryPerceptionTextAr, activeStage.olfactoryPerceptionTextEn || activeStage.olfactoryPerceptionTextAr)}
                </p>
              </div>

              {/* Perfumer Advice Box */}
              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900 block text-[11px]">
                    {L('advice_lbl')}
                  </span>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    {pickArEn(effectiveLang, activeStage.adviceForWearerAr, activeStage.adviceForWearerEn || activeStage.adviceForWearerAr)}
                  </p>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
