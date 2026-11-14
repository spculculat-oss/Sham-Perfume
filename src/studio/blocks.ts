/**
 * «استوديو شاهين» — code blocks: a library of ready, responsive website blocks (navigation, hero, features, pricing,
 * products, testimonials, FAQ, contact form, footer…) in plain HTML and CSS — no framework, no tracking, nothing
 * fetched — styled from one colour (the studio palette), right-to-left for Arabic, and exported as HTML, a React
 * component or a Vue component. Blocks stack into a whole page. Pure (no DOM): the panel previews and downloads.
 */
import { fontPair, paletteFrom, type Harmony } from './palette';

export type BlockId = 'navbar' | 'hero' | 'features' | 'stats' | 'pricing' | 'products' | 'gallery' | 'testimonials' | 'team' | 'timeline' | 'faq' | 'cta' | 'newsletter' | 'contact' | 'login' | 'footer';
export const BLOCK_IDS: BlockId[] = ['navbar', 'hero', 'features', 'stats', 'pricing', 'products', 'gallery', 'testimonials', 'team', 'timeline', 'faq', 'cta', 'newsletter', 'contact', 'login', 'footer'];

export interface BlockOptions { brand: string; base: string; harmony: Harmony; dark: boolean; radius: 'sharp' | 'soft' | 'round'; font: string; rtl: boolean }
export interface BlockCode { html: string; css: string }

/** Safe in HTML, in JSX and in Vue templates (braces too). */
export const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');

