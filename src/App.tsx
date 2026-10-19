import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { Header } from './components/Header';
import { UserProfilePage } from './components/UserProfilePage';
import { Hero } from './components/Hero';
import { HomeHub } from './components/HomeHub';
import { Storefront } from './components/Storefront';
import { ProductDetail } from './components/ProductDetail';
import { ConcentrationCalculator } from './components/ConcentrationCalculator';
import { PyramidCalculator } from './components/PyramidCalculator';
import { AlcoholDilutionCalculator } from './components/AlcoholDilutionCalculator';
import { CostCalculator } from './components/CostCalculator';
import { FormulaLibrary } from './components/FormulaLibrary';
import { WorldPerfumesLibrary } from './components/WorldPerfumesLibrary';
import { RawMaterialsEncyclopedia } from './components/RawMaterialsEncyclopedia';
import { AgingAndFixativesGuide } from './components/AgingAndFixativesGuide';
import { MacerationTimeSimulator } from './components/MacerationTimeSimulator';
import { ManufacturingSpecSheet } from './components/ManufacturingSpecSheet';
import { PerfumerAIChatbot } from './components/PerfumerAIChatbot';
import { PerfumerMasterLabView } from './components/PerfumerMasterLabView';
import { ShamAssistant } from './assistant/ShamAssistant';
import { WorldPerfumeNews } from './components/WorldPerfumeNews';
import { Footer } from './components/Footer';
import { LocalizedNumberInput } from './components/LocalizedNumberInput';
import { TopPromoHub } from './components/TopPromoHub';
import { NavigationBreadcrumbs } from './components/NavigationBreadcrumbs';
import { CountryAndAddressModal } from './components/CountryAndAddressModal';
import { AuthModal } from './components/AuthModal';
import { DataPrivacyModal } from './components/DataPrivacyModal';
import { LegalCenter } from './components/LegalCenter';
import { CookieConsent } from './components/CookieConsent';
import { useSeo } from './hooks/useSeo';
import {
  FormulationState,
  PyramidNote,
  SavedFormula,
} from './types/perfume';
import { UserDetailedAddress } from './types/address';
import {
  CURATED_FORMULA_PRESETS,
} from './data/presets';
import { WorldPerfumeRecipe } from './data/worldPerfumes';
import { calculatePerfumeFormulation } from './utils/calculations';
import { ExtractedAIPerfume } from './utils/aiFormulaExtractor';
import type { ShaheenTool, ToolLink } from './utils/shaheenTools';
import { SupportedLanguage, SUPPORTED_LANGUAGES } from './types/i18n';
import { getInitialLanguage, saveLanguage } from './لغات/i18n';
import { loadAiPack } from './لغات/aiPackLoader';
import { LanguageProvider } from './context/LanguageContext';
import { LText, makeT, fmt, pickArEn } from './لغات/localize';
import {
  UserEnvironmentProfile,
  getInitialUserEnvironment,
} from './utils/environmentAdapter';
import { loadDetailedAddress } from './utils/addressStorage';
import {
  detectEntryLanguageAsync,
  forceRedetectLocation,
  USER_LANGUAGE_MANUAL_OVERRIDE_KEY,
  saveUserCountryCode,
} from './utils/geoDetector';
import { UserProfile } from './types/auth';
import { getCurrentUserSession, logoutUser } from './utils/authStorage';
import { decodeFormulaPayload } from './utils/formulaShare';
import { Check, X, BookmarkPlus } from 'lucide-react';
import { syncRecipeToAccount, trackLearning } from './community/sync';
import { getSessionToken } from './community/api';
import { profileFromMember, saveCurrentUserProfile } from './utils/authStorage';
import { useSessionPick } from './community/session';
import { ErrorBoundary, lazyWithReload } from './utils/lazyRetry';

// «مجتمع شام» (social, messenger, member and merchant portals): its own bundle, loaded on the first #community visit.
const CommunityApp = lazyWithReload(() => import('./community/CommunityApp'));

const LOCAL_STORAGE_KEY = 'miyaar_perfume_saved_formulas';


