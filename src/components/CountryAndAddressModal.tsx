import React, { useState } from 'react';
import {
  MapPin,
  Search,
  Globe,
  Compass,
  Building,
  Phone,
  FileText,
  Copy,
  Check,
  CheckCircle2,
  X,
  Sparkles,
  Thermometer,
  Layers,
  FlaskConical,
  Save,
  Send,
  Download,
  Info,
  Coins,
  ArrowRightLeft,
  TrendingUp,
  DollarSign,
  Languages,
} from 'lucide-react';
import {
  WORLD_COUNTRIES,
  WorldCountryData,
  searchCountries,
  findCountryByCode,
} from '../data/worldCountries';
import {
  WORLD_CURRENCIES,
  WorldCurrency,
  findCurrencyByCode,
  convertCurrency,
} from '../data/worldCurrencies';
import { UserDetailedAddress, FACILITY_TYPE_LABELS } from '../types/address';
import {
  UserEnvironmentProfile,
  createEnvironmentProfileFromCountry,
  saveUserEnvironment,
  updateProfileCurrency,
} from '../utils/environmentAdapter';
import { saveDetailedAddress } from '../utils/addressStorage';
import { ExtractedAIPerfume } from '../utils/aiFormulaExtractor';
import { PyramidNote } from '../types/perfume';
import { UserProfile } from '../types/auth';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LanguageConfig } from '../types/i18n';

interface CountryAndAddressModalProps {
  currentProfile: UserEnvironmentProfile;
  currentAddress: UserDetailedAddress;
  currentUser: UserProfile | null;
  onUpdateProfile: (newProfile: UserEnvironmentProfile) => void;
  onUpdateAddress: (newAddress: UserDetailedAddress) => void;
  onApplyRegionalFormulaToWorkbench: (formula: ExtractedAIPerfume) => void;
  onClose: () => void;
  currentLang?: SupportedLanguage;
  onSelectLanguage?: (lang: SupportedLanguage) => void;
}

