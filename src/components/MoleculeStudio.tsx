import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Atom,
  Beaker,
  BookOpen,
  CalendarClock,
  Check,
  CircleHelp,
  ClipboardList,
  FlaskConical,
  Info,
  Microscope,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { RAW_MATERIALS_DATABASE } from '../data/rawMaterials';
import type { WorldPerfumeRecipe } from '../data/worldPerfumes';
import type { CalculationResult, FormulationState, PyramidNote } from '../types/perfume';
import type { SupportedLanguage } from '../types/i18n';
import { formatLocalizedNumber } from '../لغات/numerals';
import { isRTL } from '../لغات/localizedContent';
import { LocalizedNumberInput } from './LocalizedNumberInput';
import { analyzePyramidNotes, calculateIngredientMassGrams, matchRawMaterialName, parsePerfumeIngredientList, type FragrancePhase, type IngredientAnalysisRow } from '../utils/moleculeStudio';
import { PyramidCalculator } from './PyramidCalculator';
import { MacerationTimeSimulator } from './MacerationTimeSimulator';
import { WorldPerfumesLibrary } from './WorldPerfumesLibrary';

interface MoleculeStudioProps {
  currentLang: SupportedLanguage;
  formulation: FormulationState;
  pyramidNotes: PyramidNote[];
  setPyramidNotes: React.Dispatch<React.SetStateAction<PyramidNote[]>>;
  result: CalculationResult;
  formulaTitle: string;
  batchCode: string;
  macerationDays: number;
  setMacerationDays: (days: number) => void;
  macerationStartDate: string;
  setMacerationStartDate: (date: string) => void;
  onOpenSpecModal: () => void;
  onNavigateToTab: (tab: string) => void;
  onLoadWorldFormula: (recipe: WorldPerfumeRecipe) => void;
  onPrintWorldFormula: (recipe: WorldPerfumeRecipe) => void;
}

type StudioSection = 'compose' | 'analyze' | 'schedule' | 'references';
type Copy = (ar: string, en: string) => string;

const AROMATIC_MATERIALS = RAW_MATERIALS_DATABASE.filter(
  (material) => material.category !== 'solvent' && material.pyramidPlacement !== 'carrier',
);

const PHASES: FragrancePhase[] = ['top', 'heart', 'base'];

