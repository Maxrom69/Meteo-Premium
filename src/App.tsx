/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component } from 'react';
import { 
  Cloud, 
  CloudDrizzle, 
  CloudFog, 
  CloudLightning, 
  CloudRain, 
  CloudSnow, 
  CloudSun, 
  Droplets, 
  Navigation, 
  Sun, 
  Moon,
  Thermometer, 
  Wind,
  Search,
  MapPin,
  Calendar,
  Clock,
  Globe,
  Maximize,
  Minimize,
  Layers,
  Heart,
  Trash2,
  AlertCircle,
  RefreshCw,
  Palette,
  Check,
  Sliders,
  TrendingUp,
  TrendingDown,
  Eye,
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  HelpCircle,
  CloudOff,
  Plus,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { WeatherBackground } from './components/WeatherBackground';
import { BackgroundSelector } from './components/BackgroundSelector';

const GOOGLE_MAPS_API_KEY = (typeof process !== 'undefined' && process.env?.GOOGLE_MAPS_PLATFORM_KEY) || ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY) || '';
const hasValidMapsKey = Boolean(GOOGLE_MAPS_API_KEY) && GOOGLE_MAPS_API_KEY !== 'YOUR_API_KEY';

// Intercept cross-origin "Script error." and handle gracefully to prevent iframe sandbox crash
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message === 'Script error.' || !event.filename) {
      console.warn('Gracefully handled cross-origin Script error:', event);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  // Filter benign Google Maps JS API informational notices (e.g. satellite map type styling notice when mapId is present)
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const firstArg = typeof args[0] === 'string' ? args[0] : '';
    if (
      firstArg.includes("preregistered map type may not apply all custom styles when a mapId is present") ||
      firstArg.includes("cloud console for all default map types except for satellite") ||
      firstArg.includes("The Google Maps JavaScript API has already been loaded with different parameters")
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface WeatherData {
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
    isDay: boolean;
    uvIndex?: number;
    visibility?: number;
  };
  hourly: Array<{
    time: string;
    temp: number;
    weatherCode: number;
    humidity?: number;
    windSpeed?: number;
    uvIndex?: number;
    visibility?: number;
  }>;
  daily: Array<{
    date: string;
    tempMax: number;
    tempMin: number;
    weatherCode: number;
  }>;
  locationName: string;
  coords: { lat: number, lon: number };
}

// --- Weather Code Mapping ---
const getWeatherIcon = (code: number, isDay: boolean = true) => {
  if (code === 0) return isDay ? Sun : Moon;
  if (code >= 1 && code <= 3) return CloudSun;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 55) return CloudDrizzle;
  if (code >= 61 && code <= 65) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 95) return CloudLightning;
  return Cloud;
};

const getWeatherIconColor = (code: number, isDay: boolean = true) => {
  if (code === 0) return "text-yellow-400";
  if (code >= 1 && code <= 3) return "text-gray-300";
  if (code === 45 || code === 48) return "text-gray-400";
  if (code >= 51 && code <= 55) return "text-blue-300";
  if (code >= 61 && code <= 65) return "text-blue-400";
  if (code >= 71 && code <= 77) return "text-blue-100";
  if (code >= 80 && code <= 82) return "text-blue-500";
  if (code >= 95) return "text-purple-400";
  return "text-gray-400";
};

const getWeatherIconPngUrl = (code: number, isDay: boolean = true) => {
  let icon = "01d";
  if (code === 0) {
    icon = isDay ? "01d" : "01n";
  } else if (code >= 1 && code <= 3) {
    if (code === 1) icon = isDay ? "02d" : "02n";
    else if (code === 2) icon = isDay ? "03d" : "03n";
    else icon = isDay ? "04d" : "04n";
  } else if (code === 45 || code === 48) {
    icon = "50d";
  } else if (code >= 51 && code <= 55) {
    icon = "09d";
  } else if (code >= 61 && code <= 65) {
    icon = isDay ? "10d" : "10n";
  } else if (code >= 71 && code <= 77) {
    icon = "13d";
  } else if (code >= 80 && code <= 82) {
    icon = "09d";
  } else if (code >= 95) {
    icon = "11d";
  }
  return `https://openweathermap.org/img/wn/${icon}@4x.png`;
};

const getWeatherDescription = (code: number, lang: 'fr' | 'en' = 'fr') => {
  const descriptions: Record<number, { fr: string, en: string }> = {
    0: { fr: 'Ciel dégagé', en: 'Clear sky' },
    1: { fr: 'Généralement dégagé', en: 'Mainly clear' },
    2: { fr: 'Partiellement nuageux', en: 'Partly cloudy' },
    3: { fr: 'Couvert', en: 'Overcast' },
    45: { fr: 'Brouillard', en: 'Fog' },
    48: { fr: 'Brouillard givrant', en: 'Depositing rime fog' },
    51: { fr: 'Bruine légère', en: 'Light drizzle' },
    53: { fr: 'Bruine modérée', en: 'Moderate drizzle' },
    55: { fr: 'Bruine dense', en: 'Dense drizzle' },
    61: { fr: 'Pluie légère', en: 'Light rain' },
    63: { fr: 'Pluie modérée', en: 'Moderate rain' },
    65: { fr: 'Pluie forte', en: 'Heavy rain' },
    71: { fr: 'Chute de neige légère', en: 'Light snow' },
    73: { fr: 'Chute de neige modérée', en: 'Moderate snow' },
    75: { fr: 'Chute de neige forte', en: 'Heavy snow' },
    80: { fr: 'Averses de pluie légères', en: 'Light rain showers' },
    81: { fr: 'Averses de pluie modérées', en: 'Moderate rain showers' },
    82: { fr: 'Averses de pluie violentes', en: 'Violent rain showers' },
    95: { fr: 'Orage', en: 'Thunderstorm' },
  };
  const desc = descriptions[code] || { fr: 'Conditions inconnues', en: 'Unknown conditions' };
  return lang === 'fr' ? desc.fr : desc.en;
};

interface WeatherAlert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  severity: string;
  guideline: string;
}

const getWeatherAlerts = (weather: any, lang: 'fr' | 'en', simulate: boolean): WeatherAlert[] => {
  const alerts: WeatherAlert[] = [];
  if (!weather || !weather.current) return alerts;

  const temp = simulate ? 39 : (weather.current.temp ?? 20);
  const windSpeed = simulate ? 65 : (weather.current.windSpeed ?? 10);
  const weatherCode = simulate ? 95 : (weather.current.weatherCode ?? 0);
  const uvIndex = simulate ? 11 : (weather.current.uvIndex ?? 4);
  const visibility = simulate ? 0.3 : (weather.current.visibility ?? 24.1);

  // 1. Storm alert (Weather Code >= 95)
  if (weatherCode >= 95) {
    alerts.push({
      id: 'storm',
      type: 'danger',
      title: lang === 'fr' ? "Alerte d'Orage Violent" : "Severe Thunderstorm Warning",
      description: lang === 'fr' 
        ? "Des orages violents sont signalés dans la région avec de la grêle lourde, des éclairs fréquents et de fortes rafales de vent."
        : "Severe thunderstorms are reported in the region with potential heavy hail, frequent lightning, and strong wind gusts.",
      severity: lang === 'fr' ? "SÉVÈRE" : "SEVERE",
      guideline: lang === 'fr'
        ? "Mettez-vous à l'abri immédiatement à l'intérieur d'un bâtiment solide. Évitez les appareils électriques et les structures métalliques."
        : "Take shelter immediately inside a sturdy building. Avoid electrical appliances and metallic structures."
    });
  }

  // 2. High Snow / Blizzard (Weather Code 75 or 86)
  if (weatherCode === 75 || weatherCode === 86) {
    alerts.push({
      id: 'snow',
      type: 'danger',
      title: lang === 'fr' ? "Alerte de Tempête de Neige" : "Blizzard & Heavy Snow Warning",
      description: lang === 'fr'
        ? "Chutes de neige exceptionnellement abondantes réduisant la visibilité à presque zéro avec des conditions routières dangereuses."
        : "Exceptionally heavy snowfall reducing visibility to near zero with hazardous driving conditions.",
      severity: lang === 'fr' ? "CRITIQUE" : "CRITICAL",
      guideline: lang === 'fr'
        ? "Évitez tout déplacement inutile. Si vous devez absolument sortir, préparez une trousse de secours et roulez prudemment."
        : "Avoid non-essential travel. If travel is necessary, prepare an emergency kit and drive with extreme caution."
    });
  }

  // 3. Heavy Rain / Flash Flood (Weather Code 65 or 82)
  if (weatherCode === 65 || weatherCode === 82) {
    alerts.push({
      id: 'rain',
      type: 'warning',
      title: lang === 'fr' ? "Avis d'Inondation Soudaine" : "Flash Flood Advisory",
      description: lang === 'fr'
        ? "Accumulations rapides de pluie risquant d'entraîner des inondations locales dans les zones à faible élévation."
        : "Rapid rainfall accumulation with risk of localized flooding in low-lying areas.",
      severity: lang === 'fr' ? "MODÉRÉ" : "MODERATE",
      guideline: lang === 'fr'
        ? "Ne traversez jamais à pied ou en voiture les zones inondées. Tenez-vous informé des alertes de crues locales."
        : "Never attempt to walk or drive through flooded areas. Keep monitored for local rising water levels."
    });
  }

  // 4. Extreme High Wind Alert (> 50 km/h)
  if (windSpeed > 50) {
    alerts.push({
      id: 'wind',
      type: 'warning',
      title: lang === 'fr' ? "Alerte de Vents Violents" : "High Wind Warning",
      description: lang === 'fr'
        ? `Rafales de vent extrêmement violentes atteignant les ${windSpeed} km/h.`
        : `Extremely damaging winds with gusts reaching up to ${windSpeed} km/h.`,
      severity: lang === 'fr' ? "MODÉRÉ" : "MODERATE",
      guideline: lang === 'fr'
        ? "Sécurisez ou rentrez tous les objets mobiles extérieurs. Évitez les zones boisées à cause du risque de chutes de branches."
        : "Secure or bring indoors any loose outdoor objects. Avoid wooded areas due to falling branches."
    });
  }

  // 5. Extreme heat wave (> 38°C) or Extreme cold wave (< -15°C)
  if (temp >= 38) {
    alerts.push({
      id: 'heat',
      type: 'danger',
      title: lang === 'fr' ? "Alerte de Chaleur Extrême" : "Extreme Heat Warning",
      description: lang === 'fr'
        ? `Températures caniculaires extrêmes de ${temp}°C.`
        : `Extreme heatwave conditions with temperatures climbing up to ${temp}°C.`,
      severity: lang === 'fr' ? "CRITIQUE" : "CRITICAL",
      guideline: lang === 'fr'
        ? "Buvez beaucoup d'eau, évitez les efforts physiques extérieurs aux heures les plus chaudes et surveillez les personnes vulnérables."
        : "Drink plenty of fluids, avoid outdoor exertion during peak sun hours, and check on vulnerable neighbors."
    });
  } else if (temp <= -18) {
    alerts.push({
      id: 'cold',
      type: 'warning',
      title: lang === 'fr' ? "Avertissement de Froid Extrême" : "Extreme Cold Warning",
      description: lang === 'fr'
        ? `Température glaciale mesurée de ${temp}°C.`
        : `Freezing temperature measured at ${temp}°C.`,
      severity: lang === 'fr' ? "SÉVÈRE" : "SEVERE",
      guideline: lang === 'fr'
        ? "Habillez-vous chaudement avec plusieurs couches de vêtements. Limitez l'exposition de la peau nue pour éviter les engelures."
        : "Dress in warm layers. Limit bare skin exposure to avoid rapid frostbite development."
    });
  }

  // 6. Extreme UV index alert (>= 9)
  if (uvIndex !== undefined && uvIndex >= 9) {
    alerts.push({
      id: 'uv',
      type: 'warning',
      title: lang === 'fr' ? "Avis d'Indice UV Extrême" : "Extreme UV Radiation Advisory",
      description: lang === 'fr'
        ? `Index UV mesuré à ${Math.round(uvIndex)}, niveau de radiation très élevé.`
        : `UV Index is at an extreme level of ${Math.round(uvIndex)} with high radiation exposure risk.`,
      severity: lang === 'fr' ? "MODÉRÉ" : "MODERATE",
      guideline: lang === 'fr'
        ? "Appliquez un écran solaire SPF 30+, portez un chapeau à larges bords et des lunettes de soleil. Restez à l'ombre."
        : "Apply SPF 30+ sunscreen, wear a wide-brimmed hat and sunglasses. Minimize exposure between 11 AM and 3 PM."
    });
  }

  // 7. Dense Fog / Low Visibility (< 0.5 km)
  if (visibility !== undefined && visibility <= 0.5) {
    alerts.push({
      id: 'visibility',
      type: 'info',
      title: lang === 'fr' ? "Avis de Brouillard Dense" : "Dense Fog Advisory",
      description: lang === 'fr'
        ? `Visibilité extrêmement restreinte à seulement ${visibility} km en raison d'un épais brouillard.`
        : `Visibility extremely restricted to just ${visibility} km due to dense fog banks.`,
      severity: lang === 'fr' ? "MINEUR" : "MINOR",
      guideline: lang === 'fr'
        ? "Allumez vos feux de croisement et ralentissez. Gardez une distance de sécurité accrue avec le véhicule qui vous précède."
        : "Turn on low-beam headlights and slow down. Maintain an increased safety distance from the vehicle in front of you."
    });
  }

  return alerts;
};

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
  t?: any;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-10 text-slate-900 dark:text-white font-sans text-center transition-colors">
          <AlertCircle size={64} className="text-red-500 mb-6" />
          <h1 className="text-2xl font-bold mb-4 tracking-tight">Outil en panne / App Failure</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md text-sm">
            {this.state.error?.message || "An unexpected runtime error occurred."}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-blue-500 transition-colors shadow-lg"
          >
            Réessayer / Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

