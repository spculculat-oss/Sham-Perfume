/**
 * «بوابة التجار»: open a store inside Sham (the file is reviewed by the administration), add products that go live
 * only after approval, follow paid orders, and keep private details (documents, payout, supplier links) encrypted —
 * visible to the merchant and the administration only, never to buyers.
 */
import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, BadgeCheck, Box, ClipboardList, ExternalLink, EyeOff, ImagePlus, Link2, Lock, Package, Pause, Pencil, Play, Plus, Settings, Store, Trash2, TrendingUp, Truck, X } from 'lucide-react';
import { BUNDLED_FX, convert, tidy } from '../utils/pricing';
import { countryOptions } from '../utils/storeCheckout';
import { cx, resizeImage, type MerchantFile, type MerchantProduct, type Order } from './api';
import { refreshSession, type SessionState } from './session';
import { ORDER_STATUS, merchantStatus } from './UserPortal';
import { Btn, Card, Empty, Field, Sheet, Spinner, errorText, inputClass, money, timeAgo, tx, useLoad, type Lang } from './ui';
import { StoreSalesCategoryChart } from '../components/StoreSalesCategoryChart';
import type { SupportedLanguage } from '../types/i18n';

const MARGIN = 0.5;
const CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'MYR', 'TRY', 'MAD', 'IQD', 'LYD', 'DZD', 'TND'].filter((c) => c === 'USD' || BUNDLED_FX.rates[c]);
const CATEGORIES: [string, string, string][] = [
  ['perfume', 'عطور جاهزة', 'Perfumes'], ['oil', 'زيوت عطرية', 'Fragrance oils'], ['incense', 'بخور ومعمول', 'Incense & bakhoor'], ['raw_material', 'خامات', 'Raw materials'], ['alcohol', 'كحول ومذيبات', 'Alcohol & solvents'],
  ['bottle', 'زجاجات', 'Bottles'], ['packaging', 'تغليف', 'Packaging'], ['tool', 'أدوات', 'Tools'], ['other', 'أخرى', 'Other'],
];
const PRODUCT_STATUS: Record<string, [string, string, string]> = {
  pending: ['⏳ تحت المراجعة', '⏳ In review', 'bg-amber-100 text-amber-900'], approved: ['✅ منشور', '✅ Live', 'bg-emerald-100 text-emerald-800'],
  rejected: ['✏️ محتاج تعديل', '✏️ Needs changes', 'bg-rose-100 text-rose-700'], paused: ['⏸ موقوف مؤقتاً', '⏸ Paused', 'bg-stone-100 text-stone-700'],
};
export const salePrice = (price: number, currency: string) => (price > 0 ? tidy(convert(price, currency, 'EGP', BUNDLED_FX) * (1 + MARGIN)) : 0);

type Section = 'dashboard' | 'products' | 'orders' | 'settings';
interface Props { lang: Lang; session: SessionState; section?: string; go: (r: string) => void; toast: (s: string) => void }

