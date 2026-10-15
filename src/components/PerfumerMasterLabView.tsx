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
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import perfumerImg from '../assets/images/master_perfumer_compounding_1791693212967.jpg';
import { extractFormulaFromAIMessage, isFormulaTransferCommand, ExtractedAIPerfume } from '../utils/aiFormulaExtractor';
import { exportChatTranscriptToFile } from '../utils/chatStorage';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../utils/localizedContent';
import { LText, makeT, fmt, loc, LOCALE_MAP } from '../utils/localize';
import { isStaticHosting } from '../utils/api';
import { StaticHostingNotice } from './StaticHostingNotice';
import { ShaheenModesPanel, ShaheenServiceStatus, chatErrorText, shaheenWelcome } from './ShaheenServiceStatus';
import { ShaheenMarkdown, stripFormulaBlock } from './ShaheenMarkdown';
import { ENGINE_BADGE, modeBadge, visibleEngines, scrollChatToEnd } from './shaheenEngines';
import type { ShaheenModelChoice } from '../utils/chatStore';
import { useShaheenChat } from '../hooks/useShaheenChat';
import { useShaheenModels } from '../hooks/useShaheenModels';
import { copyChatText } from '../utils/clipboard';

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
    en: 'Live chat with your full session saved automatically for a month, with export',
    fr: 'Échange en direct, session complète enregistrée automatiquement pendant un mois, avec export',
    es: 'Chat en vivo con la sesión completa guardada automáticamente durante un mes, con exportación',
    it: 'Chat dal vivo con la sessione salvata automaticamente per un mese, con esportazione',
    de: 'Live-Chat mit automatischer Speicherung der ganzen Sitzung für einen Monat, inklusive Export',
    ru: 'Живой чат: вся сессия автоматически сохраняется на месяц, с экспортом',
    zh: '实时对话，整个会话自动保存一个月，并可导出',
    tr: 'Canlı sohbet; tüm oturum bir ay boyunca otomatik kaydedilir ve dışa aktarılabilir',
    fa: 'گفتگوی زنده با ذخیره خودکار کل جلسه به مدت یک ماه و امکان برون‌بری',
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
  engine_lbl: { ar: 'طريقة الرد:', en: 'Answer style:', fr: 'Style de réponse :', es: 'Estilo de respuesta:', it: 'Stile di risposta:', de: 'Antwortstil:', ru: 'Стиль ответа:', zh: '回答方式：', tr: 'Yanıt biçimi:', fa: 'شیوه پاسخ:' },
  ai_matrix_tooltip: { ar: 'عرض أوضاع شاهين المتاحة الآن', en: 'See Shahin’s available modes', fr: 'Voir les modes disponibles de Shahin', es: 'Ver los modos disponibles de Shahin', it: 'Vedi le modalità disponibili di Shahin', de: 'Verfügbare Modi von Shahin anzeigen', ru: 'Посмотреть доступные режимы Шахина', zh: '查看 Shahin 当前可用的模式', tr: 'Shahin’in kullanılabilir modlarını gör', fa: 'مشاهده حالت‌های در دسترس شاهین' },
  ai_network_lbl: { ar: 'الأوضاع', en: 'Modes', fr: 'Modes', es: 'Modos', it: 'Modalità', de: 'Modi', ru: 'Режимы', zh: '模式', tr: 'Modlar', fa: 'حالت‌ها' },
  ai_matrix_title: { ar: 'أوضاع الخبير شاهين المتاحة الآن:', en: 'Master Shahin’s modes right now:', fr: 'Modes de Maître Shahin :', es: 'Modos del Maestro Shahin:', it: 'Modalità del Maestro Shahin:', de: 'Modi von Meister Shahin:', ru: 'Режимы мастера Шахина:', zh: 'Shahin 大师当前的模式：', tr: 'Usta Shahin’in modları:', fa: 'حالت‌های استاد شاهین:' },
  you: { ar: 'أنت', en: 'You', fr: 'Vous', es: 'Tú', it: 'Tu', de: 'Sie', ru: 'Вы', zh: '您', tr: 'Siz', fa: 'شما' },
  alt_shahin: { ar: 'شاهين', en: 'Shahin', fr: 'Shahin', es: 'Shahin', it: 'Shahin', de: 'Shahin', ru: 'Шахин', zh: 'Shahin', tr: 'Shahin', fa: 'شاهین' },
  default_badge: { ar: 'شاهين', en: 'Shahin' },
  error_badge: { ar: 'تنبيه', en: 'Notice', fr: 'Avis', es: 'Aviso', it: 'Avviso', de: 'Hinweis', ru: 'Уведомление', zh: '提示', tr: 'Uyarı', fa: 'هشدار' },
  retry: { ar: 'إعادة المحاولة', en: 'Retry', fr: 'Réessayer', es: 'Reintentar', it: 'Riprova', de: 'Erneut versuchen', ru: 'Повторить', zh: '重试', tr: 'Tekrar dene', fa: 'تلاش دوباره' },
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
  compare_tooltip: { ar: 'اطلب رأياً ثانياً بطريقة رد أخرى', en: 'Ask for a second opinion in another answer style', fr: 'Demander un second avis dans un autre style', es: 'Pedir una segunda opinión con otro estilo', it: 'Chiedi un secondo parere con un altro stile', de: 'Zweite Meinung in einem anderen Stil anfordern', ru: 'Попросить второе мнение в другом стиле', zh: '以另一种回答方式获取第二意见', tr: 'Başka bir yanıt biçimiyle ikinci görüş iste', fa: 'درخواست نظر دوم با شیوه پاسخ دیگر' },
  compare_lbl: { ar: 'رأي ثانٍ', en: 'Second opinion', fr: 'Second avis', es: 'Segunda opinión', it: 'Secondo parere', de: 'Zweite Meinung', ru: 'Второе мнение', zh: '第二意见', tr: 'İkinci görüş', fa: 'نظر دوم' },
  choose_model_lbl: { ar: 'اختر طريقة الرد:', en: 'Pick an answer style:', fr: 'Choisissez un style :', es: 'Elige un estilo:', it: 'Scegli uno stile:', de: 'Stil wählen:', ru: 'Выберите стиль:', zh: '选择回答方式：', tr: 'Bir yanıt biçimi seçin:', fa: 'شیوه پاسخ را انتخاب کنید:' },
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
  // Same conversation store as the floating Shaheen window (one history, never overwritten by the other).
  const { messages, setMessages, daysRemaining, isLoading, sendMessage, retryLast, clearHistory } = useShaheenChat();
  const modelStatus = useShaheenModels();
  const selectedModel = modelStatus.selected;
  const setSelectedModel = modelStatus.setSelected;

  const [input, setInput] = useState('');
  const [scaleWeight, setScaleWeight] = useState(14.85);
  const [dripping, setDripping] = useState(false);
  const [compoundingStep, setCompoundingStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Multi-AI Model Orchestrator State
  const [comparingMsgId, setComparingMsgId] = useState<string | null>(null);
  const [showAiMatrix, setShowAiMatrix] = useState(false);

  // Shaheen's response modes the server says can answer (no engine or vendor names reach visitors).
  const AI_ENGINES = visibleEngines(modelStatus.engines, currentLang);
  const enabledEngineCount = (modelStatus.models || []).filter((m) => m.hasApiKey && AI_ENGINES.some((e) => e.id === m.id)).length;

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
    scrollChatToEnd(messagesEndRef.current);
  }, [messages, isLoading]);

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setCompoundingStep((prev) => (prev + 1) % 4);
        setScaleWeight((prev) => +(prev + 0.35).toFixed(2));
      }, 1100);
    }
    setDripping(isLoading);
    return () => clearInterval(interval);
  }, [isLoading]);

  const compoundingPhrases = [
    L('comp_1'),
    L('comp_2'),
    L('comp_3'),
    L('comp_4'),
  ];

  const handleSend = async (customText?: string, overrideModel?: ShaheenModelChoice) => {
    const text = (customText || input).trim();
    if (!text || text.length > 4000 || isLoading || isStaticHosting) return;
    // Only an explicit transfer command applies an earlier formula (never "…حول تركيبة…").
    if (isFormulaTransferCommand(text)) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant' && messages[i].kind !== 'error') {
          const formula = extractFormulaFromAIMessage(messages[i].text);
          if (formula) { onApplyToConcentrationCalculator(formula); if (!customText) setInput(''); return; }
        }
      }
    }
    if (!customText) setInput('');
    await sendMessage({ text, model: overrideModel || selectedModel, language: currentLang,
      errorText: (error) => chatErrorText(currentLang, error) });
  };

  const handleCopySingle = async (id: string, text: string) => {
    if (!await copyChatText(text)) return;
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyEntireChat = async () => {
    const transcript = messages
      .map((m) => `[${m.role === 'user' ? L('q_word') : L('shahin_name')} - ${m.timestamp}]:\n${m.text}`)
      .join('\n\n' + '─'.repeat(40) + '\n\n');

    if (!await copyChatText(transcript)) return;
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleClearHistory = () => {
    clearHistory();
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
                  onClick={() => setSelectedModel(eng.id)}
                  aria-pressed={isSelected}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border ${
                    isSelected
                      ? eng.color + ' font-bold shadow-xs'
                      : 'bg-stone-900/90 text-stone-400 hover:text-stone-200 border-stone-800 hover:border-stone-700'
                  }`}
                  title={eng.desc ? eng.name + ' - ' + eng.desc : eng.name}
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
              <span className="hidden md:inline">{L('ai_network_lbl')} ({enabledEngineCount})</span>
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
            <ShaheenModesPanel language={currentLang} models={modelStatus.models} />
          </div>
        )}
        <ShaheenServiceStatus language={currentLang} models={modelStatus.models} failed={modelStatus.failed}
          enabled={modelStatus.enabled} selected={selectedModel} />

        {/* Messages Stream Board */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-stone-50/50">
          {messages.map((m) => {
            const activeDisplayContent =
              m.id === 'welcome'
                ? shaheenWelcome(currentLang)
                : m.text;

            const isError = m.kind === 'error';
            const isLastMessage = m.id === messages[messages.length - 1]?.id;
            const canCompare = m.role === 'assistant' && !isError && m.id !== 'welcome' && AI_ENGINES.length > 1;
            const extractedFormula = m.role === 'assistant' && !isError ? extractFormulaFromAIMessage(activeDisplayContent) : null;

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
                      : isError
                        ? 'bg-amber-50 text-amber-950 border border-amber-300 rounded-tr-xs'
                        : 'bg-white text-stone-900 border border-stone-200 rounded-tr-xs'
                  }`}
                >
                  {/* AI Engine Header for Assistant */}
                  {m.role === 'assistant' && (
                    <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-stone-100 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-amber-950 font-serif-luxury text-xs">{L('shahin_name')}</span>
                        {isError ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 bg-amber-100 text-amber-900 border-amber-300">
                            <AlertCircle className="w-3 h-3" />
                            <span>{L('error_badge')}</span>
                          </span>
                        ) : m.id !== 'welcome' && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 ${ENGINE_BADGE[modeBadge(m.aiEngine?.id, currentLang).mode || ''] || 'bg-amber-50 text-amber-900 border-amber-200'}`}
                          >
                            <span>{modeBadge(m.aiEngine?.id, currentLang).label}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 font-mono-numbers">{m.timestamp}</span>
                    </div>
                  )}


                  {/* Text Payload */}
                  {m.role === 'assistant' && !isError ? (
                    <ShaheenMarkdown text={activeDisplayContent} className="text-xs sm:text-sm leading-relaxed font-sans" />
                  ) : (
                    <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line font-sans break-words space-y-2" dir="auto">
                      {activeDisplayContent}
                    </div>
                  )}

                  {isError && isLastMessage && (
                    <button
                      onClick={() => void retryLast({ model: selectedModel, language: currentLang, errorText: (error) => chatErrorText(currentLang, error) })}
                      disabled={isLoading || isStaticHosting}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-900 disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{L('retry')}</span>
                    </button>
                  )}

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

                  {/* Bottom Action Strip (not on error notices) */}
                  {!isError && <div
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
                          {canCompare && <div className="relative">
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
                                      setSelectedModel(eng.id);
                                      void handleSend(prevUserMsg?.text || L('redo_formula'), eng.id);
                                    }}
                                    className="w-full text-right px-2 py-1.5 rounded-lg hover:bg-stone-800 text-stone-200 hover:text-white transition-colors flex items-center justify-between text-[11px] cursor-pointer"
                                  >
                                    <span>{eng.name}</span>
                                    <span className="text-[9px] text-stone-400">{eng.short}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>}

                          <button
                            onClick={() => handleSpeech(stripFormulaBlock(activeDisplayContent))}
                            className="p-1 text-stone-500 hover:text-amber-800 transition-colors flex items-center gap-1 cursor-pointer"
                            title={L('speech_tooltip')}
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>}
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
              disabled={isLoading || isStaticHosting || modelStatus.isUnavailable(selectedModel)}
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
            maxLength={4000}
            disabled={isStaticHosting || modelStatus.isUnavailable(selectedModel)}
            className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-amber-700 focus:bg-white transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || isStaticHosting || modelStatus.isUnavailable(selectedModel)}
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
