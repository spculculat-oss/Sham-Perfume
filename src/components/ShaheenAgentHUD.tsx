import React, { useRef, useState } from 'react';
import {
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  ExternalLink,
  Globe,
  ImagePlus,
  Loader2,
  Mic,
  Play,
  Sliders,
  Sparkles,
  Square,
  Swords,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import type {
  AgentAction,
  AgentAttachmentInput,
  AgentGroundingSource,
  AgentMode,
  AgentReasoningDepth,
  AgentStep,
  ChatAttachmentPreview,
} from '../types/shaheenAgent';
import { apiUrl, isStaticHosting } from '../utils/api';
import { LOCALE_MAP, loc, type LText } from '../لغات/localize';

const T: Record<string, LText> = {
  agent_mode: {
    ar: 'الوكيل الذكي المستقل',
    en: 'Autonomous AI Agent',
    fr: 'Agent IA autonome',
    es: 'Agente IA autónomo',
    it: 'Agente IA autonomo',
    de: 'Autonomer KI-Agent',
    ru: 'Автономный ИИ-агент',
    zh: '自主 AI 智能体',
    tr: 'Otonom YZ Ajanı',
    fa: 'عامل هوشمند مستقل',
  },
  agent_on: { ar: 'مُفعّل', en: 'Active', fr: 'Actif', es: 'Activo', it: 'Attivo', de: 'Aktiv', ru: 'Активен', zh: '已开启', tr: 'Aktif', fa: 'فعال' },
  agent_off: { ar: 'قياسي', en: 'Classic', fr: 'Classique', es: 'Clásico', it: 'Classico', de: 'Klassisch', ru: 'Обычный', zh: '标准模式', tr: 'Klasik', fa: 'معمولی' },
  mode_agent: { ar: 'وكيل ذكي', en: 'Agent', fa: 'عامل هوشمند' },
  mode_arena: { ar: 'حلبة التنافس', en: 'Arena Duel', fa: 'میدان رقابت' },
  mode_architect: { ar: 'استوديو البرمجة', en: 'Code Studio', fa: 'استودیو کد' },
  depth_std: { ar: 'سريع', en: 'Balanced', fr: 'Équilibré', es: 'Equilibrado', it: 'Bilanciato', de: 'Ausgewogen', ru: 'Баланс', zh: '均衡', tr: 'Dengeli', fa: 'متعادل' },
  depth_deep: { ar: 'عميق', en: 'Deep', fr: 'Approfondi', es: 'Profundo', it: 'Profondo', de: 'Tief', ru: 'Глубокий', zh: '深度', tr: 'Derin', fa: 'عمیق' },
  depth_max: { ar: 'أقصى تفكير', en: 'Max Think', fr: 'Max réflexion', es: 'Máx. análisis', it: 'Max analisi', de: 'Max Denken', ru: 'Макс. анализ', zh: '极限推理', tr: 'Maks. Düşünce', fa: 'حداکثر تفکر' },
  web_search: { ar: 'بحث الويب', en: 'Web Search', fr: 'Recherche Web', es: 'Búsqueda Web', it: 'Ricerca Web', de: 'Websuche', ru: 'Веб-поиск', zh: '联网搜索', tr: 'Web Arama', fa: 'جستجوی وب' },
  auto_apply: { ar: 'تطبيق تلقائي', en: 'Auto-Apply', fr: 'Auto-appliquer', es: 'Auto-aplicar', it: 'Auto-applica', de: 'Auto-Anwenden', ru: 'Автоприменение', zh: '自动应用', tr: 'Otomatik Uygula', fa: 'اعمال خودکار' },
  steps_title: { ar: 'سجل تنفيذ الوكيل والأدوات', en: 'Agent Reasoning & Tool Execution', fr: 'Raisonnement & outils de l’agent', es: 'Razonamiento y herramientas del agente', it: 'Ragionamento e strumenti', de: 'Agenten-Schritte & Werkzeuge', ru: 'Шаги и инструменты агента', zh: '智能体推理与工具执行', tr: 'Ajan Adımları ve Araçlar', fa: 'روند تفکر و اجرای ابزارها' },
  working: { ar: 'يفكّر ويستدعي أدوات المعمل…', en: 'Planning & running lab tools…', fr: 'Planification et outils du labo…', es: 'Planificando y ejecutando herramientas…', it: 'Pianificazione e strumenti di laboratorio…', de: 'Plant und nutzt Labor-Werkzeuge…', ru: 'Планирование и вызов инструментов…', zh: '正在规划并调用实验室工具…', tr: 'Planlıyor ve laboratuvar araçlarını çalıştırıyor…', fa: 'در حال برنامه‌ریزی و اجرای ابزارهای آزمایشگاه…' },
  sources_title: { ar: 'المصادر الموثقة من الويب', en: 'Verified Web Sources', fr: 'Sources Web vérifiées', es: 'Fuentes web verificadas', it: 'Fonti web verificate', de: 'Verifizierte Webquellen', ru: 'Проверенные веб-источники', zh: '已验证网页来源', tr: 'Doğrulanmış Web Kaynakları', fa: 'منابع وب تأییدشده' },
  actions_title: { ar: 'إجراءات الوكيل في تطبيق شام', en: 'Agent Lab Actions', fr: 'Actions du laboratoire', es: 'Acciones del laboratorio', it: 'Azioni di laboratorio', de: 'Labor-Aktionen', ru: 'Действия в лаборатории', zh: '实验室可执行操作', tr: 'Laboratuvar İşlemleri', fa: 'عملیات آزمایشگاه' },
  applied_ok: { ar: 'تم التنفيذ', en: 'Applied', fr: 'Appliqué', es: 'Aplicado', it: 'Applicato', de: 'Angewendet', ru: 'Применено', zh: '已应用', tr: 'Uygulandı', fa: 'اعمال شد' },
  execute_now: { ar: 'تنفيذ الآن', en: 'Execute', fr: 'Exécuter', es: 'Ejecutar', it: 'Esegui', de: 'Ausführen', ru: 'Выполнить', zh: '立即执行', tr: 'Çalıştır', fa: 'اجرا' },
  attach_img: { ar: 'إرفاق صورة (زجاجة، وصفة، مادة خام)', en: 'Attach image (bottle, formula, material)', fr: 'Joindre une image', es: 'Adjuntar imagen', it: 'Allega immagine', de: 'Bild anhängen', ru: 'Прикрепить изображение', zh: '上传图片（香水瓶/配方表/原料）', tr: 'Görsel ekle', fa: 'پیوست تصویر' },
  voice_start: { ar: 'تسجيل سؤال صوتي', en: 'Record voice question', fr: 'Enregistrer une question vocale', es: 'Grabar pregunta por voz', it: 'Registra domanda vocale', de: 'Sprachfrage aufnehmen', ru: 'Записать голосовой вопрос', zh: '语音提问', tr: 'Sesli soru kaydet', fa: 'ضبط پرسش صوتی' },
  voice_stop: { ar: 'إيقاف التسجيل والتحويل لنص', en: 'Stop recording & transcribe', fr: 'Arrêter et transcrire', es: 'Detener y transcribir', it: 'Ferma e trascrivi', de: 'Stoppen & transkribieren', ru: 'Остановить и распознать', zh: '停止录音并转写', tr: 'Durdur ve yazıya dök', fa: 'توقف و تبدیل به متن' },
};

export interface QueuedAttachment extends AgentAttachmentInput {
  id: string;
  previewUrl: string;
}

export async function fileToAgentAttachment(file: File): Promise<QueuedAttachment | null> {
  if (!file.type.startsWith('image/')) return null;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  if (!dataUrl) return null;

  // Compress large camera photos slightly via canvas so payloads stay responsive
  let finalUrl = dataUrl;
  let finalMime = file.type;
  if (dataUrl.length > 1_200_000 && typeof document !== 'undefined') {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = dataUrl;
      });
      const maxDim = 1280;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        finalUrl = canvas.toDataURL('image/jpeg', 0.85);
        finalMime = 'image/jpeg';
      }
    } catch {
      /* keep original if canvas resize fails */
    }
  }

  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name || 'image.jpg',
    mimeType: finalMime,
    data: finalUrl,
    previewUrl: finalUrl,
  };
}

