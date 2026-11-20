import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  FlaskConical,
  Sparkles,
  Calendar,
  Layers,
  Filter,
  Download,
  Info,
  CheckCircle2,
  Atom,
} from 'lucide-react';
import { SavedFormula, PyramidNote } from '../types/perfume';
import { CURATED_FORMULA_PRESETS } from '../data/presets';
import { LText, pickArEn } from '../لغات/localize';

interface PerfumerAnalyticsProps {
  savedFormulas: SavedFormula[];
  currentLang: string;
  onNavigateToTab?: (tab: string) => void;
  onOpenFormula?: (formula: SavedFormula) => void;
}

const CONCENTRATION_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  extrait: { ar: 'إكستري دي بارفان (Extrait)', en: 'Extrait de Parfum', color: '#9333ea' },
  edp: { ar: 'ماء عطر (Eau de Parfum)', en: 'Eau de Parfum (EDP)', color: '#2563eb' },
  edt: { ar: 'ماء تواليت (Eau de Toilette)', en: 'Eau de Toilette (EDT)', color: '#0d9488' },
  edc: { ar: 'ماء كولونيا (Eau de Cologne)', en: 'Eau de Cologne (EDC)', color: '#ca8a04' },
  eau_fraiche: { ar: 'أو فريش (Eau Fraîche)', en: 'Eau Fraîche', color: '#06b6d4' },
  aftershave: { ar: 'ما بعد الحلاقة (Aftershave)', en: 'Aftershave', color: '#64748b' },
  mist: { ar: 'معطر جسم / رذاذ (Mist)', en: 'Body Mist', color: '#ec4899' },
  oil_pure: { ar: 'زيت عطري نقي (Pure Oil)', en: 'Pure Perfume Oil', color: '#d97706' },
  custom: { ar: 'مخصص (Custom)', en: 'Custom Formula', color: '#4b5563' },
};

const NOTE_CATEGORY_COLORS = {
  top: '#f59e0b',    // Amber / Citrus top notes
  heart: '#10b981',  // Emerald floral heart notes
  base: '#8b5cf6',   // Purple woods/resins base notes
};

