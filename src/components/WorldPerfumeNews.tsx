import React, { useState, useEffect } from 'react';
import {
  Globe,
  TrendingUp,
  Sparkles,
  Search,
  Calendar,
  Clock,
  Layers,
  FlaskConical,
  Check,
  Copy,
  Bookmark,
  X,
  Flame,
  ArrowRight,
  ShieldCheck,
  Award,
  BookOpen,
  RotateCcw,
  Radio,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  User,
  Zap,
} from 'lucide-react';
import { PERFUME_NEWS_DATA, PerfumeNewsItem } from '../data/perfumeNews';
import { NEWS_IMAGE_LIST, getEditorialImageForCategory } from '../data/newsImages';
import { PyramidNote } from '../types/perfume';
import { ExtractedAIPerfume } from '../utils/aiFormulaExtractor';
import { SupportedLanguage } from '../types/i18n';
import { getLocalizedNewsArticle, isRTL } from '../utils/localizedContent';
import { LText, makeT, fmt, loc, LOCALE_MAP } from '../utils/localize';
import { isStaticHosting, requestApi } from '../utils/api';
import { isNewsArticle, mergeNewsArticles, restoreNewsCache, resolveNewsImage } from '../utils/newsCache';
import { StaticHostingNotice, API_ERROR_NOTICE } from './StaticHostingNotice';
import masterShaheenImg from '../assets/images/master_perfumer_compounding_1791693212967.jpg';

interface WorldPerfumeNewsProps {
  currentLang?: SupportedLanguage;
  onApplyNewsNotesToCalculator: (formula: ExtractedAIPerfume) => void;
  onAddNoteToPyramid: (note: PyramidNote) => void;
}

