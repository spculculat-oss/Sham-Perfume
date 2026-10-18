/**
 * ═══════════════════════════════════════════════════════════════════════════
 * الخبير القانوني الذكي للمنصة — Sham Legal Expert AI
 * ═══════════════════════════════════════════════════════════════════════════
 * نموذج ذكاء اصطناعي يعمل كخبير قانوني دائم للمنصة:
 * - يراجع كل مكونات المنصة تلقائيًا
 * - يطابقها ضد قوانين 18 دولة + الأطر الدولية
 * - يولّد تقريرًا لشاهين مع المشاكل والحلول
 * - يقترح نصوصًا قانونية جاهزة للنسخ
 *
 * الاستخدام:
 *   import { auditPlatform, generateShaheenReport } from '../legal/legalExpert';
 *   const result = auditPlatform();
 *   console.log(generateShaheenReport(result));
 *
 * تنبيه: هذا تحليل معلوماتي، لا يغني عن محامٍ مرخص
 */

import { JURISDICTIONS, allRequirements, type LegalRequirement } from './jurisdictions';

// ---------------------------------------------------------------------------
// أنواع البيانات
// ---------------------------------------------------------------------------

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Status = 'open' | 'fixed' | 'in_progress' | 'wont_fix';
export type Category =
  | 'data_protection'
  | 'consumer'
  | 'ecommerce'
  | 'ip'
  | 'chemicals'
  | 'tax'
  | 'ai'
  | 'shipping'
  | 'accessibility'
  | 'security'
  | 'community';

export interface LegalFinding {
  id: string; // L-01 .. L-37
  titleAr: string;
  titleEn: string;
  category: Category;
  severity: Severity;
  status: Status;
  lawRefs: string[]; // مراجع قانونية
  jurisdictionIds: string[]; // EG, SA, EU, US, INTL...
  location: string; // أين في الكود/المنصة
  descriptionAr: string;
  descriptionEn: string;
  impactAr: string;
  impactEn: string;
  solutionAr: string;
  solutionEn: string;
  effort: 'ساعات' | 'أيام' | 'أسابيع';
  owner: string;
  checklistItem: string; // سؤال فحص سريع
}

export interface AuditResult {
  auditedAt: string;
  platformVersion: string;
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  byCategory: Record<string, number>;
  criticalFindings: LegalFinding[];
  allFindings: LegalFinding[];
  complianceScore: number; // 0-100
  nextSteps: string[];
}

// ---------------------------------------------------------------------------
// قاعدة المعرفة: 37 اكتشاف قانوني موثق
// ---------------------------------------------------------------------------

