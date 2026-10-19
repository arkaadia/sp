import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Upload,
  Layers,
  Sliders,
  RotateCcw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Download,
  Sparkles,
  MoveHorizontal,
  Maximize2,
  Minimize2,
  Gamepad2,
  Repeat,
  Image as ImageIcon,
  Check
} from 'lucide-react';
import { CharacterPack } from '../types/sprites';

// Interface for each parallax background layer
export interface ParallaxLayer {
  id: string;
  name: string;
  imageUrl: string;
  scrollSpeed: number; // Multiplier, e.g. 0.1x to 2.5x
  opacity: number; // 0.0 to 1.0
  visible: boolean;
  verticalAlign: 'top' | 'center' | 'bottom';
  yOffset: number; // -100px to +100px
  scalePercent: number; // 50% to 200%
}

// Built-in seamless procedural SVG layers for pre-configured environment themes
const createSvgDataUrl = (svgString: string): string => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
};

// Preset 1: Mythic Sunset Peaks (4 Seamless Layers)
const SUNSET_SKY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#140b2a"/>
      <stop offset="40%" stop-color="#3d1b54"/>
      <stop offset="70%" stop-color="#822d5f"/>
      <stop offset="90%" stop-color="#d45b4b"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect width="800" height="500" fill="url(#sky)"/>
  <circle cx="620" cy="120" r="48" fill="#fef08a" opacity="0.85"/>
  <circle cx="600" cy="115" r="46" fill="#140b2a" opacity="0.6"/>
  <!-- Stars -->
  <circle cx="80" cy="50" r="1.5" fill="#ffffff" opacity="0.8"/>
  <circle cx="160" cy="90" r="2" fill="#ffffff" opacity="0.7"/>
  <circle cx="280" cy="40" r="1.5" fill="#fef08a" opacity="0.9"/>
  <circle cx="420" cy="70" r="2" fill="#ffffff" opacity="0.8"/>
  <circle cx="500" cy="30" r="1.5" fill="#ffffff" opacity="0.7"/>
  <circle cx="720" cy="60" r="2" fill="#fef08a" opacity="0.85"/>
  <!-- Distant Clouds -->
  <path d="M 0 160 Q 60 140 120 160 Q 180 180 240 160 Q 300 135 380 160 Q 460 175 540 155 Q 620 140 700 160 Q 760 175 800 160 L 800 230 L 0 230 Z" fill="#b45309" opacity="0.25"/>
</svg>`;

const SUNSET_FAR_MOUNTAINS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <path d="M 0 310 L 70 230 L 140 290 L 230 180 L 320 270 L 410 200 L 490 280 L 580 190 L 670 260 L 740 220 L 800 310 L 800 500 L 0 500 Z" fill="#4a1d47" opacity="0.9"/>
  <path d="M 230 180 L 260 220 L 280 200 L 320 270 Z" fill="#702459" opacity="0.5"/>
  <path d="M 580 190 L 610 230 L 630 210 L 670 260 Z" fill="#702459" opacity="0.5"/>
</svg>`;

const SUNSET_MID_TREES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <!-- Midground Pine Ridge - Seamless edges at Y=370 -->
  <path d="M 0 370 L 30 340 L 45 355 L 75 320 L 105 360 L 140 330 L 180 375 L 220 340 L 260 380 L 300 325 L 340 365 L 390 335 L 430 375 L 480 330 L 520 370 L 570 340 L 610 380 L 660 330 L 710 370 L 760 335 L 800 370 L 800 500 L 0 500 Z" fill="#24122d"/>
  <!-- Castle Ruins in Midground -->
  <rect x="330" y="300" width="35" height="40" fill="#1b0c22"/>
  <polygon points="325,300 347,270 370,300" fill="#1b0c22"/>
  <rect x="343" y="315" width="8" height="15" fill="#f59e0b" opacity="0.7"/>
