import React, { useState } from 'react';
import { X, Download, Archive, ImageIcon, Check, Copy } from 'lucide-react';
import { CharacterPack, ExportSettings } from '../types/sprites';
import {
  buildSeparateStrips,
  buildTilesetCanvas,
  generateEngineMetadata,
  generateZipPackage
} from '../utils/imageProcessor';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPack: CharacterPack;
  removeBg: boolean;
  bgTolerance: number;
  bgSmoothness: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  currentPack,
  removeBg,
  bgTolerance,
  bgSmoothness,
}) => {
  const [layout, setLayout] = useState<'grid' | 'horizontal_strip'>('grid');
  const [bgColor, setBgColor] = useState<'transparent' | 'dark' | 'black' | 'white'>('transparent');
  const [targetSize, setTargetSize] = useState<number>(256);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const exportSettings: ExportSettings = {
    layout,
    removeBackground: removeBg,
    bgTolerance,
    bgSmoothness,
    targetCellSize: targetSize,
    backgroundColor: bgColor,
    format: 'png',
    enginePreset: 'phaser',
  };

  const handleDownloadMasterPng = async () => {
    setIsProcessing(true);
    try {
      const res = await buildTilesetCanvas(currentPack, exportSettings);
      const a = document.createElement('a');
      a.href = res.dataUrl;
      a.download = `${currentPack.id}_tileset_clean.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download tileset:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZip = async () => {
    setIsProcessing(true);
    try {
      const blob = await generateZipPackage(currentPack, exportSettings);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentPack.id}_24_frames_bundle.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate zip:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadStrips = async () => {
    setIsProcessing(true);
    try {
      const strips = await buildSeparateStrips(currentPack, exportSettings);
      (['idle', 'run', 'jump', 'attack', 'climb', 'defense'] as const).forEach((act) => {
        const item = strips[act];
        if (item) {
          const a = document.createElement('a');
          a.href = item.dataUrl;
          a.download = `${currentPack.id}_${act}_8frames.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      });
    } catch (err) {
      console.error('Failed to download strips:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyMeta = (engine: 'unity' | 'godot' | 'phaser' | 'css') => {
    const meta = generateEngineMetadata(currentPack, engine, exportSettings);
    navigator.clipboard.writeText(meta);
    setCopiedType(engine);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="border border-slate-800 rounded-2xl bg-slate-950 max-w-xl w-full p-6 space-y-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Export Clean PNG Tileset</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Production-ready sprite sheets for Godot, Unity, Phaser, and Web.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configurations */}
        <div className="space-y-4">
          {/* Layout Option */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Tileset Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLayout('grid')}
                className={`p-3 rounded-lg border text-left text-xs transition-all ${
                  layout === 'grid'
                    ? 'border-amber-400 bg-amber-400/10 text-white'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-white">8×3 Grid Matrix</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Row 1: Idle, 2: Run, 3: Jump</div>
              </button>

              <button
                type="button"
                onClick={() => setLayout('horizontal_strip')}
                className={`p-3 rounded-lg border text-left text-xs transition-all ${
                  layout === 'horizontal_strip'
                    ? 'border-amber-400 bg-amber-400/10 text-white'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-white">24×1 Horizontal Strip</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Continuous 1-line filmstrip</div>
              </button>
            </div>
          </div>

          {/* Background & Resolution */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Background</label>
              <select
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="transparent">Transparent Alpha (PNG-32)</option>
                <option value="dark">Studio Dark Gray (#1c1f26)</option>
                <option value="black">Pure Black (#000000)</option>
                <option value="white">Pure White (#ffffff)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Cell Dimension</label>
              <select
                value={targetSize}
                onChange={(e) => setTargetSize(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value={128}>128×128 px (Pixel art)</option>
                <option value={256}>256×256 px (Optimal standard)</option>
                <option value={320}>320×320 px (High definition)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Download Buttons Strip */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800">
          <button
            onClick={handleDownloadMasterPng}
            disabled={isProcessing}
            className="w-full py-3 px-4 bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-400/10 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{isProcessing ? 'Generating PNG...' : 'Download Master PNG Tileset'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownloadZip}
              disabled={isProcessing}
              className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Full Bundle (.ZIP)</span>
            </button>

            <button
              onClick={handleDownloadStrips}
              disabled={isProcessing}
              className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>3 Separate Strips</span>
            </button>
          </div>
        </div>

        {/* Quick Engine Copy */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="text-xs text-slate-400">Copy Engine Metadata to Clipboard:</div>
          <div className="grid grid-cols-4 gap-2">
            {(['phaser', 'godot', 'unity', 'css'] as const).map((eng) => (
              <button
                key={eng}
                onClick={() => handleCopyMeta(eng)}
                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 rounded border border-slate-800 flex items-center justify-center gap-1 transition-colors uppercase"
              >
                {copiedType === eng ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400" />
                )}
                <span>{eng}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