/** The words a block starts with (Arabic or English); the brand name goes where it belongs. */
function words(rtl: boolean) {
  return rtl ? {
    home: 'الرئيسية', about: 'من نحن', services: 'خدماتنا', pricing: 'الأسعار', contact: 'تواصل معنا', start: 'ابدأ الآن', more: 'اعرف أكتر',
    heroTitle: 'كل اللي محتاجه في مكان واحد', heroText: 'اكتب هنا جملة قصيرة بتشرح بتعمل إيه ولمين، وليه الناس تختارك إنت.',
    featuresTitle: 'ليه تختارنا؟', f: [['⚡', 'سرعة', 'اشرح الميزة الأولى في سطر.'], ['🛡️', 'أمان', 'اشرح الميزة التانية في سطر.'], ['💬', 'دعم', 'اشرح الميزة التالتة في سطر.'], ['🎯', 'دقة', 'اشرح الميزة الرابعة في سطر.']],
    stats: [['000+', 'عميل'], ['00', 'سنة خبرة'], ['000', 'مشروع'], ['24/7', 'دعم']],
    pricingTitle: 'باقات تناسبك', plans: [['الأساسية', '000', ['ميزة أولى', 'ميزة تانية']], ['المميزة', '000', ['كل اللي في الأساسية', 'ميزة إضافية', 'دعم أسرع']], ['الاحترافية', '000', ['كل حاجة', 'مدير حساب', 'تقارير']]], perMonth: '/ شهر', choose: 'اختار الباقة', popular: 'الأكثر طلباً',
    productsTitle: 'منتجاتنا', product: 'اسم المنتج', productText: 'وصف قصير للمنتج.', price: 'السعر', buy: 'اطلب الآن',
    galleryTitle: 'من أعمالنا', testimonialsTitle: 'آراء عملائنا', quote: 'اكتب هنا رأي عميل حقيقي بإذنه.', customer: 'اسم العميل',
    teamTitle: 'فريقنا', member: 'الاسم', role: 'الوظيفة', timelineTitle: 'إزاي بنشتغل', steps: [['1', 'تواصل', 'بتكلمنا وتقولنا محتاج إيه.'], ['2', 'خطة', 'بنجهزلك خطة واضحة.'], ['3', 'تنفيذ', 'بنبدأ الشغل وتتابع معانا.'], ['4', 'تسليم', 'بتستلم وإنت مطمّن.']],
    faqTitle: 'أسئلة شائعة', faq: [['إزاي أطلب؟', 'اكتب هنا الإجابة.'], ['التوصيل بياخد قد إيه؟', 'اكتب هنا الإجابة.'], ['ينفع أرجّع؟', 'اكتب هنا سياسة الاسترجاع الحقيقية.']],
    ctaTitle: 'جاهز تبدأ؟', ctaText: 'كلمنا النهارده وخلينا نساعدك.', newsTitle: 'اشترك في النشرة', newsText: 'جديدنا يوصلك على الإيميل — ومفيش رسايل مزعجة.', email: 'الإيميل', subscribe: 'اشترك',
    contactTitle: 'تواصل معنا', name: 'الاسم', phone: 'رقم التليفون', message: 'رسالتك', send: 'ابعت',
    loginTitle: 'تسجيل الدخول', password: 'كلمة السر', login: 'دخول', forgot: 'نسيت كلمة السر؟', noAccount: 'معندكش حساب؟ سجّل',
    rights: 'كل الحقوق محفوظة', menu: 'القائمة',
  } : {
    home: 'Home', about: 'About', services: 'Services', pricing: 'Pricing', contact: 'Contact', start: 'Get started', more: 'Learn more',
    heroTitle: 'Everything you need, in one place', heroText: 'Write one short sentence here about what you do, who it is for, and why people choose you.',
    featuresTitle: 'Why choose us?', f: [['⚡', 'Fast', 'Explain the first benefit in one line.'], ['🛡️', 'Secure', 'Explain the second benefit in one line.'], ['💬', 'Support', 'Explain the third benefit in one line.'], ['🎯', 'Precise', 'Explain the fourth benefit in one line.']],
    stats: [['000+', 'Clients'], ['00', 'Years'], ['000', 'Projects'], ['24/7', 'Support']],
    pricingTitle: 'Plans that fit', plans: [['Basic', '000', ['First feature', 'Second feature']], ['Plus', '000', ['Everything in Basic', 'Extra feature', 'Faster support']], ['Pro', '000', ['Everything', 'Account manager', 'Reports']]], perMonth: '/ month', choose: 'Choose plan', popular: 'Most popular',
    productsTitle: 'Our products', product: 'Product name', productText: 'A short product description.', price: 'Price', buy: 'Order now',
    galleryTitle: 'Our work', testimonialsTitle: 'What clients say', quote: 'Put a real client’s words here, with their permission.', customer: 'Client name',
    teamTitle: 'Our team', member: 'Name', role: 'Role', timelineTitle: 'How we work', steps: [['1', 'Talk', 'You tell us what you need.'], ['2', 'Plan', 'We prepare a clear plan.'], ['3', 'Build', 'We do the work with you in the loop.'], ['4', 'Deliver', 'You receive it with peace of mind.']],
    faqTitle: 'Questions', faq: [['How do I order?', 'Write the answer here.'], ['How long is delivery?', 'Write the answer here.'], ['Can I return it?', 'Write your real return policy here.']],
    ctaTitle: 'Ready to start?', ctaText: 'Talk to us today and let us help.', newsTitle: 'Join the newsletter', newsText: 'Our news in your inbox — no spam.', email: 'Email', subscribe: 'Subscribe',
    contactTitle: 'Get in touch', name: 'Name', phone: 'Phone', message: 'Your message', send: 'Send',
    loginTitle: 'Sign in', password: 'Password', login: 'Sign in', forgot: 'Forgot your password?', noAccount: 'No account? Sign up',
    rights: 'All rights reserved', menu: 'Menu',
  };
}