const AnimatedWeatherIcon = ({ code, isDay = true, size = 24, lang = 'fr' }: { code: number, isDay?: boolean, size?: number, lang?: 'fr' | 'en' }) => {
  const pngUrl = getWeatherIconPngUrl(code, isDay);

  const getVariants = () => {
    if (code === 0) {
      return {
        animate: { rotate: isDay ? 360 : [0, 5, -5, 0] },
        transition: isDay 
          ? { duration: 25, repeat: Infinity, ease: "linear" }
          : { duration: 5, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (code >= 1 && code <= 3) {
      return {
        animate: { x: [-1.5, 1.5, -1.5], y: [-1, 1, -1] },
        transition: { duration: 5, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (code >= 51 && code <= 82) {
      return {
        animate: { y: [0, 2, 0] },
        transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (code >= 95) {
      return {
        animate: { scale: [1, 1.05, 1], y: [0, 1, 0] },
        transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
      };
    }
    return {
      animate: { scale: [1, 1.03, 1] },
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
    };
  };

  const animationProps = getVariants();

  return (
    <motion.div {...animationProps} className="flex items-center justify-center select-none pointer-events-none">
      <img 
        src={pngUrl} 
        alt={getWeatherDescription(code, lang)} 
        width={size} 
        height={size}
        referrerPolicy="no-referrer"
        className="object-contain"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </motion.div>
  );
};

const SleekCard = ({ children, className, id, style, ...rest }: { children: React.ReactNode; className?: string; id?: string; style?: React.CSSProperties; [key: string]: any }) => (
  <motion.div 
    id={id}
    className={cn(
      "border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl dark:shadow-2xl cursor-pointer transition-colors duration-300",
      className
    )}
    style={{
      backgroundColor: 'var(--card-bg-color, rgba(255, 255, 255, 0.5))',
      backdropFilter: 'blur(var(--card-blur, 8px))',
      WebkitBackdropFilter: 'blur(var(--card-blur, 8px))',
      ...style
    }}
    whileHover={{ 
      y: -5, 
      scale: 1.008, 
      boxShadow: "0 30px 60px -15px rgba(0, 0, 0, 0.2), 0 15px 30px -20px rgba(59, 130, 246, 0.25)",
      borderColor: "rgba(59, 130, 246, 0.3)"
    }}
    transition={{ type: "spring", stiffness: 150, damping: 20 }}
    {...rest}
  >
    {children}
  </motion.div>
);

const AnimatedValue = ({ value }: { value: string }) => {
  const match = value.match(/^([^0-9.-]*)([0-9.-]+)([^0-9.-]*)$/);
  
  if (!match) {
    return <>{value}</>;
  }

  const prefix = match[1];
  const numStr = match[2];
  const suffix = match[3];
  const targetNum = parseFloat(numStr);

  if (isNaN(targetNum)) {
    return <>{value}</>;
  }

  const [currentNum, setCurrentNum] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1000; // 1 second smooth interpolation
    const startNum = 0;
    
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Beautiful easeOutQuart transition curve
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const current = startNum + (targetNum - startNum) * easeProgress;
      
      const hasDecimal = numStr.includes('.');
      const decimalPlaces = hasDecimal ? numStr.split('.')[1].length : 0;
      
      setCurrentNum(Number(current.toFixed(decimalPlaces)));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [targetNum, numStr]);

  return (
    <>
      {prefix}
      {currentNum}
      {suffix}
    </>
  );
};

const getTrendForMetric = (id: string | undefined, animateTrigger: any) => {
  if (!id || !animateTrigger) return null;
  const triggerStr = String(animateTrigger);
  const currentHour = new Date().getHours();
  // Combine id, trigger, and current hour to generate a stable, hourly deterministic value
  const str = `${id}-${triggerStr}-${currentHour}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  
  const absHash = Math.abs(hash);
  const isUp = (absHash % 2) === 0;
  // Generate a realistic, small percent change: 0.5% to 4.5%
  const percentChange = ((absHash % 41) + 5) / 10;
  
  return {
    isUp,
    percent: percentChange.toFixed(1)
  };
};

const StatCard = ({ 
  label, 
  value, 
  subtext, 
  progress, 
  id, 
  delay = 0, 
  animateTrigger, 
  activeTheme, 
  className,
  isDimmed,
  style,
  onMouseEnter,
  onMouseLeave,
  onClick,
  alert
}: { 
  label: string, 
  value: string, 
  subtext?: string, 
  progress?: number, 
  id?: string, 
  delay?: number, 
  animateTrigger?: any, 
  activeTheme?: any, 
  className?: string,
  isDimmed?: boolean,
  style?: React.CSSProperties,
  onMouseEnter?: () => void,
  onMouseLeave?: () => void,
  onClick?: () => void,
  alert?: { type: 'danger' | 'warning' | 'info'; title: string }
}) => {
  const trend = getTrendForMetric(id, animateTrigger);
  const themeId = activeTheme?.id || 'classic';

  const primaryGlow = getThemeRgbaColor(themeId, 0.3);
  const companionGlow = getCompanionRgbaColor(themeId, 0.3);
  const primaryBorder = getThemeRgbaColor(themeId, 0.45);
  const companionBorder = getCompanionRgbaColor(themeId, 0.45);

  return (
    <motion.div 
      id={id} 
      key={animateTrigger ? `${id}-${animateTrigger}` : undefined}
      initial={{ opacity: 0, y: 15 }}
      animate={{ 
        opacity: isDimmed ? 0.35 : 1, 
        y: 0,
        scale: isDimmed ? 0.98 : 1
      }}
      className={cn(
        "border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between aspect-square md:aspect-auto cursor-pointer transition-all duration-300 hover-glow-shift",
        className
      )}
      style={{
        backgroundColor: 'var(--card-bg-color, rgba(255, 255, 255, 0.5))',
        backdropFilter: 'blur(var(--card-blur, 8px))',
        WebkitBackdropFilter: 'blur(var(--card-blur, 8px))',
        '--glow-color-1': primaryGlow,
        '--glow-color-2': companionGlow,
        '--glow-border-1': primaryBorder,
        '--glow-border-2': companionBorder,
        ...style
      } as React.CSSProperties}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      whileHover={{ 
        y: -4, 
        scale: 1.02, 
        opacity: 1
      }}
      transition={{ 
        type: "spring", 
        stiffness: 150, 
        damping: 18,
        delay: isDimmed ? 0 : delay
      }}
    >
      <div className="flex justify-between items-start w-full gap-2">
        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">{label}</span>
        {alert && (
          <span className={cn(
            "text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1 animate-pulse shrink-0",
            alert.type === 'danger' 
              ? "bg-red-500 text-white" 
              : alert.type === 'warning' 
                ? "bg-amber-500 text-slate-950" 
                : "bg-blue-500 text-white"
          )} title={alert.title}>
            <AlertCircle size={8} className="fill-current" />
            <span>{alert.type === 'danger' ? "SEVERE" : "ALERT"}</span>
          </span>
        )}
      </div>
      <div className="flex flex-col mt-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            <AnimatedValue value={value} />
          </span>
          {trend && (
            <div className={cn(
              "text-[9px] font-black flex items-center gap-0.5 px-1.5 py-0.5 rounded-full select-none",
              trend.isUp 
                ? "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/10" 
                : "text-rose-600 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-500/10"
            )}>
              {trend.isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              <span>{trend.isUp ? '+' : '-'}{trend.percent}%</span>
            </div>
          )}
        </div>
        {progress !== undefined && (
          <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
            <div 
              className={cn("h-full transition-all duration-1000", activeTheme ? activeTheme.accentBgSolid : "bg-blue-500")} 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {subtext && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium uppercase tracking-tighter">{subtext}</p>}
      </div>
    </motion.div>
  );
};

// --- Translations ---
const translations = {
  fr: {
    appName: "Météo Premium",
    searchPlaceholder: "Rechercher une ville...",
    feelsLike: "Ressenti",
    wind: "Vent",
    humidity: "Humidité",
    visibility: "Visibilité",
    uvIndex: "Index UV",
    uvLevel: "Modéré",
    visLevel: "Excellente",
    hourlyTitle: "Prévisions horaires",
    dailyTitle: "7 Prochains jours",
    next24h: "Prochaines 24h",
    dayConditions: "Conditions de jour",
    nightConditions: "Conditions de nuit",
    footer: "Données Météo • Open-Meteo Engine • Sleek Interface V1.0",
    retry: "Réessayer",
    refresh: "Rafraîchir",
    init: "Initialisation...",
    findMe: "Ma position",
    favoritesTitle: "Favoris",
    addFavorite: "Ajouter aux favoris",
    removeFavorite: "Retirer des favoris",
    noFavorites: "Pas encore de favoris",
    globeTitle: "Mode Globe 3D",
    satelliteTitle: "Vue Satellite",
    mapLabel: "Hautes altitudes • Radar Nuageux",
    mapsKeyRequired: "Clé API Google Maps requise",
    mapsKeyStep1: "Obtenir une clé API Google Maps",
    mapsKeyStep2: "Ajouter la clé API",
    mapsKeyStep2Studio: "Option A : En ligne (AI Studio)",
    mapsKeyStep2Local: "Option B : En local (Sur votre machine)",
    mapsKeyStep2LocalDesc: "Créez un fichier .env à la racine de votre dossier et ajoutez :",
    mapsKeyAuto: "L'application se reconstruira automatiquement.",
    errorGeoloc: "Géolocalisation refusée ou échouée",
    errorNotFound: "Ville non trouvée",
    errorFetch: "Erreur lors de la récupération des données",
    darkMode: "Mode sombre",
    lightMode: "Mode clair",
    uvDesc: "Niveau 4 de 11",
    visDesc: "km • Excellente",
    windDesc: "km/h • Direction NW",
    months: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    weekdays: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
    themeSelect: "Thèmes",
    fxIntensityLabel: "Intensité des Effets",
    fxIntensityDesc: "Ajuster la brume et la lumière",
    legend: "Légende",
    cloudsLabel: "Nuages",
    vegetationLabel: "Végétation",
    elevationLabel: "Élévation",
    contoursLabel: "Contours",
    arteriesLabel: "Artères",
    waterLabel: "Eau",
    weatherAlert: "Alerte Météo",
    safetyTips: "Consignes de sécurité",
    noAlerts: "Aucune alerte en cours",
    severe: "SÉVÈRE",
    warning: "AVERTISSEMENT",
    info: "INFO",
    severityLabel: "Gravité",
    simulateAlertLabel: "Simuler Alerte"
  },
  en: {
    appName: "Premium Weather",
    searchPlaceholder: "Search city...",
    feelsLike: "Feels like",
    wind: "Wind",
    humidity: "Humidity",
    visibility: "Visibility",
    uvIndex: "UV Index",
    uvLevel: "Moderate",
    visLevel: "Excellent",
    hourlyTitle: "Hourly Forecast",
    dailyTitle: "Next 7 Days",
    next24h: "Next 24h",
    dayConditions: "Day Conditions",
    nightConditions: "Night Conditions",
    footer: "Weather Data • Open-Meteo Engine • Sleek Interface V1.0",
    retry: "Retry",
    refresh: "Refresh",
    init: "Initializing...",
    findMe: "My location",
    favoritesTitle: "Favorites",
    addFavorite: "Add to favorites",
    removeFavorite: "Remove from favorites",
    noFavorites: "No favorites yet",
    globeTitle: "3D Globe Mode",
    satelliteTitle: "Satellite View",
    mapLabel: "High Altitude • Cloud Radar",
    mapsKeyRequired: "Google Maps API Key Required",
    mapsKeyStep1: "Get a Google Maps API Key",
    mapsKeyStep2: "Configure your API Key",
    mapsKeyStep2Studio: "Option A: Online (AI Studio)",
    mapsKeyStep2Local: "Option B: Locally (On your machine)",
    mapsKeyStep2LocalDesc: "Create a .env file in the root folder and add:",
    mapsKeyAuto: "The app will rebuild automatically.",
    errorGeoloc: "Geolocation denied or failed",
    errorNotFound: "City not found",
    errorFetch: "Error retrieving data",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    uvDesc: "Level 4 of 11",
    visDesc: "km • Excellent",
    windDesc: "km/h • NW Direction",
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    themeSelect: "Themes",
    fxIntensityLabel: "Effects Intensity",
    fxIntensityDesc: "Adjust light and fog FX",
    legend: "Legend",
    cloudsLabel: "Clouds",
    vegetationLabel: "Vegetation",
    elevationLabel: "Elevation",
    contoursLabel: "Contours",
    arteriesLabel: "Highways",
    waterLabel: "Water",
    weatherAlert: "Weather Alert",
    safetyTips: "Safety Guidelines",
    noAlerts: "No active alerts",
    severe: "SEVERE",
    warning: "WARNING",
    info: "INFO",
    severityLabel: "Severity",
    simulateAlertLabel: "Simulate Alert"
  }
};

const THEMES = [
  {
    id: 'classic',
    name: { en: 'Classic Blue', fr: 'Bleu Classique' },
    color: 'blue',
    dotClass: 'bg-blue-500',
    accentClass: 'text-blue-500 dark:text-blue-400',
    accentHoverClass: 'group-hover:text-blue-500 dark:group-hover:text-blue-400 hover:text-blue-500 dark:hover:text-blue-400',
    accentBgClass: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20',
    accentBgLightClass: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
    focusRingClass: 'focus:ring-blue-500/30',
    borderAccentClass: 'border-blue-500/20',
    gradientFrom: 'from-blue-600/10 dark:from-blue-600/10',
    gradientDotClass: 'bg-blue-400',
    radarBorder: 'border-blue-500',
    radarPing: 'border-blue-400/40',
    accentGroupHoverBg: 'group-hover:bg-blue-500/10',
    accentBgSolid: 'bg-blue-500',
    shadowColor: 'shadow-blue-500/20',
    selectionBgClass: 'selection:bg-blue-500/30',
    groupFocusTextClass: 'group-focus-within:text-blue-500'
  },
  {
    id: 'indigo',
    name: { en: 'Cosmic Indigo', fr: 'Indigo Cosmique' },
    color: 'indigo',
    dotClass: 'bg-indigo-500',
    accentClass: 'text-indigo-500 dark:text-indigo-400',
    accentHoverClass: 'group-hover:text-indigo-500 dark:group-hover:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-400',
    accentBgClass: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20',
    accentBgLightClass: 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400',
    focusRingClass: 'focus:ring-indigo-500/30',
    borderAccentClass: 'border-indigo-500/20',
    gradientFrom: 'from-indigo-600/10 dark:from-indigo-600/10',
    gradientDotClass: 'bg-indigo-400',
    radarBorder: 'border-indigo-500',
    radarPing: 'border-indigo-400/40',
    accentGroupHoverBg: 'group-hover:bg-indigo-500/10',
    accentBgSolid: 'bg-indigo-500',
    shadowColor: 'shadow-indigo-500/20',
    selectionBgClass: 'selection:bg-indigo-500/30',
    groupFocusTextClass: 'group-focus-within:text-indigo-500'
  },
  {
    id: 'emerald',
    name: { en: 'Emerald Forest', fr: 'Forêt Émeraude' },
    color: 'emerald',
    dotClass: 'bg-emerald-500',
    accentClass: 'text-emerald-500 dark:text-emerald-400',
    accentHoverClass: 'group-hover:text-emerald-500 dark:group-hover:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-400',
    accentBgClass: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20',
    accentBgLightClass: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
    focusRingClass: 'focus:ring-emerald-500/30',
    borderAccentClass: 'border-emerald-500/20',
    gradientFrom: 'from-emerald-600/10 dark:from-emerald-600/10',
    gradientDotClass: 'bg-emerald-400',
    radarBorder: 'border-emerald-500',
    radarPing: 'border-emerald-400/40',
    accentGroupHoverBg: 'group-hover:bg-emerald-500/10',
    accentBgSolid: 'bg-emerald-500',
    shadowColor: 'shadow-emerald-500/20',
    selectionBgClass: 'selection:bg-emerald-500/30',
    groupFocusTextClass: 'group-focus-within:text-emerald-500'
  },
  {
    id: 'amber',
    name: { en: 'Sunset Amber', fr: 'Ambre Crépuscule' },
    color: 'amber',
    dotClass: 'bg-amber-500',
    accentClass: 'text-amber-500 dark:text-amber-400',
    accentHoverClass: 'group-hover:text-amber-500 dark:group-hover:text-amber-400 hover:text-amber-500 dark:hover:text-amber-400',
    accentBgClass: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20',
    accentBgLightClass: 'bg-amber-500/10 text-amber-500 dark:text-amber-400',
    focusRingClass: 'focus:ring-amber-500/30',
    borderAccentClass: 'border-amber-500/20',
    gradientFrom: 'from-amber-600/10 dark:from-amber-600/10',
    gradientDotClass: 'bg-amber-400',
    radarBorder: 'border-amber-500',
    radarPing: 'border-amber-400/40',
    accentGroupHoverBg: 'group-hover:bg-amber-500/10',
    accentBgSolid: 'bg-amber-500',
    shadowColor: 'shadow-amber-500/20',
    selectionBgClass: 'selection:bg-amber-500/30',
    groupFocusTextClass: 'group-focus-within:text-amber-500'
  },
  {
    id: 'rose',
    name: { en: 'Rose Velvet', fr: 'Velours Rose' },
    color: 'rose',
    dotClass: 'bg-rose-500',
    accentClass: 'text-rose-500 dark:text-rose-400',
    accentHoverClass: 'group-hover:text-rose-500 dark:group-hover:text-rose-400 hover:text-rose-500 dark:hover:text-rose-400',
    accentBgClass: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20',
    accentBgLightClass: 'bg-rose-500/10 text-rose-500 dark:text-rose-400',
    focusRingClass: 'focus:ring-rose-500/30',
    borderAccentClass: 'border-rose-500/20',
    gradientFrom: 'from-rose-600/10 dark:from-rose-600/10',
    gradientDotClass: 'bg-rose-400',
    radarBorder: 'border-rose-500',
    radarPing: 'border-rose-400/40',
    accentGroupHoverBg: 'group-hover:bg-rose-500/10',
    accentBgSolid: 'bg-rose-500',
    shadowColor: 'shadow-rose-500/20',
    selectionBgClass: 'selection:bg-rose-500/30',
    groupFocusTextClass: 'group-focus-within:text-rose-500'
  },
  {
    id: 'cyan',
    name: { en: 'Nordic Frost', fr: 'Gel Nordique' },
    color: 'cyan',
    dotClass: 'bg-cyan-500',
    accentClass: 'text-cyan-500 dark:text-cyan-400',
    accentHoverClass: 'group-hover:text-cyan-500 dark:group-hover:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-400',
    accentBgClass: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20',
    accentBgLightClass: 'bg-cyan-500/10 text-cyan-500 dark:text-cyan-400',
    focusRingClass: 'focus:ring-cyan-500/30',
    borderAccentClass: 'border-cyan-500/20',
    gradientFrom: 'from-cyan-600/10 dark:from-cyan-600/10',
    gradientDotClass: 'bg-cyan-400',
    radarBorder: 'border-cyan-500',
    radarPing: 'border-cyan-400/40',
    accentGroupHoverBg: 'group-hover:bg-cyan-500/10',
    accentBgSolid: 'bg-cyan-500',
    shadowColor: 'shadow-cyan-500/20',
    selectionBgClass: 'selection:bg-cyan-500/30',
    groupFocusTextClass: 'group-focus-within:text-cyan-500'
  },
  {
    id: 'violet',
    name: { en: 'Aura Violet', fr: 'Aura Violette' },
    color: 'violet',
    dotClass: 'bg-violet-500',
    accentClass: 'text-violet-500 dark:text-violet-400',
    accentHoverClass: 'group-hover:text-violet-500 dark:group-hover:text-violet-400 hover:text-violet-500 dark:hover:text-violet-400',
    accentBgClass: 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/20',
    accentBgLightClass: 'bg-violet-500/10 text-violet-500 dark:text-violet-400',
    focusRingClass: 'focus:ring-violet-500/30',
    borderAccentClass: 'border-violet-500/20',
    gradientFrom: 'from-violet-600/10 dark:from-violet-600/10',
    gradientDotClass: 'bg-violet-400',
    radarBorder: 'border-violet-500',
    radarPing: 'border-violet-400/40',
    accentGroupHoverBg: 'group-hover:bg-violet-500/10',
    accentBgSolid: 'bg-violet-500',
    shadowColor: 'shadow-violet-500/20',
    selectionBgClass: 'selection:bg-violet-500/30',
    groupFocusTextClass: 'group-focus-within:text-violet-500'
  },
  {
    id: 'orange',
    name: { en: 'Volcanic Glow', fr: 'Éclat Volcanique' },
    color: 'orange',
    dotClass: 'bg-orange-500',
    accentClass: 'text-orange-500 dark:text-orange-400',
    accentHoverClass: 'group-hover:text-orange-500 dark:group-hover:text-orange-400 hover:text-orange-500 dark:hover:text-orange-400',
    accentBgClass: 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-500/20',
    accentBgLightClass: 'bg-orange-500/10 text-orange-500 dark:text-orange-400',
    focusRingClass: 'focus:ring-orange-500/30',
    borderAccentClass: 'border-orange-500/20',
    gradientFrom: 'from-orange-600/10 dark:from-orange-600/10',
    gradientDotClass: 'bg-orange-400',
    radarBorder: 'border-orange-500',
    radarPing: 'border-orange-400/40',
    accentGroupHoverBg: 'group-hover:bg-orange-500/10',
    accentBgSolid: 'bg-orange-500',
    shadowColor: 'shadow-orange-500/20',
    selectionBgClass: 'selection:bg-orange-500/30',
    groupFocusTextClass: 'group-focus-within:text-orange-500'
  }
];

const getThemeShadowColor = (themeId: string) => {
  switch (themeId) {
    case 'indigo': return 'rgba(99, 102, 241, 0.3)';
    case 'emerald': return 'rgba(16, 185, 129, 0.3)';
    case 'amber': return 'rgba(245, 158, 11, 0.3)';
    case 'rose': return 'rgba(244, 63, 94, 0.3)';
    case 'cyan': return 'rgba(6, 182, 212, 0.3)';
    case 'violet': return 'rgba(139, 92, 246, 0.3)';
    case 'orange': return 'rgba(249, 115, 22, 0.3)';
    default: return 'rgba(59, 130, 246, 0.3)';
  }
};

const getThemeHexColor = (themeId: string) => {
  switch (themeId) {
    case 'indigo': return '#6366f1';
    case 'emerald': return '#10b981';
    case 'amber': return '#f59e0b';
    case 'rose': return '#f43f5e';
    case 'cyan': return '#06b6d4';
    case 'violet': return '#8b5cf6';
    case 'orange': return '#f97316';
    default: return '#3b82f6';
  }
};

const getThemeRgbaColor = (themeId: string, opacity: number) => {
  switch (themeId) {
    case 'indigo': return `rgba(99, 102, 241, ${opacity})`;
    case 'emerald': return `rgba(16, 185, 129, ${opacity})`;
    case 'amber': return `rgba(245, 158, 11, ${opacity})`;
    case 'rose': return `rgba(244, 63, 94, ${opacity})`;
    case 'cyan': return `rgba(6, 182, 212, ${opacity})`;
    case 'violet': return `rgba(139, 92, 246, ${opacity})`;
    case 'orange': return `rgba(249, 115, 22, ${opacity})`;
    default: return `rgba(59, 130, 246, ${opacity})`;
  }
};

const getCompanionRgbaColor = (themeId: string, opacity: number) => {
  switch (themeId) {
    case 'classic': return `rgba(6, 182, 212, ${opacity})`;
    case 'indigo': return `rgba(139, 92, 246, ${opacity})`;
    case 'emerald': return `rgba(6, 182, 212, ${opacity})`;
    case 'amber': return `rgba(249, 115, 22, ${opacity})`;
    case 'rose': return `rgba(139, 92, 246, ${opacity})`;
    case 'cyan': return `rgba(59, 130, 246, ${opacity})`;
    case 'violet': return `rgba(244, 63, 94, ${opacity})`;
    case 'orange': return `rgba(239, 68, 68, ${opacity})`;
    default: return `rgba(96, 165, 250, ${opacity})`;
  }
};

const ThemeSelector = ({
  currentThemeId,
  onSelectThemeId,
  lang,
  t
}: {
  currentThemeId: string;
  onSelectThemeId: (id: string) => void;
  lang: 'en' | 'fr';
  t: any;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeTheme = THEMES.find(th => th.id === currentThemeId) || THEMES[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none flex items-center justify-center group"
        title={t.themeSelect || "Themes"}
      >
        <Palette size={18} className={`${activeTheme.accentClass} transition-colors group-hover:scale-110 duration-200`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-50 p-2 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5 mb-1">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {t.themeSelect || "Themes"}
              </span>
            </div>
            <div className="space-y-1 max-h-[240px] overflow-y-auto scrollbar-hide">
              {THEMES.map((theme) => {
                const isActive = theme.id === currentThemeId;
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      onSelectThemeId(theme.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? `${theme.accentBgLightClass} font-bold`
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-3 h-3 rounded-full ${theme.dotClass} shadow-sm`} />
                      <span>{lang === 'fr' ? theme.name.fr : theme.name.en}</span>
                    </div>
                    {isActive && <Check size={14} className={theme.accentClass} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FXIntensitySlider = ({
  intensity,
  onIntensityChange,
  activeTheme,
  t
}: {
  intensity: number;
  onIntensityChange: (value: number) => void;
  activeTheme: any;
  t: any;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none flex items-center justify-center group"
        title={t.fxIntensityLabel || "Effects Intensity"}
      >
        <Sliders size={18} className={`${activeTheme.accentClass} transition-colors group-hover:scale-110 duration-200`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-50 p-4"
          >
            <div className="flex flex-col gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {t.fxIntensityLabel}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  {t.fxIntensityDesc}
                </span>
              </div>
              
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={intensity}
                  onChange={(e) => onIntensityChange(Number(e.target.value))}
                  className={cn(
                    "w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-current bg-slate-200 dark:bg-slate-800",
                    activeTheme.accentClass
                  )}
                  style={{
                    color: getThemeHexColor(activeTheme.id)
                  }}
                />
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 min-w-[28px] text-right">
                  {intensity}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface WeatherMetadata {
  host?: string;
  radar: {
    past: Array<{ time: number; path: string; host?: string }>;
    nowcast: Array<{ time: number; path: string; host?: string }>;
  };
  satellite: {
    infrared: Array<{ time: number; path: string; host?: string }>;
  };
}

// --- Map & Weather Controller ---
const MapController = ({ 
  coords, 
  isGlobe, 
  metadata,
  mapType,
  showClouds,
  animationIndex,
  onMapReady
}: { 
  coords: { lat: number, lon: number }, 
  isGlobe: boolean,
  metadata: WeatherMetadata | null,
  mapType: 'satellite' | 'terrain' | 'roadmap',
  showClouds: boolean,
  animationIndex: number,
  onMapReady?: (map: google.maps.Map | null) => void
}) => {
  const map = useMap();

  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  // Handle center pan
  useEffect(() => {
    if (map && coords) {
      try {
        map.panTo({ lat: coords.lat, lng: coords.lon });
      } catch (e) {
        // ignore pan errors during rapid switches
      }
    }
  }, [map, coords]);

  // Handle map type changes smoothly on the map instance without unmounting
  // And auto-zoom in a bit more when switching to terrain or roadmap mode as requested
  useEffect(() => {
    if (!map) return;
    try {
      map.setMapTypeId(mapType);
      if ((mapType === 'terrain' || mapType === 'roadmap') && !isGlobe) {
        const currentZoom = map.getZoom();
        if (typeof currentZoom === 'number' && currentZoom <= 10) {
          map.setZoom(mapType === 'roadmap' ? 13 : 12);
        }
      }
    } catch (e) {
      console.warn("Failed to set mapTypeId or zoom:", e);
    }
  }, [map, mapType, isGlobe]);

  // Handle Projection and Layers synchronously to prevent crashes and ensure smooth tile animation
  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps) return;

    let isEffectMounted = true;
    const mapAny = map as any;

    const applyMapState = () => {
      if (!map || !isEffectMounted) return;

      try {
        const overlayMapTypes = map.overlayMapTypes;

        // 1. Set Projection - only for Vector maps with Map ID
        const isVectorMap = typeof map.getRenderingType === 'function' && map.getRenderingType() === 'VECTOR';
        if (isVectorMap && mapAny.setOptions) {
          try {
            mapAny.setOptions({ projection: isGlobe ? 'globe' : 'mercator' });
          } catch (e) {
            console.warn("Failed to set projection options", e);
          }
        }

        // 2. Add or update Layers
        if (overlayMapTypes) {
          // If in globe mode, no metadata, or user toggled clouds off, clear overlays completely
          if (isGlobe || !metadata || !showClouds) {
            if (overlayMapTypes.getLength() > 0) {
              overlayMapTypes.clear();
            }
            return;
          }

          const pastRadar = metadata.radar?.past || [];
          const infraredSat = metadata.satellite?.infrared || [];

          // If infrared satellite frames exist, prioritize infrared clouds; otherwise radar
          const useSatellite = (mapType === 'satellite' || infraredSat.length > 0) && infraredSat.length > 0;
          const sourceList = infraredSat.length > 0 ? infraredSat : pastRadar;

          if (sourceList.length > 0) {
            const idx = animationIndex % sourceList.length;
            const currentItem = sourceList[idx];

            if (currentItem && currentItem.path) {
              const host = currentItem.host || metadata.host || 'https://tilecache.rainviewer.com';
              let basePath = currentItem.path;
              if (!basePath.startsWith('/')) {
                basePath = `/${basePath}`;
              }

              // Color codes: 0 for satellite infrared (white/transparent clouds), 2 for universal radar precipitation
              const colorCode = useSatellite ? 0 : 2;
              const options = useSatellite ? '0_0' : '1_1';
              const fileExt = useSatellite ? 'png' : 'webp';

              const weatherLayer = new google.maps.ImageMapType({
                getTileUrl: (coord, zoom) => {
                  try {
                    // RainViewer radar/satellite tiles only exist up to zoom 12. Return null beyond to allow deep zooming without 404 errors
                    if (zoom > 12) return null;
                    const numTiles = 1 << zoom;
                    // Mercator latitude bounds check
                    if (coord.y < 0 || coord.y >= numTiles) return null;
                    const normalizedX = ((coord.x % numTiles) + numTiles) % numTiles;
                    return `${host}${basePath}/256/${zoom}/${normalizedX}/${coord.y}/${colorCode}/${options}.${fileExt}`;
                  } catch (e) {
                    return null;
                  }
                },
                tileSize: new google.maps.Size(256, 256),
                maxZoom: 12,
                opacity: useSatellite ? 0.75 : 0.65,
                name: useSatellite ? "Clouds" : "Radar"
              });

              if (overlayMapTypes.getLength() === 0) {
                overlayMapTypes.push(weatherLayer);
              } else {
                overlayMapTypes.setAt(0, weatherLayer);
              }
            }
          } else {
            if (overlayMapTypes.getLength() > 0) {
              overlayMapTypes.clear();
            }
          }
        }
      } catch (err) {
        console.warn("Map control inner error:", err);
      }
    };

    const idleListener = map.addListener('idle', applyMapState);
    applyMapState();

    return () => {
      isEffectMounted = false;
      if (idleListener) idleListener.remove();
    };
  }, [map, isGlobe, metadata, animationIndex, mapType, showClouds]);

  return null;
};

const MapContent = ({ weather, fetchWeather }: { weather: any, fetchWeather: any }) => {
  const map = useMap();
  const [isProjectionReady, setIsProjectionReady] = useState(false);

  useEffect(() => {
    if (!map) return;
    
    const checkProjection = () => {
      const proj = map.getProjection();
      if (proj && typeof (proj as any).fromLatLngToPoint === 'function') {
        setIsProjectionReady(true);
      } else {
        setIsProjectionReady(false);
      }
    };

    const listener = map.addListener('projection_changed', checkProjection);
    const idleListener = map.addListener('idle', checkProjection);
    checkProjection();

    return () => {
      if (listener) listener.remove();
      if (idleListener) idleListener.remove();
    };
  }, [map]);

  if (!isProjectionReady) return null;

  return (
    <AdvancedMarker
      position={{ lat: weather.coords.lat, lng: weather.coords.lon }}
      draggable={true}
      onDragEnd={(e: google.maps.MapMouseEvent) => {
        try {
          if (e && e.latLng) {
            const newPos = e.latLng;
            if (typeof newPos.lat === 'function' && typeof newPos.lng === 'function') {
              fetchWeather(newPos.lat(), newPos.lng(), weather.locationName);
            }
          }
        } catch (err) {
          console.error("AdvancedMarker drag error:", err);
        }
      }}
    >
      <Pin
        background="#3b82f6"
        borderColor="#1d4ed8"
        glyphColor="#ffffff"
        scale={1.1}
      />
    </AdvancedMarker>
  );
};

interface SkeletonProps {
  lang: 'fr' | 'en';
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  toggleLang: () => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  getUserLocation: () => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  handleSearch: (e: React.FormEvent) => void;
  handleRefresh: () => void;
  t: any;
  currentThemeId: string;
  onSelectThemeId: (id: string) => void;
  fxIntensity: number;
  onFxIntensityChange: (val: number) => void;
  tempUnit: 'C' | 'F';
  toggleTempUnit: () => void;
}

const WeatherDashboardSkeleton = ({
  lang,
  isDarkMode,
  toggleDarkMode,
  toggleLang,
  isFullscreen,
  toggleFullscreen,
  getUserLocation,
  searchQuery,
  setSearchQuery,
  handleSearch,
  handleRefresh,
  t,
  currentThemeId,
  onSelectThemeId,
  fxIntensity,
  onFxIntensityChange,
  tempUnit,
  toggleTempUnit
}: SkeletonProps) => {
  const activeTheme = THEMES.find(th => th.id === currentThemeId) || THEMES[0];

  const customBg = (() => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem('weather_custom_bg_v1');
    } catch (e) {
      return null;
    }
  })();

  const [bgBrightness, bgContrast, cardOpacity, cardBlur] = (() => {
    try {
      if (typeof window === 'undefined') return [100, 100, 50, 8];
      const brightness = localStorage.getItem('weather_bg_brightness');
      const contrast = localStorage.getItem('weather_bg_contrast');
      const opacity = localStorage.getItem('weather_card_opacity');
      const blur = localStorage.getItem('weather_card_blur');
      return [
        brightness ? Number(brightness) : 100,
        contrast ? Number(contrast) : 100,
        opacity ? Number(opacity) : 50,
        blur ? Number(blur) : 8
      ];
    } catch (e) {
      return [100, 100, 50, 8];
    }
  })();

  return (
    <div 
      className={cn(
        "min-h-screen font-sans text-slate-900 dark:text-white p-6 md:p-10 transition-all duration-500 relative", 
        !customBg && "bg-slate-50 dark:bg-slate-950",
        activeTheme.selectionBgClass
      )}
      style={{
        '--card-bg-color': isDarkMode 
          ? `rgba(15, 23, 42, ${cardOpacity / 100})` 
          : `rgba(255, 255, 255, ${cardOpacity / 100})`,
        '--card-blur': `${cardBlur}px`,
      } as React.CSSProperties}
    >
      {customBg && (
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${customBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            backgroundRepeat: 'no-repeat',
            filter: `brightness(${bgBrightness}%) contrast(${bgContrast}%)`
          }}
        />
      )}
      {customBg && (
        <div className="absolute inset-0 bg-slate-50/75 dark:bg-slate-950/80 backdrop-blur-[1.5px] pointer-events-none z-0" />
      )}
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Header Section */}
        <header id="header-skeleton" className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col space-y-2">
            {/* Pulsing Title Placeholder */}
            <div className="h-9 w-52 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
            {/* Date string skeleton */}
            <div className="h-4 w-36 bg-slate-200 dark:bg-white/5 rounded-lg animate-pulse" />
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <form onSubmit={handleSearch} className="relative flex-1 md:w-80 group">
              <Search className={cn("absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors", activeTheme.groupFocusTextClass)} size={16} />
              <input 
                type="text" 
                placeholder={t.searchPlaceholder}
                className={cn("w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full py-2.5 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-400 text-slate-900 dark:text-white shadow-sm dark:shadow-none", activeTheme.focusRingClass)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>

            <div className="flex items-center gap-2">
              <button 
                onClick={toggleDarkMode}
                className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none"
                title={isDarkMode ? t.lightMode : t.darkMode}
              >
                {isDarkMode ? <Sun size={18} className="text-yellow-500" /> : <Moon size={18} className="text-slate-400" />}
              </button>

              <button 
                onClick={getUserLocation}
                className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none"
                title={t.findMe}
              >
                <Navigation size={18} className="text-slate-400 animate-pulse" />
              </button>

              <button 
                onClick={handleRefresh}
                className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none"
                title={t.refresh}
              >
                <RefreshCw size={18} className="text-slate-400 animate-spin" style={{ animationDuration: '3s' }} />
              </button>

              <ThemeSelector 
                currentThemeId={currentThemeId} 
                onSelectThemeId={onSelectThemeId} 
                lang={lang} 
                t={t} 
              />

              <FXIntensitySlider 
                intensity={fxIntensity}
                onIntensityChange={onFxIntensityChange}
                activeTheme={activeTheme}
                t={t}
              />

              <button 
                onClick={toggleLang}
                className="px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2 text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400 shadow-sm dark:shadow-none"
                title="Change Language"
              >
                <Globe size={14} />
                <span>{lang.toUpperCase()}</span>
              </button>

              <button 
                onClick={toggleTempUnit}
                className="px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400 shadow-sm dark:shadow-none"
                title={lang === 'fr' ? "Changer l'unité de température" : "Change Temperature Unit"}
              >
                <Thermometer size={14} className={activeTheme.accentClass} />
                <span>°{tempUnit}</span>
              </button>

              <button 
                onClick={toggleFullscreen}
                className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize size={18} className="text-slate-400" /> : <Maximize size={18} className="text-slate-400" />}
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Grid Skeleton */}
        <div className="grid grid-cols-12 gap-8">
          
          {/* Left Grid: Hero + Hourly + Map */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            
            {/* Hero Card Skeleton */}
            <div className="bg-gradient-to-br from-slate-200/40 via-white dark:from-slate-900/40 dark:via-slate-950 to-transparent rounded-[2rem] border border-slate-200 dark:border-white/10 p-10 flex flex-col md:flex-row items-center justify-between shadow-xl relative overflow-hidden h-[260px]">
              <div className="flex flex-col space-y-4 w-full md:w-1/2">
                <div className="flex items-start">
                  <div className="h-20 w-32 bg-slate-200 dark:bg-white/10 rounded-2xl animate-pulse" />
                  <span className="text-2xl font-light text-slate-300 dark:text-slate-600 ml-2">°{tempUnit}</span>
                </div>
                <div className="h-8 w-44 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
                <div className="h-4 w-60 bg-slate-200 dark:bg-white/5 rounded-lg animate-pulse" />
              </div>
              <div className="w-40 h-40 bg-slate-200 dark:bg-white/10 rounded-full animate-pulse mr-4 mt-6 md:mt-0" />
            </div>

            {/* Hourly Forecast Skeleton */}
            <SleekCard className="p-8 space-y-8 cursor-default" style={{ transform: 'none' }} whileHover={{ y: 0, scale: 1 }}>
              <div className="flex justify-between items-center">
                <div className="h-4 w-36 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
                <div className="h-6 w-24 bg-slate-200 dark:bg-white/5 rounded-full animate-pulse" />
              </div>
              <div className="flex overflow-x-auto gap-12 pb-6 scrollbar-hide snap-x">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center min-w-[50px] gap-6 animate-pulse">
                    <div className="h-3 w-10 bg-slate-200 dark:bg-white/10 rounded" />
                    <div className="w-12 h-12 bg-slate-200 dark:bg-white/10 rounded-2xl" />
                    <div className="h-5 w-8 bg-slate-200 dark:bg-white/10 rounded-lg" />
                  </div>
                ))}
              </div>
            </SleekCard>

            {/* Satellite Map Skeleton */}
            <SleekCard className="h-[400px] p-6 relative overflow-hidden flex flex-col justify-between cursor-default" style={{ transform: 'none' }} whileHover={{ y: 0, scale: 1 }}>
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-40 bg-slate-200 dark:bg-white/5 rounded animate-pulse" />
                </div>
                <div className="h-20 w-32 bg-slate-200 dark:bg-white/10 rounded-xl animate-pulse" />
              </div>

              {/* Decorative radar pulses */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className={cn("w-48 h-48 rounded-full border border-dashed animate-pulse", activeTheme.radarBorder)} />
                <div className={cn("absolute w-72 h-72 rounded-full border border-dashed animate-ping", activeTheme.radarPing)} style={{ animationDuration: '4s' }} />
              </div>

              <div className="self-center flex flex-col items-center gap-3 z-10">
                <div className="h-8 w-32 bg-slate-200 dark:bg-white/10 rounded-full animate-pulse" />
                <div className="h-8 w-48 bg-slate-200 dark:bg-white/5 rounded-full animate-pulse" />
              </div>
            </SleekCard>

          </div>

          {/* Right Grid: Stats + Favorites + Weekly */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SleekCard key={i} className="p-4 aspect-square flex flex-col justify-between cursor-default rounded-2xl" style={{ transform: 'none' }} whileHover={{ y: 0, scale: 1 }}>
                  <div className="h-3 w-16 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
                  <div className="h-8 w-20 bg-slate-200 dark:bg-white/10 rounded-lg animate-pulse" />
                  <div className="h-3 w-24 bg-slate-200 dark:bg-white/5 rounded-pulse animate-pulse" />
                </SleekCard>
              ))}
            </div>

            {/* Favorites Card */}
            <SleekCard className="p-6 space-y-6 cursor-default" style={{ transform: 'none' }} whileHover={{ y: 0, scale: 1 }}>
              <div className="h-3 w-20 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
              <div className="space-y-4">
                <div className="h-4 w-3/4 bg-slate-200 dark:bg-white/5 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-slate-200 dark:bg-white/5 rounded animate-pulse" />
              </div>
            </SleekCard>

            {/* Weekly Forecast Card */}
            <SleekCard className="p-6 space-y-6 cursor-default" style={{ transform: 'none' }} whileHover={{ y: 0, scale: 1 }}>
              <div className="h-3 w-28 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
              <div className="space-y-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 last:border-0 pb-3 last:pb-0">
                    <div className="h-4 w-12 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
                    <div className="h-6 w-6 bg-slate-200 dark:bg-white/10 rounded-full animate-pulse" />
                    <div className="flex gap-3">
                      <div className="h-4 w-8 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
                      <div className="h-4 w-6 bg-slate-200 dark:bg-white/5 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </SleekCard>

          </div>

        </div>

        <footer className="text-center py-12 text-slate-400 dark:text-slate-700 text-[10px] font-bold uppercase tracking-[0.4em] border-t border-slate-200 dark:border-white/5">
          <p>{t.footer}</p>
        </footer>
      </div>
    </div>
  );
};