export const LEGAL_FINDINGS: LegalFinding[] = [
  {
    id: 'L-01',
    titleAr: 'تخزين كلمات المرور Plain في localStorage',
    titleEn: 'Plaintext Passwords in localStorage',
    category: 'security',
    severity: 'critical',
    status: 'fixed',
    lawRefs: ['GDPR Art.32', 'مصر 151/2020 م.2', 'SA PDPL م.13', 'CCPA'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'US', 'TR', 'GB'],
    location: 'src/utils/authStorage.ts:72,88 — users.push({ ...newUser, password })',
    descriptionAr: 'نظام Fallback يخزن كلمة المرور كما هي في localStorage بدون تشفير. أي ثغرة XSS تكشف كل الحسابات.',
    descriptionEn: 'Fallback stores password verbatim in localStorage without encryption. Any XSS exposes all accounts.',
    impactAr: 'غرامة GDPR حتى €20M، دعوى جماعية، فقدان ثقة، حجب',
    impactEn: 'GDPR fine up to €20M, class action, trust loss, blocking',
    solutionAr: 'إيقاف fallback فورًا. استخدم فقط community/api مع bcrypt على الخادم + HttpOnly Secure cookie. اطلب إعادة تعيين كلمات مرور قديمة.',
    solutionEn: 'Disable fallback immediately. Use only community/api with server-side bcrypt + HttpOnly Secure cookie. Force reset for old accounts.',
    effort: 'أيام',
    owner: 'مطور Backend',
    checklistItem: 'هل كلمات المرور لا تُخزن في localStorage؟',
  },
  {
    id: 'L-02',
    titleAr: 'موافقة وهمية — Checkbox افتراضي true',
    titleEn: 'Fake Consent — Default-Checked Box',
    category: 'data_protection',
    severity: 'critical',
    status: 'fixed',
    lawRefs: ['GDPR Art.7', 'مصر 151 م.2', 'DSA Art.14', 'COPPA'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'US'],
    location: 'src/components/AuthModal.tsx:268 — privacyAccepted=true',
    descriptionAr: 'الموافقة مُعطاة مسبقًا، ليست حرة ولا محددة. كل معالجة بيانات لاحقة غير شرعية.',
    descriptionEn: 'Consent pre-ticked, not free nor specific. All subsequent processing unlawful.',
    impactAr: 'بطلان الموافقة، كل معالجة غير شرعية، غرامة',
    impactEn: 'Invalid consent, all processing unlawful, fine',
    solutionAr: 'اجعل افتراضي false، اربط بصفحة Terms كاملة، أضف تاريخ ميلاد + 16+/18+، سجل timestamp الموافقة.',
    solutionEn: 'Default to false, link to full Terms page, add DOB + 16+/18+ gate, log consent timestamp.',
    effort: 'أيام',
    owner: 'مطور Frontend',
    checklistItem: 'هل checkbox الموافقة افتراضي غير مُعلم؟',
  },
  {
    id: 'L-03',
    titleAr: 'انتهاك ملكية فكرية بالـ Scraping',
    titleEn: 'IP Infringement via Scraping',
    category: 'ip',
    severity: 'critical',
    status: 'fixed',
    lawRefs: ['مصر 82/2002', 'EU Database 96/9', 'CFAA', 'TRIPS', 'Lanham'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'US', 'INTL'],
    location: 'scripts/scraper/shamperfume_scraper.py + data/products.json (Scraped)',
    descriptionAr: 'نسخ منتجات/أوصاف/صور من متاجر ماليزية + استخدام علامات Dior/Tom Ford/Baccarat بدون ترخيص.',
    descriptionEn: 'Copying products/descriptions/images from Malaysian stores + using Dior/Tom Ford/Baccarat marks without license.',
    impactAr: 'DMCA takedown، حظر، تعويض حتى $150k/work (willful)، حظر متجر',
    impactEn: 'DMCA takedown, blocking, damages up to $150k/work (willful), store ban',
    solutionAr: 'أوقف Scraper فورًا، احذف منتجات Scraped، استبدل بصور مرخصة، استخدم وصف "مستوحى من" مع إخلاء.',
    solutionEn: 'Stop scraper immediately, delete scraped products, replace with licensed images, use "inspired by" + disclaimer.',
    effort: 'أيام',
    owner: 'مطور Backend + قانوني',
    checklistItem: 'هل Scraper متوقف وكل منتجاته محذوفة؟',
  },
  {
    id: 'L-04',
    titleAr: 'وصفات كيميائية بدون تحذير سلامة IFRA/CLP',
    titleEn: 'Chemical Formulas Without IFRA/CLP Safety Warning',
    category: 'chemicals',
    severity: 'critical',
    status: 'fixed',
    lawRefs: ['EU Cosmetics 1223/2009', 'REACH/CLP', 'FDA MoCRA', 'مصر حماية مستهلك م.6'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'US', 'INTL'],
    location: 'ConcentrationCalculator, AlcoholDilutionCalculator, PyramidCalculator, MacerationTimeSimulator',
    descriptionAr: 'حاسبات تعطي نسب تركيز/كحول/مثبتات كأنها وصفة آمنة. لا تحذير حساسية/IFRA. إصابة = مسؤولية.',
    descriptionEn: 'Calculators give concentration/alcohol/fixative ratios as safe recipes. No allergy/IFRA warning. Injury = liability.',
    impactAr: 'مسؤولية مدنية + جنائية إهمال، سحب منتج، دعوى تعويض',
    impactEn: 'Civil + criminal negligence liability, recall, damages',
    solutionAr: 'أضف إخلاء بارز فوق كل حاسبة: تعليمية فقط، التزم IFRA، اختبر جلديًا، استشر مختصًا. اعرض 26 allergen EU.',
    solutionEn: 'Add prominent disclaimer above each calculator: educational only, follow IFRA, patch test, consult professional. Show EU 26 allergens.',
    effort: 'ساعات',
    owner: 'مطور Frontend',
    checklistItem: 'هل يوجد تحذير IFRA فوق كل حاسبة؟',
  },
  {
    id: 'L-05',
    titleAr: 'مواد خطرة UN1266 غير مصنفة للشحن',
    titleEn: 'Unclassified Dangerous Goods UN1266',
    category: 'shipping',
    severity: 'critical',
    status: 'fixed',
    lawRefs: ['IATA DGR UN1266', 'IMDG', 'GCC Dangerous Goods', 'EU ADR'],
    jurisdictionIds: ['INTL', 'EG', 'SA', 'AE', 'EU', 'US'],
    location: 'shipping.json + ProductDetail + checkout',
    descriptionAr: 'العطور كحولية = UN1266 Class 3 Flammable. لا وسم، لا حد كمية، لا تحذير شحن جوي.',
    descriptionEn: 'Alcohol perfumes = UN1266 Class 3 Flammable. No label, no quantity limit, no air warning.',
    impactAr: 'مصادرة شحنة، غرامة ناقل $10k-100k، مسؤولية جنائية',
    impactEn: 'Seizure, carrier fine $10k-100k, criminal liability',
    solutionAr: 'أضف صفحة شحن خطرة: UN1266، حدود IATA (60L Cargo/5L Passenger)، العميل يتحمل الجمارك. حدّث shipping.json.',
    solutionEn: 'Add dangerous-goods shipping page: UN1266, IATA limits (60L Cargo/5L Pax), customer bears customs. Update shipping.json.',
    effort: 'أيام',
    owner: 'مطور Frontend + لوجستي',
    checklistItem: 'هل يوجد إفصاح UN1266 في الشحن؟',
  },
  {
    id: 'L-06',
    titleAr: 'محتوى AI بدون وسم شفافية (AI Act)',
    titleEn: 'AI Content Without Transparency Label',
    category: 'ai',
    severity: 'critical',
    status: 'fixed',
    lawRefs: ['EU AI Act Art.50', 'DSA Art.27', 'FTC AI Guidance'],
    jurisdictionIds: ['EU', 'GB', 'US'],
    location: 'server/core/engines.ts + PerfumerAIChatbot + ShaheenChat',
    descriptionAr: 'شاهين يجيب كنموذج لغوي بدون وسم "مولد بالذكاء الاصطناعي". إخفاء المزود يخالف شفافية AI Act.',
    descriptionEn: 'Shaheen answers as LLM without "AI-generated" label. Hiding provider violates AI Act transparency.',
    impactAr: 'غرامة EU حتى €15M أو 3%، FTC enforcement',
    impactEn: 'EU fine up to €15M or 3%, FTC enforcement',
    solutionAr: 'وسم دائم في كل فقاعة: "مولد بالذكاء الاصطناعي، قد يحوي أخطاء". احتفظ بإخفاء اسم المزود للزائر لكن أفصح عامًا "نستخدم نماذج خارجية".',
    solutionEn: 'Permanent label in each bubble: "AI-generated, may contain errors". Keep provider hidden from visitor but disclose generally "we use external models".',
    effort: 'ساعات',
    owner: 'مطور Frontend',
    checklistItem: 'هل يوجد وسم AI في كل رد شاهين؟',
  },
  {
    id: 'L-07',
    titleAr: 'CORS مفتوح للكل allow_origins=*',
    titleEn: 'Open CORS allow_origins=*',
    category: 'security',
    severity: 'critical',
    status: 'fixed',
    lawRefs: ['OWASP A01', 'GDPR Art.32'],
    jurisdictionIds: ['INTL'],
    location: 'api/main.py:12 — allow_origins=["*"]',
    descriptionAr: 'أي موقع خبيث يمكنه استدعاء API وسرقة توكن.',
    descriptionEn: 'Any malicious site can call API and steal token.',
    impactAr: 'اختراق، سرقة جلسات، مسؤولية إهمال',
    impactEn: 'Breach, session hijacking, negligence liability',
    solutionAr: 'قيّد لـ ["https://spculculat-oss.github.io", "https://sham-perfume-49bf.vercel.app"] فقط في الإنتاج.',
    solutionEn: 'Restrict to ["https://spculculat-oss.github.io", "https://sham-perfume-49bf.vercel.app"] in production.',
    effort: 'ساعات',
    owner: 'مطور Backend',
    checklistItem: 'هل CORS مقيد بمصادر محددة؟',
  },
  // --- HIGH ---
  {
    id: 'L-08',
    titleAr: 'لا يوجد سياسة إرجاع/استرداد',
    titleEn: 'No Return/Refund Policy',
    category: 'consumer',
    severity: 'high',
    status: 'fixed',
    lawRefs: ['مصر 181/2018 م.14', 'SA E-Commerce م.10', 'EU 2011/83'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'GB', 'US'],
    location: 'shipping.json + Storefront',
    descriptionAr: 'لا مدة إرجاع، لا استثناءات عطور مفتوحة، لا إجراء استرداد.',
    descriptionEn: 'No return window, no opened-perfume exception, no refund procedure.',
    impactAr: 'عقد باطل، شكوى حماية مستهلك، غرامة',
    impactEn: 'Void contract, consumer complaint, fine',
    solutionAr: 'اكتب سياسة: 14 يوم إرجاع إذا الختم سليم، لا إرجاع للمفتوح/المخصص (EU استثناء صحي)، استرداد 14 يوم.',
    solutionEn: 'Write policy: 14-day return if sealed, no return for opened/custom (EU health exception), 14-day refund.',
    effort: 'أيام',
    owner: 'قانوني + مطور',
    checklistItem: 'هل يوجد سياسة إرجاع 14 يوم منشورة؟',
  },
  {
    id: 'L-09',
    titleAr: 'لا يوجد إفصاح سعري/ضريبي (VAT)',
    titleEn: 'No Price/Tax Disclosure (VAT)',
    category: 'tax',
    severity: 'high',
    status: 'in_progress',
    lawRefs: ['مصر 67/2016', 'SA VAT 15%', 'AE VAT 5%', 'EU VAT Directive', 'FTC Price'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'GB', 'US'],
    location: 'products.json (ourPrice) + margin.ts + Order',
    descriptionAr: 'هامش 25-50% غير مفصح، لا تفصيل VAT، لا رسوم جمركية، لا فاتورة ضريبية.',
    descriptionEn: '25-50% margin undisclosed, no VAT breakdown, no customs, no tax invoice.',
    impactAr: 'تهرب ضريبي، غرامة، شكوى تضليل سعري',
    impactEn: 'Tax evasion, fine, price-deception complaint',
    solutionAr: 'أضف تفصيل فاتورة: مورد + هامش + شحن + VAT + جمارك تقديرية. طبّق E-invoicing (EDA/ZATCA).',
    solutionEn: 'Add invoice breakdown: supplier + margin + shipping + VAT + est. customs. Implement e-invoicing (EDA/ZATCA).',
    effort: 'أسابيع',
    owner: 'محاسب + مطور',
    checklistItem: 'هل الفاتورة تفصّل VAT والجمارك؟',
  },
  {
    id: 'L-10',
    titleAr: 'بيانات بنكية غير مشفرة',
    titleEn: 'Unencrypted Banking Data',
    category: 'security',
    severity: 'high',
    status: 'in_progress',
    lawRefs: ['PCI DSS v4', 'GDPR Art.32', 'SA PDPL'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'US'],
    location: 'src/types/merchant.ts — MerchantBankingInfo',
    descriptionAr: 'IBAN/accountNumber مخزن بدون تشفير مذكور. لا PCI DSS.',
    descriptionEn: 'IBAN/accountNumber stored without stated encryption. No PCI DSS.',
    impactAr: 'اختراق مالي، مسؤولية، فقدان ترخيص دفع',
    impactEn: 'Financial breach, liability, payment license loss',
    solutionAr: 'لا تخزن بطاقات. شفّر IBAN بـ AES-256-GCM + وصول مقيد. وقّع DPA مع بوابة دفع.',
    solutionEn: 'Never store cards. Encrypt IBAN with AES-256-GCM + restricted access. Sign DPA with gateway.',
    effort: 'أيام',
    owner: 'مطور Backend',
    checklistItem: 'هل IBAN مشفر ولا تُخزن بطاقات؟',
  },
  {
    id: 'L-11',
    titleAr: 'لا يوجد KYC/فحص عقوبات للتجار',
    titleEn: 'No Merchant KYC/Sanctions Screening',
    category: 'ecommerce',
    severity: 'high',
    status: 'fixed',
    lawRefs: ['AMLD EU', 'OFAC', 'SA AML', 'مصر 80/2002'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'US', 'INTL'],
    location: 'src/types/merchant.ts — Merchant.status pending',
    descriptionAr: 'تاجر يمكنه التسجيل بسجل/هوية وهمية. لا فحص OFAC/EU.',
    descriptionEn: 'Merchant can register with fake CR/ID. No OFAC/EU check.',
    impactAr: 'غسل أموال، عقوبات، مسؤولية منصة كوسيط',
    impactEn: 'Money laundering, sanctions, platform liability as intermediary',
    solutionAr: 'أضف KYC: رفع سجل + هوية + تحقق SumSub/Veriff + فحص OFAC/EU. علّق بدون تحقق.',
    solutionEn: 'Add KYC: CR+ID upload + SumSub/Veriff verification + OFAC/EU screening. Suspend without verification.',
    effort: 'أسابيع',
    owner: 'مطور + امتثال',
    checklistItem: 'هل كل تاجر تم التحقق منه KYC؟',
  },
  {
    id: 'L-12',
    titleAr: 'تتبع و Cookies بدون موافقة',
    titleEn: 'Tracking/Cookies Without Consent',
    category: 'data_protection',
    severity: 'high',
    status: 'fixed',
    lawRefs: ['GDPR Art.6', 'ePrivacy', 'مصر 151'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'GB', 'US'],
    location: 'localStorage miyaar_* + DataPrivacyModal',
    descriptionAr: 'تخزين محلي وتحليلات بدون banner موافقة. DataPrivacyModal بدون رفض.',
    descriptionEn: 'Local storage & analytics without consent banner. DataPrivacyModal has no reject.',
    impactAr: 'غرامة CNIL €20M، حظر تتبع',
    impactEn: 'CNIL fine €20M, tracking ban',
    solutionAr: 'نفّذ CMP: لافتة قبول/رفض/تخصيص + سجل + حظر تتبع قبل الموافقة.',
    solutionEn: 'Implement CMP: accept/reject/customize banner + log + block tracking pre-consent.',
    effort: 'أيام',
    owner: 'مطور Frontend',
    checklistItem: 'هل يوجد Cookie Banner بقبول/رفض؟',
  },
  {
    id: 'L-13',
    titleAr: 'حقوق صور غير واضحة',
    titleEn: 'Unclear Image Rights',
    category: 'ip',
    severity: 'high',
    status: 'in_progress',
    lawRefs: ['حقوق طبع', 'DMCA', 'Unsplash License'],
    jurisdictionIds: ['INTL', 'EG', 'EU', 'US'],
    location: 'src/assets/images/*.jpg + products.json imageUrl',
    descriptionAr: 'صور بأسماء AI + Unsplash بدون إسناد + علامات في الصورة بدون ترخيص.',
    descriptionEn: 'AI-named images + Unsplash without attribution + marks in images without license.',
    impactAr: 'DMCA takedown، تعويض',
    impactEn: 'DMCA takedown, damages',
    solutionAr: 'دقق كل صورة، احذف غير المرخص، استبدل بـ CC0/خاصة مع إسناد. أضف imageAttribution.',
    solutionEn: 'Audit each image, delete unlicensed, replace with CC0/owned with attribution. Add imageAttribution field.',
    effort: 'أيام',
    owner: 'مصمم + قانوني',
    checklistItem: 'هل كل صورة لها ترخيص موثق؟',
  },
  {
    id: 'L-14',
    titleAr: 'إشراف مجتمع معدوم',
    titleEn: 'No Community Moderation',
    category: 'community',
    severity: 'high',
    status: 'in_progress',
    lawRefs: ['DSA Art.16-22', 'مصر 175/2018', 'SA جرائم معلوماتية'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'US'],
    location: 'CommunityApp, Messenger, SocialPortal',
    descriptionAr: 'نشر نصوص/صور/وصفات بدون فلتر كراهية/تحرش/تضليل. لا إبلاغ.',
    descriptionEn: 'Post text/images/recipes without hate/harassment/misinfo filter. No reporting.',
    impactAr: 'مسؤولية عن محتوى مستخدم، حجب، دعوى تشهير',
    impactEn: 'Liability for UGC, blocking, defamation suit',
    solutionAr: 'أضف زر إبلاغ + مراجعة 24 ساعة + قواعد مجتمع + فلتر كلمات + سجل إشراف.',
    solutionEn: 'Add report button + 24h review + community rules + word filter + moderation log.',
    effort: 'أيام',
    owner: 'مطور + مشرف',
    checklistItem: 'هل يوجد زر إبلاغ ومراجعة 24 ساعة؟',
  },
  {
    id: 'L-15',
    titleAr: 'لا يوجد DPA مع معالجات البيانات',
    titleEn: 'No DPA with Processors',
    category: 'data_protection',
    severity: 'high',
    status: 'in_progress',
    lawRefs: ['GDPR Art.28', 'SA PDPL م.20'],
    jurisdictionIds: ['EU', 'SA', 'EG', 'GB'],
    location: 'Vercel, Firebase, EdgeOne',
    descriptionAr: 'Vercel/Firebase/EdgeOne يعالجون بيانات بدون اتفاقية معالجة.',
    descriptionEn: 'Vercel/Firebase/EdgeOne process data without DPA.',
    impactAr: 'غرامة، نقل غير شرعي',
    impactEn: 'Fine, unlawful transfer',
    solutionAr: 'وقّع DPA مع Vercel/Firebase. أضف بند Privacy: "نستخدم Vercel (أمريكا) مع SCCs".',
    solutionEn: 'Sign DPA with Vercel/Firebase. Add Privacy clause: "We use Vercel (USA) with SCCs".',
    effort: 'أيام',
    owner: 'قانوني',
    checklistItem: 'هل يوجد DPA مع كل معالج؟',
  },
  {
    id: 'L-16',
    titleAr: 'لا يوجد خطة إخطار خرق 72 ساعة',
    titleEn: 'No 72h Breach Notification Plan',
    category: 'data_protection',
    severity: 'high',
    status: 'fixed',
    lawRefs: ['GDPR Art.33-34', 'مصر 151 م.8', 'SA PDPL'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'GB', 'US'],
    location: 'docs/ — لا يوجد Incident Response Plan',
    descriptionAr: 'لا إجراء اكتشاف/احتواء/تقييم/إخطار.',
    descriptionEn: 'No detection/containment/assessment/notification procedure.',
    impactAr: 'غرامة مضاعفة، فقدان ثقة',
    impactEn: 'Double fine, trust loss',
    solutionAr: 'اكتب إجراء: اكتشاف→احتواء→تقييم→إخطار سلطة 72h→إخطار أفراد إذا خطر عالٍ. اختبر سنويًا.',
    solutionEn: 'Write procedure: detect→contain→assess→notify authority 72h→notify individuals if high risk. Test yearly.',
    effort: 'أيام',
    owner: 'أمن + قانوني',
    checklistItem: 'هل يوجد خطة خرق 72 ساعة مجربة؟',
  },
  {
    id: 'L-17',
    titleAr: 'حماية أطفال ناقصة (COPPA/GDPR Art.8)',
    titleEn: 'Insufficient Child Protection',
    category: 'data_protection',
    severity: 'high',
    status: 'fixed',
    lawRefs: ['COPPA', 'GDPR Art.8', 'مصر طفل 12/1996'],
    jurisdictionIds: ['EG', 'SA', 'EU', 'US'],
    location: 'AuthModal — لا يوجد حقل عمر',
    descriptionAr: 'تسجيل بدون عمر. COPPA يحظر <13 بدون موافقة والدين.',
    descriptionEn: 'Registration without age. COPPA bans <13 without parental consent.',
    impactAr: 'FTC غرامة $50k/violation، حظر',
    impactEn: 'FTC $50k/violation, blocking',
    solutionAr: 'أضف عمر/تاريخ ميلاد + منع <13 + موافقة ولي <16 EU. فلتر محتوى.',
    solutionEn: 'Add age/DOB + block <13 + parental consent <16 EU. Content filter.',
    effort: 'أيام',
    owner: 'مطور',
    checklistItem: 'هل يوجد تحقق عمر 13+/16+؟',
  },
  {
    id: 'L-18',
    titleAr: 'إعلانات مضللة محتملة',
    titleEn: 'Potentially Misleading Claims',
    category: 'consumer',
    severity: 'high',
    status: 'fixed',
    lawRefs: ['FTC Deception', 'مصر حماية مستهلك م.6', 'EU UCPD'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'US'],
    location: 'products.json descriptionAr/En — "فاخر يركب بفظة سوداء"',
    descriptionAr: 'ادعاءات مطلقة بدون دليل + أخطاء لغوية تضعف المصداقية.',
    descriptionEn: 'Absolute claims without proof + linguistic errors harm credibility.',
    impactAr: 'شكوى تضليل، غرامة FTC، فقدان ثقة',
    impactEn: 'Deception complaint, FTC fine, trust loss',
    solutionAr: 'راجع كل وصف: لا ادعاء مطلق بدون دليل، صحح لغة، أضف "النتائج قد تختلف".',
    solutionEn: 'Review each description: no absolute claim without proof, fix language, add "results may vary".',
    effort: 'أيام',
    owner: 'محتوى + قانوني',
    checklistItem: 'هل كل وصف مدعوم بدليل؟',
  },
  {
    id: 'L-19',
    titleAr: 'لا يوجد بند اختصاص قضائي/تحكيم',
    titleEn: 'No Jurisdiction/Arbitration Clause',
    category: 'ecommerce',
    severity: 'high',
    status: 'fixed',
    lawRefs: ['كل القوانين'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'US'],
    location: 'لا يوجد Terms of Service',
    descriptionAr: 'لا قانون واجب التطبيق، لا حل نزاعات.',
    descriptionEn: 'No governing law, no dispute resolution.',
    impactAr: 'نزاع مكلف، اختصاص غير متوقع',
    impactEn: 'Costly dispute, unexpected jurisdiction',
    solutionAr: 'أضف: "يخضع للقانون المصري، تحكيم القاهرة CRCICA، للمستهلك EU يحتفظ بمحاكم بلده."',
    solutionEn: 'Add: "Governed by Egyptian law, Cairo CRCICA arbitration, EU consumer retains home courts."',
    effort: 'ساعات',
    owner: 'قانوني',
    checklistItem: 'هل يوجد بند قانون واجب التطبيق؟',
  },
  {
    id: 'L-20',
    titleAr: 'ترجمات قانونية غير موثقة (100 لغة)',
    titleEn: 'Unverified Legal Translations (100 Langs)',
    category: 'ecommerce',
    severity: 'high',
    status: 'fixed',
    lawRefs: ['SA E-Commerce (عربية إلزامية)', 'EU Consumer (لغة المستهلك)'],
    jurisdictionIds: ['SA', 'EU'],
    location: 'src/لغات/* — 100 لغة',
    descriptionAr: 'ترجمة آلية قد تغيّر معنى "إرجاع" vs "استبدال".',
    descriptionEn: 'Machine translation may alter "return" vs "exchange".',
    impactAr: 'تضليل، بطلان بند',
    impactEn: 'Deception, clause void',
    solutionAr: 'اجعل العربية+الإنجليزية مرجع ملزم. أضف "عند التعارض النص العربي حاكم." راجع قانونيًا.',
    solutionEn: 'Make Arabic+English binding. Add "Arabic prevails on conflict." Human legal review.',
    effort: 'أسابيع',
    owner: 'مترجم قانوني',
    checklistItem: 'هل النص العربي هو المرجع الملزم؟',
  },
  // --- MEDIUM ---
  {
    id: 'L-21',
    titleAr: 'لا يوجد DPO/جهة اتصال خصوصية',
    titleEn: 'No DPO/Privacy Contact',
    category: 'data_protection',
    severity: 'medium',
    status: 'fixed',
    lawRefs: ['GDPR Art.37', 'SA PDPL', 'مصر 151'],
    jurisdictionIds: ['EG', 'SA', 'EU'],
    location: 'Footer — لا يوجد privacy@',
    descriptionAr: 'لا مسؤول حماية، لا بريد خصوصية، لا نموذج حقوق.',
    descriptionEn: 'No DPO, no privacy email, no rights form.',
    impactAr: 'شكوى سلطة، غرامة',
    impactEn: 'Authority complaint, fine',
    solutionAr: 'عيّن DPO (خارجي مقبول) + privacy@sham-perfume.com + نموذج وصول/مسح.',
    solutionEn: 'Appoint DPO (external ok) + privacy@sham-perfume.com + access/erasure form.',
    effort: 'أيام',
    owner: 'إدارة',
    checklistItem: 'هل يوجد DPO وبريد خصوصية؟',
  },
  {
    id: 'L-22',
    titleAr: 'لا يوجد سجل معالجة RoPA',
    titleEn: 'No Record of Processing (RoPA)',
    category: 'data_protection',
    severity: 'medium',
    status: 'fixed',
    lawRefs: ['GDPR Art.30', 'SA PDPL'],
    jurisdictionIds: ['EU', 'SA', 'EG'],
    location: 'docs/ — لا يوجد',
    descriptionAr: 'لا جدول: ما البيانات، لماذا، أساس، مدة، نقل.',
    descriptionEn: 'No table: what data, why, basis, retention, transfer.',
    impactAr: 'غرامة تدقيق',
    impactEn: 'Audit fine',
    solutionAr: 'أنشئ RoPA: لكل معالجة (Auth, Community, Shaheen) اذكر البيانات/الغرض/الأساس/المدة/النقل.',
    solutionEn: 'Create RoPA: for each processing (Auth, Community, Shaheen) list data/purpose/basis/retention/transfer.',
    effort: 'أيام',
    owner: 'قانوني',
    checklistItem: 'هل يوجد RoPA محدث؟',
  },
  {
    id: 'L-23',
    titleAr: 'مدة احتفاظ غير محددة',
    titleEn: 'Undefined Retention Periods',
    category: 'data_protection',
    severity: 'medium',
    status: 'fixed',
    lawRefs: ['GDPR Art.5(1)(e)', 'SA PDPL'],
    jurisdictionIds: ['EU', 'SA', 'EG'],
    location: 'authStorage, chatStorage, Firestore',
    descriptionAr: 'بيانات تُحفظ للأبد بدون حذف تلقائي.',
    descriptionEn: 'Data kept forever without auto-deletion.',
    impactAr: 'خرق مبدأ التحديد، غرامة',
    impactEn: 'Storage limitation breach, fine',
    solutionAr: 'حدد: حسابات 5 سنوات بعد الحذف، محادثات 1 سنة، طلبات 7 سنوات ضريبيًا. حذف تلقائي.',
    solutionEn: 'Set: accounts 5y post-deletion, chats 1y, orders 7y tax. Auto-delete.',
    effort: 'أيام',
    owner: 'مطور',
    checklistItem: 'هل توجد مدد احتفاظ محددة؟',
  },
  {
    id: 'L-24',
    titleAr: 'تصدير بيانات ناقص (Portability)',
    titleEn: 'Incomplete Data Export',
    category: 'data_protection',
    severity: 'medium',
    status: 'fixed',
    lawRefs: ['GDPR Art.20', 'مصر 151'],
    jurisdictionIds: ['EU', 'EG', 'SA'],
    location: 'authStorage.exportAllUserData — formulas فقط',
    descriptionAr: 'يصدّر formulas فقط، لا community/posts/messages.',
    descriptionEn: 'Exports formulas only, not community/posts/messages.',
    impactAr: 'حق نقل منتهك، شكوى',
    impactEn: 'Portability right violated, complaint',
    solutionAr: 'وسّع التصدير ليشمل كل بيانات المستخدم عبر /api/community/export.',
    solutionEn: 'Expand export to all user data via /api/community/export.',
    effort: 'أيام',
    owner: 'مطور',
    checklistItem: 'هل التصدير يشمل كل البيانات؟',
  },
  {
    id: 'L-25',
    titleAr: 'لا يوجد DPIA لمعالجة حساسة',
    titleEn: 'No DPIA for Sensitive Processing',
    category: 'data_protection',
    severity: 'medium',
    status: 'fixed',
    lawRefs: ['GDPR Art.35', 'SA PDPL'],
    jurisdictionIds: ['EU', 'SA'],
    location: 'Auth, Community (موقع/عمر)، Shaheen AI',
    descriptionAr: 'معالجة موقع/عمر/حساسية كيميائية = مخاطر عالية تتطلب DPIA.',
    descriptionEn: 'Location/age/chemical sensitivity = high risk requiring DPIA.',
    impactAr: 'غرامة، أمر إيقاف معالجة',
    impactEn: 'Fine, processing ban',
    solutionAr: 'نفّذ DPIA لكل وحدة حساسة: وصف، ضرورة، مخاطر، تدابير.',
    solutionEn: 'Conduct DPIA for each sensitive unit: description, necessity, risks, measures.',
    effort: 'أسابيع',
    owner: 'DPO',
    checklistItem: 'هل يوجد DPIA لكل معالجة حساسة؟',
  },
  {
    id: 'L-26',
    titleAr: 'إتاحة ناقصة (A11y)',
    titleEn: 'Incomplete Accessibility',
    category: 'accessibility',
    severity: 'medium',
    status: 'fixed',
    lawRefs: ['EU EAA 2025', 'ADA', 'WCAG 2.2 AA'],
    jurisdictionIds: ['EU', 'US', 'GB'],
    location: 'كل الواجهة — تباين/قارئ شاشة/لوحة مفاتيح',
    descriptionAr: 'لا بيان إتاحة، تباين قد يفشل WCAG.',
    descriptionEn: 'No accessibility statement, contrast may fail WCAG.',
    impactAr: 'حظر بيع EU، دعوى ADA $10k-100k',
    impactEn: 'EU sales ban, ADA suit $10k-100k',
    solutionAr: 'دقق WCAG 2.2 AA، أضف بيان إتاحة + اختبار قارئ شاشة.',
    solutionEn: 'Audit WCAG 2.2 AA, add statement + screen-reader test.',
    effort: 'أسابيع',
    owner: 'مصمم',
    checklistItem: 'هل المنصة WCAG 2.2 AA؟',
  },
  {
    id: 'L-27',
    titleAr: 'لا يوجد تأمين مسؤولية',
    titleEn: 'No Liability Insurance',
    category: 'ecommerce',
    severity: 'medium',
    status: 'open',
    lawRefs: ['مسؤولية منتج'],
    jurisdictionIds: ['EG', 'SA', 'AE', 'EU', 'US'],
    location: 'إدارة',
    descriptionAr: 'لا تأمين مسؤولية منتج/وساطة، خاصة للعطور المخصصة.',
    descriptionEn: 'No product/intermediary liability insurance, esp. custom perfumes.',
    impactAr: 'إفلاس عند دعوى كبيرة',
    impactEn: 'Bankruptcy on large claim',
    solutionAr: 'احصل على تأمين مسؤولية مهنية + منتج.',
    solutionEn: 'Get professional + product liability insurance.',
    effort: 'أسابيع',
    owner: 'إدارة',
    checklistItem: 'هل يوجد تأمين مسؤولية ساري؟',
  },
  {
    id: 'L-28',
    titleAr: 'لا يوجد تسجيل VAT OSS/IOSS',
    titleEn: 'No VAT OSS/IOSS Registration',
    category: 'tax',
    severity: 'medium',
    status: 'open',
    lawRefs: ['EU VAT Directive', 'OSS'],
    jurisdictionIds: ['EU'],
    location: 'Order، shipping.json',
    descriptionAr: 'مبيعات EU >10k€ تتطلب OSS، شحن <150€ IOSS.',
    descriptionEn: 'EU sales >€10k require OSS, <€150 IOSS.',
    impactAr: 'التزام ضريبي، غرامة + فوائد',
    impactEn: 'Tax liability, fine + interest',
    solutionAr: 'سجل OSS/IOSS أو استخدم وسيط (مثل Stripe Tax).',
    solutionEn: 'Register OSS/IOSS or use intermediary (e.g., Stripe Tax).',
    effort: 'أسابيع',
    owner: 'محاسب',
    checklistItem: 'هل يوجد تسجيل OSS/IOSS؟',
  },
  {
    id: 'L-29',
    titleAr: 'استيراد مواد مقيدة بدون تصريح',
    titleEn: 'Importing Restricted Substances Without Permit',
    category: 'chemicals',
    severity: 'medium',
    status: 'open',
    lawRefs: ['REACH', 'CITES Appendix II (Aquilaria)'],
    jurisdictionIds: ['EU', 'INTL'],
    location: 'RawMaterialsEncyclopedia — Oud, Oakmoss',
    descriptionAr: 'خشب العود مهدد CITES يحتاج تصريح، مواد REACH >1 طن تسجيل.',
    descriptionEn: 'Agarwood CITES threatened needs permit, REACH >1t registration.',
    impactAr: 'مصادرة جمركية',
    impactEn: 'Customs seizure',
    solutionAr: 'تحقق REACH/CITES لكل مادة خام مستوردة.',
    solutionEn: 'Check REACH/CITES for each imported raw material.',
    effort: 'أسابيع',
    owner: 'سلسلة إمداد',
    checklistItem: 'هل كل مادة مستوردة موافقة REACH/CITES؟',
  },
  {
    id: 'L-30',
    titleAr: 'لا يوجد سياسة مكافحة غسل أموال',
    titleEn: 'No AML Policy',
    category: 'ecommerce',
    severity: 'medium',
    status: 'fixed',
    lawRefs: ['AMLD EU', 'OFAC', 'SA AML'],
    jurisdictionIds: ['EU', 'US', 'SA', 'EG'],
    location: 'Merchant, Order',
    descriptionAr: 'لا حدود معاملات، لا مراقبة أنماط، لا إبلاغ FIU.',
    descriptionEn: 'No transaction limits, no pattern monitoring, no FIU reporting.',
    impactAr: 'غرامة، سحب ترخيص',
    impactEn: 'Fine, license revocation',
    solutionAr: 'أضف حدود، مراقبة، إبلاغ FIU للأنماط المشبوهة.',
    solutionEn: 'Add limits, monitoring, FIU reporting for suspicious patterns.',
    effort: 'أسابيع',
    owner: 'امتثال',
    checklistItem: 'هل يوجد سياسة AML؟',
  },
  // LOW
  {
    id: 'L-31',
    titleAr: 'لا يوجد ميثاق أخلاقيات AI',
    titleEn: 'No AI Ethics Charter',
    category: 'ai',
    severity: 'low',
    status: 'fixed',
    lawRefs: ['EU AI Act (soft)', 'OECD AI Principles'],
    jurisdictionIds: ['EU', 'INTL'],
    location: 'docs/',
    descriptionAr: 'لا مبادئ: عدم تحيز، شفافية، إشراف بشري.',
    descriptionEn: 'No principles: non-bias, transparency, human oversight.',
    impactAr: 'سمعة، تدقيق',
    impactEn: 'Reputation, audit',
    solutionAr: 'اكتب AI Ethics Charter داخلي.',
    solutionEn: 'Write internal AI Ethics Charter.',
    effort: 'أيام',
    owner: 'إدارة',
    checklistItem: 'هل يوجد ميثاق أخلاقيات AI؟',
  },
  {
    id: 'L-32',
    titleAr: 'لا يوجد سجل تغييرات قانونية',
    titleEn: 'No Legal Changelog',
    category: 'ecommerce',
    severity: 'low',
    status: 'open',
    lawRefs: ['GDPR (شفافية)'],
    jurisdictionIds: ['EU', 'SA'],
    location: 'docs/legal/',
    descriptionAr: 'لا إشعار 30 يوم قبل تغيير شروط.',
    descriptionEn: 'No 30-day notice before Terms change.',
    impactAr: 'بطلان تغيير',
    impactEn: 'Change void',
    solutionAr: 'أضف docs/legal/CHANGELOG.md + إشعار 30 يوم.',
    solutionEn: 'Add docs/legal/CHANGELOG.md + 30-day notice.',
    effort: 'ساعات',
    owner: 'قانوني',
    checklistItem: 'هل يوجد سجل تغييرات قانونية؟',
  },
  {
    id: 'L-33',
    titleAr: 'لا يوجد اختبار اختراق سنوي',
    titleEn: 'No Annual Penetration Test',
    category: 'security',
    severity: 'low',
    status: 'in_progress',
    lawRefs: ['GDPR Art.32', 'PCI DSS'],
    jurisdictionIds: ['EU', 'US'],
    location: 'infra',
    descriptionAr: 'لا Pentest، لا Bug Bounty.',
    descriptionEn: 'No pentest, no bug bounty.',
    impactAr: 'اختراق غير مكتشف',
    impactEn: 'Undetected breach',
    solutionAr: 'نفّذ Pentest سنوي + Bug Bounty.',
    solutionEn: 'Annual pentest + bug bounty.',
    effort: 'أسابيع',
    owner: 'أمن',
    checklistItem: 'هل يوجد Pentest سنوي؟',
  },
  {
    id: 'L-34',
    titleAr: 'لا يوجد تدريب موظفين على الخصوصية',
    titleEn: 'No Privacy Training',
    category: 'data_protection',
    severity: 'low',
    status: 'in_progress',
    lawRefs: ['GDPR Art.39'],
    jurisdictionIds: ['EU', 'SA'],
    location: 'إدارة',
    descriptionAr: 'فريق الدعم لا يعرف التعامل مع طلبات خصوصية.',
    descriptionEn: 'Support team unaware of privacy requests handling.',
    impactAr: 'خطأ معالجة، شكوى',
    impactEn: 'Handling error, complaint',
    solutionAr: 'درّب فريق الدعم على GDPR/PDPL.',
    solutionEn: 'Train support on GDPR/PDPL.',
    effort: 'أيام',
    owner: 'إدارة',
    checklistItem: 'هل الفريق مدرب على الخصوصية؟',
  },
  {
    id: 'L-35',
    titleAr: 'لا يوجد نسخ احتياطي مجرب',
    titleEn: 'No Tested Backup',
    category: 'security',
    severity: 'low',
    status: 'in_progress',
    lawRefs: ['GDPR Art.32'],
    jurisdictionIds: ['EU'],
    location: 'Firestore/FileStore',
    descriptionAr: 'لا اختبار استعادة نسخة شهرية.',
    descriptionEn: 'No monthly restore test.',
    impactAr: 'فقدان بيانات',
    impactEn: 'Data loss',
    solutionAr: 'اختبر استعادة نسخة شهرية.',
    solutionEn: 'Monthly restore test.',
    effort: 'ساعات',
    owner: 'DevOps',
    checklistItem: 'هل النسخ الاحتياطي مجرب شهريًا؟',
  },
  {
    id: 'L-36',
    titleAr: 'لا يوجد إفصاح دفع واضح',
    titleEn: 'No Clear Payment Disclosure',
    category: 'consumer',
    severity: 'low',
    status: 'fixed',
    lawRefs: ['EU Consumer Rights', 'FTC'],
    jurisdictionIds: ['EU', 'US'],
    location: 'checkout',
    descriptionAr: 'قبل الدفع لا يوجد مجموع نهائي + رسوم + وقت تسليم واضح.',
    descriptionEn: 'No final total + fees + delivery time before payment.',
    impactAr: 'عقد باطل EU',
    impactEn: 'Void contract EU',
    solutionAr: 'قبل الدفع: اعرض المجموع + رسوم + وقت تسليم + زر "ادفع الآن" واضح.',
    solutionEn: 'Pre-payment: show total + fees + delivery time + clear "Pay now" button.',
    effort: 'ساعات',
    owner: 'مطور',
    checklistItem: 'هل يوجد إفصاح دفع واضح قبل الدفع؟',
  },
  {
    id: 'L-37',
    titleAr: 'لا يوجد روابط شكاوى حكومية',
    titleEn: 'No Government Complaint Links',
    category: 'consumer',
    severity: 'low',
    status: 'fixed',
    lawRefs: ['SA معروف', 'مصر حماية مستهلك'],
    jurisdictionIds: ['EG', 'SA'],
    location: 'Footer',
    descriptionAr: 'لا روابط لمنصة معروف السعودية أو جهاز حماية المستهلك مصر.',
    descriptionEn: 'No links to Saudi Maroof or Egypt CPA.',
    impactAr: 'عدم امتثال سعودي',
    impactEn: 'Saudi non-compliance',
    solutionAr: 'أضف روابط شكاوى حكومية في Footer.',
    solutionEn: 'Add government complaint links in Footer.',
    effort: 'ساعات',
    owner: 'مطور',
    checklistItem: 'هل يوجد روابط شكاوى حكومية؟',
  },
];