const RADIUS = { sharp: '4px', soft: '12px', round: '22px' };
/** The shared look: colours, font, corners — as CSS variables every block uses. */
export function baseCss(o: BlockOptions): string {
  const p = paletteFrom(o.base, { harmony: o.harmony, dark: o.dark });
  const f = fontPair(o.font, o.rtl);
  return `@import url('${f.css}');
:root{--p:${p.primary};--a:${p.accent};--bg:${p.bg};--sf:${p.surface};--tx:${p.text};--mu:${p.muted};--on:${p.onPrimary};--r:${RADIUS[o.radius]};--line:color-mix(in srgb,var(--tx) 12%,transparent)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:'${f.body}',system-ui,sans-serif;line-height:1.6}
h1,h2,h3{font-family:'${f.heading}',system-ui,sans-serif;line-height:1.2;margin:0 0 .5em}
.sb{padding:72px 20px}.sb-in{max-width:1120px;margin:0 auto}.sb-title{text-align:center;font-size:clamp(26px,4vw,38px);margin-bottom:36px}
.sb-btn{display:inline-block;background:var(--p);color:var(--on);padding:12px 26px;border-radius:var(--r);font-weight:800;text-decoration:none;border:0;cursor:pointer;font:inherit;font-weight:800}
.sb-btn:hover{filter:brightness(1.08)}.sb-btn.ghost{background:transparent;color:var(--p);box-shadow:inset 0 0 0 2px var(--p)}
.sb-card{background:var(--sf);border:1px solid var(--line);border-radius:var(--r);padding:24px}
.sb-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.sb-field{display:block;width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--tx);font:inherit;margin-bottom:12px}
.sb-field:focus{outline:2px solid var(--p);outline-offset:1px}.sb-ph{background:linear-gradient(135deg,color-mix(in srgb,var(--p) 30%,var(--sf)),color-mix(in srgb,var(--a) 30%,var(--sf)));border-radius:var(--r)}
@media (prefers-reduced-motion:no-preference){.sb-btn,.sb-card{transition:transform .2s,filter .2s}.sb-card:hover{transform:translateY(-3px)}}`;
}