const S = {
  load_1: { ar: 'الخبير شاهين يتواصل مع مراسلي المعارض في ميلانو وباريس ودبي...', en: 'Master Shahin is contacting fair correspondents in Milan, Paris & Dubai...', fr: 'Le Maître Shahin contacte ses correspondants à Milan, Paris et Dubaï…', es: 'El Maestro Shahin contacta a sus corresponsales en Milán, París y Dubái...', it: 'Il Maestro Shahin contatta gli inviati di Milano, Parigi e Dubai…', de: 'Meister Shahin kontaktiert die Messekorrespondenten in Mailand, Paris und Dubai…', ru: 'Мастер Шахин связывается с корреспондентами в Милане, Париже и Дубае…', zh: 'Shahin 大师正与米兰、巴黎和迪拜的展会通讯员联络……', tr: 'Usta Shahin Milano, Paris ve Dubai fuar muhabirleriyle görüşüyor…', fa: 'استاد شاهین با خبرنگاران نمایشگاه‌های میلان، پاریس و دبی تماس می‌گیرد...' },
  load_2: { ar: 'يفحص عينات الحصاد الطبيعي وشهادات النقاء والكروماتوغرافيا (GC-MS)...', en: 'Inspecting botanical harvest samples, purity certificates & GC-MS...', fr: 'Inspection des récoltes, certificats de pureté et GC-MS…', es: 'Inspeccionando cosechas, certificados de pureza y GC-MS...', it: 'Ispezione dei raccolti, certificati di purezza e GC-MS…', de: 'Prüfung von Ernteproben, Reinheitszertifikaten und GC-MS…', ru: 'Проверка образцов урожая, сертификатов чистоты и ГХ-МС…', zh: '正在检测天然收成样本、纯度证书与 GC-MS……', tr: 'Hasat örnekleri, saflık sertifikaları ve GC-MS inceleniyor…', fa: 'نمونه‌های برداشت، گواهی خلوص و GC-MS بررسی می‌شود...' },
  load_3: { ar: 'يحلل صيحات النيش وتعديلات IFRA للسلامة الجلدية...', en: 'Analyzing niche trends and IFRA skin-safety amendments...', fr: 'Analyse des tendances de niche et amendements IFRA…', es: 'Analizando tendencias de nicho y enmiendas IFRA...', it: 'Analisi delle tendenze di nicchia e modifiche IFRA…', de: 'Analyse von Nischentrends und IFRA-Änderungen…', ru: 'Анализ нишевых трендов и поправок IFRA…', zh: '正在分析小众趋势与 IFRA 皮肤安全修订……', tr: 'Niş trendleri ve IFRA cilt güvenliği düzenlemeleri analiz ediliyor…', fa: 'روندهای نیچ و اصلاحات IFRA برای ایمنی پوستی تحلیل می‌شود...' },
  load_4: { ar: 'يصيغ التقارير الفنية المعملية ويرفق الصور المصورة لليوم...', en: 'Drafting technical lab reports and attaching today’s photos...', fr: 'Rédaction des rapports techniques et photos du jour…', es: 'Redactando informes técnicos con las fotos de hoy...', it: 'Redazione dei rapporti tecnici con le foto di oggi…', de: 'Technische Laborberichte mit den heutigen Fotos…', ru: 'Подготовка технических отчётов с сегодняшними фото…', zh: '正在撰写实验室技术报告并附上今日图片……', tr: 'Teknik laboratuvar raporları yazılıyor ve günün fotoğrafları ekleniyor…', fa: 'گزارش‌های فنی آزمایشگاهی نوشته و عکس‌های امروز پیوست می‌شود...' },
  refresh_ok: { ar: 'تم تحديث النشرة اليومية بالصور بنجاح عبر الخبير شاهين.', en: 'Daily illustrated bulletin refreshed successfully by Master Shahin.', fr: 'Bulletin quotidien illustré actualisé par le Maître Shahin.', es: 'Boletín diario ilustrado actualizado por el Maestro Shahin.', it: 'Bollettino quotidiano illustrato aggiornato dal Maestro Shahin.', de: 'Tägliches Bildbulletin von Meister Shahin aktualisiert.', ru: 'Ежедневный иллюстрированный бюллетень обновлён мастером Шахином.', zh: 'Shahin 大师成功更新了每日图文快报。', tr: 'Günlük görsel bülten Usta Shahin tarafından güncellendi.', fa: 'نشریه روزانه مصور توسط استاد شاهین با موفقیت به‌روزرسانی شد.' },
  today_tpl: { ar: 'اليوم · {d}', en: 'Today · {d}', fr: 'Aujourd’hui · {d}', es: 'Hoy · {d}', it: 'Oggi · {d}', de: 'Heute · {d}', ru: 'Сегодня · {d}', zh: '今天 · {d}', tr: 'Bugün · {d}', fa: 'امروز · {d}' },
  read_time_default: { ar: '3 دقائق', en: '3 min', fr: '3 min', es: '3 min', it: '3 min', de: '3 Min', ru: '3 мин', zh: '3 分钟', tr: '3 dk', fa: '۳ دقیقه' },
  refresh_local_ok: { ar: 'تم تحديث النشرة اليومية ونشر التقارير المصورة مع الخبير شاهين.', en: 'Daily bulletin refreshed and photo reports published with Master Shahin.', fr: 'Bulletin actualisé et rapports photo publiés avec le Maître Shahin.', es: 'Boletín actualizado e informes foto publicados con el Maestro Shahin.', it: 'Bollettino aggiornato e report foto pubblicati con il Maestro Shahin.', de: 'Bulletin aktualisiert, Fotoreports mit Meister Shahin veröffentlicht.', ru: 'Бюллетень обновлён, фотоотчёты опубликованы с мастером Шахином.', zh: '每日快报已更新，图文报告已与 Shahin 大师一同发布。', tr: 'Günlük bülten güncellendi ve foto raporlar Usta Shahin ile yayımlandı.', fa: 'نشریه روزانه به‌روزرسانی و گزارش‌های مصور با استاد شاهین منتشر شد.' },
  cat_all: { ar: 'جميع الأخبار والتقارير المصورة', en: 'All Photo Reports', fr: 'Tous les rapports photo', es: 'Todos los informes foto', it: 'Tutti i report foto', de: 'Alle Fotoreports', ru: 'Все фотоотчёты', zh: '全部图文报道', tr: 'Tüm foto raporlar', fa: 'همه گزارش‌های مصور' },
  cat_niche: { ar: 'ابتكارات النيش والكيمياء', en: 'Niche & Green Chemistry', fr: 'Niche & chimie verte', es: 'Nicho y química verde', it: 'Nicchia e chimica verde', de: 'Nische & grüne Chemie', ru: 'Ниша и зелёная химия', zh: '小众与绿色化学', tr: 'Niş ve yeşil kimya', fa: 'نیچ و شیمی سبز' },
  cat_exhibitions: { ar: 'المعارض الدولية الكبرى', en: 'International Exhibitions', fr: 'Expositions internationales', es: 'Exposiciones internacionales', it: 'Esposizioni internazionali', de: 'Internationale Messen', ru: 'Международные выставки', zh: '国际大展', tr: 'Uluslararası fuarlar', fa: 'نمایشگاه‌های بین‌المللی' },
  cat_harvests: { ar: 'مواسم الحصاد والمواد الخام', en: 'Botanical Harvests', fr: 'Récoltes botaniques', es: 'Cosechas botánicas', it: 'Raccolte botaniche', de: 'Botanische Ernten', ru: 'Ботанические урожаи', zh: '植物收成', tr: 'Botanik hasatlar', fa: 'فصل‌های برداشت گیاهی' },
  cat_trends: { ar: 'صيحات وتقارير السوق', en: 'Market Trends & Analytics', fr: 'Tendances & analyses', es: 'Tendencias y análisis', it: 'Tendenze e analisi', de: 'Trends & Analysen', ru: 'Тренды и аналитика', zh: '市场趋势与分析', tr: 'Pazar trendleri ve analitik', fa: 'روندها و تحلیل بازار' },
  cat_ifra: { ar: 'لوائح وتحديثات IFRA', en: 'IFRA Regulations', fr: 'Réglementation IFRA', es: 'Reglamentos IFRA', it: 'Regolamenti IFRA', de: 'IFRA-Richtlinien', ru: 'Регламенты IFRA', zh: 'IFRA 法规', tr: 'IFRA düzenlemeleri', fa: 'مقررات IFRA' },
  newsletter_name: { ar: 'أخبار وصيحات العطور العالمية - معمل شام', en: 'World Perfume News - Sham Atelier', fr: 'Actualités mondiales du parfum - Atelier Sham', es: 'Noticias mundiales del perfume - Atelier Sham', it: 'Notizie mondiali del profumo - Atelier Sham', de: 'Welt-Parfümnews - Atelier Sham', ru: 'Мировые парфюмерные новости — Ателье Sham', zh: '世界香水资讯 — Sham 调香室', tr: 'Dünya Parfüm Haberleri - Sham Atölyesi', fa: 'اخبار جهانی عطر - کارگاه شام' },
  source_lbl: { ar: 'المصدر:', en: 'Source:', fr: 'Source :', es: 'Fuente:', it: 'Fonte:', de: 'Quelle:', ru: 'Источник:', zh: '来源：', tr: 'Kaynak:', fa: 'منبع:' },
  verdict_lbl2: { ar: 'رأي الخبير:', en: 'Master Verdict:', fr: 'Verdict du Maître :', es: 'Veredicto del Maestro:', it: 'Verdetto del Maestro:', de: 'Urteil des Meisters:', ru: 'Мнение мастера:', zh: '大师评语：', tr: 'Usta yorumu:', fa: 'نظر استاد:' },
  default_note_name: { ar: 'نوتة عطرية', en: 'Aromatic Note', fr: 'Note aromatique', es: 'Nota aromática', it: 'Nota aromatica', de: 'Aromatische Note', ru: 'Ароматическая нота', zh: '香材音符', tr: 'Aromatik nota', fa: 'نت عطری' },
  inspired_tpl: { ar: 'مستوحى من تقرير الخبير شاهين: {t}', en: 'Inspired by Master Shaheen Report: {t}', fr: 'Inspiré du rapport du Maître Shaheen : {t}', es: 'Inspirado en el informe del Maestro Shaheen: {t}', it: 'Ispirato al report del Maestro Shaheen: {t}', de: 'Inspired by Meister Shaheens Report: {t}', ru: 'По мотивам отчёта мастера Шахина: {t}', zh: '灵感来自 Shaheen 大师报告：{t}', tr: 'Usta Shaheen raporundan ilhamla: {t}', fa: 'الهام‌گرفته از گزارش استاد شاهین: {t}' },
  accord_title_tpl: { ar: 'توليفة تقرير: {t}...', en: 'Report Accord: {t}...', fr: 'Accord du rapport : {t}…', es: 'Acorde del informe: {t}…', it: 'Accordo del report: {t}…', de: 'Report-Akkord: {t}…', ru: 'Аккорд отчёта: {t}…', zh: '报告香调：{t}……', tr: 'Rapor akoru: {t}...', fa: 'آکورد گزارش: {t}...' },
  news_author: { ar: 'الخبير شاهين (أخبار العطور العالمية)', en: 'Master Shaheen (Global Perfume Trends)', fr: 'Maître Shaheen (Tendances mondiales)', es: 'Maestro Shaheen (Tendencias globales)', it: 'Maestro Shaheen (Tendenze globali)', de: 'Meister Shaheen (Globale Trends)', ru: 'Мастер Шахин (мировые тренды)', zh: 'Shaheen 大师（全球香水趋势）', tr: 'Usta Shaheen (Küresel Parfüm Trendleri)', fa: 'استاد شاهین (روندهای جهانی عطر)' },
  summary_tpl: { ar: 'توليفة مصممة بناءً على أحدث تقارير السوق المصورة المنشورة اليوم في {t}.\n{v}', en: 'Formula based on today’s daily fragrance intelligence in {t}.\n{v}', fr: 'Formule basée sur le rapport du jour dans {t}.\n{v}', es: 'Fórmula basada en el informe de hoy en {t}.\n{v}', it: 'Formula basata sul report di oggi in {t}.\n{v}', de: 'Formel basiert auf dem heutigen Report in {t}.\n{v}', ru: 'Формула по сегодняшнему отчёту: {t}.\n{v}', zh: '基于今日报告的配方：{t}。\n{v}', tr: 'Bugünün raporuna dayalı formül: {t}.\n{v}', fa: 'فرمول مبتنی بر گزارش امروز: {t}.\n{v}' },
  briefing_title: { ar: '👑 نشرة الخبير شاهين اليومية المصورة', en: '👑 Master Shahin’s Daily Illustrated Bulletin', fr: '👑 Bulletin illustré quotidien du Maître Shahin', es: '👑 Boletín ilustrado diario del Maestro Shahin', it: '👑 Bollettino illustrato quotidiano del Maestro Shahin', de: '👑 Meister Shahins tägliches Bildbulletin', ru: '👑 Ежедневный иллюстрированный бюллетень мастера Шахина', zh: '👑 Shahin 大师每日图文快报', tr: '👑 Usta Shahin’in günlük görsel bülteni', fa: '👑 نشریه روزانه مصور استاد شاهین' },
  active_coverage_tpl: { ar: 'تغطية نشطة لليوم: {d}', en: 'Live coverage today: {d}', fr: 'Couverture du jour : {d}', es: 'Cobertura de hoy: {d}', it: 'Copertura di oggi: {d}', de: 'Heutige Berichterstattung: {d}', ru: 'Освещение сегодня: {d}', zh: '今日实时报道：{d}', tr: 'Bugünün canlı kapsamı: {d}', fa: 'پوشش زنده امروز: {d}' },
  observatory_title: { ar: 'مرصد وصيحات العطور العالمية بالصور الحصرية', en: 'Global Perfume Trends Observatory with Exclusive Photos', fr: 'Observatoire mondial des tendances avec photos exclusives', es: 'Observatorio mundial de tendencias con fotos exclusivas', it: 'Osservatorio mondiale delle tendenze con foto esclusive', de: 'Welt-Trendobservatorium mit exklusiven Fotos', ru: 'Обсерватория мировых трендов с эксклюзивными фото', zh: '世界香水趋势观察站 · 独家图片', tr: 'Özel fotoğraflarla küresel parfüm trend gözlemevi', fa: 'رصدخانه روندهای جهانی عطر با عکس‌های اختصاصی' },
  observatory_desc: { ar: 'يرصد لك الخبير شاهين يومياً وبشكل مؤتمت أحدث ما تشهده مختبرات ومعارض باريس وميلانو وبيوتي وورلد دبي، مواسم حصاد الورود واللبان والعود النقي، ولوائح IFRA، مع إرفاق الصور عالية الدقة وإمكانية تحويل أي نوتات فوراً لحاسبة التركيب والمعمل!', en: 'Master Shahin tracks daily — fully automated — the latest from Paris & Milan labs, Beauty World Dubai, rose, frankincense & pure oud harvests, and IFRA rules, with high-res photos and one-tap transfer of any notes to the formulation calculator!', fr: 'Le Maître Shahin suit chaque jour, en automatique, les labos de Paris et Milan, Beauty World Dubaï, les récoltes de rose, d’oliban et d’oud pur, et les règles IFRA — avec photos HD et transfert instantané vers le calculateur !', es: 'El Maestro Shahin rastrea a diario los laboratorios de París y Milán, Beauty World Dubái, cosechas de rosa, olíbano y oud puro, y normas IFRA — con fotos HD y transferencia al calculador en un toque.', it: 'Il Maestro Shahin monitora ogni giorno i laboratori di Parigi e Milano, Beauty World Dubai, raccolti di rosa, incenso e oud puro e regole IFRA — con foto HD e trasferimento immediato al calcolatore.', de: 'Meister Shahin verfolgt täglich vollautomatisch die Labore von Paris & Mailand, Beauty World Dubai, Rosen-, Weihrauch- und Oud-Ernten sowie IFRA-Regeln — mit HD-Fotos und Sofortübernahme in den Rechner.', ru: 'Мастер Шахин ежедневно и автоматически отслеживает лаборатории Парижа и Милана, Beauty World Dubai, сборы роз, ладана и чистого уда, нормы IFRA — с HD-фото и мгновенным переносом нот в калькулятор!', zh: 'Shahin 大师每日自动追踪巴黎与米兰实验室、迪拜 Beauty World、玫瑰乳香纯乌木收成与 IFRA 法规，附高清图片，并可一键将香材转入调配计算器！', tr: 'Usta Shahin, Paris ve Milano laboratuvarlarını, Dubai Beauty World’ü, gül, tütsü ve saf oud hasatlarını ve IFRA kurallarını günlük otomatik izler — HD fotoğraflar ve tek dokunuşla hesaplayıcıya aktarma ile!', fa: 'استاد شاهین هر روز و به‌صورت خودکار جدیدترین خبرهای آزمایشگاه‌های پاریس و میلان، بیوتی ورلد دبی، فصل‌های برداشت گل محمدی، کندر و عود خالص و مقررات IFRA را با عکس‌های باکیفیت ردیابی می‌کند و هر نت را با یک لمس به ماشین‌حساب منتقل می‌کند!' },
  urgent_today: { ar: 'عاجل اليوم', en: 'URGENT TODAY', fr: 'URGENT AUJOURD’HUI', es: 'URGENTE HOY', it: 'URGENTE OGGI', de: 'HEUTE AKTUELL', ru: 'СРОЧНО СЕГОДНЯ', zh: '今日要闻', tr: 'BUGÜN ACİL', fa: 'فوری امروز' },
  urgent_fallback: { ar: 'صعود تقنيات التقطير الجزيئي البارد لدهن العود ومواسم الورد لعام 2026.', en: 'Cold molecular distillation for oud and 2026 rose harvests on the rise.', fr: 'La distillation moléculaire à froid pour l’oud et les récoltes de rose 2026 progresse.', es: 'La destilación molecular en frío para el oud y cosechas de rosa 2026 en ascenso.', it: 'La distillazione molecolare a freddo per oud e raccolti di rosa 2026 in crescita.', de: 'Kalte Molekulardestillation für Oud und Rosenernten 2026 im Aufschwung.', ru: 'Холодная молекулярная дистилляция уда и урожаи роз 2026 набирают обороты.', zh: '冷分子蒸馏乌木与 2026 玫瑰收成正在兴起。', tr: 'Oud için soğuk moleküler damıtma ve 2026 gül hasatları yükselişte.', fa: 'تقطیر مولکولی سرد عود و برداشت گل ۲۰۲۶ در حال رشد است.' },
  shahin_name: { ar: 'الخبير شاهين', en: 'Master Shahin', fr: 'Maître Shahin', es: 'Maestro Shahin', it: 'Maestro Shahin', de: 'Meister Shahin', ru: 'Мастер Шахин', zh: 'Shahin 大师', tr: 'Usta Shahin', fa: 'استاد شاهین' },
  shahin_role: { ar: 'شيخ العطارين ورئيس التحرير', en: 'Dean of Perfumers & Editor-in-Chief', fr: 'Doyen des parfumeurs et rédacteur en chef', es: 'Decano de perfumistas y editor jefe', it: 'Decano dei profumieri e direttore', de: 'Doyen der Parfumeure & Chefredakteur', ru: 'Шейх парфюмеров и главред', zh: '调香师泰斗 · 总编辑', tr: 'Attarların şeyhi ve yayın yönetmeni', fa: 'شیخ عطرسازان و سردبیر' },
  loading_news: { ar: 'الخبير شاهين يجلب أخبار اليوم...', en: 'Master Shahin is fetching today’s news...', fr: 'Le Maître Shahin récupère les news…', es: 'El Maestro Shahin está trayendo las noticias...', it: 'Il Maestro Shahin sta scaricando le notizie…', de: 'Meister Shahin holt die heutigen News…', ru: 'Мастер Шахин загружает новости…', zh: 'Shahin 大师正在获取今日新闻……', tr: 'Usta Shahin günün haberlerini getiriyor…', fa: 'استاد شاهین اخبار امروز را می‌آورد...' },
  refresh_btn: { ar: 'تحديث النشرة اليومية بالذكاء الاصطناعي', en: 'Refresh Daily Bulletin with AI', fr: 'Actualiser le bulletin avec l’IA', es: 'Actualizar boletín con IA', it: 'Aggiorna bollettino con IA', de: 'Bulletin mit KI aktualisieren', ru: 'Обновить бюллетень с ИИ', zh: '用 AI 刷新每日快报', tr: 'Bülteni YZ ile yenile', fa: 'به‌روزرسانی نشریه با هوش مصنوعی' },
  reports_count_tpl: { ar: '{n} تقرير مصور', en: '{n} photo reports', fr: '{n} rapports photo', es: '{n} informes foto', it: '{n} report foto', de: '{n} Fotoreports', ru: '{n} фотоотчётов', zh: '{n} 篇图文报道', tr: '{n} foto rapor', fa: '{n} گزارش مصور' },
  refresh_done: { ar: 'تحديث اليوم مكتمل ✓', en: 'Today’s refresh complete ✓', fr: 'Actualisation du jour terminée ✓', es: 'Actualización de hoy completa ✓', it: 'Aggiornamento di oggi completato ✓', de: 'Heutige Aktualisierung fertig ✓', ru: 'Обновление завершено ✓', zh: '今日更新完成 ✓', tr: 'Bugünün güncellemesi tamam ✓', fa: 'به‌روزرسانی امروز کامل شد ✓' },
  ready_to_refresh: { ar: 'جاهز للتحديث', en: 'Ready to refresh', fr: 'Prêt à actualiser', es: 'Listo para actualizar', it: 'Pronto ad aggiornare', de: 'Bereit zur Aktualisierung', ru: 'Готов к обновлению', zh: '准备刷新', tr: 'Yenilemeye hazır', fa: 'آماده به‌روزرسانی' },
  generating: { ar: 'جاري توليد التقارير المصورة...', en: 'Generating photo reports...', fr: 'Génération des rapports photo…', es: 'Generando informes foto...', it: 'Generazione dei report foto…', de: 'Fotoreports werden erstellt…', ru: 'Генерация фотоотчётов…', zh: '正在生成图文报道……', tr: 'Foto raporlar oluşturuluyor…', fa: 'در حال تولید گزارش‌های مصور...' },
  reports_word: { ar: 'تقارير مصورة', en: 'reports', fr: 'rapports', es: 'informes', it: 'report', de: 'Reports', ru: 'отчётов', zh: '篇报道', tr: 'rapor', fa: 'گزارش' },
  featured_lbl: { ar: 'التقرير الأبرز اليوم · اختيار الخبير شاهين', en: 'Today’s Featured Report · Master Shahin’s Pick', fr: 'Rapport phare du jour · choix du Maître', es: 'Informe destacado de hoy · elección del Maestro', it: 'Report del giorno · scelta del Maestro', de: 'Top-Report heute · Meister Shahins Wahl', ru: 'Отчёт дня · выбор мастера Шахина', zh: '今日焦点报道 · Shahin 大师之选', tr: 'Günün öne çıkan raporu · Usta Shahin’in seçimi', fa: 'گزارش برجسته امروز · انتخاب استاد شاهین' },
  notes_intro: { ar: 'النوتات والنسب المتصدرة في التقرير:', en: 'Top notes & ratios in this report:', fr: 'Notes et ratios phares du rapport :', es: 'Notas y proporciones del informe:', it: 'Note e proporzioni del report:', de: 'Top-Noten & Verhältnisse im Report:', ru: 'Ноты и пропорции отчёта:', zh: '报告中的主打香材与比例：', tr: 'Rapordaki öne çıkan notalar ve oranlar:', fa: 'نت‌ها و نسبت‌های برتر این گزارش:' },
  transferred_ok: { ar: 'تم النقل للحاسبة!', en: 'Transferred to calculator!', fr: 'Transféré vers le calculateur !', es: '¡Transferido a la calculadora!', it: 'Trasferito al calcolatore!', de: 'In den Rechner übernommen!', ru: 'Перенесено в калькулятор!', zh: '已转入计算器！', tr: 'Hesaplayıcıya aktarıldı!', fa: 'به ماشین‌حساب منتقل شد!' },
  apply_notes_lbl: { ar: 'تطبيق نوتات التقرير في المعمل', en: 'Apply report notes in the lab', fr: 'Appliquer les notes au laboratoire', es: 'Aplicar notas en el laboratorio', it: 'Applica le note in laboratorio', de: 'Noten ins Labor übernehmen', ru: 'Применить ноты в лаборатории', zh: '在实验室应用报告香材', tr: 'Rapor notalarını laboratuvarda uygula', fa: 'نت‌های گزارش را در آزمایشگاه اعمال کن' },
  read_full_lbl: { ar: 'قراءة التقرير الكامل بالصور', en: 'Read the full photo report', fr: 'Lire le rapport complet', es: 'Leer el informe completo', it: 'Leggi il report completo', de: 'Vollständigen Report lesen', ru: 'Читать полный отчёт', zh: '阅读完整图文报道', tr: 'Tam foto raporu oku', fa: 'گزارش کامل مصور را بخوانید' },
  copy_tooltip: { ar: 'نسخ ملخص التقرير', en: 'Copy report summary', fr: 'Copier le résumé', es: 'Copiar resumen', it: 'Copia riassunto', de: 'Report kopieren', ru: 'Скопировать отчёт', zh: '复制报告摘要', tr: 'Rapor özetini kopyala', fa: 'کپی خلاصه گزارش' },
  bookmark_tooltip: { ar: 'حفظ في المفضلة', en: 'Save to favorites', fr: 'Enregistrer', es: 'Guardar en favoritos', it: 'Salva nei preferiti', de: 'Speichern', ru: 'В закладки', zh: '收藏', tr: 'Favorilere kaydet', fa: 'ذخیره در علاقه‌مندی‌ها' },
  search_ph: { ar: 'ابحث في تقارير اليوم المصورة، المكونات، المعارض...', en: 'Search today’s photo reports, ingredients, exhibitions...', fr: 'Rechercher rapports, ingrédients, expositions…', es: 'Buscar informes, ingredientes, exposiciones...', it: 'Cerca report, ingredienti, esposizioni…', de: 'Reports, Zutaten, Messen durchsuchen…', ru: 'Поиск по отчётам, ингредиентам, выставкам…', zh: '搜索今日图文报道、原料、展会……', tr: 'Günün foto raporlarında, bileşenlerde, fuarlarda ara...', fa: 'جستجو در گزارش‌های مصور امروز، مواد، نمایشگاه‌ها...' },
  shahin_monitor: { ar: 'رصد الخبير شاهين', en: 'Master Shahin Monitor', fr: 'Veille du Maître Shahin', es: 'Monitor del Maestro Shahin', it: 'Monitor del Maestro Shahin', de: 'Meister-Shahin-Monitor', ru: 'Монитор мастера Шахина', zh: 'Shahin 大师监测', tr: 'Usta Shahin izleme', fa: 'رصد استاد شاهین' },
  apply_in_lab: { ar: 'تطبيق في المعمل', en: 'Apply in Lab', fr: 'Appliquer au labo', es: 'Aplicar en lab', it: 'Applica in lab', de: 'Ins Labor', ru: 'Применить в лаб.', zh: '在实验室应用', tr: 'Laboratuvarda uygula', fa: 'در آزمایشگاه اعمال کن' },
  shahin_daily: { ar: 'رصد الخبير شاهين لليوم', en: 'Master Shahin daily briefing', fr: 'Veille quotidienne du Maître', es: 'Monitor diario del Maestro', it: 'Monitor quotidiano del Maestro', de: 'Tagesbriefing des Meisters', ru: 'Ежедневный обзор мастера', zh: 'Shahin 大师每日简报', tr: 'Usta Shahin günlük izleme', fa: 'رصد روزانه استاد شاهین' },
  read_time_lbl: { ar: 'وقت القراءة:', en: 'Read Time:', fr: 'Temps de lecture :', es: 'Tiempo de lectura:', it: 'Tempo di lettura:', de: 'Lesezeit:', ru: 'Время чтения:', zh: '阅读时间：', tr: 'Okuma süresi:', fa: 'زمان مطالعه:' },
  editor_shahin: { ar: 'تحرير: الخبير شاهين', en: 'Editor: Master Shahin', fr: 'Rédaction : Maître Shahin', es: 'Editor: Maestro Shahin', it: 'Redazione: Maestro Shahin', de: 'Redaktion: Meister Shahin', ru: 'Редактор: мастер Шахин', zh: '编辑：Shahin 大师', tr: 'Editör: Usta Shahin', fa: 'سردبیر: استاد شاهین' },
  verdict_lbl: { ar: 'حكم ورؤية الخبير شاهين المعملية', en: 'Master Perfumer Shaheen Laboratory Verdict', fr: 'Verdict laboratoire du Maître Shaheen', es: 'Veredicto de laboratorio del Maestro Shaheen', it: 'Verdetto di laboratorio del Maestro Shaheen', de: 'Laborurteil von Meister Shaheen', ru: 'Лабораторный вердикт мастера Шахина', zh: 'Shaheen 大师实验室评语', tr: 'Usta Shaheen laboratuvar değerlendirmesi', fa: 'ارزیابی آزمایشگاهی استاد شاهین' },
  market_impact_lbl: { ar: 'أثر السوق والاقتصاد العطري:', en: 'Market Impact:', fr: 'Impact marché :', es: 'Impacto de mercado:', it: 'Impatto di mercato:', de: 'Marktauswirkung:', ru: 'Влияние на рынок:', zh: '市场影响：', tr: 'Pazar etkisi:', fa: 'تأثر بازار:' },
  accord_lbl: { ar: 'الهرم العطري المقترح في هذا التقرير:', en: 'Recommended Olfactory Accord in This Report:', fr: 'Accord olfactif recommandé :', es: 'Acorde olfativo recomendado:', it: 'Accordo olfattivo consigliato:', de: 'Empfohlenes Duft-Akkord:', ru: 'Рекомендуемый аккорд:', zh: '本报告推荐香调金字塔：', tr: 'Önerilen koku piramidi:', fa: 'هرم عطری پیشنهادی این گزارش:' },
  lab_ready: { ar: 'جاهز للتطبيق المعملي', en: 'Lab Ready', fr: 'Prêt pour le labo', es: 'Listo para el lab', it: 'Pronto per il lab', de: 'Laborbereit', ru: 'Готово к лаб.', zh: '可用于实验室', tr: 'Laboratuvara hazır', fa: 'آماده اعمال آزمایشگاهی' },
  apply_full_lbl: { ar: 'تطبيق هذه التوليفة بالكامل في حاسبة العطور والمعمل', en: 'Apply Full Accord to Formulation Scale & Lab', fr: 'Appliquer l’accord complet au calculateur', es: 'Aplicar el acorde completo a la calculadora', it: 'Applica l’accordo completo al calcolatore', de: 'Vollständigen Akkord in Rechner übernehmen', ru: 'Применить весь аккорд в калькуляторе', zh: '将整套香调应用到调配计算器', tr: 'Tam akoru hesaplayıcıya uygula', fa: 'کل آکورد را در ماشین‌حساب اعمال کن' },
  close_lbl: { ar: 'إغلاق', en: 'Close', fr: 'Fermer', es: 'Cerrar', it: 'Chiudi', de: 'Schließen', ru: 'Закрыть', zh: '关闭', tr: 'Kapat', fa: 'بستن' },
} satisfies Record<string, LText>;