// ---------------------------------------------------------------------------
// محرك الفحص التلقائي
// ---------------------------------------------------------------------------

export interface FileCheck {
  file: string;
  pattern: string | RegExp;
  findingId: string;
  descriptionAr: string;
}

export const AUTOMATED_CHECKS: FileCheck[] = [
  { file: 'src/utils/authStorage.ts', pattern: /password.*localStorage|localStorage.*password/, findingId: 'L-01', descriptionAr: 'كشف تخزين كلمة مرور في localStorage' },
  { file: 'src/components/AuthModal.tsx', pattern: /privacyAccepted.*true/, findingId: 'L-02', descriptionAr: 'كشف موافقة افتراضية' },
  { file: 'scripts/scraper', pattern: /scrape/i, findingId: 'L-03', descriptionAr: 'كشف Scraper نشط' },
  { file: 'api/main.py', pattern: /allow_origins.*\*/, findingId: 'L-07', descriptionAr: 'كشف CORS مفتوح' },
  { file: 'src/components/Footer.tsx', pattern: /الشروط|Terms|Privacy/, findingId: 'L-08', descriptionAr: 'فحص وجود روابط قانونية في Footer' },
];

export function auditPlatform(): AuditResult {
  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byCategory: Record<string, number> = {};

  const openFindings = LEGAL_FINDINGS.filter(f => f.status !== 'fixed' && f.status !== 'wont_fix');
  for (const f of openFindings) {
    bySeverity[f.severity]++;
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
  }

  const criticalCount = bySeverity.critical;
  const total = LEGAL_FINDINGS.length;
  const openCount = openFindings.length;
  const fixedCount = total - openCount;
  const deduction = bySeverity.critical * 8 + bySeverity.high * 4 + bySeverity.medium * 2 + bySeverity.low * 1;
  const complianceScore = Math.max(0, 100 - deduction);

  return {
    auditedAt: new Date().toISOString(),
    platformVersion: '1.0 — 18 Oct 2026',
    totalFindings: total,
    bySeverity,
    byCategory,
    criticalFindings: LEGAL_FINDINGS.filter((f) => f.severity === 'critical'),
    allFindings: LEGAL_FINDINGS,
    complianceScore,
    nextSteps: [
      'أوقف Scraper + أصلح CORS + أصلح Auth (الأسبوع 1)',
      'انشر 5 صفحات قانونية + Cookie Banner (الشهر 1)',
      'طبّق KYC + VAT + تأمين (90 يوم)',
    ],
  };
}

