import React from 'react';
import { Bookmark, Coffee, FlaskConical, Home, Mail, MessageCircle, Radio, ShieldCheck, Store, User, Users, Wrench } from 'lucide-react';
import { tx, type Lang } from './ui';

/** Every shortcut resolves to an existing feature; no placeholder groups or demo members. */
export const communitySections = [
  { ar: 'مجتمعك', en: 'Your community', links: [
    { route: '', ar: 'الموجز', en: 'Feed', detailAr: 'تجارب وأفكار من صناع العطور', detailEn: 'Experiences and ideas from perfumers', icon: Home },
    { route: 'saved', ar: 'المنشورات المحفوظة', en: 'Saved posts', detailAr: 'ارجع للمنشورات اللي حفظتها في حسابك', detailEn: 'Revisit posts saved to your account', icon: Bookmark },
    { route: 'friends', ar: 'الأصدقاء', en: 'Friends', detailAr: 'طلبات الصداقة واكتشاف أعضاء', detailEn: 'Requests and member discovery', icon: Users },
    { route: 'discussions', ar: 'مجلس النقاش', en: 'Discussions', detailAr: 'اسأل وشارك خبرتك مع المجتمع', detailEn: 'Ask questions and share your expertise', icon: Coffee },
    { route: 'news', ar: 'أخبار العطور', en: 'Perfume news', detailAr: 'تابع نشرة المجتمع', detailEn: 'Read the community bulletin', icon: Radio },
  ] },
  { ar: 'تواصل وحسابك', en: 'Connect and manage', links: [
    { route: 'messenger', ar: 'ماسنجر شام', en: 'Sham Messenger', detailAr: 'محادثاتك في مكان واحد', detailEn: 'Your conversations in one place', icon: MessageCircle },
    { route: 'mail', ar: 'بريد شام', en: 'Sham Mail', detailAr: 'المراسلات وصندوق الوارد', detailEn: 'Correspondence and inbox', icon: Mail },
    { route: 'me', ar: 'بوابتي', en: 'My portal', detailAr: 'ملفك وإعدادات حسابك', detailEn: 'Your profile and account settings', icon: User },
    { route: 'me/recipes', ar: 'تركيباتي', en: 'My formulas', detailAr: 'إبداعاتك العطرية المحفوظة', detailEn: 'Your saved fragrance creations', icon: FlaskConical },
  ] },
  { ar: 'عالم شام', en: 'The world of Sham', links: [
    { route: 'stores', ar: 'سوق التجار', en: 'Merchants’ market', detailAr: 'اكتشف المتاجر داخل المجتمع', detailEn: 'Discover community stores', icon: Store },
    { route: 'merchant', ar: 'بوابة التجار', en: 'Merchant portal', detailAr: 'أدوات إدارة نشاطك', detailEn: 'Tools to manage your business', icon: Wrench },
  ] },
];

export default function CommunityDirectory({ lang, go, search }: { lang: Lang; go: (route: string) => void; search?: React.ReactNode }) {
  const t = tx(lang);
  return <div className="mx-auto max-w-5xl space-y-6">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-amber-950 to-stone-900 px-6 py-8 text-white sm:p-10">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-white/5 px-3 py-1 text-xs text-amber-200"><FlaskConical className="h-4 w-4" />{t('مجتمع شام • ملتقى صناع العطور', 'Sham Community • The perfumers’ hub')}</div>
      <h1 className="text-2xl font-black sm:text-4xl">{t('ناس تشاركك شغف العطر.', 'People who share your passion for fragrance.')}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-300">{t('تواصل مع أصحابك، شارك تجاربك وتركيباتك، وخلي خبرتك جزء من مجتمع بيكبر معاك.', 'Connect with friends, share your experiments and formulas, and help a community grow with your expertise.')}</p>
    </section>
    {search}
    {communitySections.map(section => <section key={section.en}>
      <h2 className="mb-3 text-lg font-black text-stone-900">{t(section.ar, section.en)}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {section.links.map(({ route, ar, en, detailAr, detailEn, icon: Icon }) => <button key={route} type="button" onClick={() => go(route)} className="group flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-start shadow-sm transition hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-700">
          <span className="rounded-xl bg-amber-50 p-2.5 text-amber-800 group-hover:bg-amber-100"><Icon className="h-5 w-5" /></span>
          <span><span className="block text-sm font-bold text-stone-900">{t(ar, en)}</span><span className="mt-1 block text-xs leading-5 text-stone-500">{t(detailAr, detailEn)}</span></span>
        </button>)}
      </div>
    </section>)}
    <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-5"><ShieldCheck className="h-6 w-6 shrink-0 text-amber-700" /><div><h2 className="text-sm font-bold">{t('مجتمع محترم، وخبرة حقيقية', 'Respectful community, real expertise')}</h2><p className="mt-1 text-xs leading-6 text-stone-600">{t('احترم خصوصية غيرك، وانسب التركيبات لأصحابها. لو شفت إساءة، استخدم الإبلاغ من قائمة المنشور أو الحظر من الملف الشخصي.', 'Respect others’ privacy and credit formula creators. Report abuse from the post menu or block from a member’s profile.')}</p></div></div>
  </div>;
}
