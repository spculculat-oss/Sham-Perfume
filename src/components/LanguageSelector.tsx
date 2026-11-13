import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Languages, MapPin, Search, Sparkles, X } from 'lucide-react';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LanguageConfig } from '../types/i18n';
import { getCommonLabel, isRTL } from '../لغات/localizedContent';
import { LText, makeT, fmt } from '../لغات/localize';
import { filterLanguages, findLanguage, languageCount, popularLanguages } from '../لغات/languagePicker';

/**
 * The single languages button of the platform: one icon at the top of the page that
 * opens every language the platform ships (currently {SUPPORTED_LANGUAGES.length}),
 * with a search box, the most-used quick picks and keyboard navigation.
 */
const S = {
  trigger_tooltip: {
    ar: 'جميع اللغات — اضغط لفتح قائمة اللغات والبحث فيها',
    en: 'All languages — open the list and search',
    fr: 'Toutes les langues — ouvrir la liste et rechercher',
    es: 'Todos los idiomas — abrir la lista y buscar',
    it: 'Tutte le lingue — apri la lista e cerca',
    de: 'Alle Sprachen — Liste öffnen und suchen',
    ru: 'Все языки — открыть список и поиск',
    zh: '所有语言 — 打开列表并搜索',
    tr: 'Tüm diller — listeyi aç ve ara',
    fa: 'همه زبان‌ها — باز کردن فهرست و جستجو',
    is: 'Öll tungumál — opnaðu listann og leitaðu',
    sq: 'Të gjitha gjuhët — hap listën dhe kërko',
    ps: 'ټولې ژبې — لړلیک پرانیزئ او ولټوئ',
  },
  panel_title: {
    ar: 'لغات المنصة',
    en: 'Platform Languages',
    fr: 'Langues de la plateforme',
    es: 'Idiomas de la plataforma',
    it: 'Lingue della piattaforma',
    de: 'Plattform-Sprachen',
    ru: 'Языки платформы',
    zh: '平台语言',
    tr: 'Platform Dilleri',
    fa: 'زبان‌های پلتفرم',
    is: 'Tungumál vettvangsins',
    sq: 'Gjuhët e platformës',
    ps: 'د پلیټفارم ژبې',
  },
  panel_sub: {
    ar: '{n} لغة متاحة — ابحث واختر لغتك',
    en: '{n} languages available — search and pick yours',
    fr: '{n} langues disponibles — recherchez et choisissez',
    es: '{n} idiomas disponibles — busca y elige',
    it: '{n} lingue disponibili — cerca e scegli',
    de: '{n} Sprachen verfügbar — suchen und wählen',
    ru: 'Доступно языков: {n} — найдите и выберите',
    zh: '共 {n} 种语言 — 搜索并选择',
    tr: '{n} dil mevcut — ara ve seç',
    fa: '{n} زبان موجود است — جستجو و انتخاب کنید',
    is: '{n} tungumál í boði — leitaðu og veldu',
    sq: '{n} gjuhë të disponueshme — kërko dhe zgjidh',
    ps: '{n} ژبې شته — ولټوئ او خپله ژبه وټاکئ',
  },
  search_ph: {
    ar: 'ابحث عن لغة… اكتب اسمها أو رمزها (مثال: عربي، ar، German)',
    en: 'Search a language… type its name or code (e.g. عربي, ar, German)',
    fr: 'Rechercher une langue… nom ou code (ex. ar, German)',
    es: 'Busca un idioma… nombre o código (p. ej. ar, German)',
    it: 'Cerca una lingua… nome o codice (es. ar, German)',
    de: 'Sprache suchen… Name oder Code (z. B. ar, German)',
    ru: 'Найти язык… название или код (напр. ar, German)',
    zh: '搜索语言…输入名称或代码（如 ar、German）',
    tr: 'Dil ara… adı veya kodu (örn. ar, German)',
    fa: 'جستجوی زبان… نام یا کد آن (مثلاً ar، German)',
    is: 'Leita að tungumáli… sláðu inn heiti eða kóða (t.d. íslenska, is, English)',
    sq: 'Kërko një gjuhë… shkruaj emrin ose kodin (p.sh. shqip, sq, English)',
    ps: 'ژبه ولټوئ… نوم یا کوډ ولیکئ (لکه پښتو، ps، English)',
  },
  popular: {
    ar: 'الأكثر استخداماً',
    en: 'Most used',
    fr: 'Les plus utilisées',
    es: 'Más usados',
    it: 'Più usate',
    de: 'Am häufigsten',
    ru: 'Популярные',
    zh: '最常用',
    tr: 'En çok kullanılan',
    fa: 'پرکاربردترین‌ها',
    is: 'Vinsælustu',
    sq: 'Më të përdorurat',
    ps: 'ډېر کارېدونکې',
  },
  all_langs: {
    ar: 'جميع اللغات',
    en: 'All languages',
    fr: 'Toutes les langues',
    es: 'Todos los idiomas',
    it: 'Tutte le lingue',
    de: 'Alle Sprachen',
    ru: 'Все языки',
    zh: '所有语言',
    tr: 'Tüm diller',
    fa: 'همه زبان‌ها',
    is: 'Öll tungumál',
    sq: 'Të gjitha gjuhët',
    ps: 'ټولې ژبې',
  },
  results_title: {
    ar: 'نتائج البحث',
    en: 'Search results',
    fr: 'Résultats de recherche',
    es: 'Resultados de búsqueda',
    it: 'Risultati di ricerca',
    de: 'Suchergebnisse',
    ru: 'Результаты поиска',
    zh: '搜索结果',
    tr: 'Arama sonuçları',
    fa: 'نتایج جستجو',
    is: 'Leitarniðurstöður',
    sq: 'Rezultatet e kërkimit',
    ps: 'د لټون پایلې',
  },
  results_tpl: {
    ar: 'ظاهر {a} من {b} لغة',
    en: 'Showing {a} of {b} languages',
    fr: '{a} sur {b} langues affichées',
    es: 'Mostrando {a} de {b} idiomas',
    it: 'Mostrate {a} di {b} lingue',
    de: '{a} von {b} Sprachen angezeigt',
    ru: 'Показано {a} из {b} языков',
    zh: '显示 {a} / {b} 种语言',
    tr: '{b} dilden {a} tanesi gösteriliyor',
    fa: 'نمایش {a} از {b} زبان',
    is: 'Sýni {a} af {b} tungumálum',
    sq: 'Duke shfaqur {a} nga {b} gjuhë',
    ps: 'له {b} ژبو څخه {a} ښکاري',
  },
  no_match: {
    ar: 'لم يتم العثور على لغة مطابقة للبحث',
    en: 'No matching languages found',
    fr: 'Aucune langue correspondante',
    es: 'No se encontraron idiomas',
    it: 'Nessuna lingua trovata',
    de: 'Keine passenden Sprachen gefunden',
    ru: 'Совпадающих языков не найдено',
    zh: '未找到匹配的语言',
    tr: 'Eşleşen dil bulunamadı',
    fa: 'زبانی مطابق جستجو یافت نشد',
    is: 'Ekkert tungumál fannst',
    sq: 'Nuk u gjet asnjë gjuhë',
    ps: 'ژبه ونه موندل شوه',
  },
  no_match_hint: {
    ar: 'جرّب الاسم بالإنجليزية أو رمز اللغة (مثال: de أو Japanese) أو امسح البحث لعرض كل اللغات',
    en: 'Try the English name or the language code (e.g. de or Japanese), or clear the search to see all languages',
    fr: 'Essayez le nom en anglais ou le code (ex. de, Japanese) ou effacez la recherche',
    es: 'Prueba el nombre en inglés o el código (p. ej. de, Japanese) o borra la búsqueda',
    it: 'Prova il nome inglese o il codice (es. de, Japanese) oppure cancella la ricerca',
    de: 'Versuchen Sie den englischen Namen oder Code (z. B. de, Japanese) oder löschen Sie die Suche',
    ru: 'Попробуйте английское название или код (напр. de, Japanese) или очистите поиск',
    zh: '请尝试英文名称或语言代码（如 de、Japanese），或清除搜索',
    tr: 'İngilizce adı veya kodu deneyin (örn. de, Japanese) ya da aramayı temizleyin',
    fa: 'نام انگلیسی یا کد زبان را امتحان کنید (مثلاً de یا Japanese) یا جستجو را پاک کنید',
    is: 'Prófaðu annað heiti, staðarheiti eða tungumálakóða.',
    sq: 'Provo një emër tjetër, emrin vendor ose kodin e gjuhës.',
    ps: 'بل نوم، اصلي نوم یا د ژبې کوډ وازمویئ.',
  },
  clear: {
    ar: 'مسح البحث',
    en: 'Clear search',
    fr: 'Effacer la recherche',
    es: 'Borrar búsqueda',
    it: 'Cancella ricerca',
    de: 'Suche löschen',
    ru: 'Очистить поиск',
    zh: '清除搜索',
    tr: 'Aramayı temizle',
    fa: 'پاک کردن جستجو',
    is: 'Hreinsa',
    sq: 'Pastro',
    ps: 'پاکول',
  },
  active: {
    ar: 'مفعلة',
    en: 'Active',
    fr: 'Active',
    es: 'Activo',
    it: 'Attiva',
    de: 'Aktiv',
    ru: 'Активен',
    zh: '使用中',
    tr: 'Aktif',
    fa: 'فعال',
    is: 'Virkt',
    sq: 'Aktive',
    ps: 'فعاله',
  },
  keyboard_hint: {
    ar: '↑↓ للتنقل · Enter للاختيار · Esc للإغلاق',
    en: '↑↓ to move · Enter to select · Esc to close',
    fr: '↑↓ pour naviguer · Entrée pour choisir · Échap pour fermer',
    es: '↑↓ para mover · Enter para elegir · Esc para cerrar',
    it: '↑↓ per muoversi · Invio per scegliere · Esc per chiudere',
    de: '↑↓ zum Navigieren · Enter zum Wählen · Esc zum Schließen',
    ru: '↑↓ — перемещение · Enter — выбор · Esc — закрыть',
    zh: '↑↓ 移动 · Enter 选择 · Esc 关闭',
    tr: '↑↓ gezin · Enter seç · Esc kapat',
    fa: '↑↓ برای حرکت · Enter برای انتخاب · Esc برای بستن',
    is: '↑↓ til að fara · Enter til að velja · Esc til að loka',
    sq: '↑↓ për të lëvizur · Enter për të zgjedhur · Esc për ta mbyllur',
    ps: '↑↓ د تګ لپاره · Enter د ټاکلو لپاره · Esc د بندولو لپاره',
  },
  close: {
    ar: 'إغلاق',
    en: 'Close',
    fr: 'Fermer',
    es: 'Cerrar',
    it: 'Chiudi',
    de: 'Schließen',
    ru: 'Закрыть',
    zh: '关闭',
    tr: 'Kapat',
    fa: 'بستن',
    is: 'Loka',
    sq: 'Mbyll',
    ps: 'بندول',
  },
  saved_auto: {
    ar: 'يتم حفظ اللغة تلقائياً في المتصفح',
    en: 'Language preference saved automatically',
    fr: 'Préférence de langue enregistrée automatiquement',
    es: 'Preferencia de idioma guardada automáticamente',
    it: 'Preferenza lingua salvata automaticamente',
    de: 'Spracheinstellung wird automatisch gespeichert',
    ru: 'Язык сохраняется автоматически',
    zh: '语言偏好将自动保存',
    tr: 'Dil tercihi otomatik kaydedilir',
    fa: 'زبان انتخابی به‌طور خودکار ذخیره می‌شود',
    is: 'Tungumálastillingin vistast sjálfkrafa',
    sq: 'Preferenca e gjuhës ruhet automatikisht',
    ps: 'د ژبې خوښه په اوتومات ډول ساتل کېږي',
  },
  langs_count: {
    ar: 'لغة',
    en: 'langs',
    fr: 'langues',
    es: 'idiomas',
    it: 'lingue',
    de: 'Sprachen',
    ru: 'языков',
    zh: '种语言',
    tr: 'dil',
    fa: 'زبان',
    is: 'tungumál',
    sq: 'gjuhë',
    ps: 'ژبې',
  },
} satisfies Record<string, LText>;

