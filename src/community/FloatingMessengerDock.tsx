/**
 * The Facebook-style chat box docked at the bottom of «مجتمع شام» (the merchant's AI Studio design, on the real
 * messenger): opening it with a member starts (or reuses) the direct conversation, messages refresh every few
 * seconds, pictures and quick emojis can be sent, and «فتح في الماسنجر» moves to the full messenger.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCheck, ImagePlus, Maximize2, Minus, Send, Smile, X } from 'lucide-react';
import { cx, resizeImage, type ChatView, type Message } from './api';
import { pulseNow } from './session';
import { Avatar, Spinner, errorText, tx, type Lang } from './ui';

const QUICK_EMOJIS = ['👍', '❤️', '🧪', '🔥', '🌹', '✨', '😂', '👌'];
const POLL_MS = 4000;

export function FloatingMessengerDock({ lang, userId, onClose, onExpand, toast }: {
  lang: Lang; userId: string; onClose: () => void; onExpand: (chatId: string) => void; toast: (s: string) => void;
}) {
  const t = tx(lang);
  const [chatId, setChatId] = useState<string | null>(null);
  const [view, setView] = useState<ChatView | null>(null);
  const [error, setError] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const lastId = useRef('');

  useEffect(() => {
    let alive = true;
    setChatId(null); setView(null); setError('');
    cx<{ id: string }>('/community/chats/direct', { body: { userId } })
      .then(({ id }) => { if (alive) setChatId(id); })
      .catch((e) => { if (alive) setError(errorText(e, lang)); });
    return () => { alive = false; };
  }, [userId, lang]);

  const load = useCallback(async () => {
    if (!chatId) return;
    try {
      const v = await cx<ChatView>(`/community/chats/${chatId}/messages`);
      setView(v);
      const last = v.messages[v.messages.length - 1];
      if (last && last.id !== lastId.current) { lastId.current = last.id; void cx(`/community/chats/${chatId}/read`, { body: {} }).then(() => pulseNow()).catch(() => undefined); }
    } catch (e) { setError(errorText(e, lang)); }
  }, [chatId, lang]);
  useEffect(() => {
    if (!chatId) return;
    void load();
    const id = setInterval(() => { if (!document.hidden) void load(); }, POLL_MS);
    return () => clearInterval(id);
  }, [chatId, load]);
  useEffect(() => { if (!minimized) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [view?.messages.length, minimized]);

  const post = async (body: Record<string, unknown>) => {
    if (!chatId) return;
    setBusy(true);
    try {
      const msg = await cx<Message>(`/community/chats/${chatId}/messages`, { body });
      setView((v) => (v ? { ...v, messages: [...v.messages, msg] } : v));
    } catch (e) { toast(errorText(e, lang)); } finally { setBusy(false); }
  };
  const send = async () => {
    const content = text.trim();
    if (!content || busy) return;
    setText(''); setShowEmoji(false);
    await post({ kind: 'text', text: content });
  };
  const sendImage = async (f?: File) => {
    if (!f) return;
    try { await post({ kind: 'image', attachment: await resizeImage(f, 1280, 0.8) }); } catch { toast(t('الصورة دي مش مدعومة', 'Unsupported image')); }
  };

  const other = view?.members.find((m) => m.id === userId);
  const name = other?.name || t('محادثة', 'Chat');
  const otherRead = view?.members.find((m) => m.id === userId)?.lastReadAt;

  if (minimized) {
    return (
      <div className="fixed bottom-4 end-4 z-[60] flex cursor-pointer items-center gap-2.5 rounded-full border border-amber-200 bg-white p-2 shadow-xl transition hover:scale-105 hover:border-amber-400 sm:end-6" onClick={() => setMinimized(false)}>
        <span className="relative">{other ? <Avatar user={other} size={38} ring /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600 text-white">💬</span>}</span>
        <span className="pe-1 text-xs font-bold text-stone-900">{name}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer" aria-label={t('إغلاق', 'Close')}><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-2 bottom-2 z-[60] flex h-[460px] max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl sm:inset-x-auto sm:end-6 sm:w-[340px]">
      <div className="flex items-center gap-2 bg-gradient-to-r from-amber-800 to-amber-950 px-3 py-2 text-white">
        {other ? <Avatar user={other} size={32} /> : <span className="h-8 w-8 rounded-full bg-white/20" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="text-[10px] text-amber-200">{other?.online ? t('متصل الآن', 'Active now') : other?.typing ? t('بيكتب…', 'typing…') : t('ماسنجر شام', 'Sham Messenger')}</p>
        </div>
        {chatId && <button type="button" onClick={() => onExpand(chatId)} className="rounded-full p-1.5 hover:bg-white/15 cursor-pointer" title={t('فتح في الماسنجر', 'Open in Messenger')}><Maximize2 className="h-4 w-4" /></button>}
        <button type="button" onClick={() => setMinimized(true)} className="rounded-full p-1.5 hover:bg-white/15 cursor-pointer" title={t('تصغير', 'Minimise')}><Minus className="h-4 w-4" /></button>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-white/15 cursor-pointer" aria-label={t('إغلاق', 'Close')}><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto bg-stone-50 p-3">
        {error ? <p className="rounded-xl bg-rose-50 p-3 text-center text-xs text-rose-700">{error}</p> : !view ? <Spinner /> : !view.messages.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            {other && <Avatar user={other} size={56} />}
            <p className="text-xs text-stone-500">{t(`ابدأ المحادثة مع ${name} 👋`, `Say hi to ${name} 👋`)}</p>
          </div>
        ) : view.messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${m.mine ? 'rounded-ee-sm bg-amber-700 text-white' : 'rounded-es-sm border border-stone-200 bg-white text-stone-800'}`}>
              {m.deleted ? <p className="italic opacity-70">{t('الرسالة اتمسحت', 'Message deleted')}</p>
                : m.kind === 'image' && m.attachment ? <img src={m.attachment} alt="" className="max-h-48 rounded-xl" />
                : m.kind === 'voice' ? <audio controls src={m.attachment || undefined} className="h-8 w-48" />
                : m.kind === 'recipe' ? <p>🧪 {m.text}</p>
                : <p className="whitespace-pre-wrap break-words">{m.text}</p>}
              <p className={`mt-0.5 flex items-center justify-end gap-1 text-[9px] ${m.mine ? 'text-amber-100' : 'text-stone-400'}`}>
                {new Date(m.createdAt).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                {m.mine && otherRead && otherRead >= m.createdAt && <CheckCheck className="h-3 w-3" />}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {showEmoji && (
        <div className="flex flex-wrap gap-1 border-t border-stone-100 bg-white px-2 py-1.5">
          {QUICK_EMOJIS.map((e) => <button key={e} type="button" onClick={() => setText((x) => x + e)} className="rounded-lg p-1 text-lg hover:bg-stone-100 cursor-pointer">{e}</button>)}
        </div>
      )}
      <div className="flex items-center gap-1.5 border-t border-stone-100 bg-white p-2">
        <button type="button" onClick={() => file.current?.click()} disabled={!chatId} className="rounded-full p-1.5 text-amber-700 hover:bg-amber-50 cursor-pointer disabled:opacity-40" title={t('صورة', 'Photo')}><ImagePlus className="h-5 w-5" /></button>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { void sendImage(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" onClick={() => setShowEmoji((x) => !x)} className="rounded-full p-1.5 text-amber-700 hover:bg-amber-50 cursor-pointer"><Smile className="h-5 w-5" /></button>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          disabled={!chatId} placeholder={t('اكتب رسالة…', 'Type a message…')} className="min-w-0 flex-1 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm outline-none focus:border-amber-500" />
        <button type="button" onClick={() => void send()} disabled={!text.trim() || busy} className="rounded-full bg-amber-700 p-2 text-white hover:bg-amber-800 cursor-pointer disabled:opacity-40" aria-label={t('إرسال', 'Send')}><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
