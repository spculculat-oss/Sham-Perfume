/**
 * «بريد شام» — the platform's own Gmail-style mailbox: inbox / starred / sent / drafts / archive /
 * trash, a composer with member suggestions, replies and forwards, search, a picture attachment,
 * and official platform letters («إدارة شام», the local delivery service). Mail is encrypted on the
 * server; unread counts ride the same pulse the messenger uses, so the tab badge is always fresh.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArchiveRestore, ArrowLeft, ArrowRight, BadgeCheck, CheckCheck, FileText, Forward, Globe, ImagePlus,
  Inbox, MailOpen, Paperclip, PenLine, RefreshCw, Reply, Search, Send, ShieldCheck, Star, Trash2, Undo2, X,
} from 'lucide-react';
import {
  cx, resizeImage, type MailCounts, type MailFolder, type MailList, type MailMessage, type MailParty, type MailSendResult, type MailSummary, type PublicUser,
} from './api';
import { pulseNow, type SessionState } from './session';
import { Avatar, Badge, Btn, Card, Empty, Sheet, Spinner, clock, errorText, inputClass, timeAgo, tx, type Lang } from './ui';

interface Props { lang: Lang; session: SessionState; route: string; go: (route: string) => void; toast: (s: string) => void }

const FOLDER_IDS: MailFolder[] = ['inbox', 'starred', 'sent', 'drafts', 'archive', 'trash'];

function folderMeta(lang: Lang): Record<MailFolder, { label: string; icon: React.ReactNode }> {
  const t = tx(lang);
  const cls = 'h-4 w-4';
  return {
    inbox: { label: t('الوارد', 'Inbox'), icon: <Inbox className={cls} /> },
    starred: { label: t('المميزة بنجمة', 'Starred'), icon: <Star className={cls} /> },
    sent: { label: t('المرسلة', 'Sent'), icon: <Send className={cls} /> },
    drafts: { label: t('المسودات', 'Drafts'), icon: <FileText className={cls} /> },
    archive: { label: t('الأرشيف', 'Archive'), icon: <Archive className={cls} /> },
    trash: { label: t('المهملات', 'Trash'), icon: <Trash2 className={cls} /> },
  };
}

/** Display name of a sender/recipient — system parties are localized and verified-looking. */
function partyName(p: MailParty, lang: Lang): string {
  const t = tx(lang);
  if (p.system) return p.handle === 'sham-mail' ? t('خدمة بريد شام', 'Sham Mail service') : t('إدارة شام', 'Sham administration');
  if (p.external) return p.name && p.name !== '?' ? `${p.name} (${p.address})` : p.address;
  return p.name || p.handle;
}

/** The Avatar widget needs a PublicUser-ish shape (id, name, avatar). */
const avatarUser = (p: MailParty) => ({ id: p.id || 'sham', name: partyName(p, 'ar'), avatar: p.avatar });