const S = {
  toast_shared_loaded: {
    ar: '✨ تم فتح تركيبة العطر المشاركة: «{title}» في حاسبة المعمل وبطاقة المواصفات!',
    en: '✨ Shared fragrance formula loaded: «{title}» into lab calculator & spec sheet!',
    fr: '✨ Formule partagée chargée : « {title} » dans le calculateur et la fiche !',
    es: '✨ ¡Fórmula compartida cargada: «{title}» en la calculadora y ficha técnica!',
    it: '✨ Formula condivisa caricata: «{title}» nel calcolatore e nella scheda!',
    de: '✨ Geteilte Formel geladen: „{title}“ im Rechner & Datenblatt!',
    ru: '✨ Загружена полученная формула: «{title}» в калькулятор и техкарту!',
    zh: '✨ 已加载共享香水配方：「{title}」至实验室计算器与规格单！',
    tr: '✨ Paylaşılan formül yüklendi: «{title}» hesaplayıcıya ve teknik karta!',
    fa: '✨ فرمول اشتراک‌گذاری شده «{title}» در ماشین‌حساب و کارت مشخصات بارگذاری شد!',
  },
  toast_home_back: { ar: 'أنت الآن في الصفحة الرئيسية. اضغط زر الرجوع مجدداً لمغادرة المنصة.', en: 'You are on the home page. Press back again to leave the platform.', fr: 'Vous êtes sur l’accueil. Appuyez à nouveau sur retour pour quitter.', es: 'Estás en el inicio. Pulsa atrás de nuevo para salir.', it: 'Sei nella home. Premi di nuovo indietro per uscire.', de: 'Sie sind auf der Startseite. Drücken Sie erneut „Zurück“, um zu verlassen.', ru: 'Вы на главной странице. Нажмите «Назад» ещё раз, чтобы выйти.', zh: '您正在首页。再次点击返回即可离开平台。', tr: 'Ana sayfadasınız. Ayrılmak için geriye tekrar basın.', fa: 'شما در صفحه اصلی هستید. برای خروج دوباره دکمه بازگشت را بزنید.' },
  toast_lang_tpl: { ar: '🌐 تم تغيير لغة المنصة بنجاح إلى: {flag} «{native}» ({dir})', en: '🌐 Platform language changed to: {flag} «{native}» ({dir})', fr: '🌐 Langue changée : {flag} « {native} » ({dir})', es: '🌐 Idioma cambiado a: {flag} «{native}» ({dir})', it: '🌐 Lingua cambiata: {flag} «{native}» ({dir})', de: '🌐 Sprache geändert: {flag} „{native}“ ({dir})', ru: '🌐 Язык платформы изменён: {flag} «{native}» ({dir})', zh: '🌐 平台语言已切换为：{flag}「{native}」（{dir}）', tr: '🌐 Dil değiştirildi: {flag} «{native}» ({dir})', fa: '🌐 زبان پلتفرم به {flag} «{native}» ({dir}) تغییر کرد' },
  toast_geo_tpl: { ar: '📍 تم تحديد موقعك: {flag} {country} — لغة المنصة: {lang}', en: '📍 Location detected: {flag} {country} — Platform language: {lang}', fr: '📍 Position détectée : {flag} {country} — Langue : {lang}', es: '📍 Ubicación detectada: {flag} {country} — Idioma: {lang}', it: '📍 Posizione rilevata: {flag} {country} — Lingua: {lang}', de: '📍 Standort erkannt: {flag} {country} — Sprache: {lang}', ru: '📍 Ваше местоположение: {flag} {country} — Язык: {lang}', zh: '📍 已检测到您的位置：{flag} {country} — 平台语言：{lang}', tr: '📍 Konum algılandı: {flag} {country} — Dil: {lang}', fa: '📍 موقعیت شما شناسایی شد: {flag} {country} — زبان پلتفرم: {lang}' },
  toast_env_tpl: { ar: '🌍 تم ضبط بلد المعمل: {flag} «{country}» وعملة {currency}!', en: '🌍 Lab country set: {flag} «{country}» with currency {currency}!', fr: '🌍 Pays du laboratoire : {flag} « {country} », devise {currency} !', es: '🌍 País del laboratorio: {flag} «{country}», moneda {currency}!', it: '🌍 Paese del laboratorio: {flag} «{country}», valuta {currency}!', de: '🌍 Laberland festgelegt: {flag} „{country}“, Währung {currency}!', ru: '🌍 Страна лаборатории: {flag} «{country}», валюта {currency}!', zh: '🌍 实验室国家已设置：{flag}「{country}」，货币 {currency}！', tr: '🌍 Laboratuvar ülkesi: {flag} «{country}», para birimi {currency}!', fa: '🌍 کشور آزمایشگاه تنظیم شد: {flag} «{country}» با ارز {currency}!' },
  toast_welcome_tpl: { ar: '👤 مرحباً بك يا {name} في معملك الخاص!', en: '👤 Welcome {name} to your private lab!', fr: '👤 Bienvenue {name} dans votre laboratoire !', es: '👤 ¡Bienvenido {name} a tu laboratorio!', it: '👤 Benvenuto {name} nel tuo laboratorio!', de: '👤 Willkommen {name} in Ihrem Labor!', ru: '👤 Добро пожаловать, {name}, в вашу лабораторию!', zh: '👤 欢迎 {name} 来到您的私人实验室！', tr: '👤 {name}, özel laboratuvarınıza hoş geldiniz!', fa: '👤 {name} عزیز، به آزمایشگاه شخصی‌تان خوش آمدید!' },
  toast_logout: { ar: '👋 تم تسجيل الخروج بنجاح', en: '👋 Logged out successfully', fr: '👋 Déconnecté avec succès', es: '👋 Sesión cerrada con éxito', it: '👋 Disconnesso con successo', de: '👋 Erfolgreich abgemeldet', ru: '👋 Вы вышли из аккаунта', zh: '👋 已成功退出登录', tr: '👋 Başarıyla çıkış yapıldı', fa: '👋 با موفقیت از حساب خارج شدید' },
  toast_wiped: { ar: '🛡️ تم مسح كافة بياناتك وسجلاتك الشخصية نهائياً بنجاح (GDPR Cleared)', en: '🛡️ All your personal data and records permanently wiped (GDPR Cleared)', fr: '🛡️ Toutes vos données ont été effacées (RGPD)', es: '🛡️ Todos tus datos han sido borrados (GDPR)', it: '🛡️ Tutti i tuoi dati sono stati cancellati (GDPR)', de: '🛡️ Alle Ihre Daten wurden endgültig gelöscht (DSGVO)', ru: '🛡️ Все ваши данные окончательно удалены (GDPR)', zh: '🛡️ 您的所有个人数据已彻底清除（GDPR）', tr: '🛡️ Tüm verileriniz kalıcı olarak silindi (GDPR)', fa: '🛡️ همه داده‌های شخصی شما برای همیشه پاک شد (GDPR)' },
  toast_apply_lab_tpl: { ar: '🧪 تم تطبيق تركيبة «{title}» في حاسبة التركيب والمعمل بنجاح!', en: '🧪 Formula «{title}» applied to the compounding calculator!', fr: '🧪 Formule « {title} » appliquée au calculateur !', es: '🧪 ¡Fórmula «{title}» aplicada a la calculadora!', it: '🧪 Formula «{title}» applicata al calcolatore!', de: '🧪 Formel „{title}“ in den Rechner übernommen!', ru: '🧪 Формула «{title}» применена в калькуляторе!', zh: '🧪 配方「{title}」已成功应用到调配计算器！', tr: '🧪 «{title}» formülü hesaplayıcıya uygulandı!', fa: '🧪 فرمول «{title}» با موفقیت در ماشین‌حساب اعمال شد!' },
  toast_apply_pyramid_tpl: { ar: '🔺 تم نقل نوتات «{title}» إلى حاسبة الهرم العطري بنجاح!', en: '🔺 Notes of «{title}» transferred to the pyramid calculator!', fr: '🔺 Notes de « {title} » transférées au calculateur de pyramide !', es: '🔺 ¡Notas de «{title}» transferidas a la pirámide olfativa!', it: '🔺 Note di «{title}» trasferite al calcolatore della piramide!', de: '🔺 Noten von „{title}“ in den Pyramidenrechner übertragen!', ru: '🔺 Ноты «{title}» перенесены в калькулятор пирамиды!', zh: '🔺 「{title}」的香材已成功转移到金字塔计算器！', tr: '🔺 «{title}» notaları piramit hesaplayıcısına aktarıldı!', fa: '🔺 نت‌های «{title}» به ماشین‌حساب هرم منتقل شد!' },
  toast_saved_lib_tpl: { ar: '📝 تم تدوين وحفظ «{title}» في دفتر الوصفات تلقائياً!', en: '📝 «{title}» recorded into the recipe library automatically!', fr: '📝 « {title} » enregistrée dans le carnet de recettes !', es: '📝 ¡«{title}» guardada en la libreta de recetas!', it: '📝 «{title}» salvata nella libreria delle ricette!', de: '📝 „{title}“ automatisch im Rezeptbuch gespeichert!', ru: '📝 «{title}» автоматически сохранена в книге рецептов!', zh: '📝 「{title}」已自动记入配方库！', tr: '📝 «{title}» tarif defterine kaydedildi!', fa: '📝 «{title}» به‌طور خودکار در دفتر فرمول‌ها ثبت شد!' },
  toast_tool_tpl: { ar: '🧪 فتحت «{tool}» بقيم سؤالك — راجعها قبل التنفيذ', en: '🧪 Opened «{tool}» with the values from your question — review them before use', fr: '🧪 « {tool} » ouvert avec les valeurs de votre question — vérifiez-les', es: '🧪 «{tool}» abierto con los valores de tu pregunta — revísalos', de: '🧪 „{tool}“ mit den Werten deiner Frage geöffnet — bitte prüfen', tr: '🧪 «{tool}» sorunuzdaki değerlerle açıldı — kontrol edin', fa: '🧪 «{tool}» با مقادیر سؤال شما باز شد — قبل از اجرا بررسی کنید' },
  tool_concentration: { ar: 'حاسبة التركيب', en: 'Compounding calculator' },
  tool_pyramid: { ar: 'الهرم العطري', en: 'Fragrance pyramid' },
  tool_maceration: { ar: 'محاكي التعتيق', en: 'Maceration simulator' },
  tool_alcohol: { ar: 'تخفيف الكحول', en: 'Alcohol dilution' },
  tool_costing: { ar: 'التكاليف والأرباح', en: 'Cost & profit' },
  tool_raw_materials: { ar: 'موسوعة الخامات', en: 'Raw materials' },
  tool_guide: { ar: 'دليل المثبتات والتعتيق', en: 'Fixatives & aging guide' },
  tool_store: { ar: 'ترشيحات من متجر شام', en: 'Picks from Sham store' },
  toast_store: { ar: '🛍️ شاهين بيختار لك من متجر شام حسب طلبك', en: '🛍️ Shaheen is picking from Sham store for you' },
  toast_costing_tpl: { ar: '💰 تم الانتقال لحاسبة التكاليف والأرباح لتسعير تركيبة «{title}»!', en: '💰 Moved to the costing calculator to price «{title}»!', fr: '💰 Passage au calculateur de coûts pour tarifer « {title} » !', es: '💰 ¡Ve a la calculadora de costes para tarificar «{title}»!', it: '💰 Passato al calcolatore dei costi per prezzi «{title}»!', de: '💰 Zum Kostenrechner gewechselt, um „{title}“ zu bepreisen!', ru: '💰 Переход к калькулятору себестоимости для «{title}»!', zh: '💰 已转到成本计算器为「{title}」定价！', tr: '💰 «{title}» için maliyet hesaplayıcısına geçildi!', fa: '💰 برای قیمت‌گذاری «{title}» به ماشین‌حساب هزینه منتقل شدید!' },
  toast_loaded_lab_tpl: { ar: 'تم تحميل التركيبة "{title}" بنجاح في المعمل', en: 'Formula "{title}" loaded into the lab', fr: 'Formule « {title} » chargée dans le laboratoire', es: 'Fórmula "{title}" cargada en el laboratorio', it: 'Formula "{title}" caricata nel laboratorio', de: 'Formel „{title}“ ins Labor geladen', ru: 'Формула «{title}» загружена в лабораторию', zh: '配方“{title}”已成功载入实验室', tr: '"{title}" formülü laboratuvara yüklendi', fa: 'فرمول «{title}» با موفقیت در آزمایشگاه بارگذاری شد' },
  toast_loaded_world_tpl: { ar: 'تم تحميل تركيبة «{title}» في حاسبة المعمل بنجاح!', en: 'Formula «{title}» loaded into the lab calculator!', fr: 'Formule « {title} » chargée dans le calculateur !', es: '¡Fórmula «{title}» cargada en la calculadora!', it: 'Formula «{title}» caricata nel calcolatore!', de: 'Formel „{title}“ in den Lab-rechner geladen!', ru: 'Формула «{title}» загружена в калькулятор!', zh: '配方「{title}」已成功载入实验室计算器！', tr: '«{title}» formülü hesaplayıcıya yüklendi!', fa: 'فرمول «{title}» با موفقیت در ماشین‌حساب بارگذاری شد!' },
  toast_note_added_tpl: { ar: 'تمت إضافة «{name}» إلى الهرم العطري بنجاح', en: '«{name}» added to the fragrance pyramid', fr: '« {name} » ajoutée à la pyramide olfactive', es: '«{name}» añadida a la pirámide olfativa', it: '«{name}» aggiunta alla piramide olfattiva', de: '„{name}“ zur Duftpyramide hinzugefügt', ru: '«{name}» добавлена в пирамиду', zh: '「{name}」已成功加入香调金字塔', tr: '«{name}» koku piramidine eklendi', fa: '«{name}» با موفقیت به هرم عطری اضافه شد' },
  toast_formula_saved_tpl: { ar: 'تم حفظ التركيبة "{title}" في مكتبة الوصفات!', en: 'Formula "{title}" saved to the library!', fr: 'Formule « {title} » enregistrée !', es: '¡Fórmula "{title}" guardada en la biblioteca!', it: 'Formula "{title}" salvata nella libreria!', de: 'Formel „{title}“ in der Bibliothek gespeichert!', ru: 'Формула «{title}» сохранена в библиотеке!', zh: '配方“{title}”已保存到配方库！', tr: '"{title}" formülü kütüphaneye kaydedildi!', fa: 'فرمول «{title}» در کتابخانه ذخیره شد!' },
  toast_formula_deleted: { ar: 'تم حذف التركيبة من المكتبة', en: 'Formula deleted from the library', fr: 'Formule supprimée de la bibliothèque', es: 'Fórmula eliminada de la biblioteca', it: 'Formula eliminata dalla libreria', de: 'Formel aus der Bibliothek gelöscht', ru: 'Формула удалена из библиотеки', zh: '配方已从库中删除', tr: 'Formül kütüphaneden silindi', fa: 'فرمول از کتابخانه حذف شد' },
  toast_addr_saved_tpl: { ar: '📍 تم حفظ وتحديث مقر المعمل: {name}', en: '📍 Lab facility saved & updated: {name}', fr: '📍 Établissement enregistré : {name}', es: '📍 Instalación guardada y actualizada: {name}', it: '📍 Struttura salvata e aggiornata: {name}', de: '📍 Standort gespeichert & aktualisiert: {name}', ru: '📍 Лаборатория сохранена: {name}', zh: '📍 实验室信息已保存并更新：{name}', tr: '📍 Tesis kaydedildi ve güncellendi: {name}', fa: '📍 مقر آزمایشگاه ذخیره و به‌روزرسانی شد: {name}' },
  expert_tip_lbl: { ar: 'نصيحة الخبير:', en: 'Expert tip:', fr: 'Conseil d’expert :', es: 'Consejo del experto:', it: 'Consiglio dell’esperto:', de: 'Expertentipp:', ru: 'Совет эксперта:', zh: '专家提示：', tr: 'Uzman tavsiyesi:', fa: 'توصیه متخصص:' },
  default_title: { ar: 'عطر مخصص جديد', en: 'New Custom Perfume', fr: 'Nouveau parfum personnalisé', es: 'Nuevo perfume personalizado', it: 'Nuovo profumo personalizzato', de: 'Neues Eigenparfüm', ru: 'Новый авторский аромат', zh: '新自定义香水', tr: 'Yeni Özel Parfüm', fa: 'عطر سفارشی جدید' },
  default_author: { ar: 'مصمم العطور', en: 'Perfume Designer', fr: 'Parfumeur créateur', es: 'Diseñador de perfumes', it: 'Profumiere', de: 'Parfümdesigner', ru: 'Парфюмер', zh: '调香师', tr: 'Parfüm Tasarımcısı', fa: 'طراح عطر' },
  save_modal_title: { ar: 'حفظ التركيبة في مكتبة الوصفات', en: 'Save formula to the recipe library', fr: 'Enregistrer la formule dans la bibliothèque', es: 'Guardar fórmula en la biblioteca', it: 'Salva la formula nella libreria', de: 'Formel in der Bibliothek speichern', ru: 'Сохранить формулу в библиотеку', zh: '将配方保存到配方库', tr: 'Formülü kütüphaneye kaydet', fa: 'ذخیره فرمول در کتابخانه دستورها' },
  lbl_name: { ar: 'اسم العطر / التركيبة', en: 'Perfume / formula name', fr: 'Nom du parfum', es: 'Nombre del perfume', it: 'Nome del profumo', de: 'Parfümname', ru: 'Название аромата', zh: '香水/配方名称', tr: 'Parfüm adı', fa: 'نام عطر / فرمول' },
  lbl_author: { ar: 'المصمم / الدار', en: 'Designer / house', fr: 'Créateur / maison', es: 'Diseñador / casa', it: 'Creatore / maison', de: 'Designer / Haus', ru: 'Автор / дом', zh: '设计师/品牌', tr: 'Tasarımcı / marka', fa: 'طراح / برند' },
  lbl_batch: { ar: 'كود التشغيلة (Batch ID)', en: 'Batch ID', fr: 'N° de lot', es: 'ID de lote', it: 'ID lotto', de: 'Chargen-ID', ru: 'Код партии', zh: '批次编号（Batch ID）', tr: 'Parti kodu', fa: 'کد بچ (Batch ID)' },
  lbl_maceration: { ar: 'فترة التعتيق المقترحة (بالأيام)', en: 'Recommended maceration period (days)', fr: 'Maturation conseillée (jours)', es: 'Maceración recomendada (días)', it: 'Maturazione consigliata (giorni)', de: 'Empfohlene Mazeration (Tage)', ru: 'Рекомендуемое настаивание (дней)', zh: '建议熟成期（天）', tr: 'Önerilen maserasyon süresi (gün)', fa: 'دوره تعریف پیشنهادی (روز)' },
  lbl_notes: { ar: 'ملاحظات التركيبة والشعور العطري', en: 'Formula notes & olfactory feel', fr: 'Notes de formule et ressenti', es: 'Notas de fórmula y sensación', it: 'Note della formula e sensazione', de: 'Formelnotizen & Duftgefühl', ru: 'Заметки о формуле и характере', zh: '配方与香气感受备注', tr: 'Formül notları ve koku hissi', fa: 'یادداشت فرمول و حس بویایی' },
  cancel: { ar: 'إلغاء', en: 'Cancel', fr: 'Annuler', es: 'Cancelar', it: 'Annulla', de: 'Abbrechen', ru: 'Отмена', zh: '取消', tr: 'Vazgeç', fa: 'انصراف' },
  confirm_save: { ar: 'تأكيد الحفظ', en: 'Confirm Save', fr: 'Confirmer', es: 'Confirmar guardado', it: 'Conferma salvataggio', de: 'Speichern bestätigen', ru: 'Сохранить', zh: '确认保存', tr: 'Kaydet', fa: 'تأیید ذخیره' },
} satisfies Record<string, LText>;


