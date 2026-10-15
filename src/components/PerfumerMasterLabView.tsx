import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Droplet,
  Beaker,
  Send,
  Volume2,
  Check,
  FlaskConical,
  Copy,
  Trash2,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  BookmarkPlus,
  DollarSign,
  Printer,
  ChevronDown,
  Download,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import perfumerImg from '../assets/images/master_perfumer_compounding_1791693212967.jpg';
import { extractFormulaFromAIMessage, ExtractedAIPerfume } from '../utils/aiFormulaExtractor';
import {
  ChatMessage,
  loadStoredChatSession,
  saveChatSession,
  clearChatSession,
  exportChatTranscriptToFile,
  DEFAULT_WELCOME_MESSAGE,
} from '../utils/chatStorage';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../utils/localizedContent';
import { LText, makeT, fmt, loc, LOCALE_MAP } from '../utils/localize';
import { isStaticHosting, requestApi, type ChatResponse } from '../utils/api';
import { StaticHostingNotice } from './StaticHostingNotice';
import { chatErrorText } from './ShaheenServiceStatus';
import { chatHistory } from '../utils/chatStore';

interface PerfumerMasterLabViewProps {
  currentLang?: SupportedLanguage;
  onApplyToConcentrationCalculator: (formula: ExtractedAIPerfume) => void;
  onApplyToPyramidCalculator: (formula: ExtractedAIPerfume) => void;
  onRecordToRecipeLibrary: (formula: ExtractedAIPerfume) => void;
  onCalculateCosting: (formula: ExtractedAIPerfume) => void;
  onPrintSpecSheet: (formula: ExtractedAIPerfume) => void;
}


