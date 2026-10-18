/**
 * «ماسنجر شام»: direct and group chats with replies, edits, delete-for-everyone, reactions, photos,
 * voice notes, shared recipes, read receipts, typing and online status. Messages are encrypted on the server;
 * new ones arrive by light polling (only what changed since the last look).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BellOff, Bell, Check, CheckCheck, Copy, FlaskConical, ImagePlus, LogOut, Mic, MoreVertical, Pencil, Plus, Reply, Search, Send, Smile, Square, Trash2, UserPlus, Users, X } from 'lucide-react';
import { blobToDataUrl, cx, resizeImage, type ChatSummary, type ChatView, type Message, type PublicUser } from './api';
import { pulseNow, setFastPulse, type SessionState } from './session';
import { RecipeCard, RecipePicker } from './SocialPortal';
import { Avatar, Badge, Btn, Card, Empty, Sheet, Spinner, clock, errorText, inputClass, timeAgo, tx, type Lang } from './ui';

const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EMOJI = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😅', '😢', '😡', '👍', '👏', '🙏', '💪', '🔥', '🌹', '🌸', '✨', '💯', '🎉', '❤️', '💛', '🤍', '🧴', '🫙', '🌿', '🍋', '🌙', '☕', '👌', '✅'];

interface Props { lang: Lang; session: SessionState; chatId?: string; go: (route: string) => void; toast: (s: string) => void }

export default function Messenger({ lang, session, chatId, go, toast }: Props) {
  const t = tx(lang);
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [filter, setFilter] = useState('');
  const [newGroup, setNewGroup] = useState(false);
  const [newChat, setNewChat] = useState(false);
  const loadChats = useCallback(async () => { try { setChats(await cx<ChatSummary[]>('/community/chats')); } catch { setChats((c) => c || []); } }, []);

  useEffect(() => { setFastPulse(true); return () => setFastPulse(false); }, []);
  useEffect(() => { void loadChats(); }, [loadChats]);
  // The pulse tells us when anything new arrived; refresh the list then (and every 15 s for typing / online dots).
  const lastAt = session.pulse?.lastAt;
  useEffect(() => { void loadChats(); }, [lastAt, chatId, loadChats]);
  useEffect(() => { const id = setInterval(() => { if (document.visibilityState === 'visible') void loadChats(); }, 15_000); return () => clearInterval(id); }, [loadChats]);

  const shown = useMemo(() => (chats || []).filter((c) => !filter.trim() || c.title.toLowerCase().includes(filter.trim().toLowerCase())), [chats, filter]);

  return (
    <Card className="grid grid-cols-[minmax(0,1fr)] h-[calc(100vh-190px)] min-h-[520px] overflow-hidden md:grid-cols-[320px_minmax(0,1fr)]">
      <aside className={`flex min-h-0 flex-col border-e border-stone-100 ${chatId ? 'hidden md:flex' : 'flex'}`}>
        <div className="space-y-3 border-b border-stone-100 p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-stone-900">{t('الماسنجر', 'Messenger')}</h2>
            <div className="flex gap-1">
              <button type="button" title={t('محادثة جديدة', 'New chat')} onClick={() => setNewChat(true)} className="rounded-full bg-stone-100 p-2 text-stone-700 hover:bg-amber-100 cursor-pointer"><Plus className="h-4 w-4" /></button>
              <button type="button" title={t('مجموعة جديدة', 'New group')} onClick={() => setNewGroup(true)} className="rounded-full bg-stone-100 p-2 text-stone-700 hover:bg-amber-100 cursor-pointer"><Users className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="relative"><Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-stone-400" />
            <input className={`${inputClass} rounded-full py-2 ps-9`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('بحث في المحادثات', 'Search chats')} /></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!chats ? <Spinner /> : !shown.length ? (
            <Empty icon={<Send className="h-9 w-9" />} title={t('ابدأ أول محادثة', 'Start your first chat')} body={t('راسل أي حد من المجتمع، أو اعمل مجموعة مع أصدقائك.', 'Message anyone in the community, or create a group with friends.')}
              action={<Btn small onClick={() => setNewChat(true)}>{t('محادثة جديدة', 'New chat')}</Btn>} />
          ) : shown.map((c) => {
            const other = c.kind === 'direct' ? c.members[0] : undefined;
            return (
              <button key={c.id} type="button" onClick={() => go(`messenger/${c.id}`)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-start transition cursor-pointer ${chatId === c.id ? 'bg-amber-50' : 'hover:bg-stone-50'}`}>
                {other ? <Avatar user={other} size={48} /> : <GroupAvatar members={c.members} />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className={`truncate text-sm ${c.unread ? 'font-black text-stone-900' : 'font-semibold text-stone-800'}`}>{c.title || t('محادثة', 'Chat')}</span>
                    <span className="ms-auto shrink-0 text-[10px] text-stone-400">{c.last ? timeAgo(c.last.at, lang) : ''}</span></span>
                  <span className="flex items-center gap-2">
                    <span className={`truncate text-xs ${c.typing.length ? 'text-emerald-600' : c.unread ? 'font-semibold text-stone-800' : 'text-stone-500'}`}>
                      {c.typing.length ? t('بيكتب…', 'typing…') : lastPreview(c, lang)}</span>
                    <span className="ms-auto flex shrink-0 items-center gap-1">{c.muted && <BellOff className="h-3 w-3 text-stone-400" />}<Badge n={c.muted ? 0 : c.unread} /></span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      <section className={`min-h-0 ${chatId ? 'flex' : 'hidden md:flex'} flex-col`}>
        {chatId ? <ChatPane key={chatId} id={chatId} lang={lang} session={session} go={go} toast={toast} onChanged={loadChats} />
          : <div className="flex flex-1 items-center justify-center"><Empty icon={<Send className="h-12 w-12" />} title={t('اختار محادثة', 'Pick a chat')} body={t('رسائلك مشفّرة على السيرفر ومحدش يشوفها غير المشاركين فيها.', 'Your messages are encrypted on the server — only the people in the chat can read them.')} /></div>}
      </section>
      {newChat && <PeoplePicker lang={lang} title={t('محادثة جديدة', 'New chat')} single onClose={() => setNewChat(false)}
        onDone={async ([u]) => { try { const { id } = await cx<{ id: string }>('/community/chats/direct', { body: { userId: u.id } }); setNewChat(false); go(`messenger/${id}`); } catch (e) { toast(errorText(e, lang)); } }} />}
      {newGroup && <PeoplePicker lang={lang} title={t('مجموعة جديدة', 'New group')} friendsOnly withTitle onClose={() => setNewGroup(false)}
        onDone={async (people, title) => { try { const { id } = await cx<{ id: string }>('/community/chats/group', { body: { title, members: people.map((p) => p.id) } }); setNewGroup(false); go(`messenger/${id}`); } catch (e) { toast(errorText(e, lang)); } }} />}
    </Card>
  );
}

function lastPreview(c: ChatSummary, lang: Lang) {
  const t = tx(lang);
  if (!c.last) return t('محادثة جديدة', 'New chat');
  if (c.last.deleted) return t('🚫 تم حذف الرسالة', '🚫 Message deleted');
  const prefix = c.last.mine ? t('أنت: ', 'You: ') : '';
  const body = c.last.kind === 'image' ? t('📷 صورة', '📷 Photo') : c.last.kind === 'voice' ? t('🎤 رسالة صوتية', '🎤 Voice note') : c.last.kind === 'recipe' ? t('🧪 تركيبة', '🧪 Recipe')
    : c.last.kind === 'system' ? systemText(c.last.text, [], lang) : c.last.text;
  return prefix + body;
}

function GroupAvatar({ members }: { members: PublicUser[] }) {
  const [a, b] = members;
  return (
    <span className="relative h-12 w-12 shrink-0">
      {a && <span className="absolute top-0 start-0"><Avatar user={a} size={32} /></span>}
      {b ? <span className="absolute bottom-0 end-0 rounded-full border-2 border-white"><Avatar user={b} size={32} /></span>
        : <span className="absolute bottom-0 end-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-amber-100"><Users className="h-4 w-4 text-amber-700" /></span>}
    </span>
  );
}

function systemText(text: string, members: PublicUser[], lang: Lang) {
  const t = tx(lang);
  const name = (id: string) => members.find((m) => m.id === id)?.name || t('عضو', 'a member');
  if (text === 'group_created') return t('تم إنشاء المجموعة', 'Group created');
  if (text === 'left') return t('غادر المجموعة', 'left the group');
  if (text.startsWith('renamed:')) return t(`غيّر اسم المجموعة إلى «${text.slice(8)}»`, `renamed the group to “${text.slice(8)}”`);
  if (text.startsWith('added:')) return t(`أضاف ${name(text.slice(6))}`, `added ${name(text.slice(6))}`);
  return text;
}

/* ------------------------------------------------ chat pane ------------------------------------------------ */