export default function MerchantPortal({ lang, session, section, go, toast }: Props) {
  const t = tx(lang);
  const file = useLoad(() => (session.me?.merchant ? cx<MerchantFile>('/community/merchant') : Promise.resolve(null)), [session.me?.merchant?.status]);
  if (!session.me?.merchant) return <Apply lang={lang} toast={toast} onDone={() => { void refreshSession(); }} />;
  if (file.loading && !file.data) return <Spinner />;
  const m = file.data;
  if (!m) return <Card><Empty title={errorText(file.error, lang)} /></Card>;
  const current = (['dashboard', 'products', 'orders', 'settings'].includes(section || '') ? section : 'dashboard') as Section;
  const tabs: [Section, string, React.ReactNode][] = [
    ['dashboard', t('لوحة المتجر', 'Dashboard'), <TrendingUp key="d" className="h-4 w-4" />], ['products', t('منتجاتي', 'Products'), <Box key="p" className="h-4 w-4" />],
    ['orders', t('الطلبات', 'Orders'), <ClipboardList key="o" className="h-4 w-4" />], ['settings', t('بيانات المتجر', 'Store file'), <Settings key="s" className="h-4 w-4" />],
  ];
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 bg-gradient-to-br from-stone-950 to-stone-800 p-5 text-white">
          {m.logo ? <img src={m.logo} alt="" className="h-16 w-16 rounded-2xl bg-white object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-2xl">🏪</span>}
          <div className="min-w-[11rem] flex-1"><p className="text-xs text-amber-300">{t('بوابة التاجر', 'Merchant portal')}</p><h2 className="truncate text-xl font-black sm:text-2xl">{m.storeName}</h2><p className="text-sm text-stone-300">{merchantStatus(m.status, lang)}</p></div>
          {m.status === 'approved' && <Btn variant="soft" onClick={() => go(`store/${m.slug}`)}><ExternalLink className="h-4 w-4" />{t('صفحة متجري', 'My store page')}</Btn>}
        </div>
        {m.status !== 'approved' && (
          <div className={`flex gap-2 p-4 text-sm ${m.status === 'pending' ? 'bg-amber-50 text-amber-900' : 'bg-rose-50 text-rose-800'}`}>
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              {m.status === 'pending' && t('ملف متجرك عند الإدارة للمراجعة. تقدر تضيف منتجاتك من دلوقتي، وهتتنشر بعد اعتماد المتجر والمنتج.', 'Your store file is being reviewed. You can add products now; they go live once the store and each product are approved.')}
              {m.status === 'rejected' && t('الإدارة طلبت تعديلات على ملف المتجر. عدّل البيانات من «بيانات المتجر» وهيرجع للمراجعة.', 'The administration asked for changes. Update your store file and it goes back to review.')}
              {m.status === 'suspended' && t('المتجر موقوف حالياً ومنتجاته مخفية عن العملاء. تواصل مع الإدارة.', 'Your store is suspended and hidden from buyers. Contact the administration.')}
              {m.note && <p className="mt-1 font-semibold">{t('ملاحظة الإدارة:', 'Note:')} {m.note}</p>}
            </div>
          </div>
        )}
        <nav className="flex overflow-x-auto border-t border-stone-100">
          {tabs.map(([id, label, icon]) => <button key={id} type="button" onClick={() => go(`merchant/${id}`)} className={`flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold cursor-pointer ${current === id ? 'border-b-2 border-amber-600 text-amber-800' : 'text-stone-500'}`}>{icon}{label}</button>)}
        </nav>
      </Card>
      {current === 'dashboard' && <Dashboard lang={lang} m={m} go={go} />}
      {current === 'products' && <Products lang={lang} toast={toast} onChange={() => void file.reload(true)} />}
      {current === 'orders' && <MerchantOrders lang={lang} toast={toast} />}
      {current === 'settings' && <StoreForm lang={lang} initial={m} toast={toast} onDone={() => { void file.reload(true); void refreshSession(); }} />}
    </div>
  );
}