export default function App() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      if (new URLSearchParams(window.location.search).has('checkout')) return 'store';
      const hash = window.location.hash.replace('#', '');
      const clean = hash.split('?')[0];
      if (clean === 'formula' || clean === 'spec') return 'concentration';
      // Check for product detail page
      const productMatch = clean.match(/^product=(\d+)$/);
      if (productMatch) {
        const productId = parseInt(productMatch[1]);
        if (!isNaN(productId)) {
          return 'productDetail';
        }
      }
      return clean || 'home';
    } catch {
      return 'home';
    }
  });
  // A product link opened directly (a product page's «اطلب من المتجر» button, a shared link) must show that
  // product at once — not an empty detail page until the hash changes.
  const [productId, setProductId] = useState<number | null>(() => {
    try {
      const m = window.location.hash.replace('#', '').split('?')[0].match(/^product=(\d+)$/);
      return m ? parseInt(m[1], 10) : null;
    } catch {
      return null;
    }
  });
  useSeo(activeTab);
  const [historyStack, setHistoryStack] = useState<string[]>(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      const clean = hash.split('?')[0];
      if (clean.match(/^product=(\d+)$/)) {
        return ['productDetail'];
      }
      return ['home'];
    } catch {
      return ['home'];
    }
  });

  // Modals & toast state
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setIsEnvironmentModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isLegalCenterOpen, setIsLegalCenterOpen] = useState(false);
  const [legalInitialTab, setLegalInitialTab] = useState<string>('overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Synchronous modal tracker ref for browser popstate
  const activeModalsRef = React.useRef({
    spec: false,
    save: false,
    auth: false,
    env: false,
    privacy: false,
    legal: false,
  });
  // Listen for Footer legal center open (L-08..L-20 Fix)
  React.useEffect(() => {
    const onOpenLegal = (e: Event) => {
      const tab = (e as CustomEvent).detail || 'overview';
      setLegalInitialTab(tab);
      setIsLegalCenterOpen(true);
      activeModalsRef.current.legal = true;
    };
    window.addEventListener('open-legal-center', onOpenLegal);
    return () => window.removeEventListener('open-legal-center', onOpenLegal);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const closeAllModalsDirectly = () => {
    activeModalsRef.current = { spec: false, save: false, auth: false, env: false, privacy: false, legal: false };
    setIsSpecModalOpen(false);
    setIsSaveModalOpen(false);
    setIsAuthModalOpen(false);
    setIsEnvironmentModalOpen(false);
    setIsPrivacyModalOpen(false);
    setIsLegalCenterOpen(false);
  };

  const handleOpenSpecModal = () => {
    activeModalsRef.current.spec = true;
    setIsSpecModalOpen(true);
    try {
      window.history.pushState({ tab: activeTab, modal: 'spec' }, '', window.location.hash || `#${activeTab}`);
    } catch {}
  };

  const handleCloseSpecModal = () => {
    activeModalsRef.current.spec = false;
    setIsSpecModalOpen(false);
    if (window.history.state?.modal === 'spec') {
      window.history.back();
    }
  };

  const handleOpenSaveModal = () => {
    activeModalsRef.current.save = true;
    setIsSaveModalOpen(true);
    try {
      window.history.pushState({ tab: activeTab, modal: 'save' }, '', window.location.hash || `#${activeTab}`);
    } catch {}
  };

  const handleCloseSaveModal = () => {
    activeModalsRef.current.save = false;
    setIsSaveModalOpen(false);
    if (window.history.state?.modal === 'save') {
      window.history.back();
    }
  };

  const handleOpenAuthModal = () => {
    activeModalsRef.current.auth = true;
    setIsAuthModalOpen(true);
    try {
      window.history.pushState({ tab: activeTab, modal: 'auth' }, '', window.location.hash || `#${activeTab}`);
    } catch {}
  };

  const handleCloseAuthModal = () => {
    activeModalsRef.current.auth = false;
    setIsAuthModalOpen(false);
    if (window.history.state?.modal === 'auth') {
      window.history.back();
    }
  };

  const handleOpenEnvironmentModal = () => {
    activeModalsRef.current.env = true;
    setIsEnvironmentModalOpen(true);
    try {
      window.history.pushState({ tab: activeTab, modal: 'env' }, '', window.location.hash || `#${activeTab}`);
    } catch {}
  };

  const handleCloseEnvironmentModal = () => {
    activeModalsRef.current.env = false;
    setIsEnvironmentModalOpen(false);
    if (window.history.state?.modal === 'env') {
      window.history.back();
    }
  };

  const handleOpenPrivacyModal = () => {
    activeModalsRef.current.privacy = true;
    setIsPrivacyModalOpen(true);
    try {
      window.history.pushState({ tab: activeTab, modal: 'privacy' }, '', window.location.hash || `#${activeTab}`);
    } catch {}
  };

  const handleClosePrivacyModal = () => {
    activeModalsRef.current.privacy = false;
    setIsPrivacyModalOpen(false);
    if (window.history.state?.modal === 'privacy') {
      window.history.back();
    }
  };

  const navigateToTab = (tab: string, pushHistory = true) => {
    if (tab === activeTab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    closeAllModalsDirectly();

    if (pushHistory) {
      setHistoryStack((prev) => [...prev, tab]);
      try {
        window.history.pushState({ tab, isAppNav: true }, '', `#${tab}`);
      } catch (e) {
        window.location.hash = `#${tab}`;
      }
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoBack = () => {
    const hasOpenModal =
      activeModalsRef.current.spec ||
      activeModalsRef.current.save ||
      activeModalsRef.current.auth ||
      activeModalsRef.current.env ||
      activeModalsRef.current.privacy;

    if (hasOpenModal) {
      closeAllModalsDirectly();
      if (window.history.state?.modal) {
        window.history.back();
      }
      return;
    }

    if (window.history.length > 1 && historyStack.length > 1) {
      window.history.back();
    } else {
      navigateToTab('home');
    }
  };

  // Exit guard ref to prevent accidental tab closing when clicking back on Home
  const lastExitAttemptRef = React.useRef<number>(0);

  // Sync with browser popstate (back/forward button)
  useEffect(() => {
    const initialHash = window.location.hash.replace('#', '') || 'home';

    // Ensure initial entry has registered history state
    try {
      if (!window.history.state || !window.history.state.tab) {
        window.history.replaceState({ tab: initialHash, isInitial: true }, '', `#${initialHash}`);
      }
    } catch {}

    const handlePopState = (event: PopStateEvent) => {
      // 1. If any modal was open and user pressed browser Back, close the modal safely
      const hasOpenModal =
        activeModalsRef.current.spec ||
        activeModalsRef.current.save ||
        activeModalsRef.current.auth ||
        activeModalsRef.current.env ||
        activeModalsRef.current.privacy;

      if (hasOpenModal && !event.state?.modal) {
        closeAllModalsDirectly();
        // If we closed a modal while on the current tab, keep user on this tab
        if (event.state?.tab === activeTab) {
          return;
        }
      }

      // 2. Identify target tab
      const hash = window.location.hash.replace('#', '').split('?')[0];
      const rawTarget = event.state?.tab || hash || 'home';
      const cleanRaw = rawTarget.split('?')[0];
      const targetTab = cleanRaw === 'formula' || cleanRaw === 'spec' ? 'concentration' : 
                        cleanRaw === 'store' ? 'store' : cleanRaw;

      // 3. Double-back safety net on Home to prevent accidental browser tab close
      if (targetTab === 'home' && (!event.state || event.state.isInitial)) {
        const now = Date.now();
        if (now - lastExitAttemptRef.current > 2500) {
          lastExitAttemptRef.current = now;
          showToast(L('toast_home_back'));
          try {
            window.history.pushState({ tab: 'home', isInitial: false }, '', '#home');
          } catch {}
          setActiveTab('home');
          return;
        }
      }

      // 4. Update tab & synchronize historyStack
      setActiveTab(targetTab);
      setHistoryStack((prev) => {
        if (prev.length > 1 && prev[prev.length - 2] === targetTab) {
          return prev.slice(0, -1);
        }
        return [...prev, targetTab];
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').split('?')[0];
      // Check for product detail page
      const productMatch = hash.match(/^product=(\d+)$/);
      if (productMatch) {
        const productId = parseInt(productMatch[1]);
        if (!isNaN(productId)) {
          setActiveTab('productDetail');
          setProductId(productId);
          return;
        }
      }
      const target = hash === 'formula' || hash === 'spec' ? 'concentration' : 
                    hash === 'store' ? 'store' : (hash || 'home');
      setActiveTab(target);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [activeTab]);

  // Core formulation state
  const [formulation, setFormulation] = useState<FormulationState>({
    bottleVolumeMl: 50,
    batchCount: 1,
    concentrationPercent: 20,
    concentrationType: 'edp',
    alcoholPercentage: 96,
    waterPercent: 0,
    fixativePercent: 1.0,
    oilDensity: 0.92,
    alcoholDensity: 0.80,
    unitMode: 'grams',
  });

  // Current formula metadata
  const [formulaTitle, setFormulaTitle] = useState('خلطة شام الفاخرة'); // default shown until user edits; localized label below
  const [formulaAuthor, setFormulaAuthor] = useState('مصمم عطور شام'); // default; localized label below
  const [batchCode, setBatchCode] = useState('MYR-B01');
  const [formulaNotes, setFormulaNotes] = useState('تركيبة متوازنة شرقية غربية معتقة.');
  const [macerationDays, setMacerationDays] = useState(30);
  // Values Shaheen read from a question, for calculators that keep their own inputs (remount on each link).
  const [alcoholPreset, setAlcoholPreset] = useState<{ from?: number; to?: number; volume?: number; at: number } | null>(null);
  const [materialSearch, setMaterialSearch] = useState<{ text: string; at: number } | null>(null);
  // «ترشيحات من متجر شام» from Shaheen's chat: the visitor's wish, asked again in the store's «اسأل شاهين».
  const [storeQuery, setStoreQuery] = useState<{ text: string; at: number } | null>(null);
  const [macerationStartDate, setMacerationStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Fragrance pyramid notes
  const [pyramidNotes, setPyramidNotes] = useState<PyramidNote[]>(
    CURATED_FORMULA_PRESETS[0].pyramidNotes
  );

  // Saved formulas in LocalStorage
  const [savedFormulas, setSavedFormulas] = useState<SavedFormula[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load local storage formulas', e);
    }
    return CURATED_FORMULA_PRESETS;
  });

  // Global Language & Internationalization State
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(() => getInitialLanguage());
  const L = makeT(currentLang, S);

  // Regional Environment & Climate Adaptation State
  const [currentEnvironment, setCurrentEnvironment] = useState<UserEnvironmentProfile>(() =>
    getInitialUserEnvironment()
  );

  // User Profile & Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() =>
    getCurrentUserSession().user
  );
  const [showProfilePage, setShowProfilePage] = useState(false);
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);

  // User Detailed Facility & Shipping Address State
  const [detailedAddress, setDetailedAddress] = useState<UserDetailedAddress>(() =>
    loadDetailedAddress()
  );

  // Check and load shared formula from URL hash or query params
  useEffect(() => {
    const handleUrlFormula = () => {
      try {
        const hash = window.location.hash || '';
        const search = window.location.search || '';
        if (
          hash.includes('d=') ||
          hash.includes('formula=') ||
          search.includes('formula=') ||
          search.includes('d=')
        ) {
          const raw = hash.includes('d=') || hash.includes('formula=') ? hash : search;
          const payload = decodeFormulaPayload(raw);
          if (payload && payload.title) {
            setFormulaTitle(payload.title);
            if (payload.author) setFormulaAuthor(payload.author);
            if (payload.batchCode) setBatchCode(payload.batchCode);
            if (payload.notes) setFormulaNotes(payload.notes);
            if (payload.macerationDays) setMacerationDays(payload.macerationDays);
            if (payload.formulation) setFormulation(payload.formulation);
            if (payload.pyramidNotes && payload.pyramidNotes.length > 0) {
              setPyramidNotes(payload.pyramidNotes);
            }
            setActiveTab('concentration');
            setIsSpecModalOpen(true);
            showToast(fmt(L('toast_shared_loaded'), { title: payload.title }));
          }
        }
      } catch (err) {
        console.error('Error loading shared formula from URL:', err);
      }
    };

    handleUrlFormula();
    window.addEventListener('hashchange', handleUrlFormula);
    return () => {
      window.removeEventListener('hashchange', handleUrlFormula);
    };
  }, []);

  // The opening language already comes from the entry country
  // (getInitialLanguage -> detectEntryLanguage). Refine it once with the
  // IP-based country, unless the visitor picked a language themselves.
  useEffect(() => {
    detectEntryLanguageAsync()
      .then((hit) => {
        if (!hit) return;
        if (hit.countryCode) {
          saveUserCountryCode(hit.countryCode);
        }
        let hasOverride = false;
        try {
          hasOverride = !!localStorage.getItem(USER_LANGUAGE_MANUAL_OVERRIDE_KEY);
        } catch (e) {}
        if (!hasOverride && hit.language !== currentLang) {
          setCurrentLang(hit.language);
          saveLanguage(hit.language);
        }
      })
      .catch(() => {});
  }, []);

  // Sync document direction and language code whenever language changes
  useEffect(() => {
    saveLanguage(currentLang);
  }, [currentLang]);

  // «المترجم الذكي»: the language agent's translations for this language load on demand, then one re-render.
  const [, setAiPackTick] = useState(0);
  useEffect(() => {
    let live = true;
    void loadAiPack(currentLang).then((fresh) => { if (fresh && live) setAiPackTick((n) => n + 1); });
    return () => { live = false; };
  }, [currentLang]);

  // Client manually requested a specific language
  const handleSelectLanguage = (lang: SupportedLanguage) => {
    try {
      localStorage.setItem(USER_LANGUAGE_MANUAL_OVERRIDE_KEY, 'true');
    } catch (e) {}
    setCurrentLang(lang);
    saveLanguage(lang);
    const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
    showToast(fmt(L('toast_lang_tpl'), { flag: langInfo?.flag || '', native: langInfo?.nativeName || lang, dir: (langInfo?.dir || 'rtl').toUpperCase() }));
  };

  // Re-run location detection by client request
  const handleAutoDetectLanguage = async () => {
    const geo = await forceRedetectLocation();
    setCurrentLang(geo.detectedLanguage);
    saveLanguage(geo.detectedLanguage);
    showToast(fmt(L('toast_geo_tpl'), { flag: geo.detectedCountry.flag, country: pickArEn(currentLang, geo.detectedCountry.nameAr, geo.detectedCountry.nameEn).split('(')[0], lang: geo.detectedLanguage.toUpperCase() }));
  };

  const handleUpdateEnvironment = (profile: UserEnvironmentProfile) => {
    setCurrentEnvironment(profile);
    setFormulation((prev) => ({
      ...prev,
      concentrationPercent: profile.recommendedConcentrationPercent,
      concentrationType: profile.recommendedConcentrationType,
      fixativePercent: profile.recommendedFixativePercent,
    }));
    setDetailedAddress((prev) => ({
      ...prev,
      countryCode: profile.countryCode,
      countryNameAr: profile.countryNameAr,
      countryNameEn: profile.countryNameEn,
    }));
    showToast(fmt(L('toast_env_tpl'), { flag: profile.countryFlag || '', country: pickArEn(currentLang, profile.countryNameAr, profile.countryNameEn).split('(')[0], currency: profile.currencyCode }));
  };

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.regionId && user.regionId !== currentEnvironment.regionId) {
      handleUpdateEnvironment(getInitialUserEnvironment());
    }
    showToast(fmt(L('toast_welcome_tpl'), { name: user.name }));
  };

  const handleOpenProfilePage = (user: UserProfile) => {
    setProfileUser(user);
    setShowProfilePage(true);
  };

  const handleCloseProfilePage = () => {
    setShowProfilePage(false);
    setProfileUser(null);
  };

  // A community account (signed in from «مجتمع شام») is also the site's account, and signing out there signs out here.
  const communitySession = { me: useSessionPick((x) => x.me), status: useSessionPick((x) => x.status) };
  const syncCommunityUser = useCallback(() => {
    const me = communitySession.me;
    if (!me) return;
    setCurrentUser((prev) => (prev?.id === me.id && prev.name === me.name && prev.avatar === (me.avatar || undefined) ? prev : saveCurrentUserProfile(profileFromMember(me))));
  }, [communitySession.me]);
  useEffect(() => { syncCommunityUser(); }, [syncCommunityUser]);
  useEffect(() => {
    if (communitySession.status === 'guest' && String(currentUser?.id || '').startsWith('u_') && !getSessionToken()) { logoutUser(); setCurrentUser(null); }
  }, [communitySession.status, currentUser?.id]);
  // Learning progress in «بوابتي»: sections the member opens on the site.
  useEffect(() => trackLearning(activeTab, currentLang), [activeTab, currentLang, communitySession.status]);

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    showToast(L('toast_logout'));
  };

  const handleUserDataWiped = () => {
    setCurrentUser(null);
    setSavedFormulas(CURATED_FORMULA_PRESETS);
    showToast(L('toast_wiped'));
  };

  // Save to LocalStorage whenever savedFormulas changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedFormulas));
    } catch (e) {
      console.error('Failed to save to local storage', e);
    }
  }, [savedFormulas]);

  // Perform core formulation calculation
  const calculationResult = calculatePerfumeFormulation(formulation);

  // ===================== INTERACTIVE CHATBOT BRIDGE HANDLERS =====================

  // 1. Transfer chat formula directly to Concentration Calculator
  const handleApplyToConcentrationCalculator = (formula: ExtractedAIPerfume) => {
    setFormulation((prev) => ({
      ...prev,
      bottleVolumeMl: formula.bottleVolumeMl || 50,
      concentrationPercent: formula.concentrationPercent,
      concentrationType: formula.concentrationType,
      // The whole recipe, not only the oil share: alcohol strength, water and fixative too.
      alcoholPercentage: formula.alcoholPercentage || prev.alcoholPercentage,
      waterPercent: formula.waterPercent ?? prev.waterPercent,
      fixativePercent: formula.fixativePercent ?? prev.fixativePercent,
    }));
    setFormulaTitle(formula.title);
    setFormulaAuthor(formula.author);
    setFormulaNotes(formula.summary);
    setMacerationDays(formula.macerationDays);
    if (formula.pyramidNotes && formula.pyramidNotes.length > 0) {
      setPyramidNotes(formula.pyramidNotes);
    }
    navigateToTab('concentration');
    showToast(fmt(L('toast_apply_lab_tpl'), { title: formula.title }));
  };

  // 2. Transfer chat formula directly to Pyramid Calculator
  const handleApplyToPyramidCalculator = (formula: ExtractedAIPerfume) => {
    setFormulation((prev) => ({
      ...prev,
      bottleVolumeMl: formula.bottleVolumeMl || 50,
      concentrationPercent: formula.concentrationPercent,
      concentrationType: formula.concentrationType,
    }));
    setFormulaTitle(formula.title);
    if (formula.pyramidNotes && formula.pyramidNotes.length > 0) {
      setPyramidNotes(formula.pyramidNotes);
    }
    navigateToTab('pyramid');
    showToast(fmt(L('toast_apply_pyramid_tpl'), { title: formula.title }));
  };

  // 3. Record & Save chat formula directly into Recipe Library Notebook
  const handleRecordToRecipeLibrary = (formula: ExtractedAIPerfume) => {
    const newEntry: SavedFormula = {
      id: 'ai-recipe-' + Date.now(),
      title: formula.title,
      author: formula.author || pickArEn(currentLang, 'الخبير شاهين (معمل عطور شام)', 'Master Shahin (Sham Perfume Lab)'),
      dateCreated: new Date().toISOString().split('T')[0],
      batchCode: 'REC-' + Math.floor(Math.random() * 900 + 100),
      notes: formula.summary,
      macerationDays: formula.macerationDays || 35,
      formulation: {
        ...formulation,
        bottleVolumeMl: formula.bottleVolumeMl || 50,
        concentrationPercent: formula.concentrationPercent,
        concentrationType: formula.concentrationType,
      },
      pyramidNotes: formula.pyramidNotes || [...pyramidNotes],
    };

    setSavedFormulas((prev) => [newEntry, ...prev]);
    syncRecipeToAccount(newEntry);
    showToast(fmt(L('toast_saved_lib_tpl'), { title: formula.title }));
  };

  // 4. Transfer to Costing Calculator
  const handleCalculateCosting = (formula: ExtractedAIPerfume) => {
    setFormulation((prev) => ({
      ...prev,
      bottleVolumeMl: formula.bottleVolumeMl || 50,
      concentrationPercent: formula.concentrationPercent,
      concentrationType: formula.concentrationType,
    }));
    setFormulaTitle(formula.title);
    navigateToTab('costing');
    showToast(fmt(L('toast_costing_tpl'), { title: formula.title }));
  };

  // 5. Open Spec Sheet for Chat Formula
  const handlePrintSpecSheetForFormula = (formula: ExtractedAIPerfume) => {
    setFormulation((prev) => ({
      ...prev,
      bottleVolumeMl: formula.bottleVolumeMl || 50,
      concentrationPercent: formula.concentrationPercent,
      concentrationType: formula.concentrationType,
    }));
    setFormulaTitle(formula.title);
    setFormulaAuthor(formula.author);
    setFormulaNotes(formula.summary);
    setMacerationDays(formula.macerationDays);
    if (formula.pyramidNotes && formula.pyramidNotes.length > 0) {
      setPyramidNotes(formula.pyramidNotes);
    }
    handleOpenSpecModal();
  };

  // 6. Any calculator Shaheen linked to his answer, opened with the values from the conversation.
  const TOOL_TABS: Record<ShaheenTool, string> = {
    concentration: 'concentration', pyramid: 'pyramid', maceration: 'maceration_simulator', alcohol: 'alcohol',
    costing: 'costing', raw_materials: 'raw_materials', guide: 'guide', store: 'store',
  };
  const handleOpenShaheenTool = (link: ToolLink) => {
    if (link.tool === 'concentration' || link.tool === 'costing' || link.tool === 'pyramid') {
      setFormulation((prev) => ({
        ...prev,
        ...(link.bottleVolumeMl !== undefined && { bottleVolumeMl: link.bottleVolumeMl }),
        ...(link.concentrationPercent !== undefined && { concentrationPercent: link.concentrationPercent }),
        ...(link.concentrationType && { concentrationType: link.concentrationType }),
        ...(link.alcoholPercentage !== undefined && { alcoholPercentage: link.alcoholPercentage }),
        ...(link.waterPercent !== undefined && { waterPercent: link.waterPercent }),
        ...(link.fixativePercent !== undefined && { fixativePercent: link.fixativePercent }),
      }));
    }
    if (link.macerationDays !== undefined) setMacerationDays(link.macerationDays);
    if (link.tool === 'alcohol') setAlcoholPreset({ from: link.alcoholFrom, to: link.alcoholTo, volume: link.finalVolumeMl, at: Date.now() });
    if (link.tool === 'raw_materials') setMaterialSearch({ text: link.search || '', at: Date.now() });
    if (link.tool === 'store') setStoreQuery(link.search ? { text: link.search, at: Date.now() } : null);
    navigateToTab(TOOL_TABS[link.tool]);
    showToast(link.tool === 'store' ? L('toast_store') : fmt(L('toast_tool_tpl'), { tool: L(`tool_${link.tool}` as 'tool_concentration') }));
  };

  // ===================== LIBRARY & WORLD RECIPES HANDLERS =====================

  const handleLoadFormula = (formula: SavedFormula) => {
    setFormulation(formula.formulation);
    setFormulaTitle(formula.title);
    setFormulaAuthor(formula.author || '');
    setBatchCode(formula.batchCode || '');
    setFormulaNotes(formula.notes || '');
    setMacerationDays(formula.macerationDays || 30);
    setPyramidNotes(formula.pyramidNotes || []);
    navigateToTab('concentration');
    showToast(fmt(L('toast_loaded_lab_tpl'), { title: formula.title }));
  };

  const handleLoadWorldFormula = (recipe: WorldPerfumeRecipe) => {
    setFormulation((prev) => ({
      ...prev,
      concentrationPercent: recipe.targetConcentration,
      concentrationType: recipe.concentrationType,
    }));
    setFormulaTitle(pickArEn(currentLang, recipe.nameAr, recipe.nameEn));
    setFormulaAuthor(recipe.brand);
    setBatchCode('WRLD-' + recipe.id.slice(0, 5).toUpperCase());
    setFormulaNotes(`${recipe.descriptionAr}\n${L('expert_tip_lbl')} ${recipe.compoundingTips}`);
    setMacerationDays(recipe.macerationDays);
    setPyramidNotes(recipe.pyramidNotes);
    navigateToTab('concentration');
    showToast(fmt(L('toast_loaded_world_tpl'), { title: pickArEn(currentLang, recipe.nameAr, recipe.nameEn) }));
  };

  const handlePrintWorldFormula = (recipe: WorldPerfumeRecipe) => {
    setFormulation((prev) => ({
      ...prev,
      concentrationPercent: recipe.targetConcentration,
      concentrationType: recipe.concentrationType,
    }));
    setFormulaTitle(recipe.nameAr);
    setFormulaAuthor(recipe.brand);
    setBatchCode('WRLD-' + recipe.id.slice(0, 5).toUpperCase());
    setFormulaNotes(recipe.descriptionAr);
    setMacerationDays(recipe.macerationDays);
    setPyramidNotes(recipe.pyramidNotes);
    handleOpenSpecModal();
  };

  const handleAddMaterialToPyramid = (note: PyramidNote) => {
    setPyramidNotes((prev) => [...prev, note]);
    showToast(fmt(L('toast_note_added_tpl'), { name: pickArEn(currentLang, note.nameAr, note.nameEn || note.nameAr) }));
  };

  const handleSaveActiveFormula = (e: React.FormEvent) => {
    e.preventDefault();
    const newFormula: SavedFormula = {
      id: 'formula-' + Date.now(),
      title: formulaTitle.trim() || L('default_title'),
      author: formulaAuthor.trim() || L('default_author'),
      dateCreated: new Date().toISOString().split('T')[0],
      batchCode: batchCode.trim() || 'BATCH-' + Math.floor(Math.random() * 900 + 100),
      notes: formulaNotes.trim(),
      macerationDays: macerationDays || 30,
      formulation: { ...formulation },
      pyramidNotes: [...pyramidNotes],
    };

    setSavedFormulas((prev) => [newFormula, ...prev]);
    syncRecipeToAccount(newFormula);
    handleCloseSaveModal();
    showToast(fmt(L('toast_formula_saved_tpl'), { title: newFormula.title }));
  };

  const handleDeleteFormula = (id: string) => {
    setSavedFormulas((prev) => prev.filter((f) => f.id !== id));
    showToast(L('toast_formula_deleted'));
  };

  const handlePrintFormula = (formula: SavedFormula) => {
    setFormulation(formula.formulation);
    setFormulaTitle(formula.title);
    setFormulaAuthor(formula.author || '');
    setBatchCode(formula.batchCode || '');
    setFormulaNotes(formula.notes || '');
    setMacerationDays(formula.macerationDays || 30);
    setPyramidNotes(formula.pyramidNotes);
    handleOpenSpecModal();
  };

  return (
    <LanguageProvider initialLang={currentLang} onLanguageChange={handleSelectLanguage}>
      <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900 selection:bg-amber-200">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 left-6 z-50 bg-stone-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-stone-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={(tab) => navigateToTab(tab)}
          onOpenPrintModal={handleOpenSpecModal}
          currentLang={currentLang}
          onSelectLanguage={handleSelectLanguage}
          onAutoDetectLanguage={handleAutoDetectLanguage}
          currentUser={currentUser}
          onOpenAuthModal={handleOpenAuthModal}
          onLogout={handleLogout}
          currentEnvironment={currentEnvironment}
          onOpenEnvironmentModal={handleOpenEnvironmentModal}
          onOpenPrivacyModal={handleOpenPrivacyModal}
          onOpenProfilePage={() => currentUser && (getSessionToken() ? navigateToTab('community/me') : handleOpenProfilePage(currentUser))}
        />

        {/* Store Promo Hub: promotional banner with store deals */}
        <TopPromoHub
          currentLang={currentLang}
          onViewStore={() => navigateToTab('store')}
        />

        {/* Hero Showcase (only shown when in concentration tab or home) */}
        {activeTab === 'concentration' && (
          <Hero
            onQuickStart={(tab) => {
              navigateToTab(tab);
            }}
            currentLang={currentLang}
          />
        )}

        {/* Main Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-10">
          {/* Universal Navigation Breadcrumbs Bar with Back to Home & Back to Previous */}
          <NavigationBreadcrumbs
            activeTab={activeTab}
            onNavigate={(tab) => navigateToTab(tab)}
            onGoBack={handleGoBack}
            canGoBack={historyStack.length > 1}
            previousTabLabel={
              historyStack.length > 1
                ? historyStack[historyStack.length - 2]
                : undefined
            }
            currentLang={currentLang}
            onOpenPrintModal={handleOpenSpecModal}
          />

          {activeTab === 'home' && (
            <HomeHub
              onNavigate={(tabId) => navigateToTab(tabId)}
              currentLang={currentLang}
              formulation={formulation}
              pyramidNotes={pyramidNotes}
              savedFormulas={savedFormulas}
              currentEnvironment={currentEnvironment}
              detailedAddress={detailedAddress}
              currentUser={currentUser}
              onOpenEnvironmentModal={handleOpenEnvironmentModal}
              onOpenPrivacyModal={handleOpenPrivacyModal}
              onOpenAuthModal={handleOpenAuthModal}
              onOpenSpecModal={handleOpenSpecModal}
            />
          )}

          {activeTab === 'concentration' && (
            <ConcentrationCalculator
              formulation={formulation}
              setFormulation={setFormulation}
              result={calculationResult}
              onSaveFormula={handleOpenSaveModal}
              onSendToCosting={() => navigateToTab('costing')}
              pyramidNotes={pyramidNotes}
              setPyramidNotes={setPyramidNotes}
              onNavigateToTab={(tab) => navigateToTab(tab)}
              currentLang={currentLang}
              currencyCode={currentEnvironment.currencyCode}
              macerationDays={macerationDays}
              setMacerationDays={setMacerationDays}
            />
          )}

        {activeTab === 'perfume_news' && (
          <WorldPerfumeNews
            currentLang={currentLang}
            onApplyNewsNotesToCalculator={handleApplyToConcentrationCalculator}
            onAddNoteToPyramid={handleAddMaterialToPyramid}
          />
        )}

        {activeTab === 'world_perfumes' && (
          <WorldPerfumesLibrary
            currentLang={currentLang}
            onLoadWorldFormula={handleLoadWorldFormula}
            onPrintWorldFormula={handlePrintWorldFormula}
          />
        )}

        {activeTab === 'raw_materials' && (
          <RawMaterialsEncyclopedia
            key={materialSearch?.at ?? 'default'}
            currentLang={currentLang}
            initialSearch={materialSearch?.text}
            onAddMaterialToPyramid={handleAddMaterialToPyramid}
          />
        )}

        {activeTab === 'pyramid' && (
          <PyramidCalculator
            currentLang={currentLang}
            formulation={formulation}
            pyramidNotes={pyramidNotes}
            setPyramidNotes={setPyramidNotes}
            result={calculationResult}
          />
        )}

        {activeTab === 'alcohol' && (
          <AlcoholDilutionCalculator
            key={alcoholPreset?.at ?? 'default'}
            currentLang={currentLang}
            initialFrom={alcoholPreset?.from}
            initialTarget={alcoholPreset?.to}
            initialVolumeMl={alcoholPreset?.volume}
          />
        )}

        {activeTab === 'costing' && (
          <CostCalculator
            currentLang={currentLang}
            formulation={formulation}
            calculationResult={calculationResult}
            currentCurrencyCode={currentEnvironment.currencyCode}
          />
        )}

        {activeTab === 'library' && (
          <FormulaLibrary
            currentLang={currentLang}
            savedFormulas={savedFormulas}
            onLoadFormula={handleLoadFormula}
            onDeleteFormula={handleDeleteFormula}
            onPrintFormula={handlePrintFormula}
          />
        )}

        {activeTab === 'master_ai' && (
          <PerfumerMasterLabView
            currentLang={currentLang}
            onApplyToConcentrationCalculator={handleApplyToConcentrationCalculator}
            onApplyToPyramidCalculator={handleApplyToPyramidCalculator}
            onRecordToRecipeLibrary={handleRecordToRecipeLibrary}
            onCalculateCosting={handleCalculateCosting}
            onPrintSpecSheet={handlePrintSpecSheetForFormula}
            onOpenTool={handleOpenShaheenTool}
          />
        )}

        {activeTab === 'guide' && (
          <AgingAndFixativesGuide
            currentLang={currentLang}
            formulation={formulation}
            onOpenConsultation={(prompt) => {
              window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: prompt }));
            }}
            onNavigateToTab={(tab) => navigateToTab(tab)}
          />
        )}

        {activeTab === 'maceration_simulator' && (
          <div className="space-y-6 animate-in fade-in">
            <MacerationTimeSimulator
              currentLang={currentLang}
              initialStartDate={macerationStartDate}
              initialMacerationDays={macerationDays}
              formulaTitle={formulaTitle}
              batchCode={batchCode}
              onMacerationDaysChange={(days) => setMacerationDays(days)}
              onStartDateChange={(date) => setMacerationStartDate(date)}
              onOpenConsultation={(prompt) => {
                window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: prompt }));
              }}
              onNavigateToTab={(tab) => navigateToTab(tab)}
            />
          </div>
        )}

        {(activeTab === 'community' || activeTab.startsWith('community/')) && (
          <ErrorBoundary key={activeTab} area="community" compact ar={currentLang === 'ar'}>
            <Suspense fallback={<div className="py-24 text-center text-sm text-stone-500">…</div>}>
              <CommunityApp lang={currentLang} route={activeTab.slice('community/'.length)} navigate={navigateToTab} onSignedIn={syncCommunityUser} />
            </Suspense>
          </ErrorBoundary>
        )}

        {activeTab === 'store' && (
          <Storefront
            onClose={() => navigateToTab('home')}
            currentLang={currentLang}
            retailerId={currentUser?.id}
            shaheenQuery={storeQuery}
          />
        )}

        {activeTab === 'productDetail' && productId && (
          <ProductDetail
            productId={productId}
            currentLang={currentLang}
            onClose={() => navigateToTab('store')}
          />
        )}
      </main>

      {/* Floating Interactive Master Perfumer AI Chatbot with Transfer Bridge */}
      <PerfumerAIChatbot
        currentLang={currentLang}
        onApplyToConcentrationCalculator={handleApplyToConcentrationCalculator}
        onApplyToPyramidCalculator={handleApplyToPyramidCalculator}
        onRecordToRecipeLibrary={handleRecordToRecipeLibrary}
        onCalculateCosting={handleCalculateCosting}
        onPrintSpecSheet={handlePrintSpecSheetForFormula}
        onOpenTool={handleOpenShaheenTool}
        hidden={activeTab === 'master_ai'}
      />

      {/* Sham Core services assistant: orders, store, bespoke, B2B, support (opposite corner to Shaheen) */}
      <ShamAssistant currentLang={currentLang} />

      {/* Footer */}
      <Footer
        setActiveTab={(tab) => navigateToTab(tab)}
        currentLang={currentLang}
      />

      {/* Save Formula Modal */}
      {isSaveModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={handleCloseSaveModal}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-stone-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold flex items-center gap-2">
                <BookmarkPlus className="w-4 h-4 text-amber-400" />
                <span>{L('save_modal_title')}</span>
              </span>
              <button
                onClick={handleCloseSaveModal}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveActiveFormula} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-stone-800 block mb-1">
                  {L('lbl_name')}
                </label>
                <input
                  type="text"
                  required
                  value={formulaTitle}
                  onChange={(e) => setFormulaTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-800 block mb-1">
                    {L('lbl_author')}
                  </label>
                  <input
                    type="text"
                    value={formulaAuthor}
                    onChange={(e) => setFormulaAuthor(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-amber-700"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-800 block mb-1">
                    {L('lbl_batch')}
                  </label>
                  <input
                    type="text"
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-800 block mb-1">
                  {L('lbl_maceration')}
                </label>
                <LocalizedNumberInput
                  lang={currentLang}
                  integer
                  min={1}
                  max={365}
                  value={macerationDays}
                  onValue={(n) => setMacerationDays(Math.trunc(n) || 30)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-800 block mb-1">
                  {L('lbl_notes')}
                </label>
                <textarea
                  rows={3}
                  value={formulaNotes}
                  onChange={(e) => setFormulaNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseSaveModal}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg font-medium cursor-pointer"
                >
                  {L('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-semibold rounded-lg shadow-sm cursor-pointer"
                >
                  {L('confirm_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Manufacturing Specification Sheet Modal */}
      {isSpecModalOpen && (
        <ManufacturingSpecSheet
          formulaTitle={formulaTitle}
          author={formulaAuthor}
          batchCode={batchCode}
          notes={formulaNotes}
          macerationDays={macerationDays}
          formulation={formulation}
          pyramidNotes={pyramidNotes}
          calculationResult={calculationResult}
          detailedAddress={detailedAddress}
          currentLang={currentLang}
          onClose={handleCloseSpecModal}
        />
      )}

      {/* User Profile Page */}
      {showProfilePage && profileUser && (
        <UserProfilePage
          user={profileUser}
          currentLang={currentLang}
          isAdmin={false}
          onLogout={handleLogout}
          onClose={handleCloseProfilePage}
        />
      )}

      {/* User Authentication & Account Modal */}
      {isAuthModalOpen && (
        <AuthModal
          currentLang={currentLang}
          onSuccess={handleAuthSuccess}
          onOpenPrivacyPolicy={() => {
            handleCloseAuthModal();
            handleOpenPrivacyModal();
          }}
          onClose={handleCloseAuthModal}
        />
      )}

      {/* World Countries & Detailed Facility Address Modal */}
      {isEnvironmentModalOpen && (
        <CountryAndAddressModal
          currentProfile={currentEnvironment}
          currentAddress={detailedAddress}
          currentUser={currentUser}
          onUpdateProfile={handleUpdateEnvironment}
          onUpdateAddress={(newAddr) => {
            setDetailedAddress(newAddr);
            showToast(fmt(L('toast_addr_saved_tpl'), { name: newAddr.labOrFacilityName || newAddr.city || '' }));
          }}
          onApplyRegionalFormulaToWorkbench={handleApplyToConcentrationCalculator}
          onClose={handleCloseEnvironmentModal}
          currentLang={currentLang}
          onSelectLanguage={handleSelectLanguage}
        />
      )}

      {/* User Data Protection & GDPR Privacy Modal */}
      {isPrivacyModalOpen && (
        <DataPrivacyModal
          currentLang={currentLang}
          currentUser={currentUser}
          onUserDataWiped={handleUserDataWiped}
          onClose={handleClosePrivacyModal}
        />
      )}

      {/* Legal Center — L-08..L-20, L-37 Fix: شامل الشروط والخصوصية وUN1266 وAI */}
      {isLegalCenterOpen && (
        <LegalCenter
          currentLang={currentLang}
          initialTab={legalInitialTab as any}
          onClose={() => {
            activeModalsRef.current.legal = false;
            setIsLegalCenterOpen(false);
          }}
        />
      )}

      {/* Cookie Consent Banner — L-12 Fix: GDPR/ePrivacy consent */}
      <CookieConsent currentLang={currentLang} onOpenPolicy={() => { setLegalInitialTab('cookies'); setIsLegalCenterOpen(true); activeModalsRef.current.legal = true; }} />

      </div>
    </LanguageProvider>
  );
}