</svg>`;

const SUNSET_GROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <!-- Foreground ground - Seamless edges at Y=410 -->
  <path d="M 0 410 Q 100 405 200 415 Q 300 425 400 410 Q 500 400 600 415 Q 700 425 800 410 L 800 500 L 0 500 Z" fill="#130819"/>
  <!-- Grass Blades & Flowers -->
  <path d="M 20 408 L 22 396 L 25 408 M 80 405 L 83 392 L 86 405 M 150 410 L 152 395 L 156 410 M 260 418 L 262 402 L 265 418 M 380 411 L 382 398 L 386 411 M 510 405 L 513 390 L 517 405 M 650 416 L 653 400 L 657 416 M 750 412 L 753 397 L 757 412" stroke="#4a2155" stroke-width="2.5" fill="none"/>
  <!-- Glowing Fireflies -->
  <circle cx="120" cy="380" r="2" fill="#fbbf24" opacity="0.9"/>
  <circle cx="340" cy="390" r="2.5" fill="#fbbf24" opacity="0.8"/>
  <circle cx="590" cy="375" r="2" fill="#fbbf24" opacity="0.95"/>
  <circle cx="710" cy="385" r="1.5" fill="#fbbf24" opacity="0.75"/>
</svg>`;

// Preset 2: Enchanted Moonlit Forest
const FOREST_SKY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="fsky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#05141c"/>
      <stop offset="60%" stop-color="#0a2a35"/>
      <stop offset="100%" stop-color="#0e3d48"/>
    </linearGradient>
  </defs>
  <rect width="800" height="500" fill="url(#fsky)"/>
  <circle cx="180" cy="130" r="54" fill="#a7f3d0" opacity="0.85"/>
  <circle cx="160" cy="120" r="54" fill="#05141c" opacity="0.75"/>
  <circle cx="380" cy="60" r="2" fill="#6ee7b7" opacity="0.8"/>
  <circle cx="560" cy="100" r="1.5" fill="#ffffff" opacity="0.9"/>
  <circle cx="680" cy="50" r="2" fill="#a7f3d0" opacity="0.7"/>
</svg>`;

const FOREST_MIST_TREES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <path d="M 0 330 Q 150 310 300 330 Q 450 350 600 320 Q 700 310 800 330 L 800 500 L 0 500 Z" fill="#09313a" opacity="0.8"/>
  <!-- Distant tree trunks -->
  <rect x="90" y="240" width="16" height="150" fill="#062229" opacity="0.6"/>
  <rect x="240" y="220" width="22" height="170" fill="#062229" opacity="0.6"/>
  <rect x="440" y="230" width="18" height="160" fill="#062229" opacity="0.6"/>
  <rect x="680" y="210" width="24" height="180" fill="#062229" opacity="0.6"/>
</svg>`;

const FOREST_CANOPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <path d="M 0 380 L 50 350 L 100 390 L 180 340 L 260 400 L 350 335 L 450 390 L 550 345 L 650 405 L 730 350 L 800 380 L 800 500 L 0 500 Z" fill="#061c22"/>
  <!-- Glowing mushrooms -->
  <circle cx="120" cy="385" r="4" fill="#34d399"/>
  <circle cx="380" cy="375" r="5" fill="#38bdf8"/>
  <circle cx="620" cy="390" r="4.5" fill="#34d399"/>
</svg>`;

const FOREST_GROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <path d="M 0 420 Q 180 410 360 425 Q 540 435 720 415 L 800 420 L 800 500 L 0 500 Z" fill="#030f13"/>
  <path d="M 50 418 L 52 405 M 120 415 L 123 400 M 280 422 L 282 408 M 460 428 L 463 412 M 640 417 L 643 402" stroke="#0e4f5c" stroke-width="3" fill="none"/>
</svg>`;