function Dashboard({ lang, m, go }: { lang: Lang; m: MerchantFile; go: (r: string) => void }) {
  const t = tx(lang);
  const tiles: [string, string | number, React.ReactNode][] = [
    [t('منتجات', 'Products'), m.stats.products, <Box key="a" className="h-5 w-5" />], [t('منشورة', 'Live'), m.stats.published, <BadgeCheck key="b" className="h-5 w-5" />],
    [t('تحت المراجعة', 'In review'), m.stats.pending, <Pause key="c" className="h-5 w-5" />], [t('طلبات', 'Orders'), m.stats.orders, <Package key="d" className="h-5 w-5" />],
    [t('مستحقاتك', 'Your earnings'), money(m.stats.earnings, m.currency, lang), <TrendingUp key="e" className="h-5 w-5" />],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{tiles.map(([label, value, icon]) => (
        <Card key={label} className="p-4"><span className="text-amber-600">{icon}</span><p className="mt-1 text-xl font-black text-stone-900">{value}</p><p className="text-xs text-stone-500">{label}</p></Card>
      ))}</div>
      <StoreSalesCategoryChart
        currentLang={lang as SupportedLanguage}
        merchantId={m.slug}
        currencyCode={m.currency}
      />
      <Card className="p-5">
        <h3 className="mb-3 font-bold">{t('إزاي البيع بيتم في شام؟', 'How selling works on Sham')}</h3>
        <ol className="space-y-2.5 text-sm leading-relaxed text-stone-700">
          {[
            t('بتضيف المنتج بسعرك أنت (بعملتك). الإدارة بتراجعه وتنشره.', 'You add a product at your own price (in your currency). The administration reviews and publishes it.'),
            t(`سعر البيع للعميل = سعرك + ${MARGIN * 100}% عمولة الموقع، ويتعرض بعملة بلد العميل، والشحن بيتحسب حسب بلده.`, `Buyer price = your price + ${MARGIN * 100}% site commission, shown in the buyer’s currency; shipping is added per country.`),
            t('العميل بيدفع أونلاين من خلال بوابة الدفع المعتمدة في الموقع.', 'The buyer pays online through the site’s payment gateway.'),
            t('بيوصلك إشعار بالطلب المدفوع، تجهّزه وتضغط «جاهز للشحن»، والإدارة بتتابع الشحن والتسليم.', 'You get notified of a paid order, prepare it and press “Ready to ship”; the administration handles shipping and delivery.'),
            t('مستحقاتك (سعرك × الكمية) بتتحوّل على وسيلة الاستلام اللي سجّلتها.', 'Your earnings (your price × qty) are paid to the payout method on file.'),
          ].map((line, i) => <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">{i + 1}</span>{line}</li>)}
        </ol>
        <div className="mt-4 flex gap-2 rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-600"><EyeOff className="h-4 w-4 shrink-0" />
          {t('روابط المورّد وأرقام التواصل عمرها ما بتظهر للعملاء. أي رابط أو رقم في وصف المنتج بيتشال تلقائياً. التواصل كله بيكون عن طريق الموقع.', 'Supplier links and contacts are never shown to buyers. Links or numbers in descriptions are removed automatically. All contact goes through the site.')}
        </div>
        <Btn className="mt-4" onClick={() => go('merchant/products')}><Plus className="h-4 w-4" />{t('أضف منتج', 'Add a product')}</Btn>
      </Card>
    </div>
  );
}

/* ------------------------------------------------ apply / store file ------------------------------------------------ */

function Apply({ lang, toast, onDone }: { lang: Lang; toast: (s: string) => void; onDone: () => void }) {
  const t = tx(lang);
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-stone-950 via-stone-900 to-amber-900 p-6 text-white">
          <Store className="h-10 w-10 text-amber-300" />
          <h2 className="mt-2 text-2xl font-black">{t('افتح متجرك في شام', 'Open your store on Sham')}</h2>
          <p className="mt-1 max-w-xl text-sm text-stone-300">{t('اعرض منتجاتك لآلاف صناع العطور في الوطن العربي والعالم. احنا بنتولّى صفحة المتجر والدفع والشحن، وأنت بتركّز على منتجك.', 'Reach perfumers across the Arab world and beyond. We handle the store page, payment and shipping — you focus on your products.')}</p>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
            {[t('📝 تملأ ملف المتجر', '📝 Fill in the store file'), t('🔎 الإدارة تراجعه', '🔎 We review it'), t('🚀 تضيف منتجاتك وتبدأ تبيع', '🚀 Add products and sell')].map((s) => <span key={s} className="rounded-xl bg-white/10 p-2.5">{s}</span>)}
          </div>
        </div>
      </Card>
      <StoreForm lang={lang} toast={toast} onDone={onDone} />
    </div>
  );
}

function StoreForm({ lang, initial, toast, onDone }: { lang: Lang; initial?: MerchantFile; toast: (s: string) => void; onDone: () => void }) {
  const t = tx(lang);
  const [f, setF] = useState({
    storeName: initial?.storeName || '', about: initial?.about || '', logo: initial?.logo || null as string | null, country: initial?.country || 'EG', currency: initial?.currency || 'EGP',
    legal: { legalName: '', registration: '', taxId: '', phone: '', whatsapp: '', address: '', website: '', ...(initial?.legal || {}) },
    payout: { method: 'bank', bankName: '', accountHolder: '', iban: '', wallet: '', notes: '', ...(initial?.payout || {}) },
  });
  const [agree, setAgree] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const logo = useRef<HTMLInputElement>(null);
  const legal = (k: keyof typeof f.legal) => (e: { target: { value: string } }) => setF((v) => ({ ...v, legal: { ...v.legal, [k]: e.target.value } }));
  const payout = (k: keyof typeof f.payout) => (e: { target: { value: string } }) => setF((v) => ({ ...v, payout: { ...v.payout, [k]: e.target.value } }));
  const submit = async () => {
    setBusy(true);
    try {
      await cx(initial ? '/community/merchant' : '/community/merchant/apply', { method: initial ? 'PATCH' : 'POST', body: f });
      toast(initial ? t('تم حفظ بيانات المتجر ✅', 'Store file saved ✅') : t('تم إرسال ملف متجرك للإدارة 🎉', 'Your store file was sent for review 🎉')); onDone();
    } catch (e) { toast(errorText(e, lang)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold"><Store className="h-4 w-4 text-amber-600" />{t('واجهة المتجر — يشوفها العملاء', 'Storefront — visible to buyers')}</h3>
        <div className="mb-4 flex items-center gap-4">
          {f.logo ? <img src={f.logo} alt="" className="h-20 w-20 rounded-2xl object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-stone-100 text-3xl">🏪</span>}
          <input ref={logo} type="file" accept="image/*" hidden onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) void resizeImage(x, 400, 0.85).then((d) => setF((v) => ({ ...v, logo: d }))); }} />
          <Btn small variant="soft" onClick={() => logo.current?.click()}><ImagePlus className="h-4 w-4" />{t('شعار المتجر', 'Store logo')}</Btn>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('اسم المتجر', 'Store name')}><input className={inputClass} value={f.storeName} onChange={(e) => setF({ ...f, storeName: e.target.value })} maxLength={80} /></Field>
          <Field label={t('بلد المتجر', 'Country')}><select className={inputClass} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>{countryOptions(lang).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></Field>
          <Field label={t('عملة أسعارك', 'Your pricing currency')}><select className={inputClass} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <div className="mt-3"><Field label={t('نبذة عن المتجر', 'About the store')} hint={t('بدون أرقام أو روابط تواصل — بتتشال تلقائياً', 'No phone numbers or links — they are removed automatically')}><textarea className={inputClass} rows={3} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} maxLength={1500} /></Field></div>
      </Card>
      <Card className="p-5">
        <h3 className="mb-1 flex items-center gap-2 font-bold"><Lock className="h-4 w-4 text-emerald-600" />{t('بيانات قانونية وتواصل — مشفّرة وللإدارة فقط', 'Legal & contact — encrypted, administration only')}</h3>
        <p className="mb-4 text-xs text-stone-500">{t('لا تظهر لأي عميل أو عضو.', 'Never shown to buyers or members.')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('الاسم القانوني / اسم النشاط', 'Legal / business name')}><input className={inputClass} value={f.legal.legalName} onChange={legal('legalName')} /></Field>
          <Field label={t('رقم السجل التجاري (إن وجد)', 'Registration no. (if any)')}><input className={inputClass} value={f.legal.registration} onChange={legal('registration')} /></Field>
          <Field label={t('الرقم الضريبي (إن وجد)', 'Tax ID (if any)')}><input className={inputClass} value={f.legal.taxId} onChange={legal('taxId')} /></Field>
          <Field label={t('موبايل (مطلوب)', 'Phone (required)')}><input className={inputClass} value={f.legal.phone} onChange={legal('phone')} dir="ltr" inputMode="tel" /></Field>
          <Field label={t('واتساب', 'WhatsApp')}><input className={inputClass} value={f.legal.whatsapp} onChange={legal('whatsapp')} dir="ltr" inputMode="tel" /></Field>
          <Field label={t('الموقع / الصفحة', 'Website / page')}><input className={inputClass} value={f.legal.website} onChange={legal('website')} dir="ltr" /></Field>
        </div>
        <div className="mt-3"><Field label={t('عنوان المخزن / الاستلام', 'Warehouse / pickup address')}><textarea className={inputClass} rows={2} value={f.legal.address} onChange={legal('address')} /></Field></div>
      </Card>
      <Card className="p-5">
        <h3 className="mb-1 flex items-center gap-2 font-bold"><Lock className="h-4 w-4 text-emerald-600" />{t('استلام المستحقات — مشفّرة', 'Payouts — encrypted')}</h3>
        <p className="mb-4 text-xs text-stone-500">{t('لا تكتب أرقام كروت أو كلمات سر هنا أبداً. يكفي بيانات الحساب اللي هنحوّل عليه.', 'Never enter card numbers or passwords. Only the account we should pay into.')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('طريقة الاستلام', 'Method')}><select className={inputClass} value={f.payout.method} onChange={payout('method')}>
            <option value="bank">{t('تحويل بنكي', 'Bank transfer')}</option><option value="instapay">InstaPay</option><option value="wallet">{t('محفظة إلكترونية', 'Mobile wallet')}</option><option value="other">{t('أخرى', 'Other')}</option></select></Field>
          <Field label={t('اسم صاحب الحساب', 'Account holder')}><input className={inputClass} value={f.payout.accountHolder} onChange={payout('accountHolder')} /></Field>
          {f.payout.method === 'bank' && <><Field label={t('البنك', 'Bank')}><input className={inputClass} value={f.payout.bankName} onChange={payout('bankName')} /></Field>
            <Field label="IBAN"><input className={inputClass} value={f.payout.iban} onChange={payout('iban')} dir="ltr" /></Field></>}
          {f.payout.method !== 'bank' && <Field label={t('رقم المحفظة / عنوان InstaPay', 'Wallet no. / InstaPay address')}><input className={inputClass} value={f.payout.wallet} onChange={payout('wallet')} dir="ltr" /></Field>}
        </div>
      </Card>
      {!initial && (
        <label className="flex items-start gap-2 rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-amber-700" />
          {t(`موافق إن سعر البيع للعميل = سعري + ${MARGIN * 100}% عمولة للموقع + الشحن، وإن الدفع والتواصل مع العملاء يتم عن طريق الموقع فقط، وإن المنتجات بتتنشر بعد مراجعة الإدارة.`,
            `I agree that the buyer price is my price + ${MARGIN * 100}% site commission + shipping, that payment and contact with buyers go through the site only, and that products are published after review.`)}
        </label>
      )}
      <Btn busy={busy} disabled={f.storeName.trim().length < 2 || f.legal.phone.replace(/\D/g, '').length < 7 || !agree} onClick={() => void submit()} className="w-full sm:w-auto">
        {initial ? t('حفظ بيانات المتجر', 'Save store file') : t('إرسال ملف المتجر للمراجعة', 'Send store file for review')}
      </Btn>
    </div>
  );
}

