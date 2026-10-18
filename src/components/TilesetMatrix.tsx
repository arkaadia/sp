import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Copy,
  Check,
  FileCode,
  Image as ImageIcon,
  Archive,
  Grid,
  Maximize2
} from 'lucide-react';
import { CharacterPack, ExportSettings, SpriteAction } from '../types/sprites';
import {
  buildSeparateStrips,
  buildTilesetCanvas,
  generateEngineMetadata,
  generateZipPackage
} from '../utils/imageProcessor';

interface TilesetMatrixProps {
  currentPack: CharacterPack;
  removeBg: boolean;
  bgTolerance: number;
  bgSmoothness: number;
}

export const TilesetMatrix: React.FC<TilesetMatrixProps> = ({
  currentPack,
  removeBg,
  bgTolerance,
  bgSmoothness,
}) => {
  const [layout, setLayout] = useState<'grid' | 'horizontal_strip'>('grid');
  const [bgColor, setBgColor] = useState<'transparent' | 'dark' | 'black' | 'white'>('transparent');
  const [targetSize, setTargetSize] = useState<number>(256);
  const [enginePreset, setEnginePreset] = useState<'unity' | 'godot' | 'phaser' | 'css'>('phaser');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [tilesetDimensions, setTilesetDimensions] = useState<{ width: number; height: number }>({
    width: 2048,
    height: 768,
  });

  const exportSettings: ExportSettings = {
    layout,
    removeBackground: removeBg,
    bgTolerance,
    bgSmoothness,
    targetCellSize: targetSize,
    backgroundColor: bgColor,
    format: 'png',
    enginePreset,
  };

  // Generate preview tileset canvas
  useEffect(() => {
    let cancelled = false;

    async function generate() {
      setIsGenerating(true);
      try {
        const result = await buildTilesetCanvas(currentPack, exportSettings);
        if (!cancelled) {
          setPreviewDataUrl(result.dataUrl);
          setTilesetDimensions({ width: result.width, height: result.height });
        }
      } catch (err) {
        console.error('Failed to generate tileset preview:', err);
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    }

    generate();

    return () => {
      cancelled = true;
    };
  }, [currentPack, layout, bgColor, targetSize, removeBg, bgTolerance, bgSmoothness]);

  const handleDownloadTilesetPng = () => {
    if (!previewDataUrl) return;
    const a = document.createElement('a');
    a.href = previewDataUrl;
    a.download = `${currentPack.id}_tileset_8x3_clean.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadZip = async () => {
    setIsGenerating(true);
    try {
      const blob = await generateZipPackage(currentPack, exportSettings);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentPack.id}_24_frames_package.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create zip package:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadSeparateStrips = async () => {
    setIsGenerating(true);
    try {
      const strips = await buildSeparateStrips(currentPack, exportSettings);
      const actions: SpriteAction[] = ['idle', 'run', 'jump', 'attack', 'climb', 'defense'];
      actions.forEach((act) => {
        const data = strips[act];
        if (data) {
          const a = document.createElement('a');
          a.href = data.dataUrl;
          a.download = `${currentPack.id}_${act}_8frames_strip.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      });
    } catch (err) {
      console.error('Failed to generate separate strips:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const metadataCode = generateEngineMetadata(currentPack, enginePreset, exportSettings);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(metadataCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Title & Metadata */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Clean 48-Frame PNG Tileset Matrix
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>6 Actions (Idle, Run, Jump, Attack, Climb, Defense)</span>
            <span aria-hidden="true">·</span>
            <span>8 Frames Each</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-400">
              {tilesetDimensions.width} × {tilesetDimensions.height} px
            </span>
          </p>
        </div>

        {/* Action Download Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDownloadSeparateStrips}
            disabled={isGenerating}
            className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all rounded-md flex items-center gap-1.5 border border-slate-700"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>6 Horizontal Strips</span>
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={isGenerating}
            className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all rounded-md flex items-center gap-1.5 border border-slate-700"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>All 48 Frames (.ZIP)</span>
          </button>

          <button
            onClick={handleDownloadTilesetPng}
            disabled={isGenerating || !previewDataUrl}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all rounded-md flex items-center gap-2 shadow-lg shadow-amber-400/10"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Master PNG</span>
          </button>
        </div>
      </div>

      {/* Tileset Layout & Config Controls */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
        {/* Layout Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Layout Format:</span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setLayout('grid')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                layout === 'grid'
                  ? 'bg-slate-800 text-amber-300 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              8×3 Grid Matrix (Standard)
            </button>
            <button
              onClick={() => setLayout('horizontal_strip')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                layout === 'horizontal_strip'
                  ? 'bg-slate-800 text-amber-300 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              24×1 Full Horizontal Strip
            </button>
          </div>
        </div>

        {/* Background Options */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Background:</span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(['transparent', 'dark', 'black', 'white'] as const).map((bg) => (
              <button
                key={bg}
                onClick={() => setBgColor(bg)}
                className={`px-2.5 py-1 text-xs font-medium rounded capitalize ${
                  bgColor === bg
                    ? 'bg-slate-800 text-amber-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {bg === 'transparent' ? 'Clean Alpha' : bg}
              </button>
            ))}
          </div>
        </div>

        {/* Target Cell Dimension */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Cell Dimension:</span>
          <select
            value={targetSize}
            onChange={(e) => setTargetSize(parseInt(e.target.value, 10))}
            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
          >
            <option value={128}>128×128 px (Lightweight)</option>
            <option value={256}>256×256 px (Recommended)</option>
            <option value={320}>320×320 px (High Resolution)</option>
          </select>
        </div>
      </div>

      {/* Main Tileset Canvas Display */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">Interactive Tileset Surface</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-400">
              Row 1: Idle (01-08) · Row 2: Run (01-08) · Row 3: Jump (01-08)
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            {isGenerating ? (
              <span className="text-amber-400 font-mono text-xs">Compiling Canvas...</span>
            ) : (
              <span className="font-mono text-xs text-slate-300">
                Ready to Save (PNG-32)
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Tileset Preview */}
        <div
          className={`p-6 overflow-auto max-h-[620px] flex items-center justify-center ${
            bgColor === 'transparent'
              ? 'canvas-checkerboard'
              : bgColor === 'dark'
              ? 'bg-[#1c1f26]'
              : bgColor === 'black'
              ? 'bg-black'
              : 'bg-white'
          }`}
        >
          {previewDataUrl ? (
            <img
              src={previewDataUrl}
              alt="2D Sprite Sheet Tileset"
              className="max-w-none shadow-2xl rounded border border-slate-700/50"
              style={{
                imageRendering: 'pixelated',
                height: layout === 'horizontal_strip' ? `${targetSize}px` : 'auto',
              }}
            />
          ) : (
            <div className="py-24 text-center text-slate-500 font-mono text-xs">
              Rendering Tileset...
            </div>
          )}
        </div>
      </div>

      {/* Game Engine Code & Export Metadata Section */}
      <div className="border border-slate-800 rounded-xl p-6 bg-slate-900/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileCode className="w-4 h-4 text-amber-400" />
              <span>Game Engine Integrations & Metadata</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select your engine to get copy-paste ready atlas definitions or CSS animations.
            </p>
          </div>

          {/* Preset Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
            {(['phaser', 'godot', 'unity', 'css'] as const).map((eng) => (
              <button
                key={eng}
                onClick={() => setEnginePreset(eng)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all uppercase ${
                  enginePreset === eng
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {eng === 'css' ? 'CSS Keyframes' : eng}
              </button>
            ))}
          </div>
        </div>

        {/* Code Box with Copy Button */}
        <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs">
            <span className="font-mono text-slate-400">
              {enginePreset === 'phaser' && 'phaser3_atlas.json'}
              {enginePreset === 'godot' && 'godot_spriteframes.tres.json'}
              {enginePreset === 'unity' && 'unity_spritesheet.meta.json'}
              {enginePreset === 'css' && 'sprite_animation.css'}
            </span>

            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-[280px] leading-relaxed">
            {metadataCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