const PRESET_THEMES: Record<string, { name: string; description: string; layers: ParallaxLayer[] }> = {
  sunset: {
    name: 'Mythic Sunset Valley',
    description: '4-layer fantasy sunset with distant jagged peaks and a pine castle ridgeline.',
    layers: [
      {
        id: 'layer_sunset_1',
        name: 'Layer 1: Sky & Crescent Moon (Back)',
        imageUrl: createSvgDataUrl(SUNSET_SKY_SVG),
        scrollSpeed: 0.1,
        opacity: 1.0,
        visible: true,
        verticalAlign: 'top',
        yOffset: 0,
        scalePercent: 100,
      },
      {
        id: 'layer_sunset_2',
        name: 'Layer 2: Distant Peaks (Mid-Back)',
        imageUrl: createSvgDataUrl(SUNSET_FAR_MOUNTAINS_SVG),
        scrollSpeed: 0.35,
        opacity: 1.0,
        visible: true,
        verticalAlign: 'center',
        yOffset: 0,
        scalePercent: 100,
      },
      {
        id: 'layer_sunset_3',
        name: 'Layer 3: Castle & Pine Ridge (Mid)',
        imageUrl: createSvgDataUrl(SUNSET_MID_TREES_SVG),
        scrollSpeed: 0.75,
        opacity: 1.0,
        visible: true,
        verticalAlign: 'center',
        yOffset: 0,
        scalePercent: 100,
      },
      {
        id: 'layer_sunset_4',
        name: 'Layer 4: Ground & Flora (Front)',
        imageUrl: createSvgDataUrl(SUNSET_GROUND_SVG),
        scrollSpeed: 1.25,
        opacity: 1.0,
        visible: true,
        verticalAlign: 'bottom',
        yOffset: 0,
        scalePercent: 100,
      },
    ],
  },
  forest: {
    name: 'Enchanted Moonlit Forest',
    description: '4-layer mystical teal night forest with glowing spores and ancient willow silhouettes.',
    layers: [
      {
        id: 'layer_forest_1',
        name: 'Layer 1: Starry Teal Sky (Back)',
        imageUrl: createSvgDataUrl(FOREST_SKY_SVG),
        scrollSpeed: 0.1,
        opacity: 1.0,
        visible: true,
        verticalAlign: 'top',
        yOffset: 0,
        scalePercent: 100,
      },
      {
        id: 'layer_forest_2',
        name: 'Layer 2: Mist & Distant Trunks (Mid-Back)',
        imageUrl: createSvgDataUrl(FOREST_MIST_TREES_SVG),
        scrollSpeed: 0.35,
        opacity: 1.0,
        visible: true,
        verticalAlign: 'center',
        yOffset: 0,
        scalePercent: 100,
      },
      {
        id: 'layer_forest_3',
        name: 'Layer 3: Glowing Canopy (Mid)',
        imageUrl: createSvgDataUrl(FOREST_CANOPY_SVG),
        scrollSpeed: 0.75,
        opacity: 1.0,
        visible: true,
        verticalAlign: 'center',
        yOffset: 0,
        scalePercent: 100,
      },
      {
        id: 'layer_forest_4',
        name: 'Layer 4: Mossy Ground (Front)',
        imageUrl: createSvgDataUrl(FOREST_GROUND_SVG),
        scrollSpeed: 1.25,
        opacity: 1.0,
        visible: true,
        verticalAlign: 'bottom',
        yOffset: 0,
        scalePercent: 100,
      },
    ],
  },
};

interface EnvironmentParallaxViewProps {
  currentPack?: CharacterPack;
}

