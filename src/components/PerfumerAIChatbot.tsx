import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  X,
  Volume2,
  Copy,
  Check,
  RotateCcw,
  Minimize2,
  Maximize2,
  Droplet,
  Beaker,
  Scale,
  FlaskConical,
  Layers,
  BookmarkPlus,
  DollarSign,
  Printer,
  Download,
  Trash2,
  Clock,
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

interface PerfumerAIChatbotProps {
  onApplyToConcentrationCalculator: (formula: ExtractedAIPerfume) => void;
  onApplyToPyramidCalculator: (formula: ExtractedAIPerfume) => void;
  onRecordToRecipeLibrary: (formula: ExtractedAIPerfume) => void;
  onCalculateCosting: (formula: ExtractedAIPerfume) => void;
  onPrintSpecSheet: (formula: ExtractedAIPerfume) => void;
}

const PRESET_QUESTIONS = [
  'تمام تقترح عليا انهى تركيبة بالظبط ونسب المكونات قد اية',
  'طبق هذه التركيبة في حاسبة التركيب والمعمل',
  'كيف أضاعف ثبات وفوحان العطر لأكثر من 24 ساعة؟',
  'العطر أصبح حليبياً ومتعكراً بعد إضافة الماء، كيف أصفّيه؟',
  'ما النسبة الذهبية لعطر صيفي منعش وفواح؟',
];

