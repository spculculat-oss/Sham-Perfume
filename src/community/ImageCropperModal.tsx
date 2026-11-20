import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  RotateCw,
  RotateCcw,
  Crop,
  Check,
  X,
  FlipHorizontal,
  FlipVertical,
  RotateCcw as ResetIcon,
  Sparkles,
  Palette,
  Sun,
  Flame,
} from 'lucide-react';
import { tx, Btn, type Lang } from './ui';

export type ColorFilterId = 'normal' | 'grayscale' | 'warm' | 'bright' | 'vintage' | 'vibrant';

export interface ColorFilterPreset {
  id: ColorFilterId;
  labelAr: string;
  labelEn: string;
  iconEmoji: string;
  css: string;
}

export const COLOR_FILTERS: ColorFilterPreset[] = [
  {
    id: 'normal',
    labelAr: 'الأصل',
    labelEn: 'Normal',
    iconEmoji: '✨',
    css: 'none',
  },
  {
    id: 'grayscale',
    labelAr: 'رمادي (أبيض وأسود)',
    labelEn: 'Grayscale',
    iconEmoji: '🖤',
    css: 'grayscale(100%) contrast(108%)',
  },
  {
    id: 'warm',
    labelAr: 'دافئ (عنبري)',
    labelEn: 'Warm Amber',
    iconEmoji: '🔥',
    css: 'sepia(35%) saturate(140%) brightness(105%)',
  },
  {
    id: 'bright',
    labelAr: 'ساطع (إشراقة نقية)',
    labelEn: 'Bright',
    iconEmoji: '☀️',
    css: 'brightness(120%) contrast(110%) saturate(110%)',
  },
  {
    id: 'vintage',
    labelAr: 'عتيق (أنتيك)',
    labelEn: 'Vintage',
    iconEmoji: '📜',
    css: 'sepia(65%) contrast(95%) brightness(95%)',
  },
  {
    id: 'vibrant',
    labelAr: 'فواح حيوي',
    labelEn: 'Vibrant',
    iconEmoji: '🌺',
    css: 'saturate(155%) contrast(115%) brightness(102%)',
  },
];

export interface ImageCropperModalProps {
  isOpen: boolean;
  imageUrl: string;
  lang: Lang;
  onClose: () => void;
  onApply: (croppedDataUrl: string) => void;
}

type AspectRatio = 'free' | '1:1' | '4:3' | '16:9' | '3:4';