function ChatPane({ id, lang, session, go, toast, onChanged }: { id: string; lang: Lang; session: SessionState; go: (r: string) => void; toast: (s: string) => void; onChanged: () => void }) {
  const t = tx(lang);
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const [view, setView] = useState<ChatView | null>(null);
  const [error, setError] = useState('');
  const [olderDone, setOlderDone] = useState(false);
  const since = useRef('');
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [reply, setReply] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [addPeople, setAddPeople] = useState(false);
  const meId = session.me!.id;

  const merge = (incoming: Message[]) => setView((v) => {
    if (!v) return v;
    const byId = new Map(v.messages.map((m) => [m.id, m]));
    for (const m of incoming) byId.set(m.id, m);
    return { ...v, messages: [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) };
  });

  const markRead = useCallback(() => { if (document.visibilityState === 'visible') void cx(`/community/chats/${id}/read`, { body: {} }).then(() => { void pulseNow(); }).catch(() => {}); }, [id]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const first = await cx<ChatView>(`/community/chats/${id}/messages`);
        if (!live) return;
        setView(first); since.current = first.serverTime; setOlderDone(first.messages.length < 40); markRead();
      } catch (e) { if (live) setError(errorText(e, lang)); }
    })();
    const poll = setInterval(async () => {
      if (!since.current || document.visibilityState === 'hidden') return;
      try {
        const next = await cx<ChatView>(`/community/chats/${id}/messages?since=${encodeURIComponent(since.current)}`, { timeoutMs: 10_000 });
        if (!live) return;
        since.current = next.serverTime;
        setView((v) => (v ? { ...v, members: next.members, conversation: next.conversation } : v));
        if (next.messages.length) { merge(next.messages); if (next.messages.some((m) => !m.mine)) markRead(); }
      } catch { /* next poll */ }
    }, 2500);
    return () => { live = false; clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { if (stick.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [view?.messages.length]);

  const loadOlder = async () => {
    if (!view?.messages.length) return;
    const el = list.current; const before = el?.scrollHeight || 0;
    try {
      const older = await cx<ChatView>(`/community/chats/${id}/messages?before=${encodeURIComponent(view.messages[0].createdAt)}`);
      setOlderDone(older.messages.length < 40);
      stick.current = false; merge(older.messages);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - before; });
    } catch (e) { toast(errorText(e, lang)); }
  };

  const send = async (body: Record<string, unknown>) => {
    try {
      const msg = await cx<Message>(`/community/chats/${id}/messages`, { body: { ...body, replyTo: reply?.id }, timeoutMs: 45_000 });
      stick.current = true; merge([msg]); setReply(null); onChanged();
    } catch (e) { toast(errorText(e, lang)); }
  };
  const edit = async (m: Message, text: string) => {
    try { await cx(`/community/messages/${m.id}`, { method: 'PATCH', body: { text } }); merge([{ ...m, text, editedAt: new Date().toISOString() }]); setEditing(null); } catch (e) { toast(errorText(e, lang)); }
  };
  const remove = async (m: Message) => {
    if (!confirm(t('حذف الرسالة عند الجميع؟', 'Delete for everyone?'))) return;
    try { await cx(`/community/messages/${m.id}`, { method: 'DELETE' }); merge([{ ...m, deleted: true, text: '', attachment: null }]); onChanged(); } catch (e) { toast(errorText(e, lang)); }
  };
  const react = async (m: Message, emoji: string) => {
    setMenuFor(null);
    const next = m.myReaction === emoji ? null : emoji;
    try { await cx(`/community/messages/${m.id}/react`, { body: { emoji: next } }); } catch (e) { toast(errorText(e, lang)); }
  };
  const updateGroup = async (body: Record<string, unknown>, done?: string) => {
    try { await cx(`/community/chats/${id}`, { method: 'PATCH', body }); if (done) toast(done); onChanged(); setView((v) => (v && body.muted !== undefined ? { ...v, conversation: { ...v.conversation, muted: Boolean(body.muted) } } : v)); } catch (e) { toast(errorText(e, lang)); }
  };

  if (error) return <div className="flex flex-1 items-center justify-center"><Empty title={error} action={<Btn small variant="soft" onClick={() => go('messenger')}>{t('رجوع', 'Back')}</Btn>} /></div>;
  if (!view) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  const others = view.members.filter((m) => m.id !== meId);
  const direct = view.conversation.kind === 'direct';
  const other = direct ? others[0] : undefined;
  const typing = others.filter((m) => m.typing);
  const status = typing.length ? (direct ? t('بيكتب…', 'typing…') : `${typing.map((m) => m.name.split(' ')[0]).join('، ')} ${t('بيكتب…', 'typing…')}`)
    : direct ? (other?.online ? t('متصل الآن', 'online') : other ? `${t('آخر ظهور', 'last seen')} ${timeAgo(other.lastSeen, lang)}` : '')
      : others.map((m) => m.name.split(' ')[0]).slice(0, 5).join('، ');
  const readBy = (m: Message) => others.length > 0 && others.every((o) => o.lastReadAt && o.lastReadAt >= m.createdAt);
  const nameOf = (sid: string) => view.members.find((m) => m.id === sid)?.name || '';

  let lastDay = '';
  return (
    <>
      <header className="flex items-center gap-3 border-b border-stone-100 px-3 py-2.5">
        <button type="button" onClick={() => go('messenger')} className="rounded-full p-1.5 text-stone-600 hover:bg-stone-100 md:hidden cursor-pointer"><Back className="h-5 w-5" /></button>
        <button type="button" onClick={() => other && go(`u/${other.handle}`)} className="flex min-w-0 flex-1 items-center gap-3 text-start cursor-pointer">
          {other ? <Avatar user={other} size={42} /> : <GroupAvatar members={others} />}
          <span className="min-w-0"><span className="block truncate font-bold text-stone-900">{direct ? other?.name : view.conversation.title}</span>
            <span className={`block truncate text-xs ${typing.length ? 'text-emerald-600' : 'text-stone-500'}`}>{status}</span></span>
        </button>
        <div className="relative">
          <button type="button" onClick={() => setHeaderMenu((m) => !m)} className="rounded-full p-2 text-stone-600 hover:bg-stone-100 cursor-pointer"><MoreVertical className="h-5 w-5" /></button>
          {headerMenu && (
            <div className="absolute end-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white text-sm shadow-xl" onMouseLeave={() => setHeaderMenu(false)}>
              <MenuItem icon={view.conversation.muted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />} label={view.conversation.muted ? t('إلغاء كتم الإشعارات', 'Unmute') : t('كتم الإشعارات', 'Mute')} onClick={() => { setHeaderMenu(false); void updateGroup({ muted: !view.conversation.muted }); }} />
              {!direct && <MenuItem icon={<UserPlus className="h-4 w-4" />} label={t('إضافة أعضاء', 'Add members')} onClick={() => { setHeaderMenu(false); setAddPeople(true); }} />}
              {!direct && <MenuItem icon={<Pencil className="h-4 w-4" />} label={t('تغيير اسم المجموعة', 'Rename group')} onClick={() => { setHeaderMenu(false); const title = prompt(t('الاسم الجديد:', 'New name:'), view.conversation.title); if (title?.trim()) void updateGroup({ title: title.trim() }); }} />}
              {direct && other && <MenuItem icon={<X className="h-4 w-4" />} label={t('حظر', 'Block')} danger onClick={() => { setHeaderMenu(false); if (confirm(t('حظر هذا الحساب؟', 'Block this account?'))) void cx(`/community/blocks/${other.id}`, { body: {} }).then(() => { toast(t('تم الحظر', 'Blocked')); go('messenger'); }); }} />}
              <MenuItem icon={<LogOut className="h-4 w-4" />} danger label={direct ? t('إخفاء المحادثة', 'Hide chat') : t('مغادرة المجموعة', 'Leave group')} onClick={() => { setHeaderMenu(false); if (confirm(direct ? t('إخفاء المحادثة؟ هترجع لو وصلت رسالة جديدة.', 'Hide this chat?') : t('مغادرة المجموعة؟', 'Leave the group?'))) void updateGroup({ leave: true }).then(() => go('messenger')); }} />
            </div>
          )}
        </div>
      </header>

      <div ref={list} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,#e7e5e4_1px,transparent_0)] bg-[length:22px_22px] bg-stone-50 px-3 py-4">
        {!olderDone && <div className="text-center"><Btn small variant="soft" onClick={() => void loadOlder()}>{t('رسائل أقدم', 'Older messages')}</Btn></div>}
        {view.messages.map((m, i) => {
          const day = new Date(m.createdAt).toDateString();
          const sep = day !== lastDay; lastDay = day;
          const prev = view.messages[i - 1];
          const grouped = prev && prev.senderId === m.senderId && prev.kind !== 'system' && !sep && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;
          return (
            <div key={m.id}>
              {sep && <div className="my-3 text-center"><span className="rounded-full bg-white px-3 py-1 text-[11px] text-stone-500 shadow-sm">{new Date(m.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>}
              {m.kind === 'system' ? (
                <p className="my-2 text-center text-[11px] text-stone-500">{!m.mine && `${nameOf(m.senderId)} `}{m.mine && `${t('أنت', 'You')} `}{systemText(m.text, view.members, lang)}</p>
              ) : (
                <Bubble m={m} lang={lang} grouped={Boolean(grouped)} showName={!direct && !m.mine && !grouped} name={nameOf(m.senderId)} sender={view.members.find((x) => x.id === m.senderId)}
                  read={m.mine && readBy(m)} replyName={m.replyTo ? (m.replyTo.senderId === meId ? t('أنت', 'You') : nameOf(m.replyTo.senderId)) : ''}
                  menuOpen={menuFor === m.id} onMenu={(open) => setMenuFor(open ? m.id : null)}
                  onReply={() => { setReply(m); setMenuFor(null); }} onReact={(e) => void react(m, e)}
                  onEdit={() => { setEditing(m); setMenuFor(null); }} onDelete={() => { setMenuFor(null); void remove(m); }}
                  onCopy={() => { void navigator.clipboard?.writeText(m.text); setMenuFor(null); toast(t('تم النسخ', 'Copied')); }} />
              )}
            </div>
          );
        })}
      </div>

      <Composer key={editing?.id || 'new'} lang={lang} chatId={id} reply={reply} replyName={reply ? (reply.mine ? t('أنت', 'You') : nameOf(reply.senderId)) : ''} editing={editing}
        onCancel={() => { setReply(null); setEditing(null); }} onSend={send} onEdit={edit} toast={toast} />
      {addPeople && <PeoplePicker lang={lang} title={t('إضافة أعضاء', 'Add members')} friendsOnly exclude={view.members.map((m) => m.id)} onClose={() => setAddPeople(false)}
        onDone={async (people) => { setAddPeople(false); await updateGroup({ add: people.map((p) => p.id) }, t('تمت الإضافة', 'Added')); }} />}
    </>
  );
}

const MenuItem = ({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) => (
  <button type="button" onClick={onClick} className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-start hover:bg-stone-50 cursor-pointer ${danger ? 'text-rose-600' : 'text-stone-700'}`}>{icon}{label}</button>
);

function Bubble({ m, lang, grouped, showName, name, sender, read, replyName, menuOpen, onMenu, onReply, onReact, onEdit, onDelete, onCopy }: {
  m: Message; lang: Lang; grouped: boolean; showName: boolean; name: string; sender?: PublicUser; read: boolean; replyName: string; menuOpen: boolean;
  onMenu: (open: boolean) => void; onReply: () => void; onReact: (emoji: string) => void; onEdit: () => void; onDelete: () => void; onCopy: () => void;
}) {
  const t = tx(lang);
  const reactions = Object.entries(m.reactions).filter(([, n]) => n > 0);
  let recipe: { title: string; data: Record<string, unknown> } | null = null;
  if (m.kind === 'recipe' && m.attachment) { try { recipe = JSON.parse(m.attachment); } catch { recipe = null; } }
  const press = useRef<ReturnType<typeof setTimeout>>(undefined);
  const canEdit = m.mine && m.kind === 'text' && !m.deleted && Date.now() - Date.parse(m.createdAt) < 24 * 3600_000;

  return (
    <div className={`group flex items-end gap-2 ${m.mine ? 'flex-row-reverse' : ''} ${grouped ? 'mt-0.5' : 'mt-2.5'}`}>
      {!m.mine && <span className="w-7 shrink-0">{!grouped && sender && <Avatar user={sender} size={28} />}</span>}
      <div className={`relative max-w-[78%] ${m.mine ? 'items-end' : 'items-start'} flex flex-col`}>
        {showName && <span className="mb-0.5 px-2 text-[11px] font-bold text-amber-800">{name}</span>}
        <div onContextMenu={(e) => { e.preventDefault(); onMenu(true); }}
          onTouchStart={() => { press.current = setTimeout(() => onMenu(true), 450); }} onTouchEnd={() => clearTimeout(press.current)} onTouchMove={() => clearTimeout(press.current)}
          className={`relative rounded-2xl px-3 py-2 text-[15px] leading-relaxed shadow-sm ${m.deleted ? 'border border-dashed border-stone-300 bg-white/70 italic text-stone-400'
            : m.mine ? 'bg-amber-700 text-white' : 'bg-white text-stone-900'} ${m.mine ? 'rounded-ee-md' : 'rounded-es-md'}`}>
          {m.replyTo && !m.deleted && (
            <div className={`mb-1.5 rounded-lg border-s-4 px-2 py-1 text-xs ${m.mine ? 'border-amber-200 bg-amber-800/60 text-amber-50' : 'border-amber-500 bg-stone-100 text-stone-600'}`}>
              <span className="block font-bold">{replyName}</span>
              <span className="line-clamp-2">{m.replyTo.text || (m.replyTo.kind === 'image' ? t('📷 صورة', '📷 Photo') : m.replyTo.kind === 'voice' ? t('🎤 رسالة صوتية', '🎤 Voice note') : m.replyTo.kind === 'recipe' ? t('🧪 تركيبة', '🧪 Recipe') : t('رسالة محذوفة', 'deleted'))}</span>
            </div>
          )}
          {m.deleted ? t('🚫 تم حذف هذه الرسالة', '🚫 This message was deleted') : (<>
            {m.kind === 'image' && m.attachment && <a href={m.attachment} target="_blank" rel="noreferrer"><img src={m.attachment} alt="" className="mb-1 max-h-72 rounded-xl object-cover" /></a>}
            {m.kind === 'voice' && m.attachment && <audio controls src={m.attachment} className="h-10 max-w-[240px]" preload="none" />}
            {recipe && <div className="-mx-4 text-stone-900"><RecipeCard lang={lang} title={recipe.title} data={recipe.data} /></div>}
            {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
          </>)}
          <span className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${m.mine && !m.deleted ? 'text-amber-100' : 'text-stone-400'}`}>
            {m.editedAt && !m.deleted && t('معدّلة', 'edited')} {clock(m.createdAt, lang)}
            {m.mine && !m.deleted && (read ? <CheckCheck className="h-3.5 w-3.5 text-sky-200" /> : <Check className="h-3.5 w-3.5" />)}
          </span>
          {reactions.length > 0 && (
            <span className={`absolute -bottom-3 ${m.mine ? 'start-2' : 'end-2'} flex items-center gap-0.5 rounded-full border border-stone-200 bg-white px-1.5 py-0.5 text-xs text-stone-700 shadow-sm`}>
              {reactions.map(([e]) => e).join('')}{reactions.reduce((s, [, n]) => s + n, 0) > 1 && <span className="ms-0.5 text-[10px]">{reactions.reduce((s, [, n]) => s + n, 0)}</span>}
            </span>
          )}
        </div>
        {reactions.length > 0 && <span className="h-3" />}
        {menuOpen && !m.deleted && (
          <div className={`absolute z-20 ${m.mine ? 'end-0' : 'start-0'} bottom-full mb-1 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white text-sm text-stone-700 shadow-xl`} onMouseLeave={() => onMenu(false)}>
            <div className="flex justify-between border-b border-stone-100 px-2 py-1.5">{QUICK.map((e) => <button key={e} type="button" onClick={() => onReact(e)} className={`rounded-full p-1 text-xl transition hover:scale-125 cursor-pointer ${m.myReaction === e ? 'bg-amber-100' : ''}`}>{e}</button>)}</div>
            <MenuItem icon={<Reply className="h-4 w-4" />} label={t('رد', 'Reply')} onClick={onReply} />
            {m.text && <MenuItem icon={<Copy className="h-4 w-4" />} label={t('نسخ', 'Copy')} onClick={onCopy} />}
            {canEdit && <MenuItem icon={<Pencil className="h-4 w-4" />} label={t('تعديل', 'Edit')} onClick={onEdit} />}
            {m.mine && <MenuItem icon={<Trash2 className="h-4 w-4" />} danger label={t('حذف عند الجميع', 'Delete for everyone')} onClick={onDelete} />}
          </div>
        )}
      </div>
      {!m.deleted && (
        <div className="mb-2 hidden shrink-0 gap-0.5 group-hover:flex">
          <button type="button" title={t('رد', 'Reply')} onClick={onReply} className="rounded-full p-1 text-stone-400 hover:bg-white hover:text-stone-700 cursor-pointer"><Reply className="h-4 w-4" /></button>
          <button type="button" title={t('تفاعل', 'React')} onClick={() => onMenu(!menuOpen)} className="rounded-full p-1 text-stone-400 hover:bg-white hover:text-stone-700 cursor-pointer"><Smile className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------ composer ------------------------------------------------ */

function Composer({ lang, chatId, reply, replyName, editing, onCancel, onSend, onEdit, toast }: {
  lang: Lang; chatId: string; reply: Message | null; replyName: string; editing: Message | null; onCancel: () => void;
  onSend: (body: Record<string, unknown>) => Promise<void>; onEdit: (m: Message, text: string) => Promise<void>; toast: (s: string) => void;
}) {
  const t = tx(lang);
  const [text, setText] = useState(editing?.text || '');
  const [busy, setBusy] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [recipe, setRecipe] = useState(false);
  const [recording, setRecording] = useState<{ rec: MediaRecorder; started: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);

  useEffect(() => { box.current?.focus(); }, [reply, editing]);
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - recording.started) / 1000);
      setElapsed(s);
      if (s >= 120) recording.rec.stop(); // two minutes per voice note
    }, 250);
    return () => clearInterval(id);
  }, [recording]);

  const typing = () => {
    if (Date.now() - lastTyping.current < 3000) return;
    lastTyping.current = Date.now();
    void cx(`/community/chats/${chatId}/typing`, { body: {} }).catch(() => {});
  };
  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    if (editing) await onEdit(editing, value); else await onSend({ kind: 'text', text: value });
    setText(''); setBusy(false);
  };
  const photo = async (f: File) => {
    setBusy(true);
    try { await onSend({ kind: 'image', attachment: await resizeImage(f, 1400, 0.8), text: text.trim() }); setText(''); } catch { toast(t('الصورة دي مش مدعومة', 'This image is not supported')); } finally { setBusy(false); }
  };
  const record = async () => {
    if (recording) { recording.rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
      const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32_000 } : undefined);
      const chunks: Blob[] = [];
      let cancelled = false;
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(null); setElapsed(0);
        if (cancelled || !chunks.length) return;
        setBusy(true);
        try { await onSend({ kind: 'voice', attachment: await blobToDataUrl(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })) }); } finally { setBusy(false); }
      };
      (rec as MediaRecorder & { cancel?: () => void }).cancel = () => { cancelled = true; rec.stop(); };
      rec.start();
      setRecording({ rec, started: Date.now() });
    } catch { toast(t('اسمح للموقع باستخدام الميكروفون', 'Allow the microphone to record')); }
  };

  return (
    <div className="border-t border-stone-100 bg-white p-2.5">
      {(reply || editing) && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border-s-4 border-amber-500 bg-amber-50 px-3 py-2 text-xs">
          {editing ? <Pencil className="h-4 w-4 text-amber-700" /> : <Reply className="h-4 w-4 text-amber-700" />}
          <span className="min-w-0 flex-1"><span className="block font-bold text-amber-900">{editing ? t('تعديل الرسالة', 'Editing message') : `${t('رد على', 'Replying to')} ${replyName}`}</span>
            <span className="block truncate text-stone-600">{(editing || reply)!.text || '📎'}</span></span>
          <button type="button" onClick={() => { onCancel(); if (editing) setText(''); }} className="text-stone-500 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
      )}
      {emoji && <div className="mb-2 grid grid-cols-10 gap-1 rounded-xl border border-stone-200 p-2">{EMOJI.map((e) => <button key={e} type="button" onClick={() => setText((v) => v + e)} className="rounded p-1 text-xl hover:bg-stone-100 cursor-pointer">{e}</button>)}</div>}
      {recording ? (
        <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-3 py-2">
          <span className="h-3 w-3 animate-pulse rounded-full bg-rose-600" />
          <span className="font-mono text-sm text-rose-700">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
          <span className="flex-1 text-xs text-rose-700">{t('جاري التسجيل…', 'Recording…')}</span>
          <Btn small variant="ghost" onClick={() => (recording.rec as MediaRecorder & { cancel?: () => void }).cancel?.()}>{t('إلغاء', 'Cancel')}</Btn>
          <Btn small onClick={() => recording.rec.stop()}><Square className="h-3.5 w-3.5" />{t('إرسال', 'Send')}</Btn>
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
          {!editing && (<>
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void photo(f); }} />
            <IconBtn title={t('صورة', 'Photo')} onClick={() => file.current?.click()}><ImagePlus className="h-5 w-5" /></IconBtn>
            <IconBtn title={t('تركيبة', 'Recipe')} onClick={() => setRecipe(true)}><FlaskConical className="h-5 w-5" /></IconBtn>
          </>)}
          <IconBtn title={t('إيموجي', 'Emoji')} onClick={() => setEmoji((v) => !v)}><Smile className="h-5 w-5" /></IconBtn>
          <textarea ref={box} rows={1} value={text} maxLength={4000} placeholder={t('اكتب رسالة…', 'Type a message…')}
            onChange={(e) => { setText(e.target.value); typing(); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } if (e.key === 'Escape') onCancel(); }}
            className="max-h-36 min-h-[42px] flex-1 resize-none rounded-2xl bg-stone-100 px-4 py-2.5 text-[15px] outline-none focus:bg-white focus:ring-2 focus:ring-amber-200" />
          {text.trim() || editing
            ? <button type="button" disabled={busy || !text.trim()} onClick={() => void submit()} className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-amber-700 text-white disabled:opacity-50 cursor-pointer">{editing ? <Check className="h-5 w-5" /> : <Send className="h-5 w-5 rtl:-scale-x-100" />}</button>
            : <button type="button" disabled={busy} title={t('رسالة صوتية', 'Voice note')} onClick={() => void record()} className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-amber-700 text-white disabled:opacity-50 cursor-pointer"><Mic className="h-5 w-5" /></button>}
        </div>
      )}
      {recipe && <RecipePicker lang={lang} onClose={() => setRecipe(false)} onPick={(r) => { setRecipe(false); void onSend({ kind: 'recipe', recipeId: r.id, text: text.trim() }); setText(''); }} />}
    </div>
  );
}

