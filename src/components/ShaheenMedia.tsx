import React, { useEffect, useState } from 'react';
import { ExternalLink, Image as ImageIcon, Play, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { isStaticHosting } from '../utils/api';
import { makeT, type LText } from '../utils/localize';
import { fetchMedia, youtubeSearchUrl, type MediaImage, type MediaRequest, type VideoResult } from '../utils/shaheenMedia';

const STRINGS = {
  title: { ar: 'توضيح مرئي', en: 'Visual guide', fr: 'Guide visuel', es: 'Guía visual', de: 'Visuelle Erklärung', tr: 'Görsel rehber', ru: 'Наглядно', zh: '图示说明' },
  imagesFrom: { ar: 'صور حرة من Wikimedia Commons — اضغط على الصورة للتكبير ومعرفة المصدر والترخيص.', en: 'Free images from Wikimedia Commons — tap an image to enlarge it and see its source and license.', fr: 'Images libres de Wikimedia Commons — touchez une image pour l’agrandir et voir sa source.', es: 'Imágenes libres de Wikimedia Commons: toca una imagen para ampliarla y ver su fuente.', de: 'Freie Bilder von Wikimedia Commons – zum Vergrößern und für Quelle/Lizenz antippen.', tr: 'Wikimedia Commons’tan özgür görseller — büyütmek ve kaynağı görmek için dokunun.' },
  watch: { ar: 'تشغيل الفيديو', en: 'Play video', fr: 'Lire la vidéo', es: 'Reproducir vídeo', de: 'Video abspielen', tr: 'Videoyu oynat' },
  moreVideos: { ar: 'مزيد من الفيديوهات على YouTube', en: 'More videos on YouTube', fr: 'Plus de vidéos sur YouTube', es: 'Más vídeos en YouTube', de: 'Weitere Videos auf YouTube', tr: 'YouTube’da daha fazla video' },
  searchVideos: { ar: 'شاهد فيديوهات توضيحية على YouTube:', en: 'Watch explanatory videos on YouTube:', fr: 'Voir des vidéos explicatives sur YouTube :', es: 'Ver vídeos explicativos en YouTube:', de: 'Erklärvideos auf YouTube ansehen:', tr: 'YouTube’da açıklayıcı videolar izleyin:' },
  source: { ar: 'المصدر والترخيص', en: 'Source & license', fr: 'Source et licence', es: 'Fuente y licencia', de: 'Quelle & Lizenz', tr: 'Kaynak ve lisans' },
  by: { ar: 'تصوير/إعداد:', en: 'By', fr: 'Par', es: 'Por', de: 'Von', tr: 'Yazar:' },
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

  useEffect(() => {
    let alive = true;
    if (!imageKey || isStaticHosting) { setImages([]); return; }
    setImages(null);
    void Promise.allSettled(imageKey.split('|').map((q) => fetchMedia('image', q, lang))).then((results) => {
      if (!alive) return;
      const seen = new Set<string>();
      // Interleave the topics so each one gets a picture before any gets a second.
      const lists = results.map((r) => (r.status === 'fulfilled' ? r.value.images : []));
      const merged: MediaImage[] = [];
      for (let i = 0; i < 4; i++) for (const list of lists) {
        const img = list[i];
        if (img && !seen.has(img.thumb) && merged.length < 4) { seen.add(img.thumb); merged.push(img); }
      }
      setImages(merged);
    });
    return () => { alive = false; };
  }, [imageKey, lang]);

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
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  const loadingImages = images === null;
  const shown = (images || []).filter((img) => !broken.has(img.thumb));
  const hasImages = shown.length > 0;
  const hasVideoArea = Boolean(videoQuery);
  if (!loadingImages && !hasImages && !hasVideoArea) return null;

  return (
    <section className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-2.5 sm:p-3" aria-label={L('title')} data-testid="shaheen-media">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
        <ImageIcon className="h-3.5 w-3.5" aria-hidden />
        <span>{L('title')}</span>
      </div>

      {loadingImages && (
        <div className="grid grid-cols-2 gap-2" aria-busy="true">
          {[0, 1].map((i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-lg bg-stone-200/80" />)}
        </div>
      )}

      {hasImages && (
        <>
          <div className="grid grid-cols-2 gap-2">
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
            <div key={v.id} className="mb-2 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
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
