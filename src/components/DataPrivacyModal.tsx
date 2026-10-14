import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Download,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  EyeOff,
  Database,
} from 'lucide-react';
import { UserProfile } from '../types/auth';
import { exportAllUserData, wipeAllUserData } from '../utils/authStorage';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../utils/localizedContent';
import { LText, makeT } from '../utils/localize';


const S = {
  header_title: { ar: 'ميثاق حماية وخصوصية بيانات المستخدم (GDPR Compliance)', en: 'User Data Protection & Privacy Charter (GDPR Compliance)', fr: 'Charte de protection des données (conformité RGPD)', es: 'Carta de protección de datos (cumplimiento GDPR)', it: 'Carta della protezione dei dati (conformità GDPR)', de: 'Datenschutz-Charta (DSGVO-konform)', ru: 'Хартия защиты данных пользователей (GDPR)', zh: '用户数据保护与隐私章程（GDPR 合规）', tr: 'Kullanıcı verisi koruma ve gizlilik şartı (GDPR)', fa: 'منشور حفاظت و حریم خصوصی داده‌های کاربر (GDPR)' },
  header_sub: { ar: 'أمان وسرية خلطاتك العطرية وسجلاتك الرقمية على منصة «صمم عطرك مع شام»', en: 'Security and confidentiality of your fragrance formulas and records on «Design Your Perfume with Sham»', fr: 'Sécurité et confidentialité de vos formules sur « Créez votre parfum avec Sham »', es: 'Seguridad y confidencialidad de tus fórmulas en «Diseña tu perfume con Sham»', it: 'Sicurezza e riservatezza delle tue formule su «Crea il tuo profumo con Sham»', de: 'Sicherheit und Vertraulichkeit Ihrer Formeln auf „Gestalten Sie Ihr Parfüm mit Sham“', ru: 'Безопасность и конфиденциальность ваших формул на «Создайте свой аромат с Sham»', zh: '「与 Sham 一同设计香水」上配方与记录的安全与保密', tr: '«Parfümünüzü Sham ile tasarlayın» üzerinde formüllerinizin güvenliği ve gizliliği', fa: 'امنیت و محرمانگی فرمول‌های عطری و سوابق شما در «عطر خود را با شام بسازید»' },
  p1_title: { ar: '1. التشفير المحلي للخلطات والأسرار', en: '1. Local Encryption of Formulas & Secrets', fr: '1. Chiffrement local des formules', es: '1. Cifrado local de fórmulas', it: '1. Crittografia locale delle formule', de: '1. Lokale Verschlüsselung der Formeln', ru: '1. Локальное шифрование формул', zh: '1. 配方与机密的本地加密', tr: '1. Formüllerin yerel şifrelenmesi', fa: '1. رمزنگاری محلی فرمول‌ها و اسرار' },
  p1_p: { ar: 'جميع وصفاتك، أكورداتك العطرية، ومحادثات المعمل مع الخبير شاهين تخزن بتشفير آمن على متصفحك ولا تُشارك مع أي طرف إعلاني.', en: 'All your recipes, fragrance accords, and lab chats with Master Shahin are stored securely encrypted in your browser and never shared with advertisers.', fr: 'Recettes, accords et conversations avec le Maître Shahin sont chiffrés dans votre navigateur et jamais partagés avec des annonceurs.', es: 'Tus recetas, acordes y conversaciones con el Maestro Shahin se cifran en tu navegador y nunca se comparten con anunciantes.', it: 'Ricette, accordi e conversazioni con il Maestro Shahin sono cifrati nel browser e mai condivisi con inserzionisti.', de: 'Rezepte, Akkorde und Chats mit Meister Shahin werden verschlüsselt im Browser gespeichert und nie an Werbetreibende weitergegeben.', ru: 'Все рецепты, аккорды и переписка с мастером Шахином хранятся в зашифрованном виде в браузере и не передаются рекламодателям.', zh: '您的所有配方、香调与 Shahin 大师的对话均加密存储于浏览器，绝不与广告方共享。', tr: 'Tüm tarifleriniz, akorlarınız ve Usta Shahin ile sohbetleriniz tarayıcınızda şifreli saklanır, reklamcılarla paylaşılmaz.', fa: 'همه دستورها، آکوردها و گفتگوهای شما با استاد شاهین به‌صورت رمزگذاری‌شده در مرورگر ذخیره می‌شوند و با هیچ تبلیغ‌کننده‌ای به اشتراک گذاشته نمی‌شوند.' },
  p2_title: { ar: '2. سياسة عدم التتبع (Zero Trackers)', en: '2. Zero-Tracker Policy', fr: '2. Politique zéro traceur', es: '2. Política sin rastreadores', it: '2. Politica zero tracker', de: '2. Null-Tracker-Richtlinie', ru: '2. Политика нулевого трекинга', zh: '2. 零追踪政策', tr: '2. Sıfır izleyici politikası', fa: '2. سیاست بدون ردیابی' },
  p2_p: { ar: 'الموقع لا يحتوي على أي ملفات تعريف ارتباط (Cookies) تجسسية أو بكسلات تتبع خارجية. خصوصيتك الفنية مضمونة 100%.', en: 'The site contains no spy cookies or external tracking pixels. Your creative privacy is 100% guaranteed.', fr: 'Aucun cookie espion ni pixel de suivi externe. Votre vie créative est garantie à 100 %.', es: 'Sin cookies espía ni píxeles de rastreo externos. Tu privacidad creativa está garantizada al 100%.', it: 'Nessun cookie spia né pixel di tracciamento esterni. La tua privacy creativa è garantita al 100%.', de: 'Keine Spionage-Cookies oder externen Tracking-Pixel. Ihre kreative Privatsphäre ist zu 100 % garantiert.', ru: 'Никаких шпионских cookie или внешних трекеров. Ваше творческое приватность гарантирована на 100%.', zh: '网站不含间谍 Cookie 或外部追踪像素，100% 保障您的创作隐私。', tr: 'Casus çerez veya harici izleme pikseli yoktur. Yaratıcı gizliliğiniz %100 garantidir.', fa: 'این سایت هیچ کوکی جاسوسی یا پیکسل ردیابی خارجی ندارد. حریم خصوصی هنری شما ۱۰۰٪ تضمین شده است.' },
  p3_title: { ar: '3. حق نقل البيانات (Data Portability)', en: '3. Data Portability Right', fr: '3. Droit à la portabilité des données', es: '3. Derecho a la portabilidad de datos', it: '3. Diritto alla portabilità dei dati', de: '3. Recht auf Datenübertragbarkeit', ru: '3. Право на переносимость данных', zh: '3. 数据可携权', tr: '3. Veri taşınabilirliği hakkı', fa: '3. حق انتقال داده‌ها' },
  p3_p: { ar: 'يحق لك في أي لحظة تنزيل نسخة رقمية كاملة من جميع وصفاتك المحفوظة ومحادثاتك بصيغة ملف JSON معتمد.', en: 'You may at any time download a complete digital copy of all your saved recipes and chats as a standard JSON file.', fr: 'Vous pouvez à tout moment télécharger une copie numérique complète de vos recettes et conversations au format JSON.', es: 'Puedes descargar en cualquier momento una copia digital completa de tus recetas y conversaciones en formato JSON.', it: 'Puoi scaricare in ogni momento una copia digitale completa di ricette e conversazioni in formato JSON.', de: 'Sie können jederzeit eine vollständige digitale Kopie Ihrer Rezepte und Chats als JSON-Datei herunterladen.', ru: 'Вы можете в любой момент скачать полную цифровую копию рецептов и переписки в формате JSON.', zh: '您可随时以标准 JSON 文件下载所有已保存配方与对话的完整副本。', tr: 'Kayıtlı tariflerinizi ve sohbetlerinizi istediğiniz an standart JSON dosyası olarak indirebilirsiniz.', fa: 'می‌توانید در هر لحظه نسخه دیجیتال کامل همه دستورها و گفتگوهای خود را به‌صورت فایل JSON استاندارد دانلود کنید.' },
  p4_title: { ar: '4. حق النسيان والمسح النهائي', en: '4. Right to be Forgotten & Final Erasure', fr: '4. Droit à l’effacement définitif', es: '4. Derecho al olvido y borrado definitivo', it: '4. Diritto all’oblio e cancellazione definitiva', de: '4. Recht auf Vergessenwerden & endgültige Löschung', ru: '4. Право на забвение и окончательное стирание', zh: '4. 被遗忘权与最终清除', tr: '4. Unutulma ve kesin silme hakkı', fa: '4. حق فراموشی و حذف نهایی' },
  p4_p: { ar: 'بضغطة زر واحدة يمكنك إتلاف ومسح كافة بياناتك وسجلاتك وخلطاتك نهائياً دون إبقاء أي نسخة في السجلات.', en: 'With one tap you can permanently destroy and erase all your data, records, and formulas without leaving any residual copy.', fr: 'D’un seul clic, détruisez et effacez définitivement toutes vos données sans laisser de copie résiduelle.', es: 'Con un toque destruye y borra definitivamente todos tus datos sin dejar copia residual.', it: 'Con un tocco distruggi e cancelli definitivamente tutti i tuoi dati senza lasciare copie residue.', de: 'Mit einem Klick löschen Sie alle Daten endgültig, ohne Restkopien zu hinterlassen.', ru: 'Одним нажатием вы безвозвратно уничтожаете все данные, не оставляя копий.', zh: '一键永久销毁并清除您的所有数据、记录与配方，不留任何副本。', tr: 'Tek dokunuşla tüm verilerinizi kalıcı olarak siler, hiçbir kopya bırakmazsınız.', fa: 'با یک لمس می‌توانید همه داده‌ها، سوابق و فرمول‌های خود را برای همیشه نابود و پاک کنید، بدون باقی‌ماندن هیچ نسخه‌ای.' },
  panel_title: { ar: 'لوحة التحكم ببيانات المستخدم الحالية:', en: 'Current User Data Control Panel:', fr: 'Panneau de contrôle des données :', es: 'Panel de control de datos del usuario:', it: 'Pannello di controllo dei dati:', de: 'Datenschutz-Steuerungsfeld:', ru: 'Панель управления данными:', zh: '当前用户数据控制面板：', tr: 'Kullanıcı veri kontrol paneli:', fa: 'پنل کنترل داده‌های کاربر:' },
  export_title: { ar: 'تصدير وحفظ نسخة احتياطية من الخلطات والملف الشخصي', en: 'Export & back up formulas and profile', fr: 'Exporter et sauvegarder formules et profil', es: 'Exportar y respaldar fórmulas y perfil', it: 'Esporta e salva formule e profilo', de: 'Formeln und Profil exportieren & sichern', ru: 'Экспорт и резервное копирование формул и профиля', zh: '导出并备份配方与个人资料', tr: 'Formülleri ve profili dışa aktar ve yedekle', fa: 'خروجی و پشتیبان‌گیری از فرمول‌ها و نمایه' },
  export_sub: { ar: 'تنزيل ملف JSON يحتوي على سجل التشغيلات، نسب الهرم، ومحادثات المعمل', en: 'Download a JSON file with batch history, pyramid ratios, and lab chats', fr: 'Téléchargez un JSON avec l’historique, les ratios et les conversations', es: 'Descarga un JSON con historial, ratios de la pirámide y conversaciones', it: 'Scarica un JSON con cronologia, rapporti della piramide e conversazioni', de: 'JSON mit Chargenverlauf, Pyramidenverhältnissen und Chats herunterladen', ru: 'Скачайте JSON с историей партий, долями пирамиды и перепиской', zh: '下载包含批次记录、金字塔配比与对话的 JSON 文件', tr: 'Parti geçmişi, piramit oranları ve sohbetleri içeren JSON indirin', fa: 'دانلود فایل JSON شامل سوابق، نسبت‌های هرم و گفتگوها' },
  export_ok: { ar: 'تم التصدير بنجاح!', en: 'Exported Successfully!', fr: 'Exporté avec succès !', es: '¡Exportado con éxito!', it: 'Esportato con successo!', de: 'Erfolgreich exportiert!', ru: 'Экспорт выполнен!', zh: '导出成功！', tr: 'Başarıyla dışa aktarıldı!', fa: 'خروجی با موفقیت گرفته شد!' },
  export_btn: { ar: 'تصدير بياناتي (JSON)', en: 'Export My Data (JSON)', fr: 'Exporter mes données (JSON)', es: 'Exportar mis datos (JSON)', it: 'Esporta i miei dati (JSON)', de: 'Meine Daten exportieren (JSON)', ru: 'Экспортировать данные (JSON)', zh: '导出我的数据（JSON）', tr: 'Verilerimi dışa aktar (JSON)', fa: 'خروجی داده‌های من (JSON)' },
  wipe_title: { ar: 'المسح النهائي لكافة البيانات (Right to be Forgotten)', en: 'Final Erasure of All Data (Right to be Forgotten)', fr: 'Effacement définitif de toutes les données (droit à l’oubli)', es: 'Borrado definitivo de todos los datos (derecho al olvido)', it: 'Cancellazione definitiva di tutti i dati (diritto all’oblio)', de: 'Endgültige Löschung aller Daten (Recht auf Vergessenwerden)', ru: 'Окончательное стирание всех данных (право на забвение)', zh: '彻底清除所有数据（被遗忘权）', tr: 'Tüm verilerin kalıcı silinmesi (unutulma hakkı)', fa: 'حذف نهایی همه داده‌ها (حق فراموشی)' },
  wipe_sub: { ar: 'حذف كافة الخلطات وسجل الدخول والمحادثات نهائياً من هذا الجهاز', en: 'Permanently delete all formulas, login history, and chats from this device', fr: 'Supprimer définitivement formules, connexions et conversations de cet appareil', es: 'Eliminar para siempre fórmulas, inicios de sesión y conversaciones de este dispositivo', it: 'Elimina per sempre formule, accessi e conversazioni da questo dispositivo', de: 'Formeln, Anmeldungen und Chats endgültig von diesem Gerät löschen', ru: 'Безвозвратно удалить формулы, историю входа и переписку с этого устройства', zh: '从此设备永久删除所有配方、登录记录与对话', tr: 'Formülleri, oturum geçmişini ve sohbetleri bu cihazdan kalıcı olarak sil', fa: 'حذف دائمی همه فرمول‌ها، سوابق ورود و گفتگوها از این دستگاه' },
  cancel: { ar: 'تراجع', en: 'Cancel', fr: 'Annuler', es: 'Cancelar', it: 'Annulla', de: 'Abbrechen', ru: 'Отмена', zh: '取消', tr: 'Vazgeç', fa: 'انصراف' },
  confirm_wipe: { ar: 'تأكيد المسح الشامل', en: 'Confirm Full Wipe', fr: 'Confirmer l’effacement total', es: 'Confirmar borrado total', it: 'Conferma cancellazione totale', de: 'Vollständige Löschung bestätigen', ru: 'Подтвердить полное стирание', zh: '确认全部清除', tr: 'Tam silmeyi onayla', fa: 'تأیید پاک‌سازی کامل' },
  wipe_btn: { ar: 'مسح جميع بياناتي', en: 'Wipe All My Data', fr: 'Effacer toutes mes données', es: 'Borrar todos mis datos', it: 'Cancella tutti i miei dati', de: 'Alle meine Daten löschen', ru: 'Стереть все мои данные', zh: '清除我的所有数据', tr: 'Tüm verilerimi sil', fa: 'پاک‌کردن همه داده‌های من' },
  footer_note: { ar: 'تتوافق معايير الأمان مع اللائحة العامة لحماية البيانات (GDPR Art. 17 & 20).', en: 'Security standards comply with the General Data Protection Regulation (GDPR Art. 17 & 20).', fr: 'Conformité au RGPD (articles 17 et 20).', es: 'Cumplimiento del RGPD (artículos 17 y 20).', it: 'Conformità al GDPR (artt. 17 e 20).', de: 'DSGVO-konform (Art. 17 & 20).', ru: 'Соответствие GDPR (статьи 17 и 20).', zh: '安全标准符合 GDPR（第 17 与 20 条）。', tr: 'KVKK/GDPR uyumlu (madde 17 & 20).', fa: 'استانداردهای امنیتی مطابق GDPR (مواد ۱۷ و ۲۰) است.' },
  close: { ar: 'إغلاق', en: 'Close', fr: 'Fermer', es: 'Cerrar', it: 'Chiudi', de: 'Schließen', ru: 'Закрыть', zh: '关闭', tr: 'Kapat', fa: 'بستن' },
} satisfies Record<string, LText>;

