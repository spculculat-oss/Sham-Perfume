/**
 * Country payment directory for Sham Bank.
 * A row is a name the owner can adopt as a plan. It is not a live charge,
 * a stored card, or a Payoneer instruction.
 * Researched 2026-10-20. Unknown local brands are left unnamed on purpose.
 */
import countryCurrency from '../data/country-currency.json';
import { WORLD_COUNTRIES } from '../data/worldCountries';
import { PAYMENT_CATALOG } from '../finance/paymentCatalog';

export const DIRECTORY_RESEARCHED_AT = '2026-10-20';

export const DIRECTORY_SOURCES = {
  gcc: 'https://www.qcb.gov.qa/en/pages/electronicpaymentsandsettlementssystems-2.aspx',
  mena: 'https://www.checkout.com/blog/master-payments-mena-saudi-arabia',
  himyan: 'https://www.spa.gov.sa/en/N2677039',
  jordan: 'https://cashx.id/map/',
  algeria: 'https://www.centeem.com/en/blog/paiement-mobile-algerie-2026',
  stripe: 'https://docs.stripe.com/payments/payment-methods/payment-method-support',
} as const;

export type PayWave = 'mena' | 'world';
export type PayKind = 'card' | 'wallet' | 'bank' | 'bnpl' | 'cash';
export type PayWeight = 'required' | 'common' | 'optional' | 'blocked';
export type PayRegion = 'mena' | 'europe' | 'americas' | 'asia' | 'africa' | 'oceania' | 'other';

export interface PayMethod {
  id: string;
  nameAr: string;
  nameEn: string;
  kind: PayKind;
  weight: PayWeight;
  adoptable: boolean;
  noteAr: string;
  noteEn: string;
  source: string;
}

export interface CountryPay {
  code: string;
  nameAr: string;
  nameEn: string;
  flag: string;
  currency: string;
  wave: PayWave;
  region: PayRegion;
  /** False means Sham will not adopt a rail. The row stays visible so the gap is explicit. */
  adoptable: boolean;
  restricted: boolean;
  methods: PayMethod[];
}

interface LocalDef {
  id: string;
  nameAr: string;
  nameEn: string;
  kind: PayKind;
  weight: PayWeight;
  countries: string[];
  noteAr: string;
  noteEn: string;
  source: string;
  adoptable?: boolean;
}

const CURRENCIES = countryCurrency as Record<string, string>;

/** Comprehensive sanctions / no lawful international acquiring path for this platform. */
const BLOCKED = new Set(['IR', 'SY', 'KP', 'CU']);
/** International cards are not a reliable Sham checkout. Catalogued, not adoptable. */
const FRAGILE = new Set(['LY', 'YE', 'SD', 'RU', 'BY']);

export const MENA_ORDER = ['SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO', 'LB', 'PS', 'IQ', 'EG', 'MA', 'DZ', 'TN', 'LY', 'YE', 'SD', 'TR', 'IL', 'IR', 'SY'];

const GLOBAL_NOTE_AR = 'شبكة عالمية مألوفة للعميل. الاسم مش بوابة، والقبول محتاج عقد تحصيل للدولة دي. شام مش بيخصم الكارت.';
const GLOBAL_NOTE_EN = 'A familiar global network. The name is not a gateway. Acceptance needs an acquiring contract for this country. Sham does not charge the card.';

const local = (
  id: string, nameAr: string, nameEn: string, kind: PayKind, weight: PayWeight, countries: string,
  noteAr: string, noteEn: string, source: string, adoptable = true,
): LocalDef => ({ id, nameAr, nameEn, kind, weight, countries: countries.split(' '), noteAr, noteEn, source, adoptable });