/* ------------------------------------------------ products ------------------------------------------------ */

function Products({ lang, toast, onChange }: { lang: Lang; toast: (s: string) => void; onChange: () => void }) {
  const t = tx(lang);
  const { data, loading, reload } = useLoad(() => cx<MerchantProduct[]>('/community/merchant/products'));
  const [editing, setEditing] = useState<MerchantProduct | 'new' | null>(null);
  const refresh = () => { void reload(true); onChange(); };
  const act = async (fn: () => Promise<unknown>, done: string) => { try { await fn(); toast(done); refresh(); } catch (e) { toast(errorText(e, lang)); } };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><p className="text-sm text-stone-500">{t('أي تعديل في الاسم أو الوصف أو الصور أو السعر بيرجّع المنتج للمراجعة. تعديل الكمية بس مش محتاج مراجعة.', 'Editing name, description, images or price sends a product back to review; stock-only edits do not.')}</p>
        <Btn onClick={() => setEditing('new')}><Plus className="h-4 w-4" />{t('منتج جديد', 'New product')}</Btn></div>
      {loading ? <Spinner /> : !data?.length ? <Card><Empty icon={<Box className="h-10 w-10" />} title={t('لسه مفيش منتجات', 'No products yet')} action={<Btn small onClick={() => setEditing('new')}>{t('أضف أول منتج', 'Add your first product')}</Btn>} /></Card> : (
        <div className="grid gap-3 md:grid-cols-2">{data.map((p) => {
          const st = PRODUCT_STATUS[p.status] || [p.status, p.status, 'bg-stone-100'];
          return (
            <Card key={p.id} className="flex gap-3 p-3">
              {p.images[0] ? <img src={p.images[0]} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" /> : <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-stone-100"><Box className="h-8 w-8 text-stone-300" /></span>}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2"><p className="line-clamp-2 flex-1 font-bold text-stone-900">{p.name}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st[2]}`}>{lang === 'ar' ? st[0] : st[1]}</span></div>
                <p className="mt-1 text-xs text-stone-600">{t('سعرك', 'Your price')}: <b>{money(p.price, p.currency, lang)}</b> · {t('للعميل', 'Buyer')} ≈ <b className="text-amber-800">{money(salePrice(p.price, p.currency), 'EGP', lang)}</b></p>
                <p className="text-xs text-stone-500">{t('المخزون', 'Stock')}: {p.stock} {p.source?.links.length ? <span className="ms-1 inline-flex items-center gap-0.5 text-emerald-700"><Lock className="h-3 w-3" />{p.source.links.length} {t('رابط خاص', 'private link(s)')}</span> : null}</p>
                {p.reviewNote && p.status === 'rejected' && <p className="mt-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{t('ملاحظة الإدارة:', 'Note:')} {p.reviewNote}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Btn small variant="soft" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" />{t('تعديل', 'Edit')}</Btn>
                  {p.status === 'approved' && <Btn small variant="ghost" onClick={() => void act(() => cx(`/community/merchant/products/${p.id}`, { method: 'PATCH', body: { paused: true } }), t('تم إيقاف المنتج مؤقتاً', 'Paused'))}><Pause className="h-3.5 w-3.5" />{t('إيقاف', 'Pause')}</Btn>}
                  {p.status === 'paused' && <Btn small variant="ghost" onClick={() => void act(() => cx(`/community/merchant/products/${p.id}`, { method: 'PATCH', body: { paused: false } }), t('تم', 'Done'))}><Play className="h-3.5 w-3.5" />{t('تفعيل', 'Resume')}</Btn>}
                  <Btn small variant="ghost" onClick={() => { if (confirm(t('حذف المنتج؟', 'Delete product?'))) void act(() => cx(`/community/merchant/products/${p.id}`, { method: 'DELETE' }), t('تم الحذف', 'Deleted')); }}><Trash2 className="h-3.5 w-3.5 text-rose-600" /></Btn>
                </div>
              </div>
            </Card>
          );
        })}</div>
      )}
      {editing && <ProductSheet lang={lang} product={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} toast={toast} />}
    </div>
  );
}