const S = {
  council_title: {
    ar: 'مجلس الخبير شاهين · شيخ العطارين',
    en: 'Master Perfumer Shahin AI Council',
    fr: 'Conseil du Maître Parfumeur Shahin IA',
    es: 'Consejo del Maestro Perfumista Shahin IA',
    it: 'Consiglio del Mastro Profumiere Shahin AI',
    de: 'Meister-Parfümeur Shahin KI-Rat',
    ru: 'Совет мастера-парфюмера Шахина ИИ',
    zh: '调香大师沙欣 AI 议会',
    tr: 'Usta Parfümör Şahin AI Konseyi',
    fa: 'شورای استاد شاهین · شیخ عطارها',
  },
  vault_tooltip: {
    ar: 'يتم حفظ المحادثة كاملة في جهازك وتُمسح تلقائياً بعد 30 يوماً من بدئها',
    en: 'Chat session stored encrypted locally and auto-purged after 30 days',
    fr: 'Session stockée chiffrée localement et purgée automatiquement après 30 jours',
    es: 'Sesión cifrada localmente y borrada automáticamente tras 30 días',
    it: 'Sessione cifrata localmente e cancellata automaticamente dopo 30 giorni',
    de: 'Sitzung lokal verschlüsselt gespeichert und nach 30 Tagen automatisch gelöscht',
    ru: 'Сессия хранится локально в зашифрованном виде и удаляется через 30 дней',
    zh: '会话本地加密保存，30 天后自动清除',
    tr: 'Oturum yerel olarak şifreli saklanır ve 30 gün sonra otomatik silinir',
    fa: 'گفتگو به‌صورت رمزنگاری‌شده محلی ذخیره می‌شود و پس از ۳۰ روز خودکار پاک می‌شود',
  },
  vault_badge_tpl: {
    ar: 'محفوظة بالكامل (تُمسح بعد {d} يوماً)',
    en: 'Active Vault ({d}d remaining)',
    fr: 'Coffre actif ({d} j restants)',
    es: 'Bóveda activa (quedan {d}d)',
    it: 'Cassaforte attiva ({d}g rimanenti)',
    de: 'Aktiver Tresor ({d} T. verbleiben)',
    ru: 'Активный сейф (осталось {d} дн.)',
    zh: '保险库有效（剩余 {d} 天）',
    tr: 'Aktif kasa ({d} gün kaldı)',
    fa: 'گاوصندوق فعال ({d} روز باقی مانده)',
  },
  session_desc: {
    ar: 'تفاعل مباشر وحفظ تلقائي لكامل الجلسة لمدة شهر كامل مع إمكانية التصدير',
    en: 'Multi-AI formulation synthesis co-pilot with one-month persistent cache',
    fr: 'Copilote multi-IA de formulation avec cache persistant d’un mois',
    es: 'Copiloto multi-IA de formulación con caché persistente de un mes',
    it: 'Co-pilota multi-AI con cache persistente di un mese',
    de: 'Multi-KI-Formulierungscopilot mit einmonatigem Cache',
    ru: 'Ко-пилот мульти-ИИ синтеза формул с месячным кэшем',
    zh: '多 AI 配方合成副驾驶，支持一个月持久缓存',
    tr: 'Bir aylık kalıcı önbellekle çoklu AI formülasyon yardımcısı',
    fa: 'دستیار چند-IA سنتز فرمول با حافظه پایدار یک‌ماهه',
  },
  scale: {
    ar: 'الميزان:',
    en: 'Scale:',
    fr: 'Balance :',
    es: 'Balanza:',
    it: 'Bilancia:',
    de: 'Waage:',
    ru: 'Весы:',
    zh: '天平：',
    tr: 'Terazi:',
    fa: 'ترازو:',
  },
  add_drop_tooltip: {
    ar: 'إضافة قطرة عطرية للمركب',
    en: 'Add aroma drop to scale',
    fr: 'Ajouter une goutte aromatique',
    es: 'Añadir una gota aromática',
    it: 'Aggiungi una goccia aromatica',
    de: 'Aromatropfen hinzufügen',
    ru: 'Добавить ароматическую каплю',
    zh: '向天平添加一滴香料',
    tr: 'Teraziye aroma damlası ekle',
    fa: 'افزودن یک قطره عطری به ترازو',
  },
  add_drop: {
    ar: 'إضافة قطرة',
    en: '+1 Drop',
    fr: '+1 goutte',
    es: '+1 gota',
    it: '+1 goccia',
    de: '+1 Tropfen',
    ru: '+1 капля',
    zh: '+1 滴',
    tr: '+1 damla',
    fa: '+۱ قطره',
  },
  export_tooltip: {
    ar: 'تنزيل نسخة احتياطية من المحادثة كملف نصي TXT',
    en: 'Download chat transcript as TXT',
    fr: 'Télécharger la transcription en TXT',
    es: 'Descargar transcripción en TXT',
    it: 'Scarica la trascrizione in TXT',
    de: 'Chat-Protokoll als TXT herunterladen',
    ru: 'Скачать стенограмму чата в TXT',
    zh: '下载 TXT 聊天记录',
    tr: 'Sohbet dökümünü TXT olarak indirin',
    fa: 'دانلود رونوشت گفتگو به صورت TXT',
  },
  export_txt: {
    ar: 'تنزيل نسخة TXT',
    en: 'Export TXT',
    fr: 'Exporter TXT',
    es: 'Exportar TXT',
    it: 'Esporta TXT',
    de: 'TXT exportieren',
    ru: 'Экспорт TXT',
    zh: '导出 TXT',
    tr: 'TXT dışa aktar',
    fa: 'خروجی TXT',
  },
  copy_tooltip: {
    ar: 'نسخ المحادثة بالكامل',
    en: 'Copy entire transcript',
    fr: 'Copier toute la transcription',
    es: 'Copiar toda la transcripción',
    it: 'Copia tutta la trascrizione',
    de: 'Ganzes Protokoll kopieren',
    ru: 'Скопировать всю стенограмму',
    zh: '复制全部聊天记录',
    tr: 'Tüm dökümü kopyala',
    fa: 'کپی کل گفتگو',
  },
  copied: {
    ar: 'تم النسخ!',
    en: 'Copied!',
    fr: 'Copié !',
    es: '¡Copiado!',
    it: 'Copiato!',
    de: 'Kopiert!',
    ru: 'Скопировано!',
    zh: '已复制！',
    tr: 'Kopyalandı!',
    fa: 'کپی شد!',
  },
  copy_all: {
    ar: 'نسخ المحادثة',
    en: 'Copy All',
    fr: 'Tout copier',
    es: 'Copiar todo',
    it: 'Copia tutto',
    de: 'Alles kopieren',
    ru: 'Скопировать всё',
    zh: '复制全部',
    tr: 'Tümünü kopyala',
    fa: 'کپی همه',
  },
  clear_tooltip: {
    ar: 'مسح سجل المحادثة الآن',
    en: 'Clear chat history now',
    fr: 'Effacer l’historique maintenant',
    es: 'Borrar el historial ahora',
    it: 'Cancella la cronologia ora',
    de: 'Verlauf jetzt löschen',
    ru: 'Очистить историю сейчас',
    zh: '立即清空聊天记录',
    tr: 'Sohbet geçmişini şimdi temizle',
    fa: 'پاک کردن تاریخچه گفتگو',
  },
  prompt_1: { ar: 'ناقشني في اختيار عطر شخصي يناسب يومي الصيفي في العمل', en: 'Help me pick a personal scent for my summer workday', fr: 'Aide-moi à choisir un parfum pour mes journées d’été au bureau', es: 'Ayúdame a elegir un aroma para mi día de verano en el trabajo', it: 'Aiutami a scegliere un profumo per la mia giornata estiva in ufficio', de: 'Hilf mir, einen Duft für meinen Sommertag im Büro zu wählen', ru: 'Помоги выбрать аромат на летний рабочий день', zh: '帮我挑一款适合夏日工作日的个人香氛', tr: 'Yaz günü işim için kişisel bir koku seçmeme yardım et', fa: 'برای روز کاری تابستانم کمکم کن عطر شخصی انتخاب کنم' },
  prompt_2: { ar: 'ما الاستخدامات الطبية والعلاجية للزيوت العطرية ونسب الأمان للأطفال والحوامل؟', en: 'What are the therapeutic uses of essential oils and safe ratios for children & pregnancy?', fr: 'Quels sont les usages thérapeutiques des huiles et les dosages sûrs pour enfants et grossesse ?', es: '¿Cuáles son los usos terapéuticos de los aceites y las dosis seguras para niños y embarazo?', it: 'Quali sono gli usi terapeutici degli oli e i dosaggi sicuri per bambini e gravidanza?', de: 'Welche therapeutischen Anwendungen haben Öle und welche Dosierungen sind für Kinder und Schwangere sicher?', ru: 'Каково терапевтическое применение эфирных масел и безопасные дозы для детей и беременных?', zh: '精油的疗愈用途是什么？儿童与孕期的安全剂量是多少？', tr: 'Uçucu yağların terapötik kullanımları ve çocuk/hamilelik için güvenli oranlar nelerdir?', fa: 'کاربردهای درمانی روغن‌های اسانسی و نسبت‌های امن برای کودکان و بارداری چیست؟' },
  prompt_3: { ar: 'كيف أصنع تركيبة تجميلية لمعطر جسم (Body Mist) ثابت ومستحلب؟', en: 'How do I make a stable emulsified Body Mist formula?', fr: 'Comment créer une formule de brume corporelle émulsionnée et stable ?', es: '¿Cómo creo una fórmula de Body Mist emulsionada y estable?', it: 'Come creo una formula di Body Mist emulsionata e stabile?', de: 'Wie erstelle ich eine stabile, emulgierte Body-Mist-Formel?', ru: 'Как сделать стабильную эмульгированную формулу Body Mist?', zh: '如何调制稳定乳化的身体喷雾（Body Mist）配方？', tr: 'Stabil, emülsifiye bir Body Mist formülü nasıl yapılır?', fa: 'چگونه فرمول اسپری بدن (Body Mist) پایدار و امولسیون‌شده بسازم؟' },
  prompt_4: { ar: 'العطر أصبح حليبياً ومتعكراً بعد إضافة الكحول، كيف أصفّيه بالمعمل؟', en: 'My perfume turned milky after adding alcohol — how do I clarify it?', fr: 'Mon parfum est devenu laiteux après l’alcool — comment le clarifier ?', es: 'Mi perfume se enturbió tras añadir alcohol, ¿cómo aclararlo?', it: 'Il mio profumo è diventato lattiginoso dopo l’alcol: come chiarificarlo?', de: 'Mein Parfüm wurde nach Alkoholzugabe milchig — wie kläre ich es?', ru: 'Духи помутнели после добавления спирта — как осветлить?', zh: '加酒精后香水变浑浊，如何在实验室澄清？', tr: 'Alkol ekledikten sonra parfümüm sütlüleşti, nasıl berraklaştırırım?', fa: 'عطرم بعد از افزودن الکل شیری و کدر شد؛ چگونه شفافش کنم؟' },
  prompt_5: { ar: 'ما المدة والشروط العلمية لتعتيق العطر (Maceration) للحصول على صفاء وثبات؟', en: 'What is the scientifically correct maceration duration & conditions for clarity and tenacity?', fr: 'Quelle durée et conditions de macération pour clarté et tenue ?', es: '¿Qué duración y condiciones de maceración para claridad y fijación?', it: 'Quale durata e condizioni di macerazione per chiarezza e tenacia?', de: 'Welche Mazerationstemperatur und -dauer für Klarheit und Haltbarkeit?', ru: 'Какова длительность и условия мацерации для ясности и стойкости?', zh: '获得清澈与持久所需的科学浸置时长与条件是什么？', tr: 'Berraklık ve kalıcılık için bilimsel maserasyon süresi ve koşulları nedir?', fa: 'مدت و شرایط علمی تعریف عطر (Maceration) برای شفافیت و ماندگاری چیست؟' },
  eng_auto_name: { ar: 'أتمتة الدمج الذكي (Auto Ensemble)', en: 'Smart Fusion Automation (Auto Ensemble)', fr: 'Fusion intelligente automatique (Auto Ensemble)', es: 'Fusión inteligente automática (Auto Ensemble)', it: 'Fusione intelligente automatica (Auto Ensemble)', de: 'Intelligente Fusion (Auto Ensemble)', ru: 'Автосборка умного слияния (Auto Ensemble)', zh: '智能融合自动化（Auto Ensemble）', tr: 'Akıllı birleşim otomasyonu (Auto Ensemble)', fa: 'ادغام هوشمند خودکار (Auto Ensemble)' },
  eng_auto_short: { ar: '⚡ مجلس الخبراء', en: '⚡ Expert Council', fr: '⚡ Conseil d’experts', es: '⚡ Consejo de expertos', it: '⚡ Consiglio di esperti', de: '⚡ Expertrat', ru: '⚡ Совет экспертов', zh: '⚡ 专家议会', tr: '⚡ Uzman konseyi', fa: '⚡ شورای متخصصان' },
  eng_auto_badge: { ar: '⚡ مجلس الخبراء المؤتمت', en: '⚡ Automated Expert Council', fr: '⚡ Conseil d’experts automatisé', es: '⚡ Consejo automatizado', it: '⚡ Consiglio automatizzato', de: '⚡ Automatisierter Expertrat', ru: '⚡ Автоматический совет экспертов', zh: '⚡ 自动化专家议会', tr: '⚡ Otomatik uzman konseyi', fa: '⚡ شورای خودکار متخصصان' },
  eng_auto_desc: { ar: 'يدمج ذكاء الأربعة نماذج تلقائياً ويصيغ الخلاصة الموحدة', en: 'Automatically fuses all four models into one unified verdict', fr: 'Fusionne automatiquement les quatre modèles en un verdict unifié', es: 'Fusiona automáticamente los cuatro modelos en un veredicto unificado', it: 'Fonde automaticamente i quattro modelli in un verdetto unificato', de: 'Vereint automatisch alle vier Modelle zu einem Urteil', ru: 'Автоматически объединяет четыре модели в единый вывод', zh: '自动融合四个模型并给出统一结论', tr: 'Dört modeli otomatik birleştirip ortak sonuç üretir', fa: 'چهار مدل را خودکار ادغام و نتیجه واحد می‌سازد' },
  eng_gemini_short: { ar: '✨ جيمناي', en: '✨ Gemini', fr: '✨ Gemini', es: '✨ Gemini', it: '✨ Gemini', de: '✨ Gemini', ru: '✨ Gemini', zh: '✨ Gemini', tr: '✨ Gemini', fa: '✨ جمنای' },
  eng_gemini_desc: { ar: 'الحسابات الرياضية الدقيقة، أوزان الغرامات، والسرعة الفائقة', en: 'Precise math, gram-level weights, and blazing speed', fr: 'Maths précises, poids au gramme et rapidité', es: 'Matemáticas precisas, pesos al gramo y velocidad', it: 'Matematica precisa, pesi al grammo e velocità', de: 'Präzise Mathematik, Grammgewichte und Tempo', ru: 'Точная математика, граммы и скорость', zh: '精准计算、克级配比与极速响应', tr: 'Hassas matematik, gram ağırlıkları ve hız', fa: 'محاسبات دقیق، وزن‌های گرمی و سرعت بالا' },
  eng_deepseek_short: { ar: '🔬 ديب سيك', en: '🔬 DeepSeek', fr: '🔬 DeepSeek', es: '🔬 DeepSeek', it: '🔬 DeepSeek', de: '🔬 DeepSeek', ru: '🔬 DeepSeek', zh: '🔬 DeepSeek', tr: '🔬 DeepSeek', fa: '🔬 دیپ‌سیک' },
  eng_deepseek_desc: { ar: 'استدلال كيميائي، الكثافة النوعية ومعايير أمان IFRA', en: 'Chemical reasoning, specific gravity, and IFRA safety', fr: 'Raisonnement chimique, densité et sécurité IFRA', es: 'Razonamiento químico, densidad y seguridad IFRA', it: 'Ragionamento chimico, densità e sicurezza IFRA', de: 'Chemisches Denken, Dichte und IFRA-Sicherheit', ru: 'Химическая логика, плотность и безопасность IFRA', zh: '化学推理、比重与 IFRA 安全', tr: 'Kimyasal akıl yürütme, yoğunluk ve IFRA güvenliği', fa: 'استدلال شیمیایی، چگالی و ایمنی IFRA' },
  eng_openai_short: { ar: '🟢 شات جي بي تي', en: '🟢 ChatGPT', fr: '🟢 ChatGPT', es: '🟢 ChatGPT', it: '🟢 ChatGPT', de: '🟢 ChatGPT', ru: '🟢 ChatGPT', zh: '🟢 ChatGPT', tr: '🟢 ChatGPT', fa: '🟢 چت‌جی‌پی‌تی' },
  eng_openai_desc: { ar: 'هندسة الأكوردات، الفوحان التجاري والانتشار الجذاب', en: 'Accord architecture, commercial sillage, and allure', fr: 'Architecture des accords, sillage commercial et séduction', es: 'Arquitectura de acordes, estela comercial y atractivo', it: 'Architettura degli accordi, scia commerciale e appeal', de: 'Akkordarchitektur, kommerzielle Sillage und Anziehung', ru: 'Архитектура аккордов, коммерческий шлейф', zh: '香调架构、商业扩散与吸引力', tr: 'Akor mimarisi, ticari iz ve çekicilik', fa: 'معماری آکورد، انتشار تجاری و جذابیت' },
  eng_claude_short: { ar: '🟣 كلود', en: '🟣 Claude', fr: '🟣 Claude', es: '🟣 Claude', it: '🟣 Claude', de: '🟣 Claude', ru: '🟣 Claude', zh: '🟣 Claude', tr: '🟣 Claude', fa: '🟣 کلود' },
  eng_claude_desc: { ar: 'مدرسة جراس الفرنسية، التعتيق الصامت، وأناقة النيش', en: 'French Grasse school, quiet maturation, and niche elegance', fr: 'École de Grasse, maturation discrète et élégance de niche', es: 'Escuela de Grasse, maduración silenciosa y elegancia de nicho', it: 'Scuola di Grasse, maturazione silenziosa ed eleganza di nicchia', de: 'Grasse-Schule, stille Reifung und Nischen-Eleganz', ru: 'Школа Граса, тихое настаивание и нишевая элегантность', zh: '格拉斯学派、静谧熟成与小众优雅', tr: 'Grasse okulu, sessiz olgunlaşma ve niş zarafeti', fa: 'مدرسه گراس، تعریف آرام و ظرافت نیچ' },
  comp_1: { ar: 'الخبير شاهين يقطر الزيوت الخام في المخبار بدقة الميزان...', en: 'Master Shahin drips raw oils into the flask with scale precision...', fr: 'Le Maître Shahin verse les huiles dans le ballon avec précision…', es: 'El Maestro Shahin gotea los aceites con precisión de balanza...', it: 'Il Maestro Shahin versa gli oli nel matraccio con precisione…', de: 'Meister Shahin tropft die Rohöle mit Waagenpräzision ein…', ru: 'Мастер Шахин капает масла в колбу с точностью весов…', zh: 'Shahin 大师正以天平精度将原精滴入烧瓶……', tr: 'Usta Shahin çiğ yağları terazi hassasiyetiyle damlatıyor…', fa: 'استاد شاهین روغن‌های خام را با دقت ترازو در بالن می‌چکاند...' },
  comp_2: { ar: 'يفحص الكثافة النوعية وتجانس النوتات العطرية...', en: 'Checking specific gravity and note homogeneity...', fr: 'Vérification de la densité et de l’homogénéité des notes…', es: 'Comprobando densidad y homogeneidad de notas...', it: 'Verifica di densità e omogeneità delle note…', de: 'Prüfung von Dichte und Homogenität der Noten…', ru: 'Проверка плотности и однородности нот…', zh: '正在检测比重与香气均匀度……', tr: 'Yoğunluk ve nota homojenliği kontrol ediliyor…', fa: 'بررسی چگالی و همگنی نت‌ها...' },
  comp_3: { ar: 'يمزج مركب العطر ويتحقق من توازن الهرم العطري...', en: 'Blending the concentrate and verifying pyramid balance...', fr: 'Assemblage du concentré et équilibre de la pyramide…', es: 'Mezclando el concentrado y verificando el equilibrio...', it: 'Fusione del concentrato e verifica dell’equilibrio…', de: 'Vermengung des Konzentrats und Pyramidenabgleich…', ru: 'Смешивание концентрата и проверка баланса пирамиды…', zh: '正在混合浓缩物并校验金字塔平衡……', tr: 'Konsantre harmanlanıyor ve piramit dengesi doğrulanıyor…', fa: 'اختلاط کنسانتره و بررسی تعادل هرم...' },
  comp_4: { ar: 'يصيغ لك خلاصة سر التركيبة من واقع خبرة 35 عاماً في المعمل...', en: 'Distilling the secret of your formula from 35 years of lab craft...', fr: 'Il distille le secret de votre formule fort de 35 ans de métier…', es: 'Destilando el secreto de tu fórmula con 35 años de oficio...', it: 'Distilla il segreto della tua formula da 35 anni di mestiere…', de: 'Er destilliert das Geheimnis Ihrer Formel aus 35 Jahren Handwerk…', ru: 'Выводит секрет формулы из 35 лет мастерства…', zh: '正以 35 年实验室功力提炼配方秘诀……', tr: 'Formülün sırrını 35 yıllık tecrübeyle damıtıyor…', fa: 'راز فرمول شما را از ۳۵ سال تجربه آزمایشگاهی می‌گیری...' },
  retry_later: { ar: 'معذرة، أعد المحاولة بعد قليل.', en: 'Sorry, please try again shortly.', fr: 'Désolé, réessayez dans un instant.', es: 'Disculpa, reintenta en un momento.', it: 'Spiacente, riprova tra poco.', de: 'Entschuldigung, versuchen Sie es gleich erneut.', ru: 'Извините, попробуйте ещё раз чуть позже.', zh: '抱歉，请稍后重试。', tr: 'Üzgünüm, birazdan tekrar deneyin.', fa: 'متأسفم، کمی بعد دوباره تلاش کنید.' },
  fallback_welcome: { ar: 'أهلاً بك يا صديقي، المعذرة على هذا التأخر الطفيف في استجابة شبكة الذكاء الاصطناعي للمعمل. يُرجى إعادة إرسال سؤالك وسأجيبك فوراً بكل تفصيل كيميائي وعطري!', en: 'Welcome, my friend — apologies for the slight delay from the lab’s AI network. Please resend your question and I’ll answer instantly with full chemical & perfumery detail!', fr: 'Bienvenue, mon ami — veuillez excuser le léger délai du réseau IA. Renvoyez votre question, je répondrai immédiatement en détail !', es: '¡Bienvenido, amigo! Disculpa el breve retraso de la red IA. Reenvía tu pregunta y te respondo al instante.', it: 'Benvenuto, amico! Scusa il piccolo ritardo della rete IA. Invia di nuovo la domanda e rispondo subito.', de: 'Willkommen, mein Freund! Bitte entschuldige die kurze Verzögerung des KI-Netzwerks. Senden Sie Ihre Frage erneut.', ru: 'Добро пожаловать, друг! Извините за небольшую задержку ИИ-сети. Отправьте вопрос повторно — отвечу немедленно.', zh: '欢迎，我的朋友！AI 网络稍有延迟，请重新发送您的问题，我会立刻给出详尽的化学与调香解答！', tr: 'Hoş geldin dostum! YZ ağındaki kısa gecikme için özür dilerim. Sorunu tekrar gönder, hemen ayrıntılı yanıtlayayım.', fa: 'خوش آمدی دوست من! برای تأخیر کوتاه شبکه هوش مصنوعی پوزش می‌خواهم. پرسشت را دوباره بفرست تا فوراً با جزئیات شیمیایی و عطری پاسخ دهم!' },
  shahin_name: { ar: 'الخبير شاهين', en: 'Master Shahin', fr: 'Maître Shahin', es: 'Maestro Shahin', it: 'Maestro Shahin', de: 'Meister Shahin', ru: 'Мастер Шахин', zh: 'Shahin 大师', tr: 'Usta Shahin', fa: 'استاد شاهین' },
  fallback_badge: { ar: '👑 معمل الخبير شاهين', en: '👑 Master Shahin Lab', fr: '👑 Laboratoire du Maître Shahin', es: '👑 Laboratorio del Maestro Shahin', it: '👑 Laboratorio del Maestro Shahin', de: '👑 Labor von Meister Shahin', ru: '👑 Лаборатория мастера Шахина', zh: '👑 Shahin 大师实验室', tr: '👑 Usta Shahin Laboratuvarı', fa: '👑 آزمایشگاه استاد شاهین' },
  q_word: { ar: 'السؤال', en: 'Question', fr: 'Question', es: 'Pregunta', it: 'Domanda', de: 'Frage', ru: 'Вопрос', zh: '提问', tr: 'Soru', fa: 'پرسش' },
  clear_confirm_tpl: { ar: 'هل ترغب في مسح سجل المحادثة بالكامل الآن؟ (تُمسح تلقائياً بعد {d} يوماً).', en: 'Wipe the entire chat history now? (It auto-deletes after {d} days).', fr: 'Effacer tout l’historique maintenant ? (suppression auto après {d} jours).', es: '¿Borrar todo el historial ahora? (se borra solo tras {d} días).', it: 'Cancellare tutta la cronologia ora? (si cancella da sola dopo {d} giorni).', de: 'Gesamten Verlauf jetzt löschen? (automatisch nach {d} Tagen).', ru: 'Стереть всю историю переписки? (автоудаление через {d} дн.).', zh: '现在清除全部聊天记录吗？（{d} 天后自动清除）', tr: 'Tüm sohbet geçmişi silinsin mi? ({d} gün sonra otomatik silinir).', fa: 'همه تاریخچه گفتگو الان پاک شود؟ (پس از {d} روز خودکار پاک می‌شود).' },
  cancel: { ar: 'إلغاء', en: 'Cancel', fr: 'Annuler', es: 'Cancelar', it: 'Annulla', de: 'Abbrechen', ru: 'Отмена', zh: '取消', tr: 'Vazgeç', fa: 'انصراف' },
  confirm_wipe: { ar: 'تأكيد المسح', en: 'Confirm Wipe', fr: 'Confirmer l’effacement', es: 'Confirmar borrado', it: 'Conferma cancellazione', de: 'Löschen bestätigen', ru: 'Подтвердить стирание', zh: '确认清除', tr: 'Silmeyi onayla', fa: 'تأیید پاک‌سازی' },
  engine_lbl: { ar: 'محرك الذكاء العطري:', en: 'Fragrance AI Engine:', fr: 'Moteur IA olfactif :', es: 'Motor de IA olfativa:', it: 'Motore IA olfattivo:', de: 'Duft-KI-Engine:', ru: 'Движок парфюмерного ИИ:', zh: '香水 AI 引擎：', tr: 'Koku YZ motoru:', fa: 'موتور هوش مصنوعی عطری:' },
  ai_matrix_tooltip: { ar: 'عرض حالة شبكة الذكاء الاصطناعي الأربعة المتصلة بالمعمل', en: 'View the four AI engines connected to the lab', fr: 'Voir les quatre moteurs IA connectés', es: 'Ver los cuatro motores IA conectados', it: 'Vedi i quattro motori IA collegati', de: 'Die vier angeschlossenen KI-Engines ansehen', ru: 'Просмотр четырёх ИИ-движков лаборатории', zh: '查看连接到实验室的四个 AI 引擎', tr: 'Laboratuvara bağlı dört YZ motorunu görüntüle', fa: 'مشاهده چهار موتور هوش مصنوعی متصل به آزمایشگاه' },
  ai_network_lbl: { ar: 'شبكة الذكاء (4)', en: 'AI Network (4)', fr: 'Réseau IA (4)', es: 'Red IA (4)', it: 'Rete IA (4)', de: 'KI-Netzwerk (4)', ru: 'Сеть ИИ (4)', zh: 'AI 网络（4）', tr: 'YZ ağı (4)', fa: 'شبکه هوش مصنوعی (۴)' },
  ai_matrix_title: { ar: 'شبكة محركات الذكاء الاصطناعي المؤتمتة بالمعمل (Automated AI Council):', en: 'Automated AI Council of the lab:', fr: 'Conseil IA automatisé du laboratoire :', es: 'Consejo IA automatizado del laboratorio:', it: 'Consiglio IA automatizzato del laboratorio:', de: 'Automatisierter KI-Rat des Labors:', ru: 'Автоматический ИИ-совет лаборатории:', zh: '实验室自动化 AI 议会：', tr: 'Laboratuvarın otomatik YZ konseyi:', fa: 'شورای خودکار هوش مصنوعی آزمایشگاه:' },
  matrix_gemini_desc: { ar: 'حسابات الأوزان بالغرام والمل وسرعة الاستجابة.', en: 'Gram & ml weight math with fast responses.', fr: 'Calculs en grammes et ml, réponses rapides.', es: 'Cálculos en gramos y ml, respuestas rápidas.', it: 'Calcoli in grammi e ml, risposte rapide.', de: 'Gramm- und ml-Berechnungen mit schnellen Antworten.', ru: 'Расчёты в граммах и мл, быстрые ответы.', zh: '克与毫升计算，响应迅速。', tr: 'Gram ve ml hesaplamaları, hızlı yanıtlar.', fa: 'محاسبات گرم و میلی‌لیتر با پاسخ سریع.' },
  matrix_deepseek_desc: { ar: 'استدلال كيميائي، الكثافة ومعايير IFRA.', en: 'Chemical reasoning, density, and IFRA standards.', fr: 'Raisonnement chimique, densité et normes IFRA.', es: 'Razonamiento químico, densidad y normas IFRA.', it: 'Ragionamento chimico, densità e norme IFRA.', de: 'Chemielogik, Dichte und IFRA-Normen.', ru: 'Химическая логика, плотность и стандарты IFRA.', zh: '化学推理、密度与 IFRA 标准。', tr: 'Kimyasal akıl yürütme, yoğunluk ve IFRA standartları.', fa: 'استدلال شیمیایی، چگالی و استانداردهای IFRA.' },
  matrix_openai_desc: { ar: 'هندسة الأكوردات، الفوحان وقوس الأداء.', en: 'Accord engineering, sillage, and performance arc.', fr: 'Ingénierie des accords, sillage et courbe de performance.', es: 'Ingeniería de acordes, estela y curva de rendimiento.', it: 'Ingegneria degli accordi, scia e curva di prestazione.', de: 'Akkord-Engineering, Sillage und Leistungskurve.', ru: 'Инжиниринг аккордов, шлейф и кривая звучания.', zh: '香调工程、扩散与表现曲线。', tr: 'Akor mühendisliği, iz ve performans eğrisi.', fa: 'مهندسی آکورد، انتشار و منحنی عملکرد.' },
  matrix_claude_desc: { ar: 'تقاليد جراس وتعتيق النيش الأرستقراطي.', en: 'Grasse traditions and aristocratic niche aging.', fr: 'Traditions de Grasse et maturation aristocratique.', es: 'Tradiciones de Grasse y añejamiento aristocrático.', it: 'Tradizioni di Grasse e affinamento aristocratico.', de: 'Grasse-Traditionen und aristokratische Reifung.', ru: 'Традиции Граса и аристократическое настаивание.', zh: '格拉斯传统与贵族式小众陈化。', tr: 'Grasse gelenekleri ve aristokratik niş olgunlaşması.', fa: 'سنت‌های گراس و تعریف اشرافی نیچ.' },
  you: { ar: 'أنت', en: 'You', fr: 'Vous', es: 'Tú', it: 'Tu', de: 'Sie', ru: 'Вы', zh: '您', tr: 'Siz', fa: 'شما' },
  alt_shahin: { ar: 'شاهين', en: 'Shahin', fr: 'Shahin', es: 'Shahin', it: 'Shahin', de: 'Shahin', ru: 'Шахин', zh: 'Shahin', tr: 'Shahin', fa: 'شاهین' },
  default_badge: { ar: '⚡ مجلس الخبراء المؤتمت', en: '⚡ Automated Expert Council', fr: '⚡ Conseil automatisé', es: '⚡ Consejo automatizado', it: '⚡ Consiglio automatizzato', de: '⚡ Automatisierter Rat', ru: '⚡ Автосовет экспертов', zh: '⚡ 自动化专家议会', tr: '⚡ Otomatik uzman konseyi', fa: '⚡ شورای خودکار متخصصان' },
  perspectives_lbl: { ar: 'تبديل منظور المحركات المستشارة:', en: 'Switch consulted-engine perspective:', fr: 'Changer de perspective des moteurs :', es: 'Cambiar perspectiva de motores:', it: 'Cambia prospettiva dei motori:', de: 'Perspektive der Engines wechseln:', ru: 'Переключить мнение движков:', zh: '切换咨询引擎视角：', tr: 'Danışılan motor perspektifini değiştir:', fa: 'تغییر دیدگاه موتورهای مشاور:' },
  models_count: { ar: '4 نماذج متزامنة', en: '4 parallel models', fr: '4 modèles en parallèle', es: '4 modelos en paralelo', it: '4 modelli in parallelo', de: '4 parallele Modelle', ru: '4 модели параллельно', zh: '4 个并行模型', tr: '4 paralel model', fa: '۴ مدل موازی' },
  unified_summary: { ar: '⚡ خلاصة شاهين الموحدة', en: '⚡ Shahin Unified Verdict', fr: '⚡ Verdict unifié de Shahin', es: '⚡ Veredicto unificado de Shahin', it: '⚡ Verdetto unificato di Shahin', de: '⚡ Shahins vereinigtes Urteil', ru: '⚡ Единый вывод Шахина', zh: '⚡ Shahin 统一结论', tr: '⚡ Shahin birleşik özeti', fa: '⚡ نتیجه واحد شاهین' },
  convert_lbl: { ar: 'تحويل بيانات هذه الخلطة لأيقونات وحاسبات التطبيق:', en: 'Convert this blend into app tools:', fr: 'Convertir cette composition en outils :', es: 'Convertir esta mezcla en herramientas:', it: 'Converti questa miscela in strumenti:', de: 'Diese Mischung in App-Werkzeuge umwandeln:', ru: 'Перенести эту смесь в инструменты приложения:', zh: '将此配方转换为应用工具：', tr: 'Bu karışımı uygulama araçlarına aktar:', fa: 'تبدیل این ترکیب به ابزارهای برنامه:' },
  to_conc_tooltip: { ar: 'تطبيق مقادير هذه الخلطة في حاسبة التركيب وتعبئة الزجاجة', en: 'Apply this blend to the compounding calculator', fr: 'Appliquer au calculateur de composition', es: 'Aplicar a la calculadora de composición', it: 'Applica al calcolatore di composizione', de: 'In den Kompositionsrechner übernehmen', ru: 'Применить в калькуляторе составления', zh: '将此配方应用到调配计算器', tr: 'Bu karışımı hesaplayıcıya uygula', fa: 'اعمال این ترکیب در ماشین‌حساب' },
  to_conc_lbl: { ar: 'حاسبة التركيب', en: 'Compounding Calculator', fr: 'Calculateur', es: 'Calculadora', it: 'Calcolatore', de: 'Rechner', ru: 'Калькулятор', zh: '调配计算器', tr: 'Hesaplayıcı', fa: 'ماشین‌حساب' },
  to_pyramid_tooltip: { ar: 'نقل النوتات العطرية إلى حاسبة الهرم العطري', en: 'Transfer notes to the pyramid calculator', fr: 'Transférer les notes vers la pyramide', es: 'Transferir notas a la pirámide', it: 'Trasferisci le note alla piramide', de: 'Noten in den Pyramidenrechner übertragen', ru: 'Перенести ноты в калькулятор пирамиды', zh: '将香材转移到金字塔计算器', tr: 'Notaları piramit hesaplayıcısına aktar', fa: 'انتقال نت‌ها به ماشین‌حساب هرم' },
  to_pyramid_lbl: { ar: 'الهرم العطري', en: 'Fragrance Pyramid', fr: 'Pyramide olfactive', es: 'Pirámide olfativa', it: 'Piramide olfattiva', de: 'Duftpyramide', ru: 'Пирамида', zh: '香调金字塔', tr: 'Koku piramidi', fa: 'هرم عطری' },
  to_lib_tooltip: { ar: 'تدوين وحفظ هذه الخلطة فوراً في مكتبة الوصفات والتشغيلات', en: 'Record this blend into the recipe library', fr: 'Enregistrer cette composition dans le carnet', es: 'Guardar esta mezcla en la biblioteca', it: 'Salva questa miscela nella libreria', de: 'Diese Mischung im Rezeptbuch speichern', ru: 'Сохранить эту смесь в книге рецептов', zh: '将此配方记入配方库', tr: 'Bu karışımı tarif kitaplığına kaydet', fa: 'ثبت این ترکیب در کتابخانه دستورها' },
  recorded_ok: { ar: 'تم التدوين!', en: 'Recorded!', fr: 'Enregistré !', es: '¡Guardado!', it: 'Salvato!', de: 'Gespeichert!', ru: 'Записано!', zh: '已记录！', tr: 'Kaydedildi!', fa: 'ثبت شد!' },
  to_lib_lbl: { ar: 'تدوين الخلطة', en: 'Record Blend', fr: 'Enregistrer', es: 'Guardar mezcla', it: 'Salva miscela', de: 'Mischung speichern', ru: 'Записать смесь', zh: '记录配方', tr: 'Karışımı kaydet', fa: 'ثبت ترکیب' },
  to_cost_tooltip: { ar: 'حساب تكلفة إنتاج وسعر بيع هذه التركيبة', en: 'Calculate production cost and retail price', fr: 'Calculer coût de production et prix de vente', es: 'Calcular coste de producción y precio', it: 'Calcola costo di produzione e prezzo', de: 'Produktionskosten und Verkaufspreis berechnen', ru: 'Рассчитать себестоимость и цену', zh: '计算生产成本与售价', tr: 'Üretim maliyetini ve satış fiyatını hesapla', fa: 'محاسبه هزینه تولید و قیمت فروش' },
  to_cost_lbl: { ar: 'حساب التكلفة', en: 'Cost It', fr: 'Coûts', es: 'Costear', it: 'Costi', de: 'Kosten', ru: 'Себестоимость', zh: '成本计算', tr: 'Maliyet', fa: 'محاسبه هزینه' },
  ready_lbl: { ar: 'التركيبة جاهزة للتصنيع والمعمل:', en: 'Formula ready for manufacturing & lab:', fr: 'Formule prête pour la production :', es: 'Fórmula lista para producción:', it: 'Formula pronta per la produzione:', de: 'Formel fertig für Produktion & Labor:', ru: 'Формула готова к производству:', zh: '配方已可用于生产与实验室：', tr: 'Formül üretim ve laboratuvara hazır:', fa: 'فرمول برای تولید و آزمایشگاه آماده است:' },
  print_batch_lbl: { ar: 'طباعة بطاقة التشغيلة الرسمية ➔', en: 'Print official batch card ➔', fr: 'Imprimer la fiche officielle ➔', es: 'Imprimir ficha oficial ➔', it: 'Stampa scheda ufficiale ➔', de: 'Offizielle Chargenkarte drucken ➔', ru: 'Печать официальной карты партии ➔', zh: '打印正式批次卡 ➔', tr: 'Resmi parti kartını yazdır ➔', fa: 'چاپ کارت رسمی بچ ➔' },
  copy_q_tooltip: { ar: 'نسخ هذا السؤال', en: 'Copy this question', fr: 'Copier cette question', es: 'Copiar esta pregunta', it: 'Copia questa domanda', de: 'Diese Frage kopieren', ru: 'Скопировать вопрос', zh: '复制此提问', tr: 'Bu soruyu kopyala', fa: 'کپی این پرسش' },
  copy_a_tooltip: { ar: 'نسخ هذه الإجابة والتركيبة', en: 'Copy this answer & formula', fr: 'Copier cette réponse et formule', es: 'Copiar esta respuesta y fórmula', it: 'Copia risposta e formula', de: 'Antwort & Formel kopieren', ru: 'Скопировать ответ и формулу', zh: '复制此回答与配方', tr: 'Bu yanıtı ve formülü kopyala', fa: 'کپی این پاسخ و فرمول' },
  copied_ok: { ar: 'تم النسخ بنجاح!', en: 'Copied!', fr: 'Copié !', es: '¡Copiado!', it: 'Copiato!', de: 'Kopiert!', ru: 'Скопировано!', zh: '已复制！', tr: 'Kopyalandı!', fa: 'کپی شد!' },
  copy_q_lbl: { ar: 'نسخ السؤال', en: 'Copy question', fr: 'Copier la question', es: 'Copiar pregunta', it: 'Copia domanda', de: 'Frage kopieren', ru: 'Копировать вопрос', zh: '复制提问', tr: 'Soruyu kopyala', fa: 'کپی پرسش' },
  copy_a_lbl: { ar: 'نسخ الإجابة والتركيبة', en: 'Copy answer & formula', fr: 'Copier réponse et formule', es: 'Copiar respuesta y fórmula', it: 'Copia risposta e formula', de: 'Antwort & Formel kopieren', ru: 'Копировать ответ и формулу', zh: '复制回答与配方', tr: 'Yanıtı ve formülü kopyala', fa: 'کپی پاسخ و فرمول' },
  compare_tooltip: { ar: 'استشارة نموذج ذكاء اصطناعي آخر لمقارنة الرأي', en: 'Consult another AI model for a second opinion', fr: 'Consulter un autre modèle IA', es: 'Consultar otro modelo IA', it: 'Consulta un altro modello IA', de: 'Ein anderes KI-Modell befragen', ru: 'Спросить другую ИИ-модель', zh: '咨询另一个 AI 模型以对比意见', tr: 'İkinci görüş için başka bir YZ modeline danış', fa: 'مشورت با مدل هوش مصنوعی دیگر' },
  compare_lbl: { ar: 'مقارنة بنموذج آخر', en: 'Compare with another model', fr: 'Comparer avec un autre modèle', es: 'Comparar con otro modelo', it: 'Confronta con un altro modello', de: 'Mit anderem Modell vergleichen', ru: 'Сравнить с другой моделью', zh: '与其他模型对比', tr: 'Başka modelle karşılaştır', fa: 'مقایسه با مدل دیگر' },
  choose_model_lbl: { ar: 'اختر نموذجاً للمقارنة:', en: 'Pick a model to compare:', fr: 'Choisissez un modèle :', es: 'Elige un modelo:', it: 'Scegli un modello:', de: 'Modell wählen:', ru: 'Выберите модель:', zh: '选择要对比的模型：', tr: 'Karşılaştırılacak modeli seç:', fa: 'مدل مقایسه را انتخاب کنید:' },
  consult_prefix_tpl: { ar: '[استشارة متخصصة من محرك {m}]: ', en: '[Specialist consult from {m}]: ', fr: '[Consultation spécialisée de {m}] : ', es: '[Consulta especializada de {m}]: ', it: '[Consulenza specializzata da {m}]: ', de: '[Fachberatung von {m}]: ', ru: '[Консультация от {m}]: ', zh: '【来自 {m} 的专业咨询】：', tr: '[{m} uzman görüşü]: ', fa: '[مشاوره تخصصی از {m}]: ' },
  redo_formula: { ar: 'أعد حساب التركيبة السابقة', en: 'Recalculate the previous formula', fr: 'Recalculer la formule précédente', es: 'Recalcular la fórmula anterior', it: 'Ricalcola la formula precedente', de: 'Vorherige Formel neu berechnen', ru: 'Пересчитать предыдущую формулу', zh: '重新计算上一个配方', tr: 'Önceki formülü yeniden hesapla', fa: 'فرمول قبلی را دوباره محاسبه کن' },
  speech_tooltip: { ar: 'استماع صوتي لنصيحة الخبير شاهين', en: 'Listen to Master Shahin’s advice', fr: 'Écouter le conseil du Maître Shahin', es: 'Escuchar el consejo del Maestro Shahin', it: 'Ascolta il consiglio del Maestro Shahin', de: 'Meister Shahins Rat anhören', ru: 'Послушать совет мастера Шахина', zh: '语音收听 Shahin 大师建议', tr: 'Usta Shahin’in tavsiyesini dinle', fa: 'گوش‌دادن به توصیه استاد شاهین' },
  loading_status: { ar: 'الخبير شاهين يقطر الزيوت ويزن النوتات بالميزان...', en: 'Master Shahin is dripping oils and weighing notes...', fr: 'Le Maître Shahin pèse les notes goutte à goutte…', es: 'El Maestro Shahin está pesando las notas...', it: 'Il Maestro Shahin sta pesando le note…', de: 'Meister Shahin wiegt die Noten ab…', ru: 'Мастер Шахин отвешивает ноты…', zh: 'Shahin 大师正在滴油并称量香材……', tr: 'Usta Shahin yağları damlatıp notaları tartıyor…', fa: 'استاد شاهین روغن‌ها را می‌چکاند و نت‌ها را وزن می‌کند...' },
  quick_cmds_lbl: { ar: 'أوامر وتفاعلات سريعة:', en: 'Quick commands:', fr: 'Commandes rapides :', es: 'Comandos rápidos:', it: 'Comandi rapidi:', de: 'Schnellbefehle:', ru: 'Быстрые команды:', zh: '快捷指令：', tr: 'Hızlı komutlar:', fa: 'فرمان‌های سریع:' },
  input_ph: { ar: 'اسأل الخبير شاهين أو اطلب تطبيق الخلطة (مثال: تمام تقترح عليا انهى تركيبة بالظبط ونسب المكونات قد اية)...', en: 'Ask Master Shahin or request to apply the blend (e.g.: finalize this formula with exact ingredient ratios)...', fr: 'Demandez au Maître Shahin (ex. : finalise cette formule avec les ratios exacts)…', es: 'Pregunta al Maestro Shahin (ej.: finaliza esta fórmula con ratios exactos)...', it: 'Chiedi al Maestro Shahin (es. finalizza questa formula con le percentuali esatte)...', de: 'Fragen Sie Meister Shahin (z. B. Formel mit exakten Verhältnissen finalisieren)…', ru: 'Спросите мастера Шахина (напр. заверши формулу с точными пропорциями)…', zh: '向 Shahin 大师提问或要求应用配方（例如：用精确比例完成此配方）……', tr: 'Usta Shahin’e sor (örn. bu formülü net oranlarla tamamla)...', fa: 'از استاد شاهین بپرسید یا اعمال ترکیب را بخواهید (مثال: این فرمول را با نسبت‌های دقیق کامل کن)...' },
  send: { ar: 'إرسال', en: 'Send', fr: 'Envoyer', es: 'Enviar', it: 'Invia', de: 'Senden', ru: 'Отправить', zh: '发送', tr: 'Gönder', fa: 'ارسال' },
} satisfies Record<string, LText>;

