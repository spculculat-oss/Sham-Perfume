import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LanguageConfig, TranslationKey } from '../types/i18n';
import { getInitialLanguage, saveLanguage, t as translateFn, TRANSLATIONS } from '../utils/i18n';

interface LanguageContextType {
  currentLang: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, fallback?: string) => string;
  dir: 'rtl' | 'ltr';
  isRTL: boolean;
  langConfig: LanguageConfig;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
  initialLang?: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage) => void;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
  initialLang,
  onLanguageChange,
}) => {
  const [currentLang, setCurrentLangState] = useState<SupportedLanguage>(() => {
    return initialLang || getInitialLanguage();
  });

  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0];
  const dir = langConfig.dir;
  const isRTL = dir === 'rtl';

  useEffect(() => {
    if (initialLang && initialLang !== currentLang) {
      setCurrentLangState(initialLang);
    }
  }, [initialLang]);

  useEffect(() => {
    saveLanguage(currentLang);
  }, [currentLang]);

  const setLanguage = (lang: SupportedLanguage) => {
    setCurrentLangState(lang);
    saveLanguage(lang);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
  };

  const t = (key: string, fallback?: string): string => {
    return translateFn(key as TranslationKey, currentLang, fallback);
  };

  return (
    <LanguageContext.Provider
      value={{
        currentLang,
        setLanguage,
        t,
        dir,
        isRTL,
        langConfig,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside provider
    const initial = getInitialLanguage();
    const config = SUPPORTED_LANGUAGES.find((l) => l.code === initial) || SUPPORTED_LANGUAGES[0];
    return {
      currentLang: initial,
      setLanguage: () => {},
      t: (key: string, fallback?: string) => translateFn(key as TranslationKey, initial, fallback),
      dir: config.dir,
      isRTL: config.dir === 'rtl',
      langConfig: config,
    };
  }
  return context;
};
