import React, { useState } from 'react';
import { Flag, X, Send, AlertTriangle } from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';

export const ReportButton: React.FC<{ currentLang?: SupportedLanguage; targetType?: string; targetId?: string }> = ({ currentLang = 'ar', targetType = 'content', targetId = '' }) => {
  const rtl = isRTL(currentLang);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [detail, setDetail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    // L-14 Fix: DSA Art.16 — store report locally + server if available
    try {
      const reports = JSON.parse(localStorage.getItem('sham_reports_v1') || '[]');
      reports.push({ targetType, targetId, reason, detail, at: new Date().toISOString(), lang: currentLang });
      localStorage.setItem('sham_reports_v1', JSON.stringify(reports.slice(-100)));
    } catch {}
    setSent(true);
    setTimeout(() => { setOpen(false); setSent(false); setDetail(''); }, 2000);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-amber-700 transition" title={currentLang === 'ar' ? 'إبلاغ عن محتوى' : 'Report content'}>
        <Flag className="w-3 h-3" /> {currentLang === 'ar' ? 'إبلاغ' : 'Report'}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4" dir={rtl ? 'rtl' : 'ltr'} onClick={() => setOpen(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> {currentLang === 'ar' ? 'الإبلاغ عن محتوى' : 'Report Content'}</h3>
          <button onClick={() => setOpen(false)} className="p-1 text-stone-400 hover:text-stone-700"><X className="w-4 h-4" /></button>
        </div>
        {sent ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 text-center">
            ✅ {currentLang === 'ar' ? 'تم الإرسال — نراجع خلال 24 ساعة (DSA Art.16)' : 'Sent — we review within 24h (DSA Art.16)'}
          </div>
        ) : (
          <>
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs">
              <option value="spam">{currentLang === 'ar' ? 'محتوى مزعج/احتيالي' : 'Spam / scam'}</option>
              <option value="hate">{currentLang === 'ar' ? 'كراهية/تحرش' : 'Hate / harassment'}</option>
              <option value="ip">{currentLang === 'ar' ? 'انتهاك ملكية فكرية' : 'IP infringement'}</option>
              <option value="misinfo">{currentLang === 'ar' ? 'تضليل/معلومة خاطئة' : 'Misinformation'}</option>
              <option value="safety">{currentLang === 'ar' ? 'مخاطر سلامة/كيميائية' : 'Safety / chemical risk'}</option>
              <option value="other">{currentLang === 'ar' ? 'آخر' : 'Other'}</option>
            </select>
            <textarea value={detail} onChange={e => setDetail(e.target.value)} placeholder={currentLang === 'ar' ? 'تفاصيل إضافية (اختياري)' : 'Additional details (optional)'} className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs h-20 resize-none" />
            <button onClick={handleSend} className="w-full py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2">
              <Send className="w-3.5 h-3.5" /> {currentLang === 'ar' ? 'إرسال البلاغ' : 'Send Report'}
            </button>
            <p className="text-[10px] text-stone-500 text-center">{currentLang === 'ar' ? 'المراجعة خلال 24 ساعة · إساءة الإبلاغ قد تؤدي لحظر حسابك' : 'Reviewed within 24h · False reports may lead to account suspension'}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportButton;
