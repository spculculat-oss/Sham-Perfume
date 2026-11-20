import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Droplets, FlaskConical, Flame, Layers, Wind } from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { makeT, fmt } from '../لغات/localize';
import { formatNum } from '../utils/calculations';
import { AR3DSpatialStage, AR3DStageCameraSpec } from './AR3DSpatialStage';

const SIM_STRINGS = {
  scale_title: {
    ar: 'الميزان والمخبار الزجاجي ثلاثي الأبعاد والواقع المعزز',
    en: '3D & AR Precision Balance and Layered Beaker',
    fr: 'Balance 3D/RA et bécher multicouche',
    es: 'Balanza 3D/RA y vaso multicapa',
    it: 'Bilancia 3D/AR e becher multistrato',
    de: '3D/AR Laborwaage & Schicht-Becher',
    ru: '3D и AR весы и многослойный стакан',
    zh: '3D 与 AR 精密天平与分层烧杯',
    tr: '3D/AR Hassas Terazi ve Katmanlı Beher',
    fa: 'ترازو و بشر سه‌بعدی و واقعیت افزوده',
  },
  scale_sub: {
    ar: 'معاينة طبقات الزيت والمثبت والماء والكحول بالمخبار فوق الميزان؛ انقر على الميزان لتبديل التصفير',
    en: 'Inspect Oil, Fixative, Water & Ethanol strata inside the beaker; click the scale pan to toggle Tare',
    fr: 'Inspectez huile, fixateur, eau et éthanol ; cliquez sur le plateau pour la tare',
    es: 'Inspecciona aceite, fijador, agua y etanol; haz clic en el plato para tarar',
    it: 'Ispeziona olio, fissante, acqua ed etanolo; clicca sul piatto per la tara',
    de: 'Öl-, Fixativ-, Wasser- und Ethanolschichten prüfen; auf Waagschale klicken für Tara',
    ru: 'Осмотрите слои масла, фиксатора, воды и этанола; нажмите на чашу для тары',
    zh: '查看烧杯内精油、定香剂、水与乙醇分层；点击秤盘切换去皮',
    tr: 'Beher içindeki katmanları inceleyin; dara için kefeye tıklayın',
    fa: 'لایه‌های روغن، ثابت‌کننده، آب و اتانول را ببینید؛ برای صفر کردن روی ترازو کلیک کنید',
  },
  scale_badge: {
    ar: 'محاكي التوزين 3D / AR',
    en: 'Weighing 3D / AR',
    fr: 'Pesée 3D / RA',
    es: 'Pesaje 3D / RA',
    it: 'Pesatura 3D / AR',
    de: 'Wägen 3D / AR',
    ru: 'Взвешивание 3D / AR',
    zh: '称量 3D / AR',
    tr: 'Tartım 3D / AR',
    fa: 'توزین 3D / AR',
  },
  tare_btn: {
    ar: 'تصفير الميزان (Tare)',
    en: 'Toggle Tare',
    fr: 'Tare',
    es: 'Tara',
    it: 'Tara',
    de: 'Tara',
    ru: 'Тара',
    zh: '去皮',
    tr: 'Dara',
    fa: 'صفر کردن',
  },
  spray_title: {
    ar: 'محاكي الرش والتبخر ثلاثي الأبعاد والواقع المعزز',
    en: '3D & AR Perfume Atomization & Skin Adhesion',
    fr: 'Atomisation 3D/RA et fixation cutanée',
    es: 'Atomización 3D/RA y adhesión cutánea',
    it: 'Atomizzazione 3D/AR e adesione cutanea',
    de: '3D/AR Zerstäubung & Hautbindung',
    ru: '3D и AR распыление и фиксация на коже',
    zh: '3D 与 AR 雾化喷洒与肌肤附着模拟',
    tr: '3D/AR Püskürtme ve Cilt Tutunması',
    fa: 'شبیه‌ساز سه‌بعدی و AR اسپری و جذب پوست',
  },
  spray_sub: {
    ar: 'اضغط على البخاخ الثلاثي الأبعاد أو فعّل الرش المستمر لمشاهدة تطاير الكحول ورسو الزيوت وهالة الفوحان',
    en: 'Click the 3D flacon atomizer or enable continuous mist to inspect alcohol flash-off and sillage waves',
    fr: 'Cliquez sur le flacon 3D pour vaporiser et observer les vagues de sillage',
    es: 'Haz clic en el atomizador 3D para pulverizar y observar la estela',
    it: 'Clicca sullo spruzzatore 3D per nebulizzare e osservare la scia',
    de: 'Auf den 3D-Zerstäuber klicken für Nebel, Hautbindung und Sillage-Wellen',
    ru: 'Нажмите на 3D-флакон для распыления и наблюдения шлейфа',
    zh: '点击 3D 香水喷头或开启持续雾化，观察乙醇闪蒸、油滴附着与扩散波纹',
    tr: 'Püskürtmek ve yayılım dalgalarını izlemek için 3D şişeye tıklayın',
    fa: 'برای اسپری و مشاهده امواج رایحه روی شیشه سه‌بعدی کلیک کنید',
  },
  spray_badge: {
    ar: 'محاكي الرذاذ 3D / AR',
    en: 'Aerosol 3D / AR',
    fr: 'Aérosol 3D / RA',
    es: 'Aerosol 3D / RA',
    it: 'Aerosol 3D / AR',
    de: 'Aerosol 3D / AR',
    ru: 'Спрей 3D / AR',
    zh: '喷雾 3D / AR',
    tr: 'Sprey 3D / AR',
    fa: 'اسپری 3D / AR',
  },
  spray_now: {
    ar: 'بَخّة عطر',
    en: 'Spray Now',
    fr: 'Vaporiser',
    es: 'Pulverizar',
    it: 'Spruzza',
    de: 'Sprühen',
    ru: 'Распылить',
    zh: '立即喷洒',
    tr: 'Püskürt',
    fa: 'اسپری',
  },
  continuous_mist: {
    ar: 'رش مستمر',
    en: 'Continuous',
    fr: 'Continu',
    es: 'Continuo',
    it: 'Continuo',
    de: 'Dauerhaft',
    ru: 'Непрерывно',
    zh: '持续雾化',
    tr: 'Sürekli',
    fa: 'مداوم',
  },
  maceration_title: {
    ar: 'وعاء التعتيق والتشابك الجزيئي ثلاثي الأبعاد والواقع المعزز',
    en: '3D & AR Maceration Vessel & Molecular Cross-Linking',
    fr: 'Flacon de macération 3D/RA et liaisons moléculaires',
    es: 'Envase de maceración 3D/RA y enlaces moleculares',
    it: 'Contenitore di macerazione 3D/AR e legami molecolari',
    de: '3D/AR Mazerationsgefäß & Estervernetzung',
    ru: '3D и AR сосуд мацерации и молекулярные связи',
    zh: '3D 与 AR 陈化容器与分子交联演示',
    tr: '3D/AR Maserasyon Kabı ve Moleküler Bağlanma',
    fa: 'مخزن سه‌بعدی و AR تعتیق و پیوند مولکولی',
  },
  maceration_sub: {
    ar: 'يتغير شكل الوعاء والمجال الجزيئي وفق وسط التخزين المختار ونسبة النضوج الزمني ({p}%)',
    en: 'Vessel housing and molecular ester rings respond dynamically to your storage choice and maturation progress ({p}%)',
    fr: 'Le flacon et les anneaux moléculaires s’adaptent au stockage et à la maturation ({p}%)',
    es: 'El envase y los anillos moleculares responden al almacenamiento y maduración ({p}%)',
    it: 'Il contenitore e gli anelli molecolari riflettono conservazione e maturazione ({p}%)',
    de: 'Gefäß und molekulare Ringe reagieren auf Lagerung und Reifegrad ({p}%)',
    ru: 'Сосуд и молекулярные кольца отражают тип хранения и прогресс созревания ({p}%)',
    zh: '容器造型与分子交联环随储存介质及成熟度（{p}%）动态变化',
    tr: 'Kap ve moleküler halkalar depolama türüne ve olgunlaşmaya ({p}%) göre değişir',
    fa: 'ظرف و حلقه‌های مولکولی بر اساس نوع نگهداری و پیشرفت بلوغ ({p}٪) تغییر می‌کنند',
  },
  maceration_badge: {
    ar: 'محاكي التعتيق 3D / AR',
    en: 'Aging 3D / AR',
    fr: 'Maturation 3D / RA',
    es: 'Maduración 3D / RA',
    it: 'Maturazione 3D / AR',
    de: 'Reifung 3D / AR',
    ru: 'Мацерация 3D / AR',
    zh: '陈化 3D / AR',
    tr: 'Maserasyon 3D / AR',
    fa: 'تعتیق 3D / AR',
  },
};