const MENA_LOCAL: LocalDef[] = [
  local('mada', 'مدى', 'mada', 'card', 'required', 'SA',
    'شبكة الخصم المحلية الغالبة في السعودية. كارت دولي لوحده مش كفاية للعميل المحلي.',
    'The dominant Saudi domestic debit scheme. An international card alone misses most local customers.', 'mena'),
  local('stcpay', 'STC Pay', 'STC Pay', 'wallet', 'common', 'SA',
    'محفظة منتشرة. الربط بعقد محلي، مش من حساب بايونير.',
    'A widely used wallet. It needs a local contract, not a Payoneer account.', 'mena'),
  local('tabby_tamara', 'تابي / تمارا', 'Tabby / Tamara', 'bnpl', 'optional', 'SA AE',
    'تقسيط اختياري بعد عقد كل شبكة. مش تحصيل فوري.',
    'Optional instalments after each network’s own contract. Not instant collection.', 'mena'),
  local('knet', 'كي نت', 'KNET', 'card', 'required', 'KW',
    'شبكة الخصم المحلية في الكويت. من غيرها أغلب الدفع المحلي مش هيعدّي.',
    'Kuwait’s domestic debit network. Without it, most local payments will not complete.', 'mena'),
  local('benefit', 'بنفت', 'Benefit', 'card', 'required', 'BH',
    'شبكة الخصم المحلية في البحرين.',
    'Bahrain’s domestic debit network.', 'mena'),
  local('benefitpay', 'بنفت باي', 'BenefitPay', 'wallet', 'common', 'BH',
    'محفظة بنفت. عقد منفصل عن فيزا.',
    'Benefit’s wallet. A separate contract from Visa.', 'mena'),
  local('naps_qpay', 'نابس / كيو باي', 'NAPS / QPay', 'card', 'required', 'QA',
    'مفتاح الدفع المحلي في قطر. كيو باي بوابة التجارة على نابس.',
    'Qatar’s domestic switch. QPay is the e-commerce gateway on NAPS.', 'gcc'),
  local('himyan', 'هميان', 'Himyan', 'card', 'common', 'QA',
    'كارت قطر الوطني. القبول الإلكتروني حسب المستحوذ، ومش تلقائي.',
    'Qatar’s national debit card. Online acceptance depends on the acquirer and is not automatic.', 'himyan'),
  local('omannet', 'عُمان نت', 'OmanNet', 'card', 'required', 'OM',
    'شبكة الخصم المحلية في عُمان. أغلب كروت الخصم المحلية بتمر منها.',
    'Oman’s domestic debit switch. Most local debit cards route through it.', 'mena'),
  local('cliq', 'كليك', 'CliQ', 'bank', 'common', 'JO',
    'تحويل فوري بالاسم المستعار من جوباك. مش رقم حساب يتكتب عندنا.',
    'JoPACC instant transfer by alias. No account number is stored here.', 'jordan'),
  local('efawateercom', 'إي فواتيركم', 'eFAWATEERcom', 'bank', 'optional', 'JO',
    'دفع فواتير أكثر من سلة متجر. يُراجع قبل الاعتماد.',
    'Better suited to bills than a store cart. Confirm before adoption.', 'jordan'),
  local('zain_orange', 'زين كاش / أورنج ماني', 'Zain Cash / Orange Money', 'wallet', 'common', 'JO',
    'محافظ أردنية. كل محفظة عقد لوحدها.',
    'Jordanian wallets. Each brand needs its own contract.', 'jordan'),
  local('meeza', 'ميزة', 'Meeza', 'card', 'common', 'EG',
    'خصم محلي مصري. مسار عميل، مش محفظة مكسب المنصة.',
    'Egyptian domestic debit. A customer path, not the platform profit wallet.', 'stripe'),
  local('instapay', 'إنستا باي', 'InstaPay', 'bank', 'optional', 'EG',
    'تحويل محلي. مش اتجاه تسوية شام.',
    'A local transfer rail. Not Sham’s settlement direction.', 'stripe', false),
  local('fawry_voda', 'فوري / فودافون كاش', 'Fawry / Vodafone Cash', 'wallet', 'optional', 'EG',
    'محافظ وفوري للعميل في مصر فقط. مكسب المنصة مش بيتسحب من هنا.',
    'Egyptian customer wallets only. Platform profit is not withdrawn here.', 'stripe', false),
  local('cmi', 'مركز النقديات', 'CMI', 'card', 'common', 'MA',
    'المفتاح المحلي لقبول الكروت في المغرب.',
    'The local switch for card acceptance in Morocco.', 'stripe'),
  local('edahabia', 'الذهبية', 'Edahabia', 'card', 'required', 'DZ',
    'كارت بريد الجزائر. هو الأكثر انتشاراً للدفع المحلي.',
    'Algérie Poste’s card. The most widespread local payment card.', 'algeria'),
  local('cib_dz', 'بطاقة CIB', 'CIB', 'card', 'common', 'DZ',
    'الكارت البنكي بين البنوك عبر ساتيم.',
    'The interbank card on the SATIM network.', 'algeria'),
  local('baridimob', 'بريدي موب', 'BaridiMob', 'wallet', 'common', 'DZ',
    'تطبيق بريد الجزائر لاستخدام الذهبية.',
    'Algérie Poste’s app for the Edahabia card.', 'algeria'),
  local('smt', 'البطاقة البنكية التونسية', 'Tunisian bank card', 'card', 'common', 'TN',
    'القبول المحلي عبر النقديات. فيزا الدولية مش الافتراضي.',
    'Local acceptance through the national switch. International Visa is not the default.', 'stripe'),
  local('troy', 'تروي', 'Troy', 'card', 'common', 'TR',
    'شبكة تركيا المحلية. كثير من كروت الخصم مش دولية.',
    'Turkey’s domestic scheme. Many debit cards are not international.', 'stripe'),
  local('bkm', 'بي كي إم إكسبريس', 'BKM Express', 'wallet', 'optional', 'TR',
    'محفظة البنوك التركية. عقد محلي.',
    'The Turkish banks’ wallet. A local contract.', 'stripe'),
  local('qi', 'كي كارد', 'Qi Card', 'card', 'common', 'IQ',
    'كارت محلي عراقي. القبول الدولي محدود.',
    'An Iraqi local card. International acceptance is limited.', 'stripe'),
  local('whish_omt', 'ويش / أومي تي', 'Whish / OMT', 'wallet', 'optional', 'LB',
    'محافظ وتحويل محلي في لبنان. التحصيل الدولي هش.',
    'Lebanese wallets and cash transfer. International acquiring is fragile.', 'stripe', false),
  local('palpay', 'بال باي', 'PalPay', 'card', 'optional', 'PS',
    'قبول محلي حيث تعمل البنوك. مش مسار تسوية دولي مؤكد.',
    'Local acceptance where banks operate. Not a confirmed international settlement path.', 'stripe', false),
  local('bit', 'بيت', 'Bit', 'wallet', 'common', 'IL',
    'محفظة تحويل محلية. فيزا وماستركارد هما طبقة الكروت.',
    'A local transfer wallet. Visa and Mastercard are the card layer.', 'stripe'),
];