export const MoleculeStudio: React.FC<MoleculeStudioProps> = ({
  currentLang,
  formulation,
  pyramidNotes,
  setPyramidNotes,
  result,
  formulaTitle,
  batchCode,
  macerationDays,
  setMacerationDays,
  macerationStartDate,
  setMacerationStartDate,
  onOpenSpecModal,
  onNavigateToTab,
  onLoadWorldFormula,
  onPrintWorldFormula,
}) => {
  const rtl = isRTL(currentLang);
  const c: Copy = (ar, en) => currentLang === 'ar' ? ar : en;
  const number = (value: number, digits = 2) => formatLocalizedNumber(currentLang, value, { maximumFractionDigits: digits });
  const [section, setSection] = useState<StudioSection>('compose');
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<FragrancePhase>('heart');
  const [percentageDraft, setPercentageDraft] = useState(0);
  const [analysisTitle, setAnalysisTitle] = useState(formulaTitle);
  const [analysisText, setAnalysisText] = useState('');
  const [analysisRows, setAnalysisRows] = useState<IngredientAnalysisRow[]>([]);
  const [analysisIssues, setAnalysisIssues] = useState<string[]>([]);
  const [analysisSource, setAnalysisSource] = useState<'draft' | 'pasted' | null>(null);

  const matches = useMemo(() => {
    const query = materialSearch.trim().toLocaleLowerCase();
    if (!query) return AROMATIC_MATERIALS.slice(0, 16);
    return AROMATIC_MATERIALS.filter((item) =>
      [item.nameAr, item.nameEn, item.casNumber, item.olfactoryFamily]
        .some((field) => field.toLocaleLowerCase().includes(query)),
    ).slice(0, 30);
  }, [materialSearch]);

  const selectedMaterial = useMemo(
    () => AROMATIC_MATERIALS.find((item) => item.id === selectedMaterialId),
    [selectedMaterialId],
  );
  const selectedAlreadyAdded = selectedMaterial
    ? pyramidNotes.some((note) => {
        const match = matchRawMaterialName(note.nameEn || note.nameAr, RAW_MATERIALS_DATABASE);
        return match.status === 'matched' && match.material?.id === selectedMaterial.id;
      })
    : false;
  const currentTotal = pyramidNotes.reduce((sum, note) => sum + (Number.isFinite(note.percentageOfOil) ? note.percentageOfOil : 0), 0);
  const validPercentage = Number.isFinite(percentageDraft) && percentageDraft > 0 && percentageDraft <= 100;
  const canAddMaterial = Boolean(selectedMaterial && validPercentage && !selectedAlreadyAdded);

  const parsedTotal = analysisRows.reduce(
    (sum, row) => sum + (row.percentage !== undefined && !row.percentageIssue ? row.percentage : 0),
    0,
  );
  const missingPercentages = analysisRows.filter((row) => row.percentage === undefined).length;
  const verifiedNames = analysisRows.filter((row) => row.matchStatus === 'matched').length;

  const tabs: Array<{ id: StudioSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'compose', label: c('التركيب', 'Compose'), icon: Atom },
    { id: 'analyze', label: c('تحليل قائمة', 'Analyze list'), icon: Microscope },
    { id: 'schedule', label: c('التحضير والتعتيق', 'Preparation & aging'), icon: CalendarClock },
    { id: 'references', label: c('مكتبة مرجعية', 'Reference library'), icon: BookOpen },
  ];

  const chooseMaterial = (id: string) => {
    setSelectedMaterialId(id);
    const material = AROMATIC_MATERIALS.find((item) => item.id === id);
    if (material && (material.pyramidPlacement === 'top' || material.pyramidPlacement === 'heart' || material.pyramidPlacement === 'base')) {
      setSelectedPhase(material.pyramidPlacement);
    }
  };

  const addSelectedMaterial = () => {
    if (!selectedMaterial || !validPercentage || selectedAlreadyAdded) return;
    const material = selectedMaterial;
    const phase = selectedPhase;
    setPyramidNotes((current) => [
      ...current,
      {
        id: `studio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nameAr: material.nameAr,
        nameEn: material.nameEn,
        category: phase,
        percentageOfOil: percentageDraft,
        description: [
          material.casNumber ? `CAS: ${material.casNumber}` : undefined,
          material.olfactoryFamily,
        ].filter(Boolean).join(' · '),
      },
    ]);
    setPercentageDraft(0);
  };

  const analyzeDraft = () => {
    setAnalysisRows(analyzePyramidNotes(pyramidNotes, RAW_MATERIALS_DATABASE));
    setAnalysisIssues([]);
    setAnalysisTitle(formulaTitle);
    setAnalysisSource('draft');
    setSection('analyze');
  };

  const analyzePastedList = () => {
    const parsed = parsePerfumeIngredientList(analysisText, RAW_MATERIALS_DATABASE);
    setAnalysisRows(parsed.rows);
    setAnalysisIssues(parsed.issues);
    setAnalysisSource('pasted');
  };

  const phaseLabel = (phase: FragrancePhase | undefined) => {
    if (!phase) return c('غير محددة', 'Not specified');
    const labels: Record<FragrancePhase, string> = {
      top: c('القمة', 'Top'),
      heart: c('القلب', 'Heart'),
      base: c('القاعدة', 'Base'),
    };
    return labels[phase];
  };

  const localizeInputIssue = (issue: string) => currentLang === 'ar'
    ? issue
      .replace(/^Line (\d+): ingredient name is missing\.$/, 'السطر $1: اسم المكوّن مفقود.')
      .replace(/^Line (\d+): percentage must be between 0 and 100\.$/, 'السطر $1: يجب أن تكون النسبة بين 0 و100.')
    : issue;

  const renderAnalysisRow = (row: IngredientAnalysisRow) => {
    const mass = calculateIngredientMassGrams(row.percentage, result.batchTotalOilGrams);
    const displayName = currentLang === 'ar' && row.nameAr ? row.nameAr : row.name;
    const matchedLabel = row.matchStatus === 'matched'
      ? c('مطابقة اسم دقيقة', 'Exact name match')
      : row.matchStatus === 'ambiguous'
        ? c('مطابقة ملتبسة', 'Ambiguous match')
        : c('غير مفهرس', 'Not in reference index');

    return (
      <li key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words text-sm font-bold text-stone-900">{displayName}</h3>
            <p className="mt-1 text-xs text-stone-500">{phaseLabel(row.phase)}</p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.matchStatus === 'matched' ? 'bg-emerald-50 text-emerald-800' : row.matchStatus === 'ambiguous' ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>
            {row.matchStatus === 'matched' ? <Check className="h-3.5 w-3.5" /> : <CircleHelp className="h-3.5 w-3.5" />}
            {matchedLabel}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div className="rounded-xl bg-stone-50 p-2.5">
            <div className="text-stone-500">{c('النسبة من المركز', 'Concentrate share')}</div>
            <div className="mt-1 font-bold text-stone-900">
              {row.percentage === undefined ? c('غير مذكورة', 'Not provided') : `${number(row.percentage)}%`}
              {row.percentageIssue && <span className="ms-1 text-rose-700">{c('خارج النطاق', 'out of range')}</span>}
            </div>
          </div>
          <div className="rounded-xl bg-stone-50 p-2.5">
            <div className="text-stone-500">{c('الوزن المحسوب', 'Calculated mass')}</div>
            <div className="mt-1 font-bold text-stone-900">
              {mass === undefined ? '—' : `${number(mass)} ${c('جم', 'g')}`}
            </div>
          </div>
          <div className="col-span-2 rounded-xl bg-stone-50 p-2.5 sm:col-span-1">
            <div className="text-stone-500">{c('سجل الموسوعة', 'Reference record')}</div>
            <div className="mt-1 break-words font-bold text-stone-900">
              {row.material?.casNumber
                ? `CAS ${row.material.casNumber}`
                : row.matchStatus === 'ambiguous'
                  ? c(`${row.candidates?.length ?? 0} سجلات محتملة`, `${row.candidates?.length ?? 0} possible records`)
                  : c('لا يوجد CAS مطابق', 'No matching CAS')}
            </div>
          </div>
        </div>
        {row.matchStatus === 'ambiguous' && row.candidates && (
          <p className="mt-2 text-[11px] leading-5 text-amber-800">
            {c('اكتب الاسم الكامل من الموسوعة لتحديد السجل المقصود.', 'Use the full reference name to identify the intended record.')}
          </p>
        )}
      </li>
    );
  };

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="space-y-6 animate-in fade-in duration-300">
      <section className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 p-6 text-white shadow-xl sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -end-16 -top-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />{c('استوديو العطور متعدد المراحل', 'Perfume formulation workspace')}
            </span>
            <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">{c('مختبر تركيب وتحليل العطور', 'Perfume composition & analysis studio')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-200">
              {c('ابنِ تركيبتك من مواد العطر، راجع نسب قائمة المكونات، ثم خطّط التحضير والتعتيق من مساحة واحدة.', 'Build a formula from fragrance materials, review ingredient-list proportions, then plan preparation and maceration in one workspace.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSpecModal}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-500 px-4 py-2.5 text-sm font-bold text-stone-950 shadow-sm transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-stone-950"
          >
            <Printer className="h-4 w-4" />{c('بطاقة التصنيع', 'Manufacturing sheet')}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5" aria-label={c('ملاحظة حول حدود التحليل', 'Analysis limits')}>
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" />
          <div className="text-xs leading-6 text-stone-700 sm:text-sm">
            <strong className="text-stone-900">{c('تنبيه دقة مهم: ', 'Important accuracy note: ')}</strong>
            {c('المحلّل يراجع قائمة تركيبة تدخلها أو تحملها من مسودتك ويطابق الأسماء مع موسوعة المواد في الموقع. لا يكشف التركيبة السرية لعطر تجاري، ولا يجري تحليل GC‑MS. التركيبات المرجعية المعروضة «مستوحاة» وليست صيغة أصلية مؤكدة.', 'The analyzer reviews a list you provide or load from your draft and matches names against this site’s materials index. It does not reveal a commercial perfume’s proprietary formula or perform GC‑MS. Reference blends are inspired examples, not verified original formulas.')}
          </div>
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xs" role="tablist" aria-label={c('أقسام استوديو العطور', 'Studio sections')}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition sm:text-sm ${section === id ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950'}`}
          >
            <Icon className="h-4 w-4" />{label}
            {id === 'compose' && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${section === id ? 'bg-white/15 text-white' : 'bg-stone-100 text-stone-500'}`}>{number(pyramidNotes.length, 0)}</span>}
          </button>
        ))}
      </nav>

      {section === 'compose' && (
        <div role="tabpanel" className="space-y-6">
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900"><Atom className="h-5 w-5 text-amber-700" />{c('أضف مادة أو جزيئاً إلى التركيبة', 'Add a material or molecule')}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-6 text-stone-600 sm:text-sm">{c('ابحث بالاسم أو رقم CAS، ثم اختر المرحلة والنسبة. قاعدة الموقع تضم خامات طبيعية ومركبات وأكوردات؛ ليست كل خانة جزيئاً منفرداً.', 'Search by name or CAS, then choose a phase and percentage. The site index includes natural materials, compounds, and accords—not every entry is a single molecule.')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700">
                <Beaker className="h-4 w-4 text-amber-700" />
                <span>{c('إجمالي النسب الحالية', 'Current total')}</span>
                <span className={currentTotal > 100.01 ? 'text-rose-700' : 'text-stone-950'}>{number(currentTotal)}%</span>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
              <div>
                <label htmlFor="studio-material-search" className="mb-2 block text-xs font-semibold text-stone-700">{c('ابحث في موسوعة الخامات', 'Search the materials index')}</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    id="studio-material-search"
                    type="search"
                    dir="auto"
                    value={materialSearch}
                    onChange={(event) => setMaterialSearch(event.target.value)}
                    placeholder={c('الاسم العربي أو الإنجليزي أو CAS…', 'Arabic/English name or CAS…')}
                    className="w-full rounded-xl border border-stone-300 bg-white py-3 ps-10 pe-3 text-sm text-stone-900 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
                  />
                </div>
                <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pe-1" aria-label={c('نتائج المواد', 'Material results')}>
                  {matches.map((material) => (
                    <li key={material.id}>
                      <button
                        type="button"
                        onClick={() => chooseMaterial(material.id)}
                        aria-pressed={selectedMaterialId === material.id}
                        className={`w-full rounded-xl border p-3 text-start transition ${selectedMaterialId === material.id ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500/20' : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'}`}
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-stone-900">{currentLang === 'ar' ? material.nameAr : material.nameEn}</span>
                          {material.casNumber && <span className="text-[10px] text-stone-500">CAS {material.casNumber}</span>}
                        </span>
                        <span className="mt-1 block text-[11px] text-stone-500">{currentLang === 'ar' ? material.olfactoryFamily : material.category}</span>
                      </button>
                    </li>
                  ))}
                  {matches.length === 0 && (
                    <li className="rounded-xl border border-dashed border-stone-300 p-4 text-center text-xs text-stone-500">{c('لا توجد نتائج مطابقة. جرّب اسماً آخر أو رقم CAS.', 'No matches. Try another name or CAS number.')}</li>
                  )}
                </ul>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 sm:p-5">
                {selectedMaterial ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-stone-600 ring-1 ring-stone-200"><FlaskConical className="h-3 w-3 text-amber-700" />{c('سجل مادة خام', 'Material reference')}</span>
                    <h3 className="mt-3 text-base font-bold text-stone-950">{currentLang === 'ar' ? selectedMaterial.nameAr : selectedMaterial.nameEn}</h3>
                    <p className="mt-1 text-xs leading-5 text-stone-600">{selectedMaterial.olfactoryFamily}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-lg bg-white px-2 py-1 text-stone-600 ring-1 ring-stone-200">CAS {selectedMaterial.casNumber || c('غير متاح', 'not listed')}</span>
                      <span className="rounded-lg bg-white px-2 py-1 text-stone-600 ring-1 ring-stone-200">{currentLang === 'ar' ? selectedMaterial.categoryAr : selectedMaterial.category}</span>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <span className="mb-2 block text-xs font-semibold text-stone-700">{c('المرحلة في هرمك', 'Your pyramid phase')}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {PHASES.map((phase) => (
                            <button key={phase} type="button" onClick={() => setSelectedPhase(phase)} aria-pressed={selectedPhase === phase} className={`rounded-lg px-2.5 py-2 text-[11px] font-semibold ${selectedPhase === phase ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100'}`}>
                              {phaseLabel(phase)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label htmlFor="studio-material-percent" className="mb-2 block text-xs font-semibold text-stone-700">{c('النسبة من مركز العطر (%)', 'Share of concentrate (%)')}</label>
                        <div className="flex items-center gap-2">
                          <LocalizedNumberInput
                            id="studio-material-percent"
                            lang={currentLang}
                            value={Number.isFinite(percentageDraft) ? percentageDraft : 0}
                            onValue={setPercentageDraft}
                            min={0}
                            max={100}
                            placeholder="0"
                            ariaLabel={c('النسبة من مركز العطر', 'Share of concentrate')}
                            className="min-w-0 w-28 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
                          />
                          <span className="text-sm font-bold text-stone-500">%</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-950">
                      <Info className="me-1 inline h-3.5 w-3.5 align-text-bottom" />
                      {c('النسبة من إدخالك وليست توصية سلامة. راجع SDS وحدود IFRA الخاصة بالمورد قبل وزن أي خامة أو استخدامها على الجلد.', 'This is your entered proportion, not a safety recommendation. Check the supplier SDS and applicable IFRA limits before weighing or applying any material.')}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={addSelectedMaterial} disabled={!canAddMaterial} className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-300">
                        {selectedAlreadyAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {selectedAlreadyAdded ? c('موجودة في المسودة', 'Already in draft') : c('أضف إلى التركيبة', 'Add to formula')}
                      </button>
                      <span className="text-[11px] text-stone-500">{c('المجموع بعد الإضافة', 'Total after adding')}: {number(currentTotal + (validPercentage ? percentageDraft : 0))}%</span>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center text-center text-stone-500">
                    <Atom className="h-9 w-9 text-amber-600" />
                    <p className="mt-3 text-sm font-semibold text-stone-700">{c('اختر مادة من القائمة', 'Choose a material')}</p>
                    <p className="mt-1 max-w-xs text-xs leading-5">{c('ستظهر هنا بيانات السجل، ورقم CAS إن كان مدرجاً، ثم تختار أنت النسبة والمرحلة.', 'The reference details and listed CAS appear here; you choose the proportion and phase.')}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <div>
              <div className="text-sm font-bold text-stone-900">{c('مسودة التركيبة الحالية', 'Current formula draft')}: {formulaTitle}</div>
              <div className="mt-1 text-xs text-stone-500">{number(pyramidNotes.length, 0)} {c('مكوّن/مكوّنات', 'ingredient(s)')} · {c('مركز الدفعة', 'Batch concentrate')}: {number(result.batchTotalOilGrams)} {c('جم', 'g')}</div>
            </div>
            <button type="button" onClick={analyzeDraft} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-700 transition hover:bg-stone-50">
              <Microscope className="h-4 w-4 text-amber-700" />{c('تحليل المسودة', 'Analyze this draft')}
            </button>
          </div>

          <PyramidCalculator
            currentLang={currentLang}
            formulation={formulation}
            pyramidNotes={pyramidNotes}
            setPyramidNotes={setPyramidNotes}
            result={result}
          />
        </div>
      )}

      {section === 'analyze' && (
        <div role="tabpanel" className="space-y-5">
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900"><Microscope className="h-5 w-5 text-amber-700" />{c('تحليل قائمة المكوّنات والنِسَب', 'Ingredient-list & proportion review')}</h2>
                <p className="mt-1 text-xs leading-6 text-stone-600 sm:text-sm">{c('ألصق قائمة معلومة، أو افحص مسودة المعمل. يعرض النظام ما ذُكر فقط، ويحسب الوزن من إجمالي المركز الحالي عند توفر النسبة.', 'Paste a known list or inspect the current lab draft. Only supplied data is shown; weights are calculated from the current concentrate batch when a percentage is provided.')}</p>
              </div>
              <button type="button" onClick={analyzeDraft} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-stone-800">
                <ClipboardList className="h-4 w-4" />{c('استخدم مسودة المعمل', 'Use lab draft')}
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
              <div>
                <label htmlFor="studio-analysis-title" className="mb-2 block text-xs font-semibold text-stone-700">{c('اسم العطر أو العينة (اختياري)', 'Perfume or sample name (optional)')}</label>
                <input id="studio-analysis-title" dir="auto" value={analysisTitle} onChange={(event) => setAnalysisTitle(event.target.value)} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15" placeholder={c('مثال: عينة رقم 04', 'e.g. Sample 04')} />
              </div>
              <div>
                <label htmlFor="studio-analysis-input" className="mb-2 block text-xs font-semibold text-stone-700">{c('قائمة المكوّنات (سطر لكل مادة)', 'Ingredient list (one material per line)')}</label>
                <textarea
                  id="studio-analysis-input"
                  dir="auto"
                  value={analysisText}
                  onChange={(event) => setAnalysisText(event.target.value)}
                  rows={5}
                  placeholder={'Hedione | heart | 12%\nAmbroxan | base | 8%\nBergamot | top | 5%'}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 font-mono text-xs leading-6 text-stone-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
                />
                <p className="mt-1 text-[11px] text-stone-500">{c('الصيغة المقترحة: الاسم | top / heart / base | النسبة. يمكنك ترك المرحلة أو النسبة فارغة.', 'Suggested format: name | top / heart / base | percentage. Phase or percentage may be omitted.')}</p>
                <button type="button" onClick={analyzePastedList} disabled={!analysisText.trim()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-300">
                  <Search className="h-4 w-4" />{c('حلّل القائمة المدخلة', 'Review pasted list')}
                </button>
              </div>
            </div>
          </section>

          {analysisRows.length > 0 && (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={c('ملخص التحليل', 'Analysis summary')}>
                {[
                  { label: c('عدد البنود', 'Entries'), value: number(analysisRows.length, 0), icon: ClipboardList },
                  { label: c('مطابقات اسم دقيقة', 'Exact name matches'), value: number(verifiedNames, 0), icon: Check },
                  { label: c('إجمالي النسب المذكورة', 'Sum of supplied proportions'), value: `${number(parsedTotal)}%`, icon: Beaker },
                  { label: c('نِسَب غير مذكورة', 'Missing proportions'), value: number(missingPercentages, 0), icon: CircleHelp },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center gap-2 text-xs text-stone-500"><Icon className="h-4 w-4 text-amber-700" />{label}</div>
                    <div className="mt-2 text-xl font-extrabold text-stone-950">{value}</div>
                  </div>
                ))}
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-bold text-stone-900">{analysisTitle || c('قائمة المكوّنات', 'Ingredient list')}</h3>
                    <p className="mt-1 text-xs text-stone-500">{analysisSource === 'draft' ? c('المصدر: مسودة المعمل الحالية', 'Source: current lab draft') : c('المصدر: النص الذي أدخلته', 'Source: your pasted text')}</p>
                  </div>
                  {missingPercentages === 0 && analysisRows.length > 0 && (
                    <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${Math.abs(parsedTotal - 100) < 0.05 ? 'bg-emerald-50 text-emerald-800' : parsedTotal > 100 ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
                      {Math.abs(parsedTotal - 100) < 0.05
                        ? c('مجموع النسب = 100%', 'Proportions total 100%')
                        : parsedTotal > 100
                          ? c('المجموع يتجاوز 100% — راجع القائمة', 'Total exceeds 100% — review the list')
                          : c(`المجموع ${number(parsedTotal)}% — القائمة قد تكون جزئية`, `Total ${number(parsedTotal)}% — the list may be partial`)}
                    </div>
                  )}
                </div>
                {analysisIssues.length > 0 && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900" role="status">
                    <strong>{c('تنبيهات الإدخال: ', 'Input notes: ')}</strong>{analysisIssues.map(localizeInputIssue).join(' · ')}
                  </div>
                )}
                <ul className="mt-4 grid gap-3 lg:grid-cols-2">{analysisRows.map(renderAnalysisRow)}</ul>
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-[11px] leading-5 text-stone-600">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
                  <span>{c('الوزن المحسوب = النسبة المدخلة × إجمالي الزيت العطري في إعداد الدفعة الحالي. النتيجة حسابية للمراجعة وليست تحليلاً مخبرياً أو توصية استعمال.', 'Calculated mass = supplied proportion × the fragrance-concentrate mass in the current batch settings. This is arithmetic for review, not a laboratory analysis or use recommendation.')}</span>
                </div>
              </section>
            </>
          )}
          {analysisRows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
              <Microscope className="mx-auto h-9 w-9 text-amber-700" />
              <p className="mt-3 text-sm font-bold text-stone-800">{c('ابدأ بتحليل مسودة أو ألصق قائمة', 'Start with a draft or paste a list')}</p>
              <p className="mx-auto mt-1 max-w-lg text-xs leading-6 text-stone-600">{c('ستظهر هنا النسب المذكورة، الأوزان الحسابية، وأي تطابق دقيق مع سجل خامة ورقم CAS. الأسماء المركّبة أو الأكوردات ستبقى غير مؤكدة.', 'Supplied proportions, calculated weights, and exact matches to a material/CAS record appear here. Composite names and accords remain unverified.')}</p>
            </div>
          )}
        </div>
      )}

      {section === 'schedule' && (
        <div role="tabpanel" className="space-y-5">
          <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900"><CalendarClock className="h-5 w-5 text-amber-700" />{c('جدول التحضير والتعتيق', 'Preparation & maceration schedule')}</h2>
                <p className="mt-1 text-xs leading-6 text-stone-600">{c('الخطة مرتبطة باسم التركيبة وكود الدفعة، وتُحفظ مدتها وتاريخ بدايتها في جلسة المعمل الحالية.', 'The plan is linked to the formula name and batch code; its duration and start date are kept in the current lab session.')}</p>
              </div>
              <button type="button" onClick={onOpenSpecModal} className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-bold text-stone-700 transition hover:bg-stone-50"><Printer className="h-4 w-4 text-amber-700" />{c('طباعة بطاقة التصنيع', 'Print manufacturing sheet')}</button>
            </div>
          </section>
          <MacerationTimeSimulator
            currentLang={currentLang}
            initialStartDate={macerationStartDate}
            initialMacerationDays={macerationDays}
            formulaTitle={formulaTitle}
            batchCode={batchCode}
            onMacerationDaysChange={setMacerationDays}
            onStartDateChange={setMacerationStartDate}
            onOpenConsultation={(prompt) => window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: prompt }))}
            onNavigateToTab={onNavigateToTab}
          />
        </div>
      )}

      {section === 'references' && (
        <div role="tabpanel" className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs leading-6 text-sky-950 sm:text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sky-800" />
            <p>{c('مكتبة العطور أمثلة تعليمية «مستوحاة من»؛ النوتات والنسب فيها لا تمثل تحليلاً مؤكداً أو تركيبة أصلية منشورة من الشركة المصنّعة.', 'The perfume library contains educational “inspired by” examples; its notes and proportions are not verified analyses or manufacturers’ original formulas.')}</p>
          </div>
          <WorldPerfumesLibrary
            currentLang={currentLang}
            onLoadWorldFormula={onLoadWorldFormula}
            onPrintWorldFormula={onPrintWorldFormula}
          />
        </div>
      )}
    </div>
  );
};
