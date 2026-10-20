import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Layers,
  Crosshair,
  Sliders,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { CharacterPack, SpriteAction } from '../types/sprites';
import { loadImage, processFrameCanvas } from '../utils/imageProcessor';

interface StudioPlayerProps {
  currentPack: CharacterPack;
  selectedAction: SpriteAction;
  setSelectedAction: (act: SpriteAction) => void;
  removeBg: boolean;
  setRemoveBg: (val: boolean) => void;
  bgTolerance: number;
  setBgTolerance: (val: number) => void;
  bgSmoothness: number;
  setBgSmoothness: (val: number) => void;
  onOpenExport: () => void;
}

export const StudioPlayer: React.FC<StudioPlayerProps> = ({
  currentPack,
  selectedAction,
  setSelectedAction,
  removeBg,
  setRemoveBg,
  bgTolerance,
  setBgTolerance,
  bgSmoothness,
  setBgSmoothness,
  onOpenExport,
}) => {
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(10);
  const [zoom, setZoom] = useState<number>(1.5);
  const [loopMode, setLoopMode] = useState<'loop' | 'pingpong' | 'once'>('loop');
  const [pingPongForward, setPingPongForward] = useState<boolean>(true);
  const [showOnionSkin, setShowOnionSkin] = useState<boolean>(false);
  const [showHitbox, setShowHitbox] = useState<boolean>(false);
  const [canvasBg, setCanvasBg] = useState<'checker' | 'dark' | 'light'>('checker');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ghostCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationTimerRef = useRef<number | null>(null);

  const activeActionDef = currentPack.actions[selectedAction] || Object.values(currentPack.actions)[0];
  const frames = activeActionDef?.frames && activeActionDef.frames.length > 0 ? activeActionDef.frames : [];
  const totalFramesCount = Math.max(1, frames.length);
  const currentFrame = frames[currentFrameIdx] || frames[0];
  const prevFrameIdx = (currentFrameIdx - 1 + totalFramesCount) % totalFramesCount;
  const prevFrame = frames[prevFrameIdx];

  // Sync FPS when switching action
  useEffect(() => {
    if (activeActionDef) {
      setFps(activeActionDef.fps || 10);
      setCurrentFrameIdx(0);
    }
  }, [selectedAction, currentPack]);

  // Main animation playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
      return;
    }

    const intervalMs = Math.max(20, Math.round(1000 / fps));
    animationTimerRef.current = window.setInterval(() => {
      setCurrentFrameIdx((prev) => {
        if (loopMode === 'loop') {
          return (prev + 1) % totalFramesCount;
        } else if (loopMode === 'pingpong') {
          if (pingPongForward) {
            if (prev >= totalFramesCount - 1) {
              setPingPongForward(false);
              return Math.max(0, totalFramesCount - 2);
            }
            return prev + 1;
          } else {
            if (prev <= 0) {
              setPingPongForward(true);
              return Math.min(1, totalFramesCount - 1);
            }
            return prev - 1;
          }
        } else {
          // once
          if (prev >= totalFramesCount - 1) {
            setIsPlaying(false);
            return totalFramesCount - 1;
          }
          return prev + 1;
        }
      });
    }, intervalMs);

    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    };
  }, [isPlaying, fps, loopMode, pingPongForward, totalFramesCount]);

  // Render current frame to canvas
  useEffect(() => {
    let isCancelled = false;

    async function draw() {
      if (!canvasRef.current || !currentFrame) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        const sourceImg = await loadImage(activeActionDef.sheetUrl);
        if (isCancelled) return;

        // Process current frame
        const frameCanvas = processFrameCanvas(
          sourceImg,
          currentFrame,
          removeBg,
          bgTolerance,
          bgSmoothness,
          currentFrame.sw,
          currentFrame.sh
        );

        canvas.width = currentFrame.sw;
        canvas.height = currentFrame.sh;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Onion skinning ghost frame
        if (showOnionSkin) {
          const ghostCanvas = processFrameCanvas(
            sourceImg,
            prevFrame,
            removeBg,
            bgTolerance,
            bgSmoothness,
            prevFrame.sw,
            prevFrame.sh
          );
          ctx.globalAlpha = 0.35;
          ctx.drawImage(ghostCanvas, 0, 0);
          ctx.globalAlpha = 1.0;
        }

        ctx.drawImage(frameCanvas, 0, 0);

        // Hitbox overlay
        if (showHitbox) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          const hw = 140;
          const hh = 260;
          const hx = (canvas.width - hw) / 2;
          const hy = canvas.height - hh - 40;
          ctx.strokeRect(hx, hy, hw, hh);

          // Pivot point crosshair
          ctx.setLineDash([]);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          const px = canvas.width / 2;
          const py = canvas.height - 35;
          ctx.beginPath();
          ctx.moveTo(px - 14, py);
          ctx.lineTo(px + 14, py);
          ctx.moveTo(px, py - 14);
          ctx.lineTo(px, py + 14);
          ctx.stroke();
        }
      } catch (err) {
        console.error('Error drawing frame canvas:', err);
      }
    }

    draw();

    return () => {
      isCancelled = true;
    };
  }, [
    currentFrame,
    prevFrame,
    activeActionDef.sheetUrl,
    removeBg,
    bgTolerance,
    bgSmoothness,
    showOnionSkin,
    showHitbox,
  ]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header and Action Switcher Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {currentPack.name}
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>8 Sequential Frames</span>
            <span aria-hidden="true">·</span>
            <span>2D Pixel / Vector Concept Asset</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400 font-mono">1200×896 Source Tileset</span>
          </p>
        </div>

        {/* Action Tabs Segmented Control */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900/90 rounded-lg border border-slate-800">
          {Object.keys(currentPack.actions).map((act) => {
            const isActive = selectedAction === act;
            const def = currentPack.actions[act];
            if (!def) return null;
            return (
              <button
                key={act}
                onClick={() => setSelectedAction(act as SpriteAction)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap capitalize ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {def.title || act} ({def.totalFrames || def.frames?.length || 8})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center: Interactive Viewport */}
        <div className="lg:col-span-8 space-y-4">
          {/* Canvas Stage */}
          <div className="relative border border-slate-800/90 rounded-xl overflow-hidden bg-slate-950 shadow-2xl flex flex-col">
            {/* Viewport Toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold capitalize flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  {selectedAction} Animation
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-300">
                  Frame {currentFrameIdx + 1} / {totalFramesCount}
                </span>
              </div>

              {/* Viewport Mode Toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowOnionSkin(!showOnionSkin)}
                  title="Toggle Onion Skinning"
                  className={`px-2.5 py-1 text-xs rounded border transition-colors flex items-center gap-1 ${
                    showOnionSkin
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Onion Skin</span>
                </button>

                <button
                  onClick={() => setShowHitbox(!showHitbox)}
                  title="Toggle Hitbox / Collision Box"
                  className={`px-2.5 py-1 text-xs rounded border transition-colors flex items-center gap-1 ${
                    showHitbox
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Crosshair className="w-3 h-3" />
                  <span>Hitbox & Pivot</span>
                </button>

                <div className="h-4 w-[1px] bg-slate-800" />

                {/* Background Toggles */}
                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
                  <button
                    onClick={() => setCanvasBg('checker')}
                    title="Transparent Checkerboard"
                    className={`px-1.5 py-0.5 text-[11px] rounded ${
                      canvasBg === 'checker' ? 'bg-slate-700 text-white' : 'text-slate-400'
                    }`}
                  >
                    Alpha
                  </button>
                  <button
                    onClick={() => setCanvasBg('dark')}
                    title="Dark Studio Gray"
                    className={`px-1.5 py-0.5 text-[11px] rounded ${
                      canvasBg === 'dark' ? 'bg-slate-700 text-white' : 'text-slate-400'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setCanvasBg('light')}
                    title="Light Grid"
                    className={`px-1.5 py-0.5 text-[11px] rounded ${
                      canvasBg === 'light' ? 'bg-slate-700 text-white' : 'text-slate-400'
                    }`}
                  >
                    Light
                  </button>
                </div>
              </div>
            </div>

            {/* Viewport Center Area */}
            <div
              className={`relative flex items-center justify-center p-8 min-h-[460px] overflow-hidden ${
                canvasBg === 'checker'
                  ? 'canvas-checkerboard'
                  : canvasBg === 'light'
                  ? 'canvas-checkerboard-light'
                  : 'bg-[#181b22]'
              }`}
            >
              {/* Ground guideline */}
              <div className="absolute bottom-16 left-0 right-0 h-[1px] bg-slate-700/40 pointer-events-none" />

              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="relative flex items-center justify-center pixelated"
              >
                <canvas
                  ref={canvasRef}
                  className="rounded shadow-xl max-w-none"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>

              {/* Zoom pill overlay */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 bg-slate-900/90 border border-slate-800 rounded text-[11px] font-mono text-slate-400">
                <span>Zoom:</span>
                <button
                  onClick={() => setZoom(Math.max(0.75, zoom - 0.25))}
                  className="px-1 hover:text-white"
                >
                  -
                </button>
                <span className="text-amber-400">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                  className="px-1 hover:text-white"
                >
                  +
                </button>
              </div>
            </div>

            {/* Playback Transport Bar */}
            <div className="p-4 bg-slate-900/95 border-t border-slate-800 space-y-3">
              {/* Scrubber */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">
                    {currentFrame.phaseLabel}
                  </span>
                  <span className="font-mono text-amber-400 tabular-nums">
                    Frame {currentFrameIdx + 1} of 8 ({(1000 / fps).toFixed(0)}ms)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="7"
                    step="1"
                    value={currentFrameIdx}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setCurrentFrameIdx(parseInt(e.target.value, 10));
                    }}
                    className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Transport Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentFrameIdx(0);
                    }}
                    title="Jump to Start"
                    className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentFrameIdx((prev) => (prev - 1 + totalFramesCount) % totalFramesCount);
                    }}
                    title="Step Previous Frame"
                    className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-bold rounded-md flex items-center gap-2 shadow-md transition-all text-xs"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Play (Space)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentFrameIdx((prev) => (prev + 1) % totalFramesCount);
                    }}
                    title="Step Next Frame"
                    className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* FPS Control */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Speed:</span>
                    <input
                      type="range"
                      min="2"
                      max="24"
                      step="1"
                      value={fps}
                      onChange={(e) => setFps(parseInt(e.target.value, 10))}
                      className="w-24 accent-amber-400 bg-slate-800 h-1 rounded cursor-pointer"
                    />
                    <span className="font-mono text-xs text-white tabular-nums w-12 text-right">
                      {fps} FPS
                    </span>
                  </div>

                  <div className="h-4 w-[1px] bg-slate-800" />

                  {/* Loop Mode Selector */}
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-xs">
                    {(['loop', 'pingpong', 'once'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setLoopMode(m);
                          if (!isPlaying) setIsPlaying(true);
                        }}
                        className={`px-2 py-1 rounded text-[11px] capitalize ${
                          loopMode === m
                            ? 'bg-slate-800 text-amber-300 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filmstrip Thumbnails */}
          <div className="border border-slate-800/80 rounded-xl p-4 bg-slate-900/50 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200">
                {totalFramesCount}-Frame Sequence Filmstrip
              </span>
              <span>Click any frame to inspect</span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {frames.map((f, i) => {
                const isSelected = currentFrameIdx === i;
                const sheetW = (activeActionDef.cols || 4) * (activeActionDef.frameWidth || 300);
                const sheetH = (activeActionDef.rows || 2) * (activeActionDef.frameHeight || 448);
                const scaleDiv = 3;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentFrameIdx(i);
                    }}
                    className={`group relative flex flex-col items-center rounded-lg border p-1.5 transition-all text-left ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-400/10'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-full aspect-[3/4] overflow-hidden rounded bg-slate-900/80 canvas-checkerboard relative flex items-center justify-center">
                      <div
                        style={{
                          backgroundImage: `url(${activeActionDef.sheetUrl})`,
                          backgroundPosition: `-${f.sx / scaleDiv}px -${f.sy / scaleDiv}px`,
                          backgroundSize: `${sheetW / scaleDiv}px ${sheetH / scaleDiv}px`,
                          width: `${(f.sw || 300) / scaleDiv}px`,
                          height: `${(f.sh || 448) / scaleDiv}px`,
                        }}
                        className="transform scale-90"
                      />
                    </div>
                    <div className="w-full mt-1.5 text-center">
                      <span className="block text-[11px] font-mono text-slate-300">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Settings & Motion Metadata */}
        <div className="lg:col-span-4 space-y-4">
          {/* Background Removal Studio Panel */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">
                  Clean PNG Alpha Masking
                </h2>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeBg}
                  onChange={(e) => setRemoveBg(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-400"></div>
              </label>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Dynamically strips the solid studio backdrop into a transparent alpha PNG
              while preserving soft feathered wings and silver hair.
            </p>

            {removeBg && (
              <div className="space-y-4 pt-2 border-t border-slate-800/80">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Color Threshold</span>
                    <span className="font-mono text-amber-400">{bgTolerance}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={bgTolerance}
                    onChange={(e) => setBgTolerance(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Edge Feathering & Despill</span>
                    <span className="font-mono text-amber-400">{bgSmoothness}px</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="35"
                    value={bgSmoothness}
                    onChange={(e) => setBgSmoothness(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Active Frame Kinematics & Phase Card */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/80 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Frame Kinematics</span>
            </h2>

            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Phase Label:</span>
                <span className="text-slate-200 font-semibold">{currentFrame.phaseLabel}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Source Crop (X, Y):</span>
                <span className="font-mono text-slate-300">
                  {currentFrame.sx}px, {currentFrame.sy}px
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Cell Resolution:</span>
                <span className="font-mono text-slate-300">
                  {currentFrame.sw} × {currentFrame.sh} px
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Frame Duration:</span>
                <span className="font-mono text-amber-400">
                  {(1000 / fps).toFixed(1)} ms
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {activeActionDef.description}
            </p>
          </div>

          {/* Quick Export CTA */}
          <div className="border border-amber-500/30 rounded-xl p-5 bg-amber-500/5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Ready to Export Tileset?</h2>
            <p className="text-xs text-slate-400">
              Download the complete 24-frame matrix in clean transparent PNG format or as
              individual files ready for your game engine.
            </p>
            <button
              onClick={onOpenExport}
              className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-slate-950 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-2"
            >
              <span>Open Tileset Exporter & Downloads</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