export const PerfumerAnalytics: React.FC<PerfumerAnalyticsProps> = ({
  savedFormulas,
  currentLang,
  onNavigateToTab,
}) => {
  const isAr = currentLang === 'ar';
  const [includePresets, setIncludePresets] = useState<boolean>(savedFormulas.length < 3);
  const [timeFilter, setTimeFilter] = useState<'all' | '30d' | '7d'>('all');
  const [minNoteCount, setMinNoteCount] = useState<number>(1);
  const [activeTooltip, setActiveTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    content: string;
  } | null>(null);

  // SVG Chart Refs
  const materialsChartRef = useRef<SVGSVGElement | null>(null);
  const concentrationChartRef = useRef<SVGSVGElement | null>(null);
  const timelineChartRef = useRef<SVGSVGElement | null>(null);

  // Combine user saved formulas with presets if toggled
  const activeFormulas = useMemo(() => {
    let list: SavedFormula[] = [...savedFormulas];
    if (includePresets || list.length === 0) {
      const presetFormulas: SavedFormula[] = CURATED_FORMULA_PRESETS.map((p, idx) => ({
        id: `preset_${idx}`,
        title: p.title,
        titleEn: p.titleEn,
        author: p.author || 'Sham Fragrance Lab',
        dateCreated: p.dateCreated || new Date(Date.now() - idx * 86400000 * 2).toISOString(),
        formulation: p.formulation,
        pyramidNotes: p.pyramidNotes,
        category: p.category,
        tags: p.tags,
      }));
      // Avoid duplicate titles
      const existingTitles = new Set(list.map((f) => f.title.trim().toLowerCase()));
      for (const pf of presetFormulas) {
        if (!existingTitles.has(pf.title.trim().toLowerCase())) {
          list.push(pf);
        }
      }
    }

    if (timeFilter === 'all') return list;
    const now = Date.now();
    const daysLimit = timeFilter === '7d' ? 7 : 30;
    const cutoff = now - daysLimit * 86400000;

    return list.filter((f) => {
      const t = new Date(f.dateCreated).getTime();
      return !isNaN(t) && t >= cutoff;
    });
  }, [savedFormulas, includePresets, timeFilter]);

  // Aggregate Raw Materials
  const rawMaterialsData = useMemo(() => {
    const map = new Map<string, {
      name: string;
      nameAr: string;
      nameEn: string;
      count: number;
      category: 'top' | 'heart' | 'base';
      totalPercentage: number;
    }>();

    activeFormulas.forEach((formula) => {
      (formula.pyramidNotes || []).forEach((note) => {
        const key = (note.nameAr || note.nameEn || note.id || '').trim().toLowerCase();
        if (!key) return;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
          existing.totalPercentage += note.percentageOfOil || 0;
        } else {
          map.set(key, {
            name: isAr ? (note.nameAr || note.nameEn) : (note.nameEn || note.nameAr),
            nameAr: note.nameAr || note.nameEn,
            nameEn: note.nameEn || note.nameAr,
            count: 1,
            category: note.category || 'heart',
            totalPercentage: note.percentageOfOil || 0,
          });
        }
      });
    });

    return Array.from(map.values())
      .filter((m) => m.count >= minNoteCount)
      .sort((a, b) => b.count - a.count || b.totalPercentage - a.totalPercentage)
      .slice(0, 15);
  }, [activeFormulas, isAr, minNoteCount]);

  // Aggregate Concentration Types
  const concentrationData = useMemo(() => {
    const counts: Record<string, number> = {};
    activeFormulas.forEach((f) => {
      const type = f.formulation?.concentrationType || 'edp';
      counts[type] = (counts[type] || 0) + 1;
    });

    const total = activeFormulas.length || 1;
    return Object.entries(counts).map(([type, count]) => {
      const meta = CONCENTRATION_LABELS[type] || {
        ar: type,
        en: type,
        color: '#6366f1',
      };
      return {
        type,
        label: isAr ? meta.ar : meta.en,
        count,
        percent: Math.round((count / total) * 100),
        color: meta.color,
      };
    }).sort((a, b) => b.count - a.count);
  }, [activeFormulas, isAr]);

  // Aggregate Daily Formulation Counts
  const dailyCountsData = useMemo(() => {
    const dateMap = new Map<string, { dateStr: string; timestamp: number; count: number; titles: string[] }>();

    activeFormulas.forEach((f) => {
      const d = new Date(f.dateCreated);
      const key = isNaN(d.getTime())
        ? new Date().toISOString().split('T')[0]
        : d.toISOString().split('T')[0];

      const existing = dateMap.get(key);
      const title = isAr ? f.title : (f.titleEn || f.title);
      if (existing) {
        existing.count += 1;
        existing.titles.push(title);
      } else {
        dateMap.set(key, {
          dateStr: key,
          timestamp: new Date(key).getTime(),
          count: 1,
          titles: [title],
        });
      }
    });

    const sorted = Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    // If fewer than 2 dates, add padding for visual continuity
    if (sorted.length === 1) {
      const single = sorted[0];
      const prevDate = new Date(single.timestamp - 86400000).toISOString().split('T')[0];
      sorted.unshift({
        dateStr: prevDate,
        timestamp: single.timestamp - 86400000,
        count: 0,
        titles: [],
      });
    }
    return sorted;
  }, [activeFormulas, isAr]);

  // D3 Chart 1: Most Used Raw Materials (Horizontal Bar Chart)
  useEffect(() => {
    if (!materialsChartRef.current) return;
    const svg = d3.select(materialsChartRef.current);
    svg.selectAll('*').remove();

    if (rawMaterialsData.length === 0) return;

    const width = 640;
    const height = Math.max(340, rawMaterialsData.length * 28 + 60);
    const margin = { top: 20, right: 30, bottom: 30, left: 140 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const yScale = d3
      .scaleBand()
      .domain(rawMaterialsData.map((d) => d.name))
      .range([0, innerHeight])
      .padding(0.25);

    const maxCount = d3.max(rawMaterialsData, (d) => d.count) || 5;
    const xScale = d3.scaleLinear().domain([0, maxCount + 1]).range([0, innerWidth]);

    // Gridlines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(5)
          .tickSize(-innerHeight)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-dasharray', '2,2');

    // Bars
    const bars = g.selectAll('.bar')
      .data(rawMaterialsData)
      .enter()
      .append('rect')
      .attr('class', 'bar cursor-pointer transition-all')
      .attr('y', (d) => yScale(d.name) || 0)
      .attr('height', yScale.bandwidth())
      .attr('x', 0)
      .attr('width', 0)
      .attr('rx', 4)
      .attr('fill', (d) => NOTE_CATEGORY_COLORS[d.category] || '#f59e0b')
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget as any).attr('opacity', 0.85);
        const categoryLabel =
          d.category === 'top'
            ? (isAr ? 'نوتة عليا (افتتاحية)' : 'Top Note')
            : d.category === 'heart'
            ? (isAr ? 'نوتة وسطى (قلب العطر)' : 'Heart Note')
            : (isAr ? 'نوتة قاعدية (قاعدة)' : 'Base Note');
        setActiveTooltip({
          x: event.clientX,
          y: event.clientY,
          title: d.name,
          content: `${isAr ? 'التكرار في التركيبات' : 'Formulation count'}: ${d.count} | ${categoryLabel}`,
        });
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget as any).attr('opacity', 1);
        setActiveTooltip(null);
      });

    bars.transition()
      .duration(750)
      .ease(d3.easeCubicOut)
      .attr('width', (d) => xScale(d.count));

    // Value Labels on Bars
    g.selectAll('.val-label')
      .data(rawMaterialsData)
      .enter()
      .append('text')
      .attr('class', 'val-label text-[11px] font-bold fill-stone-700')
      .attr('y', (d) => (yScale(d.name) || 0) + yScale.bandwidth() / 2 + 4)
      .attr('x', (d) => xScale(d.count) + 8)
      .text((d) => `${d.count}`);

    // Y Axis
    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale).tickSize(0))
      .attr('font-family', 'inherit')
      .attr('font-size', '11px');

    yAxis.select('.domain').attr('stroke', '#cbd5e1');
    yAxis.selectAll('text').attr('fill', '#334155').attr('font-weight', '500');

    // X Axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('d')))
      .attr('font-family', 'inherit')
      .attr('font-size', '11px');

    xAxis.select('.domain').attr('stroke', '#cbd5e1');
  }, [rawMaterialsData, isAr]);

  // D3 Chart 2: Preferred Concentration Types (Donut Chart)
  useEffect(() => {
    if (!concentrationChartRef.current) return;
    const svg = d3.select(concentrationChartRef.current);
    svg.selectAll('*').remove();

    if (concentrationData.length === 0) return;

    const width = 360;
    const height = 320;
    const radius = Math.min(width, height) / 2 - 20;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie<typeof concentrationData[0]>()
      .value((d) => d.count)
      .sort(null)
      .padAngle(0.03);

    const arc = d3.arc<d3.PieArcDatum<typeof concentrationData[0]>>()
      .innerRadius(radius * 0.58)
      .outerRadius(radius * 0.95)
      .cornerRadius(6);

    const hoverArc = d3.arc<d3.PieArcDatum<typeof concentrationData[0]>>()
      .innerRadius(radius * 0.55)
      .outerRadius(radius * 1.0)
      .cornerRadius(8);

    const slices = g.selectAll('.slice')
      .data(pie(concentrationData))
      .enter()
      .append('path')
      .attr('class', 'slice cursor-pointer transition-all')
      .attr('fill', (d) => d.data.color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget as any)
          .transition()
          .duration(200)
          .attr('d', hoverArc as any);
        setActiveTooltip({
          x: event.clientX,
          y: event.clientY,
          title: d.data.label,
          content: `${d.data.count} ${isAr ? 'تركيبة' : 'formulas'} (${d.data.percent}%)`,
        });
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget as any)
          .transition()
          .duration(200)
          .attr('d', arc as any);
        setActiveTooltip(null);
      });

    slices.transition()
      .duration(800)
      .attrTween('d', function (d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function (t) {
          return arc(i(t)) || '';
        };
      });

    // Center metric
    const totalCount = d3.sum(concentrationData, (d) => d.count);
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('class', 'text-2xl font-black fill-stone-900')
      .text(totalCount);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.4em')
      .attr('class', 'text-[11px] font-bold fill-stone-500 uppercase tracking-wider')
      .text(isAr ? 'تركيبة' : 'Formulas');
  }, [concentrationData, isAr]);

  // D3 Chart 3: Daily Formulation Counts (Time-Series Area Chart)
  useEffect(() => {
    if (!timelineChartRef.current) return;
    const svg = d3.select(timelineChartRef.current);
    svg.selectAll('*').remove();

    if (dailyCountsData.length === 0) return;

    const width = 640;
    const height = 280;
    const margin = { top: 25, right: 30, bottom: 40, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Gradient definition
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'area-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#d97706').attr('stop-opacity', 0.45);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#d97706').attr('stop-opacity', 0.02);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scalePoint()
      .domain(dailyCountsData.map((d) => d.dateStr))
      .range([0, innerWidth])
      .padding(0.15);

    const maxCount = d3.max(dailyCountsData, (d) => d.count) || 1;
    const yScale = d3.scaleLinear().domain([0, maxCount + 1]).range([innerHeight, 0]);

    // Gridlines
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale).ticks(4).tickSize(-innerWidth).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', '#f1f5f9')
      .attr('stroke-dasharray', '3,3');

    // Area generator
    const area = d3.area<typeof dailyCountsData[0]>()
      .x((d) => xScale(d.dateStr) || 0)
      .y0(innerHeight)
      .y1((d) => yScale(d.count))
      .curve(d3.curveMonotoneX);

    // Line generator
    const line = d3.line<typeof dailyCountsData[0]>()
      .x((d) => xScale(d.dateStr) || 0)
      .y((d) => yScale(d.count))
      .curve(d3.curveMonotoneX);

    // Render Area
    g.append('path')
      .datum(dailyCountsData)
      .attr('fill', 'url(#area-gradient)')
      .attr('d', area);

    // Render Line
    const path = g.append('path')
      .datum(dailyCountsData)
      .attr('fill', 'none')
      .attr('stroke', '#d97706')
      .attr('stroke-width', 2.5)
      .attr('d', line);

    // Animate line
    const totalLength = (path.node() as SVGPathElement)?.getTotalLength() || 1000;
    path.attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(1000)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    // Dots
    g.selectAll('.dot')
      .data(dailyCountsData)
      .enter()
      .append('circle')
      .attr('class', 'dot cursor-pointer')
      .attr('cx', (d) => xScale(d.dateStr) || 0)
      .attr('cy', (d) => yScale(d.count))
      .attr('r', 4.5)
      .attr('fill', '#ffffff')
      .attr('stroke', '#d97706')
      .attr('stroke-width', 2.5)
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget as any).attr('r', 7).attr('fill', '#d97706');
        const titlesText = d.titles.length > 0 ? ` (${d.titles.slice(0, 3).join('، ')})` : '';
        setActiveTooltip({
          x: event.clientX,
          y: event.clientY,
          title: d.dateStr,
          content: `${isAr ? 'عدد التركيبات' : 'Formulations'}: ${d.count}${titlesText}`,
        });
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget as any).attr('r', 4.5).attr('fill', '#ffffff');
        setActiveTooltip(null);
      });

    // X Axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(4))
      .attr('font-family', 'inherit')
      .attr('font-size', '10px');

    xAxis.select('.domain').attr('stroke', '#cbd5e1');
    xAxis.selectAll('text').attr('fill', '#64748b').attr('transform', 'rotate(-25)').style('text-anchor', 'end');

    // Y Axis
    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale).ticks(4).tickFormat(d3.format('d')))
      .attr('font-family', 'inherit')
      .attr('font-size', '11px');

    yAxis.select('.domain').attr('stroke', '#cbd5e1');
    yAxis.selectAll('text').attr('fill', '#64748b');
  }, [dailyCountsData, isAr]);

  // Export Analytics JSON
  const handleExportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      totalFormulas: activeFormulas.length,
      rawMaterials: rawMaterialsData,
      concentrationBreakdown: concentrationData,
      dailyTrend: dailyCountsData,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sham_perfumer_analytics_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header & Controls */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-amber-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{isAr ? 'ذكاء معمل العطور وتحليلات البيانات' : 'Fragrance Lab Intelligence & D3 Analytics'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isAr ? 'تحليلات العطّار وإحصائيات التركيبات' : 'Perfumer Analytics & Formulation Insights'}
            </h1>
            <p className="text-stone-300 text-sm max-w-2xl leading-relaxed">
              {isAr
                ? 'استكشف المكونات الخام الأكثر استخداماً في تركيباتك، وتوزيع التراكيز العطرية المفضلة، ومعدل التطوير اليومي عبر رسوم D3.js البيانية التفاعلية.'
                : 'Explore your most frequently used raw materials, preferred fragrance concentrations, and daily formulation rhythm rendered with interactive D3.js visual charts.'}
            </p>
          </div>

          {/* Action Buttons & Preset Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 bg-stone-800/80 hover:bg-stone-800 px-3.5 py-2 rounded-xl border border-stone-700/60 cursor-pointer text-xs font-semibold text-stone-200 transition-colors">
              <input
                type="checkbox"
                checked={includePresets}
                onChange={(e) => setIncludePresets(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
              />
              <span>{isAr ? 'تضمين وصفات دار شام الجاهزة' : 'Include Platform Presets'}</span>
            </label>

            <button
              onClick={handleExportData}
              className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isAr ? 'تصدير البيانات' : 'Export Data'}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="mt-6 pt-6 border-t border-stone-700/60 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-400" />
            <span className="text-stone-400">{isAr ? 'النطاق الزمني:' : 'Timeframe:'}</span>
            <div className="inline-flex rounded-lg bg-stone-800/90 p-1 border border-stone-700/80">
              <button
                onClick={() => setTimeFilter('all')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  timeFilter === 'all' ? 'bg-amber-600 text-stone-950' : 'text-stone-300 hover:text-white'
                }`}
              >
                {isAr ? 'الكل' : 'All Time'}
              </button>
              <button
                onClick={() => setTimeFilter('30d')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  timeFilter === '30d' ? 'bg-amber-600 text-stone-950' : 'text-stone-300 hover:text-white'
                }`}
              >
                {isAr ? 'آخر 30 يوماً' : '30 Days'}
              </button>
              <button
                onClick={() => setTimeFilter('7d')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  timeFilter === '7d' ? 'bg-amber-600 text-stone-950' : 'text-stone-300 hover:text-white'
                }`}
              >
                {isAr ? 'آخر 7 أيام' : '7 Days'}
              </button>
            </div>
          </div>

          <div className="text-stone-400 text-xs">
            {isAr
              ? `يتم تحليل ${activeFormulas.length} تركيبة عطرية (${savedFormulas.length} من مكتبتك الشخصية)`
              : `Analyzing ${activeFormulas.length} formulas (${savedFormulas.length} from your saved library)`}
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-stone-900">{activeFormulas.length}</div>
            <div className="text-xs font-semibold text-stone-500">{isAr ? 'إجمالي التركيبات' : 'Formulations'}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Atom className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-stone-900">{rawMaterialsData.length}</div>
            <div className="text-xs font-semibold text-stone-500">{isAr ? 'مواد خام نشطة' : 'Raw Materials'}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <PieChart className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-black text-stone-900 truncate">
              {concentrationData[0]?.label || (isAr ? 'غير محدد' : 'N/A')}
            </div>
            <div className="text-xs font-semibold text-stone-500">{isAr ? 'التركيز المفضل' : 'Dominant Type'}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-black text-stone-900 truncate">
              {rawMaterialsData[0]?.name || (isAr ? 'الياسمين والمسك' : 'Rose / Musk')}
            </div>
            <div className="text-xs font-semibold text-stone-500">{isAr ? 'المادة الأكثر استخداماً' : 'Top Raw Material'}</div>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart 1: Most Used Raw Materials (Spans 2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-stone-200/90 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-extrabold text-stone-900">
                  {isAr ? 'المواد الخام الأكثر استخداماً' : 'Most Used Raw Materials'}
                </h2>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {isAr
                  ? 'معدل تكرار استخدام الزيوت والمواد العطرية في تركيباتك مع ترميز موقع النوتة'
                  : 'Frequency of raw aromatic notes across your formulas, categorized by pyramid role'}
              </p>
            </div>

            {/* Note category legend */}
            <div className="flex items-center gap-3 text-[11px] font-semibold text-stone-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                {isAr ? 'افتتاحية (Top)' : 'Top'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                {isAr ? 'قلب (Heart)' : 'Heart'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                {isAr ? 'قاعدة (Base)' : 'Base'}
              </span>
            </div>
          </div>

          {rawMaterialsData.length === 0 ? (
            <div className="py-16 text-center text-stone-400 text-sm">
              {isAr ? 'لا توجد بيانات مواد خام كافية للتحليل' : 'No raw material data found'}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <svg ref={materialsChartRef} className="w-full h-auto min-w-[500px]" />
            </div>
          )}
        </div>

        {/* Chart 2: Preferred Concentration Types (Donut) */}
        <div className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
              <PieChart className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-lg font-extrabold text-stone-900">
                  {isAr ? 'أنواع التراكيز المفضلة' : 'Preferred Concentrations'}
                </h2>
                <p className="text-xs text-stone-500">
                  {isAr ? 'النسبة المئوية لكل تصنيف تركيز' : 'Percentage breakdown by concentration grade'}
                </p>
              </div>
            </div>

            <div className="w-full flex justify-center py-4">
              <svg ref={concentrationChartRef} className="w-full max-w-[280px] h-auto" />
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-2 pt-4 border-t border-stone-100 max-h-48 overflow-y-auto">
            {concentrationData.map((item) => (
              <div key={item.type} className="flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-stone-700 truncate max-w-[140px]">{item.label}</span>
                </div>
                <div className="text-stone-500 font-bold">
                  {item.count} ({item.percent}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 3: Daily Formulation Trend (Full width) */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="text-lg font-extrabold text-stone-900">
                {isAr ? 'معدل الابتكار والتطوير اليومي' : 'Daily Formulation Rhythm'}
              </h2>
              <p className="text-xs text-stone-500">
                {isAr
                  ? 'عدد التركيبات والعطور المسجلة على مدار الأيام (D3 Smooth Timeline Curve)'
                  : 'Time-series curve of recorded fragrance formulations by date'}
              </p>
            </div>
          </div>
          <div className="text-xs text-stone-400 font-medium">
            {isAr ? 'مرر الفأرة على النقاط لعرض أسماء التركيبات' : 'Hover over points to see formula names'}
          </div>
        </div>

        {dailyCountsData.length === 0 ? (
          <div className="py-16 text-center text-stone-400 text-sm">
            {isAr ? 'لا توجد بيانات زمنية كافية' : 'No time-series data available'}
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg ref={timelineChartRef} className="w-full h-auto min-w-[560px]" />
          </div>
        )}
      </div>

      {/* Interactive Floating Tooltip */}
      {activeTooltip && (
        <div
          className="fixed pointer-events-none z-50 bg-stone-900/95 text-white px-3.5 py-2.5 rounded-xl text-xs shadow-2xl border border-stone-700 max-w-xs transition-opacity duration-150 backdrop-blur-xs"
          style={{
            left: `${activeTooltip.x + 15}px`,
            top: `${activeTooltip.y - 45}px`,
          }}
        >
          <div className="font-bold text-amber-400">{activeTooltip.title}</div>
          <div className="text-stone-300 mt-0.5">{activeTooltip.content}</div>
        </div>
      )}
    </div>
  );
};
