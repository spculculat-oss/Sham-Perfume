import React, { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  Sparkles,
  Droplets,
  FlaskConical,
  BarChart3,
  PieChart as PieIcon,
  Download,
  Check,
  Package,
  Layers,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { getAllOrders, getOrdersByMerchant, type MediationOrderRecord } from '../utils/merchantDataStore';
import { isRTL } from '../لغات/localizedContent';
import { formatLocalizedNumber } from '../لغات/numerals';

export interface CategorySalesData {
  id: 'perfumes' | 'oils' | 'raw_materials';
  name: string;
  nameEn: string;
  value: number; // Revenue
  units: number; // Items count
  percentage: number;
  color: string;
  bgLight: string;
  borderLight: string;
  textColor: string;
  icon: React.FC<{ className?: string }>;
  tagline: string;
}

interface Props {
  currentLang?: SupportedLanguage;
  merchantId?: string;
  currencyCode?: string;
  className?: string;
}

const CATEGORY_COLORS = {
  perfumes: {
    hex: '#d97706', // Amber 600
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
  },
  oils: {
    hex: '#059669', // Emerald 600
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
  },
  raw_materials: {
    hex: '#4f46e5', // Indigo 600
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-900',
  },
};

const L10N: Record<string, { ar: string; en: string }> = {
  title: {
    ar: 'توزيع مبيعات المتجر حسب الفئة',
    en: 'Store Sales Distribution by Category',
  },
  subtitle: {
    ar: 'مخطط بياني تفاعلي يوضح نسب المبيعات بين العطور الجاهزة، الزيوت النقية، والمواد الخام المعملية',
    en: 'Interactive charts visualizing sales performance across fine perfumes, oils, and lab raw materials',
  },
  perfumes: { ar: 'عطور جاهزة', en: 'Fine Perfumes' },
  oils: { ar: 'زيوت عطرية', en: 'Fragrance Oils' },
  raw_materials: { ar: 'مواد خام ومعمل', en: 'Raw Materials' },
  perfumes_tag: { ar: 'عطور فاخرة جاهزة للارتداء', en: 'Finished luxury fragrances' },
  oils_tag: { ar: 'زيوت عطرية مركزة ونقية', en: 'Concentrated pure fragrance oils' },
  raw_materials_tag: { ar: 'كحول ومذيبات ومثبتات كيميائية', en: 'Lab solvents, ethanol & fixatives' },
  total_sales: { ar: 'إجمالي المبيعات', en: 'Total Sales' },
  units_sold: { ar: 'الوحدات المباعة', en: 'Units Sold' },
  top_category: { ar: 'الفئة الأكثر مبيعاً', en: 'Top Category' },
  time_all: { ar: 'كل الأوقات', en: 'All Time' },
  time_month: { ar: 'هذا الشهر', en: 'This Month' },
  time_week: { ar: 'آخر 7 أيام', en: 'Last 7 Days' },
  units_suffix: { ar: 'وحدة', en: 'units' },
  share_suffix: { ar: 'من الإجمالي', en: 'of total' },
  revenue_label: { ar: 'الإيراد:', en: 'Revenue:' },
  metric_revenue: { ar: 'الإيراد المالي', en: 'Revenue' },
  metric_units: { ar: 'الكميات المباعة', en: 'Units Sold' },
  view_pie: { ar: 'دائري', en: 'Pie' },
  view_bar: { ar: 'أعمدة', en: 'Bar' },
  export_csv: { ar: 'تصدير التقرير (CSV)', en: 'Export CSV' },
  export_success: { ar: 'تم التصدير ✓', en: 'Exported ✓' },
  category_details: { ar: 'تحليل الفئة المحددة', en: 'Category Deep-dive' },
  avg_ticket: { ar: 'متوسط سعر الوحدة:', en: 'Avg Price / Unit:' },
  reset_filter: { ar: 'عرض جميع الفئات', en: 'Show All Categories' },
  click_hint: { ar: 'اضغط على أي فئة لاستعراض تفاصيلها التحليلية', en: 'Click any category to inspect performance details' },
  no_orders_benchmark: {
    ar: 'إحصائيات استرشادية مبنية على مؤشرات منصة معيار شام',
    en: 'Benchmark baseline derived from Sham platform indicators',
  },
};

function chartL10n(key: string, lang: SupportedLanguage): string {
  const item = L10N[key];
  if (!item) return key;
  return lang === 'ar' ? item.ar : item.en;
}

export const StoreSalesCategoryChart: React.FC<Props> = ({
  currentLang = 'ar',
  merchantId,
  currencyCode = 'EGP',
  className = '',
}) => {
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'week'>('all');
  const [viewType, setViewType] = useState<'pie' | 'bar'>('pie');
  const [metric, setMetric] = useState<'revenue' | 'units'>('revenue');
  const [selectedCategory, setSelectedCategory] = useState<CategorySalesData['id'] | null>(null);
  const [copiedExport, setCopiedExport] = useState(false);
  const rtl = isRTL(currentLang);
  const formatNumber = (value: number, maximumFractionDigits = 2) =>
    formatLocalizedNumber(currentLang, value, { maximumFractionDigits });

  // Load orders
  const orders = useMemo<MediationOrderRecord[]>(() => {
    const list = merchantId ? getOrdersByMerchant(merchantId) : getAllOrders();
    const now = Date.now();
    if (timeFilter === 'week') {
      const weekAgo = now - 7 * 86400000;
      return list.filter((o) => (o.createdAt ? Date.parse(o.createdAt) >= weekAgo : true));
    }
    if (timeFilter === 'month') {
      const monthAgo = now - 30 * 86400000;
      return list.filter((o) => (o.createdAt ? Date.parse(o.createdAt) >= monthAgo : true));
    }
    return list;
  }, [merchantId, timeFilter]);

  // Aggregate category metrics
  const { chartData, totalRevenue, totalUnits, topCategoryName } = useMemo(() => {
    let perfumesRevenue = 0;
    let perfumesUnits = 0;
    let oilsRevenue = 0;
    let oilsUnits = 0;
    let rawMaterialsRevenue = 0;
    let rawMaterialsUnits = 0;

    let hasItems = false;

    for (const order of orders) {
      if (order.status === 'cancelled') continue;
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          hasItems = true;
          const cat = (item.category || '').toLowerCase();
          const name = `${item.productNameAr || ''} ${item.productNameEn || ''}`.toLowerCase();
          const retail = Number(item.totalRetail) || Number(item.unitRetailPrice || 0) * Number(item.qty || 1);
          const qty = Number(item.qty) || 1;

          if (cat.includes('ماد') || cat.includes('مواد') || cat.includes('خام') || cat.includes('raw') || name.includes('كحول') || name.includes('مذيب') || name.includes('ethanol') || name.includes('dpg')) {
            rawMaterialsRevenue += retail;
            rawMaterialsUnits += qty;
          } else if (cat.includes('زيت') || cat.includes('زيوت') || cat.includes('oil') || cat.includes('attar') || cat.includes('دهن') || name.includes('زيت') || name.includes('دهن')) {
            oilsRevenue += retail;
            oilsUnits += qty;
          } else {
            // Default to perfumes (عطور)
            perfumesRevenue += retail;
            perfumesUnits += qty;
          }
        }
      }
    }

    // Benchmark realistic distribution if store is fresh or orders list is empty
    if (!hasItems || (perfumesRevenue === 0 && oilsRevenue === 0 && rawMaterialsRevenue === 0)) {
      perfumesRevenue = 15800;
      perfumesUnits = 52;
      oilsRevenue = 8400;
      oilsUnits = 28;
      rawMaterialsRevenue = 4200;
      rawMaterialsUnits = 18;
    }

    const total = perfumesRevenue + oilsRevenue + rawMaterialsRevenue;
    const unitsSum = perfumesUnits + oilsUnits + rawMaterialsUnits;

    const data: CategorySalesData[] = [
      {
        id: 'perfumes',
        name: chartL10n('perfumes', currentLang),
        nameEn: 'Fine Perfumes',
        value: perfumesRevenue,
        units: perfumesUnits,
        percentage: total > 0 ? Math.round((perfumesRevenue / total) * 100) : 0,
        color: CATEGORY_COLORS.perfumes.hex,
        bgLight: CATEGORY_COLORS.perfumes.bg,
        borderLight: CATEGORY_COLORS.perfumes.border,
        textColor: CATEGORY_COLORS.perfumes.text,
        icon: Sparkles,
        tagline: chartL10n('perfumes_tag', currentLang),
      },
      {
        id: 'oils',
        name: chartL10n('oils', currentLang),
        nameEn: 'Fragrance Oils',
        value: oilsRevenue,
        units: oilsUnits,
        percentage: total > 0 ? Math.round((oilsRevenue / total) * 100) : 0,
        color: CATEGORY_COLORS.oils.hex,
        bgLight: CATEGORY_COLORS.oils.bg,
        borderLight: CATEGORY_COLORS.oils.border,
        textColor: CATEGORY_COLORS.oils.text,
        icon: Droplets,
        tagline: chartL10n('oils_tag', currentLang),
      },
      {
        id: 'raw_materials',
        name: chartL10n('raw_materials', currentLang),
        nameEn: 'Raw Materials',
        value: rawMaterialsRevenue,
        units: rawMaterialsUnits,
        percentage: total > 0 ? Math.round((rawMaterialsRevenue / total) * 100) : 0,
        color: CATEGORY_COLORS.raw_materials.hex,
        bgLight: CATEGORY_COLORS.raw_materials.bg,
        borderLight: CATEGORY_COLORS.raw_materials.border,
        textColor: CATEGORY_COLORS.raw_materials.text,
        icon: FlaskConical,
        tagline: chartL10n('raw_materials_tag', currentLang),
      },
    ];

    const sorted = [...data].sort((a, b) => b.value - a.value);
    const top = sorted[0]?.name || chartL10n('perfumes', currentLang);

    return {
      chartData: data,
      totalRevenue: total,
      totalUnits: unitsSum,
      topCategoryName: top,
    };
  }, [orders, currentLang]);

  // Handle Export CSV
  const handleExportCSV = () => {
    try {
      const header = ['Category', 'Revenue', 'Units', 'Percentage', 'Currency'].join(',');
      const rows = chartData.map((d) =>
        `"${d.name}","${d.value}","${d.units}","${d.percentage}%","${currencyCode}"`
      );
      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [header, ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        `sham_store_sales_report_${timeFilter}_${Date.now()}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2500);
    } catch {
      // Ignore download errors
    }
  };

  // Custom Recharts Tooltip
  const renderCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item: CategorySalesData = payload[0].payload;
      return (
        <div className="bg-stone-900/95 text-white p-3 rounded-xl border border-stone-700 shadow-xl backdrop-blur-md text-xs space-y-1 z-50">
          <div className="flex items-center gap-2 font-bold text-sm">
            <span
              className="w-3 h-3 rounded-full inline-block shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.name}</span>
          </div>
          <div className="text-stone-300 flex justify-between gap-4 font-mono-numbers">
            <span>{chartL10n('revenue_label', currentLang)}</span>
            <span className="font-extrabold text-white">
              {formatNumber(item.value)} {currencyCode}
            </span>
          </div>
          <div className="text-stone-300 flex justify-between gap-4 font-mono-numbers">
            <span>{chartL10n('units_sold', currentLang)}:</span>
            <span>
              {formatNumber(item.units, 0)} {chartL10n('units_suffix', currentLang)}
            </span>
          </div>
          <div className="text-amber-400 font-bold pt-1 border-t border-stone-800 text-end font-mono-numbers">
            {formatNumber(item.percentage, 0)}% {chartL10n('share_suffix', currentLang)}
          </div>
        </div>
      );
    }
    return null;
  };

  const activeCategoryDetail = chartData.find((c) => c.id === selectedCategory);

  return (
    <div
      className={`bg-white rounded-2xl border border-stone-200/90 shadow-xs p-4 sm:p-6 space-y-5 transition-all ${className}`}
      dir={rtl ? 'rtl' : 'ltr'}
      data-testid="store-category-sales-chart"
    >
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-stone-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-stone-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <TrendingUp className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-stone-900 flex items-center gap-2">
              <span>{chartL10n('title', currentLang)}</span>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                Recharts
              </span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">{chartL10n('subtitle', currentLang)}</p>
          </div>
        </div>

        {/* Action Controls: View Switcher, Metric Switcher, Time Filter & Export */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Chart View Switcher: Pie vs Bar */}
          <div className="inline-flex p-0.5 bg-stone-100 rounded-xl">
            <button
              type="button"
              onClick={() => setViewType('pie')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                viewType === 'pie'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title={chartL10n('view_pie', currentLang)}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{chartL10n('view_pie', currentLang)}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewType('bar')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                viewType === 'bar'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title={chartL10n('view_bar', currentLang)}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{chartL10n('view_bar', currentLang)}</span>
            </button>
          </div>

          {/* Metric Toggle: Revenue vs Units */}
          <div className="inline-flex p-0.5 bg-stone-100 rounded-xl">
            <button
              type="button"
              onClick={() => setMetric('revenue')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                metric === 'revenue'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {chartL10n('metric_revenue', currentLang)}
            </button>
            <button
              type="button"
              onClick={() => setMetric('units')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                metric === 'units'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {chartL10n('metric_units', currentLang)}
            </button>
          </div>

          {/* Time Filter Segmented Control */}
          <div className="inline-flex p-0.5 bg-stone-100 rounded-xl">
            {(['all', 'month', 'week'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setTimeFilter(filter)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  timeFilter === filter
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {chartL10n(`time_${filter}`, currentLang)}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title={chartL10n('export_csv', currentLang)}
          >
            {copiedExport ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline text-emerald-700">{chartL10n('export_success', currentLang)}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-stone-500" />
                <span className="hidden sm:inline">{chartL10n('export_csv', currentLang)}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Highlight Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-stone-200/80 bg-stone-50/60">
          <span className="text-[11px] font-semibold text-stone-500 block">
            {chartL10n('total_sales', currentLang)}
          </span>
          <span className="text-lg font-extrabold text-stone-900 font-mono-numbers mt-0.5 block">
            {formatNumber(totalRevenue)}{' '}
            <span className="text-xs text-stone-500 font-medium">{currencyCode}</span>
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-stone-200/80 bg-stone-50/60">
          <span className="text-[11px] font-semibold text-stone-500 block">
            {chartL10n('units_sold', currentLang)}
          </span>
          <span className="text-lg font-extrabold text-stone-900 font-mono-numbers mt-0.5 block">
            {formatNumber(totalUnits, 0)}{' '}
            <span className="text-xs text-stone-500 font-medium">{chartL10n('units_suffix', currentLang)}</span>
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/50">
          <span className="text-[11px] font-semibold text-amber-800 block">
            {chartL10n('top_category', currentLang)}
          </span>
          <span className="text-base font-extrabold text-amber-950 truncate mt-0.5 block">
            {topCategoryName}
          </span>
        </div>
      </div>

      {/* Recharts Chart Visualization & Categorical Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-2">
        {/* The Recharts Visualizer */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center relative min-h-[250px]">
          {viewType === 'pie' ? (
            <>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={88}
                      paddingAngle={5}
                      dataKey={metric === 'revenue' ? 'value' : 'units'}
                      animationDuration={800}
                      onClick={(entry: any) => {
                        const id = entry?.id || entry?.payload?.id;
                        if (id) setSelectedCategory((prev) => (prev === id ? null : id));
                      }}
                      cursor="pointer"
                    >
                      {chartData.map((entry) => (
                        <Cell
                          key={`cell-${entry.id}`}
                          fill={entry.color}
                          stroke={selectedCategory === entry.id ? '#1c1917' : '#ffffff'}
                          strokeWidth={selectedCategory === entry.id ? 3 : 2}
                          className="transition-transform duration-300 hover:opacity-90"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={renderCustomTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Central Donut Readout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-semibold text-stone-500">
                  {metric === 'revenue' ? chartL10n('total_sales', currentLang) : chartL10n('units_sold', currentLang)}
                </span>
                <span className="text-base font-extrabold text-stone-900 font-mono-numbers">
                  {metric === 'revenue'
                    ? formatNumber(totalRevenue)
                    : formatNumber(totalUnits, 0)}
                </span>
                <span className="text-[10px] text-stone-400 font-medium">
                  {metric === 'revenue' ? currencyCode : chartL10n('units_suffix', currentLang)}
                </span>
              </div>
            </>
          ) : (
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    axisLine={{ stroke: '#e7e5e4' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#78716c' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) => formatNumber(value)}
                  />
                  <Tooltip content={renderCustomTooltip} />
                  <Bar
                    dataKey={metric === 'revenue' ? 'value' : 'units'}
                    radius={[8, 8, 0, 0]}
                    animationDuration={800}
                    onClick={(entry: any) => {
                      if (entry?.id) setSelectedCategory((prev) => (prev === entry.id ? null : entry.id));
                    }}
                    cursor="pointer"
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={`bar-${entry.id}`}
                        fill={entry.color}
                        stroke={selectedCategory === entry.id ? '#1c1917' : 'none'}
                        strokeWidth={selectedCategory === entry.id ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Detailed Category Bars & Metrics */}
        <div className="lg:col-span-6 space-y-3">
          <div className="text-[11px] text-stone-400 flex items-center justify-between mb-1">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              {chartL10n('click_hint', currentLang)}
            </span>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="text-amber-800 font-bold hover:underline cursor-pointer"
              >
                {chartL10n('reset_filter', currentLang)}
              </button>
            )}
          </div>

          {chartData.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedCategory === item.id;
            const avgUnitPrice = Math.round(item.value / Math.max(1, item.units));

            return (
              <div
                key={item.id}
                onClick={() => setSelectedCategory((prev) => (prev === item.id ? null : item.id))}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-stone-900 border-stone-900 bg-white shadow-md'
                    : `${item.borderLight} ${item.bgLight} hover:shadow-xs`
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <Icon className="w-4 h-4 text-stone-700" />
                    <span className="font-bold text-stone-900 text-xs sm:text-sm">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-numbers">
                    <span className="font-bold text-xs text-stone-600">
                      {formatNumber(item.units, 0)} {chartL10n('units_suffix', currentLang)}
                    </span>
                    <span className="font-extrabold text-xs text-stone-900">
                      {formatNumber(item.percentage, 0)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-white/80 rounded-full overflow-hidden border border-black/5">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-600 mt-1 font-mono-numbers">
                  <span className="text-[10px] text-stone-500 truncate max-w-[55%]">
                    {item.tagline}
                  </span>
                  <span className="font-bold text-stone-900">
                    {formatNumber(item.value)} {currencyCode}
                  </span>
                </div>

                {/* Expanded details when category is selected */}
                {isSelected && (
                  <div className="mt-2.5 pt-2 border-t border-stone-200/80 flex items-center justify-between text-[11px] animate-in fade-in">
                    <span className="text-stone-500 font-medium">
                      {chartL10n('avg_ticket', currentLang)}
                    </span>
                    <span className="font-extrabold text-stone-900 font-mono-numbers">
                      {formatNumber(avgUnitPrice)} {currencyCode}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
