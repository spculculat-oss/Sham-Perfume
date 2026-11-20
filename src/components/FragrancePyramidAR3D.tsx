import React, { useEffect, useRef, useState } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { SupportedLanguage } from '../types/i18n';
import { makeT } from '../لغات/localize';
import { formatNum } from '../utils/calculations';
import { AR3DSpatialStage } from './AR3DSpatialStage';

export type PyramidTierFilter = 'all' | 'top' | 'heart' | 'base';

interface FragrancePyramidAR3DProps {
  currentLang: SupportedLanguage;
  topPct: number;
  heartPct: number;
  basePct: number;
  selectedTier: PyramidTierFilter;
  onSelectTier: (tier: PyramidTierFilter) => void;
  isTopActive: boolean;
  isHeartActive: boolean;
  isBaseActive: boolean;
  activeSillagePercent: number;
  currentMinutes: number;
}

const PYR_STRINGS = {
  title: {
    ar: 'الهرم العطري ثلاثي الأبعاد والواقع المعزز',
    en: '3D & AR Olfactory Pyramid Architecture',
    fr: 'Pyramide olfactive 3D & RA',
    es: 'Pirámide olfativa 3D y RA',
    it: 'Piramide olfattiva 3D & AR',
    de: '3D & AR Duftpyramide',
    ru: '3D и AR пирамида аромата',
    zh: '3D 与 AR 香调金字塔',
    tr: '3D & AR Koku Piramidi',
    fa: 'هرم عطری سه‌بعدی و واقعیت افزوده',
  },
  subtitle: {
    ar: 'انقر على أي طبقة من الهرم الثلاثي الأبعاد لعزل مكوناتها، أو فعّل الكاميرا لمعاينة الهرم في محيطك',
    en: 'Click any 3D tier to filter its notes, or enable AR camera to project the pyramid on your workbench',
    fr: 'Cliquez sur un niveau 3D pour filtrer ses notes ou activez la caméra RA',
    es: 'Haz clic en cualquier nivel 3D para filtrar notas o activa la cámara RA',
    it: 'Clicca su un livello 3D per filtrare le note o attiva la fotocamera AR',
    de: 'Klicken Sie auf eine 3D-Ebene zum Filtern oder aktivieren Sie die AR-Kamera',
    ru: 'Нажмите на любой 3D-ярус для фильтрации нот или включите AR-камеру',
    zh: '点击任意 3D 层级筛选香材，或开启 AR 相机投影到桌面',
    tr: 'Notaları filtrelemek için 3D katmanlara tıklayın veya AR kamerayı açın',
    fa: 'برای فیلتر نت‌ها روی هر طبقه سه‌بعدی کلیک کنید یا دوربین AR را روشن کنید',
  },
  badge: {
    ar: 'معمار الهرم 3D / AR',
    en: 'Pyramid 3D / AR',
    fr: 'Pyramide 3D / RA',
    es: 'Pirámide 3D / RA',
    it: 'Piramide 3D / AR',
    de: 'Pyramiden-3D / AR',
    ru: 'Пирамида 3D / AR',
    zh: '金字塔 3D / AR',
    tr: 'Piramit 3D / AR',
    fa: 'هرم 3D / AR',
  },
  top_lbl: {
    ar: 'القمة',
    en: 'Top',
    fr: 'Tête',
    es: 'Salida',
    it: 'Testa',
    de: 'Kopf',
    ru: 'Верх',
    zh: '前调',
    tr: 'Üst',
    fa: 'ابتدایی',
  },
  heart_lbl: {
    ar: 'القلب',
    en: 'Heart',
    fr: 'Cœur',
    es: 'Corazón',
    it: 'Cuore',
    de: 'Herz',
    ru: 'Сердце',
    zh: '中调',
    tr: 'Kalp',
    fa: 'میانی',
  },
  base_lbl: {
    ar: 'القاعدة',
    en: 'Base',
    fr: 'Fond',
    es: 'Fondo',
    it: 'Fondo',
    de: 'Basis',
    ru: 'База',
    zh: '后调',
    tr: 'Dip',
    fa: 'پایه',
  },
  all_lbl: {
    ar: 'الكل',
    en: 'All',
    fr: 'Tout',
    es: 'Todo',
    it: 'Tutto',
    de: 'Alle',
    ru: 'Все',
    zh: '全部',
    tr: 'Tümü',
    fa: 'همه',
  },
  sillage_lbl: {
    ar: 'هالة الفوحان',
    en: 'Sillage',
    fr: 'Sillage',
    es: 'Estela',
    it: 'Scia',
    de: 'Sillage',
    ru: 'Шлейф',
    zh: '扩散度',
    tr: 'Yayılım',
    fa: 'انتشار',
  },
};

