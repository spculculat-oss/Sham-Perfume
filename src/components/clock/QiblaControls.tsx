import { memo, useId, useMemo } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { WORLD_CITIES } from '../../data/worldEntryGazetteer';
import { makeT, type LText } from '../../لغات/localize';
import { formatLocalizedNumber } from '../../لغات/numerals';
import { normalizeBearing } from '../../utils/visitorCompass';
import { clockLocale } from './clockText';
import type { QiblaState } from './useQibla';

const TEXT = {
  title: { ar: 'اتجاه القبلة', en: 'Qibla direction' },
  locate: { ar: 'حدّد القبلة بموقعي', en: 'Find Qibla using my location' },
  refresh: { ar: 'حدّث موقعي للقبلة', en: 'Refresh my Qibla location' },
  chooseCity: { ar: 'اختار مدينة', en: 'Choose a city' },
  city: { ar: 'مدينة القبلة', en: 'Qibla city' },
  cityFrom: { ar: 'تقدير من وسط {city}', en: 'Estimate from central {city}' },
  deviceFrom: { ar: 'حسب موقع جهازك', en: 'From your device location' },
  north: { ar: 'من الشمال الجغرافي', en: 'From geographic north' },
  idle: { ar: 'حدّد موقعك أو اختار مدينة قريبة. حساب القبلة على جهازك بس.', en: 'Use your location or choose a nearby city. Qibla is calculated on your device.' },
  locating: { ar: 'بنحدّد موقعك…', en: 'Finding your location…' },
  denied: { ar: 'إذن الموقع مرفوض. اختار مدينة أو اسمح بالموقع من إعدادات المتصفح.', en: 'Location access was denied. Choose a city or allow location in browser settings.' },
  timeout: { ar: 'تحديد الموقع اتأخّر. جرّب تاني أو اختار مدينة.', en: 'Location timed out. Try again or choose a city.' },
  unsupported: { ar: 'تحديد الموقع مش متاح هنا. اختار مدينة أو افتح الصفحة في تبويب مستقل.', en: 'Location is unavailable here. Choose a city or open this page in its own tab.' },
  failed: { ar: 'ماقدرناش نحدد موقعك. جرّب تاني أو اختار مدينة.', en: 'Could not find your location. Try again or choose a city.' },
  uncertain: { ar: 'مفيش اتجاه موثوق من الموقع ده. جرّب موقع أدق.', en: 'No reliable bearing from this position. Try a more precise location.' },
  map: { ar: 'عرض ثابت: الشمال فوق. السهم مش مرتبط بلفّ موبايلك دلوقتي.', en: 'North-up diagram. The arrow is not tracking your phone.' },
  uncorrected: { ar: 'عرض ثابت: الشمال فوق. تصحيح الشمال المغناطيسي مش متاح للموقع أو التاريخ ده.', en: 'North-up diagram. Magnetic north correction is unavailable for this place or date.' },
  live: { ar: 'امسك الموبايل أفقي ولفّه لحد ما السهم يقابل العلامة فوق. ابعد عن المعادن والمغناطيس.', en: 'Hold the phone flat and turn until the arrow meets the top notch. Keep away from metal and magnets.' },
  aligned: { ar: 'أعلى الموبايل ناحية القبلة تقريبًا.', en: 'The top of the phone is approximately facing Qibla.' },
} satisfies Record<string, LText>;

export const QiblaControls = memo(function QiblaControls({ lang, state, live, aligned, locate, selectCity }: {
  lang: SupportedLanguage; state: QiblaState; live: boolean; aligned: boolean;
  locate: () => void; selectCity: (key: string) => void;
}) {
  const label = makeT(lang, TEXT);
  const headingId = useId();
  const statusId = useId();
  const { locale } = clockLocale(lang);
  const cities = useMemo(() => {
    const regions = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames([locale], { type: 'region' }) : undefined;
    const collator = new Intl.Collator(locale);
    return WORLD_CITIES.map((city) => {
      const name = lang === 'ar' ? city.cityAr : city.cityEn;
      return { key: city.key, name: `${name} · ${regions?.of(city.country) || city.country}` };
    }).sort((a, b) => collator.compare(a.name, b.name));
  }, [lang, locale]);
  const status = state.phase !== 'ready' ? state.phase : aligned ? 'aligned' : live ? 'live' : state.direction.declination === undefined ? 'uncorrected' : 'map';
  const degrees = state.direction && normalizeBearing(Math.round(state.direction.bearing));
  return <section className="clock-qibla" aria-labelledby={headingId}>
    <div className="clock-qibla-title">
      <h3 id={headingId}>{label('title')}</h3>
      {degrees !== undefined && <bdi dir="ltr" data-testid="qibla-bearing">{formatLocalizedNumber(lang, degrees, { grouping: false })}°</bdi>}
    </div>
    {state.direction && <p className="clock-qibla-origin"><MapPin size={12} aria-hidden="true" /><span>
      {state.city ? label('cityFrom').replace('{city}', lang === 'ar' ? state.city.cityAr : state.city.cityEn) : label('deviceFrom')}
      {' · '}{label('north')}
    </span></p>}
    <p id={statusId} className="clock-qibla-status" role="status">{label(status)}</p>
    <div className="clock-qibla-actions">
      <button type="button" onClick={locate} disabled={state.phase === 'locating'} aria-describedby={statusId}>
        <LocateFixed size={14} aria-hidden="true" />{label(state.phase === 'ready' && !state.city ? 'refresh' : 'locate')}
      </button>
      <details>
        <summary>{label('chooseCity')}</summary>
        <select aria-label={label('city')} value={state.city?.key ?? ''} onChange={(event) => selectCity(event.currentTarget.value)}>
          <option value="">{label('chooseCity')}</option>
          {cities.map(({ key, name }) => <option key={key} value={key}>{name}</option>)}
        </select>
      </details>
    </div>
  </section>;
});
