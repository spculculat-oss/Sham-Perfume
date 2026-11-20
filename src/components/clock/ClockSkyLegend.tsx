import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { SupportedLanguage } from '../../types/i18n';
import { makeT, type LText } from '../../لغات/localize';
import type { SkyPhase } from '../../utils/clockSky';
import type { ClockSky } from './useClockSky';
import './clock.css';

export const SKY_TEXT = {
  sky_dawn: { ar: 'فجر', en: 'First light' },
  sky_morning: { ar: 'صباح', en: 'Morning' },
  sky_noon: { ar: 'ظُهر', en: 'Noon' },
  sky_afternoon: { ar: 'عصر', en: 'Afternoon' },
  sky_dusk: { ar: 'مغرب', en: 'Dusk' },
  sky_night: { ar: 'ليل', en: 'Night' },
  sky_hint: { ar: 'المس الزجاج أو اسحبه يغيّر ضوء البار', en: 'Tap the glass or drag it to change the light' },
  sky_cycle: { ar: 'غيّر المشهد', en: 'Change the scene' },
  sky_auto: { ar: 'رجّع ضوء الوقت', en: 'Back to the real time' },
  compass_shine: { ar: 'خلّي الضوء يلف مع البوصلة', en: 'Turn the light with the compass' },
  compass_off: { ar: 'الضوء مع البوصلة', en: 'Light follows compass' },
  compass_waiting: { ar: 'بنقرأ اتجاه الجهاز…', en: 'Reading the device heading…' },
  compass_ready: { ar: 'الضوء بيلف مع اتجاهك', en: 'The light turns with you' },
  compass_denied: { ar: 'إذن الحساس مرفوض', en: 'Sensor permission was denied' },
  compass_unsupported: { ar: 'اتجاه الجهاز مش متاح هنا', en: 'Device heading is unavailable here' },
} satisfies Record<string, LText>;

const PHASE_KEY: Record<SkyPhase, keyof typeof SKY_TEXT> = {
  dawn: 'sky_dawn', morning: 'sky_morning', noon: 'sky_noon',
  afternoon: 'sky_afternoon', dusk: 'sky_dusk', night: 'sky_night',
};

/** Props that make any surface play with the glass light. */
export function skySurfaceProps(sky: ClockSky) {
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      sky.startDrag(event);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      sky.followPointer(event);
      sky.moveDrag(event);
    },
    onPointerUp: sky.endDrag,
    onPointerCancel: sky.endDrag,
    onPointerLeave: sky.endDrag,
    onMouseMove: (event: ReactMouseEvent<HTMLElement>) => sky.followPointer(event),
  };
}

export function ClockSkyLegend({ sky, lang, compact = false }: { sky: ClockSky; lang: SupportedLanguage; compact?: boolean }) {
  const label = makeT(lang, SKY_TEXT);
  const compassText = label(`compass_${sky.compass.phase}` as keyof typeof SKY_TEXT);
  const compassState = sky.compass.phase === 'ready' ? 'ready' : sky.compass.phase === 'off' ? 'off' : 'waiting';
  return (
    <div className="clock-sky-legend" data-compact={compact}>
      <button type="button" className="clock-sky-phase" data-phase={sky.phase} aria-pressed={!sky.seasonal} title={label(sky.seasonal ? 'sky_hint' : 'sky_auto')} onClick={sky.cycle}>
        <span className="clock-sky-dot" aria-hidden="true" />
        <span>{label(PHASE_KEY[sky.phase])}</span>
      </button>
      <button type="button" className="clock-sky-compass" data-state={compassState} aria-pressed={sky.compass.phase === 'ready' || sky.compass.phase === 'waiting'} title={compassText} onClick={() => { void sky.toggleCompass(); }}>
        <svg viewBox="0 0 16 16" aria-hidden="true" width="13" height="13">
          <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
          <path d="M8 2.6 L10.1 8 L8 6.9 L5.9 8 Z" fill="currentColor" />
        </svg>
        <span>{compact ? label('compass_off') : compassText}</span>
        {sky.compass.phase === 'ready' && <bdi dir="ltr">{sky.compass.bearing}°</bdi>}
      </button>
    </div>
  );
}