interface LanguageSelectorProps {
  currentLang: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  onAutoDetectLanguage?: () => void;
  /** Kept for callers that render the button inside a dense toolbar. */
  compactMobile?: boolean;
  /** Extra classes for the wrapper (positioning in a header row). */
  className?: string;
  /** Render the panel already open — used by deep links and by the render tests. */
  defaultOpen?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  onSelectLanguage,
  onAutoDetectLanguage,
  compactMobile = false,
  className = '',
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const activeConfig = findLanguage(currentLang) || SUPPORTED_LANGUAGES[0];
  const rtl = isRTL(currentLang);
  const L = makeT(currentLang, S);

  // One unified source of truth for the list: every picker filters through it.
  const results = useMemo(() => filterLanguages(searchQuery), [searchQuery]);
  const isSearching = searchQuery.trim().length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus the search box as soon as the panel opens, like a command palette.
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightIndex(-1);
      const timer = window.setTimeout(() => searchRef.current?.focus(), 30);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  // The header uses backdrop-blur, which would trap a fixed panel inside the header box,
  // so the panel is portalled to <body> and positioned from the trigger's real rectangle.
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return undefined;
    const gap = 8;
    const place = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (vw < 640) {
        setPanelStyle({ left: gap, right: gap, bottom: gap, top: 'auto', width: 'auto', maxHeight: Math.max(280, vh - gap * 2 - 12) });
        return;
      }
      const width = Math.min(vw - gap * 2, 512);
      const maxHeight = Math.min(vh - rect.bottom - gap * 2, Math.round(vh * 0.7));
      if (rtl) {
        // Arabic keeps the controls on the left, so the panel grows towards the reading start.
        const left = Math.max(gap, Math.min(rect.left, vw - gap - width));
        setPanelStyle({ left, right: 'auto', bottom: 'auto', top: rect.bottom + gap, width, maxHeight });
      } else {
        const right = Math.max(gap, Math.min(vw - rect.right, vw - gap - width));
        setPanelStyle({ left: 'auto', right, bottom: 'auto', top: rect.bottom + gap, width, maxHeight });
      }
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen, rtl]);

  // Escape closes the panel from anywhere, even after focus moved to a language row.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Keep the highlighted row visible while arrowing through 100 languages.
  useEffect(() => {
    if (highlightIndex < 0) return;
    const node = listRef.current?.querySelectorAll<HTMLElement>('[data-language-item]')[highlightIndex];
    node?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, results]);

  const close = () => {
    setIsOpen(false);
    setSearchQuery('');
    setHighlightIndex(-1);
  };

  const choose = (lingua: LanguageConfig) => {
    onSelectLanguage(lingua.code);
    close();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!results.length) return;
      setHighlightIndex((prev) => {
        const next = event.key === 'ArrowDown' ? prev + 1 : prev - 1;
        if (next < 0) return results.length - 1;
        if (next >= results.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const target = results[highlightIndex] || results[0];
      if (target) choose(target);
    }
  };

  const triggerSize = compactMobile ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs';

  const overlay = isOpen ? (
    <>
      {/* Mobile scrim so the panel reads as a sheet, not a floating menu */}
      <div className="fixed inset-0 z-[60] bg-stone-950/25 sm:hidden" aria-hidden="true" onClick={close} />

      <div
        ref={panelRef}
        role="dialog"
          aria-modal="true"
          aria-label={L('panel_title')}
          dir={rtl ? 'rtl' : 'ltr'}
          style={panelStyle}
          className="fixed z-[70] flex flex-col rounded-2xl bg-white border border-stone-200 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-stone-900 to-amber-950 text-white flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 shrink-0">
                <Languages className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-amber-200 truncate">{L('panel_title')}</div>
                <div className="text-[10px] text-stone-300 truncate">{fmt(L('panel_sub'), { n: languageCount() })}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              className="shrink-0 w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-stone-200 flex items-center justify-center transition-colors cursor-pointer"
              aria-label={L('close')}
              title={L('close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search box — the whole point of the unified button */}
          <div className="p-2.5 border-b border-stone-100 bg-stone-50/70 shrink-0 space-y-2">
            <div className="relative">
              <Search
                className={`w-4 h-4 text-stone-400 absolute ${rtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 pointer-events-none`}
              />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setHighlightIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={L('search_ph')}
                aria-label={L('search_ph')}
                autoComplete="off"
                spellCheck={false}
                className={`w-full ${rtl ? 'pr-9 pl-9 text-right' : 'pl-9 pr-9 text-left'} py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500 transition-all`}
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setHighlightIndex(-1);
                    searchRef.current?.focus();
                  }}
                  className={`absolute ${rtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors cursor-pointer`}
                  aria-label={L('clear')}
                  title={L('clear')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {onAutoDetectLanguage && (
              <button
                type="button"
                onClick={() => {
                  onAutoDetectLanguage();
                  close();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-xs transition-all cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{getCommonLabel('auto_detect_location', currentLang)}</span>
              </button>
            )}
          </div>

          {/* Quick picks — only while nothing is typed */}
          {!isSearching && (
            <div className="px-3 pt-2.5 pb-2 border-b border-stone-100 shrink-0">
              <div className="text-[10px] font-bold text-stone-500 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-700" />
                <span>{L('popular')}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {popularLanguages().map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => choose(lang)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                      lang.code === currentLang
                        ? 'bg-amber-100 border-amber-400 text-amber-950 font-bold'
                        : 'bg-white border-stone-200 hover:border-amber-300 hover:bg-amber-50 text-stone-700'
                    }`}
                    title={`${lang.nativeName} (${lang.name})`}
                  >
                    <span aria-hidden="true">{lang.flag}</span>
                    <span className="font-semibold">{lang.nativeName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Result counter */}
          <div className="px-3.5 py-1.5 bg-white border-b border-stone-100 flex items-center justify-between text-[10px] text-stone-500 shrink-0">
            <span className="font-bold text-stone-600">{isSearching ? L('results_title') : L('all_langs')}</span>
            <span className="font-mono">{fmt(L('results_tpl'), { a: results.length, b: languageCount() })}</span>
          </div>

          {/* Every language of the platform, filtered by the search box */}
          <div ref={listRef} className="overflow-y-auto flex-1 p-2">
            {results.length === 0 ? (
              <div className="py-8 px-5 text-center space-y-2">
                <div className="text-sm font-bold text-stone-700">{L('no_match')}</div>
                <p className="text-[11px] text-stone-500 leading-relaxed">{L('no_match_hint')}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setHighlightIndex(-1);
                    searchRef.current?.focus();
                  }}
                  className="mt-1 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {L('clear')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {results.map((lang, index) => {
                  const isSelected = lang.code === currentLang;
                  const isHighlighted = index === highlightIndex;
                  return (
                      <button
                        key={lang.code}
                        type="button"
                        data-language-item
                        onClick={() => choose(lang)}
                        onMouseEnter={() => setHighlightIndex(index)}
                        className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 transition-colors cursor-pointer text-start ${
                          isSelected
                            ? 'bg-amber-50 border border-amber-300'
                            : isHighlighted
                              ? 'bg-stone-100 border border-stone-200'
                              : 'bg-white border border-transparent hover:bg-stone-50 hover:border-stone-200'
                        }`}
                        title={`${lang.nativeName} — ${lang.name} (${lang.code.toUpperCase()})`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-lg leading-none shrink-0" aria-hidden="true">
                            {lang.flag}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-bold text-[12px] text-stone-900 truncate">{lang.nativeName}</span>
                            <span className="block text-[10px] text-stone-500 truncate">
                              {lang.name} · <span className="font-mono uppercase">{lang.code}</span>
                            </span>
                          </span>
                        </span>
                        {isSelected ? (
                          <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-200/80 text-amber-950 text-[9px] font-bold">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>{L('active')}</span>
                          </span>
                        ) : (
                          <span
                            className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-md font-mono font-semibold ${
                              lang.dir === 'rtl'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                            }`}
                          >
                            {lang.dir.toUpperCase()}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3.5 py-2 border-t border-stone-100 bg-stone-50 shrink-0 flex items-center justify-between gap-2 text-[10px] text-stone-500">
              <span className="truncate hidden sm:inline">{L('keyboard_hint')}</span>
              <span className="truncate sm:hidden">{L('saved_auto')}</span>
              <span className="font-mono text-stone-400 shrink-0">
                {languageCount()} {L('langs_count')}
              </span>
            </div>
          </div>
    </>
  ) : null;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* The one unified languages icon at the top of the page */}
      <button
        type="button"
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        className={`flex items-center gap-1.5 rounded-xl border transition-all cursor-pointer select-none shadow-xs ${triggerSize} ${
          isOpen
            ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-300/40 text-stone-900'
            : 'bg-white hover:bg-stone-50 border-stone-200 hover:border-amber-300 text-stone-800'
        }`}
        title={`${L('trigger_tooltip')} (${languageCount()})`}
        aria-label={`${L('trigger_tooltip')} (${languageCount()})`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="w-6 h-6 rounded-lg bg-amber-100/80 text-amber-900 flex items-center justify-center shrink-0 relative">
          <Languages className="w-3.5 h-3.5" />
          <span className="absolute -bottom-1 -end-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-stone-900 text-amber-300 text-[8px] font-bold flex items-center justify-center leading-none">
            {languageCount()}
          </span>
        </span>
        <span className="text-sm leading-none" role="img" aria-hidden="true">
          {activeConfig.flag}
        </span>
        <span className="font-bold text-[11px] font-mono text-stone-900 uppercase">
          {activeConfig.code}
        </span>
        <span className="hidden lg:inline truncate max-w-[90px] font-semibold text-stone-700">
          {activeConfig.nativeName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-700' : ''}`}
        />
      </button>

      {overlay && (typeof document === 'undefined' ? overlay : createPortal(overlay, document.body))}
    </div>
  );
};
