import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Beaker,
  BookOpen,
  Box,
  Calculator,
  Camera,
  CameraOff,
  ChevronDown,
  ChevronUp,
  Coins,
  Droplets,
  ExternalLink,
  EyeOff,
  FlaskConical,
  Globe,
  Hourglass,
  Info,
  Layers,
  Leaf,
  Pause,
  Play,
  RotateCw,
  Scale,
  Sparkles,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { FormulationState } from '../types/perfume';
import { LText, makeT, pickArEn } from '../لغات/localize';

interface ThreePerfumeStudioProps {
  currentLang: SupportedLanguage;
  formulaTitle: string;
  batchCode: string;
  formulation: FormulationState;
  onNavigate?: (tabId: string) => void;
}

type LabEquipmentId =
  | 'scale'
  | 'flask'
  | 'pyramid'
  | 'abacus'
  | 'globe'
  | 'mortar'
  | 'vial_rack'
  | 'hourglass'
  | 'ledger';

type EquipmentCategory = 'calculator' | 'info';

interface LabEquipmentSpec {
  id: LabEquipmentId;
  targetTab: string;
  category: EquipmentCategory;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  accentHex: number;
  position: [number, number, number];
  icon: React.ComponentType<{ className?: string }>;
}

const STUDIO_STRINGS = {
  title: {
    ar: 'استوديو تصميم الزجاجة ثلاثي الأبعاد',
    en: '3D Crystal Flacon & Lab Workbench',
    fr: 'Atelier Flacon 3D & Établi de Laboratoire',
    es: 'Estudio 3D de Frasco y Mesa de Laboratorio',
    it: 'Studio 3D Flacone e Banco di Laboratorio',
    de: '3D-Flakon-Studio & Laborwerkbank',
    ru: '3D-студия флакона и лабораторный стол',
    zh: '3D 水晶香水瓶与实验台工作室',
    tr: '3D Kristal Şişe ve Laboratuvar Tezgahı',
    fa: 'استودیوی سه‌بعدی شیشه عطر و میز آزمایشگاه',
  },
  subtitle: {
    ar: 'انقر على أي أداة مخبرية ثلاثية الأبعاد حول الزجاجة لفتح الحاسبة أو صفحة المعلومات المقابلة لها مباشرة.',
    en: 'Click any surrounding 3D lab instrument to open its corresponding calculator or reference page directly.',
    fr: 'Cliquez sur un instrument 3D pour ouvrir le calculateur ou la page d’information correspondante.',
    es: 'Haz clic en cualquier instrumento 3D del laboratorio para abrir su calculadora o página informativa.',
    it: 'Fai clic su qualsiasi strumento 3D per aprire il calcolatore o la scheda informativa corrispondente.',
    de: 'Klicken Sie auf ein 3D-Laborgerät, um den zugehörigen Rechner oder die Infoseite zu öffnen.',
    ru: 'Нажмите на любой 3D-прибор вокруг флакона, чтобы открыть нужный калькулятор или справочник.',
    zh: '点击香水瓶周围任意 3D 实验仪器，即可直接打开对应的计算器或信息百科页面。',
    tr: 'İlgili hesaplayıcıyı veya bilgi sayfasını açmak için herhangi bir 3D laboratuvar aracına tıklayın.',
    fa: 'روی هر ابزار آزمایشگاهی سه‌بعدی اطراف شیشه کلیک کنید تا ماشین‌حساب یا صفحه اطلاعات مربوطه باز شود.',
  },
  cat_calculator: {
    ar: 'حاسبة تفاعلية',
    en: 'Lab Calculator',
    fr: 'Calculateur',
    es: 'Calculadora',
    it: 'Calcolatore',
    de: 'Laborrechner',
    ru: 'Калькулятор',
    zh: '实验室计算器',
    tr: 'Hesaplayıcı',
    fa: 'ماشین‌حساب',
  },
  cat_info: {
    ar: 'موسوعة ومعلومات',
    en: 'Info & Archive',
    fr: 'Encyclopédie & Info',
    es: 'Info y Archivo',
    it: 'Info e Archivio',
    de: 'Wissen & Archiv',
    ru: 'Справочник',
    zh: '信息与百科',
    tr: 'Bilgi ve Arşiv',
    fa: 'دانشنامه و اطلاعات',
  },
  click_to_open: {
    ar: 'انقر على المجسم لفتح الصفحة',
    en: 'Click 3D instrument to open',
    fr: 'Cliquez sur l’objet 3D pour ouvrir',
    es: 'Haz clic en el modelo 3D para abrir',
    it: 'Clicca sul modello 3D per aprire',
    de: '3D-Modell zum Öffnen anklicken',
    ru: 'Нажмите на 3D-модель, чтобы открыть',
    zh: '点击 3D 模型即可打开',
    tr: 'Açmak için 3D araca tıklayın',
    fa: 'برای باز کردن روی مدل سه‌بعدی کلیک کنید',
  },
  ar_start: {
    ar: 'الواقع المعزز AR',
    en: 'AR Camera',
    fr: 'Caméra RA',
    es: 'Cámara RA',
    it: 'Fotocamera AR',
    de: 'AR-Kamera',
    ru: 'AR-камера',
    zh: 'AR 实景相机',
    tr: 'AR Kamera',
    fa: 'دوربین AR',
  },
  ar_stop: {
    ar: 'إيقاف AR',
    en: 'Exit AR',
    fr: 'Quitter RA',
    es: 'Salir RA',
    it: 'Esci da AR',
    de: 'AR beenden',
    ru: 'Выйти из AR',
    zh: '退出 AR',
    tr: 'AR Çıkış',
    fa: 'خروج از AR',
  },
  show_controls: {
    ar: 'إظهار التحكم',
    en: 'Show Controls',
    fr: 'Afficher',
    es: 'Mostrar controles',
    it: 'Mostra controlli',
    de: 'Steuerung zeigen',
    ru: 'Показать панель',
    zh: '显示控制栏',
    tr: 'Kontrolleri Göster',
    fa: 'نمایش کنترل‌ها',
  },
  hide_controls: {
    ar: 'طي التحكم (H)',
    en: 'Hide Controls (H)',
    fr: 'Masquer (H)',
    es: 'Ocultar (H)',
    it: 'Nascondi (H)',
    de: 'Ausblenden (H)',
    ru: 'Скрыть (H)',
    zh: '收起控制栏 (H)',
    tr: 'Gizle (H)',
    fa: 'پنهان کردن (H)',
  },
  bench_equipment: {
    ar: 'الأدوات المخبرية التفاعلية (انقر على المجسم أو الاختصار للفتح):',
    en: 'Interactive 3D Lab Tools (click 3D model or shortcut):',
    fr: 'Instruments 3D du laboratoire (cliquez pour ouvrir) :',
    es: 'Instrumentos 3D del laboratorio (clic para abrir):',
    it: 'Strumenti 3D di laboratorio (clicca per aprire):',
    de: 'Interaktive 3D-Laborgeräte (klicken zum Öffnen):',
    ru: 'Интерактивные 3D-инструменты (нажмите для открытия):',
    zh: '交互式 3D 实验仪器（点击模型或快捷按钮打开）：',
    tr: 'Etkileşimli 3D Laboratuvar Araçları (açmak için tıklayın):',
    fa: 'ابزارهای سه‌بعدی آزمایشگاه (برای باز کردن کلیک کنید):',
  },
  blend_trigger: {
    ar: 'دمج المكونات (تفاعل)',
    en: 'Blend Ingredients',
    fr: 'Mélanger (Réaction)',
    es: 'Mezclar ingredientes',
    it: 'Miscela ingredienti',
    de: 'Zutaten mischen',
    ru: 'Смешать компоненты',
    zh: '混合反应特效',
    tr: 'Bileşenleri Karıştır',
    fa: 'ترکیب مواد (واکنش)',
  },
  reaction_live: {
    ar: 'فقاعات التفاعل: نشطة',
    en: 'Bubbles: Active',
    fr: 'Bulles : Actives',
    es: 'Burbujas: Activas',
    it: 'Bolle: Attive',
    de: 'Blasen: Aktiv',
    ru: 'Пузырьки: Вкл',
    zh: '气泡反应：开启',
    tr: 'Kabarcıklar: Aktif',
    fa: 'حباب‌ها: فعال',
  },
  reaction_paused: {
    ar: 'فقاعات التفاعل: متوقفة',
    en: 'Bubbles: Paused',
    fr: 'Bulles : En pause',
    es: 'Burbujas: Pausadas',
    it: 'Bolle: In pausa',
    de: 'Blasen: Pausiert',
    ru: 'Пузырьки: Пауза',
    zh: '气泡反应：暂停',
    tr: 'Kabarcıklar: Duraklatıldı',
    fa: 'حباب‌ها: متوقف',
  },
} satisfies Record<string, LText>;

