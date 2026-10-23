/**
 * «خريطة العالم الحرارية التفاعلية لزيارات المنصة»
 *
 * Interactive global thermal heatmap showing real visit locations, counts, shares, and statistics across the globe.
 * Both continent/island coastlines and country hotspots use `projectWorldPoint(lat, lon)` so every country aligns
 * accurately on its real geographic landmass.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Flame, Globe, Maximize2, Search, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import { T, TP, adminLocale, formatAdminNumber, getAdminLang, useAdminLanguage } from './adminL10n';
import {
  HEAT_COLORS,
  WORLD_REGIONS,
  enrichCountries,
  projectWorldPoint,
  worldAtlasPoints,
  type CensusReport,
  type EnrichedCountryStat,
  type HeatLevel,
  type WorldRegionId,
} from '../utils/platformCensus';

const W = 1000;
const H = 500;

/** Simplified real geographic `[lat, lon]` polygons for continents and major islands. */
const WORLD_LANDMASSES: { id: string; points: [number, number][] }[] = [
  {
    id: 'north-america',
    points: [
      [71, -156], [70, -140], [69, -125], [72, -95], [66, -82], [62, -74], [58, -63], [52, -56], [47, -53],
      [44, -64], [41, -70], [35, -75], [30, -81], [25, -80], [28, -83], [29, -90], [26, -97], [21, -97],
      [19, -91], [21, -87], [16, -88], [14, -83], [9, -79], [8, -78], [9, -84], [13, -88], [16, -95],
      [19, -105], [23, -106], [31, -114], [23, -110], [28, -115], [34, -120], [40, -124], [48, -125],
      [55, -132], [60, -141], [61, -150], [56, -160], [60, -166], [66, -168], [71, -156],
    ],
  },
  {
    id: 'greenland',
    points: [
      [77, -70], [77, -40], [76, -20], [70, -22], [65, -38], [60, -44], [61, -49], [68, -53], [74, -58], [77, -70],
    ],
  },
  {
    id: 'cuba-hispaniola',
    points: [[23, -84], [22, -77], [20, -74], [20, -77], [22, -83], [23, -84]],
  },
  {
    id: 'south-america',
    points: [
      [11, -75], [12, -71], [10, -62], [6, -55], [2, -50], [-2, -44], [-6, -35], [-13, -38], [-20, -40],
      [-24, -46], [-30, -50], [-35, -54], [-39, -58], [-44, -65], [-50, -68], [-55, -67], [-54, -72],
      [-46, -75], [-36, -73], [-24, -70], [-18, -71], [-12, -77], [-5, -81], [1, -80], [6, -77], [11, -75],
    ],
  },
  {
    id: 'iceland',
    points: [[66.5, -24], [66, -14], [63.5, -15], [64, -22], [66.5, -24]],
  },
  {
    id: 'uk-ireland',
    points: [[58.6, -5], [57.5, -1.8], [53, 1.5], [51, 1.3], [50, -5.5], [52, -10], [55, -8.5], [58.6, -5]],
  },
  {
    id: 'eurasia',
    points: [
      // Iberia & Western Europe
      [36, -9], [43, -9], [44, -1.5], [48, -4.5], [50, 1.8], [53.5, 5], [55, 8.5], [57.5, 10], [55, 12],
      // Scandinavia
      [56, 15], [60, 19], [65, 22], [60, 11], [58, 7], [62, 5], [68, 15], [71, 26], [70, 32],
      // Northern Russia & Siberia
      [68, 44], [70, 58], [73, 70], [75, 88], [76, 105], [73, 125], [71, 145], [69, 165], [66, 178],
      // Far East & Kamchatka & Korea & China
      [60, 165], [52, 157], [58, 152], [54, 140], [46, 138], [41, 130], [35, 129], [35, 126], [39, 124],
      [40, 120], [37, 122], [31, 122], [25, 119], [22, 114], [20, 109],
      // Southeast Asia & Malay Peninsula
      [16, 108], [11, 109], [9, 105], [13, 101], [7, 100], [1.5, 104], [6, 100], [14, 98], [17, 96], [22, 92],
      // India
      [21, 88], [16, 82], [8, 77.5], [15, 74], [21, 72], [24, 68],
      // Iran, Persian Gulf & Arabian Peninsula
      [25, 61], [27, 56], [29, 50], [29, 48], [26, 50.5], [24, 54], [22.5, 59.5], [17, 54], [13, 45],
      [13, 43.3], [20, 40], [28, 35], [30, 32.6],
      // Levant, Anatolia & Southern Europe
      [32, 34.8], [36, 36], [36.5, 32], [38, 27], [41, 29], [42, 37], [44, 39], [46, 33], [45, 29],
      [41, 26], [38, 23.5], [37, 21.5], [40, 20], [44, 15], [45, 12.5], [41, 16.5], [38, 15.6],
      [41.5, 12.5], [44, 9], [43.3, 5], [41, 2], [37, -2], [36, -5.5], [36, -9],
    ],
  },
  {
    id: 'africa',
    points: [
      [35.8, -5.8], [37, 10], [33, 11.5], [31, 17], [32, 24], [31.5, 32], [29.5, 32.6], [22, 37], [15, 40],
      [11.8, 43.5], [11.8, 51], [4, 48], [-2, 41], [-10, 40], [-16, 40], [-20, 35], [-26, 33], [-33, 28],
      [-34.8, 20], [-33, 18], [-26, 15], [-17, 12], [-9, 13], [-5, 12], [0, 9.5], [4, 9.5], [6, 3],
      [5, -4], [4.5, -8], [8, -13], [12, -16.8], [15, -17.4], [21, -17], [27, -13], [32, -9.5], [35.8, -5.8],
    ],
  },
  {
    id: 'madagascar',
    points: [[-12.5, 49.3], [-16, 50], [-25, 47], [-25.5, 45], [-19, 44.3], [-14, 47.8], [-12.5, 49.3]],
  },
  {
    id: 'sri-lanka',
    points: [[9.8, 80.2], [7.5, 81.8], [6, 80.5], [8, 79.8], [9.8, 80.2]],
  },
  {
    id: 'japan',
    points: [[45, 142], [43, 145], [39, 142], [35, 140], [33, 132], [31, 130.5], [34, 131], [37, 137], [41, 140], [45, 142]],
  },
  {
    id: 'taiwan',
    points: [[25.3, 121.5], [23.5, 121.5], [22, 120.8], [23.5, 120.1], [25.3, 121.5]],
  },
  {
    id: 'philippines',
    points: [[18.5, 121], [15, 122], [11, 125], [6.5, 126], [6, 124], [10, 122], [14, 120], [18.5, 121]],
  },
  {
    id: 'sumatra-java',
    points: [[5.5, 95.3], [1, 102], [-5.8, 105.8], [-6.8, 108], [-7.8, 114], [-8.5, 114], [-7.5, 107], [-4, 102], [2, 97], [5.5, 95.3]],
  },
  {
    id: 'borneo',
    points: [[7, 117], [4, 118], [-1, 117], [-3.5, 114.5], [-3, 110.5], [1.5, 109.5], [4.5, 114], [7, 117]],
  },
  {
    id: 'sulawesi-papua',
    points: [[1, 125], [-5, 122], [-4, 119.5], [0.5, 120], [1, 125]],
  },
  {
    id: 'new-guinea',
    points: [[-1, 131], [-3, 141], [-6, 147], [-10, 150.5], [-9, 147], [-8, 139], [-4.5, 134], [-1, 131]],
  },
  {
    id: 'australia',
    points: [
      [-11, 132], [-12, 136.5], [-16, 136], [-17, 140.5], [-11, 142.5], [-16, 145.8], [-22, 149.5],
      [-28, 153.5], [-34, 151.2], [-38, 149.5], [-39, 146.5], [-38, 141], [-35, 137], [-32, 133],
      [-32, 125], [-35, 117], [-33.5, 115], [-27, 114], [-22, 114], [-19, 121.5], [-15, 125], [-13, 130], [-11, 132],
    ],
  },
  {
    id: 'tasmania',
    points: [[-40.7, 145], [-41, 148.3], [-43.5, 147], [-42.5, 145.3], [-40.7, 145]],
  },
  {
    id: 'new-zealand',
    points: [[-34.5, 173], [-38, 178], [-41.5, 175], [-46.5, 168], [-45, 167], [-41, 172], [-37, 174.5], [-34.5, 173]],
  },
];

