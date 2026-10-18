import React, { useRef, useState, useEffect } from 'react';
import {
  Upload,
  Sliders,
  Download,
  Grid,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  Archive,
  Image as ImageIcon
} from 'lucide-react';
import JSZip from 'jszip';
import { CharacterPack, FrameDefinition, SpriteAction } from '../types/sprites';
import { loadImage, processFrameCanvas } from '../utils/imageProcessor';

interface SpriteSlicerProps {
  initialImageUrl?: string | null;
  onApplyCustomPack: (pack: CharacterPack) => void;
  removeBg: boolean;
  bgTolerance: number;
  bgSmoothness: number;
}

export const SpriteSlicer: React.FC<SpriteSlicerProps> = ({
  initialImageUrl,
  onApplyCustomPack,
  removeBg,
  bgTolerance,
  bgSmoothness,
}) => {
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Grid Slicing Controls
  const [cols, setCols] = useState<number>(4);
  const [rows, setRows] = useState<number>(2);
  const [totalFrames, setTotalFrames] = useState<number>(8);

  useEffect(() => {
    if (initialImageUrl) {
      setUploadedImageUrl(initialImageUrl);
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
      };
      img.src = initialImageUrl;
    }
  }, [initialImageUrl]);

  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [spacingX, setSpacingX] = useState<number>(0);
  const [spacingY, setSpacingY] = useState<number>(0);
  const [cellWidth, setCellWidth] = useState<number>(300);
  const [cellHeight, setCellHeight] = useState<number>(400);

  // Auto-calculated cell sizes
  const [autoFit, setAutoFit] = useState<boolean>(true);

  // Sliced Frame Canvases
  const [slicedFrames, setSlicedFrames] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [assignedAction, setAssignedAction] = useState<SpriteAction>('idle');
  const [appliedSuccess, setAppliedSuccess] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle image upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setUploadedImageUrl(url);

    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      const w = Math.floor(img.width / cols);
      const h = Math.floor(img.height / rows);
      setCellWidth(w);
      setCellHeight(h);
    };
    img.src = url;
  };

  // Adjust cell dimensions when cols/rows/image dimensions change and autoFit is true
  useEffect(() => {
    if (autoFit && imageDimensions.width > 0 && imageDimensions.height > 0) {
      const w = Math.floor((imageDimensions.width - offsetX) / cols);
      const h = Math.floor((imageDimensions.height - offsetY) / rows);
      setCellWidth(Math.max(16, w));
      setCellHeight(Math.max(16, h));
    }
  }, [autoFit, cols, rows, offsetX, offsetY, imageDimensions]);

  // Generate slice previews whenever parameters change
  useEffect(() => {
    let cancelled = false;

    async function slice() {
      if (!uploadedImageUrl) return;
      setIsProcessing(true);

      try {
        const sourceImg = await loadImage(uploadedImageUrl);
        const results: string[] = [];

        let count = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (count >= totalFrames) break;

            const sx = offsetX + c * (cellWidth + spacingX);
            const sy = offsetY + r * (cellHeight + spacingY);

            const frameDef: FrameDefinition = {
              id: `slice_${count + 1}`,
              index: count,
              label: `Frame ${count + 1}`,
              phaseLabel: `Frame ${count + 1}`,
              sx,
              sy,
              sw: cellWidth,
              sh: cellHeight,
              durationMs: 100,
            };

            const canvas = processFrameCanvas(
              sourceImg,
              frameDef,
              removeBg,
              bgTolerance,
              bgSmoothness,
              cellWidth,
              cellHeight
            );

            results.push(canvas.toDataURL('image/png'));
            count++;
          }
        }

        if (!cancelled) {
          setSlicedFrames(results);
        }
      } catch (err) {
        console.error('Error slicing frames:', err);
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    }

    slice();

    return () => {
      cancelled = true;
    };
  }, [
    uploadedImageUrl,
    cols,
    rows,
    totalFrames,
    offsetX,
    offsetY,
    spacingX,
    spacingY,
    cellWidth,
    cellHeight,
    removeBg,
    bgTolerance,
    bgSmoothness,
  ]);

  // Export sliced frames to ZIP
  const handleDownloadZip = async () => {
    if (slicedFrames.length === 0) return;
    setIsProcessing(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder('custom_sliced_frames');

      slicedFrames.forEach((dataUrl, idx) => {
        const base64 = dataUrl.split(',')[1];
        const num = String(idx + 1).padStart(2, '0');
        folder?.file(`frame_${num}.png`, base64, { base64: true });
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `custom_sliced_${totalFrames}_frames.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export zip:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply to Studio Player as a dynamic character pack
  const handleApplyToStudio = () => {
    if (!uploadedImageUrl) return;

    const frames: FrameDefinition[] = [];
    let count = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (count >= totalFrames) break;
        const sx = offsetX + c * (cellWidth + spacingX);
        const sy = offsetY + r * (cellHeight + spacingY);
        frames.push({
          id: `custom_frame_${count + 1}`,
          index: count,
          label: `Frame ${count + 1}`,
          phaseLabel: `Phase ${count + 1}`,
          sx,
          sy,
          sw: cellWidth,
          sh: cellHeight,
          durationMs: 100,
        });
        count++;
      }
    }

    const customPack: CharacterPack = {
      id: 'custom_uploaded_character',
      name: 'Custom Uploaded Character',
      shortDesc: `Custom sprite sheet with ${totalFrames} sliced frames.`,
      avatarUrl: uploadedImageUrl,
      actions: {
        idle: {
          action: 'idle',
          title: 'Custom Idle',
          fps: 10,
          loop: true,
          sheetUrl: uploadedImageUrl,
          cols,
          rows,
          totalFrames,
          frameWidth: cellWidth,
          frameHeight: cellHeight,
          frames,
          description: 'Custom sliced animation loop.',
        },
        run: {
          action: 'run',
          title: 'Custom Run',
          fps: 12,
          loop: true,
          sheetUrl: uploadedImageUrl,
          cols,
          rows,
          totalFrames,
          frameWidth: cellWidth,
          frameHeight: cellHeight,
          frames,
          description: 'Custom sliced animation loop.',
        },
        jump: {
          action: 'jump',
          title: 'Custom Jump',
          fps: 10,
          loop: false,
          sheetUrl: uploadedImageUrl,
          cols,
          rows,
          totalFrames,
          frameWidth: cellWidth,
          frameHeight: cellHeight,
          frames,
          description: 'Custom sliced animation loop.',
        },
        attack: {
          action: 'attack',
          title: 'Custom Attack',
          fps: 12,
          loop: false,
          sheetUrl: uploadedImageUrl,
          cols,
          rows,
          totalFrames,
          frameWidth: cellWidth,
          frameHeight: cellHeight,
          frames,
          description: 'Custom sliced animation loop.',
        },
        climb: {
          action: 'climb',
          title: 'Custom Climb',
          fps: 9,
          loop: true,
          sheetUrl: uploadedImageUrl,
          cols,
          rows,
          totalFrames,
          frameWidth: cellWidth,
          frameHeight: cellHeight,
          frames,
          description: 'Custom sliced animation loop.',
        },
        defense: {
          action: 'defense',
          title: 'Custom Defense',
          fps: 8,
          loop: true,
          sheetUrl: uploadedImageUrl,
          cols,
          rows,
          totalFrames,
          frameWidth: cellWidth,
          frameHeight: cellHeight,
          frames,
          description: 'Custom sliced animation loop.',
        },
      },
    };

    onApplyCustomPack(customPack);
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 2500);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Grid className="w-6 h-6 text-amber-400" />
            <span>Interactive Sprite Slicer & Upload Editor</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Import Any Custom Sprite Sheet</span>
            <span aria-hidden="true">·</span>
            <span>Configurable Matrix Slicing</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-400">Export ZIP or Load into Studio</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/png,image/jpeg,image/webp,image/jfif"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 shadow-md transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Sprite Sheet (PNG/JPG)</span>
          </button>
        </div>
      </div>

      {/* Editor Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Slicing Parameters Controls */}
        <div className="lg:col-span-4 space-y-5">
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/80 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Grid Matrix Parameters</span>
            </h2>

            {/* Columns & Rows */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Columns (X)</label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={cols}
                  onChange={(e) => setCols(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Rows (Y)</label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </div>

            {/* Total Frames Target */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Total Frames to Extract</span>
                <span className="font-mono text-amber-400">{totalFrames} Frames</span>
              </div>
              <input
                type="range"
                min="1"
                max={cols * rows}
                value={totalFrames}
                onChange={(e) => setTotalFrames(parseInt(e.target.value, 10))}
                className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded cursor-pointer"
              />
            </div>

            {/* Cell Dimensions */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Cell Sizing</span>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoFit}
                    onChange={(e) => setAutoFit(e.target.checked)}
                    className="accent-amber-400 rounded"
                  />
                  <span>Auto-Divide</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Cell Width (px)</label>
                  <input
                    type="number"
                    disabled={autoFit}
                    value={cellWidth}
                    onChange={(e) => setCellWidth(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white disabled:opacity-50 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Cell Height (px)</label>
                  <input
                    type="number"
                    disabled={autoFit}
                    value={cellHeight}
                    onChange={(e) => setCellHeight(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white disabled:opacity-50 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Offsets (Padding/Margins) */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-300">Offsets & Padding</span>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Offset X</label>
                  <input
                    type="number"
                    value={offsetX}
                    onChange={(e) => setOffsetX(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Offset Y</label>
                  <input
                    type="number"
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Preset Action Buttons */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="text-xs text-slate-400">Quick Grid Presets:</span>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCols(4);
                    setRows(2);
                    setTotalFrames(8);
                  }}
                  className="py-1 px-2 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-slate-300"
                >
                  4×2 (8 frames)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCols(8);
                    setRows(1);
                    setTotalFrames(8);
                  }}
                  className="py-1 px-2 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-slate-300"
                >
                  8×1 (Strip)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCols(8);
                    setRows(3);
                    setTotalFrames(24);
                  }}
                  className="py-1 px-2 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-slate-300"
                >
                  8×3 (Full 24)
                </button>
              </div>
            </div>
          </div>

          {/* Action Export Buttons */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/80 space-y-3">
            <button
              onClick={handleDownloadZip}
              disabled={slicedFrames.length === 0}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-700"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Download Sliced Frames (.ZIP)</span>
            </button>

            <button
              onClick={handleApplyToStudio}
              disabled={!uploadedImageUrl}
              className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-400/10"
            >
              {appliedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>Applied to Studio Player!</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Load Into Studio Player</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Visual Slicing Viewport & Extracted Frames */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Visual Slicer Preview */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-2xl">
            <div className="px-5 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Visual Grid Cutter Preview</span>
              {uploadedImageUrl && (
                <span className="font-mono text-slate-400">
                  Source: {imageDimensions.width}×{imageDimensions.height} px
                </span>
              )}
            </div>

            <div className="p-6 overflow-auto max-h-[500px] flex items-center justify-center bg-[#13161c] relative">
              {uploadedImageUrl ? (
                <div className="relative inline-block border border-slate-700 shadow-xl">
                  <img
                    src={uploadedImageUrl}
                    alt="Uploaded sprite sheet"
                    className="max-w-none block select-none"
                    style={{ maxHeight: '420px', width: 'auto' }}
                  />

                  {/* SVG Grid Overlay */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ width: '100%', height: '100%' }}
                  >
                    {Array.from({ length: cols + 1 }).map((_, i) => (
                      <line
                        key={`col-${i}`}
                        x1={`${(i / cols) * 100}%`}
                        y1="0"
                        x2={`${(i / cols) * 100}%`}
                        y2="100%"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      />
                    ))}
                    {Array.from({ length: rows + 1 }).map((_, i) => (
                      <line
                        key={`row-${i}`}
                        x1="0"
                        y1={`${(i / rows) * 100}%`}
                        x2="100%"
                        y2={`${(i / rows) * 100}%`}
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      />
                    ))}
                  </svg>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="py-24 px-8 border-2 border-dashed border-slate-800 rounded-xl text-center cursor-pointer hover:border-amber-400/50 transition-colors max-w-md w-full"
                >
                  <Upload className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-200">
                    Upload Any Sprite Sheet
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Drag and drop your PNG, JPG, or WebP sprite image here, or click to browse.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sliced Output Filmstrip */}
          {slicedFrames.length > 0 && (
            <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">
                  Extracted Frames ({slicedFrames.length} Frames)
                </span>
                <span className="font-mono text-amber-400">
                  {cellWidth}×{cellHeight} px per frame
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5 overflow-x-auto p-1">
                {slicedFrames.map((url, i) => (
                  <div
                    key={i}
                    className="border border-slate-800 rounded-lg p-1 bg-slate-950 flex flex-col items-center canvas-checkerboard"
                  >
                    <img
                      src={url}
                      alt={`Sliced ${i + 1}`}
                      className="w-full aspect-[3/4] object-contain pixelated"
                    />
                    <span className="text-[10px] font-mono text-slate-400 mt-1">
                      0{i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