const LAB_EQUIPMENT: LabEquipmentSpec[] = [
  {
    id: 'scale',
    targetTab: 'concentration',
    category: 'calculator',
    nameAr: 'الميزان التحليلي (0.01g)',
    nameEn: 'Analytical Lab Scale',
    descAr: 'فتح حاسبة التركيز وأوزان الزيت والكحول',
    descEn: 'Open Formulation & Concentration Calculator',
    accentHex: 0xf59e0b,
    position: [-2.76, -0.78, 1.16],
    icon: Scale,
  },
  {
    id: 'flask',
    targetTab: 'alcohol',
    category: 'calculator',
    nameAr: 'دورق تخفيف الكحول',
    nameEn: 'Ethanol Dilution Flask',
    descAr: 'فتح حاسبة تخفيف الكحول والماء المقطر',
    descEn: 'Open Alcohol Dilution Calculator',
    accentHex: 0x06b6d4,
    position: [-3.04, -0.78, -0.18],
    icon: Beaker,
  },
  {
    id: 'pyramid',
    targetTab: 'pyramid',
    category: 'calculator',
    nameAr: 'الهرم العطري الثلاثي',
    nameEn: 'Fragrance Pyramid Stand',
    descAr: 'فتح جرافيك الهرم العطري ومحاكي الرش',
    descEn: 'Open Fragrance Pyramid & Evolution Simulator',
    accentHex: 0xf43f5e,
    position: [-2.57, -0.78, -1.48],
    icon: Layers,
  },
  {
    id: 'abacus',
    targetTab: 'costing',
    category: 'calculator',
    nameAr: 'ميزان التسعير والتكلفة',
    nameEn: 'Brass Costing Balance',
    descAr: 'فتح حاسبة التكاليف والأرباح وهوامش البيع',
    descEn: 'Open Costing & Profit Margin Calculator',
    accentHex: 0x22c55e,
    position: [-1.47, -0.78, -2.41],
    icon: Coins,
  },
  {
    id: 'globe',
    targetTab: 'world_perfumes',
    category: 'info',
    nameAr: 'الكرة العطرية العالمية',
    nameEn: 'World Perfumery Globe',
    descAr: 'فتح موسوعة العطور العالمية وتركيباتها الشهيرة',
    descEn: 'Open World Iconic Perfumes Encyclopedia',
    accentHex: 0x38bdf8,
    position: [0.0, -0.78, -2.75],
    icon: Globe,
  },
  {
    id: 'mortar',
    targetTab: 'raw_materials',
    category: 'info',
    nameAr: 'هاون الخلاصات والمواد الخام',
    nameEn: 'Raw Materials Mortar',
    descAr: 'فتح موسوعة المواد الخام العطرية وأرقام CAS',
    descEn: 'Open Raw Materials & CAS Encyclopedia',
    accentHex: 0x10b981,
    position: [1.47, -0.78, -2.41],
    icon: Leaf,
  },
  {
    id: 'vial_rack',
    targetTab: 'guide',
    category: 'info',
    nameAr: 'حامل المثبتات والراتنجات',
    nameEn: 'Fixatives Vial Rack',
    descAr: 'فتح صفحة دليل المثبتات والتعتيق العلمي',
    descEn: 'Open Fixatives & Aging Reference Guide',
    accentHex: 0xa855f7,
    position: [2.57, -0.78, -1.48],
    icon: Info,
  },
  {
    id: 'hourglass',
    targetTab: 'maceration_simulator',
    category: 'calculator',
    nameAr: 'ساعة التعتيق الزمنية',
    nameEn: 'Maceration Hourglass',
    descAr: 'فتح محاكي التعتيق الزمني ونضوج العطر',
    descEn: 'Open Maceration Time Simulator',
    accentHex: 0xd97706,
    position: [3.04, -0.78, -0.18],
    icon: Hourglass,
  },
  {
    id: 'ledger',
    targetTab: 'library',
    category: 'info',
    nameAr: 'سجل ودفتر الوصفات',
    nameEn: 'Atelier Formula Ledger',
    descAr: 'فتح دفتر الوصفات وسجلات المعمل المحفوظة',
    descEn: 'Open Formula Notebook & Recipe Archive',
    accentHex: 0xeab308,
    position: [2.76, -0.78, 1.16],
    icon: BookOpen,
  },
];

type ElixirPreset = {
  id: string;
  nameAr: string;
  nameEn: string;
  liquidHex: number;
  reactionHex: number;
  metalHex: number;
  accentCss: string;
};

const ELIXIR_PRESETS: ElixirPreset[] = [
  { id: 'oud_amber', nameAr: 'عنبر وعود ملكي', nameEn: 'Royal Oud Amber', liquidHex: 0xc26d1f, reactionHex: 0xfbbf24, metalHex: 0xd4af37, accentCss: 'bg-amber-600' },
  { id: 'taif_rose', nameAr: 'ورد طائفي ياقوتي', nameEn: 'Ruby Taif Rose', liquidHex: 0xa63a50, reactionHex: 0xfb7185, metalHex: 0xe6c17a, accentCss: 'bg-rose-700' },
  { id: 'neroli_mist', nameAr: 'نيرولي وبرغموت', nameEn: 'Calabrian Bergamot', liquidHex: 0x3b8a6b, reactionHex: 0x34d399, metalHex: 0xd6d3d1, accentCss: 'bg-emerald-700' },
  { id: 'night_musk', nameAr: 'مسك الليل واللبان', nameEn: 'Nocturnal Frankincense', liquidHex: 0x5c4b8a, reactionHex: 0xa78bfa, metalHex: 0xc7ccd6, accentCss: 'bg-indigo-700' },
];

type CameraPresetId = 'hero' | 'workbench' | 'plaque' | 'crown' | 'nozzle';

const CAMERA_PRESETS: Record<CameraPresetId, { pos: [number, number, number]; target: [number, number, number] }> = {
  hero: { pos: [4.1, 2.75, 5.2], target: [0, 0.35, -0.25] },
  workbench: { pos: [0, 4.5, 6.9], target: [0, -0.1, -0.65] },
  plaque: { pos: [0, 0.5, 4.4], target: [0, 0.35, 0] },
  crown: { pos: [2.1, 3.9, 2.4], target: [0, 1.35, 0] },
  nozzle: { pos: [1.5, 1.85, 1.9], target: [0, 1.25, 0] },
};

function drawPlaqueTexture(
  canvas: HTMLCanvasElement,
  title: string,
  batch: string,
  concPercent: number,
  concType: string,
  volumeMl: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#fcf8f0';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#b4832b';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, w - 28, h - 28);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, w - 56, h - 56);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#78350f';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('MAISON SHAM · ATELIER', w / 2, 82);

  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 42px Georgia, serif';
  const cleanTitle = (title || 'SHAM SIGNATURE').slice(0, 22);
  ctx.fillText(cleanTitle, w / 2, 165);

  ctx.fillStyle = '#92400e';
  ctx.fillRect(w * 0.28, 195, w * 0.44, 2);

  ctx.fillStyle = '#44403c';
  ctx.font = '600 28px monospace';
  ctx.fillText(`${concType.toUpperCase()} · ${concPercent}% · ${volumeMl} mL`, w / 2, 250);

  ctx.fillStyle = '#78716c';
  ctx.font = '500 22px monospace';
  ctx.fillText(`BATCH: ${batch || 'SHM-001'}`, w / 2, 298);
}

function resolveEquipmentId(obj: THREE.Object3D | null): LabEquipmentId | null {
  let curr: THREE.Object3D | null = obj;
  while (curr) {
    const eqId = curr.userData?.equipmentId as LabEquipmentId | undefined;
    if (eqId) return eqId;
    curr = curr.parent;
  }
  return null;
}

