import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Environment, Float, Lightformer, OrbitControls, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CameraOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  EyeOff,
  Layers,
  RotateCcw,
  RotateCw,
  Scan,
  Sparkles as SparklesIcon,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { loc, LText, makeT } from '../لغات/localize';
import { LuxuryPortalIcon } from './LuxuryPortalIcon';

export interface ARPortalItem {
  id: string;
  targetTab: string;
  category: 'lab' | 'knowledge' | 'business' | 'ai_news';
  title: string;
  subtitle: string;
  statsBadge: string;
  metricLabel: string;
  actionHint: string;
  accentHex: number;
  accentCssHex: string;
  onEnter: () => void;
}

interface HomeARPortalsProps {
  currentLang: SupportedLanguage;
  portals: ARPortalItem[];
}

const AR_STRINGS = {
  eyebrow: {
    ar: 'الواقع المعزز ثلاثي الأبعاد · React-Three-Fiber',
    en: 'Interactive 3D AR Portals · React-Three-Fiber',
    fr: 'Portails 3D RA interactifs · React-Three-Fiber',
    es: 'Portales 3D RA interactivos · React-Three-Fiber',
    it: 'Portali 3D AR interattivi · React-Three-Fiber',
    de: 'Interaktive 3D-AR-Portale · React-Three-Fiber',
    ru: 'Интерактивные 3D AR-порталы · React-Three-Fiber',
    zh: '交互式 3D 增强现实门户 · React-Three-Fiber',
    tr: 'Etkileşimli 3D AR Portallar · React-Three-Fiber',
    fa: 'درگاه‌های سه‌بعدی واقعیت افزوده · React-Three-Fiber',
  },
  title: {
    ar: 'استكشف نماذج أقسام المعمل بالواقع المعزز',
    en: 'Explore Interactive 3D Lab Section Models in AR',
    fr: 'Explorez les modèles 3D des sections du laboratoire en RA',
    es: 'Explora los modelos 3D de cada sección en realidad aumentada',
    it: 'Esplora i modelli 3D delle sezioni del laboratorio in AR',
    de: 'Interaktive 3D-Laborbereichsmodelle in AR erkunden',
    ru: 'Интерактивные 3D-модели разделов лаборатории в AR',
    zh: '在增强现实中探索实验室各分区 3D 立体模型',
    tr: 'Laboratuvar Bölümlerinin 3D Modellerini AR ile Keşfedin',
    fa: 'مدل‌های سه‌بعدی بخش‌های آزمایشگاه را در واقعیت افزوده کاوش کنید',
  },
  subtitle: {
    ar: 'كل قسم يظهر بنموذجه الثلاثي الأبعاد التفاعلي؛ اسحب للتدوير، اضغط على أي نموذج للتركيز، أو فعّل الكاميرا لدمجه في محيطك',
    en: 'Each section renders its own interactive 3D sculpture; drag to orbit, tap any model to focus, or enable your camera for live AR',
    fr: 'Chaque section possède son modèle 3D interactif ; glissez pour pivoter ou activez la caméra AR',
    es: 'Cada sección muestra su modelo 3D interactivo; arrastra para rotar o activa la cámara AR',
    it: 'Ogni sezione mostra il proprio modello 3D interattivo; trascina per ruotare o attiva la fotocamera AR',
    de: 'Jeder Bereich zeigt ein eigenes interaktives 3D-Modell; zum Drehen ziehen oder AR-Kamera aktivieren',
    ru: 'У каждого раздела своя 3D-модель; вращайте сцену, выбирайте портал или включите AR-камеру',
    zh: '每个分区均配有专属 3D 立体模型；拖动环绕、点击聚焦或开启 AR 实景相机',
    tr: 'Her bölüm kendi 3D modelini sunar; döndürmek için sürükleyin veya canlı AR için kamerayı açın',
    fa: 'هر بخش با مدل سه‌بعدی اختصاصی نمایش داده می‌شود؛ بکشید، لمس کنید یا دوربین AR را فعال کنید',
  },
  enable_ar_cam: {
    ar: 'تشغيل كاميرا الواقع المعزز',
    en: 'Enable AR Camera',
    fr: 'Activer caméra AR',
    es: 'Activar cámara AR',
    it: 'Attiva fotocamera AR',
    de: 'AR-Kamera aktivieren',
    ru: 'Включить AR-камеру',
    zh: '开启 AR 相机',
    tr: 'AR Kamerayı Aç',
    fa: 'فعال‌سازی دوربین AR',
  },
  stop_ar_cam: {
    ar: 'العودة لبيئة الاستوديو',
    en: 'Return to Studio Space',
    fr: 'Mode studio 3D',
    es: 'Volver al estudio 3D',
    it: 'Torna allo studio 3D',
    de: 'Zurück zum 3D-Studio',
    ru: 'Вернуться в 3D-студию',
    zh: '返回 3D 空间',
    tr: '3D Stüdyoya Dön',
    fa: 'بازگشت به استودیوی سه‌بعدی',
  },
  ar_active_badge: {
    ar: 'بث كاميرا الواقع المعزز نشط',
    en: 'Live AR Camera Passthrough',
    fr: 'Caméra AR active',
    es: 'Cámara AR activa',
    it: 'Fotocamera AR attiva',
    de: 'AR-Kamera aktiv',
    ru: 'AR-камера активна',
    zh: 'AR 实景透视已开启',
    tr: 'Canlı AR Kamera Açık',
    fa: 'دوربین واقعیت افزوده فعال است',
  },
  studio_badge: {
    ar: 'استوديو المعمل المكاني 3D',
    en: '3D Spatial Sanctuary',
    fr: 'Sanctuaire spatial 3D',
    es: 'Santuario espacial 3D',
    it: 'Santuario spaziale 3D',
    de: '3D-Raumgalerie',
    ru: '3D-лаборатория',
    zh: '3D 空间展厅',
    tr: '3D Mekânsal Galeri',
    fa: 'گالری فضایی سه‌بعدی',
  },
  enter_portal: {
    ar: 'دخول هذا القسم',
    en: 'Enter Section',
    fr: 'Entrer dans la section',
    es: 'Entrar a la sección',
    it: 'Entra nella sezione',
    de: 'Bereich öffnen',
    ru: 'Открыть раздел',
    zh: '进入该分区',
    tr: 'Bölüme Gir',
    fa: 'ورود به بخش',
  },
  inspect_model: {
    ar: 'تفكيك النموذج',
    en: 'Inspect Parts',
    fr: 'Décomposer',
    es: 'Desglosar',
    it: 'Esplodi vista',
    de: 'Explodieren',
    ru: 'Разбор модели',
    zh: '拆解模型',
    tr: 'Modeli Aç',
    fa: 'نمای انفجاری',
  },
  auto_orbit: {
    ar: 'دوران تلقائي',
    en: 'Auto-Orbit',
    fr: 'Rotation auto',
    es: 'Órbita auto',
    it: 'Orbita auto',
    de: 'Auto-Drehung',
    ru: 'Автоповорот',
    zh: '自动环绕',
    tr: 'Otomatik Dönüş',
    fa: 'چرخش خودکار',
  },
  reset_view: {
    ar: 'إعادة الضبط',
    en: 'Reset View',
    fr: 'Réinitialiser',
    es: 'Restablecer',
    it: 'Reimposta',
    de: 'Zurücksetzen',
    ru: 'Сброс',
    zh: '重置视角',
    tr: 'Sıfırla',
    fa: 'بازنشانی دید',
  },
  hide_hud: {
    ar: 'طي الشريط (H)',
    en: 'Hide Bar (H)',
    fr: 'Masquer (H)',
    es: 'Ocultar (H)',
    it: 'Nascondi (H)',
    de: 'Ausblenden (H)',
    ru: 'Скрыть (H)',
    zh: '收起控制栏 (H)',
    tr: 'Gizle (H)',
    fa: 'پنهان کردن (H)',
  },
  show_hud: {
    ar: 'إظهار التحكم',
    en: 'Show Controls',
    fr: 'Afficher',
    es: 'Mostrar controles',
    it: 'Mostra controlli',
    de: 'Steuerung zeigen',
    ru: 'Показать панель',
    zh: '展开控制栏',
    tr: 'Kontrolleri Göster',
    fa: 'نمایش کنترل‌ها',
  },
  cam_unavailable: {
    ar: 'تعذّر الوصول إلى الكاميرا أو لم يُمنح الإذن؛ تم الحفاظ على العرض التفاعلي ثلاثي الأبعاد.',
    en: 'Camera access was unavailable or declined; interactive 3D spatial models remain active.',
    fr: 'Caméra indisponible ou refusée ; les modèles 3D restent actifs.',
    es: 'Cámara no disponible o denegada; los modelos 3D siguen activos.',
    it: 'Fotocamera non disponibile o negata; i modelli 3D restano attivi.',
    de: 'Kamera nicht verfügbar oder abgelehnt; die interaktiven 3D-Modelle bleiben aktiv.',
    ru: 'Камера недоступна или доступ отклонён; 3D-модели продолжают работать.',
    zh: '无法访问相机或权限被拒绝；已保持 3D 空间模型交互运行。',
    tr: 'Kameraya erişilemedi veya izin verilmedi; 3D modeller etkin kaldı.',
    fa: 'دسترسی به دوربین ممکن نشد یا رد شد؛ نمایش سه‌بعدی مدل‌ها فعال است.',
  },
  webgl_unavailable: {
    ar: 'محرك الرسوميات الثلاثية الأبعاد غير مفعّل في هذا المتصفح حالياً.',
    en: '3D WebGL acceleration is currently unavailable in this browser.',
    fr: 'L’accélération WebGL 3D est indisponible sur ce navigateur.',
    es: 'La aceleración WebGL 3D no está disponible en este navegador.',
    it: 'L’accelerazione WebGL 3D non è disponibile en questo browser.',
    de: '3D-WebGL ist in diesem Browser derzeit nicht verfügbar.',
    ru: '3D-ускорение WebGL недоступно в этом браузере.',
    zh: '当前浏览器不支持或未启用 3D WebGL 加速。',
    tr: 'Bu tarayıcıda 3D WebGL hızlandırma şu anda kullanılamıyor.',
    fa: 'شتاب‌دهنده سه‌بعدی WebGL در این مرورگر فعال نیست.',
  },
  prev_portal: {
    ar: 'القسم السابق',
    en: 'Previous section',
    fr: 'Section précédente',
    es: 'Sección anterior',
    it: 'Sezione precedente',
    de: 'Vorheriger Bereich',
    ru: 'Предыдущий раздел',
    zh: '上一个分区',
    tr: 'Önceki bölüm',
    fa: 'بخش قبلی',
  },
  next_portal: {
    ar: 'القسم التالي',
    en: 'Next section',
    fr: 'Section suivante',
    es: 'Sección siguiente',
    it: 'Sezione successiva',
    de: 'Nächster Bereich',
    ru: 'Следующий раздел',
    zh: '下一个分区',
    tr: 'Sonraki bölüm',
    fa: 'بخش بعدی',
  },
  webxr_ready: {
    ar: 'دعم WebXR جاهز',
    en: 'WebXR AR Ready',
    fr: 'WebXR RA prêt',
    es: 'WebXR RA listo',
    it: 'WebXR AR pronto',
    de: 'WebXR AR bereit',
    ru: 'WebXR AR готов',
    zh: '支持 WebXR AR',
    tr: 'WebXR AR Hazır',
    fa: 'آماده WebXR',
  },
} satisfies Record<string, LText>;

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length >= maxLines - 1) break;
    }
  }
  lines.push(current);
  return lines.slice(0, maxLines);
}