const WAVE2: LocalDef[] = [
  local('jazzcash', 'جاز كاش', 'JazzCash', 'wallet', 'common', 'PK', 'محفظة باكستان الأكثر استخداماً. عقد محلي، مش من بايونير.', 'Pakistan’s most used wallet. A local contract, not Payoneer.', 'wave2'),
  local('easypaisa', 'إيزي بيسا', 'Easypaisa', 'wallet', 'common', 'PK', 'محفظة ثانية واسعة. كل علامة عقد لوحدها.', 'A second widespread wallet. Each brand needs its own contract.', 'wave2'),
  local('bkash', 'بي كاش', 'bKash', 'wallet', 'required', 'BD', 'المحفظة الغالبة في بنغلاديش. من غيرها أغلب العملاء مش هيدفعوا.', 'The dominant wallet in Bangladesh. Without it, most customers will not pay.', 'wave2'),
  local('nagad', 'ناغاد', 'Nagad', 'wallet', 'common', 'BD', 'محفظة بريد بنغلاديش. بجانب بي كاش، مش بديل عن فيزا.', 'Bangladesh Post’s wallet. Beside bKash, not a substitute for Visa.', 'wave2'),
  local('kakaopay', 'كاكاو باي', 'KakaoPay', 'wallet', 'common', 'KR', 'محفظة كوريا الغالبة على الدفع اليومي.', 'Korea’s dominant everyday wallet.', 'wave2'),
  local('naverpay', 'نافير باي', 'Naver Pay', 'wallet', 'optional', 'KR', 'محفظة تسوق كورية. عقد منفصل.', 'A Korean shopping wallet. A separate contract.', 'wave2'),
  local('esewa', 'إي سيوا', 'eSewa', 'wallet', 'common', 'NP', 'محفظة نيبال الأساسية للدفع الإلكتروني.', 'Nepal’s primary electronic wallet.', 'wave2'),
  local('khalti', 'خالتي', 'Khalti', 'wallet', 'common', 'NP', 'محفظة نيبالية ثانية. مش تحصيل تلقائي.', 'A second Nepali wallet. Not automatic collection.', 'wave2'),
  local('kaspi', 'كاسبي', 'Kaspi', 'wallet', 'required', 'KZ', 'تطبيق كازاخستان الغالب. كارت دولي لوحده مش كفاية.', 'Kazakhstan’s dominant app. An international card alone is not enough.', 'wave2'),
  local('click_uz', 'كليك', 'Click', 'wallet', 'common', 'UZ', 'محفظة أوزبكستان المنتشرة.', 'A widespread Uzbek wallet.', 'wave2'),
  local('payme', 'باي مي', 'Payme', 'wallet', 'common', 'UZ', 'محفظة أوزبكية ثانية. عقد محلي.', 'A second Uzbek wallet. A local contract.', 'wave2'),
  local('telebirr', 'تيلي بير', 'Telebirr', 'wallet', 'common', 'ET', 'محفظة إثيو تيليكوم. هي مسار العميل المحلي.', 'Ethio Telecom’s wallet. It is the local customer path.', 'wave2'),
  local('ozow', 'أوزو', 'Ozow', 'bank', 'common', 'ZA', 'تحويل فوري من الحساب في جنوب أفريقيا.', 'Instant account transfer in South Africa.', 'wave2'),
  local('payshap', 'باي شاب', 'PayShap', 'bank', 'optional', 'ZA', 'تحويل فوري وطني. مش بديل عن أوزو في كل متجر.', 'The national instant transfer. Not a substitute for Ozow in every store.', 'wave2'),
  local('orange_wave', 'أورانج موني / ويف', 'Orange Money / Wave', 'wallet', 'common', 'SN', 'محافظ السنغال الغالبة. كل شبكة عقد.', 'Senegal’s dominant wallets. Each network is a contract.', 'wave2'),
  local('mtn_momo', 'إم تي إن مومو', 'MTN MoMo', 'wallet', 'common', 'UG RW ZM CM', 'محفظة الهاتف الغالبة في دول كتير في أفريقيا. البلد والعقد بيتحددوا لوحدهم.', 'The dominant phone wallet in several African countries. Country and contract are chosen separately.', 'wave2'),
  local('airtel_money', 'أيرتل موني', 'Airtel Money', 'wallet', 'common', 'UG TZ RW ZM MW', 'محفظة هاتف ثانية. مش نفس عقد إم تي إن.', 'A second phone wallet. Not the same contract as MTN.', 'wave2'),
  local('mpesa_tz', 'إم-بيسا', 'M-Pesa', 'wallet', 'common', 'TZ', 'محفظة تنزانيا الأساسية. غير إم-بيسا كينيا في العقد.', 'Tanzania’s primary wallet. Not the same contract as Kenya M-Pesa.', 'wave2'),
  local('sinpe', 'سينبي موفيل', 'SINPE Móvil', 'bank', 'common', 'CR', 'التحويل الفوري في كوستاريكا بالرقم.', 'Costa Rica’s instant transfer by phone number.', 'wave2'),
  local('yappy', 'يابي', 'Yappy', 'wallet', 'common', 'PA', 'محفظة بنما الغالبة.', 'Panama’s dominant wallet.', 'wave2'),
  local('bizum', 'بيزوم', 'Bizum', 'wallet', 'common', 'ES', 'تحويل فوري إسباني بين البنوك. مش فيزا.', 'Spain’s interbank instant transfer. Not Visa.', 'wave2'),
  local('vipps', 'فيبس', 'Vipps', 'wallet', 'common', 'NO', 'محفظة النرويج الغالبة.', 'Norway’s dominant wallet.', 'wave2'),
  local('satispay', 'ساتيس باي', 'Satispay', 'wallet', 'optional', 'IT', 'محفظة إيطالية اختيارية بجانب الكروت.', 'An optional Italian wallet beside cards.', 'wave2'),
  local('nequi', 'نيكي', 'Nequi', 'wallet', 'common', 'CO', 'محفظة كولومبيا الواسعة بجانب بي إس إي.', 'A widespread Colombian wallet beside PSE.', 'wave2'),
  local('webpay', 'ويب باي', 'Webpay', 'card', 'common', 'CL', 'بوابة الكروت المحلية في تشيلي.', 'Chile’s local card gateway.', 'wave2'),
  local('plin', 'بلين', 'Plin', 'wallet', 'optional', 'PE', 'تحويل فوري بيروفي بجانب يابي.', 'A Peruvian instant transfer beside Yape.', 'wave2'),
  local('truemoney', 'ترو موني', 'TrueMoney', 'wallet', 'common', 'TH', 'محفظة تايلاند الواسعة بجانب برومبت باي.', 'A widespread Thai wallet beside PromptPay.', 'wave2'),
  local('tng', 'تاتش آن جو', "Touch 'n Go", 'wallet', 'common', 'MY', 'محفظة ماليزيا اليومية بجانب إف بي إكس.', 'Malaysia’s everyday wallet beside FPX.', 'wave2'),
  local('phonepe', 'فون بي', 'PhonePe', 'wallet', 'common', 'IN', 'محفظة على يو بي آي. العقد غير عقد البطاقة.', 'A wallet on UPI. The contract is not the card contract.', 'wave2'),
  local('idram', 'آي درام', 'Idram', 'wallet', 'common', 'AM', 'محفظة أرمينيا المحلية.', 'Armenia’s local wallet.', 'wave2'),
  local('aba_pay', 'إيه بي إيه باي', 'ABA Pay', 'wallet', 'common', 'KH', 'محفظة كمبوديا الأكثر استخداماً في المتاجر.', 'The wallet most used by shops in Cambodia.', 'wave2'),
  local('liqpay', 'ليك باي', 'LiqPay', 'card', 'optional', 'UA', 'تحصيل أوكراني محلي. القبول الدولي محدود، والاعتماد تخطيط فقط.', 'Ukrainian local acquiring. International acceptance is limited. Adoption is only a plan.', 'wave2'),
  local('evc', 'إي في سي بلس', 'EVC Plus', 'wallet', 'optional', 'SO', 'محفظة الصومال المحلية. مش مسار تحصيل دولي جاهز.', 'Somalia’s local wallet. Not a ready international collection path.', 'wave2', false),
  local('kbzpay', 'كي بي زد باي', 'KBZPay', 'wallet', 'optional', 'MM', 'محفظة ميانمار المحلية. القبول الدولي غير مؤكد، ومش للاعتماد الآن.', 'Myanmar’s local wallet. International acceptance is not confirmed, and it is not for adoption now.', 'wave2', false),
  local('sepa_extra', 'سيبا', 'SEPA', 'bank', 'common', 'AD MC SM VA', 'تحويل يورو بنكي في منطقة سيبا. مش في كل بلد بيستخدم اليورو.', 'A euro bank transfer inside SEPA. Not every euro-using country is in it.', 'wave2'),
];