const PyramidSculptureScene: React.FC<{
  topPct: number;
  heartPct: number;
  basePct: number;
  selectedTier: PyramidTierFilter;
  onSelectTier: (tier: PyramidTierFilter) => void;
  isTopActive: boolean;
  isHeartActive: boolean;
  isBaseActive: boolean;
  activeSillagePercent: number;
  exploded: boolean;
  isSoftwareGl: boolean;
}> = ({
  topPct,
  heartPct,
  basePct,
  selectedTier,
  onSelectTier,
  isTopActive,
  isHeartActive,
  isBaseActive,
  activeSillagePercent,
  exploded,
  isSoftwareGl,
}) => {
  const rootRef = useRef<THREE.Group>(null);
  const baseRef = useRef<THREE.Group>(null);
  const heartRef = useRef<THREE.Group>(null);
  const topRef = useRef<THREE.Group>(null);
  const crownRingRef = useRef<THREE.Mesh>(null);
  const sillageWaveRef = useRef<THREE.Mesh>(null);
  const sillageOuterRef = useRef<THREE.Mesh>(null);

  const baseMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const heartMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const topMatRef = useRef<THREE.MeshPhysicalMaterial>(null);

  const [hoveredTier, setHoveredTier] = useState<'top' | 'heart' | 'base' | null>(null);
  const pointerDownPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    document.body.style.cursor = hoveredTier ? 'pointer' : 'auto';
  }, [hoveredTier]);

  useEffect(() => () => {
    document.body.style.cursor = 'auto';
  }, []);

  // Scale heights subtly with tier percentages while keeping architectural silhouette
  const hBase = THREE.MathUtils.clamp(0.45 + (basePct / 100) * 0.55, 0.45, 0.95);
  const hHeart = THREE.MathUtils.clamp(0.42 + (heartPct / 100) * 0.55, 0.42, 0.92);
  const hTop = THREE.MathUtils.clamp(0.42 + (topPct / 100) * 0.52, 0.42, 0.9);

  const baseCenterY = 0.08 + hBase / 2;
  const heartCenterY = 0.08 + hBase + 0.06 + hHeart / 2;
  const topCenterY = 0.08 + hBase + 0.06 + hHeart + 0.06 + hTop / 2;

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleUp = (tier: 'top' | 'heart' | 'base', e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (Math.hypot(e.clientX - pointerDownPos.current.x, e.clientY - pointerDownPos.current.y) > 7) {
      return;
    }
    onSelectTier(selectedTier === tier ? 'all' : tier);
  };

  useFrame((state, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);
    const t = state.clock.elapsedTime;

    if (rootRef.current) {
      rootRef.current.rotation.y += dt * 0.24;
    }

    const baseTargetY = baseCenterY + (exploded ? 0.0 : 0);
    const heartTargetY = heartCenterY + (exploded ? 0.58 : 0);
    const topTargetY = topCenterY + (exploded ? 1.18 : 0) + (isTopActive ? Math.sin(t * 2.2) * 0.04 : 0);

    if (baseRef.current) {
      baseRef.current.position.y = THREE.MathUtils.damp(baseRef.current.position.y, baseTargetY, 7, dt);
      const s = hoveredTier === 'base' || selectedTier === 'base' ? 1.07 : 1.0;
      const ns = THREE.MathUtils.damp(baseRef.current.scale.x, s, 8, dt);
      baseRef.current.scale.setScalar(ns);
    }

    if (heartRef.current) {
      heartRef.current.position.y = THREE.MathUtils.damp(heartRef.current.position.y, heartTargetY, 7, dt);
      const s = hoveredTier === 'heart' || selectedTier === 'heart' ? 1.08 : 1.0;
      const ns = THREE.MathUtils.damp(heartRef.current.scale.x, s, 8, dt);
      heartRef.current.scale.setScalar(ns);
    }

    if (topRef.current) {
      topRef.current.position.y = THREE.MathUtils.damp(topRef.current.position.y, topTargetY, 7, dt);
      const s = hoveredTier === 'top' || selectedTier === 'top' ? 1.1 : 1.0;
      const ns = THREE.MathUtils.damp(topRef.current.scale.x, s, 8, dt);
      topRef.current.scale.setScalar(ns);
    }

    if (crownRingRef.current) {
      crownRingRef.current.rotation.z = t * 0.7;
      crownRingRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 1.1) * 0.14;
    }

    const sillageRatio = THREE.MathUtils.clamp(activeSillagePercent / 100, 0.2, 1.0);
    if (sillageWaveRef.current) {
      const waveScale = 0.8 + sillageRatio * 1.1 + Math.sin(t * 2.0) * 0.06;
      sillageWaveRef.current.scale.set(waveScale, waveScale, 1);
    }
    if (sillageOuterRef.current) {
      const outerScale = 1.05 + sillageRatio * 1.45 + Math.cos(t * 1.6) * 0.08;
      sillageOuterRef.current.scale.set(outerScale, outerScale, 1);
    }

    // Highlight active / hovered / selected tiers
    if (baseMatRef.current) {
      const active = isBaseActive || hoveredTier === 'base' || selectedTier === 'base';
      baseMatRef.current.emissiveIntensity = THREE.MathUtils.damp(
        baseMatRef.current.emissiveIntensity,
        hoveredTier === 'base' ? 0.65 : active ? 0.36 : 0.08,
        8,
        dt,
      );
    }
    if (heartMatRef.current) {
      const active = isHeartActive || hoveredTier === 'heart' || selectedTier === 'heart';
      heartMatRef.current.emissiveIntensity = THREE.MathUtils.damp(
        heartMatRef.current.emissiveIntensity,
        hoveredTier === 'heart' ? 0.72 : active ? 0.42 : 0.1,
        8,
        dt,
      );
    }
    if (topMatRef.current) {
      const active = isTopActive || hoveredTier === 'top' || selectedTier === 'top';
      topMatRef.current.emissiveIntensity = THREE.MathUtils.damp(
        topMatRef.current.emissiveIntensity,
        hoveredTier === 'top' ? 0.85 : active ? 0.48 : 0.12,
        8,
        dt,
      );
    }
  });

  const activeSparkleColor = isTopActive ? '#fde047' : isHeartActive ? '#f472b6' : '#f59e0b';

  return (
    <group>
      {/* Expanding Sillage Projection Rings */}
      <mesh ref={sillageWaveRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
        <ringGeometry args={[1.05, 1.12, 56]} />
        <meshBasicMaterial color={activeSparkleColor} transparent opacity={0.42} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={sillageOuterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[1.28, 1.33, 56]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>

      {/* Main Rotating 3D Pyramid Architecture */}
      <group ref={rootRef}>
        {/* Grounded Brass Plinth */}
        <mesh position={[0, 0.04, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={!isSoftwareGl}>
          <cylinderGeometry args={[1.45, 1.55, 0.08, 4]} />
          <meshStandardMaterial color={0x292524} metalness={0.55} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.082, 0]} rotation={[0, Math.PI / 4, 0]}>
          <cylinderGeometry args={[1.38, 1.44, 0.018, 4]} />
          <meshStandardMaterial color={0xd4af37} metalness={0.92} roughness={0.2} />
        </mesh>

        {/* Central Crystal Core Axis (visible in Exploded View) */}
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.045, 0.06, exploded ? 2.4 : 1.5, 16]} />
          <meshStandardMaterial
            color={0xfef3c7}
            emissive={0xf59e0b}
            emissiveIntensity={exploded ? 0.55 : 0.15}
            metalness={0.35}
            roughness={0.18}
          />
        </mesh>

        {/* TIER 3: BASE ANCHOR */}
        <group
          ref={baseRef}
          position={[0, baseCenterY, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredTier('base');
          }}
          onPointerOut={() => setHoveredTier((prev) => (prev === 'base' ? null : prev))}
          onPointerDown={handleDown}
          onPointerUp={(e) => handleUp('base', e)}
        >
          <mesh rotation={[0, Math.PI / 4, 0]} castShadow={!isSoftwareGl} receiveShadow>
            <cylinderGeometry args={[0.92, 1.34, hBase, 4]} />
            <meshStandardMaterial
              ref={baseMatRef}
              color={0x78350f}
              emissive={0xd97706}
              emissiveIntensity={0.1}
              metalness={0.42}
              roughness={0.38}
            />
          </mesh>
          <mesh position={[0, -hBase / 2 + 0.03, 0]} rotation={[0, Math.PI / 4, 0]}>
            <cylinderGeometry args={[1.32, 1.35, 0.04, 4]} />
            <meshStandardMaterial color={0xd4af37} metalness={0.9} roughness={0.22} />
          </mesh>
        </group>

        {/* TIER 2: HEART BOUQUET */}
        <group
          ref={heartRef}
          position={[0, heartCenterY, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredTier('heart');
          }}
          onPointerOut={() => setHoveredTier((prev) => (prev === 'heart' ? null : prev))}
          onPointerDown={handleDown}
          onPointerUp={(e) => handleUp('heart', e)}
        >
          <mesh rotation={[0, Math.PI / 4, 0]} castShadow={!isSoftwareGl} receiveShadow>
            <cylinderGeometry args={[0.5, 0.88, hHeart, 4]} />
            <meshStandardMaterial
              ref={heartMatRef}
              color={0xbe185d}
              emissive={0xf472b6}
              emissiveIntensity={0.12}
              metalness={0.34}
              roughness={0.24}
            />
          </mesh>
          <mesh position={[0, -hHeart / 2 + 0.025, 0]} rotation={[0, Math.PI / 4, 0]}>
            <cylinderGeometry args={[0.88, 0.9, 0.03, 4]} />
            <meshStandardMaterial color={0xfde68a} metalness={0.9} roughness={0.2} />
          </mesh>
        </group>

        {/* TIER 1: TOP APEX */}
        <group
          ref={topRef}
          position={[0, topCenterY, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredTier('top');
          }}
          onPointerOut={() => setHoveredTier((prev) => (prev === 'top' ? null : prev))}
          onPointerDown={handleDown}
          onPointerUp={(e) => handleUp('top', e)}
        >
          <mesh rotation={[0, Math.PI / 4, 0]} castShadow={!isSoftwareGl}>
            <coneGeometry args={[0.48, hTop, 4]} />
            <meshPhysicalMaterial
              ref={topMatRef}
              color={0xfbbf24}
              emissive={0xf59e0b}
              emissiveIntensity={0.15}
              metalness={0.18}
              roughness={0.12}
              clearcoat={1}
              clearcoatRoughness={0.08}
            />
          </mesh>
          <mesh ref={crownRingRef} position={[0, hTop * 0.42, 0]}>
            <torusGeometry args={[0.26, 0.015, 10, 36]} />
            <meshStandardMaterial color={0xfef08a} metalness={0.95} roughness={0.15} />
          </mesh>
        </group>
      </group>

      {/* Ascending Volatility Sparkles */}
      <Sparkles
        count={isSoftwareGl ? 32 : 70}
        scale={[2.6, 2.8, 2.6]}
        position={[0, 1.5, 0]}
        size={2.3}
        speed={0.42}
        opacity={0.75}
        color={activeSparkleColor}
      />
    </group>
  );
};