export function ShaheenAgentConfigBar({
  language,
  agentEnabled,
  setAgentEnabled,
  agentMode = 'agent',
  setAgentMode,
  reasoningDepth,
  setReasoningDepth,
  autoWebSearch,
  setAutoWebSearch,
  autoApplyActions,
  setAutoApplyActions,
  disabled,
}: {
  language: SupportedLanguage;
  agentEnabled: boolean;
  setAgentEnabled: (v: boolean) => void;
  agentMode?: AgentMode;
  setAgentMode?: (v: AgentMode) => void;
  reasoningDepth: AgentReasoningDepth;
  setReasoningDepth: (v: AgentReasoningDepth) => void;
  autoWebSearch: boolean;
  setAutoWebSearch: (v: boolean) => void;
  autoApplyActions: boolean;
  setAutoApplyActions: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="px-3 py-1.5 bg-stone-900/95 text-stone-200 border-b border-stone-800 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setAgentEnabled(!agentEnabled)}
          disabled={disabled}
          aria-pressed={agentEnabled}
          className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
            agentEnabled
              ? 'bg-gradient-to-r from-amber-500/25 to-amber-600/20 text-amber-300 border-amber-400/60 shadow-2xs'
              : 'bg-stone-800 text-stone-400 border-stone-700 hover:text-stone-200'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>{loc(language, T.agent_mode)}</span>
          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${agentEnabled ? 'bg-amber-400 text-stone-950' : 'bg-stone-700 text-stone-300'}`}>
            {loc(language, agentEnabled ? T.agent_on : T.agent_off)}
          </span>
        </button>

        {agentEnabled && setAgentMode && (
          <div className="flex items-center gap-1 bg-stone-950/80 p-0.5 rounded-lg border border-stone-800">
            {(
              [
                ['agent', T.mode_agent, Bot],
                ['arena', T.mode_arena, Swords],
                ['architect', T.mode_architect, Code2],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => setAgentMode(id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  agentMode === id
                    ? 'bg-amber-400 text-stone-950 font-bold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{loc(language, label)}</span>
              </button>
            ))}
          </div>
        )}

        {agentEnabled && (
          <div className="flex items-center gap-1 bg-stone-950/70 p-0.5 rounded-lg border border-stone-800">
            <Brain className="w-3 h-3 text-amber-400 mx-1" />
            {(
              [
                ['standard', T.depth_std],
                ['deep', T.depth_deep],
                ['max', T.depth_max],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => setReasoningDepth(id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  reasoningDepth === id
                    ? 'bg-amber-500 text-stone-950 font-bold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {loc(language, label)}
              </button>
            ))}
          </div>
        )}
      </div>

      {agentEnabled && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setAutoWebSearch(!autoWebSearch)}
            aria-pressed={autoWebSearch}
            className={`px-2 py-0.5 rounded-lg border text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
              autoWebSearch
                ? 'bg-sky-500/15 text-sky-300 border-sky-400/50'
                : 'bg-stone-950 text-stone-500 border-stone-800 hover:text-stone-300'
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>{loc(language, T.web_search)}</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => setAutoApplyActions(!autoApplyActions)}
            aria-pressed={autoApplyActions}
            className={`px-2 py-0.5 rounded-lg border text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
              autoApplyActions
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/50'
                : 'bg-stone-950 text-stone-500 border-stone-800 hover:text-stone-300'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>{loc(language, T.auto_apply)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function ShaheenAgentTimeline({
  language,
  steps,
  sources,
  actions,
  isStreaming,
  onExecuteAction,
}: {
  language: SupportedLanguage;
  steps?: AgentStep[];
  sources?: AgentGroundingSource[];
  actions?: AgentAction[];
  isStreaming?: boolean;
  onExecuteAction?: (action: AgentAction) => void;
}) {
  const [expanded, setExpanded] = useState<boolean>(Boolean(isStreaming));
  const hasSteps = Boolean(steps && steps.length > 0);
  const hasSources = Boolean(sources && sources.length > 0);
  const hasActions = Boolean(actions && actions.length > 0);

  if (!isStreaming && !hasSteps && !hasSources && !hasActions) return null;

  const doneCount = steps?.filter((s) => s.status === 'done').length || 0;

  return (
    <div className="space-y-2 my-1.5">
      {/* Execution Steps Accordion */}
      {(isStreaming || hasSteps) && (
        <div className="rounded-xl border border-amber-200/80 bg-stone-50/90 overflow-hidden text-[11px]">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-3 py-2 flex items-center justify-between gap-2 text-stone-800 hover:bg-amber-50/60 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 font-semibold text-amber-950">
              {isStreaming ? (
                <Loader2 className="w-3.5 h-3.5 text-amber-700 animate-spin shrink-0" />
              ) : (
                <Sliders className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              )}
              <span>{isStreaming ? loc(language, T.working) : loc(language, T.steps_title)}</span>
              {hasSteps && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-200/70 text-amber-950 text-[9px] font-mono-numbers">
                  {doneCount}/{steps!.length}
                </span>
              )}
            </span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-stone-500" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-500" />}
          </button>

          {(expanded || isStreaming) && (
            <div className="px-3 pb-2.5 pt-1 space-y-1.5 border-t border-amber-200/50 bg-white/80">
              {(!steps || !steps.length) && isStreaming && (
                <div className="flex items-center gap-2 text-stone-500 py-1">
                  <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" />
                  <span>{loc(language, T.working)}</span>
                </div>
              )}
              {steps?.map((step) => (
                <div key={step.id} className="flex items-start gap-2 text-[11px] leading-snug py-0.5">
                  <span className="mt-0.5 shrink-0">
                    {step.status === 'running' ? (
                      <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                    ) : step.kind === 'web' ? (
                      <Globe className="w-3.5 h-3.5 text-sky-600" />
                    ) : step.kind === 'thought' ? (
                      <Brain className="w-3.5 h-3.5 text-purple-600" />
                    ) : step.kind === 'action' ? (
                      <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    ) : step.kind === 'arena' ? (
                      <Swords className="w-3.5 h-3.5 text-amber-800" />
                    ) : step.kind === 'code' ? (
                      <Code2 className="w-3.5 h-3.5 text-stone-800" />
                    ) : (
                      <Wrench className="w-3.5 h-3.5 text-amber-700" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-stone-800">{step.label}</span>
                      {typeof step.durationMs === 'number' && (
                        <span className="text-[9px] font-mono-numbers text-stone-400 shrink-0">{step.durationMs}ms</span>
                      )}
                    </div>
                    {step.detail && (
                      <p className="text-[10px] text-stone-500 break-words line-clamp-2 mt-0.5">{step.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agent Dispatched App Actions */}
      {hasActions && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-950">
            <Zap className="w-3.5 h-3.5 text-emerald-700" />
            <span>{loc(language, T.actions_title)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {actions!.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => onExecuteAction?.(act)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  act.applied
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white hover:bg-emerald-100 text-emerald-950 border-emerald-300 shadow-2xs'
                }`}
              >
                {act.applied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Play className="w-3 h-3" />}
                <span>{act.label}</span>
                <span className="text-[9px] opacity-80">
                  ({loc(language, act.applied ? T.applied_ok : T.execute_now)})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grounding Web Sources */}
      {hasSources && (
        <div className="rounded-xl border border-sky-200/80 bg-sky-50/60 p-2.5 space-y-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 font-bold text-sky-950">
            <Globe className="w-3.5 h-3.5 text-sky-700" />
            <span>{loc(language, T.sources_title)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sources!.map((src, i) => (
              <a
                key={`${src.uri}-${i}`}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 hover:bg-sky-100 transition-colors text-[10px] font-medium max-w-[240px]"
              >
                <span className="truncate">{src.title}</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0 text-sky-600" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MessageAttachmentsStrip({ attachments }: { attachments?: ChatAttachmentPreview[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-1.5">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="inline-flex items-center gap-1.5 rounded-xl overflow-hidden border border-amber-300/50 bg-black/20 px-2 py-1 text-[10px] text-amber-100"
        >
          {att.previewUrl ? (
            <img src={att.previewUrl} alt={att.name} className="w-9 h-9 object-cover rounded-lg" />
          ) : (
            <ImagePlus className="w-3.5 h-3.5" />
          )}
          <span className="max-w-[110px] truncate">{att.name}</span>
        </div>
      ))}
    </div>
  );
}