/* ============================================================================
 * 1. SCALE & BEAKER 3D / AR SIMULATOR
 * ============================================================================ */

interface ScaleBeakerAR3DProps {
  currentLang: SupportedLanguage;
  bottleVolumeMl: number;
  oilGrams: number;
  alcoholGrams: number;
  fixativeGrams: number;
  waterGrams: number;
  totalGrams: number;
  oilHeightPct: number;
  fixativeHeightPct: number;
  waterHeightPct: number;
  alcoholHeightPct: number;
  isTared: boolean;
  onToggleTare: () => void;
  activeStepIndex?: number;
}

const ScaleBeakerScene: React.FC<{
  oilHeightPct: number;
  fixativeHeightPct: number;
  waterHeightPct: number;
  alcoholHeightPct: number;
  isTared: boolean;
  onToggleTare: () => void;
  activeStepIndex: number;
  exploded: boolean;
  isSoftwareGl: boolean;
}> = ({
  oilHeightPct,
  fixativeHeightPct,
  waterHeightPct,
  alcoholHeightPct,
  isTared,
  onToggleTare,
  activeStepIndex,
  exploded,
  isSoftwareGl,
}) => {
  const panGroupRef = useRef<THREE.Group>(null);
  const beakerGroupRef = useRef<THREE.Group>(null);
  const pipetteGroupRef = useRef<THREE.Group>(null);
  const dropMeshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
  }, [hovered]);

  useEffect(() => () => {
    document.body.style.cursor = 'auto';
  }, []);

  // Normalize fill stack into 1.15m internal beaker column
  const maxColH = 1.08;
  const hOil = Math.max(0.08, (oilHeightPct / 100) * maxColH);
  const hFix = fixativeHeightPct > 0 ? Math.max(0.05, (fixativeHeightPct / 100) * maxColH) : 0;
  const hWat = waterHeightPct > 0 ? Math.max(0.04, (waterHeightPct / 100) * maxColH) : 0;
  const hAlc = Math.max(0.12, (alcoholHeightPct / 100) * maxColH);

  const totalFluid = hOil + hFix + hWat + hAlc;
  const norm = totalFluid > maxColH ? maxColH / totalFluid : 1;
  const nOil = hOil * norm;
  const nFix = hFix * norm;
  const nWat = hWat * norm;
  const nAlc = hAlc * norm;

  const yOil = nOil / 2;
  const yFix = nOil + nFix / 2;
  const yWat = nOil + nFix + nWat / 2;
  const yAlc = nOil + nFix + nWat + nAlc / 2;

  useFrame((state, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);
    const t = state.clock.elapsedTime;

    if (panGroupRef.current) {
      const targetPanY = exploded ? 0.42 : 0.23;
      panGroupRef.current.position.y = THREE.MathUtils.damp(panGroupRef.current.position.y, targetPanY, 7, dt);
    }
    if (beakerGroupRef.current) {
      const targetBeakerY = exploded ? 0.92 : 0.28;
      beakerGroupRef.current.position.y = THREE.MathUtils.damp(
        beakerGroupRef.current.position.y,
        targetBeakerY,
        7,
        dt,
      );
    }
    if (pipetteGroupRef.current) {
      const targetPipY = (exploded ? 2.45 : 1.86) + Math.sin(t * 2.2) * 0.05;
      pipetteGroupRef.current.position.y = THREE.MathUtils.damp(
        pipetteGroupRef.current.position.y,
        targetPipY,
        7,
        dt,
      );
      pipetteGroupRef.current.rotation.z = Math.sin(t * 1.4) * 0.06;
    }
    if (dropMeshRef.current) {
      const dropPhase = (t * 1.35) % 1;
      dropMeshRef.current.position.y = THREE.MathUtils.lerp(1.52, 0.52, dropPhase);
      const scale = dropPhase > 0.85 ? 0.02 : 1;
      dropMeshRef.current.scale.setScalar(scale);
    }
  });

  const activeDropColor =
    activeStepIndex === 2 ? '#22d3ee' : activeStepIndex === 3 ? '#10b981' : '#f59e0b';

  return (
    <group>
      {/* Analytical Digital Balance Base */}
      <group
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onToggleTare();
        }}
      >
        <mesh position={[0, 0.09, 0]} castShadow={!isSoftwareGl} receiveShadow>
          <boxGeometry args={[1.85, 0.16, 1.55]} />
          <meshStandardMaterial color={0x1c1917} metalness={0.45} roughness={0.45} />
        </mesh>
        {/* Brushed Chamfer Frame */}
        <mesh position={[0, 0.175, 0]}>
          <boxGeometry args={[1.76, 0.02, 1.46]} />
          <meshStandardMaterial color={0x57534e} metalness={0.78} roughness={0.28} />
        </mesh>
        {/* Digital Front Panel Screen */}
        <mesh position={[0, 0.1, 0.785]}>
          <boxGeometry args={[1.1, 0.09, 0.02]} />
          <meshStandardMaterial
            color={isTared ? 0x064e3b : 0x451a03}
            emissive={isTared ? 0x10b981 : 0xf59e0b}
            emissiveIntensity={hovered ? 0.95 : 0.55}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* Stainless Steel Weighing Pan */}
      <group ref={panGroupRef} position={[0, 0.23, -0.06]}>
        <mesh castShadow={!isSoftwareGl} receiveShadow>
          <cylinderGeometry args={[0.62, 0.65, 0.045, 36]} />
          <meshStandardMaterial color={0xd6d3d1} metalness={0.92} roughness={0.18} />
        </mesh>
        <mesh position={[0, 0.025, 0]}>
          <torusGeometry args={[0.58, 0.014, 10, 40]} />
          <meshStandardMaterial color={isTared ? 0x10b981 : 0xd4af37} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Borosilicate Glass Beaker + Live Stratified Fluid Layers */}
      <group ref={beakerGroupRef} position={[0, 0.28, -0.06]}>
        {/* Glass Outer Cylinder */}
        <mesh position={[0, 0.62, 0]} renderOrder={4}>
          <cylinderGeometry args={[0.46, 0.44, 1.24, 32, 1, true]} />
          <meshPhysicalMaterial
            color={0xf8fafc}
            transparent
            opacity={0.24}
            roughness={0.08}
            metalness={0.05}
            clearcoat={1}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Glass Base Plate */}
        <mesh position={[0, 0.015, 0]}>
          <cylinderGeometry args={[0.44, 0.44, 0.03, 32]} />
          <meshStandardMaterial color={0xe2e8f0} transparent opacity={0.45} roughness={0.1} />
        </mesh>
        {/* Top Rim Lip */}
        <mesh position={[0, 1.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.46, 0.016, 10, 36]} />
          <meshStandardMaterial color={0xe2e8f0} roughness={0.12} metalness={0.35} />
        </mesh>
        {/* Etched Brass Graduation Rings */}
        {[0.3, 0.6, 0.9, 1.12].map((gy) => (
          <mesh key={gy} position={[0, gy, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.462, 0.004, 6, 36]} />
            <meshStandardMaterial color={0xd4af37} metalness={0.85} roughness={0.25} />
          </mesh>
        ))}

        {/* Liquid Layer 1: Fragrance Oil (Amber) */}
        <mesh position={[0, 0.04 + yOil, 0]} renderOrder={1}>
          <cylinderGeometry args={[0.415, 0.41, nOil, 28]} />
          <meshPhysicalMaterial
            color={0xd97706}
            emissive={0xb45309}
            emissiveIntensity={0.22}
            roughness={0.16}
            clearcoat={0.85}
          />
        </mesh>

        {/* Liquid Layer 2: Fixative (Emerald) */}
        {nFix > 0 && (
          <mesh position={[0, 0.04 + yFix, 0]} renderOrder={1}>
            <cylinderGeometry args={[0.417, 0.415, nFix, 28]} />
            <meshPhysicalMaterial
              color={0x10b981}
              emissive={0x059669}
              emissiveIntensity={0.18}
              roughness={0.18}
            />
          </mesh>
        )}

        {/* Liquid Layer 3: Distilled Water (Azure) */}
        {nWat > 0 && (
          <mesh position={[0, 0.04 + yWat, 0]} renderOrder={1}>
            <cylinderGeometry args={[0.419, 0.417, nWat, 28]} />
            <meshPhysicalMaterial color={0x38bdf8} transparent opacity={0.78} roughness={0.1} />
          </mesh>
        )}

        {/* Liquid Layer 4: Ethanol 96% Carrier (Crystal Cyan) */}
        <mesh position={[0, 0.04 + yAlc, 0]} renderOrder={2}>
          <cylinderGeometry args={[0.422, 0.418, nAlc, 28]} />
          <meshPhysicalMaterial
            color={0x67e8f9}
            transparent
            opacity={0.56}
            roughness={0.08}
            clearcoat={1}
          />
        </mesh>
      </group>

      {/* Hovering Glass Dropper Pipette + Animated Droplet */}
      <group ref={pipetteGroupRef} position={[0, 1.86, -0.06]}>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.045, 0.014, 0.48, 16]} />
          <meshPhysicalMaterial color={0xf8fafc} transparent opacity={0.52} roughness={0.08} />
        </mesh>
        <mesh position={[0, 0.44, 0]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial color={0x92400e} roughness={0.55} />
        </mesh>
      </group>

      <mesh ref={dropMeshRef} position={[0, 1.4, -0.06]}>
        <sphereGeometry args={[0.032, 12, 12]} />
        <meshStandardMaterial color={activeDropColor} emissive={activeDropColor} emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
};