function toSvgPath(points: [number, number][]): string {
  return points
    .map(([lat, lon], idx) => {
      const p = projectWorldPoint(lat, lon, W, H);
      return `${idx === 0 ? 'M' : 'L'}${p.x},${p.y}`;
    })
    .join(' ') + ' Z';
}

const PROJECTED_LANDMASSES = WORLD_LANDMASSES.map((m) => ({ id: m.id, d: toSvgPath(m.points) }));

const GRATICULE_LATS = [60, 30, 23.5, 0, -23.5, -45];
const GRATICULE_LONS = [-120, -60, 0, 30, 60, 120];

export interface WorldHeatmapSvgLayerProps {
  report: CensusReport;
  width?: number;
  height?: number;
  theme?: 'dark' | 'light';
  idPrefix?: string;
  showLabels?: boolean;
  still?: boolean;
}

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

/**
 * Pure non-interactive SVG `<g>` layer that projects the world continents, graticule,
 * blurred thermal heat clouds, and country visit hotspots into the background of any SVG
 * (such as «غرفة التحكم الحية» and «خريطة تشغيل شام»).
 */
export function WorldHeatmapSvgLayer({
  report,
  width = W,
  height = H,
  theme = 'dark',
  idPrefix = 'bg-hm',
  showLabels = true,
  still = false,
}: WorldHeatmapSvgLayerProps) {
  const isAr = getAdminLang() === 'ar';
  const points = useMemo(() => worldAtlasPoints(report, 'total'), [report]);
  const activePoints = useMemo(() => points.filter((p) => p.heatLevel !== 'none'), [points]);

  // Preserve ~2:1 world proportions cleanly inside arbitrary SVG canvases (e.g. 1200x600 or 1200x920)
  const scaleX = width / W;
  const targetH = Math.min(height, width * 0.58);
  const scaleY = targetH / H;
  const offsetY = (height - targetH) * 0.45;

  const isDark = theme === 'dark';
  const landFill = isDark ? '#14345c' : '#dbeafe';
  const landStroke = isDark ? '#38bdf8' : '#0284c7';
  const landOpacity = isDark ? 0.88 : 0.72;
  const gridStroke = isDark ? '#38bdf8' : '#94a3b8';

  return (
    <g pointerEvents="none" aria-hidden="true">
      <defs>
        <filter id={`${idPrefix}-blur`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <radialGradient id={`${idPrefix}-ambient-amber`}>
          <stop offset="0%" stopColor="#f59e0b" stopOpacity={isDark ? '0.42' : '0.26'} />
          <stop offset="55%" stopColor="#06b6d4" stopOpacity={isDark ? '0.18' : '0.10'} />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${idPrefix}-ambient-cyan`}>
          <stop offset="0%" stopColor="#06b6d4" stopOpacity={isDark ? '0.36' : '0.22'} />
          <stop offset="60%" stopColor="#0ea5e9" stopOpacity={isDark ? '0.14' : '0.08'} />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${idPrefix}-ambient-emerald`}>
          <stop offset="0%" stopColor="#10b981" stopOpacity={isDark ? '0.34' : '0.20'} />
          <stop offset="60%" stopColor="#06b6d4" stopOpacity={isDark ? '0.14' : '0.08'} />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </radialGradient>
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
        {/* Ambient regional atmospheric radar aura so the world thermal map is vividly visible even at 0 visits */}
        <g filter={`url(#${idPrefix}-blur)`}>
          {AMBIENT_REGION_HUBS.map((hub) => {
            const p = projectWorldPoint(hub.lat, hub.lon, W, H);
            return (
              <circle
                key={`bg-aura-${hub.id}`}
                cx={p.x}
                cy={p.y}
                r={hub.id === 'arab' ? 92 : 76}
                fill={`url(#${idPrefix}-ambient-${hub.tone})`}
              />
            );
          })}
        </g>

        {/* Crisp world graticule (latitude & longitude radar grid) */}
        <g stroke={gridStroke} strokeWidth={0.7} strokeDasharray="3 5" opacity={isDark ? 0.34 : 0.45}>
          {GRATICULE_LATS.map((lat) => {
            const { y } = projectWorldPoint(lat, 0, W, H);
            return (
              <line
                key={`bg-lat-${lat}`}
                x1={0}
                y1={y}
                x2={W}
                y2={y}
                strokeWidth={lat === 0 ? 1.1 : 0.7}
                strokeDasharray={lat === 0 ? undefined : '3 5'}
              />
            );
          })}
          {GRATICULE_LONS.map((lon) => {
            const { x } = projectWorldPoint(0, lon, W, H);
            return <line key={`bg-lon-${lon}`} x1={x} y1={0} x2={x} y2={H} />;
          })}
        </g>

        {/* World Continents & Islands with luminous coastlines */}
        <g opacity={landOpacity}>
          {PROJECTED_LANDMASSES.map((m) => (
            <path
              key={`bg-${m.id}`}
              d={m.d}
              fill={landFill}
              stroke={landStroke}
              strokeOpacity={isDark ? 0.78 : 0.65}
              strokeWidth={1.15}
              strokeLinejoin="round"
            />
          ))}
        </g>

        {/* Ambient radar beacons for world countries */}
        <g opacity={isDark ? 0.72 : 0.55}>
          {points
            .filter((c) => c.heatLevel === 'none')
            .map((c) => {
              const isArab = c.region === 'arab';
              return (
                <circle
                  key={`bg-idle-${c.code}`}
                  cx={c.x}
                  cy={c.y}
                  r={isArab ? 2.6 : 1.9}
                  fill={isArab ? '#fbbf24' : isDark ? '#38bdf8' : '#0284c7'}
                  stroke={isDark ? '#082f49' : '#fff'}
                  strokeWidth={0.5}
                />
              );
            })}
        </g>

        {/* Live Radar Rings & Region Labels across the 6 Continents */}
        <g>
          {AMBIENT_REGION_HUBS.map((hub) => {
            const p = projectWorldPoint(hub.lat, hub.lon, W, H);
            const ringColor = hub.tone === 'amber' ? '#fbbf24' : hub.tone === 'emerald' ? '#34d399' : '#38bdf8';
            return (
              <g key={`bg-hub-${hub.id}`} transform={`translate(${p.x}, ${p.y})`}>
                {!still && (
                  <circle r={12} fill="none" stroke={ringColor} strokeWidth={1.1} opacity={0.65}>
                    <animate attributeName="r" values="8;30" dur={hub.id === 'arab' ? '3.4s' : '4.6s'} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0" dur={hub.id === 'arab' ? '3.4s' : '4.6s'} repeatCount="indefinite" />
                  </circle>
                )}
                {showLabels && activePoints.length === 0 && (
                  <text
                    y={16}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight="700"
                    fill={hub.tone === 'amber' ? '#fde68a' : '#bae6fd'}
                    stroke="#040b16"
                    strokeWidth={2.5}
                    paintOrder="stroke"
                    opacity={0.85}
                  >
                    {isAr ? hub.ar : hub.en}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Thermal Heat Clouds over visited countries */}
        <g filter={`url(#${idPrefix}-blur)`}>
          {activePoints.map((c) => (
            <circle
              key={`bg-cloud-${c.code}`}
              cx={c.x}
              cy={c.y}
              r={30 + c.intensity * 44}
              fill={`url(#${idPrefix}-grad-${c.heatLevel})`}
            />
          ))}
        </g>

        {/* Active Country Hotspots */}
        <g>
          {activePoints.map((c) => {
            const palette = HEAT_COLORS[c.heatLevel];
            const r = 4.2 + c.intensity * 5.6;
            return (
              <g key={`bg-hot-${c.code}`} transform={`translate(${c.x}, ${c.y})`}>
                {c.todayVisits > 0 && !still && (
                  <circle r={r * 2} fill="none" stroke={palette.ring} strokeWidth={1.2} opacity={0.8}>
                    <animate attributeName="r" values={`${r.toFixed(1)};${(r * 2.9).toFixed(1)}`} dur="2.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.85;0" dur="2.6s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle r={r} fill={palette.fill} fillOpacity={0.95} stroke={palette.ring} strokeWidth={1.1} />
                {showLabels && c.rank <= 8 && (
                  <text
                    y={-(r + 5)}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight="800"
                    fill={isDark ? '#f8fafc' : '#1c1917'}
                    stroke={isDark ? '#020617' : '#fafaf9'}
                    strokeWidth={2.4}
                    paintOrder="stroke"
                    opacity={0.95}
                  >
                    {isAr ? c.nameAr : c.nameEn} ({formatAdminNumber(c.visits)})
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </g>
    </g>
  );
}

/**
 * Full-bleed fixed ambient World Thermal Heatmap background for «صفحة خريطة التشغيل» (`#ops` / `#admin/ops`).
 */
export function WorldHeatmapPageBackdrop({ report }: { report: CensusReport }) {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
      data-testid="ops-world-heatmap-backdrop"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#040d1d] via-[#091c38] to-[#040d1d]" />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full opacity-95"
      >
        <WorldHeatmapSvgLayer
          report={report}
          width={W}
          height={H}
          theme="dark"
          idPrefix="page-ops-hm"
          showLabels
        />
      </svg>
      <div className="absolute inset-0 bg-radial from-transparent via-[#040d1d]/15 to-[#040d1d]/55" />
    </div>
  );
}

export interface WorldVisitHeatmapProps {
  report: CensusReport;
  selectedCountry?: string | null;
  onSelectCountry?: (code: string | null) => void;
}

export default function WorldVisitHeatmap({ report, selectedCountry, onSelectCountry }: WorldVisitHeatmapProps) {
  useAdminLanguage();
  const isAr = getAdminLang() === 'ar';

  const [metricMode, setMetricMode] = useState<'total' | 'today'>('total');
  const [showAllAtlas, setShowAllAtlas] = useState<boolean>(report.totals.visits === 0);
  const [regionFilter, setRegionFilter] = useState<WorldRegionId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  // Viewport pan & zoom state (`center x, center y, zoom factor`)
  const [view, setView] = useState<{ cx: number; cy: number; zoom: number }>({ cx: W / 2, cy: H / 2, zoom: 1 });
  const dragRef = useRef<{ startX: number; startY: number; cx: number; cy: number } | null>(null);

  const activeSelected = selectedCountry !== undefined ? selectedCountry : internalSelected;
  const selectCode = (code: string | null) => {
    setInternalSelected(code);
    onSelectCountry?.(code);
  };

  const activePoints = useMemo(() => enrichCountries(report, metricMode), [report, metricMode]);
  const allPoints = useMemo(
    () => (showAllAtlas || report.totals.visits === 0 ? worldAtlasPoints(report, metricMode) : activePoints),
    [report, metricMode, showAllAtlas, activePoints],
  );

  const visiblePoints = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPoints.filter((c) => {
      if (regionFilter !== 'all' && c.region !== regionFilter) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.nameAr.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q)
      );
    });
  }, [allPoints, regionFilter, search]);

  const focusedCountry: EnrichedCountryStat | undefined = useMemo(() => {
    const targetCode = hoveredCode || activeSelected;
    if (targetCode) {
      const found = allPoints.find((c) => c.code === targetCode);
      if (found) return found;
    }
    return activePoints[0];
  }, [hoveredCode, activeSelected, allPoints, activePoints]);

  const focusRegion = (reg: WorldRegionId | 'all') => {
    setRegionFilter(reg);
    if (reg === 'all') {
      setView({ cx: W / 2, cy: H / 2, zoom: 1 });
    } else {
      const rv = WORLD_REGIONS[reg].view;
      setView({ cx: rv.x, cy: rv.y, zoom: rv.zoom });
    }
  };

  const focusCountry = (c: EnrichedCountryStat) => {
    selectCode(c.code);
    setView((prev) => ({ cx: c.x, cy: c.y, zoom: Math.max(prev.zoom, 2.4) }));
  };

  const adjustZoom = (delta: number) => {
    setView((prev) => {
      const nextZoom = Math.min(5, Math.max(1, Math.round((prev.zoom + delta) * 100) / 100));
      if (nextZoom === 1) return { cx: W / 2, cy: H / 2, zoom: 1 };
      return { ...prev, zoom: nextZoom };
    });
  };

  // Compute SVG viewBox from center + zoom
  const vw = W / view.zoom;
  const vh = H / view.zoom;
  const vx = Math.max(0, Math.min(W - vw, view.cx - vw / 2));
  const vy = Math.max(0, Math.min(H - vh, view.cy - vh / 2));
  const viewBoxStr = `${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`;

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (view.zoom <= 1) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, cx: view.cx, cy: view.cy };
  };
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * vw;
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * vh;
    setView((prev) => ({
      ...prev,
      cx: Math.max(vw / 2, Math.min(W - vw / 2, dragRef.current!.cx - dx)),
      cy: Math.max(vh / 2, Math.min(H - vh / 2, dragRef.current!.cy - dy)),
    }));
  };
  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const heatLegend: HeatLevel[] = ['low', 'warm', 'hot', 'blazing'];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 overflow-hidden shadow-lg">
      {/* Top Toolbar */}
      <div className="p-3 sm:p-4 border-b border-slate-800/90 bg-gradient-to-l from-slate-900 via-slate-950 to-slate-900 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-300">
              <Flame className="w-5 h-5" />
            </span>
            <div>
              <h4 className="font-bold text-sm sm:text-base text-amber-100 flex items-center gap-2">
                {T('خريطة العالم الحرارية التفاعلية للزيارات')}
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {TP('{n} دولة نشطة', { n: formatAdminNumber(report.totals.countriesCount) })}
                </span>
              </h4>
              <p className="text-[11px] text-slate-400">
                {T('توزيع حراري حي لأماكن الزيارات وعددها ونسبتها حول العالم — اضغط على أي دولة للتفاصيل والتقريب')}
              </p>
            </div>
          </div>

          {/* Metric & Atlas Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-900 p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setMetricMode('total')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${metricMode === 'total' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'}`}
              >
                {T('إجمالي الزيارات')}
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('today')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${metricMode === 'today' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'}`}
              >
                {T('زيارات اليوم')}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAllAtlas((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition ${
                showAllAtlas
                  ? 'bg-sky-500/15 border-sky-400/40 text-sky-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              {showAllAtlas ? T('أطلس كل الدول مفعّل') : T('إظهار كل دول العالم')}
            </button>
          </div>
        </div>

        {/* Region Filter Pills + Country Search + Zoom Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => focusRegion('all')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition ${
                regionFilter === 'all'
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
            >
              {T('🌍 العالم كله')}
            </button>
            {(Object.keys(WORLD_REGIONS) as WorldRegionId[]).map((reg) => {
              const regVisits = report.byRegion[reg]?.visits ?? 0;
              return (
                <button
                  key={reg}
                  type="button"
                  onClick={() => focusRegion(reg)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition ${
                    regionFilter === reg
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {isAr ? WORLD_REGIONS[reg].ar : WORLD_REGIONS[reg].en}
                  {regVisits > 0 ? ` (${formatAdminNumber(regVisits)})` : ''}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={T('ابحث عن دولة…')}
                aria-label={T('ابحث عن دولة…')}
                className="rounded-lg bg-slate-900 border border-slate-700 ps-8 pe-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 w-40 sm:w-48"
              />
            </div>
            <button
              type="button"
              onClick={() => adjustZoom(0.6)}
              title={T('تقريب الخريطة')}
              aria-label={T('تقريب الخريطة')}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:border-amber-400"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => adjustZoom(-0.6)}
              title={T('تبعيد الخريطة')}
              aria-label={T('تبعيد الخريطة')}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:border-amber-400"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => focusRegion('all')}
              title={T('إعادة ضبط عرض العالم')}
              aria-label={T('إعادة ضبط عرض العالم')}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:border-amber-400"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive SVG World Canvas */}
      <div className="relative bg-[#07101f] select-none">
        <svg
          viewBox={viewBoxStr}
          className={`w-full h-auto aspect-[2/1] block ${view.zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
          role="img"
          aria-label={T('خريطة العالم الحرارية التفاعلية للزيارات')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <defs>
            <linearGradient id="ocean-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#060d1b" />
              <stop offset="50%" stopColor="#0a162c" />
              <stop offset="100%" stopColor="#060e1d" />
            </linearGradient>
            <filter id="thermal-cloud-blur" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <radialGradient id="heat-grad-low">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heat-grad-warm">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.72" />
              <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heat-grad-hot">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.82" />
              <stop offset="55%" stopColor="#10b981" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="heat-grad-blazing">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.92" />
              <stop offset="42%" stopColor="#f59e0b" stopOpacity="0.55" />
              <stop offset="78%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ocean backdrop */}
          <rect x={0} y={0} width={W} height={H} fill="url(#ocean-bg)" />

          {/* Graticule grid (Latitude & Longitude lines) */}
          <g stroke="#1e293b" strokeWidth={0.6 / Math.sqrt(view.zoom)} strokeDasharray="3 4" opacity={0.7}>
            {GRATICULE_LATS.map((lat) => {
              const { y } = projectWorldPoint(lat, 0, W, H);
              return (
                <line
                  key={`lat-${lat}`}
                  x1={0}
                  y1={y}
                  x2={W}
                  y2={y}
                  stroke={lat === 0 ? '#334155' : '#1e293b'}
                  strokeDasharray={lat === 0 ? undefined : '3 4'}
                />
              );
            })}
            {GRATICULE_LONS.map((lon) => {
              const { x } = projectWorldPoint(0, lon, W, H);
              return <line key={`lon-${lon}`} x1={x} y1={0} x2={x} y2={H} />;
            })}
          </g>

          {/* Continents & Major Islands */}
          <g>
            {PROJECTED_LANDMASSES.map((m) => (
              <path
                key={m.id}
                d={m.d}
                fill="#132038"
                stroke="#294166"
                strokeWidth={0.9 / Math.sqrt(view.zoom)}
                strokeLinejoin="round"
              />
            ))}
          </g>

          {/* Thermal Heat Clouds Layer (soft blurred atmospheric glow over active countries) */}
          <g filter="url(#thermal-cloud-blur)" pointerEvents="none">
            {visiblePoints
              .filter((c) => c.heatLevel !== 'none')
              .map((c) => {
                const cloudR = (22 + c.intensity * 36) / Math.pow(view.zoom, 0.35);
                return (
                  <circle
                    key={`cloud-${c.code}`}
                    cx={c.x}
                    cy={c.y}
                    r={cloudR}
                    fill={`url(#heat-grad-${c.heatLevel})`}
                  />
                );
              })}
          </g>

          {/* Country Markers & Hotspots */}
          <g>
            {visiblePoints.map((c) => {
              const isSelected = activeSelected === c.code || hoveredCode === c.code;
              const palette = HEAT_COLORS[c.heatLevel];
              const baseR = c.heatLevel === 'none'
                ? 2.1 / Math.pow(view.zoom, 0.45)
                : (4.2 + c.intensity * 6.5) / Math.pow(view.zoom, 0.45);
              const showLabel =
                isSelected ||
                (c.heatLevel !== 'none' && (c.rank <= 8 || view.zoom >= 2.1)) ||
                (search.trim().length > 0 && visiblePoints.length <= 12);

              return (
                <g
                  key={c.code}
                  transform={`translate(${c.x}, ${c.y})`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredCode(c.code)}
                  onMouseLeave={() => setHoveredCode((prev) => (prev === c.code ? null : prev))}
                  onClick={(e) => {
                    e.stopPropagation();
                    focusCountry(c);
                  }}
                >
                  {/* Today's live pulse halo */}
                  {c.todayVisits > 0 && (
                    <circle
                      r={baseR * 2.1}
                      fill="none"
                      stroke={palette.ring}
                      strokeWidth={1.1 / Math.sqrt(view.zoom)}
                      opacity={0.75}
                    >
                      <animate
                        attributeName="r"
                        values={`${(baseR * 1.1).toFixed(1)};${(baseR * 2.6).toFixed(1)}`}
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                      <animate attributeName="opacity" values="0.85;0" dur="2.4s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Selection ring */}
                  {isSelected && (
                    <circle
                      r={baseR * 1.9}
                      fill="none"
                      stroke="#fde047"
                      strokeWidth={1.5 / Math.sqrt(view.zoom)}
                    />
                  )}

                  {/* Core thermal dot */}
                  <circle
                    r={baseR}
                    fill={palette.fill}
                    fillOpacity={c.heatLevel === 'none' ? 0.55 : 0.95}
                    stroke={isSelected ? '#fef08a' : palette.ring}
                    strokeWidth={(c.heatLevel === 'none' ? 0.5 : 1.1) / Math.sqrt(view.zoom)}
                  />

                  {/* Country label + visit count */}
                  {showLabel && (
                    <g transform={`translate(0, ${-(baseR + 5 / Math.sqrt(view.zoom))})`} pointerEvents="none">
                      <text
                        textAnchor="middle"
                        fontSize={Math.max(5.5, 9.5 / Math.pow(view.zoom, 0.55))}
                        fontWeight="700"
                        fill="#f8fafc"
                        stroke="#020617"
                        strokeWidth={2.2 / Math.pow(view.zoom, 0.55)}
                        paintOrder="stroke"
                      >
                        {isAr ? c.nameAr : c.nameEn}
                        {c.visits > 0 ? ` (${formatAdminNumber(metricMode === 'today' ? c.todayVisits : c.visits)})` : ''}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Honest Zero-Visits Floating Badge on Map when 0 visits */}
        {report.totals.visits === 0 && (
          <div className="pointer-events-none absolute bottom-3 start-3 end-3 sm:end-auto sm:max-w-md rounded-xl bg-slate-900/90 backdrop-blur border border-amber-400/30 px-3 py-2 text-xs text-amber-100 shadow-lg">
            <p className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {T('الرادار الحراري العالمي جاهز — 0 زيارة مسجلة حالياً')}
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {T('كل نقاط الدول المعروضة حقيقية وجاهزة للإضاءة الحرارية فور دخول أول زائر فعلي بدون أي أرقام تجميلية.')}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Legend + Selected Country Inspector */}
      <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Thermal Scale Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
          <span className="font-bold text-slate-200">{T('مقياس الحرارة:')}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600 inline-block" />
            {T('بدون زيارات بعد')}
          </span>
          {heatLegend.map((lvl) => (
            <span key={lvl} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: HEAT_COLORS[lvl].fill }} />
              {isAr ? HEAT_COLORS[lvl].ar : HEAT_COLORS[lvl].en}
            </span>
          ))}
        </div>

        {/* Country Inspector Strip */}
        {focusedCountry ? (
          <div className="rounded-xl bg-slate-950/90 border border-slate-800 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-amber-200 flex items-center gap-1.5">
              <span className="text-base">{focusedCountry.flag}</span>
              {isAr ? focusedCountry.nameAr : focusedCountry.nameEn}
              <span className="text-[10px] text-slate-400" dir="ltr">({focusedCountry.code})</span>
            </span>
            <span className="text-slate-300">
              {T('الزيارات:')} <b className="text-white">{formatAdminNumber(focusedCountry.visits)}</b>
            </span>
            <span className="text-slate-300">
              {T('الزوار الفريدون:')} <b className="text-emerald-300">{formatAdminNumber(focusedCountry.uniqueVisitors)}</b>
            </span>
            <span className="text-slate-300">
              {T('اليوم:')} <b className="text-amber-300">{formatAdminNumber(focusedCountry.todayVisits)}</b>
            </span>
            <span className="text-slate-300">
              {T('الحصة العالمية:')} <b>{formatAdminNumber(focusedCountry.sharePercent)}%</b>
            </span>
            {focusedCountry.visits > 0 && (
              <span className="text-slate-400">
                {T('الأعلى إقبالاً:')} <b className="text-slate-200">{isAr ? focusedCountry.topSectionAr : focusedCountry.topSectionEn}</b>
              </span>
            )}
            {focusedCountry.lastVisitAt && (
              <span className="text-[11px] text-slate-400">
                {T('آخر زيارة:')} {new Date(focusedCountry.lastVisitAt).toLocaleString(adminLocale(), { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Cairo' })}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">{T('مرّر المؤشر أو اضغط على أي دولة في الخريطة لعرض إحصائياتها التفصيلية.')}</p>
        )}
      </div>
    </div>
  );
}
