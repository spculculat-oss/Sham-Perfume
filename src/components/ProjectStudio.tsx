import React, { useRef, useState } from 'react';
import { Archive, Download, FileUp, FlaskConical, Layers3, Plus, RotateCcw, Save, Trash2, Copy, History } from 'lucide-react';
import type { FragranceProject, IngredientRole } from '../types/fragranceProject';
import type { SavedFormula } from '../types/perfume';
import type { SupportedLanguage } from '../types/i18n';
import { LocalizedNumberInput } from './LocalizedNumberInput';
import { WORLD_CURRENCIES } from '../data/worldCurrencies';
import { calculateProjectIngredientAmounts, exportProjectCollection, importProjectExport } from '../utils/fragranceProjects';
import { calculateProjectCostLedger, createProjectCostLedger, validateProjectCostLedger } from '../utils/projectCostLedger';
import { addProjectExperiment, createProjectExperiment, deleteProjectExperiment, updateProjectExperiment, type ProjectExperimentInput } from '../utils/projectJournal';

interface Props {
  lang: SupportedLanguage;
  projects: FragranceProject[];
  activeProjectId: string | null;
  legacyFormulas: SavedFormula[];
  onCreate: (name: string) => void;
  onSelect: (project: FragranceProject) => void;
  onUpdate: (project: FragranceProject) => void;
  onDuplicate: (project: FragranceProject) => void;
  onArchive: (project: FragranceProject) => void;
  onRestore: (project: FragranceProject) => void;
  onDelete: (project: FragranceProject) => void;
  onSaveVersion: (project: FragranceProject, note: string) => void;
  onRestoreVersion: (project: FragranceProject, versionId: string) => void;
  onImportLegacy: () => { importedCount: number; skippedCount: number };
  onImportProjects: (projects: FragranceProject[]) => void;
  onNavigate: (tab: string) => void;
  onPrint: () => void;
  defaultCurrency: string;
}

