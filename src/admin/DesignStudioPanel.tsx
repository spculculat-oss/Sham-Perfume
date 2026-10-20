import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Copy, Image, Loader2, Palette, RefreshCw, Sparkles } from 'lucide-react';
import type { Product } from '../../server/core/types';
import type { DesignBriefRequest, DesignBriefResponse, DesignCreativeBrief, DesignObjective, DesignPlatform, DesignSpecialty } from '../types/design';
import { copyChatText } from '../utils/clipboard';
import { T } from './adminL10n';
import { AdminApiError, adminRequest, send } from './adminApi';

const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const input = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50';

const SPECIALTIES: { id: DesignSpecialty; label: () => string }[] = [
  { id: 'brand_strategy', label: () => T('استراتيجية العلامة التجارية') },
  { id: 'brand_guidelines', label: () => T('دليل الهوية ومعايير العلامة') },
  { id: 'visual_identity', label: () => T('الهوية البصرية والشعار') },
  { id: 'graphic_design', label: () => T('التصميم الجرافيكي') },
  { id: 'advertising_creative', label: () => T('الإعلانات والحملات الإبداعية') },
  { id: 'social_media', label: () => T('تصميم الشبكات الاجتماعية') },
  { id: 'web_design', label: () => T('تصميم المواقع') },
  { id: 'ui_ux', label: () => T('واجهات وتجربة المستخدم UI/UX') },
  { id: 'mobile_app', label: () => T('تصميم تطبيقات الهاتف') },
  { id: 'ecommerce_conversion', label: () => T('التجارة الإلكترونية والتحويل') },
  { id: 'design_systems', label: () => T('أنظمة التصميم والمكونات') },
  { id: 'packaging_label', label: () => T('التغليف والملصقات') },
  { id: 'product_photography', label: () => T('تصوير المنتجات') },
  { id: 'art_direction', label: () => T('الإخراج والتوجيه الفني') },
  { id: 'motion_video', label: () => T('الموشن جرافيك والفيديو') },
  { id: 'illustration', label: () => T('الرسم والتوضيح') },
  { id: '3d_visualization', label: () => T('التصميم والتصور ثلاثي الأبعاد') },
  { id: 'editorial_print', label: () => T('التصميم التحريري والمطبوعات') },
  { id: 'presentation', label: () => T('العروض التقديمية') },
  { id: 'infographics', label: () => T('الإنفوجرافيك وتصوير البيانات') },
  { id: 'typography', label: () => T('الخطوط والطباعة') },
  { id: 'accessibility', label: () => T('الإتاحة والتصميم الشامل') },
  { id: 'rtl_localization', label: () => T('التوطين وواجهات RTL') },
  { id: 'service_design', label: () => T('تصميم الخدمات ورحلة المستخدم') },
  { id: 'retail_environment', label: () => T('المساحات التجارية واللافتات') },
  { id: 'interior_spatial', label: () => T('التصميم الداخلي والمساحات') },
  { id: 'architecture_design', label: () => T('العمارة والتصميم المعماري') },
  { id: 'landscape_design', label: () => T('تصميم المناظر الطبيعية والحدائق') },
  { id: 'exhibition_event', label: () => T('المعارض والفعاليات والتجارب') },
  { id: 'fashion_textile', label: () => T('الأزياء والمنسوجات') },
  { id: 'game_design', label: () => T('تصميم الألعاب') },
  { id: 'immersive_ar_vr', label: () => T('الواقع المعزز والافتراضي والتجارب الغامرة') },
  { id: 'wayfinding_signage', label: () => T('أنظمة الإرشاد واللافتات') },
  { id: 'instructional_design', label: () => T('التصميم التعليمي والتعلّم') },
  { id: 'user_research', label: () => T('بحث المستخدم واختبار الاستخدام') },
  { id: 'sound_design', label: () => T('تصميم الصوت') },
  { id: 'email_content', label: () => T('تصميم البريد والمحتوى') },
  { id: 'design_audit', label: () => T('تدقيق التصميم وتجربة الموقع') },
  { id: 'industrial_product', label: () => T('تصميم المنتجات المادية والصناعية') },
  { id: 'custom', label: () => T('تخصص آخر (مخصص)') },
];
const PLATFORMS: { id: DesignPlatform; label: () => string }[] = [
  { id: 'instagram_post', label: () => T('منشور إنستغرام — 4:5') },
  { id: 'instagram_story', label: () => T('ستوري / ريلز — 9:16') },
  { id: 'facebook_post', label: () => T('منشور فيسبوك — 4:5') },
  { id: 'tiktok_video', label: () => T('فيديو تيك توك — 9:16') },
  { id: 'website_banner', label: () => T('بانر الموقع — 16:9') },
  { id: 'website_page', label: () => T('صفحة موقع متجاوبة') },
  { id: 'mobile_app_screen', label: () => T('شاشة تطبيق هاتف') },
  { id: 'ecommerce_product_page', label: () => T('صفحة منتج للمتجر') },
  { id: 'brand_identity', label: () => T('منظومة هوية بصرية') },
  { id: 'logo_system', label: () => T('نظام شعار ونسخه') },
  { id: 'brand_guidelines', label: () => T('دليل إرشادات العلامة') },
  { id: 'packaging_label', label: () => T('ملصق عبوة') },
  { id: 'packaging_concept', label: () => T('تصور تغليف وعبوة') },
  { id: 'product_photo_shoot', label: () => T('جلسة تصوير منتج') },
  { id: 'video_storyboard', label: () => T('لوحة مشاهد فيديو') },
  { id: 'print_flyer', label: () => T('فلاير مطبوع — A5') },
  { id: 'catalog_brochure', label: () => T('كتالوج أو بروشور') },
  { id: 'presentation_deck', label: () => T('عرض تقديمي — 16:9') },
  { id: 'email_campaign', label: () => T('رسالة بريد إلكتروني') },
  { id: 'infographic', label: () => T('إنفوجرافيك') },
  { id: 'store_signage', label: () => T('لافتة أو مساحة متجر') },
  { id: 'industrial_product_concept', label: () => T('تصور منتج مادي') },
  { id: 'design_system', label: () => T('نظام تصميم ومكونات') },
  { id: 'ux_audit', label: () => T('تدقيق تجربة المستخدم') },
  { id: 'responsive_prototype', label: () => T('نموذج أولي متجاوب') },
  { id: 'architecture_concept', label: () => T('تصور معماري') },
  { id: 'interior_spatial_concept', label: () => T('تصور تصميم داخلي ومساحي') },
  { id: 'landscape_concept', label: () => T('تصور تنسيق موقع طبيعي') },
  { id: 'exhibition_environment', label: () => T('تصميم معرض أو بيئة فعالية') },
  { id: 'fashion_textile_concept', label: () => T('تصور أزياء أو نقوش نسيج') },
  { id: 'game_interface_concept', label: () => T('واجهة أو تجربة لعبة') },
  { id: 'immersive_ar_vr_prototype', label: () => T('نموذج تجربة AR/VR') },
  { id: 'wayfinding_signage_system', label: () => T('نظام إرشاد ولافتات') },
  { id: 'service_blueprint', label: () => T('مخطط خدمة ورحلة مستخدم') },
  { id: 'instructional_design_module', label: () => T('وحدة تصميم تعليمي') },
  { id: 'user_research_plan', label: () => T('خطة بحث واختبار مستخدم') },
  { id: 'sound_design_brief', label: () => T('موجز تصميم صوتي') },
  { id: 'custom_design', label: () => T('مخرج تصميم مخصص') },
];
const OBJECTIVES: { id: DesignObjective; label: () => string }[] = [
  { id: 'awareness', label: () => T('تعريف بالعلامة') },
  { id: 'launch', label: () => T('إطلاق منتج') },
  { id: 'sales', label: () => T('زيادة المبيعات') },
  { id: 'gift', label: () => T('اقتراح هدية') },
  { id: 'seasonal', label: () => T('مناسبة موسمية') },
  { id: 'usability', label: () => T('سهولة الاستخدام') },
  { id: 'conversion', label: () => T('تحسين التحويل') },
  { id: 'consistency', label: () => T('اتساق الهوية والتجربة') },
  { id: 'accessibility', label: () => T('الإتاحة والشمول') },
  { id: 'retention', label: () => T('الاحتفاظ والعودة') },
  { id: 'education', label: () => T('التثقيف والشرح') },
  { id: 'custom', label: () => T('هدف آخر') },
];

