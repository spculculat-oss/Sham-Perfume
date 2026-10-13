import React, { useState } from 'react';
import {
  Compass,
  MapPin,
  Thermometer,
  Sparkles,
  Droplets,
  DollarSign,
  X,
  Check,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  FlaskConical,
} from 'lucide-react';
import {
  REGIONAL_ENVIRONMENTS,
  UserEnvironmentProfile,
  saveUserEnvironment,
} from '../utils/environmentAdapter';
import { PyramidNote } from '../types/perfume';
import { ExtractedAIPerfume } from '../utils/aiFormulaExtractor';

interface EnvironmentRegionalModalProps {
  currentProfile: UserEnvironmentProfile;
  onUpdateProfile: (newProfile: UserEnvironmentProfile) => void;
  onApplyRegionalFormulaToWorkbench: (formula: ExtractedAIPerfume) => void;
  onClose: () => void;
}

export const EnvironmentRegionalModal: React.FC<EnvironmentRegionalModalProps> = ({
  currentProfile,
  onUpdateProfile,
  onApplyRegionalFormulaToWorkbench,
  onClose,
}) => {
  const [selectedRegionId, setSelectedRegionId] = useState<string>(currentProfile.regionId);
  const activeProfile = REGIONAL_ENVIRONMENTS[selectedRegionId] || currentProfile;

  const handleSelectAndSave = (id: string) => {
    setSelectedRegionId(id);
    const updated = REGIONAL_ENVIRONMENTS[id] || currentProfile;
    saveUserEnvironment(updated);
    onUpdateProfile(updated);
  };

  const handleApplyRegionalFormula = () => {
    const rawNotes = activeProfile.traditionalNotes || [];
    const transformedNotes: PyramidNote[] = rawNotes.map((n: any, i: number) => ({
      id: `regional-note-${activeProfile.regionId}-${i}`,
      nameAr: n.nameAr,
      nameEn: n.nameEn,
      category: n.category,
      percentageOfOil: n.percentageOfOil,
      description: n.description,
    }));

    const formula: ExtractedAIPerfume = {
      title: `توليفة موطن: ${activeProfile.countryNameAr.split('(')[0].trim()}`,
      author: 'معمل صمم عطرك مع شام الإقليمي',
      bottleVolumeMl: 50,
      concentrationPercent: activeProfile.recommendedConcentrationPercent,
      concentrationType: activeProfile.recommendedConcentrationType,
      alcoholPercentage: 96,
      waterPercent: 0,
      fixativePercent: activeProfile.recommendedFixativePercent,
      macerationDays: activeProfile.climateType === 'hot_arid' ? 40 : 30,
      summary: `${activeProfile.climateAdviceAr} - مخصصة لبيئة ومناخ ${activeProfile.countryNameAr}.`,
      pyramidNotes: transformedNotes.length > 0 ? transformedNotes : [
        { id: 'tn-1', nameAr: 'برغموت منعش', nameEn: 'Bergamot', category: 'top', percentageOfOil: 20 },
        { id: 'hn-1', nameAr: 'ياسمين وزهور', nameEn: 'Jasmine', category: 'heart', percentageOfOil: 40 },
        { id: 'bn-1', nameAr: 'صندل وعنبر', nameEn: 'Sandalwood', category: 'base', percentageOfOil: 40 },
      ],
    };

    onApplyRegionalFormulaToWorkbench(formula);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 text-stone-900">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-amber-400 animate-spin" />
              <span>نظام التكيف البيئي والموطن الإقليمي</span>
            </span>
            <h3 className="text-xl sm:text-2xl font-bold font-serif-luxury">
              تخصيص تجربة الموقع وفق بيئتك وموطنك الجغرافي
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-full bg-stone-800 hover:bg-stone-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 sm:p-8 space-y-6 text-xs sm:text-sm">
          
          {/* Explanation Banner */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-stone-700 leading-relaxed text-xs flex items-start gap-3">
            <Thermometer className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900 block mb-0.5">
                لماذا يتكيف الموقع مع بيئتك وموطنك؟
              </span>
              تتأثر سرعة تبخر العطور وثباتها على الجلد بنسبة الرطوبة ودرجة حرارة الطقس. منصة «صمم عطرك مع شام» تضبط نسب التركيز المقترحة، كميات المثبتات (Fixatives)، وتوفر أكوردات العطور التراثية لكل منطقة وعملاتها المحلية بدقة.
            </div>
          </div>

          {/* Region Selector Grid */}
          <div>
            <label className="font-bold text-stone-900 block mb-3 text-xs uppercase tracking-wider">
              اختر موطنك أو البيئة المناخية المستهدفة:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(REGIONAL_ENVIRONMENTS).map((profile) => {
                const isSelected = profile.regionId === selectedRegionId;
                return (
                  <button
                    key={profile.regionId}
                    onClick={() => handleSelectAndSave(profile.regionId)}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-amber-700 bg-amber-50/70 shadow-sm ring-2 ring-amber-700/20'
                        : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-stone-900 text-xs">
                          {profile.countryNameAr.split('(')[0]}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-amber-600" />
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 line-clamp-1 mb-2">
                        {profile.climateLabelAr}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[10px] text-stone-600">
                      <span>التركيز الموصى: {profile.recommendedConcentrationPercent}%</span>
                      <span className="font-bold text-amber-800">{profile.currencySymbolAr}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Profile Details Card */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
              <div>
                <span className="text-[11px] text-stone-500 block">الموطن والبيئة الحالية:</span>
                <span className="text-base font-bold text-stone-950 font-serif-luxury">
                  {activeProfile.countryNameAr}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200">
                  {activeProfile.climateLabelAr}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-stone-200 text-stone-800 text-xs font-mono font-bold">
                  العملة: {activeProfile.currencyCode} ({activeProfile.currencySymbolAr})
                </span>
              </div>
            </div>

            {/* Scientific Advice */}
            <div className="space-y-1">
              <span className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>التوصية الكيميائية الخاصة بالمناخ:</span>
              </span>
              <p className="text-stone-600 text-xs leading-relaxed">
                {activeProfile.climateAdviceAr}
              </p>
            </div>

            {/* Traditional Accords */}
            <div className="space-y-2 pt-2">
              <span className="font-bold text-stone-900 text-xs block">
                الأكوردات والنوتات التراثية الأكثر أصالة في هذه البيئة:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(activeProfile.traditionalNotes || []).map((note: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-stone-900">{note.nameAr}</div>
                      <div className="text-[10px] text-stone-400">{note.description}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 font-mono-numbers text-xs font-bold shrink-0">
                      {note.percentageOfOil}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="pt-2">
              <button
                onClick={handleApplyRegionalFormula}
                className="w-full py-3 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <FlaskConical className="w-4 h-4 text-amber-300" />
                <span>تطبيق توليفة هذه البيئة التراثية مباشرة في حاسبة العطر والمعمل</span>
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">
            يتم حفظ إعدادات البيئة والموطن تلقائياً ومزامنتها مع حاسبة التكاليف والتركيب.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold cursor-pointer"
          >
            إغلاق وتطبيق
          </button>
        </div>

      </div>
    </div>
  );
};
