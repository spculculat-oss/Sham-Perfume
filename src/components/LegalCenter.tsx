import React, { useState } from 'react';
import { Shield, FileText, Truck, RefreshCw, Cookie, AlertTriangle, Scale, Mail, X, ExternalLink, CheckCircle2 } from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { LText, makeT } from '../لغات/localize';
import { LEGAL_FINDINGS, auditPlatform, complianceStats } from '../legal/legalExpert';

/**
 * المركز القانوني للمنصة — Legal Center
 * يعرض كل السياسات القانونية المطلوبة في مكان واحد
 * يُربط من Footer وAuthModal وCheckout
 * يستوفي متطلبات: مصر 181/2018، السعودية E-Commerce، GDPR، DSA، EU Consumer
 */

interface LegalCenterProps {
  currentLang?: SupportedLanguage;
  onClose?: () => void;
  initialTab?: LegalTab;
}

type LegalTab = 'overview' | 'terms' | 'privacy' | 'returns' | 'shipping' | 'cookies' | 'ai' | 'contact';

const S: Record<string, LText> = {
  title: {
    ar: 'المركز القانوني — منصة شام',
    en: 'Legal Center — Sham Platform',
    fr: 'Centre juridique — Sham',
    es: 'Centro legal — Sham',
    de: 'Rechtszentrum — Sham',
  },
  subtitle: {
    ar: 'كل حقوقك وشروط الاستخدام في مكان واحد — شفافية 100%',
    en: 'All your rights & terms in one place — 100% transparency',
    fr: 'Tous vos droits et conditions en un seul endroit',
    es: 'Todos tus derechos y condiciones en un solo lugar',
    de: 'Alle Rechte & Bedingungen an einem Ort',
  },
  tab_overview: { ar: 'نظرة عامة', en: 'Overview', fr: 'Aperçu', es: 'Resumen', de: 'Überblick' },
  tab_terms: { ar: 'الشروط والأحكام', en: 'Terms of Service', fr: 'Conditions', es: 'Términos', de: 'AGB' },
  tab_privacy: { ar: 'سياسة الخصوصية', en: 'Privacy Policy', fr: 'Confidentialité', es: 'Privacidad', de: 'Datenschutz' },
  tab_returns: { ar: 'الإرجاع والاسترداد', en: 'Returns & Refunds', fr: 'Retours', es: 'Devoluciones', de: 'Rückgaben' },
  tab_shipping: { ar: 'الشحن والمواد الخطرة', en: 'Shipping & DG', fr: 'Livraison', es: 'Envío', de: 'Versand' },
  tab_cookies: { ar: 'الكوكيز والتتبع', en: 'Cookies & Tracking', fr: 'Cookies', es: 'Cookies', de: 'Cookies' },
  tab_ai: { ar: 'الذكاء الاصطناعي', en: 'AI Disclosure', fr: 'IA', es: 'IA', de: 'KI' },
  tab_contact: { ar: 'اتصل بنا قانونيًا', en: 'Legal Contact', fr: 'Contact juridique', es: 'Contacto legal', de: 'Rechtskontakt' },
  score_label: { ar: 'نقاط الامتثال القانوني', en: 'Legal Compliance Score', fr: 'Score de conformité', es: 'Puntuación legal', de: 'Compliance-Score' },
  last_audit: { ar: 'آخر تدقيق:', en: 'Last audit:', fr: 'Dernier audit :', es: 'Última auditoría:', de: 'Letzte Prüfung:' },
};

const TAB_ICON: Record<LegalTab, React.ReactNode> = {
  overview: <Shield className="w-4 h-4" />,
  terms: <FileText className="w-4 h-4" />,
  privacy: <Shield className="w-4 h-4" />,
  returns: <RefreshCw className="w-4 h-4" />,
  shipping: <Truck className="w-4 h-4" />,
  cookies: <Cookie className="w-4 h-4" />,
  ai: <AlertTriangle className="w-4 h-4" />,
  contact: <Mail className="w-4 h-4" />,
};

