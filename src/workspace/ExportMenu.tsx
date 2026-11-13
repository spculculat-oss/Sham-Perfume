import React, { useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, Presentation, Printer, Loader2 } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { parseMarkdown } from './markdownDoc';
import { downloadBlob, printAsPdf, writeOffice, type OfficeKind } from './officeWriters';
import { saveFile } from './fileStore';
import { wsText } from './strings';

/** «نزّله كـ»: a reply (or any Markdown) as Word, Excel, PowerPoint, PDF or Markdown — made in the browser. */
export function ExportMenu({ markdown, lang, compact = false, alsoSave = false }: { markdown: string; lang: SupportedLanguage; compact?: boolean; alsoSave?: boolean }) {
  const [busy, setBusy] = useState<OfficeKind | null>(null);
  const [note, setNote] = useState('');
  const w = (k: Parameters<typeof wsText>[1]) => wsText(lang, k);
  const make = async (kind: OfficeKind) => {
    setBusy(kind);
    setNote('');
    try {
      const model = parseMarkdown(markdown, w('title'));
      if (kind === 'pdf') { printAsPdf(model); setNote(w('pdf_hint')); return; }
      const { blob, name } = await writeOffice(kind, model, markdown);
      downloadBlob(blob, name);
      if (alsoSave) await saveFile(name, blob).catch(() => undefined);
    } catch {
      setNote(w('failed'));
    } finally { setBusy(null); }
  };
  const items: Array<{ kind: OfficeKind; label: string; icon: typeof FileText }> = [
    { kind: 'docx', label: 'Word', icon: FileText },
    { kind: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
    { kind: 'pptx', label: 'PowerPoint', icon: Presentation },
    { kind: 'pdf', label: 'PDF', icon: Printer },
    { kind: 'md', label: 'Markdown', icon: FileDown },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="ws-export">
      {!compact && <span className="text-[11px] font-bold text-stone-500">{w('export_as')}</span>}
      {items.map(({ kind, label, icon: Icon }) => (
        <button key={kind} type="button" onClick={() => make(kind)} disabled={busy !== null}
          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-bold text-stone-700 hover:border-amber-400 disabled:opacity-50 cursor-pointer">
          {busy === kind ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />} {label}
        </button>
      ))}
      {note && <span className="text-[11px] text-stone-500">{note}</span>}
    </div>
  );
}
