import React, { Suspense, lazy, useEffect, useState } from 'react';
import { tidyCaption, topicOnlyInPlaceName } from '../utils/mediaCaption';
import { ExternalLink, Image as ImageIcon, MapPin, Play, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { isStaticHosting } from '../utils/api';
import { makeT, type LText } from '../لغات/localize';
import { fetchMedia, osmSearchUrl, youtubeSearchUrl, type MediaImage, type MediaPlace, type MediaRequest, type VideoResult } from '../utils/shaheenMedia';

// Leaflet (~150 KB) is only downloaded when an answer actually has places to show.
const ShaheenMap = lazy(() => import('./ShaheenMap'));

const STRINGS = {
  title: { ar: 'توضيح مرئي', en: 'Visual guide', fr: 'Guide visuel', es: 'Guía visual', de: 'Visuelle Erklärung', tr: 'Görsel rehber', ru: 'Наглядно', zh: '图示说明' },
  imagesFrom: { ar: 'صور حرة من Wikimedia Commons — اضغط على الصورة للتكبير ومعرفة المصدر والترخيص.', en: 'Free images from Wikimedia Commons — tap an image to enlarge it and see its source and license.', fr: 'Images libres de Wikimedia Commons — touchez une image pour l’agrandir et voir sa source.', es: 'Imágenes libres de Wikimedia Commons: toca una imagen para ampliarla y ver su fuente.', de: 'Freie Bilder von Wikimedia Commons – zum Vergrößern und für Quelle/Lizenz antippen.', tr: 'Wikimedia Commons’tan özgür görseller — büyütmek ve kaynağı görmek için dokunun.' },
  watch: { ar: 'تشغيل الفيديو', en: 'Play video', fr: 'Lire la vidéo', es: 'Reproducir vídeo', de: 'Video abspielen', tr: 'Videoyu oynat' },
  moreVideos: { ar: 'مزيد من الفيديوهات على YouTube', en: 'More videos on YouTube', fr: 'Plus de vidéos sur YouTube', es: 'Más vídeos en YouTube', de: 'Weitere Videos auf YouTube', tr: 'YouTube’da daha fazla video' },
  searchVideos: { ar: 'شاهد فيديوهات توضيحية على YouTube:', en: 'Watch explanatory videos on YouTube:', fr: 'Voir des vidéos explicatives sur YouTube :', es: 'Ver vídeos explicativos en YouTube:', de: 'Erklärvideos auf YouTube ansehen:', tr: 'YouTube’da açıklayıcı videolar izleyin:' },
  source: { ar: 'المصدر والترخيص', en: 'Source & license', fr: 'Source et licence', es: 'Fuente y licencia', de: 'Quelle & Lizenz', tr: 'Kaynak ve lisans' },
  by: { ar: 'تصوير/إعداد:', en: 'By', fr: 'Par', es: 'Por', de: 'Von', tr: 'Yazar:' },
  places: { ar: 'أماكن على الخريطة', en: 'Places on the map', fr: 'Lieux sur la carte', es: 'Lugares en el mapa', de: 'Orte auf der Karte', tr: 'Haritadaki yerler', ru: 'Места на карте', zh: '地图上的地点' },
  mapHint: { ar: 'اضغط على اسم المكان للانتقال إليه على الخريطة. بيانات الخريطة © مساهمو OpenStreetMap.', en: 'Tap a place to fly to it on the map. Map data © OpenStreetMap contributors.', fr: 'Touchez un lieu pour le voir sur la carte. Données © contributeurs OpenStreetMap.', es: 'Toca un lugar para verlo en el mapa. Datos © colaboradores de OpenStreetMap.', de: 'Ort antippen, um ihn auf der Karte zu zeigen. Kartendaten © OpenStreetMap-Mitwirkende.', tr: 'Haritada görmek için bir yere dokunun. Harita verileri © OpenStreetMap katkıcıları.' },
  openMap: { ar: 'افتح في OpenStreetMap', en: 'Open in OpenStreetMap', fr: 'Ouvrir dans OpenStreetMap', es: 'Abrir en OpenStreetMap', de: 'In OpenStreetMap öffnen', tr: 'OpenStreetMap’te aç' },
  close: { ar: 'إغلاق', en: 'Close', fr: 'Fermer', es: 'Cerrar', de: 'Schließen', tr: 'Kapat' },
} satisfies Record<string, LText>;

interface Props { request: MediaRequest; lang: SupportedLanguage }

/** Real images (Wikimedia Commons) and videos (YouTube) for the topics Shaheen asked to illustrate. */
export function ShaheenMedia({ request, lang }: Props) {
  const L = makeT(lang, STRINGS);
  const imageKey = request.images.join('|');
  const videoQuery = request.videos[0];
  const [images, setImages] = useState<MediaImage[] | null>(request.images.length && !isStaticHosting ? null : []);
  const [video, setVideo] = useState<VideoResult | null>(videoQuery ? null : { videos: [], searchUrl: '' });
  const [playing, setPlaying] = useState<string | null>(null);
  const [zoom, setZoom] = useState<MediaImage | null>(null);
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const placeKey = (request.places || []).join('|');
  const [places, setPlaces] = useState<MediaPlace[] | null>(placeKey && !isStaticHosting ? null : []);
  const [selectedPlace, setSelectedPlace] = useState(-1);
  const [unlocated, setUnlocated] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    if (!imageKey || isStaticHosting) { setImages([]); return; }
    setImages(null);
    // Images and places do not depend on the interface language (it can switch right after load).
    void Promise.allSettled(imageKey.split('|').map((q) => fetchMedia('image', q, ''))).then((results) => {
      if (!alive) return;
      const seen = new Set<string>();
      // Interleave the topics so each one gets a picture before any gets a second.
      // Readable captions (no catalogue numbers), and no Dutch places for «oud» — also for answers the
      // server cached before it learned this.
      const topics = imageKey.split('|');
      const lists = results.map((r, n) => (r.status === 'fulfilled' ? r.value.images : [])
        .filter((img) => !topicOnlyInPlaceName(img.title, topics[n]))
        .map((img) => ({ ...img, title: tidyCaption(img.title, topics[n]) })));
      const merged: MediaImage[] = [];
      for (let i = 0; i < 4; i++) for (const list of lists) {
        const img = list[i];
        if (img && !seen.has(img.thumb) && merged.length < 4) { seen.add(img.thumb); merged.push(img); }
      }
      setImages(merged);
    });
    return () => { alive = false; };
  }, [imageKey]);

  useEffect(() => {
    let alive = true;
    if (!videoQuery) return;
    const fallback = { videos: [], searchUrl: youtubeSearchUrl(videoQuery) };
    if (isStaticHosting) { setVideo(fallback); return; }
    setVideo(null);
    fetchMedia('video', videoQuery, lang).then((v) => { if (alive) setVideo(v); }, () => { if (alive) setVideo(fallback); });
    return () => { alive = false; };
  }, [videoQuery, lang]);

  useEffect(() => {
    let alive = true;
    const names = placeKey ? placeKey.split('|') : [];
    if (!placeKey || isStaticHosting) { setPlaces([]); setUnlocated(names); return; }
    setPlaces(null);
    setUnlocated([]);
    setSelectedPlace(-1);
    void Promise.allSettled(placeKey.split('|').map((q) => fetchMedia('place', q, ''))).then((results) => {
      if (!alive) return;
      const seen = new Set<string>();
      setUnlocated(names.filter((_, i) => { const r = results[i]; return r.status !== 'fulfilled' || !r.value.places.length; }));
      setPlaces(results.flatMap((r) => (r.status === 'fulfilled' ? r.value.places.slice(0, 1) : []))
        .filter((p) => { const k = `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`; if (seen.has(k)) return false; seen.add(k); return true; }));
    });
    return () => { alive = false; };
  }, [placeKey]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  const loadingImages = images === null;
  const shown = (images || []).filter((img) => !broken.has(img.thumb));
  const hasImages = shown.length > 0;
  const hasVideoArea = Boolean(videoQuery);
  const loadingPlaces = places === null;
  const hasPlaces = Boolean(places?.length);
  // Places that could not be located (or no API on this host) still get a search link (`unlocated`).
  const hasPlaceArea = loadingPlaces || hasPlaces || unlocated.length > 0;
  if (!loadingImages && !hasImages && !hasVideoArea && !hasPlaceArea) return null;

  return (
    <section className="@container mt-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-2.5 sm:p-3" aria-label={L('title')} data-testid="shaheen-media">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
        <ImageIcon className="h-3.5 w-3.5" aria-hidden />
        <span>{L('title')}</span>
      </div>

      {loadingImages && (
        <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4" aria-busy="true">
          {[0, 1].map((i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-lg bg-stone-200/80" />)}
        </div>
      )}

      {hasImages && (
        <>
          <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
            {shown.map((img) => (
              <button
                key={img.thumb}
                type="button"
                onClick={() => setZoom(img)}
                className="group relative overflow-hidden rounded-lg border border-stone-200 bg-white text-start shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 cursor-zoom-in"
                title={img.title}
              >
                <img src={img.thumb} alt={img.title} loading="lazy" decoding="async" referrerPolicy="no-referrer"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={() => setBroken((prev) => new Set(prev).add(img.thumb))} />
                <span className="absolute inset-x-0 bottom-0 line-clamp-1 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4 text-[10px] text-white" dir="auto">{img.title}</span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-stone-500">{L('imagesFrom')}</p>
        </>
      )}

      {hasVideoArea && (
        <div className={hasImages || loadingImages ? 'mt-3' : ''}>
          {video === null && <div className="aspect-video w-full animate-pulse rounded-lg bg-stone-200/80" aria-busy="true" />}
          {video && video.videos.map((v) => (
            <div key={v.id} className="mb-2 max-w-md overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
              {playing === v.id ? (
                <iframe
                  className="aspect-video w-full"
                  src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1`}
                  title={v.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <button type="button" onClick={() => setPlaying(v.id)} className="group relative block w-full cursor-pointer" aria-label={`${L('watch')}: ${v.title}`}>
                  <img src={v.thumb} alt="" loading="lazy" decoding="async" className="aspect-video w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform group-hover:scale-110">
                      <Play className="h-6 w-6 translate-x-0.5 fill-current" aria-hidden />
                    </span>
                  </span>
                </button>
              )}
              <div className="px-2.5 py-1.5">
                <p className="line-clamp-2 text-[11px] font-bold text-stone-800" dir="auto">{v.title}</p>
                {v.channel && <p className="text-[10px] text-stone-500" dir="auto">{v.channel}</p>}
              </div>
            </div>
          ))}
          {video && (
            <a href={video.searchUrl} target="_blank" rel="noopener noreferrer nofollow"
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50">
              <Play className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden />
              <span className="truncate">{video.videos.length ? L('moreVideos') : <>{L('searchVideos')} <span dir="auto" className="font-normal">{videoQuery}</span></>}</span>
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
          )}
        </div>
      )}

      {hasPlaceArea && (
        <div className={hasImages || loadingImages || hasVideoArea ? 'mt-3' : ''}>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            <span>{L('places')}</span>
          </div>
          {(loadingPlaces || hasPlaces) && (
            <Suspense fallback={<div className="h-56 w-full animate-pulse rounded-lg bg-stone-200/80 sm:h-64" aria-busy="true" />}>
              {loadingPlaces
                ? <div className="h-56 w-full animate-pulse rounded-lg bg-stone-200/80 sm:h-64" aria-busy="true" />
                : <ShaheenMap places={places!} selected={selectedPlace} onSelect={setSelectedPlace} label={L('places')} />}
            </Suspense>
          )}
          {hasPlaces && (
            <ol className="mt-2 flex flex-wrap gap-1.5">
              {places!.map((p, i) => (
                <li key={`${p.lat},${p.lon}`} className={`flex max-w-full items-center overflow-hidden rounded-full border text-[11px] ${i === selectedPlace ? 'border-amber-700 bg-amber-100' : 'border-stone-200 bg-white'}`}>
                  <button type="button" onClick={() => setSelectedPlace(i)} title={p.label} className="flex min-w-0 items-center gap-1 px-2.5 py-1 font-bold text-stone-800 hover:text-amber-900 cursor-pointer">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-700 text-[9px] text-white">{i + 1}</span>
                    <span className="truncate" dir="auto">{p.name}</span>
                  </button>
                  <a href={p.osm} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${L('openMap')}: ${p.name}`} title={L('openMap')} className="border-s border-stone-200 px-2 py-1 text-amber-800 hover:bg-amber-50">
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </li>
              ))}
            </ol>
          )}
          {unlocated.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {unlocated.map((q) => (
                <a key={q} href={osmSearchUrl(q)} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-bold text-stone-700 hover:bg-amber-50">
                  <MapPin className="h-3 w-3 shrink-0 text-amber-700" aria-hidden />
                  <span className="truncate" dir="auto">{q}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                </a>
              ))}
            </div>
          )}
          {hasPlaces && <p className="mt-1.5 text-[10px] leading-snug text-stone-500">{L('mapHint')}</p>}
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label={zoom.title} onClick={() => setZoom(null)}>
          <div className="relative max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setZoom(null)} className="absolute -top-3 -end-3 z-10 rounded-full bg-white p-1.5 text-stone-800 shadow-lg cursor-pointer" aria-label={L('close')}>
              <X className="h-4 w-4" />
            </button>
            <img src={zoom.large || zoom.thumb} alt={zoom.title} referrerPolicy="no-referrer" className="max-h-[75vh] w-auto rounded-lg object-contain shadow-2xl" />
            <div className="mt-2 rounded-lg bg-white/95 px-3 py-2 text-[11px] text-stone-700">
              <p className="font-bold text-stone-900" dir="auto">{zoom.title}</p>
              <p className="mt-0.5" dir="auto">
                {zoom.author && <>{L('by')} {zoom.author} · </>}{zoom.license} ·{' '}
                <a href={zoom.page} target="_blank" rel="noopener noreferrer nofollow" className="text-amber-800 underline">{L('source')}</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
