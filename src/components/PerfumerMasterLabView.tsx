import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Droplet,
  Beaker,
  Send,
  Volume2,
  Check,
  FlaskConical,
  Copy,
  Trash2,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  BookmarkPlus,
  DollarSign,
  Printer,
  ChevronDown,
  Download,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import perfumerImg from '../assets/images/master_perfumer_compounding_1791693212967.jpg';
import { extractFormulaFromAIMessage, ExtractedAIPerfume } from '../utils/aiFormulaExtractor';
import {
  ChatMessage,
  loadStoredChatSession,
  saveChatSession,
  clearChatSession,
  exportChatTranscriptToFile,
  DEFAULT_WELCOME_MESSAGE,
} from '../utils/chatStorage';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../utils/localizedContent';

interface PerfumerMasterLabViewProps {
  currentLang?: SupportedLanguage;
  onApplyToConcentrationCalculator: (formula: ExtractedAIPerfume) => void;
  onApplyToPyramidCalculator: (formula: ExtractedAIPerfume) => void;
  onRecordToRecipeLibrary: (formula: ExtractedAIPerfume) => void;
  onCalculateCosting: (formula: ExtractedAIPerfume) => void;
  onPrintSpecSheet: (formula: ExtractedAIPerfume) => void;
}

const MASTER_PROMPTS = [
  'أتمتة تركيبة عطرية صيفية منعشة بدمج آراء الخبراء ونسب الجرامات',
  'تركيبة شتوية ملكية (عود وعنبر) مع فحص IFRA وثبات 48 ساعة',
  'العطر أصبح حليبياً ومتعكراً بعد إضافة الماء، كيف أصفّيه بالمعمل؟',
  'كيف أضاعف ثبات وفوحان العطر لأكثر من 24 ساعة بالنسبة الكيميائية؟',
  'طبق هذه التركيبة فوراً في حاسبة التركيب والمعمل',
];

