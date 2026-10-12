import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Download,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  EyeOff,
  Database,
} from 'lucide-react';
import { UserProfile } from '../types/auth';
import { exportAllUserData, wipeAllUserData } from '../utils/authStorage';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../utils/localizedContent';

interface DataPrivacyModalProps {
  currentLang?: SupportedLanguage;
  currentUser: UserProfile | null;
  onUserDataWiped: () => void;
  onClose: () => void;
}

export const DataPrivacyModal: React.FC<DataPrivacyModalProps> = ({
  currentLang = 'ar',
  currentUser,
  onUserDataWiped,
  onClose,
}) => {
  const rtl = isRTL(currentLang);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = () => {
    if (currentUser) {
      exportAllUserData(currentUser);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    }
  };

  const handleWipe = () => {
    wipeAllUserData();
    onUserDataWiped();
    onClose();
  };

  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-serif-luxury">
                ميثاق حماية وخصوصية بيانات المستخدم (GDPR Compliance)
              </h3>
              <p className="text-xs text-stone-300">
                أمان وسرية خلطاتك العطرية وسجلاتك الرقمية على منصة «صمم عطرك مع شام»
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6 text-xs sm:text-sm text-stone-700 leading-relaxed">
          
          {/* Highlights 4 Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="font-bold text-stone-900 flex items-center gap-2 text-xs">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>1. التشفير المحلي للخلطات والأسرار</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-normal">
                جميع وصفاتك، أكورداتك العطرية، ومحادثات المعمل مع الخبير شاهين تخزن بتشفير آمن على متصفحك ولا تُشارك مع أي طرف إعلاني.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="font-bold text-stone-900 flex items-center gap-2 text-xs">
                <EyeOff className="w-4 h-4 text-emerald-700" />
                <span>2. سياسة عدم التتبع (Zero Trackers)</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-normal">
                الموقع لا يحتوي على أي ملفات تعريف ارتباط (Cookies) تجسسية أو بكسلات تتبع خارجية. خصوصيتك الفنية مضمونة 100%.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="font-bold text-stone-900 flex items-center gap-2 text-xs">
                <Download className="w-4 h-4 text-blue-700" />
                <span>3. حق نقل البيانات (Data Portability)</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-normal">
                يحق لك في أي لحظة تنزيل نسخة رقمية كاملة من جميع وصفاتك المحفوظة ومحادثاتك بصيغة ملف JSON معتمد.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="font-bold text-stone-900 flex items-center gap-2 text-xs">
                <Trash2 className="w-4 h-4 text-red-700" />
                <span>4. حق النسيان والمسح النهائي</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-normal">
                بضغطة زر واحدة يمكنك إتلاف ومسح كافة بياناتك وسجلاتك وخلطاتك نهائياً دون إبقاء أي نسخة في السجلات.
              </p>
            </div>
          </div>

          {/* User Actions */}
          <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-4">
            <div className="font-bold text-amber-900 text-xs">
              لوحة التحكم ببيانات المستخدم الحالية:
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div>
                <div className="font-semibold text-stone-900 text-xs">
                  تصدير وحفظ نسخة احتياطية من الخلطات والملف الشخصي
                </div>
                <div className="text-[11px] text-stone-500">
                  تنزيل ملف JSON يحتوي على سجل التشغيلات، نسب الهرم، ومحادثات المعمل
                </div>
              </div>

              <button
                onClick={handleExport}
                className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer"
              >
                {exportSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>تم التصدير بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>تصدير بياناتي (JSON)</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-3 border-t border-amber-200/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-red-900 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>المسح النهائي لكافة البيانات (Right to be Forgotten)</span>
                </div>
                <div className="text-[11px] text-stone-500">
                  حذف كافة الخلطات وسجل الدخول والمحادثات نهائياً من هذا الجهاز
                </div>
              </div>

              {confirmWipe ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmWipe(false)}
                    className="px-3 py-2 rounded-xl bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer"
                  >
                    تراجع
                  </button>
                  <button
                    onClick={handleWipe}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    تأكيد المسح الشامل
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmWipe(true)}
                  className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold transition-all shrink-0 cursor-pointer"
                >
                  مسح جميع بياناتي
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">
            تتوافق معايير الأمان مع اللائحة العامة لحماية البيانات (GDPR Art. 17 & 20).
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