/** Next named local rails. A name is a plan the owner can adopt, never a live charge. Sources reviewed 2026-10-20. */
const WAVE3: LocalDef[] = [
  local('line_pay', 'لاين باي', 'LINE Pay', 'wallet', 'common', 'TW', 'محفظة تايوان الأكثر استخداماً. عقد محلي، ومش زر خصم.', 'Taiwan’s most used wallet. A local contract, not a charge button.', 'wave3'),
  local('jkopay', 'جيه كيه أو باي', 'JKOPay', 'wallet', 'common', 'TW', 'محفظة تايوان الثانية. عقد منفصل عن لاين باي.', 'Taiwan’s second wallet. A separate contract from LINE Pay.', 'wave3'),
  local('fps_hk', 'إف بي إس', 'FPS', 'bank', 'common', 'HK', 'التحويل الفوري في هونغ كونغ. غير يونيون باي.', 'Hong Kong’s instant transfer. Not UnionPay.', 'wave3'),
  local('m10', 'إم 10', 'm10', 'wallet', 'common', 'AZ', 'محفظة أذربيجان الأكثر استخداماً. عقد محلي.', 'Azerbaijan’s most used wallet. A local contract.', 'wave3'),
  local('qpay_mn', 'كيو باي', 'QPay', 'wallet', 'common', 'MN', 'شبكة الدفع بالرمز في منغوليا. مش تحصيل تلقائي.', 'Mongolia’s QR payment network. Not automatic collection.', 'wave3'),
  local('lankaqr', 'لانكا كي آر', 'LankaQR', 'bank', 'common', 'LK', 'رمز الدفع الوطني في سريلانكا. التطبيق بيتحدد بالعقد.', 'Sri Lanka’s national QR. The app is chosen by the contract.', 'wave3'),
  local('tigo_py', 'تيجو موني', 'Tigo Money', 'wallet', 'common', 'PY', 'محفظة باراغواي الواسعة. عقد محلي.', 'A widespread Paraguayan wallet. A local contract.', 'wave3'),
  local('ips_rs', 'آي بي إس', 'IPS', 'bank', 'common', 'RS', 'تحويل صربيا الفوري من تطبيق البنك. مش فيزا.', 'Serbia’s instant transfer from a bank app. Not Visa.', 'wave3'),
  local('mpesa_mz', 'إم-بيسا', 'M-Pesa', 'wallet', 'common', 'MZ', 'محفظة موزمبيق الأساسية. غير عقد كينيا أو تنزانيا.', 'Mozambique’s primary wallet. Not the Kenya or Tanzania contract.', 'wave3'),
  local('mvola', 'إم فولا', 'MVola', 'wallet', 'common', 'MG', 'محفظة مدغشقر الأكثر توثيقاً. أورانج وأيرتل عقد تاني.', 'Madagascar’s best-documented wallet. Orange and Airtel are other contracts.', 'wave3'),
  local('tnm_mpamba', 'تي إن إم مبامبا', 'TNM Mpamba', 'wallet', 'common', 'MW', 'محفظة ملاوي المحلية بجانب أيرتل. عقد لوحدها.', 'Malawi’s local wallet beside Airtel. Its own contract.', 'wave3'),
  local('mbank_kg', 'إم بنك', 'MBank', 'wallet', 'common', 'KG', 'تطبيق قيرغيزستان الافتراضي للتحويل والدفع.', 'Kyrgyzstan’s default app for transfer and payment.', 'wave3'),
  local('bcel_one', 'بي سي إي إل ون', 'BCEL One', 'wallet', 'common', 'LA', 'تطبيق بنك لاوس التجاري للرمز والتحويل.', 'The Lao commercial bank app for QR and transfer.', 'wave3'),
  local('ecocash', 'إيكو كاش', 'EcoCash', 'wallet', 'common', 'ZW', 'محفظة زيمبابوي الغالبة. عقد محلي، ومش زر خصم.', 'Zimbabwe’s dominant wallet. A local contract, not a charge button.', 'wave3'),
  local('ecocash_ls', 'إيكو كاش', 'EcoCash', 'wallet', 'common', 'LS', 'محفظة ليسوتو. غير عقد زيمبابوي.', 'Lesotho’s wallet. Not the Zimbabwe contract.', 'wave3'),
  local('multicaixa', 'ملتي كايشا إكسبريس', 'Multicaixa Express', 'wallet', 'common', 'AO', 'مسار أنغولا المحلي للكارت والمحفظة. عقد مع الشبكة.', 'Angola’s local card and wallet path. A network contract.', 'wave3'),
  local('orange_ml', 'أورانج موني', 'Orange Money', 'wallet', 'common', 'ML', 'محفظة مالي الأساسية. ويف ومُوف عقد تاني.', 'Mali’s primary wallet. Wave and Moov are other contracts.', 'wave3'),
  local('orange_gn', 'أورانج موني', 'Orange Money', 'wallet', 'common', 'GN', 'محفظة غينيا المحلية. مش نفس عقد مالي.', 'Guinea’s local wallet. Not the Mali contract.', 'wave3'),
  local('orange_lr', 'أورانج موني', 'Orange Money', 'wallet', 'common', 'LR', 'محفظة ليبيريا. العقد بيتحدد للبلد دي لوحدها.', 'Liberia’s wallet. The contract is chosen for this country alone.', 'wave3'),
  local('bankily', 'بانكيلي', 'Bankily', 'wallet', 'common', 'MR', 'محفظة موريتانيا الغالبة. عقد بنكي محلي.', 'Mauritania’s dominant wallet. A local bank contract.', 'wave3'),
  local('moncash', 'مون كاش', 'MonCash', 'wallet', 'common', 'HT', 'محفظة هايتي المحلية. مش مسار تسوية دولي جاهز.', 'Haiti’s local wallet. Not a ready international settlement path.', 'wave3'),
];