function createPortalPlaqueTexture(
  portal: ARPortalItem,
  index: number,
  isRtlLang: boolean,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const w = canvas.width;
    const h = canvas.height;
    const accent = portal.accentCssHex || '#f59e0b';

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1e1916');
    grad.addColorStop(1, '#120f0d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    ctx.strokeStyle = 'rgba(255, 245, 225, 0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Top badge chip
    ctx.fillStyle = `${accent}33`;
    ctx.fillRect(w / 2 - 96, 40, 192, 42);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(w / 2 - 96, 40, 192, 42);

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 21px monospace';
    ctx.fillText(
      `${String(index + 1).padStart(2, '0')} · ${portal.category.toUpperCase()}`,
      w / 2,
      62,
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 31px Georgia, serif';
    ctx.direction = isRtlLang ? 'rtl' : 'ltr';
    const lines = wrapCanvasLines(ctx, portal.title, w - 76, 2);
    let y = 148;
    for (const line of lines) {
      ctx.fillText(line, w / 2, y);
      y += 42;
    }

    ctx.fillStyle = accent;
    ctx.fillRect(w * 0.28, 224, w * 0.44, 3);

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(portal.statsBadge.slice(0, 34), w / 2, 276);

    ctx.fillStyle = '#a8a29e';
    ctx.font = 'normal 18px sans-serif';
    ctx.fillText(portal.metricLabel.slice(0, 38), w / 2, 316);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Distinct multi-part 3D sculpture tailored for each Sham Perfume Lab section.
 */
const LabSectionSculpture: React.FC<{
  targetTab: string;
  accentHex: number;
  isSelected: boolean;
  isHovered: boolean;
  explodeModels: boolean;
  isSoftwareGl: boolean;
}> = ({ targetTab, accentHex, isSelected, isHovered, explodeModels, isSoftwareGl }) => {
  const spinRef = useRef<THREE.Group>(null);
  const partARef = useRef<THREE.Object3D>(null);
  const partBRef = useRef<THREE.Object3D>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((_, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);
    if (spinRef.current) {
      const rate = isSelected ? 0.85 : isHovered ? 0.55 : 0.25;
      spinRef.current.rotation.y += dt * rate;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += dt * (isSelected ? 1.2 : 0.45);
      ringRef.current.rotation.x += dt * 0.3;
    }
    if (partARef.current) {
      const targetY = explodeModels ? 0.52 : 0.26;
      partARef.current.position.y = THREE.MathUtils.damp(partARef.current.position.y, targetY, 7, dt);
    }
    if (partBRef.current) {
      const targetY = explodeModels ? -0.22 : 0;
      partBRef.current.position.y = THREE.MathUtils.damp(partBRef.current.position.y, targetY, 7, dt);
    }
  });

  const glassProps = {
    color: 0xffffff,
    roughness: 0.08,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0.4 : 0.78,
    transparent: true,
    opacity: 0.94,
    ior: 1.5,
    thickness: 0.35,
    clearcoat: 1,
  } as const;

  const emissiveBoost = isSelected ? 0.35 : isHovered ? 0.24 : 0.12;

  const renderModel = () => {
    switch (targetTab) {
      case 'concentration':
      case 'world_perfumes':
        // Crystal Perfume Flacon + Golden Collar + Crown Cap
        return (
          <group>
            <mesh ref={partBRef as React.Ref<THREE.Mesh>} position={[0, 0, 0]} castShadow={!isSoftwareGl}>
              <cylinderGeometry args={[0.32, 0.36, 0.56, 8]} />
              <meshPhysicalMaterial {...glassProps} />
            </mesh>
            <mesh position={[0, -0.02, 0]}>
              <cylinderGeometry args={[0.25, 0.28, 0.4, 8]} />
              <meshStandardMaterial
                color={accentHex}
                roughness={0.2}
                metalness={0.35}
                emissive={accentHex}
                emissiveIntensity={emissiveBoost}
              />
            </mesh>
            <mesh position={[0, 0.34, 0]}>
              <cylinderGeometry args={[0.12, 0.13, 0.14, 16]} />
              <meshStandardMaterial color={0xd4af37} metalness={0.92} roughness={0.2} />
            </mesh>
            <mesh ref={partARef as React.Ref<THREE.Mesh>} position={[0, 0.26, 0]} castShadow={!isSoftwareGl}>
              <octahedronGeometry args={[0.17, 0]} />
              <meshStandardMaterial
                color={0x292524}
                metalness={0.65}
                roughness={0.22}
              />
            </mesh>
          </group>
        );

      case 'pyramid':
        // Three-Tier Fragrance Pyramid (Top, Heart, Base)
        return (
          <group>
            <mesh ref={partBRef as React.Ref<THREE.Mesh>} position={[0, -0.18, 0]} castShadow={!isSoftwareGl}>
              <cylinderGeometry args={[0.28, 0.42, 0.2, 4]} />
              <meshStandardMaterial color={0x92400e} metalness={0.55} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.05, 0]} castShadow={!isSoftwareGl}>
              <cylinderGeometry args={[0.15, 0.27, 0.22, 4]} />
              <meshStandardMaterial
                color={accentHex}
                metalness={0.45}
                roughness={0.25}
                emissive={accentHex}
                emissiveIntensity={emissiveBoost}
              />
            </mesh>
            <mesh ref={partARef as React.Ref<THREE.Mesh>} position={[0, 0.28, 0]} castShadow={!isSoftwareGl}>
              <coneGeometry args={[0.14, 0.24, 4]} />
              <meshStandardMaterial color={0xfbbf24} metalness={0.85} roughness={0.18} />
            </mesh>
          </group>
        );

      case 'alcohol':
        // Erlenmeyer Lab Flask + Calibration Rings
        return (
          <group>
            <mesh ref={partBRef as React.Ref<THREE.Mesh>} position={[0, -0.05, 0]} castShadow={!isSoftwareGl}>
              <coneGeometry args={[0.36, 0.56, 20]} />
              <meshPhysicalMaterial {...glassProps} />
            </mesh>
            <mesh position={[0, -0.14, 0]}>
              <coneGeometry args={[0.29, 0.34, 20]} />
              <meshStandardMaterial
                color={accentHex}
                roughness={0.15}
                metalness={0.15}
                emissive={accentHex}
                emissiveIntensity={emissiveBoost}
              />
            </mesh>
            <mesh ref={partARef as React.Ref<THREE.Mesh>} position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.11, 0.12, 0.22, 16]} />
              <meshStandardMaterial color={0xe2e8f0} metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
        );

      case 'raw_materials':
        // Aromatic Molecular Cluster
        return (
          <group>
            <mesh>
              <icosahedronGeometry args={[0.22, 1]} />
              <meshStandardMaterial
                color={accentHex}
                metalness={0.35}
                roughness={0.22}
                emissive={accentHex}
                emissiveIntensity={emissiveBoost + 0.1}
              />
            </mesh>
            {[0, 1, 2].map((idx) => {
              const a = (idx / 3) * Math.PI * 2;
              const dist = explodeModels ? 0.44 : 0.32;
              return (
                <mesh key={idx} position={[Math.cos(a) * dist, idx === 1 ? 0.16 : -0.1, Math.sin(a) * dist]}>
                  <sphereGeometry args={[0.1, 16, 16]} />
                  <meshStandardMaterial color={0xfef3c7} metalness={0.75} roughness={0.2} />
                </mesh>
              );
            })}
          </group>
        );

      case 'master_ai':
      case 'perfume_news':
        // Triple-Gimbal Astrolabe / Globe Sphere
        return (
          <group>
            <mesh>
              <sphereGeometry args={[0.2, 24, 24]} />
              <meshStandardMaterial
                color={accentHex}
                metalness={0.4}
                roughness={0.18}
                emissive={accentHex}
                emissiveIntensity={emissiveBoost + 0.15}
              />
            </mesh>
            <mesh rotation={[Math.PI / 4, 0, 0]}>
              <torusGeometry args={[0.32, 0.022, 12, 36]} />
              <meshStandardMaterial color={0xd4af37} metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh rotation={[-Math.PI / 4, Math.PI / 3, 0]}>
              <torusGeometry args={[0.38, 0.018, 12, 36]} />
              <meshStandardMaterial color={accentHex} metalness={0.85} roughness={0.25} />
            </mesh>
          </group>
        );

      case 'guide':
      case 'maceration_simulator':
        // Alchemical Hourglass
        return (
          <group>
            <mesh ref={partARef as React.Ref<THREE.Mesh>} position={[0, 0.24, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.24, 0.34, 18]} />
              <meshPhysicalMaterial {...glassProps} />
            </mesh>
            <mesh ref={partBRef as React.Ref<THREE.Mesh>} position={[0, -0.06, 0]}>
              <coneGeometry args={[0.24, 0.34, 18]} />
              <meshStandardMaterial
                color={accentHex}
                metalness={0.35}
                roughness={0.25}
                emissive={accentHex}
                emissiveIntensity={emissiveBoost}
              />
            </mesh>
            <mesh position={[0, 0.09, 0]}>
              <torusGeometry args={[0.1, 0.025, 10, 24]} />
              <meshStandardMaterial color={0xd4af37} metalness={0.92} roughness={0.2} />
            </mesh>
          </group>
        );

      case 'costing':
        // Golden Treasury Balance Scale
        return (
          <group>
            <mesh position={[0, -0.02, 0]}>
              <cylinderGeometry args={[0.04, 0.06, 0.56, 14]} />
              <meshStandardMaterial color={0xd4af37} metalness={0.9} roughness={0.22} />
            </mesh>
            <mesh ref={partARef as React.Ref<THREE.Mesh>} position={[0, 0.26, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 0.68, 12]} />
              <meshStandardMaterial color={0xfbbf24} metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[-0.3, 0.04, 0]}>
              <cylinderGeometry args={[0.14, 0.09, 0.06, 16]} />
              <meshStandardMaterial color={accentHex} metalness={0.75} roughness={0.25} />
            </mesh>
            <mesh position={[0.3, 0.04, 0]}>
              <cylinderGeometry args={[0.14, 0.09, 0.06, 16]} />
              <meshStandardMaterial color={accentHex} metalness={0.75} roughness={0.25} />
            </mesh>
          </group>
        );

      case 'library':
      case 'store':
        // Atelier Folio / Luxury Gift Coffret
        return (
          <group>
            <mesh ref={partBRef as React.Ref<THREE.Mesh>} position={[0, -0.04, 0]} castShadow={!isSoftwareGl}>
              <boxGeometry args={[0.52, 0.34, 0.36]} />
              <meshStandardMaterial color={0x451a03} metalness={0.28} roughness={0.42} />
            </mesh>
            <mesh ref={partARef as React.Ref<THREE.Mesh>} position={[0, 0.24, 0]}>
              <boxGeometry args={[0.54, 0.08, 0.38]} />
              <meshStandardMaterial
                color={accentHex}
                metalness={0.75}
                roughness={0.22}
                emissive={accentHex}
                emissiveIntensity={emissiveBoost}
              />
            </mesh>
          </group>
        );

      default:
        // Country / Privacy / Default Faceted Crest Gem + Halo
        return (
          <group>
            <mesh>
              <octahedronGeometry args={[0.26, 0]} />
              <meshPhysicalMaterial
                color={accentHex}
                metalness={0.2}
                roughness={0.08}
                clearcoat={1}
                emissive={accentHex}
                emissiveIntensity={emissiveBoost}
              />
            </mesh>
            <mesh ref={partARef as React.Ref<THREE.Mesh>} position={[0, 0.3, 0]}>
              <torusGeometry args={[0.18, 0.02, 10, 28]} />
              <meshStandardMaterial color={0xd4af37} metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        );
    }
  };

  return (
    <Float speed={isSelected ? 2.4 : 1.5} rotationIntensity={0.25} floatIntensity={0.28}>
      <group ref={spinRef} position={[0, 1.38, 0]}>
        {renderModel()}
        <mesh ref={ringRef} rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[0.46, 0.012, 10, 36]} />
          <meshBasicMaterial color={accentHex} transparent opacity={isSelected ? 0.78 : 0.35} />
        </mesh>
      </group>
    </Float>
  );
};