const StatDetailModal = ({
  id,
  weather,
  onClose,
  activeTheme,
  lang
}: {
  id: 'stat-humidity' | 'stat-wind' | 'stat-uv' | 'stat-vis';
  weather: WeatherData;
  onClose: () => void;
  activeTheme: any;
  lang: 'en' | 'fr';
}) => {
  const chartData = weather.hourly.map((h, idx) => {
    let value = 0;
    if (id === 'stat-humidity') {
      value = h.humidity !== undefined ? h.humidity : (weather.current.humidity + Math.sin(idx / 3) * 10);
    } else if (id === 'stat-wind') {
      value = h.windSpeed !== undefined ? h.windSpeed : (weather.current.windSpeed + Math.sin(idx / 2) * 4);
    } else if (id === 'stat-uv') {
      value = h.uvIndex !== undefined ? h.uvIndex : Math.max(0, Math.sin((idx - 6) / 4) * 8);
    } else if (id === 'stat-vis') {
      value = h.visibility !== undefined ? h.visibility : (24.1 + Math.cos(idx / 4) * 2);
    }
    value = Number(Math.max(0, value).toFixed(1));

    return {
      time: h.time,
      value
    };
  });

  const config = {
    'stat-humidity': {
      title: lang === 'fr' ? 'Humidité de l\'Air' : 'Air Humidity',
      unit: '%',
      icon: Droplets,
      desc: lang === 'fr' 
        ? 'L\'humidité relative indique la quantité de vapeur d\'eau présente dans l\'air par rapport au maximum possible à la même température.' 
        : 'Relative humidity indicates the amount of water vapor in the air compared to the maximum possible at that temperature.',
      advice: lang === 'fr'
        ? 'Une humidité confortable se situe généralement entre 30% et 60%.'
        : 'A comfortable indoor relative humidity is generally between 30% and 60%.'
    },
    'stat-wind': {
      title: lang === 'fr' ? 'Vitesse du Vent' : 'Wind Speed',
      unit: 'km/h',
      icon: Wind,
      desc: lang === 'fr' 
        ? 'La vitesse du vent à 10 mètres de haut. Utile pour suivre l\'approche de perturbations atmosphériques et l\'indice de refroidissement éolien.' 
        : 'Wind speed measured at 10 meters above the surface. Helpful for tracking atmospheric disturbances and wind chill index values.',
      advice: lang === 'fr'
        ? 'Des vents calmes inférieurs à 15 km/h sont idéaux pour les activités extérieures.'
        : 'Gentle winds below 15 km/h are ideal for outdoor leisure activities.'
    },
    'stat-uv': {
      title: lang === 'fr' ? 'Indice Ultraviolet' : 'Ultraviolet Index',
      unit: 'UV',
      icon: Sun,
      desc: lang === 'fr' 
        ? 'L\'indice UV mesure l\'intensité du rayonnement ultraviolet solaire atteignant la Terre. Indispensable pour estimer les risques d\'exposition.' 
        : 'The UV index is an international standard measurement of the strength of sunburn-producing ultraviolet radiation at a particular place and time.',
      advice: lang === 'fr'
        ? 'Un indice UV supérieur à 3 requiert une protection solaire (crème, lunettes, chapeau).'
        : 'A UV index of 3 or higher recommends sun protection (sunscreen, sunglasses, hat).'
    },
    'stat-vis': {
      title: lang === 'fr' ? 'Distance de Visibilité' : 'Visibility Distance',
      unit: 'km',
      icon: Eye,
      desc: lang === 'fr' 
        ? 'La distance maximale à laquelle un observateur peut distinguer clairement un objet. Une faible visibilité peut indiquer du brouillard ou de fortes précipitations.' 
        : 'The maximum distance at which objects can be clearly identified. Low visibility might indicate thick fog, dust storms, or heavy rainfall.',
      advice: lang === 'fr'
        ? 'Une visibilité supérieure à 10 km est considérée comme excellente pour les déplacements et transports.'
        : 'Visibility greater than 10 km is considered excellent for safe travel and transit.'
    }
  }[id];

  const values = chartData.map(d => d.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const avgVal = Number((values.reduce((acc, v) => acc + v, 0) / values.length).toFixed(1));
  
  let currentVal = 0;
  if (id === 'stat-humidity') {
    currentVal = weather.current.humidity;
  } else if (id === 'stat-wind') {
    currentVal = weather.current.windSpeed;
  } else if (id === 'stat-uv') {
    currentVal = weather.current.uvIndex !== undefined ? weather.current.uvIndex : 4.0;
  } else if (id === 'stat-vis') {
    currentVal = weather.current.visibility !== undefined ? weather.current.visibility : 24.1;
  }

  const IconComponent = config.icon;
  const hexColor = getThemeHexColor(activeTheme.id);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
      />

      {/* Content Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
        className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-200/50 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-2xl", activeTheme.accentBgLightClass)}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{config.title}</h2>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {lang === 'fr' ? 'Historique des dernières 24h' : 'Last 24h History'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto scrollbar-hide">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl p-3 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {lang === 'fr' ? 'Actuel' : 'Current'}
              </span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                {currentVal}{config.unit}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl p-3 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {lang === 'fr' ? 'Maximum' : 'Maximum'}
              </span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                {maxVal}{config.unit}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl p-3 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {lang === 'fr' ? 'Minimum' : 'Minimum'}
              </span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                {minVal}{config.unit}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl p-3 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {lang === 'fr' ? 'Moyenne' : 'Average'}
              </span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                {avgVal}{config.unit}
              </span>
            </div>
          </div>

          {/* Recharts Chart Area */}
          <div className="h-64 w-full bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-white/5 rounded-2xl p-4 flex flex-col justify-between">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={`modalGradient-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={hexColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={hexColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.1)" />
                <XAxis 
                  dataKey="time" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                  dx={-5}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-200 dark:border-white/10 p-2.5 rounded-xl shadow-xl flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{data.time}</span>
                          <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5">{data.value} {config.unit}</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={hexColor}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={`url(#modalGradient-${id})`}
                  activeDot={{ r: 5, strokeWidth: 0, fill: hexColor }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Description / Advice */}
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              {config.desc}
            </p>
            <div className={cn("p-4 rounded-2xl border flex items-start gap-3", activeTheme.borderAccentClass, activeTheme.accentBgLightClass)}>
              <div className="mt-0.5">
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5">
                  {lang === 'fr' ? 'Conseil du jour' : 'Daily Insight'}
                </span>
                <p className="text-xs font-semibold leading-relaxed">
                  {config.advice}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const getUvLevelDesc = (uv: number, lang: 'en' | 'fr') => {
  if (uv <= 2) return lang === 'fr' ? 'Faible' : 'Low';
  if (uv <= 5) return lang === 'fr' ? 'Modéré' : 'Moderate';
  if (uv <= 7) return lang === 'fr' ? 'Élevé' : 'High';
  if (uv <= 10) return lang === 'fr' ? 'Très élevé' : 'Very High';
  return lang === 'fr' ? 'Extrême' : 'Extreme';
};

const getVisLevelDesc = (vis: number, lang: 'en' | 'fr') => {
  if (vis >= 10) return lang === 'fr' ? 'Excellente' : 'Excellent';
  if (vis >= 5) return lang === 'fr' ? 'Moyenne' : 'Moderate';
  return lang === 'fr' ? 'Faible' : 'Poor';
};

const WeatherAlertsModal = ({
  alerts,
  onClose,
  lang,
  activeTheme
}: {
  alerts: WeatherAlert[];
  onClose: () => void;
  lang: 'en' | 'fr';
  activeTheme: any;
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
      />

      {/* Content Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
        className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10 flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 text-red-500 rounded-xl animate-pulse">
              <AlertCircle size={20} className="fill-red-500/20" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {lang === 'fr' ? "Alertes de Sécurité Actives" : "Active Safety Alerts"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {alerts.length} {lang === 'fr' ? "notification(s) de vigilance" : "active vigilance warning(s)"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Alerts List */}
        <div className="p-6 overflow-y-auto space-y-4 max-h-[60vh] scrollbar-hide">
          {alerts.map((alert) => (
            <div 
              key={alert.id}
              className={cn(
                "p-5 rounded-2xl border flex flex-col gap-3 transition-colors",
                alert.type === 'danger'
                  ? "bg-red-500/5 dark:bg-red-500/[0.02] border-red-500/20"
                  : alert.type === 'warning'
                    ? "bg-amber-500/5 dark:bg-amber-500/[0.02] border-amber-500/20"
                    : "bg-blue-500/5 dark:bg-blue-500/[0.02] border-blue-500/20"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full",
                  alert.type === 'danger'
                    ? "bg-red-500 text-white"
                    : alert.type === 'warning'
                      ? "bg-amber-500 text-slate-950"
                      : "bg-blue-500 text-white"
                )}>
                  {alert.severity}
                </span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  #{alert.id}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{alert.title}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-1.5 leading-relaxed">
                  {alert.description}
                </p>
              </div>

              {/* Safety tips / Guidelines */}
              <div className="bg-slate-100/50 dark:bg-white/[0.03] p-3.5 rounded-xl border border-slate-200/50 dark:border-white/5">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <span className={alert.type === 'danger' ? "text-red-500" : alert.type === 'warning' ? "text-amber-500" : "text-blue-500"}>●</span>
                  <span>{lang === 'fr' ? "Consigne de Sécurité" : "Safety Guideline"}</span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal italic font-medium">
                  {alert.guideline}
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [metadata, setMetadata] = useState<WeatherMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lang, setLang] = useState<'fr' | 'en'>(() => {
    try {
      if (typeof window === 'undefined') return 'fr';
      const saved = localStorage.getItem('weather_lang');
      return (saved === 'fr' || saved === 'en') ? saved : 'fr';
    } catch (e) {
      return 'fr';
    }
  });
  // Google Maps JS API script cannot be reloaded with different URL parameters (such as language)
  // dynamically without triggering a console warning. We freeze the APIProvider language to the initial value.
  const [mapsInitialLang] = useState(lang);
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>(() => {
    try {
      if (typeof window === 'undefined') return 'C';
      const saved = localStorage.getItem('weather_temp_unit');
      return (saved === 'C' || saved === 'F') ? saved : 'C';
    } catch (e) {
      return 'C';
    }
  });

  const toggleTempUnit = () => {
    setTempUnit(prev => {
      const next = prev === 'C' ? 'F' : 'C';
      try {
        localStorage.setItem('weather_temp_unit', next);
      } catch (e) {
        console.warn("Failed to save temp unit", e);
      }
      return next;
    });
  };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapType, setMapType] = useState<'satellite' | 'terrain' | 'roadmap'>('satellite');
  const [isGlobe, setIsGlobe] = useState(false);
  const [showClouds, setShowClouds] = useState(true);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(true);

  const handleZoomIn = () => {
    if (!mapInstance) return;
    const curr = mapInstance.getZoom() || 10;
    const max = mapType === 'terrain' ? 20 : 22;
    if (curr < max) {
      mapInstance.setZoom(curr + 1);
    }
  };

  const handleZoomOut = () => {
    if (!mapInstance) return;
    const curr = mapInstance.getZoom() || 10;
    if (curr > 2) {
      mapInstance.setZoom(curr - 1);
    }
  };

  const activeTimelineFrames = React.useMemo(() => {
    if (!metadata) return [];
    const hasInfrared = (metadata.satellite?.infrared?.length || 0) > 0;
    const hasRadar = (metadata.radar?.past?.length || 0) > 0;
    if (hasInfrared) return metadata.satellite.infrared;
    if (hasRadar) return metadata.radar.past;
    return [];
  }, [metadata]);

  // Keep timelineIndex bounded when frames change
  useEffect(() => {
    if (activeTimelineFrames.length > 0 && timelineIndex >= activeTimelineFrames.length) {
      setTimelineIndex(activeTimelineFrames.length - 1);
    }
  }, [activeTimelineFrames.length, timelineIndex]);

  // Reset timelineIndex to start when mapType changes
  useEffect(() => {
    setTimelineIndex(0);
  }, [mapType]);

  // Animation interval for timeline playback
  useEffect(() => {
    if (!isPlayingTimeline || activeTimelineFrames.length === 0) return;

    const interval = setInterval(() => {
      setTimelineIndex((prev) => (prev + 1) % activeTimelineFrames.length);
    }, 1200);

    return () => clearInterval(interval);
  }, [isPlayingTimeline, activeTimelineFrames.length]);

  const activeTimelineFrame = activeTimelineFrames[timelineIndex];

  const frameTimeFormatted = React.useMemo(() => {
    if (!activeTimelineFrame?.time) return '--:--';
    const d = new Date(activeTimelineFrame.time * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [activeTimelineFrame?.time]);

  const relativeTimeFormatted = React.useMemo(() => {
    if (!activeTimelineFrames.length || !activeTimelineFrame?.time) return '';
    const latestTime = activeTimelineFrames[activeTimelineFrames.length - 1]?.time;
    if (!latestTime) return '';
    const diffSec = latestTime - activeTimelineFrame.time;
    if (diffSec <= 60) return lang === 'fr' ? 'EN DIRECT' : 'LIVE';
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `-${diffMin} min`;
    const hours = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    return remMin > 0 ? `-${hours}h ${remMin}m` : `-${hours}h`;
  }, [activeTimelineFrames, activeTimelineFrame?.time, lang]);
  const [hoveredStatId, setHoveredStatId] = useState<string | null>(null);
  const [selectedStatId, setSelectedStatId] = useState<'stat-humidity' | 'stat-wind' | 'stat-uv' | 'stat-vis' | null>(null);
  const [simulateAlert, setSimulateAlert] = useState<boolean>(false);
  const [showAlertsModal, setShowAlertsModal] = useState<boolean>(false);
  const [activeThemeId, setActiveThemeId] = useState(() => {
    try {
      if (typeof window === 'undefined') return 'classic';
      const saved = localStorage.getItem('weather_app_theme_id');
      return saved || 'classic';
    } catch (e) {
      return 'classic';
    }
  });

  const activeTheme = THEMES.find(t => t.id === activeThemeId) || THEMES[0];
  const activeAlerts = getWeatherAlerts(weather, lang, simulateAlert);

  const handleSetThemeId = (id: string) => {
    setActiveThemeId(id);
    try {
      localStorage.setItem('weather_app_theme_id', id);
    } catch (e) {
      console.warn("Failed to save theme setting", e);
    }
  };

  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      if (typeof window === 'undefined') return false;
      const saved = localStorage.getItem('weather_theme');
      if (saved) return saved === 'dark';
      if (window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch (e) {
      console.warn("Storage or Media access denied", e);
    }
    return false;
  });

  const [fxIntensity, setFxIntensity] = useState(() => {
    try {
      if (typeof window === 'undefined') return 50;
      const saved = localStorage.getItem('weather_app_fx_intensity');
      return saved ? parseInt(saved, 10) : 50;
    } catch (e) {
      return 50;
    }
  });

  const handleSetFxIntensity = (val: number) => {
    setFxIntensity(val);
    try {
      localStorage.setItem('weather_app_fx_intensity', val.toString());
    } catch (e) {
      console.warn("Failed to save FX intensity", e);
    }
  };

  const [favorites, setFavorites] = useState<{ name: string; lat: number; lon: number }[]>([]);

  const [customBg, setCustomBg] = useState<string | null>(() => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem('weather_custom_bg_v1');
    } catch (e) {
      return null;
    }
  });

  const [bgBrightness, setBgBrightness] = useState<number>(() => {
    try {
      if (typeof window === 'undefined') return 100;
      const saved = localStorage.getItem('weather_bg_brightness');
      return saved ? Number(saved) : 100;
    } catch (e) {
      return 100;
    }
  });

  const [bgContrast, setBgContrast] = useState<number>(() => {
    try {
      if (typeof window === 'undefined') return 100;
      const saved = localStorage.getItem('weather_bg_contrast');
      return saved ? Number(saved) : 100;
    } catch (e) {
      return 100;
    }
  });

  const [cardOpacity, setCardOpacity] = useState<number>(() => {
    try {
      if (typeof window === 'undefined') return 50;
      const saved = localStorage.getItem('weather_card_opacity');
      return saved ? Number(saved) : 50;
    } catch (e) {
      return 50;
    }
  });

  const [cardBlur, setCardBlur] = useState<number>(() => {
    try {
      if (typeof window === 'undefined') return 8;
      const saved = localStorage.getItem('weather_card_blur');
      return saved ? Number(saved) : 8;
    } catch (e) {
      return 8;
    }
  });

  const handleBgBrightnessChange = (val: number) => {
    setBgBrightness(val);
    try {
      localStorage.setItem('weather_bg_brightness', String(val));
    } catch (e) {}
  };

  const handleBgContrastChange = (val: number) => {
    setBgContrast(val);
    try {
      localStorage.setItem('weather_bg_contrast', String(val));
    } catch (e) {}
  };

  const handleCardOpacityChange = (val: number) => {
    setCardOpacity(val);
    try {
      localStorage.setItem('weather_card_opacity', String(val));
    } catch (e) {}
  };

  const handleCardBlurChange = (val: number) => {
    setCardBlur(val);
    try {
      localStorage.setItem('weather_card_blur', String(val));
    } catch (e) {}
  };

  const handleCustomBgChange = (bgUrl: string | null) => {
    setCustomBg(bgUrl);
    try {
      if (bgUrl) {
        localStorage.setItem('weather_custom_bg_v1', bgUrl);
      } else {
        localStorage.removeItem('weather_custom_bg_v1');
      }
    } catch (e) {
      console.warn("Failed to persist custom background", e);
    }
  };

  const transformedHourly = React.useMemo(() => {
    if (!weather) return [];
    return weather.hourly.map(h => ({
      ...h,
      temp: tempUnit === 'C' ? h.temp : Math.round(h.temp * 1.8 + 32)
    }));
  }, [weather, tempUnit]);

  const hourlyChartContainerRef = React.useRef<HTMLDivElement>(null);
  const [hourlyChartWidth, setHourlyChartWidth] = useState<number>(0);

  useEffect(() => {
    const el = hourlyChartContainerRef.current;
    if (!el) return;

    const handleResize = () => {
      if (hourlyChartContainerRef.current) {
        setHourlyChartWidth(hourlyChartContainerRef.current.clientWidth);
      }
    };

    handleResize();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect?.width) {
          setHourlyChartWidth(Math.round(entry.contentRect.width));
        }
      }
    });

    observer.observe(el);
    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [weather]);

  const hourlyChartConfig = React.useMemo(() => {
    const w = hourlyChartWidth || 600;

    // Dynamically scale font size between 9px and 13px based on container width
    const fontSize = w < 360 ? 9 : w < 500 ? 10 : w < 720 ? 11 : 12;

    // Dynamically scale interval of hours to show on the X axis to avoid overcrowding
    const interval = w < 360 ? 4 : w < 520 ? 3 : w < 720 ? 2 : 1;

    // Dynamically scale chart margins to maximize space while keeping labels visible
    const margin = w < 420 
      ? { top: 16, right: 8, left: -22, bottom: 0 }
      : w < 680
      ? { top: 20, right: 12, left: -16, bottom: 0 }
      : { top: 24, right: 16, left: -10, bottom: 0 };

    // Dynamic active dot size
    const dotRadius = w < 480 ? 4 : 6;

    return {
      fontSize,
      interval,
      margin,
      dotRadius,
      yAxisWidth: fontSize * 2.8,
    };
  }, [hourlyChartWidth]);

  const t = translations[lang];

  useEffect(() => {
    const root = window.document.documentElement;
    try {
      if (isDarkMode) {
        root.classList.add('dark');
        localStorage.setItem('weather_theme', 'dark');
      } else {
        root.classList.remove('dark');
        localStorage.setItem('weather_theme', 'light');
      }
    } catch (e) {
      console.warn("Storage write denied", e);
    }
  }, [isDarkMode]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('weather_favorites');
      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to parse favorites", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('weather_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.warn("Storage write denied for favorites", e);
    }
  }, [favorites]);

  useEffect(() => {
    let isMounted = true;
    const fetchMetadata = async () => {
      try {
        let rainviewerData: any = null;
        try {
          const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
          if (response.ok) {
            rainviewerData = await response.json();
          }
        } catch (err) {
          console.warn('Rainviewer API error:', err);
        }

        const rvHost = rainviewerData?.host || 'https://tilecache.rainviewer.com';
        const pastRadar = (rainviewerData?.radar?.past || []).map((item: any) => ({
          ...item,
          host: rvHost
        }));
        const nowcastRadar = (rainviewerData?.radar?.nowcast || []).map((item: any) => ({
          ...item,
          host: rvHost
        }));

        let satelliteInfrared = (rainviewerData?.satellite?.infrared || []).map((item: any) => ({
          ...item,
          host: rvHost
        }));

        // If RainViewer public API has no satellite infrared frames, load from LibreWXR
        if (satelliteInfrared.length === 0) {
          try {
            const satResponse = await fetch('https://api.librewxr.net/public/weather-maps.json');
            if (satResponse.ok) {
              const satData = await satResponse.json();
              if (satData.satellite?.infrared?.length > 0) {
                satelliteInfrared = satData.satellite.infrared.map((item: any) => ({
                  ...item,
                  host: satData.host || 'https://api.librewxr.net'
                }));
              }
            }
          } catch (satErr) {
            console.warn('Satellite fallback error:', satErr);
          }
        }

        const combined: WeatherMetadata = {
          host: rvHost,
          radar: {
            past: pastRadar,
            nowcast: nowcastRadar
          },
          satellite: {
            infrared: satelliteInfrared
          }
        };

        if (isMounted) setMetadata(combined);
      } catch (e) {
        console.warn("Failed to load map metadata:", e);
      }
    };

    fetchMetadata();
    const interval = setInterval(fetchMetadata, 300000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const toggleFavorite = () => {
    if (!weather) return;
    const isFav = favorites.some(f => f.name === weather.locationName);
    if (isFav) {
      setFavorites(prev => prev.filter(f => f.name !== weather.locationName));
    } else {
      setFavorites(prev => [
        ...prev, 
        { name: weather.locationName, lat: weather.coords.lat, lon: weather.coords.lon }
      ]);
    }
  };

  const removeFavorite = (name: string) => {
    setFavorites(prev => prev.filter(f => f.name !== name));
  };

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        const docElem = document.documentElement as any;
        const requestFs = docElem.requestFullscreen || docElem.mozRequestFullScreen || docElem.webkitRequestFullscreen || docElem.msRequestFullscreen;
        if (requestFs) {
          requestFs.call(docElem).catch((err: any) => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
          });
          setIsFullscreen(true);
        }
      } else {
        const exitFs = (document as any).exitFullscreen || (document as any).mozCancelFullScreen || (document as any).webkitExitFullscreen || (document as any).msExitFullscreen;
        if (exitFs) {
          exitFs.call(document);
          setIsFullscreen(false);
        }
      }
    } catch (e) {
      console.error("Fullscreen toggle failed", e);
    }
  };

  const toggleLang = () => {
    setLang(prev => {
      const next = prev === 'fr' ? 'en' : 'fr';
      try {
        localStorage.setItem('weather_lang', next);
      } catch (e) {
        console.warn("Failed to save language preference", e);
      }
      return next;
    });
  };

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  // Resilient fallback weather generator if Open-Meteo API is unreachable or returns 500 error
  const createEmergencyWeatherData = (lat: number, lon: number, locationName: string, currentLang: 'fr' | 'en'): WeatherData => {
    const now = new Date();
    const currentHour = now.getHours();
    const isDay = currentHour >= 6 && currentHour < 20;
    const baseTemp = 18;

    const hourly = Array.from({ length: 24 }, (_, i) => {
      const hourDate = new Date(now.getTime() + i * 3600000);
      const hourVal = hourDate.getHours();
      const tempVariation = Math.sin((hourVal - 6) / 24 * 2 * Math.PI) * 4;
      const timeStr = hourDate.toLocaleTimeString(currentLang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit' });
      return {
        time: timeStr,
        temp: Math.round(baseTemp + tempVariation),
        weatherCode: 1,
        humidity: Math.round(55 + Math.cos(i / 3) * 12),
        windSpeed: Math.round(12 + Math.sin(i / 2) * 4),
        uvIndex: (hourVal >= 10 && hourVal <= 16) ? 4.2 : 0.5,
        visibility: 24.1,
      };
    });

    const daily = Array.from({ length: 7 }, (_, i) => {
      const dayDate = new Date(now.getTime() + i * 86400000);
      const dayName = currentLang === 'fr'
        ? (["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"][dayDate.getDay()])
        : dayDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      return {
        date: dayName,
        tempMax: baseTemp + 4 + (i % 3),
        tempMin: baseTemp - 3 - (i % 2),
        weatherCode: i % 4 === 2 ? 61 : (i % 2 === 0 ? 0 : 2),
      };
    });

    return {
      current: {
        temp: baseTemp,
        feelsLike: baseTemp - 1,
        humidity: 60,
        windSpeed: 12,
        weatherCode: 1,
        isDay,
        uvIndex: isDay ? 4.0 : 0,
        visibility: 24.1,
      },
      hourly,
      daily,
      locationName,
      coords: { lat, lon },
    };
  };

  const saveWeatherToCache = (data: WeatherData) => {
    try {
      const key = `weather_cache_${data.coords.lat.toFixed(2)}_${data.coords.lon.toFixed(2)}`;
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem('weather_cache_last', JSON.stringify(data));
    } catch (e) {
      console.warn("Could not cache weather data:", e);
    }
  };

  const getWeatherFromCache = (lat: number, lon: number): WeatherData | null => {
    try {
      const key = `weather_cache_${lat.toFixed(2)}_${lon.toFixed(2)}`;
      const saved = localStorage.getItem(key) || localStorage.getItem('weather_cache_last');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.current && Array.isArray(parsed.hourly) && Array.isArray(parsed.daily)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not read weather cache:", e);
    }
    return null;
  };

  const fetchWeather = async (lat: number, lon: number, name?: string) => {
    const safeLat = Number.isFinite(lat) ? Number(lat.toFixed(4)) : 47.3719;
    const safeLon = Number.isFinite(lon) ? Number(lon.toFixed(4)) : -68.3241;
    const resolvedName = name || (lang === 'fr' ? "🇨🇦 Edmundston, Nouveau-Brunswick" : "🇨🇦 Edmundston, New Brunswick");

    try {
      setLoading(true);
      setError(null);

      // Primary comprehensive query
      const primaryUrl = `https://api.open-meteo.com/v1/forecast?latitude=${safeLat}&longitude=${safeLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,uv_index,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
      
      // Fallback simplified query (omits uv_index, visibility, and timezone=auto which can cause 500 when upstream Open-Meteo models experience disruptions)
      const fallbackUrl = `https://api.open-meteo.com/v1/forecast?latitude=${safeLat}&longitude=${safeLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min`;

      const executeRequest = async (targetUrl: string) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(targetUrl, { signal: controller.signal });
          clearTimeout(timeout);
          const rawText = await response.text();

          let json: any = null;
          try {
            json = JSON.parse(rawText);
          } catch {
            // Guard against HTML error pages (e.g. 500/502 from reverse proxy or cloudflare)
            throw new Error(`${t.errorFetch}: ${response.status || 500}`);
          }

          if (!response.ok) {
            throw new Error(json?.reason || `${t.errorFetch}: ${response.status}`);
          }

          return json;
        } catch (err: any) {
          clearTimeout(timeout);
          throw err;
        }
      };

      let data: any = null;
      try {
        data = await executeRequest(primaryUrl);
      } catch (primaryErr: any) {
        console.warn("Primary weather API request failed, retrying with fallback endpoint:", primaryErr?.message);
        // Small delay before retry
        await new Promise(r => setTimeout(r, 600));
        data = await executeRequest(fallbackUrl);
      }

      if (!data || !data.current) {
        throw new Error(t.errorFetch);
      }

      const currentIdx = data.hourly?.time ? data.hourly.time.indexOf(data.current.time) : -1;
      const resolvedIdx = currentIdx !== -1 ? currentIdx : 0;

      const hourlyList = Array.isArray(data.hourly?.time) ? data.hourly.time.slice(0, 24) : [];
      const dailyList = Array.isArray(data.daily?.time) ? data.daily.time.slice(0, 7) : [];

      const weatherData: WeatherData = {
        current: {
          temp: Math.round(data.current.temperature_2m ?? 20),
          feelsLike: Math.round(data.current.apparent_temperature ?? data.current.temperature_2m ?? 20),
          humidity: data.current.relative_humidity_2m ?? 60,
          windSpeed: Math.round(data.current.wind_speed_10m ?? 10),
          weatherCode: data.current.weather_code ?? 0,
          isDay: data.current.is_day === 1,
          uvIndex: data.hourly?.uv_index ? data.hourly.uv_index[resolvedIdx] : undefined,
          visibility: data.hourly?.visibility ? Number((data.hourly.visibility[resolvedIdx] / 1000).toFixed(1)) : undefined,
        },
        hourly: hourlyList.map((time: string, i: number) => {
          const d = new Date(time);
          const timeStr = isNaN(d.getTime()) 
            ? "??:??" 
            : d.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit' });
          return {
            time: timeStr,
            temp: Math.round(data.hourly.temperature_2m?.[i] ?? 20),
            weatherCode: data.hourly.weather_code?.[i] ?? 0,
            humidity: data.hourly.relative_humidity_2m ? Math.round(data.hourly.relative_humidity_2m[i]) : undefined,
            windSpeed: data.hourly.wind_speed_10m ? Math.round(data.hourly.wind_speed_10m[i]) : undefined,
            uvIndex: data.hourly.uv_index ? data.hourly.uv_index[i] : undefined,
            visibility: data.hourly.visibility ? Number((data.hourly.visibility[i] / 1000).toFixed(1)) : undefined,
          };
        }),
        daily: dailyList.map((date: string, i: number) => {
          const d = new Date(date);
          const isValid = !isNaN(d.getTime());
          
          let dayName = "???";
          if (isValid) {
            dayName = lang === 'fr' 
              ? (t.weekdays[d.getDay()] || "???").substring(0, 3).toUpperCase()
              : d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
          }

          return {
            date: dayName,
            tempMax: Math.round(data.daily.temperature_2m_max?.[i] ?? 22),
            tempMin: Math.round(data.daily.temperature_2m_min?.[i] ?? 12),
            weatherCode: data.daily.weather_code?.[i] ?? 0,
          };
        }),
        locationName: resolvedName,
        coords: { lat: safeLat, lon: safeLon },
      };

      setWeather(weatherData);
      saveWeatherToCache(weatherData);
    } catch (err) {
      console.warn("Weather fetch encountered an issue, restoring cache or fallback:", err);

      // Attempt recovery from localStorage cache first
      const cached = getWeatherFromCache(safeLat, safeLon);
      if (cached) {
        setWeather({
          ...cached,
          locationName: resolvedName || cached.locationName
        });
        setError(lang === 'fr' 
          ? "Serveur météo temporairement indisponible (500). Données récentes restaurées."
          : "Weather server temporarily unavailable (500). Restored recent cached data."
        );
      } else {
        // Construct emergency realistic weather data so the UI remains 100% stable and fully interactive
        const fallbackData = createEmergencyWeatherData(safeLat, safeLon, resolvedName, lang);
        setWeather(fallbackData);
        setError(lang === 'fr'
          ? "Serveur météo temporairement indisponible (500). Mode estimation actif."
          : "Weather server temporarily unavailable (500). Estimated mode active."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    try {
      if (!navigator || !navigator.geolocation) {
        fetchWeather(47.3719, -68.3241);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos && pos.coords && Number.isFinite(pos.coords.latitude) && Number.isFinite(pos.coords.longitude)) {
            fetchWeather(Number(pos.coords.latitude.toFixed(4)), Number(pos.coords.longitude.toFixed(4)));
          } else {
            fetchWeather(47.3719, -68.3241);
          }
        },
        (err) => {
          console.warn("Geolocation denied or failed:", err);
          fetchWeather(47.3719, -68.3241);
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    } catch (e) {
      console.warn("Geolocation access error:", e);
      fetchWeather(47.3719, -68.3241);
    }
  };

  const handleRefresh = () => {
    if (weather && weather.coords) {
      fetchWeather(weather.coords.lat, weather.coords.lon, weather.locationName);
    } else {
      getUserLocation();
    }
  };

  useEffect(() => {
    if (weather) {
      let name = weather.locationName;
      if (name === "🇨🇦 Edmundston, Nouveau-Brunswick" || name === "🇨🇦 Edmundston, New Brunswick") {
        name = lang === 'fr' ? "🇨🇦 Edmundston, Nouveau-Brunswick" : "🇨🇦 Edmundston, New Brunswick";
      }
      fetchWeather(weather.coords.lat, weather.coords.lon, name);
    }
  }, [lang]);

  useEffect(() => {
    getUserLocation();
    
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=1&language=${lang}&format=json`;
      const res = await fetch(geoUrl);
      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(t.errorNotFound);
      }
      
      if (res.ok && data?.results && data.results.length > 0) {
        const result = data.results[0];
        fetchWeather(result.latitude, result.longitude, result.name);
      } else {
        setError(t.errorNotFound);
        setLoading(false);
      }
    } catch (err) {
      setError(t.errorNotFound);
      setLoading(false);
    }
  };

  if (!weather) {
    return (
      <WeatherDashboardSkeleton 
        lang={lang} 
        isDarkMode={isDarkMode} 
        toggleDarkMode={toggleDarkMode}
        toggleLang={toggleLang}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        getUserLocation={getUserLocation}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearch={handleSearch}
        handleRefresh={handleRefresh}
        t={t}
        currentThemeId={activeThemeId}
        onSelectThemeId={handleSetThemeId}
        fxIntensity={fxIntensity}
        onFxIntensityChange={handleSetFxIntensity}
        tempUnit={tempUnit}
        toggleTempUnit={toggleTempUnit}
      />
    );
  }

  const now = new Date();
  const dateStr = (t && t.weekdays && t.months) 
    ? (lang === 'fr' 
        ? `${t.weekdays[now.getDay()]} ${now.getDate()} ${t.months[now.getMonth()]}`
        : now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }))
    : now.toDateString();

  if (!hasValidMapsKey) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-white font-sans p-6 transition-colors duration-300">
        <SleekCard className="max-w-2xl w-full text-center space-y-6 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-xl p-8">
          <Layers size={48} className="mx-auto text-blue-500 mb-2 animate-pulse" />
          <h2 className="text-2xl font-bold tracking-tight">{t.mapsKeyRequired}</h2>
          
          <div className="text-left space-y-6 text-sm">
            {/* Step 1 */}
            <div className="pb-4 border-b border-slate-100 dark:border-white/10">
              <span className="inline-flex items-center justify-center bg-blue-500/10 text-blue-500 rounded-full w-6 h-6 text-xs font-bold mr-2">1</span>
              <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-semibold text-base">
                {t.mapsKeyStep1}
              </a>
            </div>
            
            {/* Step 2 */}
            <div className="space-y-4">
              <div className="flex items-center">
                <span className="inline-flex items-center justify-center bg-blue-500/10 text-blue-500 rounded-full w-6 h-6 text-xs font-bold mr-2">2</span>
                <span className="font-semibold text-base">{t.mapsKeyStep2}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {/* Option A: AI Studio */}
                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/10 space-y-2 flex flex-col justify-between">
                  <div>
                    <p className="font-bold text-xs text-blue-500 uppercase tracking-wider mb-2">{t.mapsKeyStep2Studio}</p>
                    <ul className="list-disc list-inside text-slate-500 dark:text-slate-400 space-y-1.5 text-xs">
                      <li>Ouvrir les réglages <strong>Settings</strong> (⚙️)</li>
                      <li>Sélectionner l'onglet <strong>Secrets</strong></li>
                      <li>Ajouter un secret nommé : <code className="bg-slate-200 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[11px] text-slate-800 dark:text-slate-200 font-bold">GOOGLE_MAPS_PLATFORM_KEY</code></li>
                    </ul>
                  </div>
                  <p className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100 dark:border-white/5">{t.mapsKeyAuto}</p>
                </div>

                {/* Option B: Local */}
                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/10 space-y-2 flex flex-col justify-between">
                  <div>
                    <p className="font-bold text-xs text-emerald-500 uppercase tracking-wider mb-2">{t.mapsKeyStep2Local}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mb-2">
                      {t.mapsKeyStep2LocalDesc}
                    </p>
                    <pre className="bg-slate-200 dark:bg-black/40 p-2 rounded font-mono text-[10px] overflow-x-auto text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-white/5">
                      GOOGLE_MAPS_PLATFORM_KEY=VOTRE_CLE_ICI
                    </pre>
                  </div>
                  <p className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100 dark:border-white/5">
                    {lang === 'fr' ? "Puis redémarrez le serveur local." : "Then restart your local development server."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button onClick={getUserLocation} className="w-full py-3 bg-blue-600 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-blue-500 transition-colors text-white mt-4 shadow-lg shadow-blue-500/20">
            {t.retry}
          </button>
        </SleekCard>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <APIProvider 
        apiKey={GOOGLE_MAPS_API_KEY} 
        version="weekly" 
        language={mapsInitialLang} 
      >
        <div 
          className={cn(
            "min-h-screen font-sans text-slate-900 dark:text-white p-6 md:p-10 transition-all duration-500 relative", 
            !customBg && "bg-slate-50 dark:bg-slate-950",
            activeTheme.selectionBgClass
          )}
          style={{
            '--card-bg-color': isDarkMode 
              ? `rgba(15, 23, 42, ${cardOpacity / 100})` 
              : `rgba(255, 255, 255, ${cardOpacity / 100})`,
            '--card-blur': `${cardBlur}px`,
          } as React.CSSProperties}
        >
          {customBg && (
            <div 
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                backgroundImage: `url(${customBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
                backgroundRepeat: 'no-repeat',
                filter: `brightness(${bgBrightness}%) contrast(${bgContrast}%)`
              }}
            />
          )}
          {customBg && (
            <div className="absolute inset-0 bg-slate-50/75 dark:bg-slate-950/80 backdrop-blur-[1.5px] pointer-events-none z-0" />
          )}
          <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Header Section */}
        <header id="header" className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tighter text-slate-900 dark:text-white">{weather?.locationName}</h1>
              {weather && (
                <button 
                  onClick={toggleFavorite}
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors group"
                  title={favorites.some(f => f.name === weather.locationName) ? t.removeFavorite : t.addFavorite}
                >
                  <Heart 
                    size={20} 
                    className={cn(
                      "transition-all duration-300",
                      favorites.some(f => f.name === weather.locationName) 
                        ? "fill-red-500 text-red-500 scale-110" 
                        : "text-slate-400 group-hover:text-red-400"
                    )} 
                  />
                </button>
              )}
              {weather && activeAlerts.length > 0 && (
                <button
                  onClick={() => setShowAlertsModal(true)}
                  className="px-2.5 py-1 bg-red-500 text-white rounded-full text-[10px] font-black tracking-widest uppercase animate-pulse flex items-center gap-1.5 shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all duration-300 ml-1 hover:scale-105"
                  title={lang === 'fr' ? "Voir les alertes de sécurité" : "View safety alerts"}
                >
                  <AlertCircle size={12} className="fill-white text-red-500 animate-bounce" style={{ animationDuration: '2s' }} />
                  <span>{lang === 'fr' ? "ALERTE" : "ALERT"}</span>
                  <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[8px] font-black">{activeAlerts.length}</span>
                </button>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 border-0" style={{ borderWidth: '0px' }}>
              {dateStr} | {now.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <form onSubmit={handleSearch} className="relative flex-1 md:w-80 group" id="search-form">
              <Search className={cn("absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors", activeTheme.groupFocusTextClass)} size={16} />
              <input 
                type="text" 
                placeholder={t.searchPlaceholder}
                className={cn("w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full py-2.5 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-400 text-slate-900 dark:text-white shadow-sm dark:shadow-none", activeTheme.focusRingClass)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                id="search-input"
              />
            </form>

            <div className="flex items-center gap-2 flex-wrap">
              <button 
                onClick={toggleDarkMode}
                className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none"
                title={isDarkMode ? t.lightMode : t.darkMode}
              >
                {isDarkMode ? <Sun size={18} className="text-yellow-500" /> : <Moon size={18} className="text-slate-400" />}
              </button>

              <button 
                onClick={getUserLocation}
                className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none"
                title={t.findMe}
              >
                <Navigation size={18} className="text-slate-400" />
              </button>

              <button 
                onClick={handleRefresh}
                className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none group"
                title={t.refresh}
              >
                <RefreshCw 
                  size={18} 
                  className={cn(
                    "text-slate-400 group-hover:rotate-180 transition-transform duration-500",
                    loading && "animate-spin"
                  )} 
                />
              </button>

              <ThemeSelector 
                currentThemeId={activeThemeId} 
                onSelectThemeId={handleSetThemeId} 
                lang={lang} 
                t={t} 
              />

              <BackgroundSelector
                customBg={customBg}
                onCustomBgChange={handleCustomBgChange}
                bgBrightness={bgBrightness}
                onBgBrightnessChange={handleBgBrightnessChange}
                bgContrast={bgContrast}
                onBgContrastChange={handleBgContrastChange}
                cardOpacity={cardOpacity}
                onCardOpacityChange={handleCardOpacityChange}
                cardBlur={cardBlur}
                onCardBlurChange={handleCardBlurChange}
                activeTheme={activeTheme}
                lang={lang}
              />

              <FXIntensitySlider 
                intensity={fxIntensity}
                onIntensityChange={handleSetFxIntensity}
                activeTheme={activeTheme}
                t={t}
              />

              <button 
                onClick={() => setSimulateAlert(prev => !prev)}
                className={cn(
                  "px-4 py-2 border rounded-full transition-all flex items-center gap-2 text-xs font-bold tracking-widest shadow-sm dark:shadow-none",
                  simulateAlert 
                    ? "bg-red-500 hover:bg-red-600 border-red-500 text-white animate-pulse" 
                    : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400"
                )}
                title={lang === 'fr' ? "Simuler une alerte météo violente" : "Simulate severe weather alert"}
              >
                <AlertCircle size={14} className={simulateAlert ? "text-white animate-bounce" : "text-red-500"} />
                <span>{simulateAlert ? (lang === 'fr' ? "ALERTE ACTIVE" : "ALERT ACTIVE") : t.simulateAlertLabel}</span>
              </button>

              <button 
                onClick={toggleLang}
                className="px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2 text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400 shadow-sm dark:shadow-none"
                title="Change Language"
              >
                <Globe size={14} />
                <span>{lang.toUpperCase()}</span>
              </button>

              <button 
                onClick={toggleTempUnit}
                className="px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400 shadow-sm dark:shadow-none"
                title={lang === 'fr' ? "Changer l'unité de température" : "Change Temperature Unit"}
              >
                <Thermometer size={14} className={activeTheme.accentClass} />
                <span>°{tempUnit}</span>
              </button>

              <button 
                onClick={toggleFullscreen}
                className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize size={18} className="text-slate-400" /> : <Maximize size={18} className="text-slate-400" />}
              </button>
            </div>
          </div>
        </header>

        {error && (
            <motion.div 
               initial={{ opacity: 0, y: -10 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-amber-600 dark:text-amber-300 text-xs flex items-center justify-between gap-4 shadow-sm"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertCircle size={16} className="text-amber-500 shrink-0" />
                  <span className="font-medium truncate">{error}</span>
                </div>
                <button onClick={handleRefresh} className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-200 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all cursor-pointer shrink-0">{t.retry}</button>
            </motion.div>
        )}

        <AnimatePresence mode="wait">
          {weather && (
            <motion.main 
              key={`${weather.locationName}-${lang}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-12 gap-8"
              id="main-grid"
            >
              
              {/* Main Hero Card (8 cols) */}
              <div className="col-span-12 lg:col-span-8 space-y-8">
                <motion.div 
                   className={cn("bg-gradient-to-br via-white dark:via-slate-900 to-transparent rounded-[2rem] border border-slate-200 dark:border-white/10 p-10 flex flex-col md:flex-row items-center justify-between shadow-xl dark:shadow-3xl relative overflow-hidden group cursor-pointer", activeTheme.gradientFrom)}
                   id="hero-card"
                   whileHover={{ 
                     y: -10, 
                     scale: 1.015, 
                     boxShadow: "0 35px 60px -15px rgba(0, 0, 0, 0.25), 0 20px 40px -20px " + getThemeShadowColor(activeTheme.id) 
                   }}
                   transition={{ type: "spring", stiffness: 140, damping: 22 }}
                >
                  <WeatherBackground 
                    code={weather.current.weatherCode} 
                    isDay={weather.current.isDay} 
                    themeId={activeThemeId}
                    fxIntensity={fxIntensity}
                  />
                  <div 
                    className="absolute top-0 left-0 w-full h-full pointer-events-none" 
                    style={{ backgroundImage: `radial-gradient(circle at 30% 30%, ${getThemeShadowColor(activeTheme.id).replace('0.3', '0.08')}, transparent)` }}
                  />
                  
                  <div className="flex flex-col relative z-10 w-full md:w-auto text-center md:text-left">
                    <div className="flex items-start justify-center md:justify-start">
                      <span className="text-[120px] font-extralight leading-none tracking-tighter text-slate-900 dark:text-white drop-shadow-sm dark:drop-shadow-2xl">
                        {tempUnit === 'C' ? weather.current.temp : Math.round(weather.current.temp * 1.8 + 32)}
                      </span>
                      <span className="text-4xl font-light mt-6 text-slate-500 dark:text-slate-400">°{tempUnit}</span>
                    </div>
                    <div className="mt-4">
                      <h2 className="text-3xl font-medium text-slate-900 dark:text-white tracking-tight">
                        {getWeatherDescription(weather.current.weatherCode, lang)}
                      </h2>
                      <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                        {t.feelsLike} {tempUnit === 'C' ? weather.current.feelsLike : Math.round(weather.current.feelsLike * 1.8 + 32)}°{tempUnit} • {t.wind} {weather.current.windSpeed} km/h
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center relative z-10 mt-8 md:mt-0">
                    <div className="relative flex items-center justify-center">
                       <div 
                         className="w-48 h-48 flex items-center justify-center"
                         style={{ filter: `drop-shadow(0 0 50px ${getThemeShadowColor(activeTheme.id)})` }}
                       >
                         <AnimatedWeatherIcon 
                           code={weather.current.weatherCode} 
                           isDay={weather.current.isDay}
                           size={140} 
                           lang={lang}
                         />
                       </div>
                    </div>
                    <p className={cn("text-[10px] font-bold tracking-[0.3em] mt-6 uppercase leading-none border-b pb-1", activeTheme.accentClass, activeTheme.borderAccentClass)}>
                      {weather.current.isDay ? t.dayConditions : t.nightConditions}
                    </p>
                  </div>
                </motion.div>

                {/* Hourly Mini Chart */}
                <SleekCard 
                  id="hourly-card" 
                  className="p-5 sm:p-8 relative w-full border-white/55 dark:border-white/15 shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.65),inset_0_2px_4px_0_rgba(255,255,255,0.45),inset_0_-1px_2px_0_rgba(0,0,0,0.05),0_25px_50px_-12px_rgba(0,0,0,0.25),0_12px_24px_-8px_rgba(0,0,0,0.18)] dark:shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.22),inset_0_2px_4px_0_rgba(255,255,255,0.16),inset_0_-1px_2px_0_rgba(0,0,0,0.4),0_30px_60px_-15px_rgba(0,0,0,0.8),0_16px_32px_-10px_rgba(0,0,0,0.65)]" 
                  style={{ borderWidth: '6px' }}
                >
                   <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{t.hourlyTitle}</h3>
                    <div className="flex items-center gap-2">
                      <div className={cn("text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full", activeTheme.accentBgLightClass)}>{t.next24h}</div>
                      
                      {/* Chart Info Tooltip */}
                      <div className="relative group/chart-help flex items-center">
                        <button
                          type="button"
                          id="hourly-chart-info-btn"
                          aria-label={lang === 'fr' ? 'Comment lire le graphique horaire' : 'How to interpret the temperature trend chart'}
                          className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus:outline-none"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Tooltip Content */}
                        <div 
                          role="tooltip"
                          id="hourly-chart-tooltip"
                          className="absolute right-0 top-full mt-2 w-64 p-3.5 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs shadow-2xl border border-slate-700/60 dark:border-white/10 backdrop-blur-md opacity-0 invisible group-hover/chart-help:opacity-100 group-hover/chart-help:visible transition-all duration-200 z-30 pointer-events-none"
                        >
                          <div className="flex items-center gap-1.5 font-bold text-slate-200 mb-1 text-[11px] uppercase tracking-wider">
                            <HelpCircle className="w-3 h-3 text-sky-400 shrink-0" />
                            <span>{lang === 'fr' ? 'Tendance des températures' : 'Temperature Trend'}</span>
                          </div>
                          <p className="text-slate-300 text-[11px] leading-relaxed">
                            {lang === 'fr'
                              ? 'Cette courbe illustre la variation continue de la température sur 24h. Les pics représentent les maxima thermiques en journée et les creux le rafraîchissement nocturne. Survolez la courbe pour obtenir le détail exact heure par heure.'
                              : 'This curve illustrates continuous temperature changes across the next 24 hours. Peaks indicate daytime heat, while valleys reveal overnight cooling. Hover over the line to view exact hourly temperatures and conditions.'}
                          </p>
                          <div className="absolute -top-1.5 right-2 w-3 h-3 bg-slate-900/95 dark:bg-slate-800/95 border-t border-l border-slate-700/60 dark:border-white/10 rotate-45" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div ref={hourlyChartContainerRef} className="h-64 sm:h-72 md:h-80 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <AreaChart
                        data={transformedHourly}
                        margin={hourlyChartConfig.margin}
                      >
                        <defs>
                          <linearGradient id={`tempGradient-${activeTheme.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={getThemeHexColor(activeTheme.id)} stopOpacity={0.25}/>
                            <stop offset="95%" stopColor={getThemeHexColor(activeTheme.id)} stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid 
                          vertical={false} 
                          stroke={isDarkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.05)"} 
                          strokeDasharray="4 4" 
                        />
                        <XAxis 
                          dataKey="time" 
                          tickLine={false}
                          axisLine={false}
                          tick={{ 
                            fill: isDarkMode ? '#64748b' : '#94a3b8', 
                            fontSize: hourlyChartConfig.fontSize, 
                            fontWeight: 600 
                          }}
                          interval={hourlyChartConfig.interval}
                          dy={10}
                        />
                        <YAxis 
                          dataKey="temp" 
                          tickLine={false}
                          axisLine={false}
                          tick={{ 
                            fill: isDarkMode ? '#64748b' : '#94a3b8', 
                            fontSize: hourlyChartConfig.fontSize, 
                            fontWeight: 600 
                          }}
                          domain={['auto', 'auto']}
                          tickFormatter={(val) => `${val}°`}
                          width={hourlyChartConfig.yAxisWidth}
                        />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const WeatherIconComponent = getWeatherIcon(data.weatherCode);
                              return (
                                <div className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-white/10 p-3 sm:p-3.5 rounded-2xl shadow-xl flex items-center gap-3">
                                  <div className={cn("p-2 rounded-xl shrink-0", activeTheme.accentBgLightClass)}>
                                    <WeatherIconComponent size={20} />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{data.time}</span>
                                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-0.5">{data.temp}°{tempUnit}</span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="temp"
                          stroke={getThemeHexColor(activeTheme.id)}
                          strokeWidth={3}
                          fillOpacity={1}
                          fill={`url(#tempGradient-${activeTheme.id})`}
                          activeDot={{ r: hourlyChartConfig.dotRadius, strokeWidth: 0, fill: getThemeHexColor(activeTheme.id) }}
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-in-out"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </SleekCard>

              {/* Satellite View */}
                <SleekCard 
                  id="satellite-card" 
                  className="p-0 overflow-hidden relative group h-[470px] sm:h-[450px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                  whileHover={{ y: 0, scale: 1 }}
                >
                  <div className="absolute top-3 sm:top-6 left-3 sm:left-6 z-20 space-y-1 max-w-[60%] sm:max-w-none">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white drop-shadow-md shrink-0">{t.satelliteTitle}</h3>
                      <button
                        type="button"
                        onClick={() => setShowClouds(prev => !prev)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold tracking-wider transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0",
                          showClouds
                            ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                            : "bg-slate-800/60 border-white/10 text-slate-400 hover:text-slate-200"
                        )}
                        title={showClouds 
                          ? (lang === 'fr' ? 'Cliquer pour masquer les nuages' : 'Click to hide clouds') 
                          : (lang === 'fr' ? 'Cliquer pour afficher les nuages' : 'Click to show clouds')}
                      >
                        {showClouds ? (
                          <>
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                            </span>
                            <span>{lang === 'fr' ? 'NUAGES ANIMÉS' : 'ANIMATED CLOUDS'}</span>
                          </>
                        ) : (
                          <>
                            <CloudOff className="w-2.5 h-2.5 text-slate-400" />
                            <span>{lang === 'fr' ? 'NUAGES MASQUÉS' : 'CLOUDS HIDDEN'}</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest drop-shadow-md truncate">
                      {mapType === 'satellite' ? t.mapLabel : mapType === 'terrain' ? (lang === 'fr' ? 'Topographie • Relief' : 'Topography • Relief') : (lang === 'fr' ? 'Réseau Routier • Infrastructure' : 'Road Network • Infrastructure')}
                    </p>
                  </div>

                  {/* Map Legend */}
                  <div className="absolute top-3 sm:top-6 right-3 sm:right-6 z-20">
                    <div className="p-2 sm:p-3 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/10 space-y-1.5 sm:space-y-2 min-w-[100px] sm:min-w-[120px]">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">{t.legend}</span>
                        {showClouds && (
                          <span className="text-[8px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                            {lang === 'fr' ? 'Météo' : 'Weather'}
                          </span>
                        )}
                      </div>
                      {showClouds && (
                        <div className="flex items-center gap-2 pb-1 mb-1 border-b border-white/10">
                          <div className="w-2 h-2 rounded-full bg-white/90 ring-1 ring-sky-400/40" /> 
                          <span className="text-[10px] text-white/90 font-medium">{t.cloudsLabel}</span>
                        </div>
                      )}
                      {mapType === 'satellite' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500/80" /> <span className="text-[10px] text-white/80">{t.vegetationLabel}</span></div>
                        </div>
                      )}
                      {mapType === 'terrain' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-700/80" /> <span className="text-[10px] text-white/80">{t.elevationLabel}</span></div>
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-200/50" /> <span className="text-[10px] text-white/80">{t.contoursLabel}</span></div>
                        </div>
                      )}
                      {mapType === 'roadmap' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-400" /> <span className="text-[10px] text-white/80">{t.arteriesLabel}</span></div>
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400" /> <span className="text-[10px] text-white/80">{t.waterLabel}</span></div>
                        </div>
                      )}
                    </div>
                  </div>

                    <div id="satellite-map" className="h-full w-full bg-slate-200 dark:bg-slate-900 flex items-center justify-center relative">
                        <Map
                          key={`map-${isGlobe}`}
                          defaultCenter={{ lat: weather.coords.lat, lng: weather.coords.lon }}
                          defaultZoom={isGlobe ? 3 : (mapType === 'roadmap' ? 13 : mapType === 'terrain' ? 12 : 10)}
                          minZoom={2}
                          maxZoom={mapType === 'terrain' ? 20 : 22}
                          mapTypeId={mapType}
                          mapId="DEMO_MAP_ID"
                          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
                          disableDefaultUI={true}
                          gestureHandling="greedy"
                          style={{ width: '100%', height: '100%' }}
                        >
                          <MapController 
                            coords={weather.coords} 
                            isGlobe={isGlobe} 
                            metadata={metadata} 
                            mapType={mapType} 
                            showClouds={showClouds}
                            animationIndex={timelineIndex} 
                            onMapReady={setMapInstance}
                          />
                          {weather.coords && (
                            <MapContent weather={weather} fetchWeather={fetchWeather} />
                          )}
                        </Map>
                    </div>

                  {/* Zoom Controls (+ / -) */}
                  <div className="absolute right-3 sm:right-6 bottom-28 z-20 flex flex-col gap-1.5 shadow-2xl">
                    <button
                      id="map-zoom-in-btn"
                      type="button"
                      onClick={handleZoomIn}
                      className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md group cursor-pointer"
                      title={lang === 'fr' ? 'Zoomer (+)' : 'Zoom in (+)'}
                      aria-label="Zoom in"
                    >
                      <Plus className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" />
                    </button>
                    <button
                      id="map-zoom-out-btn"
                      type="button"
                      onClick={handleZoomOut}
                      className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md group cursor-pointer"
                      title={lang === 'fr' ? 'Dézoomer (-)' : 'Zoom out (-)'}
                      aria-label="Zoom out"
                    >
                      <Minus className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" />
                    </button>
                  </div>

                  {/* Layer Control Bar - Fully responsive, cleanly spaced, never clipped */}
                  <div className="absolute bottom-16 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-20 flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap sm:flex-nowrap pointer-events-none">
                     {/* Globe 3D Toggle */}
                     <button
                        onClick={() => setIsGlobe(!isGlobe)}
                        className={cn(
                          "px-2.5 sm:px-3 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all backdrop-blur-xl border border-white/10 shadow-xl flex items-center gap-1 sm:gap-1.5 shrink-0 pointer-events-auto cursor-pointer",
                          isGlobe 
                            ? activeTheme.accentBgClass
                            : "bg-slate-900/90 text-slate-300 hover:text-white"
                        )}
                        title={lang === 'fr' ? 'Mode Globe 3D' : '3D Globe Mode'}
                      >
                        <Globe className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0" />
                        <span className="hidden sm:inline">{t.globeTitle}</span>
                        <span className="sm:hidden">3D</span>
                      </button>

                     {/* Map Types (Satellite / Terrain / Roadmap) */}
                     <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl shrink-0 pointer-events-auto">
                        {(['satellite', 'terrain', 'roadmap'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setMapType(type)}
                            className={cn(
                              "px-2 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                              mapType === type 
                                ? activeTheme.accentBgClass
                                : "text-slate-400 hover:text-white hover:bg-white/5"
                            )}
                          >
                            <span className="hidden sm:inline">{type}</span>
                            <span className="sm:hidden">
                              {type === 'satellite' ? 'Sat' : type === 'terrain' ? 'Terr' : 'Plan'}
                            </span>
                          </button>
                        ))}
                     </div>

                     {/* Clouds toggle button - Always 100% visible and unclipt */}
                     <button
                        id="map-clouds-toggle-btn"
                        type="button"
                        onClick={() => setShowClouds(prev => !prev)}
                        className={cn(
                          "px-2.5 sm:px-3 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all backdrop-blur-xl border shadow-xl flex items-center gap-1 sm:gap-1.5 shrink-0 cursor-pointer pointer-events-auto",
                          showClouds
                            ? "bg-sky-500 text-white shadow-sky-500/25 border-sky-400/30"
                            : "bg-slate-900/90 text-slate-400 hover:text-white border-white/10"
                        )}
                        title={showClouds 
                          ? (lang === 'fr' ? 'Masquer les nuages' : 'Hide clouds') 
                          : (lang === 'fr' ? 'Afficher les nuages' : 'Show clouds')}
                        aria-label={showClouds 
                          ? (lang === 'fr' ? 'Masquer les nuages' : 'Hide clouds') 
                          : (lang === 'fr' ? 'Afficher les nuages' : 'Show clouds')}
                      >
                        {showClouds ? <Cloud className="w-3 sm:w-3.5 h-3 sm:h-3.5 fill-current text-white shrink-0" /> : <CloudOff className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-slate-400 shrink-0" />}
                        <span className="hidden md:inline">
                          {lang === 'fr' 
                            ? (showClouds ? 'Nuages : Oui' : 'Nuages : Non') 
                            : (showClouds ? 'Clouds: On' : 'Clouds: Off')}
                        </span>
                        <span className="hidden sm:inline md:hidden">
                          {lang === 'fr' 
                            ? (showClouds ? 'Nuages' : 'Sans nuage') 
                            : (showClouds ? 'Clouds' : 'No clouds')}
                        </span>
                        <span className="sm:hidden">
                          {lang === 'fr' 
                            ? (showClouds ? 'Nuages' : 'Masqués') 
                            : (showClouds ? 'Clouds' : 'Hidden')}
                        </span>
                     </button>
                  </div>

                  {/* Scrubbing Timeline Slider Control Bar - Non-resizing, rock solid, fixed layout */}
                  <div className="absolute bottom-2.5 sm:bottom-3 left-2.5 sm:left-3 right-2.5 sm:right-3 z-20">
                    <div className="bg-slate-950/90 backdrop-blur-md rounded-2xl border border-white/10 px-2 sm:px-3 h-12 shadow-2xl flex items-center gap-1.5 sm:gap-2.5 flex-nowrap min-w-0">
                      {/* Play / Pause button */}
                      <button
                        type="button"
                        onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
                        className={cn(
                          "w-8 h-8 rounded-xl transition-all flex items-center justify-center shrink-0 shadow-sm cursor-pointer",
                          isPlayingTimeline
                            ? "bg-white/10 hover:bg-white/20 text-white"
                            : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
                        )}
                        title={isPlayingTimeline ? (lang === 'fr' ? 'Mettre en pause' : 'Pause animation') : (lang === 'fr' ? 'Lancer animation' : 'Play animation')}
                      >
                        {isPlayingTimeline ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>

                      {/* Step back */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlayingTimeline(false);
                          setTimelineIndex(prev => (prev - 1 + activeTimelineFrames.length) % (activeTimelineFrames.length || 1));
                        }}
                        disabled={activeTimelineFrames.length <= 1}
                        className="w-7 h-7 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-all shrink-0 flex items-center justify-center disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                        title={lang === 'fr' ? 'Image précédente' : 'Previous frame'}
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                      </button>

                      {/* Step forward */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlayingTimeline(false);
                          setTimelineIndex(prev => (prev + 1) % (activeTimelineFrames.length || 1));
                        }}
                        disabled={activeTimelineFrames.length <= 1}
                        className="w-7 h-7 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-all shrink-0 flex items-center justify-center disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                        title={lang === 'fr' ? 'Image suivante' : 'Next frame'}
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>

                      {/* Scrubber timeline track */}
                      <div className="flex-1 min-w-0 relative flex items-center h-6 select-none cursor-pointer">
                        {/* Background track */}
                        <div className="absolute inset-x-0 h-1.5 bg-white/15 rounded-full overflow-hidden">
                          {/* Progress fill */}
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 rounded-full"
                            style={{ 
                              width: `${activeTimelineFrames.length > 1 ? (timelineIndex / (activeTimelineFrames.length - 1)) * 100 : 0}%` 
                            }}
                          />
                        </div>

                        {/* Frame tick marks */}
                        {activeTimelineFrames.length > 1 && activeTimelineFrames.map((_, idx) => {
                          const pct = (idx / (activeTimelineFrames.length - 1)) * 100;
                          const isCurrent = idx === timelineIndex;
                          const isPast = idx < timelineIndex;
                          return (
                            <div
                              key={idx}
                              className={cn(
                                "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full pointer-events-none",
                                isCurrent 
                                  ? "w-2.5 h-2.5 bg-white ring-2 ring-emerald-400 shadow-sm z-10" 
                                  : isPast 
                                  ? "w-1.5 h-1.5 bg-white/80" 
                                  : "w-1.5 h-1.5 bg-white/30"
                              )}
                              style={{ left: `${pct}%` }}
                            />
                          );
                        })}

                        {/* Interactive Range Input */}
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, activeTimelineFrames.length - 1)}
                          step={1}
                          value={timelineIndex}
                          onChange={(e) => {
                            setTimelineIndex(Number(e.target.value));
                          }}
                          onMouseDown={() => setIsPlayingTimeline(false)}
                          onTouchStart={() => setIsPlayingTimeline(false)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                          title={lang === 'fr' ? 'Glisser pour naviguer dans le temps' : 'Drag to scrub timeline'}
                        />
                      </div>

                      {/* Timestamp and status badge - rigidly fixed widths, tabular-nums to completely prevent resizing */}
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0 border-l border-white/10 pl-1.5 sm:pl-2.5">
                        <Clock className="w-3 h-3 text-slate-400 hidden sm:inline-block shrink-0" />
                        
                        {/* 44px fixed width for HH:MM */}
                        <span className="font-mono text-xs font-bold text-white tracking-wider tabular-nums w-11 text-center shrink-0">
                          {frameTimeFormatted}
                        </span>

                        {/* 66px-74px fixed width for the relative time / LIVE badge */}
                        <div className="w-[66px] sm:w-[74px] flex items-center justify-center shrink-0">
                          {relativeTimeFormatted ? (
                            <span 
                              className={cn(
                                "w-full px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider tabular-nums text-center truncate flex items-center justify-center",
                                relativeTimeFormatted === 'LIVE' || relativeTimeFormatted === 'EN DIRECT'
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-white/10 text-slate-300 border border-white/10"
                              )}
                            >
                              {(relativeTimeFormatted === 'LIVE' || relativeTimeFormatted === 'EN DIRECT') && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1 shrink-0" />
                              )}
                              <span className="truncate">{relativeTimeFormatted}</span>
                            </span>
                          ) : (
                            <span className="w-full px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-white/5 text-slate-400 border border-white/5 text-center truncate">
                              {lang === 'fr' ? 'RADAR' : 'LIVE'}
                            </span>
                          )}
                        </div>

                        {/* 32px fixed width for frame counter */}
                        <span className="text-[10px] text-slate-400 font-mono tabular-nums w-8 text-center hidden md:inline-block shrink-0">
                          {activeTimelineFrames.length > 0 ? `${timelineIndex + 1}/${activeTimelineFrames.length}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />
                </SleekCard>
              </div>

              {/* Side/Bottom Grid */}
              <div className="col-span-12 lg:col-span-4 space-y-8 relative" style={{ borderWidth: '0px', borderRadius: '0px', borderColor: '#1f5fb5' }}>
                {/* Ambient Backlight / Glow effects behind the right side cards */}
                <div 
                  className="absolute -top-12 -left-12 -right-12 -bottom-12 rounded-[3rem] filter blur-[100px] opacity-25 dark:opacity-40 pointer-events-none z-0"
                  style={{
                    background: `radial-gradient(circle, ${getThemeHexColor(activeTheme.id)} 0%, transparent 75%)`
                  }}
                />
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 relative z-10" style={{ borderWidth: '0px', borderStyle: 'solid', borderRadius: '0px', borderColor: '#e2e8f0' }}>
                   <StatCard 
                     id="stat-humidity" 
                     label={t.humidity} 
                     value={`${weather.current.humidity}%`} 
                     progress={weather.current.humidity} 
                     delay={0.04}
                     animateTrigger={`${weather.locationName}-${weather.current.temp}`}
                     activeTheme={activeTheme}
                     className="bg-white/20 dark:bg-white/[0.02] backdrop-blur-lg"
                     isDimmed={hoveredStatId !== null && hoveredStatId !== "stat-humidity"}
                     style={{ borderWidth: '6px', borderRadius: '24px' }}
                     onMouseEnter={() => setHoveredStatId("stat-humidity")}
                     onMouseLeave={() => setHoveredStatId(null)}
                     onClick={() => setSelectedStatId("stat-humidity")}
                     alert={activeAlerts.find(a => ['storm', 'rain', 'snow', 'heat', 'cold'].includes(a.id))}
                   />
                   <StatCard 
                     id="stat-wind" 
                     label={`${t.wind} (${lang === 'en' ? 'S' : 'V'})`} 
                     value={`${weather.current.windSpeed}`} 
                     subtext={t.windDesc} 
                     delay={0.08}
                     animateTrigger={`${weather.locationName}-${weather.current.temp}`}
                     activeTheme={activeTheme}
                     className="bg-white/20 dark:bg-white/[0.02] backdrop-blur-lg"
                     isDimmed={hoveredStatId !== null && hoveredStatId !== "stat-wind"}
                     style={{ borderWidth: '6px', borderRadius: '24px' }}
                     onMouseEnter={() => setHoveredStatId("stat-wind")}
                     onMouseLeave={() => setHoveredStatId(null)}
                     onClick={() => setSelectedStatId("stat-wind")}
                     alert={activeAlerts.find(a => a.id === 'wind')}
                   />
                   <StatCard 
                     id="stat-uv" 
                     label={t.uvIndex} 
                     value={weather.current.uvIndex !== undefined ? String(weather.current.uvIndex) : "4.0"} 
                     subtext={weather.current.uvIndex !== undefined ? (lang === 'fr' ? `${getUvLevelDesc(weather.current.uvIndex, lang)} • Niveau ${weather.current.uvIndex} sur 11` : `${getUvLevelDesc(weather.current.uvIndex, lang)} • Level ${weather.current.uvIndex} of 11`) : t.uvDesc} 
                     delay={0.12}
                     animateTrigger={`${weather.locationName}-${weather.current.temp}`}
                     activeTheme={activeTheme}
                     className="bg-white/20 dark:bg-white/[0.02] backdrop-blur-lg"
                     isDimmed={hoveredStatId !== null && hoveredStatId !== "stat-uv"}
                     style={{ borderWidth: '6px', borderRadius: '24px' }}
                     onMouseEnter={() => setHoveredStatId("stat-uv")}
                     onMouseLeave={() => setHoveredStatId(null)}
                     onClick={() => setSelectedStatId("stat-uv")}
                     alert={activeAlerts.find(a => a.id === 'uv')}
                   />
                   <StatCard 
                     id="stat-vis" 
                     label={t.visibility} 
                     value={weather.current.visibility !== undefined ? String(weather.current.visibility) : "24.1"} 
                     subtext={weather.current.visibility !== undefined ? `km • ${getVisLevelDesc(weather.current.visibility, lang)}` : t.visDesc} 
                     delay={0.16}
                     animateTrigger={`${weather.locationName}-${weather.current.temp}`}
                     activeTheme={activeTheme}
                     className="bg-white/20 dark:bg-white/[0.02] backdrop-blur-lg"
                     isDimmed={hoveredStatId !== null && hoveredStatId !== "stat-vis"}
                     style={{ borderWidth: '6px', borderRadius: '24px' }}
                     onMouseEnter={() => setHoveredStatId("stat-vis")}
                     onMouseLeave={() => setHoveredStatId(null)}
                     onClick={() => setSelectedStatId("stat-vis")}
                     alert={activeAlerts.find(a => a.id === 'visibility')}
                   />
                </div>

                {/* Favorites List */}
                <SleekCard id="favorites-card" style={{ borderWidth: '6px', borderRadius: '24px', borderStyle: 'solid' }} className="relative z-10 bg-white/20 dark:bg-white/[0.02] backdrop-blur-lg">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-6">{t.favoritesTitle}</h3>
                  <div className="space-y-3 max-h-[200px] overflow-y-auto scrollbar-hide">
                    {favorites.length === 0 ? (
                      <p className="text-[10px] text-slate-400 dark:text-slate-600 font-medium uppercase tracking-widest text-center py-4">{t.noFavorites}</p>
                    ) : (
                      favorites.map((fav, i) => (
                        <div key={fav.name} className="flex items-center justify-between group">
                          <button 
                             onClick={() => fetchWeather(fav.lat, fav.lon, fav.name)}
                             className={cn("text-[11px] font-bold text-slate-500 dark:text-slate-400 transition-colors uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis text-left flex-1", activeTheme.accentHoverClass)}
                          >
                             {fav.name}
                          </button>
                          <button 
                            onClick={() => removeFavorite(fav.name)}
                            className="p-1 text-slate-300 dark:text-slate-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </SleekCard>

                {/* Vertical Weekly */}
                <SleekCard id="weekly-card" style={{ borderWidth: '6px', borderStyle: 'solid' }} className="flex-1 relative z-10 bg-white/20 dark:bg-white/[0.02] backdrop-blur-lg">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-8">{t.dailyTitle}</h3>
                  <div className="space-y-6">
                    {weather.daily.map((day, i) => (
                      <div key={i} className="flex items-center justify-between group py-1 border-b border-slate-200 dark:border-white/5 last:border-0 pb-4 last:pb-0">
                        <span className={cn(
                          "w-12 text-sm font-bold tracking-widest",
                          i === 0 ? activeTheme.accentClass : "text-slate-500 dark:text-slate-300"
                        )}>{day.date}</span>
                        <div className="transition-all duration-500">
                          <AnimatedWeatherIcon code={day.weatherCode} size={24} lang={lang} />
                        </div>
                        <div className="flex items-center gap-4 w-24 justify-end">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {tempUnit === 'C' ? day.tempMax : Math.round(day.tempMax * 1.8 + 32)}°
                          </span>
                          <span className="text-slate-400 dark:text-slate-500 text-xs font-bold">
                            {tempUnit === 'C' ? day.tempMin : Math.round(day.tempMin * 1.8 + 32)}°
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </SleekCard>
              </div>

            </motion.main>
          )}
        </AnimatePresence>

        <footer className="text-center py-12 text-slate-400 dark:text-slate-700 text-[10px] font-bold uppercase tracking-[0.4em] border-t border-slate-200 dark:border-white/5" id="footer">
          <p>{t.footer}</p>
        </footer>
      </div>
    </div>
    
    <AnimatePresence>
      {selectedStatId && weather && (
        <StatDetailModal
          id={selectedStatId}
          weather={weather}
          onClose={() => setSelectedStatId(null)}
          activeTheme={activeTheme}
          lang={lang}
        />
      )}
      {showAlertsModal && activeAlerts.length > 0 && (
        <WeatherAlertsModal
          alerts={activeAlerts}
          onClose={() => setShowAlertsModal(false)}
          lang={lang}
          activeTheme={activeTheme}
        />
      )}
    </AnimatePresence>
    </APIProvider>
    </ErrorBoundary>
  );
}


