/**
 * «خريطة الدول الحرارية الملونة + رصد أماكن دخول الزوار بدقة داخل كل دولة»
 *
 * Interactive global country-by-country colored thermal map:
 *   - Draws 182 real Natural Earth country border polygons (`WORLD_COUNTRY_POLYGONS`), separating every
 *     country from its neighbors with a distinct thermal color (`countryPolygonStyle`).
 *   - Plots exact city/governorate visitor entry pinpoints (`byPlace` + `liveNow.activePlaces`) at their real
 *     `[lat, lon]` coordinates inside each country, with smart country-bbox zoom (`up to 7x`) and full sub-country
 *     entry inspection.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Crosshair, Flame, Globe, MapPin, Palette, Radio, Search, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import { T, TP, adminLocale, formatAdminNumber, getAdminLang, useAdminLanguage } from './adminL10n';
import { COUNTRY_POLYGON_MAP, WORLD_COUNTRY_POLYGONS } from '../data/worldCountryPolygons';
import {
  HEAT_COLORS,
  WORLD_REGIONS,
  countryPolygonStyle,
  enrichCountries,
  enrichPlaces,
  projectWorldPoint,
  worldAtlasPoints,
  type CensusLiveNow,
  type CensusReport,
  type EnrichedCountryStat,
  type EnrichedPlaceStat,
  type HeatLevel,
  type WorldRegionId,
} from '../utils/platformCensus';

const W = 1000;
const H = 500;

const GRATICULE_LATS = [-45, -30, -15, 0, 15, 30, 45, 60];
const GRATICULE_LONS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];

const AMBIENT_REGION_HUBS: Array<{
  id: string;
  lat: number;
  lon: number;
  ar: string;
  en: string;
  tone: 'amber' | 'cyan' | 'emerald';
}> = [
  { id: 'arab', lat: 26, lon: 36, ar: 'العالم العربي', en: 'Arab World', tone: 'amber' },
  { id: 'europe', lat: 50, lon: 14, ar: 'أوروبا', en: 'Europe', tone: 'cyan' },
  { id: 'asia', lat: 34, lon: 103, ar: 'آسيا', en: 'Asia', tone: 'emerald' },
  { id: 'americas', lat: 36, lon: -92, ar: 'الأمريكتان', en: 'Americas', tone: 'cyan' },
  { id: 'africa', lat: 2, lon: 21, ar: 'أفريقيا', en: 'Africa', tone: 'emerald' },
  { id: 'oceania', lat: -25, lon: 135, ar: 'أوقيانوسيا', en: 'Oceania', tone: 'cyan' },
];

export interface WorldHeatmapSvgLayerProps {
  report: CensusReport;
  liveNow?: CensusLiveNow;
  width?: number;
  height?: number;
  theme?: 'dark' | 'light';
  idPrefix?: string;
  showLabels?: boolean;
  still?: boolean;
}

/**
 * Non-interactive SVG `<g>` layer projecting all 182 colored country polygons, borders,
 * thermal heat clouds, and exact city entry pinpoints into the background of «خريطة التشغيل».
 */