export default function DesignStudioPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [brief, setBrief] = useState('');
  const [specialty, setSpecialty] = useState<DesignSpecialty>('social_media');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [customDeliverable, setCustomDeliverable] = useState('');
  const [audience, setAudience] = useState('');
  const [platform, setPlatform] = useState<DesignPlatform>('instagram_story');
  const [objective, setObjective] = useState<DesignObjective>('awareness');
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [includeRetailPrice, setIncludeRetailPrice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DesignBriefResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    adminRequest<{ items: Product[] }>('/products')
      .then((data) => { if (active) setProducts(data.items || []); })
      .catch(() => { if (active) setProductsError(T('تعذّر تحميل كتالوج المنتجات. يمكنك إعداد تصور من دون اختيار منتج.')); })
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedProduct = products.find((product) => product.id === productId);
  const visibleProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    const matches = products.filter((product) => !query || `${product.nameAr} ${product.nameEn} ${product.sku}`.toLowerCase().includes(query)).slice(0, 60);
    if (selectedProduct && !matches.some((product) => product.id === selectedProduct.id)) return [selectedProduct, ...matches];
    return matches;
  }, [products, productSearch, selectedProduct]);

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    if (brief.trim().length < 12 || busy) return;
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      const request: DesignBriefRequest = {
        brief: brief.trim(), specialty, platform, objective, language,
        ...(specialty === 'custom' && customSpecialty.trim() ? { customSpecialty: customSpecialty.trim() } : {}),
        ...(platform === 'custom_design' && customDeliverable.trim() ? { customDeliverable: customDeliverable.trim() } : {}),
        ...(audience.trim() ? { audience: audience.trim() } : {}),
        ...(productId ? { productId } : {}),
        includeRetailPrice,
      };
      const data = await adminRequest<DesignBriefResponse>('/design/brief', {
        ...send('POST', request),
        signal: AbortSignal.timeout(50_000),
      });
      setResult(data);
    } catch (cause) {
      setError(errorText(cause));
    } finally { setBusy(false); }
  };

  const copyResult = async () => {
    if (!result) return;
    setCopied(await copyChatText(formatBrief(result.creative, result.retailPrice)));
  };
  const canSubmit = brief.trim().length >= 12 && !(specialty === 'custom' && customSpecialty.trim().length < 3)
    && !(platform === 'custom_design' && customDeliverable.trim().length < 3);

  return (
    <div className="space-y-4" dir="auto">
      <header className={`${card} overflow-hidden border-amber-200 bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-amber-50`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="rounded-xl bg-amber-400/15 p-2.5 text-amber-300"><Palette className="h-6 w-6" /></span>
            <div>
              <h1 className="text-xl font-black">{T('استوديو التصميم')}</h1>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-stone-200">{T('خبير متعدد التخصصات يشمل العلامات والواجهات والعمارة والمساحات والمناظر الطبيعية والفعاليات والأزياء والألعاب والواقع الممتد والتغليف والتصوير والحركة والطباعة والإتاحة والتعلّم والبحث والصوت، مع مساحة لتخصصاتك المخصصة.')}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-200"><Sparkles className="h-3.5 w-3.5" />{T('تحت إشراف الخبير شاهين')}</span>
        </div>
        <div className="mt-4 grid gap-2 text-xs text-stone-200 sm:grid-cols-2 xl:grid-cols-3">
          {[T('شبكة جميع برامج الذكاء المسجلة تحت شاهين'), T('تدقيق التصميم والتباين والموبايل'), T('وكيل اللغات واتجاه الكتابة RTL'), T('جولة الزائر على الهاتف'), T('الكتالوج والبحث وجودة الصور وفق التقارير المتاحة')].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />{item}</div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-amber-100/80">{T('يجهز خطة وتصورا وقائمة فحص؛ لا ينشئ ملف إنتاج نهائياً ولا يعدّل الموقع أو ينشر تلقائياً.')}</p>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]">
        <form onSubmit={generate} className={`${card} space-y-3`}>
          <h2 className="flex items-center gap-2 text-base font-black text-stone-900"><Image className="h-4 w-4 text-amber-700" />{T('موجز التصميم')}</h2>
          <label className="block space-y-1 text-xs font-semibold text-stone-700">
            <span>{T('اشرح التصميم أو المشكلة أو النتيجة التي تريدها')}</span>
            <textarea className={input} rows={5} maxLength={1400} value={brief} onChange={(event) => setBrief(event.target.value)} placeholder={T('مثال: راجع رحلة شراء العطر على الهاتف واقترح تحسينات للوضوح والإتاحة وRTL، من غير تغيير الموقع أو اختراع نتائج.')}/>
            <span className="block text-end text-[10px] font-normal text-stone-400">{brief.length}/1400</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={T('التخصص التصميمي')}>
              <select className={input} value={specialty} onChange={(event) => {
                const next = event.target.value as DesignSpecialty;
                setSpecialty(next);
                if (!['advertising_creative', 'social_media', 'ecommerce_conversion'].includes(next)) setIncludeRetailPrice(false);
              }}>
                {SPECIALTIES.map((item) => <option key={item.id} value={item.id}>{item.label()}</option>)}
              </select>
            </Field>
            <Field label={T('المخرج أو سطح التصميم')}>
              <select className={input} value={platform} onChange={(event) => setPlatform(event.target.value as DesignPlatform)}>
                {PLATFORMS.map((item) => <option key={item.id} value={item.id}>{item.label()}</option>)}
              </select>
            </Field>
            <Field label={T('هدف المشروع')}>
              <select className={input} value={objective} onChange={(event) => setObjective(event.target.value as DesignObjective)}>
                {OBJECTIVES.map((item) => <option key={item.id} value={item.id}>{item.label()}</option>)}
              </select>
            </Field>
            <Field label={T('لغة التصميم والنص (العربية أو الإنجليزية)')}>
              <select className={input} value={language} onChange={(event) => setLanguage(event.target.value as 'ar' | 'en')}>
                <option value="ar">{T('العربية')}</option><option value="en">{T('الإنجليزية')}</option>
              </select>
            </Field>
            <Field label={T('الجمهور أو المستخدم المستهدف (اختياري)')}>
              <input className={input} maxLength={180} value={audience} onChange={(event) => setAudience(event.target.value)} placeholder={T('مثال: مشترو العطور عبر الهاتف أو عشاق الروائح الخشبية')} />
            </Field>
            {specialty === 'custom' && <Field label={T('اكتب التخصص المخصص')}><input className={input} maxLength={80} value={customSpecialty} onChange={(event) => setCustomSpecialty(event.target.value)} placeholder={T('مثال: تصميم تجربة معرض عطور تفاعلي')} /></Field>}
            {platform === 'custom_design' && <Field label={T('اكتب المخرج أو الملف المطلوب')}><input className={input} maxLength={140} value={customDeliverable} onChange={(event) => setCustomDeliverable(event.target.value)} placeholder={T('مثال: ملف إرشادات تصوير لثماني صور منتجات')} /></Field>}
          </div>

          <div className="block space-y-1 text-xs font-semibold text-stone-700">
            <span>{T('منتج من كتالوج شام (اختياري)')}</span>
            <input className={input} value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder={T('ابحث باسم المنتج أو رقمه')} aria-label={T('ابحث عن منتج')} />
            <select className={`${input} mt-1`} value={productId} aria-label={T('منتج من كتالوج شام (اختياري)')} onChange={(event) => {
              const id = event.target.value;
              setProductId(id);
              const product = products.find((item) => item.id === id);
              if (product) setProductSearch(product.nameAr || product.nameEn);
              if (!id) setIncludeRetailPrice(false);
            }}>
              <option value="">{T('بدون منتج محدد')}</option>
              {visibleProducts.map((product) => <option key={product.id} value={product.id}>{product.nameAr || product.nameEn} · {product.sku}</option>)}
            </select>
            {productsLoading && <span className="mt-1 flex items-center gap-1 text-[11px] font-normal text-stone-400"><RefreshCw className="h-3 w-3 animate-spin" />{T('جارٍ تحميل المنتجات…')}</span>}
            {productsError && <span className="mt-1 block text-[11px] font-normal text-amber-700">{productsError}</span>}
          </div>
          {['advertising_creative', 'social_media', 'ecommerce_conversion'].includes(specialty) && <label className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${selectedProduct ? 'border-stone-200 bg-stone-50 text-stone-700' : 'border-stone-100 bg-stone-50/60 text-stone-400'}`}>
            <input type="checkbox" className="mt-0.5" checked={includeRetailPrice} disabled={!selectedProduct} onChange={(event) => setIncludeRetailPrice(event.target.checked)} />
            <span>{T('أرفق سعر البيع الحالي من الكتالوج في النتيجة المنفصلة (من غير تكلفة المورد أو الهامش).')}</span>
          </label>}

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <button type="submit" disabled={busy || !canSubmit} className={`${btn} w-full bg-stone-900 text-amber-100`}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />{T('شاهين يجمع خبرات الفريق ويجهّز الخطة…')}</> : <><Sparkles className="h-4 w-4" />{T('جهّز تصور التصميم')}</>}
          </button>
          <p className="text-[11px] leading-relaxed text-stone-500">{T('راجع الحقائق والأبعاد والتراخيص وقائمة الفحص قبل التنفيذ؛ لا تُطبّق اقتراحات الموقع تلقائياً.')}</p>
        </form>

        <section className="space-y-3">
          {!result && !busy && (
            <div className={`${card} flex min-h-64 flex-col items-center justify-center gap-3 text-center text-stone-500`}>
              <div className="rounded-2xl bg-amber-50 p-4 text-amber-700"><Palette className="h-8 w-8" /></div>
              <p className="max-w-sm text-sm">{T('اختر التخصص والمخرج واكتب موجزك؛ سيجمع شاهين الملاحظات المتاحة ويعرض خطة التصميم وقائمة الفحص هنا.')}</p>
            </div>
          )}
          {busy && <div className={`${card} flex min-h-64 flex-col items-center justify-center gap-3 text-center text-stone-500`}><Loader2 className="h-8 w-8 animate-spin text-amber-600" /><p className="text-sm">{T('شاهين يدمج منهج التصميم وتقارير الفريق المناسبة…')}</p></div>}
          {result && <CreativePreview result={result} onCopy={copyResult} copied={copied} />}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-xs font-semibold text-stone-700"><span>{label}</span>{children}</label>;
}

function CreativePreview({ result, onCopy, copied }: { result: DesignBriefResponse; onCopy: () => void; copied: boolean }) {
  const creative = result.creative;
  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 p-5 text-amber-50 sm:p-7">
        <div className="absolute -end-12 -top-16 h-52 w-52 rounded-full border border-amber-200/10" />
        <div className="absolute -end-4 -top-8 h-36 w-36 rounded-full border border-amber-200/15" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">{T('خطة تصميم متعددة التخصصات — للمراجعة')}</p>
            <p className="mt-2 text-[11px] font-bold text-amber-200">{creative.specialtyLabel || SPECIALTIES.find((item) => item.id === creative.specialty)?.label() || creative.specialty}</p>
            <h2 className="mt-1 text-2xl font-black leading-tight">{creative.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-200">{creative.concept}</p>
          </div>
          <button type="button" onClick={onCopy} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-100/20 bg-white/5 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-white/10">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? T('تم النسخ') : T('نسخ الموجز')}
          </button>
        </div>
        {(creative.headline || creative.caption || creative.cta) && <div className="relative mt-6 rounded-2xl border border-amber-200/20 bg-black/25 p-4 sm:p-6">
          {creative.headline && <><p className="text-[10px] font-bold tracking-wider text-amber-300">{T('العنوان المقترح')}</p><p className="mt-2 max-w-xl text-2xl font-black leading-snug sm:text-3xl">{creative.headline}</p></>}
          {creative.caption && <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-200">{creative.caption}</p>}
          {creative.cta && <span className="mt-4 inline-flex rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-stone-950">{creative.cta}</span>}
        </div>}
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          {creative.palette.map((color) => <span key={`${color.hex}-${color.name}`} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-stone-200"><i className="h-3 w-3 rounded-full border border-white/30" style={{ backgroundColor: color.hex }} />{color.name} <b dir="ltr" className="font-mono">{color.hex}</b><span className="text-stone-400">{color.use}</span></span>)}
          <span className="text-[10px] text-stone-400">{creative.format}</span>
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <Info title={T('الاستراتيجية')} text={creative.strategy} />
        <Info title={T('الجمهور أو المستخدم')} text={creative.audience} />
        <Info title={T('الاتجاه البصري')} text={creative.visualDirection} />
        <Info title={T('المعلومات وتسلسلها')} text={creative.informationArchitecture} />
        <Info title={T('التخطيط')} text={creative.layout} />
        <Info title={T('الخطوط والكتابة')} text={creative.typography} />
        <Info title={T('رحلة المستخدم')} text={creative.experienceFlow} />
        <Info title={T('التفاعل والحالات')} text={creative.interactionNotes} />
        <Info title={T('التصميم المتجاوب')} text={creative.responsiveNotes} />
        <Info title={T('الإتاحة والشمول')} text={creative.accessibilityNotes} />
        <Info title={T('الإنتاج والقيود')} text={creative.productionNotes} />
        <Info title={T('معايير النجاح')} text={creative.successCriteria} />
        <Info title={T('الصور والأصول المقترحة')} text={creative.assetDirection} />
        <Info title={T('الوصف البديل للصورة')} text={creative.altText} />
        {creative.assetSearchTerms.length > 0 && <BulletList title={T('عبارات بحث الأصول المرئية')} items={creative.assetSearchTerms} />}
        {creative.qualityChecklist.length > 0 && <BulletList title={T('قائمة الفحص قبل التسليم')} items={creative.qualityChecklist} />}
        {creative.siteImprovementIdeas.length > 0 && <BulletList title={T('مقترحات تطوير الموقع (تحتاج موافقتك)')} items={creative.siteImprovementIdeas} />}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 sm:col-span-2">
          <h3 className="mb-1 text-xs font-black text-stone-800">{T('توجيه بصري للمصمم أو أداة الأصول')}</h3>
          <p dir="auto" className="whitespace-pre-wrap text-xs leading-relaxed text-stone-600">{creative.imagePrompt}</p>
        </div>
        <CollaborationDetails collaboration={result.collaboration} />
        {result.retailPrice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:col-span-2"><h3 className="text-xs font-black text-emerald-900">{T('سعر البيع من الكتالوج')}</h3><p dir="ltr" className="mt-1 text-sm font-bold text-emerald-800">{result.retailPrice.amount} {result.retailPrice.currency}</p><p className="mt-1 text-[10px] text-emerald-800">{T('سعر بيع فقط — لا يتضمن أي تفاصيل تكلفة داخلية.')}</p></div>}
      </div>
    </article>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return <div className="rounded-xl border border-stone-100 bg-stone-50 p-3"><h3 className="mb-1 text-xs font-black text-stone-800">{title}</h3><p dir="auto" className="whitespace-pre-wrap text-xs leading-relaxed text-stone-600">{text}</p></div>;
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-xl border border-stone-100 bg-stone-50 p-3"><h3 className="mb-1 text-xs font-black text-stone-800">{title}</h3><ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-stone-600">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>;
}

function CollaborationDetails({ collaboration }: { collaboration: DesignBriefResponse['collaboration'] }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 sm:col-span-2">
      <details>
        <summary className="cursor-pointer text-xs font-black text-amber-950">{T('شبكة التعاون والتعلّم مع شاهين')} · {collaboration.team.length} {T('عضواً مسجلاً')}</summary>
        <div className="mt-3 space-y-3 text-xs text-stone-700">
          <p>{collaboration.privacyNoteAr}</p>
          <div className="rounded-lg border border-amber-200 bg-white p-3">
            <h3 className="font-black">{T('درس التصميم المطبق')}</h3>
            <p className="mt-1 font-semibold">{collaboration.learning.titleAr}</p>
            <p className="mt-1 leading-relaxed">{collaboration.learning.principleAr}</p>
          </div>
          <div>
            <h3 className="mb-1 font-black">{T('تقارير ومصادر دمجها فعلياً')}</h3>
            {collaboration.sources.length > 0
              ? <ul className="list-inside list-disc space-y-1">{collaboration.sources.map((source) => <li key={source.id}>{source.nameAr}: {source.contributionAr}{source.updatedAt ? ` · ${source.updatedAt}` : ''}</li>)}</ul>
              : <p>{T('لم تتوفر تقارير تخصصية لهذا الطلب؛ استُخدم سجل الأدوار والمنهج فقط.')}</p>}
          </div>
          <div>
            <h3 className="mb-1 font-black">{T('سجل الأدوار والأدوات والروبوتات تحت شاهين')}</h3>
            <div className="flex flex-wrap gap-1.5">{collaboration.team.map((member) => <span key={member.id} className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px]">{member.nameAr}</span>)}</div>
          </div>
        </div>
      </details>
    </div>
  );
}

function formatBrief(creative: DesignCreativeBrief, retailPrice?: DesignBriefResponse['retailPrice']): string {
  const field = (label: string, value?: string) => value?.trim() ? `${T(label)}: ${value}` : '';
  return [
    creative.title,
    creative.concept,
    field('التخصص التصميمي', creative.specialtyLabel || SPECIALTIES.find((item) => item.id === creative.specialty)?.label() || creative.specialty),
    field('الاستراتيجية', creative.strategy),
    field('الجمهور أو المستخدم', creative.audience),
    field('الاتجاه البصري', creative.visualDirection),
    field('المعلومات وتسلسلها', creative.informationArchitecture),
    field('التخطيط', creative.layout),
    field('الخطوط والكتابة', creative.typography),
    field('رحلة المستخدم', creative.experienceFlow),
    field('التفاعل والحالات', creative.interactionNotes),
    field('العنوان المقترح', creative.headline),
    field('النص الإعلاني', creative.caption),
    field('الدعوة لاتخاذ إجراء', creative.cta),
    field('لوحة الألوان', creative.palette.map((color) => `${color.name} ${color.hex} — ${color.use}`).join('، ')),
    field('التصميم المتجاوب', creative.responsiveNotes),
    field('الإتاحة والشمول', creative.accessibilityNotes),
    field('الإنتاج والقيود', creative.productionNotes),
    field('معايير النجاح', creative.successCriteria),
    field('الصور والأصول المقترحة', creative.assetDirection),
    field('عبارات بحث الأصول المرئية', creative.assetSearchTerms.join(' · ')),
    field('توجيه بصري للمصمم أو أداة الأصول', creative.imagePrompt),
    field('الوصف البديل للصورة', creative.altText),
    field('قائمة الفحص قبل التسليم', creative.qualityChecklist.map((item) => `• ${item}`).join('\n')),
    field('مقترحات تطوير الموقع (تحتاج موافقتك)', creative.siteImprovementIdeas.map((item) => `• ${item}`).join('\n')),
    retailPrice ? `${T('سعر البيع من الكتالوج')}: ${retailPrice.amount} ${retailPrice.currency}` : '',
  ].filter(Boolean).join('\n\n');
}

function errorText(error: unknown): string {
  const code = error instanceof AdminApiError ? error.code : '';
  if (code === 'PROVIDER_NOT_CONFIGURED') return T('لا يوجد محرك ذكاء اصطناعي مهيأ؛ راجع إعدادات شاهين في لوحة الإدارة.');
  if (code === 'PROVIDER_UNAVAILABLE' || code === 'PROVIDER_TIMEOUT') return T('شاهين لم يتمكن من إعداد تصور هذه المرة. لم يتم إنشاء نتيجة بديلة وهمية؛ جرّب لاحقاً.');
  if (code === 'SHAHEEN_DISABLED') return T('شاهين متوقف حالياً من إعدادات الإدارة.');
  if (code === 'PRODUCT_NOT_FOUND') return T('المنتج غير موجود أو غير ظاهر في كتالوج شام.');
  if (code === 'RATE_LIMITED') return T('طلبات تصميم كثيرة في وقت قصير؛ انتظر دقائق ثم جرّب.');
  if (error instanceof AdminApiError && error.status === 401) return T('انتهت جلسة الإدارة؛ سجّل الدخول من جديد.');
  return error instanceof Error && error.message ? error.message : T('حصلت مشكلة أثناء إعداد التصميم.');
}