const IconBtn = ({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) => (
  <button type="button" title={title} onClick={onClick} className="flex h-[42px] w-9 shrink-0 items-center justify-center rounded-full text-amber-700 hover:bg-amber-50 cursor-pointer">{children}</button>
);

/* ------------------------------------------------ people ------------------------------------------------ */

function PeoplePicker({ lang, title, single, friendsOnly, withTitle, exclude = [], onClose, onDone }: {
  lang: Lang; title: string; single?: boolean; friendsOnly?: boolean; withTitle?: boolean; exclude?: string[]; onClose: () => void; onDone: (people: PublicUser[], title: string) => void | Promise<void>;
}) {
  const t = tx(lang);
  const [friends, setFriends] = useState<PublicUser[] | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<PublicUser[]>([]);
  const [picked, setPicked] = useState<PublicUser[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void cx<{ friends: PublicUser[] }>('/community/friends').then((d) => setFriends(d.friends)).catch(() => setFriends([])); }, []);
  useEffect(() => {
    if (friendsOnly || q.trim().length < 2) { setFound([]); return; }
    const id = setTimeout(() => { void cx<PublicUser[]>(`/community/people?q=${encodeURIComponent(q.trim())}`).then(setFound).catch(() => setFound([])); }, 300);
    return () => clearTimeout(id);
  }, [q, friendsOnly]);
  const pool = useMemo(() => {
    const local = (friends || []).filter((f) => !q.trim() || f.name.toLowerCase().includes(q.trim().toLowerCase()) || f.handle.includes(q.trim().toLowerCase()));
    const seen = new Set(local.map((f) => f.id));
    return [...local, ...found.filter((f) => !seen.has(f.id))].filter((p) => !exclude.includes(p.id));
  }, [friends, found, q, exclude]);
  const toggle = (u: PublicUser) => {
    if (single) { void onDone([u], ''); return; }
    setPicked((list) => (list.some((p) => p.id === u.id) ? list.filter((p) => p.id !== u.id) : [...list, u]));
  };
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="space-y-3">
        {withTitle && <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t('اسم المجموعة', 'Group name')} />}
        <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder={friendsOnly ? t('ابحث في أصدقائك', 'Search your friends') : t('ابحث بالاسم أو اسم المستخدم', 'Search by name or username')} />
        {friendsOnly && <p className="text-[11px] text-stone-500">{t('المجموعات بتتعمل مع الأصدقاء فقط.', 'Groups are made with friends only.')}</p>}
        {picked.length > 0 && <div className="flex flex-wrap gap-1.5">{picked.map((p) => <button key={p.id} type="button" onClick={() => toggle(p)} className="flex items-center gap-1 rounded-full bg-amber-100 py-1 pe-2 ps-1 text-xs font-semibold text-amber-900 cursor-pointer"><Avatar user={p} size={20} />{p.name}<X className="h-3 w-3" /></button>)}</div>}
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {!friends ? <Spinner /> : !pool.length ? <p className="py-6 text-center text-sm text-stone-500">{friendsOnly ? t('أضف أصدقاء الأول من «سوشيال شام»', 'Add friends first from Sham Social') : t('اكتب حرفين على الأقل للبحث', 'Type at least 2 letters')}</p>
            : pool.map((u) => (
              <button key={u.id} type="button" onClick={() => toggle(u)} className={`flex w-full items-center gap-3 rounded-xl p-2 text-start cursor-pointer ${picked.some((p) => p.id === u.id) ? 'bg-amber-50' : 'hover:bg-stone-50'}`}>
                <Avatar user={u} size={40} /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{u.name}</span><span className="text-[11px] text-stone-500">@{u.handle}</span></span>
                {!single && <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${picked.some((p) => p.id === u.id) ? 'border-amber-600 bg-amber-600 text-white' : 'border-stone-300'}`}>{picked.some((p) => p.id === u.id) && <Check className="h-3 w-3" />}</span>}
              </button>
            ))}
        </div>
        {!single && <Btn className="w-full" busy={busy} disabled={!picked.length || (withTitle && name.trim().length < 2)} onClick={async () => { setBusy(true); try { await onDone(picked, name.trim()); } finally { setBusy(false); } }}>{withTitle ? t('إنشاء المجموعة', 'Create group') : t('إضافة', 'Add')}</Btn>}
      </div>
    </Sheet>
  );
}