const EXTRA_WORLD: LocalDef[] = [
  local('unionpay', 'يونيون باي', 'UnionPay', 'card', 'common', 'CN HK MO',
    'شبكة الكروت الصينية. علي باي ووي تشات مسار مسافرين منفصل.',
    'China’s card network. Alipay and WeChat Pay are a separate traveller path.', 'stripe'),
  local('rupay', 'رو باي', 'RuPay', 'card', 'common', 'IN',
    'خصم هندي. UPI مسار تحويل منفصل ومش تلقائي.',
    'Indian debit. UPI is a separate transfer path and is not automatic.', 'stripe'),
  local('interac', 'إنترآك', 'Interac', 'bank', 'common', 'CA',
    'خصم وتحويل كندي. مش بديل عن فيزا لكل عملية.',
    'Canadian debit and transfer. Not a replacement for Visa on every purchase.', 'stripe'),
  local('cartes_bancaires', 'كارت بنكير', 'Cartes Bancaires', 'card', 'common', 'FR',
    'الخصم الفرنسي المحلي. كثير من الكروت الفرنسية بتمر منه أولاً.',
    'French domestic debit. Many French cards route here first.', 'stripe'),
  local('elo', 'إيلو', 'Elo', 'card', 'optional', 'BR',
    'شبكة برازيلية محلية بجانب فيزا وماستركارد. بيكس هو التحويل الفوري.',
    'A Brazilian local network beside Visa and Mastercard. Pix is the instant transfer.', 'stripe'),
];

