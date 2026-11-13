import React, { useMemo, useState } from 'react';
import { CheckCircle2, Lightbulb, Loader2, MessageSquarePlus, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { LText, makeT } from '../لغات/localize';
import { apiUrl, isStaticHosting } from '../utils/api';
import { type SuggestionKind } from '../utils/visitorVoice';

const S: Record<string, LText> = {
  open: { ar: 'شارك اقتراحك', en: 'Share a suggestion', fr: 'Partager une suggestion', es: 'Comparte una sugerencia', de: 'Vorschlag teilen' },
  title: { ar: 'صوتك يهمنا', en: 'We value your feedback', fr: 'Votre avis compte', es: 'Tu opinión nos importa', de: 'Ihre Meinung zählt' },
  intro: { ar: 'اكتب اقتراح أو ملاحظة تساعدنا نحسّن الموقع والترشيحات.', en: 'Share an idea or note to help us improve the site and recommendations.', fr: 'Partagez une idée pour améliorer le site et les recommandations.', es: 'Comparte una idea para mejorar el sitio y las recomendaciones.', de: 'Teilen Sie eine Idee, um Website und Empfehlungen zu verbessern.' },
  kind: { ar: 'نوع الرسالة', en: 'Message type', fr: 'Type de message', es: 'Tipo de mensaje', de: 'Nachrichtentyp' },
  idea: { ar: 'اقتراح', en: 'Idea', fr: 'Idée', es: 'Idea', de: 'Idee' },
  problem: { ar: 'مشكلة أو ملاحظة', en: 'Problem or note', fr: 'Problème ou remarque', es: 'Problema o comentario', de: 'Problem oder Hinweis' },
  praise: { ar: 'شكر أو تقييم', en: 'Thanks or praise', fr: 'Merci ou compliment', es: 'Agradecimiento', de: 'Dank oder Lob' },
  message: { ar: 'اقتراحك', en: 'Your suggestion', fr: 'Votre suggestion', es: 'Tu sugerencia', de: 'Ihr Vorschlag' },
  placeholder: { ar: 'إيه اللي تحب يتغير أو يظهر بشكل أحسن؟', en: 'What would you like us to improve or show better?', fr: 'Que devrions-nous améliorer ou mieux présenter ?', es: '¿Qué deberíamos mejorar o mostrar mejor?', de: 'Was sollten wir verbessern oder besser zeigen?' },
  privacy: { ar: 'الاقتراح اختياري ومجهول: مفيش خانة اسم أو تواصل. بنخفي البريد والأرقام، وبنرفض البيانات الشخصية الواضحة والأسرار. تنتهي صلاحيته بعد 180 يوم؛ بعدها يمسحه التنظيف الدوري أو أول استخدام لاحق للموقع. ماتكتبش اسمك أو عنوانك أو رقم طلب أو كلمة سر أو معلومة حساسة.', en: 'Optional and anonymous: no name or contact field. Emails and long numbers are removed; clear personal details and secrets are refused. It expires after 180 days and is deleted by routine cleanup or on the site’s first later use. Do not include names, addresses, order references, passwords or sensitive details.', fr: 'Facultatif et anonyme : aucun nom ni contact. E-mails et longs numéros masqués ; données personnelles explicites et secrets refusés. Expiration après 180 jours, suppression au nettoyage périodique ou à la première utilisation ultérieure du site. Ne partagez pas d’informations sensibles.', es: 'Opcional y anónimo: no pedimos nombre ni contacto. Se ocultan correos y números largos; se rechazan datos personales claros y secretos. Caduca a los 180 días y se elimina en la limpieza periódica o al primer uso posterior del sitio. No incluyas datos sensibles.', de: 'Freiwillig und anonym: kein Name oder Kontaktfeld. E-Mails und lange Nummern werden entfernt; eindeutige persönliche Angaben und Geheimnisse werden abgelehnt. Läuft nach 180 Tagen ab und wird bei der regelmäßigen Bereinigung oder der ersten späteren Nutzung der Website gelöscht. Keine sensiblen Angaben.' },
  agree: { ar: 'موافق على إرسال الاقتراح ومراجعته لتحسين الموقع.', en: 'I agree to submit this suggestion for site-improvement review.', fr: 'J’accepte l’envoi de cette suggestion pour examen.', es: 'Acepto enviar esta sugerencia para su revisión.', de: 'Ich stimme der Übermittlung zur Prüfung zu.' },
  send: { ar: 'إرسال الاقتراح', en: 'Send suggestion', fr: 'Envoyer', es: 'Enviar sugerencia', de: 'Vorschlag senden' },
  sending: { ar: 'جاري الإرسال…', en: 'Sending…', fr: 'Envoi…', es: 'Enviando…', de: 'Wird gesendet…' },
  close: { ar: 'إغلاق', en: 'Close', fr: 'Fermer', es: 'Cerrar', de: 'Schließen' },
  success: { ar: 'وصل اقتراحك للمراجعة، شكرًا ليك.', en: 'Your suggestion was received for review. Thank you.', fr: 'Votre suggestion a été reçue. Merci.', es: 'Recibimos tu sugerencia. Gracias.', de: 'Ihr Vorschlag wurde empfangen. Vielen Dank.' },
  redacted: { ar: 'وصل اقتراحك بعد إخفاء البريد أو الأرقام.', en: 'Your suggestion was received after emails or numbers were redacted.', fr: 'Votre suggestion a été reçue après masquage des coordonnées.', es: 'Recibimos la sugerencia tras ocultar datos de contacto.', de: 'Der Vorschlag wurde nach dem Entfernen von Kontaktdaten empfangen.' },
  sensitive: { ar: 'ماحفظناش الرسالة. امسح كلمات السر أو رموز التحقق وأعد المحاولة.', en: 'The message was not saved. Remove passwords or verification codes and try again.', fr: 'Message non enregistré. Supprimez les mots de passe et réessayez.', es: 'No se guardó. Elimina contraseñas o códigos y vuelve a intentarlo.', de: 'Nicht gespeichert. Entfernen Sie Passwörter oder Bestätigungscodes und versuchen Sie es erneut.' },
  personal: { ar: 'ماحفظناش الرسالة. امسح الاسم أو بيانات التواصل وأعد المحاولة.', en: 'The message was not saved. Remove names or contact details and try again.', fr: 'Message non enregistré. Supprimez le nom ou les coordonnées.', es: 'No se guardó. Elimina nombres o datos de contacto.', de: 'Nicht gespeichert. Entfernen Sie Namen oder Kontaktdaten.' },
  unavailable: { ar: 'الإرسال مش متاح دلوقتي؛ ماحفظناش حاجة. جرّب بعدين.', en: 'Sending is unavailable right now; nothing was saved. Please try later.', fr: 'Envoi indisponible ; rien n’a été enregistré. Réessayez plus tard.', es: 'El envío no está disponible; no se guardó nada. Inténtalo más tarde.', de: 'Senden ist gerade nicht verfügbar; nichts wurde gespeichert. Bitte später erneut versuchen.' },
  limited: { ar: 'وصلنا حد الإرسال مؤقتًا. جرّب بعد شوية.', en: 'The temporary sending limit was reached. Please try again later.', fr: 'Limite temporaire atteinte. Réessayez plus tard.', es: 'Se alcanzó el límite temporal. Inténtalo más tarde.', de: 'Das vorläufige Limit ist erreicht. Bitte später erneut versuchen.' },
  invalid: { ar: 'اكتب اقتراح واضح من 8 إلى 1200 حرف ووافق على الإرسال.', en: 'Enter a clear suggestion of 8–1200 characters and confirm submission.', fr: 'Saisissez 8 à 1200 caractères et confirmez l’envoi.', es: 'Escribe entre 8 y 1200 caracteres y confirma el envío.', de: 'Geben Sie 8–1200 Zeichen ein und bestätigen Sie.' },
};

type ApiReply = { accepted?: boolean; redacted?: boolean; code?: string };

export default function VisitorSuggestionBox({ currentLang = 'ar' }: { currentLang?: SupportedLanguage }) {
  const L = useMemo(() => makeT(currentLang, S), [currentLang]);
  const rtl = isRTL(currentLang);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SuggestionKind>('idea');
  const [text, setText] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const show = () => {
    setKind('idea'); setText(''); setAgree(false); setBusy(false); setMessage(''); setSuccess(false); setOpen(true);
  };
  const close = () => { if (!busy) setOpen(false); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (text.trim().length < 8 || text.trim().length > 1200 || !agree || busy) { setMessage(L('invalid')); return; }
    if (isStaticHosting) { setMessage(L('unavailable')); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch(apiUrl('/api/insights/suggestions'), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ text, kind, language: currentLang, agree }),
        credentials: 'omit',
      });
      const data = await response.json().catch(() => ({})) as ApiReply;
      if (!response.ok || !data.accepted) {
        const errorText = data.code === 'SENSITIVE_CONTENT' ? L('sensitive')
          : data.code === 'PERSONAL_DATA' ? L('personal')
            : data.code === 'RATE_LIMITED' ? L('limited')
              : data.code === 'INVALID_SUGGESTION' ? L('invalid') : L('unavailable');
        setMessage(errorText); return;
      }
      setSuccess(true); setText(''); setAgree(false);
      setMessage(data.redacted ? L('redacted') : L('success'));
    } catch {
      setMessage(L('unavailable'));
    } finally { setBusy(false); }
  };

  return (
    <>
      <button type="button" onClick={show} className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-900/60 hover:text-white">
        <MessageSquarePlus className="h-3.5 w-3.5" />{L('open')}
      </button>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" dir={rtl ? 'rtl' : 'ltr'} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="visitor-suggestion-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-3 bg-stone-900 p-4 text-white">
              <div className="flex gap-2.5">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <div>
                  <h2 id="visitor-suggestion-title" className="font-bold">{L('title')}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-stone-300">{L('intro')}</p>
                </div>
              </div>
              <button type="button" onClick={close} disabled={busy} aria-label={L('close')} className="rounded-lg p-1.5 text-stone-300 hover:bg-white/10 disabled:opacity-50"><X className="h-4 w-4" /></button>
            </header>
            <form onSubmit={submit} className="space-y-3 p-4">
              <label className="block space-y-1 text-xs font-semibold text-stone-700">
                <span>{L('kind')}</span>
                <select value={kind} onChange={(event) => setKind(event.target.value as SuggestionKind)} disabled={success || busy} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="idea">{L('idea')}</option>
                  <option value="problem">{L('problem')}</option>
                  <option value="praise">{L('praise')}</option>
                </select>
              </label>
              <label className="block space-y-1 text-xs font-semibold text-stone-700">
                <span>{L('message')}</span>
                <textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 1200))} disabled={success || busy} rows={5} maxLength={1200} required className="w-full resize-y rounded-xl border border-stone-300 px-3 py-2 text-sm font-normal leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder={L('placeholder')} />
                <span className="block text-end text-[10px] font-normal text-stone-500">{text.length}/1200</span>
              </label>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-950">{L('privacy')}</p>
              <label className="flex items-start gap-2 text-xs leading-relaxed text-stone-700">
                <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} disabled={success || busy} className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-400" />
                <span>{L('agree')}</span>
              </label>
              {message && <p role="status" className={`rounded-xl p-2.5 text-xs leading-relaxed ${success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{success && <CheckCircle2 className="me-1 inline h-4 w-4 align-text-bottom" />}{message}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={close} disabled={busy} className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">{L('close')}</button>
                <button type="submit" disabled={busy || success || !agree || text.trim().length < 8} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{busy ? L('sending') : L('send')}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