export default function Mailbox({ lang, session, route, go, toast }: Props) {
  const t = tx(lang);
  const folder: MailFolder = (FOLDER_IDS as string[]).includes(route) ? (route as MailFolder) : 'inbox';
  const meta = folderMeta(lang);
  const [list, setList] = useState<MailSummary[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [counts, setCounts] = useState<MailCounts | null>(null);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState(0); // bump to refetch the same message (e.g. after edits)
  const [compose, setCompose] = useState<ComposeState | null>(null);

  const loadCounts = useCallback(async () => {
    try { setCounts(await cx<MailCounts>('/community/mail/counts')); } catch { /* keep the last snapshot */ }
  }, []);

  const loadList = useCallback(async (quiet = true, cursor?: string) => {
    try {
      const qs = new URLSearchParams({ folder });
      if (q.trim()) qs.set('q', q.trim());
      if (cursor) qs.set('before', cursor);
      const page = await cx<MailList>(`/community/mail?${qs}`);
      setList((old) => (cursor ? [...(old || []), ...page.items.filter((m) => !(old || []).some((o) => o.id === m.id))] : page.items));
      setNext(page.more ? page.next : null);
    } catch (e) { if (!quiet) toast(errorText(e, lang)); if (!cursor) setList((old) => old || []); }
  }, [folder, q, lang, toast]);

  useEffect(() => { setList(null); setNext(null); void loadList(false); }, [loadList]);
  useEffect(() => { void loadCounts(); }, [loadCounts]);
  // New mail arrives with the pulse: refresh the inbox view and the counters (light, every 20 s as a floor).
  const mailPulse = session.pulse?.mail;
  useEffect(() => { if (mailPulse !== undefined) { void loadList(); void loadCounts(); } }, [mailPulse]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadList(); void loadCounts();
    }, 20_000);
    return () => clearInterval(id);
  }, [loadList, loadCounts]);

  const refreshAll = useCallback(async () => {
    setBusy(true);
    await Promise.all([loadList(false), loadCounts()]);
    await pulseNow();
    setBusy(false);
  }, [loadList, loadCounts]);

  const act = useCallback(async (id: string, patch: Record<string, unknown>, close = false) => {
    try {
      await cx(`/community/mail/${id}`, { method: 'PATCH', body: patch });
      setList((old) => (old || []).map((m) => {
        if (m.id !== id) return m;
        if (typeof patch.starred === 'boolean') return { ...m, starred: patch.starred };
        if (typeof patch.read === 'boolean') return { ...m, read: patch.read };
        return m;
      }).filter((m) => {
        if (m.id !== id) return true;
        if (patch.folder) return folder !== 'inbox' || m.folder === 'drafts'; // moved away: hide everywhere but the inbox list
        if (folder === 'starred' && patch.starred === false) return false;
        return true;
      }));
      void loadCounts();
      if (close) setOpenId(null);
    } catch (e) { toast(errorText(e, lang)); }
  }, [folder, lang, loadCounts, toast]);

  const remove = useCallback(async (id: string, inTrash: boolean) => {
    if (inTrash && !window.confirm(t('الحذف النهائي لا يمكن التراجع عنه. نكمل؟', 'This is permanent and cannot be undone. Continue?'))) return;
    try {
      const out = await cx<{ trashed?: boolean; deleted?: boolean }>(`/community/mail/${id}`, { method: 'DELETE' });
      setList((old) => (old || []).filter((m) => m.id !== id));
      setOpenId((cur) => (cur === id ? null : cur));
      void loadCounts();
      toast(out.deleted ? t('اتحذفت نهائياً 🗑️', 'Deleted forever 🗑️') : t('اتنقلت للمهملات', 'Moved to trash'));
    } catch (e) { toast(errorText(e, lang)); }
  }, [lang, loadCounts, t, toast]);

  const openMessage = useCallback((id: string) => {
    const item = (list || []).find((m) => m.id === id);
    if (item?.folder === 'drafts') { setCompose({ draftId: id }); return; }
    setOpenId(id);
  }, [list]);

  const starToggle = useCallback((ev: React.MouseEvent, m: MailSummary) => {
    ev.stopPropagation();
    void act(m.id, { starred: !m.starred });
  }, [act]);

  return (
    <Card className="flex h-[calc(100vh-190px)] min-h-[520px] flex-col overflow-hidden md:flex-row">
      {/* ----------------------------------------- sidebar (folders) ----------------------------------------- */}
      <aside className="hidden w-56 shrink-0 flex-col gap-0.5 border-e border-stone-100 bg-stone-50/60 p-3 md:flex">
        <Btn onClick={() => setCompose({})} className="mb-3 w-full justify-start gap-2 !rounded-2xl !px-4 !py-3 shadow-md shadow-amber-900/20">
          <PenLine className="h-5 w-5" />{t('رسالة جديدة', 'Compose')}
        </Btn>
        {FOLDER_IDS.map((f) => (
          <div key={f} className="group relative">
            <button type="button" onClick={() => { setOpenId(null); go(f === 'inbox' ? 'mail' : `mail/${f}`); }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition cursor-pointer ${folder === f ? 'bg-amber-200/70 font-bold text-amber-950' : 'text-stone-700 hover:bg-stone-100'}`}>
              <span className={folder === f ? 'text-amber-800' : 'text-stone-500'}>{meta[f].icon}</span>
              <span className="truncate">{meta[f].label}</span>
              <span className="ms-auto">
                {f === 'inbox' && <Badge n={counts?.unread} />}
                {f === 'drafts' && (counts?.drafts ? <span className="text-[10px] font-bold text-stone-500">{counts.drafts}</span> : null)}
                {f === 'starred' && (counts?.starred ? <span className="text-[10px] font-bold text-stone-500">{counts.starred}</span> : null)}
              </span>
            </button>
            {f === 'trash' && folder === 'trash' && (counts?.trash || 0) > 0 && (
              <button type="button" title={t('إفراغ المهملات', 'Empty trash')}
                onClick={async () => {
                  if (!window.confirm(t('إفراغ المهملات نهائياً؟', 'Empty the trash forever?'))) return;
                  try { await cx('/community/mail/trash/empty', { method: 'POST', body: {} }); setList([]); toast(t('المهملات فضيت 🗑️', 'Trash emptied 🗑️')); void loadCounts(); }
                  catch (e) { toast(errorText(e, lang)); }
                }}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-rose-600 hover:bg-rose-100 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
            )}
          </div>
        ))}
        <div className="mt-auto flex items-start gap-2 rounded-xl bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>{t('الرسايل جوه المنصة مشفرة زي الماسنجر. اللي بتبعته لإيميل خارجي (جيميل/ياهو…) بيخرج عبر مزوّد البريد زي أي إيميل عادي.', 'Mail inside the platform is encrypted like the messenger. What you send to an outside e-mail (gmail/yahoo…) goes through the mail provider like any regular e-mail.')}</span>
        </div>
      </aside>

      {/* ----------------------------------------- main pane ----------------------------------------- */}
      <section className="flex min-w-0 flex-1 flex-col">
        {openId ? (
          <DetailPane key={`${openId}:${openKey}`} id={openId} lang={lang} folder={folder}
            onBack={() => { setOpenId(null); void loadList(); void loadCounts(); void pulseNow(); }}
            onAction={(id, patch, close) => act(id, patch, close)}
            onDelete={(id, inTrash) => void remove(id, inTrash)}
            onChanged={() => setOpenKey((k) => k + 1)}
            reply={(m) => setCompose(replyState(m, false, lang))}
            forward={(m) => setCompose(replyState(m, true, lang))} />
        ) : (
          <>
            {/* toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-2.5">
              <Btn onClick={() => setCompose({})} className="md:hidden !px-3 !py-2"><PenLine className="h-4 w-4" />{t('جديدة', 'New')}</Btn>
              <form className="relative min-w-40 flex-1" onSubmit={(e) => { e.preventDefault(); setQ(search); }}>
                <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-stone-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); if (!e.target.value.trim()) setQ(''); }}
                  placeholder={t('ابحث في بريدك…', 'Search your mail…')} className={`${inputClass} rounded-full py-2 ps-9 pe-9`} />
                {search && (
                  <button type="button" onClick={() => { setSearch(''); setQ(''); }}
                    className="absolute inset-y-0 end-3 my-auto text-stone-400 hover:text-stone-600 cursor-pointer"><X className="h-4 w-4" /></button>
                )}
              </form>
              <button type="button" title={t('تحديث', 'Refresh')} onClick={() => void refreshAll()} disabled={busy}
                className="rounded-full p-2 text-stone-500 hover:bg-stone-100 cursor-pointer disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              </button>
              {folder === 'inbox' && (counts?.unread || 0) > 0 && (
                <button type="button" title={t('تعليم الكل كمقروء', 'Mark all as read')}
                  onClick={async () => {
                    try { await cx('/community/mail/read-all', { method: 'POST', body: {} }); toast(t('كل الرسايل اتعلّمت كمقروءة ✓', 'All marked as read ✓')); void refreshAll(); }
                    catch (e) { toast(errorText(e, lang)); }
                  }}
                  className="rounded-full p-2 text-stone-500 hover:bg-stone-100 cursor-pointer"><CheckCheck className="h-4 w-4" /></button>
              )}
            </div>
            {/* mobile folder chips */}
            <div className="flex gap-1 overflow-x-auto border-b border-stone-100 p-2 md:hidden">
              {FOLDER_IDS.map((f) => (
                <button key={f} type="button" onClick={() => { setOpenId(null); go(f === 'inbox' ? 'mail' : `mail/${f}`); }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${folder === f ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600'}`}>
                  {meta[f].icon}{meta[f].label}
                  {f === 'inbox' && <Badge n={counts?.unread} />}
                </button>
              ))}
            </div>
            {/* list */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!list ? <Spinner /> : !list.length ? (
                <Empty icon={<MailOpen className="h-10 w-10" />}
                  title={q ? t('مفيش نتايج', 'No results') : meta[folder].label}
                  body={q ? t('جرّب كلمة تانية أو اسم مرسل مختلف.', 'Try another word or a different sender.')
                    : folder === 'inbox' ? t('صندوقك فاضي لسه — رسايل الإدارة وأعضاء المجتمع هتوصل هنا.', 'Nothing here yet — platform letters and members’ mail will land here.')
                    : folder === 'sent' ? t('لسه ما بعتش أي ميل. اضغط «رسالة جديدة» وابدأ!', 'No sent mail yet. Hit “Compose” and start!')
                    : folder === 'drafts' ? t('مفيش مسودات محفوظة.', 'No saved drafts.')
                    : folder === 'trash' ? t('المهملات فاضية.', 'Trash is empty.')
                    : t('مفيش رسايل هنا لسه.', 'Nothing here yet.')}
                  action={<Btn small onClick={() => setCompose({})}><PenLine className="h-4 w-4" />{t('رسالة جديدة', 'Compose')}</Btn>} />
              ) : (
                <ul className="divide-y divide-stone-100">
                  {list.map((m) => {
                    const isDraft = m.folder === 'drafts';
                    const other = isDraft || m.folder === 'sent' ? m.to[0] : m.from;
                    const isSystem = m.kind === 'system';
                    const isExternal = m.kind === 'external';
                    return (
                      <li key={m.id}>
                        <button type="button" onClick={() => openMessage(m.id)}
                          className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition cursor-pointer hover:bg-stone-50 ${m.read ? 'bg-white' : 'bg-amber-50/40'}`}>
                          <span onClick={(e) => starToggle(e, m)} className="shrink-0 cursor-pointer p-0.5" role="button" tabIndex={-1}
                            title={m.starred ? t('شيل النجمة', 'Unstar') : t('نجمة', 'Star')}>
                            <Star className={`h-4 w-4 ${m.starred ? 'fill-amber-400 text-amber-400' : 'text-stone-300 hover:text-amber-400'}`} />
                          </span>
                          <span className="flex w-40 shrink-0 items-center gap-1.5 overflow-hidden sm:w-52">
                            {isSystem ? (
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-800 text-white"><BadgeCheck className="h-4 w-4" /></span>
                            ) : isExternal ? (
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-sky-800 text-white"><Globe className="h-4 w-4" /></span>
                            ) : other && !isDraft ? <Avatar user={avatarUser(other)} size={28} /> : null}
                            <span className={`truncate text-sm ${m.read ? 'text-stone-600' : 'font-bold text-stone-900'}`}>
                              {isDraft ? <span className="font-bold text-rose-700">{t('مسودة', 'Draft')}</span>
                                : m.folder === 'sent' ? `${t('إلى:', 'To:')} ${m.to.map((x) => partyName(x, lang)).slice(0, 2).join('، ') || t('بدون مستلم', 'no recipient')}`
                                : partyName(m.from, lang)}
                              {isSystem && <span title={t('مرسل رسمي', 'Official sender')}><BadgeCheck className="ms-1 inline h-3.5 w-3.5 text-amber-600" /></span>}
                              {isExternal && <Globe className="ms-1 inline h-3.5 w-3.5 text-sky-600" />}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm ${m.read ? 'text-stone-700' : 'font-bold text-stone-900'}`}>
                              {m.subject || t('(بدون عنوان)', '(no subject)')}
                              {m.snippet && <span className="font-normal text-stone-400"> — {m.snippet}</span>}
                            </span>
                          </span>
                          {m.hasAttachment && <Paperclip className="h-3.5 w-3.5 shrink-0 text-stone-400" />}
                          {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title={t('جديدة', 'new')} />}
                          <span className="shrink-0 text-[11px] text-stone-400">{isDraft ? timeAgo(m.updatedAt, lang) : timeAgo(m.at, lang)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {next && (
                <div className="p-3 text-center">
                  <Btn variant="soft" small busy={moreBusy} onClick={async () => { setMoreBusy(true); await loadList(true, next); setMoreBusy(false); }}>
                    {t('حمّل المزيد', 'Load more')}
                  </Btn>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {compose && (
        <ComposeSheet lang={lang} toast={toast} initial={compose} onClose={(sent) => {
          setCompose(null);
          if (sent) toast(t('تم الإرسال ✓ — الميل وصل 📬', 'Sent ✓ — delivered 📬'));
          void loadList(); void loadCounts(); void pulseNow();
        }} />
      )}
    </Card>
  );
}

/* ---------------------------------------------- detail pane ---------------------------------------------- */

function DetailPane({ id, lang, folder, onBack, onAction, onDelete, onChanged, reply, forward }: {
  id: string; lang: Lang; folder: MailFolder;
  onBack: () => void; onAction: (id: string, patch: Record<string, unknown>, close?: boolean) => Promise<void>;
  onDelete: (id: string, inTrash: boolean) => void; onChanged: () => void;
  reply: (m: MailMessage) => void; forward: (m: MailMessage) => void;
}) {
  const t = tx(lang);
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const [mail, setMail] = useState<MailMessage | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    cx<MailMessage>(`/community/mail/${id}`).then((m) => { if (live) setMail(m); }).catch((e) => { if (live) setError(errorText(e, lang)); });
    return () => { live = false; };
  }, [id, lang]);
  const full = useMemo(
    () => (mail ? new Date(mail.at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''),
    [mail, lang]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-stone-100 p-2.5">
        <button type="button" onClick={onBack} title={t('رجوع', 'Back')} className="rounded-full p-2 text-stone-600 hover:bg-stone-100 cursor-pointer"><Back className="h-4 w-4" /></button>
        {mail && (
          <div className="ms-1 flex items-center gap-0.5">
            {folder !== 'archive' && folder !== 'trash' && !mail.read && (
              <IconBtn title={t('تعليم كمقروءة', 'Mark read')} onClick={() => void onAction(id, { read: true }).then(onChanged)}><MailOpen className="h-4 w-4" /></IconBtn>
            )}
            {mail.read && folder !== 'trash' && (
              <IconBtn title={t('تعليم كغير مقروءة', 'Mark unread')} onClick={() => void onAction(id, { read: false }, true)}><Inbox className="h-4 w-4" /></IconBtn>
            )}
            {folder === 'inbox' && <IconBtn title={t('أرشفة', 'Archive')} onClick={() => void onAction(id, { folder: 'archive' }, true)}><Archive className="h-4 w-4" /></IconBtn>}
            {folder === 'archive' && <IconBtn title={t('رجّعها للوارد', 'Move to inbox')} onClick={() => void onAction(id, { folder: 'inbox' }, true)}><ArchiveRestore className="h-4 w-4" /></IconBtn>}
            {folder === 'trash' && <IconBtn title={t('استعادة للوارد', 'Restore to inbox')} onClick={() => void onAction(id, { folder: 'inbox' }, true)}><Undo2 className="h-4 w-4" /></IconBtn>}
            <IconBtn title={folder === 'trash' ? t('حذف نهائي', 'Delete forever') : t('حذف', 'Delete')} danger onClick={() => onDelete(id, folder === 'trash')}><Trash2 className="h-4 w-4" /></IconBtn>
            <IconBtn title={mail.starred ? t('شيل النجمة', 'Unstar') : t('نجمة', 'Star')} onClick={() => void onAction(id, { starred: !mail.starred }).then(onChanged)}>
              <Star className={`h-4 w-4 ${mail.starred ? 'fill-amber-400 text-amber-400' : ''}`} />
            </IconBtn>
          </div>
        )}
      </div>
      {error ? <Empty title={error} /> : !mail ? <Spinner /> : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <h2 className="mb-4 text-xl font-black text-stone-900">{mail.subject || t('(بدون عنوان)', '(no subject)')}</h2>
          <div className="mb-1 flex items-start gap-3">
            {mail.kind === 'system' ? (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-800 text-white"><BadgeCheck className="h-6 w-6" /></span>
            ) : mail.kind === 'external' ? (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-sky-800 text-white"><Globe className="h-6 w-6" /></span>
            ) : <Avatar user={avatarUser(mail.from)} size={44} />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-bold text-stone-900">{partyName(mail.from, lang)}</span>
                {mail.kind === 'system' && <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"><BadgeCheck className="h-3 w-3" />{t('رسمي', 'Official')}</span>}
                {mail.kind === 'external' && <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800"><Globe className="h-3 w-3" />{t('بريد خارجي', 'External mail')}</span>}
                {mail.extStatus === 'sent' && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">{t('اتبعت خارجيًا ✓', 'Sent externally ✓')}</span>}
                {mail.extStatus === 'failed' && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">{t('فشل الإرسال الخارجي', 'External send failed')}</span>}
                {mail.extStatus === 'unconfigured' && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-600">{t('الإرسال الخارجي مش متظبط', 'External send not configured')}</span>}
                <span className="ms-auto shrink-0 text-xs text-stone-400" title={full}>{timeAgo(mail.at, lang)} · {clock(mail.at, lang)}</span>
              </div>
              <div className="truncate text-xs text-stone-500">{mail.from.address}</div>
              <div className="mt-1 text-xs text-stone-500">
                {t('إلى:', 'To:')} {mail.to.length ? mail.to.map((x, i) => (
                  <span key={x.id || i}>{i > 0 && '، '}{partyName(x, lang)} <span className="text-stone-400">({x.address})</span></span>
                )) : t('أنا', 'me')}
              </div>
            </div>
          </div>
          <div className="mt-4 whitespace-pre-wrap break-words rounded-2xl bg-stone-50 p-4 text-sm leading-7 text-stone-800" dir="auto">{mail.body}</div>
          {mail.attachment && (
            <div className="mt-3">
              <a href={mail.attachment} target="_blank" rel="noreferrer" title={t('افتح الصورة في تبويب جديد', 'Open the picture in a new tab')}>
                <img loading="lazy" decoding="async" src={mail.attachment} alt={t('مرفق', 'attachment')} className="max-h-72 cursor-zoom-in rounded-2xl border border-stone-200 object-cover" />
              </a>
            </div>
          )}
          {mail.parent && (
            <p className="mt-3 text-xs text-stone-400">{t('رد على:', 'In reply to:')} «{mail.parent.subject || t('(بدون عنوان)', '(no subject)')}»</p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Btn small variant="soft" onClick={() => reply(mail)}><Reply className="h-4 w-4" />{t('رد', 'Reply')}</Btn>
            <Btn small variant="ghost" onClick={() => forward(mail)}><Forward className="h-4 w-4" />{t('إعادة توجيه', 'Forward')}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`rounded-full p-2 transition cursor-pointer ${danger ? 'text-rose-600 hover:bg-rose-50' : 'text-stone-600 hover:bg-stone-100'}`}>{children}</button>
  );
}

/* ---------------------------------------------- composer ---------------------------------------------- */

interface ComposeChip { q: string; user?: PublicUser }
interface ComposeState {
  draftId?: string;
  to?: ComposeChip[];
  subject?: string;
  body?: string;
  attachment?: string | null;
}

function replyState(m: MailMessage, forward: boolean, lang: Lang): ComposeState {
  const t = tx(lang);
  const quote = `\n\n———— ${t('الرسالة الأصلية', 'Original message')} ————\n${t('من:', 'From:')} ${partyName(m.from, lang)} <${m.from.address}>\n${t('التاريخ:', 'Date:')} ${new Date(m.at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}\n${t('الموضوع:', 'Subject:')} ${m.subject}\n\n${m.body}\n`;
  if (forward) return { to: [], subject: `${t('فوروارد:', 'Fwd:')} ${m.subject}`.slice(0, 190), body: quote.trimStart(), attachment: m.attachment };
  const chips: ComposeChip[] = m.kind === 'external' && m.from.address
    ? [{ q: m.from.address }]
    : m.kind === 'system' || !m.from.id ? [] : [{ q: m.from.handle, user: m.from as unknown as PublicUser }];
  return { to: chips, subject: m.subject.startsWith(t('رد:', 'Re:')) ? m.subject : `${t('رد:', 'Re:')} ${m.subject}`.slice(0, 190), body: quote };
}

function ComposeSheet({ lang, initial, onClose, toast }: { lang: Lang; initial: ComposeState; onClose: (sent: boolean) => void; toast: (s: string) => void }) {
  const t = tx(lang);
  const [chips, setChips] = useState<ComposeChip[]>(initial.to || []);
  const [typing, setTyping] = useState('');
  const [suggestions, setSuggestions] = useState<PublicUser[]>([]);
  const [subject, setSubject] = useState(initial.subject || '');
  const [body, setBody] = useState(initial.body || '');
  const [attachment, setAttachment] = useState<string | null>(initial.attachment || null);
  const [draftId, setDraftId] = useState(initial.draftId);
  const [busy, setBusy] = useState<'send' | 'draft' | ''>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = chips.length > 0 || subject.trim() !== '' || body.trim() !== '' || Boolean(attachment);

  // The original draft's raw addresses come back on the first save/open.
  useEffect(() => {
    if (!initial.draftId || chips.length) return;
    let live = true;
    cx<MailMessage>(`/community/mail/${initial.draftId}`).then((m) => {
      if (!live) return;
      setSubject((s) => s || m.subject);
      setBody((b) => b || m.body);
      setAttachment((a) => a || m.attachment);
      setChips(m.draftTo.map((q) => ({ q })));
    }).catch(() => {});
    return () => { live = false; };
  }, [initial.draftId]); // eslint-disable-line react-hooks/exhaustive-deps

  // «إلى»: suggest community members while typing (debounced).
  useEffect(() => {
    const query = typing.trim().replace(/^@/, '');
    if (query.length < 2) { setSuggestions([]); return; }
    const id = setTimeout(() => {
      cx<PublicUser[]>(`/community/people?q=${encodeURIComponent(query)}`).then(setSuggestions).catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(id);
  }, [typing]);

  const addChip = useCallback((chip: ComposeChip) => {
    const key = (chip.user?.handle || chip.q).toLowerCase();
    setChips((old) => (old.some((c) => (c.user?.handle || c.q).toLowerCase() === key) ? old : [...old, chip]));
    setTyping('');
    setSuggestions([]);
  }, []);

  const commitTyping = useCallback(() => {
    const q = typing.trim().replace(/[,;$]/g, '').trim();
    if (q) addChip({ q });
  }, [typing, addChip]);

  const save = useCallback(async (silent: boolean): Promise<string | null> => {
    if (!dirty) return null;
    try {
      const payload = { to: chips.map((c) => c.user?.handle || c.q), subject, body, attachment };
      const out = draftId
        ? await cx<{ id: string }>(`/community/mail/drafts/${draftId}`, { method: 'PATCH', body: payload })
        : await cx<{ id: string }>('/community/mail/drafts', { body: payload });
      setDraftId(out.id);
      if (!silent) toast(t('المسودة اتحفظت ✓', 'Draft saved ✓'));
      return out.id;
    } catch (e) { toast(errorText(e, lang)); return null; }
  }, [dirty, chips, subject, body, attachment, draftId, lang, t, toast]);

  const close = useCallback(async () => {
    if (dirty) {
      const id = await save(true);
      if (id) toast(t('اتحفظت في المسودات', 'Saved to drafts'));
      onClose(false);
    } else onClose(false);
  }, [dirty, save, toast, t, onClose]);

  const send = useCallback(async () => {
    commitTyping();
    const to = [...chips.map((c) => c.user?.handle || c.q), ...(typing.trim() ? [typing.trim()] : [])].filter(Boolean);
    if (!to.length) { toast(errorText({ code: 'NO_RECIPIENTS' }, lang)); return; }
    if (!body.trim() && !attachment) { toast(errorText({ code: 'EMPTY_MESSAGE' }, lang)); return; }
    setBusy('send');
    try {
      const payload = { to, subject, body, attachment };
      const out = draftId
        ? await cx<MailSendResult>(`/community/mail/drafts/${draftId}/send`, { body: payload })
        : await cx<MailSendResult>('/community/mail', { body: payload });
      const externalCount = out.external?.to?.length || 0;
      if (externalCount && out.external?.status === 'sent') toast(t(`والميل اتبعت خارجيًا لـ ${externalCount} عنوان ✓`, `and ${externalCount} external address(es) got it for real ✓`));
      else if (externalCount && out.external?.status === 'failed') toast(t('الميل في المرسلة — لكن الإرسال الخارجي فشل (وصلك إشعار تعذّر تسليم)', 'Saved in Sent, but the external delivery failed (bounce notice sent)'));
      else if (externalCount && out.external?.status === 'unconfigured') toast(t('الميل في المرسلة — الإرسال الخارجي مش متظبط على السيرفر لسه (وصلك إشعار)', 'Saved in Sent — external delivery is not configured yet (notice sent)'));
      else if (out.missed?.length) toast(t(`اتبعت، لكن ${out.missed.length} عنوان مش متاح (بعتنالك إشعار تعذّر تسليم)`, `Sent, but ${out.missed.length} address(es) were unreachable (bounce notice sent)`));
      onClose(true);
    } catch (e) { toast(errorText(e, lang)); setBusy(''); }
  }, [chips, typing, subject, body, attachment, draftId, commitTyping, lang, t, toast, onClose]);

  const onPick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setAttachment(await resizeImage(file, 1280, 0.82)); }
    catch { toast(errorText({ code: 'INVALID_IMAGE' }, lang)); }
  }, [lang, toast]);

  return (
    <Sheet title={initial.draftId || draftId ? t('مسودة رسالة', 'Draft') : t('رسالة جديدة', 'New message')} onClose={() => void close()} wide>
      <div className="space-y-3">
        {/* To */}
        <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-stone-500">{t('إلى:', 'To:')}</span>
            {chips.map((c, i) => {
              const looksExternal = !c.user && /@[^@\s]+\.[^@\s]{2,}$/.test(c.q) && !/@(sham|sham\.mail)$/i.test(c.q);
              return (
                <span key={`${c.user?.handle || c.q}-${i}`} title={looksExternal ? t('عنوان خارج المنصة — بيتبعت كإيميل حقيقي', 'Outside the platform — sent as a real e-mail') : undefined}
                  className={`flex items-center gap-1 rounded-full py-0.5 pe-1 ps-1.5 text-xs font-semibold ${looksExternal ? 'bg-sky-100 text-sky-900' : 'bg-amber-100 text-amber-900'}`}>
                  {c.user && <Avatar user={c.user} size={18} />}
                  {looksExternal && <Globe className="h-3 w-3" />}
                  {c.user ? c.user.name : c.q}
                  <button type="button" onClick={() => setChips((old) => old.filter((_, x) => x !== i))} className={`rounded-full p-0.5 cursor-pointer ${looksExternal ? 'hover:bg-sky-200' : 'hover:bg-amber-200'}`}><X className="h-3 w-3" /></button>
                </span>
              );
            })}
            <div className="relative min-w-36 flex-1">
              <input value={typing} onChange={(e) => setTyping(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === 'Tab' || e.key === ',') && typing.trim()) { e.preventDefault(); if (suggestions[0]) addChip({ q: typing.trim(), user: suggestions[0] }); else commitTyping(); }
                  else if (e.key === 'Backspace' && !typing && chips.length) setChips((old) => old.slice(0, -1));
                }}
                onBlur={() => setTimeout(() => setSuggestions([]), 200)}
                placeholder={chips.length ? '' : t('اسم مستخدم أو handle@sham أو أي إيميل خارجي (gmail/yahoo…)', 'username, handle@sham, or any outside e-mail (gmail/yahoo…)')}
                className="w-full bg-transparent py-1 text-sm outline-none" />
              {suggestions.length > 0 && (
                <ul className="absolute start-0 top-full z-10 mt-1 max-h-56 w-64 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-xl">
                  {suggestions.filter((s) => !chips.some((c) => c.user?.id === s.id)).slice(0, 8).map((s) => (
                    <li key={s.id}>
                      <button type="button" onMouseDown={(e) => { e.preventDefault(); addChip({ q: s.handle, user: s }); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-amber-50 cursor-pointer">
                        <Avatar user={s} size={26} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-stone-800">{s.name}</span>
                          <span className="block truncate text-[11px] text-stone-400" dir="ltr">{s.handle}@sham</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        {/* Subject */}
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={190}
          placeholder={t('الموضوع', 'Subject')} className={inputClass} />
        {/* Body */}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={8000} dir="auto"
          placeholder={t('اكتب رسالتك هنا…', 'Write your letter here…')}
          className={`${inputClass} resize-y leading-7`}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void send(); }} />
        {/* Attachment */}
        {attachment && (
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2">
            <img loading="lazy" decoding="async" src={attachment} alt="" className="h-14 w-14 rounded-lg object-cover" />
            <span className="text-xs text-stone-500">{t('صورة مرفقة ✓', 'Picture attached ✓')}</span>
            <button type="button" onClick={() => setAttachment(null)} className="ms-auto rounded-full p-1.5 text-stone-500 hover:bg-stone-200 cursor-pointer"><X className="h-4 w-4" /></button>
          </div>
        )}
        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Btn busy={busy === 'send'} onClick={() => void send()}><Send className="h-4 w-4" />{t('إرسال', 'Send')}</Btn>
          <Btn variant="soft" busy={busy === 'draft'} disabled={!dirty}
            onClick={async () => { setBusy('draft'); await save(false); setBusy(''); }}>
            <FileText className="h-4 w-4" />{t('حفظ كمسودة', 'Save draft')}
          </Btn>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPick(e)} />
          <button type="button" onClick={() => fileRef.current?.click()} title={t('إرفاق صورة', 'Attach a picture')}
            className="rounded-full p-2.5 text-stone-600 hover:bg-stone-100 cursor-pointer"><ImagePlus className="h-5 w-5" /></button>
          <span className="ms-auto text-[11px] text-stone-400">{t('Ctrl + Enter للإرسال', 'Ctrl + Enter to send')}</span>
        </div>
      </div>
    </Sheet>
  );
}