export const PerfumerAIChatbot: React.FC<PerfumerAIChatbotProps> = ({
  onApplyToConcentrationCalculator,
  onApplyToPyramidCalculator,
  onRecordToRecipeLibrary,
  onCalculateCosting,
  onPrintSpecSheet,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Load persisted session with 30-day (1 month) expiration check
  const [sessionData, setSessionData] = useState(() => loadStoredChatSession());
  const [messages, setMessages] = useState<ChatMessage[]>(() => sessionData.messages);
  const [daysRemaining, setDaysRemaining] = useState(sessionData.daysRemaining);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [compoundingStep, setCompoundingStep] = useState(0);
  const [currentScaleWeight, setCurrentScaleWeight] = useState(12.45);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Copy & Action tracking states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [recordedId, setRecordedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Persist messages whenever changed & broadcast to sync full lab view
  useEffect(() => {
    saveChatSession(messages);
    window.dispatchEvent(new CustomEvent('miyaar-chat-updated', { detail: messages }));
  }, [messages]);

  // Sync with updates from full lab view
  useEffect(() => {
    const handleSync = (e: any) => {
      if (Array.isArray(e.detail)) {
        setMessages(e.detail);
      }
    };
    window.addEventListener('miyaar-chat-updated', handleSync);
    return () => window.removeEventListener('miyaar-chat-updated', handleSync);
  }, []);

  // Listen for cross-app AI consultation requests from calculators
  useEffect(() => {
    const handleConsultation = (e: any) => {
      if (e.detail) {
        setIsOpen(true);
        setTimeout(() => {
          handleSendMessage(e.detail);
        }, 150);
      }
    };
    window.addEventListener('open-ai-chat-with-prompt', handleConsultation);
    return () => window.removeEventListener('open-ai-chat-with-prompt', handleConsultation);
  }, []);

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setCompoundingStep((prev) => (prev + 1) % 4);
        setCurrentScaleWeight((prev) => +(prev + 0.35 + Math.random() * 0.2).toFixed(2));
      }, 1100);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const compoundingMessages = [
    'يقطر الزيوت الخام في المخبار بدقة...',
    'يزن قطرات النوتات ويفحص الكثافة النوعية...',
    'يمزج مركب العطر ويفحص التناغم بين القمة والقاعدة...',
    'يصيغ لك خلاصة سر التركيبة من المعمل...',
  ];

  const handleSendMessage = async (
    textToSend?: string,
    overrideModel?: 'auto' | 'gemini' | 'deepseek' | 'openai' | 'claude'
  ) => {
    const text = (textToSend || input).trim();
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
            setIsOpen(false);
            return;
          }
        }
      }
    }

    const userMessage: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          model: activeModelChoice,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      const data = await response.json();
      const replyText = data.reply || 'معذرة، أعد المحاولة بعد قليل.';

      const botMessage: ChatMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        aiEngine: data.engine,
        perspectives: data.perspectives,
        activePerspectiveTab: 'consensus',
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const fallbackMessage: ChatMessage = {
        id: 'bot-err-' + Date.now(),
        role: 'assistant',
        text: 'أهلاً بك يا صديقي في مختبري العطري. لمضاعفة الثبات والفوحان، احرص على استخدام مثبت DPG بنسبة 1%، مع تعتيق العطر 30 يوماً في زجاج عسلي محكم الإغلاق.',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        aiEngine: {
          id: 'ensemble',
          name: 'الخبير شاهين',
          badge: '👑 معمل الخبير شاهين الاحتياطي',
          provider: 'ensemble',
        },
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsultDifferentEngine = (
    originalUserText: string,
    targetEngine: 'auto' | 'gemini' | 'deepseek' | 'openai' | 'claude'
  ) => {
    setComparingMsgId(null);
    setSelectedModel(targetEngine);
    handleSendMessage(`[استشارة متخصصة من محرك ${targetEngine.toUpperCase()}]: ${originalUserText}`, targetEngine);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyAll = () => {
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

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-40 no-print flex items-center gap-3">
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="hidden sm:flex items-center gap-2 bg-stone-900/90 backdrop-blur-md text-amber-300 text-xs py-2 px-3.5 rounded-full shadow-lg border border-amber-500/30 font-medium"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>الخبير شاهين يقطر مركباً في معمله.. اسأله عن أي تركيبة!</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative group p-1 rounded-full bg-gradient-to-tr from-amber-900 via-stone-900 to-amber-700 shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-400/40"
          title="شات بوت خبير تركيب العطور (شاهين)"
        >
          <span className="absolute -inset-1 rounded-full bg-amber-500/20 blur-md group-hover:bg-amber-500/40 transition-all animate-pulse" />
          
          <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-amber-300/80">
            <img
              src={perfumerImg}
              alt="الخبير شاهين صانع العطور"
              className="w-full h-full object-cover object-top"
            />
          </div>

          <span className="absolute -bottom-1 -left-1 w-5 h-5 bg-amber-500 text-stone-950 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md border border-white">
            🧪
          </span>
        </button>
      </div>

      {/* Main Chatbot Window with Expanded Board Space */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className={`fixed z-50 bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col no-print transition-all ${
              isFullScreen
                ? 'inset-3 sm:inset-6'
                : 'bottom-20 right-3 sm:right-6 w-[calc(100vw-1.5rem)] sm:w-[640px] lg:w-[780px] h-[86vh]'
            }`}
          >
            {/* 1. Compact Slim Header with Expiry Info */}
            <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-amber-400/80 shrink-0">
                  <img
                    src={perfumerImg}
                    alt="الخبير شاهين"
                    className="w-full h-full object-cover object-top"
                  />
                  {isLoading && (
                    <span className="absolute inset-0 bg-amber-500/40 mix-blend-overlay animate-pulse" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-stone-100 font-serif-luxury">
                      الخبير شاهين
                    </span>
                    {/* Auto-Purge Expiration Badge */}
                    <span
                      className="px-2 py-0.2 bg-emerald-950 border border-emerald-500/40 text-emerald-300 rounded-full text-[9px] flex items-center gap-1 font-mono-numbers"
                      title="يتم حفظ المحادثة كاملة وتُمسح تلقائياً بعد 30 يوماً من بدئها"
                    >
                      <Clock className="w-2.5 h-2.5 text-emerald-400" />
                      <span>تُمسح بعد {daysRemaining} يوماً</span>
                    </span>
                  </div>
                  <div className="text-[10px] text-amber-300/80 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>
                      {isLoading ? compoundingMessages[compoundingStep] : 'الميزان الرقمي: ' + currentScaleWeight + 'g'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Controls in Header */}
              <div className="flex items-center gap-1.5">
                {/* Download Backup */}
                <button
                  onClick={() => exportChatTranscriptToFile(messages, daysRemaining)}
                  className="p-1.5 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="تنزيل نسخة نصية TXT"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                </button>

                <button
                  onClick={handleCopyAll}
                  className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="نسخ كامل المحادثة"
                >
                  {copiedAll ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span className="hidden sm:inline text-[11px]">{copiedAll ? 'تم النسخ' : 'نسخ الكل'}</span>
                </button>

                {/* Clear Button */}
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="p-1.5 text-stone-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                  title="مسح سجل المحادثة الآن"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-1.5 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title={isFullScreen ? 'تصغير الحجم' : 'تكبير الشاشة بالكامل'}
                >
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Multi-AI Model Selector Toolbar */}
            <div className="px-3 py-2 bg-stone-950 text-white border-b border-stone-800 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1.5 shrink-0 text-amber-400 font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">محرك الذكاء:</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {AI_ENGINES.map((eng) => {
                  const isSelected = selectedModel === eng.id;
                  return (
                    <button
                      key={eng.id}
                      onClick={() => setSelectedModel(eng.id as any)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border ${
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
                  className={`px-2 py-1 rounded-xl text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 border ${
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
              <div className="p-3 bg-stone-900 text-stone-200 border-b border-stone-800 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-amber-300 font-bold text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>شبكة محركات الذكاء الاصطناعي المؤتمتة بالمعمل (Automated AI Council):</span>
                  </span>
                  <button onClick={() => setShowAiMatrix(false)} className="text-stone-400 hover:text-white cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-stone-950 border border-emerald-500/30 flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0 animate-pulse" />
                    <div>
                      <div className="font-bold text-emerald-300">Google Gemini 3.8 Flash</div>
                      <div className="text-stone-400 text-[10px]">حسابات الأوزان بالغرام، سرعة استخراج نسب الزيت والكحول.</div>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-stone-950 border border-blue-500/30 flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 mt-1 shrink-0 animate-pulse" />
                    <div>
                      <div className="font-bold text-blue-300">DeepSeek R1 Chemistry</div>
                      <div className="text-stone-400 text-[10px]">استدلال كيميائي، الكثافة النوعية ومعايير سلامة IFRA.</div>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-stone-950 border border-green-500/30 flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 mt-1 shrink-0 animate-pulse" />
                    <div>
                      <div className="font-bold text-green-300">ChatGPT GPT-4o Architect</div>
                      <div className="text-stone-400 text-[10px]">هندسة الأكوردات، الفوحان التجاري والجاذبية التسويقية.</div>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-stone-950 border border-purple-500/30 flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 mt-1 shrink-0 animate-pulse" />
                    <div>
                      <div className="font-bold text-purple-300">Claude 3.5 Haute Parfumerie</div>
                      <div className="text-stone-400 text-[10px]">تقاليد جراس الفرنسية، التعتيق الصبور، والنيش الأرستقراطي.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Clear Confirmation Prompt */}
            {showClearConfirm && (
              <div className="p-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-xs text-rose-900">
                <span>مسح المحادثة بالكامل الآن؟ (تُمسح تلقائياً بعد {daysRemaining} يوماً).</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-0.5 bg-white border border-stone-200 rounded text-stone-600 hover:bg-stone-50 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleClearHistory}
                    className="px-2.5 py-0.5 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded cursor-pointer"
                  >
                    مسح
                  </button>
                </div>
              </div>
            )}

            {/* 2. Expanded Chat Board */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-stone-50/60">
              {messages.map((msg) => {
                // Determine active perspective content if user toggled model tabs on this message
                const activeDisplayContent =
                  msg.activePerspectiveTab && msg.activePerspectiveTab !== 'consensus' && msg.perspectives
                    ? msg.perspectives.find((p) => p.modelId === msg.activePerspectiveTab)?.reply || msg.text
                    : msg.text;

                const extractedFormula = msg.role === 'assistant' ? extractFormulaFromAIMessage(activeDisplayContent) : null;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* Avatar */}
                    {msg.role === 'assistant' ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-600/50 shrink-0 mt-0.5 shadow-xs">
                        <img
                          src={perfumerImg}
                          alt="شاهين"
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-amber-900 text-amber-200 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                        أنت
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[92%] sm:max-w-[86%] p-4 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-2xs space-y-2.5 ${
                        msg.role === 'user'
                          ? 'bg-amber-900 text-white rounded-tl-xs'
                          : 'bg-white text-stone-900 border border-stone-200/90 rounded-tr-xs'
                      }`}
                    >
                      {/* AI Engine Header for Assistant */}
                      {msg.role === 'assistant' && (
                        <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-stone-100 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-amber-950 font-serif-luxury">الخبير شاهين</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 ${
                              msg.aiEngine?.provider === 'deepseek' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                              msg.aiEngine?.provider === 'openai' ? 'bg-green-50 text-green-800 border-green-200' :
                              msg.aiEngine?.provider === 'claude' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                              msg.aiEngine?.provider === 'gemini' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              'bg-amber-50 text-amber-900 border-amber-200'
                            }`}>
                              <span>{msg.aiEngine?.badge || '⚡ مجلس الخبراء المؤتمت'}</span>
                            </span>
                          </div>
                          <span className="text-[10px] text-stone-400 font-mono-numbers">{msg.timestamp}</span>
                        </div>
                      )}

                      {/* Perspective Switcher Tabs on Message (When Multi-AI Ensemble generated) */}
                      {msg.role === 'assistant' && msg.perspectives && msg.perspectives.length > 0 && (
                        <div className="p-1.5 bg-stone-50 rounded-xl border border-stone-200/80 mb-2 space-y-1">
                          <div className="text-[10px] text-stone-500 font-bold flex items-center justify-between px-1">
                            <span>تبديل منظور المحركات المستشارة:</span>
                            <span className="text-[9px] text-amber-700 bg-amber-100/60 px-1.5 py-0.2 rounded">دمج مؤتمت 4 محركات</span>
                          </div>
                          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                            <button
                              onClick={() => setActivePerspectiveForMessage(msg.id, 'consensus')}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 border ${
                                (!msg.activePerspectiveTab || msg.activePerspectiveTab === 'consensus')
                                  ? 'bg-amber-200/90 text-amber-950 border-amber-400 shadow-2xs'
                                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                              }`}
                            >
                              <span>⚡ خلاصة شاهين الموحدة</span>
                            </button>
                            {msg.perspectives.map((p) => {
                              const isActive = msg.activePerspectiveTab === p.modelId;
                              return (
                                <button
                                  key={p.modelId}
                                  onClick={() => setActivePerspectiveForMessage(msg.id, p.modelId)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 border ${
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
                      <div className="whitespace-pre-line break-words font-sans space-y-2">
                        {activeDisplayContent}
                      </div>

                      {/* SMART INTERACTION BAR: Transfer Chat Data to App Modules */}
                      {extractedFormula && (
                        <div className="mt-3 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl space-y-2.5 text-xs text-amber-950 animate-in fade-in">
                          <div className="flex items-center justify-between font-bold text-amber-900">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-amber-700" />
                              <span>تحويل هذه الخلطة لأيقونات وحاسبات التطبيق:</span>
                            </span>
                            <span className="text-[10px] font-mono-numbers bg-white px-2 py-0.5 rounded border border-amber-200">
                              {extractedFormula.concentrationPercent}% {extractedFormula.concentrationType.toUpperCase()}
                            </span>
                          </div>

                          {/* Interactive Transfer Buttons */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            <button
                              onClick={() => {
                                onApplyToConcentrationCalculator(extractedFormula);
                                setIsOpen(false);
                              }}
                              className="p-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                              title="تطبيق مقادير هذه الخلطة في حاسبة التركيب وتعبئة الزجاجة"
                            >
                              <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                              <span>حاسبة التركيب</span>
                            </button>

                            <button
                              onClick={() => {
                                onApplyToPyramidCalculator(extractedFormula);
                                setIsOpen(false);
                              }}
                              className="p-2 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                              title="نقل النوتات العطرية إلى حاسبة الهرم العطري"
                            >
                              <Layers className="w-3.5 h-3.5 text-amber-700" />
                              <span>الهرم العطري</span>
                            </button>

                            <button
                              onClick={() => {
                                onRecordToRecipeLibrary(extractedFormula);
                                setRecordedId(msg.id);
                                setTimeout(() => setRecordedId(null), 3000);
                              }}
                              className="p-2 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                              title="تدوين وحفظ هذه الخلطة فوراً في مكتبة الوصفات والتشغيلات"
                            >
                              {recordedId === msg.id ? (
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
                              onClick={() => {
                                onCalculateCosting(extractedFormula);
                                setIsOpen(false);
                              }}
                              className="p-2 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                              title="حساب تكلفة إنتاج وسعر بيع هذه التركيبة"
                            >
                              <DollarSign className="w-3.5 h-3.5 text-amber-800" />
                              <span>حساب التكلفة</span>
                            </button>
                          </div>

                          <div className="pt-1 flex items-center justify-between text-[11px] text-amber-900/80 border-t border-amber-200/60">
                            <span>طباعة ورقة المعمل:</span>
                            <button
                              onClick={() => {
                                onPrintSpecSheet(extractedFormula);
                                setIsOpen(false);
                              }}
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
                        className={`flex flex-wrap items-center justify-between gap-2 text-[10px] pt-2 border-t ${
                          msg.role === 'user'
                            ? 'border-amber-800/80 text-amber-200'
                            : 'border-stone-100 text-stone-400'
                        }`}
                      >
                        <span className="font-mono-numbers">{msg.timestamp}</span>

                        <div className="flex items-center gap-1.5">
                          {/* Copy Button Under EACH message */}
                          <button
                            onClick={() => handleCopyMessage(msg.id, activeDisplayContent)}
                            className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer font-medium text-[11px] ${
                              msg.role === 'user'
                                ? 'bg-amber-800/80 hover:bg-amber-700 text-white'
                                : 'bg-stone-100 hover:bg-amber-50 hover:text-amber-900 text-stone-700 border border-stone-200/60'
                            }`}
                            title={msg.role === 'user' ? 'نسخ هذا السؤال' : 'نسخ هذه الإجابة والتركيبة'}
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500 font-semibold">تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>{msg.role === 'user' ? 'نسخ السؤال' : 'نسخ الإجابة والتركيبة'}</span>
                              </>
                            )}
                          </button>

                          {msg.role === 'assistant' && (
                            <>
                              {/* Re-consult another model */}
                              <div className="relative">
                                <button
                                  onClick={() => setComparingMsgId(comparingMsgId === msg.id ? null : msg.id)}
                                  className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-950 border border-stone-200 transition-colors flex items-center gap-1 cursor-pointer font-medium text-[11px]"
                                  title="استشارة نموذج ذكاء اصطناعي آخر على نفس السؤال لمقارنة الرأي"
                                >
                                  <Sparkles className="w-3 h-3 text-amber-700" />
                                  <span>مقارنة بنموذج آخر</span>
                                </button>

                                {comparingMsgId === msg.id && (
                                  <div className="absolute left-0 bottom-full mb-1 z-30 bg-stone-900 text-white rounded-xl p-2 shadow-2xl border border-stone-700 min-w-[210px] space-y-1 text-xs animate-in fade-in zoom-in-95">
                                    <div className="text-[10px] text-amber-400 font-bold px-1.5 pb-1 border-b border-stone-800 flex items-center justify-between">
                                      <span>اختر نموذجاً للمقارنة:</span>
                                      <X
                                        className="w-3 h-3 cursor-pointer text-stone-400 hover:text-white"
                                        onClick={() => setComparingMsgId(null)}
                                      />
                                    </div>
                                    {AI_ENGINES.map((eng) => (
                                      <button
                                        key={eng.id}
                                        onClick={() => {
                                          const prevUserMsg = messages
                                            .slice(0, messages.findIndex((m) => m.id === msg.id))
                                            .reverse()
                                            .find((m) => m.role === 'user');
                                          handleConsultDifferentEngine(
                                            prevUserMsg?.text || 'أعد صياغة التركيبة السابقة وحساب نسبها برؤيتك المتخصصة',
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
                                className="p-1 hover:text-amber-800 transition-colors flex items-center gap-1 cursor-pointer"
                                title="استماع صوتي"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Compounding Indicator */}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-600/50 shrink-0">
                    <img
                      src={perfumerImg}
                      alt="شاهين"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl rounded-tr-xs text-xs text-amber-950 space-y-2 shadow-2xs max-w-[85%]">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="animate-spin text-base">🧪</span>
                      <span>الخبير شاهين يقطر الزيوت ويزن المركب الآن بالميزان...</span>
                    </div>
                    <div className="text-[11px] text-amber-800 leading-relaxed">
                      {compoundingMessages[compoundingStep]}
                    </div>
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

            {/* 3. Quick Suggestions Bar */}
            <div className="p-2.5 bg-stone-100/90 border-t border-stone-200 overflow-x-auto flex items-center gap-2 text-xs no-scrollbar shrink-0">
              <span className="text-[11px] font-bold text-stone-500 whitespace-nowrap">
                أوامر وتفاعلات:
              </span>
              {PRESET_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  disabled={isLoading}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-amber-50 border border-stone-200 text-stone-700 hover:text-amber-900 text-[11px] transition-all cursor-pointer shadow-2xs shrink-0 font-medium"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* 4. Large Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-white border-t border-stone-200 flex items-center gap-2 shrink-0"
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="اسأل الخبير شاهين أو اطلب تطبيق الخلطة (مثال: طبق هذه التركيبة في حاسبة المعمل)..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-amber-700 focus:bg-white transition-all shadow-inner"
              />

              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2.5 px-4 bg-amber-800 hover:bg-amber-900 disabled:opacity-40 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center shrink-0 font-medium text-xs sm:text-sm gap-1"
                title="إرسال"
              >
                <span>إرسال</span>
                <Send className="w-3.5 h-3.5 rotate-180" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
