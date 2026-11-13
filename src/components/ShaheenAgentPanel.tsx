import React, { useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '../types/i18n';
import type { AgentReport } from '../types/agent';
import { validAgentReport } from '../types/agent';
import { useShaheenAgent } from '../hooks/useShaheenAgent';
import { useShaheenChat } from '../hooks/useShaheenChat';
import { isStaticHosting, requestApi } from '../utils/api';

export function ShaheenAgentPanel({ language }: { language: SupportedLanguage }) {
  const ar = language === 'ar';
  const { agent, documents, webSearch, update } = useShaheenAgent();
  const { isLoading, cancelRequest } = useShaheenChat();
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [searchAvailable, setSearchAvailable] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isStaticHosting) return;
    const controller = new AbortController();
    requestApi<{ tools: string[] }>('/api/agent/capabilities', { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setSearchAvailable(Array.isArray(data.tools) && data.tools.includes('web_search')); })
      .catch(() => { /* Search stays disabled if capabilities cannot be verified. */ });
    return () => controller.abort();
  }, []);
  return <details className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-stone-900">
    <summary className="cursor-pointer font-bold">{ar ? 'أدوات شاهين · وضع الوكيل' : 'Shahin tools · Agent mode'}{agent ? ' ●' : ''}</summary>
    <div className="mt-2 max-h-52 overflow-y-auto space-y-2">
      <label className="flex gap-2 items-center"><input type="checkbox" checked={agent} disabled={isStaticHosting || isLoading || reading}
        onChange={(event) => update({ agent: event.target.checked })} />
        {ar ? 'تفعيل تنفيذ الأدوات (حتى 5 طلبات ذكاء اصطناعي للمهمة)' : 'Enable tools (up to 5 AI requests per task)'}</label>
      <p>{ar ? 'حسابات · تكلفة · مواد خام · مراجعة تركيبات · قراءة نصوص · تجهيز ملفات للتنزيل. لا ينفّذ كوداً ولا يعدّل حسابات أو مستودعات.'
        : 'Calculations · costing · material lookup · formula checks · text reading · downloadable files. No code execution, account access or repository edits.'}</p>
      <p>{ar ? 'المرفقات تُرسل لسيرفر الموقع ولمزوّد الذكاء الاصطناعي عند قراءتها. لا ترفع مفاتيح أو بيانات سرية؛ المرفقات نفسها لا تُحفظ تلقائياً، لكن مقتطفاتها في الردود والتقارير قد تُحفظ مع المحادثة.'
        : 'Attachments go to this server and, when read, the AI provider. Do not upload secrets. Attachments are not automatically stored, but excerpts in replies and reports may be saved in chat history.'}</p>
      {agent && <>
        <input ref={input} type="file" className="hidden" accept=".txt,.md,.json,.csv" multiple onChange={async (event) => {
          const files = [...(event.currentTarget.files || [])];
          event.currentTarget.value = '';
          setError(''); setReading(true);
          try {
            if (files.length + documents.length > 3 || files.some((file) => file.size > 48000 || !/\.(txt|md|json|csv)$/i.test(file.name))) throw new Error();
            const next = [...documents, ...await Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() })))];
            if (next.some((doc) => !doc.text.trim() || doc.name.length > 120 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(doc.text)) || next.reduce((n, doc) => n + doc.text.length, 0) > 12000) throw new Error();
            update({ documents: next });
          } catch { setError(ar ? 'حتى 3 ملفات نصية غير فارغة، بإجمالي 12000 حرف. PDF والصور غير مدعومة حالياً.' : 'Up to 3 nonempty text files, 12000 characters total. PDF and images are not currently supported.'); }
          finally { setReading(false); }
        }} />
        <button type="button" className="rounded-lg border border-stone-400 px-2 py-1 disabled:opacity-50" disabled={isLoading || reading}
          onClick={() => input.current?.click()}>{ar ? 'إرفاق ملف نصي' : 'Attach text file'}</button>
        {documents.map((doc, index) => <div key={`${index}-${doc.name}`} className="flex items-center gap-2 break-all">
          <span>{doc.name} ({doc.text.length})</span><button type="button" disabled={isLoading || reading} onClick={() => update({ documents: documents.filter((_, i) => i !== index) })}
            aria-label={ar ? `إزالة ${doc.name}` : `Remove ${doc.name}`}>×</button></div>)}
        <label className="flex gap-2"><input type="checkbox" checked={webSearch && searchAvailable} disabled={!searchAvailable || isLoading}
          onChange={(event) => update({ webSearch: event.target.checked })} />
          {searchAvailable ? (ar ? 'السماح بالبحث الخارجي: تُرسل عبارات البحث لخدمة Brave' : 'Allow external search: search queries are sent to Brave')
            : (ar ? 'البحث الخارجي غير مهيأ (يحتاج BRAVE_SEARCH_API_KEY على الخادم)' : 'Web search unavailable (server BRAVE_SEARCH_API_KEY required)')}</label>
      </>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {isLoading && <button type="button" onClick={cancelRequest} className="rounded-lg border border-red-600 px-2 py-1 text-red-800">{ar ? 'إيقاف الطلب' : 'Stop request'}</button>}
      {isStaticHosting && <p>{ar ? 'نسخة Pages لا تشغّل الوكيل؛ يلزم سيرفر ومزوّد متاح.' : 'Pages cannot run the agent; a server and available AI provider are required.'}</p>}
    </div>
  </details>;
}

export function ShaheenAgentReport({ report, language }: { report?: AgentReport; language: SupportedLanguage }) {
  if (!report || !validAgentReport(report)) return null;
  const ar = language === 'ar';
  return <div className="mt-2 space-y-2 text-xs text-stone-700">
    <details className="rounded-lg border border-stone-200 p-2"><summary className="cursor-pointer">{ar ? 'سجل الأدوات المنفّذة' : 'Tool execution log'} ({report.steps.length})</summary>
      {report.steps.length === 0 && <p>{ar ? 'رد بدون استدعاء أدوات' : 'Answered without tool calls'}</p>}
      <ol>{report.steps.map((step, index) => <li key={index}>{step.status === 'completed' ? '✓' : '✕'} {step.tool} — {step.status}</li>)}</ol>
    </details>
    {report.artifacts.map((artifact) => <button key={artifact.name} type="button" className="block rounded-lg border border-amber-400 bg-amber-50 px-3 py-2" onClick={() => {
      // Explicit user click is the only operation which creates a local download.
      // Force text/plain + attachment filename; never render/execute model content.
      const url = URL.createObjectURL(new Blob([artifact.content], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = artifact.name;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>{ar ? 'تنزيل الملف المُجهّز' : 'Download prepared file'}: {artifact.name}</button>)}
  </div>;
}
