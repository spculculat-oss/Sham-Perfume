/**
 * «مسؤول التعاقدات» — the letters and the supplier agreement (version AGREEMENT_VERSION), in Arabic and English.
 * Written as a person of the team writes: the letter goes out under the sender's real name, after he reviews
 * it (criterion C-01). The margin's value is never written (C-04); the store's link only comes after
 * approval (C-05). Pure functions; every output passes checkLetter() (tests/contracts.test.ts).
 */
import type { Sender } from './policy';

export const AGREEMENT_VERSION = 1;
export type Lang = 'ar' | 'en';
export interface Party { storeName: string; domain: string; contactName?: string; lang: Lang }
export interface Letter { subject: string; body: string }

const entity = (s: Sender, lang: Lang) => (s.registrationNo?.trim()
  ? (lang === 'ar' ? `شركة ${s.entityName}` : `${s.entityName} (registration no. ${s.registrationNo})`)
  : (lang === 'ar' ? `منصة ${s.entityName}` : s.entityName));
const signature = (s: Sender, lang: Lang) => [
  lang === 'ar' ? 'مع خالص التحية،' : 'Kind regards,',
  s.name,
  `${s.title} — ${s.platformName}`,
  s.email,
  ...(s.phone?.trim() ? [s.phone.trim()] : []),
].join('\n');

/** The first letter: who we are, how we work, the agreement link, the honest «still being set up», opt-out. */
export function outreachLetter(s: Sender, p: Party, signUrl: string): Letter {
  if (p.lang === 'en') {
    return {
      subject: `Partnership proposal — listing ${p.storeName} products on ${s.platformName}`,
      body: [
        `Hello ${p.contactName?.trim() || `${p.storeName} team`},`,
        '',
        `My name is ${s.name}, ${s.title} at ${entity(s, 'en')}, the team behind ${s.platformName}. I came across your products on ${p.domain} and I would like to propose a simple collaboration.`,
        '',
        'We are an independent sales intermediary for perfumes: we list products from selected stores on our marketplace. When a customer orders one of your products, we order it from you at your price and pay the full amount before it ships; we then sell it to the customer at our own retail price, which covers our margin and running costs. There is no cost to you, and you always receive your full price.',
        '',
        'To list your products we need your written permission to use their names, photos and descriptions. It takes about two minutes online — the full agreement is shown before you accept anything, and you can withdraw your permission at any time:',
        signUrl,
        '',
        `To be transparent: ${s.platformName} is in its final setup stage. We will send you the link to the store as soon as you agree and our review is complete.`,
        '',
        `If you have any questions, just reply to this email${s.phone?.trim() ? ` or call ${s.phone.trim()}` : ''}. If you are not interested, simply reply "no" and we will not contact you again.`,
        '',
        signature(s, 'en'),
      ].join('\n'),
    };
  }
  return {
    subject: `عرض تعاون لعرض منتجات ${p.storeName} على ${s.platformName}`,
    body: [
      `أهلاً ${p.contactName?.trim() || `فريق ${p.storeName}`}،`,
      '',
      `معك ${s.name}، ${s.title} في ${entity(s, 'ar')} «${s.platformName}». اطلعت على منتجاتكم في ${p.domain} وحابب أعرض عليكم تعاوناً بسيطاً.`,
      '',
      'نحن وسيط مستقل في بيع العطور: نعرض منتجات متاجر مختارة على متجرنا، وعندما يطلب عميل أحد منتجاتكم نطلبه منكم بسعركم وندفع قيمته كاملة قبل الشحن، ثم نبيعه للعميل بسعرنا الذي يشمل هامش ربحنا وتكاليف التشغيل. أي لا توجد عليكم أي تكلفة، ويصلكم سعركم كاملاً دائماً.',
      '',
      'لعرض منتجاتكم نحتاج موافقتكم المكتوبة على استخدام أسماء المنتجات وصورها وأوصافها، وتتم إلكترونياً في دقيقتين من خلال هذا الرابط — ستجدون نص الاتفاقية كاملاً قبل أي موافقة، ويمكنكم سحب الموافقة في أي وقت:',
      signUrl,
      '',
      `وللأمانة، ${s.platformName} في مرحلة التجهيز النهائي، وسنرسل لكم رابط المتجر بمجرد موافقتكم وانتهاء المراجعة.`,
      '',
      `لأي سؤال يكفي الرد على هذا الإيميل${s.phone?.trim() ? ` أو الاتصال على ${s.phone.trim()}` : ''}. وإذا كنتم غير مهتمين يكفي الرد بكلمة «لا» ولن نراسلكم مرة أخرى.`,
      '',
      signature(s, 'ar'),
    ].join('\n'),
  };
}