export function ProjectStudio(props: Props) {
  const { lang, projects, activeProjectId, legacyFormulas } = props;
  const ar = lang === 'ar';
  const text = (arText: string, enText: string) => ar ? arText : enText;
  const money = (value: number, currency: string) => {
    try { return new Intl.NumberFormat(lang, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
    catch { return `${value.toFixed(2)} ${currency}`; }
  };
  const [name, setName] = useState('');
  const [editName, setEditName] = useState('');
  const [versionNote, setVersionNote] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [ingredientName, setIngredientName] = useState('');
  const [ingredientPercent, setIngredientPercent] = useState(0);
  const [ingredientRole, setIngredientRole] = useState<IngredientRole>('other');
  const [ledgerLineLabel, setLedgerLineLabel] = useState('');
  const [ledgerLineAmount, setLedgerLineAmount] = useState(0);
  const [ledgerLineCategory, setLedgerLineCategory] = useState<'materials' | 'packaging' | 'labor' | 'shipping' | 'other'>('materials');
  const [ledgerLineTaxable, setLedgerLineTaxable] = useState(false);
  const [journalEditingId, setJournalEditingId] = useState<string | null>(null);
  const [journalBatchCode, setJournalBatchCode] = useState('');
  const [journalDate, setJournalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [journalConditions, setJournalConditions] = useState('');
  const [journalObservation, setJournalObservation] = useState('');
  const [journalEvaluation, setJournalEvaluation] = useState('');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const active = projects.find((item) => item.id === activeProjectId);
  const visible = projects.filter((item) => showArchived || item.status === 'active');
  const importableLegacyCount = legacyFormulas.filter((formula) => !projects.some((project) => project.legacyFormula?.id === formula.id)).length;

  const exportProjects = () => {
    try {
      const blob = new Blob([exportProjectCollection(projects)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sham-perfume-projects-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(text('تم تصدير المشاريع كملف JSON.', 'Projects exported as JSON.'));
    } catch {
      setMessage(text('تعذر إنشاء ملف التصدير.', 'Could not create the export file.'));
    }
  };

  const addIngredient = (event: React.FormEvent) => {
    event.preventDefault();
    if (!active) return;
    const percentage = ingredientPercent;
    if (!ingredientName.trim() || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      setMessage(text('أدخل اسمًا ونسبة بين 0 و100.', 'Enter a name and a percentage from 0 to 100.'));
      return;
    }
    const line = {
      id: globalThis.crypto?.randomUUID?.() ?? `ingredient-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: ingredientName.trim(),
      role: ingredientRole,
      percentage,
    };
    props.onUpdate({ ...active, formula: { ...active.formula, ingredientLines: [...active.formula.ingredientLines, line] }, updatedAt: new Date().toISOString() });
    setIngredientName('');
    setIngredientPercent(0);
    setMessage(text('تمت إضافة خط المكوّن. الكثافة غير محددة ما لم تُدخل وتُوثق.', 'Ingredient line added. Density stays unspecified unless explicitly provided and sourced.'));
  };

  const updateIngredient = (id: string, patch: { percentage?: number; role?: IngredientRole; density?: { gramsPerMl: number; confidence: 'unverified' } | null }) => {
    if (!active) return;
    const ingredientLines = active.formula.ingredientLines.map((line) => {
      if (line.id !== id) return line;
      const next = { ...line, ...(patch.percentage !== undefined ? { percentage: patch.percentage } : {}), ...(patch.role ? { role: patch.role } : {}) };
      if (patch.density === null) delete next.density;
      else if (patch.density) next.density = patch.density;
      return next;
    });
    props.onUpdate({ ...active, formula: { ...active.formula, ingredientLines }, updatedAt: new Date().toISOString() });
  };

  const removeIngredient = (id: string) => {
    if (!active) return;
    props.onUpdate({ ...active, formula: { ...active.formula, ingredientLines: active.formula.ingredientLines.filter((line) => line.id !== id) }, updatedAt: new Date().toISOString() });
  };

  const updateLedger = (patch: Partial<NonNullable<FragranceProject['costLedger']>>) => {
    if (!active) return;
    const base = active.costLedger ?? createProjectCostLedger(props.defaultCurrency);
    const next = { ...base, ...patch };
    if (!validateProjectCostLedger(next)) {
      setMessage(text('قيمة غير صالحة؛ لم تُحفظ.', 'Invalid value; not saved.'));
      return;
    }
    props.onUpdate({ ...active, costLedger: next, updatedAt: new Date().toISOString() });
  };

  const addLedgerLine = (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || !ledgerLineLabel.trim() || !Number.isFinite(ledgerLineAmount) || ledgerLineAmount < 0) return;
    const base = active.costLedger ?? createProjectCostLedger(props.defaultCurrency);
    const next = { ...base, lines: [...base.lines, {
      id: globalThis.crypto?.randomUUID?.() ?? `expense-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: ledgerLineLabel.trim(), category: ledgerLineCategory, batchAmount: ledgerLineAmount, subjectToInputTax: ledgerLineTaxable,
    }] };
    if (!validateProjectCostLedger(next)) return;
    props.onUpdate({ ...active, costLedger: next, updatedAt: new Date().toISOString() });
    setLedgerLineLabel('');
    setLedgerLineAmount(0);
    setLedgerLineTaxable(false);
  };

  const updateLedgerLine = (id: string, batchAmount: number) => {
    if (!active?.costLedger || !Number.isFinite(batchAmount) || batchAmount < 0) return;
    const next = { ...active.costLedger, lines: active.costLedger.lines.map((line) => line.id === id ? { ...line, batchAmount } : line) };
    if (validateProjectCostLedger(next)) props.onUpdate({ ...active, costLedger: next, updatedAt: new Date().toISOString() });
  };

  const updateLedgerLineTaxTreatment = (id: string, subjectToInputTax: boolean) => {
    if (!active?.costLedger) return;
    const next = { ...active.costLedger, lines: active.costLedger.lines.map((line) => line.id === id ? { ...line, subjectToInputTax } : line) };
    if (validateProjectCostLedger(next)) props.onUpdate({ ...active, costLedger: next, updatedAt: new Date().toISOString() });
  };

  const removeLedgerLine = (id: string) => {
    if (!active?.costLedger) return;
    props.onUpdate({ ...active, costLedger: { ...active.costLedger, lines: active.costLedger.lines.filter((line) => line.id !== id) }, updatedAt: new Date().toISOString() });
  };

  const clearJournalForm = () => {
    setJournalEditingId(null);
    setJournalBatchCode('');
    setJournalDate(new Date().toISOString().slice(0, 10));
    setJournalConditions('');
    setJournalObservation('');
    setJournalEvaluation('');
  };

  const saveJournalEntry = (event: React.FormEvent) => {
    event.preventDefault();
    if (!active) return;
    const input: ProjectExperimentInput = {
      batchCode: journalBatchCode,
      observedAt: journalDate,
      conditions: journalConditions,
      observation: journalObservation,
      evaluation: journalEvaluation,
    };
    try {
      const updated = journalEditingId
        ? updateProjectExperiment(active, journalEditingId, input)
        : addProjectExperiment(active, createProjectExperiment(input));
      props.onUpdate(updated);
      clearJournalForm();
      setMessage(text('تم حفظ سجل الملاحظة.', 'Observation saved.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text('تعذر حفظ الملاحظة.', 'Could not save observation.'));
    }
  };

  const editJournalEntry = (entry: FragranceProject['experiments'][number]) => {
    setJournalEditingId(entry.id);
    setJournalBatchCode(entry.batchCode);
    setJournalDate(entry.observedAt);
    setJournalConditions(entry.conditions);
    setJournalObservation(entry.observation);
    setJournalEvaluation(entry.evaluation);
  };

  const removeJournalEntry = (id: string) => {
    if (!active || !window.confirm(text('حذف هذه الملاحظة من سجل المشروع؟', 'Delete this project observation?'))) return;
    try { props.onUpdate(deleteProjectExperiment(active, id)); }
    catch (error) { setMessage(error instanceof Error ? error.message : text('تعذر حذف الملاحظة.', 'Could not delete entry.')); }
  };

  const readImport = async (file?: File) => {
    if (!file) return;
    try {
      const incoming = importProjectExport(await file.text());
      props.onImportProjects(incoming);
      setMessage(text(`تم استيراد ${incoming.length} مشروعًا.`, `Imported ${incoming.length} project(s).`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text('ملف غير صالح.', 'Invalid project file.'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveProjectName = () => {
    if (!active || !editName.trim()) return;
    props.onUpdate({ ...active, name: editName.trim(), updatedAt: new Date().toISOString() });
    setMessage(text('تم تحديث اسم المشروع.', 'Project name updated.'));
  };

  return (
    <section className="space-y-6" data-testid="project-studio">
      <header className="rounded-3xl border border-amber-200 bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 p-6 sm:p-8 text-white">
        <div className="flex items-start gap-4">
          <span className="rounded-2xl bg-amber-100/10 p-3"><FlaskConical className="h-7 w-7 text-amber-300" /></span>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[.2em] text-amber-200">SHAM PERFUME 2.0</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black">{text('استوديو المشاريع', 'Project Studio')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-200">{text('كل مشروع يحتفظ بتركيبته وهرمه ونسخه محليًا على هذا الجهاز. المشاريع خاصة ولا تُزامن سحابيًا في هذه المرحلة.', 'Each project keeps its formulation, pyramid, and versions locally on this device. Projects are private and are not cloud-synced in this phase.')}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-black text-lg">{text('مشاريعي', 'My projects')} <span className="text-sm text-stone-500">({visible.length})</span></h2>
            <button type="button" onClick={() => setShowArchived((value) => !value)} className="text-xs underline underline-offset-4 text-stone-600">
              {showArchived ? text('إخفاء المؤرشفة', 'Hide archived') : text('عرض المؤرشفة', 'Show archived')}
            </button>
          </div>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (name.trim()) { props.onCreate(name); setName(''); } }}>
            <input value={name} onChange={(event) => setName(event.target.value)} aria-label={text('اسم المشروع الجديد', 'New project name')} placeholder={text('اسم المشروع الجديد', 'New project name')} className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm" />
            <button className="inline-flex items-center gap-1 rounded-xl bg-amber-800 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" />{text('إنشاء', 'Create')}</button>
          </form>
          {importableLegacyCount > 0 && <button type="button" onClick={() => { const result = props.onImportLegacy(); setMessage(text(`تم استيراد ${result.importedCount} وصفة دون حذفها من المكتبة القديمة. تُركت ${result.skippedCount} وصفة غير صالحة دون تغيير.`, `Imported ${result.importedCount} formula(s); the old library was left unchanged. ${result.skippedCount} invalid record(s) were skipped.`)); }} className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-start text-sm font-bold text-amber-950">
            {text(`استيراد ${importableLegacyCount} وصفة من المكتبة القديمة (اختياري)`, `Import ${importableLegacyCount} legacy formula(s) (optional)`)}
          </button>}
          {visible.length === 0 ? <p className="rounded-xl bg-stone-50 p-5 text-sm text-stone-500">{text('لا توجد مشاريع بعد. أنشئ مشروعًا أو استورد وصفاتك القديمة.', 'No projects yet. Create one or optionally import your legacy formulas.')}</p> : (
            <div className="max-h-[34rem] space-y-2 overflow-auto">
              {visible.map((project) => <article key={project.id} className={`rounded-xl border p-3 ${project.id === activeProjectId ? 'border-amber-500 bg-amber-50/60' : 'border-stone-200'}`}>
                <button type="button" onClick={() => { setEditName(project.name); props.onSelect(project); }} className="w-full text-start">
                  <span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{project.name}</strong><span className="text-[10px] uppercase text-stone-500">{project.status}</span></span>
                  <span className="mt-1 block text-xs text-stone-500">{new Date(project.updatedAt).toLocaleDateString(lang)} · {project.formula.ingredientLines.length} {text('خطوط', 'lines')} · {project.pyramid.length} {text('نوتات', 'notes')}</span>
                </button>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {project.status === 'active' ? <>
                    <button type="button" onClick={() => props.onDuplicate(project)} className="rounded-lg border px-2 py-1 text-xs"><Copy className="me-1 inline h-3 w-3" />{text('نسخ', 'Duplicate')}</button>
                    <button type="button" onClick={() => { if (window.confirm(text('أرشفة المشروع؟ يمكنك استعادته لاحقًا.', 'Archive this project? You can restore it later.'))) props.onArchive(project); }} className="rounded-lg border px-2 py-1 text-xs"><Archive className="me-1 inline h-3 w-3" />{text('أرشفة', 'Archive')}</button>
                  </> : <>
                    <button type="button" onClick={() => props.onRestore(project)} className="rounded-lg border px-2 py-1 text-xs"><RotateCcw className="me-1 inline h-3 w-3" />{text('استعادة', 'Restore')}</button>
                    <button type="button" onClick={() => { if (window.confirm(text('حذف نهائي لهذا المشروع؟ لا يمكن التراجع عن الحذف.', 'Permanently delete this project? This cannot be undone.'))) props.onDelete(project); }} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700"><Trash2 className="me-1 inline h-3 w-3" />{text('حذف نهائي', 'Delete permanently')}</button>
                  </>}
                </div>
              </article>)}
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-4">
            <button type="button" onClick={exportProjects} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold"><Download className="h-4 w-4" />{text('تصدير JSON', 'Export JSON')}</button>
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold"><FileUp className="h-4 w-4" />{text('استيراد JSON', 'Import JSON')}</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => void readImport(event.target.files?.[0])} />
          </div>
          {message && <p role="status" className="text-xs text-stone-600">{message}</p>}
        </div>

        <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
          {!active ? <div className="rounded-xl bg-stone-50 p-6 text-center text-sm text-stone-500">{text('اختر مشروعًا لربطه بأدوات المعمل.', 'Select a project to connect it to the lab tools.')}</div> : <>
            <div className="flex flex-wrap items-center gap-3">
              <Layers3 className="h-5 w-5 text-amber-800" />
              <h2 className="flex-1 text-lg font-black">{text('المشروع المحدد', 'Selected project')}: {active.name}</h2>
              <button type="button" onClick={() => props.onNavigate('concentration')} className="rounded-xl bg-amber-800 px-3 py-2 text-xs font-bold text-white">{text('فتح الحاسبة', 'Open calculator')}</button>
              <button type="button" onClick={props.onPrint} className="rounded-xl border px-3 py-2 text-xs font-bold">{text('بطاقة المواصفات', 'Spec sheet')}</button>
            </div>
            <div className="flex gap-2">
              <input value={editName || active.name} onFocus={() => setEditName(active.name)} onChange={(event) => setEditName(event.target.value)} aria-label={text('اسم المشروع', 'Project name')} className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              <button type="button" onClick={saveProjectName} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold"><Save className="h-4 w-4" />{text('حفظ الاسم', 'Save name')}</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold">{text('العائلة العطرية (اختياري)', 'Fragrance family (optional)')}<input value={active.family} onChange={(event) => props.onUpdate({ ...active, family: event.target.value, updatedAt: new Date().toISOString() })} className="w-full rounded-lg border px-3 py-2 font-normal" /></label>
              <label className="space-y-1 text-xs font-semibold">{text('نوع المنتج المستهدف', 'Target product type')}<select value={active.targetProductType} onChange={(event) => props.onUpdate({ ...active, targetProductType: event.target.value, updatedAt: new Date().toISOString() })} className="w-full rounded-lg border bg-white px-3 py-2 font-normal"><option value="perfume">{text('عطر', 'Perfume')}</option><option value="body_mist">{text('رذاذ للجسم', 'Body mist')}</option><option value="perfume_oil">{text('زيت عطري', 'Perfume oil')}</option><option value="other">{text('أخرى', 'Other')}</option></select></label>
              <label className="space-y-1 text-xs font-semibold sm:col-span-2">{text('وصف المشروع', 'Project description')}<textarea value={active.description} onChange={(event) => props.onUpdate({ ...active, description: event.target.value, updatedAt: new Date().toISOString() })} rows={2} className="w-full rounded-lg border px-3 py-2 font-normal" /></label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => props.onNavigate('pyramid')} className="rounded-xl border border-stone-200 p-3 text-start text-sm hover:bg-stone-50"><Layers3 className="mb-2 h-4 w-4 text-amber-800" />{text('الهرم العطري', 'Fragrance pyramid')} · {active.pyramid.length}</button>
              <button type="button" onClick={() => props.onNavigate('raw_materials')} className="rounded-xl border border-stone-200 p-3 text-start text-sm hover:bg-stone-50"><FlaskConical className="mb-2 h-4 w-4 text-amber-800" />{text('المواد الخام', 'Raw materials')} · {active.formula.ingredientLines.length}</button>
              <button type="button" onClick={() => props.onNavigate('costing')} className="rounded-xl border border-stone-200 p-3 text-start text-sm hover:bg-stone-50">{text('التكلفة', 'Costing')} · {active.costing?.currency ?? text('غير محفوظة', 'not saved')}</button>
            </div>
            <div className="space-y-3 rounded-xl border border-stone-200 p-3">
              <div>
                <h3 className="font-bold text-sm">{text('مكوّنات المركز العطري', 'Fragrance concentrate ingredients')}</h3>
                <p className="mt-1 text-xs text-stone-500">{text('النسب هنا من إجمالي المركز العطري، ولا تمثل إثباتًا للسلامة أو الأداء. أدخل الكثافة فقط عند توفر بيانات مناسبة.', 'Percentages are shares of the fragrance concentrate, not evidence of safety or performance. Enter density only when you have appropriate data.')}</p>
              </div>
              <form onSubmit={addIngredient} className="grid gap-2 sm:grid-cols-[1fr_7rem_8rem_auto]">
                <input value={ingredientName} onChange={(event) => setIngredientName(event.target.value)} aria-label={text('اسم المكوّن', 'Ingredient name')} placeholder={text('اسم المكوّن', 'Ingredient name')} className="min-w-0 rounded-lg border px-2 py-2 text-xs" />
                <LocalizedNumberInput lang={lang} value={ingredientPercent} onValue={setIngredientPercent} min={0} max={100} ariaLabel={text('النسبة المئوية', 'Percentage')} placeholder="%" className="rounded-lg border px-2 py-2 text-xs" />
                <select value={ingredientRole} onChange={(event) => setIngredientRole(event.target.value as IngredientRole)} aria-label={text('نوع المكوّن', 'Ingredient role')} className="rounded-lg border px-2 py-2 text-xs">
                  {(['oil', 'alcohol', 'water', 'fixative', 'other'] as IngredientRole[]).map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
                <button className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-bold text-white">{text('إضافة', 'Add')}</button>
              </form>
              {active.formula.ingredientLines.length > 0 && <div className="space-y-1">
                {active.formula.ingredientLines.map((line) => <div key={line.id} className="grid grid-cols-1 gap-2 rounded-lg bg-stone-50 p-2 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_7rem_auto] sm:items-center">
                  <span className="min-w-0 truncate text-xs font-semibold" title={line.materialId}>{line.name}{line.materialId && <span className="ms-1 text-[10px] font-normal text-stone-500">· {line.materialId}</span>}</span>
                  <LocalizedNumberInput lang={lang} value={line.percentage} min={0} max={100} onValue={(value) => { if (Number.isFinite(value) && value >= 0 && value <= 100) updateIngredient(line.id, { percentage: value }); }} ariaLabel={text('نسبة المكوّن من المركز', 'Ingredient share of concentrate')} className="rounded-lg border bg-white px-2 py-1.5 text-xs" />
                  <select value={line.role} onChange={(event) => updateIngredient(line.id, { role: event.target.value as IngredientRole })} aria-label={text('نوع المكوّن', 'Ingredient role')} className="rounded-lg border bg-white px-2 py-1.5 text-xs">{(['oil', 'alcohol', 'water', 'fixative', 'other'] as IngredientRole[]).map((role) => <option key={role} value={role}>{role}</option>)}</select>
                  <div><LocalizedNumberInput lang={lang} value={line.density?.gramsPerMl ?? 0} min={0} onValue={(value) => { if (Number.isFinite(value) && value > 0) updateIngredient(line.id, { density: { gramsPerMl: value, confidence: 'unverified' } }); else if (value === 0) updateIngredient(line.id, { density: null }); }} ariaLabel={text('كثافة غير موثقة جم لكل مل، صفر تعني بلا كثافة', 'Unverified density g per ml; zero means unset')} className="w-full rounded-lg border bg-white px-2 py-1.5 text-xs" />{!line.density && <span className="text-[9px] text-stone-500">{text('0 = غير محددة', '0 = unset')}</span>}</div>
                  <button type="button" onClick={() => removeIngredient(line.id)} aria-label={`${text('حذف', 'Remove')} ${line.name}`} className="rounded-lg px-2 py-1 text-xs text-rose-700">{text('حذف', 'Remove')}</button>
                </div>)}
                {(() => {
                  const result = calculateProjectIngredientAmounts(active);
                  return <p className="text-xs text-stone-600">{text(`المجموع: ${result.totalPercentage}%`, `Total: ${result.totalPercentage}%`)}{result.status === 'invalid' ? ` · ${result.errors.map((error) => error.message).join(' ')}` : ` · ${result.lines.map((line) => `${line.id}: ${line.amount.toFixed(3)} ml${line.convertedAmount === undefined ? '' : ` / ${line.convertedAmount.toFixed(3)} g${line.densityConfidence === 'unverified' ? ' estimated' : ''}`}`).join(' · ')}`}{result.warnings.length > 0 && <span className="block text-amber-800">{result.warnings.map((warning) => warning.message).join(' ')}</span>}</p>;
                })()}
              </div>}
            </div>
            <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3" aria-labelledby="cost-ledger-title">
              <div>
                <h3 id="cost-ledger-title" className="font-bold text-sm">{text('سجل تكلفة الدفعة والتسعير', 'Batch cost ledger & pricing')}</h3>
                <p className="mt-1 text-xs text-stone-600">{text('أدخل مبالغ فعلية بعملة واحدة. لا يوجد تحويل عملات أو استنتاج من التركيبة. تُطبق نسبة الضريبة المدخلة فقط على البنود التي تحددها خاضعة لها؛ هذا ليس حسابًا أو نصيحة ضريبية.', 'Enter explicit batch amounts in one currency. No FX conversion or formula-based estimate is applied. The entered tax rate applies only to lines you mark taxable; this is not tax advice or a tax calculation.')}</p>
              </div>
              {(() => {
                const ledger = active.costLedger ?? createProjectCostLedger(props.defaultCurrency);
                const result = calculateProjectCostLedger(ledger);
                return <>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1 text-xs font-semibold">{text('العملة', 'Currency')}<select value={ledger.currency} onChange={(event) => updateLedger({ currency: event.target.value })} className="w-full rounded-lg border bg-white px-2 py-2 font-normal">{WORLD_CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} · {ar ? currency.nameAr : currency.nameEn}</option>)}</select></label>
                    <label className="space-y-1 text-xs font-semibold">{text('وحدات قابلة للبيع في الدفعة', 'Saleable units in batch')}<LocalizedNumberInput lang={lang} value={ledger.batchUnits} min={1} max={1000000} onValue={(value) => { if (Number.isInteger(value) && value >= 1 && value <= 1000000) updateLedger({ batchUnits: value }); }} ariaLabel={text('عدد وحدات الدفعة', 'Batch units')} className="w-full rounded-lg border bg-white px-2 py-2 font-normal" /></label>
                    <label className="space-y-1 text-xs font-semibold">{text('ضريبة مدخلات مفترضة %', 'Assumed input tax %')}<LocalizedNumberInput lang={lang} value={ledger.inputTaxPercent} min={0} max={1000} onValue={(value) => { if (Number.isFinite(value) && value >= 0 && value <= 1000) updateLedger({ inputTaxPercent: value }); }} ariaLabel={text('ضريبة المدخلات بالمئة', 'Input tax percent')} className="w-full rounded-lg border bg-white px-2 py-2 font-normal" /></label>
                  </div>
                  <form onSubmit={addLedgerLine} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto_auto]">
                    <input value={ledgerLineLabel} onChange={(event) => setLedgerLineLabel(event.target.value)} required maxLength={120} aria-label={text('وصف المصروف', 'Expense label')} placeholder={text('وصف المصروف', 'Expense label')} className="rounded-lg border px-2 py-2 text-xs" />
                    <select value={ledgerLineCategory} onChange={(event) => setLedgerLineCategory(event.target.value as typeof ledgerLineCategory)} aria-label={text('فئة التكلفة', 'Cost category')} className="rounded-lg border bg-white px-2 py-2 text-xs">{(['materials', 'packaging', 'labor', 'shipping', 'other'] as const).map((category) => <option key={category}>{category}</option>)}</select>
                    <LocalizedNumberInput lang={lang} value={ledgerLineAmount} min={0} max={1000000000000} onValue={setLedgerLineAmount} ariaLabel={text('مبلغ بند الدفعة', 'Batch line amount')} className="rounded-lg border px-2 py-2 text-xs" />
                    <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={ledgerLineTaxable} onChange={(event) => setLedgerLineTaxable(event.target.checked)} />{text('خاضع للضريبة', 'Taxable')}</label>
                    <button className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white">{text('إضافة بند', 'Add line')}</button>
                  </form>
                  {ledger.lines.length > 0 && <div className="space-y-1">{ledger.lines.map((line) => <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_auto_7rem_auto] items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs"><span className="truncate">{line.label} <span className="text-stone-500">· {line.category}</span></span><label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={line.subjectToInputTax === true} onChange={(event) => updateLedgerLineTaxTreatment(line.id, event.target.checked)} />{text('خاضع', 'Taxable')}</label><LocalizedNumberInput lang={lang} value={line.batchAmount} min={0} onValue={(value) => updateLedgerLine(line.id, value)} ariaLabel={`${line.label} ${text('مبلغ الدفعة', 'batch amount')}`} className="w-full rounded border px-2 py-1" /><button type="button" onClick={() => removeLedgerLine(line.id)} aria-label={`${text('حذف', 'Remove')} ${line.label}`} className="text-rose-700">{text('حذف', 'Remove')}</button></div>)}</div>}
                  <div className="grid gap-2 sm:grid-cols-[1fr_10rem_8rem]">
                    <label className="space-y-1 text-xs font-semibold">{text('أساس التسعير', 'Pricing basis')}<select value={ledger.pricingBasis} onChange={(event) => { const basis = event.target.value as NonNullable<typeof ledger.pricingBasis>; updateLedger({ pricingBasis: basis, ...(basis === 'gross_margin' && ledger.targetPercent >= 100 ? { targetPercent: 50 } : {}) }); }} className="w-full rounded-lg border bg-white px-2 py-2 font-normal"><option value="markup">{text('زيادة على التكلفة (Markup)', 'Markup on cost')}</option><option value="gross_margin">{text('هامش إجمالي مستهدف', 'Target gross margin')}</option></select></label>
                    <label className="space-y-1 text-xs font-semibold">{text('النسبة المستهدفة %', 'Target percent')}<LocalizedNumberInput lang={lang} value={ledger.targetPercent} min={0} max={ledger.pricingBasis === 'gross_margin' ? 99.99 : 1000} onValue={(value) => { if (Number.isFinite(value) && value >= 0 && value <= (ledger.pricingBasis === 'gross_margin' ? 99.99 : 1000)) updateLedger({ targetPercent: value }); }} ariaLabel={text('النسبة المستهدفة للتسعير', 'Pricing target percent')} className="w-full rounded-lg border bg-white px-2 py-2 font-normal" /></label>
                    <div className="flex items-end"><button type="button" onClick={() => { if (window.confirm(text('إعادة ضبط سجل التكلفة وحذف بنوده الحالية؟', 'Reset the cost ledger and remove its current entries?'))) props.onUpdate({ ...active, costLedger: createProjectCostLedger(props.defaultCurrency), updatedAt: new Date().toISOString() }); }} className="w-full rounded-lg border border-rose-200 px-2 py-2 text-xs text-rose-700">{text('إعادة ضبط السجل', 'Reset ledger')}</button></div>
                  </div>
                  <div aria-live="polite" className="grid gap-2 rounded-lg bg-white p-3 text-xs sm:grid-cols-2">
                    <p>{text('إجمالي تكلفة الدفعة', 'Batch cost total')}: <strong>{money(result.totalBatchCost, result.currency)}</strong> <span className="text-stone-500">({text('مجموع البنود', 'line subtotal')} {money(result.subtotalBatch, result.currency)} + {text('ضريبة مفترضة على البنود المحددة فقط', 'assumed tax on selected lines only')} {money(result.inputTaxBatch, result.currency)} · {text('الوعاء', 'taxable base')} {money(result.taxableSubtotalBatch, result.currency)})</span></p>
                    <p>{text('التكلفة لكل وحدة', 'Cost per unit')}: <strong>{money(result.costPerUnit, result.currency)}</strong></p>
                    <p>{text('سعر الوحدة المقترح حسابيًا', 'Calculated unit price')}: <strong>{money(result.pricePerUnit, result.currency)}</strong></p>
                    <p>{text('الربح لكل وحدة', 'Profit per unit')}: <strong>{money(result.profitPerUnit, result.currency)}</strong></p>
                    <p>{text('إيراد الدفعة النظري', 'Theoretical batch revenue')}: <strong>{money(result.revenueBatch, result.currency)}</strong></p>
                    <p>{text('الهامش الإجمالي الفعلي', 'Effective gross margin')}: <strong>{result.effectiveGrossMarginPercent.toFixed(2)}%</strong></p>
                    {result.warnings.map((warning) => <p key={warning} className="text-amber-800 sm:col-span-2">{warning === 'No expense lines have been entered.' ? text('لم تُدخل بنود تكلفة بعد.', warning) : warning.startsWith('Target is markup') ? text('النسبة زيادة على التكلفة وليست هامشًا إجماليًا.', warning) : text('الهامش مطبق على التكلفة قبل ضرائب البيع أو الرسوم.', warning)}</p>)}
                  </div>
                </>;
              })()}
            </section>
            <section className="space-y-3 rounded-xl border border-indigo-200 p-3" aria-labelledby="experiment-journal-title">
              <div><h3 id="experiment-journal-title" className="font-bold text-sm">{text('سجل التجارب والملاحظات', 'Experiment journal')}</h3><p className="mt-1 text-xs text-stone-500">{text('سجّل الملاحظات كما رُصدت؛ لا يحوّل السجل التقييمات إلى ادعاءات سلامة أو امتثال.', 'Record observations as observed; journal ratings do not establish safety or compliance.')}</p></div>
              <form onSubmit={saveJournalEntry} className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold">{text('رمز الدفعة', 'Batch code')}<input value={journalBatchCode} onChange={(event) => setJournalBatchCode(event.target.value)} maxLength={80} required className="w-full rounded-lg border px-2 py-2 font-normal" /></label>
                <label className="space-y-1 text-xs font-semibold">{text('تاريخ الملاحظة', 'Observation date')}<input type="date" value={journalDate} onChange={(event) => setJournalDate(event.target.value)} required className="w-full rounded-lg border px-2 py-2 font-normal" /></label>
                <label className="space-y-1 text-xs font-semibold sm:col-span-2">{text('ظروف الرصد (اختياري)', 'Observation conditions (optional)')}<textarea value={journalConditions} onChange={(event) => setJournalConditions(event.target.value)} maxLength={2000} rows={2} placeholder={text('الوقت، الحرارة، طريقة التقييم…', 'Time, temperature, evaluation method…')} className="w-full rounded-lg border px-2 py-2 font-normal" /></label>
                <label className="space-y-1 text-xs font-semibold sm:col-span-2">{text('الملاحظة', 'Observation')}<textarea value={journalObservation} onChange={(event) => setJournalObservation(event.target.value)} maxLength={5000} rows={3} required className="w-full rounded-lg border px-2 py-2 font-normal" /></label>
                <label className="space-y-1 text-xs font-semibold sm:col-span-2">{text('التقييم الوصفي (اختياري)', 'Qualitative evaluation (optional)')}<textarea value={journalEvaluation} onChange={(event) => setJournalEvaluation(event.target.value)} maxLength={3000} rows={2} className="w-full rounded-lg border px-2 py-2 font-normal" /></label>
                <div className="flex gap-2 sm:col-span-2"><button className="rounded-lg bg-indigo-800 px-3 py-2 text-xs font-bold text-white">{journalEditingId ? text('حفظ التعديل', 'Save changes') : text('إضافة إلى السجل', 'Add to journal')}</button>{journalEditingId && <button type="button" onClick={clearJournalForm} className="rounded-lg border px-3 py-2 text-xs">{text('إلغاء', 'Cancel')}</button>}</div>
              </form>
              {active.experiments.length ? <ol className="space-y-2">{[...active.experiments].sort((a, b) => b.observedAt.localeCompare(a.observedAt) || b.createdAt.localeCompare(a.createdAt)).map((entry) => <li key={entry.id} className="rounded-lg border bg-white p-3 text-xs"><div className="flex flex-wrap gap-2"><strong className="flex-1">{entry.batchCode}</strong><time dateTime={entry.observedAt}>{entry.observedAt}</time><button type="button" onClick={() => editJournalEntry(entry)} className="underline">{text('تعديل', 'Edit')}</button><button type="button" onClick={() => removeJournalEntry(entry.id)} className="text-rose-700 underline">{text('حذف', 'Delete')}</button></div><p className="mt-2 whitespace-pre-wrap">{entry.observation}</p>{entry.conditions && <p className="mt-1 whitespace-pre-wrap text-stone-500">{text('الظروف', 'Conditions')}: {entry.conditions}</p>}{entry.evaluation && <p className="mt-1 whitespace-pre-wrap text-stone-600">{text('التقييم', 'Evaluation')}: {entry.evaluation}</p>}</li>)}</ol> : <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-500">{text('لا توجد تجارب مسجلة لهذا المشروع.', 'No experiments recorded for this project yet.')}</p>}
            </section>
            <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
              {text('الأساس الحالي: حجم (مل). كل تحويل كتلة يعتمد على كثافة وقد تكون تقديرية. لا يوجد تزامن سحابي أو مشاركة عامة.', 'Current basis: volume (ml). Any mass conversion depends on density and may be estimated. No cloud sync or public sharing is enabled.')}
            </div>
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); props.onSaveVersion(active, versionNote); setVersionNote(''); }}>
              <input value={versionNote} onChange={(event) => setVersionNote(event.target.value)} placeholder={text('ملاحظة النسخة (اختياري)', 'Version note (optional)')} className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              <button className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3 py-2 text-xs font-bold text-white"><History className="h-4 w-4" />{text('حفظ نسخة', 'Save version')}</button>
            </form>
            {active.versions.length > 0 && <div className="space-y-2"><h3 className="text-sm font-bold">{text('سجل النسخ', 'Version history')}</h3>{[...active.versions].reverse().map((version) => <div key={version.id} className="flex items-center gap-2 rounded-lg border p-2 text-xs"><span className="flex-1">{version.note} · {new Date(version.createdAt).toLocaleString(lang)}</span><button type="button" onClick={() => props.onRestoreVersion(active, version.id)} className="rounded-lg border px-2 py-1">{text('استعادة', 'Restore')}</button></div>)}</div>}
          </>}
        </div>
      </div>
    </section>
  );
}