export const ThreePerfumeStudio: React.FC<ThreePerfumeStudioProps> = ({
  currentLang,
  formulaTitle,
  batchCode,
  formulation,
  onNavigate,
}) => {
  const L = makeT(currentLang, STUDIO_STRINGS);
  const txt = (ar: string, en: string) => pickArEn(currentLang, ar, en);

  const mountRef = useRef<HTMLDivElement>(null);
  const [presetId, setPresetId] = useState<string>('oud_amber');
  const [exploded, setExploded] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('hero');
  const [controlsCollapsed, setControlsCollapsed] = useState<boolean>(false);
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(false);
  const [hoveredEquipmentId, setHoveredEquipmentId] = useState<LabEquipmentId | null>(null);
  const [hoveredScreenPos, setHoveredScreenPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [arCameraActive, setArCameraActive] = useState<boolean>(false);
  const [arCamError, setArCamError] = useState<string | null>(null);
  const [liveReaction, setLiveReaction] = useState<boolean>(true);
  const [blendPulseCount, setBlendPulseCount] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const arStreamRef = useRef<MediaStream | null>(null);
  const arActiveRef = useRef<boolean>(false);
  arActiveRef.current = arCameraActive;

  const explodedRef = useRef(exploded);
  explodedRef.current = exploded;
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const liveReactionRef = useRef(liveReaction);
  liveReactionRef.current = liveReaction;
  const blendBoostRef = useRef<number>(0.75);
  const cameraPresetRef = useRef<CameraPresetId>(cameraPreset);
  const camTransitionRef = useRef<boolean>(false);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const hoveredEquipmentRef = useRef<LabEquipmentId | null>(hoveredEquipmentId);
  hoveredEquipmentRef.current = hoveredEquipmentId;

  const triggerBlendReaction = useCallback(() => {
    setLiveReaction(true);
    blendBoostRef.current = 1.0;
    setBlendPulseCount((c) => c + 1);
  }, []);

  const openEquipmentDestination = useCallback((spec: LabEquipmentSpec) => {
    if (onNavigateRef.current) {
      onNavigateRef.current(spec.targetTab);
      return;
    }
    try {
      window.location.hash = `#${spec.targetTab}`;
    } catch {
      // ignore fallback error
    }
  }, []);

  const openEquipmentRef = useRef(openEquipmentDestination);
  openEquipmentRef.current = openEquipmentDestination;

  const stopArCamera = () => {
    if (arStreamRef.current) {
      for (const track of arStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      arStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => () => stopArCamera(), []);

  const toggleArCamera = async () => {
    if (arCameraActive) {
      stopArCamera();
      setArCameraActive(false);
      setArCamError(null);
      return;
    }
    setArCamError(null);
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setArCamError(
        pickArEn(
          currentLang,
          'الكاميرا غير متاحة؛ العرض ثلاثي الأبعاد نشط.',
          'Camera unavailable; 3D studio remains active.',
        ),
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      arStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setArCameraActive(true);
    } catch {
      stopArCamera();
      setArCameraActive(false);
      setArCamError(
        pickArEn(
          currentLang,
          'تعذّر الوصول للكاميرا؛ العرض ثلاثي الأبعاد نشط.',
          'Camera access declined; 3D studio remains active.',
        ),
      );
    }
  };

  const hoveredEquipment = useMemo(
    () => LAB_EQUIPMENT.find((eq) => eq.id === hoveredEquipmentId) || null,
    [hoveredEquipmentId],
  );

  const activePreset = useMemo(
    () => ELIXIR_PRESETS.find((p) => p.id === presetId) || ELIXIR_PRESETS[0],
    [presetId],
  );

  const activePresetRef = useRef<ElixirPreset>(activePreset);
  activePresetRef.current = activePreset;

  const dynamicRefs = useRef<{
    liquidMat?: THREE.MeshPhysicalMaterial;
    metalMat?: THREE.MeshStandardMaterial;
    plaqueCanvas?: HTMLCanvasElement;
    plaqueTex?: THREE.CanvasTexture;
    liquidMesh?: THREE.Mesh;
    scene?: THREE.Scene;
    renderer?: THREE.WebGLRenderer;
    floorMesh?: THREE.Mesh;
    arGrid?: THREE.GridHelper;
  }>({});

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setControlsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Update dynamic materials, trigger aromatic reaction surge & refresh plaque CanvasTexture
  useEffect(() => {
    const refs = dynamicRefs.current;
    blendBoostRef.current = 1.0;
    if (refs.liquidMat) {
      refs.liquidMat.color.setHex(activePreset.liquidHex);
      refs.liquidMat.attenuationColor.setHex(activePreset.liquidHex);
    }
    if (refs.metalMat) {
      refs.metalMat.color.setHex(activePreset.metalHex);
    }
    if (refs.liquidMesh) {
      const fillFactor = Math.min(1.0, Math.max(0.45, 0.55 + formulation.concentrationPercent / 65));
      refs.liquidMesh.scale.y = fillFactor;
    }
    if (refs.plaqueCanvas && refs.plaqueTex) {
      drawPlaqueTexture(
        refs.plaqueCanvas,
        formulaTitle,
        batchCode,
        formulation.concentrationPercent,
        formulation.concentrationType,
        formulation.bottleVolumeMl,
      );
      refs.plaqueTex.needsUpdate = true;
    }
  }, [activePreset, formulaTitle, batchCode, formulation]);

  useEffect(() => {
    const refs = dynamicRefs.current;
    if (!refs.scene || !refs.renderer) return;
    if (arCameraActive) {
      refs.scene.background = null;
      refs.scene.fog = null;
      refs.renderer.setClearColor(0x000000, 0);
      if (refs.floorMesh) refs.floorMesh.visible = false;
      if (refs.arGrid) refs.arGrid.visible = true;
    } else {
      const bgHex = 0x171412;
      refs.scene.background = new THREE.Color(bgHex);
      refs.scene.fog = new THREE.FogExp2(bgHex, 0.036);
      refs.renderer.setClearColor(bgHex, 1);
      if (refs.floorMesh) refs.floorMesh.visible = true;
      if (refs.arGrid) refs.arGrid.visible = false;
    }
  }, [arCameraActive]);

  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
    camTransitionRef.current = true;
  }, [cameraPreset]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    const gl = renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererName = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName);

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    const onContextRestored = () => {
      setWebglUnavailable(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const bgHex = 0x171412;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.036);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      40,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      55,
    );
    camera.position.set(...CAMERA_PRESETS.hero.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2.1;
    controls.maxDistance = 11.5;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.target.set(...CAMERA_PRESETS.hero.target);
    const stopCamTransition = () => {
      camTransitionRef.current = false;
    };
    controls.addEventListener('start', stopCamTransition);

    // Studio three-point lighting
    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    keyLight.position.set(4, 7, 4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xfbbf24, 1.3);
    rimLight.position.set(-4.5, 4, -3.5);
    scene.add(rimLight);

    const fillLight = new THREE.HemisphereLight(0xfaf5ee, 0x292524, 0.65);
    scene.add(fillLight);

    // Shared disposal tracking
    const disposables: Array<{ dispose: () => void }> = [envTarget];

    // 1. Display Stage & Pedestal
    const stageGroup = new THREE.Group();
    const floorGeo = new THREE.CircleGeometry(8.5, isSoftwareGl ? 32 : 64);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.92, metalness: 0.08 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.78;
    floorMesh.receiveShadow = true;
    stageGroup.add(floorMesh);

    const plinthGeo = new THREE.CylinderGeometry(1.45, 1.6, 0.24, isSoftwareGl ? 24 : 48);
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.55, metalness: 0.2 });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.position.y = -0.66;
    plinthMesh.receiveShadow = true;
    plinthMesh.castShadow = true;
    stageGroup.add(plinthMesh);

    const brassTrimGeo = new THREE.TorusGeometry(1.46, 0.02, 16, 48);
    const metalMat = new THREE.MeshStandardMaterial({
      color: activePreset.metalHex,
      metalness: 0.92,
      roughness: 0.22,
    });
    const brassTrimMesh = new THREE.Mesh(brassTrimGeo, metalMat);
    brassTrimMesh.rotation.x = Math.PI / 2;
    brassTrimMesh.position.y = -0.54;
    stageGroup.add(brassTrimMesh);

    const arGrid = new THREE.GridHelper(9, 18, 0xf59e0b, 0x57534e);
    arGrid.position.y = -0.77;
    arGrid.visible = false;
    stageGroup.add(arGrid);
    disposables.push(arGrid.geometry);
    if (!Array.isArray(arGrid.material)) {
      disposables.push(arGrid.material);
    }
    scene.add(stageGroup);

    dynamicRefs.current.scene = scene;
    dynamicRefs.current.renderer = renderer;
    dynamicRefs.current.floorMesh = floorMesh;
    dynamicRefs.current.arGrid = arGrid;

    // 2. Composite Perfume Flacon Root Group
    const flaconRoot = new THREE.Group();
    scene.add(flaconRoot);

    const latheSegments = isSoftwareGl ? 16 : 32;

    // 2a. Crystal Glass Vessel (LatheGeometry outer silhouette)
    const outerPoints = [
      new THREE.Vector2(0.0, -0.52),
      new THREE.Vector2(0.68, -0.52),
      new THREE.Vector2(0.76, -0.42),
      new THREE.Vector2(0.76, 0.72),
      new THREE.Vector2(0.62, 0.92),
      new THREE.Vector2(0.24, 0.98),
      new THREE.Vector2(0.24, 1.14),
      new THREE.Vector2(0.26, 1.16),
    ];
    const bottleGeo = new THREE.LatheGeometry(outerPoints, latheSegments);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: isSoftwareGl ? 0 : 0.92,
      opacity: isSoftwareGl ? 0.42 : 1,
      transparent: true,
      roughness: 0.06,
      ior: 1.52,
      thickness: 0.45,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    });
    const bottleMesh = new THREE.Mesh(bottleGeo, glassMat);
    bottleMesh.castShadow = !isSoftwareGl;
    flaconRoot.add(bottleMesh);

    // 2b. Heavy Crystal Punt Base
    const puntGeo = new THREE.CylinderGeometry(0.64, 0.6, 0.2, latheSegments);
    const puntMat = new THREE.MeshPhysicalMaterial({
      color: 0xf5efe6,
      transmission: isSoftwareGl ? 0 : 0.78,
      opacity: isSoftwareGl ? 0.5 : 1,
      transparent: true,
      roughness: 0.1,
      ior: 1.54,
    });
    const puntMesh = new THREE.Mesh(puntGeo, puntMat);
    puntMesh.position.y = -0.39;
    flaconRoot.add(puntMesh);

    // 2c. Perfume Liquid Core
    const liquidPoints = [
      new THREE.Vector2(0.0, -0.26),
      new THREE.Vector2(0.64, -0.26),
      new THREE.Vector2(0.66, -0.18),
      new THREE.Vector2(0.66, 0.65),
      new THREE.Vector2(0.56, 0.78),
      new THREE.Vector2(0.0, 0.78),
    ];
    const liquidGeo = new THREE.LatheGeometry(liquidPoints, latheSegments);
    const liquidMat = new THREE.MeshPhysicalMaterial({
      color: activePreset.liquidHex,
      transmission: isSoftwareGl ? 0 : 0.55,
      transparent: true,
      opacity: 0.92,
      roughness: 0.08,
      ior: 1.38,
      attenuationColor: new THREE.Color(activePreset.liquidHex),
      attenuationDistance: 0.85,
    });
    const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    flaconRoot.add(liquidMesh);

    // 2d. Dynamic CanvasTexture Label Plaque (front face)
    const plaqueCanvas = document.createElement('canvas');
    plaqueCanvas.width = 512;
    plaqueCanvas.height = 360;
    drawPlaqueTexture(
      plaqueCanvas,
      formulaTitle,
      batchCode,
      formulation.concentrationPercent,
      formulation.concentrationType,
      formulation.bottleVolumeMl,
    );
    const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
    plaqueTex.colorSpace = THREE.SRGBColorSpace;
    plaqueTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const plaqueGroup = new THREE.Group();
    const plaqueFrameGeo = new THREE.BoxGeometry(0.92, 0.66, 0.03);
    const plaqueFrameMesh = new THREE.Mesh(plaqueFrameGeo, metalMat);
    const plaqueFaceGeo = new THREE.PlaneGeometry(0.86, 0.6);
    const plaqueFaceMat = new THREE.MeshStandardMaterial({
      map: plaqueTex,
      roughness: 0.35,
      metalness: 0.05,
    });
    const plaqueFaceMesh = new THREE.Mesh(plaqueFaceGeo, plaqueFaceMat);
    plaqueFaceMesh.position.z = 0.017;
    plaqueGroup.add(plaqueFrameMesh, plaqueFaceMesh);
    plaqueGroup.position.set(0, 0.22, 0.77);
    flaconRoot.add(plaqueGroup);

    // 2e. Dip Tube
    const tubeGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.35, 12);
    const tubeMat = new THREE.MeshPhysicalMaterial({
      color: 0xe7e5e4,
      transparent: true,
      opacity: 0.55,
      roughness: 0.12,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.position.set(0.05, 0.38, 0);
    tubeMesh.rotation.z = -0.07;
    flaconRoot.add(tubeMesh);

    // 2f. Metallic Crimp Collar & Atomizer Pump Head
    const collarGroup = new THREE.Group();
    const collarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.27, 0.22, 24),
      metalMat,
    );
    const sprayHeadMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.19, 0.2, 24),
      metalMat,
    );
    sprayHeadMesh.position.y = 0.2;

    const nozzleInsertMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.4, metalness: 0.3 });
    const nozzleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.05, 16),
      nozzleInsertMat,
    );
    nozzleMesh.rotation.x = Math.PI / 2;
    nozzleMesh.position.set(0, 0.21, 0.18);
    collarGroup.add(collarMesh, sprayHeadMesh, nozzleMesh);
    collarGroup.position.y = 1.15;
    flaconRoot.add(collarGroup);

    // 2g. Architectural Extruded Crown Cap
    const capGroup = new THREE.Group();
    const capShape = new THREE.Shape();
    capShape.moveTo(-0.34, -0.34);
    capShape.lineTo(0.34, -0.34);
    capShape.lineTo(0.42, 0);
    capShape.lineTo(0.34, 0.34);
    capShape.lineTo(-0.34, 0.34);
    capShape.lineTo(-0.42, 0);
    capShape.closePath();

    const capGeo = new THREE.ExtrudeGeometry(capShape, {
      depth: 0.46,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.04,
      bevelSegments: 3,
    });
    capGeo.rotateX(-Math.PI / 2);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x1f1916,
      roughness: 0.26,
      metalness: 0.42,
    });
    const capBodyMesh = new THREE.Mesh(capGeo, capMat);
    capBodyMesh.castShadow = !isSoftwareGl;

    const capCrownRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.3, 0.08, 24),
      metalMat,
    );
    capCrownRing.position.y = 0.54;
    capGroup.add(capBodyMesh, capCrownRing);
    capGroup.position.y = 1.46;
    flaconRoot.add(capGroup);

    // Spread instead of overwriting so scene, renderer, floorMesh, arGrid are preserved!
    dynamicRefs.current = {
      ...dynamicRefs.current,
      liquidMat,
      metalMat,
      plaqueCanvas,
      plaqueTex,
      liquidMesh,
    };

    disposables.push(
      floorGeo, floorMat, plinthGeo, plinthMat, brassTrimGeo, metalMat,
      bottleGeo, glassMat, puntGeo, puntMat, liquidGeo, liquidMat,
      plaqueTex, plaqueFrameGeo, plaqueFaceGeo, plaqueFaceMat,
      tubeGeo, tubeMat, collarMesh.geometry, sprayHeadMesh.geometry,
      nozzleMesh.geometry, nozzleInsertMat, capGeo, capMat, capCrownRing.geometry,
    );

    // 3. Interactive 3D Lab Equipment Stations around the Workbench
    const equipmentRoot = new THREE.Group();
    scene.add(equipmentRoot);

    type EquipmentHandle = {
      id: LabEquipmentId;
      targetTab: string;
      accentHex: number;
      baseColor: THREE.Color;
      hoverColor: THREE.Color;
      group: THREE.Group;
      baseY: number;
      haloMat: THREE.MeshBasicMaterial;
      outerGlowMesh: THREE.Mesh;
      outerGlowMat: THREE.MeshBasicMaterial;
      accentMat: THREE.MeshStandardMaterial;
      bodyMat: THREE.MeshStandardMaterial;
    };

    const hoverPointLight = new THREE.PointLight(0xfbbf24, 0, 3.8, 1.8);
    hoverPointLight.position.set(0, 0.25, 0);
    scene.add(hoverPointLight);
    const targetLightPos = new THREE.Vector3();
    const tmpColor = new THREE.Color();
    const camTargetPos = new THREE.Vector3();
    const camTargetLook = new THREE.Vector3();
    const projVec = new THREE.Vector3();

    const equipmentHandles: EquipmentHandle[] = [];
    const equipmentById = new Map<LabEquipmentId, EquipmentHandle>();
    let flaskLiqMat: THREE.MeshPhysicalMaterial | null = null;
    let scaleVialMat: THREE.MeshPhysicalMaterial | null = null;
    let mortarEssenceMat: THREE.MeshPhysicalMaterial | null = null;
    let mortarPestleMesh: THREE.Mesh | null = null;
    let hourglassChamberMat: THREE.MeshPhysicalMaterial | null = null;
    const rackVialMats: THREE.MeshPhysicalMaterial[] = [];

    // Raycast targets include central flacon meshes + plinth for occlusion, plus equipment hit proxies & visible meshes
    const raycastTargets: THREE.Object3D[] = [plinthMesh];
    flaconRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        raycastTargets.push(child);
      }
    });

    const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const ringBaseGeo = new THREE.RingGeometry(0.5, 0.6, 32);
    const outerGlowGeo = new THREE.RingGeometry(0.62, 0.76, 36);
    const proxyBoxGeo = new THREE.BoxGeometry(1.15, 1.25, 1.15);
    disposables.push(hitProxyMat, ringBaseGeo, outerGlowGeo, proxyBoxGeo);

    for (const eq of LAB_EQUIPMENT) {
      const g = new THREE.Group();
      g.position.set(eq.position[0], eq.position[1], eq.position[2]);
      g.lookAt(0, eq.position[1], 2.2);

      const eqHaloMat = new THREE.MeshBasicMaterial({
        color: eq.accentHex,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      });
      const haloMesh = new THREE.Mesh(ringBaseGeo, eqHaloMat);
      haloMesh.rotation.x = -Math.PI / 2;
      haloMesh.position.y = 0.015;
      g.add(haloMesh);

      const outerGlowMat = new THREE.MeshBasicMaterial({
        color: eq.accentHex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const outerGlowMesh = new THREE.Mesh(outerGlowGeo, outerGlowMat);
      outerGlowMesh.rotation.x = -Math.PI / 2;
      outerGlowMesh.position.y = 0.018;
      g.add(outerGlowMesh);

      const baseColor = new THREE.Color(eq.accentHex);
      const hoverColor = baseColor.clone().lerp(new THREE.Color(0xfffbeb), 0.48);

      const eqAccentMat = new THREE.MeshStandardMaterial({
        color: baseColor.clone(),
        roughness: 0.25,
        metalness: 0.72,
        emissive: baseColor.clone(),
        emissiveIntensity: 0.14,
      });

      const eqBodyMat = new THREE.MeshStandardMaterial({
        color: eq.id === 'ledger' || eq.id === 'vial_rack' || eq.id === 'abacus' ? 0x451a03 : 0x26211d,
        roughness: eq.id === 'ledger' ? 0.55 : 0.62,
        metalness: eq.id === 'ledger' ? 0.18 : 0.28,
        emissive: baseColor.clone(),
        emissiveIntensity: 0,
      });

      const eqSecondaryMat = new THREE.MeshStandardMaterial({
        color: eq.id === 'ledger' ? 0xfef3c7 : 0xd6d3d1,
        roughness: eq.id === 'ledger' ? 0.68 : 0.22,
        metalness: eq.id === 'ledger' ? 0.06 : 0.88,
        emissive: baseColor.clone(),
        emissiveIntensity: 0,
      });

      disposables.push(eqHaloMat, outerGlowMat, eqAccentMat, eqBodyMat, eqSecondaryMat);

      const eqMeshes: THREE.Mesh[] = [];

      if (eq.id === 'scale') {
        const bodyGeo = new THREE.BoxGeometry(0.86, 0.14, 0.72);
        const panGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 24);
        const screenGeo = new THREE.BoxGeometry(0.42, 0.03, 0.14);
        const vialGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.34, 16);
        scaleVialMat = new THREE.MeshPhysicalMaterial({
          color: 0xf59e0b,
          emissive: 0xd97706,
          emissiveIntensity: 0.28,
          roughness: 0.12,
          transparent: true,
          opacity: 0.88,
          clearcoat: 1,
        });
        const body = new THREE.Mesh(bodyGeo, eqBodyMat);
        body.position.y = 0.08;
        body.castShadow = !isSoftwareGl;
        const pan = new THREE.Mesh(panGeo, eqSecondaryMat);
        pan.position.set(0, 0.18, -0.06);
        const screen = new THREE.Mesh(screenGeo, eqAccentMat);
        screen.position.set(0, 0.155, 0.24);
        const vial = new THREE.Mesh(vialGeo, scaleVialMat);
        vial.position.set(0, 0.37, -0.06);
        g.add(body, pan, screen, vial);
        eqMeshes.push(body, pan, screen, vial);
        disposables.push(bodyGeo, panGeo, screenGeo, vialGeo, scaleVialMat);
      } else if (eq.id === 'flask') {
        const coneGeo = new THREE.CylinderGeometry(0.12, 0.42, 0.68, 22);
        const liqGeo = new THREE.CylinderGeometry(0.24, 0.36, 0.34, 20);
        const neckGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.16, 18);
        flaskLiqMat = new THREE.MeshPhysicalMaterial({
          color: 0x06b6d4,
          emissive: 0x0891b2,
          emissiveIntensity: 0.32,
          roughness: 0.08,
          transparent: true,
          opacity: 0.86,
          clearcoat: 1,
        });
        const flask = new THREE.Mesh(coneGeo, glassMat);
        flask.position.y = 0.36;
        flask.castShadow = !isSoftwareGl;
        const liq = new THREE.Mesh(liqGeo, flaskLiqMat);
        liq.position.y = 0.2;
        const neck = new THREE.Mesh(neckGeo, eqSecondaryMat);
        neck.position.y = 0.72;
        g.add(flask, liq, neck);
        eqMeshes.push(flask, liq, neck);
        disposables.push(coneGeo, liqGeo, neckGeo, flaskLiqMat);
      } else if (eq.id === 'pyramid') {
        const tier1Geo = new THREE.CylinderGeometry(0.28, 0.42, 0.22, 4);
        const tier2Geo = new THREE.CylinderGeometry(0.15, 0.27, 0.22, 4);
        const tier3Geo = new THREE.ConeGeometry(0.14, 0.26, 4);
        const t1 = new THREE.Mesh(tier1Geo, eqBodyMat);
        t1.position.y = 0.12;
        t1.castShadow = !isSoftwareGl;
        const t2 = new THREE.Mesh(tier2Geo, eqAccentMat);
        t2.position.y = 0.36;
        const t3 = new THREE.Mesh(tier3Geo, eqAccentMat);
        t3.position.y = 0.62;
        g.add(t1, t2, t3);
        eqMeshes.push(t1, t2, t3);
        disposables.push(tier1Geo, tier2Geo, tier3Geo);
      } else if (eq.id === 'abacus') {
        const baseGeo = new THREE.BoxGeometry(0.78, 0.09, 0.42);
        const pillarGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.64, 14);
        const beamGeo = new THREE.BoxGeometry(0.76, 0.045, 0.05);
        const panGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.05, 18);
        const weightGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.14, 14);
        const base = new THREE.Mesh(baseGeo, eqBodyMat);
        base.position.y = 0.05;
        base.castShadow = !isSoftwareGl;
        const pillar = new THREE.Mesh(pillarGeo, eqSecondaryMat);
        pillar.position.y = 0.38;
        const beam = new THREE.Mesh(beamGeo, eqAccentMat);
        beam.position.y = 0.68;
        beam.rotation.z = 0.08;
        const leftPan = new THREE.Mesh(panGeo, eqAccentMat);
        leftPan.position.set(-0.28, 0.42, 0);
        const rightPan = new THREE.Mesh(panGeo, eqAccentMat);
        rightPan.position.set(0.28, 0.48, 0);
        const weight = new THREE.Mesh(weightGeo, eqSecondaryMat);
        weight.position.set(-0.28, 0.52, 0);
        g.add(base, pillar, beam, leftPan, rightPan, weight);
        eqMeshes.push(base, pillar, beam, leftPan, rightPan, weight);
        disposables.push(baseGeo, pillarGeo, beamGeo, panGeo, weightGeo);
      } else if (eq.id === 'globe') {
        const footGeo = new THREE.CylinderGeometry(0.22, 0.3, 0.12, 20);
        const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.24, 12);
        const meridianGeo = new THREE.TorusGeometry(0.36, 0.024, 12, 32);
        const sphereGeo = new THREE.IcosahedronGeometry(0.28, 1);
        const ringEqGeo = new THREE.TorusGeometry(0.33, 0.018, 10, 32);
        const foot = new THREE.Mesh(footGeo, eqBodyMat);
        foot.position.y = 0.07;
        foot.castShadow = !isSoftwareGl;
        const stem = new THREE.Mesh(stemGeo, eqSecondaryMat);
        stem.position.y = 0.22;
        const meridian = new THREE.Mesh(meridianGeo, eqSecondaryMat);
        meridian.position.y = 0.56;
        meridian.rotation.y = 0.35;
        const sphere = new THREE.Mesh(sphereGeo, eqAccentMat);
        sphere.position.y = 0.56;
        const eqRing = new THREE.Mesh(ringEqGeo, eqSecondaryMat);
        eqRing.position.y = 0.56;
        eqRing.rotation.x = Math.PI / 2 - 0.28;
        g.add(foot, stem, meridian, sphere, eqRing);
        eqMeshes.push(foot, stem, meridian, sphere, eqRing);
        disposables.push(footGeo, stemGeo, meridianGeo, sphereGeo, ringEqGeo);
      } else if (eq.id === 'mortar') {
        const bowlGeo = new THREE.CylinderGeometry(0.36, 0.24, 0.34, 18);
        const rimGeo = new THREE.TorusGeometry(0.35, 0.04, 10, 24);
        const pestleGeo = new THREE.CylinderGeometry(0.05, 0.075, 0.56, 14);
        const herbGeo = new THREE.SphereGeometry(0.16, 14, 14);
        mortarEssenceMat = new THREE.MeshPhysicalMaterial({
          color: 0x10b981,
          emissive: 0x059669,
          emissiveIntensity: 0.3,
          roughness: 0.14,
          transparent: true,
          opacity: 0.9,
          clearcoat: 1,
        });
        const bowl = new THREE.Mesh(bowlGeo, eqBodyMat);
        bowl.position.y = 0.18;
        bowl.castShadow = !isSoftwareGl;
        const rim = new THREE.Mesh(rimGeo, eqAccentMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.34;
        const pestle = new THREE.Mesh(pestleGeo, eqSecondaryMat);
        pestle.position.set(0.12, 0.38, 0);
        pestle.rotation.z = -0.48;
        mortarPestleMesh = pestle;
        const herb = new THREE.Mesh(herbGeo, mortarEssenceMat);
        herb.position.set(-0.04, 0.26, 0.03);
        herb.scale.set(1.15, 0.72, 1.15);
        g.add(bowl, rim, pestle, herb);
        eqMeshes.push(bowl, rim, pestle, herb);
        disposables.push(bowlGeo, rimGeo, pestleGeo, herbGeo, mortarEssenceMat);
      } else if (eq.id === 'vial_rack') {
        const trayGeo = new THREE.BoxGeometry(0.84, 0.12, 0.42);
        const railGeo = new THREE.BoxGeometry(0.8, 0.04, 0.06);
        const vialGeo = new THREE.CylinderGeometry(0.09, 0.095, 0.42, 16);
        const capPipGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.14, 12);
        const tray = new THREE.Mesh(trayGeo, eqBodyMat);
        tray.position.y = 0.07;
        tray.castShadow = !isSoftwareGl;
        const rail = new THREE.Mesh(railGeo, eqSecondaryMat);
        rail.position.set(0, 0.28, -0.14);
        g.add(tray, rail);
        eqMeshes.push(tray, rail);
        const offsets = [-0.24, 0, 0.24];
        const baseVialColors = [0xa855f7, 0xd97706, 0x0ea5e9];
        for (let vi = 0; vi < offsets.length; vi += 1) {
          const ox = offsets[vi];
          const vMat = new THREE.MeshPhysicalMaterial({
            color: baseVialColors[vi],
            emissive: baseVialColors[vi],
            emissiveIntensity: 0.28,
            roughness: 0.1,
            transparent: true,
            opacity: 0.86,
            clearcoat: 1,
          });
          rackVialMats.push(vMat);
          disposables.push(vMat);
          const vial = new THREE.Mesh(vialGeo, vMat);
          vial.position.set(ox, 0.32, 0);
          const pipCap = new THREE.Mesh(capPipGeo, eqSecondaryMat);
          pipCap.position.set(ox, 0.58, 0);
          g.add(vial, pipCap);
          eqMeshes.push(vial, pipCap);
        }
        disposables.push(trayGeo, railGeo, vialGeo, capPipGeo);
      } else if (eq.id === 'hourglass') {
        const basePlateGeo = new THREE.CylinderGeometry(0.32, 0.34, 0.06, 20);
        const coneTopGeo = new THREE.ConeGeometry(0.24, 0.36, 18);
        const coneBotGeo = new THREE.ConeGeometry(0.24, 0.36, 18);
        const pillarGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.72, 10);
        hourglassChamberMat = new THREE.MeshPhysicalMaterial({
          color: 0xd97706,
          emissive: 0xb45309,
          emissiveIntensity: 0.28,
          roughness: 0.14,
          transparent: true,
          opacity: 0.9,
          clearcoat: 1,
        });
        const botPlate = new THREE.Mesh(basePlateGeo, eqBodyMat);
        botPlate.position.y = 0.04;
        const topPlate = new THREE.Mesh(basePlateGeo, eqBodyMat);
        topPlate.position.y = 0.78;
        const coneBot = new THREE.Mesh(coneBotGeo, hourglassChamberMat);
        coneBot.position.y = 0.23;
        const coneTop = new THREE.Mesh(coneTopGeo, glassMat);
        coneTop.rotation.x = Math.PI;
        coneTop.position.y = 0.59;
        const pL = new THREE.Mesh(pillarGeo, eqSecondaryMat);
        pL.position.set(-0.26, 0.41, 0);
        const pR = new THREE.Mesh(pillarGeo, eqSecondaryMat);
        pR.position.set(0.26, 0.41, 0);
        g.add(botPlate, topPlate, coneBot, coneTop, pL, pR);
        eqMeshes.push(botPlate, topPlate, coneBot, coneTop, pL, pR);
        disposables.push(basePlateGeo, coneTopGeo, coneBotGeo, pillarGeo, hourglassChamberMat);
      } else {
        const coverGeo = new THREE.BoxGeometry(0.74, 0.08, 0.56);
        const pagesGeo = new THREE.BoxGeometry(0.66, 0.14, 0.5);
        const sealGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 18);
        const cover = new THREE.Mesh(coverGeo, eqBodyMat);
        cover.position.y = 0.06;
        cover.castShadow = !isSoftwareGl;
        const pages = new THREE.Mesh(pagesGeo, eqSecondaryMat);
        pages.position.y = 0.14;
        const topCover = new THREE.Mesh(coverGeo, eqBodyMat);
        topCover.position.y = 0.23;
        const seal = new THREE.Mesh(sealGeo, eqAccentMat);
        seal.position.set(0.14, 0.28, 0.1);
        g.add(cover, pages, topCover, seal);
        eqMeshes.push(cover, pages, topCover, seal);
        disposables.push(coverGeo, pagesGeo, sealGeo);
      }

      const proxy = new THREE.Mesh(proxyBoxGeo, hitProxyMat);
      proxy.position.y = 0.52;
      proxy.userData.equipmentId = eq.id;
      g.add(proxy);

      for (const m of eqMeshes) {
        m.userData.equipmentId = eq.id;
        raycastTargets.push(m);
      }
      raycastTargets.push(proxy);
      equipmentRoot.add(g);

      const handle: EquipmentHandle = {
        id: eq.id,
        targetTab: eq.targetTab,
        accentHex: eq.accentHex,
        baseColor,
        hoverColor,
        group: g,
        baseY: eq.position[1],
        haloMat: eqHaloMat,
        outerGlowMesh,
        outerGlowMat,
        accentMat: eqAccentMat,
        bodyMat: eqBodyMat,
      };
      equipmentHandles.push(handle);
      equipmentById.set(eq.id, handle);
    }

    // 4. GPU-Instanced Aromatic Blending Bubbles across Flacon & Reactive 3D Lab Vessels
    const BUBBLE_COUNT = 144;
    const bubbleGeo = new THREE.SphereGeometry(0.022, isSoftwareGl ? 6 : 10, isSoftwareGl ? 6 : 10);
    const bubbleMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0xfef3c7,
      emissiveIntensity: 0.42,
      roughness: 0.08,
      metalness: 0.08,
      clearcoat: 1.0,
      iridescence: isSoftwareGl ? 0 : 0.85,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
    });
    const bubblesMesh = new THREE.InstancedMesh(bubbleGeo, bubbleMat, BUBBLE_COUNT);
    bubblesMesh.frustumCulled = false;
    bubblesMesh.renderOrder = 4;
    scene.add(bubblesMesh);
    disposables.push(bubbleGeo, bubbleMat);

    type BubbleVessel = 'flacon' | 'flask' | 'scale' | 'mortar' | 'vial_0' | 'vial_1' | 'vial_2';
    interface BubbleSeed {
      vessel: BubbleVessel;
      phase: number;
      speed: number;
      radius: number;
      angleOffset: number;
      swirlRate: number;
      size: number;
    }

    const bubbleSeeds: BubbleSeed[] = [];
    for (let i = 0; i < BUBBLE_COUNT; i += 1) {
      let vessel: BubbleVessel = 'flacon';
      if (i < 48) vessel = 'flacon';
      else if (i < 84) vessel = 'flask';
      else if (i < 102) vessel = 'scale';
      else if (i < 124) vessel = 'mortar';
      else if (i < 131) vessel = 'vial_0';
      else if (i < 138) vessel = 'vial_1';
      else vessel = 'vial_2';

      // Deterministic quasi-random distribution for clean natural effervescence
      const s1 = ((i * 73 + 19) % 97) / 97;
      const s2 = ((i * 41 + 7) % 89) / 89;
      const s3 = ((i * 59 + 31) % 83) / 83;
      bubbleSeeds.push({
        vessel,
        phase: (i / BUBBLE_COUNT + s1 * 0.25) % 1,
        speed: 0.24 + s2 * 0.34,
        radius: 0.18 + s3 * 0.82,
        angleOffset: s1 * Math.PI * 2,
        swirlRate: (s2 > 0.5 ? 1 : -1) * (1.2 + s3 * 1.8),
        size: 0.65 + s1 * 0.85,
      });
    }

    // Zero-GC scratch helpers for per-frame reaction & bubble simulation
    const _bubbleMat4 = new THREE.Matrix4();
    const _bubblePos = new THREE.Vector3();
    const _bubbleQuat = new THREE.Quaternion();
    const _bubbleScale = new THREE.Vector3();
    const _bubbleColor = new THREE.Color();
    const _elixirTargetCol = new THREE.Color();
    const _reactionPulseCol = new THREE.Color();
    const _flaskBaseCol = new THREE.Color(0x06b6d4);
    const _scaleBaseCol = new THREE.Color(0xf59e0b);
    const _mortarBaseCol = new THREE.Color(0x10b981);
    const _hourglassBaseCol = new THREE.Color(0xfbbf24);
    const _whiteSparkCol = new THREE.Color(0xfffbeb);
    const _vialPhaseColors = [
      new THREE.Color(0xa855f7),
      new THREE.Color(0xd97706),
      new THREE.Color(0x0ea5e9),
    ];

    // Raycasting hover & click on 3D lab equipment (drag-safe, occlusion-aware, touch-friendly)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownInfo = { x: 0, y: 0, active: false };
    let lastHoverTs = 0;

    const updateNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      return true;
    };

    const pickUnobstructedEquipment = (): LabEquipmentId | null => {
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(raycastTargets, false);
      if (hits.length === 0) return null;
      return resolveEquipmentId(hits[0].object);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.isPrimary === false) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerDownInfo = { x: e.clientX, y: e.clientY, active: true };
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTs < 35) return;
      lastHoverTs = now;
      if (!updateNdc(e.clientX, e.clientY)) return;
      const eqId = pickUnobstructedEquipment();
      if (eqId) {
        if (hoveredEquipmentRef.current !== eqId) {
          setHoveredEquipmentId(eqId);
        }
        renderer.domElement.style.cursor = 'pointer';
      } else {
        if (hoveredEquipmentRef.current !== null) {
          setHoveredEquipmentId(null);
        }
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onPointerLeaveOrCancel = () => {
      pointerDownInfo.active = false;
      if (hoveredEquipmentRef.current !== null) {
        setHoveredEquipmentId(null);
      }
      renderer.domElement.style.cursor = 'grab';
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDownInfo.active) return;
      pointerDownInfo.active = false;
      if (e.isPrimary === false) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (Math.hypot(e.clientX - pointerDownInfo.x, e.clientY - pointerDownInfo.y) > 8) {
        return;
      }
      if (!updateNdc(e.clientX, e.clientY)) return;
      const eqId = pickUnobstructedEquipment();
      if (eqId) {
        const spec = LAB_EQUIPMENT.find((item) => item.id === eqId);
        if (spec) {
          openEquipmentRef.current(spec);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerLeaveOrCancel);
    renderer.domElement.addEventListener('pointercancel', onPointerLeaveOrCancel);

    // Responsive ResizeObserver
    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    // Animation loop with fixed-clamp dt + smooth MathUtils.damp transitions
    let rafId = 0;
    let lastTime = performance.now();
    let lastProjState = { x: -999, y: -999, visible: false };

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const isExploded = explodedRef.current;
      capGroup.position.y = THREE.MathUtils.damp(capGroup.position.y, isExploded ? 2.48 : 1.46, 7, dt);
      collarGroup.position.y = THREE.MathUtils.damp(collarGroup.position.y, isExploded ? 1.72 : 1.15, 7, dt);
      tubeMesh.position.y = THREE.MathUtils.damp(tubeMesh.position.y, isExploded ? 0.95 : 0.38, 7, dt);
      plaqueGroup.position.z = THREE.MathUtils.damp(plaqueGroup.position.z, isExploded ? 1.25 : 0.77, 7, dt);
      liquidMesh.position.y = THREE.MathUtils.damp(liquidMesh.position.y, isExploded ? -0.08 : 0, 7, dt);

      if (camTransitionRef.current) {
        const preset = CAMERA_PRESETS[cameraPresetRef.current];
        camTargetPos.set(...preset.pos);
        camTargetLook.set(...preset.target);
        const camStep = 1 - Math.exp(-6 * dt);
        camera.position.lerp(camTargetPos, camStep);
        controls.target.lerp(camTargetLook, camStep);
        if (camera.position.distanceTo(camTargetPos) < 0.02) {
          camTransitionRef.current = false;
        }
      } else if (autoRotateRef.current) {
        flaconRoot.rotation.y += dt * 0.28;
      }

      let hoveredHandle: EquipmentHandle | null = null;
      const colorStep = 1 - Math.exp(-9 * dt);

      for (let i = 0; i < equipmentHandles.length; i += 1) {
        const eh = equipmentHandles[i];
        const isHovered = eh.id === hoveredEquipmentRef.current;
        if (isHovered) hoveredHandle = eh;

        const targetY = eh.baseY + (isHovered ? 0.12 : 0);
        eh.group.position.y = THREE.MathUtils.damp(eh.group.position.y, targetY, 8, dt);

        const targetScale = isHovered ? 1.13 : 1.0;
        const nextScale = THREE.MathUtils.damp(eh.group.scale.x, targetScale, 8, dt);
        eh.group.scale.setScalar(nextScale);

        eh.haloMat.opacity = THREE.MathUtils.damp(eh.haloMat.opacity, isHovered ? 0.92 : 0.24, 8, dt);
        eh.outerGlowMat.opacity = THREE.MathUtils.damp(eh.outerGlowMat.opacity, isHovered ? 0.75 : 0, 8, dt);
        const outerScale = THREE.MathUtils.damp(eh.outerGlowMesh.scale.x, isHovered ? 1.26 : 0.92, 8, dt);
        eh.outerGlowMesh.scale.set(outerScale, outerScale, 1);

        eh.accentMat.color.lerp(isHovered ? eh.hoverColor : eh.baseColor, colorStep);
        eh.accentMat.emissiveIntensity = THREE.MathUtils.damp(
          eh.accentMat.emissiveIntensity,
          isHovered ? 1.15 : 0.14,
          9,
          dt,
        );
        eh.bodyMat.emissiveIntensity = THREE.MathUtils.damp(
          eh.bodyMat.emissiveIntensity,
          isHovered ? 0.38 : 0,
          9,
          dt,
        );
      }

      if (hoveredHandle) {
        targetLightPos.set(
          hoveredHandle.group.position.x,
          hoveredHandle.baseY + 0.95,
          hoveredHandle.group.position.z,
        );
        hoverPointLight.position.lerp(targetLightPos, 1 - Math.exp(-12 * dt));
        tmpColor.setHex(hoveredHandle.accentHex);
        hoverPointLight.color.lerp(tmpColor, colorStep);
        hoverPointLight.intensity = THREE.MathUtils.damp(hoverPointLight.intensity, 3.0, 9, dt);

        // Project hovered 3D tool anchor to container-local 2D coordinates
        projVec.set(
          hoveredHandle.group.position.x,
          hoveredHandle.group.position.y + 1.08,
          hoveredHandle.group.position.z,
        );
        projVec.project(camera);
        const vw = container.clientWidth;
        const vh = container.clientHeight;
        const sx = Math.max(120, Math.min(vw - 120, ((projVec.x + 1) * 0.5) * vw));
        const sy = Math.max(58, Math.min(vh - 70, ((-projVec.y + 1) * 0.5) * vh));
        const inFront = projVec.z < 1;
        if (
          !lastProjState.visible ||
          Math.abs(lastProjState.x - sx) >= 2 ||
          Math.abs(lastProjState.y - sy) >= 2 ||
          lastProjState.visible !== inFront
        ) {
          lastProjState = { x: sx, y: sy, visible: inFront };
          setHoveredScreenPos({ x: sx, y: sy, visible: inFront });
        }
      } else {
        hoverPointLight.intensity = THREE.MathUtils.damp(hoverPointLight.intensity, 0, 9, dt);
        if (lastProjState.visible) {
          lastProjState = { x: 0, y: 0, visible: false };
          setHoveredScreenPos({ x: 0, y: 0, visible: false });
        }
      }

      // 5. Aromatic Blending Reaction: vessel color transitions & 144 rising instanced 3D bubbles
      const tSec = now * 0.001;
      const reactionOn = liveReactionRef.current;
      blendBoostRef.current = THREE.MathUtils.damp(blendBoostRef.current, 0, 0.55, dt);
      const boost = blendBoostRef.current;
      const activeActivity = reactionOn ? 0.35 + boost * 0.65 : boost * 0.85;

      const curPreset = activePresetRef.current;
      _elixirTargetCol.setHex(curPreset.liquidHex);
      _reactionPulseCol.setHex(curPreset.reactionHex);

      // Central Flacon liquid color wave & gentle swirl
      const flaconWave = 0.5 + 0.5 * Math.sin(tSec * (1.8 + boost * 4.5));
      _bubbleColor.copy(_elixirTargetCol).lerp(_reactionPulseCol, (0.18 + boost * 0.55) * flaconWave);
      liquidMat.color.lerp(_bubbleColor, 1 - Math.exp(-6 * dt));
      liquidMat.attenuationColor.copy(liquidMat.color);
      liquidMat.emissive.copy(_reactionPulseCol);
      liquidMat.emissiveIntensity = THREE.MathUtils.damp(
        liquidMat.emissiveIntensity,
        reactionOn ? 0.12 + boost * 0.42 : 0.04,
        6,
        dt,
      );
      if (activeActivity > 0.05) {
        liquidMesh.rotation.y += dt * (0.25 + boost * 2.1);
      }

      // Reactive 3D Lab Vessels color transition & pestle blending motion
      const blendWaveA = 0.5 + 0.5 * Math.sin(tSec * 2.1);
      const blendWaveB = 0.5 + 0.5 * Math.cos(tSec * 1.7 + 1.1);
      const blendStep = 1 - Math.exp(-5.5 * dt);

      if (flaskLiqMat) {
        const emMix = reactionOn ? 0.25 + 0.45 * blendWaveA + boost * 0.25 : 0.05;
        _bubbleColor.copy(_flaskBaseCol).lerp(_elixirTargetCol, emMix).lerp(_reactionPulseCol, boost * 0.35);
        flaskLiqMat.color.lerp(_bubbleColor, blendStep);
        flaskLiqMat.emissive.copy(flaskLiqMat.color);
        flaskLiqMat.emissiveIntensity = 0.24 + activeActivity * 0.55;
      }

      if (scaleVialMat) {
        const sMix = reactionOn ? 0.2 + 0.45 * blendWaveB + boost * 0.3 : 0.05;
        _bubbleColor.copy(_scaleBaseCol).lerp(_reactionPulseCol, sMix);
        scaleVialMat.color.lerp(_bubbleColor, blendStep);
        scaleVialMat.emissive.copy(scaleVialMat.color);
        scaleVialMat.emissiveIntensity = 0.22 + activeActivity * 0.5;
      }

      if (mortarEssenceMat) {
        const mMix = reactionOn ? 0.22 + 0.5 * blendWaveA + boost * 0.28 : 0.05;
        _bubbleColor.copy(_mortarBaseCol).lerp(_elixirTargetCol, mMix).lerp(_reactionPulseCol, boost * 0.32);
        mortarEssenceMat.color.lerp(_bubbleColor, blendStep);
        mortarEssenceMat.emissive.copy(mortarEssenceMat.color);
        mortarEssenceMat.emissiveIntensity = 0.22 + activeActivity * 0.55;
      }

      if (mortarPestleMesh) {
        const grindRadius = activeActivity > 0.08 ? 0.09 + boost * 0.05 : 0.02;
        const grindAngle = tSec * (2.2 + boost * 3.8);
        mortarPestleMesh.position.x = 0.08 + Math.cos(grindAngle) * grindRadius;
        mortarPestleMesh.position.z = Math.sin(grindAngle) * grindRadius;
        mortarPestleMesh.rotation.z = -0.45 + Math.cos(grindAngle) * 0.14 * activeActivity;
      }

      if (hourglassChamberMat) {
        const hMix = reactionOn ? 0.3 + 0.45 * blendWaveB + boost * 0.25 : 0.15;
        _bubbleColor.copy(_hourglassBaseCol).lerp(_elixirTargetCol, hMix);
        hourglassChamberMat.color.lerp(_bubbleColor, blendStep);
        hourglassChamberMat.emissive.copy(hourglassChamberMat.color);
        hourglassChamberMat.emissiveIntensity = 0.22 + activeActivity * 0.42;
      }

      for (let vi = 0; vi < rackVialMats.length; vi += 1) {
        const vMat = rackVialMats[vi];
        const vWave = 0.5 + 0.5 * Math.sin(tSec * 1.9 + vi * 1.4);
        _bubbleColor.copy(_vialPhaseColors[vi]).lerp(_reactionPulseCol, (0.28 + boost * 0.52) * vWave);
        vMat.color.lerp(_bubbleColor, blendStep);
        vMat.emissive.copy(vMat.color);
        vMat.emissiveIntensity = 0.24 + activeActivity * 0.48;
      }

      // Update all 144 GPU-instanced bubbles
      const flaskHandle = equipmentById.get('flask');
      const scaleHandle = equipmentById.get('scale');
      const mortarHandle = equipmentById.get('mortar');
      const rackHandle = equipmentById.get('vial_rack');
      const bubbleSpeedMul = reactionOn ? 0.85 + boost * 1.65 : boost * 1.1;

      for (let i = 0; i < BUBBLE_COUNT; i += 1) {
        const b = bubbleSeeds[i];
        const p = (b.phase + tSec * b.speed * bubbleSpeedMul) % 1;
        const fadeEnv = activeActivity < 0.02 ? 0 : Math.sin(p * Math.PI);
        const angle = b.angleOffset + tSec * b.swirlRate * (1 + boost * 1.3);

        let localScale = b.size * (0.45 + 0.75 * fadeEnv) * (0.65 + activeActivity * 0.6);

        if (b.vessel === 'flacon') {
          const maxR = 0.52 * b.radius * (1 - p * 0.15);
          _bubblePos.set(
            Math.cos(angle) * maxR,
            -0.22 + p * 0.94 + liquidMesh.position.y,
            Math.sin(angle) * maxR,
          );
          _bubbleColor.copy(_elixirTargetCol).lerp(_whiteSparkCol, 0.48 + 0.35 * fadeEnv);
        } else if (b.vessel === 'flask' && flaskHandle) {
          const isVesselHover = hoveredEquipmentRef.current === 'flask';
          const taper = 0.28 - p * 0.19;
          const r = taper * b.radius;
          _bubblePos.set(Math.cos(angle) * r, 0.1 + p * 0.58, Math.sin(angle) * r);
          _bubblePos.applyQuaternion(flaskHandle.group.quaternion);
          _bubblePos.multiplyScalar(flaskHandle.group.scale.x);
          _bubblePos.add(flaskHandle.group.position);
          _bubbleColor.copy(flaskLiqMat ? flaskLiqMat.color : _flaskBaseCol).lerp(_whiteSparkCol, 0.55);
          if (isVesselHover) localScale *= 1.28;
        } else if (b.vessel === 'scale' && scaleHandle) {
          const isVesselHover = hoveredEquipmentRef.current === 'scale';
          const r = 0.058 * b.radius;
          _bubblePos.set(Math.cos(angle) * r, 0.23 + p * 0.3, -0.06 + Math.sin(angle) * r);
          _bubblePos.applyQuaternion(scaleHandle.group.quaternion);
          _bubblePos.multiplyScalar(scaleHandle.group.scale.x);
          _bubblePos.add(scaleHandle.group.position);
          _bubbleColor.copy(scaleVialMat ? scaleVialMat.color : _scaleBaseCol).lerp(_whiteSparkCol, 0.52);
          if (isVesselHover) localScale *= 1.25;
        } else if (b.vessel === 'mortar' && mortarHandle) {
          const isVesselHover = hoveredEquipmentRef.current === 'mortar';
          const r = (0.08 + p * 0.16) * b.radius;
          _bubblePos.set(
            -0.02 + Math.cos(angle) * r,
            0.27 + p * 0.55,
            0.02 + Math.sin(angle) * r,
          );
          _bubblePos.applyQuaternion(mortarHandle.group.quaternion);
          _bubblePos.multiplyScalar(mortarHandle.group.scale.x);
          _bubblePos.add(mortarHandle.group.position);
          _bubbleColor.copy(mortarEssenceMat ? mortarEssenceMat.color : _mortarBaseCol).lerp(_reactionPulseCol, 0.45);
          if (isVesselHover) localScale *= 1.3;
        } else if (rackHandle) {
          const isVesselHover = hoveredEquipmentRef.current === 'vial_rack';
          const vIdx = b.vessel === 'vial_0' ? 0 : b.vessel === 'vial_1' ? 1 : 2;
          const ox = vIdx === 0 ? -0.24 : vIdx === 1 ? 0 : 0.24;
          const r = 0.055 * b.radius;
          _bubblePos.set(ox + Math.cos(angle) * r, 0.14 + p * 0.36, Math.sin(angle) * r);
          _bubblePos.applyQuaternion(rackHandle.group.quaternion);
          _bubblePos.multiplyScalar(rackHandle.group.scale.x);
          _bubblePos.add(rackHandle.group.position);
          const refMat = rackVialMats[vIdx];
          _bubbleColor.copy(refMat ? refMat.color : _whiteSparkCol).lerp(_whiteSparkCol, 0.5);
          if (isVesselHover) localScale *= 1.25;
        } else {
          localScale = 0;
        }

        _bubbleScale.setScalar(Math.max(0.0001, localScale));
        _bubbleMat4.compose(_bubblePos, _bubbleQuat, _bubbleScale);
        bubblesMesh.setMatrixAt(i, _bubbleMat4);
        bubblesMesh.setColorAt(i, _bubbleColor);
      }
      bubblesMesh.instanceMatrix.needsUpdate = true;
      if (bubblesMesh.instanceColor) {
        bubblesMesh.instanceColor.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.removeEventListener('start', stopCamTransition);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeaveOrCancel);
      renderer.domElement.removeEventListener('pointercancel', onPointerLeaveOrCancel);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          // ignore
        }
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      dynamicRefs.current = {};
    };
  }, []);

  return (
    <section className="space-y-4 animate-in fade-in">
      <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-sm">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-stone-900 font-serif-luxury">
              {L('title')}
            </h2>
            <p className="text-xs text-stone-500">
              {L('subtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={toggleArCamera}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              arCameraActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                : 'bg-amber-400 hover:bg-amber-300 text-stone-950 border-amber-300'
            }`}
          >
            {arCameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            <span>{arCameraActive ? L('ar_stop') : L('ar_start')}</span>
          </button>

          <button
            type="button"
            onClick={() => setControlsCollapsed((c) => !c)}
            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1.5 border border-stone-200 cursor-pointer whitespace-nowrap shrink-0"
            title={txt('إخفاء أو إظهار شريط التحكم (H)', 'Toggle controls (H)')}
          >
            {controlsCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{controlsCollapsed ? L('show_controls') : L('hide_controls')}</span>
          </button>
        </div>
      </div>

      {arCamError && (
        <div className="bg-amber-950 text-amber-200 px-4 py-2 rounded-2xl text-xs flex items-center justify-between gap-2">
          <span>{arCamError}</span>
          <button type="button" onClick={() => setArCamError(null)} className="font-bold px-2 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Interactive 3D Viewport Stage */}
      <div className="relative rounded-3xl overflow-hidden border border-stone-800 bg-stone-950 shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300 ${
            arCameraActive ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className="relative">
          <div ref={mountRef} className="relative z-10 w-full h-[520px] sm:h-[580px]" />

          {/* Spatial Projected Floating Callout directly above the hovered 3D tool (solid surface, zero backdrop-blur) */}
          {hoveredEquipment && hoveredScreenPos.visible && !webglUnavailable && (
            <div
              style={{
                left: `${hoveredScreenPos.x}px`,
                top: `${hoveredScreenPos.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
              className="absolute z-20 pointer-events-none max-w-[230px] rounded-2xl bg-stone-950 border border-amber-400/75 px-3 py-2 shadow-2xl text-white transition-transform duration-100"
            >
              <div className="flex items-center justify-between gap-2 text-[10px] text-stone-400 mb-0.5">
                <span className="flex items-center gap-1 font-semibold text-amber-300">
                  {hoveredEquipment.category === 'calculator' ? (
                    <Calculator className="w-3 h-3 shrink-0" />
                  ) : (
                    <Info className="w-3 h-3 shrink-0" />
                  )}
                  <span>
                    {hoveredEquipment.category === 'calculator' ? L('cat_calculator') : L('cat_info')}
                  </span>
                </span>
                <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <hoveredEquipment.icon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{txt(hoveredEquipment.nameAr, hoveredEquipment.nameEn)}</span>
              </div>
              <p className="text-[10px] text-stone-300 mt-0.5 leading-snug">
                {txt(hoveredEquipment.descAr, hoveredEquipment.descEn)}
              </p>
              <div className="text-[10px] font-bold text-emerald-400 mt-1">
                {L('click_to_open')}
              </div>
            </div>
          )}

          {/* Fallback corner readout when hovering from the bottom equipment dock bar */}
          {hoveredEquipment && !hoveredScreenPos.visible && !webglUnavailable && (
            <div className="absolute top-3 left-3 z-20 pointer-events-none max-w-xs rounded-2xl bg-stone-950 border border-amber-500/60 px-3.5 py-2.5 shadow-xl text-white">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <hoveredEquipment.icon className="w-4 h-4 shrink-0" />
                <span>{txt(hoveredEquipment.nameAr, hoveredEquipment.nameEn)}</span>
              </div>
              <p className="text-[11px] text-stone-300 mt-0.5">
                {txt(hoveredEquipment.descAr, hoveredEquipment.descEn)}
              </p>
              <div className="text-[10px] font-bold text-emerald-400 mt-1 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                <span>{L('click_to_open')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Fallback overlay if WebGL fails */}
        {webglUnavailable && (
          <div className="absolute inset-0 z-30 bg-stone-950 text-stone-200 flex flex-col items-center justify-center p-6 text-center space-y-2">
            <EyeOff className="w-8 h-8 text-amber-400" />
            <div className="font-bold text-sm">
              {txt('عرض ثلاثي الأبعاد غير مدعوم على هذا المتصفح حالياً', 'WebGL 3D context is unavailable on this browser')}
            </div>
            <p className="text-xs text-stone-400 max-w-md">
              {txt(
                'يمكنك استخدام شريط الأدوات المخبرية أدناه لفتح الحاسبات وصفحات المعلومات مباشرة.',
                'Use the lab equipment bar below to open any calculator or information page directly.',
              )}
            </p>
          </div>
        )}

        {/* Solid Collapsible Bottom Control Dock (no backdrop-blur over WebGL canvas) */}
        {!controlsCollapsed && (
          <div className="bg-stone-900 border-t border-stone-800 px-4 py-3.5 text-xs text-stone-200 space-y-3">
            {/* Clickable 3D Workbench Equipment Quick Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 shrink-0 pe-1">
                <FlaskConical className="w-3.5 h-3.5" />
                <span>{L('bench_equipment')}</span>
              </span>
              {LAB_EQUIPMENT.map((eq) => {
                const EqIcon = eq.icon;
                const isHover = hoveredEquipmentId === eq.id;
                return (
                  <button
                    key={eq.id}
                    type="button"
                    onMouseEnter={() => setHoveredEquipmentId(eq.id)}
                    onMouseLeave={() => setHoveredEquipmentId(null)}
                    onClick={() => openEquipmentDestination(eq)}
                    title={txt(eq.descAr, eq.descEn)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors ${
                      isHover
                        ? 'bg-stone-800 border-amber-400 text-amber-300'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-amber-500/60 hover:text-white'
                    }`}
                  >
                    <EqIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{txt(eq.nameAr, eq.nameEn)}</span>
                    <span className="text-[9px] text-stone-500">
                      {eq.category === 'calculator' ? txt('حاسبة', 'Calc') : txt('معلومات', 'Info')}
                    </span>
                  </button>
                );
              })}
            </div>

            {!webglUnavailable && (
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Scent Elixir Shade */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5" />
                    <span>{txt('لون الإكسير:', 'Elixir:')}</span>
                  </span>
                  {ELIXIR_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPresetId(p.id)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                        presetId === p.id
                          ? 'bg-stone-800 border-amber-400 text-white'
                          : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-white'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${p.accentCss}`} />
                      <span>{txt(p.nameAr, p.nameEn)}</span>
                    </button>
                  ))}
                </div>

                {/* Camera & Aromatic Blending Reaction Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    key={blendPulseCount}
                    type="button"
                    onClick={triggerBlendReaction}
                    className="px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 bg-amber-500 hover:bg-amber-400 text-stone-950 border-amber-300"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>{L('blend_trigger')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLiveReaction((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      liveReaction
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60'
                        : 'bg-stone-950 text-stone-400 border-stone-700'
                    }`}
                  >
                    {liveReaction ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{liveReaction ? L('reaction_live') : L('reaction_paused')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExploded((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      exploded
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-stone-950 text-stone-300 border-stone-700 hover:border-amber-500'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{exploded ? txt('تجميع الزجاجة', 'Assemble Flacon') : txt('تفكيك هندسي', 'Exploded View')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutoRotate((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      autoRotate
                        ? 'bg-stone-800 text-amber-300 border-amber-500/60'
                        : 'bg-stone-950 text-stone-400 border-stone-700'
                    }`}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>{autoRotate ? txt('دوران تلقائي', 'Auto Orbit') : txt('تثبيت', 'Static')}</span>
                  </button>

                  <div className="flex items-center gap-1 bg-stone-950 border border-stone-800 rounded-xl p-1">
                    <Camera className="w-3.5 h-3.5 text-stone-400 mx-1" />
                    {(
                      [
                        ['hero', txt('منظور', 'Hero')],
                        ['workbench', txt('الطاولة', 'Bench')],
                        ['plaque', txt('اللوحة', 'Plaque')],
                        ['crown', txt('الغطاء', 'Crown')],
                        ['nozzle', txt('البخاخ', 'Nozzle')],
                      ] as Array<[CameraPresetId, string]>
                    ).map(([cid, label]) => (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => setCameraPreset(cid)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                          cameraPreset === cid ? 'bg-amber-700 text-white' : 'text-stone-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Spec Footer Note */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold">
          <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            {txt(
              `الزجاجة تعرض لوحة «${formulaTitle || 'عطر شام'}» بتركيز ${formulation.concentrationPercent}% (${formulation.bottleVolumeMl} مل) — انقر على أي أداة معملية حولها لفتح حاسبتها أو صفحتها فوراً.`,
              `Plaque reflects "${formulaTitle || 'Sham Signature'}" at ${formulation.concentrationPercent}% (${formulation.bottleVolumeMl} mL) — click any surrounding 3D tool to open its calculator or info page.`,
            )}
          </span>
        </span>
        <span className="text-[11px] text-amber-800">
          {txt('اسحب للتدوير · مرر للتقريب · انقر على أي أداة للفتح', 'Drag to orbit · Scroll to zoom · Click any 3D tool to open')}
        </span>
      </div>
    </section>
  );
};
