import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown, Search, Sparkles, Languages, MapPin } from 'lucide-react';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LanguageConfig } from '../types/i18n';
import { getCommonLabel, isRTL } from '../utils/localizedContent';

interface LanguageSelectorProps {
  currentLang: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  onAutoDetectLanguage?: () => void;
  compactMobile?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  onSelectLanguage,
  onAutoDetectLanguage,
  compactMobile = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeConfig =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0];
  const rtl = isRTL(currentLang);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Filter languages based on search query
  const filteredLanguages = SUPPORTED_LANGUAGES.filter((lang) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      lang.name.toLowerCase().includes(query) ||
      lang.nativeName.toLowerCase().includes(query) ||
      lang.code.toLowerCase().includes(query)
    );
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button - Clearly labeled */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-xs select-none ${
          isOpen
            ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-300/40 text-stone-900'
            : 'bg-white hover:bg-stone-50 border-stone-200 hover:border-amber-300 text-stone-800'
        } ${compactMobile ? 'text-[11px] py-1 px-2' : 'text-xs'}`}
        title="خانة تغيير لغة المنصة / Change Platform Language"
        aria-label="خانة تغيير اللغة"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-amber-100/80 text-amber-900 flex items-center justify-center shrink-0">
            <Globe className="w-3.5 h-3.5 text-amber-800" />
          </div>
          
          <span className="font-extrabold text-[11px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 hidden md:inline">
            {currentLang === 'ar' ? 'اللغة' : currentLang.toUpperCase()}
          </span>

          <span className="text-sm leading-none" role="img" aria-label={activeConfig.name}>
            {activeConfig.flag}
          </span>

          <span className="font-bold text-stone-900 truncate max-w-[85px] sm:max-w-[100px]">
            {activeConfig.nativeName}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-amber-700' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`absolute top-full mt-2 ${rtl ? 'right-0' : 'left-0'} z-50 w-72 sm:w-84 rounded-2xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-xs text-stone-800`}>
          
          {/* Dropdown Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-stone-900 to-amber-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                <Languages className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm text-amber-200">
                  {currentLang === 'ar' ? 'خانة تغيير لغة المنصة' : 'Change Platform Language'}
                </div>
                <div className="text-[10px] text-stone-300">
                  {currentLang === 'ar' ? 'اختر لغتك المفضلة (10 لغات عالمية)' : 'Select language (10 world languages)'}
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-mono font-bold">
              {activeConfig.code.toUpperCase()} · {activeConfig.dir.toUpperCase()}
            </span>
          </div>

          {/* Location-based auto-detection button */}
          {onAutoDetectLanguage && (
            <div className="p-2 border-b border-amber-100 bg-amber-50/80">
              <button
                onClick={() => {
                  onAutoDetectLanguage();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 animate-bounce" />
                <span>{getCommonLabel('auto_detect_location', currentLang)}</span>
              </button>
            </div>
          )}

          {/* Quick Search Field */}
          <div className="p-2.5 border-b border-stone-100 bg-stone-50/70">
            <div className="relative">
              <Search className={`w-3.5 h-3.5 text-stone-400 absolute ${rtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 pointer-events-none`} />
              <input
                type="text"
                placeholder={getCommonLabel('search', currentLang) + ' (العربية, English, Français)...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full ${rtl ? 'pr-8 pl-3 text-right' : 'pl-8 pr-3 text-left'} py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500 transition-all`}
                autoFocus
              />
            </div>
          </div>

          {/* Languages List */}
          <div className="max-h-72 overflow-y-auto py-1.5 divide-y divide-stone-100/60">
            {filteredLanguages.length === 0 ? (
              <div className="py-6 text-center text-stone-400 text-xs">
                {currentLang === 'ar' ? 'لم يتم العثور على لغة مطابقة للبحث' : 'No matching languages found'}
              </div>
            ) : (
              filteredLanguages.map((lang: LanguageConfig) => {
                const isSelected = lang.code === currentLang;
                return (
                  <button
                    key={lang.code}
                    onClick={() => {
                      onSelectLanguage(lang.code);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between transition-all cursor-pointer ${rtl ? 'text-right' : 'text-left'} group ${
                      isSelected
                        ? 'bg-amber-50/90 text-amber-950 font-bold'
                        : 'hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">
                        {lang.flag}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 group-hover:text-amber-850">
                            {lang.nativeName}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono font-medium">
                            ({lang.name})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                              lang.dir === 'rtl'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                            }`}
                          >
                            {lang.dir === 'rtl' ? getCommonLabel('direction_rtl', currentLang) : getCommonLabel('direction_ltr', currentLang)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950 text-[10px] font-bold">
                        <Check className="w-3.5 h-3.5 text-amber-900 stroke-[3]" />
                        <span>{currentLang === 'ar' ? 'مفعلة' : 'Active'}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {currentLang === 'ar' ? 'اختيار' : 'Select'}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Dropdown Footer Tip */}
          <div className="px-3.5 py-2 border-t border-stone-100 bg-stone-50 text-[10px] text-stone-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-700" />
              <span>{currentLang === 'ar' ? 'يتم حفظ اللغة تلقائياً في المتصفح' : 'Language preference saved automatically'}</span>
            </span>
            <span className="font-mono text-stone-400">10 {currentLang === 'ar' ? 'لغات' : 'Langs'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
