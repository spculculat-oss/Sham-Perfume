/**
 * «بوابتي»: the member's own space — profile (public part and private, encrypted part), saved recipes,
 * learning progress, orders, and security & privacy (password, sessions, data export, account deletion).
 */
import { useRef, useState } from 'react';
import { BookOpen, Camera, Download, Fingerprint, FlaskConical, Globe2, KeyRound, KeySquare, Lock, LogOut, Mail, Package, ShieldCheck, Smartphone, Trash2, Upload, User, Users } from 'lucide-react';
import { countryOptions } from '../utils/storeCheckout';
import { cx, resizeImage, type Learning, type Me, type Order, type PasskeyInfo, type PasskeyRegisterOptions, type Recipe, type SessionInfo } from './api';
import { createPasskey, webauthnAvailable } from './passkeys';
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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <Card className="h-fit min-w-0 p-2">
        <div className="flex items-center gap-3 p-3"><Avatar user={me} size={48} /><div className="min-w-0"><p className="truncate font-bold">{me.name}</p><p className="truncate text-xs text-stone-500">@{me.handle}</p></div></div>
        <nav className="flex max-w-full gap-1 overflow-x-auto lg:flex-col">
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
        <div className="flex items-center gap-4 bg-gradient-to-br from-stone-900 to-amber-800 p-5 text-white">
          <Avatar user={me} size={64} ring />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-amber-200">{t('أهلاً بيك في بوابتك', 'Welcome to your portal')}</p>
            <h2 className="mt-0.5 truncate text-2xl font-black">{me.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-300">
              <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold text-amber-100">{craftLabel(me.craftLevel, lang)}</span>
              {t('عضو منذ', 'Member since')} {new Date(me.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' })}
            </p>
          </div>
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
      <div className="grid gap-4 lg:grid-cols-2">
        <LearningSummary lang={lang} go={go} />
        <LatestRecipes lang={lang} go={go} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink title={t('اكتب منشور', 'Write a post')} body={t('شارك المجتمع تجربتك', 'Share with the community')} onClick={() => go('social')} />
        <QuickLink title={t('افتح الماسنجر', 'Open messenger')} body={t('راسل أصدقاءك', 'Message your friends')} onClick={() => go('messenger')} />
        <QuickLink title={me.merchant ? t('متجري', 'My store') : t('افتح متجرك', 'Open a store')} body={t('بيع منتجاتك داخل شام', 'Sell inside Sham')} onClick={() => go('merchant')} />
      </div>
    </div>
  );
}
const craftLabel = (level: string, lang: Lang) => {
  const t = tx(lang);
  return level === 'master_lab' ? t('خبير / معمل', 'Master / lab') : level === 'perfumer' ? t('عطّار', 'Perfumer') : t('هاوي', 'Hobbyist');
};

/** «رحلة التعلّم» at a glance: overall progress and the sections to continue. */
function LearningSummary({ lang, go }: { lang: Lang; go: (r: string) => void }) {
  const t = tx(lang);
  const { data, loading } = useLoad(() => cx<Learning[]>('/community/me/learning'));
  const items = data || [];
  const done = items.filter((l) => l.progress >= 100).length;
  const overall = items.length ? Math.round(items.reduce((s, l) => s + Math.min(100, l.progress), 0) / items.length) : 0;
  const next = [...items].sort((a, b) => (a.progress >= 100 ? 1 : 0) - (b.progress >= 100 ? 1 : 0) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold"><BookOpen className="h-5 w-5 text-amber-600" />{t('رحلة التعلّم', 'Learning journey')}</h3>
        <button type="button" onClick={() => go('me/learning')} className="text-xs font-semibold text-amber-700 hover:underline cursor-pointer">{t('الكل', 'All')}</button>
      </div>
      {loading ? <Spinner /> : !items.length ? (
        <p className="text-sm text-stone-500">{t('افتح أي قسم في الموقع وإنت مسجّل، وتقدّمك هيتسجّل هنا.', 'Open any section while signed in and your progress shows here.')}</p>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 rounded-full" style={{ background: `conic-gradient(#b45309 ${overall * 3.6}deg, #f5f5f4 0)` }}>
              <span className="absolute inset-1.5 flex items-center justify-center rounded-full bg-white text-sm font-black text-stone-900">{overall}%</span>
            </div>
            <p className="text-sm text-stone-600">{t(`خلّصت ${done} من ${items.length} أقسام`, `${done} of ${items.length} sections completed`)}</p>
          </div>
          <div className="space-y-2.5">{next.map((l) => (
            <button key={l.itemId} type="button" onClick={() => { window.location.hash = l.itemId.replace(/^section:/, ''); }} className="block w-full text-start cursor-pointer">
              <span className="flex justify-between text-xs"><span className="font-semibold text-stone-800">{l.title}</span><span className="text-stone-500">{l.progress >= 100 ? '✓' : `${l.progress}%`}</span></span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-stone-100"><span className={`block h-full rounded-full ${l.progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, l.progress)}%` }} /></span>
            </button>
          ))}</div>
        </>
      )}
    </Card>
  );
}

function LatestRecipes({ lang, go }: { lang: Lang; go: (r: string) => void }) {
  const t = tx(lang);
  const { data, loading } = useLoad(() => cx<Recipe[]>('/community/me/recipes'));
  const list = (data || []).slice(0, 3);
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold"><FlaskConical className="h-5 w-5 text-amber-600" />{t('آخر تركيباتي', 'Latest recipes')}</h3>
        <button type="button" onClick={() => go('me/recipes')} className="text-xs font-semibold text-amber-700 hover:underline cursor-pointer">{t('الكل', 'All')}</button>
      </div>
      {loading ? <Spinner /> : !list.length ? (
        <div className="text-sm text-stone-500">
          <p>{t('أي تركيبة تحفظها من الحاسبة وإنت مسجّل بتظهر هنا.', 'Recipes you save in the calculator appear here.')}</p>
          <Btn small variant="soft" className="mt-3" onClick={() => { window.location.hash = 'concentration'; }}>{t('افتح الحاسبة', 'Open the calculator')}</Btn>
        </div>
      ) : (
        <ul className="space-y-2">{list.map((r) => {
          const f = (r.data?.formulation || {}) as { concentrationPercent?: number; bottleVolumeMl?: number };
          const notes = Array.isArray(r.data?.pyramidNotes) ? (r.data.pyramidNotes as { nameAr?: string; nameEn?: string }[]).slice(0, 3).map((n) => (lang === 'ar' ? n.nameAr : n.nameEn) || n.nameAr || n.nameEn).filter(Boolean).join(' · ') : '';
          return (
            <li key={r.id}>
              <button type="button" onClick={() => go('me/recipes')} className="flex w-full items-center gap-3 rounded-xl border border-stone-100 p-3 text-start hover:border-amber-300 cursor-pointer">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><FlaskConical className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-stone-900">{r.title}</span>
                  <span className="block truncate text-[11px] text-stone-500">{f.concentrationPercent != null ? `${f.concentrationPercent}% · ${f.bottleVolumeMl} ml` : ''}{notes ? ` — ${notes}` : ''}</span>
                </span>
                <span className="text-[10px] text-stone-400">{r.visibility === 'private' ? '🔒' : r.visibility === 'friends' ? '👥' : '🌍'}</span>
              </button>
            </li>
          );
        })}</ul>
      )}
    </Card>
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
                <li key={i.sku} className="flex items-center gap-3 text-sm">{i.image ? <img loading="lazy" decoding="async" src={i.image} alt="" className="h-11 w-11 rounded-lg object-cover" /> : <span className="h-11 w-11 rounded-lg bg-stone-100" />}<span className="flex-1">{i.name}</span><span className="text-stone-500">×{i.qty}</span></li>
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

  /* The Security Checkup (Google/Meta style): every recommendation below is a real gap in the account. */
  const { data: sessions, reload: reloadSessions } = useLoad(() => cx<SessionInfo[]>('/community/me/sessions'));
  const oldAccount = new Date(me.createdAt).getTime() < Date.now() - 365 * 86_400_000;
  const checks: { ok: boolean; label: [string, string] }[] = [
    { ok: Boolean(me.emailVerified), label: [me.emailVerified ? 'البريد الإلكتروني مؤكد' : 'أكّد بريدك الإلكتروني', me.emailVerified ? 'E-mail verified' : 'Verify your e-mail'] },
    { ok: me.totp, label: [me.totp ? 'التحقق بخطوتين مفعّل' : 'فعّل التحقق بخطوتين', me.totp ? 'Two-factor is on' : 'Turn on two-factor'] },
    { ok: (sessions?.length || 0) <= 3, label: ['راجع أجهزتك المسجلة', 'Review your signed-in devices'] },
    { ok: !oldAccount, label: ['حسابك قديم — غيّر كلمة السر لو لسه الزمينة على القديمة', 'Account is a year old — change the password if it has lived with you this long'] },
  ];
  const score = checks.filter((c) => c.ok).length;

  /* E-mail verification (the code arrives by e-mail; nothing is faked when the server has no provider). */
  const [vCode, setVCode] = useState('');
  const [vBusy, setVBusy] = useState('');
  const refreshMe = async () => { try { setMe(await cx<Me>('/community/me')); } catch { /* next pulse */ } };
  const sendVerification = async () => {
    setVBusy('send');
    try { await cx('/community/auth/resend-verification', { body: {} }); toast(t('الكود اتبعت على بريدك', 'The code was sent to your e-mail')); }
    catch (e) { toast(errorText(e, lang)); } finally { setVBusy(''); }
  };
  const doVerify = async () => {
    setVBusy('verify');
    try { setMe(await cx<Me>('/community/auth/verify-email', { body: { code: vCode } })); setVCode(''); toast(t('تم تأكيد بريدك ✅', 'E-mail verified ✅')); }
    catch (e) { toast(errorText(e, lang)); } finally { setVBusy(''); }
  };

  /* Devices: sign one out without touching the rest. */
  const revoke = async (id: string) => {
    try { await cx(`/community/me/sessions/${id}`, { method: 'DELETE' }); await reloadSessions(true); toast(t('اتسجل خروج الجهاز ده', 'That device was signed out')); }
    catch (e) { toast(errorText(e, lang)); }
  };

  /* Passkeys (WebAuthn): the device's fingerprint/face/PIN. The key never leaves the device. */
  const { data: passkeys, reload: reloadPasskeys } = useLoad(() => cx<PasskeyInfo[]>('/community/me/passkeys'));
  const [pkName, setPkName] = useState('');
  const addPasskey = async () => {
    const password = prompt(t('للتأكيد اكتب كلمة المرور:', 'Type your password to confirm:'));
    if (!password) return;
    setBusy('pk-add');
    try {
      const begin = await cx<PasskeyRegisterOptions>('/community/me/passkeys/begin', { body: { name: pkName, password } });
      const res = await createPasskey(begin);
      await cx('/community/me/passkeys/finish', { body: { challengeId: begin.id, ...res, name: pkName } });
      setPkName('');
      await reloadPasskeys(true);
      toast(t('اتضافت البصمة ✅ تقدر تدخل بيها من أي جهاز', 'Passkey added ✅ you can sign in with it'));
    } catch (e) {
      if (e instanceof Error && e.message === 'cancelled') toast(t('الطلب اتلغى من الجهاز', 'Cancelled on the device'));
      else toast(errorText(e, lang));
    } finally { setBusy(''); }
  };
  const removePasskey = async (id: string) => {
    const password = prompt(t('للتأكيد اكتب كلمة المرور:', 'Type your password to confirm:'));
    if (!password) return;
    try { await cx(`/community/me/passkeys/${id}`, { method: 'DELETE', body: { password } }); await reloadPasskeys(true); toast(t('اتشالت البصمة', 'Passkey removed')); }
    catch (e) { toast(errorText(e, lang)); }
  };

  /* Two-factor (authenticator app, the standard Google and Meta use). */
  const [tfa, setTfa] = useState<{ secret: string; uri: string } | null>(null);
  const [tfaPw, setTfaPw] = useState('');
  const [tfaCode, setTfaCode] = useState('');
  const startTfa = async () => {
    setBusy('tfa-setup');
    try { setTfa(await cx<{ secret: string; uri: string }>('/community/me/2fa/setup', { body: { password: tfaPw } })); }
    catch (e) { toast(errorText(e, lang)); } finally { setBusy(''); }
  };
  const confirmTfa = async () => {
    setBusy('tfa-confirm');
    try {
      await cx('/community/me/2fa/confirm', { body: { code: tfaCode } });
      setTfa(null); setTfaPw(''); setTfaCode('');
      await refreshMe(); toast(t('تم تفعيل التحقق بخطوتين ✅', 'Two-factor is on ✅'));
    } catch (e) { toast(errorText(e, lang)); } finally { setBusy(''); }
  };
  const disableTfa = async () => {
    const password = prompt(t('لتأكيد إيقاف التحقق بخطوتين اكتب كلمة المرور:', 'Type your password to turn two-factor off:'));
    if (!password) return;
    const code = prompt(t('والكود الحالي من التطبيق:', 'And the current code from the app:'));
    if (!code) return;
    setBusy('tfa-disable');
    try { await cx('/community/me/2fa/disable', { body: { password, code } }); await refreshMe(); toast(t('تم إيقاف التحقق بخطوتين', 'Two-factor is off')); }
    catch (e) { toast(errorText(e, lang)); } finally { setBusy(''); }
  };

  /* Phone 2FA (WhatsApp/SMS) — optional, suggested like Google prompt */
  const [phoneMethod, setPhoneMethod] = useState<'sms'|'whatsapp'>('whatsapp');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phonePw, setPhonePw] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneStage, setPhoneStage] = useState<'idle'|'code'>('idle');
  const startPhone2fa = async () => {
    setBusy('phone-setup');
    try {
      const res = await cx<{ ok: boolean; method: string; phone: string }>('/community/me/2fa/phone/setup', { body: { phone: phoneNumber, method: phoneMethod, password: phonePw } });
      setPhoneStage('code');
      toast(t('اتبع الكود على ' + (phoneMethod==='whatsapp'?'واتساب':'الموبايل') + ' ' + res.phone, `Code sent via ${res.method} to ${res.phone}`));
    } catch (e) { toast(errorText(e, lang)); } finally { setBusy(''); }
  };
  const confirmPhone2fa = async () => {
    setBusy('phone-confirm');
    try {
      await cx('/community/me/2fa/phone/confirm', { body: { code: phoneCode } });
      setPhoneStage('idle'); setPhoneNumber(''); setPhonePw(''); setPhoneCode('');
      await refreshMe(); toast(t('تم تفعيل التحقق بخطوتين عبر الهاتف ✅', 'Phone 2-step is on ✅'));
    } catch (e) { toast(errorText(e, lang)); } finally { setBusy(''); }
  };
  const disablePhone2fa = async () => {
    const password = prompt(t('لتأكيد إيقاف تحقق الهاتف اكتب كلمة المرور:', 'Type your password to turn phone 2-step off:'));
    if (!password) return;
    setBusy('phone-disable');
    try { await cx('/community/me/2fa/phone/disable', { body: { password } }); await refreshMe(); toast(t('تم إيقاف تحقق الهاتف', 'Phone 2-step is off')); }
    catch (e) { toast(errorText(e, lang)); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-4">
      {/* Security Checkup — the score the rest of this page improves. */}
      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-amber-600" />{t('فحص أمان الحساب', 'Security checkup')}</h3>
        <div className="mb-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all" style={{ width: `${(score / checks.length) * 100}%` }} /></div>
          <span className="text-sm font-bold text-stone-700">{score}/{checks.length}</span>
        </div>
        <ul className="space-y-1.5 text-sm">
          {checks.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${c.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{c.ok ? '✓' : '!'}</span>
              <span className={c.ok ? 'text-stone-500 line-through decoration-stone-300' : 'text-stone-800'}>{lang === 'ar' ? c.label[0] : c.label[1]}</span>
            </li>
          ))}
        </ul>
      </Card>

      {!me.emailVerified && (
        <Card className="p-5">
          <h3 className="mb-1 flex items-center gap-2 font-bold"><Mail className="h-4 w-4 text-sky-600" />{t('تأكيد البريد الإلكتروني', 'Verify your e-mail')}</h3>
          <p className="mb-3 text-xs text-stone-500">{t(`هنبعتك كود على ${me.email}. اكتبه هنا وخلص الحاجة:`, `We will e-mail a code to ${me.email}. Enter it here to finish:`)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Btn small variant="soft" busy={vBusy === 'send'} onClick={() => void sendVerification()}>{t('إرسال الكود', 'Send the code')}</Btn>
            <input className={`${inputClass} w-32 text-center tracking-[0.35em]`} inputMode="numeric" maxLength={6} placeholder="••••••" value={vCode} onChange={(e) => setVCode(e.target.value.replace(/\D/g, ''))} dir="ltr" />
            <Btn small busy={vBusy === 'verify'} disabled={vCode.length !== 6} onClick={() => void doVerify()}>{t('تأكيد', 'Verify')}</Btn>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold"><Smartphone className="h-4 w-4 text-amber-600" />{t('أجهزتك المسجلة', 'Your signed-in devices')}</h3>
        {!sessions ? <Spinner /> : !sessions.length ? <p className="text-xs text-stone-500">{t('مفيش أجهزة مسجلة.', 'No signed-in devices.')}</p> : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl border border-stone-100 p-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.current ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}><Smartphone className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-stone-800">{s.agent || t('متصفح', 'Browser')}{s.current ? ` — ${t('هذا الجهاز', 'this device')}` : ''}</span>
                  <span className="text-[11px] text-stone-500" dir="ltr">{s.ip && `${s.ip} · `}{t('آخر استخدام', 'last used')} {timeAgo(s.lastUsedAt, lang)}</span>
                </span>
                {!s.current && <Btn small variant="soft" onClick={() => void revoke(s.id)}>{t('تسجيل خروج', 'Sign out')}</Btn>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-1 flex items-center gap-2 font-bold"><Fingerprint className="h-4 w-4 text-amber-600" />{t('الدخول بالبصمة (Passkey)', 'Sign in with a fingerprint (passkey)')}</h3>
        <p className="mb-3 text-xs text-stone-500">{t('بصمتك أو وجهك أو قفل موبايلك — زي ما جوجل وفيسبوك ماشيين دلوقتي. السر بيفضل على جهازك بس.', 'Your fingerprint, face, or device PIN — the way Google and Meta are moving. The secret stays on your device only.')}</p>
        {!webauthnAvailable() ? (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{t('المتصفح ده مايدعمش البصمة — استخدم متصفح حديث على HTTPS.', 'This browser does not support passkeys — use a modern browser over HTTPS.')}</p>
        ) : (
          <>
            {passkeys?.length ? (
              <ul className="mb-3 space-y-2">
                {passkeys.map((k) => (
                  <li key={k.id} className="flex items-center gap-3 rounded-xl border border-stone-100 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Fingerprint className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-stone-800">{k.name || t('بصمة', 'Passkey')}</span>
                      <span className="text-[11px] text-stone-500">{k.lastUsedAt ? `${t('آخر استخدام', 'last used')} ${timeAgo(k.lastUsedAt, lang)}` : `${t('أُضيفت', 'added')} ${timeAgo(k.createdAt, lang)}`}</span>
                    </span>
                    <Btn small variant="soft" onClick={() => void removePasskey(k.id)}>{t('حذف', 'Remove')}</Btn>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${inputClass} w-48`} value={pkName} onChange={(e) => setPkName(e.target.value)} placeholder={t('اسم الجهاز (مثال: موبايلي)', 'Device name (e.g. my phone)')} />
              <Btn small busy={busy === 'pk-add'} onClick={() => void addPasskey()}>{t('إضافة بصمة لهذا الجهاز', 'Add a passkey for this device')}</Btn>
            </div>
          </>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-1 flex items-center gap-2 font-bold"><KeySquare className="h-4 w-4 text-amber-600" />{t('التحقق بخطوتين', 'Two-factor authentication')}</h3>
        <p className="mb-3 text-xs text-stone-500">{t('كلمة السر + كود من تطبيق التحقق على موبايلك — زي جوجل وفيس بوك. لو حد عرف كلمة السر من غيره، يدخلش.', 'Your password plus a code from your phone\'s authenticator app — the way Google and Meta protect accounts. A stolen password alone gets in nowhere.')}</p>
        {!me.totp ? (
          tfa ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-stone-50 p-3 text-xs" dir="ltr">
                <p className="mb-1 text-stone-500">{t('ضيف الكود ده في تطبيق التحقق (Google Authenticator أو غيره):', 'Add this secret to your authenticator app (Google Authenticator or any other):')}</p>
                <p className="break-all font-mono text-sm font-bold tracking-wider">{tfa.secret}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input className={`${inputClass} w-32 text-center tracking-[0.35em]`} inputMode="numeric" maxLength={6} placeholder="••••••" value={tfaCode} onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, ''))} dir="ltr" />
                <Btn small busy={busy === 'tfa-confirm'} disabled={tfaCode.length !== 6} onClick={() => void confirmTfa()}>{t('تأكيد التفعيل', 'Confirm')}</Btn>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${inputClass} w-56`} type="password" autoComplete="current-password" value={tfaPw} onChange={(e) => setTfaPw(e.target.value)} dir="ltr" />
              <Btn small busy={busy === 'tfa-setup'} disabled={!tfaPw} onClick={() => void startTfa()}>{t('تفعيل', 'Turn on')}</Btn>
            </div>
          )
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{t('مفعّل ✅', 'On ✅')}</span>
            <Btn small variant="soft" busy={busy === 'tfa-disable'} onClick={() => void disableTfa()}>{t('إيقاف', 'Turn off')}</Btn>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-1 flex items-center gap-2 font-bold"><Smartphone className="h-4 w-4 text-emerald-600" />{t('التحقق بالهاتف (واتساب / SMS)', 'Phone verification (WhatsApp / SMS)')}</h3>
        <p className="mb-3 text-xs text-stone-500">{t('مستوى حماية إضافي مقترح — زي جوجل: كود 6 أرقام يوصلك على واتساب أو SMS. مش إلزامي بس مقترح بشدة.', 'Extra protection — like Google: a 6-digit code to your WhatsApp or SMS. Optional but strongly suggested.')}</p>
        {(me as any).phone2fa?.enabled ? (
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{t('مفعّل ✅ عبر', 'On ✅ via')} {(me as any).phone2fa?.method === 'whatsapp' ? 'WhatsApp' : 'SMS'}</span>
            <Btn small variant="soft" busy={busy === 'phone-disable'} onClick={() => void disablePhone2fa()}>{t('إيقاف', 'Turn off')}</Btn>
          </div>
        ) : phoneStage === 'code' ? (
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${inputClass} w-32 text-center tracking-[0.35em]`} inputMode="numeric" maxLength={6} placeholder="••••••" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))} dir="ltr" />
            <Btn small busy={busy === 'phone-confirm'} disabled={phoneCode.length !== 6} onClick={() => void confirmPhone2fa()}>{t('تأكيد التفعيل', 'Confirm')}</Btn>
            <Btn small variant="soft" onClick={() => setPhoneStage('idle')}>{t('رجوع', 'Back')}</Btn>
          </div>
        ) : (
          <div className="space-y-3">
            {!me.totp && (me as any).phone2fa?.enabled === false && (
              <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">{t('💡 مقترح: فعّل التحقق بخطوتين عبر واتساب/SMS لحماية أقوى — زي ما جوجل وآبل بيعملوا.', '💡 Suggested: turn on phone 2-step via WhatsApp/SMS for stronger protection — like Google and Apple do.')}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select className={`${inputClass} w-36`} value={phoneMethod} onChange={(e) => setPhoneMethod(e.target.value as any)}>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
              <input className={`${inputClass} w-48`} placeholder={t('رقم الهاتف مع كود البلد', 'Phone with country code')} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} dir="ltr" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${inputClass} w-56`} type="password" placeholder={t('كلمة المرور للتأكيد', 'Password to confirm')} value={phonePw} onChange={(e) => setPhonePw(e.target.value)} dir="ltr" />
              <Btn small busy={busy === 'phone-setup'} disabled={!phoneNumber || !phonePw} onClick={() => void startPhone2fa()}>{t('إرسال الكود', 'Send code')}</Btn>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold"><KeyRound className="h-4 w-4 text-amber-600" />{t('تغيير كلمة المرور', 'Change password')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('الحالية', 'Current')}><input className={inputClass} type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" dir="ltr" /></Field>
          <Field label={t('الجديدة', 'New')} hint={t('8 أحرف على الأقل وفيها حروف وأرقام، ومتكونش من الكلمات الشائعة', '8+ characters with letters and numbers — not a common password')}><input className={inputClass} type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" dir="ltr" /></Field>
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
        {t('كلمة مرورك محفوظة بتشفير لا يمكن عكسه. موبايلك وعنوانك ورسائلك ومستندات متجرك مشفّرة بمفتاح على السيرفر. كل عملية تسجيل دخول جديدة بيوصلك إشعار، وكل مراجعة إدارة بتتسجّل.',
          'Your password is stored with one-way hashing. Your phone, address, messages and store documents are encrypted with a server key. Every new sign-in raises an alert, and every administration review is logged.')}
      </Card>
    </div>
  );
}

const Row = ({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode }) => (
  <div className="flex items-center gap-3 p-4"><span className="text-stone-500">{icon}</span><div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="text-xs text-stone-500">{body}</p></div>{action}</div>
);