interface PortalGatewayMeshProps {
  portal: ARPortalItem;
  index: number;
  angle: number;
  radius: number;
  isSelected: boolean;
  isHovered: boolean;
  explodeModels: boolean;
  isRtlLang: boolean;
  isSoftwareGl: boolean;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
}

const PortalGatewayMesh: React.FC<PortalGatewayMeshProps> = ({
  portal,
  index,
  angle,
  radius,
  isSelected,
  isHovered,
  explodeModels,
  isRtlLang,
  isSoftwareGl,
  onSelect,
  onHover,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const plaqueTexture = useMemo(
    () => createPortalPlaqueTexture(portal, index, isRtlLang),
    [portal.id, portal.title, portal.statsBadge, portal.metricLabel, portal.accentCssHex, index, isRtlLang],
  );

  useEffect(() => () => {
    plaqueTexture.dispose();
  }, [plaqueTexture]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);
    if (groupRef.current) {
      const targetScale = isSelected ? 1.12 : isHovered ? 1.05 : 0.94;
      const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, 8, dt);
      groupRef.current.scale.setScalar(nextScale);
    }
    if (haloMatRef.current) {
      const targetOpacity = isSelected ? 0.85 : isHovered ? 0.55 : 0.22;
      haloMatRef.current.opacity = THREE.MathUtils.damp(haloMatRef.current.opacity, targetOpacity, 8, dt);
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(index);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(index);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    onHover(null);
    document.body.style.cursor = 'auto';
  };

  return (
    <group
      ref={groupRef}
      position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]}
      rotation={[0, angle, 0]}
    >
      {/* Octagonal Obsidian Pedestal */}
      <mesh position={[0, 0.1, 0]} receiveShadow castShadow={!isSoftwareGl}>
        <cylinderGeometry args={[0.72, 0.84, 0.2, 8]} />
        <meshStandardMaterial color={0x221d1a} roughness={0.75} metalness={0.16} />
      </mesh>

      {/* Brushed Metallic Collar */}
      <mesh position={[0, 0.21, 0]}>
        <cylinderGeometry args={[0.75, 0.75, 0.04, 24]} />
        <meshStandardMaterial
          color={portal.accentHex}
          metalness={0.88}
          roughness={0.22}
          emissive={portal.accentHex}
          emissiveIntensity={isSelected ? 0.35 : 0.12}
        />
      </mesh>

      {/* Twin Arch Columns & Crowning Halo Arch */}
      <mesh position={[-0.62, 1.05, 0]} castShadow={!isSoftwareGl}>
        <cylinderGeometry args={[0.048, 0.06, 1.66, 14]} />
        <meshStandardMaterial color={portal.accentHex} metalness={0.86} roughness={0.24} />
      </mesh>
      <mesh position={[0.62, 1.05, 0]} castShadow={!isSoftwareGl}>
        <cylinderGeometry args={[0.048, 0.06, 1.66, 14]} />
        <meshStandardMaterial color={portal.accentHex} metalness={0.86} roughness={0.24} />
      </mesh>
      <mesh position={[0, 1.88, 0]} castShadow={!isSoftwareGl}>
        <torusGeometry args={[0.62, 0.056, 12, 32, Math.PI]} />
        <meshStandardMaterial
          color={portal.accentHex}
          metalness={0.88}
          roughness={0.2}
          emissive={portal.accentHex}
          emissiveIntensity={isSelected ? 0.42 : 0.14}
        />
      </mesh>

      {/* Bespoke Interactive 3D Lab Section Sculpture */}
      <LabSectionSculpture
        targetTab={portal.targetTab}
        accentHex={portal.accentHex}
        isSelected={isSelected}
        isHovered={isHovered}
        explodeModels={explodeModels}
        isSoftwareGl={isSoftwareGl}
      />

      {/* Tilted Front Informational Plaque */}
      <group position={[0, 0.56, 0.46]} rotation={[-0.36, 0, 0]}>
        <mesh>
          <boxGeometry args={[1.04, 0.74, 0.03]} />
          <meshStandardMaterial color={portal.accentHex} metalness={0.85} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0, 0.018]}>
          <planeGeometry args={[0.98, 0.68]} />
          <meshStandardMaterial
            map={plaqueTexture}
            emissiveMap={plaqueTexture}
            emissive={0xffffff}
            emissiveIntensity={0.24}
            roughness={0.32}
            metalness={0.05}
          />
        </mesh>
      </group>

      {/* AR Floor Contact Halo */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 0.98, 32]} />
        <meshBasicMaterial
          ref={haloMatRef}
          color={portal.accentHex}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Invisible Raycast Click Hit Proxy */}
      <mesh
        position={[0, 1.25, 0.08]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[1.48, 2.55, 0.95]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
};