function ProductSheet({ lang, product, onClose, onSaved, toast }: { lang: Lang; product?: MerchantProduct; onClose: () => void; onSaved: () => void; toast: (s: string) => void }) {
  const t = tx(lang);
  const [f, setF] = useState({
    name: product?.name || '', description: product?.description || '', category: product?.category || 'perfume', images: product?.images || [] as string[],
    price: product ? String(product.price) : '', currency: product?.currency || 'EGP', stock: product ? String(product.stock) : '10',
    links: product?.source?.links.join('\n') || '', notes: product?.source?.notes || '',
  });
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const pics = useRef<HTMLInputElement>(null);
  const price = Number(f.price) || 0;
  const buyer = useMemo(() => salePrice(price, f.currency), [price, f.currency]);
  const save = async () => {
    setBusy(true);
    const body = { name: f.name, description: f.description, category: f.category, images: f.images, price, currency: f.currency, stock: Math.max(0, Math.floor(Number(f.stock) || 0)), source: { links: f.links.split(/\s+/).filter(Boolean), notes: f.notes } };
    try {
      await cx(product ? `/community/merchant/products/${product.id}` : '/community/merchant/products', { method: product ? 'PATCH' : 'POST', body, timeoutMs: 60_000 });
      toast(t('تم الحفظ — المنتج عند الإدارة للمراجعة', 'Saved — the product is in review')); onSaved();
    } catch (e) { toast(errorText(e, lang)); } finally { setBusy(false); }
  };
  return (
    <Sheet title={product ? t('تعديل المنتج', 'Edit product') : t('منتج جديد', 'New product')} onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold text-stone-700">{t('صور المنتج (حتى 6)', 'Photos (up to 6)')}</p>
          <div className="flex flex-wrap gap-2">
            {f.images.map((src, i) => (
              <span key={i} className="relative"><img src={src} alt="" className="h-20 w-20 rounded-xl object-cover" />
                <button type="button" onClick={() => setF({ ...f, images: f.images.filter((_, j) => j !== i) })} className="absolute -top-1.5 -end-1.5 rounded-full bg-stone-900 p-0.5 text-white cursor-pointer"><X className="h-3.5 w-3.5" /></button></span>
            ))}
            {f.images.length < 6 && <button type="button" onClick={() => pics.current?.click()} className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 text-xs text-stone-500 hover:border-amber-400 cursor-pointer"><ImagePlus className="h-5 w-5" />{t('رفع', 'Upload')}</button>}
          </div>
          <input ref={pics} type="file" accept="image/*" multiple hidden onChange={async (e) => {
            const files = [...(e.target.files || [])].slice(0, 6 - f.images.length); e.target.value = '';
            const list = await Promise.all(files.map((x) => resizeImage(x, 1000, 0.8).catch(() => '')));
            setF((v) => ({ ...v, images: [...v.images, ...list.filter(Boolean)].slice(0, 6) }));
          }} />
          <div className="mt-2 flex gap-2"><input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t('أو رابط صورة https://…', 'or an image link https://…')} dir="ltr" />
            <Btn small variant="soft" disabled={!/^https:\/\//.test(url) || f.images.length >= 6} onClick={() => { setF({ ...f, images: [...f.images, url.trim()] }); setUrl(''); }}>{t('إضافة', 'Add')}</Btn></div>
          <p className="mt-1 text-[11px] text-stone-500">{t('استخدم صور نظيفة بدون أرقام أو شعارات تواصل — الإدارة بترفض الصور اللي فيها بيانات تواصل.', 'Use clean photos without phone numbers or contact logos — those are rejected.')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('اسم المنتج', 'Product name')}><input className={inputClass} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={140} /></Field>
          <Field label={t('القسم', 'Category')}><select className={inputClass} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map(([id, ar, en]) => <option key={id} value={id}>{lang === 'ar' ? ar : en}</option>)}</select></Field>
        </div>
        <Field label={t('الوصف', 'Description')} hint={t('الروابط وأرقام التليفون والإيميلات بتتشال تلقائياً من الوصف العام', 'Links, phone numbers and e-mails are removed from the public description')}>
          <textarea className={inputClass} rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={4000} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('سعرك', 'Your price')}><input className={inputClass} type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} dir="ltr" /></Field>
          <Field label={t('العملة', 'Currency')}><select className={inputClass} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label={t('الكمية المتاحة', 'Stock')}><input className={inputClass} type="number" min={0} step={1} value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} dir="ltr" /></Field>
        </div>
        {price > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{t('سعرك', 'Your price')}: <b>{money(price, f.currency, lang)}</b> → {t('سعر البيع للعميل', 'buyer price')} ≈ <b>{money(buyer, 'EGP', lang)}</b> <span className="text-xs">({t(`+${MARGIN * 100}% عمولة الموقع`, `+${MARGIN * 100}% site commission`)})</span></p>
            <p className="mt-1 text-xs text-amber-800">{t('العميل بيشوف السعر بعملة بلده، وبيتضاف الشحن حسب بلده. مستحقاتك = سعرك × الكمية.', 'Buyers see it in their currency with shipping for their country. Your earnings = your price × qty.')}</p>
          </div>
        )}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-bold text-emerald-900"><Link2 className="h-4 w-4" />{t('روابط المصدر / المورّد — خاصة بينك وبين الإدارة', 'Source / supplier links — private between you and the administration')}</p>
          <p className="mb-3 text-[11px] text-emerald-800">{t('مشفّرة ومش بتظهر لأي عميل أو عضو. بتساعد الإدارة تتأكد من المنتج.', 'Encrypted and never shown to buyers or members. They help the administration verify the product.')}</p>
          <textarea className={inputClass} rows={2} value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} placeholder={t('رابط في كل سطر', 'One link per line')} dir="ltr" />
          <textarea className={`${inputClass} mt-2`} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder={t('ملاحظات خاصة للإدارة (اختياري)', 'Private notes for the administration (optional)')} />
        </div>
        <div className="flex gap-2"><Btn busy={busy} disabled={f.name.trim().length < 2 || !(price > 0)} onClick={() => void save()} className="flex-1">{t('حفظ وإرسال للمراجعة', 'Save & send for review')}</Btn><Btn variant="ghost" onClick={onClose}>{t('إلغاء', 'Cancel')}</Btn></div>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------ orders ------------------------------------------------ */