export const LegalCenter: React.FC<LegalCenterProps> = ({ currentLang = 'ar', onClose, initialTab = 'overview' }) => {
  const rtl = isRTL(currentLang);
  const T = makeT(currentLang, S);
  const [tab, setTab] = useState<LegalTab>(initialTab);
  const stats = complianceStats();
  const audit = auditPlatform();

  const TABS: { id: LegalTab; labelKey: string }[] = [
    { id: 'overview', labelKey: 'tab_overview' },
    { id: 'terms', labelKey: 'tab_terms' },
    { id: 'privacy', labelKey: 'tab_privacy' },
    { id: 'returns', labelKey: 'tab_returns' },
    { id: 'shipping', labelKey: 'tab_shipping' },
    { id: 'cookies', labelKey: 'tab_cookies' },
    { id: 'ai', labelKey: 'tab_ai' },
    { id: 'contact', labelKey: 'tab_contact' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 text-white p-5 sm:p-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Scale className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">{T('title')}</h2>
              <p className="text-xs text-stone-300">{T('subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 bg-stone-100 overflow-x-auto border-b border-stone-200 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                tab === t.id ? 'bg-stone-900 text-white shadow' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
              }`}
            >
              {TAB_ICON[t.id]}
              {T(t.labelKey)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs sm:text-sm leading-relaxed text-stone-700 space-y-4">
          {tab === 'overview' && <OverviewTab stats={stats} audit={audit} currentLang={currentLang} />}
          {tab === 'terms' && <TermsTab currentLang={currentLang} />}
          {tab === 'privacy' && <PrivacyTab currentLang={currentLang} />}
          {tab === 'returns' && <ReturnsTab currentLang={currentLang} />}
          {tab === 'shipping' && <ShippingTab currentLang={currentLang} />}
          {tab === 'cookies' && <CookiesTab currentLang={currentLang} />}
          {tab === 'ai' && <AiTab currentLang={currentLang} />}
          {tab === 'contact' && <ContactTab currentLang={currentLang} />}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-stone-500 shrink-0">
          <span>© 2026 Sham Perfume — {T('last_audit')} 18 Oct 2026 — {stats.score}/100 {T('score_label')}</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            المرجع القانوني: النص العربي هو الحاكم عند التعارض
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Tabs ──────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ stats: ReturnType<typeof complianceStats>; audit: ReturnType<typeof auditPlatform>; currentLang: SupportedLanguage }> = ({ stats }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard label="الامتثال" value={`${stats.score}/100`} color={stats.score >= 80 ? 'emerald' : stats.score >= 50 ? 'amber' : 'red'} />
      <StatCard label="حرجة" value={String(stats.critical)} color="red" />
      <StatCard label="عالية" value={String(stats.high)} color="orange" />
      <StatCard label="قوانين مغطاة" value={String(stats.lawsCovered)} color="stone" />
    </div>
    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
      <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> تنبيه لشاهين
      </h3>
      <p className="text-stone-700 leading-relaxed">
        هذا المركز يعرض السياسات للمستخدمين. التقرير الكامل للخبير القانوني (37 مشكلة + خطط إصلاح) موجود في{' '}
        <code className="bg-white px-1.5 py-0.5 rounded text-[11px]">docs/legal/التقرير-القانوني-الشامل-شام-بيرفيوم-2026.md</code>
        . راجع التبويبات التالية للنصوص الجاهزة للنشر.
      </p>
    </div>
    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
      <h3 className="font-bold text-stone-900 mb-2">التزاماتنا القانونية</h3>
      <ul className="list-disc ps-5 space-y-1 text-stone-600">
        <li>نلتزم بقوانين مصر (151/2020، 181/2018)، السعودية (PDPL، التجارة الإلكترونية)، الإمارات (45/2021)، الاتحاد الأوروبي (GDPR، AI Act، DSA)، وأمريكا (CCPA، COPPA، FDA).</li>
        <li>لا نبيع بياناتك. لا نشارك خلطاتك مع معلنين. كل معالجة بموافقة صريحة قابلة للسحب.</li>
        <li>لدينا خطة إخطار اختراق 72 ساعة، وDPO، وسجل معالجة، وتقييم أثر DPIA.</li>
        <li>التقرير يُحدّث تلقائيًا عبر الخبير القانوني الذكي (<code>src/legal/legalExpert.ts</code>).</li>
      </ul>
    </div>
  </div>
);

const TermsTab: React.FC<{ currentLang: SupportedLanguage }> = () => (
  <div className="space-y-3">
    <h3 className="font-bold text-stone-900 text-sm">الشروط والأحكام — مسودة للنشر (يجب مراجعة محامٍ)</h3>
    <Section title="1. من نحن" body="منصة «صمم عطرك مع شام» (Sham Perfume) — منصة وسيطة تربط مصممي العطور بالتجار. السجل التجاري: [يُعبأ]، الرقم الضريبي: [يُعبأ]، العنوان: [يُعبأ]، البريد: legal@sham-perfume.com. المنصة مسجلة في مصر وتخدم عملاء عالميًا." />
    <Section title="2. قبول الشروط" body="بإنشاء حساب أو استخدام الحاسبات/المتجر/شاهين، تقر بأنك قرأت هذه الشروط وسياسة الخصوصية ووافقت عليهما. إذا كنت أقل من 16 سنة (أوروبا) أو 13 سنة (أمريكا) فلا تستخدم المنصة. عند التعارض بين الترجمات، النص العربي هو الحاكم." />
    <Section title="3. الحسابات" body="يجب تقديم بيانات صحيحة. أنت مسؤول عن سرية كلمة مرورك. نحتفظ بحق تعليق الحساب عند انتحال/إساءة/خرق. كلمات المرور مشفرة ولا تُخزن في المتصفح." />
    <Section title="4. المتجر والوساطة" body="المنصة وسيط فقط، ليست بائعًا. الأسعار تشمل هامش المنصة (25% افتراضي) + شحن + ضريبة VAT حسب بلدك + رسوم جمركية تقديرية (يتحملها المشتري). الفاتورة تُصدر إلكترونيًا وفق قوانين بلدك (مصر EDA، السعودية ZATCA). التجار يخضعون لـ KYC." />
    <Section title="5. الملكية الفكرية" body="كل المحتوى الأصلي (حاسبات، مقالات، صور شام) © شام. ذكر علامات مثل Dior/Lattafa هو للوصف المقارن فقط وليس انتسابًا. لا تنسخ وصفات/صور بدون إذن. نحترم DMCA ونزيل المحتوى المنتهك خلال 48 ساعة." />
    <Section title="6. حاسبات العطور — إخلاء مسؤولية" body="الحاسبات تعليمية فقط، ليست نصيحة طبية/كيميائية. التزم بمعايير IFRA وREACH/CLP واختبر على الجلد (Patch Test). بعض المواد قد تسبب حساسية (Citral, Limonene...). استخدم قفازات/نظارات، احفظ بعيدًا عن الأطفال، لا تتناول. المنصة غير مسؤولة عن إساءة الاستخدام." />
    <Section title="7. الذكاء الاصطناعي (شاهين)" body="ردود شاهين مولدة بالذكاء الاصطناعي، قد تحوي أخطاء. ليست بديلاً عن استشارة خبير عطور مرخص/صيدلي/طبيب جلدية. كل رد موسوم 'مولد بالذكاء الاصطناعي'. نحتفظ بسجل تدقيق ولا ننسب ردًا لخبير بشري." />
    <Section title="8. الإرجاع والضمان (ملخص)" body="14 يوم حق انسحاب للبيع عن بعد (EU) إذا الختم سليم. لا إرجاع لعطور مفتوحة/مخصصة لأسباب صحية. السعودية 7 أيام، مصر 14 يوم + 30 يوم عيب. الاسترداد خلال 14 يوم بنفس وسيلة الدفع." />
    <Section title="9. الشحن والمواد الخطرة" body="العطور سائل قابل للاشتعال UN1266 Class 3. شحن جوي محدود (IATA DGR). العميل يتحمل مسؤولية الامتثال الجمركي/الاستيرادي في بلده. قد تُحجز شحنة لمواد مقيدة (عود CITES). التأخير بسبب جمارك ليس مسؤوليتنا." />
    <Section title="10. تحديد المسؤولية" body="المنصة تُقدم 'كما هي'. لا نضمن دقة الحاسبات/AI. مسؤوليتنا القصوى لا تتجاوز ما دفعته خلال 12 شهرًا. لا مسؤولية عن أضرار غير مباشرة. لا يمس حقك كمستهلك في الضمان القانوني." />
    <Section title="11. القانون الواجب التطبيق وحل النزاعات" body="تخضع هذه الشروط للقانون المصري. أي نزاع يُحل وديًا خلال 30 يومًا، ثم تحكيم مركز القاهرة الإقليمي CRCICA (لغة عربية، مقر القاهرة). للمستهلك الأوروبي: يحتفظ بحقه في محاكم بلده. للسعودية: يمكنك الشكوى عبر معروف (maroof.sa)." />
    <Section title="12. التغييرات" body="قد نحدث الشروط بإشعار 30 يومًا عبر البريد/الموقع. استمرار الاستخدام بعد التحديث = موافقة. سجل التغييرات في docs/legal/CHANGELOG.md." />
    <p className="text-[11px] text-stone-500 mt-2">⚠️ مسودة معلوماتية — يجب مراجعة محامٍ مرخص قبل النشر.</p>
  </div>
);

const PrivacyTab: React.FC<{ currentLang: SupportedLanguage }> = () => (
  <div className="space-y-3">
    <h3 className="font-bold text-stone-900 text-sm">سياسة الخصوصية — مسودة GDPR/PDPL</h3>
    <Section title="من نحن (Controller)" body="شام بيرفيوم، البريد: privacy@sham-perfume.com، DPO: dpo@sham-perfume.com، العنوان: [يُعبأ]. نمثل معالج البيانات لكل خدمات المنصة." />
    <Section title="ما نجمعه" body="• حساب: اسم، بريد، هاتف، بلد، تاريخ ميلاد، مستوى حرفي. • طلبات: عنوان شحن، منتجات، دفع (لا نخزن بطاقات، نستخدم بوابة مرخصة). • تقني: IP، نوع متصفح، سجلات استخدام (لأمن/تحسين). • محتوى: وصفات، محادثات شاهين، منشورات مجتمع (اختياري). • موقع: فقط إذا وافقت (للشحن/الضرائب)." />
    <Section title="لماذا (الأساس القانوني GDPR Art.6)" body="• تنفيذ عقد (إنشاء حساب، تنفيذ طلب) • موافقة صريحة (تسويق، كوكيز تحليلية) • مصلحة مشروعة (أمن، منع احتيال) • التزام قانوني (فواتير 7 سنوات، ضرائب) • لا نعالج بيانات حساسة (صحة/دين) بدون موافقة صريحة منفصلة." />
    <Section title="كم نحتفظ" body="• حساب: حتى تحذفه + 5 سنوات للأرشيف القانوني • طلبات/فواتير: 7 سنوات ضريبيًا • محادثات: 1 سنة ثم حذف تلقائي (يمكنك المسح فورًا) • سجلات أمن: 1 سنة • بعد الحذف: إخفاء هوية أو مسح كامل خلال 30 يومًا." />
    <Section title="مع من نشارك" body="• معالجات: Vercel (استضافة أمريكا، SCCs)، Firebase/Firestore (تخزين)، بوابة دفع (Paymob/Stripe)، شحن (DHL...). لدينا DPA مع كل معالج. • تجار: فقط بيانات الطلب اللازمة. • سلطات: إذا أمر قضائي/التزام قانوني. • لا نبيع بياناتك أبدًا." />
    <Section title="حقوقك (GDPR 15-22، مصر 151، SA PDPL)" body="لك حق: الوصول، التصحيح، المسح (النسيان)، التقييد، النقل (JSON)، الاعتراض، سحب الموافقة، عدم الخضوع لقرار آلي. اطلب عبر privacy@sham-perfume.com أو زر 'تصدير/مسح بياناتي' في DataPrivacyModal. نرد خلال 30 يومًا (GDPR) / 30 يومًا (SA PDPL)." />
    <Section title="النقل الدولي" body="بياناتك قد تُعالج خارج بلدك (Vercel أمريكا). نستخدم ضمانات: SCCs (EU)، تقييم أثر نقل، تشفير. للسعودية: نقل بموافقة + ضمانات كافية." />
    <Section title="الأطفال" body="لا نجمع عمدًا بيانات <13 سنة (COPPA). إذا اكتشفنا حساب طفل بدون موافقة والدين نحذفه. 13-16 سنة (EU) يتطلب موافقة ولي." />
    <Section title="الأمن والخرق" body="تشفير AES-256، TLS 1.3، HSTS، CSP، WAF. كلمات مرور مشفرة Argon2 + HttpOnly cookies. إذا حدث خرق يمسك، نخطر السلطة خلال 72 ساعة ونخطرك إذا خطر عالٍ." />
    <Section title="الشكاوى" body="راسل DPO أولًا. لك حق الشكوى لدى: مصر (جهاز حماية البيانات)، السعودية (SDAIA)، الإمارات (UAE Data Office)، EU (سلطة بلدك)، كاليفورنيا (AG)." />
    <p className="text-[11px] text-stone-500">آخر تحديث: 18 Oct 2026 — الإصدار 1.0 — المرجع: النص العربي</p>
  </div>
);

const ReturnsTab: React.FC<{ currentLang: SupportedLanguage }> = () => (
  <div className="space-y-3">
    <h3 className="font-bold text-stone-900">سياسة الإرجاع والاسترداد</h3>
    <Section title="المدد القانونية" body="• مصر: 14 يوم حق عدول بدون سبب (عن بعد) + 30 يوم عيب (181/2018) • السعودية: 7 أيام (نظام التجارة الإلكترونية) • الإمارات: حسب العقد + لجنة فض منازعات • الاتحاد الأوروبي: 14 يوم انسحاب بدون سبب (2011/83) — للعطور المختومة المفتوحة استثناء صحي: لا إرجاع بعد الفتح • أمريكا: حسب سياسة المتجر، مع الالتزام بعدم التضليل (FTC)" />
    <Section title="شروط الإرجاع" body="• المنتج مختوم، غير مفتوح، غير مستخدم، في عبوته الأصلية • لا إرجاع لعطور مخصصة/مركبة حسب طلبك • لا إرجاع لمنتجات نزل سعرها بسبب استخدام/تلف من العميل • العميل يتحمل تكلفة شحن الإرجاع إلا إذا العيب منا/التاجر" />
    <Section title="كيف ترجع" body="1) تواصل خلال المدة عبر حسابك → طلباتي → إرجاع 2) اذكر سببًا (اختياري) 3) نرسل ملصق إرجاع + تعليمات 4) أرسل خلال 7 أيام 5) نفحص خلال 3 أيام عمل 6) الاسترداد خلال 14 يوم بنفس وسيلة الدفع" />
    <Section title="الاستثناءات الصحية" body="لأسباب صحية/نظافة، العطور المفتوحة/المستخدمة لا تُرجع (EU 2011/83 Art.16(e)، السعودية، مصر). هذا لا يمس حقك في ضمان العيوب." />
    <Section title="عيب أو خطأ" body="إذا وصل منتج خاطئ/تالف/منتهي: نتحمل الشحن + استبدال فوري أو استرداد كامل + تعويض شحن. أبلغ خلال 48 ساعة مع صور." />
  </div>
);

const ShippingTab: React.FC<{ currentLang: SupportedLanguage }> = () => (
  <div className="space-y-3">
    <h3 className="font-bold text-stone-900">الشحن والمواد الخطرة — UN1266</h3>
    <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex gap-2">
      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
      <div className="text-xs text-red-900">
        <strong>تحذير IATA:</strong> العطور سائل قابل للاشتعال (UN1266, Class 3, PG II/III). شحن جوي محدود: 60L per package (Cargo Aircraft)، 5L (Passenger)، Excepted Quantity E1. بعض الدول تحظر استيراد عطور كحولية/مواد معينة (عود CITES). العميل مسؤول عن الامتثال الجمركي/الاستيرادي في بلده.
      </div>
    </div>
    <Section title="أسعار الشحن (من shipping.json)" body="مصر: $15 أول زجاجة + $3 إضافية (7-14 يوم) • الخليج: $14+$3 (5-10) • باقي عربي: $18+$4 (7-15) • أوروبا: $22+$5 (7-14) • أمريكا الشمالية: $25+$5 (7-14) • باقي العالم: $28+$6 (10-20) — الأسعار بدون ضريبة/جمارك." />
    <Section title="الجمارك والضرائب" body="الأسعار لا تشمل VAT/جمارك بلدك. العميل يتحمل الرسوم الجمركية/الضرائب عند الاستيراد. قد تُحجز شحنة لفحص/رسوم. لسنا مسؤولين عن تأخير جمركي. للEU: شحن <150€ عبر IOSS، >150€ VAT عند الاستيراد. تقدير الجمارك عند الدفع تقريبي فقط." />
    <Section title="تتبع ومسؤولية" body="نرسل رقم تتبع عند الشحن. المنصة/التاجر غير مسؤول عن فقدان/تلف بعد تسليم الناقل إلا إذا تأمين شحن. تأمين شحن اختياري عند الدفع." />
    <Section title="مواد مقيدة" body="بعض المواد الخام (Oakmoss, Lyral, Lilial...) مقيدة IFRA/REACH. خشب العود (Aquilaria) CITES Appendix II — يحتاج تصريح. تحقق قبل الطلب." />
  </div>
);

const CookiesTab: React.FC<{ currentLang: SupportedLanguage }> = () => (
  <div className="space-y-3">
    <h3 className="font-bold text-stone-900">الكوكيز والتتبع — ePrivacy + GDPR</h3>
    <Section title="ما نستخدمه" body="• ضروري: localStorage لحفظ وصفاتك/جلساتك (ضروري للخدمة، لا يحتاج موافقة) • وظيفي: تفضيل لغة/عملة • تحليلي: قياس أداء (يتطلب موافقة) • تسويقي: لا يوجد حاليًا (يتطلب موافقة صريحة)" />
    <Section title="موافقتك" body="عند زيارتك الأولى نعرض لافتة: قبول الكل / رفض غير الضروري / تخصيص. يمكنك تغيير اختيارك anytime عبر 'إعدادات الكوكيز' في Footer. نحتفظ بسجل موافقتك (timestamp + IP hash) لإثبات الامتثال." />
    <Section title="كيف تتحكم" body="• عبر لافتة الموافقة • عبر إعدادات متصفحك (حذف cookies) • عبر زر 'مسح بياناتي' في DataPrivacyModal • التواصل: privacy@sham-perfume.com" />
    <Section title="لا تتبع" body="نحن Zero Trackers: لا بكسلات فيسبوك/جوجل، لا بيع بيانات. إذا أضفنا تحليلات مستقبلاً، سنطلب موافقتك أولًا." />
  </div>
);

const AiTab: React.FC<{ currentLang: SupportedLanguage }> = () => (
  <div className="space-y-3">
    <h3 className="font-bold text-stone-900">الذكاء الاصطناعي — إفصاح AI Act (EU 2024/1689 Art.50)</h3>
    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
      🤖 <strong>هذا المحتوى مولد بالذكاء الاصطناعي</strong> — قد يحتوي أخطاء. ليس بديلاً عن استشارة خبير عطور مرخص/صيدلي/طبيب جلدية. راجع دائمًا معايير IFRA.
    </div>
    <Section title="ما هو شاهين" body="شاهين مساعد ذكي (LLM) يجيب عن أسئلة العطور باستخدام خدمات ذكاء اصطناعي خارجية موثوقة، مع تراجع إلى ذاكرة شاهين المحلية لما الخدمات تكون مش متاحة. نستخدم توجيه ذكي (router) واسترجاع معرفي (BM25) وأدوات (حسابات، كتالوج)." />
    <Section title="الشفافية" body="• كل رد موسوم 'مولد بالذكاء الاصطناعي' • لا ننسب رد AI لإنسان • نحتفظ بسجل تدقيق (trace) في الإدارة • يمكنك طلب 'ما تعرف عني؟' و'امسح بياناتي' • يمكنك تقييم الرد 👍/👎 لتحسينه" />
    <Section title="القيود" body="• شاهين لا يخترع أسعار/مخزون — كل الأسعار من الكتالوج على الخادم • لا يؤكد طلبًا بدون تأكيدك • قد يخطئ في نسب/توافق نوتات — تحقق دائمًا • لا يقدم تشخيصًا طبيًا" />
    <Section title="حقوقك" body="لك حق الاعتراض على قرار آلي، وطلب مراجعة بشرية، والإبلاغ عن تحيز/خطأ عبر زر الإبلاغ في الشات." />
    <Section title="الخصوصية في AI" body="محادثاتك لا تُستخدم لتدريب نماذج خارجية بدون موافقتك. يمكنك حذف محادثة anytime. نحتفظ بسجل مجهول لأغراض تحسين فقط." />
  </div>
);

const ContactTab: React.FC<{ currentLang: SupportedLanguage }> = () => (
  <div className="space-y-3">
    <h3 className="font-bold text-stone-900">اتصل بنا قانونيًا</h3>
    <div className="grid sm:grid-cols-2 gap-3">
      <ContactCard title="مسؤول حماية البيانات (DPO)" email="dpo@sham-perfume.com" desc="لطلبات: وصول، تصحيح، مسح، نقل، اعتراض — نرد خلال 30 يومًا" />
      <ContactCard title="الخصوصية العامة" email="privacy@sham-perfume.com" desc="أسئلة عامة، سحب موافقة، شكاوى" />
      <ContactCard title="القانوني/الشروط" email="legal@sham-perfume.com" desc="شروط، ملكية فكرية، DMCA، عقود" />
      <ContactCard title="دعم المستهلك" email="support@sham-perfume.com" desc="طلبات، شحن، إرجاع — رد خلال 24 ساعة" />
    </div>
    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
      <h4 className="font-bold text-stone-900 mb-2">الشكاوى الحكومية</h4>
      <ul className="space-y-1 text-xs">
        <li><a href="https://maroof.sa" target="_blank" rel="noreferrer" className="text-amber-700 hover:underline flex items-center gap-1">🇸🇦 منصة معروف السعودية <ExternalLink className="w-3 h-3" /></a></li>
        <li><a href="https://www.cpa.gov.eg" target="_blank" rel="noreferrer" className="text-amber-700 hover:underline flex items-center gap-1">🇪🇬 جهاز حماية المستهلك مصر <ExternalLink className="w-3 h-3" /></a></li>
        <li><a href="https://u.ae/en/information-and-services/social-affairs/having-a-consumer-complaint" target="_blank" rel="noreferrer" className="text-amber-700 hover:underline flex items-center gap-1">🇦🇪 شكاوى المستهلك الإمارات <ExternalLink className="w-3 h-3" /></a></li>
        <li><a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer" className="text-amber-700 hover:underline flex items-center gap-1">🇪🇺 تسوية منازعات EU ODR <ExternalLink className="w-3 h-3" /></a></li>
      </ul>
    </div>
    <p className="text-[11px] text-stone-500">العنوان البريدي: [يُعبأ بعد التسجيل] — السجل التجاري: [يُعبأ] — الرقم الضريبي: [يُعبأ]</p>
  </div>
);

// ─── Helpers ──────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
    <h4 className="font-bold text-stone-900 text-xs mb-1">{title}</h4>
    <p className="text-xs text-stone-600 leading-relaxed">{body}</p>
  </div>
);

const StatCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => {
  const map: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    stone: 'bg-stone-50 border-stone-200 text-stone-700',
  };
  return (
    <div className={`p-3 rounded-xl border text-center ${map[color]}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[11px] opacity-80">{label}</div>
    </div>
  );
};

const ContactCard: React.FC<{ title: string; email: string; desc: string }> = ({ title, email, desc }) => (
  <div className="p-3 rounded-xl bg-white border border-stone-200">
    <h4 className="font-bold text-stone-900 text-xs">{title}</h4>
    <a href={`mailto:${email}`} className="text-xs text-amber-700 hover:underline">{email}</a>
    <p className="text-[11px] text-stone-500 mt-1">{desc}</p>
  </div>
);

export default LegalCenter;
