import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMapView,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  ExternalLink,
  Flower2,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  Sparkles,
  Store,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { apiUrl, isStaticHosting } from '../utils/api';
import { pickArEn } from '../لغات/localize';

interface OriginSpot {
  id: string;
  nameAr: string;
  nameEn: string;
  countryAr: string;
  countryEn: string;
  lat: number;
  lng: number;
  category: 'origin' | 'house';
  noteAr: string;
  noteEn: string;
  harvestSeasonAr: string;
  harvestSeasonEn: string;
}

const CURATED_PERFUMERY_SPOTS: OriginSpot[] = [
  {
    id: 'damascus',
    nameAr: 'دمشق — موطن الورد الشامي (Rosa Damascena)',
    nameEn: 'Damascus — Damask Rose Origin',
    countryAr: 'سوريا',
    countryEn: 'Syria',
    lat: 33.5138,
    lng: 36.2765,
    category: 'origin',
    noteAr: 'قطاف الورد الجوري الدمشقي وتقطير ماء الورد والزيت العطري الصافي.',
    noteEn: 'Historic Damask rose cultivation and copper-alembic hydro-distillation.',
    harvestSeasonAr: 'أبريل – مايو',
    harvestSeasonEn: 'April – May',
  },
  {
    id: 'grasse',
    nameAr: 'غراس — عاصمة العطور العالمية',
    nameEn: 'Grasse — World Capital of Perfumery',
    countryAr: 'فرنسا',
    countryEn: 'France',
    lat: 43.6584,
    lng: 6.9224,
    category: 'house',
    noteAr: 'الياسمين الكبير، مسك الروم، ورد سنتيفوليا وأعرق دور استخلاص الأبسلوت.',
    noteEn: 'Grandiflorum jasmine, tuberose, Rose Centifolia & historic extraction houses.',
    harvestSeasonAr: 'يوليو – أكتوبر',
    harvestSeasonEn: 'July – October',
  },
  {
    id: 'taif',
    nameAr: 'الطائف — مزارع ومعامل الورد الطائفي',
    nameEn: 'Taif — Ward Taifi Mountain Terraces',
    countryAr: 'السعودية',
    countryEn: 'Saudi Arabia',
    lat: 21.2841,
    lng: 40.4248,
    category: 'origin',
    noteAr: 'أشهر تولات دهن الورد الطائفي الجبلي بنفحاته الحارة العسلية الفاخرة.',
    noteEn: 'High-altitude Ward Taifi attar prized for honeyed spicy facets.',
    harvestSeasonAr: 'مارس – أبريل',
    harvestSeasonEn: 'March – April',
  },
  {
    id: 'salalah',
    nameAr: 'صلالة (ظفار) — اللبان الحوجري الملكي',
    nameEn: 'Salalah — Royal Hojari Frankincense',
    countryAr: 'عُمان',
    countryEn: 'Oman',
    lat: 17.0194,
    lng: 54.0897,
    category: 'origin',
    noteAr: 'أجود راتنج Boswellia sacra الأخضر الفضي والمثبتات البلسمية المقدسة.',
    noteEn: 'Boswellia sacra green Hojari resin and sacred balsamic fixatives.',
    harvestSeasonAr: 'سبتمبر – نوفمبر',
    harvestSeasonEn: 'September – November',
  },
  {
    id: 'calabria',
    nameAr: 'ريجيو كالابريا — البرغموت الإيطالي',
    nameEn: 'Reggio Calabria — Bergamot Groves',
    countryAr: 'إيطاليا',
    countryEn: 'Italy',
    lat: 38.1113,
    lng: 15.6473,
    category: 'origin',
    noteAr: 'العصر البارد لقشور البرغموت لإنتاج أرقى إفتتاحيات الكولونيا والشيبري.',
    noteEn: 'Cold-pressed bergamot essence forming classic chypre & eau de cologne tops.',
    harvestSeasonAr: 'نوفمبر – يناير',
    harvestSeasonEn: 'November – January',
  },
  {
    id: 'kannauj',
    nameAr: 'قنوج — مدينة العطور والتقطير التقليدي',
    nameEn: 'Kannauj — Traditional Attar Craft',
    countryAr: 'الهند',
    countryEn: 'India',
    lat: 27.0514,
    lng: 79.9193,
    category: 'house',
    noteAr: 'التقطير البخاري بالديج والأواني النحاسية في قاعدة خشب الصندل الصافي.',
    noteEn: 'Deg-bhapka clay & copper distillation into pure sandalwood base.',
    harvestSeasonAr: 'على مدار العام',
    harvestSeasonEn: 'Year-round',
  },
];

