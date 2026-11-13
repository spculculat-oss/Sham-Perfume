/**
 * Sham Legal Expert — خريطة القوانين لكل دولة
 * مرجع قانوني مبرمج يستخدمه الخبير القانوني الذكي للفحص التلقائي
 * لا يغني عن استشارة محامٍ مرخص
 */

export type JurisdictionId =
  | 'EG' | 'SA' | 'AE' | 'QA' | 'KW' | 'BH' | 'OM'
  | 'JO' | 'LB' | 'MA' | 'DZ' | 'TN' | 'IQ'
  | 'TR' | 'GB' | 'EU' | 'US' | 'INTL';

export interface LegalRequirement {
  id: string;
  titleAr: string;
  titleEn: string;
  lawRef: string; // المرجع القانوني
  descriptionAr: string;
  descriptionEn: string;
  appliesTo: string[]; // ماذا يمس في المنصة
  penaltyAr: string;
  deadline?: string;
}

export interface Jurisdiction {
  id: JurisdictionId;
  nameAr: string;
  nameEn: string;
  flag: string;
  dataProtection: LegalRequirement[];
  consumer: LegalRequirement[];
  ecommerce: LegalRequirement[];
  ip: LegalRequirement[];
  chemicals: LegalRequirement[];
  tax: LegalRequirement[];
  ai?: LegalRequirement[];
  other: LegalRequirement[];
}