/** A short reminder (one only, a week later). */
export function reminderLetter(s: Sender, p: Party, signUrl: string): Letter {
  if (p.lang === 'en') {
    return {
      subject: `Following up — ${p.storeName} on ${s.platformName}`,
      body: [`Hello ${p.contactName?.trim() || `${p.storeName} team`},`, '', `I am following up on my previous email about listing your products on ${s.platformName}. The agreement is still available here if you would like to review it:`, signUrl, '', 'If you are not interested, just reply "no" and I will not write again.', '', signature(s, 'en')].join('\n'),
    };
  }
  return {
    subject: `متابعة — منتجات ${p.storeName} على ${s.platformName}`,
    body: [`أهلاً ${p.contactName?.trim() || `فريق ${p.storeName}`}،`, '', `أتابع معكم رسالتي السابقة بخصوص عرض منتجاتكم على ${s.platformName}. الاتفاقية ما زالت متاحة للمراجعة هنا:`, signUrl, '', 'وإذا كنتم غير مهتمين يكفي الرد بكلمة «لا» ولن أراسلكم مرة أخرى.', '', signature(s, 'ar')].join('\n'),
  };
}

/** After the legal manager's approval: thanks, the store link (only now — C-05), how to withdraw. */
export function welcomeLetter(s: Sender, p: Party, siteUrl: string): Letter {
  if (p.lang === 'en') {
    return {
      subject: `Welcome to ${s.platformName} — your products are being listed`,
      body: [`Hello ${p.contactName?.trim() || `${p.storeName} team`},`, '', 'Thank you for signing the agreement — our review is complete and we are now preparing your products for listing. You can see the store here:', siteUrl, '', 'Orders will reach you by email, at your price. To remove any product, or to withdraw your permission entirely, just reply to this email and we will act within 48 hours.', '', signature(s, 'en')].join('\n'),
    };
  }
  return {
    subject: `أهلاً بكم في ${s.platformName} — جاري تجهيز منتجاتكم`,
    body: [`أهلاً ${p.contactName?.trim() || `فريق ${p.storeName}`}،`, '', 'شكراً لتوقيعكم الاتفاقية — انتهت المراجعة ونجهز الآن منتجاتكم للعرض. هذا رابط المتجر:', siteUrl, '', 'ستصلكم الطلبات على الإيميل بسعركم. ولإزالة أي منتج أو سحب الموافقة بالكامل يكفي الرد على هذا الإيميل وننفذ خلال 48 ساعة.', '', signature(s, 'ar')].join('\n'),
  };
}

/**
 * The supplier agreement — both languages in one document; the store's language prevails (clause 14).
 * Canonical text: the signature record keeps its SHA-256, so any later change is detectable (C-09).
 */