export const EnvironmentParallaxView: React.FC<EnvironmentParallaxViewProps> = ({ currentPack }) => {
  // Parallax layers state
  const [layers, setLayers] = useState<ParallaxLayer[]>(PRESET_THEMES.sunset.layers);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('sunset');

  // Animation & Scrolling State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [baseSpeed, setBaseSpeed] = useState<number>(65); // Base pixels per second
  const [direction, setDirection] = useState<1 | -1>(1); // 1 = Left-to-right camera motion (layers move left)

  // Seamless repeat toggle
  const [seamlessRepeat, setSeamlessRepeat] = useState<boolean>(true);

  // Optional Character on Ground
  const [showCharacter, setShowCharacter] = useState<boolean>(true);

  // Viewport Zoom
  const [viewportZoom, setViewportZoom] = useState<number>(1.0);

  // Scroll offset accumulator in pixels
  const scrollOffsetRef = useRef<number>(0);
  const [scrollDisplayOffset, setScrollDisplayOffset] = useState<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const animationFrameRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [copiedJsonSuccess, setCopiedJsonSuccess] = useState<boolean>(false);

  // 60FPS Parallax render loop
  const animate = useCallback((currentTime: number) => {
    const deltaTime = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1); // clamp to max 100ms
    lastTimeRef.current = currentTime;

    if (isPlaying) {
      scrollOffsetRef.current += baseSpeed * deltaTime * direction;
      setScrollDisplayOffset(scrollOffsetRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [isPlaying, baseSpeed, direction]);

  useEffect(() => {
    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate]);

  // Handle Preset Switching
  const handleSelectPreset = (presetKey: string) => {
    if (PRESET_THEMES[presetKey]) {
      setSelectedPresetKey(presetKey);
      setLayers(PRESET_THEMES[presetKey].layers);
      scrollOffsetRef.current = 0;
      setScrollDisplayOffset(0);
    }
  };

  // Update specific layer speed
  const handleUpdateLayerSpeed = (id: string, speed: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, scrollSpeed: Math.max(0, Math.min(3.0, speed)) } : l))
    );
  };

  // Update layer name
  const handleUpdateLayerName = (id: string, name: string) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
  };

  // Toggle layer visibility
  const handleToggleLayerVisibility = (id: string) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  };

  // Reorder layer: move up (closer to front)
  const handleMoveLayerUp = (index: number) => {
    if (index >= layers.length - 1) return;
    setLayers((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  // Reorder layer: move down (further back)
  const handleMoveLayerDown = (index: number) => {
    if (index <= 0) return;
    setLayers((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  // Delete layer
  const handleDeleteLayer = (id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
  };

  // Upload Custom Layer Image
  const handleUploadCustomLayer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const newLayer: ParallaxLayer = {
      id: `custom_layer_${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, '') || `Layer ${layers.length + 1} (Custom)`,
      imageUrl: url,
      scrollSpeed: 0.8,
      opacity: 1.0,
      visible: true,
      verticalAlign: 'center',
      yOffset: 0,
      scalePercent: 100,
    };

    setLayers((prev) => [...prev, newLayer]);
  };

  // Export Parallax Configuration as JSON
  const handleExportJson = () => {
    const config = {
      name: 'Elysian Parallax Environment',
      baseSpeed,
      seamlessRepeat,
      exportedAt: new Date().toISOString(),
      layers: layers.map((l, idx) => ({
        index: idx,
        id: l.id,
        name: l.name,
        scrollSpeed: l.scrollSpeed,
        opacity: l.opacity,
        visible: l.visible,
        verticalAlign: l.verticalAlign,
        yOffset: l.yOffset,
      })),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parallax_environment_${selectedPresetKey}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <MoveHorizontal className="w-6 h-6 text-amber-400" />
            <span>Environment & Parallax Studio</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
            <span>Wide 2D Environment Viewport</span>
            <span aria-hidden="true">·</span>
            <span>Multi-Layer Depth Simulation</span>
            <span aria-hidden="true">·</span>
            <span>Per-Layer Scroll Speed Sliders</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-400">Seamless Tiling</span>
          </p>
        </div>

        {/* Global Controls: Play/Pause, Seamless Repeat Toggle, Export */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seamless Repeat Toggle Switch */}
          <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 cursor-pointer select-none group">
            <Repeat className="w-3.5 h-3.5 text-amber-400" />
            <span>Seamless Repeat</span>
            <div className="relative inline-flex items-center ml-1">
              <input
                type="checkbox"
                checked={seamlessRepeat}
                onChange={(e) => setSeamlessRepeat(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-800 border border-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 peer-checked:after:bg-slate-950 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-400 peer-checked:border-amber-400"></div>
            </div>
          </label>

          {/* Play / Pause Parallax Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer ${
              isPlaying
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/10'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/10'
            }`}
            title="Toggle parallax scrolling animation (Spacebar)"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause Parallax</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Play Parallax</span>
              </>
            )}
          </button>

          {/* Export JSON Button */}
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
            title="Export Parallax layer speeds and configuration"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Config (.JSON)</span>
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Left Sidebar (Col 4) & Wide Viewport (Col 8) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Layers & Speed Controls (Col 4) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/90 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Background Layers ({layers.length})</span>
              </h2>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded text-xs font-bold transition-all"
                title="Upload PNG, JPG, or SVG layer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Layer</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadCustomLayer}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
              />
            </div>

            {/* Environment Preset Theme Selector */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 flex items-center justify-between">
                <span>Select Environment Theme:</span>
                <span className="text-[10px] text-amber-400 font-mono">Ready-to-Scroll</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPreset('sunset')}
                  className={`p-2 rounded-lg border text-xs font-semibold text-left transition-all ${
                    selectedPresetKey === 'sunset'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="truncate">Sunset Peaks</p>
                  <span className="text-[10px] font-normal text-slate-500">4 Layers • Warm</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset('forest')}
                  className={`p-2 rounded-lg border text-xs font-semibold text-left transition-all ${
                    selectedPresetKey === 'forest'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="truncate">Moonlit Forest</p>
                  <span className="text-[10px] font-normal text-slate-500">4 Layers • Teal</span>
                </button>
              </div>
            </div>

            {/* Base Speed & Direction Controls */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Master Parallax Speed:</span>
                <span className="font-mono text-amber-400 font-bold">{baseSpeed} px/sec</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                step="5"
                value={baseSpeed}
                onChange={(e) => setBaseSpeed(parseInt(e.target.value, 10))}
                className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded cursor-pointer"
              />

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400 text-[11px]">Scroll Direction:</span>
                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDirection(1)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      direction === 1 ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Rightwards (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection(-1)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      direction === -1 ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Leftwards
                  </button>
                </div>
              </div>
            </div>

            {/* Layer Stack (from Front to Back) */}
            <div className="space-y-3 pt-2 border-t border-slate-800 max-h-[460px] overflow-y-auto pr-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Render Order (Top = Front, Bottom = Back):
              </span>

              {layers.slice().reverse().map((layer, reverseIdx) => {
                const actualIndex = layers.length - 1 - reverseIdx;

                return (
                  <div
                    key={layer.id}
                    className={`p-3 rounded-lg border transition-all space-y-2.5 ${
                      layer.visible
                        ? 'border-slate-800 bg-slate-950/90 shadow-sm'
                        : 'border-slate-900 bg-slate-950/40 opacity-50'
                    }`}
                  >
                    {/* Layer Header: Name & Visibility & Reorder Controls */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <button
                          type="button"
                          onClick={() => handleToggleLayerVisibility(layer.id)}
                          className="text-slate-400 hover:text-white p-0.5"
                          title={layer.visible ? 'Hide layer' : 'Show layer'}
                        >
                          {layer.visible ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <input
                          type="text"
                          value={layer.name}
                          onChange={(e) => handleUpdateLayerName(layer.id, e.target.value)}
                          className="bg-transparent text-xs font-semibold text-white focus:outline-none focus:border-b border-amber-400 truncate w-full"
                        />
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Move Up */}
                        <button
                          type="button"
                          disabled={actualIndex >= layers.length - 1}
                          onClick={() => handleMoveLayerUp(actualIndex)}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          title="Bring Layer Forward"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        {/* Move Down */}
                        <button
                          type="button"
                          disabled={actualIndex <= 0}
                          onClick={() => handleMoveLayerDown(actualIndex)}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                          title="Send Layer Backward"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteLayer(layer.id)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                          title="Delete Layer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Thumbnail & Scroll Speed Slider Row */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-9 rounded overflow-hidden border border-slate-800 bg-[#0c0e14] shrink-0 flex items-center justify-center">
                        <img
                          src={layer.imageUrl}
                          alt={layer.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Scroll Speed Slider */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-medium">Scroll Speed</span>
                          <span className="font-mono text-amber-300 font-bold text-[11px]">
                            {layer.scrollSpeed.toFixed(2)}×
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.0"
                          max="2.5"
                          step="0.05"
                          value={layer.scrollSpeed}
                          onChange={(e) => handleUpdateLayerSpeed(layer.id, parseFloat(e.target.value))}
                          className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Wide Parallax Viewport (Col 8) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-2xl flex flex-col">
            {/* Viewport Top Bar */}
            <div className="px-5 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-white">2D Parallax Environment Viewport</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/30 font-mono text-[10px]">
                  {isPlaying ? 'Auto-Scrolling (60 FPS)' : 'Paused'}
                </span>
              </div>

              {/* Viewport controls */}
              <div className="flex items-center gap-3">
                {/* Character on ground toggle */}
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                  <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px]">Character Preview</span>
                  <input
                    type="checkbox"
                    checked={showCharacter}
                    onChange={(e) => setShowCharacter(e.target.checked)}
                    className="accent-amber-400 rounded"
                  />
                </label>

                {/* Reset Camera position */}
                <button
                  type="button"
                  onClick={() => {
                    scrollOffsetRef.current = 0;
                    setScrollDisplayOffset(0);
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                  title="Reset scroll camera to X=0"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Origin</span>
                </button>
              </div>
            </div>

            {/* The Main Wide Viewport Stage (16:9 / Ultra-Wide Responsive Canvas) */}
            <div
              className="relative w-full aspect-[16/9] min-h-[380px] max-h-[560px] overflow-hidden bg-[#0d0714] select-none shadow-inner"
              style={{
                perspective: '1000px',
              }}
            >
              {/* Parallax Layers Container */}
              <div className="absolute inset-0 w-full h-full pointer-events-none">
                {layers.map((layer) => {
                  if (!layer.visible) return null;

                  // Compute current layer horizontal offset in pixels
                  const layerOffset = scrollDisplayOffset * layer.scrollSpeed;

                  return (
                    <div
                      key={layer.id}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{
                        opacity: layer.opacity,
                        backgroundImage: `url("${layer.imageUrl}")`,
                        backgroundRepeat: seamlessRepeat ? 'repeat-x' : 'no-repeat',
                        backgroundPosition: `${-layerOffset}px ${
                          layer.verticalAlign === 'top'
                            ? 'top'
                            : layer.verticalAlign === 'bottom'
                            ? 'bottom'
                            : 'center'
                        }`,
                        backgroundSize: 'auto 100%',
                        imageRendering: 'pixelated',
                      }}
                    />
                  );
                })}
              </div>

              {/* Optional Animated Character Running/Idling on the Ground */}
              {showCharacter && (
                <div
                  className="absolute bottom-10 left-28 z-30 pointer-events-none flex flex-col items-center"
                  style={{
                    filter: 'drop-shadow(0 10px 8px rgba(0,0,0,0.6))',
                  }}
                >
                  {/* Subtle running shadow */}
                  <div className="w-14 h-3 bg-black/50 rounded-full blur-[2px] mt-24" />

                  {/* Character Avatar or sprite */}
                  <div className="absolute bottom-2 flex flex-col items-center animate-bounce">
                    <img
                      src={
                        currentPack?.actions?.run?.sheetUrl ||
                        currentPack?.avatarUrl ||
                        '/src/assets/images/elf_white_wings_run_1792302187930.jpg'
                      }
                      alt="Player Character"
                      className="w-20 h-24 object-contain pixelated"
                    />
                  </div>
                </div>
              )}

              {/* Vignette Overlay for Depth */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/50 via-transparent to-black/30" />
            </div>

            {/* Bottom Live Metrics & Help Strip */}
            <div className="px-5 py-2.5 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="text-amber-400">
                  Global Camera X: {Math.round(scrollDisplayOffset)} px
                </span>
                <span className="text-slate-600">|</span>
                <span>Active Layers: {layers.filter((l) => l.visible).length} of {layers.length}</span>
                <span className="text-slate-600">|</span>
                <span className={seamlessRepeat ? 'text-emerald-400' : 'text-slate-400'}>
                  Tiling: {seamlessRepeat ? 'Infinite Seamless Repeat' : 'Clamped'}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Tip: Higher scroll speeds in the foreground create realistic 2.5D optical parallax.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
