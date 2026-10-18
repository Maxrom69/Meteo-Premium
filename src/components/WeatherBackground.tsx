import React, { useMemo } from 'react';
import { motion } from 'motion/react';

interface WeatherBackgroundProps {
  code: number;
  isDay?: boolean;
  themeId?: string;
  fxIntensity?: number; // 0 to 100
}

const getThemeHexColor = (themeId: string) => {
  switch (themeId) {
    case 'indigo': return '#6366f1';
    case 'emerald': return '#10b981';
    case 'amber': return '#f59e0b';
    case 'rose': return '#f43f5e';
    case 'cyan': return '#06b6d4';
    case 'violet': return '#8b5cf6';
    case 'orange': return '#f97316';
    default: return '#3b82f6'; // classic blue
  }
};

export const WeatherBackground: React.FC<WeatherBackgroundProps> = ({ 
  code, 
  isDay = true,
  themeId = 'classic',
  fxIntensity = 50
}) => {
  const themeColor = getThemeHexColor(themeId);
  const intensityFactor = fxIntensity / 100;

  // Categorize weather codes based on WMO standards used in the app
  const isClear = code === 0;
  const isCloudy = (code >= 1 && code <= 3) || code === 45 || code === 48;
  const isRainy = (code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82);
  const isSnowy = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
  const isThunder = code >= 95 || (code >= 96 && code <= 99);

  // Raindrop generator: generates deterministic random-like values so we don't recalculate and cause flicker
  const raindrops = useMemo(() => {
    if (!isRainy && !isThunder) return [];
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      left: `${(i * 6.3) % 100}%`,
      delay: ((i * 0.13) % 2.0),
      duration: 0.8 + ((i * 0.17) % 0.6),
      opacity: 0.4 + ((i * 0.08) % 0.4),
      length: 25 + ((i * 15) % 35),
      width: 1.5 + ((i * 0.5) % 1.5),
    }));
  }, [isRainy, isThunder]);

  // Snowflake generator
  const snowflakes = useMemo(() => {
    if (!isSnowy) return [];
    return Array.from({ length: 35 }).map((_, i) => ({
      id: i,
      left: `${(i * 7.7) % 100}%`,
      delay: ((i * 0.25) % 4.5),
      duration: 3.0 + ((i * 0.4) % 3.5),
      size: 5 + ((i * 4) % 10),
      opacity: 0.5 + ((i * 0.07) % 0.4),
    }));
  }, [isSnowy]);

  // Twinkling stars for clear night
  const stars = useMemo(() => {
    if (!isClear || isDay) return [];
    return Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      left: `${(i * 9.7) % 96 + 2}%`,
      top: `${(i * 6.7) % 80 + 5}%`,
      delay: ((i * 0.3) % 3),
      duration: 1.2 + ((i * 0.5) % 2.5),
      size: 2 + ((i * 3) % 4),
    }));
  }, [isClear, isDay]);

  return (
    <div className="absolute inset-0 z-[1] overflow-hidden rounded-[2rem] pointer-events-none select-none">
      {/* 1. CLEAR DAY BACKGROUND */}
      {isClear && isDay && (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-400/5">
          {/* Subtle sun ray pulse & rotation with Theme flare! */}
          <motion.div
            className="absolute -top-20 -right-20 w-96 h-96 rounded-full blur-3xl"
            style={{
              backgroundColor: themeColor,
              opacity: 0.18 * intensityFactor,
            }}
            animate={{
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Golden base Sun glow */}
          <motion.div
            className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-amber-400 blur-3xl"
            style={{
              opacity: 0.22 * intensityFactor,
            }}
            animate={{
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Rotating Theme-colored Sunbeam Rays */}
          <motion.div
            className="absolute -top-10 -right-10 w-80 h-80 flex items-center justify-center"
            style={{ opacity: 0.35 * intensityFactor }}
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: '300px',
                  height: '16px',
                  transform: `rotate(${i * 45}deg) translateX(100px)`,
                  filter: 'blur(4px)',
                  background: `linear-gradient(to right, ${themeColor}44, transparent)`
                }}
              />
            ))}
          </motion.div>
        </div>
      )}

      {/* 2. CLEAR NIGHT BACKGROUND */}
      {isClear && !isDay && (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/10 via-transparent to-purple-950/10">
          {stars.map((star) => (
            <motion.div
              key={star.id}
              className="absolute rounded-full"
              style={{
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                backgroundColor: star.id % 3 === 0 ? themeColor : '#ffffff',
                boxShadow: `0 0 8px 1px ${star.id % 3 === 0 ? themeColor : 'rgba(255, 255, 255, 0.8)'}`,
              }}
              animate={{
                opacity: [0.1 * intensityFactor, 1 * intensityFactor, 0.1 * intensityFactor],
                scale: [0.7, 1.3, 0.7],
              }}
              transition={{
                duration: star.duration,
                delay: star.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
          {/* Beautiful glowing moon aura dynamically taking active theme color */}
          <motion.div
            className="absolute -top-20 -right-20 w-96 h-96 rounded-full blur-3xl"
            style={{
              backgroundColor: themeColor,
              opacity: 0.22 * intensityFactor,
            }}
            animate={{
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
      )}

      {/* 3. CLOUDY / FOG BACKGROUND */}
      {isCloudy && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-400/5 via-transparent to-sky-400/5">
          {/* Stylized Moving Cloud 1 */}
          <motion.div
            className="absolute top-12 left-10 text-slate-300/20 dark:text-slate-100/10 w-44 h-24"
            style={{ opacity: intensityFactor }}
            animate={{
              x: [-100, 750],
            }}
            transition={{
              duration: 35,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full">
              <path d="M20 60 A20 20 0 0 1 50 40 A15 15 0 0 1 75 45 A20 20 0 0 1 70 80 L20 80 Z" />
            </svg>
          </motion.div>

          {/* Stylized Moving Cloud 2 */}
          <motion.div
            className="absolute bottom-8 right-24 text-blue-300/15 dark:text-slate-400/10 w-56 h-32"
            style={{ opacity: intensityFactor }}
            animate={{
              x: [100, -650],
            }}
            transition={{
              duration: 45,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full">
              <path d="M10 70 A25 25 0 0 1 50 45 A20 20 0 0 1 80 50 A25 25 0 0 1 75 95 L10 95 Z" />
            </svg>
          </motion.div>

          {/* Ambient theme-tinted fog overlays */}
          <motion.div
            className="absolute top-4 -left-1/4 w-[150%] h-40 blur-2xl"
            style={{
              backgroundColor: themeColor,
              opacity: 0.12 * intensityFactor,
            }}
            animate={{
              x: ["0%", "15%", "0%"],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-4 -right-1/4 w-[150%] h-40 blur-2xl"
            style={{
              backgroundColor: themeColor,
              opacity: 0.08 * intensityFactor,
            }}
            animate={{
              x: ["0%", "-15%", "0%"],
            }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
      )}

      {/* 4. RAINY BACKGROUND */}
      {(isRainy || isThunder) && (
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/5 via-transparent to-blue-950/10">
          {/* Subtle puddle splash ripples on the bottom - matching active theme color! */}
          <div className="absolute bottom-0 left-0 right-0 h-12 flex justify-around opacity-40">
            {[1, 2, 3, 4, 5].map((id) => (
              <motion.div
                key={id}
                className="w-6 h-2 border-t rounded-full"
                style={{
                  borderColor: `${themeColor}aa`,
                  opacity: 0.5 * intensityFactor
                }}
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: [0, 2.5], opacity: [0.8, 0] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: id * 0.35,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>

          {/* Falling raindrops tinted in the chosen theme color */}
          {raindrops.map((drop) => (
            <motion.div
              key={drop.id}
              className="absolute rounded-full"
              style={{
                left: drop.left,
                top: -60,
                width: drop.width,
                height: drop.length,
                opacity: drop.opacity * intensityFactor,
                background: `linear-gradient(to bottom, ${themeColor}33, ${themeColor}cc)`,
                transform: 'skewX(-12deg)', // slightly diagonal rain
                filter: `drop-shadow(0px 1px 2px ${themeColor}33)`,
              }}
              animate={{
                top: ['-60px', '460px'],
              }}
              transition={{
                duration: drop.duration,
                delay: drop.delay,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}
        </div>
      )}

      {/* 5. THUNDERSTORM BACKGROUND (LIGHTNING EFFECT TINTED TO THEME) */}
      {isThunder && (
        <motion.div
          className="absolute inset-0 mix-blend-overlay pointer-events-none"
          style={{
            backgroundColor: themeColor,
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0, 0.6, 0, 0.4, 0, 0, 0, 0.7, 0, 0, 0, 0.5, 0, 0, 0].map(val => val * intensityFactor),
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* 6. SNOWY BACKGROUND */}
      {isSnowy && (
        <div className="absolute inset-0 bg-gradient-to-b from-sky-100/5 to-transparent">
          {snowflakes.map((flake) => (
            <motion.div
              key={flake.id}
              className="absolute bg-white rounded-full"
              style={{
                left: flake.left,
                top: -30,
                width: flake.size,
                height: flake.size,
                opacity: flake.opacity * intensityFactor,
                boxShadow: `0 0 6px ${themeColor}88`,
              }}
              animate={{
                top: ['-30px', '460px'],
                x: [0, 20, -20, 0],
              }}
              transition={{
                top: {
                  duration: flake.duration,
                  delay: flake.delay,
                  repeat: Infinity,
                  ease: "linear",
                },
                x: {
                  duration: flake.duration * 0.6,
                  delay: flake.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