interface ARSceneContentProps {
  portals: ARPortalItem[];
  activeIndex: number;
  hoveredIndex: number | null;
  arCameraActive: boolean;
  autoOrbit: boolean;
  explodeModels: boolean;
  resetSignal: number;
  isRtlLang: boolean;
  isSoftwareGl: boolean;
  onSelectPortal: (index: number) => void;
  onHoverPortal: (index: number | null) => void;
}

const ARSceneContent: React.FC<ARSceneContentProps> = ({
  portals,
  activeIndex,
  hoveredIndex,
  arCameraActive,
  autoOrbit,
  explodeModels,
  resetSignal,
  isRtlLang,
  isSoftwareGl,
  onSelectPortal,
  onHoverPortal,
}) => {
  const { gl, scene, camera } = useThree();
  const ringGroupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const userDraggingRef = useRef(false);
  const autoPhaseRef = useRef(0);
  const resetActiveRef = useRef(false);
  const tiltRef = useRef({ x: 0 });

  const count = portals.length;
  const radius = count <= 1 ? 0.01 : count <= 3 ? 2.45 : count <= 6 ? 3.55 : 4.85;
  const defaultCamPos = useMemo(() => new THREE.Vector3(0, 2.4, radius + 4.45), [radius]);
  const defaultCamTarget = useMemo(
    () => new THREE.Vector3(0, 1.05, count <= 1 ? 0 : radius * 0.34),
    [count, radius],
  );

  // Sync studio vs transparent AR camera backdrop cleanly
  useEffect(() => {
    if (arCameraActive) {
      scene.background = null;
      scene.fog = null;
      gl.setClearColor(0x000000, 0);
    } else {
      scene.background = new THREE.Color(0x110e0c);
      scene.fog = new THREE.FogExp2(0x110e0c, 0.034);
      gl.setClearColor(0x110e0c, 1);
    }
  }, [arCameraActive, gl, scene]);

  // Trigger camera reset on demand
  useEffect(() => {
    if (resetSignal > 0) {
      resetActiveRef.current = true;
    }
  }, [resetSignal]);

  // Device orientation parallax in AR mode
  useEffect(() => {
    const onOrientation = (ev: DeviceOrientationEvent) => {
      if (!arCameraActive || typeof ev.gamma !== 'number') return;
      tiltRef.current.x = THREE.MathUtils.clamp(ev.gamma / 45, -1, 1) * 0.4;
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [arCameraActive]);

  // Position ring immediately when portal count changes
  useEffect(() => {
    if (!ringGroupRef.current || count === 0) return;
    const angle = (activeIndex / count) * Math.PI * 2;
    ringGroupRef.current.rotation.y = -angle;
  }, [count]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);
    if (!ringGroupRef.current || count === 0) return;

    const targetAngle = -((activeIndex / count) * Math.PI * 2);

    if (autoOrbit && !userDraggingRef.current && !arCameraActive) {
      autoPhaseRef.current += dt * 0.16;
    } else {
      autoPhaseRef.current = THREE.MathUtils.damp(autoPhaseRef.current, 0, 5, dt);
    }

    const desiredRot = targetAngle + Math.sin(autoPhaseRef.current) * 0.14 + tiltRef.current.x * 0.18;
    const deltaAngle = Math.atan2(
      Math.sin(desiredRot - ringGroupRef.current.rotation.y),
      Math.cos(desiredRot - ringGroupRef.current.rotation.y),
    );
    ringGroupRef.current.rotation.y += deltaAngle * (1 - Math.exp(-5.5 * dt));

    if (resetActiveRef.current && controlsRef.current) {
      camera.position.lerp(defaultCamPos, 1 - Math.exp(-6 * dt));
      controlsRef.current.target.lerp(defaultCamTarget, 1 - Math.exp(-6 * dt));
      controlsRef.current.update();
      if (camera.position.distanceTo(defaultCamPos) < 0.04) {
        resetActiveRef.current = false;
      }
    }
  });

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        target={[defaultCamTarget.x, defaultCamTarget.y, defaultCamTarget.z]}
        enableDamping
        dampingFactor={0.07}
        minDistance={2.3}
        maxDistance={radius + 8.5}
        maxPolarAngle={Math.PI * 0.52}
        minPolarAngle={Math.PI * 0.16}
        onStart={() => {
          userDraggingRef.current = true;
          resetActiveRef.current = false;
        }}
        onEnd={() => {
          userDraggingRef.current = false;
        }}
      />

      {/* Procedural Studio IBL Environment (Zero External Network Assets) */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#fff1d6"
          scale={[10, 4, 1]}
          position={[0, 6, 4]}
          rotation={[Math.PI / 3, 0, 0]}
        />
        <Lightformer
          form="ring"
          intensity={1.6}
          color="#f59e0b"
          scale={[6, 6, 1]}
          position={[-5, 3, -5]}
          rotation={[0, Math.PI / 4, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#e2e8f0"
          scale={[8, 3, 1]}
          position={[6, 4, -2]}
          rotation={[0, -Math.PI / 2, 0]}
        />
      </Environment>

      {/* Three-Point Atelier Lighting */}
      <directionalLight
        position={[5, 9, 6]}
        intensity={2.0}
        color="#fff0d4"
        castShadow={!isSoftwareGl}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-5.5, 4.5, -5]} intensity={1.2} color="#f59e0b" />
      <hemisphereLight args={['#faf5ee', '#1c1917', 0.72]} />

      {/* Grounded Studio Floor vs AR Calibration Grid */}
      {!arCameraActive ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <circleGeometry args={[14, isSoftwareGl ? 32 : 64]} />
          <meshStandardMaterial color={0x161210} roughness={0.88} metalness={0.12} />
        </mesh>
      ) : (
        <group position={[0, 0.01, 0]}>
          <gridHelper args={[12, 16, '#f59e0b', '#57534e']} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <ringGeometry args={[Math.max(1.2, radius - 0.14), Math.max(1.24, radius - 0.1), 64]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.48} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {/* Permanent Brass Compass Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <torusGeometry args={[Math.max(1.1, radius), 0.018, 12, 72]} />
        <meshStandardMaterial color={0xd4af37} metalness={0.9} roughness={0.25} />
      </mesh>

      {/* Floating Golden Fragrance Particles */}
      <Sparkles
        count={isSoftwareGl ? 45 : 95}
        scale={[radius * 2.4 + 2, 3.6, radius * 2.4 + 2]}
        position={[0, 1.7, 0]}
        size={2.2}
        speed={0.35}
        opacity={0.55}
        color="#fcd34d"
      />

      {/* Interactive 3D Lab Section Portals Carousel */}
      <group ref={ringGroupRef}>
        {portals.map((portal, index) => {
          const angle = (index / count) * Math.PI * 2;
          return (
            <PortalGatewayMesh
              key={portal.id}
              portal={portal}
              index={index}
              angle={angle}
              radius={radius}
              isSelected={index === activeIndex}
              isHovered={index === hoveredIndex}
              explodeModels={explodeModels}
              isRtlLang={isRtlLang}
              isSoftwareGl={isSoftwareGl}
              onSelect={onSelectPortal}
              onHover={onHoverPortal}
            />
          );
        })}
      </group>
    </>
  );
};

export const HomeARPortals: React.FC<HomeARPortalsProps> = ({ currentLang, portals }) => {
  const L = makeT(currentLang, AR_STRINGS);
  const isRtlLang = isRTL(currentLang);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [arCameraActive, setArCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoOrbit, setAutoOrbit] = useState<boolean>(true);
  const [explodeModels, setExplodeModels] = useState<boolean>(false);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(false);
  const [webXrSupported, setWebXrSupported] = useState<boolean>(false);
  const [isSoftwareGl, setIsSoftwareGl] = useState<boolean>(false);

  const safeIndex = portals.length > 0 ? Math.min(activeIndex, portals.length - 1) : 0;
  const activePortal = portals[safeIndex] || portals[0];

  const count = portals.length;
  const radius = count <= 1 ? 0.01 : count <= 3 ? 2.45 : count <= 6 ? 3.55 : 4.85;

  useEffect(() => {
    if (activeIndex >= portals.length && portals.length > 0) {
      setActiveIndex(0);
    }
  }, [portals.length, activeIndex]);

  useEffect(() => {
    let mounted = true;
    const nav = navigator as Navigator & { xr?: { isSessionSupported?: (mode: string) => Promise<boolean> } };
    if (nav.xr && typeof nav.xr.isSessionSupported === 'function') {
      nav.xr
        .isSessionSupported('immersive-ar')
        .then((supported) => {
          if (mounted) setWebXrSupported(Boolean(supported));
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setHudCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => () => {
    document.body.style.cursor = 'auto';
  }, []);

  const stopCameraStream = () => {
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

  useEffect(() => () => stopCameraStream(), []);

  const toggleArCamera = async () => {
    if (arCameraActive) {
      stopCameraStream();
      setArCameraActive(false);
      setCameraError(null);
      return;
    }

    setCameraError(null);
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setCameraError(L('cam_unavailable'));
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
      stopCameraStream();
      setArCameraActive(false);
      setCameraError(L('cam_unavailable'));
    }
  };

  const handleSelectPortal = (idx: number) => {
    if (idx === safeIndex) {
      portals[idx]?.onEnter();
    } else {
      setActiveIndex(idx);
    }
  };

  if (!activePortal) return null;

  const stepPortal = (dir: -1 | 1) => {
    if (portals.length <= 1) return;
    setActiveIndex((prev) => (prev + dir + portals.length) % portals.length);
  };

  return (
    <section
      data-focus-id="home-ar-portals"
      className="relative rounded-3xl overflow-hidden border border-amber-800/40 bg-stone-950 shadow-2xl"
    >
      {/* Top Section Header Bar */}
      <div className="bg-stone-900/95 border-b border-stone-800 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="inline-flex flex-wrap items-center gap-2 text-[11px] font-bold text-amber-400">
            <Scan className="w-3.5 h-3.5" />
            <span>{L('eyebrow')}</span>
            <span className="px-2 py-0.5 rounded-md bg-stone-800 border border-stone-700 text-stone-200 font-mono text-[10px]">
              {arCameraActive ? L('ar_active_badge') : L('studio_badge')}
            </span>
            {webXrSupported && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-700/60 text-emerald-300 text-[10px]">
                {L('webxr_ready')}
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-bold font-serif-luxury text-white">
            {L('title')}
          </h3>
          <p className="text-xs text-stone-400">{L('subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleArCamera}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
              arCameraActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                : 'bg-amber-400 hover:bg-amber-300 text-stone-950 border-amber-300'
            }`}
          >
            {arCameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            <span>{arCameraActive ? L('stop_ar_cam') : L('enable_ar_cam')}</span>
          </button>

          <button
            type="button"
            onClick={() => setHudCollapsed((c) => !c)}
            className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 border border-stone-700 cursor-pointer"
          >
            {hudCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{hudCollapsed ? L('show_hud') : L('hide_hud')}</span>
          </button>
        </div>
      </div>

      {/* Inline Camera Notice */}
      {cameraError && (
        <div className="bg-amber-950 border-b border-amber-800/60 px-5 py-2 text-xs text-amber-200 flex items-center justify-between gap-2">
          <span>{cameraError}</span>
          <button
            type="button"
            onClick={() => setCameraError(null)}
            className="text-amber-400 hover:text-white font-bold px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Isolated R3F Canvas + Live Camera AR Feed */}
      <div className="relative w-full h-[460px] sm:h-[520px] bg-stone-950 overflow-hidden">
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
              camera={{ position: [0, 2.4, radius + 4.45], fov: 44, near: 0.1, far: 65 }}
              gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
              onCreated={({ gl }) => {
                const rawGl = gl.getContext();
                const debugInfo = rawGl.getExtension('WEBGL_debug_renderer_info');
                const rendererName = debugInfo
                  ? String(rawGl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
                  : '';
                const software = /SwiftShader|llvmpipe|Software/i.test(rendererName);
                if (software) {
                  setIsSoftwareGl(true);
                  gl.setPixelRatio(1);
                }
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 1.12;
                gl.outputColorSpace = THREE.SRGBColorSpace;

                const onLost = (e: Event) => {
                  e.preventDefault();
                  setWebglUnavailable(true);
                };
                const onRestored = () => setWebglUnavailable(false);
                gl.domElement.addEventListener('webglcontextlost', onLost);
                gl.domElement.addEventListener('webglcontextrestored', onRestored);
              }}
            >
              <ARSceneContent
                portals={portals}
                activeIndex={safeIndex}
                hoveredIndex={hoveredIndex}
                arCameraActive={arCameraActive}
                autoOrbit={autoOrbit}
                explodeModels={explodeModels}
                resetSignal={resetSignal}
                isRtlLang={isRtlLang}
                isSoftwareGl={isSoftwareGl}
                onSelectPortal={handleSelectPortal}
                onHoverPortal={setHoveredIndex}
              />
            </Canvas>
          </div>
        )}

        {/* Solid Corner Portal Index Counter */}
        {!webglUnavailable && (
          <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-stone-950/90 border border-stone-800 text-[11px] font-mono text-amber-300 flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {String(safeIndex + 1).padStart(2, '0')} / {String(portals.length).padStart(2, '0')}
              </span>
            </div>
          </div>
        )}

        {webglUnavailable && (
          <div className="absolute inset-0 z-30 bg-stone-950 text-stone-200 flex flex-col items-center justify-center p-6 text-center space-y-2">
            <EyeOff className="w-8 h-8 text-amber-400" />
            <div className="text-sm font-bold">{L('webgl_unavailable')}</div>
          </div>
        )}
      </div>

      {/* Collapsible Ergonomic Bottom Dock with Section Quick-Selector */}
      {!hudCollapsed && !webglUnavailable && (
        <div className="bg-stone-900 border-t border-stone-800 px-4 sm:px-5 py-3.5 space-y-3">
          {/* Quick-Jump Section Chips */}
          {portals.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {portals.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`group px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap border transition-colors cursor-pointer flex items-center gap-2 ${
                    idx === safeIndex
                      ? 'bg-stone-800 text-amber-300 border-amber-500/70 shadow-sm'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200 hover:border-stone-700'
                  }`}
                >
                  <LuxuryPortalIcon portalId={p.id} size="xs" active={idx === safeIndex} />
                  <span>{p.title}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Focused Section Summary */}
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => stepPortal(isRtlLang ? 1 : -1)}
                  aria-label={L('prev_portal')}
                  title={L('prev_portal')}
                  className="w-9 h-9 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-200 border border-stone-700 flex items-center justify-center cursor-pointer"
                >
                  {isRtlLang ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => stepPortal(isRtlLang ? -1 : 1)}
                  aria-label={L('next_portal')}
                  title={L('next_portal')}
                  className="w-9 h-9 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-200 border border-stone-700 flex items-center justify-center cursor-pointer"
                >
                  {isRtlLang ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              <LuxuryPortalIcon portalId={activePortal.id} size="sm" active />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white truncate">{activePortal.title}</h4>
                  <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-800 text-amber-300 border border-stone-700 shrink-0">
                    {activePortal.statsBadge}
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 truncate mt-0.5">{activePortal.subtitle}</p>
              </div>
            </div>

            {/* Model & Camera Controls + Primary Enter Action */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setExplodeModels((v) => !v)}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  explodeModels
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-stone-950 text-stone-300 border-stone-700 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{L('inspect_model')}</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoOrbit((v) => !v)}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
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
                className="px-3 py-2 rounded-xl border border-stone-700 bg-stone-950 hover:bg-stone-800 text-stone-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{L('reset_view')}</span>
              </button>

              <button
                type="button"
                onClick={() => activePortal.onEnter()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <SparklesIcon className="w-3.5 h-3.5" />
                <span>{L('enter_portal')}</span>
                {isRtlLang ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