export const PerfumerMasterLabView: React.FC<PerfumerMasterLabViewProps> = ({
  currentLang = 'ar',
  onApplyToConcentrationCalculator,
  onApplyToPyramidCalculator,
  onRecordToRecipeLibrary,
  onCalculateCosting,
  onPrintSpecSheet,
}) => {
  const rtl = isRTL(currentLang);
  // Load persisted session with 30-day (1 month) expiration check
  const [sessionData, setSessionData] = useState(() => loadStoredChatSession());
  const [messages, setMessages] = useState<ChatMessage[]>(() => sessionData.messages);
  const [daysRemaining, setDaysRemaining] = useState(sessionData.daysRemaining);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scaleWeight, setScaleWeight] = useState(14.85);
  const [dripping, setDripping] = useState(false);
  const [compoundingStep, setCompoundingStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Multi-AI Model Orchestrator State
  const [selectedModel, setSelectedModel] = useState<'auto' | 'gemini' | 'deepseek' | 'openai' | 'claude'>('auto');
  const [comparingMsgId, setComparingMsgId] = useState<string | null>(null);
  const [showAiMatrix, setShowAiMatrix] = useState(false);

  const AI_ENGINES = [
    { id: 'auto', name: 'أتمتة الدمج الذكي (Auto Ensemble)', short: '⚡ مجلس الخبراء', badge: '⚡ مجلس الخبراء المؤتمت', color: 'border-amber-400 bg-amber-500/20 text-amber-300', desc: 'يدمج ذكاء الأربعة نماذج تلقائياً ويصيغ الخلاصة الموحدة' },
    { id: 'gemini', name: 'Google Gemini 3.8 Flash', short: '✨ جيمناي', badge: '✨ Gemini 3.8 Flash', color: 'border-emerald-400 bg-emerald-500/20 text-emerald-300', desc: 'الحسابات الرياضية الدقيقة، أوزان الغرامات، والسرعة الفائقة' },
    { id: 'deepseek', name: 'DeepSeek R1 Chemistry', short: '🔬 ديب سيك', badge: '🔬 DeepSeek R1', color: 'border-blue-400 bg-blue-500/20 text-blue-300', desc: 'استدلال كيميائي، الكثافة النوعية ومعايير أمان IFRA' },
    { id: 'openai', name: 'ChatGPT GPT-4o Architect', short: '🟢 شات جي بي تي', badge: '🟢 GPT-4o Architect', color: 'border-green-400 bg-green-500/20 text-green-300', desc: 'هندسة الأكوردات، الفوحان التجاري والانتشار الجذاب' },
    { id: 'claude', name: 'Claude 3.5 Haute Parfumerie', short: '🟣 كلود', badge: '🟣 Claude 3.5 Sonnet', color: 'border-purple-400 bg-purple-500/20 text-purple-300', desc: 'مدرسة جراس الفرنسية، التعتيق الصامت، وأناقة النيش' },
  ];

  const setActivePerspectiveForMessage = (msgId: string, tabId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, activePerspectiveTab: tabId } : m))
    );
  };

  const handleSpeech = (text: string) => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.95;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Copy & clear state trackers
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [recordedId, setRecordedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Persist messages whenever changed & broadcast to sync floating window
  useEffect(() => {
    saveChatSession(messages);
    window.dispatchEvent(new CustomEvent('miyaar-chat-updated', { detail: messages }));
  }, [messages]);

  // Sync with updates from floating chat window
  useEffect(() => {
    const handleSync = (e: any) => {
      if (Array.isArray(e.detail)) {
        setMessages(e.detail);
      }
    };
    window.addEventListener('miyaar-chat-updated', handleSync);
    return () => window.removeEventListener('miyaar-chat-updated', handleSync);
  }, []);

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setCompoundingStep((prev) => (prev + 1) % 4);
        setScaleWeight((prev) => +(prev + 0.35).toFixed(2));
      }, 1100);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const compoundingPhrases = [
    'الخبير شاهين يقطر الزيوت الخام في المخبار بدقة الميزان...',
    'يفحص الكثافة النوعية وتجانس النوتات العطرية...',
    'يمزج مركب العطر ويتحقق من توازن الهرم العطري...',
    'يصيغ لك خلاصة سر التركيبة من واقع خبرة 35 عاماً في المعمل...',
  ];

  const handleSend = async (
    customText?: string,
    overrideModel?: 'auto' | 'gemini' | 'deepseek' | 'openai' | 'claude'
  ) => {
    const text = (customText || input).trim();
    if (!text || isLoading) return;

    const activeModelChoice = overrideModel || selectedModel;

    // Check if user requested an immediate interactive action by text command
    const lower = text.toLowerCase();
    if (
      (lower.includes('طبق') || lower.includes('حول') || lower.includes('انقل')) &&
      (lower.includes('حاسبة') || lower.includes('تركيب'))
    ) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          const formula = extractFormulaFromAIMessage(messages[i].text);
          if (formula) {
            onApplyToConcentrationCalculator(formula);
            return;
          }
        }
      }
    }

    const userMsg: ChatMessage = {
      id: 'u-' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setDripping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          model: activeModelChoice,
          conversationHistory: messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      const reply = data.reply || 'معذرة، أعد المحاولة بعد قليل.';

      setMessages((prev) => [
        ...prev,
        {
          id: 'b-' + Date.now(),
          role: 'assistant',
          text: reply,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          aiEngine: data.engine,
          perspectives: data.perspectives,
          activePerspectiveTab: 'consensus',
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          role: 'assistant',
          text: 'أهلاً بك يا صديقي، لضمان أعلى ثبات ننصح بمثبت DPG بنسبة 1%، والتعتيق 30 يوماً في زجاج عسلي محكم.',
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          aiEngine: {
            id: 'ensemble',
            name: 'الخبير شاهين',
            badge: '👑 معمل الخبير شاهين الاحتياطي',
            provider: 'ensemble',
          },
        },
      ]);
    } finally {
      setIsLoading(false);
      setDripping(false);
    }
  };

  const handleCopySingle = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyEntireChat = () => {
    const transcript = messages
      .map((m) => `[${m.role === 'user' ? 'السؤال' : 'الخبير شاهين'} - ${m.timestamp}]:\n${m.text}`)
      .join('\n\n' + '─'.repeat(40) + '\n\n');

    navigator.clipboard.writeText(transcript);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleClearHistory = () => {
    clearChatSession();
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setDaysRemaining(30);
    setShowClearConfirm(false);
  };

  const handleManualDrop = () => {
    setDripping(true);
    setScaleWeight((prev) => +(prev + 0.22).toFixed(2));
    setTimeout(() => setDripping(false), 800);
  };

  return (
    <div className="space-y-4">
      {/* 1. Compact Slim Header with Expiry Info & Controls */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-amber-600 shrink-0">
            <img
              src={perfumerImg}
              alt="الخبير شاهين"
              className="w-full h-full object-cover object-top"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-stone-900 font-serif-luxury">
                {rtl ? 'مجلس الخبير شاهين · شيخ العطارين' : 'Master Perfumer Shahin AI Council'}
              </h2>
              {/* 30-Day Auto-Purge Persistence Badge */}
              <div
                className="flex items-center gap-1 text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-medium"
                title={rtl ? 'يتم حفظ المحادثة كاملة في جهازك وتُمسح تلقائياً بعد 30 يوماً من بدئها' : 'Chat session stored encrypted locally and auto-purged after 30 days'}
              >
                <Clock className="w-3 h-3 text-emerald-700" />
                <span>{rtl ? `محفوظة بالكامل (تُمسح بعد ${daysRemaining} يوماً)` : `Active Vault (${daysRemaining}d remaining)`}</span>
              </div>
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              {isLoading ? (
                <span className="text-amber-800 font-medium animate-pulse">
                  🧪 {compoundingPhrases[compoundingStep]}
                </span>
              ) : (
                rtl
                  ? 'تفاعل مباشر وحفظ تلقائي لكامل الجلسة لمدة شهر كامل مع إمكانية التصدير'
                  : 'Multi-AI formulation synthesis co-pilot with one-month persistent cache'
              )}
            </div>
          </div>
        </div>

        {/* Workbench Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Scale Display */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-mono-numbers">
            <span className="text-stone-400 text-[10px]">{rtl ? 'الميزان:' : 'Scale:'}</span>
            <span className="text-amber-400 font-bold">{scaleWeight} g</span>
          </div>

          <button
            onClick={handleManualDrop}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
            title={rtl ? 'إضافة قطرة عطرية للمركب' : 'Add aroma drop to scale'}
          >
            <Droplet className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">{rtl ? 'إضافة قطرة' : '+1 Drop'}</span>
          </button>

          {/* Download TXT Transcript */}
          <button
            onClick={() => exportChatTranscriptToFile(messages, daysRemaining)}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            title={rtl ? 'تنزيل نسخة احتياطية من المحادثة كملف نصي TXT' : 'Download chat transcript as TXT'}
          >
            <Download className="w-3.5 h-3.5 text-amber-800" />
            <span className="hidden sm:inline">{rtl ? 'تنزيل نسخة TXT' : 'Export TXT'}</span>
          </button>

          <button
            onClick={handleCopyEntireChat}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            title={rtl ? 'نسخ المحادثة بالكامل' : 'Copy entire transcript'}
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">{rtl ? 'تم النسخ!' : 'Copied!'}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{rtl ? 'نسخ المحادثة' : 'Copy All'}</span>
              </>
            )}
          </button>

          {/* Manual Clear Session Button */}
          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title="مسح سجل المحادثة الآن"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Confirmation Modal to Clear Chat Manually */}
      {showClearConfirm && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>
              هل ترغب في مسح سجل المحادثة بالكامل الآن؟ (تُمسح تلقائياً بعد {daysRemaining} يوماً).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2.5 py-1 bg-white border border-stone-200 rounded text-stone-600 hover:bg-stone-50 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleClearHistory}
              className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded cursor-pointer"
            >
              تأكيد المسح
            </button>
          </div>
        </div>
      )}

      {/* 2. Expanded Chat Board Container */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-md flex flex-col h-[780px] overflow-hidden">
        
        {/* Multi-AI Model Selector Toolbar */}
        <div className="px-3.5 py-2.5 bg-stone-950 text-white border-b border-stone-800 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 shrink-0 text-amber-400 font-bold text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">محرك الذكاء العطري:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {AI_ENGINES.map((eng) => {
              const isSelected = selectedModel === eng.id;
              return (
                <button
                  key={eng.id}
                  onClick={() => setSelectedModel(eng.id as any)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border ${
                    isSelected
                      ? eng.color + ' font-bold shadow-xs'
                      : 'bg-stone-900/90 text-stone-400 hover:text-stone-200 border-stone-800 hover:border-stone-700'
                  }`}
                  title={eng.name + ' - ' + eng.desc}
                >
                  <span>{eng.short}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                </button>
              );
            })}

            {/* AI Matrix HUD Button */}
            <button
              onClick={() => setShowAiMatrix(!showAiMatrix)}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border ${
                showAiMatrix
                  ? 'bg-amber-400 text-stone-950 border-amber-300 font-bold'
                  : 'bg-stone-900 text-amber-300 border-stone-800 hover:border-amber-500/40'
              }`}
              title="عرض حالة شبكة الذكاء الاصطناعي الأربعة المتصلة بالمعمل"
            >
              <Layers className="w-3 h-3" />
              <span className="hidden md:inline">شبكة الذكاء (4)</span>
            </button>
          </div>
        </div>

        {/* Connected AI Engines Matrix Panel */}
        {showAiMatrix && (
          <div className="p-3.5 bg-stone-900 text-stone-200 border-b border-stone-800 text-xs space-y-2 shrink-0 animate-in fade-in">
            <div className="flex items-center justify-between text-amber-300 font-bold text-xs">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>شبكة محركات الذكاء الاصطناعي المؤتمتة بالمعمل (Automated AI Council):</span>
              </span>
              <button onClick={() => setShowAiMatrix(false)} className="text-stone-400 hover:text-white cursor-pointer">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded-xl bg-stone-950 border border-emerald-500/30 flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0 animate-pulse" />
                <div>
                  <div className="font-bold text-emerald-300">Google Gemini 3.8 Flash</div>
                  <div className="text-stone-400 text-[10px]">حسابات الأوزان بالغرام والمل وسرعة الاستجابة.</div>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-stone-950 border border-blue-500/30 flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 mt-1 shrink-0 animate-pulse" />
                <div>
                  <div className="font-bold text-blue-300">DeepSeek R1 Chemistry</div>
                  <div className="text-stone-400 text-[10px]">استدلال كيميائي، الكثافة ومعايير IFRA.</div>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-stone-950 border border-green-500/30 flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 mt-1 shrink-0 animate-pulse" />
                <div>
                  <div className="font-bold text-green-300">ChatGPT GPT-4o Architect</div>
                  <div className="text-stone-400 text-[10px]">هندسة الأكوردات، الفوحان وقوس الأداء.</div>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-stone-950 border border-purple-500/30 flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 mt-1 shrink-0 animate-pulse" />
                <div>
                  <div className="font-bold text-purple-300">Claude 3.5 Haute Parfumerie</div>
                  <div className="text-stone-400 text-[10px]">تقاليد جراس وتعتيق النيش الأرستقراطي.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages Stream Board */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-stone-50/50">
          {messages.map((m) => {
            const activeDisplayContent =
              m.activePerspectiveTab && m.activePerspectiveTab !== 'consensus' && m.perspectives
                ? m.perspectives.find((p) => p.modelId === m.activePerspectiveTab)?.reply || m.text
                : m.text;

            const extractedFormula = m.role === 'assistant' ? extractFormulaFromAIMessage(activeDisplayContent) : null;

            return (
              <div
                key={m.id}
                className={`flex items-start gap-3 sm:gap-4 ${
                  m.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs ${
                    m.role === 'user'
                      ? 'bg-amber-900 text-amber-200'
                      : 'overflow-hidden border border-amber-700/60'
                  }`}
                >
                  {m.role === 'user' ? (
                    'أنت'
                  ) : (
                    <img
                      src={perfumerImg}
                      alt="شاهين"
                      className="w-full h-full object-cover object-top"
                    />
                  )}
                </div>

                {/* Message Content Bubble */}
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 ${
                    m.role === 'user'
                      ? 'bg-amber-900 text-white rounded-tl-xs'
                      : 'bg-white text-stone-900 border border-stone-200 rounded-tr-xs'
                  }`}
                >
                  {/* AI Engine Header for Assistant */}
                  {m.role === 'assistant' && (
                    <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-stone-100 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-amber-950 font-serif-luxury text-xs">الخبير شاهين</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 ${
                          m.aiEngine?.provider === 'deepseek' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                          m.aiEngine?.provider === 'openai' ? 'bg-green-50 text-green-800 border-green-200' :
                          m.aiEngine?.provider === 'claude' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                          m.aiEngine?.provider === 'gemini' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          'bg-amber-50 text-amber-900 border-amber-200'
                        }`}>
                          <span>{m.aiEngine?.badge || '⚡ مجلس الخبراء المؤتمت'}</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-400 font-mono-numbers">{m.timestamp}</span>
                    </div>
                  )}

                  {/* Perspective Switcher Tabs on Message */}
                  {m.role === 'assistant' && m.perspectives && m.perspectives.length > 0 && (
                    <div className="p-1.5 bg-stone-50 rounded-xl border border-stone-200/80 mb-2 space-y-1">
                      <div className="text-[10px] text-stone-500 font-bold flex items-center justify-between px-1">
                        <span>تبديل منظور المحركات المستشارة:</span>
                        <span className="text-[9px] text-amber-700 bg-amber-100/60 px-1.5 py-0.2 rounded font-mono-numbers">4 نماذج متزامنة</span>
                      </div>
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                        <button
                          onClick={() => setActivePerspectiveForMessage(m.id, 'consensus')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 border ${
                            (!m.activePerspectiveTab || m.activePerspectiveTab === 'consensus')
                              ? 'bg-amber-200/90 text-amber-950 border-amber-400 shadow-2xs'
                              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          <span>⚡ خلاصة شاهين الموحدة</span>
                        </button>
                        {m.perspectives.map((p) => {
                          const isActive = m.activePerspectiveTab === p.modelId;
                          return (
                            <button
                              key={p.modelId}
                              onClick={() => setActivePerspectiveForMessage(m.id, p.modelId)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 border ${
                                isActive
                                  ? p.color + ' font-bold shadow-2xs'
                                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                              }`}
                            >
                              <span>{p.badge}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Text Payload */}
                  <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line font-sans break-words space-y-2">
                    {activeDisplayContent}
                  </div>

                  {/* SMART INTERACTION BAR: Transfer Chat Data to App Modules */}
                  {extractedFormula && (
                    <div className="mt-3 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl space-y-2.5 text-xs text-amber-950 animate-in fade-in">
                      <div className="flex items-center justify-between font-bold text-amber-900">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-700" />
                          <span>تحويل بيانات هذه الخلطة لأيقونات وحاسبات التطبيق:</span>
                        </span>
                        <span className="text-[10px] font-mono-numbers bg-white px-2 py-0.5 rounded border border-amber-200">
                          {extractedFormula.concentrationPercent}% {extractedFormula.concentrationType.toUpperCase()}
                        </span>
                      </div>

                      {/* Interactive Transfer Buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <button
                          onClick={() => onApplyToConcentrationCalculator(extractedFormula)}
                          className="p-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                          title="تطبيق مقادير هذه الخلطة في حاسبة التركيب وتعبئة الزجاجة"
                        >
                          <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                          <span>حاسبة التركيب</span>
                        </button>

                        <button
                          onClick={() => onApplyToPyramidCalculator(extractedFormula)}
                          className="p-2 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                          title="نقل النوتات العطرية إلى حاسبة الهرم العطري"
                        >
                          <Layers className="w-3.5 h-3.5 text-amber-700" />
                          <span>الهرم العطري</span>
                        </button>

                        <button
                          onClick={() => {
                            onRecordToRecipeLibrary(extractedFormula);
                            setRecordedId(m.id);
                            setTimeout(() => setRecordedId(null), 3000);
                          }}
                          className="p-2 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                          title="تدوين وحفظ هذه الخلطة فوراً في مكتبة الوصفات والتشغيلات"
                        >
                          {recordedId === m.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">تم التدوين!</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="w-3.5 h-3.5 text-emerald-600" />
                              <span>تدوين الخلطة</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => onCalculateCosting(extractedFormula)}
                          className="p-2 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                          title="حساب تكلفة إنتاج وسعر بيع هذه التركيبة"
                        >
                          <DollarSign className="w-3.5 h-3.5 text-amber-800" />
                          <span>حساب التكلفة</span>
                        </button>
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[11px] text-amber-900/80 border-t border-amber-200/60">
                        <span>التركيبة جاهزة للتصنيع والمعمل:</span>
                        <button
                          onClick={() => onPrintSpecSheet(extractedFormula)}
                          className="text-amber-900 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3 h-3 text-amber-800" />
                          <span>طباعة بطاقة التشغيلة الرسمية ➔</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bottom Action Strip Under EVERY message */}
                  <div
                    className={`pt-2.5 mt-2 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] ${
                      m.role === 'user'
                        ? 'border-amber-800/80 text-amber-200'
                        : 'border-stone-100 text-stone-500'
                    }`}
                  >
                    <span className="font-mono-numbers">{m.timestamp}</span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopySingle(m.id, activeDisplayContent)}
                        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer font-medium text-xs ${
                          m.role === 'user'
                            ? 'bg-amber-800/80 hover:bg-amber-700 text-white'
                            : 'bg-stone-100 hover:bg-amber-50 hover:text-amber-900 text-stone-700 border border-stone-200/70'
                        }`}
                        title={m.role === 'user' ? 'نسخ هذا السؤال' : 'نسخ هذه الإجابة والتركيبة'}
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">تم النسخ بنجاح!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{m.role === 'user' ? 'نسخ السؤال' : 'نسخ الإجابة والتركيبة'}</span>
                          </>
                        )}
                      </button>

                      {m.role === 'assistant' && (
                        <>
                          {/* Re-consult another model */}
                          <div className="relative">
                            <button
                              onClick={() => setComparingMsgId(comparingMsgId === m.id ? null : m.id)}
                              className="px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-950 border border-stone-200/70 transition-colors flex items-center gap-1 cursor-pointer font-medium text-xs"
                              title="استشارة نموذج ذكاء اصطناعي آخر لمقارنة الرأي"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                              <span className="hidden sm:inline">مقارنة بنموذج آخر</span>
                            </button>

                            {comparingMsgId === m.id && (
                              <div className="absolute left-0 bottom-full mb-1 z-30 bg-stone-900 text-white rounded-xl p-2 shadow-2xl border border-stone-700 min-w-[220px] space-y-1 text-xs animate-in fade-in zoom-in-95">
                                <div className="text-[10px] text-amber-400 font-bold px-1.5 pb-1 border-b border-stone-800 flex items-center justify-between">
                                  <span>اختر نموذجاً للمقارنة:</span>
                                  <button onClick={() => setComparingMsgId(null)} className="text-stone-400 hover:text-white">
                                    ✕
                                  </button>
                                </div>
                                {AI_ENGINES.map((eng) => (
                                  <button
                                    key={eng.id}
                                    onClick={() => {
                                      const prevUserMsg = messages
                                        .slice(0, messages.findIndex((msg) => msg.id === m.id))
                                        .reverse()
                                        .find((msg) => msg.role === 'user');
                                      setComparingMsgId(null);
                                      setSelectedModel(eng.id as any);
                                      handleSend(
                                        `[استشارة متخصصة من محرك ${eng.short}]: ${prevUserMsg?.text || 'أعد حساب التركيبة السابقة'}`,
                                        eng.id as any
                                      );
                                    }}
                                    className="w-full text-right px-2 py-1.5 rounded-lg hover:bg-stone-800 text-stone-200 hover:text-white transition-colors flex items-center justify-between text-[11px] cursor-pointer"
                                  >
                                    <span>{eng.name}</span>
                                    <span className="text-[9px] text-stone-400">{eng.short}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleSpeech(activeDisplayContent)}
                            className="p-1 text-stone-500 hover:text-amber-800 transition-colors flex items-center gap-1 cursor-pointer"
                            title="استماع صوتي لنصيحة الخبير شاهين"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Active Compounding Loading Status */}
          {isLoading && (
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-amber-600 shrink-0">
                <img
                  src={perfumerImg}
                  alt="شاهين"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200/90 p-4 sm:p-5 rounded-2xl text-xs sm:text-sm text-amber-950 space-y-2 shadow-xs max-w-[85%]">
                <div className="font-semibold flex items-center gap-2 text-amber-900">
                  <span className="animate-spin text-base">🧪</span>
                  <span>الخبير شاهين يقطر الزيوت ويزن النوتات بالميزان...</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {compoundingPhrases[compoundingStep]}
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. Fast Suggestion Strip */}
        <div className="p-3 bg-stone-100 border-t border-stone-200 overflow-x-auto flex items-center gap-2 text-xs no-scrollbar shrink-0">
          <span className="text-[11px] font-bold text-stone-500 whitespace-nowrap">
            أوامر وتفاعلات سريعة:
          </span>
          {MASTER_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              disabled={isLoading}
              className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white hover:bg-amber-50 border border-stone-200 text-stone-700 hover:text-amber-900 text-xs transition-colors cursor-pointer shrink-0 shadow-2xs font-medium"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* 4. Large Interactive Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3.5 sm:p-4 bg-white border-t border-stone-200 flex items-center gap-3 shrink-0"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="اسأل الخبير شاهين أو اطلب تطبيق الخلطة (مثال: تمام تقترح عليا انهى تركيبة بالظبط ونسب المكونات قد اية)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-amber-700 focus:bg-white transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-amber-800 hover:bg-amber-900 disabled:opacity-40 text-white rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-xs"
          >
            <span>إرسال</span>
            <Send className="w-4 h-4 rotate-180" />
          </button>
        </form>

      </div>
    </div>
  );
};
