import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Upload, Trash2, Check, AlertCircle, RefreshCw, Sun, Sliders, Eye, RotateCcw, Sparkles } from 'lucide-react';

interface BackgroundSelectorProps {
  customBg: string | null;
  onCustomBgChange: (bgUrl: string | null) => void;
  bgBrightness: number;
  onBgBrightnessChange: (val: number) => void;
  bgContrast: number;
  onBgContrastChange: (val: number) => void;
  cardOpacity: number;
  onCardOpacityChange: (val: number) => void;
  cardBlur: number;
  onCardBlurChange: (val: number) => void;
  activeTheme: any;
  lang: 'en' | 'fr';
}

const localTranslations = {
  fr: {
    bgTitle: "Fond d'écran",
    bgDesc: "Personnalisez l'arrière-plan de l'application",
    dragActive: "Déposez l'image ici...",
    clickOrDrag: "Cliquez ou glissez-déposez une image",
    maxSizeDesc: "Recommandé: JPG ou PNG. Redimensionné automatiquement.",
    removeBg: "Retirer l'arrière-plan",
    errorFormat: "Format d'image invalide. Veuillez choisir un fichier image.",
    errorCompress: "Erreur lors de la compression de l'image.",
    processing: "Traitement de l'image...",
    success: "Arrière-plan appliqué!",
    brightness: "Luminosité",
    contrast: "Contraste",
    cardOpacityLabel: "Opacité des cartes",
    cardOpacityDesc: "Transparence des panneaux d'information",
    cardBlurLabel: "Flou des cartes",
    cardBlurDesc: "Intensité de l'effet de verre dépoli",
    resetDefaults: "Réinitialiser les réglages"
  },
  en: {
    bgTitle: "Background",
    bgDesc: "Customize the application background",
    dragActive: "Drop the image here...",
    clickOrDrag: "Click or drag & drop an image",
    maxSizeDesc: "Recommended: JPG or PNG. Auto-resized.",
    removeBg: "Remove background",
    errorFormat: "Invalid image format. Please select an image file.",
    errorCompress: "Error compressing image.",
    processing: "Processing image...",
    success: "Background applied!",
    brightness: "Brightness",
    contrast: "Contrast",
    cardOpacityLabel: "Card Opacity",
    cardOpacityDesc: "Transparency of info panels",
    cardBlurLabel: "Card Blur",
    cardBlurDesc: "Intensity of the frosted glass effect",
    resetDefaults: "Reset adjustments"
  }
};