export const PerfumerMasterLabView: React.FC<PerfumerMasterLabViewProps> = ({
  currentLang = 'ar',
  onApplyToConcentrationCalculator,
  onApplyToPyramidCalculator,
  onRecordToRecipeLibrary,
  onCalculateCosting,
  onPrintSpecSheet,
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
  const masterPrompts: string[] = [L('prompt_1'), L('prompt_2'), L('prompt_3'), L('prompt_4'), L('prompt_5')];
  // Load persisted session with 30-day (1 month) expiration check
  const [sessionData, setSessionData] = useState(() => loadStoredChatSession());
  const [messages, setMessages] = useState<ChatMessage[]>(() => sessionData.messages);
  const [daysRemaining, setDaysRemaining] = useState(sessionData.daysRemaining);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scaleWeight, setScaleWeight] = useState(14.85);
  const [dripping, setDripping] = useState(false);
  const [compoundingStep, setCompoundingStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Multi-AI Model Orchestrator State
  const [selectedModel, setSelectedModel] = useState<'auto' | 'gemini' | 'deepseek' | 'openai' | 'claude'>('auto');
  const [comparingMsgId, setComparingMsgId] = useState<string | null>(null);
  const [showAiMatrix, setShowAiMatrix] = useState(false);

  const AI_ENGINES = [
    { id: 'auto', name: L('eng_auto_name'), short: L('eng_auto_short'), badge: L('eng_auto_badge'), color: 'border-amber-400 bg-amber-500/20 text-amber-300', desc: L('eng_auto_desc') },
    { id: 'gemini', name: 'Google Gemini 3.8 Flash', short: L('eng_gemini_short'), badge: '✨ Gemini 3.8 Flash', color: 'border-emerald-400 bg-emerald-500/20 text-emerald-300', desc: L('eng_gemini_desc') },
    { id: 'deepseek', name: 'DeepSeek R1 Chemistry', short: L('eng_deepseek_short'), badge: '🔬 DeepSeek R1', color: 'border-blue-400 bg-blue-500/20 text-blue-300', desc: L('eng_deepseek_desc') },
    { id: 'openai', name: 'ChatGPT GPT-4o Architect', short: L('eng_openai_short'), badge: '🟢 GPT-4o Architect', color: 'border-green-400 bg-green-500/20 text-green-300', desc: L('eng_openai_desc') },
    { id: 'claude', name: 'Claude 3.5 Haute Parfumerie', short: L('eng_claude_short'), badge: '🟣 Claude 3.5 Sonnet', color: 'border-purple-400 bg-purple-500/20 text-purple-300', desc: L('eng_claude_desc') },
  ];

  const setActivePerspectiveForMessage = (msgId: string, tabId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, activePerspectiveTab: tabId } : m))
    );
  };

  const handleSpeech = (text: string) => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LOCALE_MAP[currentLang] || 'ar-SA';
      utterance.rate = 0.95;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Copy & clear state trackers
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [recordedId, setRecordedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Persist messages whenever changed & broadcast to sync floating window
  useEffect(() => {
    saveChatSession(messages);
    window.dispatchEvent(new CustomEvent('miyaar-chat-updated', { detail: messages }));
  }, [messages]);

  // Sync with updates from floating chat window
  useEffect(() => {
    const handleSync = (e: any) => {
      if (Array.isArray(e.detail)) {
        setMessages(e.detail);
      }
    };
    window.addEventListener('miyaar-chat-updated', handleSync);
    return () => window.removeEventListener('miyaar-chat-updated', handleSync);
  }, []);

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setCompoundingStep((prev) => (prev + 1) % 4);
        setScaleWeight((prev) => +(prev + 0.35).toFixed(2));
      }, 1100);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const compoundingPhrases = [
    L('comp_1'),
    L('comp_2'),
    L('comp_3'),
    L('comp_4'),
  ];

  const handleSend = async (
    customText?: string,
    overrideModel?: 'auto' | 'gemini' | 'deepseek' | 'openai' | 'claude'
  ) => {
    const text = (customText || input).trim();
    if (!text || isLoading || isStaticHosting) return;

    const activeModelChoice = overrideModel || selectedModel;

    // Check if user requested an immediate interactive action by text command
    const lower = text.toLowerCase();
    if (
      (lower.includes('طبق') || lower.includes('حول') || lower.includes('انقل')) &&
      (lower.includes('حاسبة') || lower.includes('تركيب'))
    ) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          const formula = extractFormulaFromAIMessage(messages[i].text);
          if (formula) {
            onApplyToConcentrationCalculator(formula);
            return;
          }
        }
      }
    }

    const userMsg: ChatMessage = {
      id: 'u-' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString(LOCALE_MAP[currentLang], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setDripping(true);

    try {
      const data = await requestApi<ChatResponse>('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          model: activeModelChoice,
          // Same rules as the floating chat: the site language, and a bounded history without the
          // welcome/error bubbles (the server rejects >24 turns or >16k chars, which broke long chats).
          language: currentLang,
          conversationHistory: chatHistory(messages),
        }),
      });
      if (typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error('Chat response is empty');
      }
      const reply = data.reply || L('retry_later');

      setMessages((prev) => [
        ...prev,
        {
          id: 'b-' + Date.now(),
          role: 'assistant',
          text: reply,
          timestamp: new Date().toLocaleTimeString(LOCALE_MAP[currentLang], { hour: '2-digit', minute: '2-digit' }),
          aiEngine: data.engine,
          perspectives: data.perspectives,
          activePerspectiveTab: 'consensus',
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          role: 'assistant',
          text: chatErrorText(currentLang, err),
          timestamp: new Date().toLocaleTimeString(LOCALE_MAP[currentLang], { hour: '2-digit', minute: '2-digit' }),
          aiEngine: {
            id: 'ensemble',
            name: L('shahin_name'),
            badge: L('fallback_badge'),
            provider: 'ensemble',
          },
        },
      ]);
    } finally {
      setIsLoading(false);
      setDripping(false);
    }
  };

  const handleCopySingle = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyEntireChat = () => {
    const transcript = messages
      .map((m) => `[${m.role === 'user' ? L('q_word') : L('shahin_name')} - ${m.timestamp}]:\n${m.text}`)
      .join('\n\n' + '─'.repeat(40) + '\n\n');

    navigator.clipboard.writeText(transcript);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleClearHistory = () => {
    clearChatSession();
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setDaysRemaining(30);
    setShowClearConfirm(false);
  };

  const handleManualDrop = () => {
    setDripping(true);
    setScaleWeight((prev) => +(prev + 0.22).toFixed(2));
    setTimeout(() => setDripping(false), 800);
  };

  return (
    <div className="space-y-4">
      <StaticHostingNotice currentLang={currentLang} />
      {/* 1. Compact Slim Header with Expiry Info & Controls */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-amber-600 shrink-0">
            <img
              src={perfumerImg}
              alt="Master Shahin"
              className="w-full h-full object-cover object-top"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-stone-900 font-serif-luxury">
                {L('council_title')}
              </h2>
              {/* 30-Day Auto-Purge Persistence Badge */}
              <div
                className="flex items-center gap-1 text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-medium"
                title={L('vault_tooltip')}
              >
                <Clock className="w-3 h-3 text-emerald-700" />
                <span>{fmt(L('vault_badge_tpl'), { d: daysRemaining })}</span>
              </div>
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              {isLoading ? (
                <span className="text-amber-800 font-medium animate-pulse">
                  🧪 {compoundingPhrases[compoundingStep]}
                </span>
              ) : (
                L('session_desc')
              )}
            </div>
          </div>
        </div>

        {/* Workbench Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Scale Display */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-mono-numbers">
            <span className="text-stone-400 text-[10px]">{L('scale')}</span>
            <span className="text-amber-400 font-bold">{scaleWeight} g</span>
          </div>

          <button
            onClick={handleManualDrop}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
            title={L('add_drop_tooltip')}
          >
            <Droplet className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">{L('add_drop')}</span>
          </button>

          {/* Download TXT Transcript */}
          <button
            onClick={() => exportChatTranscriptToFile(messages, daysRemaining)}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            title={L('export_tooltip')}
          >
            <Download className="w-3.5 h-3.5 text-amber-800" />
            <span className="hidden sm:inline">{L('export_txt')}</span>
          </button>

          <button
            onClick={handleCopyEntireChat}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            title={L('copy_tooltip')}
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">{L('copied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{L('copy_all')}</span>
              </>
            )}
          </button>

          {/* Manual Clear Session Button */}
          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title={L('clear_tooltip')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Confirmation Modal to Clear Chat Manually */}
      {showClearConfirm && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>
              {fmt(L('clear_confirm_tpl'), { d: daysRemaining })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2.5 py-1 bg-white border border-stone-200 rounded text-stone-600 hover:bg-stone-50 cursor-pointer"
            >
              {L('cancel')}
            </button>
            <button
              onClick={handleClearHistory}
              className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded cursor-pointer"
            >
              {L('confirm_wipe')}
            </button>
          </div>
        </div>
      )}

      {/* 2. Expanded Chat Board Container */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-md flex flex-col h-[780px] overflow-hidden">
        
        {/* Multi-AI Model Selector Toolbar */}
        <div className="px-3.5 py-2.5 bg-stone-950 text-white border-b border-stone-800 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 shrink-0 text-amber-400 font-bold text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{L('engine_lbl')}</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {AI_ENGINES.map((eng) => {
              const isSelected = selectedModel === eng.id;
              return (
                <button
                  key={eng.id}
                  onClick={() => setSelectedModel(eng.id as any)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border ${
                    isSelected
                      ? eng.color + ' font-bold shadow-xs'
                      : 'bg-stone-900/90 text-stone-400 hover:text-stone-200 border-stone-800 hover:border-stone-700'
                  }`}
                  title={eng.name + ' - ' + eng.desc}
                >
                  <span>{eng.short}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                </button>
              );
            })}

            {/* AI Matrix HUD Button */}
            <button
              onClick={() => setShowAiMatrix(!showAiMatrix)}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border ${
                showAiMatrix
                  ? 'bg-amber-400 text-stone-950 border-amber-300 font-bold'
                  : 'bg-stone-900 text-amber-300 border-stone-800 hover:border-amber-500/40'
              }`}
              title={L('ai_matrix_tooltip')}
            >
              <Layers className="w-3 h-3" />
              <span className="hidden md:inline">{L('ai_network_lbl')}</span>
            </button>
          </div>
        </div>

        {/* Connected AI Engines Matrix Panel */}
        {showAiMatrix && (
          <div className="p-3.5 bg-stone-900 text-stone-200 border-b border-stone-800 text-xs space-y-2 shrink-0 animate-in fade-in">
            <div className="flex items-center justify-between text-amber-300 font-bold text-xs">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{L('ai_matrix_title')}</span>
              </span>
              <button onClick={() => setShowAiMatrix(false)} className="text-stone-400 hover:text-white cursor-pointer">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded-xl bg-stone-950 border border-emerald-500/30 flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0 animate-pulse" />
                <div>
                  <div className="font-bold text-emerald-300">Google Gemini 3.8 Flash</div>
                  <div className="text-stone-400 text-[10px]">{L('matrix_gemini_desc')}</div>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-stone-950 border border-blue-500/30 flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 mt-1 shrink-0 animate-pulse" />
                <div>
                  <div className="font-bold text-blue-300">DeepSeek R1 Chemistry</div>
                  <div className="text-stone-400 text-[10px]">{L('matrix_deepseek_desc')}</div>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-stone-950 border border-green-500/30 flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 mt-1 shrink-0 animate-pulse" />
                <div>
                  <div className="font-bold text-green-300">ChatGPT GPT-4o Architect</div>
                  <div className="text-stone-400 text-[10px]">{L('matrix_openai_desc')}</div>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-stone-950 border border-purple-500/30 flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 mt-1 shrink-0 animate-pulse" />
                <div>
                  <div className="font-bold text-purple-300">Claude 3.5 Haute Parfumerie</div>
                  <div className="text-stone-400 text-[10px]">{L('matrix_claude_desc')}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages Stream Board */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-stone-50/50">
          {messages.map((m) => {
            const activeDisplayContent =
              m.activePerspectiveTab && m.activePerspectiveTab !== 'consensus' && m.perspectives
                ? m.perspectives.find((p) => p.modelId === m.activePerspectiveTab)?.reply || m.text
                : m.text;

            const extractedFormula = m.role === 'assistant' ? extractFormulaFromAIMessage(activeDisplayContent) : null;

            return (
              <div
                key={m.id}
                className={`flex items-start gap-3 sm:gap-4 ${
                  m.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs ${
                    m.role === 'user'
                      ? 'bg-amber-900 text-amber-200'
                      : 'overflow-hidden border border-amber-700/60'
                  }`}
                >
                  {m.role === 'user' ? (
                    L('you')
                  ) : (
                    <img
                      src={perfumerImg}
                      alt={L('alt_shahin')}
                      className="w-full h-full object-cover object-top"
                    />
                  )}
                </div>

                {/* Message Content Bubble */}
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 ${
                    m.role === 'user'
                      ? 'bg-amber-900 text-white rounded-tl-xs'
                      : 'bg-white text-stone-900 border border-stone-200 rounded-tr-xs'
                  }`}
                >
                  {/* AI Engine Header for Assistant */}
                  {m.role === 'assistant' && (
                    <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-stone-100 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-amber-950 font-serif-luxury text-xs">{L('shahin_name')}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 ${
                          m.aiEngine?.provider === 'deepseek' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                          m.aiEngine?.provider === 'openai' ? 'bg-green-50 text-green-800 border-green-200' :
                          m.aiEngine?.provider === 'claude' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                          m.aiEngine?.provider === 'gemini' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          'bg-amber-50 text-amber-900 border-amber-200'
                        }`}>
                          <span>{m.aiEngine?.badge || L('default_badge')}</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-400 font-mono-numbers">{m.timestamp}</span>
                    </div>
                  )}

                  {/* Perspective Switcher Tabs on Message */}
                  {m.role === 'assistant' && m.perspectives && m.perspectives.length > 0 && (
                    <div className="p-1.5 bg-stone-50 rounded-xl border border-stone-200/80 mb-2 space-y-1">
                      <div className="text-[10px] text-stone-500 font-bold flex items-center justify-between px-1">
                        <span>{L('perspectives_lbl')}</span>
                        <span className="text-[9px] text-amber-700 bg-amber-100/60 px-1.5 py-0.2 rounded font-mono-numbers">{L('models_count')}</span>
                      </div>
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                        <button
                          onClick={() => setActivePerspectiveForMessage(m.id, 'consensus')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 border ${
                            (!m.activePerspectiveTab || m.activePerspectiveTab === 'consensus')
                              ? 'bg-amber-200/90 text-amber-950 border-amber-400 shadow-2xs'
                              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          <span>{L('unified_summary')}</span>
                        </button>
                        {m.perspectives.map((p) => {
                          const isActive = m.activePerspectiveTab === p.modelId;
                          return (
                            <button
                              key={p.modelId}
                              onClick={() => setActivePerspectiveForMessage(m.id, p.modelId)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 border ${
                                isActive
                                  ? p.color + ' font-bold shadow-2xs'
                                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                              }`}
                            >
                              <span>{p.badge}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Text Payload */}
                  <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line font-sans break-words space-y-2">
                    {activeDisplayContent}
                  </div>

                  {/* SMART INTERACTION BAR: Transfer Chat Data to App Modules */}
                  {extractedFormula && (
                    <div className="mt-3 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl space-y-2.5 text-xs text-amber-950 animate-in fade-in">
                      <div className="flex items-center justify-between font-bold text-amber-900">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-700" />
                          <span>{L('convert_lbl')}</span>
                        </span>
                        <span className="text-[10px] font-mono-numbers bg-white px-2 py-0.5 rounded border border-amber-200">
                          {extractedFormula.concentrationPercent}% {extractedFormula.concentrationType.toUpperCase()}
                        </span>
                      </div>

                      {/* Interactive Transfer Buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <button
                          onClick={() => onApplyToConcentrationCalculator(extractedFormula)}
                          className="p-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                          title={L('to_conc_tooltip')}
                        >
                          <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                          <span>{L('to_conc_lbl')}</span>
                        </button>

                        <button
                          onClick={() => onApplyToPyramidCalculator(extractedFormula)}
                          className="p-2 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                          title={L('to_pyramid_tooltip')}
                        >
                          <Layers className="w-3.5 h-3.5 text-amber-700" />
                          <span>{L('to_pyramid_lbl')}</span>
                        </button>

                        <button
                          onClick={() => {
                            onRecordToRecipeLibrary(extractedFormula);
                            setRecordedId(m.id);
                            setTimeout(() => setRecordedId(null), 3000);
                          }}
                          className="p-2 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                          title={L('to_lib_tooltip')}
                        >
                          {recordedId === m.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">{L('recorded_ok')}</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{L('to_lib_lbl')}</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => onCalculateCosting(extractedFormula)}
                          className="p-2 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                          title={L('to_cost_tooltip')}
                        >
                          <DollarSign className="w-3.5 h-3.5 text-amber-800" />
                          <span>{L('to_cost_lbl')}</span>
                        </button>
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[11px] text-amber-900/80 border-t border-amber-200/60">
                        <span>{L('ready_lbl')}</span>
                        <button
                          onClick={() => onPrintSpecSheet(extractedFormula)}
                          className="text-amber-900 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3 h-3 text-amber-800" />
                          <span>{L('print_batch_lbl')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bottom Action Strip Under EVERY message */}
                  <div
                    className={`pt-2.5 mt-2 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] ${
                      m.role === 'user'
                        ? 'border-amber-800/80 text-amber-200'
                        : 'border-stone-100 text-stone-500'
                    }`}
                  >
                    <span className="font-mono-numbers">{m.timestamp}</span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopySingle(m.id, activeDisplayContent)}
                        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer font-medium text-xs ${
                          m.role === 'user'
                            ? 'bg-amber-800/80 hover:bg-amber-700 text-white'
                            : 'bg-stone-100 hover:bg-amber-50 hover:text-amber-900 text-stone-700 border border-stone-200/70'
                        }`}
                        title={m.role === 'user' ? L('copy_q_tooltip') : L('copy_a_tooltip')}
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">{L('copied_ok')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{m.role === 'user' ? L('copy_q_lbl') : L('copy_a_lbl')}</span>
                          </>
                        )}
                      </button>

                      {m.role === 'assistant' && (
                        <>
                          {/* Re-consult another model */}
                          <div className="relative">
                            <button
                              onClick={() => setComparingMsgId(comparingMsgId === m.id ? null : m.id)}
                              className="px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-950 border border-stone-200/70 transition-colors flex items-center gap-1 cursor-pointer font-medium text-xs"
                              title={L('compare_tooltip')}
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                              <span className="hidden sm:inline">{L('compare_lbl')}</span>
                            </button>

                            {comparingMsgId === m.id && (
                              <div className="absolute left-0 bottom-full mb-1 z-30 bg-stone-900 text-white rounded-xl p-2 shadow-2xl border border-stone-700 min-w-[220px] space-y-1 text-xs animate-in fade-in zoom-in-95">
                                <div className="text-[10px] text-amber-400 font-bold px-1.5 pb-1 border-b border-stone-800 flex items-center justify-between">
                                  <span>{L('choose_model_lbl')}</span>
                                  <button onClick={() => setComparingMsgId(null)} className="text-stone-400 hover:text-white">
                                    ✕
                                  </button>
                                </div>
                                {AI_ENGINES.map((eng) => (
                                  <button
                                    key={eng.id}
                                    onClick={() => {
                                      const prevUserMsg = messages
                                        .slice(0, messages.findIndex((msg) => msg.id === m.id))
                                        .reverse()
                                        .find((msg) => msg.role === 'user');
                                      setComparingMsgId(null);
                                      setSelectedModel(eng.id as any);
                                      handleSend(
                                        `${fmt(L('consult_prefix_tpl'), { m: eng.short })}${prevUserMsg?.text || L('redo_formula')}`,
                                        eng.id as any
                                      );
                                    }}
                                    className="w-full text-right px-2 py-1.5 rounded-lg hover:bg-stone-800 text-stone-200 hover:text-white transition-colors flex items-center justify-between text-[11px] cursor-pointer"
                                  >
                                    <span>{eng.name}</span>
                                    <span className="text-[9px] text-stone-400">{eng.short}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleSpeech(activeDisplayContent)}
                            className="p-1 text-stone-500 hover:text-amber-800 transition-colors flex items-center gap-1 cursor-pointer"
                            title={L('speech_tooltip')}
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Active Compounding Loading Status */}
          {isLoading && (
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-amber-600 shrink-0">
                <img
                  src={perfumerImg}
                  alt={L('alt_shahin')}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200/90 p-4 sm:p-5 rounded-2xl text-xs sm:text-sm text-amber-950 space-y-2 shadow-xs max-w-[85%]">
                <div className="font-semibold flex items-center gap-2 text-amber-900">
                  <span className="animate-spin text-base">🧪</span>
                  <span>{L('loading_status')}</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {compoundingPhrases[compoundingStep]}
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. Fast Suggestion Strip */}
        <div className="p-3 bg-stone-100 border-t border-stone-200 overflow-x-auto flex items-center gap-2 text-xs no-scrollbar shrink-0">
          <span className="text-[11px] font-bold text-stone-500 whitespace-nowrap">
            {L('quick_cmds_lbl')}
          </span>
          {masterPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              disabled={isLoading || isStaticHosting}
              className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white hover:bg-amber-50 border border-stone-200 text-stone-700 hover:text-amber-900 text-xs transition-colors cursor-pointer shrink-0 shadow-2xs font-medium"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* 4. Large Interactive Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3.5 sm:p-4 bg-white border-t border-stone-200 flex items-center gap-3 shrink-0"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder={L('input_ph')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || isStaticHosting}
            className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-amber-700 focus:bg-white transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || isStaticHosting}
            className="px-6 py-3 bg-amber-800 hover:bg-amber-900 disabled:opacity-40 text-white rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-xs"
          >
            <span>{L('send')}</span>
            <Send className="w-4 h-4 rotate-180" />
          </button>
        </form>

      </div>
    </div>
  );
};
