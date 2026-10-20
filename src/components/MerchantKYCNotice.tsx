import React from 'react';
import { ShieldCheck, AlertTriangle, FileText, Globe } from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';

export const MerchantKYCNotice: React.FC<{ currentLang?: SupportedLanguage; status?: string }> = ({ currentLang = 'ar', status = 'pending' }) => {
  // This notice currently has Arabic/English copy only; non-Arabic locales use the English fallback.
  const rtl = currentLang === 'ar';
  const isPending = status === 'pending';
  return (
    <div className={`p-4 rounded-2xl border flex gap-3 ${isPending ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`} dir={rtl ? 'rtl' : 'ltr'}>
      <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${isPending ? 'bg-amber-100' : 'bg-emerald-100'}`}>
        {isPending ? <AlertTriangle className="w-4 h-4 text-amber-700" /> : <ShieldCheck className="w-4 h-4 text-emerald-700" />}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <h4 className={`font-bold text-xs ${isPending ? 'text-amber-900' : 'text-emerald-900'}`}>
          {isPending ? (currentLang === 'ar' ? 'التحقق مطلوب قبل البيع — KYC/عقوبات' : 'Verification required before selling — KYC/Sanctions') : (currentLang === 'ar' ? 'تم التحقق ✓' : 'Verified ✓')}
        </h4>
        <p className="text-[11px] text-stone-600 leading-relaxed">
          {currentLang === 'ar'
            ? 'وفق OFAC/EU/SA AML: يجب رفع سجل تجاري + هوية، وفحص عقوبات، ومكالمة فيديو. منتجاتك تظهر لكن غير قابلة للطلب حتى الاعتماد (خلال 48 ساعة).'
            : 'Per OFAC/EU/SA AML: upload CR + ID, sanctions screening, video call. Your products appear but are not orderable until approved (48h).'}
        </p>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-stone-200 rounded-full"><FileText className="w-3 h-3" /> {currentLang === 'ar' ? 'السجل التجاري' : 'CR'}</span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-stone-200 rounded-full"><Globe className="w-3 h-3" /> OFAC/EU check</span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-stone-200 rounded-full">IBAN AES-256-GCM</span>
        </div>
      </div>
    </div>
  );
};
export default MerchantKYCNotice;
