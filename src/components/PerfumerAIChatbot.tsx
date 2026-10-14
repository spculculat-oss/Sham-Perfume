import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  X,
  Volume2,
  Copy,
  Check,
  RotateCcw,
  Minimize2,
  Maximize2,
  Droplet,
  Beaker,
  Scale,
  FlaskConical,
  Layers,
  BookmarkPlus,
  DollarSign,
  Printer,
  Download,
  Trash2,
  Clock,
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
import { LText, makeT, fmt, LOCALE_MAP } from '../utils/localize';


const S = {
  teaser: {
    ar: 'الخبير شاهين يقطر مركباً في معمله.. اسأله عن أي تركيبة!',
    en: 'Master Perfumer Shahin is at work.. Ask him anything!',
    fr: 'Le maître Shahin compose au laboratoire… Posez-lui vos questions !',
    es: 'El maestro Shahin compone en su laboratorio… ¡pregúntale lo que quieras!',
    it: 'Il maestro Shahin compone nel suo laboratorio… chiedigli qualsiasi cosa!',
    de: 'Meister Shahin komponiert im Labor… Frag ihn alles!',
    ru: 'Мастер Шахин работает в лаборатории… Спросите его о чём угодно!',
    zh: 'Shahin 大师正在实验室调配……问他任何配方问题！',
    tr: 'Usta Shahin laboratuvarda kompoze ediyor… ona her şeyi sorabilirsin!',
    fa: 'استاد شاهین در آزمایشگاهش ترکیب می‌سازد.. هر سوالی داری بپرس!',
  },
  trigger_title: {
    ar: 'شات بوت خبير تركيب العطور (شاهين)',
    en: 'Master Perfumer AI Chatbot',
    fr: 'Chatbot IA du maître parfumeur',
    es: 'Chatbot IA del maestro perfumista',
    it: 'Chatbot IA del maestro profumiere',
    de: 'KI-Chatbot des Meisterparfümeurs',
    ru: 'ИИ-чатбот мастера-парфюмера',
    zh: '调香大师 AI 聊天助手',
    tr: 'Usta parfümör yapay zeka sohbeti',
    fa: 'چت‌بات هوش مصنوعی عطرساز ارشد',
  },
  header_alt: {
    ar: 'الخبير شاهين صانع العطور',
    en: 'Master Perfumer Shahin',
    fr: 'Maître parfumeur Shahin',
    es: 'Maestro perfumista Shahin',
    it: 'Maestro profumiere Shahin',
    de: 'Meisterparfümeur Shahin',
    ru: 'Мастер-парфюмер Шахин',
    zh: '调香大师 Shahin',
    tr: 'Usta parfümör Shahin',
    fa: 'استاد عطرساز شاهین',
  },
  shahin_alt: {
    ar: 'شاهين',
    en: 'Shahin',
    fr: 'Shahin',
    es: 'Shahin',
    it: 'Shahin',
    de: 'Shahin',
    ru: 'Шахин',
    zh: 'Shahin',
    tr: 'Shahin',
    fa: 'شاهین',
  },
  header_title: {
    ar: 'الخبير شاهين',
    en: 'Master Shahin AI',
    fr: 'Maître Shahin IA',
    es: 'Maestro Shahin IA',
    it: 'Maestro Shahin IA',
    de: 'Meister Shahin KI',
    ru: 'Мастер Шахин ИИ',
    zh: 'Shahin 大师 AI',
    tr: 'Usta Shahin AI',
    fa: 'استاد شاهین هوشمند',
  },
  expiry_tooltip: {
    ar: 'يتم حفظ المحادثة كاملة وتُمسح تلقائياً بعد 30 يوماً من بدئها',
    en: 'Full chat stored locally, auto-deleted after 30 days',
    fr: 'Conversation complète stockée localement, effacée après 30 jours',
    es: 'Chat completo guardado localmente, se borra tras 30 días',
    it: 'Chat completa salvata localmente, cancellata dopo 30 giorni',
    de: 'Gesamter Chat lokal gespeichert, nach 30 Tagen gelöscht',
    ru: 'Полная история хранится локально и удаляется через 30 дней',
    zh: '完整对话本地保存，30 天后自动删除',
    tr: 'Tüm sohbet yerel olarak saklanır, 30 gün sonra silinir',
    fa: 'کل گفتگو به‌صورت محلی ذخیره و پس از ۳۰ روز پاک می‌شود',
  },
  days_left_tpl: {
    ar: 'تُمسح بعد {d} يوماً',
    en: '{d}d left',
    fr: 'Effacé dans {d} j',
    es: 'Se borra en {d} d',
    it: 'Cancellato tra {d} g',
    de: '{d} T. übrig',
    ru: 'Осталось {d} дн.',
    zh: '剩 {d} 天',
    tr: '{d} gün kaldı',
    fa: '{d} روز باقی مانده',
  },
  scale_tpl: {
    ar: 'الميزان الرقمي: {w}g',
    en: 'Digital Scale: {w}g',
    fr: 'Balance numérique : {w} g',
    es: 'Balanza digital: {w}g',
    it: 'Bilancia digitale: {w}g',
    de: 'Digitale Waage: {w}g',
    ru: 'Цифровые весы: {w} г',
    zh: '电子秤：{w}g',
    tr: 'Dijital terazi: {w}g',
    fa: 'ترازوی دیجیتال: {w} گرم',
  },
  export_tooltip: {
    ar: 'تنزيل نسخة نصية TXT',
    en: 'Export TXT transcript',
    fr: 'Exporter la transcription TXT',
    es: 'Exportar transcripción TXT',
    it: 'Esporta trascrizione TXT',
    de: 'TXT-Transkript exportieren',
    ru: 'Экспорт переписки в TXT',
    zh: '导出 TXT 对话记录',
    tr: 'TXT dökümü indir',
    fa: 'دریافت نسخه متنی TXT',
  },
  copy_all_tooltip: {
    ar: 'نسخ كامل المحادثة',
    en: 'Copy entire chat',
    fr: 'Copier toute la conversation',
    es: 'Copiar todo el chat',
    it: 'Copia tutta la chat',
    de: 'Ganzen Chat kopieren',
    ru: 'Скопировать всю переписку',
    zh: '复制全部对话',
    tr: 'Tüm sohbeti kopyala',
    fa: 'کپی کل گفتگو',
  },
  copy_all: {
    ar: 'نسخ الكل',
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
  copied: {
    ar: 'تم النسخ',
    en: 'Copied',
    fr: 'Copié',
    es: 'Copiado',
    it: 'Copiato',
    de: 'Kopiert',
    ru: 'Скопировано',
    zh: '已复制',
    tr: 'Kopyalandı',
    fa: 'کپی شد',
  },
  clear_tooltip: {
    ar: 'مسح سجل المحادثة الآن',
    en: 'Clear chat history now',
    fr: 'Effacer l’historique maintenant',
    es: 'Borrar el historial ahora',
    it: 'Cancella la cronologia ora',
    de: 'Chatverlauf jetzt löschen',
    ru: 'Очистить историю чата',
    zh: '立即清除聊天记录',
    tr: 'Sohbet geçmişini şimdi temizle',
    fa: 'پاک کردن تاریخچه گفتگو',
  },
  minimize: {
    ar: 'تصغير الحجم',
    en: 'Minimize',
    fr: 'Réduire',
    es: 'Minimizar',
    it: 'Riduci',
    de: 'Minimieren',
    ru: 'Свернуть',
    zh: '缩小窗口',
    tr: 'Küçült',
    fa: 'کوچک‌کردن',
  },
  fullscreen: {
    ar: 'تكبير الشاشة بالكامل',
    en: 'Expand to full screen',
    fr: 'Plein écran',
    es: 'Pantalla completa',
    it: 'Schermo intero',
    de: 'Vollbild',
    ru: 'Развернуть на весь экран',
    zh: '全屏显示',
    tr: 'Tam ekran yap',
    fa: 'نمایش تمام‌صفحه',
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
  engine_label: {
    ar: 'محرك الذكاء:',
    en: 'AI Engine:',
    fr: 'Moteur IA :',
    es: 'Motor IA:',
    it: 'Motore IA:',
    de: 'KI-Engine:',
    ru: 'ИИ-движок:',
    zh: 'AI 引擎：',
    tr: 'YZ motoru:',
    fa: 'موتور هوش مصنوعی:',
  },
  matrix_tooltip: {
    ar: 'عرض حالة شبكة الذكاء الاصطناعي الأربعة المتصلة بالمعمل',
    en: 'Show the status of the four lab-connected AI engines',
    fr: 'Voir l’état des quatre moteurs IA connectés',
    es: 'Ver el estado de los cuatro motores IA conectados',
    it: 'Stato dei quattro motori IA collegati',
    de: 'Status der vier verbundenen KI-Engines',
    ru: 'Статус четырёх подключённых ИИ-движков',
    zh: '查看四个已连接 AI 引擎的状态',
    tr: 'Bağlı dört yapay zeka motorunun durumu',
    fa: 'نمایش وضعیت چهار موتور هوش مصنوعی متصل',
  },
  matrix_btn: {
    ar: 'شبكة الذكاء (4)',
    en: 'AI Matrix (4)',
    fr: 'Matrice IA (4)',
    es: 'Matriz IA (4)',
    it: 'Matrice IA (4)',
    de: 'KI-Matrix (4)',
    ru: 'Матрица ИИ (4)',
    zh: 'AI 矩阵（4）',
    tr: 'YZ matrisi (4)',
    fa: 'شبکه هوش (۴)',
  },
  matrix_title: {
    ar: 'شبكة محركات الذكاء الاصطناعي المؤتمتة بالمعمل (Automated AI Council):',
    en: 'Automated AI Council — Lab Engine Matrix:',
    fr: 'Conseil IA automatisé — matrice des moteurs :',
    es: 'Consejo IA automatizado — matriz de motores:',
    it: 'Consiglio IA automatizzato — matrice dei motori:',
    de: 'Automatischer KI-Rat — Engine-Matrix:',
    ru: 'Автоматический ИИ-совет — матрица движков:',
    zh: '自动化 AI 议会——引擎矩阵：',
    tr: 'Otomatik YZ konseyi — motor matrisi:',
    fa: 'شورای خودکار هوش مصنوعی — ماتریس موتورها:',
  },
  matrix_gemini: {
    ar: 'حسابات الأوزان بالغرام، سرعة استخراج نسب الزيت والكحول.',
    en: 'Gram-level weight math; rapid oil & alcohol ratio extraction.',
    fr: 'Calculs au gramme ; extraction rapide des ratios huile/alcool.',
    es: 'Cálculos al gramo; extracción rápida de proporciones.',
    it: 'Calcoli al grammo; estrazione rapida dei rapporti.',
    de: 'Rechnungen auf Grammbasis; schnelle Extraktion der Verhältnisse.',
    ru: 'Расчёты с точностью до грамма; быстрое извлечение пропорций.',
    zh: '克级精确计算；快速提取油酒比例。',
    tr: 'Gram düzeyinde hesaplar; hızlı oran çıkarımı.',
    fa: 'محاسبات بر حسب گرم؛ استخراج سریع نسبت روغن و الکل.',
  },
  matrix_deepseek: {
    ar: 'استدلال كيميائي، الكثافة النوعية ومعايير سلامة IFRA.',
    en: 'Chemical reasoning, specific gravity & IFRA safety.',
    fr: 'Raisonnement chimique, densité et sécurité IFRA.',
    es: 'Razonamiento químico, densidad y seguridad IFRA.',
    it: 'Ragionamento chimico, densità e sicurezza IFRA.',
    de: 'Chemische Logik, Dichte & IFRA-Sicherheit.',
    ru: 'Химическая логика, плотность и безопасность IFRA.',
    zh: '化学推理、比重与 IFRA 安全。',
    tr: 'Kimyasal akıl yürütme, yoğunluk ve IFRA güvenliği.',
    fa: 'استدلال شیمیایی، چگالی ویژه و ایمنی IFRA.',
  },
  matrix_openai: {
    ar: 'هندسة الأكوردات، الفوحان التجاري والجاذبية التسويقية.',
    en: 'Accord architecture, commercial sillage & market appeal.',
    fr: 'Architecture des accords, sillage commercial.',
    es: 'Arquitectura de acordes, estela comercial.',
    it: 'Architettura degli accordi, scia commerciale.',
    de: 'Akkord-Architektur, kommerzielle Sillage.',
    ru: 'Архитектура аккордов, коммерческий шлейф.',
    zh: '香调架构、商业扩散与市场吸引力。',
    tr: 'Akor mimarisi, ticari iz ve pazar çekiciliği.',
    fa: 'معماری آکورد، انتشار تجاری و جذابیت بازاریابی.',
  },
  matrix_claude: {
    ar: 'تقاليد جراس الفرنسية، التعتيق الصبور، والنيش الأرستقراطي.',
    en: 'Grasse tradition, patient maceration & niche elegance.',
    fr: 'Tradition de Grasse, macération patiente et élégance de niche.',
    es: 'Tradición de Grasse, maceración paciente y elegancia de nicho.',
    it: 'Tradizione di Grasse, macerazione paziente ed eleganza di nicchia.',
    de: 'Grasse-Tradition, geduldige Mazeration & Nische-Eleganz.',
    ru: 'Традиции Граса, терпеливая мацерация и нишевая элегантность.',
    zh: '格拉斯传统、静待陈化与小众优雅。',
    tr: 'Grasse geleneği, sabırlı dinlendirme ve niş zarafeti.',
    fa: 'سنت گراس، کهنه‌سازی صبور و ظرافت نیچ.',
  },
  clear_confirm_tpl: {
    ar: 'مسح المحادثة بالكامل الآن؟ (تُمسح تلقائياً بعد {d} يوماً).',
    en: 'Clear the entire chat? (auto-deletes after {d} days).',
    fr: 'Effacer toute la conversation ? (suppression auto après {d} jours).',
    es: '¿Borrar todo el chat? (se elimina tras {d} días).',
    it: 'Cancellare tutta la chat? (eliminazione automatica dopo {d} giorni).',
    de: 'Ganzen Chat löschen? (automatisch nach {d} Tagen).',
    ru: 'Очистить весь чат? (автоудаление через {d} дн.).',
    zh: '清除全部对话？（{d} 天后自动删除）',
    tr: 'Tüm sohbet silinsin mi? ({d} gün sonra otomatik silinir).',
    fa: 'کل گفتگو پاک شود؟ (پس از {d} روز خودکار پاک می‌شود).',
  },
  cancel: {
    ar: 'إلغاء',
    en: 'Cancel',
    fr: 'Annuler',
    es: 'Cancelar',
    it: 'Annulla',
    de: 'Abbrechen',
    ru: 'Отмена',
    zh: '取消',
    tr: 'İptal',
    fa: 'لغو',
  },
  clear: {
    ar: 'مسح',
    en: 'Clear',
    fr: 'Effacer',
    es: 'Borrar',
    it: 'Cancella',
    de: 'Löschen',
    ru: 'Очистить',
    zh: '清除',
    tr: 'Sil',
    fa: 'پاک کردن',
  },
  you: {
    ar: 'أنت',
    en: 'You',
    fr: 'Vous',
    es: 'Tú',
    it: 'Tu',
    de: 'Du',
    ru: 'Вы',
    zh: '你',
    tr: 'Sen',
    fa: 'شما',
  },
  welcome_name: {
    ar: 'الخبير شاهين',
    en: 'Master Shahin',
    fr: 'Maître Shahin',
    es: 'Maestro Shahin',
    it: 'Maestro Shahin',
    de: 'Meister Shahin',
    ru: 'Мастер Шахин',
    zh: 'Shahin 大师',
    tr: 'Usta Shahin',
    fa: 'استاد شاهین',
  },
  default_badge: {
    ar: '⚡ مجلس الخبراء المؤتمت',
    en: '⚡ Automated Experts Council',
    fr: '⚡ Conseil d’experts automatisé',
    es: '⚡ Consejo automatizado',
    it: '⚡ Consiglio automatizzato',
    de: '⚡ Automatischer Expertenrat',
    ru: '⚡ Автоматический совет экспертов',
    zh: '⚡ 自动化专家议会',
    tr: '⚡ Otomatik uzmanlar kurulu',
    fa: '⚡ شورای خبرگان خودکار',
  },
  persp_lbl: {
    ar: 'تبديل منظور المحركات المستشارة:',
    en: 'Switch advisor engine view:',
    fr: 'Changer de moteur conseiller :',
    es: 'Cambiar vista del motor asesor:',
    it: 'Cambia vista del motore consulente:',
    de: 'Berater-Engine wechseln:',
    ru: 'Переключить движок-советник:',
    zh: '切换顾问引擎视角：',
    tr: 'Danışman motor görünümünü değiştir:',
    fa: 'تغییر نمای موتور مشاور:',
  },
  persp_ens: {
    ar: 'دمج مؤتمت 4 محركات',
    en: 'Automated 4-engine blend',
    fr: 'Fusion automatique de 4 moteurs',
    es: 'Fusión automática de 4 motores',
    it: 'Fusione automatica di 4 motori',
    de: 'Automatische 4-Engine-Fusion',
    ru: 'Автослияние 4 движков',
    zh: '四引擎自动融合',
    tr: '4 motorlu otomatik harman',
    fa: 'ترکیب خودکار ۴ موتور',
  },
  consensus_lbl: {
    ar: '⚡ خلاصة شاهين الموحدة',
    en: '⚡ Shahin Unified Summary',
    fr: '⚡ Synthèse unifiée de Shahin',
    es: '⚡ Síntesis unificada de Shahin',
    it: '⚡ Sintesi unificata di Shahin',
    de: '⚡ Shahins vereintes Fazit',
    ru: '⚡ Единое резюме Шахина',
    zh: '⚡ Shahin 统一结论',
    tr: '⚡ Shahin birleşik özet',
    fa: '⚡ جمع‌بندی واحد شاهین',
  },
  transfer_lbl: {
    ar: 'تحويل هذه الخلطة لأيقونات وحاسبات التطبيق:',
    en: 'Transfer this formula to the app tools:',
    fr: 'Envoyer cette formule vers les outils :',
    es: 'Transferir esta fórmula a las herramientas:',
    it: 'Trasferisci questa formula agli strumenti:',
    de: 'Diese Formel an die App-Tools senden:',
    ru: 'Перенести эту формулу в инструменты приложения:',
    zh: '将此配方发送到应用工具：',
    tr: 'Bu formülü uygulama araçlarına aktar:',
    fa: 'انتقال این فرمول به ابزارهای برنامه:',
  },
  apply_conc: {
    ar: 'حاسبة التركيب',
    en: 'Concentration Calc',
    fr: 'Calculateur',
    es: 'Calculadora',
    it: 'Calcolatore',
    de: 'Rechner',
    ru: 'Калькулятор',
    zh: '浓度计算器',
    tr: 'Konsantrasyon hesaplayıcı',
    fa: 'ماشین‌حساب ترکیب',
  },
  apply_conc_tip: {
    ar: 'تطبيق مقادير هذه الخلطة في حاسبة التركيب وتعبئة الزجاجة',
    en: 'Apply this formula in the compounding calculator & fill the bottle',
    fr: 'Appliquer cette formule dans le calculateur et remplir le flacon',
    es: 'Aplicar esta fórmula en la calculadora y llenar el frasco',
    it: 'Applica questa formula nella calcolatrice e riempi il flacone',
    de: 'Formel im Rechner anwenden und Flakon füllen',
    ru: 'Применить формулу в калькуляторе и наполнить флакон',
    zh: '在调配计算器中应用此配方并灌装',
    tr: 'Bu formülü hesaplayıcıda uygula ve şişeyi doldur',
    fa: 'اعمال این فرمول در ماشین‌حساب و پر کردن بطری',
  },
  apply_pyramid: {
    ar: 'الهرم العطري',
    en: 'Pyramid Calculator',
    fr: 'Pyramide',
    es: 'Pirámide',
    it: 'Piramide',
    de: 'Duftpyramide',
    ru: 'Пирамида',
    zh: '香调金字塔',
    tr: 'Koku piramidi',
    fa: 'هرم عطری',
  },
  apply_pyramid_tip: {
    ar: 'نقل النوتات العطرية إلى حاسبة الهرم العطري',
    en: 'Send the fragrance notes to the pyramid calculator',
    fr: 'Envoyer les notes vers la pyramide',
    es: 'Enviar las notas a la pirámide',
    it: 'Invia le note alla piramide',
    de: 'Noten an die Duftpyramide senden',
    ru: 'Отправить ноты в калькулятор пирамиды',
    zh: '将香调发送至金字塔计算器',
    tr: 'Notaları piramit hesaplayıcıya gönder',
    fa: 'ارسال نت‌های عطری به ماشین‌حساب هرم',
  },
  record_btn: {
    ar: 'تدوين الخلطة',
    en: 'Save Recipe',
    fr: 'Enregistrer',
    es: 'Guardar receta',
    it: 'Salva ricetta',
    de: 'Rezept speichern',
    ru: 'В рецепт',
    zh: '保存配方',
    tr: 'Tarifi kaydet',
    fa: 'ثبت دستور',
  },
  recorded_lbl: {
    ar: 'تم التدوين!',
    en: 'Saved!',
    fr: 'Enregistré !',
    es: '¡Guardado!',
    it: 'Salvata!',
    de: 'Gespeichert!',
    ru: 'Сохранено!',
    zh: '已保存！',
    tr: 'Kaydedildi!',
    fa: 'ثبت شد!',
  },
  record_tip: {
    ar: 'تدوين وحفظ هذه الخلطة فوراً في مكتبة الوصفات والتشغيلات',
    en: 'Instantly save this formula to the recipe library',
    fr: 'Enregistrer immédiatement cette formule dans la bibliothèque',
    es: 'Guardar al instante esta fórmula en la biblioteca',
    it: 'Salva subito questa formula nella libreria',
    de: 'Diese Formel sofort in der Rezeptbibliothek speichern',
    ru: 'Мгновенно сохранить формулу в библиотеку рецептов',
    zh: '立即将此配方保存到配方库',
    tr: 'Bu formülü tarif kitaplığına anında kaydet',
    fa: 'ذخیره فوری این فرمول در کتابخانه دستورها',
  },
  cost_btn: {
    ar: 'حساب التكلفة',
    en: 'Costing',
    fr: 'Coûts',
    es: 'Costos',
    it: 'Costi',
    de: 'Kosten',
    ru: 'Себестоимость',
    zh: '成本核算',
    tr: 'Maliyet',
    fa: 'محاسبه هزینه',
  },
  cost_tip: {
    ar: 'حساب تكلفة إنتاج وسعر بيع هذه التركيبة',
    en: 'Calculate production cost & sale price of this formula',
    fr: 'Calculer le coût de production et le prix de vente',
    es: 'Calcular coste de producción y precio de venta',
    it: 'Calcola costo di produzione e prezzo di vendita',
    de: 'Produktionskosten & Verkaufspreis berechnen',
    ru: 'Рассчитать себестоимость и цену продажи',
    zh: '计算此配方的生产成本与售价',
    tr: 'Bu formülün üretim maliyetini ve satış fiyatını hesapla',
    fa: 'محاسبه هزینه تولید و قیمت فروش این فرمول',
  },
  print_lbl: {
    ar: 'طباعة ورقة المعمل:',
    en: 'Print lab sheet:',
    fr: 'Fiche laboratoire :',
    es: 'Hoja de laboratorio:',
    it: 'Scheda di laboratorio:',
    de: 'Labordatenblatt:',
    ru: 'Печать техкарты:',
    zh: '打印实验室单据：',
    tr: 'Laboratuvar sayfası:',
    fa: 'چاپ برگ آزمایشگاه:',
  },
  print_btn: {
    ar: 'طباعة بطاقة التشغيلة الرسمية ➔',
    en: 'Print Official Batch Sheet ➔',
    fr: 'Imprimer la fiche officielle ➔',
    es: 'Imprimir ficha oficial ➔',
    it: 'Stampa scheda ufficiale ➔',
    de: 'Offizielles Datenblatt drucken ➔',
    ru: 'Печать официальной техкарты ➔',
    zh: '打印正式批次单 ➔',
    tr: 'Resmi parti kartını yazdır ➔',
    fa: 'چاپ کارت رسمی پارت ➔',
  },
  copy_q_title: {
    ar: 'نسخ هذا السؤال',
    en: 'Copy this question',
    fr: 'Copier cette question',
    es: 'Copiar esta pregunta',
    it: 'Copia questa domanda',
    de: 'Diese Frage kopieren',
    ru: 'Скопировать вопрос',
    zh: '复制此提问',
    tr: 'Bu soruyu kopyala',
    fa: 'کپی این پرسش',
  },
  copy_a_title: {
    ar: 'نسخ هذه الإجابة والتركيبة',
    en: 'Copy this answer & formula',
    fr: 'Copier cette réponse et la formule',
    es: 'Copiar esta respuesta y fórmula',
    it: 'Copia questa risposta e formula',
    de: 'Diese Antwort & Formel kopieren',
    ru: 'Скопировать ответ и формулу',
    zh: '复制此回答与配方',
    tr: 'Bu cevabı ve formülü kopyala',
    fa: 'کپی این پاسخ و فرمول',
  },
  copy_q: {
    ar: 'نسخ السؤال',
    en: 'Copy question',
    fr: 'Copier la question',
    es: 'Copiar pregunta',
    it: 'Copia domanda',
    de: 'Frage kopieren',
    ru: 'Копировать вопрос',
    zh: '复制提问',
    tr: 'Soruyu kopyala',
    fa: 'کپی پرسش',
  },
  copy_a: {
    ar: 'نسخ الإجابة والتركيبة',
    en: 'Copy answer & formula',
    fr: 'Copier la réponse et la formule',
    es: 'Copiar respuesta y fórmula',
    it: 'Copia risposta e formula',
    de: 'Antwort & Formel kopieren',
    ru: 'Копировать ответ и формулу',
    zh: '复制回答与配方',
    tr: 'Cevabı ve formülü kopyala',
    fa: 'کپی پاسخ و فرمول',
  },
  consult_tooltip: {
    ar: 'استشارة نموذج ذكاء اصطناعي آخر على نفس السؤال لمقارنة الرأي',
    en: 'Ask another AI model the same question to compare opinions',
    fr: 'Consulter un autre modèle IA sur la même question',
    es: 'Consultar otro modelo IA con la misma pregunta',
    it: 'Chiedi a un altro modello IA la stessa domanda',
    de: 'Ein anderes KI-Modell zur gleichen Frage befragen',
    ru: 'Спросить другую ИИ-модель и сравнить мнения',
    zh: '向另一个 AI 模型提出同一问题以比较观点',
    tr: 'Aynı soruyu başka bir yapay zeka modeline sor',
    fa: 'پرسیدن همان سؤال از مدل هوش مصنوعی دیگر برای مقایسه',
  },
  consult_btn: {
    ar: 'مقارنة بنموذج آخر',
    en: 'Compare with another model',
    fr: 'Comparer avec un autre modèle',
    es: 'Comparar con otro modelo',
    it: 'Confronta con un altro modello',
    de: 'Mit anderem Modell vergleichen',
    ru: 'Сравнить с другой моделью',
    zh: '与其他模型对比',
    tr: 'Başka bir modelle karşılaştır',
    fa: 'مقایسه با مدل دیگر',
  },
  choose_model: {
    ar: 'اختر نموذجاً للمقارنة:',
    en: 'Choose a model to compare:',
    fr: 'Choisir un modèle à comparer :',
    es: 'Elige un modelo para comparar:',
    it: 'Scegli un modello da confrontare:',
    de: 'Modell zum Vergleich wählen:',
    ru: 'Выберите модель для сравнения:',
    zh: '选择要对比的模型：',
    tr: 'Karşılaştırılacak modeli seç:',
    fa: 'مدل مورد مقایسه را انتخاب کنید:',
  },
  speech_tooltip: {
    ar: 'استماع صوتي',
    en: 'Listen',
    fr: 'Écouter',
    es: 'Escuchar',
    it: 'Ascolta',
    de: 'Anhören',
    ru: 'Прослушать',
    zh: '语音播放',
    tr: 'Dinle',
    fa: 'پخش صوتی',
  },
  loading_title: {
    ar: 'الخبير شاهين يقطر الزيوت ويزن المركب الآن بالميزان...',
    en: 'Master Shahin is dripping oils and weighing the compound...',
    fr: 'Le maître Shahin dose les huiles et pèse le composé…',
    es: 'El maestro Shahin dosifica aceites y pesa el compuesto…',
    it: 'Il maestro Shahin dosa gli oli e pesa il composto…',
    de: 'Meister Shahin tropft Öle und wiegt die Komposition…',
    ru: 'Мастер Шахин дозирует масла и взвешивает композицию…',
    zh: 'Shahin 大师正在滴注精油并称量香液……',
    tr: 'Usta Shahin yağları damlatıyor ve bileşimi tartıyor…',
    fa: 'استاد شاهین روغن‌ها را می‌چکاند و ترکیب را وزن می‌کند…',
  },
  comp_1: {
    ar: 'يقطر الزيوت الخام في المخبار بدقة...',
    en: 'Dripping raw oils into the graduated flask...',
    fr: 'Verse les huiles brutes dans le bécher…',
    es: 'Dosificando aceites crudos en la probeta…',
    it: 'Dosa gli oli grezzi nel cilindro…',
    de: 'Tropft Rohöle präzise in den Kolben…',
    ru: 'Точно капает сырые масла в цилиндр…',
    zh: '正在精确滴注精油……',
    tr: 'Ham yağları dereceli silindire damlatıyor…',
    fa: 'روغن‌های خام را با دقت در بالن می‌چکاند…',
  },
  comp_2: {
    ar: 'يزن قطرات النوتات ويفحص الكثافة النوعية...',
    en: 'Weighing note drops & checking specific gravity...',
    fr: 'Pèse les gouttes et vérifie la densité…',
    es: 'Pesa las gotas y comprueba la densidad…',
    it: 'Pesa le gocce e controlla la densità…',
    de: 'Wiegt Tropfen und prüft die Dichte…',
    ru: 'Взвешивает капли нот и проверяет плотность…',
    zh: '正在称量香调滴数并检测比重……',
    tr: 'Damla damla tartıyor ve yoğunluğu kontrol ediyor…',
    fa: 'قطره‌ها را وزن می‌کند و چگالی ویژه را می‌سنجد…',
  },
  comp_3: {
    ar: 'يمزج مركب العطر ويفحص التناغم بين القمة والقاعدة...',
    en: 'Blending the compound & testing top-to-base harmony...',
    fr: 'Assemble le composé et vérifie l’harmonie tête-fond…',
    es: 'Mezcla el compuesto y prueba la armonía salida-fondo…',
    it: 'Fonde il composto e testa l’armonia testa-fondo…',
    de: 'Mischt die Komposition und prüft die Kopf-Basis-Harmonie…',
    ru: 'Смешивает композицию и проверяет баланс верха и базы…',
    zh: '正在调和香液并测试前中后调和谐度……',
    tr: 'Bileşimi harmanlıyor ve üst-dip uyumunu test ediyor…',
    fa: 'ترکیب عطر را مخلوط و هماهنگی قمه و پایه را می‌سنجد…',
  },
  comp_4: {
    ar: 'يصيغ لك خلاصة سر التركيبة من المعمل...',
    en: 'Distilling the secret of your formula from the lab…',
    fr: 'Formule le secret de votre composition au labo…',
    es: 'Formula el secreto de tu composición…',
    it: 'Elabora il segreto della tua formula…',
    de: 'Destilliert das Geheimnis deiner Formel…',
    ru: 'Формулирует секрет вашей композиции…',
    zh: '正在为您提炼配方秘诀……',
    tr: 'Formülün sırrını laboratuvardan damıtıyor…',
    fa: 'راز فرمول شما را از آزمایشگاه می‌چیند…',
  },
  presets_lbl: {
    ar: 'أوامر وتفاعلات:',
    en: 'Quick commands:',
    fr: 'Commandes rapides :',
    es: 'Comandos rápidos:',
    it: 'Comandi rapidi:',
    de: 'Schnellbefehle:',
    ru: 'Быстрые команды:',
    zh: '快捷指令：',
    tr: 'Hızlı komutlar:',
    fa: 'فرمان‌های سریع:',
  },
  preset_1: {
    ar: 'تمام تقترح عليا انهى تركيبة بالظبط ونسب المكونات قد اية',
    en: 'Suggest the perfect formula for me with exact ingredient ratios',
    fr: 'Propose-moi la formule parfaite et les proportions exactes',
    es: 'Sugiéreme la fórmula perfecta y las proporciones exactas',
    it: 'Suggeriscimi la formula perfetta e le proporzioni esatte',
    de: 'Schlag mir die perfekte Formel und die genauen Mengen vor',
    ru: 'Предложи идеальную формулу и точные пропорции',
    zh: '给我推荐完美配方和精确的原料比例',
    tr: 'Bana mükemmel formülü ve malzeme oranlarını öner',
    fa: 'یک فرمول بی‌نقص با نسبت دقیق مواد به من پیشنهاد بده',
  },
  preset_2: {
    ar: 'طبق هذه التركيبة في حاسبة التركيب والمعمل',
    en: 'Apply this formula in the compounding calculator & lab',
    fr: 'Appliquer cette formule dans la calculatrice et le labo',
    es: 'Aplicar esta fórmula en la calculadora y el laboratorio',
    it: 'Applica questa formula nella calcolatrice e nel laboratorio',
    de: 'Diese Formel im Rechner und Labor anwenden',
    ru: 'Применить эту формулу в калькуляторе и лаборатории',
    zh: '在计算器与实验室中应用此配方',
    tr: 'Bu formülü hesaplayıcı ve laboratuvarda uygula',
    fa: 'این فرمول را در ماشین‌حساب و آزمایشگاه اعمال کن',
  },
  preset_3: {
    ar: 'كيف أضاعف ثبات وفوحان العطر لأكثر من 24 ساعة؟',
    en: 'How do I double longevity & sillage beyond 24 hours?',
    fr: 'Comment doubler tenue et sillage au-delà de 24 h ?',
    es: '¿Cómo duplico duración y estela más de 24 horas?',
    it: 'Come raddoppiare persistenza e scia oltre 24 ore?',
    de: 'Wie verdopple ich Haltbarkeit & Sillage über 24 Stunden?',
    ru: 'Как удвоить стойкость и шлейф более 24 часов?',
    zh: '如何让留香和扩散超过 24 小时？',
    tr: 'Kalıcılığı ve izi 24 saatin üzerinde nasıl ikiye katlarım?',
    fa: 'چگونه ماندگاری و انتشار عطر را به بیش از ۲۴ ساعت برسانم؟',
  },
  preset_4: {
    ar: 'العطر أصبح حليبياً ومتعكراً بعد إضافة الماء، كيف أصفّيه؟',
    en: 'My perfume turned milky after adding water — how do I clarify it?',
    fr: 'Mon parfum est devenu laiteux après l’eau — comment le clarifier ?',
    es: 'Mi perfume se volvió lechoso tras añadir agua, ¿cómo aclararlo?',
    it: 'Il profumo è diventato lattiginoso dopo l’acqua, come chiarificarlo?',
    de: 'Mein Parfüm wurde nach Wasserzugabe milchig — wie klären?',
    ru: 'Духи помутнели после добавления воды — как осветлить?',
    zh: '加水后香水变浑浊了，如何澄清？',
    tr: 'Su ekledikten sonra parfümüm sütleşti, nasıl berraklaştırırım?',
    fa: 'بعد از افزودن آب عطر شیری و کدر شد، چگونه شفافش کنم؟',
  },
  preset_5: {
    ar: 'ما النسبة الذهبية لعطر صيفي منعش وفواح؟',
    en: 'What’s the golden ratio for a fresh, radiant summer scent?',
    fr: 'Quel est le ratio d’or pour un parfum d’été frais et rayonnant ?',
    es: '¿Cuál es la proporción dorada para un perfume de verano fresco?',
    it: 'Qual è il rapporto perfetto per un profumo estivo fresco?',
    de: 'Was ist die Goldformel für einen frischen Sommersduft?',
    ru: 'Какая золотая пропорция для свежего летнего аромата?',
    zh: '清新夏日香水的黄金比例是什么？',
    tr: 'Ferah bir yaz parfümü için altın oran nedir?',
    fa: 'نسبت طلایی برای یک عطر تابستانی خنک و پرپخش چیست؟',
  },
  input_placeholder: {
    ar: 'اسأل الخبير شاهين أو اطلب تطبيق الخلطة (مثال: طبق هذه التركيبة في حاسبة المعمل)...',
    en: 'Ask Master Shahin or request to apply a formula (e.g., apply this formula in the lab calculator)...',
    fr: 'Demandez au maître Shahin (ex. : appliquer cette formule dans la calculatrice)…',
    es: 'Pregunta al maestro Shahin (ej.: aplicar esta fórmula en la calculadora)…',
    it: 'Chiedi al maestro Shahin (es.: applica questa formula nella calcolatrice)…',
    de: 'Frag Meister Shahin (z. B.: diese Formel im Rechner anwenden)…',
    ru: 'Спросите мастера Шахина (напр.: применить эту формулу в калькуляторе)…',
    zh: '向 Shahin 大师提问（例如：在实验室计算器中应用此配方）……',
    tr: 'Usta Shahin’e sor (ör.: bu formülü hesaplayıcıda uygula)…',
    fa: 'از استاد شاهین بپرسید (مثال: این فرمول را در ماشین‌حساب اعمال کن)…',
  },
  send: {
    ar: 'إرسال',
    en: 'Send',
    fr: 'Envoyer',
    es: 'Enviar',
    it: 'Invia',
    de: 'Senden',
    ru: 'Отправить',
    zh: '发送',
    tr: 'Gönder',
    fa: 'ارسال',
  },
  error_reply: {
    ar: 'معذرة، أعد المحاولة بعد قليل.',
    en: 'Sorry, please try again in a moment.',
    fr: 'Désolé, réessayez dans un instant.',
    es: 'Disculpe, inténtelo de nuevo en un momento.',
    it: 'Spiacente, riprova tra poco.',
    de: 'Sorry, bitte gleich noch einmal versuchen.',
    ru: 'Извините, попробуйте ещё раз чуть позже.',
    zh: '抱歉，请稍后重试。',
    tr: 'Üzgünüm, birazdan tekrar deneyin.',
    fa: 'متأسفم، کمی بعد دوباره تلاش کنید.',
  },
  fallback_reply: {
    ar: 'أهلاً بك يا صديقي في مختبري العطري. لمضاعفة الثبات والفوحان، احرص على استخدام مثبت DPG بنسبة 1%، مع تعتيق العطر 30 يوماً في زجاج عسلي محكم الإغلاق.',
    en: 'Welcome to my aromatic lab, friend. To double longevity and sillage, use 1% DPG fixative and macerate for 30 days in a sealed amber bottle.',
    fr: 'Bienvenue dans mon laboratoire. Pour doubler tenue et sillage : 1 % de DPG et 30 jours de macération en flacon ambré hermétique.',
    es: 'Bienvenido a mi laboratorio. Para duplicar duración y estela: 1 % de DPG y 30 días de maceración en vidrio ámbar hermético.',
    it: 'Benvenuto nel mio laboratorio. Per raddoppiare persistenza e scia: 1% di DPG e 30 giorni di macerazione in vetro ambrato ermetico.',
    de: 'Willkommen in meinem Labor. Für doppelte Haltbarkeit: 1 % DPG und 30 Tage Reifung im verschlossenen Braunglas.',
    ru: 'Добро пожаловать в мою лабораторию. Для удвоения стойкости и шлейфа: 1% DPG и 30 дней мацерации в герметичном тёмном стекле.',
    zh: '欢迎来到我的香氛实验室。要倍增留香与扩散：使用 1% DPG 定香剂，并在密封琥珀瓶中陈化 30 天。',
    tr: 'Laboratuvarıma hoş geldin. Kalıcılığı ve izi ikiye katlamak için %1 DPG fiksatör kullan ve parfümü 30 gün amber şişede dinlendir.',
    fa: 'به آزمایشگاه عطر من خوش آمدی. برای دوبرابر کردن ماندگاری و انتشار، ۱٪ تثبیت‌کننده DPG به کار ببر و عطر را ۳۰ روز در شیشه کهربایی دربسته کهنه کن.',
  },
  fallback_badge: {
    ar: '👑 معمل الخبير شاهين الاحتياطي',
    en: '👑 Master Shahin Offline Lab',
    fr: '👑 Labo hors-ligne de Shahin',
    es: '👑 Laboratorio offline de Shahin',
    it: '👑 Laboratorio offline di Shahin',
    de: '👑 Shahins Offline-Labor',
    ru: '👑 Офлайн-лаборатория Шахина',
    zh: '👑 Shahin 离线实验室',
    tr: '👑 Shahin çevrimdışı laboratuvarı',
    fa: '👑 آزمایشگاه آفلاین استاد شاهین',
  },
  consult_prefix_tpl: {
    ar: '[استشارة متخصصة من محرك {m}]:',
    en: '[Specialist consult via {m}]:',
    fr: '[Consultation spécialisée via {m}] :',
    es: '[Consulta especializada vía {m}]:',
    it: '[Consulenza specializzata via {m}]:',
    de: '[Fachkonsultation über {m}]:',
    ru: '[Консультация специалиста через {m}]:',
    zh: '【{m} 专家会诊】：',
    tr: '[{m} üzerinden uzman görüşü]:',
    fa: '[مشاوره تخصصی از موتور {m}]:',
  },
  reformat_fallback: {
    ar: 'أعد صياغة التركيبة السابقة وحساب نسبها برؤيتك المتخصصة',
    en: 'Reformulate the previous formula and recalculate its ratios from your expert perspective',
    fr: 'Reformule la formule précédente et recalcule les proportions selon ton expertise',
    es: 'Reformula la composición anterior y recalcula sus proporciones con tu visión experta',
    it: 'Riformula la formula precedente e ricalcola le proporzioni con la tua competenza',
    de: 'Formuliere die vorherige Formel neu und berechne die Anteile aus deiner Expertensicht',
    ru: 'Переформулируй предыдущую формулу и пересчитай пропорции с твоей экспертной точки зрения',
    zh: '请以你的专业视角重新表述上一个配方并计算比例',
    tr: 'Önceki formülü uzman bakışınla yeniden formüle et ve oranlarını hesapla',
    fa: 'فرمول قبلی را با دید تخصصی‌ات بازنویسی و نسبت‌هایش را محاسبه کن',
  },
  transcript_q: {
    ar: 'السؤال',
    en: 'Question',
    fr: 'Question',
    es: 'Pregunta',
    it: 'Domanda',
    de: 'Frage',
    ru: 'Вопрос',
    zh: '提问',
    tr: 'Soru',
    fa: 'پرسش',
  },
  transcript_a: {
    ar: 'الخبير شاهين',
    en: 'Master Shahin',
    fr: 'Maître Shahin',
    es: 'Maestro Shahin',
    it: 'Maestro Shahin',
    de: 'Meister Shahin',
    ru: 'Мастер Шахин',
    zh: 'Shahin 大师',
    tr: 'Usta Shahin',
    fa: 'استاد شاهین',
  },
  engine_auto_name: {
    ar: 'أتمتة الدمج الذكي (Auto Ensemble)',
    en: 'Smart Auto Ensemble',
    fr: 'Ensemble automatique intelligent',
    es: 'Ensamble automático inteligente',
    it: 'Ensemble automatico intelligente',
    de: 'Intelligentes Auto-Ensemble',
    ru: 'Умный автосенсамбль',
    zh: '智能自动合议',
    tr: 'Akıllı otomatik ansambl',
    fa: 'ترکیب هوشمند خودکار',
  },
  engine_auto_short: {
    ar: '⚡ مجلس الخبراء',
    en: '⚡ Experts Council',
    fr: '⚡ Conseil d’experts',
    es: '⚡ Consejo de expertos',
    it: '⚡ Consiglio di esperti',
    de: '⚡ Expertenrat',
    ru: '⚡ Совет экспертов',
    zh: '⚡ 专家议会',
    tr: '⚡ Uzmanlar kurulu',
    fa: '⚡ شورای خبرگان',
  },
  engine_auto_desc: {
    ar: 'يدمج ذكاء الأربعة نماذج تلقائياً ويصيغ الخلاصة الموحدة',
    en: 'Automatically blends all four models into one unified verdict',
    fr: 'Fusionne automatiquement les quatre modèles en un verdict unifié',
    es: 'Fusiona los cuatro modelos en un veredicto unificado',
    it: 'Unisce automaticamente i quattro modelli in un verdetto unificato',
    de: 'Vereint alle vier Modelle automatisch zu einem Urteil',
    ru: 'Автоматически объединяет четыре модели в единый вердикт',
    zh: '自动融合四个模型并生成统一结论',
    tr: 'Dört modeli otomatik birleştirip tek sonuç çıkarır',
    fa: 'چهار مدل را خودکار ترکیب و نتیجه واحد می‌سازد',
  },
  engine_gemini_short: {
    ar: '✨ جيمناي',
    en: '✨ Gemini',
    fr: '✨ Gemini',
    es: '✨ Gemini',
    it: '✨ Gemini',
    de: '✨ Gemini',
    ru: '✨ Gemini',
    zh: '✨ Gemini',
    tr: '✨ Gemini',
    fa: '✨ جمنای',
  },
  engine_gemini_desc: {
    ar: 'الحسابات الرياضية الدقيقة، أوزان الغرامات، والسرعة الفائقة',
    en: 'Precise math, gram weights & blazing speed',
    fr: 'Calculs précis, poids en grammes et rapidité',
    es: 'Cálculos precisos, pesos en gramos y velocidad',
    it: 'Calcoli precisi, pesi in grammi e velocità',
    de: 'Präzise Mathe, Grammgewichte & Tempo',
    ru: 'Точная математика, граммы и скорость',
    zh: '精确计算、克重与极速',
    tr: 'Hassas hesaplar, gram ağırlıkları ve hız',
    fa: 'محاسبات دقیق، وزن گریمی و سرعت بالا',
  },
  engine_deepseek_short: {
    ar: '🔬 ديب سيك',
    en: '🔬 DeepSeek',
    fr: '🔬 DeepSeek',
    es: '🔬 DeepSeek',
    it: '🔬 DeepSeek',
    de: '🔬 DeepSeek',
    ru: '🔬 DeepSeek',
    zh: '🔬 DeepSeek',
    tr: '🔬 DeepSeek',
    fa: '🔬 دیپ‌سیک',
  },
  engine_deepseek_desc: {
    ar: 'استدلال كيميائي، الكثافة النوعية ومعايير أمان IFRA',
    en: 'Chemical reasoning, specific gravity & IFRA safety',
    fr: 'Raisonnement chimique, densité et sécurité IFRA',
    es: 'Razonamiento químico, densidad y seguridad IFRA',
    it: 'Ragionamento chimico, densità e sicurezza IFRA',
    de: 'Chemisches Denken, Dichte & IFRA-Sicherheit',
    ru: 'Химическая логика, плотность и стандарты IFRA',
    zh: '化学推理、比重与 IFRA 安全',
    tr: 'Kimyasal akıl yürütme, yoğunluk ve IFRA güvenliği',
    fa: 'استدلال شیمیایی، چگالی و ایمنی IFRA',
  },
  engine_openai_short: {
    ar: '🟢 شات جي بي تي',
    en: '🟢 ChatGPT',
    fr: '🟢 ChatGPT',
    es: '🟢 ChatGPT',
    it: '🟢 ChatGPT',
    de: '🟢 ChatGPT',
    ru: '🟢 ChatGPT',
    zh: '🟢 ChatGPT',
    tr: '🟢 ChatGPT',
    fa: '🟢 چت‌جی‌پی‌تی',
  },
  engine_openai_desc: {
    ar: 'هندسة الأكوردات، الفوحان التجاري والانتشار الجذاب',
    en: 'Accord architecture, commercial sillage & allure',
    fr: 'Architecture des accords, sillage commercial et attrait',
    es: 'Arquitectura de acordes, estela comercial y atractivo',
    it: 'Architettura degli accordi, scia commerciale e appeal',
    de: 'Akkord-Architektur, kommerzielle Sillage & Anziehung',
    ru: 'Архитектура аккордов, коммерческий шлейф и притягательность',
    zh: '香调架构、商业扩散与吸引力',
    tr: 'Akor mimarisi, ticari iz ve çekicilik',
    fa: 'معماری آکورد، انتشار تجاری و جذابیت',
  },
  engine_claude_short: {
    ar: '🟣 كلود',
    en: '🟣 Claude',
    fr: '🟣 Claude',
    es: '🟣 Claude',
    it: '🟣 Claude',
    de: '🟣 Claude',
    ru: '🟣 Claude',
    zh: '🟣 Claude',
    tr: '🟣 Claude',
    fa: '🟣 کلود',
  },
  engine_claude_desc: {
    ar: 'مدرسة جراس الفرنسية، التعتيق الصامت، وأناقة النيش',
    en: 'Grasse school, silent maceration & niche elegance',
    fr: 'École de Grasse, macération silencieuse et élégance de niche',
    es: 'Escuela de Grasse, maceración silenciosa y elegancia de nicho',
    it: 'Scuola di Grasse, macerazione silenziosa ed eleganza di nicchia',
    de: 'Grasse-Schule, stille Mazeration & Nische-Eleganz',
    ru: 'Школа Граса, тихая мацерация и нишевая элегантность',
    zh: '格拉斯学派、静默陈化与小众优雅',
    tr: 'Grasse okulu, sessiz dinlendirme ve niş zarafeti',
    fa: 'مدرسه گراس، کهنه‌سازی آرام و ظرافت نیچ',
  },
  engine_auto_badge: {
    ar: '⚡ مجلس الخبراء المؤتمت',
    en: '⚡ Automated Experts Council',
    fr: '⚡ Conseil d’experts automatisé',
    es: '⚡ Consejo automatizado',
    it: '⚡ Consiglio automatizzato',
    de: '⚡ Automatischer Expertenrat',
    ru: '⚡ Автоматический совет экспертов',
    zh: '⚡ 自动化专家议会',
    tr: '⚡ Otomatik uzmanlar kurulu',
    fa: '⚡ شورای خبرگان خودکار',
  },
  welcome_msg: {
    ar: `مرحباً بك في معملي يا عاشق الشذى والطيوب! أنا الخبير شاهين، شيخ العطارين وكبير كيميائيي العطور.
أنا هنا بجانب ميزاني ومخابيري أقطر الزيوت الخام وأمزج التراكيب.
اسألني عن أي تركيبة عطرية، نسب المكونات بالجرام، حل مشكلات التعكر، أو أسرار التعتيق وسأجيبك بدقة المعمل.
كما يمكنك تحويل بيانات أي تركيبة مباشرة إلى «حاسبة التركيب» أو «تدوينها في الوصفات» بنقرة زر واحدة!

📌 ملاحظة: محادثتك محفوظة بالكامل محلياً في جهازك، وستُمسح تلقائياً بعد شهر (30 يوماً) من بدئها حفاظاً على الخصوصية.`,
    en: `Welcome to my laboratory, fragrance lover! I am Master Shahin, chief perfumer and aroma chemist.
I stand by my scale and beakers, dripping raw oils and blending accords.
Ask me about any formula, ingredient ratios in grams, cloudiness fixes, or maceration secrets — I answer with laboratory precision.
You can also send any formula straight to the “Compounding Calculator” or “Save it to Recipes” in one click!

📌 Note: your chat is stored locally on your device and auto-deletes after one month (30 days) for privacy.`,
    fr: `Bienvenue dans mon laboratoire ! Je suis Maître Shahin, parfumeur en chef et chimiste des arômes.
À ma balance et mes fioles, je dose les huiles brutes et compose les accords.
Demandez-moi une formule, des proportions en grammes, la clarification ou les secrets de macération.
Envoyez aussi toute formule vers la « calculatrice de formulation » ou sauvegardez-la en un clic !

📌 Note : la conversation est stockée localement et s’efface après un mois (30 jours).`,
    es: `¡Bienvenido a mi laboratorio! Soy el Maestro Shahin, perfumista jefe y químico aromático.
Junto a mi balanza y mis mataces, dosifico aceites y creo acordes.
Pregúntame por cualquier fórmula, proporciones en gramos, aclarados o secretos de maceración.
¡También puedes enviar cualquier fórmula a la «calculadora» o guardarla con un clic!

📌 Nota: el chat se guarda localmente y se borra automáticamente tras un mes (30 días).`,
    it: `Benvenuto nel mio laboratorio! Sono il Maestro Shahin, capo profumiere e chimico delle fragranze.
Accanto a bilancia e beute, doso oli grezzi e compongo accordi.
Chiedimi qualsiasi formula, proporzioni in grammi, chiarificazione o segreti di macerazione.
Puoi anche inviare una formula alla «calcolatrice» o salvarla con un clic!

📌 Nota: la chat è salvata localmente e si cancella dopo un mese (30 giorni).`,
    de: `Willkommen in meinem Labor! Ich bin Meister Shahin, Chefparfümeur und Duftchemiker.
An meiner Waage und meinen Kolben dosiere ich Rohöle und komponiere Akkorde.
Frag mich nach Formeln, Gramm-Angaben, Klärung oder Mazerationsgeheimnissen.
Du kannst jede Formel mit einem Klick in den «Rechner» senden oder im Rezeptbuch speichern!

📌 Hinweis: Der Chat wird lokal gespeichert und nach einem Monat (30 Tagen) gelöscht.`,
    ru: `Добро пожаловать в мою лабораторию! Я мастер Шахин, главный парфюмер и ароматический химик.
У весов и колб я дозирую масла и составляю аккорды.
Спрашивайте о любых формулах, пропорциях в граммах, осветлении или секретах мацерации.
Любую формулу можно в один клик отправить в «калькулятор» или сохранить в рецептах!

📌 Примечание: чат хранится локально и автоматически удаляется через месяц (30 дней).`,
    zh: `欢迎来到我的实验室！我是 Shahin 大师，首席调香师与香料化学家。
我正站在天平与烧瓶旁，滴注精油、调配香方。
欢迎向我咨询任何配方、克重比例、浑浊处理或陈化秘诀——我以实验室级精度作答。
你也可以一键将配方发送到「调配计算器」或保存到配方库！

📌 提示：对话仅保存在本地设备，一个月（30 天）后自动删除以保护隐私。`,
    tr: `Laboratuvarıma hoş geldiniz! Ben Usta Shahin, baş parfümör ve koku kimyacısı.
Terazimin ve şişelerimin başında esans yağlarını damlatıp akorlar kuruyorum.
Herhangi bir formül, gram oranları, berraklaştırma veya dinlendirme sırları hakkında sorabilirsiniz.
Ayrıca her formülü tek tıkla «hesaplayıcıya» gönderebilir veya tarif defterine kaydedebilirsiniz!

📌 Not: sohbet yerel olarak saklanır ve bir ay (30 gün) sonra otomatik silinir.`,
    fa: `به آزمایشگاه من خوش آمدید! من استاد شاهین هستم، عطرساز ارشد و شیمی‌دان رایحه.
کنار ترازو و بالن‌هایم روغن‌های خام را قطره‌قطره ریخته و ترکیب‌ها را می‌سازم.
هر فرمولی، نسبت مواد بر حسب گرم، روش شفاف‌سازی یا رازهای کهنه‌سازی را از من بپرسید.
همچنین می‌توانید هر فرمول را با یک کلیک به «ماشین‌حساب» بفرستید یا در کتاب دستور ذخیره کنید!

📌 یادآوری: گفتگو به‌صورت محلی ذخیره می‌شود و پس از یک ماه (۳۰ روز) خودکار پاک می‌شود.`,
  },
} satisfies Record<string, LText>;

interface PerfumerAIChatbotProps {
  currentLang?: SupportedLanguage;
  onApplyToConcentrationCalculator: (formula: ExtractedAIPerfume) => void;
  onApplyToPyramidCalculator: (formula: ExtractedAIPerfume) => void;
  onRecordToRecipeLibrary: (formula: ExtractedAIPerfume) => void;
  onCalculateCosting: (formula: ExtractedAIPerfume) => void;
  onPrintSpecSheet: (formula: ExtractedAIPerfume) => void;
}


export const PerfumerAIChatbot: React.FC<PerfumerAIChatbotProps> = ({
  currentLang = 'ar',
  onApplyToConcentrationCalculator,
  onApplyToPyramidCalculator,
  onRecordToRecipeLibrary,
  onCalculateCosting,
  onPrintSpecSheet,
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);

  const PRESET_QUESTIONS = [
    L('preset_1'),
    L('preset_2'),
    L('preset_3'),
    L('preset_4'),
    L('preset_5'),
  ];
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Load persisted session with 30-day (1 month) expiration check
  const [sessionData, setSessionData] = useState(() => loadStoredChatSession());
  const [messages, setMessages] = useState<ChatMessage[]>(() => sessionData.messages);
  const [daysRemaining, setDaysRemaining] = useState(sessionData.daysRemaining);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [compoundingStep, setCompoundingStep] = useState(0);
  const [currentScaleWeight, setCurrentScaleWeight] = useState(12.45);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Copy & Action tracking states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [recordedId, setRecordedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Multi-AI Model Orchestrator State
  const [selectedModel, setSelectedModel] = useState<'auto' | 'gemini' | 'deepseek' | 'openai' | 'claude'>('auto');
  const [comparingMsgId, setComparingMsgId] = useState<string | null>(null);
  const [showAiMatrix, setShowAiMatrix] = useState(false);

  const AI_ENGINES = [
    { id: 'auto', name: L('engine_auto_name'), short: L('engine_auto_short'), badge: L('engine_auto_badge'), color: 'border-amber-400 bg-amber-500/20 text-amber-300', desc: L('engine_auto_desc') },
    { id: 'gemini', name: 'Google Gemini 3.8 Flash', short: L('engine_gemini_short'), badge: '✨ Gemini 3.8 Flash', color: 'border-emerald-400 bg-emerald-500/20 text-emerald-300', desc: L('engine_gemini_desc') },
    { id: 'deepseek', name: 'DeepSeek R1 Chemistry', short: L('engine_deepseek_short'), badge: '🔬 DeepSeek R1', color: 'border-blue-400 bg-blue-500/20 text-blue-300', desc: L('engine_deepseek_desc') },
    { id: 'openai', name: 'ChatGPT GPT-4o Architect', short: L('engine_openai_short'), badge: '🟢 GPT-4o Architect', color: 'border-green-400 bg-green-500/20 text-green-300', desc: L('engine_openai_desc') },
    { id: 'claude', name: 'Claude 3.5 Haute Parfumerie', short: L('engine_claude_short'), badge: '🟣 Claude 3.5 Sonnet', color: 'border-purple-400 bg-purple-500/20 text-purple-300', desc: L('engine_claude_desc') },
  ];

  const setActivePerspectiveForMessage = (msgId: string, tabId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, activePerspectiveTab: tabId } : m))
    );
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Persist messages whenever changed & broadcast to sync full lab view
  useEffect(() => {
    saveChatSession(messages);
    window.dispatchEvent(new CustomEvent('miyaar-chat-updated', { detail: messages }));
  }, [messages]);

  // Sync with updates from full lab view
  useEffect(() => {
    const handleSync = (e: any) => {
      if (Array.isArray(e.detail)) {
        setMessages(e.detail);
      }
    };
    window.addEventListener('miyaar-chat-updated', handleSync);
    return () => window.removeEventListener('miyaar-chat-updated', handleSync);
  }, []);

  // Listen for cross-app AI consultation requests from calculators
  useEffect(() => {
    const handleConsultation = (e: any) => {
      if (e.detail) {
        setIsOpen(true);
        setTimeout(() => {
          handleSendMessage(e.detail);
        }, 150);
      }
    };
    window.addEventListener('open-ai-chat-with-prompt', handleConsultation);
    return () => window.removeEventListener('open-ai-chat-with-prompt', handleConsultation);
  }, []);

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setCompoundingStep((prev) => (prev + 1) % 4);
        setCurrentScaleWeight((prev) => +(prev + 0.35 + Math.random() * 0.2).toFixed(2));
      }, 1100);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const compoundingMessages = [
    L('comp_1'),
    L('comp_2'),
    L('comp_3'),
    L('comp_4'),
  ];

  const handleSendMessage = async (
    textToSend?: string,
    overrideModel?: 'auto' | 'gemini' | 'deepseek' | 'openai' | 'claude'
  ) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const activeModelChoice = overrideModel || selectedModel;

    // Check if user requested an immediate interactive action by text command
    const lower = text.toLowerCase();
    if (
      (lower.includes('طبق') || lower.includes('حول') || lower.includes('انقل') ||
        lower.includes('apply') || lower.includes('transfer') || lower.includes('send')) &&
      (lower.includes('حاسبة') || lower.includes('تركيب') ||
        lower.includes('calculator') || lower.includes('lab') || lower.includes('formula'))
    ) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          const formula = extractFormulaFromAIMessage(messages[i].text);
          if (formula) {
            onApplyToConcentrationCalculator(formula);
            setIsOpen(false);
            return;
          }
        }
      }
    }

    const userMessage: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString(LOCALE_MAP[currentLang] || 'ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          model: activeModelChoice,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      const data = await response.json();
      const replyText = data.reply || L('error_reply');

      const botMessage: ChatMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString(LOCALE_MAP[currentLang] || 'ar-EG', { hour: '2-digit', minute: '2-digit' }),
        aiEngine: data.engine,
        perspectives: data.perspectives,
        activePerspectiveTab: 'consensus',
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const fallbackMessage: ChatMessage = {
        id: 'bot-err-' + Date.now(),
        role: 'assistant',
        text: L('fallback_reply'),
        timestamp: new Date().toLocaleTimeString(LOCALE_MAP[currentLang] || 'ar-EG', { hour: '2-digit', minute: '2-digit' }),
        aiEngine: {
          id: 'ensemble',
          name: L('welcome_name'),
          badge: L('fallback_badge'),
          provider: 'ensemble',
        },
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsultDifferentEngine = (
    originalUserText: string,
    targetEngine: 'auto' | 'gemini' | 'deepseek' | 'openai' | 'claude'
  ) => {
    setComparingMsgId(null);
    setSelectedModel(targetEngine);
    handleSendMessage(`${fmt(L('consult_prefix_tpl'), { m: targetEngine.toUpperCase() })} ${originalUserText}`, targetEngine);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyAll = () => {
    const transcript = messages
      .map((m) => `[${m.role === 'user' ? L('transcript_q') : L('transcript_a')} - ${m.timestamp}]:\n${m.text}`)
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

  const handleSpeech = (text: string) => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LOCALE_MAP[currentLang] || 'ar-EG';
      utterance.rate = 0.95;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div className={`fixed bottom-6 ${rtl ? 'right-6' : 'left-6'} z-40 no-print flex items-center gap-3`}>
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0, x: rtl ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: rtl ? 20 : -20 }}
              className="hidden sm:flex items-center gap-2 bg-stone-900/90 backdrop-blur-md text-amber-300 text-xs py-2 px-3.5 rounded-full shadow-lg border border-amber-500/30 font-medium"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>{L('teaser')}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative group p-1 rounded-full bg-gradient-to-tr from-amber-900 via-stone-900 to-amber-700 shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-400/40"
          title={L('trigger_title')}
        >
          <span className="absolute -inset-1 rounded-full bg-amber-500/20 blur-md group-hover:bg-amber-500/40 transition-all animate-pulse" />
          
          <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-amber-300/80">
            <img
              src={perfumerImg}
              alt={L('header_alt')}
              className="w-full h-full object-cover object-top"
            />
          </div>

          <span className={`absolute -bottom-1 ${rtl ? '-left-1' : '-right-1'} w-5 h-5 bg-amber-500 text-stone-950 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md border border-white`}>
            🧪
          </span>
        </button>
      </div>

      {/* Main Chatbot Window with Expanded Board Space */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className={`fixed z-50 bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col no-print transition-all ${
              isFullScreen
                ? 'inset-3 sm:inset-6'
                : `bottom-20 ${rtl ? 'right-3 sm:right-6' : 'left-3 sm:left-6'} w-[calc(100vw-1.5rem)] sm:w-[640px] lg:w-[780px] h-[86vh]`
            }`}
          >
            {/* 1. Compact Slim Header with Expiry Info */}
            <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-amber-400/80 shrink-0">
                  <img
                    src={perfumerImg}
                    alt={L('header_alt')}
                    className="w-full h-full object-cover object-top"
                  />
                  {isLoading && (
                    <span className="absolute inset-0 bg-amber-500/40 mix-blend-overlay animate-pulse" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-stone-100 font-serif-luxury">
                      {L('header_title')}
                    </span>
                    {/* Auto-Purge Expiration Badge */}
                    <span
                      className="px-2 py-0.2 bg-emerald-950 border border-emerald-500/40 text-emerald-300 rounded-full text-[9px] flex items-center gap-1 font-mono-numbers"
                      title={L('expiry_tooltip')}
                    >
                      <Clock className="w-2.5 h-2.5 text-emerald-400" />
                      <span>{fmt(L('days_left_tpl'), { d: daysRemaining })}</span>
                    </span>
                  </div>
                  <div className="text-[10px] text-amber-300/80 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>
                      {isLoading ? compoundingMessages[compoundingStep] : fmt(L('scale_tpl'), { w: currentScaleWeight })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Controls in Header */}
              <div className="flex items-center gap-1.5">
                {/* Download Backup */}
                <button
                  onClick={() => exportChatTranscriptToFile(messages, daysRemaining)}
                  className="p-1.5 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title={L('export_tooltip')}
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                </button>

                <button
                  onClick={handleCopyAll}
                  className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title={L('copy_all_tooltip')}
                >
                  {copiedAll ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span className="hidden sm:inline text-[11px]">{copiedAll ? L('copied') : L('copy_all')}</span>
                </button>

                {/* Clear Button */}
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="p-1.5 text-stone-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                  title={L('clear_tooltip')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-1.5 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title={isFullScreen ? L('minimize') : L('fullscreen')}
                >
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title={L('close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Multi-AI Model Selector Toolbar */}
            <div className="px-3 py-2 bg-stone-950 text-white border-b border-stone-800 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1.5 shrink-0 text-amber-400 font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{L('engine_label')}</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {AI_ENGINES.map((eng) => {
                  const isSelected = selectedModel === eng.id;
                  return (
                    <button
                      key={eng.id}
                      onClick={() => setSelectedModel(eng.id as any)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border ${
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
                  className={`px-2 py-1 rounded-xl text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 border ${
                    showAiMatrix
                      ? 'bg-amber-400 text-stone-950 border-amber-300 font-bold'
                      : 'bg-stone-900 text-amber-300 border-stone-800 hover:border-amber-500/40'
                  }`}
                  title={L('matrix_tooltip')}
                >
                  <Layers className="w-3 h-3" />
                  <span className="hidden md:inline">{L('matrix_btn')}</span>
                </button>
              </div>
            </div>

            {/* Connected AI Engines Matrix Panel */}
            {showAiMatrix && (
              <div className="p-3 bg-stone-900 text-stone-200 border-b border-stone-800 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-amber-300 font-bold text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{L('matrix_title')}</span>
                  </span>
                  <button onClick={() => setShowAiMatrix(false)} className="text-stone-400 hover:text-white cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-stone-950 border border-emerald-500/30 flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0 animate-pulse" />
                    <div>
                      <div className="font-bold text-emerald-300">Google Gemini 3.8 Flash</div>
                      <div className="text-stone-400 text-[10px]">{L('matrix_gemini')}</div>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-stone-950 border border-blue-500/30 flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 mt-1 shrink-0 animate-pulse" />
                    <div>
                      <div className="font-bold text-blue-300">DeepSeek R1 Chemistry</div>
                      <div className="text-stone-400 text-[10px]">{L('matrix_deepseek')}</div>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-stone-950 border border-green-500/30 flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 mt-1 shrink-0 animate-pulse" />
                    <div>
                      <div className="font-bold text-green-300">ChatGPT GPT-4o Architect</div>
                      <div className="text-stone-400 text-[10px]">{L('matrix_openai')}</div>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-stone-950 border border-purple-500/30 flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 mt-1 shrink-0 animate-pulse" />
                    <div>
                      <div className="font-bold text-purple-300">Claude 3.5 Haute Parfumerie</div>
                      <div className="text-stone-400 text-[10px]">{L('matrix_claude')}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Clear Confirmation Prompt */}
            {showClearConfirm && (
              <div className="p-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-xs text-rose-900">
                <span>{fmt(L('clear_confirm_tpl'), { d: daysRemaining })}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-0.5 bg-white border border-stone-200 rounded text-stone-600 hover:bg-stone-50 cursor-pointer"
                  >
                    {L('cancel')}
                  </button>
                  <button
                    onClick={handleClearHistory}
                    className="px-2.5 py-0.5 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded cursor-pointer"
                  >
                    {L('clear')}
                  </button>
                </div>
              </div>
            )}

            {/* 2. Expanded Chat Board */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-stone-50/60">
              {messages.map((msg) => {
                // Determine active perspective content if user toggled model tabs on this message
                const activeDisplayContent =
                  msg.id === 'welcome'
                    ? L('welcome_msg')
                    : msg.activePerspectiveTab && msg.activePerspectiveTab !== 'consensus' && msg.perspectives
                    ? msg.perspectives.find((p) => p.modelId === msg.activePerspectiveTab)?.reply || msg.text
                    : msg.text;

                const extractedFormula = msg.role === 'assistant' ? extractFormulaFromAIMessage(activeDisplayContent) : null;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* Avatar */}
                    {msg.role === 'assistant' ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-600/50 shrink-0 mt-0.5 shadow-xs">
                        <img
                          src={perfumerImg}
                          alt={L('shahin_alt')}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-amber-900 text-amber-200 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                        {L('you')}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[92%] sm:max-w-[86%] p-4 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-2xs space-y-2.5 ${
                        msg.role === 'user'
                          ? 'bg-amber-900 text-white rounded-tl-xs'
                          : 'bg-white text-stone-900 border border-stone-200/90 rounded-tr-xs'
                      }`}
                    >
                      {/* AI Engine Header for Assistant */}
                      {msg.role === 'assistant' && (
                        <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-stone-100 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-amber-950 font-serif-luxury">{L('welcome_name')}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 ${
                              msg.aiEngine?.provider === 'deepseek' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                              msg.aiEngine?.provider === 'openai' ? 'bg-green-50 text-green-800 border-green-200' :
                              msg.aiEngine?.provider === 'claude' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                              msg.aiEngine?.provider === 'gemini' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              'bg-amber-50 text-amber-900 border-amber-200'
                            }`}>
                              <span>{msg.aiEngine?.badge || L('default_badge')}</span>
                            </span>
                          </div>
                          <span className="text-[10px] text-stone-400 font-mono-numbers">{msg.timestamp}</span>
                        </div>
                      )}

                      {/* Perspective Switcher Tabs on Message (When Multi-AI Ensemble generated) */}
                      {msg.role === 'assistant' && msg.perspectives && msg.perspectives.length > 0 && (
                        <div className="p-1.5 bg-stone-50 rounded-xl border border-stone-200/80 mb-2 space-y-1">
                          <div className="text-[10px] text-stone-500 font-bold flex items-center justify-between px-1">
                            <span>{L('persp_lbl')}</span>
                            <span className="text-[9px] text-amber-700 bg-amber-100/60 px-1.5 py-0.2 rounded">{L('persp_ens')}</span>
                          </div>
                          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                            <button
                              onClick={() => setActivePerspectiveForMessage(msg.id, 'consensus')}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 border ${
                                (!msg.activePerspectiveTab || msg.activePerspectiveTab === 'consensus')
                                  ? 'bg-amber-200/90 text-amber-950 border-amber-400 shadow-2xs'
                                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                              }`}
                            >
                              <span>{L('consensus_lbl')}</span>
                            </button>
                            {msg.perspectives.map((p) => {
                              const isActive = msg.activePerspectiveTab === p.modelId;
                              return (
                                <button
                                  key={p.modelId}
                                  onClick={() => setActivePerspectiveForMessage(msg.id, p.modelId)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 border ${
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
                      <div className="whitespace-pre-line break-words font-sans space-y-2">
                        {activeDisplayContent}
                      </div>

                      {/* SMART INTERACTION BAR: Transfer Chat Data to App Modules */}
                      {extractedFormula && (
                        <div className="mt-3 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl space-y-2.5 text-xs text-amber-950 animate-in fade-in">
                          <div className="flex items-center justify-between font-bold text-amber-900">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-amber-700" />
                              <span>{L('transfer_lbl')}</span>
                            </span>
                            <span className="text-[10px] font-mono-numbers bg-white px-2 py-0.5 rounded border border-amber-200">
                              {extractedFormula.concentrationPercent}% {extractedFormula.concentrationType.toUpperCase()}
                            </span>
                          </div>

                          {/* Interactive Transfer Buttons */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            <button
                              onClick={() => {
                                onApplyToConcentrationCalculator(extractedFormula);
                                setIsOpen(false);
                              }}
                              className="p-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                              title={L('apply_conc_tip')}
                            >
                              <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                              <span>{L('apply_conc')}</span>
                            </button>

                            <button
                              onClick={() => {
                                onApplyToPyramidCalculator(extractedFormula);
                                setIsOpen(false);
                              }}
                              className="p-2 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                              title={L('apply_pyramid_tip')}
                            >
                              <Layers className="w-3.5 h-3.5 text-amber-700" />
                              <span>{L('apply_pyramid')}</span>
                            </button>

                            <button
                              onClick={() => {
                                onRecordToRecipeLibrary(extractedFormula);
                                setRecordedId(msg.id);
                                setTimeout(() => setRecordedId(null), 3000);
                              }}
                              className="p-2 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                              title={L('record_tip')}
                            >
                              {recordedId === msg.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700 font-bold">{L('recorded_lbl')}</span>
                                </>
                              ) : (
                                <>
                                  <BookmarkPlus className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{L('record_btn')}</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => {
                                onCalculateCosting(extractedFormula);
                                setIsOpen(false);
                              }}
                              className="p-2 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                              title={L('cost_tip')}
                            >
                              <DollarSign className="w-3.5 h-3.5 text-amber-800" />
                              <span>{L('cost_btn')}</span>
                            </button>
                          </div>

                          <div className="pt-1 flex items-center justify-between text-[11px] text-amber-900/80 border-t border-amber-200/60">
                            <span>{L('print_lbl')}</span>
                            <button
                              onClick={() => {
                                onPrintSpecSheet(extractedFormula);
                                setIsOpen(false);
                              }}
                              className="text-amber-900 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3 text-amber-800" />
                              <span>{L('print_btn')}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Bottom Action Strip Under EVERY message */}
                      <div
                        className={`flex flex-wrap items-center justify-between gap-2 text-[10px] pt-2 border-t ${
                          msg.role === 'user'
                            ? 'border-amber-800/80 text-amber-200'
                            : 'border-stone-100 text-stone-400'
                        }`}
                      >
                        <span className="font-mono-numbers">{msg.timestamp}</span>

                        <div className="flex items-center gap-1.5">
                          {/* Copy Button Under EACH message */}
                          <button
                            onClick={() => handleCopyMessage(msg.id, activeDisplayContent)}
                            className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer font-medium text-[11px] ${
                              msg.role === 'user'
                                ? 'bg-amber-800/80 hover:bg-amber-700 text-white'
                                : 'bg-stone-100 hover:bg-amber-50 hover:text-amber-900 text-stone-700 border border-stone-200/60'
                            }`}
                            title={msg.role === 'user' ? L('copy_q_title') : L('copy_a_title')}
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500 font-semibold">{L('copied')}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>{msg.role === 'user' ? L('copy_q') : L('copy_a')}</span>
                              </>
                            )}
                          </button>

                          {msg.role === 'assistant' && (
                            <>
                              {/* Re-consult another model */}
                              <div className="relative">
                                <button
                                  onClick={() => setComparingMsgId(comparingMsgId === msg.id ? null : msg.id)}
                                  className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-950 border border-stone-200 transition-colors flex items-center gap-1 cursor-pointer font-medium text-[11px]"
                                  title={L('consult_tooltip')}
                                >
                                  <Sparkles className="w-3 h-3 text-amber-700" />
                                  <span>{L('consult_btn')}</span>
                                </button>

                                {comparingMsgId === msg.id && (
                                  <div className="absolute left-0 bottom-full mb-1 z-30 bg-stone-900 text-white rounded-xl p-2 shadow-2xl border border-stone-700 min-w-[210px] space-y-1 text-xs animate-in fade-in zoom-in-95">
                                    <div className="text-[10px] text-amber-400 font-bold px-1.5 pb-1 border-b border-stone-800 flex items-center justify-between">
                                      <span>{L('choose_model')}</span>
                                      <X
                                        className="w-3 h-3 cursor-pointer text-stone-400 hover:text-white"
                                        onClick={() => setComparingMsgId(null)}
                                      />
                                    </div>
                                    {AI_ENGINES.map((eng) => (
                                      <button
                                        key={eng.id}
                                        onClick={() => {
                                          const prevUserMsg = messages
                                            .slice(0, messages.findIndex((m) => m.id === msg.id))
                                            .reverse()
                                            .find((m) => m.role === 'user');
                                          handleConsultDifferentEngine(
                                            prevUserMsg?.text || L('reformat_fallback'),
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
                                className="p-1 hover:text-amber-800 transition-colors flex items-center gap-1 cursor-pointer"
                                title={L('speech_tooltip')}
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Compounding Indicator */}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-600/50 shrink-0">
                    <img
                      src={perfumerImg}
                      alt={L('shahin_alt')}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl rounded-tr-xs text-xs text-amber-950 space-y-2 shadow-2xs max-w-[85%]">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="animate-spin text-base">🧪</span>
                      <span>{L('loading_title')}</span>
                    </div>
                    <div className="text-[11px] text-amber-800 leading-relaxed">
                      {compoundingMessages[compoundingStep]}
                    </div>
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

            {/* 3. Quick Suggestions Bar */}
            <div className="p-2.5 bg-stone-100/90 border-t border-stone-200 overflow-x-auto flex items-center gap-2 text-xs no-scrollbar shrink-0">
              <span className="text-[11px] font-bold text-stone-500 whitespace-nowrap">
                {L('presets_lbl')}
              </span>
              {PRESET_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  disabled={isLoading}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-amber-50 border border-stone-200 text-stone-700 hover:text-amber-900 text-[11px] transition-all cursor-pointer shadow-2xs shrink-0 font-medium"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* 4. Large Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-white border-t border-stone-200 flex items-center gap-2 shrink-0"
            >
              <input
                ref={inputRef}
                type="text"
                placeholder={L('input_placeholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-amber-700 focus:bg-white transition-all shadow-inner"
              />

              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2.5 px-4 bg-amber-800 hover:bg-amber-900 disabled:opacity-40 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center shrink-0 font-medium text-xs sm:text-sm gap-1"
                title={L('send')}
              >
                <span>{L('send')}</span>
                <Send className="w-3.5 h-3.5 rotate-180" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