interface GroundedPlace {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets?: string[];
}

interface PlacedResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  googleMapsURI?: string;
}

function isQuotaError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '');
  const status = (err as any)?.status || (err as any)?.code;
  return (
    status === 429 ||
    /RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|OverQuota|QuotaExceeded|429/i.test(msg)
  );
}

interface InnerAtlasProps {
  currentLang: SupportedLanguage;
  onAskShaheenPrompt?: (prompt: string) => void;
}

const InnerPerfumeAtlas: React.FC<InnerAtlasProps> = ({
  currentLang,
  onAskShaheenPrompt,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');

  const [selectedOrigin, setSelectedOrigin] = useState<OriginSpot | null>(CURATED_PERFUMERY_SPOTS[0]);
  const [selectedSearchedPlace, setSelectedSearchedPlace] = useState<PlacedResult | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchedPlaces, setSearchedPlaces] = useState<PlacedResult[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);

  const [groundingQuery, setGroundingQuery] = useState('');
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [groundingAnswer, setGroundingAnswer] = useState<string | null>(null);
  const [groundedPlaces, setGroundedPlaces] = useState<GroundedPlace[]>([]);
  const [groundingError, setGroundingError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const sessionTokenRef = useRef<any>(null);

  const isAr = currentLang === 'ar';
  const txt = useCallback(
    (ar: string, en: string) => pickArEn(currentLang, ar, en),
    [currentLang],
  );

  // Places API (New): Autocomplete suggestions
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (!placesLib || trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const { suggestions: raw } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          language: isAr ? 'ar' : 'en',
        });
        if (!cancelled) {
          setSuggestions(Array.isArray(raw) ? raw.slice(0, 5) : []);
        }
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) setSuggestions([]);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchInput, placesLib, isAr]);

  const handleSelectSuggestion = async (suggestion: any) => {
    if (!suggestion?.placePrediction) return;
    setSuggestions([]);
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'rating', 'googleMapsURI'],
      });
      sessionTokenRef.current = new (placesLib as any).AutocompleteSessionToken();

      const loc = place.location;
      if (!loc) return;
      const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
      const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;

      const result: PlacedResult = {
        id: place.id || `place-${Date.now()}`,
        name: place.displayName || searchInput,
        address: place.formattedAddress || '',
        lat,
        lng,
        rating: typeof place.rating === 'number' ? place.rating : undefined,
        googleMapsURI: place.googleMapsURI || undefined,
      };
      setSearchedPlaces([result]);
      setSelectedOrigin(null);
      setSelectedSearchedPlace(result);
      setSearchInput(result.name);
      map?.panTo({ lat, lng });
      map?.setZoom(13);
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    }
  };

  const handleTextSearchPlaces = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchInput.trim();
    if (!placesLib || !q) return;
    setSearchingPlaces(true);
    setSuggestions([]);
    try {
      const { places } = await placesLib.Place.searchByText({
        textQuery: q,
        fields: ['displayName', 'formattedAddress', 'location', 'rating', 'googleMapsURI'],
        maxResultCount: 6,
        language: isAr ? 'ar' : 'en',
      });
      const mapped: PlacedResult[] = (places || [])
        .filter((p: any) => p.location)
        .map((p: any, idx: number) => ({
          id: p.id || `res-${idx}-${Date.now()}`,
          name: p.displayName || q,
          address: p.formattedAddress || '',
          lat: typeof p.location.lat === 'function' ? p.location.lat() : p.location.lat,
          lng: typeof p.location.lng === 'function' ? p.location.lng() : p.location.lng,
          rating: typeof p.rating === 'number' ? p.rating : undefined,
          googleMapsURI: p.googleMapsURI || undefined,
        }));
      setSearchedPlaces(mapped);
      if (mapped.length > 0) {
        setSelectedOrigin(null);
        setSelectedSearchedPlace(mapped[0]);
        map?.panTo({ lat: mapped[0].lat, lng: mapped[0].lng });
        map?.setZoom(12);
      }
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    } finally {
      setSearchingPlaces(false);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        map?.panTo(coords);
        map?.setZoom(12);
      },
      () => {
        // Silent fallback if user blocks geolocation
      },
      { enableHighAccuracy: false, timeout: 7000 },
    );
  };

  const handleMapsGrounding = async (customQuery?: string) => {
    const q = (customQuery ?? groundingQuery).trim();
    if (!q || isStaticHosting) return;
    if (customQuery) setGroundingQuery(customQuery);
    setGroundingLoading(true);
    setGroundingError(null);

    try {
      const center = map?.getCenter();
      const lat = userLocation?.lat ?? (center ? center.lat() : selectedOrigin?.lat);
      const lng = userLocation?.lng ?? (center ? center.lng() : selectedOrigin?.lng);

      const res = await fetch(apiUrl('/api/maps/grounding'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          lat: typeof lat === 'number' && Number.isFinite(lat) ? lat : undefined,
          lng: typeof lng === 'number' && Number.isFinite(lng) ? lng : undefined,
          language: currentLang,
        }),
      });
      const data = await res.json();
      if (res.status === 429 || data?.code === 'QUOTA_EXHAUSTED') {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        setGroundingError(data?.error || txt('تم بلوغ حد الاستعلام المؤقت', 'Quota reached temporarily'));
        return;
      }
      if (!res.ok) {
        setGroundingError(data?.error || txt('تعذر إتمام البحث الجغرافي الآن', 'Discovery lookup failed'));
        return;
      }
      setGroundingAnswer(data.answer || '');
      setGroundedPlaces(Array.isArray(data.places) ? data.places : []);
    } catch {
      setGroundingError(txt('تعذر الاتصال بخدمة الخرائط الذكية', 'Could not reach Maps Discovery service'));
    } finally {
      setGroundingLoading(false);
    }
  };

  const jumpToSpot = (spot: OriginSpot) => {
    setSelectedSearchedPlace(null);
    setSelectedOrigin(spot);
    map?.panTo({ lat: spot.lat, lng: spot.lng });
    map?.setZoom(9);
  };

  return (
    <div className="space-y-5">
      {/* Top Search & Origin Quick-Jump Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-3">
        <form onSubmit={(e) => void handleTextSearchPlaces(e)} className="flex flex-col sm:flex-row gap-2.5 relative">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={txt('ابحث عن دار عطور، معمل تقطير، أو سوق بخور وزيوت…', 'Search perfumery houses, distilleries, oud markets…')}
              className="w-full ps-10 pe-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-amber-700 focus:bg-white"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full mt-1 inset-x-0 z-30 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={s.placePrediction?.placeId || i}
                    type="button"
                    onClick={() => void handleSelectSuggestion(s)}
                    className="w-full text-start px-3.5 py-2.5 text-xs hover:bg-amber-50 border-b last:border-b-0 border-stone-100 flex items-center gap-2 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="truncate font-medium text-stone-800">
                      {s.placePrediction?.text?.text || 'Place'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={searchingPlaces || !searchInput.trim()}
              className="px-4 py-2.5 bg-amber-800 hover:bg-amber-900 disabled:opacity-45 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {searchingPlaces ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>{txt('بحث الخريطة', 'Search Map')}</span>
            </button>

            <button
              type="button"
              onClick={handleLocateMe}
              className="px-3 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-stone-200 cursor-pointer shrink-0"
              title={txt('التمركز عند موقعي', 'Center near me')}
            >
              <LocateFixed className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">{txt('موقعي', 'Near Me')}</span>
            </button>
          </div>
        </form>

        {/* Curated Botanical Capitals Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          <span className="text-[11px] font-bold text-stone-500 shrink-0 flex items-center gap-1">
            <Flower2 className="w-3.5 h-3.5 text-amber-700" />
            <span>{txt('عواصم الخامات:', 'Origins:')}</span>
          </span>
          {CURATED_PERFUMERY_SPOTS.map((spot) => {
            const active = selectedOrigin?.id === spot.id;
            return (
              <button
                key={spot.id}
                type="button"
                onClick={() => jumpToSpot(spot)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  active
                    ? 'bg-amber-900 text-white border-amber-900 shadow-2xs'
                    : 'bg-stone-50 hover:bg-amber-50 text-stone-700 border-stone-200'
                }`}
              >
                {isAr ? spot.nameAr.split('—')[0].trim() : spot.nameEn.split('—')[0].trim()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Layout: Interactive Google Map + Grounded Perfumery Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
          <GoogleMapView
            defaultCenter={{ lat: 30.0, lng: 35.0 }}
            defaultZoom={3.5}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            gestureHandling="greedy"
            className="w-full h-[460px]"
          >
            {CURATED_PERFUMERY_SPOTS.map((spot) => (
              <AdvancedMarker
                key={spot.id}
                position={{ lat: spot.lat, lng: spot.lng }}
                onClick={() => {
                  setSelectedSearchedPlace(null);
                  setSelectedOrigin(spot);
                }}
              >
                <Pin
                  background={spot.category === 'house' ? '#92400e' : '#065f46'}
                  borderColor="#fef3c7"
                  glyphColor="#fef3c7"
                />
              </AdvancedMarker>
            ))}

            {searchedPlaces.map((p) => (
              <AdvancedMarker
                key={p.id}
                position={{ lat: p.lat, lng: p.lng }}
                onClick={() => {
                  setSelectedOrigin(null);
                  setSelectedSearchedPlace(p);
                }}
              >
                <Pin background="#1c1917" borderColor="#f59e0b" glyphColor="#f59e0b" />
              </AdvancedMarker>
            ))}

            {userLocation && (
              <AdvancedMarker position={userLocation}>
                <Pin background="#0284c7" borderColor="#e0f2fe" glyphColor="#ffffff" />
              </AdvancedMarker>
            )}

            {selectedOrigin && (
              <InfoWindow
                position={{ lat: selectedOrigin.lat, lng: selectedOrigin.lng }}
                onCloseClick={() => setSelectedOrigin(null)}
              >
                <div className="p-1 max-w-[240px] space-y-1.5 text-xs text-stone-900">
                  <div className="font-bold text-amber-950">
                    {isAr ? selectedOrigin.nameAr : selectedOrigin.nameEn}
                  </div>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    {isAr ? selectedOrigin.noteAr : selectedOrigin.noteEn}
                  </p>
                  <div className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded inline-block">
                    {txt('موسم الحصاد:', 'Harvest:')} {isAr ? selectedOrigin.harvestSeasonAr : selectedOrigin.harvestSeasonEn}
                  </div>
                </div>
              </InfoWindow>
            )}

            {selectedSearchedPlace && (
              <InfoWindow
                position={{ lat: selectedSearchedPlace.lat, lng: selectedSearchedPlace.lng }}
                onCloseClick={() => setSelectedSearchedPlace(null)}
              >
                <div className="p-1 max-w-[240px] space-y-1.5 text-xs text-stone-900">
                  <div className="font-bold text-stone-900">{selectedSearchedPlace.name}</div>
                  {selectedSearchedPlace.address && (
                    <p className="text-[11px] text-stone-600">{selectedSearchedPlace.address}</p>
                  )}
                  {typeof selectedSearchedPlace.rating === 'number' && (
                    <div className="text-[11px] font-semibold text-amber-700">★ {selectedSearchedPlace.rating.toFixed(1)}</div>
                  )}
                  {selectedSearchedPlace.googleMapsURI && (
                    <a
                      href={selectedSearchedPlace.googleMapsURI}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:underline"
                    >
                      <span>{txt('فتح في Google Maps', 'Open in Google Maps')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMapView>
        </div>

        {/* Maps Grounding & Regional Perfumery Guide */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-stone-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-amber-900 text-amber-300 flex items-center justify-center">
                  <Compass className="w-4.5 h-4.5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-stone-900">
                    {txt('الاستكشاف الجغرافي الموثق مع شاهين', 'Grounded Perfumery Discovery')}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {txt('اسأل عن متاجر العطور، معارض البخور، أو مناطق استخلاص الخامات', 'Discover boutiques, essence houses & botanical regions via Maps')}
                  </p>
                </div>
              </div>
            </div>

            {!isStaticHosting && (
              <div className="space-y-2.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={groundingQuery}
                    onChange={(e) => setGroundingQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleMapsGrounding();
                      }
                    }}
                    placeholder={txt('مثال: أين أجد أجود العطور الشرقية والعود في دبي؟', 'e.g., Best artisan perfumery boutiques in Paris or Riyadh?')}
                    className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-700"
                  />
                  <button
                    type="button"
                    disabled={groundingLoading || !groundingQuery.trim()}
                    onClick={() => void handleMapsGrounding()}
                    className="px-3.5 py-2 bg-stone-900 hover:bg-amber-900 disabled:opacity-45 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {groundingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{txt('استكشف', 'Explore')}</span>
                  </button>
                </div>

                {/* Preset Grounding Queries */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    txt('دور العطور والمتاحف في غراس فرنسا', 'Perfume museums & houses in Grasse'),
                    txt('أسواق العود والورد في الرياض أو دبي', 'Oud & Taif rose souks in Riyadh or Dubai'),
                    txt('متاجر الزيوت العطرية في وسط القاهرة', 'Essential oil attar shops in Cairo'),
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void handleMapsGrounding(q)}
                      disabled={groundingLoading}
                      className="px-2.5 py-1 rounded-lg bg-amber-50/80 hover:bg-amber-100 border border-amber-200 text-amber-950 text-[10px] font-semibold cursor-pointer transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {groundingError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {groundingError}
              </div>
            )}

            {groundingAnswer ? (
              <div className="space-y-3 max-h-[260px] overflow-y-auto pe-1">
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-800 leading-relaxed whitespace-pre-line">
                  {groundingAnswer}
                </div>

                {groundedPlaces.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-stone-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-700" />
                      <span>{txt('أماكن موثقة على Google Maps:', 'Verified Places on Google Maps:')}</span>
                    </div>
                    <div className="space-y-1.5">
                      {groundedPlaces.map((pl, idx) => (
                        <a
                          key={`${pl.uri}-${idx}`}
                          href={pl.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-2.5 rounded-xl border border-amber-200/80 bg-amber-50/50 hover:bg-amber-100/70 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-bold text-amber-950">
                            <span className="truncate">{pl.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          </div>
                          {pl.reviewSnippets && pl.reviewSnippets.length > 0 && (
                            <p className="text-[10px] text-stone-600 mt-1 line-clamp-2">
                              “{pl.reviewSnippets[0]}”
                            </p>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : selectedOrigin ? (
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-amber-950 text-sm">
                    {isAr ? selectedOrigin.nameAr : selectedOrigin.nameEn}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-[10px] font-bold text-amber-900">
                    {isAr ? selectedOrigin.countryAr : selectedOrigin.countryEn}
                  </span>
                </div>
                <p className="text-stone-700 leading-relaxed">
                  {isAr ? selectedOrigin.noteAr : selectedOrigin.noteEn}
                </p>
                <div className="pt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-emerald-800">
                    {txt('الموسم:', 'Season:')} {isAr ? selectedOrigin.harvestSeasonAr : selectedOrigin.harvestSeasonEn}
                  </span>
                  {onAskShaheenPrompt && (
                    <button
                      type="button"
                      onClick={() =>
                        onAskShaheenPrompt(
                          isAr
                            ? `اشرح لي الخصائص العطرية وطريقة استخدام خامات منطقة ${selectedOrigin.nameAr.split('—')[0]} في تركيب عطر فاخر.`
                            : `Explain the olfactory profile and compounding dosage for ingredients sourced from ${selectedOrigin.nameEn}.`,
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-amber-900 text-white text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      {txt('استشر شاهين عن هذه الخامة', 'Ask Shahin about this origin')}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-500">
            <span className="flex items-center gap-1">
              <Store className="w-3 h-3 text-amber-700" />
              <span>{txt('مدعوم ببيانات Google Maps', 'Powered by Google Maps')}</span>
            </span>
            <span>{txt('اختر أي معلم على الخريطة للتفاصيل', 'Click any pin for origin specs')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface PerfumeAtlasMapProps {
  currentLang: SupportedLanguage;
  onAskShaheenPrompt?: (prompt: string) => void;
}

export const PerfumeAtlasMap: React.FC<PerfumeAtlasMapProps> = ({
  currentLang,
  onAskShaheenPrompt,
}) => {
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const [mapsApiKey, setMapsApiKey] = useState<string>(envKey);
  const [configLoaded, setConfigLoaded] = useState<boolean>(Boolean(envKey));

  useEffect(() => {
    if (envKey) {
      setMapsApiKey(envKey);
      setConfigLoaded(true);
      return;
    }
    if (isStaticHosting) {
      setConfigLoaded(true);
      return;
    }
    let cancelled = false;
    fetch(apiUrl('/api/maps/config'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.apiKey) {
          setMapsApiKey(String(data.apiKey).trim());
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setConfigLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [envKey]);

  const isAr = currentLang === 'ar';
  const txt = (ar: string, en: string) => pickArEn(currentLang, ar, en);

  return (
    <section className="space-y-5 animate-in fade-in">
      <div className="bg-gradient-to-br from-stone-900 via-amber-950 to-stone-900 text-white rounded-3xl p-6 border border-amber-700/30 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[11px] font-bold">
            <Compass className="w-3.5 h-3.5" />
            <span>{txt('أطلس العطور والخامات العالمية', 'World Perfumery & Botanical Atlas')}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-serif-luxury">
            {txt('خريطة مواطن العطور النبيلة ودور الاستخلاص', 'Interactive Map of Fragrance Capitals & Suppliers')}
          </h2>
          <p className="text-xs text-stone-300 max-w-2xl">
            {txt(
              'استكشف مواطن الورد الشامي والطائفي واللبان الحوجري وغراس، وابحث عن أي مدينة أو دار عطور عبر Google Maps.',
              'Explore Grasse, Damascus, Taif, Salalah & Kannauj or search live boutiques and botanical suppliers on Google Maps.',
            )}
          </p>
        </div>
      </div>

      {!configLoaded ? (
        <div className="bg-white rounded-3xl border border-stone-200 h-[420px] flex items-center justify-center gap-2 text-xs text-stone-500">
          <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
          <span>{txt('جاري تهيئة أطلس الخرائط…', 'Initializing interactive map…')}</span>
        </div>
      ) : mapsApiKey ? (
        <APIProvider
          apiKey={mapsApiKey}
          language={isAr ? 'ar' : 'en'}
          region={isAr ? 'EG' : 'US'}
        >
          <InnerPerfumeAtlas
            currentLang={currentLang}
            onAskShaheenPrompt={onAskShaheenPrompt}
          />
        </APIProvider>
      ) : (
        <div className="bg-white rounded-3xl border border-amber-200 p-6 space-y-5 shadow-xs">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950">
            {txt(
              'مفتاح Google Maps Platform للواجهة الأمامية (VITE_GOOGLE_MAPS_API_KEY) غير مضاف في بيئة التشغيل الحالية. يمكنك استعراض دليل المواطن العطرية أدناه:',
              'Browser Maps key (VITE_GOOGLE_MAPS_API_KEY) is not present in the current runtime environment. Browse the curated perfumery origins below:',
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CURATED_PERFUMERY_SPOTS.map((spot) => (
              <div key={spot.id} className="p-4 rounded-2xl border border-stone-200 bg-stone-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-stone-900">
                    {isAr ? spot.nameAr : spot.nameEn}
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {isAr ? spot.noteAr : spot.noteEn}
                </p>
                <div className="text-[11px] font-semibold text-amber-800">
                  {txt('موسم الحصاد:', 'Harvest:')} {isAr ? spot.harvestSeasonAr : spot.harvestSeasonEn}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