type W = ReturnType<typeof words>;
const e = escHtml;
const BLOCKS: Record<BlockId, (w: W, brand: string) => BlockCode> = {
  navbar: (w, b) => ({
    html: `<header class="sb-nav"><div class="sb-in sb-nav-row"><a class="sb-logo" href="#">${e(b)}</a><input type="checkbox" id="sb-menu" class="sb-menu-t" aria-label="${e(w.menu)}"><label for="sb-menu" class="sb-burger" aria-hidden="true">☰</label><nav class="sb-links"><a href="#">${e(w.home)}</a><a href="#about">${e(w.about)}</a><a href="#services">${e(w.services)}</a><a href="#pricing">${e(w.pricing)}</a><a class="sb-btn" href="#contact">${e(w.contact)}</a></nav></div></header>`,
    css: `.sb-nav{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--sf) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}.sb-nav-row{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;flex-wrap:wrap}.sb-logo{font-weight:900;font-size:22px;color:var(--p);text-decoration:none}.sb-links{display:flex;gap:22px;align-items:center}.sb-links a:not(.sb-btn){color:var(--tx);text-decoration:none;font-weight:600}.sb-links a:not(.sb-btn):hover{color:var(--p)}.sb-menu-t,.sb-burger{display:none}@media(max-width:760px){.sb-burger{display:block;font-size:26px;cursor:pointer}.sb-links{display:none;width:100%;flex-direction:column;padding-top:12px}.sb-menu-t:checked~.sb-links{display:flex}}`,
  }),
  hero: (w) => ({
    html: `<section class="sb sb-hero"><div class="sb-in sb-hero-row"><div><h1>${e(w.heroTitle)}</h1><p class="sb-lead">${e(w.heroText)}</p><div class="sb-actions"><a class="sb-btn" href="#contact">${e(w.start)}</a><a class="sb-btn ghost" href="#about">${e(w.more)}</a></div></div><div class="sb-ph sb-hero-art" role="img" aria-label=""></div></div></section>`,
    css: `.sb-hero{background:radial-gradient(circle at 15% 20%,color-mix(in srgb,var(--p) 14%,transparent),transparent 55%),var(--bg)}.sb-hero-row{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center}.sb-hero h1{font-size:clamp(34px,6vw,60px)}.sb-lead{font-size:19px;color:var(--mu);max-width:36ch}.sb-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}.sb-hero-art{aspect-ratio:4/3}@media(max-width:820px){.sb-hero-row{grid-template-columns:1fr}}`,
  }),
  features: (w) => ({
    html: `<section class="sb" id="services"><div class="sb-in"><h2 class="sb-title">${e(w.featuresTitle)}</h2><div class="sb-grid">${w.f.map(([i, t, d]) => `<div class="sb-card sb-feat"><span class="sb-icon" aria-hidden="true">${i}</span><h3>${e(t!)}</h3><p>${e(d!)}</p></div>`).join('')}</div></div></section>`,
    css: `.sb-icon{display:grid;place-items:center;width:52px;height:52px;border-radius:var(--r);background:color-mix(in srgb,var(--p) 14%,transparent);font-size:26px;margin-bottom:14px}.sb-feat p{color:var(--mu);margin:0}`,
  }),
  stats: (w) => ({
    html: `<section class="sb sb-stats"><div class="sb-in sb-grid">${w.stats.map(([n, l]) => `<div class="sb-stat"><strong>${e(n!)}</strong><span>${e(l!)}</span></div>`).join('')}</div></section>`,
    css: `.sb-stats{background:var(--p);color:var(--on);padding:48px 20px}.sb-stat{text-align:center}.sb-stat strong{display:block;font-size:44px;font-weight:900;line-height:1.1}.sb-stat span{opacity:.85}`,
  }),
  pricing: (w) => ({
    html: `<section class="sb" id="pricing"><div class="sb-in"><h2 class="sb-title">${e(w.pricingTitle)}</h2><div class="sb-grid sb-plans">${w.plans.map(([name, price, list], i) => `<div class="sb-card sb-plan${i === 1 ? ' hot' : ''}">${i === 1 ? `<span class="sb-badge">${e(w.popular)}</span>` : ''}<h3>${e(name as string)}</h3><p class="sb-price"><b>${e(price as string)}</b> ${e(w.perMonth)}</p><ul>${(list as string[]).map((x) => `<li>${e(x)}</li>`).join('')}</ul><a class="sb-btn${i === 1 ? '' : ' ghost'}" href="#contact">${e(w.choose)}</a></div>`).join('')}</div></div></section>`,
    css: `.sb-plan{position:relative;display:flex;flex-direction:column}.sb-plan.hot{border:2px solid var(--p);box-shadow:0 18px 40px -20px var(--p)}.sb-badge{position:absolute;top:-13px;inset-inline-start:24px;background:var(--a);color:#fff;font-size:12px;font-weight:800;padding:3px 12px;border-radius:99px}.sb-price b{font-size:40px;color:var(--p)}.sb-plan ul{list-style:none;padding:0;margin:0 0 20px;flex:1}.sb-plan li{padding:7px 0;border-bottom:1px dashed var(--line)}.sb-plan li::before{content:'✓ ';color:var(--p);font-weight:900}`,
  }),
  products: (w) => ({
    html: `<section class="sb"><div class="sb-in"><h2 class="sb-title">${e(w.productsTitle)}</h2><div class="sb-grid">${[1, 2, 3, 4].map(() => `<article class="sb-card sb-prod"><div class="sb-ph sb-prod-img" role="img" aria-label=""></div><h3>${e(w.product)}</h3><p>${e(w.productText)}</p><div class="sb-prod-row"><b>${e(w.price)}</b><a class="sb-btn" href="#contact">${e(w.buy)}</a></div></article>`).join('')}</div></div></section>`,
    css: `.sb-prod{padding:14px}.sb-prod-img{aspect-ratio:1;margin-bottom:14px}.sb-prod p{color:var(--mu);margin:0 0 14px}.sb-prod-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.sb-prod-row .sb-btn{padding:9px 16px}`,
  }),
  gallery: (w) => ({
    html: `<section class="sb"><div class="sb-in"><h2 class="sb-title">${e(w.galleryTitle)}</h2><div class="sb-gal">${[1, 2, 3, 4, 5, 6].map((n) => `<div class="sb-ph sb-gal-${n}" role="img" aria-label=""></div>`).join('')}</div></div></section>`,
    css: `.sb-gal{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:180px;gap:14px}.sb-gal-1{grid-row:span 2}.sb-gal-5{grid-column:span 2}@media(max-width:700px){.sb-gal{grid-template-columns:1fr 1fr}.sb-gal-5{grid-column:auto}}`,
  }),
  testimonials: (w) => ({
    html: `<section class="sb sb-alt"><div class="sb-in"><h2 class="sb-title">${e(w.testimonialsTitle)}</h2><div class="sb-grid">${[1, 2, 3].map(() => `<figure class="sb-card sb-quote"><blockquote>“${e(w.quote)}”</blockquote><figcaption><span class="sb-ph sb-ava" aria-hidden="true"></span>${e(w.customer)}</figcaption></figure>`).join('')}</div></div></section>`,
    css: `.sb-alt{background:color-mix(in srgb,var(--p) 6%,var(--bg))}.sb-quote{margin:0}.sb-quote blockquote{margin:0 0 16px;font-size:17px}.sb-quote figcaption{display:flex;align-items:center;gap:10px;font-weight:800}.sb-ava{display:inline-block;width:40px;height:40px;border-radius:50%}`,
  }),
  team: (w) => ({
    html: `<section class="sb"><div class="sb-in"><h2 class="sb-title">${e(w.teamTitle)}</h2><div class="sb-grid">${[1, 2, 3, 4].map(() => `<div class="sb-member"><div class="sb-ph sb-photo" role="img" aria-label=""></div><h3>${e(w.member)}</h3><p>${e(w.role)}</p></div>`).join('')}</div></div></section>`,
    css: `.sb-member{text-align:center}.sb-photo{width:140px;height:140px;border-radius:50%;margin:0 auto 14px}.sb-member p{color:var(--mu);margin:0}`,
  }),
  timeline: (w) => ({
    html: `<section class="sb"><div class="sb-in"><h2 class="sb-title">${e(w.timelineTitle)}</h2><ol class="sb-steps">${w.steps.map(([n, t, d]) => `<li><span class="sb-num">${e(n!)}</span><div><h3>${e(t!)}</h3><p>${e(d!)}</p></div></li>`).join('')}</ol></div></section>`,
    css: `.sb-steps{list-style:none;padding:0;margin:0 auto;max-width:720px;border-inline-start:3px solid color-mix(in srgb,var(--p) 30%,transparent)}.sb-steps li{display:flex;gap:16px;padding:0 0 26px;margin-inline-start:-22px}.sb-num{flex:none;display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:var(--p);color:var(--on);font-weight:900}.sb-steps p{color:var(--mu);margin:0}`,
  }),
  faq: (w) => ({
    html: `<section class="sb"><div class="sb-in sb-narrow"><h2 class="sb-title">${e(w.faqTitle)}</h2>${w.faq.map(([q, a]) => `<details class="sb-card sb-faq"><summary>${e(q!)}</summary><p>${e(a!)}</p></details>`).join('')}</div></section>`,
    css: `.sb-narrow{max-width:760px}.sb-faq{margin-bottom:12px;padding:18px 22px}.sb-faq summary{cursor:pointer;font-weight:800;list-style:none;display:flex;justify-content:space-between;gap:12px}.sb-faq summary::after{content:'+';color:var(--p);font-size:22px;line-height:1}.sb-faq[open] summary::after{content:'–'}.sb-faq p{color:var(--mu);margin:12px 0 0}`,
  }),
  cta: (w) => ({
    html: `<section class="sb"><div class="sb-in sb-cta"><h2>${e(w.ctaTitle)}</h2><p>${e(w.ctaText)}</p><a class="sb-btn" href="#contact">${e(w.start)}</a></div></section>`,
    css: `.sb-cta{text-align:center;padding:56px 24px;border-radius:calc(var(--r) * 1.5);background:linear-gradient(135deg,var(--p),var(--a));color:var(--on)}.sb-cta h2{font-size:clamp(28px,4vw,40px)}.sb-cta p{opacity:.9;margin:0 0 24px}.sb-cta .sb-btn{background:var(--on);color:var(--p)}`,
  }),
  newsletter: (w) => ({
    html: `<section class="sb"><div class="sb-in sb-card sb-news"><div><h2>${e(w.newsTitle)}</h2><p>${e(w.newsText)}</p></div><form class="sb-news-form" onsubmit="event.preventDefault()"><label class="sb-sr" for="sb-news-email">${e(w.email)}</label><input id="sb-news-email" class="sb-field" type="email" required placeholder="${e(w.email)}" autocomplete="email"><button class="sb-btn" type="submit">${e(w.subscribe)}</button></form></div></section>`,
    css: `.sb-news{display:flex;gap:24px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:36px}.sb-news p{color:var(--mu);margin:0}.sb-news-form{display:flex;gap:10px;flex:1;min-width:260px}.sb-news-form .sb-field{margin:0}.sb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}`,
  }),
  contact: (w) => ({
    html: `<section class="sb" id="contact"><div class="sb-in sb-narrow"><h2 class="sb-title">${e(w.contactTitle)}</h2><form class="sb-card" onsubmit="event.preventDefault()"><label>${e(w.name)}<input class="sb-field" name="name" required autocomplete="name"></label><label>${e(w.email)}<input class="sb-field" name="email" type="email" required autocomplete="email"></label><label>${e(w.phone)}<input class="sb-field" name="phone" type="tel" inputmode="tel" autocomplete="tel"></label><label>${e(w.message)}<textarea class="sb-field" name="message" rows="4" required></textarea></label><button class="sb-btn" type="submit">${e(w.send)}</button></form></div></section>`,
    css: `#contact label{display:block;font-weight:700;font-size:14px}#contact .sb-field{margin-top:6px}`,
  }),
  login: (w) => ({
    html: `<section class="sb sb-login"><form class="sb-card sb-login-box" onsubmit="event.preventDefault()"><h2>${e(w.loginTitle)}</h2><label>${e(w.email)}<input class="sb-field" type="email" required autocomplete="username"></label><label>${e(w.password)}<input class="sb-field" type="password" required autocomplete="current-password"></label><button class="sb-btn" type="submit">${e(w.login)}</button><p><a href="#">${e(w.forgot)}</a> · <a href="#">${e(w.noAccount)}</a></p></form></section>`,
    css: `.sb-login{display:grid;place-items:center;min-height:70vh}.sb-login-box{width:min(420px,100%);padding:32px}.sb-login-box label{display:block;font-weight:700;font-size:14px}.sb-login-box .sb-field{margin-top:6px}.sb-login-box .sb-btn{width:100%}.sb-login-box p{text-align:center;font-size:14px;margin:16px 0 0}.sb-login-box a{color:var(--p)}`,
  }),
  footer: (w, b) => ({
    html: `<footer class="sb-foot"><div class="sb-in sb-foot-row"><div><b class="sb-logo">${e(b)}</b><p>${e(w.heroText)}</p></div><nav><a href="#">${e(w.home)}</a><a href="#about">${e(w.about)}</a><a href="#services">${e(w.services)}</a><a href="#contact">${e(w.contact)}</a></nav></div><p class="sb-copy">© <span>${new Date().getFullYear()}</span> ${e(b)} — ${e(w.rights)}</p></footer>`,
    css: `.sb-foot{background:color-mix(in srgb,var(--tx) 92%,var(--p));color:color-mix(in srgb,var(--bg) 85%,transparent);padding:48px 20px 20px}.sb-foot-row{display:flex;justify-content:space-between;gap:30px;flex-wrap:wrap}.sb-foot .sb-logo{color:var(--bg);font-size:22px}.sb-foot p{max-width:40ch;opacity:.8}.sb-foot nav{display:flex;flex-direction:column;gap:8px}.sb-foot a{color:inherit;text-decoration:none}.sb-foot a:hover{color:var(--bg)}.sb-copy{text-align:center;border-top:1px solid color-mix(in srgb,var(--bg) 20%,transparent);margin:30px auto 0;padding-top:16px;font-size:13px;max-width:none!important}`,
  }),
};