const STORAGE_KEY_NEWS = 'miyaar_daily_perfume_news_v2';
const STORAGE_KEY_LAST_REFRESH = 'miyaar_perfume_news_last_refresh_date';

export const WorldPerfumeNews: React.FC<WorldPerfumeNewsProps> = ({
  currentLang = 'ar',
  onApplyNewsNotesToCalculator,
  onAddNoteToPyramid,
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);

  // Initialize news list from localStorage or fallback
  const [newsList, setNewsList] = useState<PerfumeNewsItem[]>(() => {
    try {
      return restoreNewsCache(localStorage.getItem(STORAGE_KEY_NEWS), PERFUME_NEWS_DATA);
    } catch {}
    return PERFUME_NEWS_DATA;
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<PerfumeNewsItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [transferSuccessId, setTransferSuccessId] = useState<string | null>(null);

  // Daily Refresh states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStep, setRefreshStep] = useState(0);
  const [lastRefreshedDate, setLastRefreshedDate] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_LAST_REFRESH) || '';
    } catch {
      return '';
    }
  });
  const [refreshToast, setRefreshToast] = useState<{ message: string; count: number; error?: boolean } | null>(null);

  const REFRESH_PHRASES = [L('load_1'), L('load_2'), L('load_3'), L('load_4')];

  // Cycling phrases during refresh
  useEffect(() => {
    let timer: any;
    if (isRefreshing) {
      timer = setInterval(() => {
        setRefreshStep((prev) => (prev + 1) % REFRESH_PHRASES.length);
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isRefreshing]);

  // Modal navigation history
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

  // Pages has no /api routes; retain the bundled/cached feed without failing requests.
  useEffect(() => {
    if (isStaticHosting) return;
    let cancelled = false;

    const fetchLatest = async () => {
      try {
        const data = await requestApi<{ success: boolean; articles: unknown }>('/api/news');
        if (!cancelled && data.success && Array.isArray(data.articles)) {
          const articles = data.articles.filter(isNewsArticle);
          if (articles.length > 0) {
            mergeArticles(articles);
            markRefreshed();
          }
        }
      } catch (err) {
        console.warn('News fetch failed; keeping the existing articles:', err);
      }
    };

    fetchLatest();
    return () => { cancelled = true; };
  }, []);

  const markRefreshed = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    setLastRefreshedDate(todayStr);
    try { localStorage.setItem(STORAGE_KEY_LAST_REFRESH, todayStr); } catch {}
  };

  const mergeArticles = (newArticles: PerfumeNewsItem[]) => {
    setNewsList((prev) => {
      const combined = mergeNewsArticles(prev, newArticles);
      try { localStorage.setItem(STORAGE_KEY_NEWS, JSON.stringify(combined)); } catch {}
      return combined;
    });
  };

  const handlePerformDailyRefresh = async () => {
    if (isRefreshing || isStaticHosting) return;
    setIsRefreshing(true);
    setRefreshToast(null);

    try {
      const data = await requestApi<{ success: boolean; articles: unknown; message?: string }>('/api/news/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!data.success || !Array.isArray(data.articles)) {
        throw new Error('Refresh response is invalid');
      }
      const articles = data.articles.filter(isNewsArticle);
      if (articles.length === 0) throw new Error('Refresh response is empty');

      mergeArticles(articles);
      markRefreshed();
      setRefreshToast({ message: data.message || L('refresh_ok'), count: articles.length });
      setTimeout(() => setRefreshToast(null), 6000);
    } catch (err) {
      console.warn('News refresh failed; no articles were changed:', err);
      setRefreshToast({ message: loc(currentLang, API_ERROR_NOTICE), count: 0, error: true });
    } finally {
      setIsRefreshing(false);
    }
  };

  const categories = [
    { id: 'all', label: L('cat_all') },
    { id: 'niche', label: L('cat_niche') },
    { id: 'exhibitions', label: L('cat_exhibitions') },
    { id: 'harvests', label: L('cat_harvests') },
    { id: 'trends', label: L('cat_trends') },
    { id: 'ifra', label: L('cat_ifra') },
  ];

  // Filtering
  const filteredNews = newsList.filter((item) => {
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
    const text = `📰 [${L('newsletter_name')}]\n${loc.titleAr}\n📅 ${item.date} | 🏛️ ${L('source_lbl')} ${item.source}\n\n${item.summaryAr}\n\n${L('verdict_lbl2')} ${item.expertVerdict || ''}`;
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
      nameAr: (rtl ? k.nameAr : (k.nameEn || k.nameAr)) || L('default_note_name'),
      nameEn: k.nameEn || k.nameAr || 'Aromatic Note',
      category: (k.type === 'top' || k.type === 'heart' || k.type === 'base' ? k.type : 'heart') as 'top' | 'heart' | 'base',
      percentageOfOil: k.percentageHint || 25,
      description: fmt(L('inspired_tpl'), { t: loc.titleAr }),
    }));

    const formula: ExtractedAIPerfume = {
      title: fmt(L('accord_title_tpl'), { t: loc.titleAr.slice(0, 32) }),
      author: L('news_author'),
      bottleVolumeMl: 50,
      concentrationPercent: 20,
      concentrationType: 'edp',
      alcoholPercentage: 96,
      waterPercent: 0,
      fixativePercent: 1.5,
      macerationDays: 35,
      summary: fmt(L('summary_tpl'), { t: loc.titleAr, v: item.expertVerdict || '' }),
      pyramidNotes: transformedNotes,
    };

    onApplyNewsNotesToCalculator(formula);
    setTransferSuccessId(item.id);
    setTimeout(() => setTransferSuccessId(null), 3000);
  };

  const rawFeatured = newsList.find((n) => n.isDailyRefreshed && n.isHot) || newsList.find((n) => n.isHot) || newsList[0];
  const featuredHotNews = rawFeatured ? getLocalizedNewsArticle(rawFeatured, currentLang) : null;

  // Use current build assets, not stale /src paths or old hashes from localStorage.
  const resolveArticleImage = (item: PerfumeNewsItem, index: number) =>
    resolveNewsImage(item.imageUrl, NEWS_IMAGE_LIST, getEditorialImageForCategory(item.category, index));

  const todayDisplay = new Date().toLocaleDateString(LOCALE_MAP[currentLang], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-10">
      <StaticHostingNotice currentLang={currentLang} />
      
      {/* 1. MASTER SHAHEEN DAILY EDITORIAL BULLETIN HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-10 border border-amber-900/50 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-700/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-3xl space-y-4">
            
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500/30 to-amber-600/20 text-amber-300 text-xs font-bold border border-amber-500/40 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>{L('briefing_title')}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 text-emerald-300 text-xs font-medium border border-emerald-800/50">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>{fmt(L('active_coverage_tpl'), { d: todayDisplay })}</span>
              </span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold font-serif-luxury tracking-tight text-white leading-tight">
              {L('observatory_title')}
            </h2>

            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
              {L('observatory_desc')}
            </p>

            {/* Live Ticker */}
            <div className="pt-1 flex items-center gap-3 bg-stone-900/90 backdrop-blur-md rounded-2xl p-3 border border-stone-800 text-xs text-stone-200">
              <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold text-[10px] tracking-wider shrink-0 flex items-center gap-1 animate-pulse">
                <Flame className="w-3.5 h-3.5" />
                {L('urgent_today')}
              </span>
              <div className="truncate flex-1 font-medium text-stone-200">
                {newsList[0]?.titleAr || L('urgent_fallback')}
              </div>
            </div>
          </div>

          {/* Master Shaheen Daily Refresh Action Box */}
          <div className="w-full lg:w-auto shrink-0 bg-stone-900/80 backdrop-blur-md p-5 rounded-2xl border border-amber-500/30 shadow-xl flex flex-col items-center sm:items-stretch text-center sm:text-right space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={masterShaheenImg}
                alt={L('shahin_name')}
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-md"
              />
              <div className="text-right">
                <div className="font-bold text-sm text-white flex items-center gap-1">
                  <span>{L('shahin_name')}</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-[11px] text-amber-300/80">{L('shahin_role')}</div>
              </div>
            </div>

            <button
              onClick={handlePerformDailyRefresh}
              disabled={isRefreshing || isStaticHosting}
              className={`w-full py-3 px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isRefreshing
                  ? 'bg-amber-700/60 text-stone-200 cursor-wait'
                  : 'bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-white shadow-amber-900/40 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isRefreshing ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin text-amber-300" />
                  <span>{L('loading_news')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{L('refresh_btn')}</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1 border-t border-stone-800">
              <span className="flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>{fmt(L('reports_count_tpl'), { n: newsList.length })}</span>
              </span>
              <span className="text-stone-400">
                {lastRefreshedDate ? L('refresh_done') : L('ready_to_refresh')}
              </span>
            </div>
          </div>
        </div>

        {/* Refreshing Progress Banner */}
        {isRefreshing && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-400/30 backdrop-blur-md animate-in fade-in flex items-center gap-3 text-amber-200 text-xs">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
            <div className="flex-1 font-medium truncate">
              {REFRESH_PHRASES[refreshStep]}
            </div>
            <span className="text-[10px] text-amber-300/70 shrink-0 font-mono">
              {L('generating')}
            </span>
          </div>
        )}

        {/* Refresh Toast Notice */}
        {refreshToast && (
          <div role={refreshToast.error ? 'alert' : 'status'} className={`mt-6 p-4 rounded-2xl border backdrop-blur-md flex items-center justify-between gap-3 text-xs ${refreshToast.error ? 'bg-amber-950/80 border-amber-500/50 text-amber-200' : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'}`}>
            <div className="flex items-center gap-2">
              {refreshToast.error ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
              <span className="font-semibold">{refreshToast.message}</span>
            </div>
            {!refreshToast.error && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-900/60 text-emerald-300 text-[11px] font-bold">
                +{refreshToast.count} {L('reports_word')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. FEATURED SPOTLIGHT ARTICLE WITH FULL PHOTO BANNER */}
      {featuredHotNews && (
        <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-lg hover:shadow-xl transition-all">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-5 relative aspect-[16/10] lg:aspect-auto overflow-hidden group">
              <img
                src={resolveArticleImage(featuredHotNews, 0)}
                alt={featuredHotNews.titleAr}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-stone-950/80 backdrop-blur-md text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-lg border border-amber-500/30">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>{L('featured_lbl')}</span>
              </div>
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-xs text-white text-[11px] font-mono-numbers flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>{featuredHotNews.readTime || L('read_time_default')}</span>
              </div>
            </div>

            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-stone-500">
                  <span className="font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    {featuredHotNews.categoryLabelAr}
                  </span>
                  <span className="flex items-center gap-1 text-stone-600">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>{featuredHotNews.date}</span>
                  </span>
                  <span className="text-stone-300">·</span>
                  <span className="text-stone-600">{featuredHotNews.source}</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold font-serif-luxury text-stone-950 leading-snug hover:text-amber-900 cursor-pointer" onClick={() => openArticleReader(featuredHotNews)}>
                  {featuredHotNews.titleAr}
                </h3>

                <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
                  {featuredHotNews.summaryAr}
                </p>

                {/* Key notes preview */}
                {featuredHotNews.keyNotes && (
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-stone-700 block mb-2">
                      {L('notes_intro')}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {featuredHotNews.keyNotes.map((note, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 text-xs font-medium border border-stone-200 flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                          <span>{note.nameAr}</span>
                          <span className="text-amber-800 font-bold text-[11px]">({note.percentageHint}%)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Master Shaheen quote in featured */}
                {featuredHotNews.expertVerdict && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50/80 to-stone-50 border border-amber-200/80 text-xs text-amber-950 italic flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      {featuredHotNews.expertVerdict}
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
                        <span>{L('transferred_ok')}</span>
                      </>
                    ) : (
                      <>
                        <FlaskConical className="w-4 h-4 text-amber-300" />
                        <span>{L('apply_notes_lbl')}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => openArticleReader(featuredHotNews)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-stone-600" />
                    <span>{L('read_full_lbl')}</span>
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
                    title={L('bookmark_tooltip')}
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. FILTER AND SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-stone-950 text-white shadow-md'
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
            placeholder={L('search_ph')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full ${rtl ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-700 shadow-xs`}
          />
        </div>
      </div>

      {/* 4. ARTICLES GRID WITH HIGH RESOLUTION PICTURES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNews.map((item, index) => {
          const loc = getLocalizedNewsArticle(item, currentLang);
          const isBookmarked = bookmarkedIds.includes(item.id);
          const isCopied = copiedId === item.id;
          const isTransferred = transferSuccessId === item.id;
          const imageSrc = resolveArticleImage(item, index);

          return (
            <div
              key={item.id}
              className="bg-white rounded-3xl border border-stone-200/90 overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Article Image Container */}
                <div className="relative aspect-[16/10] overflow-hidden bg-stone-100 cursor-pointer" onClick={() => openArticleReader(item)}>
                  <img
                    src={imageSrc}
                    alt={loc.titleAr}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Badges Overlay */}
                  <div className={`absolute top-3 ${rtl ? 'right-3' : 'left-3'} flex flex-col gap-1.5 items-start`}>
                    <span className="px-2.5 py-1 rounded-lg bg-stone-950/85 backdrop-blur-md text-amber-300 text-[10px] font-bold border border-amber-500/20 shadow-md">
                      {loc.categoryLabelAr}
                    </span>
                    {item.isDailyRefreshed && (
                      <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-600 to-amber-700 text-white text-[9px] font-bold shadow-md flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" />
                        <span>{L('shahin_monitor')}</span>
                      </span>
                    )}
                  </div>

                  <div className={`absolute bottom-3 ${rtl ? 'left-3' : 'right-3'} px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-white text-[10px] flex items-center gap-1 font-mono-numbers`}>
                    <Clock className="w-3 h-3 text-stone-300" />
                    <span>{item.readTime || L('read_time_default')}</span>
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

                  {/* Master Shaheen verdict snippet */}
                  {item.expertVerdict && (
                    <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-[11px] text-amber-900 italic line-clamp-2">
                      {item.expertVerdict}
                    </div>
                  )}

                  {/* Notes Tag list */}
                  {item.keyNotes && item.keyNotes.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {item.keyNotes.slice(0, 3).map((note, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 text-[10px] font-medium border border-stone-200 flex items-center gap-1"
                        >
                          <span className="w-1 h-1 rounded-full bg-amber-600" />
                          <span>{rtl ? note.nameAr : note.nameEn}</span>
                          <span className="text-stone-400 font-mono text-[9px]">({note.percentageHint}%)</span>
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
              <div className="p-4 bg-stone-50/90 border-t border-stone-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleTransferToWorkbench(item)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-[11px] font-semibold transition-all shadow-xs cursor-pointer"
                >
                  {isTransferred ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{L('transferred_ok')}</span>
                    </>
                  ) : (
                    <>
                      <FlaskConical className="w-3.5 h-3.5 text-amber-300" />
                      <span>{L('apply_in_lab')}</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openArticleReader(item)}
                    className="p-1.5 text-stone-600 hover:text-stone-950 hover:bg-stone-200 rounded-lg text-xs font-medium cursor-pointer"
                    title={L('read_full_lbl')}
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCopySummary(item)}
                    className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded-lg cursor-pointer"
                    title={L('copy_tooltip')}
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
                    title={L('bookmark_tooltip')}
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. FULL ARTICLE READER MODAL WITH HIGH RESOLUTION PHOTO */}
      {selectedArticle && (() => {
        const modalLoc = getLocalizedNewsArticle(selectedArticle, currentLang);
        const modalImg = resolveArticleImage(selectedArticle, 0);

        return (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
              
              {/* Header Image with overlays */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-stone-900">
                <img
                  src={modalImg}
                  alt={modalLoc.titleAr}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={closeArticleReader}
                  className={`absolute top-4 ${rtl ? 'left-4' : 'right-4'} p-2 rounded-full bg-black/60 hover:bg-black text-white transition-colors cursor-pointer shadow-lg`}
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className={`absolute bottom-4 ${rtl ? 'right-4' : 'left-4'} flex items-center gap-2`}>
                  <span className="px-3 py-1 rounded-lg bg-stone-950/90 text-amber-300 text-xs font-bold shadow-md">
                    {modalLoc.categoryLabelAr}
                  </span>
                  {selectedArticle.isDailyRefreshed && (
                    <span className="px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-bold shadow-md">
                      ⚡ {L('shahin_daily')}
                    </span>
                  )}
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 sm:p-8 space-y-5 text-stone-800">
                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 border-b border-stone-100 pb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>{selectedArticle.date}</span>
                  </span>
                  <span>·</span>
                  <span>{L('source_lbl')} {selectedArticle.source}</span>
                  <span>·</span>
                  <span>{L('read_time_lbl')} {selectedArticle.readTime || L('read_time_default')}</span>
                  <span>·</span>
                  <span className="text-amber-800 font-semibold flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span>{L('editor_shahin')}</span>
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold font-serif-luxury text-stone-950 leading-snug">
                  {modalLoc.titleAr}
                </h3>

                <div className="prose text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                  {selectedArticle.contentAr || selectedArticle.summaryAr}
                </div>

                {/* Expert Verdict Box */}
                {selectedArticle.expertVerdict && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-stone-50 border border-amber-200 space-y-2">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-700" />
                      <span>{L('verdict_lbl')}</span>
                    </span>
                    <p className="text-xs text-amber-950 leading-relaxed italic">
                      {selectedArticle.expertVerdict}
                    </p>
                    {selectedArticle.marketImpact && (
                      <div className="text-[11px] text-amber-800 pt-1 font-medium border-t border-amber-200/60">
                        📊 {L('market_impact_lbl')} {selectedArticle.marketImpact}
                      </div>
                    )}
                  </div>
                )}

                {/* Mentioned Key Notes breakdown with button */}
                {selectedArticle.keyNotes && selectedArticle.keyNotes.length > 0 && (
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">
                        {L('accord_lbl')}
                      </span>
                      <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                        {L('lab_ready')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selectedArticle.keyNotes.map((note, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-stone-900">{rtl ? note.nameAr : note.nameEn}</div>
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
                      <span>{L('apply_full_lbl')}</span>
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
                    <span>{L('copy_tooltip')}</span>
                  </button>

                  <button
                    onClick={closeArticleReader}
                    className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    {L('close_lbl')}
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