export const BackgroundSelector: React.FC<BackgroundSelectorProps> = ({
  customBg,
  onCustomBgChange,
  bgBrightness,
  onBgBrightnessChange,
  bgContrast,
  onBgContrastChange,
  cardOpacity,
  onCardOpacityChange,
  cardBlur,
  onCardBlurChange,
  activeTheme,
  lang = 'fr'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = localTranslations[lang];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerSuccess = () => {
    setSuccessMsg(true);
    const timer = setTimeout(() => setSuccessMsg(false), 2000);
    return () => clearTimeout(timer);
  };

  // Image compression engine (resizes to max width 1280px and converts to JPG at 0.75 quality)
  const processAndCompressFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg(t.errorFormat);
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Limit max dimension to 1280px for standard widescreen viewports
          const MAX_DIMENSION = 1280;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error("Canvas context is unavailable");
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG at 0.75 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          
          onCustomBgChange(dataUrl);
          setIsProcessing(false);
          triggerSuccess();
        } catch (err) {
          console.error("Compression error:", err);
          setErrorMsg(t.errorCompress);
          setIsProcessing(false);
        }
      };
      
      img.onerror = () => {
        setErrorMsg(t.errorFormat);
        setIsProcessing(false);
      };
      
      if (event.target?.result) {
        img.src = event.target.result as string;
      } else {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg(t.errorCompress);
      setIsProcessing(false);
    };

    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processAndCompressFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processAndCompressFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveBg = () => {
    onCustomBgChange(null);
    triggerSuccess();
  };

  const handleResetSliders = () => {
    onBgBrightnessChange(100);
    onBgContrastChange(100);
    onCardOpacityChange(50);
    onCardBlurChange(8);
  };

  const hasAdjustments = bgBrightness !== 100 || bgContrast !== 100 || cardOpacity !== 50 || cardBlur !== 8;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none flex items-center justify-center group"
        title={t.bgTitle}
      >
        <ImageIcon size={18} className={`${activeTheme.accentClass} transition-colors group-hover:scale-110 duration-200`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-50 p-4 max-h-[90vh] overflow-y-auto scrollbar-hide"
          >
            <div className="flex flex-col gap-4">
              {/* Heading */}
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    {t.bgTitle}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    {t.bgDesc}
                  </span>
                </div>
                {hasAdjustments && (
                  <button
                    onClick={handleResetSliders}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title={t.resetDefaults}
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>

              {/* Drag/Drop and Click Zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`relative border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  dragActive 
                    ? "border-blue-500 bg-blue-500/10" 
                    : customBg 
                      ? "border-emerald-500/30 bg-emerald-500/[0.01]" 
                      : "border-slate-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                />

                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {t.processing}
                    </span>
                  </div>
                ) : customBg ? (
                  <div className="flex flex-col items-center gap-1.5 w-full">
                    <div className="relative w-20 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm">
                      <img 
                        src={customBg} 
                        alt="Current background preview" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white drop-shadow-md" />
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-500">
                      {t.success}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {t.clickOrDrag}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-full text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block">
                        {dragActive ? t.dragActive : t.clickOrDrag}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        {t.maxSizeDesc}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sliders Container */}
              <div className="flex flex-col gap-3.5 border-t border-slate-100 dark:border-white/5 pt-3.5">
                
                {/* Brightness slider - Only relevant if custom background is applied */}
                {customBg && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Sun size={12} className="text-amber-500" />
                        <span>{t.brightness}</span>
                      </div>
                      <span className="font-mono text-xs">{bgBrightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="150"
                      value={bgBrightness}
                      onChange={(e) => onBgBrightnessChange(Number(e.target.value))}
                      className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                )}

                {/* Contrast slider - Only relevant if custom background is applied */}
                {customBg && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Sliders size={12} className="text-indigo-500" />
                        <span>{t.contrast}</span>
                      </div>
                      <span className="font-mono text-xs">{bgContrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={bgContrast}
                      onChange={(e) => onBgContrastChange(Number(e.target.value))}
                      className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                )}

                {/* Card Opacity slider - works with default theme and custom backgrounds alike */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Eye size={12} className="text-emerald-500" />
                      <span>{t.cardOpacityLabel}</span>
                    </div>
                    <span className="font-mono text-xs">{cardOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={cardOpacity}
                    onChange={(e) => onCardOpacityChange(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-[8px] text-slate-400 dark:text-slate-500 block font-medium">
                    {t.cardOpacityDesc}
                  </span>
                </div>

                {/* Card Blur slider - dynamic frosted glass filter adjustment */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={12} className="text-indigo-400" />
                      <span>{t.cardBlurLabel}</span>
                    </div>
                    <span className="font-mono text-xs">{cardBlur}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={cardBlur}
                    onChange={(e) => onCardBlurChange(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-[8px] text-slate-400 dark:text-slate-500 block font-medium">
                    {t.cardBlurDesc}
                  </span>
                </div>

              </div>

              {/* Error messages */}
              {errorMsg && (
                <div className="flex items-start gap-1.5 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[9px] text-red-500 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Success indicator */}
              {successMsg && !errorMsg && !isProcessing && (
                <div className="flex items-center gap-1.5 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[9px] text-emerald-500 font-medium">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{customBg ? t.success : "Réinitialisé / Reset completed"}</span>
                </div>
              )}

              {/* Remove BG Action Button */}
              {customBg && (
                <button
                  onClick={handleRemoveBg}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 mt-1"
                >
                  <Trash2 size={12} />
                  <span>{t.removeBg}</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