interface CropBox {
  x: number; // percentage (0 to 100)
  y: number; // percentage (0 to 100)
  width: number; // percentage (0 to 100)
  height: number; // percentage (0 to 100)
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  imageUrl,
  lang,
  onClose,
  onApply,
}) => {
  const t = tx(lang);
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<ColorFilterId>('normal');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('free');
  const [crop, setCrop] = useState<CropBox>({ x: 5, y: 5, width: 90, height: 90 });
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ mouseX: number; mouseY: number; initialCrop: CropBox }>({
    mouseX: 0,
    mouseY: 0,
    initialCrop: { x: 5, y: 5, width: 90, height: 90 },
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset when a new image is loaded
  useEffect(() => {
    if (isOpen) {
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setActiveFilter('normal');
      setAspectRatio('free');
      setCrop({ x: 5, y: 5, width: 90, height: 90 });
    }
  }, [isOpen, imageUrl]);

  // Handle aspect ratio preset changes
  const applyAspectRatio = useCallback(
    (ratio: AspectRatio) => {
      setAspectRatio(ratio);
      if (ratio === 'free') {
        setCrop({ x: 5, y: 5, width: 90, height: 90 });
        return;
      }

      let targetRatio = 1; // width / height
      if (ratio === '1:1') targetRatio = 1;
      else if (ratio === '4:3') targetRatio = 4 / 3;
      else if (ratio === '16:9') targetRatio = 16 / 9;
      else if (ratio === '3:4') targetRatio = 3 / 4;

      const container = containerRef.current;
      if (!container) return;
      const containerRatio = container.clientWidth / container.clientHeight;

      let newWidth = 80;
      let newHeight = 80;

      if (targetRatio > containerRatio) {
        newWidth = 85;
        newHeight = (newWidth * containerRatio) / targetRatio;
      } else {
        newHeight = 85;
        newWidth = (newHeight * targetRatio) / containerRatio;
      }

      // Constrain within 10-90
      newWidth = Math.min(90, Math.max(15, newWidth));
      newHeight = Math.min(90, Math.max(15, newHeight));

      const newX = (100 - newWidth) / 2;
      const newY = (100 - newHeight) / 2;

      setCrop({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      });
    },
    []
  );

  // Mouse Drag handlers for resizing or moving crop box
  const handleMouseDown = (action: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(action);
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialCrop: { ...crop },
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStart.mouseX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStart.mouseY) / rect.height) * 100;
      const init = dragStart.initialCrop;

      let next = { ...init };

      if (isDragging === 'move') {
        next.x = Math.max(0, Math.min(100 - init.width, init.x + deltaX));
        next.y = Math.max(0, Math.min(100 - init.height, init.y + deltaY));
      } else if (isDragging === 'nw') {
        const newX = Math.max(0, Math.min(init.x + init.width - 10, init.x + deltaX));
        const newY = Math.max(0, Math.min(init.y + init.height - 10, init.y + deltaY));
        next.width = init.x + init.width - newX;
        next.height = init.y + init.height - newY;
        next.x = newX;
        next.y = newY;
      } else if (isDragging === 'ne') {
        const newY = Math.max(0, Math.min(init.y + init.height - 10, init.y + deltaY));
        next.width = Math.max(10, Math.min(100 - init.x, init.width + deltaX));
        next.height = init.y + init.height - newY;
        next.y = newY;
      } else if (isDragging === 'sw') {
        const newX = Math.max(0, Math.min(init.x + init.width - 10, init.x + deltaX));
        next.width = init.x + init.width - newX;
        next.height = Math.max(10, Math.min(100 - init.y, init.height + deltaY));
        next.x = newX;
      } else if (isDragging === 'se') {
        next.width = Math.max(10, Math.min(100 - init.x, init.width + deltaX));
        next.height = Math.max(10, Math.min(100 - init.y, init.height + deltaY));
      }

      setCrop(next);
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Execute Canvas Filter, Rotation, Flip & Crop
  const handleApplyCrop = () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Step 1: Render oriented image onto first canvas with applied rotation, flips, and color filter
      const orientedCanvas = document.createElement('canvas');
      const oCtx = orientedCanvas.getContext('2d');
      if (!oCtx) return;

      const isRotated90 = rotation % 180 !== 0;
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;

      orientedCanvas.width = isRotated90 ? naturalH : naturalW;
      orientedCanvas.height = isRotated90 ? naturalW : naturalH;

      oCtx.save();
      // Apply color filter to canvas
      const currentFilter = COLOR_FILTERS.find((f) => f.id === activeFilter);
      if (currentFilter && currentFilter.css !== 'none') {
        try {
          oCtx.filter = currentFilter.css;
        } catch {
          // Fallback if browser doesn't support ctx.filter
        }
      }

      oCtx.translate(orientedCanvas.width / 2, orientedCanvas.height / 2);
      oCtx.rotate((rotation * Math.PI) / 180);
      oCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      oCtx.drawImage(img, -naturalW / 2, -naturalH / 2);
      oCtx.restore();

      // Step 2: Crop from orientedCanvas
      const cropPxX = Math.round((crop.x / 100) * orientedCanvas.width);
      const cropPxY = Math.round((crop.y / 100) * orientedCanvas.height);
      const cropPxW = Math.round((crop.width / 100) * orientedCanvas.width);
      const cropPxH = Math.round((crop.height / 100) * orientedCanvas.height);

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = Math.max(1, cropPxW);
      croppedCanvas.height = Math.max(1, cropPxH);
      const cCtx = croppedCanvas.getContext('2d');
      if (!cCtx) return;

      cCtx.drawImage(
        orientedCanvas,
        cropPxX,
        cropPxY,
        cropPxW,
        cropPxH,
        0,
        0,
        cropPxW,
        cropPxH
      );

      const resultDataUrl = croppedCanvas.toDataURL('image/jpeg', 0.9);
      onApply(resultDataUrl);
      onClose();
    };
    img.src = imageUrl;
  };

  const activeFilterCss = COLOR_FILTERS.find((f) => f.id === activeFilter)?.css || 'none';

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col max-w-4xl w-full max-h-[96vh] bg-stone-900 rounded-3xl overflow-hidden shadow-2xl border border-stone-700/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-950/80 border-b border-stone-800 text-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
              <Crop className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-100">
                {t('محرر تعديل الصورة: فلاتر لونية وقص وتدوير', 'Image Editor: Filters, Crop & Orientation')}
              </h3>
              <p className="text-[11px] text-stone-400">
                {t('طبّق الفلاتر (رمادي، دافئ، ساطع)، اقلب الصورة، واضبط أبعاد القص', 'Apply filters, flip, rotate and crop')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Center Canvas / Interactive Workspace */}
        <div className="relative flex-1 min-h-[280px] sm:min-h-[380px] bg-stone-950 flex items-center justify-center p-4 overflow-hidden select-none">
          <div
            ref={containerRef}
            className="relative max-h-[50vh] max-w-full flex items-center justify-center overflow-hidden"
            style={{
              transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
              transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop workspace"
              style={{ filter: activeFilterCss }}
              className="max-h-[48vh] max-w-full object-contain pointer-events-none rounded-lg transition-all"
            />

            {/* Dark Mask outside crop area */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute inset-0 bg-black/55 backdrop-grayscale-20"
                style={{
                  clipPath: `polygon(
                    0% 0%, 100% 0%, 100% 100%, 0% 100%,
                    0% ${crop.y}%,
                    ${crop.x}% ${crop.y}%,
                    ${crop.x}% ${crop.y + crop.height}%,
                    ${crop.x + crop.width}% ${crop.y + crop.height}%,
                    ${crop.x + crop.width}% ${crop.y}%,
                    0% ${crop.y}%
                  )`,
                }}
              />
            </div>

            {/* Interactive Crop Rectangle */}
            <div
              className="absolute border-2 border-amber-400 shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move"
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.width}%`,
                height: `${crop.height}%`,
              }}
              onMouseDown={(e) => handleMouseDown('move', e)}
            >
              {/* 3x3 Rule of Thirds Grid */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                <div className="border-r border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div />
              </div>

              {/* Corner Handles */}
              <div
                onMouseDown={(e) => handleMouseDown('nw', e)}
                className="absolute -top-2 -left-2 w-4 h-4 bg-amber-400 border border-black rounded-sm cursor-nwse-resize shadow-md"
              />
              <div
                onMouseDown={(e) => handleMouseDown('ne', e)}
                className="absolute -top-2 -right-2 w-4 h-4 bg-amber-400 border border-black rounded-sm cursor-nesw-resize shadow-md"
              />
              <div
                onMouseDown={(e) => handleMouseDown('sw', e)}
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-amber-400 border border-black rounded-sm cursor-nesw-resize shadow-md"
              />
              <div
                onMouseDown={(e) => handleMouseDown('se', e)}
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-amber-400 border border-black rounded-sm cursor-nwse-resize shadow-md"
              />
            </div>
          </div>
        </div>

        {/* Modal Controls Toolbar */}
        <div className="px-5 py-3.5 bg-stone-900 border-t border-stone-800 space-y-3 shrink-0">
          {/* Row 1: Color Filters Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 shrink-0">
              <Palette className="h-3.5 w-3.5" />
              <span>{t('الفلاتر اللونية:', 'Filters:')}</span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {COLOR_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    activeFilter === f.id
                      ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md shadow-amber-900/30'
                      : 'bg-stone-950/80 hover:bg-stone-800 text-stone-300 border-stone-800'
                  }`}
                >
                  <span>{f.iconEmoji}</span>
                  <span>{lang === 'ar' ? f.labelAr : f.labelEn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Aspect Ratios, Rotation & Flip Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-stone-800/80">
            {/* Aspect Ratio Buttons */}
            <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
              <span className="text-[10px] text-stone-500 font-bold px-1.5 uppercase">
                {t('النسبة:', 'Ratio:')}
              </span>
              {(['free', '1:1', '4:3', '16:9', '3:4'] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => applyAspectRatio(ratio)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    aspectRatio === ratio
                      ? 'bg-amber-600 text-stone-950 shadow-sm'
                      : 'text-stone-300 hover:text-white hover:bg-stone-800'
                  }`}
                >
                  {ratio === 'free' ? t('حر', 'Free') : ratio}
                </button>
              ))}
            </div>

            {/* Rotation & Flip Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title={t('تدوير 90 درجة مع عقارب الساعة', 'Rotate 90° Clockwise')}
                className="inline-flex items-center gap-1 bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-1.5 rounded-xl text-xs font-semibold border border-stone-700 transition cursor-pointer"
              >
                <RotateCw className="h-3.5 w-3.5 text-amber-400" />
                <span>{t('تدوير 90°', 'Rotate')}</span>
              </button>

              <button
                type="button"
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                title={t('تدوير عكس عقارب الساعة', 'Rotate Counter-Clockwise')}
                className="inline-flex items-center gap-1 bg-stone-800 hover:bg-stone-700 text-stone-200 p-2 rounded-xl text-xs font-semibold border border-stone-700 transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              {/* Flip Horizontal */}
              <button
                type="button"
                onClick={() => setFlipH((f) => !f)}
                title={t('قلب أفقي (مرآة)', 'Flip Horizontal')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  flipH
                    ? 'bg-amber-600 text-stone-950 border-amber-500'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
                }`}
              >
                <FlipHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('قلب أفقي', 'Flip H')}</span>
              </button>

              {/* Flip Vertical */}
              <button
                type="button"
                onClick={() => setFlipV((f) => !f)}
                title={t('قلب عمودي (رأسي)', 'Flip Vertical')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  flipV
                    ? 'bg-amber-600 text-stone-950 border-amber-500'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
                }`}
              >
                <FlipVertical className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('قلب عمودي', 'Flip V')}</span>
              </button>

              {/* Reset */}
              <button
                type="button"
                onClick={() => {
                  setRotation(0);
                  setFlipH(false);
                  setFlipV(false);
                  setActiveFilter('normal');
                  setAspectRatio('free');
                  setCrop({ x: 5, y: 5, width: 90, height: 90 });
                }}
                title={t('إعادة تعيين كافة التعديلات', 'Reset all changes')}
                className="inline-flex items-center gap-1 bg-stone-800 hover:bg-stone-700 text-stone-300 p-2 rounded-xl text-xs font-semibold border border-stone-700 transition cursor-pointer"
              >
                <ResetIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Row 3: Bottom Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-800">
            <div className="text-[11px] text-stone-400 hidden sm:block">
              {t(
                'اختر الفلتر والزاوية المناسبة، واسحب الإطار الأصفر لقص التكوين بدقة',
                'Select filter, orientation, and adjust yellow crop box'
              )}
            </div>

            <div className="flex items-center gap-2 ms-auto">
              <Btn
                variant="ghost"
                small
                className="text-stone-300 hover:text-white"
                onClick={onClose}
              >
                {t('إلغاء', 'Cancel')}
              </Btn>

              <button
                type="button"
                onClick={handleApplyCrop}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer"
              >
                <Check className="h-4 w-4 stroke-[3]" />
                <span>{t('تطبيق وحفظ التعديلات', 'Apply Edits & Save')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
