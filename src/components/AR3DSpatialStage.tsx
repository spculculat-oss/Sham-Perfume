import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  Camera,
  CameraOff,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Layers,
  RotateCcw,
  RotateCw,
  Scan,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { makeT } from '../لغات/localize';

export interface AR3DStageCameraSpec {
  position: [number, number, number];
  target: [number, number, number];
}

interface AR3DSpatialStageProps {
  currentLang: SupportedLanguage;
  title: string;
  subtitle?: string;
  badgeText?: string;
  heightClass?: string;
  cameraSpec?: AR3DStageCameraSpec;
  cameraKey?: string;
  showExplodeButton?: boolean;
  exploded?: boolean;
  onToggleExploded?: () => void;
  defaultAutoOrbit?: boolean;
  groundRadius?: number;
  topLeftOverlay?: React.ReactNode;
  bottomExtraControls?: React.ReactNode;
  children: (ctx: {
    arCameraActive: boolean;
    isSoftwareGl: boolean;
    exploded: boolean;
  }) => React.ReactNode;
}

const STAGE_STRINGS = {
  enable_ar: {
    ar: 'الواقع المعزز AR',
    en: 'AR Camera',
    fr: 'Caméra RA',
    es: 'Cámara RA',
    it: 'Fotocamera AR',
    de: 'AR-Kamera',
    ru: 'AR-камера',
    zh: 'AR 实景',
    tr: 'AR Kamera',
    fa: 'دوربین AR',
  },
  stop_ar: {
    ar: 'بيئة الاستوديو 3D',
    en: '3D Studio Mode',
    fr: 'Studio 3D',
    es: 'Estudio 3D',
    it: 'Studio 3D',
    de: '3D-Studio',
    ru: '3D-студия',
    zh: '3D 空间',
    tr: '3D Stüdyo',
    fa: 'استودیوی سه‌بعدی',
  },
  ar_active: {
    ar: 'AR مباشر',
    en: 'Live AR',
    fr: 'RA en direct',
    es: 'RA en vivo',
    it: 'AR dal vivo',
    de: 'Live-AR',
    ru: 'Live AR',
    zh: 'AR 实景中',
    tr: 'Canlı AR',
    fa: 'AR زنده',
  },
  studio_mode: {
    ar: 'عرض 3D تفاعلي',
    en: 'Interactive 3D',
    fr: '3D interactif',
    es: '3D interactivo',
    it: '3D interattivo',
    de: 'Interaktiv 3D',
    ru: 'Интерактив 3D',
    zh: '交互式 3D',
    tr: 'Etkileşimli 3D',
    fa: 'سه‌بعدی تعاملی',
  },
  explode: {
    ar: 'تفكيك الطبقات',
    en: 'Explode Layers',
    fr: 'Vue éclatée',
    es: 'Vista desglosada',
    it: 'Vista esplosa',
    de: 'Explodieren',
    ru: 'Разбор слоёв',
    zh: '分层拆解',
    tr: 'Katmanları Aç',
    fa: 'تفکیک لایه‌ها',
  },
  auto_orbit: {
    ar: 'دوران',
    en: 'Orbit',
    fr: 'Rotation',
    es: 'Órbita',
    it: 'Orbita',
    de: 'Drehen',
    ru: 'Орбита',
    zh: '环绕',
    tr: 'Dönüş',
    fa: 'چرخش',
  },
  reset: {
    ar: 'إعادة الضبط',
    en: 'Reset',
    fr: 'Réinitialiser',
    es: 'Restablecer',
    it: 'Ripristina',
    de: 'Zurücksetzen',
    ru: 'Сброс',
    zh: '重置',
    tr: 'Sıfırla',
    fa: 'بازنشانی',
  },
  hide_hud: {
    ar: 'طي',
    en: 'Hide',
    fr: 'Masquer',
    es: 'Ocultar',
    it: 'Nascondi',
    de: 'Ausblenden',
    ru: 'Скрыть',
    zh: '收起',
    tr: 'Gizle',
    fa: 'پنهان',
  },
  show_hud: {
    ar: 'تحكم 3D/AR',
    en: '3D/AR Bar',
    fr: 'Contrôles 3D',
    es: 'Controles 3D',
    it: 'Controlli 3D',
    de: '3D-Steuerung',
    ru: 'Панель 3D',
    zh: '3D 控制',
    tr: '3D Kontrol',
    fa: 'کنترل سه‌بعدی',
  },
  cam_err: {
    ar: 'تعذّر فتح الكاميرا أو لم يُمنح الإذن؛ تم الإبقاء على العرض الثلاثي الأبعاد.',
    en: 'Camera access unavailable or declined; interactive 3D remains active.',
    fr: 'Caméra indisponible ou refusée ; la scène 3D reste active.',
    es: 'Cámara no disponible o denegada; la escena 3D sigue activa.',
    it: 'Fotocamera non disponibile o negata; la scena 3D resta attiva.',
    de: 'Kamera nicht verfügbar oder abgelehnt; 3D bleibt aktiv.',
    ru: 'Камера недоступна; 3D-сцена остаётся активной.',
    zh: '相机不可用或权限被拒绝；已保持 3D 交互场景。',
    tr: 'Kamera kullanılamıyor veya reddedildi; 3D sahne aktif kaldı.',
    fa: 'دسترسی به دوربین ممکن نشد؛ نمای سه‌بعدی فعال است.',
  },
  webgl_err: {
    ar: 'تسريع WebGL غير متاح حالياً في هذا المتصفح.',
    en: '3D WebGL acceleration is currently unavailable in this browser.',
    fr: 'L’accélération WebGL 3D est indisponible.',
    es: 'WebGL 3D no está disponible actualmente.',
    it: 'WebGL 3D non disponibile in questo browser.',
    de: '3D-WebGL ist derzeit nicht verfügbar.',
    ru: 'Ускорение WebGL 3D недоступно.',
    zh: '当前浏览器不支持 WebGL 3D 加速。',
    tr: 'Bu tarayıcıda 3D WebGL şu anda kullanılamıyor.',
    fa: 'شتاب‌دهنده سه‌بعدی WebGL در دسترس نیست.',
  },
  drag_hint: {
    ar: 'اسحب للتدوير · مرر للتكبير · فعّل الكاميرا للواقع المعزز',
    en: 'Drag to orbit · Scroll to zoom · Enable camera for live AR',
    fr: 'Glisser pour pivoter · Zoom molette · Caméra pour RA',
    es: 'Arrastra para rotar · Rueda para zoom · Cámara para RA',
    it: 'Trascina per ruotare · Scorri per zoom · Fotocamera per AR',
    de: 'Ziehen zum Drehen · Scrollen für Zoom · Kamera für AR',
    ru: 'Тяните для вращения · Колёсико для зума · Камера для AR',
    zh: '拖动旋转 · 滚轮缩放 · 开启相机体验 AR',
    tr: 'Döndürmek için sürükle · Yakınlaştır · Canlı AR için kamera',
    fa: 'بکشید برای چرخش · اسکرول برای بزرگنمایی · دوربین برای AR',
  },
};

