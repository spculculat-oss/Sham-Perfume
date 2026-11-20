/**
 * «استوديو الصوت» — the three audio tools that came from Google AI Studio, gathered in one tab of our own instead
 * of a copy of the studio's server:
 *
 *  - تسجيل صوتي → نص      (`AudioTranscribeStudio`, POST /api/ai/transcribe)
 *  - موسيقى العطر          (`FragranceMusicStudio`,   POST /api/ai/music)
 *  - صوت بشري للنص         (`VoiceTranscribeButton` + the site's own speech, POST /api/ai/tts)
 *
 * The owner's rules stay: nothing is bought, nothing is stored, and when the engine's free quota is spent the tab
 * says so plainly instead of hiding a failure (server/studioVoice.ts answers 503).
 */
import { useState } from 'react';
import { AudioLines, Mic, Music4, Volume2 } from 'lucide-react';
import { pickArEn } from '../لغات/localize';
import { AudioTranscribeStudio } from './AudioTranscribeStudio';
import { FragranceMusicStudio } from './FragranceMusicStudio';
import { VoiceTranscribeButton } from './VoiceTranscribeButton';
import { apiUrl, isStaticHosting } from '../utils/api';
import type { SupportedLanguage } from '../types/i18n';

type Tool = 'transcribe' | 'music' | 'speak';

export function StudioVoiceHub({ currentLang = 'ar' }: { currentLang?: string }) {
  const [tool, setTool] = useState<Tool>('transcribe');
  const [text, setText] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const t = (ar: string, en: string) => pickArEn(currentLang as SupportedLanguage, ar, en);

  const speak = async () => {
    const clean = text.trim();
    if (!clean || busy) return;
    if (isStaticHosting) { setNote(t('الصوت البشري محتاج اتصالًا بخادم شام.', 'The human voice needs the Sham server.')); return; }
    setBusy(true); setNote(null); setSaid(null);
    try {
      const res = await fetch(apiUrl('/api/ai/tts'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, language: currentLang === 'ar' ? 'ar' : 'en' }),
      });
      const data = await res.json().catch(() => ({})) as { audioBase64?: string; code?: string };
      if (!res.ok || !data.audioBase64) {
        setNote(res.status === 503
          ? t('الصوت مشغول دلوقتي — جرّب بعد شوية.', 'The voice is busy right now — try again shortly.')
          : t('تعذّر تشغيل النص دلوقتي.', 'Could not speak that right now.'));
        return;
      }
      const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
      setSaid(clean);
      await audio.play().catch(() => setNote(t('المتصفح منع التشغيل — اضغط تشغيل تاني.', 'The browser blocked playback — press play again.')));
    } catch {
      setNote(t('تعذّر الوصول لخدمة الصوت.', 'Could not reach the voice service.'));
    } finally { setBusy(false); }
  };

  const tabs: Array<{ id: Tool; icon: typeof Mic; ar: string; en: string }> = [
    { id: 'transcribe', icon: Mic, ar: 'تسجيل → نص', en: 'Record → text' },
    { id: 'music', icon: Music4, ar: 'موسيقى العطر', en: 'Fragrance music' },
    { id: 'speak', icon: Volume2, ar: 'نص → صوت', en: 'Text → voice' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-stone-50 p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-black text-stone-900">
          <AudioLines className="h-5 w-5 text-amber-700" />
          {t('استوديو الصوت', 'Voice studio')}
        </h2>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-stone-600">
          {t('سجّل ملاحظاتك بصوتك وتتحوّل لنص، اسمع موسيقى مستوحاة من عطرك، أو خلّي شاهين يقرا النص بصوت بشري.',
            'Record your notes into text, hear music inspired by your fragrance, or have the text read in a human voice.')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map(({ id, icon: Icon, ar, en }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTool(id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                tool === id ? 'bg-amber-700 text-white shadow' : 'bg-white text-stone-700 hover:bg-amber-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(ar, en)}
            </button>
          ))}
        </div>
      </div>

      {tool === 'transcribe' && (
        <AudioTranscribeStudio lang={currentLang} onInsertText={(value) => { setText(value); setTool('speak'); }} />
      )}
      {tool === 'music' && <FragranceMusicStudio lang={currentLang} />}
      {tool === 'speak' && (
        <div className="space-y-3 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <label className="block text-xs font-bold text-stone-600" htmlFor="studio-voice-text">
            {t('النص اللي عايز تسمعه', 'The text you want to hear')}
          </label>
          <textarea
            id="studio-voice-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={2400}
            placeholder={t('اكتب أو استخدم زر المايك…', 'Type, or use the microphone button…')}
            className="w-full resize-none rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:bg-white focus:ring-2 focus:ring-amber-200"
          />
          <div className="flex flex-wrap items-center gap-2">
            <VoiceTranscribeButton
              lang={currentLang}
              onTranscribed={(value) => setText((prev) => (prev ? `${prev} ${value}` : value))}
            />
            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={() => void speak()}
              className="flex items-center gap-1.5 rounded-xl bg-amber-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-800 disabled:opacity-50 cursor-pointer"
            >
              <Volume2 className="h-4 w-4" />
              {busy ? t('بيتكلّم…', 'Speaking…') : t('اسمع النص', 'Speak it')}
            </button>
          </div>
          {said && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-900">
              {t('اتقرأ بصوت بشري:', 'Read in a human voice:')} {said.slice(0, 120)}
            </p>
          )}
          {note && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-900">{note}</p>}
        </div>
      )}
    </div>
  );
}