export function agreementText(s: Sender, p: Party, signer?: { name: string; title: string }): string {
  const us = entity(s, 'ar');
  const usEn = entity(s, 'en');
  const ar = [
    `اتفاقية عرض منتجات وإعادة بيع (غير حصرية) — الإصدار ${AGREEMENT_VERSION}`,
    '',
    `الطرف الأول (الوسيط): ${us}، ويمثلها ${s.name} (${s.title})، إيميل: ${s.email}${s.phone?.trim() ? `، تليفون: ${s.phone.trim()}` : ''}${s.registrationNo?.trim() ? `، سجل تجاري رقم ${s.registrationNo.trim()}` : ''}.`,
    `الطرف الثاني (المورد): ${p.storeName} (${p.domain})${signer ? `، ويمثله ${signer.name} (${signer.title})` : ''}.`,
    '',
    '1. طبيعة العلاقة: الوسيط يعرض منتجات المورد على متجره ويعيد بيعها باسمه لحسابه. العلاقة مستقلة: لا وكالة ولا شراكة ولا امتياز ولا حصرية لأي طرف.',
    '2. الترخيص: يمنح المورد الوسيط ترخيصاً غير حصري وقابلاً للإلغاء لاستخدام أسماء منتجاته وصورها وأوصافها وأسعارها المنشورة على موقعه، لغرض عرضها وبيعها فقط، مع تعديلات تقنية على الصور (المقاس، الخلفية، إزالة بيانات التواصل) دون تغيير المنتج نفسه.',
    '3. الأسعار: يحدد الوسيط سعر البيع للمستهلك باستقلالية، ويشمل هامش ربحه وتكاليفه، ولا يلتزم بالإفصاح عنه. يلتزم الوسيط بدفع سعر المورد المعلن (أو السعر الخاص المتفق عليه كتابياً) كاملاً عن كل طلب.',
    '4. الطلبات والدفع: يرسل الوسيط كل طلب للمورد كتابياً، ويؤكد المورد التوفر، ويدفع الوسيط القيمة قبل الشحن. يتم الشحن حسب ما يُتفق عليه في كل طلب.',
    '5. الأصالة والحقوق: يضمن المورد أن المنتجات أصلية ومطابقة لوصفها، وأن له حق ترخيص الصور والأوصاف المرخصة هنا.',
    '6. العلامات التجارية: تُذكر أسماء الماركات للوصف فقط. لا يدّعي الوسيط أنه وكيل أو موزع معتمد لأي ماركة أو للمورد.',
    '7. السحب والإزالة: للمورد سحب أي منتج أو الترخيص كله في أي وقت برسالة إيميل، ويزيل الوسيط المحتوى خلال 48 ساعة.',
    '8. حالة المنصة: المنصة في مرحلة التجهيز. يبدأ العرض بعد المراجعة القانونية، ويُرسل للمورد رابط المتجر عند البدء.',
    '9. البيانات: لا يتبادل الطرفان من بيانات العملاء إلا ما يلزم لتنفيذ الطلب والشحن، ويحميها كل طرف وفق القانون المطبق عليه.',
    '10. المدة والإنهاء: تسري الاتفاقية من تاريخ التوقيع الإلكتروني لمدة غير محددة، ولكل طرف إنهاؤها بإشعار مكتوب قبل 7 أيام، مع سريان البند 7 فوراً.',
    '11. المسؤولية: كل طرف مسؤول عن التزاماته فقط، ولا يتحمل أي طرف الأضرار غير المباشرة.',
    '12. التوقيع الإلكتروني: يوافق الطرفان على إبرام هذه الاتفاقية إلكترونياً. يحفظ سجل التوقيع: اسم الموقّع وصفته، والتحقق من إيميل المورد الرسمي، وبصمة النص (SHA-256)، والتاريخ والوقت والجهاز. ويحصل كل طرف على نسخة.',
    `13. القانون: تخضع الاتفاقية لقوانين ${s.governingLaw}، ويُسعى لحل أي خلاف ودياً أولاً.`,
    `14. اللغة: الاتفاقية بالعربية والإنجليزية، وعند الاختلاف تسود نسخة ${p.lang === 'ar' ? 'العربية' : 'الإنجليزية'}.`,
  ];
  const en = [
    `Product Listing and Resale Agreement (non-exclusive) — version ${AGREEMENT_VERSION}`,
    '',
    `Party 1 (Intermediary): ${usEn}, represented by ${s.name} (${s.title}), email: ${s.email}${s.phone?.trim() ? `, phone: ${s.phone.trim()}` : ''}.`,
    `Party 2 (Supplier): ${p.storeName} (${p.domain})${signer ? `, represented by ${signer.name} (${signer.title})` : ''}.`,
    '',
    "1. Relationship: the Intermediary lists the Supplier's products on its marketplace and resells them in its own name and for its own account. The parties are independent: no agency, partnership, franchise or exclusivity for either party.",
    "2. Licence: the Supplier grants the Intermediary a non-exclusive, revocable licence to use the names, photos, descriptions and prices of its products as published on its website, solely to list and sell them, including technical edits to photos (size, background, removal of contact details) without altering the product itself.",
    "3. Prices: the Intermediary sets the consumer price independently; it includes the Intermediary's margin and costs, which it is not required to disclose. The Intermediary pays the Supplier's published price (or a special price agreed in writing) in full for every order.",
    '4. Orders and payment: the Intermediary sends each order to the Supplier in writing, the Supplier confirms availability, and the Intermediary pays before shipment. Shipping is as agreed for each order.',
    '5. Authenticity and rights: the Supplier warrants that the products are genuine and as described, and that it has the right to license the photos and descriptions licensed here.',
    '6. Trademarks: brand names are used descriptively only. The Intermediary does not claim to be an authorised agent or distributor of any brand or of the Supplier.',
    '7. Withdrawal and removal: the Supplier may withdraw any product, or this licence entirely, at any time by email; the Intermediary removes the content within 48 hours.',
    '8. Platform status: the platform is in its setup stage. Listing starts after the legal review, and the Supplier receives the store link when it starts.',
    "9. Data: the parties share only the customer data needed to fulfil and ship an order, and each protects it under the law that applies to it.",
    '10. Term and termination: this agreement runs from the date of electronic signature for an indefinite term; either party may end it with 7 days written notice, clause 7 applying immediately.',
    '11. Liability: each party is liable for its own obligations only; neither is liable for indirect damages.',
    "12. Electronic signature: the parties agree to conclude this agreement electronically. The signature record keeps the signer's name and title, the verification of the Supplier's official email, the text fingerprint (SHA-256), the date, time and device. Each party receives a copy.",
    `13. Law: this agreement is governed by the laws of ${s.governingLaw === 'جمهورية مصر العربية' ? 'the Arab Republic of Egypt' : s.governingLaw}; the parties will first seek an amicable settlement of any dispute.`,
    `14. Language: this agreement is in Arabic and English; in case of difference the ${p.lang === 'ar' ? 'Arabic' : 'English'} version prevails.`,
  ];
  return [...ar, '', '────────', '', ...en].join('\n');
}