export const FragrancePyramidAR3D: React.FC<FragrancePyramidAR3DProps> = ({
  currentLang,
  topPct,
  heartPct,
  basePct,
  selectedTier,
  onSelectTier,
  isTopActive,
  isHeartActive,
  isBaseActive,
  activeSillagePercent,
  currentMinutes,
}) => {
  const L = makeT(currentLang, PYR_STRINGS);
  const [exploded, setExploded] = useState(false);

  const activeTierTitle = isTopActive
    ? `${L('top_lbl')} (${formatNum(topPct, 1)}%)`
    : isHeartActive
    ? `${L('heart_lbl')} (${formatNum(heartPct, 1)}%)`
    : `${L('base_lbl')} (${formatNum(basePct, 1)}%)`;

  return (
    <AR3DSpatialStage
      currentLang={currentLang}
      title={L('title')}
      subtitle={L('subtitle')}
      badgeText={L('badge')}
      heightClass="h-[340px] sm:h-[390px]"
      cameraSpec={{ position: [0, 2.15, 4.55], target: [0, 0.95, 0] }}
      exploded={exploded}
      onToggleExploded={() => setExploded((v) => !v)}
      groundRadius={1.85}
      topLeftOverlay={
        <div className="px-3 py-1.5 rounded-xl bg-stone-950/90 border border-stone-800 text-[11px] font-mono text-amber-300 space-y-0.5">
          <div>
            {currentMinutes}m · {activeTierTitle}
          </div>
          <div className="text-[10px] text-stone-400">
            {L('sillage_lbl')}: {activeSillagePercent}%
          </div>
        </div>
      }
      bottomExtraControls={
        <div className="flex items-center gap-1 flex-wrap">
          {(
            [
              ['all', L('all_lbl'), null],
              ['top', L('top_lbl'), topPct],
              ['heart', L('heart_lbl'), heartPct],
              ['base', L('base_lbl'), basePct],
            ] as Array<[PyramidTierFilter, string, number | null]>
          ).map(([id, label, pct]) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTier(id)}
              className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                selectedTier === id
                  ? 'bg-amber-500 text-stone-950 border-amber-400'
                  : 'bg-stone-950 text-stone-300 border-stone-700 hover:text-white'
              }`}
            >
              {label}
              {pct !== null ? ` ${formatNum(pct, 0)}%` : ''}
            </button>
          ))}
        </div>
      }
    >
      {({ isSoftwareGl, exploded: isExp }) => (
        <PyramidSculptureScene
          topPct={topPct}
          heartPct={heartPct}
          basePct={basePct}
          selectedTier={selectedTier}
          onSelectTier={onSelectTier}
          isTopActive={isTopActive}
          isHeartActive={isHeartActive}
          isBaseActive={isBaseActive}
          activeSillagePercent={activeSillagePercent}
          exploded={isExp}
          isSoftwareGl={isSoftwareGl}
        />
      )}
    </AR3DSpatialStage>
  );
};
