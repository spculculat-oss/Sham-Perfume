import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { HomeHub } from './components/HomeHub';
import { ConcentrationCalculator } from './components/ConcentrationCalculator';
import { PyramidCalculator } from './components/PyramidCalculator';
import { AlcoholDilutionCalculator } from './components/AlcoholDilutionCalculator';
import { CostCalculator } from './components/CostCalculator';
import { FormulaLibrary } from './components/FormulaLibrary';
import { WorldPerfumesLibrary } from './components/WorldPerfumesLibrary';
import { RawMaterialsEncyclopedia } from './components/RawMaterialsEncyclopedia';
import { AgingAndFixativesGuide } from './components/AgingAndFixativesGuide';
import { ManufacturingSpecSheet } from './components/ManufacturingSpecSheet';
import { PerfumerAIChatbot } from './components/PerfumerAIChatbot';
import { PerfumerMasterLabView } from './components/PerfumerMasterLabView';
import { WorldPerfumeNews } from './components/WorldPerfumeNews';
import { Footer } from './components/Footer';
import { NavigationBreadcrumbs } from './components/NavigationBreadcrumbs';
import { CountryAndAddressModal } from './components/CountryAndAddressModal';
import { AuthModal } from './components/AuthModal';
import { DataPrivacyModal } from './components/DataPrivacyModal';
import {
  FormulationState,
  PyramidNote,
  SavedFormula,
} from './types/perfume';
import { UserDetailedAddress } from './types/address';
import {
  CURATED_FORMULA_PRESETS,
} from './data/presets';
import { WorldPerfumeRecipe } from './data/worldPerfumes';
import { calculatePerfumeFormulation } from './utils/calculations';
import { ExtractedAIPerfume } from './utils/aiFormulaExtractor';
import { SupportedLanguage, SUPPORTED_LANGUAGES } from './types/i18n';
import { getInitialLanguage, saveLanguage } from './utils/i18n';
import { LanguageProvider } from './context/LanguageContext';
import {
  UserEnvironmentProfile,
  getInitialUserEnvironment,
} from './utils/environmentAdapter';
import { loadDetailedAddress } from './utils/addressStorage';
import {
  detectUserCountryAndLanguage,
  detectUserLocationAsync,
  forceRedetectLocation,
  USER_LANGUAGE_MANUAL_OVERRIDE_KEY,
  saveUserCountryCode,
} from './utils/geoDetector';
import { UserProfile } from './types/auth';
import { getCurrentUserSession, logoutUser } from './utils/authStorage';
import { Check, X, BookmarkPlus } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'miyaar_perfume_saved_formulas';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      return hash || 'home';
    } catch {
      return 'home';
    }
  });
  const [historyStack, setHistoryStack] = useState<string[]>(['home']);

  // Modals & toast state
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setIsEnvironmentModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Synchronous modal tracker ref for browser popstate
  const activeModalsRef = React.useRef({
    spec: false,
    save: false,
    auth: false,
    env: false,
    privacy: false,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const closeAllModalsDirectly = () => {
    activeModalsRef.current = { spec: false, save: false, auth: false, env: false, privacy: false };
    setIsSpecModalOpen(false);
    setIsSaveModalOpen(false);
    setIsAuthModalOpen(false);
    setIsEnvironmentModalOpen(false);
    setIsPrivacyModalOpen(false);
  };

  const handleOpenSpecModal = () => {
    activeModalsRef.current.spec = true;
    setIsSpecModalOpen(true);
    try {
      window.history.pushState({ tab: activeTab, modal: 'spec' }, '', window.location.hash || `#${activeTab}`);
    } catch {}
  };

  const handleCloseSpecModal = () => {
    activeModalsRef.current.spec = false;
    setIsSpecModalOpen(false);
    if (window.history.state?.modal === 'spec') {
      window.history.back();
    }
  };

  const handleOpenSaveModal = () => {
    activeModalsRef.current.save = true;
    setIsSaveModalOpen(true);
    try {
      window.history.pushState({ tab: activeTab, modal: 'save' }, '', window.location.hash || `#${activeTab}`);
    } catch {}
  };

  const handleCloseSaveModal = () => {
    activeModalsRef.current.save = false;
    setIsSaveModalOpen(false);
    if (window.history.state?.modal === 'save') {
      window.history.back();
    }
  };

  const handleOpenAuthModal = () => {
    activeModalsRef.current.auth = true;
    setIsAuthModalOpen(true);
    try {
      window.history.pushState({ tab: activeTab, modal: 'auth' }, '', window.location.hash || `#${activeTab}`);
    } catch {}
  };

  const handleCloseAuthModal = () => {
    activeModalsRef.current.auth = false;
    setIsAuthModalOpen(false);
    if (window.history.state?.modal === 'auth') {
      window.history.back();
    }
  };

  const handleOpenEnvironmentModal = () => {
    activeModalsRef.current.env = true;
    setIsEnvironmentModalOpen(true);
    try {
      window.history.pushState({ tab: activeTab, modal: 'env' }, '', window.location.hash || `#${activeTab}`);
    } catch {}
  };

  const handleCloseEnvironmentModal = () => {
    activeModalsRef.current.env = false;
    setIsEnvironmentModalOpen(false);
    if (window.history.state?.modal === 'env') {
      window.history.back();
    }
  };

  const handleOpenPrivacyModal = () => {
    activeModalsRef.current.privacy = true;
    setIsPrivacyModalOpen(true);
    try {
      window.history.pushState({ tab: activeTab, modal: 'privacy' }, '', window.location.hash || `#${activeTab}`);
    } catch {}
  };

  const handleClosePrivacyModal = () => {
    activeModalsRef.current.privacy = false;
    setIsPrivacyModalOpen(false);
    if (window.history.state?.modal === 'privacy') {
      window.history.back();
    }
  };

  const navigateToTab = (tab: string, pushHistory = true) => {
    if (tab === activeTab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    closeAllModalsDirectly();

    if (pushHistory) {
      setHistoryStack((prev) => [...prev, tab]);
      try {
        window.history.pushState({ tab, isAppNav: true }, '', `#${tab}`);
      } catch (e) {
        window.location.hash = `#${tab}`;
      }
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoBack = () => {
    const hasOpenModal =
      activeModalsRef.current.spec ||
      activeModalsRef.current.save ||
      activeModalsRef.current.auth ||
      activeModalsRef.current.env ||
      activeModalsRef.current.privacy;

    if (hasOpenModal) {
      closeAllModalsDirectly();
      if (window.history.state?.modal) {
        window.history.back();
      }
      return;
    }

    if (window.history.length > 1 && historyStack.length > 1) {
      window.history.back();
    } else {
      navigateToTab('home');
    }
  };

  // Exit guard ref to prevent accidental tab closing when clicking back on Home
  const lastExitAttemptRef = React.useRef<number>(0);

  // Sync with browser popstate (back/forward button)
  useEffect(() => {
    const initialHash = window.location.hash.replace('#', '') || 'home';

    // Ensure initial entry has registered history state
    try {
      if (!window.history.state || !window.history.state.tab) {
        window.history.replaceState({ tab: initialHash, isInitial: true }, '', `#${initialHash}`);
      }
    } catch {}

    const handlePopState = (event: PopStateEvent) => {
      // 1. If any modal was open and user pressed browser Back, close the modal safely
      const hasOpenModal =
        activeModalsRef.current.spec ||
        activeModalsRef.current.save ||
        activeModalsRef.current.auth ||
        activeModalsRef.current.env ||
        activeModalsRef.current.privacy;

      if (hasOpenModal && !event.state?.modal) {
        closeAllModalsDirectly();
        // If we closed a modal while on the current tab, keep user on this tab
        if (event.state?.tab === activeTab) {
          return;
        }
      }

      // 2. Identify target tab
      const hash = window.location.hash.replace('#', '');
      const targetTab = event.state?.tab || hash || 'home';

      // 3. Double-back safety net on Home to prevent accidental browser tab close
      if (targetTab === 'home' && (!event.state || event.state.isInitial)) {
        const now = Date.now();
        if (now - lastExitAttemptRef.current > 2500) {
          lastExitAttemptRef.current = now;
          showToast('أنت الآن في الصفحة الرئيسية. اضغط زر الرجوع مجدداً لمغادرة المنصة.');
          try {
            window.history.pushState({ tab: 'home', isInitial: false }, '', '#home');
          } catch {}
          setActiveTab('home');
          return;
        }
      }

      // 4. Update tab & synchronize historyStack
      setActiveTab(targetTab);
      setHistoryStack((prev) => {
        if (prev.length > 1 && prev[prev.length - 2] === targetTab) {
          return prev.slice(0, -1);
        }
        return [...prev, targetTab];
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || 'home';
      setActiveTab(hash);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [activeTab]);

  // Core formulation state
  const [formulation, setFormulation] = useState<FormulationState>({
    bottleVolumeMl: 50,
    batchCount: 1,
    concentrationPercent: 20,
    concentrationType: 'edp',
    alcoholPercentage: 96,
    waterPercent: 0,
    fixativePercent: 1.0,
    oilDensity: 0.92,
    alcoholDensity: 0.80,
    unitMode: 'grams',
  });

  // Current formula metadata
  const [formulaTitle, setFormulaTitle] = useState('خلطة شام الفاخرة');
  const [formulaAuthor, setFormulaAuthor] = useState('مصمم عطور شام');
  const [batchCode, setBatchCode] = useState('MYR-B01');
  const [formulaNotes, setFormulaNotes] = useState('تركيبة متوازنة شرقية غربية معتقة.');
  const [macerationDays, setMacerationDays] = useState(30);

  // Fragrance pyramid notes
  const [pyramidNotes, setPyramidNotes] = useState<PyramidNote[]>(
    CURATED_FORMULA_PRESETS[0].pyramidNotes
  );

  // Saved formulas in LocalStorage
  const [savedFormulas, setSavedFormulas] = useState<SavedFormula[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load local storage formulas', e);
    }
    return CURATED_FORMULA_PRESETS;
  });

  // Global Language & Internationalization State
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(() => getInitialLanguage());

  // Regional Environment & Climate Adaptation State
  const [currentEnvironment, setCurrentEnvironment] = useState<UserEnvironmentProfile>(() =>
    getInitialUserEnvironment()
  );

  // User Profile & Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() =>
    getCurrentUserSession().user
  );

  // User Detailed Facility & Shipping Address State
  const [detailedAddress, setDetailedAddress] = useState<UserDetailedAddress>(() =>
    loadDetailedAddress()
  );

  // Auto-detect country and language based on the country where the site was opened
  useEffect(() => {
    // 1. Immediate sync check with synchronous detector
    try {
      const hasOverride = localStorage.getItem(USER_LANGUAGE_MANUAL_OVERRIDE_KEY);
      if (!hasOverride) {
        const syncGeo = detectUserCountryAndLanguage();
        if (syncGeo.detectedLanguage && syncGeo.detectedLanguage !== currentLang) {
          setCurrentLang(syncGeo.detectedLanguage);
          saveLanguage(syncGeo.detectedLanguage);
        }
      }
    } catch (e) {
      // ignore
    }

    // 2. High-precision Async IP-based location detection
    detectUserLocationAsync()
      .then((geo) => {
        const hasOverride = localStorage.getItem(USER_LANGUAGE_MANUAL_OVERRIDE_KEY);
        if (!hasOverride && geo.detectedLanguage && geo.detectedLanguage !== currentLang) {
          setCurrentLang(geo.detectedLanguage);
          saveLanguage(geo.detectedLanguage);
          if (geo.detectedCountry) {
            saveUserCountryCode(geo.detectedCountry.code);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Sync document direction and language code whenever language changes
  useEffect(() => {
    saveLanguage(currentLang);
  }, [currentLang]);

  // Client manually requested a specific language
  const handleSelectLanguage = (lang: SupportedLanguage) => {
    try {
      localStorage.setItem(USER_LANGUAGE_MANUAL_OVERRIDE_KEY, 'true');
    } catch (e) {}
    setCurrentLang(lang);
    saveLanguage(lang);
    const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
    showToast(`🌐 تم تغيير لغة المنصة بنجاح إلى: ${langInfo?.flag || ''} «${langInfo?.nativeName || lang}» (${langInfo?.dir.toUpperCase() || 'RTL'})`);
  };

  // Re-run location detection by client request
  const handleAutoDetectLanguage = async () => {
    const geo = await forceRedetectLocation();
    setCurrentLang(geo.detectedLanguage);
    saveLanguage(geo.detectedLanguage);
    showToast(`📍 تم تحديد موقعك: ${geo.detectedCountry.flag} ${geo.detectedCountry.nameAr.split('(')[0]} — لغة المنصة: ${geo.detectedLanguage.toUpperCase()}`);
  };

  const handleUpdateEnvironment = (profile: UserEnvironmentProfile) => {
    setCurrentEnvironment(profile);
    setFormulation((prev) => ({
      ...prev,
      concentrationPercent: profile.recommendedConcentrationPercent,
      concentrationType: profile.recommendedConcentrationType,
      fixativePercent: profile.recommendedFixativePercent,
    }));
    setDetailedAddress((prev) => ({
      ...prev,
      countryCode: profile.countryCode,
      countryNameAr: profile.countryNameAr,
      countryNameEn: profile.countryNameEn,
    }));
    showToast(`🌍 تم ضبط بلد المعمل: ${profile.countryFlag || ''} «${profile.countryNameAr.split('(')[0]}» وعملة ${profile.currencyCode}!`);
  };

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.regionId && user.regionId !== currentEnvironment.regionId) {
      handleUpdateEnvironment(getInitialUserEnvironment());
    }
    showToast(`👤 مرحباً بك يا ${user.name} في معملك الخاص!`);
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    showToast('👋 تم تسجيل الخروج بنجاح');
  };

  const handleUserDataWiped = () => {
    setCurrentUser(null);
    setSavedFormulas(CURATED_FORMULA_PRESETS);
    showToast('🛡️ تم مسح كافة بياناتك وسجلاتك الشخصية نهائياً بنجاح (GDPR Cleared)');
  };

  // Save to LocalStorage whenever savedFormulas changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedFormulas));
    } catch (e) {
      console.error('Failed to save to local storage', e);
    }
  }, [savedFormulas]);

  // Perform core formulation calculation
  const calculationResult = calculatePerfumeFormulation(formulation);

  // ===================== INTERACTIVE CHATBOT BRIDGE HANDLERS =====================

  // 1. Transfer chat formula directly to Concentration Calculator
  const handleApplyToConcentrationCalculator = (formula: ExtractedAIPerfume) => {
    setFormulation((prev) => ({
      ...prev,
      bottleVolumeMl: formula.bottleVolumeMl || 50,
      concentrationPercent: formula.concentrationPercent,
      concentrationType: formula.concentrationType,
    }));
    setFormulaTitle(formula.title);
    setFormulaAuthor(formula.author);
    setFormulaNotes(formula.summary);
    setMacerationDays(formula.macerationDays);
    if (formula.pyramidNotes && formula.pyramidNotes.length > 0) {
      setPyramidNotes(formula.pyramidNotes);
    }
    navigateToTab('concentration');
    showToast(`🧪 تم تطبيق تركيبة «${formula.title}» في حاسبة التركيب والمعمل بنجاح!`);
  };

  // 2. Transfer chat formula directly to Pyramid Calculator
  const handleApplyToPyramidCalculator = (formula: ExtractedAIPerfume) => {
    setFormulation((prev) => ({
      ...prev,
      bottleVolumeMl: formula.bottleVolumeMl || 50,
      concentrationPercent: formula.concentrationPercent,
      concentrationType: formula.concentrationType,
    }));
    setFormulaTitle(formula.title);
    if (formula.pyramidNotes && formula.pyramidNotes.length > 0) {
      setPyramidNotes(formula.pyramidNotes);
    }
    navigateToTab('pyramid');
    showToast(`🔺 تم نقل نوتات «${formula.title}» إلى حاسبة الهرم العطري بنجاح!`);
  };

  // 3. Record & Save chat formula directly into Recipe Library Notebook
  const handleRecordToRecipeLibrary = (formula: ExtractedAIPerfume) => {
    const newEntry: SavedFormula = {
      id: 'ai-recipe-' + Date.now(),
      title: formula.title,
      author: formula.author || 'الخبير شاهين (معمل عطور شام)',
      dateCreated: new Date().toISOString().split('T')[0],
      batchCode: 'REC-' + Math.floor(Math.random() * 900 + 100),
      notes: formula.summary,
      macerationDays: formula.macerationDays || 35,
      formulation: {
        ...formulation,
        bottleVolumeMl: formula.bottleVolumeMl || 50,
        concentrationPercent: formula.concentrationPercent,
        concentrationType: formula.concentrationType,
      },
      pyramidNotes: formula.pyramidNotes || [...pyramidNotes],
    };

    setSavedFormulas((prev) => [newEntry, ...prev]);
    showToast(`📝 تم تدوين وحفظ «${formula.title}» في دفتر الوصفات تلقائياً!`);
  };

  // 4. Transfer to Costing Calculator
  const handleCalculateCosting = (formula: ExtractedAIPerfume) => {
    setFormulation((prev) => ({
      ...prev,
      bottleVolumeMl: formula.bottleVolumeMl || 50,
      concentrationPercent: formula.concentrationPercent,
      concentrationType: formula.concentrationType,
    }));
    setFormulaTitle(formula.title);
    navigateToTab('costing');
    showToast(`💰 تم الانتقال لحاسبة التكاليف والأرباح لتسعير تركيبة «${formula.title}»!`);
  };

  // 5. Open Spec Sheet for Chat Formula
  const handlePrintSpecSheetForFormula = (formula: ExtractedAIPerfume) => {
    setFormulation((prev) => ({
      ...prev,
      bottleVolumeMl: formula.bottleVolumeMl || 50,
      concentrationPercent: formula.concentrationPercent,
      concentrationType: formula.concentrationType,
    }));
    setFormulaTitle(formula.title);
    setFormulaAuthor(formula.author);
    setFormulaNotes(formula.summary);
    setMacerationDays(formula.macerationDays);
    if (formula.pyramidNotes && formula.pyramidNotes.length > 0) {
      setPyramidNotes(formula.pyramidNotes);
    }
    handleOpenSpecModal();
  };

  // ===================== LIBRARY & WORLD RECIPES HANDLERS =====================

  const handleLoadFormula = (formula: SavedFormula) => {
    setFormulation(formula.formulation);
    setFormulaTitle(formula.title);
    setFormulaAuthor(formula.author);
    setBatchCode(formula.batchCode);
    setFormulaNotes(formula.notes || '');
    setMacerationDays(formula.macerationDays || 30);
    setPyramidNotes(formula.pyramidNotes || []);
    navigateToTab('concentration');
    showToast(`تم تحميل التركيبة "${formula.title}" بنجاح في المعمل`);
  };

  const handleLoadWorldFormula = (recipe: WorldPerfumeRecipe) => {
    setFormulation((prev) => ({
      ...prev,
      concentrationPercent: recipe.targetConcentration,
      concentrationType: recipe.concentrationType,
    }));
    setFormulaTitle(recipe.nameAr);
    setFormulaAuthor(recipe.brand);
    setBatchCode('WRLD-' + recipe.id.slice(0, 5).toUpperCase());
    setFormulaNotes(`${recipe.descriptionAr}\nنصيحة الخبير: ${recipe.compoundingTips}`);
    setMacerationDays(recipe.macerationDays);
    setPyramidNotes(recipe.pyramidNotes);
    navigateToTab('concentration');
    showToast(`تم تحميل تركيبة «${recipe.nameAr}» في حاسبة المعمل بنجاح!`);
  };

  const handlePrintWorldFormula = (recipe: WorldPerfumeRecipe) => {
    setFormulation((prev) => ({
      ...prev,
      concentrationPercent: recipe.targetConcentration,
      concentrationType: recipe.concentrationType,
    }));
    setFormulaTitle(recipe.nameAr);
    setFormulaAuthor(recipe.brand);
    setBatchCode('WRLD-' + recipe.id.slice(0, 5).toUpperCase());
    setFormulaNotes(recipe.descriptionAr);
    setMacerationDays(recipe.macerationDays);
    setPyramidNotes(recipe.pyramidNotes);
    handleOpenSpecModal();
  };

  const handleAddMaterialToPyramid = (note: PyramidNote) => {
    setPyramidNotes((prev) => [...prev, note]);
    showToast(`تمت إضافة «${note.nameAr}» إلى الهرم العطري بنجاح`);
  };

  const handleSaveActiveFormula = (e: React.FormEvent) => {
    e.preventDefault();
    const newFormula: SavedFormula = {
      id: 'formula-' + Date.now(),
      title: formulaTitle.trim() || 'عطر مخصص جديد',
      author: formulaAuthor.trim() || 'مصمم العطور',
      dateCreated: new Date().toISOString().split('T')[0],
      batchCode: batchCode.trim() || 'BATCH-' + Math.floor(Math.random() * 900 + 100),
      notes: formulaNotes.trim(),
      macerationDays: macerationDays || 30,
      formulation: { ...formulation },
      pyramidNotes: [...pyramidNotes],
    };

    setSavedFormulas((prev) => [newFormula, ...prev]);
    handleCloseSaveModal();
    showToast(`تم حفظ التركيبة "${newFormula.title}" في مكتبة الوصفات!`);
  };

  const handleDeleteFormula = (id: string) => {
    setSavedFormulas((prev) => prev.filter((f) => f.id !== id));
    showToast('تم حذف التركيبة من المكتبة');
  };

  const handlePrintFormula = (formula: SavedFormula) => {
    setFormulation(formula.formulation);
    setFormulaTitle(formula.title);
    setFormulaAuthor(formula.author);
    setBatchCode(formula.batchCode);
    setFormulaNotes(formula.notes);
    setMacerationDays(formula.macerationDays);
    setPyramidNotes(formula.pyramidNotes);
    handleOpenSpecModal();
  };

  return (
    <LanguageProvider initialLang={currentLang} onLanguageChange={handleSelectLanguage}>
      <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900 selection:bg-amber-200">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 left-6 z-50 bg-stone-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-stone-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={(tab) => navigateToTab(tab)}
          onOpenPrintModal={handleOpenSpecModal}
          currentLang={currentLang}
          onSelectLanguage={handleSelectLanguage}
          onAutoDetectLanguage={handleAutoDetectLanguage}
          currentUser={currentUser}
          onOpenAuthModal={handleOpenAuthModal}
          onLogout={handleLogout}
          currentEnvironment={currentEnvironment}
          onOpenEnvironmentModal={handleOpenEnvironmentModal}
          onOpenPrivacyModal={handleOpenPrivacyModal}
        />

        {/* Hero Showcase (only shown when in concentration tab or home) */}
        {activeTab === 'concentration' && (
          <Hero
            onQuickStart={(tab) => {
              navigateToTab(tab);
            }}
            currentLang={currentLang}
          />
        )}

        {/* Main Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-10">
          {/* Universal Navigation Breadcrumbs Bar with Back to Home & Back to Previous */}
          <NavigationBreadcrumbs
            activeTab={activeTab}
            onNavigate={(tab) => navigateToTab(tab)}
            onGoBack={handleGoBack}
            canGoBack={historyStack.length > 1}
            previousTabLabel={
              historyStack.length > 1
                ? historyStack[historyStack.length - 2]
                : undefined
            }
            currentLang={currentLang}
            onOpenPrintModal={handleOpenSpecModal}
          />

          {activeTab === 'home' && (
            <HomeHub
              onNavigate={(tabId) => navigateToTab(tabId)}
              currentLang={currentLang}
              formulation={formulation}
              pyramidNotes={pyramidNotes}
              savedFormulas={savedFormulas}
              currentEnvironment={currentEnvironment}
              detailedAddress={detailedAddress}
              currentUser={currentUser}
              onOpenEnvironmentModal={handleOpenEnvironmentModal}
              onOpenPrivacyModal={handleOpenPrivacyModal}
              onOpenAuthModal={handleOpenAuthModal}
              onOpenSpecModal={handleOpenSpecModal}
            />
          )}

          {activeTab === 'concentration' && (
            <ConcentrationCalculator
              formulation={formulation}
              setFormulation={setFormulation}
              result={calculationResult}
              onSaveFormula={handleOpenSaveModal}
              onSendToCosting={() => navigateToTab('costing')}
              pyramidNotes={pyramidNotes}
              setPyramidNotes={setPyramidNotes}
              onNavigateToTab={(tab) => navigateToTab(tab)}
              currentLang={currentLang}
            />
          )}

        {activeTab === 'perfume_news' && (
          <WorldPerfumeNews
            currentLang={currentLang}
            onApplyNewsNotesToCalculator={handleApplyToConcentrationCalculator}
            onAddNoteToPyramid={handleAddMaterialToPyramid}
          />
        )}

        {activeTab === 'world_perfumes' && (
          <WorldPerfumesLibrary
            currentLang={currentLang}
            onLoadWorldFormula={handleLoadWorldFormula}
            onPrintWorldFormula={handlePrintWorldFormula}
          />
        )}

        {activeTab === 'raw_materials' && (
          <RawMaterialsEncyclopedia
            currentLang={currentLang}
            onAddMaterialToPyramid={handleAddMaterialToPyramid}
          />
        )}

        {activeTab === 'pyramid' && (
          <PyramidCalculator
            currentLang={currentLang}
            formulation={formulation}
            pyramidNotes={pyramidNotes}
            setPyramidNotes={setPyramidNotes}
            result={calculationResult}
          />
        )}

        {activeTab === 'alcohol' && (
          <AlcoholDilutionCalculator currentLang={currentLang} />
        )}

        {activeTab === 'costing' && (
          <CostCalculator
            currentLang={currentLang}
            formulation={formulation}
            calculationResult={calculationResult}
            currentCurrencyCode={currentEnvironment.currencyCode}
          />
        )}

        {activeTab === 'library' && (
          <FormulaLibrary
            currentLang={currentLang}
            savedFormulas={savedFormulas}
            onLoadFormula={handleLoadFormula}
            onDeleteFormula={handleDeleteFormula}
            onPrintFormula={handlePrintFormula}
          />
        )}

        {activeTab === 'master_ai' && (
          <PerfumerMasterLabView
            currentLang={currentLang}
            onApplyToConcentrationCalculator={handleApplyToConcentrationCalculator}
            onApplyToPyramidCalculator={handleApplyToPyramidCalculator}
            onRecordToRecipeLibrary={handleRecordToRecipeLibrary}
            onCalculateCosting={handleCalculateCosting}
            onPrintSpecSheet={handlePrintSpecSheetForFormula}
          />
        )}

        {activeTab === 'guide' && (
          <AgingAndFixativesGuide currentLang={currentLang} />
        )}
      </main>

      {/* Floating Interactive Master Perfumer AI Chatbot with Transfer Bridge */}
      <PerfumerAIChatbot
        onApplyToConcentrationCalculator={handleApplyToConcentrationCalculator}
        onApplyToPyramidCalculator={handleApplyToPyramidCalculator}
        onRecordToRecipeLibrary={handleRecordToRecipeLibrary}
        onCalculateCosting={handleCalculateCosting}
        onPrintSpecSheet={handlePrintSpecSheetForFormula}
      />

      {/* Footer */}
      <Footer
        setActiveTab={(tab) => navigateToTab(tab)}
        currentLang={currentLang}
        onSelectLanguage={handleSelectLanguage}
      />

      {/* Save Formula Modal */}
      {isSaveModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={handleCloseSaveModal}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-stone-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <span className="text-sm font-bold flex items-center gap-2">
                <BookmarkPlus className="w-4 h-4 text-amber-400" />
                <span>حفظ التركيبة في مكتبة الوصفات</span>
              </span>
              <button
                onClick={handleCloseSaveModal}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveActiveFormula} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-stone-800 block mb-1">
                  اسم العطر / التركيبة
                </label>
                <input
                  type="text"
                  required
                  value={formulaTitle}
                  onChange={(e) => setFormulaTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-800 block mb-1">
                    المصمم / الدار
                  </label>
                  <input
                    type="text"
                    value={formulaAuthor}
                    onChange={(e) => setFormulaAuthor(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-amber-700"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-800 block mb-1">
                    كود التشغيلة (Batch ID)
                  </label>
                  <input
                    type="text"
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-800 block mb-1">
                  فترة التعتيق المقترحة (بالأيام)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={macerationDays}
                  onChange={(e) => setMacerationDays(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono-numbers text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-800 block mb-1">
                  ملاحظات التركيبة والشعور العطري
                </label>
                <textarea
                  rows={3}
                  value={formulaNotes}
                  onChange={(e) => setFormulaNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-amber-700"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseSaveModal}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-semibold rounded-lg shadow-sm cursor-pointer"
                >
                  تأكيد الحفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Manufacturing Specification Sheet Modal */}
      {isSpecModalOpen && (
        <ManufacturingSpecSheet
          formulaTitle={formulaTitle}
          author={formulaAuthor}
          batchCode={batchCode}
          notes={formulaNotes}
          macerationDays={macerationDays}
          formulation={formulation}
          pyramidNotes={pyramidNotes}
          calculationResult={calculationResult}
          detailedAddress={detailedAddress}
          onClose={handleCloseSpecModal}
        />
      )}

      {/* User Authentication & Account Modal */}
      {isAuthModalOpen && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onOpenPrivacyPolicy={() => {
            handleCloseAuthModal();
            handleOpenPrivacyModal();
          }}
          onClose={handleCloseAuthModal}
        />
      )}

      {/* World Countries & Detailed Facility Address Modal */}
      {isEnvironmentModalOpen && (
        <CountryAndAddressModal
          currentProfile={currentEnvironment}
          currentAddress={detailedAddress}
          currentUser={currentUser}
          onUpdateProfile={handleUpdateEnvironment}
          onUpdateAddress={(newAddr) => {
            setDetailedAddress(newAddr);
            showToast(`📍 تم حفظ وتحديث مقر المعمل: ${newAddr.labOrFacilityName || newAddr.city}`);
          }}
          onApplyRegionalFormulaToWorkbench={handleApplyToConcentrationCalculator}
          onClose={handleCloseEnvironmentModal}
          currentLang={currentLang}
          onSelectLanguage={handleSelectLanguage}
        />
      )}

      {/* User Data Protection & GDPR Privacy Modal */}
      {isPrivacyModalOpen && (
        <DataPrivacyModal
          currentUser={currentUser}
          onUserDataWiped={handleUserDataWiped}
          onClose={handleClosePrivacyModal}
        />
      )}

      </div>
    </LanguageProvider>
  );
}