export const CountryAndAddressModal: React.FC<CountryAndAddressModalProps> = ({
  currentProfile,
  currentAddress,
  currentUser,
  onUpdateProfile,
  onUpdateAddress,
  onApplyRegionalFormulaToWorkbench,
  onClose,
  currentLang = 'ar',
  onSelectLanguage,
}) => {
  const [activeTab, setActiveTab] = useState<'country' | 'address' | 'currencies' | 'languages'>('country');
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<'all' | 'arab' | 'europe' | 'asia' | 'americas'>('all');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(
    currentProfile.countryCode || 'SA'
  );

  // Address form fields
  const [addressForm, setAddressForm] = useState<UserDetailedAddress>({ ...currentAddress });
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Currencies tab state
  const [currencySearch, setCurrencySearch] = useState('');
  const [currencyRegion, setCurrencyRegion] = useState<'all' | 'arab' | 'europe' | 'asia' | 'americas' | 'africa' | 'oceania'>('all');
  const [currencySavedMessage, setCurrencySavedMessage] = useState<string | null>(null);

  // Language tab state
  const [languageSearch, setLanguageSearch] = useState('');
  const [languageSavedMessage, setLanguageSavedMessage] = useState<string | null>(null);

  // Live Currency Converter state
  const [calcAmount, setCalcAmount] = useState<number>(100);
  const [calcFromCurrency, setCalcFromCurrency] = useState<string>(currentProfile.currencyCode || 'SAR');
  const [calcToCurrency, setCalcToCurrency] = useState<string>('USD');
  const selectedCountry = findCountryByCode(selectedCountryCode) || WORLD_COUNTRIES[0];
  const activeProfile = createEnvironmentProfileFromCountry(selectedCountry);

  // Close on Escape and lock body scroll
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

  // Filtered world currencies
  const filteredCurrencies = WORLD_CURRENCIES.filter((c) => {
    if (currencyRegion !== 'all' && c.region !== currencyRegion) return false;
    if (!currencySearch.trim()) return true;
    const q = currencySearch.toLowerCase().trim();
    return (
      c.code.toLowerCase().includes(q) ||
      c.nameAr.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q) ||
      c.symbolAr.toLowerCase().includes(q) ||
      c.symbolEn.toLowerCase().includes(q)
    );
  });

  // Filtered languages
  const filteredLanguages = SUPPORTED_LANGUAGES.filter((l) => {
    if (!languageSearch.trim()) return true;
    const q = languageSearch.toLowerCase().trim();
    return (
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  const handleSelectLanguage = (langCode: SupportedLanguage) => {
    if (onSelectLanguage) {
      onSelectLanguage(langCode);
      const conf = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
      setLanguageSavedMessage(`تم تغيير لغة المنصة فوراً إلى: ${conf?.flag} «${conf?.nativeName} (${conf?.name})» وتطبيق اتجاه (${conf?.dir.toUpperCase()})`);
      setTimeout(() => {
        setLanguageSavedMessage(null);
      }, 3500);
    }
  };

  const handleSelectLabCurrency = (curr: WorldCurrency) => {
    const updated = updateProfileCurrency(
      currentProfile,
      curr.code
    );
    onUpdateProfile(updated);
    setCalcFromCurrency(curr.code);
    setCurrencySavedMessage(`تم تعيين ${curr.flag} «${curr.nameAr} (${curr.code})» كعملة رسمية للمعمل بنجاح!`);
    setTimeout(() => {
      setCurrencySavedMessage(null);
    }, 3500);
  };

  // Filtered countries
  const filteredCountries = searchCountries(searchQuery).filter((c) => {
    if (regionFilter === 'all') return true;
    return c.regionCategory === regionFilter;
  });

  const handleSelectCountry = (country: WorldCountryData) => {
    setSelectedCountryCode(country.code);
    const newProfile = createEnvironmentProfileFromCountry(country);
    saveUserEnvironment(newProfile);
    onUpdateProfile(newProfile);

    // Sync country with address form
    const phone = addressForm.phoneNumber || addressForm.phone || '';
    const updatedAddress: UserDetailedAddress = {
      ...addressForm,
      countryCode: country.code,
      countryNameAr: country.nameAr,
      countryNameEn: country.nameEn,
      phoneNumber: phone.startsWith('+')
        ? phone
        : `${country.phoneCode} `,
    };
    setAddressForm(updatedAddress);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    saveDetailedAddress(addressForm);
    onUpdateAddress(addressForm);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleCopyFormattedAddress = () => {
    const formatted = `═══════════════════════════════════════════════════
بيانات مقر المعمل والعنوان التفصيلي · منصة صمم عطرك مع شام
═══════════════════════════════════════════════════
المنشأة العطرية: ${addressForm.labOrFacilityName || addressForm.facilityName || 'مختبر تركيب العطور'}
نوع المنشأة: ${FACILITY_TYPE_LABELS[addressForm.facilityType]?.ar || 'معمل تركيب'}
الدولة: ${selectedCountry.flag} ${addressForm.countryNameAr} (${addressForm.countryCode})
المدينة / المحافظة: ${addressForm.city || addressForm.cityName || 'غير محدد'}
الحي / المنطقة: ${addressForm.district || addressForm.districtName || 'غير محدد'}
الشارع / رقم المعمل: ${addressForm.street || addressForm.streetAddress || 'غير محدد'}
الرمز البريدي: ${addressForm.postalCode || 'غير محدد'}
هاتف التواصل: ${addressForm.phoneNumber || addressForm.phone || 'غير محدد'}
ملاحظات الشحن والتخزين: ${addressForm.additionalNotes || 'لا توجد'}
═══════════════════════════════════════════════════`;

    navigator.clipboard.writeText(formatted);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2500);
  };

  const handleApplyRegionalFormula = () => {
    const rawNotes = activeProfile.traditionalNotes || [];
    const transformedNotes: PyramidNote[] = rawNotes.map((n: any, i: number) => ({
      id: `regional-note-${activeProfile.countryCode}-${i}`,
      nameAr: n.nameAr,
      nameEn: n.nameEn,
      category: n.category,
      percentageOfOil: n.percentageOfOil,
      description: n.description,
    }));

    const formula: ExtractedAIPerfume = {
      title: `توليفة موطن: ${activeProfile.countryNameAr.split('(')[0].trim()}`,
      author: `معمل صمم عطرك مع شام · ${activeProfile.countryNameAr}`,
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
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 text-stone-900 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 text-xl font-bold shadow-inner">
              {selectedCountry.flag}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  <span>دليل دول العالم والعنوان التفصيلي</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 text-[10px] font-mono border border-stone-700">
                  {selectedCountry.code} · {selectedCountry.currencyCode}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-serif-luxury mt-0.5">
                تحديد بلد ومقر المعمل العطري والعنوان التفصيلي
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-stone-800 hover:bg-rose-700 text-stone-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-stone-700 shadow-sm"
            title="إغلاق النافذة (Escape)"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>إغلاق ✕</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-200 bg-stone-100/70 p-2 gap-2 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('country')}
            className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'country'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-bold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Globe className="w-4 h-4 text-amber-700" />
            <span>1. اختيار الدولة والمناخ العطري ({WORLD_COUNTRIES.length} دولة)</span>
          </button>
          <button
            onClick={() => setActiveTab('address')}
            className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'address'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-bold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Building className="w-4 h-4 text-amber-700" />
            <span>2. خانات العنوان ومقر المعمل</span>
            {addressForm.city && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('currencies')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'currencies'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-bold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-700" />
            <span>3. العملات ({WORLD_CURRENCIES.length})</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-mono font-bold">
              {currentProfile.currencyCode}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('languages')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'languages'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-bold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Languages className="w-4 h-4 text-amber-700" />
            <span>4. خانة تغيير اللغة ({SUPPORTED_LANGUAGES.length} لغات)</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 text-[10px] font-mono font-bold">
              {currentLang.toUpperCase()}
            </span>
          </button>
        </div>

        {/* Body Container (Scrollable) */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          
          {/* TAB 1: ALL COUNTRIES SELECTOR & CLIMATE ADVICE */}
          {activeTab === 'country' && (
            <div className="space-y-6">
              
              {/* Active Selected Country Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-stone-50 border border-amber-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <span className="text-4xl shadow-xs">{selectedCountry.flag}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-950 text-base sm:text-lg">
                        {selectedCountry.nameAr}
                      </span>
                      <span className="text-xs text-stone-500 font-mono">
                        ({selectedCountry.nameEn})
                      </span>
                    </div>
                    <div className="text-xs text-stone-600 mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                        <Thermometer className="w-3.5 h-3.5" />
                        <span>{selectedCountry.climateLabelAr}</span>
                      </span>
                      <span>•</span>
                      <span className="font-mono text-stone-700">
                        العملة: {selectedCountry.currencySymbolAr} ({selectedCountry.currencyCode})
                      </span>
                      <span>•</span>
                      <span className="font-mono text-stone-700">
                        مفتاح الاتصال: {selectedCountry.phoneCode}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={handleApplyRegionalFormula}
                    className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <FlaskConical className="w-4 h-4 text-amber-300" />
                    <span>تطبيق تركيبة {selectedCountry.nameAr.split('(')[0]} بالمعمل</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('address')}
                    className="px-3 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-stone-200"
                  >
                    <span>كتابة العنوان</span>
                  </button>
                </div>
              </div>

              {/* Fragrance Compounding Recommendations Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                  <span className="text-[11px] text-stone-500">التركيز الموصى به للمناخ</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-amber-900">
                      {selectedCountry.recommendedConcentrationPercent}%
                    </span>
                    <span className="text-xs font-semibold text-stone-700 uppercase">
                      ({selectedCountry.recommendedConcentrationType})
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1">
                    مضبوط لمنع التبخر أو الاختناق
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                  <span className="text-[11px] text-stone-500">نسبة المثبت الكيميائي</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-amber-900">
                      {selectedCountry.recommendedFixativePercent}%
                    </span>
                    <span className="text-xs font-semibold text-stone-700">Ambroxan/DPG</span>
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1">
                    يحافظ على ثبات الفوحان
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                  <span className="text-[11px] text-stone-500">دعم وزن التولة (Tola)</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-stone-900">
                      {selectedCountry.tolaSupport ? 'مفعل (11.66g)' : 'معايير الجرام الدولية'}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1">
                    {selectedCountry.tolaSupport ? 'معتمد في التراث العطري' : 'وفق مقاييس IFRA العالمية'}
                  </span>
                </div>
              </div>

              {/* Climate Advice Text */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-700 leading-relaxed flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-900">نصيحة الخبير شاهين لمناخ {selectedCountry.nameAr}: </span>
                  <span>{selectedCountry.climateAdviceAr}</span>
                </div>
              </div>

              {/* Search & Region Filter Bar */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث عن أي دولة بالاسم العربي أو الإنجليزي أو كود الدولة (SA, EG, FR, KW...)"
                      className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto text-[11px] no-scrollbar">
                    {[
                      { id: 'all', label: 'جميع الدول' },
                      { id: 'arab', label: 'الدول العربية' },
                      { id: 'europe', label: 'أوروبا' },
                      { id: 'asia', label: 'آسيا' },
                      { id: 'americas', label: 'الأمريكتان' },
                    ].map((pill) => (
                      <button
                        key={pill.id}
                        onClick={() => setRegionFilter(pill.id as any)}
                        className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                          regionFilter === pill.id
                            ? 'bg-stone-900 text-white font-bold'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Countries Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                  {filteredCountries.map((country) => {
                    const isSelected = country.code === selectedCountryCode;
                    return (
                      <button
                        key={country.code}
                        onClick={() => handleSelectCountry(country)}
                        className={`p-3 rounded-xl border text-right transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50/90 border-amber-800/70 shadow-xs ring-1 ring-amber-800/20'
                            : 'bg-white hover:bg-stone-50 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl shrink-0">{country.flag}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-stone-900 text-xs truncate">
                              {country.nameAr}
                            </div>
                            <div className="text-[10px] text-stone-500 font-mono truncate">
                              {country.nameEn} · {country.currencyCode}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-amber-800 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {filteredCountries.length === 0 && (
                    <div className="col-span-full py-8 text-center text-stone-500 text-xs">
                      لم يتم العثور على دولة مطابقة لبحثك "{searchQuery}".
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: DETAILED ADDRESS INQUIRY FIELDS */}
          {activeTab === 'address' && (
            <form onSubmit={handleSaveAddress} className="space-y-6">
              
              {/* Info Banner */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-stone-700 text-xs leading-relaxed flex items-start gap-3">
                <Building className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-900">بيانات العنوان ومقر المعمل: </span>
                  تُستخدم هذه الخانات لتحديد موقع معملك الرسمي، وتضمينها تلقائياً في بطاقات تصنيع العطور المطبوعة، بوالص الشحن، وإرسال العينات للعملاء أو المختبرات.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* 1. Country Selection */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    الدولة / البلد المعتمد
                  </label>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-stone-300 bg-stone-50 text-stone-900 text-xs">
                    <span className="text-xl">{selectedCountry.flag}</span>
                    <span className="font-bold">{selectedCountry.nameAr}</span>
                    <span className="text-stone-500 font-mono">({selectedCountry.code})</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('country')}
                      className="mr-auto text-[11px] text-amber-800 hover:underline font-semibold cursor-pointer"
                    >
                      تغيير الدولة
                    </button>
                  </div>
                </div>

                {/* 2. Facility Name */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    اسم المنشأة أو المعمل العطري
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.labOrFacilityName}
                    onChange={(e) => setAddressForm({ ...addressForm, labOrFacilityName: e.target.value })}
                    placeholder="مثال: مختبر عطور الشام، دار الفخامة..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                  />
                </div>

                {/* 3. Facility Type */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    نوع النشاط / المقر العطري
                  </label>
                  <select
                    value={addressForm.facilityType}
                    onChange={(e) => setAddressForm({ ...addressForm, facilityType: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 cursor-pointer"
                  >
                    {Object.entries(FACILITY_TYPE_LABELS).map(([key, val]) => (
                      <option key={key} value={key}>
                        {val.ar}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. City / Governorate / State */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    المدينة / المحافظة / الإمارة / الولاية
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder="مثال: الرياض، دبي، القاهرة، باريس..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                  />
                </div>

                {/* 5. District / Neighborhood */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    الحي / المنطقة
                  </label>
                  <input
                    type="text"
                    value={addressForm.district}
                    onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })}
                    placeholder="مثال: حي الياسمين، المعادي، وسط البلد..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                  />
                </div>

                {/* 6. Street Address & Building / Lab Number */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    اسم الشارع ورقم المبنى أو المعمل
                  </label>
                  <input
                    type="text"
                    value={addressForm.street}
                    onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                    placeholder="مثال: طريق الملك فهد - مبنى رقم 12 - الطابق الثاني"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                  />
                </div>

                {/* 7. Postal / ZIP Code */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    الرمز البريدي (Postal / ZIP Code)
                  </label>
                  <input
                    type="text"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    placeholder="مثال: 12345 أو 75001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800"
                  />
                </div>

                {/* 8. Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    رقم هاتف التواصل مع كود الدولة الدولي
                  </label>
                  <input
                    type="tel"
                    value={addressForm.phoneNumber}
                    onChange={(e) => setAddressForm({ ...addressForm, phoneNumber: e.target.value })}
                    placeholder={`${selectedCountry.phoneCode} 5XXXXXXXX`}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 ltr:text-left text-left font-mono"
                  />
                </div>

                {/* 9. Additional Notes (Full width) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    ملاحظات الشحن والتخزين المبرد للعينات والزيوت
                  </label>
                  <textarea
                    rows={2}
                    value={addressForm.additionalNotes}
                    onChange={(e) => setAddressForm({ ...addressForm, additionalNotes: e.target.value })}
                    placeholder="تعليمات خاصة للاستلام، شحن الكحول، درجات الحرارة المطلوبة لحفظ الزيوت العطرية..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 resize-none"
                  />
                </div>

              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ وتحديث العنوان التفصيلي</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyFormattedAddress}
                    className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs flex items-center gap-1.5 border border-stone-200 transition-all cursor-pointer"
                  >
                    {copiedAddress ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">تم نسخ العنوان!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-stone-500" />
                        <span>نسخ العنوان للشحن</span>
                      </>
                    )}
                  </button>
                </div>

                {savedSuccess && (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم حفظ العنوان وتحديث بيانات المعمل بنجاح!</span>
                  </span>
                )}
              </div>

            </form>
          )}

          {/* TAB 3: ALL WORLD CURRENCIES & LIVE CONVERTER */}
          {activeTab === 'currencies' && (
            <div className="space-y-6 animate-in fade-in">
              
              {/* Active Lab Currency Highlight Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-50 to-stone-50 border border-amber-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-2xl font-bold shadow-md">
                    {findCurrencyByCode(currentProfile.currencyCode).flag}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-base sm:text-lg">
                        {findCurrencyByCode(currentProfile.currencyCode).nameAr}
                      </span>
                      <span className="text-xs text-amber-900 font-mono font-bold bg-amber-200/80 px-2 py-0.5 rounded-md">
                        {currentProfile.currencyCode} · {currentProfile.currencySymbolAr}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5">
                      العملة الرسمية المعتمدة حالياً لحساب التكاليف والأرباح وتسعير زجاجات العطر في المعمل.
                    </p>
                  </div>
                </div>

                <div className="text-left md:text-right text-xs text-stone-500 font-mono">
                  <span>سعر الصرف المرجعي:</span>
                  <div className="font-bold text-stone-800 text-sm">
                    1 USD ≈ {findCurrencyByCode(currentProfile.currencyCode).rateToUSD} {currentProfile.currencyCode}
                  </div>
                </div>
              </div>

              {currencySavedMessage && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{currencySavedMessage}</span>
                </div>
              )}

              {/* Live Interactive Currency Converter */}
              <div className="p-5 rounded-2xl bg-stone-900 text-white border border-stone-800 shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                    <span>محول ومطابق العملات العالمية اللحظي</span>
                  </div>
                  <span className="text-[11px] text-stone-400 font-mono">
                    أسعار مرجعية محدثة لجميع العملات
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  {/* Amount Input */}
                  <div className="md:col-span-3">
                    <label className="text-[11px] text-stone-400 block mb-1">المبلغ:</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={calcAmount}
                      onChange={(e) => setCalcAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* From Currency */}
                  <div className="md:col-span-4">
                    <label className="text-[11px] text-stone-400 block mb-1">من عملة:</label>
                    <select
                      value={calcFromCurrency}
                      onChange={(e) => setCalcFromCurrency(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-xs font-semibold text-stone-200 focus:outline-none focus:border-amber-400"
                    >
                      {WORLD_CURRENCIES.map((c) => (
                        <option key={`from-${c.code}`} value={c.code}>
                          {c.flag} {c.code} - {c.nameAr} ({c.symbolAr})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Swap Button */}
                  <div className="md:col-span-1 flex justify-center pt-4 md:pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        const temp = calcFromCurrency;
                        setCalcFromCurrency(calcToCurrency);
                        setCalcToCurrency(temp);
                      }}
                      className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 border border-stone-700 transition-colors cursor-pointer"
                      title="تبديل اتجاه التحويل"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                  </div>

                  {/* To Currency */}
                  <div className="md:col-span-4">
                    <label className="text-[11px] text-stone-400 block mb-1">إلى عملة:</label>
                    <select
                      value={calcToCurrency}
                      onChange={(e) => setCalcToCurrency(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-xs font-semibold text-stone-200 focus:outline-none focus:border-amber-400"
                    >
                      {WORLD_CURRENCIES.map((c) => (
                        <option key={`to-${c.code}`} value={c.code}>
                          {c.flag} {c.code} - {c.nameAr} ({c.symbolAr})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Conversion Result Display */}
                <div className="p-3.5 bg-stone-850 rounded-xl border border-stone-750 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-stone-400">النتيجة:</span>
                    <span className="font-mono font-extrabold text-base sm:text-lg text-amber-400">
                      {calcAmount.toLocaleString()} {findCurrencyByCode(calcFromCurrency).symbolAr} ={' '}
                      {convertCurrency(calcAmount, calcFromCurrency, calcToCurrency).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{' '}
                      {findCurrencyByCode(calcToCurrency).symbolAr} ({calcToCurrency})
                    </span>
                  </div>

                  <div className="text-[11px] text-stone-400 font-mono">
                    1 {calcFromCurrency} ≈{' '}
                    {convertCurrency(1, calcFromCurrency, calcToCurrency).toFixed(4)} {calcToCurrency}
                  </div>
                </div>
              </div>

              {/* Search & Category Filter */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  
                  {/* Search Bar */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="ابحث عن أي عملة بكود الأيزو (USD, SAR, EUR, EGP) أو الاسم (ريال، درهم، دولار، دينار)..."
                      value={currencySearch}
                      onChange={(e) => setCurrencySearch(e.target.value)}
                      className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-amber-700 focus:bg-white transition-colors"
                    />
                  </div>

                  <span className="text-xs text-stone-500 font-medium shrink-0 self-center">
                    {filteredCurrencies.length} عملة عالمية متاحة
                  </span>
                </div>

                {/* Region Filter Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  {[
                    { id: 'all', label: 'كافة العملات' },
                    { id: 'arab', label: 'الدول العربية' },
                    { id: 'europe', label: 'أوروبا' },
                    { id: 'asia', label: 'آسيا والشرق الأوسط' },
                    { id: 'americas', label: 'الأمريكتان' },
                    { id: 'africa', label: 'إفريقيا' },
                    { id: 'oceania', label: 'أوقيانوسيا' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCurrencyRegion(cat.id as any)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        currencyRegion === cat.id
                          ? 'bg-amber-800 text-white shadow-xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of All World Currencies */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {filteredCurrencies.map((curr) => {
                  const isActive = currentProfile.currencyCode === curr.code;

                  return (
                    <div
                      key={curr.code}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                        isActive
                          ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/30 shadow-xs'
                          : 'bg-white border-stone-200/90 hover:border-stone-300 hover:bg-stone-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{curr.flag}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-stone-900 text-xs">
                                {curr.nameAr}
                              </span>
                              <span className="font-mono text-[10px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.2 rounded">
                                {curr.code}
                              </span>
                            </div>
                            <span className="text-[10px] text-stone-500 font-mono">
                              {curr.nameEn} · {curr.symbolAr}
                            </span>
                          </div>
                        </div>

                        {curr.popular && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-bold">
                            شائعة
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[10px]">
                        <span className="text-stone-500 font-mono">
                          1 USD ≈ {curr.rateToUSD} {curr.code}
                        </span>

                        {isActive ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>مفعلة بالمعمل</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectLabCurrency(curr)}
                            className="px-2.5 py-1 rounded-md bg-stone-900 hover:bg-amber-700 text-white font-semibold transition-colors cursor-pointer"
                          >
                            تعيين كعملة المعمل
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* TAB 4: PLATFORM LANGUAGES SELECTOR (10 LANGUAGES) */}
          {activeTab === 'languages' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white p-5 rounded-2xl shadow-sm border border-amber-900/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/40 text-xl shrink-0">
                      <Languages className="w-6 h-6 text-amber-300" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <span>خانة تغيير واختيار لغة المنصة</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                          10 لغات عالمية
                        </span>
                      </h4>
                      <p className="text-xs text-stone-300 mt-1 max-w-xl">
                        اختر اللغة المفضلة للعمل بها داخل المعمل؛ يتم فوراً ضبط اتجاه الواجهة (RTL ⇄ LTR) وترجمة كافة المصطلحات المعملية، مع حفظ التفضيل تلقائياً في متصفحك.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-stone-850/80 p-2.5 rounded-xl border border-stone-700/60 shrink-0">
                    <span className="text-2xl leading-none">
                      {SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.flag || '🇸🇦'}
                    </span>
                    <div className="text-right">
                      <div className="text-[10px] text-stone-400">اللغة الحالية المفعلة:</div>
                      <div className="font-bold text-xs text-amber-300">
                        {SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.nativeName} ({currentLang.toUpperCase()})
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notification Banner */}
              {languageSavedMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{languageSavedMessage}</span>
                </div>
              )}

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="ابحث عن لغة (مثال: العربية, English, Français, Deutsch, 中文)..."
                    value={languageSearch}
                    onChange={(e) => setLanguageSearch(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="text-xs text-stone-500 font-medium px-2">
                  عرض {filteredLanguages.length} من أصل {SUPPORTED_LANGUAGES.length} لغة عالمية
                </div>
              </div>

              {/* Languages Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredLanguages.map((lang: LanguageConfig) => {
                  const isActive = lang.code === currentLang;
                  return (
                    <div
                      key={lang.code}
                      onClick={() => handleSelectLanguage(lang.code)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                        isActive
                          ? 'bg-amber-50/80 border-amber-400 shadow-sm ring-2 ring-amber-300/40'
                          : 'bg-white hover:bg-stone-50 border-stone-200 hover:border-amber-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl group-hover:scale-110 transition-transform">
                              {lang.flag}
                            </span>
                            <div>
                              <div className="font-bold text-sm text-stone-900 group-hover:text-amber-900 transition-colors">
                                {lang.nativeName}
                              </div>
                              <div className="text-xs text-stone-500">
                                {lang.name} · <span className="font-mono font-bold uppercase">{lang.code}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                                lang.dir === 'rtl'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {lang.dir === 'rtl' ? 'RTL (يمين)' : 'LTR (يسار)'}
                            </span>
                          </div>
                        </div>

                        {/* Sample preview text */}
                        <div className="mt-2.5 p-2 rounded-lg bg-stone-100/70 border border-stone-200/60 text-[11px] text-stone-600 font-serif-luxury truncate">
                          {lang.code === 'ar' && '«صمم عطرك مع شام: الدقة الكيميائية والإبداع الفني العالمي»'}
                          {lang.code === 'en' && '“Design Perfume with Sham: Chemical Precision & Haute Artistry”'}
                          {lang.code === 'fr' && '«Créez Votre Parfum avec Sham : Précision Chimique et Haute Parfumerie»'}
                          {lang.code === 'es' && '«Diseña tu Perfume con Sham: Precisión Química y Arte Olfativo»'}
                          {lang.code === 'it' && '«Disegna il tuo Profumo con Sham: Precisione Chimica e Bellezza»'}
                          {lang.code === 'de' && '«Parfüm Kreieren mit Sham: Chemische Präzision & Duftkunst»'}
                          {lang.code === 'ru' && '«Создай свой парфюм с Шам: Точность и парфюмерное искусство»'}
                          {lang.code === 'zh' && '“与Sham一起设计香水：化学精密与高定时香水艺术”'}
                          {lang.code === 'tr' && '«Sham ile Parfümünü Tasarla: Kimyasal Hassasiyet ve Koku Sanatı»'}
                          {lang.code === 'fa' && '«عطر خود را با شام طراحی کنید: دقت شیمیایی و هنر عطرسازی»'}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-stone-150 text-xs">
                        <span className="text-[11px] text-stone-500">
                          {isActive ? 'اللغة النشطة حالياً للمنصة' : 'انقر للتبديل الفوري'}
                        </span>

                        {isActive ? (
                          <span className="text-amber-900 font-bold flex items-center gap-1.5 bg-amber-200/80 px-2.5 py-1 rounded-lg">
                            <Check className="w-3.5 h-3.5 text-amber-900 stroke-[3]" />
                            <span>مفعلة</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectLanguage(lang.code);
                            }}
                            className="px-3 py-1 rounded-lg bg-stone-900 hover:bg-amber-800 text-white font-semibold transition-colors cursor-pointer text-xs"
                          >
                            تفعيل هذه اللغة
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-stone-100 p-4 sm:p-5 border-t border-stone-200 flex items-center justify-between shrink-0 text-xs">
          <div className="text-stone-500 text-[11px] flex items-center gap-2">
            <span>البلد النشط: {selectedCountry.flag} {selectedCountry.nameAr}</span>
            <span>•</span>
            <span>العملة: {selectedCountry.currencyCode}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
