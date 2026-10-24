import React, { useState, useEffect } from 'react';
import { Cookie, ShieldCheck, X, Settings } from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { LText, makeT } from '../لغات/localize';
import { INSIGHTS_CONSENT_VERSION } from '../utils/visitorInsights';

const S: Record<string, LText> = {
  banner_title: {
    ar: 'نحن نحترم خصوصيتك 🍪',
    en: 'We respect your privacy 🍪',
    fr: 'Nous respectons votre vie privée 🍪',
    es: 'Respetamos tu privacidad 🍪',
    de: 'Wir respektieren Ihre Privatsphäre 🍪',
  },
  banner_msg: {
    ar: 'نستخدم الضروري بس لتشغيل المنصة. ولو وافقت على «التحليل»، بنسجّل تفاعلك مع المنصة (الأقسام والمنتجات اللي بتشوفها، بحثك، أسئلتك لشاهين، السلة والطلب) ونحلّله عشان نفهم ذوقك وذوق كل بلد — وفي المقابل بنرشّحلك عطور على ذوقك من اللي شفته. البيانات دي ملك إدارة شام وحدها: مابنبيعهاش ولا بنشاركها، ومافيهاش مفاتيح ولا كلمات سر ولا أرقام بطاقات، وتقدر تسحب موافقتك وتتمسح في أي وقت.',
    en: 'We use only what is essential to run the platform. If you accept “Analytics”, we record how you use the platform (sections and products you view, your searches, your questions to Shaheen, cart and orders) and analyse it to understand your taste and each country’s — and in return we suggest perfumes for your taste from what you viewed. This data belongs to Sham’s administration alone: never sold or shared, never containing keys, passwords or card numbers, and you can withdraw and have it erased at any time.',
    fr: 'Essentiels uniquement. Si vous acceptez « Analyse », nous enregistrons et analysons votre utilisation de la plateforme (pages, produits, recherches, questions, panier) pour comprendre vos goûts — et vous suggérer des parfums à votre goût. Données réservées à l’administration de Sham, jamais vendues ; retrait et effacement à tout moment.',
    es: 'Solo lo esencial. Si aceptas «Análisis», registramos y analizamos tu uso de la plataforma (secciones, productos, búsquedas, preguntas, carrito) para entender tus gustos — y sugerirte perfumes a tu gusto. Datos solo para la administración de Sham, nunca vendidos; puedes retirarlo y borrarlo cuando quieras.',
    de: 'Nur das Notwendige. Wenn Sie „Analyse“ zustimmen, erfassen und analysieren wir Ihre Nutzung (Bereiche, Produkte, Suchen, Fragen, Warenkorb), um Ihren Geschmack zu verstehen — und Ihnen passende Düfte vorzuschlagen. Nur für die Sham-Verwaltung, nie verkauft; Widerruf und Löschung jederzeit.',
  },
  accept_all: { ar: 'قبول الكل', en: 'Accept All', fr: 'Tout accepter', es: 'Aceptar todo', de: 'Alle akzeptieren' },
  reject_all: { ar: 'رفض غير الضروري', en: 'Reject Non-Essential', fr: 'Refuser', es: 'Rechazar', de: 'Ablehnen' },
  customize: { ar: 'تخصيص', en: 'Customize', fr: 'Personnaliser', es: 'Personalizar', de: 'Anpassen' },
  save: { ar: 'حفظ اختياري', en: 'Save Preferences', fr: 'Enregistrer', es: 'Guardar', de: 'Speichern' },
  essential: { ar: 'ضروري (دائمًا نشط)', en: 'Essential (always on)', fr: 'Essentiel', es: 'Esencial', de: 'Essentiell' },
  analytics: { ar: 'التحليل (فهم ذوقك وتحسين المنصة)', en: 'Analytics (understanding your taste)', fr: 'Analyse', es: 'Análisis', de: 'Analyse' },
  marketing: { ar: 'تسويقي (لا نستخدمه حاليًا)', en: 'Marketing (not used)', fr: 'Marketing', es: 'Marketing', de: 'Marketing' },
  policy_link: { ar: 'سياسة الكوكيز', en: 'Cookie Policy', fr: 'Politique cookies', es: 'Política cookies', de: 'Cookie-Richtlinie' },
};