export function ShaheenMultimodalButtons({
  language,
  agentEnabled,
  disabled,
  attachmentsCount,
  onAddAttachment,
  onTranscribed,
}: {
  language: SupportedLanguage;
  agentEnabled: boolean;
  disabled?: boolean;
  attachmentsCount: number;
  onAddAttachment: (att: QueuedAttachment) => void;
  onTranscribed: (text: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, 3 - attachmentsCount));
    for (const file of files) {
      const att = await fileToAgentAttachment(file);
      if (att) onAddAttachment(att);
    }
    e.target.value = '';
  };

  const toggleVoiceRecording = async () => {
    if (isStaticHosting || isTranscribing) return;
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 200) return;
        setIsTranscribing(true);
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result || ''));
            r.onerror = reject;
            r.readAsDataURL(blob);
          });
          const res = await fetch(apiUrl('/api/ai/transcribe'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64, mimeType: blob.type || 'audio/webm' }),
          });
          if (res.ok) {
            const data = (await res.json()) as { transcription?: string };
            if (data.transcription?.trim()) onTranscribed(data.transcription.trim());
          }
        } catch {
          /* keep UX calm on network failure */
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  return (
    <>
      {agentEnabled && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => void handleFileChange(e)}
          />
          <button
            type="button"
            disabled={disabled || attachmentsCount >= 3}
            onClick={() => fileRef.current?.click()}
            className="p-2.5 rounded-xl bg-stone-100 hover:bg-amber-50 text-stone-700 hover:text-amber-900 border border-stone-200 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
            title={loc(language, T.attach_img)}
          >
            <ImagePlus className="w-4 h-4" />
          </button>
        </>
      )}

      {!isStaticHosting && (
        <button
          type="button"
          disabled={disabled || isTranscribing}
          onClick={() => void toggleVoiceRecording()}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
            isRecording
              ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
              : 'bg-stone-100 hover:bg-amber-50 text-stone-700 hover:text-amber-900 border-stone-200 disabled:opacity-40'
          }`}
          title={loc(language, isRecording ? T.voice_stop : T.voice_start)}
        >
          {isTranscribing ? (
            <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
          ) : isRecording ? (
            <Square className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>
      )}
    </>
  );
}

export function QueuedAttachmentsPreviewBar({
  attachments,
  onRemove,
}: {
  attachments: QueuedAttachment[];
  onRemove: (id: string) => void;
}) {
  if (!attachments.length) return null;
  return (
    <div className="px-3 py-2 bg-amber-50/70 border-t border-amber-200/70 flex flex-wrap gap-2 shrink-0">
      {attachments.map((att) => (
        <div key={att.id} className="relative group flex items-center gap-1.5 bg-white border border-amber-300 rounded-xl p-1 pr-2 text-[11px] text-stone-800 shadow-2xs">
          <img src={att.previewUrl} alt={att.name} className="w-8 h-8 rounded-lg object-cover" />
          <span className="max-w-[110px] truncate font-medium">{att.name}</span>
          <button
            type="button"
            onClick={() => onRemove(att.id)}
            className="p-0.5 rounded-full bg-stone-100 hover:bg-rose-100 text-stone-500 hover:text-rose-700 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useShaheenSpeech(language: SupportedLanguage) {
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopSpeech = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
  };

  const speak = async (msgId: string, text: string) => {
    if (speakingMsgId === msgId) {
      stopSpeech();
      return;
    }
    stopSpeech();
    setSpeakingMsgId(msgId);

    // Prefer studio-grade server neural TTS when server is available
    if (!isStaticHosting) {
      try {
        const res = await fetch(apiUrl('/api/ai/tts'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.slice(0, 2400), language }),
        });
        if (res.ok) {
          const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
          if (data.audioBase64) {
            const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
            audioRef.current = audio;
            audio.onended = () => {
              audioRef.current = null;
              setSpeakingMsgId(null);
            };
            audio.onerror = () => {
              audioRef.current = null;
              setSpeakingMsgId(null);
            };
            await audio.play();
            return;
          }
        }
      } catch {
        /* fallback cleanly to browser synthesis */
      }
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LOCALE_MAP[language] || 'ar-EG';
      utterance.rate = 0.95;
      utterance.onend = () => setSpeakingMsgId(null);
      utterance.onerror = () => setSpeakingMsgId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setSpeakingMsgId(null);
    }
  };

  return { speakingMsgId, speak, stopSpeech };
}