export function WorldHeatmapSvgLayer({
  report,
  liveNow,
  width = W,
  height = H,
  theme = 'dark',
  idPrefix = 'bg-hm',
  showLabels = true,
  still = false,
}: WorldHeatmapSvgLayerProps) {
  const isAr = getAdminLang() === 'ar';
  const points = useMemo(() => worldAtlasPoints(report, 'total'), [report]);
  const statByCode = useMemo(() => new Map(points.map((p) => [p.code, p])), [points]);
  const activePoints = useMemo(() => points.filter((p) => p.heatLevel !== 'none'), [points]);
  const entryPlaces = useMemo(() => enrichPlaces(report, { mode: 'total' }), [report]);

  const scaleX = width / W;
  const targetH = Math.min(height, width * 0.58);
  const scaleY = targetH / H;
  const offsetY = (height - targetH) * 0.45;
  const isDark = theme === 'dark';
  const gridStroke = isDark ? '#38bdf8' : '#94a3b8';

  return (
    <g pointerEvents="none" aria-hidden="true">
      <defs>
        <filter id={`${idPrefix}-blur`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <radialGradient id={`${idPrefix}-grad-low`}>
          <stop offset="0%" stopColor="#06b6d4" stopOpacity={isDark ? '0.68' : '0.45'} />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${idPrefix}-grad-warm`}>
          <stop offset="0%" stopColor="#10b981" stopOpacity={isDark ? '0.74' : '0.50'} />
          <stop offset="60%" stopColor="#06b6d4" stopOpacity={isDark ? '0.30' : '0.20'} />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${idPrefix}-grad-hot`}>
          <stop offset="0%" stopColor="#f59e0b" stopOpacity={isDark ? '0.82' : '0.55'} />
          <stop offset="55%" stopColor="#10b981" stopOpacity={isDark ? '0.36' : '0.22'} />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${idPrefix}-grad-blazing`}>
          <stop offset="0%" stopColor="#ef4444" stopOpacity={isDark ? '0.90' : '0.62'} />
          <stop offset="45%" stopColor="#f59e0b" stopOpacity={isDark ? '0.55' : '0.38'} />
          <stop offset="80%" stopColor="#10b981" stopOpacity={isDark ? '0.24' : '0.16'} />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform={`translate(0, ${offsetY.toFixed(1)}) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`}>
        {/* Latitude / Longitude Graticule */}
        <g stroke={gridStroke} strokeWidth={0.65} strokeDasharray="3 5" opacity={isDark ? 0.30 : 0.42}>
          {GRATICULE_LATS.map((lat) => {
            const { y } = projectWorldPoint(lat, 0, W, H);
            return (
              <line
                key={`bg-lat-${lat}`}
                x1={0}
                y1={y}
                x2={W}
                y2={y}
                strokeWidth={lat === 0 ? 1.05 : 0.65}
                strokeDasharray={lat === 0 ? undefined : '3 5'}
              />
            );
          })}
          {GRATICULE_LONS.map((lon) => {
            const { x } = projectWorldPoint(0, lon, W, H);
            return <line key={`bg-lon-${lon}`} x1={x} y1={0} x2={x} y2={H} />;
          })}
        </g>

        {/* All 182 Countries Individually Colored & Border-Separated */}
        <g>
          {WORLD_COUNTRY_POLYGONS.map((poly) => {
            const st = statByCode.get(poly.code);
            const visits = st?.visits ?? 0;
            const intensity = st?.intensity ?? 0;
            const style = countryPolygonStyle({
              slot: poly.slot,
              intensity,
              visits,
              separateAllCountries: true,
              theme,
            });
            return (
              <path
                key={`bg-poly-${poly.code}`}
                d={poly.d}
                fill={style.fill}
                fillOpacity={style.fillOpacity}
                stroke={isDark ? '#020617' : '#ffffff'}
                strokeWidth={visits > 0 ? 0.9 : 0.6}
                strokeLinejoin="round"
              />
            );
          })}
        </g>

        {/* Thermal Glow Clouds over Active Countries */}
        <g filter={`url(#${idPrefix}-blur)`}>
          {activePoints.map((c) => (
            <circle
              key={`bg-cloud-${c.code}`}
              cx={c.x}
              cy={c.y}
              r={26 + c.intensity * 40}
              fill={`url(#${idPrefix}-grad-${c.heatLevel})`}
            />
          ))}
        </g>

        {/* Exact City / Governorate Entry Pinpoints Inside Countries */}
        <g>
          {entryPlaces.slice(0, 40).map((pl) => (
            <g key={`bg-place-${pl.id}`} transform={`translate(${pl.x}, ${pl.y})`}>
              {!still && pl.todayVisits > 0 && (
                <circle r={6} fill="none" stroke="#fef08a" strokeWidth={1.1} opacity={0.85}>
                  <animate attributeName="r" values="3;13" dur="2.3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0" dur="2.3s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={2.8} fill="#fef08a" stroke="#dc2626" strokeWidth={1} />
              {showLabels && pl.rank <= 8 && (
                <text
                  y={-6}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight="800"
                  fill="#fef9c3"
                  stroke="#020617"
                  strokeWidth={2.3}
                  paintOrder="stroke"
                >
                  {isAr ? pl.cityAr : pl.cityEn} ({formatAdminNumber(pl.visits)})
                </text>
              )}
            </g>
          ))}
        </g>

        {/* Live Active Visitors Right Now Pinpoints */}
        {liveNow && liveNow.activePlaces.length > 0 && (
          <g>
            {liveNow.activePlaces.map((ap) => {
              const pt = projectWorldPoint(ap.lat, ap.lon, W, H);
              return (
                <g key={`bg-live-${ap.placeId}`} transform={`translate(${pt.x}, ${pt.y})`}>
                  {!still && (
                    <circle r={8} fill="none" stroke="#4ade80" strokeWidth={1.4}>
                      <animate attributeName="r" values="4;18" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="1;0" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle r={3.4} fill="#22c55e" stroke="#ffffff" strokeWidth={1} />
                </g>
              );
            })}
          </g>
        )}

        {/* Regional Radar Labels when 0 visits */}
        {activePoints.length === 0 && (
          <g>
            {AMBIENT_REGION_HUBS.map((hub) => {
              const p = projectWorldPoint(hub.lat, hub.lon, W, H);
              const ringColor = hub.tone === 'amber' ? '#fbbf24' : hub.tone === 'emerald' ? '#34d399' : '#38bdf8';
              return (
                <g key={`bg-hub-${hub.id}`} transform={`translate(${p.x}, ${p.y})`}>
                  {!still && (
                    <circle r={12} fill="none" stroke={ringColor} strokeWidth={1.1} opacity={0.65}>
                      <animate attributeName="r" values="7;26" dur={hub.id === 'arab' ? '3.2s' : '4.4s'} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.75;0" dur={hub.id === 'arab' ? '3.2s' : '4.4s'} repeatCount="indefinite" />
                    </circle>
                  )}
                  {showLabels && (
                    <text
                      y={14}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight="800"
                      fill={hub.tone === 'amber' ? '#fde68a' : '#e0f2fe'}
                      stroke="#020617"
                      strokeWidth={2.6}
                      paintOrder="stroke"
                    >
                      {isAr ? hub.ar : hub.en}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}
      </g>
    </g>
  );
}

/**
 * Full-bleed fixed ambient Colored World Countries Heatmap background for «صفحة خريطة التشغيل» (`#ops` / `#admin/ops`).
 */
export function WorldHeatmapPageBackdrop({ report, liveNow }: { report: CensusReport; liveNow?: CensusLiveNow }) {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
      data-testid="ops-world-heatmap-backdrop"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#040d1d] via-[#071830] to-[#040d1d]" />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full opacity-95"
      >
        <WorldHeatmapSvgLayer
          report={report}
          liveNow={liveNow}
          width={W}
          height={H}
          theme="dark"
          idPrefix="page-ops-hm"
          showLabels
        />
      </svg>
      <div className="absolute inset-0 bg-radial from-transparent via-[#040d1d]/10 to-[#040d1d]/55" />
    </div>
  );
}

export interface WorldVisitHeatmapProps {
  report: CensusReport;
  liveNow?: CensusLiveNow;
  selectedCountry?: string | null;
  onSelectCountry?: (code: string | null) => void;
}

export default function WorldVisitHeatmap({
  report,
  liveNow,
  selectedCountry,
  onSelectCountry,
}: WorldVisitHeatmapProps) {
  useAdminLanguage();
  const isAr = getAdminLang() === 'ar';

  const [metricMode, setMetricMode] = useState<'total' | 'today'>('total');
  const [separateColors, setSeparateColors] = useState<boolean>(true);
  const [showEntryPinpoints, setShowEntryPinpoints] = useState<boolean>(true);
  const [regionFilter, setRegionFilter] = useState<WorldRegionId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [hoveredPlace, setHoveredPlace] = useState<EnrichedPlaceStat | null>(null);
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  // Viewport pan & zoom (`center x, center y, zoom factor up to 7x for exact city pinpoints inside countries`)
  const [view, setView] = useState<{ cx: number; cy: number; zoom: number }>({ cx: W / 2, cy: H / 2, zoom: 1 });
  const dragRef = useRef<{ startX: number; startY: number; cx: number; cy: number } | null>(null);

  const activeSelected = selectedCountry !== undefined ? selectedCountry : internalSelected;
  const selectCode = (code: string | null) => {
    setInternalSelected(code);
    onSelectCountry?.(code);
  };

  const allAtlasCountries = useMemo(() => worldAtlasPoints(report, metricMode), [report, metricMode]);
  const statByCode = useMemo(() => new Map(allAtlasCountries.map((c) => [c.code, c])), [allAtlasCountries]);
  const activeCountries = useMemo(() => enrichCountries(report, metricMode), [report, metricMode]);
  const allPlaces = useMemo(() => enrichPlaces(report, { mode: metricMode }), [report, metricMode]);

  const searchNormalized = search.trim().toLowerCase();
  const matchingCodes = useMemo(() => {
    if (!searchNormalized && regionFilter === 'all') return null;
    const set = new Set<string>();
    for (const c of allAtlasCountries) {
      if (regionFilter !== 'all' && c.region !== regionFilter) continue;
      if (
        !searchNormalized ||
        c.code.toLowerCase().includes(searchNormalized) ||
        c.nameAr.toLowerCase().includes(searchNormalized) ||
        c.nameEn.toLowerCase().includes(searchNormalized)
      ) {
        set.add(c.code);
      }
    }
    // Also match city names inside countries!
    if (searchNormalized) {
      for (const p of allPlaces) {
        if (
          p.cityAr.toLowerCase().includes(searchNormalized) ||
          p.cityEn.toLowerCase().includes(searchNormalized) ||
          (p.regionAr && p.regionAr.toLowerCase().includes(searchNormalized))
        ) {
          set.add(p.country);
        }
      }
    }
    return set;
  }, [allAtlasCountries, allPlaces, regionFilter, searchNormalized]);

  const inspectedCountry: EnrichedCountryStat | null = useMemo(() => {
    const target = hoveredPlace?.country || hoveredCode || activeSelected;
    if (!target) return activeCountries[0] || null;
    return statByCode.get(target) || null;
  }, [hoveredPlace, hoveredCode, activeSelected, statByCode, activeCountries]);

  const inspectedCountryPlaces = useMemo(() => {
    if (!inspectedCountry) return [];
    return enrichPlaces(report, { country: inspectedCountry.code, mode: metricMode });
  }, [report, inspectedCountry, metricMode]);

  const clampView = (cx: number, cy: number, zoom: number) => {
    const z = Math.max(1, Math.min(7, zoom));
    const halfW = W / (2 * z);
    const halfH = H / (2 * z);
    return {
      cx: Math.max(halfW, Math.min(W - halfW, cx)),
      cy: Math.max(halfH, Math.min(H - halfH, cy)),
      zoom: z,
    };
  };

  const applyRegionZoom = (reg: WorldRegionId | 'all') => {
    setRegionFilter(reg);
    if (reg === 'all') {
      setView({ cx: W / 2, cy: H / 2, zoom: 1 });
    } else {
      const v = WORLD_REGIONS[reg].view;
      setView(clampView(v.x, v.y, v.zoom));
    }
  };

  /** Zooms directly to fit a country's real polygon bounding box so all cities inside it are clearly visible. */
  const focusCountry = (code: string) => {
    selectCode(code);
    const poly = COUNTRY_POLYGON_MAP.get(code);
    if (poly) {
      const [minX, minY, maxX, maxY] = poly.bbox;
      const bw = Math.max(16, maxX - minX);
      const bh = Math.max(12, maxY - minY);
      const fitZoom = Math.min(6.2, Math.max(2.2, Math.min((W * 0.62) / bw, (H * 0.62) / bh)));
      setView(clampView((minX + maxX) / 2, (minY + maxY) / 2, fitZoom));
      return;
    }
    const st = statByCode.get(code);
    if (st) setView(clampView(st.x, st.y, 3.6));
  };

  const focusPlace = (pl: EnrichedPlaceStat) => {
    selectCode(pl.country);
    setHoveredPlace(pl);
    setView(clampView(pl.x, pl.y, 5.2));
  };

  const viewBoxStr = useMemo(() => {
    const vw = W / view.zoom;
    const vh = H / view.zoom;
    const vx = view.cx - vw / 2;
    const vy = view.cy - vh / 2;
    return `${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`;
  }, [view]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (view.zoom <= 1) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, cx: view.cx, cy: view.cy };
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.startX) / Math.max(1, rect.width)) * (W / view.zoom);
    const dy = ((e.clientY - dragRef.current.startY) / Math.max(1, rect.height)) * (H / view.zoom);
    setView((prev) => clampView(dragRef.current!.cx - dx, dragRef.current!.cy - dy, prev.zoom));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const invZoom = 1 / Math.sqrt(view.zoom);
  const precisionBadge = (p: EnrichedPlaceStat['precision']) => {
    if (p === 'edge-coords') return T('إحداثيات حية دقيقة');
    if (p === 'edge-city') return T('رصد المدينة');
    if (p === 'timezone') return T('نطاق التوقيت');
    return T('مركز الدولة');
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xl overflow-hidden">
      {/* Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 bg-slate-900/80 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 via-red-500/20 to-cyan-500/20 border border-amber-400/30">
            <Flame className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-amber-100 flex items-center gap-2">
              {T('خريطة دول العالم الملونة ورصد نقاط الدخول الدقيقة')}
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                {T('182 دولة مفصولة + رصد المدن')}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {T('كل دولة مفصولة بحدودها ولونها الحراري — اضغط على أي دولة لتقريبها ورؤية المدن وأماكن دخول كل زائر بداخلها بالضبط')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setMetricMode('total')}
              className={`rounded-lg px-2.5 py-1 font-bold transition ${
                metricMode === 'total' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              {T('الإجمالي التراكمي')}
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('today')}
              className={`rounded-lg px-2.5 py-1 font-bold transition ${
                metricMode === 'today' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              {T('زيارات اليوم')}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSeparateColors((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 font-semibold transition ${
              separateColors
                ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            {separateColors ? T('فصل ألوان الدول: مفعّل') : T('تلوين الدول النشطة فقط')}
          </button>

          <button
            type="button"
            onClick={() => setShowEntryPinpoints((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 font-semibold transition ${
              showEntryPinpoints
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" />
            {showEntryPinpoints ? T('نقاط دخول المدن: ظاهرة') : T('نقاط دخول المدن: مخفية')}
          </button>
        </div>
      </div>

      {/* Region Quick-Zoom & Country/City Search */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 bg-slate-950/90 px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => applyRegionZoom('all')}
            className={`rounded-lg px-2.5 py-1 font-bold transition ${
              regionFilter === 'all' ? 'bg-slate-100 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {T('🌍 العالم كله')}
          </button>
          {(Object.keys(WORLD_REGIONS) as WorldRegionId[]).map((reg) => {
            const count = report.byRegion[reg]?.visits ?? 0;
            return (
              <button
                key={reg}
                type="button"
                onClick={() => applyRegionZoom(reg)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition flex items-center gap-1 ${
                  regionFilter === reg ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{isAr ? WORLD_REGIONS[reg].ar : WORLD_REGIONS[reg].en}</span>
                {count > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] ${regionFilter === reg ? 'bg-slate-950/20' : 'bg-slate-800 text-amber-300'}`}>
                    {formatAdminNumber(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={T('ابحث عن دولة أو مدينة دخول…')}
              className="w-48 sm:w-60 rounded-xl border border-slate-800 bg-slate-900 ps-8 pe-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-0.5">
            <button
              type="button"
              title={T('تقريب الخريطة')}
              onClick={() => setView((v) => clampView(v.cx, v.cy, v.zoom * 1.45))}
              className="rounded-lg p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title={T('تبعيد الخريطة')}
              onClick={() => setView((v) => clampView(v.cx, v.cy, v.zoom / 1.45))}
              className="rounded-lg p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title={T('إعادة ضبط عرض العالم')}
              onClick={() => {
                setView({ cx: W / 2, cy: H / 2, zoom: 1 });
                selectCode(null);
                setHoveredPlace(null);
              }}
              className="rounded-lg p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Globe className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main SVG Colored Country Map Canvas */}
      <div className="relative bg-[#030b18] select-none">
        <svg
          viewBox={viewBoxStr}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className={`w-full h-auto block max-h-[540px] ${view.zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
          role="img"
          aria-label={T('خريطة دول العالم الملونة ورصد نقاط الدخول الدقيقة')}
        >
          <defs>
            <radialGradient id="oceanGlowInteractive" cx="50%" cy="45%" r="65%">
              <stop offset="0%" stopColor="#091d38" />
              <stop offset="100%" stopColor="#020813" />
            </radialGradient>
            <filter id="heatCloudBlurInteractive" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <radialGradient id="heatGrad-low">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heatGrad-warm">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.62" />
              <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heatGrad-hot">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.72" />
              <stop offset="55%" stopColor="#10b981" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heatGrad-blazing">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.82" />
              <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.44" />
              <stop offset="80%" stopColor="#10b981" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Deep Ocean Backdrop */}
          <rect x={0} y={0} width={W} height={H} fill="url(#oceanGlowInteractive)" />

          {/* Latitude / Longitude Graticule */}
          <g stroke="#1e3a5f" strokeWidth={0.5 * invZoom} strokeDasharray="3 4" opacity={0.45}>
            {GRATICULE_LATS.map((lat) => {
              const { y } = projectWorldPoint(lat, 0, W, H);
              return (
                <line
                  key={`lat-${lat}`}
                  x1={0}
                  y1={y}
                  x2={W}
                  y2={y}
                  stroke={lat === 0 ? '#38bdf8' : '#1e3a5f'}
                  strokeOpacity={lat === 0 ? 0.55 : 0.45}
                />
              );
            })}
            {GRATICULE_LONS.map((lon) => {
              const { x } = projectWorldPoint(0, lon, W, H);
              return <line key={`lon-${lon}`} x1={x} y1={0} x2={x} y2={H} />;
            })}
          </g>

          {/* 182 Individual Country Border Polygons — Each Colored Separately */}
          <g>
            {WORLD_COUNTRY_POLYGONS.map((poly) => {
              const st = statByCode.get(poly.code);
              const visits = st ? (metricMode === 'today' ? st.todayVisits : st.visits) : 0;
              const intensity = st?.intensity ?? 0;
              const isSelected = activeSelected === poly.code;
              const isHovered = hoveredCode === poly.code;
              const dimmed = matchingCodes !== null && !matchingCodes.has(poly.code);

              const style = countryPolygonStyle({
                slot: poly.slot,
                intensity,
                visits,
                separateAllCountries: separateColors,
                theme: 'dark',
              });

              return (
                <path
                  key={`country-poly-${poly.code}`}
                  d={poly.d}
                  fill={isSelected ? '#f59e0b' : isHovered ? '#38bdf8' : style.fill}
                  fillOpacity={dimmed ? 0.18 : isSelected || isHovered ? 0.92 : style.fillOpacity}
                  stroke={isSelected ? '#fef08a' : isHovered ? '#e0f2fe' : visits > 0 ? style.stroke : '#020617'}
                  strokeWidth={(isSelected ? 1.8 : isHovered ? 1.3 : visits > 0 ? 0.95 : 0.65) * invZoom}
                  strokeLinejoin="round"
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={() => setHoveredCode(poly.code)}
                  onMouseLeave={() => setHoveredCode((prev) => (prev === poly.code ? null : prev))}
                  onClick={(e) => {
                    e.stopPropagation();
                    focusCountry(poly.code);
                  }}
                >
                  <title>
                    {`${st ? (isAr ? st.nameAr : st.nameEn) : poly.code} — ${formatAdminNumber(visits)} ${T('زيارة')}`}
                  </title>
                </path>
              );
            })}
          </g>

          {/* Soft Thermal Glow over Visited Countries */}
          <g filter="url(#heatCloudBlurInteractive)" pointerEvents="none">
            {activeCountries.map((c) => (
              <circle
                key={`cloud-${c.code}`}
                cx={c.x}
                cy={c.y}
                r={20 + c.intensity * 34}
                fill={`url(#heatGrad-${c.heatLevel})`}
              />
            ))}
          </g>

          {/* Country Name Labels on Active / Selected / Zoomed Countries */}
          <g pointerEvents="none">
            {WORLD_COUNTRY_POLYGONS.map((poly) => {
              const st = statByCode.get(poly.code);
              if (!st) return null;
              const isSelected = activeSelected === poly.code || hoveredCode === poly.code;
              const showCountryLabel =
                isSelected ||
                (st.visits > 0 && st.rank <= 12) ||
                (view.zoom >= 2.2 && (!matchingCodes || matchingCodes.has(poly.code)));
              if (!showCountryLabel) return null;
              return (
                <text
                  key={`clabel-${poly.code}`}
                  x={poly.cx}
                  y={poly.cy}
                  textAnchor="middle"
                  fontSize={(isSelected ? 10.5 : 8.5) * invZoom}
                  fontWeight="800"
                  fill={st.visits > 0 || isSelected ? '#fef9c3' : '#e2e8f0'}
                  stroke="#020617"
                  strokeWidth={2.4 * invZoom}
                  paintOrder="stroke"
                  opacity={st.visits > 0 || isSelected ? 0.98 : 0.78}
                >
                  {isAr ? st.nameAr : st.nameEn}
                  {st.visits > 0 ? ` (${formatAdminNumber(metricMode === 'today' ? st.todayVisits : st.visits)})` : ''}
                </text>
              );
            })}
          </g>

          {/* Exact Sub-Country Visitor Entry Pinpoints (Cities & Governorates Inside Each Country) */}
          {showEntryPinpoints && (
            <g>
              {allPlaces.map((pl) => {
                const dimmed = matchingCodes !== null && !matchingCodes.has(pl.country);
                if (dimmed) return null;
                const isInspected = hoveredPlace?.id === pl.id;
                const pinR = (isInspected ? 5.2 : 3.4 + pl.intensity * 3.2) * invZoom;
                const showCityLabel =
                  isInspected ||
                  activeSelected === pl.country ||
                  view.zoom >= 2.0 ||
                  pl.rank <= 10;

                return (
                  <g
                    key={`place-pin-${pl.id}`}
                    transform={`translate(${pl.x}, ${pl.y})`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPlace(pl)}
                    onMouseLeave={() => setHoveredPlace((prev) => (prev?.id === pl.id ? null : prev))}
                    onClick={(e) => {
                      e.stopPropagation();
                      focusPlace(pl);
                    }}
                  >
                    {pl.todayVisits > 0 && (
                      <circle r={pinR * 2.1} fill="none" stroke="#fef08a" strokeWidth={1.1 * invZoom}>
                        <animate
                          attributeName="r"
                          values={`${pinR.toFixed(1)};${(pinR * 3.1).toFixed(1)}`}
                          dur="2.2s"
                          repeatCount="indefinite"
                        />
                        <animate attributeName="opacity" values="0.9;0" dur="2.2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {/* Precision Target Reticle */}
                    <line x1={-pinR * 1.6} y1={0} x2={pinR * 1.6} y2={0} stroke="#fef08a" strokeWidth={0.85 * invZoom} />
                    <line x1={0} y1={-pinR * 1.6} x2={0} y2={pinR * 1.6} stroke="#fef08a" strokeWidth={0.85 * invZoom} />
                    <circle
                      r={pinR}
                      fill={pl.heatLevel === 'blazing' ? '#ef4444' : '#f59e0b'}
                      stroke="#fef9c3"
                      strokeWidth={1.2 * invZoom}
                    />
                    <circle r={pinR * 0.36} fill="#ffffff" />

                    {showCityLabel && (
                      <text
                        y={-(pinR + 4 * invZoom)}
                        textAnchor="middle"
                        fontSize={8.8 * invZoom}
                        fontWeight="800"
                        fill="#ffffff"
                        stroke="#020617"
                        strokeWidth={2.4 * invZoom}
                        paintOrder="stroke"
                      >
                        {`📍 ${isAr ? pl.cityAr : pl.cityEn} (${formatAdminNumber(metricMode === 'today' ? pl.todayVisits : pl.visits)})`}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Real-Time Active Visitors Online Right Now («العداد اللحظي») */}
              {liveNow?.activePlaces.map((ap) => {
                const pt = projectWorldPoint(ap.lat, ap.lon, W, H);
                return (
                  <g key={`live-pin-${ap.placeId}`} transform={`translate(${pt.x}, ${pt.y})`} pointerEvents="none">
                    <circle r={7 * invZoom} fill="none" stroke="#4ade80" strokeWidth={1.5 * invZoom}>
                      <animate
                        attributeName="r"
                        values={`${(3.5 * invZoom).toFixed(1)};${(16 * invZoom).toFixed(1)}`}
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                      <animate attributeName="opacity" values="1;0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <circle r={3.2 * invZoom} fill="#22c55e" stroke="#ffffff" strokeWidth={1 * invZoom} />
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {/* Zero-Visit Honest Ready Banner */}
        {report.totals.visits === 0 && (
          <div className="pointer-events-none absolute bottom-3 inset-x-3 sm:inset-x-auto sm:start-3 sm:max-w-lg rounded-2xl border border-amber-400/30 bg-slate-950/90 backdrop-blur-md px-3.5 py-2.5 text-xs text-slate-200 shadow-lg">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>{T('خريطة الـ 182 دولة ملونة وجاهزة — 0 زيارة مسجلة حالياً')}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              {T('كل دولة مرسومة بحدودها المستقلة ولونها المميز بدون أي أرقام وهمية. فور دخول أي زائر حقيقي ستظهر نقطة مدينته ومحافظته وإحداثياته هنا لحظياً.')}
            </p>
          </div>
        )}

        {/* Live Online Badge on Map Corner */}
        {liveNow && (
          <div className="pointer-events-none absolute top-3 end-3 rounded-xl border border-emerald-400/40 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 text-xs shadow-lg flex items-center gap-2">
            <Radio className={`h-3.5 w-3.5 ${liveNow.activeVisitors > 0 ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
            <span className="font-bold text-emerald-300">
              {TP('متواجدون الآن لحظياً: {n}', { n: formatAdminNumber(liveNow.activeVisitors) })}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Legend + Selected Country & Exact Sub-Country Cities Inspector */}
      <div className="border-t border-slate-800 bg-slate-900/85 p-4 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-400">{T('مقياس الحرارة اللوني للدول:')}</span>
            {(['none', 'low', 'warm', 'hot', 'blazing'] as HeatLevel[]).map((lvl) => (
              <span key={lvl} className="inline-flex items-center gap-1.5 text-slate-300">
                <span
                  className="h-3 w-3 rounded-sm border border-white/25"
                  style={{ backgroundColor: HEAT_COLORS[lvl].fill }}
                />
                <span>{isAr ? HEAT_COLORS[lvl].ar : HEAT_COLORS[lvl].en}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-amber-200 font-semibold">
              <MapPin className="h-3.5 w-3.5 text-amber-400" />
              {T('علامة الاستهداف = مكان دخول الزائر داخل الدولة')}
            </span>
          </div>

          {activeSelected && (
            <button
              type="button"
              onClick={() => {
                selectCode(null);
                setHoveredPlace(null);
                setView({ cx: W / 2, cy: H / 2, zoom: 1 });
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 font-bold text-amber-200 hover:bg-slate-700"
            >
              {T('إلغاء تحديد الدولة وعرض العالم')}
            </button>
          )}
        </div>

        {inspectedCountry ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{inspectedCountry.flag}</span>
                <div>
                  <div className="font-black text-sm text-white flex items-center gap-2">
                    <span>{isAr ? inspectedCountry.nameAr : inspectedCountry.nameEn}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                      {inspectedCountry.code}
                    </span>
                    {inspectedCountry.rank > 0 && (
                      <span className="rounded-full bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        #{formatAdminNumber(inspectedCountry.rank)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isAr ? inspectedCountry.regionAr : inspectedCountry.regionEn}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400">{T('الزيارات:')} </span>
                  <strong className="text-amber-300 font-black">{formatAdminNumber(inspectedCountry.visits)}</strong>
                </div>
                <div>
                  <span className="text-slate-400">{T('الزوار الفريدون:')} </span>
                  <strong className="text-cyan-300 font-bold">{formatAdminNumber(inspectedCountry.uniqueVisitors)}</strong>
                </div>
                <div>
                  <span className="text-slate-400">{T('اليوم:')} </span>
                  <strong className="text-emerald-300 font-bold">{formatAdminNumber(inspectedCountry.todayVisits)}</strong>
                </div>
                <div>
                  <span className="text-slate-400">{T('الحصة العالمية:')} </span>
                  <strong className="text-white font-bold">{formatAdminNumber(inspectedCountry.sharePercent)}%</strong>
                </div>
                <div>
                  <span className="text-slate-400">{T('مناطق الدخول المرصودة:')} </span>
                  <strong className="text-amber-200 font-bold">{formatAdminNumber(inspectedCountryPlaces.length)}</strong>
                </div>
              </div>
            </div>

            {/* Exact Sub-Country Entry Cities / Governorates Breakdown */}
            <div className="border-t border-slate-800/80 pt-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold text-amber-200 flex items-center gap-1.5">
                  <Crosshair className="h-3.5 w-3.5 text-amber-400" />
                  {TP('أماكن الدخول المرصودة داخل {country}:', {
                    country: isAr ? inspectedCountry.nameAr : inspectedCountry.nameEn,
                  })}
                </span>
                {inspectedCountry.lastVisitAt && (
                  <span className="text-[11px] text-slate-400">
                    {T('آخر زيارة:')}{' '}
                    {new Date(inspectedCountry.lastVisitAt).toLocaleString(adminLocale(), {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                )}
              </div>

              {inspectedCountryPlaces.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  {T('لم تُسجّل نقاط دخول فرعية داخل هذه الدولة بعد — فور دخول أول زائر منها سيظهر اسم المدينة/المحافظة وإحداثياتها هنا.')}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {inspectedCountryPlaces.slice(0, 12).map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => focusPlace(pl)}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 text-start hover:border-amber-400/50 transition"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 truncate">
                          📍 {isAr ? pl.cityAr : pl.cityEn}
                          {pl.regionAr && isAr ? ` — ${pl.regionAr}` : ''}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {pl.lat.toFixed(2)}°, {pl.lon.toFixed(2)}° · {precisionBadge(pl.precision)}
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <div className="font-black text-amber-300">{formatAdminNumber(pl.visits)}</div>
                        <div className="text-[10px] text-cyan-300">{formatAdminNumber(pl.countrySharePercent)}%</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-slate-500">
            {T('اضغط على أي دولة في الخريطة لتقريب حدودها وعرض كل مدن ومناطق الدخول بداخلها.')}
          </div>
        )}
      </div>
    </div>
  );
}