interface DataPrivacyModalProps {
  currentLang?: SupportedLanguage;
  currentUser: UserProfile | null;
  onUserDataWiped: () => void;
  onClose: () => void;
}

export const DataPrivacyModal: React.FC<DataPrivacyModalProps> = ({
  currentLang = 'ar',
  currentUser,
  onUserDataWiped,
  onClose,
}) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = () => {
    if (currentUser) {
      exportAllUserData(currentUser);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    }
  };

  const handleWipe = () => {
    wipeAllUserData();
    onUserDataWiped();
    onClose();
  };

  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-serif-luxury">
                {L('header_title')}
              </h3>
              <p className="text-xs text-stone-300">
                {L('header_sub')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6 text-xs sm:text-sm text-stone-700 leading-relaxed">
          
          {/* Highlights 4 Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="font-bold text-stone-900 flex items-center gap-2 text-xs">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>{L('p1_title')}</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-normal">
                {L('p1_p')}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="font-bold text-stone-900 flex items-center gap-2 text-xs">
                <EyeOff className="w-4 h-4 text-emerald-700" />
                <span>{L('p2_title')}</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-normal">
                {L('p2_p')}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="font-bold text-stone-900 flex items-center gap-2 text-xs">
                <Download className="w-4 h-4 text-blue-700" />
                <span>{L('p3_title')}</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-normal">
                {L('p3_p')}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="font-bold text-stone-900 flex items-center gap-2 text-xs">
                <Trash2 className="w-4 h-4 text-red-700" />
                <span>{L('p4_title')}</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-normal">
                {L('p4_p')}
              </p>
            </div>
          </div>

          {/* User Actions */}
          <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-4">
            <div className="font-bold text-amber-900 text-xs">
              {L('panel_title')}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div>
                <div className="font-semibold text-stone-900 text-xs">
                  {L('export_title')}
                </div>
                <div className="text-[11px] text-stone-500">
                  {L('export_sub')}
                </div>
              </div>

              <button
                onClick={handleExport}
                className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer"
              >
                {exportSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{L('export_ok')}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>{L('export_btn')}</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-3 border-t border-amber-200/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-red-900 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>{L('wipe_title')}</span>
                </div>
                <div className="text-[11px] text-stone-500">
                  {L('wipe_sub')}
                </div>
              </div>

              {confirmWipe ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmWipe(false)}
                    className="px-3 py-2 rounded-xl bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer"
                  >
                    {L('cancel')}
                  </button>
                  <button
                    onClick={handleWipe}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    {L('confirm_wipe')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmWipe(true)}
                  className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold transition-all shrink-0 cursor-pointer"
                >
                  {L('wipe_btn')}
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">
            {L('footer_note')}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold cursor-pointer"
          >
            {L('close')}
          </button>
        </div>

      </div>
    </div>
  );
};