const SceneRig: React.FC<{
  arCameraActive: boolean;
  autoOrbit: boolean;
  resetSignal: number;
  cameraSpec: AR3DStageCameraSpec;
  cameraKey?: string;
  isSoftwareGl: boolean;
  groundRadius: number;
  children: React.ReactNode;
}> = ({
  arCameraActive,
  autoOrbit,
  resetSignal,
  cameraSpec,
  cameraKey,
  isSoftwareGl,
  groundRadius,
  children,
}) => {
  const { gl, scene, camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const stageRootRef = useRef<THREE.Group>(null);
  const userDraggingRef = useRef(false);
  const camTransitionRef = useRef(false);
  const tiltRef = useRef({ x: 0, y: 0 });

  const targetCamPos = useMemo(
    () => new THREE.Vector3(...cameraSpec.position),
    [cameraSpec.position],
  );
  const targetLook = useMemo(
    () => new THREE.Vector3(...cameraSpec.target),
    [cameraSpec.target],
  );

  useEffect(() => {
    if (arCameraActive) {
      scene.background = null;
      scene.fog = null;
      gl.setClearColor(0x000000, 0);
    } else {
      scene.background = new THREE.Color(0x110e0c);
      scene.fog = new THREE.FogExp2(0x110e0c, 0.042);
      gl.setClearColor(0x110e0c, 1);
    }
  }, [arCameraActive, gl, scene]);

  useEffect(() => {
    if (resetSignal > 0 || cameraKey) {
      camTransitionRef.current = true;
    }
  }, [resetSignal, cameraKey]);

  useEffect(() => {
    const onOrientation = (ev: DeviceOrientationEvent) => {
      if (!arCameraActive) return;
      if (typeof ev.gamma === 'number') {
        tiltRef.current.x = THREE.MathUtils.clamp(ev.gamma / 45, -1, 1) * 0.22;
      }
      if (typeof ev.beta === 'number') {
        tiltRef.current.y = THREE.MathUtils.clamp((ev.beta - 45) / 45, -1, 1) * 0.14;
      }
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [arCameraActive]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);

    if (stageRootRef.current) {
      if (arCameraActive) {
        stageRootRef.current.rotation.y +=
          (tiltRef.current.x - stageRootRef.current.rotation.y) * (1 - Math.exp(-5 * dt));
        stageRootRef.current.rotation.x +=
          (tiltRef.current.y - stageRootRef.current.rotation.x) * (1 - Math.exp(-5 * dt));
      } else {
        stageRootRef.current.rotation.x = THREE.MathUtils.damp(stageRootRef.current.rotation.x, 0, 5, dt);
        stageRootRef.current.rotation.y = THREE.MathUtils.damp(stageRootRef.current.rotation.y, 0, 5, dt);
      }
    }

    if (camTransitionRef.current && controlsRef.current) {
      camera.position.lerp(targetCamPos, 1 - Math.exp(-6 * dt));
      controlsRef.current.target.lerp(targetLook, 1 - Math.exp(-6 * dt));
      controlsRef.current.update();
      if (camera.position.distanceTo(targetCamPos) < 0.03) {
        camTransitionRef.current = false;
      }
    }
  });

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        target={[cameraSpec.target[0], cameraSpec.target[1], cameraSpec.target[2]]}
        enableDamping={!isSoftwareGl}
        dampingFactor={0.07}
        autoRotate={autoOrbit && !isSoftwareGl && !userDraggingRef.current}
        autoRotateSpeed={0.9}
        minDistance={1.8}
        maxDistance={11.5}
        maxPolarAngle={Math.PI * 0.56}
        minPolarAngle={0.14}
        onStart={() => {
          userDraggingRef.current = true;
          camTransitionRef.current = false;
        }}
        onEnd={() => {
          userDraggingRef.current = false;
        }}
      />

      {/* Zero-404 Procedural Studio Reflection Environment */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#fff3dc"
          scale={[10, 4, 1]}
          position={[0, 6, 4]}
          rotation={[Math.PI / 3, 0, 0]}
        />
        <Lightformer
          form="ring"
          intensity={1.6}
          color="#f59e0b"
          scale={[6, 6, 1]}
          position={[-5, 3, -4]}
          rotation={[0, Math.PI / 4, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#cbd5e1"
          scale={[8, 3, 1]}
          position={[5, 4, -2]}
          rotation={[0, -Math.PI / 2, 0]}
        />
      </Environment>

      {/* Calibrated 3-Point Lighting Rig */}
      <directionalLight
        position={[4.5, 8.5, 5.5]}
        intensity={2.1}
        color="#fff1d6"
        castShadow={!isSoftwareGl}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-5, 4, -5]} intensity={1.1} color="#f59e0b" />
      <hemisphereLight args={['#faf5ee', '#1c1917', 0.72]} />

      <group ref={stageRootRef}>
        {/* Ground Plane vs AR Tracking Calibration Floor */}
        {!arCameraActive ? (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
            <circleGeometry args={[groundRadius + 5.5, isSoftwareGl ? 32 : 64]} />
            <meshStandardMaterial color={0x171311} roughness={0.88} metalness={0.14} />
          </mesh>
        ) : (
          <group position={[0, -0.01, 0]}>
            <gridHelper args={[groundRadius * 3, 14, '#f59e0b', '#57534e']} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
              <ringGeometry args={[groundRadius - 0.08, groundRadius, 48]} />
              <meshBasicMaterial color="#fbbf24" transparent opacity={0.55} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}

        {/* Brass Atelier Turntable Trim */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <torusGeometry args={[groundRadius, 0.018, 12, 64]} />
          <meshStandardMaterial color={0xd4af37} metalness={0.9} roughness={0.22} />
        </mesh>

        {children}
      </group>
    </>
  );
};

export const AR3DSpatialStage: React.FC<AR3DSpatialStageProps> = ({
  currentLang,
  title,
  subtitle,
  badgeText,
  heightClass = 'h-[360px] sm:h-[420px]',
  cameraSpec = { position: [0, 2.35, 5.2], target: [0, 1.0, 0] },
  cameraKey,
  showExplodeButton = true,
  exploded = false,
  onToggleExploded,
  defaultAutoOrbit = true,
  groundRadius = 2.0,
  topLeftOverlay,
  bottomExtraControls,
  children,
}) => {
  const L = makeT(currentLang, STAGE_STRINGS);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [arCameraActive, setArCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoOrbit, setAutoOrbit] = useState(defaultAutoOrbit);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [isSoftwareGl, setIsSoftwareGl] = useState(false);

  const stopCamera = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => () => stopCamera(), []);

  const toggleArCamera = async () => {
    if (arCameraActive) {
      stopCamera();
      setArCameraActive(false);
      setCameraError(null);
      return;
    }
    setCameraError(null);
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setCameraError(L('cam_err'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setArCameraActive(true);
    } catch {
      stopCamera();
      setArCameraActive(false);
      setCameraError(L('cam_err'));
    }
  };

  return (
    <div className="rounded-3xl overflow-hidden border border-amber-700/35 bg-stone-950 shadow-xl text-white">
      {/* Compact Top Bar */}
      <div className="bg-stone-900 border-b border-stone-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-amber-400">
            <span className="inline-flex items-center gap-1">
              <Scan className="w-3.5 h-3.5" />
              <span>{badgeText || L('studio_mode')}</span>
            </span>
            <span className="text-stone-500">·</span>
            <span className={arCameraActive ? 'text-emerald-400' : 'text-stone-300'}>
              {arCameraActive ? L('ar_active') : 'WebGL 3D'}
            </span>
          </div>
          <h4 className="text-sm font-bold text-white truncate">{title}</h4>
          {subtitle && <p className="text-[11px] text-stone-400 truncate">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleArCamera}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
              arCameraActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                : 'bg-amber-400 hover:bg-amber-300 text-stone-950 border-amber-300'
            }`}
          >
            {arCameraActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
            <span>{arCameraActive ? L('stop_ar') : L('enable_ar')}</span>
          </button>

          <button
            type="button"
            onClick={() => setHudCollapsed((v) => !v)}
            className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            {hudCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{hudCollapsed ? L('show_hud') : L('hide_hud')}</span>
          </button>
        </div>
      </div>

      {/* Camera Inline Notice */}
      {cameraError && (
        <div className="bg-amber-950 border-b border-amber-800/60 px-4 py-2 text-[11px] text-amber-200 flex items-center justify-between gap-2">
          <span>{cameraError}</span>
          <button
            type="button"
            onClick={() => setCameraError(null)}
            className="text-amber-300 hover:text-white font-bold px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Viewport */}
      <div className={`relative w-full ${heightClass} bg-stone-950 overflow-hidden`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300 ${
            arCameraActive ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {!webglUnavailable && (
          <div className="relative z-10 w-full h-full">
            <Canvas
              shadows={!isSoftwareGl}
              dpr={isSoftwareGl ? 1 : [1, 2]}
              camera={{ position: cameraSpec.position, fov: 44, near: 0.1, far: 60 }}
              gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
              onCreated={({ gl }) => {
                const rawGl = gl.getContext();
                const ext = rawGl.getExtension('WEBGL_debug_renderer_info');
                const rendererName = ext
                  ? String(rawGl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
                  : '';
                if (/SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName)) {
                  setIsSoftwareGl(true);
                  gl.setPixelRatio(1);
                }
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 1.1;
                gl.outputColorSpace = THREE.SRGBColorSpace;

                gl.domElement.addEventListener('webglcontextlost', (e) => {
                  e.preventDefault();
                  setWebglUnavailable(true);
                });
                gl.domElement.addEventListener('webglcontextrestored', () => {
                  setWebglUnavailable(false);
                });
              }}
            >
              <SceneRig
                arCameraActive={arCameraActive}
                autoOrbit={autoOrbit}
                resetSignal={resetSignal}
                cameraSpec={cameraSpec}
                cameraKey={cameraKey}
                isSoftwareGl={isSoftwareGl}
                groundRadius={groundRadius}
              >
                {children({ arCameraActive, isSoftwareGl, exploded })}
              </SceneRig>
            </Canvas>
          </div>
        )}

        {topLeftOverlay && !webglUnavailable && (
          <div className="absolute top-3 start-3 z-20 pointer-events-none">{topLeftOverlay}</div>
        )}

        {webglUnavailable && (
          <div className="absolute inset-0 z-30 bg-stone-950 text-stone-200 flex flex-col items-center justify-center p-6 text-center space-y-2">
            <EyeOff className="w-7 h-7 text-amber-400" />
            <div className="text-xs font-bold">{L('webgl_err')}</div>
          </div>
        )}
      </div>

      {/* Collapsible Bottom Control Dock (Zero backdrop-blur over WebGL) */}
      {!hudCollapsed && !webglUnavailable && (
        <div className="bg-stone-900 border-t border-stone-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            {bottomExtraControls}
            <span className="hidden md:inline text-stone-400 ps-1">{L('drag_hint')}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 ms-auto">
            {showExplodeButton && onToggleExploded && (
              <button
                type="button"
                onClick={onToggleExploded}
                className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                  exploded
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-stone-950 text-stone-300 border-stone-700 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{L('explode')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setAutoOrbit((v) => !v)}
              className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                autoOrbit
                  ? 'bg-stone-800 text-amber-300 border-amber-500/60'
                  : 'bg-stone-950 text-stone-400 border-stone-700 hover:text-white'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{L('auto_orbit')}</span>
            </button>

            <button
              type="button"
              onClick={() => setResetSignal((n) => n + 1)}
              className="px-2.5 py-1 rounded-lg border border-stone-700 bg-stone-950 hover:bg-stone-800 text-stone-300 font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{L('reset')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