/** One block's HTML and its own CSS (without the shared look). */
export function blockCode(id: BlockId, o: BlockOptions): BlockCode {
  const make = BLOCKS[id] || BLOCKS.hero;
  return make(words(o.rtl), o.brand.trim() || (o.rtl ? 'اسم البراند' : 'Brand'));
}

/** A whole page from the chosen blocks, ready to open or publish. */
export function blocksPage(ids: BlockId[], o: BlockOptions, extra: BlockCode[] = []): string {
  const parts = [...ids.map((id) => blockCode(id, o)), ...extra];
  const css = [baseCss(o), ...new Set(parts.map((p) => p.css))].join('\n');
  const title = escHtml(o.brand.trim() || 'Shaheen');
  return `<!doctype html>
<html lang="${o.rtl ? 'ar' : 'en'}" dir="${o.rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
${css}
</style>
</head>
<body>
${parts.map((p) => p.html).join('\n')}
</body>
</html>`;
}

/** The block as a React component (JSX). */
export function toReact(code: BlockCode, o: BlockOptions, name = 'ShaheenBlock'): string {
  const jsx = code.html
    .replace(/\sclass="/g, ' className="')
    .replace(/\sfor="/g, ' htmlFor="')
    .replace(/\sautocomplete="/g, ' autoComplete="')
    .replace(/\sinputmode="/g, ' inputMode="')
    .replace(/\sonsubmit="event\.preventDefault\(\)"/g, ' onSubmit={(e) => e.preventDefault()}')
    .replace(/\srows="(\d+)"/g, ' rows={$1}')
    .replace(/<(input|img|br|hr)([^>]*?)\s*>/g, '<$1$2 />')
    .replace(/<span>(\d{4})<\/span>/, '<span>{new Date().getFullYear()}</span>');
  const css = `${baseCss(o)}\n${code.css}`.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return `// ${name}.jsx — made in Shaheen Studio (plain React, no extra packages)
export default function ${name}() {
  return (
    <div dir="${o.rtl ? 'rtl' : 'ltr'}">
      <style>{\`${css}\`}</style>
      ${jsx}
    </div>
  );
}
`;
}

/** The block as a Vue single-file component. */
export function toVue(code: BlockCode, o: BlockOptions): string {
  const html = code.html.replace(/\sonsubmit="event\.preventDefault\(\)"/g, ' @submit.prevent').replace(/<span>(\d{4})<\/span>/, '<span>{{ new Date().getFullYear() }}</span>');
  return `<!-- Made in Shaheen Studio -->
<template>
  <div dir="${o.rtl ? 'rtl' : 'ltr'}">
    ${html}
  </div>
</template>

<style>
${baseCss(o)}
${code.css}
</style>
`;
}

/** Words that point to each block (Arabic dialects and English), for «describe the block you want». */
const HINTS: Record<BlockId, RegExp> = {
  navbar: /ناف|قائمة|قايمة|منيو علوي|هيدر|header|nav|menu bar|شريط علوي/i,
  hero: /هيرو|واجهة|بانر رئيسي|أول الصفحة|اول الصفحة|hero|landing|banner/i,
  features: /مميزات|مزايا|خدمات|features|services|benefits/i,
  stats: /أرقام|ارقام|إحصائيات|احصائيات|عدادات|stats|counters|numbers/i,
  pricing: /أسعار|اسعار|باقات|باقة|خطط|pricing|plans|subscription/i,
  products: /منتجات|منتج|كروت منتجات|متجر|products?|shop|store|cards?/i,
  gallery: /معرض|صور|جاليري|بورتفوليو|gallery|portfolio|images/i,
  testimonials: /آراء|اراء|تقييمات|شهادات|ريفيو|testimonials?|reviews/i,
  team: /فريق|الفريق|موظفين|team|staff/i,
  timeline: /خطوات|مراحل|تايم ?لاين|إزاي بنشتغل|timeline|steps|process/i,
  faq: /أسئلة|اسئلة|faq|questions|accordion/i,
  cta: /دعوة|اتصل بنا الآن|ابدأ|cta|call to action/i,
  newsletter: /نشرة|اشتراك|إيميلات|newsletter|subscribe/i,
  contact: /تواصل|اتصال|راسلنا|contact|get in touch|message form/i,
  login: /دخول|تسجيل|لوجين|login|sign ?in|sign ?up|register/i,
  footer: /فوتر|ذيل|آخر الصفحة|اخر الصفحة|footer/i,
};
/** The blocks a description asks for, in page order (empty when nothing matches). */
export function blocksFor(text: string): BlockId[] {
  return BLOCK_IDS.filter((id) => HINTS[id].test(text));
}

/** The first ```html (or bare HTML) in a reply, as a block: its <style> split out, scripts and handlers removed. */
export function blockFromReply(reply: string): BlockCode | undefined {
  const fenced = reply.match(/```(?:html|htm)?\s*\n([\s\S]*?)```/i)?.[1] || (/<\w+[\s>]/.test(reply) ? reply : '');
  if (!fenced.trim()) return undefined;
  let html = fenced.replace(/<!doctype[^>]*>/gi, '').replace(/<\/?(html|head|body)[^>]*>/gi, '').replace(/<meta[^>]*>|<title>[\s\S]*?<\/title>/gi, '');
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]!.trim()).join('\n');
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
    .replace(/<form(\s|>)/gi, '<form onsubmit="event.preventDefault()"$1')
    .trim();
  return html ? { html, css: css.replace(/<\/style/gi, '') } : undefined;
}