export const ScaleBeakerAR3D: React.FC<ScaleBeakerAR3DProps> = ({
  currentLang,
  bottleVolumeMl,
  oilGrams,
  alcoholGrams,
  fixativeGrams,
  waterGrams,
  totalGrams,
  oilHeightPct,
  fixativeHeightPct,
  waterHeightPct,
  alcoholHeightPct,
  isTared,
  onToggleTare,
  activeStepIndex = 0,
}) => {
  const L = makeT(currentLang, SIM_STRINGS);
  const [exploded, setExploded] = useState(false);

  return (
    <AR3DSpatialStage
      currentLang={currentLang}
      title={L('scale_title')}
      subtitle={L('scale_sub')}
      badgeText={L('scale_badge')}
      heightClass="h-[340px] sm:h-[380px]"
      cameraSpec={{ position: [0.35, 2.25, 4.35], target: [0, 0.9, 0] }}
      exploded={exploded}
      onToggleExploded={() => setExploded((v) => !v)}
      groundRadius={1.85}
      topLeftOverlay={
        <div className="px-3 py-1.5 rounded-xl bg-stone-950/90 border border-stone-800 text-[11px] font-mono text-amber-300 space-y-0.5">
          <div>
            {formatNum(totalGrams, 2)} g · {bottleVolumeMl} mL
          </div>
          <div className="text-[10px] text-stone-400">
            Oil {formatNum(oilGrams, 1)}g · EtOH {formatNum(alcoholGrams, 1)}g
            {fixativeGrams > 0 ? ` · Fix ${formatNum(fixativeGrams, 1)}g` : ''}
            {waterGrams > 0 ? ` · H2O ${formatNum(waterGrams, 1)}g` : ''}
          </div>
        </div>
      }
      bottomExtraControls={
        <button
          type="button"
          onClick={onToggleTare}
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
            isTared
              ? 'bg-emerald-600 text-white border-emerald-400'
              : 'bg-stone-950 text-amber-300 border-stone-700 hover:border-amber-400'
          }`}
        >
          {L('tare_btn')}
        </button>
      }
    >
      {({ isSoftwareGl, exploded: isExp }) => (
        <ScaleBeakerScene
          oilHeightPct={oilHeightPct}
          fixativeHeightPct={fixativeHeightPct}
          waterHeightPct={waterHeightPct}
          alcoholHeightPct={alcoholHeightPct}
          isTared={isTared}
          onToggleTare={onToggleTare}
          activeStepIndex={activeStepIndex}
          exploded={isExp}
          isSoftwareGl={isSoftwareGl}
        />
      )}
    </AR3DSpatialStage>
  );
};

/* ============================================================================
 * 2. SPRAY & SKIN ADHESION 3D / AR SIMULATOR
 * ============================================================================ */

interface SprayKineticsAR3DProps {
  currentLang: SupportedLanguage;
  activeView: 'panorama' | 'micro' | 'aura';
  pulsePoint: 'wrist' | 'neck' | 'elbow';
  skinTemp: number;
  sprayCount: number;
  sprayBurstSeq: number;
  isContinuous: boolean;
  sillageRadiusMeters: number;
  alcoholRemainingPct: number;
  oilRemainingOnSkinPct: number;
  onTriggerSpray: () => void;
  onToggleContinuous: () => void;
}

const SPRAY_CAMERA_PRESETS: Record<'panorama' | 'micro' | 'aura', AR3DStageCameraSpec> = {
  panorama: { position: [0.3, 2.2, 4.9], target: [0.1, 0.85, 0] },
  micro: { position: [1.65, 1.35, 2.55], target: [1.15, 0.45, 0] },
  aura: { position: [0, 4.4, 3.6], target: [0.5, 0.4, 0] },
};

type MistParticle = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  kind: 'alcohol' | 'top' | 'heart' | 'base';
  size: number;
};

const MIST_COUNT = 220;
const _dummyObj = new THREE.Object3D();
const _cAlcohol = new THREE.Color('#38bdf8');
const _cTop = new THREE.Color('#fbbf24');
const _cHeart = new THREE.Color('#f472b6');
const _cBase = new THREE.Color('#b45309');

const SprayKineticsScene: React.FC<{
  activeView: 'panorama' | 'micro' | 'aura';
  pulsePoint: 'wrist' | 'neck' | 'elbow';
  skinTemp: number;
  sprayBurstSeq: number;
  isContinuous: boolean;
  sillageRadiusMeters: number;
  onTriggerSpray: () => void;
  exploded: boolean;
  isSoftwareGl: boolean;
}> = ({
  pulsePoint,
  skinTemp,
  sprayBurstSeq,
  isContinuous,
  sillageRadiusMeters,
  onTriggerSpray,
  exploded,
  isSoftwareGl,
}) => {
  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const flaconRef = useRef<THREE.Group>(null);
  const nozzleRef = useRef<THREE.Mesh>(null);
  const auraRing1Ref = useRef<THREE.Mesh>(null);
  const auraRing2Ref = useRef<THREE.Mesh>(null);
  const [hoveredFlacon, setHoveredFlacon] = useState(false);

  const particles = useMemo<MistParticle[]>(
    () =>
      Array.from({ length: MIST_COUNT }, () => ({
        active: false,
        pos: new THREE.Vector3(0, -10, 0),
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 2.5,
        kind: 'alcohol',
        size: 0.03,
      })),
    [],
  );
  const cursorRef = useRef(0);
  const lastBurstRef = useRef(0);
  const contAccumRef = useRef(0);

  useEffect(() => {
    document.body.style.cursor = hoveredFlacon ? 'pointer' : 'auto';
  }, [hoveredFlacon]);

  useEffect(() => () => {
    document.body.style.cursor = 'auto';
  }, []);

  const spawnBurst = (count: number) => {
    for (let i = 0; i < count; i += 1) {
      const idx = cursorRef.current % MIST_COUNT;
      cursorRef.current += 1;
      const p = particles[idx];
      const r = Math.random();
      p.kind = r < 0.34 ? 'alcohol' : r < 0.58 ? 'top' : r < 0.8 ? 'heart' : 'base';
      p.active = true;
      p.age = 0;
      p.maxAge = p.kind === 'alcohol' ? 1.15 : p.kind === 'top' ? 1.85 : 3.2;
      p.size = p.kind === 'base' ? 0.048 : p.kind === 'alcohol' ? 0.028 : 0.038;
      p.pos.set(-1.05, 1.18, 0);
      const speed = 2.4 + Math.random() * 1.4;
      const spreadY = (Math.random() - 0.52) * 0.72;
      const spreadZ = (Math.random() - 0.5) * 0.72;
      p.vel.set(speed, spreadY, spreadZ);
    }
  };

  useEffect(() => {
    if (sprayBurstSeq > lastBurstRef.current) {
      lastBurstRef.current = sprayBurstSeq;
      spawnBurst(65);
    }
  }, [sprayBurstSeq]);

  // Seed initial subtle mist on mount
  useEffect(() => {
    spawnBurst(40);
  }, []);

  const tempRatio = THREE.MathUtils.clamp((skinTemp - 33) / 6, 0, 1);
  const skinColor = useMemo(() => {
    return new THREE.Color(0xc28e70).lerp(new THREE.Color(0xe07a5f), tempRatio * 0.65);
  }, [tempRatio]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);
    const t = state.clock.elapsedTime;

    if (isContinuous) {
      contAccumRef.current += dt;
      if (contAccumRef.current > 0.07) {
        contAccumRef.current = 0;
        spawnBurst(10);
      }
    }

    if (flaconRef.current) {
      const targetX = exploded ? -1.75 : -1.38;
      flaconRef.current.position.x = THREE.MathUtils.damp(flaconRef.current.position.x, targetX, 6, dt);
    }

    if (auraRing1Ref.current) {
      const s1 = 0.75 + Math.min(1.6, sillageRadiusMeters * 0.45) + Math.sin(t * 2.2) * 0.08;
      auraRing1Ref.current.scale.set(s1, s1, 1);
    }
    if (auraRing2Ref.current) {
      const s2 = 1.0 + Math.min(2.1, sillageRadiusMeters * 0.65) + Math.cos(t * 1.6) * 0.1;
      auraRing2Ref.current.scale.set(s2, s2, 1);
    }

    const mesh = instancedRef.current;
    if (!mesh) return;

    for (let i = 0; i < MIST_COUNT; i += 1) {
      const p = particles[i];
      if (!p.active) {
        _dummyObj.position.set(0, -10, 0);
        _dummyObj.scale.setScalar(0.0001);
        _dummyObj.updateMatrix();
        mesh.setMatrixAt(i, _dummyObj.matrix);
        continue;
      }

      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        continue;
      }

      // Trajectory toward skin surface near x = 0.9..1.45, y = 0.35..0.55
      p.vel.x *= 1 - Math.min(0.9, dt * 1.15);
      if (p.kind === 'alcohol') {
        p.vel.y += dt * (1.2 + tempRatio * 0.6); // Alcohol flash-off rises fast
      } else if (p.kind === 'top') {
        p.vel.y += dt * 0.25;
      } else {
        p.vel.y -= dt * 0.55; // Heart/base adhere onto skin lipid layer
      }

      p.pos.addScaledVector(p.vel, dt);

      // Skin lipid surface arrest around x in [0.55, 1.85]
      if (p.pos.x > 0.52 && p.pos.x < 1.95 && p.pos.y <= 0.44) {
        p.pos.y = 0.44 + (p.kind === 'alcohol' ? 0.06 : 0.015);
        p.vel.x *= 0.2;
        p.vel.z *= 0.2;
        if (p.kind === 'alcohol') {
          p.vel.y = 0.9 + tempRatio * 0.7;
        } else {
          p.vel.y = 0;
        }
      }

      const fade = 1 - p.age / p.maxAge;
      const sc = p.size * (0.65 + fade * 0.7);
      _dummyObj.position.copy(p.pos);
      _dummyObj.scale.setScalar(sc);
      _dummyObj.updateMatrix();
      mesh.setMatrixAt(i, _dummyObj.matrix);

      mesh.setColorAt(
        i,
        p.kind === 'alcohol'
          ? _cAlcohol
          : p.kind === 'top'
          ? _cTop
          : p.kind === 'heart'
          ? _cHeart
          : _cBase,
      );
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const pulseOffsetZ = pulsePoint === 'wrist' ? 0 : pulsePoint === 'neck' ? 0.22 : -0.22;

  return (
    <group>
      {/* Left: 3D Atomizer Flacon */}
      <group
        ref={flaconRef}
        position={[-1.38, 0.06, 0]}
        onPointerOver={() => setHoveredFlacon(true)}
        onPointerOut={() => setHoveredFlacon(false)}
        onClick={(e) => {
          e.stopPropagation();
          onTriggerSpray();
        }}
      >
        <mesh position={[0, 0.48, 0]} castShadow={!isSoftwareGl}>
          <cylinderGeometry args={[0.38, 0.42, 0.92, 24]} />
          <meshPhysicalMaterial
            color={0xf59e0b}
            transparent
            opacity={0.72}
            roughness={0.12}
            clearcoat={1}
          />
        </mesh>
        <mesh position={[0, 1.04, 0]}>
          <cylinderGeometry args={[0.16, 0.18, 0.2, 20]} />
          <meshStandardMaterial color={0xd4af37} metalness={0.92} roughness={0.18} />
        </mesh>
        <mesh ref={nozzleRef} position={[0.14, 1.14, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.05, 0.18, 14]} />
          <meshStandardMaterial
            color={0xfef3c7}
            emissive={hoveredFlacon ? 0xf59e0b : 0x000000}
            emissiveIntensity={hoveredFlacon ? 0.7 : 0}
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* Right: 3D Curved Skin Lipid Patch + Pulse Target */}
      <group position={[1.15, 0.06, 0]}>
        {/* Dermis Base */}
        <mesh position={[0, 0.16, 0]} castShadow={!isSoftwareGl} receiveShadow>
          <boxGeometry args={[1.55, 0.26, 1.35]} />
          <meshStandardMaterial color={0x572c23} roughness={0.68} />
        </mesh>
        {/* Lipid Epidermis Surface */}
        <mesh position={[0, 0.34, 0]} receiveShadow>
          <boxGeometry args={[1.58, 0.12, 1.38]} />
          <meshStandardMaterial
            color={skinColor}
            emissive={0xea580c}
            emissiveIntensity={0.08 + tempRatio * 0.22}
            roughness={0.46}
          />
        </mesh>
        {/* Pulse Point Vascular Target Rings */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.415, pulseOffsetZ]}>
          <ringGeometry args={[0.2, 0.26, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        {/* Expanding Sillage Projection Waves */}
        <mesh ref={auraRing1Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.42, pulseOffsetZ]}>
          <ringGeometry args={[0.45, 0.5, 48]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.38} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={auraRing2Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.418, pulseOffsetZ]}>
          <ringGeometry args={[0.72, 0.76, 48]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.22} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* 3D Instanced Perfume Mist Particles */}
      <instancedMesh
        ref={instancedRef}
        args={[undefined, undefined, MIST_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  );
};

export const SprayKineticsAR3D: React.FC<SprayKineticsAR3DProps> = ({
  currentLang,
  activeView,
  pulsePoint,
  skinTemp,
  sprayCount,
  sprayBurstSeq,
  isContinuous,
  sillageRadiusMeters,
  alcoholRemainingPct,
  oilRemainingOnSkinPct,
  onTriggerSpray,
  onToggleContinuous,
}) => {
  const L = makeT(currentLang, SIM_STRINGS);
  const [exploded, setExploded] = useState(false);

  return (
    <AR3DSpatialStage
      currentLang={currentLang}
      title={L('spray_title')}
      subtitle={L('spray_sub')}
      badgeText={L('spray_badge')}
      heightClass="h-[340px] sm:h-[380px]"
      cameraSpec={SPRAY_CAMERA_PRESETS[activeView]}
      cameraKey={activeView}
      exploded={exploded}
      onToggleExploded={() => setExploded((v) => !v)}
      groundRadius={2.35}
      topLeftOverlay={
        <div className="px-3 py-1.5 rounded-xl bg-stone-950/90 border border-stone-800 text-[11px] font-mono text-amber-300 space-y-0.5">
          <div>
            Sprays: {sprayCount} · {skinTemp.toFixed(1)}°C
          </div>
          <div className="text-[10px] text-stone-400">
            EtOH {alcoholRemainingPct}% · Skin Oil {oilRemainingOnSkinPct}%
          </div>
        </div>
      }
      bottomExtraControls={
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onTriggerSpray}
            className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{L('spray_now')}</span>
          </button>
          <button
            type="button"
            onClick={onToggleContinuous}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              isContinuous
                ? 'bg-rose-600 text-white border-rose-400'
                : 'bg-stone-950 text-stone-300 border-stone-700 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>{L('continuous_mist')}</span>
          </button>
        </div>
      }
    >
      {({ isSoftwareGl, exploded: isExp }) => (
        <SprayKineticsScene
          activeView={activeView}
          pulsePoint={pulsePoint}
          skinTemp={skinTemp}
          sprayBurstSeq={sprayBurstSeq}
          isContinuous={isContinuous}
          sillageRadiusMeters={sillageRadiusMeters}
          onTriggerSpray={onTriggerSpray}
          exploded={isExp}
          isSoftwareGl={isSoftwareGl}
        />
      )}
    </AR3DSpatialStage>
  );
};

/* ============================================================================
 * 3. MACERATION VESSEL & MOLECULAR AGING 3D / AR SIMULATOR
 * ============================================================================ */

interface MacerationVesselAR3DProps {
  currentLang: SupportedLanguage;
  storageType: 'amber_glass' | 'dark_cupboard' | 'aluminum_flacon';
  progressPercent: number;
  macerationDays: number;
  elapsedDays: number;
}

const MacerationVesselScene: React.FC<{
  storageType: 'amber_glass' | 'dark_cupboard' | 'aluminum_flacon';
  progressPercent: number;
  exploded: boolean;
  isSoftwareGl: boolean;
}> = ({ storageType, progressPercent, exploded, isSoftwareGl }) => {
  const vesselGroupRef = useRef<THREE.Group>(null);
  const stopperRef = useRef<THREE.Group>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);
  const vaultRef = useRef<THREE.Group>(null);

  const progress = THREE.MathUtils.clamp(progressPercent / 100, 0, 1);

  useFrame((state, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);
    const t = state.clock.elapsedTime;

    if (vesselGroupRef.current) {
      vesselGroupRef.current.rotation.y += dt * 0.25;
    }
    if (stopperRef.current) {
      const targetY = exploded ? 2.08 : 1.56;
      stopperRef.current.position.y = THREE.MathUtils.damp(stopperRef.current.position.y, targetY, 7, dt);
    }
    if (vaultRef.current) {
      const targetScale = exploded ? 1.18 : 1.0;
      const nextScale = THREE.MathUtils.damp(vaultRef.current.scale.x, targetScale, 7, dt);
      vaultRef.current.scale.set(nextScale, 1, nextScale);
    }
    // Orbit speed slows cleanly as esters cross-link toward 100% equilibrium
    const orbitRate = THREE.MathUtils.lerp(1.4, 0.35, progress);
    if (ringARef.current) {
      ringARef.current.rotation.z = t * orbitRate;
      ringARef.current.rotation.x = Math.PI / 3 + Math.sin(t * 0.8) * 0.25;
    }
    if (ringBRef.current) {
      ringBRef.current.rotation.z = -t * orbitRate * 0.8;
      ringBRef.current.rotation.y = Math.PI / 4 + Math.cos(t * 0.7) * 0.2;
    }
  });

  const isAmber = storageType === 'amber_glass';
  const isVault = storageType === 'dark_cupboard';
  const isAlum = storageType === 'aluminum_flacon';

  const elixirColor = useMemo(
    () => new THREE.Color('#d97706').lerp(new THREE.Color('#facc15'), progress * 0.65),
    [progress],
  );

  return (
    <group>
      {/* Maturation Progress Gauge Ring on Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[1.05, 1.15, 64, 1, 0, Math.max(0.08, Math.PI * 2 * progress)]} />
        <meshBasicMaterial
          color={progress >= 0.99 ? '#10b981' : '#fbbf24'}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group ref={vesselGroupRef}>
        {/* Pedestal */}
        <mesh position={[0, 0.05, 0]} castShadow={!isSoftwareGl} receiveShadow>
          <cylinderGeometry args={[0.72, 0.78, 0.08, 32]} />
          <meshStandardMaterial color={0x292524} metalness={0.55} roughness={0.4} />
        </mesh>

        {/* Inner Maturing Perfume Elixir */}
        <mesh position={[0, 0.66, 0]}>
          <cylinderGeometry args={[0.41, 0.43, 0.92, 28]} />
          <meshPhysicalMaterial
            color={elixirColor}
            emissive={0xd97706}
            emissiveIntensity={0.18 + progress * 0.35}
            roughness={0.14}
            clearcoat={1}
          />
        </mesh>

        {/* Outer Storage Housing based on selected medium */}
        {isAmber && (
          <mesh position={[0, 0.72, 0]} renderOrder={3} castShadow={!isSoftwareGl}>
            <cylinderGeometry args={[0.49, 0.52, 1.24, 32]} />
            <meshPhysicalMaterial
              color={0x92400e}
              transparent
              opacity={exploded ? 0.28 : 0.62}
              roughness={0.12}
              clearcoat={1}
              depthWrite={false}
            />
          </mesh>
        )}

        {isAlum && (
          <mesh position={[0, 0.72, 0]} castShadow={!isSoftwareGl}>
            <cylinderGeometry args={[0.5, 0.5, 1.26, 32]} />
            <meshStandardMaterial
              color={0xcbd5e1}
              metalness={0.94}
              roughness={0.22}
              transparent={exploded}
              opacity={exploded ? 0.38 : 1}
            />
          </mesh>
        )}

        {isVault && (
          <group ref={vaultRef}>
            <mesh position={[0, 0.72, 0]} renderOrder={3}>
              <cylinderGeometry args={[0.48, 0.5, 1.2, 28]} />
              <meshPhysicalMaterial
                color={0x451a03}
                transparent
                opacity={0.55}
                roughness={0.16}
                depthWrite={false}
              />
            </mesh>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const ang = (i / 6) * Math.PI * 2;
              return (
                <mesh
                  key={i}
                  position={[Math.cos(ang) * 0.66, 0.76, Math.sin(ang) * 0.66]}
                  rotation={[0, -ang, 0]}
                >
                  <boxGeometry args={[0.08, 1.38, 0.24]} />
                  <meshStandardMaterial color={0x3f2212} roughness={0.75} metalness={0.12} />
                </mesh>
              );
            })}
          </group>
        )}

        {/* Vessel Neck + Crimped Brass Collar & Stopper */}
        <group ref={stopperRef} position={[0, 1.56, 0]}>
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.2, 0.24, 0.22, 24]} />
            <meshStandardMaterial color={0xd4af37} metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.25, 0.22, 0.26, 24]} />
            <meshStandardMaterial color={0x1c1917} roughness={0.35} metalness={0.4} />
          </mesh>
        </group>
      </group>

      {/* Ester Cross-Linking Molecular Orbitals */}
      <mesh ref={ringARef} position={[0, 0.8, 0]}>
        <torusGeometry args={[0.88, 0.014, 10, 48]} />
        <meshStandardMaterial
          color={progress >= 0.99 ? 0x34d399 : 0xfbbf24}
          emissive={progress >= 0.99 ? 0x10b981 : 0xf59e0b}
          emissiveIntensity={0.45}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      <mesh ref={ringBRef} position={[0, 0.8, 0]}>
        <torusGeometry args={[1.02, 0.012, 10, 48]} />
        <meshStandardMaterial color={0xfde68a} metalness={0.9} roughness={0.2} />
      </mesh>

      <Sparkles
        count={isSoftwareGl ? 24 : 52}
        scale={[2.2, 2.0, 2.2]}
        position={[0, 0.95, 0]}
        size={2.0}
        speed={THREE.MathUtils.lerp(0.65, 0.18, progress)}
        opacity={0.7}
        color={progress >= 0.99 ? '#34d399' : '#fcd34d'}
      />
    </group>
  );
};

export const MacerationVesselAR3D: React.FC<MacerationVesselAR3DProps> = ({
  currentLang,
  storageType,
  progressPercent,
  macerationDays,
  elapsedDays,
}) => {
  const L = makeT(currentLang, SIM_STRINGS);
  const [exploded, setExploded] = useState(false);

  return (
    <AR3DSpatialStage
      currentLang={currentLang}
      title={L('maceration_title')}
      subtitle={fmt(L('maceration_sub'), { p: progressPercent })}
      badgeText={L('maceration_badge')}
      heightClass="h-[320px] sm:h-[360px]"
      cameraSpec={{ position: [0.3, 2.1, 4.25], target: [0, 0.85, 0] }}
      exploded={exploded}
      onToggleExploded={() => setExploded((v) => !v)}
      groundRadius={1.75}
      topLeftOverlay={
        <div className="px-3 py-1.5 rounded-xl bg-stone-950/90 border border-stone-800 text-[11px] font-mono text-amber-300 space-y-0.5">
          <div>
            {progressPercent}% · {elapsedDays} / {macerationDays}d
          </div>
        </div>
      }
      bottomExtraControls={
        <span className="text-[10px] font-mono text-amber-300 flex items-center gap-1">
          <FlaskConical className="w-3.5 h-3.5" />
          <span>{storageType.replace('_', ' ')}</span>
        </span>
      }
    >
      {({ isSoftwareGl, exploded: isExp }) => (
        <MacerationVesselScene
          storageType={storageType}
          progressPercent={progressPercent}
          exploded={isExp}
          isSoftwareGl={isSoftwareGl}
        />
      )}
    </AR3DSpatialStage>
  );
};