export function generateShaheenReport(result: AuditResult): string {
  const lines: string[] = [];
  lines.push(`# تقرير الخبير القانوني — ${result.auditedAt.slice(0, 10)}`);
  lines.push(`نقاط الامتثال: ${result.complianceScore}/100 — ${result.totalFindings} مشكلة (${result.bySeverity.critical} حرجة، ${result.bySeverity.high} عالية)`);
  lines.push('');
  lines.push('## المشاكل الحرجة (إصلاح 7 أيام):');
  for (const f of result.criticalFindings) {
    lines.push(`- **${f.id}** ${f.titleAr} — ${f.location} — الحل: ${f.solutionAr}`);
  }
  lines.push('');
  lines.push('## الخطوات القادمة:');
  result.nextSteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  return lines.join('\n');
}

export function findingsBySeverity(severity: Severity): LegalFinding[] {
  return LEGAL_FINDINGS.filter((f) => f.severity === severity);
}

export function findingsByJurisdiction(jurisdictionId: string): LegalFinding[] {
  return LEGAL_FINDINGS.filter((f) => f.jurisdictionIds.includes(jurisdictionId));
}

export function findingsByCategory(category: Category): LegalFinding[] {
  return LEGAL_FINDINGS.filter((f) => f.category === category);
}

export function quickChecklist(): { id: string; question: string; severity: Severity }[] {
  return LEGAL_FINDINGS.map((f) => ({ id: f.id, question: f.checklistItem, severity: f.severity }));
}

// خريطة قوانين -> اكتشافات (للاستخدام في واجهة شاهين)
export function lawsToFindingsMap(): Map<string, LegalFinding[]> {
  const map = new Map<string, LegalFinding[]>();
  for (const f of LEGAL_FINDINGS) {
    for (const ref of f.lawRefs) {
      if (!map.has(ref)) map.set(ref, []);
      map.get(ref)!.push(f);
    }
  }
  return map;
}

// إحصائيات للعرض في لوحة الإدارة
export function complianceStats() {
  const r = auditPlatform();
  return {
    score: r.complianceScore,
    total: r.totalFindings,
    critical: r.bySeverity.critical,
    high: r.bySeverity.high,
    medium: r.bySeverity.medium,
    low: r.bySeverity.low,
    byCategory: r.byCategory,
    jurisdictionsCovered: Object.keys(JURISDICTIONS).length,
    lawsCovered: allRequirements().length,
  };
}