export type ConsentChoice = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
};

const CONSENT_KEY = 'sham_cookie_consent_v1';
// 1.1: «التحليل» now studies how each visitor uses the platform (src/utils/visitorInsights.ts) — asked again.
const CONSENT_VERSION = INSIGHTS_CONSENT_VERSION;

export function getConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch { return null; }
}

export function saveConsent(choice: Omit<ConsentChoice, 'timestamp' | 'version' | 'essential'> & Partial<Pick<ConsentChoice,'essential'>>) {
  const full: ConsentChoice = { essential: true, analytics: !!choice.analytics, marketing: !!choice.marketing, timestamp: new Date().toISOString(), version: CONSENT_VERSION };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(full)); } catch {}
  window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: full }));
  return full;
}

export const CookieConsent: React.FC<{ currentLang?: SupportedLanguage; onOpenPolicy?: () => void }> = ({ currentLang = 'ar', onOpenPolicy }) => {
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = getConsent();
    if (!existing) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const handler = () => setVisible(false);
    window.addEventListener('cookie-consent-updated', handler);
    window.addEventListener('open-cookie-settings', () => { setVisible(true); setShowCustomize(true); });
    return () => { window.removeEventListener('cookie-consent-updated', handler); };
  }, []);

  if (!visible) return null;

  const handleAcceptAll = () => { saveConsent({ analytics: true, marketing: true }); setVisible(false); };
  const handleRejectAll = () => { saveConsent({ analytics: false, marketing: false }); setVisible(false); };
  const handleSaveCustom = () => { saveConsent({ analytics, marketing }); setVisible(false); };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-4 flex justify-center pointer-events-none" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="pointer-events-auto w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in slide-in-from-bottom-2">
        <div className="p-4 sm:p-5 flex gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center hidden sm:flex">
            <Cookie className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <Cookie className="w-4 h-4 sm:hidden text-amber-600" />
                {L('banner_title')}
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-normal bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" /> GDPR/ePrivacy
                </span>
              </h3>
              <button onClick={() => setVisible(false)} className="p-1 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              {L('banner_msg')}{' '}
              {onOpenPolicy && (
                <button onClick={onOpenPolicy} className="text-amber-700 underline font-semibold">{L('policy_link')}</button>
              )}
            </p>

            {showCustomize && (
              <div className="pt-2 space-y-2 bg-stone-50 rounded-xl p-3 border border-stone-200">
                <label className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />{L('essential')}</span>
                  <input type="checkbox" checked disabled className="rounded" />
                </label>
                <label className="flex items-center justify-between text-xs">
                  <span>{L('analytics')}</span>
                  <input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} className="rounded text-amber-600" />
                </label>
                <label className="flex items-center justify-between text-xs">
                  <span>{L('marketing')}</span>
                  <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} className="rounded text-amber-600" />
                </label>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={handleAcceptAll} className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition">
                {L('accept_all')}
              </button>
              <button onClick={handleRejectAll} className="px-4 py-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl text-xs font-semibold transition">
                {L('reject_all')}
              </button>
              {!showCustomize ? (
                <button onClick={() => setShowCustomize(true)} className="px-3 py-2 text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1">
                  <Settings className="w-3.5 h-3.5" /> {L('customize')}
                </button>
              ) : (
                <button onClick={handleSaveCustom} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition">
                  {L('save')}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-200 text-[11px] text-stone-500 flex items-center justify-between">
          <span>ePrivacy + GDPR Art.6 — سجل الموافقة يُحفظ مع timestamp</span>
          <span className="hidden sm:inline text-[10px]">Zero Trackers · لا تتبع خارجي</span>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