function MerchantOrders({ lang, toast }: { lang: Lang; toast: (s: string) => void }) {
  const t = tx(lang);
  const { data, loading, reload } = useLoad(() => cx<Order[]>('/community/merchant/orders'));
  return (
    <div className="space-y-3">
      <Card className="flex gap-2 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900"><Truck className="h-4 w-4 shrink-0" />
        {t('هنا بتظهر الطلبات المدفوعة فقط. جهّز الطلب واضغط «جاهز للشحن» — الإدارة بتستلم وبتشحن للعميل وبتتابع التسليم. بيانات العميل وعنوانه مع الإدارة فقط لحماية الطرفين.',
          'Only paid orders appear here. Prepare the order and press “Ready to ship” — the administration collects, ships and tracks delivery. Buyer details stay with the administration to protect both sides.')}
      </Card>
      {loading ? <Spinner /> : !data?.length ? <Card><Empty icon={<ClipboardList className="h-10 w-10" />} title={t('لسه مفيش طلبات مدفوعة', 'No paid orders yet')} /></Card> : data.map((o) => {
        const s = ORDER_STATUS[o.status] || [o.status, o.status, 'bg-stone-100'];
        return (
          <Card key={o.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-bold">#{o.number}</span><span className="text-xs text-stone-500">{timeAgo(o.createdAt, lang)} · {o.country}</span>
              <span className={`ms-auto rounded-full px-2.5 py-1 text-[11px] font-bold ${s[2]}`}>{lang === 'ar' ? s[0] : s[1]}</span></div>
            <ul className="mt-3 space-y-1.5 text-sm">{o.items.map((i) => <li key={i.sku} className="flex justify-between gap-2"><span>{i.name} <span className="text-stone-500">×{i.qty}</span></span>{i.unit != null && <span className="text-stone-600">{money(i.unit * i.qty, o.currency, lang)}</span>}</li>)}</ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
              <span className="text-sm">{t('مستحقاتك', 'Your earnings')}: <b>{money(o.amount || 0, o.currency, lang)}</b></span>
              {o.status === 'paid' && <Btn small onClick={async () => { try { await cx(`/community/merchant/orders/${o.id}/ready`, { body: {} }); toast(t('تم — الإدارة هتستلم الطلب', 'Done — the administration will collect it')); void reload(true); } catch (e) { toast(errorText(e, lang)); } }}><Package className="h-4 w-4" />{t('جاهز للشحن', 'Ready to ship')}</Btn>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