const APPLE_GOOGLE = 'US CA GB IE FR DE IT ES NL BE AT PT SE NO DK FI CH PL AU NZ SG HK JP AE SA KW QA BH OM JO EG TR IL'.split(' ');

function flagOf(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...[...code].map((char) => 0x1F1E6 + char.charCodeAt(0) - 65));
}

function names(code: string) {
  const known = WORLD_COUNTRIES.find((country) => country.code === code);
  const ar = known?.nameAr || safeName('ar', code);
  const en = known?.nameEn || safeName('en', code);
  return { nameAr: ar, nameEn: en, flag: known?.flag || flagOf(code) };
}

function safeName(locale: string, code: string) {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

function regionOf(code: string, wave: PayWave): PayRegion {
  if (wave === 'mena') return 'mena';
  const known = WORLD_COUNTRIES.find((country) => country.code === code);
  if (known?.regionCategory === 'arab') return 'africa';
  if (known?.regionCategory === 'europe' || known?.regionCategory === 'asia' || known?.regionCategory === 'americas' || known?.regionCategory === 'africa' || known?.regionCategory === 'oceania') {
    return known.regionCategory;
  }
  return 'other';
}

function catalogLocals(): LocalDef[] {
  return PAYMENT_CATALOG.flatMap((method) => {
    if (!method.customerCountries?.length) return [];
    if (method.id === 'card' || method.id === 'wallet') return [];
    return [{
      id: method.id,
      nameAr: method.name,
      nameEn: method.name,
      kind: method.category,
      weight: 'optional' as const,
      countries: method.customerCountries,
      noteAr: method.notes,
      noteEn: 'Researched candidate. A merchant contract and a test are required before any adoption goes live. Not live now.',
      source: method.source,
      adoptable: true,
    }];
  });
}

function defsFor(code: string) {
  const merged = new Map<string, LocalDef>();
  for (const item of [...catalogLocals(), ...EXTRA_WORLD, ...WAVE2, ...WAVE3, ...MENA_LOCAL]) {
    if (item.countries.includes(code)) merged.set(item.id, item);
  }
  return [...merged.values()];
}

function toMethod(item: LocalDef, countryAdoptable: boolean): PayMethod {
  const adoptable = countryAdoptable && item.adoptable !== false && item.weight !== 'blocked';
  return {
    id: item.id,
    nameAr: item.nameAr,
    nameEn: item.nameEn,
    kind: item.kind,
    weight: item.weight,
    adoptable,
    noteAr: item.noteAr,
    noteEn: item.noteEn,
    source: item.source,
  };
}

function globalMethods(code: string, adoptable: boolean): PayMethod[] {
  const card = (id: string, nameAr: string, nameEn: string, weight: PayWeight): PayMethod => ({
    id, nameAr, nameEn, kind: 'card', weight, adoptable, noteAr: GLOBAL_NOTE_AR, noteEn: GLOBAL_NOTE_EN, source: 'stripe',
  });
  const methods = [card('visa', 'فيزا', 'Visa', 'common'), card('mastercard', 'ماستركارد', 'Mastercard', 'common')];
  if ('US CA GB AE SA AU JP SG HK'.split(' ').includes(code)) {
    methods.push(card('amex', 'أمريكان إكسبريس', 'American Express', 'optional'));
  }
  if (APPLE_GOOGLE.includes(code)) {
    methods.push({
      id: 'apple_google', nameAr: 'آبل باي / جوجل باي', nameEn: 'Apple Pay / Google Pay', kind: 'wallet', weight: 'optional', adoptable,
      noteAr: 'طبقة على الكارت. الجهاز والبنك والنطاق لازم يتوافقوا. مش متاح تلقائياً.',
      noteEn: 'A layer on the card. Device, bank and domain must all agree. Not automatic.',
      source: 'stripe',
    });
  }
  return methods;
}

function buildCountry(code: string): CountryPay {
  const wave: PayWave = MENA_ORDER.includes(code) ? 'mena' : 'world';
  const blocked = BLOCKED.has(code);
  const fragile = FRAGILE.has(code);
  const adoptable = !blocked && !fragile;
  const { nameAr, nameEn, flag } = names(code);
  const methods: PayMethod[] = [];
  if (blocked) {
    methods.push({
      id: 'restricted', nameAr: 'غير معتمد', nameEn: 'Not adoptable', kind: 'card', weight: 'blocked', adoptable: false,
      noteAr: 'شام لا يجدول وسيلة تحصيل في المسار ده. مفيش التفاف على قيد دولي.',
      noteEn: 'Sham does not schedule a collection rail on this corridor. There is no workaround for an international restriction.',
      source: 'gcc',
    });
  } else {
    methods.push(...globalMethods(code, adoptable));
    methods.push(...defsFor(code).filter((item) => item.id !== 'visa' && item.id !== 'mastercard').map((item) => toMethod(item, adoptable)));
    if (!methods.some((method) => method.id !== 'visa' && method.id !== 'mastercard' && method.id !== 'amex' && method.id !== 'apple_google')) {
      methods.push({
        id: 'local_gap', nameAr: 'وسيلة محلية غير مؤكدة', nameEn: 'Local method not confirmed', kind: 'wallet', weight: 'blocked', adoptable: false,
        noteAr: 'مفيش اسم محفظة محلية متأكد هنا. ما نختلقش اسماً. فيزا وماستركارد هما الطبقة العالمية لحد عقد التحصيل.',
        noteEn: 'No local wallet name is confirmed here. One is not invented. Visa and Mastercard stay the global layer until an acquiring contract.',
        source: 'stripe',
      });
    }
    if (fragile) {
      methods.forEach((method) => { method.adoptable = false; method.weight = method.weight === 'required' ? 'optional' : method.weight; });
    }
  }
  return {
    code, nameAr, nameEn, flag, currency: CURRENCIES[code] || '', wave, region: regionOf(code, wave),
    adoptable, restricted: blocked || fragile, methods,
  };
}

let cached: CountryPay[] | null = null;

export function countryDirectory(): CountryPay[] {
  if (cached) return cached;
  const mena = MENA_ORDER.filter((code) => code in CURRENCIES).map(buildCountry);
  const rest = Object.keys(CURRENCIES).filter((code) => !MENA_ORDER.includes(code)).sort().map(buildCountry);
  cached = [...mena, ...rest];
  return cached;
}

export function countryPay(code: string) {
  return countryDirectory().find((country) => country.code === code.toUpperCase());
}

const OFFER_SKIP = new Set(['local_gap', 'restricted']);
const OFFER_GLOBAL = new Set(['visa', 'mastercard', 'amex', 'apple_google']);

/** Methods a customer can choose for a country. A name is not a charge. */
export function customerPayOffer(code: string) {
  const row = countryPay(code);
  if (!row) return { country: code.toUpperCase(), enabled: false as const, methods: [] as { id: string; nameAr: string; nameEn: string; weight: PayWeight }[] };
  const methods = row.methods
    .filter((method) => !OFFER_SKIP.has(method.id) && method.weight !== 'blocked')
    .sort((a, b) => {
      const rank = (method: PayMethod) => (method.weight === 'required' ? 0 : OFFER_GLOBAL.has(method.id) ? 2 : 1);
      return rank(a) - rank(b) || a.nameEn.localeCompare(b.nameEn);
    })
    .map(({ id, nameAr, nameEn, weight }) => ({ id, nameAr, nameEn, weight }));
  return { country: row.code, enabled: methods.length > 0, methods };
}

export function directorySummary() {
  const rows = countryDirectory();
  return {
    researchedAt: DIRECTORY_RESEARCHED_AT,
    countries: rows.length,
    mena: rows.filter((row) => row.wave === 'mena').length,
    world: rows.filter((row) => row.wave === 'world').length,
    restricted: rows.filter((row) => row.restricted).length,
    localNamed: rows.filter((row) => row.methods.some((method) => !['visa', 'mastercard', 'amex', 'apple_google', 'local_gap', 'restricted'].includes(method.id))).length,
    openLocal: rows.filter((row) => row.methods.some((method) => method.id === 'local_gap')).length,
    liveMethods: 0 as const,
    payoneerRole: 'profit_wallet' as const,
    sendsExternal: false as const,
  };
}

export function publicCountries(wave?: string, query = '') {
  const q = query.trim().toLowerCase();
  const rows = countryDirectory().filter((row) => {
    if (wave === 'mena' || wave === 'world') { if (row.wave !== wave) return false; }
    if (!q) return true;
    return `${row.code} ${row.nameAr} ${row.nameEn} ${row.currency} ${row.methods.map((method) => `${method.nameAr} ${method.nameEn} ${method.id}`).join(' ')}`.toLowerCase().includes(q);
  });
  return {
    ...directorySummary(),
    rows: rows.map((row) => ({
      code: row.code,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      flag: row.flag,
      currency: row.currency,
      wave: row.wave,
      region: row.region,
      adoptable: row.adoptable,
      restricted: row.restricted,
      methods: row.methods.map(({ id, nameAr, nameEn, kind, weight, adoptable, noteAr, noteEn }) => ({ id, nameAr, nameEn, kind, weight, adoptable, noteAr, noteEn, status: 'cataloged' as const })),
    })),
  };
}