export const JURISDICTIONS: Record<JurisdictionId, Jurisdiction> = {
  EG: {
    id: 'EG',
    nameAr: 'مصر',
    nameEn: 'Egypt',
    flag: '🇪🇬',
    dataProtection: [
      {
        id: 'EG-DP-01',
        titleAr: 'قانون حماية البيانات الشخصية 151/2020',
        titleEn: 'Personal Data Protection Law 151/2020',
        lawRef: 'قانون 151 لسنة 2020، المواد 2، 17، 18',
        descriptionAr: 'يشترط موافقة صريحة قابلة للإثبات، حق الوصول والتصحيح والمسح والنقل، إخطار الخرق خلال 72 ساعة، تعيين مسؤول حماية بيانات إذا المعالجة واسعة',
        descriptionEn: 'Requires explicit demonstrable consent, rights of access/rectification/erasure/portability, 72h breach notification, DPO for large-scale processing',
        appliesTo: ['AuthModal', 'authStorage', 'DataPrivacyModal', 'community/api'],
        penaltyAr: 'غرامة 100 ألف - 5 مليون جنيه، حبس، حجب موقع',
      },
      {
        id: 'EG-DP-02',
        titleAr: 'قانون مكافحة جرائم تقنية المعلومات 175/2018',
        titleEn: 'Anti-Cybercrime Law 175/2018',
        lawRef: 'قانون 175/2018',
        descriptionAr: 'يجرم الوصول غير المشروع، انتحال الهوية، المحتوى المسيء، الابتزاز الإلكتروني',
        descriptionEn: 'Criminalizes unauthorized access, impersonation, abusive content, cyber-extortion',
        appliesTo: ['community/Messenger', 'SocialPortal', 'auth'],
        penaltyAr: 'حبس 2-5 سنوات + غرامة',
      },
    ],
    consumer: [
      {
        id: 'EG-C-01',
        titleAr: 'قانون حماية المستهلك 181/2018',
        titleEn: 'Consumer Protection Law 181/2018',
        lawRef: 'قانون 181/2018، المواد 10، 13، 14',
        descriptionAr: 'حق العدول 14 يوم للبيع عن بعد بدون سبب، ضمان 30 يوم للعيوب، حظر الإعلانات المضللة، إلزامية الفاتورة',
        descriptionEn: '14-day no-reason return for distance sales, 30-day defect warranty, ban on misleading ads, mandatory invoice',
        appliesTo: ['shipping.json', 'products.json', 'Storefront', 'Order'],
        penaltyAr: 'غرامة 10 آلاف - 2 مليون جنيه',
      },
    ],
    ecommerce: [
      {
        id: 'EG-E-01',
        titleAr: 'قانون التوقيع الإلكتروني 15/2004 وتعديلاته',
        titleEn: 'E-Signature Law 15/2004',
        lawRef: 'قانون 15/2004',
        descriptionAr: 'يعترف بالعقود الإلكترونية والتوقيع الإلكتروني، يلزم مقدم الخدمة بحفظ السجلات',
        descriptionEn: 'Recognizes e-contracts and e-signatures, requires service provider record-keeping',
        appliesTo: ['MediationOrder', 'Merchant', 'checkout'],
        penaltyAr: 'بطلان العقد، غرامة',
      },
    ],
    ip: [
      {
        id: 'EG-IP-01',
        titleAr: 'قانون الملكية الفكرية 82/2002',
        titleEn: 'IP Law 82/2002',
        lawRef: 'قانون 82/2002',
        descriptionAr: 'يحمي حقوق المؤلف (50 سنة بعد الوفاة)، العلامات التجارية، براءات الاختراع. النسخ بدون إذن انتهاك',
        descriptionEn: 'Protects copyright (50y p.m.a.), trademarks, patents. Unauthorized copying is infringement',
        appliesTo: ['scraper', 'products.json', 'WorldPerfumesLibrary'],
        penaltyAr: 'حبس + غرامة 5 آلاف - 100 ألف جنيه، تعويض',
      },
    ],
    chemicals: [
      {
        id: 'EG-CH-01',
        titleAr: 'مواصفات قياسية 3794-2008 للعطور + REACH المستوردة',
        titleEn: 'ES 3794-2008 Perfume Standard + REACH for imports',
        lawRef: 'مواصفة قياسية مصرية 3794',
        descriptionAr: 'تحدد نسب الكحول، المعادن الثقيلة، مسببات الحساسية. العطور الكحولية سائل قابل للاشتعال',
        descriptionEn: 'Sets alcohol ratios, heavy metals, allergens. Alcohol perfumes = flammable liquid',
        appliesTo: ['ConcentrationCalculator', 'RawMaterialsEncyclopedia'],
        penaltyAr: 'سحب منتج، غرامة',
      },
    ],
    tax: [
      {
        id: 'EG-T-01',
        titleAr: 'ضريبة القيمة المضافة 14% + الفاتورة الإلكترونية',
        titleEn: 'VAT 14% + E-Invoicing',
        lawRef: 'قانون 67/2016، قرار 188/2019 (EDA)',
        descriptionAr: 'VAT 14% على السلع، إلزامية الفاتورة الإلكترونية للمسجلين، الإقرار الشهري',
        descriptionEn: '14% VAT, mandatory e-invoicing for registrants, monthly filing',
        appliesTo: ['margin.ts', 'Order', 'invoice'],
        penaltyAr: 'غرامة 10 آلاف - 100 ألف جنيه، تهرب ضريبي',
      },
    ],
    other: [
      {
        id: 'EG-OTH-01',
        titleAr: 'قانون الطفل 12/1996 المعدل',
        titleEn: 'Child Law 12/1996',
        lawRef: 'قانون 12/1996',
        descriptionAr: 'حماية الأطفال <18 من المحتوى الضار، حظر جمع بياناتهم بدون ولي',
        descriptionEn: 'Protects <18 from harmful content, bans data collection without guardian',
        appliesTo: ['AuthModal', 'community'],
        penaltyAr: 'حبس + غرامة',
      },
    ],
  },

  SA: {
    id: 'SA',
    nameAr: 'السعودية',
    nameEn: 'Saudi Arabia',
    flag: '🇸🇦',
    dataProtection: [
      {
        id: 'SA-DP-01',
        titleAr: 'نظام حماية البيانات الشخصية PDPL (نفاذ 2024)',
        titleEn: 'PDPL (Enforced 2024)',
        lawRef: 'مرسوم ملكي م/19 2021 المعدل 2023، اللائحة التنفيذية',
        descriptionAr: 'موافقة واضحة منفصلة لكل غرض، حق الوصول والمسح، إخطار خرق 72 ساعة، نقل خارج المملكة بضمانات كافية، تعيين DPO',
        descriptionEn: 'Clear separate consent per purpose, access/erasure, 72h breach notice, cross-border transfer safeguards, DPO',
        appliesTo: ['authStorage', 'DataPrivacyModal', 'community'],
        penaltyAr: 'غرامة حتى 5 مليون ريال، سجن',
      },
    ],
    consumer: [
      {
        id: 'SA-C-01',
        titleAr: 'نظام التجارة الإلكترونية ولائحته 2019',
        titleEn: 'E-Commerce Law 2019 + Regs',
        lawRef: 'نظام التجارة الإلكترونية م/126، اللائحة',
        descriptionAr: 'إلزامية اللغة العربية، عرض السجل التجاري والرقم الضريبي، سياسة استرجاع 7 أيام، معالجة شكاوى، ربط معروف',
        descriptionEn: 'Arabic mandatory, display CR & VAT ID, 7-day return, complaint handling, Maroof link',
        appliesTo: ['Footer', 'shipping.json', 'ProductDetail', 'Merchant'],
        penaltyAr: 'غرامة حتى 1 مليون ريال، إيقاف متجر',
      },
    ],
    ecommerce: [
      {
        id: 'SA-E-01',
        titleAr: 'نظام مكافحة الجرائم المعلوماتية',
        titleEn: 'Anti-Cybercrime Law',
        lawRef: 'نظام مكافحة الجرائم المعلوماتية 1428هـ',
        descriptionAr: 'يجرم اختراق البيانات، التشهير، المحتوى الإباحي/الإرهابي',
        descriptionEn: 'Criminalizes hacking, defamation, porn/terror content',
        appliesTo: ['community', 'Messenger'],
        penaltyAr: 'سجن حتى 5 سنوات + غرامة 3 مليون ريال',
      },
    ],
    ip: [
      {
        id: 'SA-IP-01',
        titleAr: 'نظام العلامات التجارية + حقوق المؤلف',
        titleEn: 'Trademark & Copyright Law',
        lawRef: 'نظام العلامات م/21 1423هـ، نظام حماية حقوق المؤلف',
        descriptionAr: 'حماية العلامات 10 سنوات قابلة للتجديد، حقوق مؤلف 50 سنة',
        descriptionEn: 'Trademark 10y renewable, copyright 50y',
        appliesTo: ['products.json', 'scraper'],
        penaltyAr: 'غرامة حتى 1 مليون ريال، مصادرة',
      },
    ],
    chemicals: [
      {
        id: 'SA-CH-01',
        titleAr: 'لائحة SFDA لمستحضرات التجميل والعطور + SASO SASO 1798',
        titleEn: 'SFDA Cosmetics + SASO 1798',
        lawRef: 'لائحة SFDA، مواصفة SASO 1798 (العطور)',
        descriptionAr: 'تسجيل مستحضرات التجميل في منصة غدي، حظر مواد معينة، وسم المكونات INCI، تحذيرات',
        descriptionEn: 'Register cosmetics in Ghadi, ban certain substances, INCI labeling, warnings',
        appliesTo: ['ConcentrationCalculator', 'RawMaterials'],
        penaltyAr: 'سحب، غرامة، منع استيراد',
      },
    ],
    tax: [
      {
        id: 'SA-T-01',
        titleAr: 'ضريبة القيمة المضافة 15% + الفوترة الإلكترونية ZATCA',
        titleEn: 'VAT 15% + ZATCA E-Invoicing',
        lawRef: 'نظام ضريبة القيمة المضافة، لائحة الفوترة الإلكترونية (فاتورة/ربط)',
        descriptionAr: 'VAT 15%، فوترة إلكترونية إلزامية (مرحلة الربط والتكامل)، غرامات صارمة',
        descriptionEn: '15% VAT, mandatory e-invoicing (Integration phase), strict penalties',
        appliesTo: ['Order', 'invoice'],
        penaltyAr: 'غرامة حتى 50 ألف ريال لكل فاتورة',
      },
    ],
    other: [],
  },

  AE: {
    id: 'AE',
    nameAr: 'الإمارات',
    nameEn: 'UAE',
    flag: '🇦🇪',
    dataProtection: [
      {
        id: 'AE-DP-01',
        titleAr: 'المرسوم بقانون حماية البيانات 45/2021',
        titleEn: 'PDPL Federal Decree 45/2021',
        lawRef: 'مرسوم 45/2021',
        descriptionAr: 'موافقة صريحة، حق الاعتراض والمسح، إخطار خرق 72 ساعة، عقوبات جنائية',
        descriptionEn: 'Explicit consent, objection/erasure, 72h breach, criminal penalties',
        appliesTo: ['authStorage', 'DataPrivacyModal'],
        penaltyAr: 'غرامة 50 ألف - 500 ألف درهم',
      },
    ],
    consumer: [
      {
        id: 'AE-C-01',
        titleAr: 'قانون حماية المستهلك 46/2021 (2023)',
        titleEn: 'Consumer Protection Decree 46/2021',
        lawRef: 'مرسوم 46/2021',
        descriptionAr: 'حظر ممارسات احتكارية/مضللة، ضمان، حق إرجاع، لجنة فض منازعات',
        descriptionEn: 'Ban on monopoly/misleading, warranty, return, dispute committee',
        appliesTo: ['products.json', 'shipping.json'],
        penaltyAr: 'غرامة حتى 2 مليون درهم',
      },
    ],
    ecommerce: [
      {
        id: 'AE-E-01',
        titleAr: 'قانون المعاملات والتجارة الإلكترونية 45/2022',
        titleEn: 'E-Transactions & E-Commerce Law 45/2022',
        lawRef: 'مرسوم 46/2022',
        descriptionAr: 'اعتراف بالعقود الإلكترونية، حماية بيانات الدفع',
        descriptionEn: 'E-contracts recognized, payment data protection',
        appliesTo: ['Order', 'PaymentEnvironmentModal'],
        penaltyAr: 'غرامة',
      },
    ],
    ip: [{ id: 'AE-IP-01', titleAr: 'قانون حقوق المؤلف والعلامات', titleEn: 'Copyright & Trademark Law', lawRef: 'مرسوم 38/2021', descriptionAr: 'حماية شاملة', descriptionEn: 'Comprehensive protection', appliesTo: ['scraper'], penaltyAr: 'غرامة + حبس' }],
    chemicals: [
      {
        id: 'AE-CH-01',
        titleAr: 'مواصفات ESMA للعطور + GSO 1798',
        titleEn: 'ESMA Perfume Specs + GSO 1798',
        lawRef: 'GSO 1798، ESMA',
        descriptionAr: 'مواصفات خليجية موحدة للعطور، وسم INCI',
        descriptionEn: 'GCC unified perfume specs, INCI labeling',
        appliesTo: ['RawMaterials'],
        penaltyAr: 'سحب',
      },
    ],
    tax: [
      {
        id: 'AE-T-01',
        titleAr: 'ضريبة القيمة المضافة 5%',
        titleEn: 'VAT 5%',
        lawRef: 'مرسوم 8/2017 VAT',
        descriptionAr: 'VAT 5%، تسجيل إلزامي >375 ألف درهم',
        descriptionEn: '5% VAT, mandatory >375k AED',
        appliesTo: ['Order'],
        penaltyAr: 'غرامة حتى 50 ألف درهم',
      },
    ],
    other: [],
  },

  QA: {
    id: 'QA',
    nameAr: 'قطر',
    nameEn: 'Qatar',
    flag: '🇶🇦',
    dataProtection: [{ id: 'QA-DP-01', titleAr: 'قانون حماية البيانات 13/2016', titleEn: 'Data Protection Law 13/2016', lawRef: 'قانون 13/2016', descriptionAr: 'موافقة، حق وصول/تصحيح/مسح', descriptionEn: 'Consent, access/rectification/erasure', appliesTo: ['auth'], penaltyAr: 'غرامة حتى 1 مليون ريال' }],
    consumer: [], ecommerce: [], ip: [], chemicals: [], tax: [],
    other: [],
  },
  KW: {
    id: 'KW',
    nameAr: 'الكويت',
    nameEn: 'Kuwait',
    flag: '🇰🇼',
    dataProtection: [{ id: 'KW-DP-01', titleAr: 'قانون حماية البيانات (مشروع 2024)', titleEn: 'Data Protection (Draft 2024)', lawRef: 'مشروع قانون', descriptionAr: 'قيد التشريع، يطبق مبادئ GDPR', descriptionEn: 'Draft, GDPR principles', appliesTo: ['auth'], penaltyAr: 'غرامة' }],
    consumer: [], ecommerce: [], ip: [], chemicals: [], tax: [],
    other: [],
  },
  BH: {
    id: 'BH',
    nameAr: 'البحرين',
    nameEn: 'Bahrain',
    flag: '🇧🇭',
    dataProtection: [{ id: 'BH-DP-01', titleAr: 'قانون حماية البيانات 30/2018', titleEn: 'PDPL 30/2018', lawRef: 'قانون 30/2018', descriptionAr: 'موافقة، حقوق، نقل دولي', descriptionEn: 'Consent, rights, cross-border', appliesTo: ['auth'], penaltyAr: 'غرامة حتى 20 ألف دينار' }],
    consumer: [], ecommerce: [], ip: [], chemicals: [], tax: [{ id: 'BH-T-01', titleAr: 'VAT 10%', titleEn: 'VAT 10%', lawRef: 'VAT Law', descriptionAr: 'VAT 10% منذ 2022', descriptionEn: '10% VAT since 2022', appliesTo: ['Order'], penaltyAr: 'غرامة' }],
    other: [],
  },
  OM: {
    id: 'OM',
    nameAr: 'عمان',
    nameEn: 'Oman',
    flag: '🇴🇲',
    dataProtection: [{ id: 'OM-DP-01', titleAr: 'قانون حماية البيانات 6/2022', titleEn: 'PDPL 6/2022', lawRef: 'مرسوم 6/2022', descriptionAr: 'موافقة، DPO، نقل', descriptionEn: 'Consent, DPO, transfer', appliesTo: ['auth'], penaltyAr: 'غرامة حتى 500 ألف ريال' }],
    consumer: [], ecommerce: [], ip: [], chemicals: [], tax: [{ id: 'OM-T-01', titleAr: 'VAT 5%', titleEn: 'VAT 5%', lawRef: 'VAT Law 2020', descriptionAr: 'VAT 5%', descriptionEn: '5% VAT', appliesTo: ['Order'], penaltyAr: 'غرامة' }],
    other: [],
  },
  JO: { id: 'JO', nameAr: 'الأردن', nameEn: 'Jordan', flag: '🇯🇴', dataProtection: [], consumer: [], ecommerce: [], ip: [], chemicals: [], tax: [], other: [] },
  LB: { id: 'LB', nameAr: 'لبنان', nameEn: 'Lebanon', flag: '🇱🇧', dataProtection: [{ id: 'LB-DP-01', titleAr: 'قانون المعاملات الإلكترونية 81/2018', titleEn: 'E-Transactions Law 81/2018', lawRef: 'قانون 81/2018', descriptionAr: 'حماية بيانات، توقيع إلكتروني', descriptionEn: 'Data protection, e-signature', appliesTo: ['auth'], penaltyAr: 'غرامة' }], consumer: [], ecommerce: [], ip: [], chemicals: [], tax: [], other: [] },
  MA: { id: 'MA', nameAr: 'المغرب', nameEn: 'Morocco', flag: '🇲🇦', dataProtection: [{ id: 'MA-DP-01', titleAr: 'قانون 09-08 حماية المعطيات', titleEn: 'Law 09-08 Data Protection', lawRef: 'قانون 09-08', descriptionAr: 'موافقة، حقوق، إخطار CNDP', descriptionEn: 'Consent, rights, CNDP notification', appliesTo: ['auth'], penaltyAr: 'سجن + غرامة' }], consumer: [], ecommerce: [], ip: [], chemicals: [], tax: [], other: [] },
  DZ: { id: 'DZ', nameAr: 'الجزائر', nameEn: 'Algeria', flag: '🇩🇿', dataProtection: [{ id: 'DZ-DP-01', titleAr: 'قانون 18-07 حماية المعطيات', titleEn: 'Law 18-07', lawRef: 'قانون 18-07', descriptionAr: 'موافقة، حقوق', descriptionEn: 'Consent, rights', appliesTo: ['auth'], penaltyAr: 'غرامة' }], consumer: [], ecommerce: [], ip: [], chemicals: [], tax: [], other: [] },
  TN: { id: 'TN', nameAr: 'تونس', nameEn: 'Tunisia', flag: '🇹🇳', dataProtection: [{ id: 'TN-DP-01', titleAr: 'قانون 2004-63 حماية المعطيات', titleEn: 'Law 2004-63', lawRef: 'قانون 2004', descriptionAr: 'موافقة، INPDP', descriptionEn: 'Consent, INPDP', appliesTo: ['auth'], penaltyAr: 'غرامة' }], consumer: [], ecommerce: [], ip: [], chemicals: [], tax: [], other: [] },
  IQ: { id: 'IQ', nameAr: 'العراق', nameEn: 'Iraq', flag: '🇮🇶', dataProtection: [], consumer: [], ecommerce: [], ip: [], chemicals: [], tax: [], other: [] },
  TR: {
    id: 'TR',
    nameAr: 'تركيا',
    nameEn: 'Türkiye',
    flag: '🇹🇷',
    dataProtection: [{ id: 'TR-DP-01', titleAr: 'KVKK قانون حماية البيانات 6698', titleEn: 'KVKK Law 6698', lawRef: 'قانون 6698', descriptionAr: 'موافقة صريحة، تسجيل VERBIS، حقوق', descriptionEn: 'Explicit consent, VERBIS, rights', appliesTo: ['auth'], penaltyAr: 'غرامة حتى 2 مليون ليرة' }],
    consumer: [],
    ecommerce: [{ id: 'TR-E-01', titleAr: 'قانون التجارة الإلكترونية 6563', titleEn: 'E-Commerce Law 6563', lawRef: 'قانون 6563', descriptionAr: 'التزامات مقدم الخدمة', descriptionEn: 'Service provider duties', appliesTo: ['Order'], penaltyAr: 'غرامة' }],
    ip: [], chemicals: [], tax: [], other: [],
  },
  GB: {
    id: 'GB',
    nameAr: 'بريطانيا',
    nameEn: 'United Kingdom',
    flag: '🇬🇧',
    dataProtection: [{ id: 'GB-DP-01', titleAr: 'UK GDPR + Data Protection Act 2018', titleEn: 'UK GDPR + DPA 2018', lawRef: 'UK GDPR', descriptionAr: 'موافقة، حقوق، ICO', descriptionEn: 'Consent, rights, ICO', appliesTo: ['auth'], penaltyAr: 'غرامة حتى £17.5M أو 4%' }],
    consumer: [{ id: 'GB-C-01', titleAr: 'حماية المستهلك من التداول غير العادل 2008', titleEn: 'Consumer Protection 2008', lawRef: 'CPUT 2008', descriptionAr: 'حظر تضليل', descriptionEn: 'Misleading ban', appliesTo: ['products'], penaltyAr: 'غرامة' }],
    ecommerce: [], ip: [], chemicals: [], tax: [{ id: 'GB-T-01', titleAr: 'VAT 20%', titleEn: 'VAT 20%', lawRef: 'VAT Act 1994', descriptionAr: 'VAT 20%، £85k threshold', descriptionEn: '20% VAT', appliesTo: ['Order'], penaltyAr: 'غرامة' }], other: [],
  },
  EU: {
    id: 'EU',
    nameAr: 'الاتحاد الأوروبي',
    nameEn: 'European Union',
    flag: '🇪🇺',
    dataProtection: [
      {
        id: 'EU-DP-01',
        titleAr: 'اللائحة العامة لحماية البيانات GDPR',
        titleEn: 'GDPR (2016/679)',
        lawRef: 'Regulation (EU) 2016/679، المواد 5-7، 12-22، 33-34',
        descriptionAr: 'مبادئ: قانونية/شفافية/تقليل/دقة/تحديد/سلامة/مساءلة. حقوق: وصول/تصحيح/مسح/تقييد/نقل/اعتراض. إخطار خرق 72 ساعة. غرامة حتى 20M€ أو 4% الإيرادات',
        descriptionEn: 'Principles: lawfulness/transparency/minimisation/accuracy/limitation/integrity/accountability. Rights: access/rectify/erase/restrict/portability/object. 72h breach. Fine up to €20M or 4%',
        appliesTo: ['كل المنصة'],
        penaltyAr: 'غرامة حتى 20 مليون € أو 4% الإيرادات العالمية السنوية (الأعلى)',
      },
      {
        id: 'EU-DP-02',
        titleAr: 'توجيه ePrivacy (Cookies)',
        titleEn: 'ePrivacy Directive 2002/58',
        lawRef: 'Directive 2002/58',
        descriptionAr: 'يشترط موافقة مسبقة قبل تخزين/وصول أي كوكيز غير ضروري',
        descriptionEn: 'Requires prior consent for non-essential cookies',
        appliesTo: ['DataPrivacyModal', 'localStorage'],
        penaltyAr: 'غرامة وطنية (مثل فرنسا CNIL حتى 4% )',
      },
    ],
    consumer: [
      {
        id: 'EU-C-01',
        titleAr: 'توجيه حقوق المستهلك 2011/83 + توجيه البيع عن بعد',
        titleEn: 'Consumer Rights Directive 2011/83',
        lawRef: 'Directive 2011/83/EU',
        descriptionAr: '14 يوم حق انسحاب بدون سبب للبيع عن بعد، استثناء للسلع الصحية المختومة المفتوحة (العطور المفتوحة لا تُرجع)',
        descriptionEn: '14-day withdrawal for distance sales, exception for sealed health goods once unsealed (opened perfumes non-returnable)',
        appliesTo: ['shipping.json', 'Order'],
        penaltyAr: 'عقد باطل، غرامة وطنية',
      },
    ],
    ecommerce: [
      {
        id: 'EU-E-01',
        titleAr: 'قانون الخدمات الرقمية DSA',
        titleEn: 'Digital Services Act (2022/2065)',
        lawRef: 'Regulation (EU) 2022/2065',
        descriptionAr: 'يلزم المنصات بآلية إبلاغ وإزالة محتوى غير قانوني، شفافية خوارزميات، حماية قاصرين',
        descriptionEn: 'Requires notice-and-action, recommender transparency, minor protection',
        appliesTo: ['community', 'Messenger', 'SocialPortal'],
        penaltyAr: 'غرامة حتى 6% الإيرادات',
      },
      {
        id: 'EU-E-02',
        titleAr: 'قانون الأسواق الرقمية DMA',
        titleEn: 'Digital Markets Act',
        lawRef: 'Regulation (EU) 2022/1925',
        descriptionAr: 'يلزم حراس البوابة (Gatekeepers) بالتشغيل البيني، حظر تفضيل ذاتي',
        descriptionEn: 'Gatekeepers: interoperability, no self-preferencing',
        appliesTo: ['Storefront'],
        penaltyAr: 'غرامة حتى 10% الإيرادات',
      },
    ],
    ip: [
      {
        id: 'EU-IP-01',
        titleAr: 'توجيه قواعد البيانات 96/9/EC',
        titleEn: 'Database Directive 96/9/EC',
        lawRef: 'Directive 96/9/EC',
        descriptionAr: 'يحمي قواعد البيانات حتى لو الحقائق غير محمية — Scraping قاعدة منتجات محمية انتهاك',
        descriptionEn: 'Protects databases sui generis — scraping a protected product DB is infringement',
        appliesTo: ['scraper'],
        penaltyAr: 'دعوى مدنية، حظر',
      },
    ],
    chemicals: [
      {
        id: 'EU-CH-01',
        titleAr: 'لائحة مستحضرات التجميل 1223/2009 (تنطبق على العطور)',
        titleEn: 'Cosmetics Regulation 1223/2009',
        lawRef: 'Regulation (EC) 1223/2009',
        descriptionAr: 'تحدد مواد محظورة/مقيدة، وسم 26 allergen، ملف معلومات المنتج PIF، شخص مسؤول',
        descriptionEn: 'Banned/restricted substances, 26 allergens labeling, PIF, Responsible Person',
        appliesTo: ['RawMaterialsEncyclopedia', 'ConcentrationCalculator'],
        penaltyAr: 'سحب منتج، غرامة وطنية، حظر',
      },
      {
        id: 'EU-CH-02',
        titleAr: 'REACH 1907/2006 + CLP 1272/2008',
        titleEn: 'REACH + CLP',
        lawRef: 'Regulations 1907/2006, 1272/2008',
        descriptionAr: 'تسجيل المواد >1 طن، تصنيف/وسم مخاطر (GHS). العطور = خليط كيميائي',
        descriptionEn: 'Register >1t substances, GHS classification/labeling. Perfumes = chemical mixture',
        appliesTo: ['RawMaterials'],
        penaltyAr: 'منع تسويق، غرامة',
      },
      {
        id: 'EU-CH-03',
        titleAr: 'معايير IFRA 51st Amendment (2024)',
        titleEn: 'IFRA Standards 51st',
        lawRef: 'IFRA Standards Library 2024',
        descriptionAr: 'حدود لـ 200+ مادة (Citral 1.6%، Oakmoss...). مرجع قضائي للسلامة',
        descriptionEn: 'Limits for 200+ substances (Citral 1.6%...). Judicial safety reference',
        appliesTo: ['ConcentrationCalculator', 'PyramidCalculator'],
        penaltyAr: 'مسؤولية مدنية إذا تجاوزت',
      },
    ],
    tax: [
      {
        id: 'EU-T-01',
        titleAr: 'VAT + OSS/IOSS + DAC7',
        titleEn: 'VAT + OSS/IOSS + DAC7',
        lawRef: 'VAT Directive 2006/112، OSS Regulation',
        descriptionAr: 'VAT متفاوت (20% فرنسا/ألمانيا...)، OSS للبيع عن بعد >10k€، IOSS <150€، DAC7 إبلاغ عن البائعين',
        descriptionEn: 'VAT varies, OSS >€10k, IOSS <€150, DAC7 seller reporting',
        appliesTo: ['Order', 'Merchant'],
        penaltyAr: 'غرامة + فوائد',
      },
    ],
    ai: [
      {
        id: 'EU-AI-01',
        titleAr: 'قانون الذكاء الاصطناعي AI Act 2024/1689',
        titleEn: 'AI Act 2024/1689',
        lawRef: 'Regulation (EU) 2024/1689، المادة 50',
        descriptionAr: 'شفافية إلزامية: وسم المحتوى المولد AI، سجل، إشراف بشري. غرامة حتى 15M€ أو 3%',
        descriptionEn: 'Mandatory transparency: label AI content, logs, human oversight. Fine up to €15M or 3%',
        appliesTo: ['Shaheen', 'PerfumerAIChatbot', 'server/core/engines'],
        penaltyAr: 'غرامة حتى 15 مليون € أو 3% الإيرادات',
      },
    ],
    other: [
      {
        id: 'EU-OTH-01',
        titleAr: 'قانون الإتاحة الأوروبي EAA 2025 + WCAG 2.2 AA',
        titleEn: 'European Accessibility Act 2025',
        lawRef: 'Directive (EU) 2019/882',
        descriptionAr: 'يلزم المتاجر الإلكترونية بالإتاحة (قارئ شاشة، تباين، لوحة مفاتيح) بحلول يونيو 2025',
        descriptionEn: 'E-shops must be accessible (screen reader, contrast, keyboard) by June 2025',
        appliesTo: ['كل الواجهة'],
        penaltyAr: 'حظر بيع، غرامة وطنية',
      },
    ],
  },
  US: {
    id: 'US',
    nameAr: 'الولايات المتحدة',
    nameEn: 'United States',
    flag: '🇺🇸',
    dataProtection: [
      {
        id: 'US-DP-01',
        titleAr: 'CCPA/CPRA كاليفورنيا + قوانين ولايات',
        titleEn: 'CCPA/CPRA + State Laws',
        lawRef: 'Cal. Civ. Code 1798.100',
        descriptionAr: 'حق معرفة/حذف/عدم بيع، إخطار خرق، غرامة حتى $7,500/violation',
        descriptionEn: 'Right to know/delete/do-not-sell, breach notice, up to $7,500/violation',
        appliesTo: ['auth', 'community'],
        penaltyAr: 'غرامة حتى $7,500 لكل انتهاك (قد تتراكم لملايين)',
      },
      {
        id: 'US-DP-02',
        titleAr: 'COPPA أطفال <13',
        titleEn: 'COPPA <13',
        lawRef: '15 U.S.C. 6501',
        descriptionAr: 'حظر جمع بيانات <13 بدون موافقة والدين قابلة للتحقق',
        descriptionEn: 'Ban on collecting <13 data without verifiable parental consent',
        appliesTo: ['AuthModal'],
        penaltyAr: 'غرامة حتى $50,000/violation (FTC)',
      },
    ],
    consumer: [
      {
        id: 'US-C-01',
        titleAr: 'قانون FTC ضد الممارسات الخادعة + FPLA',
        titleEn: 'FTC Act §5 + FPLA',
        lawRef: '15 U.S.C. 45، 15 U.S.C. 1451',
        descriptionAr: 'حظر إعلانات مضللة، وسم عادل (وزن/حجم/مكونات)',
        descriptionEn: 'Ban deceptive ads, fair packaging (weight/volume/ingredients)',
        appliesTo: ['products.json', 'ProductDetail'],
        penaltyAr: 'FTC enforcement، دعاوى جماعية',
      },
      {
        id: 'US-C-02',
        titleAr: 'CAN-SPAM (بريد/واتساب تسويقي)',
        titleEn: 'CAN-SPAM',
        lawRef: '15 U.S.C. 7701',
        descriptionAr: 'يشترط opt-in، عنوان فعلي، رابط إلغاء، عدم تضليل العنوان',
        descriptionEn: 'Requires opt-in, physical address, unsubscribe, no deceptive headers',
        appliesTo: ['emailNotifications', 'MerchantChannels'],
        penaltyAr: 'غرامة حتى $50,000/email',
      },
      {
        id: 'US-C-03',
        titleAr: 'CA Prop 65 تحذير مواد مسرطنة',
        titleEn: 'CA Prop 65',
        lawRef: 'Cal. Health & Safety 25249.6',
        descriptionAr: 'يجب تحذير كاليفورنيا إذا منتج يحتوي مواد مسرطنة/تناسلية (بعض مذيبات عطور)',
        descriptionEn: 'Requires warning if product contains carcinogen/reproductive toxicant',
        appliesTo: ['RawMaterials'],
        penaltyAr: 'دعوى جماعية كاليفورنيا، تسوية $10k-100k',
      },
    ],
    ecommerce: [],
    ip: [
      {
        id: 'US-IP-01',
        titleAr: 'CFAA + DMCA + Lanham (علامات)',
        titleEn: 'CFAA + DMCA + Lanham',
        lawRef: '18 U.S.C. 1030، 17 U.S.C. 1201، 15 U.S.C. 1125',
        descriptionAr: 'يجرم الوصول غير المصرح (Scraping رغم حظر ToS قد يخالف)، يحمي DMCA، العلامات',
        descriptionEn: 'Criminalizes unauthorized access (scraping despite ToS may violate), DMCA, trademarks',
        appliesTo: ['scraper', 'products.json'],
        penaltyAr: 'دعوى مدنية + جنائية، تعويض حتى $150k/work (willful)',
      },
    ],
    chemicals: [
      {
        id: 'US-CH-01',
        titleAr: 'FDA FD&C Act مستحضرات تجميل + FPLA',
        titleEn: 'FDA Cosmetics + FPLA',
        lawRef: '21 U.S.C. 361-363، MoCRA 2022',
        descriptionAr: 'العطور = مستحضرات تجميل، يجب تسجيل منشأة + منتج (MoCRA 2023)، وسم مكونات، حظر ضار',
        descriptionEn: 'Perfumes = cosmetics, must register facility+product (MoCRA 2023), ingredient labeling, ban adulterated',
        appliesTo: ['ConcentrationCalculator'],
        penaltyAr: 'سحب FDA، حظر استيراد',
      },
    ],
    tax: [
      {
        id: 'US-T-01',
        titleAr: 'Sales Tax ولايات + de minimis $800',
        titleEn: 'State Sales Tax + de minimis $800',
        lawRef: 'South Dakota v. Wayfair، 19 USC 1321',
        descriptionAr: 'ضريبة مبيعات ولاية إذا nexus، إعفاء جمركي < $800 (يتغير)',
        descriptionEn: 'State sales tax if nexus, customs exemption <$800 (changing)',
        appliesTo: ['Order', 'shipping.json'],
        penaltyAr: 'التزام ضريبي',
      },
    ],
    other: [
      {
        id: 'US-OTH-01',
        titleAr: 'ADA Title II/III إتاحة',
        titleEn: 'ADA Accessibility',
        lawRef: '42 U.S.C. 12101',
        descriptionAr: 'المواقع = أماكن عامة، يجب WCAG 2.1 AA',
        descriptionEn: 'Websites = public accommodations, must be WCAG 2.1 AA',
        appliesTo: ['كل الواجهة'],
        penaltyAr: 'دعوى جماعية، تسوية $10k-100k',
      },
    ],
  },
  INTL: {
    id: 'INTL',
    nameAr: 'دولي',
    nameEn: 'International',
    flag: '🌍',
    dataProtection: [],
    consumer: [],
    ecommerce: [],
    ip: [
      {
        id: 'INTL-IP-01',
        titleAr: 'اتفاقية برن + TRIPS (ويبو)',
        titleEn: 'Berne + TRIPS (WIPO)',
        lawRef: 'Berne Convention 1886، TRIPS 1994',
        descriptionAr: 'حماية حقوق مؤلف 50-70 سنة، حماية علامات، إنفاذ عبر WTO',
        descriptionEn: 'Copyright 50-70y, trademark protection, WTO enforcement',
        appliesTo: ['scraper', 'products'],
        penaltyAr: 'حظر تجاري، تعويض دولي',
      },
      {
        id: 'INTL-IP-02',
        titleAr: 'نظام مدريد للعلامات',
        titleEn: 'Madrid System',
        lawRef: 'Madrid Agreement/Protocol',
        descriptionAr: 'تسجيل علامة دولي — استخدام Lattafa/Dior بدون ترخيص تعدٍ في 130 دولة',
        descriptionEn: 'International trademark registration — using Lattafa/Dior without license infringes in 130 states',
        appliesTo: ['products.json'],
        penaltyAr: 'حظر استخدام',
      },
    ],
    chemicals: [
      {
        id: 'INTL-CH-01',
        titleAr: 'IATA DGR — UN1266 عطور',
        titleEn: 'IATA DGR — UN1266 Perfumery',
        lawRef: 'IATA Dangerous Goods Regulations، UN1266 (Class 3, PG II/III)',
        descriptionAr: 'العطور = سائل قابل للاشتعال، شحن جوي محدود: 60L per package (Cargo Aircraft), 5L (Passenger), Excepted Quantity E1',
        descriptionEn: 'Perfumes = flammable liquid, air limited: 60L Cargo, 5L Passenger, EQ E1',
        appliesTo: ['shipping.json', 'Order'],
        penaltyAr: 'مصادرة شحنة، غرامة ناقل $10k-100k، مسؤولية جنائية',
      },
      {
        id: 'INTL-CH-02',
        titleAr: 'IFRA Standards 51st + CITES (عود)',
        titleEn: 'IFRA 51st + CITES (Oud)',
        lawRef: 'IFRA Standards Library, CITES Appendix II (Aquilaria)',
        descriptionAr: 'حدود 200+ مادة، خشب العود مهدد (CITES) يحتاج تصريح استيراد/تصدير',
        descriptionEn: 'Limits for 200+ substances, agarwood threatened (CITES) needs permit',
        appliesTo: ['RawMaterials', 'products.json'],
        penaltyAr: 'مصادرة جمركية، مسؤولية',
      },
    ],
    tax: [
      {
        id: 'INTL-T-01',
        titleAr: 'WTO Trade Facilitation + GCC Customs + EU UCC',
        titleEn: 'WTO TFA + GCC Customs + EU UCC',
        lawRef: 'WTO TFA 2017، GCC Common Customs Law، EU UCC',
        descriptionAr: 'إجراءات جمركية، رسوم، منشأ. العميل يتحمل الرسوم إذا غير مفصح',
        descriptionEn: 'Customs procedures, duties, origin. Customer liable if not disclosed',
        appliesTo: ['shipping.json'],
        penaltyAr: 'احتجاز جمركي',
      },
    ],
    other: [
      {
        id: 'INTL-OTH-01',
        titleAr: 'عقوبات OFAC/EU/UN',
        titleEn: 'OFAC/EU/UN Sanctions',
        lawRef: 'OFAC SDN List، EU Sanctions Map',
        descriptionAr: 'حظر بيع لبلدان/أشخاص خاضعين لعقوبات (سوريا، إيران، كوريا الشمالية، روسيا لبعض السلع)',
        descriptionEn: 'Ban sales to sanctioned countries/persons (Syria, Iran, NK, Russia for dual-use)',
        appliesTo: ['Merchant', 'Order', 'shipping.json'],
        penaltyAr: 'غرامة حتى $20M، سجن (أمريكا)',
      },
      {
        id: 'INTL-OTH-02',
        titleAr: 'WCAG 2.2 AA إتاحة دولية',
        titleEn: 'WCAG 2.2 AA',
        lawRef: 'W3C WCAG 2.2',
        descriptionAr: 'معيار إتاحة عالمي أصبح ملزمًا في EU/US',
        descriptionEn: 'Global accessibility standard now mandatory in EU/US',
        appliesTo: ['كل الواجهة'],
        penaltyAr: 'دعوى، حظر',
      },
    ],
  },
};

export function allRequirements(): LegalRequirement[] {
  return Object.values(JURISDICTIONS).flatMap((j) => [
    ...j.dataProtection,
    ...j.consumer,
    ...j.ecommerce,
    ...j.ip,
    ...j.chemicals,
    ...j.tax,
    ...j.ai ?? [],
    ...j.other,
  ]);
}

export function requirementsForCountry(code: string): LegalRequirement[] {
  const j = JURISDICTIONS[code as JurisdictionId];
  if (!j) return [];
  return [...j.dataProtection, ...j.consumer, ...j.ecommerce, ...j.ip, ...j.chemicals, ...j.tax, ...(j.ai ?? []), ...j.other];
}

export const COUNTRY_NAMES: Record<string, string> = {
  EG: 'مصر', SA: 'السعودية', AE: 'الإمارات', QA: 'قطر', KW: 'الكويت', BH: 'البحرين', OM: 'عمان',
  JO: 'الأردن', LB: 'لبنان', MA: 'المغرب', DZ: 'الجزائر', TN: 'تونس', IQ: 'العراق',
  TR: 'تركيا', GB: 'بريطانيا', FR: 'فرنسا', DE: 'ألمانيا', US: 'أمريكا',
};
