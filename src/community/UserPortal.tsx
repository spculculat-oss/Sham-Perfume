/**
 * «بوابتي»: the member's own space — profile (public part and private, encrypted part), saved recipes,
 * learning progress, orders, and security & privacy (password, sessions, data export, account deletion).
 */
import { useRef, useState } from 'react';
import { BookOpen, Camera, Download, FlaskConical, Globe2, KeyRound, Lock, LogOut, Package, ShieldCheck, Trash2, Upload, User, Users } from 'lucide-react';
import { countryOptions } from '../utils/storeCheckout';
import { cx, resizeImage, type Learning, type Me, type Order, type Recipe } from './api';
import { setMe, signOut, type SessionState } from './session';
import { RecipeCard } from './SocialPortal';
import { Avatar, Btn, Card, Empty, Field, Spinner, errorText, inputClass, money, timeAgo, tx, useLoad, type Lang } from './ui';

type Section = 'overview' | 'profile' | 'recipes' | 'learning' | 'orders' | 'security';
interface Props { lang: Lang; session: SessionState; section?: string; go: (r: string) => void; toast: (s: string) => void }

export default function UserPortal({ lang, session, section, go, toast }: Props) {
  const t = tx(lang);
  const me = session.me!;
  const current = (['overview', 'profile', 'recipes', 'learning', 'orders', 'security'].includes(section || '') ? section : 'overview') as Section;
  const nav: [Section, string, React.ReactNode][] = [
    ['overview', t('نظرة عامة', 'Overview'), <User key="o" className="h-4 w-4" />],
    ['profile', t('ملفي الشخصي', 'My profile'), <Camera key="p" className="h-4 w-4" />],
    ['recipes', t('تركيباتي', 'My recipes'), <FlaskConical key="r" className="h-4 w-4" />],
    ['learning', t('تعلّمي', 'My learning'), <BookOpen key="l" className="h-4 w-4" />],
    ['orders', t('مشترياتي', 'My orders'), <Package key="d" className="h-4 w-4" />],
    ['security', t('الأمان والخصوصية', 'Security & privacy'), <ShieldCheck key="s" className="h-4 w-4" />],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <Card className="h-fit p-2">
        <div className="flex items-center gap-3 p-3"><Avatar user={me} size={48} /><div className="min-w-0"><p className="truncate font-bold">{me.name}</p><p className="truncate text-xs text-stone-500">@{me.handle}</p></div></div>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {nav.map(([id, label, icon]) => (
            <button key={id} type="button" onClick={() => go(`me/${id}`)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold cursor-pointer ${current === id ? 'bg-amber-100 text-amber-900' : 'text-stone-600 hover:bg-stone-50'}`}>{icon}{label}</button>
          ))}
        </nav>
      </Card>
      <div className="min-w-0">
        {current === 'overview' && <Overview lang={lang} me={me} go={go} />}
        {current === 'profile' && <ProfileForm lang={lang} me={me} toast={toast} />}
        {current === 'recipes' && <Recipes lang={lang} toast={toast} />}
        {current === 'learning' && <LearningList lang={lang} />}
        {current === 'orders' && <Orders lang={lang} />}
        {current === 'security' && <Security lang={lang} me={me} toast={toast} go={go} />}
      </div>
    </div>
  );
}

function Overview({ lang, me, go }: { lang: Lang; me: Me; go: (r: string) => void }) {
  const t = tx(lang);
  const tiles: [string, number, string, React.ReactNode][] = [
    [t('تركيبات محفوظة', 'Saved recipes'), me.counts.recipes, 'me/recipes', <FlaskConical key="r" className="h-5 w-5" />],
    [t('أصدقاء', 'Friends'), me.counts.friends, 'friends', <Users key="f" className="h-5 w-5" />],
    [t('مشتريات', 'Orders'), me.counts.orders, 'me/orders', <Package key="o" className="h-5 w-5" />],
    [t('منشورات', 'Posts'), me.counts.posts, `u/${me.handle}`, <Globe2 key="p" className="h-5 w-5" />],
  ];
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-stone-900 to-amber-800 p-5 text-white">
          <p className="text-sm text-amber-200">{t('أهلاً بيك في بوابتك', 'Welcome to your portal')}</p>
          <h2 className="mt-1 text-2xl font-black">{me.name}</h2>
          <p className="mt-1 text-xs text-stone-300">{t('عضو منذ', 'Member since')} {new Date(me.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-stone-100 sm:grid-cols-4">
          {tiles.map(([label, n, route, icon]) => (
            <button key={label} type="button" onClick={() => go(route)} className="bg-white p-4 text-start hover:bg-amber-50 cursor-pointer">
              <span className="text-amber-600">{icon}</span><span className="mt-1 block text-2xl font-black text-stone-900">{n}</span><span className="text-xs text-stone-500">{label}</span>
            </button>
          ))}
        </div>
      </Card>
      {me.merchant && (
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <span className="text-2xl">🏪</span>
          <div className="flex-1"><p className="font-bold">{me.merchant.storeName}</p><p className="text-xs text-stone-500">{merchantStatus(me.merchant.status, lang)}</p></div>
          <Btn variant="soft" onClick={() => go('merchant')}>{t('بوابة التاجر', 'Merchant portal')}</Btn>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink title={t('اكتب منشور', 'Write a post')} body={t('شارك المجتمع تجربتك', 'Share with the community')} onClick={() => go('social')} />
        <QuickLink title={t('افتح الماسنجر', 'Open messenger')} body={t('راسل أصدقاءك', 'Message your friends')} onClick={() => go('messenger')} />
        <QuickLink title={me.merchant ? t('متجري', 'My store') : t('افتح متجرك', 'Open a store')} body={t('بيع منتجاتك داخل شام', 'Sell inside Sham')} onClick={() => go('merchant')} />
      </div>
    </div>
  );
}
const QuickLink = ({ title, body, onClick }: { title: string; body: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="rounded-2xl border border-stone-200 bg-white p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 cursor-pointer">
    <span className="block font-bold text-stone-900">{title}</span><span className="text-xs text-stone-500">{body}</span>
  </button>
);
export const merchantStatus = (s: string, lang: Lang) => {
  const t = tx(lang);
  return ({ pending: t('⏳ تحت مراجعة الإدارة', '⏳ Under review'), approved: t('✅ متجر معتمد', '✅ Approved'), rejected: t('✏️ مطلوب تعديلات', '✏️ Changes requested'), suspended: t('⛔ موقوف', '⛔ Suspended') } as Record<string, string>)[s] || s;
};

function ProfileForm({ lang, me, toast }: { lang: Lang; me: Me; toast: (s: string) => void }) {
  const t = tx(lang);
  const [f, setF] = useState({ name: me.name, handle: me.handle, bio: me.bio, country: me.country, craftLevel: me.craftLevel, lang: me.lang, avatar: me.avatar, phone: me.private.phone || '', city: me.private.city || '', address: me.private.address || '' });
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    try {
      const next = await cx<Me>('/community/me', { method: 'PATCH', body: { name: f.name, handle: f.handle, bio: f.bio, country: f.country, craftLevel: f.craftLevel, lang: f.lang, avatar: f.avatar, private: { phone: f.phone, city: f.city, address: f.address } } });
      setMe(next); toast(t('تم حفظ ملفك ✅', 'Profile saved ✅'));
    } catch (e) { toast(errorText(e, lang)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold"><Globe2 className="h-4 w-4 text-amber-600" />{t('البيانات العامة — يشوفها المجتمع', 'Public — visible to the community')}</h3>
        <div className="mb-4 flex items-center gap-4">
          <Avatar user={{ id: me.id, name: f.name || me.name, avatar: f.avatar }} size={84} />
          <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) resizeImage(x, 400, 0.85).then((a) => setF((v) => ({ ...v, avatar: a }))).catch(() => toast(t('الصورة دي مش مدعومة', 'Unsupported image'))); }} />
          <div className="flex gap-2"><Btn small variant="soft" onClick={() => file.current?.click()}><Camera className="h-4 w-4" />{t('تغيير الصورة', 'Change photo')}</Btn>{f.avatar && <Btn small variant="ghost" onClick={() => setF((v) => ({ ...v, avatar: null }))}>{t('إزالة', 'Remove')}</Btn>}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('الاسم', 'Name')}><input className={inputClass} value={f.name} onChange={set('name')} maxLength={60} /></Field>
          <Field label={t('اسم المستخدم', 'Username')} hint={t('حروف إنجليزية وأرقام و _ فقط', 'Letters, numbers and _ only')}><input className={inputClass} value={f.handle} onChange={set('handle')} maxLength={30} dir="ltr" /></Field>
          <Field label={t('الدولة', 'Country')}><select className={inputClass} value={f.country} onChange={set('country')}>{countryOptions(lang).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></Field>
          <Field label={t('مستواك', 'Level')}><select className={inputClass} value={f.craftLevel} onChange={set('craftLevel')}>
            <option value="hobbyist">{t('هاوي', 'Hobbyist')}</option><option value="perfumer">{t('صانع عطور', 'Perfumer')}</option><option value="master_lab">{t('معمل / مصنع', 'Lab / factory')}</option></select></Field>
        </div>
        <div className="mt-3"><Field label={t('نبذة عنك', 'Bio')}><textarea className={inputClass} rows={3} value={f.bio} onChange={set('bio')} maxLength={500} /></Field></div>
      </Card>
      <Card className="p-5">
        <h3 className="mb-1 flex items-center gap-2 font-bold"><Lock className="h-4 w-4 text-emerald-600" />{t('بيانات خاصة — مشفّرة', 'Private — encrypted')}</h3>
        <p className="mb-4 text-xs text-stone-500">{t('محدش في المجتمع يشوفها. بتُستخدم لتوصيل طلباتك فقط.', 'Never shown to the community. Used only to deliver your orders.')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('الموبايل', 'Phone')}><input className={inputClass} value={f.phone} onChange={set('phone')} dir="ltr" inputMode="tel" /></Field>
          <Field label={t('المدينة', 'City')}><input className={inputClass} value={f.city} onChange={set('city')} /></Field>
        </div>
        <div className="mt-3"><Field label={t('العنوان', 'Address')}><textarea className={inputClass} rows={2} value={f.address} onChange={set('address')} /></Field></div>
      </Card>
      <Btn busy={busy} onClick={() => void save()} className="w-full sm:w-auto">{t('حفظ التغييرات', 'Save changes')}</Btn>
    </div>
  );
}

const LOCAL_FORMULAS = 'miyaar_perfume_saved_formulas';

function Recipes({ lang, toast }: { lang: Lang; toast: (s: string) => void }) {
  const t = tx(lang);
  const { data, loading, reload } = useLoad(() => cx<Recipe[]>('/community/me/recipes'));
  const [importing, setImporting] = useState(false);
  const local = (() => { try { const v = JSON.parse(localStorage.getItem(LOCAL_FORMULAS) || '[]'); return Array.isArray(v) ? v as { id: string; title: string; notes?: string }[] : []; } catch { return []; } })();
  const fresh = local.filter((f) => f?.title && !(data || []).some((r) => r.title === f.title));
  const importAll = async () => {
    setImporting(true);
    let n = 0;
    for (const f of fresh.slice(0, 200)) { try { await cx('/community/me/recipes', { body: { title: f.title, data: f, notes: f.notes || '' } }); n++; } catch { /* skip */ } }
    setImporting(false); toast(t(`تم نقل ${n} تركيبة لحسابك ✅`, `${n} recipes moved to your account ✅`)); void reload(true);
  };
  const setVisibility = async (r: Recipe, visibility: Recipe['visibility']) => {
    try { await cx('/community/me/recipes', { body: { id: r.id, title: r.title, data: r.data, notes: r.notes, visibility } }); void reload(true); } catch (e) { toast(errorText(e, lang)); }
  };
  const del = async (r: Recipe) => { if (!confirm(t('حذف التركيبة؟', 'Delete recipe?'))) return; try { await cx(`/community/me/recipes/${r.id}`, { method: 'DELETE' }); void reload(true); } catch (e) { toast(errorText(e, lang)); } };
  return (
    <div className="space-y-4">
      {fresh.length > 0 && (
        <Card className="flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50 p-4">
          <Upload className="h-6 w-6 text-amber-700" />
          <p className="flex-1 text-sm text-amber-900">{t(`عندك ${fresh.length} تركيبة محفوظة على الجهاز ده بس. انقلها لحسابك علشان تلاقيها على أي جهاز.`, `${fresh.length} recipes are saved on this device only. Move them to your account.`)}</p>
          <Btn busy={importing} onClick={() => void importAll()}>{t('نقل لحسابي', 'Move to my account')}</Btn>
        </Card>
      )}
      <p className="text-xs text-stone-500">{t('أي تركيبة تحفظها من الحاسبة وأنت مسجّل بتتحفظ هنا تلقائياً.', 'Recipes you save in the calculator while signed in appear here automatically.')}</p>
      {loading ? <Spinner /> : !data?.length ? <Card><Empty icon={<FlaskConical className="h-10 w-10" />} title={t('لسه مفيش تركيبات', 'No recipes yet')} body={t('احفظ أول تركيبة من حاسبة التركيز.', 'Save your first recipe from the concentration calculator.')} /></Card> : (
        <div className="grid gap-3 md:grid-cols-2">{data.map((r) => (
          <Card key={r.id} className="pb-3">
            <RecipeCard lang={lang} title={r.title} data={r.data} />
            <div className="mt-3 flex flex-wrap items-center gap-2 px-4">
              <select value={r.visibility} onChange={(e) => void setVisibility(r, e.target.value as Recipe['visibility'])} className="rounded-lg border border-stone-200 px-2 py-1 text-xs">
                <option value="private">🔒 {t('خاصة', 'Private')}</option><option value="friends">👥 {t('للأصدقاء', 'Friends')}</option><option value="public">🌍 {t('عامة على ملفي', 'Public on my profile')}</option>
              </select>
              <span className="text-[11px] text-stone-400">{timeAgo(r.updatedAt, lang)}</span>
              <button type="button" onClick={() => void del(r)} className="ms-auto text-stone-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
            </div>
          </Card>
        ))}</div>
      )}
    </div>
  );
}

function LearningList({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const { data, loading } = useLoad(() => cx<Learning[]>('/community/me/learning'));
  const open = (itemId: string) => { const tab = itemId.replace(/^section:/, ''); window.location.hash = tab; };
  return (
    <Card className="p-5">
      <h3 className="mb-1 font-bold">{t('رحلة التعلّم', 'Your learning journey')}</h3>
      <p className="mb-4 text-xs text-stone-500">{t('كل قسم تفتحه في الموقع وأنت مسجّل بيتسجّل هنا، ويكتمل لما تقضي فيه دقيقتين.', 'Each section you open while signed in is tracked here, and completes after two minutes.')}</p>
      {loading ? <Spinner /> : !data?.length ? <Empty icon={<BookOpen className="h-10 w-10" />} title={t('ابدأ رحلتك', 'Start learning')} action={<Btn small onClick={() => { window.location.hash = 'guide'; }}>{t('افتح دليل صناعة العطور', 'Open the guide')}</Btn>} /> : (
        <div className="space-y-3">{data.map((l) => (
          <button key={l.itemId} type="button" onClick={() => open(l.itemId)} className="block w-full rounded-xl border border-stone-100 p-3 text-start hover:border-amber-300 cursor-pointer">
            <span className="flex items-center justify-between text-sm"><span className="font-semibold">{l.title}</span><span className={l.progress >= 100 ? 'text-emerald-600' : 'text-amber-700'}>{l.progress >= 100 ? t('مكتمل ✅', 'Done ✅') : `${l.progress}%`}</span></span>
            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-stone-100"><span className={`block h-full rounded-full ${l.progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${l.progress}%` }} /></span>
            <span className="mt-1 block text-[11px] text-stone-400">{timeAgo(l.updatedAt, lang)}</span>
          </button>
        ))}</div>
      )}
    </Card>
  );
}

export const ORDER_STATUS: Record<string, [string, string, string]> = {
  awaiting_payment: ['في انتظار الدفع', 'Awaiting payment', 'bg-stone-100 text-stone-700'],
  paid: ['مدفوع — جاري التجهيز', 'Paid — being prepared', 'bg-sky-100 text-sky-800'],
  processing: ['جاهز للشحن', 'Ready to ship', 'bg-violet-100 text-violet-800'],
  shipped: ['تم الشحن 🚚', 'Shipped 🚚', 'bg-amber-100 text-amber-900'],
  delivered: ['تم التسليم ✅', 'Delivered ✅', 'bg-emerald-100 text-emerald-800'],
  cancelled: ['ملغي', 'Cancelled', 'bg-rose-100 text-rose-700'],
  refunded: ['مسترد', 'Refunded', 'bg-rose-100 text-rose-700'],
};

function Orders({ lang }: { lang: Lang }) {
  const t = tx(lang);
  const { data, loading } = useLoad(() => cx<Order[]>('/community/me/orders'));
  return (
    <div className="space-y-3">
      {loading ? <Spinner /> : !data?.length ? <Card><Empty icon={<Package className="h-10 w-10" />} title={t('لسه مفيش مشتريات', 'No orders yet')} body={t('الطلبات اللي بتدفعها من «متجر شام» وأنت مسجّل بتظهر هنا.', 'Orders you pay for in the Sham store while signed in appear here.')} action={<Btn small onClick={() => { window.location.hash = 'store'; }}>{t('افتح المتجر', 'Open the store')}</Btn>} /></Card>
        : data.map((o) => {
          const s = ORDER_STATUS[o.status] || [o.status, o.status, 'bg-stone-100'];
          return (
            <Card key={o.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">#{o.number}</span>{o.store && <span className="text-xs text-stone-500">🏪 {o.store}</span>}
                <span className={`ms-auto rounded-full px-2.5 py-1 text-[11px] font-bold ${s[2]}`}>{lang === 'ar' ? s[0] : s[1]}</span></div>
              <ul className="mt-3 space-y-2">{o.items.map((i) => (
                <li key={i.sku} className="flex items-center gap-3 text-sm">{i.image ? <img src={i.image} alt="" className="h-11 w-11 rounded-lg object-cover" /> : <span className="h-11 w-11 rounded-lg bg-stone-100" />}<span className="flex-1">{i.name}</span><span className="text-stone-500">×{i.qty}</span></li>
              ))}</ul>
              <div className="mt-3 flex justify-between border-t border-stone-100 pt-2 text-sm"><span className="text-stone-500">{timeAgo(o.createdAt, lang)}</span>{o.total != null && <span className="font-bold">{money(o.total, o.currency, lang)}</span>}</div>
            </Card>
          );
        })}
    </div>
  );
}

function Security({ lang, me, toast, go }: { lang: Lang; me: Me; toast: (s: string) => void; go: (r: string) => void }) {
  const t = tx(lang);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState('');
  const change = async () => {
    setBusy('pw');
    try { await cx('/community/me/password', { body: { current: pw.current, next: pw.next } }); setPw({ current: '', next: '' }); toast(t('تم تغيير كلمة المرور، وتم الخروج من الأجهزة الأخرى', 'Password changed; other devices were signed out')); }
    catch (e) { toast(errorText(e, lang)); } finally { setBusy(''); }
  };
  const exportData = async () => {
    setBusy('export');
    try {
      const data = await cx<unknown>('/community/me/export', { timeoutMs: 60_000 });
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `sham-${me.handle}-data.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { toast(errorText(e, lang)); } finally { setBusy(''); }
  };
  const del = async () => {
    const password = prompt(t('لتأكيد حذف الحساب نهائياً اكتب كلمة المرور:', 'Type your password to delete your account permanently:'));
    if (!password) return;
    setBusy('delete');
    try { await cx('/community/me', { method: 'DELETE', body: { password } }); await signOut(); toast(t('تم حذف حسابك', 'Your account was deleted')); go(''); }
    catch (e) { toast(errorText(e, lang)); } finally { setBusy(''); }
  };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold"><KeyRound className="h-4 w-4 text-amber-600" />{t('تغيير كلمة المرور', 'Change password')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('الحالية', 'Current')}><input className={inputClass} type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" dir="ltr" /></Field>
          <Field label={t('الجديدة', 'New')} hint={t('8 أحرف على الأقل وفيها حروف وأرقام', '8+ characters, letters and numbers')}><input className={inputClass} type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" dir="ltr" /></Field>
        </div>
        <Btn className="mt-3" busy={busy === 'pw'} disabled={!pw.current || pw.next.length < 8} onClick={() => void change()}>{t('تغيير', 'Change')}</Btn>
      </Card>
      <Card className="divide-y divide-stone-100">
        <Row icon={<LogOut className="h-5 w-5" />} title={t('الخروج من كل الأجهزة', 'Sign out everywhere')} body={t('لو نسيت حسابك مفتوح على جهاز تاني', 'If you left your account open on another device')}
          action={<Btn small variant="soft" onClick={() => void signOut(true).then(() => go(''))}>{t('خروج', 'Sign out')}</Btn>} />
        <Row icon={<Download className="h-5 w-5" />} title={t('تنزيل نسخة من بياناتك', 'Download your data')} body={t('ملف فيه حسابك وتركيباتك ومنشوراتك وطلباتك ورسائلك', 'Your account, recipes, posts, orders and messages')}
          action={<Btn small variant="soft" busy={busy === 'export'} onClick={() => void exportData()}>{t('تنزيل', 'Download')}</Btn>} />
        <Row icon={<Trash2 className="h-5 w-5 text-rose-600" />} title={t('حذف الحساب نهائياً', 'Delete account')} body={t('بيحذف حسابك ومنشوراتك ورسائلك. الطلبات المدفوعة بتفضل محفوظة للفواتير بدون بياناتك.', 'Removes your account, posts and messages. Paid orders stay for invoicing, anonymised.')}
          action={<Btn small variant="danger" busy={busy === 'delete'} onClick={() => void del()}>{t('حذف', 'Delete')}</Btn>} />
      </Card>
      <Card className="flex gap-3 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
        <ShieldCheck className="h-5 w-5 shrink-0" />
        {t('كلمة مرورك محفوظة بتشفير لا يمكن عكسه. موبايلك وعنوانك ورسائلك ومستندات متجرك مشفّرة بمفتاح على السيرفر. الإدارة تقدر تراجعها عند الضرورة فقط وكل مراجعة بتتسجّل.',
          'Your password is stored with one-way hashing. Your phone, address, messages and store documents are encrypted with a server key. The administration may review them only when necessary, and every access is logged.')}
      </Card>
    </div>
  );
}
const Row = ({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode }) => (
  <div className="flex items-center gap-3 p-4"><span className="text-stone-500">{icon}</span><div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="text-xs text-stone-500">{body}</p></div>{action}</div>
);
