import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Sliders,
  Check,
  Play,
  Archive,
  GripVertical,
  GripHorizontal,
  Scissors,
  RotateCcw,
  Sparkles,
  Tag,
  Grid
} from 'lucide-react';
import JSZip from 'jszip';
import { CharacterPack, FrameDefinition, SpriteAction } from '../types/sprites';
import { loadImage, processFrameCanvas } from '../utils/imageProcessor';
import sampleAttackSheet from '../assets/images/elf_white_wings_attack_1792304222679.jpg';
import sampleIdleSheet from '../assets/images/elf_idle_spritesheet_1792302152477.jpg';

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

  // Manual Adjustment Mode Toggle
  const [manualAdjustmentMode, setManualAdjustmentMode] = useState<boolean>(false);

  // Fractional line boundary positions (0 to 1)
  const [colBoundaries, setColBoundaries] = useState<number[]>([0, 0.25, 0.5, 0.75, 1.0]);
  const [rowBoundaries, setRowBoundaries] = useState<number[]>([0, 0.5, 1.0]);

  // Active dragging state
  const [draggingLine, setDraggingLine] = useState<{
    type: 'col' | 'row';
    index: number;
  } | null>(null);

  // Custom frame names keyed by frame index
  const [frameNames, setFrameNames] = useState<Record<number, string>>({});

  // Individual cell dimensions for extracted frames
  const [frameDimensions, setFrameDimensions] = useState<{ w: number; h: number }[]>([]);

  // Offsets and auto sizing (used in automatic mode)
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [spacingX, setSpacingX] = useState<number>(0);
  const [spacingY, setSpacingY] = useState<number>(0);
  const [cellWidth, setCellWidth] = useState<number>(300);
  const [cellHeight, setCellHeight] = useState<number>(400);
  const [autoFit, setAutoFit] = useState<boolean>(true);

  // Sliced Frame Canvases
  const [slicedFrames, setSlicedFrames] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [appliedSuccess, setAppliedSuccess] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize or load default/provided image
  useEffect(() => {
    const targetUrl = initialImageUrl || sampleAttackSheet;
    setUploadedImageUrl(targetUrl);
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      const w = Math.floor(img.width / cols);
      const h = Math.floor(img.height / rows);
      setCellWidth(w);
      setCellHeight(h);
    };
    img.src = targetUrl;
  }, [initialImageUrl]);

  // Synchronize boundaries when cols change
  useEffect(() => {
    setColBoundaries((prev) => {
      if (prev.length === cols + 1) return prev;
      const arr: number[] = [];
      for (let i = 0; i <= cols; i++) {
        arr.push(i / cols);
      }
      return arr;
    });
  }, [cols]);

  // Synchronize boundaries when rows change
  useEffect(() => {
    setRowBoundaries((prev) => {
      if (prev.length === rows + 1) return prev;
      const arr: number[] = [];
      for (let i = 0; i <= rows; i++) {
        arr.push(i / rows);
      }
      return arr;
    });
  }, [rows]);

  // Reset boundaries to uniform distribution
  const handleResetBoundaries = useCallback(() => {
    const newColBounds: number[] = [];
    for (let i = 0; i <= cols; i++) newColBounds.push(i / cols);
    setColBoundaries(newColBounds);

    const newRowBounds: number[] = [];
    for (let i = 0; i <= rows; i++) newRowBounds.push(i / rows);
    setRowBoundaries(newRowBounds);
  }, [cols, rows]);

  // Handle image upload from user device
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
      handleResetBoundaries();
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

  // Helper to compute slice rect for (row, col)
  const getSliceRect = useCallback(
    (r: number, c: number) => {
      if (
        manualAdjustmentMode &&
        colBoundaries.length === cols + 1 &&
        rowBoundaries.length === rows + 1
      ) {
        const leftFrac = colBoundaries[c];
        const rightFrac = colBoundaries[c + 1];
        const topFrac = rowBoundaries[r];
        const bottomFrac = rowBoundaries[r + 1];

        const sx = Math.max(0, Math.round(leftFrac * imageDimensions.width));
        const sw = Math.max(16, Math.round((rightFrac - leftFrac) * imageDimensions.width));
        const sy = Math.max(0, Math.round(topFrac * imageDimensions.height));
        const sh = Math.max(16, Math.round((bottomFrac - topFrac) * imageDimensions.height));

        return { sx, sy, sw, sh };
      } else {
        const sx = offsetX + c * (cellWidth + spacingX);
        const sy = offsetY + r * (cellHeight + spacingY);
        return { sx, sy, sw: cellWidth, sh: cellHeight };
      }
    },
    [
      manualAdjustmentMode,
      colBoundaries,
      rowBoundaries,
      cols,
      rows,
      imageDimensions,
      offsetX,
      offsetY,
      cellWidth,
      cellHeight,
      spacingX,
      spacingY,
    ]
  );

  // Generate slice previews whenever parameters or boundaries change
  useEffect(() => {
    let cancelled = false;

    async function slice() {
      if (!uploadedImageUrl || imageDimensions.width === 0 || imageDimensions.height === 0) return;
      setIsProcessing(true);

      try {
        const sourceImg = await loadImage(uploadedImageUrl);
        const results: string[] = [];
        const dimensionsList: { w: number; h: number }[] = [];

        let count = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (count >= totalFrames) break;

            const { sx, sy, sw, sh } = getSliceRect(r, c);
            dimensionsList.push({ w: sw, h: sh });

            const customName = frameNames[count]?.trim();
            const frameDef: FrameDefinition = {
              id: `slice_${count + 1}`,
              index: count,
              label: customName || `Frame ${count + 1}`,
              phaseLabel: customName || `Frame ${count + 1}`,
              sx,
              sy,
              sw,
              sh,
              durationMs: 100,
            };

            const canvas = processFrameCanvas(
              sourceImg,
              frameDef,
              removeBg,
              bgTolerance,
              bgSmoothness,
              sw,
              sh
            );

            results.push(canvas.toDataURL('image/png'));
            count++;
          }
        }

        if (!cancelled) {
          setSlicedFrames(results);
          setFrameDimensions(dimensionsList);
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
    manualAdjustmentMode,
    colBoundaries,
    rowBoundaries,
    offsetX,
    offsetY,
    spacingX,
    spacingY,
    cellWidth,
    cellHeight,
    removeBg,
    bgTolerance,
    bgSmoothness,
    imageDimensions,
    getSliceRect,
  ]);

  // Dragging event listeners for interactive grid handles
  const startDrag = (type: 'col' | 'row', index: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingLine({ type, index });
  };

  useEffect(() => {
    if (!draggingLine) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!previewContainerRef.current) return;
      const rect = previewContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const minGap = 0.02; // Minimum gap between cut lines (prevent overlapping or negative cell widths)

      if (draggingLine.type === 'col') {
        const ratio = (e.clientX - rect.left) / rect.width;
        const idx = draggingLine.index;
        const minBound = idx > 0 ? colBoundaries[idx - 1] + minGap : 0;
        const maxBound = idx < cols ? colBoundaries[idx + 1] - minGap : 1;
        const clamped = Math.max(minBound, Math.min(maxBound, ratio));

        setColBoundaries((prev) => {
          const next = [...prev];
          next[idx] = clamped;
          return next;
        });
      } else {
        const ratio = (e.clientY - rect.top) / rect.height;
        const idx = draggingLine.index;
        const minBound = idx > 0 ? rowBoundaries[idx - 1] + minGap : 0;
        const maxBound = idx < rows ? rowBoundaries[idx + 1] - minGap : 1;
        const clamped = Math.max(minBound, Math.min(maxBound, ratio));

        setRowBoundaries((prev) => {
          const next = [...prev];
          next[idx] = clamped;
          return next;
        });
      }
    };

    const handlePointerUp = () => {
      setDraggingLine(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingLine, colBoundaries, rowBoundaries, cols, rows]);

  // Handle custom frame name updates
  const handleFrameNameChange = (index: number, newName: string) => {
    setFrameNames((prev) => ({
      ...prev,
      [index]: newName,
    }));
  };

  // Quick naming presets
  const handleApplyNamingPattern = (pattern: 'attack' | 'idle' | 'run' | 'clear') => {
    if (pattern === 'clear') {
      setFrameNames({});
      return;
    }
    const updated: Record<number, string> = {};
    for (let i = 0; i < totalFrames; i++) {
      if (pattern === 'attack') {
        updated[i] = `Attack_${i + 1}`;
      } else if (pattern === 'idle') {
        updated[i] = `Idle_${i + 1}`;
      } else if (pattern === 'run') {
        updated[i] = `Run_${i + 1}`;
      }
    }
    setFrameNames(updated);
  };

  // Export sliced frames to ZIP with custom names and metadata
  const handleDownloadZip = async () => {
    if (slicedFrames.length === 0) return;
    setIsProcessing(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder('custom_sliced_frames');
      const manifest: Array<{
        index: number;
        id: string;
        customName: string;
        fileName: string;
        width: number;
        height: number;
      }> = [];

      slicedFrames.forEach((dataUrl, idx) => {
        const base64 = dataUrl.split(',')[1];
        const num = String(idx + 1).padStart(2, '0');
        const customName = frameNames[idx]?.trim();
        const safeName = customName
          ? `${num}_${customName.replace(/[^a-zA-Z0-9_-]/g, '_')}`
          : `frame_${num}`;

        const fileName = `${safeName}.png`;
        folder?.file(fileName, base64, { base64: true });

        manifest.push({
          index: idx,
          id: `frame_${num}`,
          customName: customName || `Frame ${idx + 1}`,
          fileName,
          width: frameDimensions[idx]?.w || cellWidth,
          height: frameDimensions[idx]?.h || cellHeight,
        });
      });

      // Add manifest.json for game engine importers
      folder?.file(
        'manifest.json',
        JSON.stringify(
          {
            generator: 'Elysian Sprite Studio',
            totalFrames: slicedFrames.length,
            manualSlicingUsed: manualAdjustmentMode,
            frames: manifest,
          },
          null,
          2
        )
      );

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

  // Apply to Studio Player as a dynamic character pack with custom frame names
  const handleApplyToStudio = () => {
    if (!uploadedImageUrl) return;

    const frames: FrameDefinition[] = [];
    let count = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (count >= totalFrames) break;
        const { sx, sy, sw, sh } = getSliceRect(r, c);
        const customName = frameNames[count]?.trim();

        frames.push({
          id: `custom_frame_${count + 1}`,
          index: count,
          label: customName || `Frame ${count + 1}`,
          phaseLabel: customName || `Phase ${count + 1}`,
          sx,
          sy,
          sw,
          sh,
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
          <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
            <span>Import Any Custom Sprite Sheet</span>
            <span aria-hidden="true">·</span>
            <span>Manual Drag-Handle Slicing</span>
            <span aria-hidden="true">·</span>
            <span>Custom Frame Naming</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-400">Export Engine-Ready ZIP</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setUploadedImageUrl(sampleAttackSheet);
              handleResetBoundaries();
            }}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors"
            title="Load Winged Elf Attack Sheet to test slice margins"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Load Attack Sample</span>
          </button>

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
            {/* Header with Manual Adjustment Mode Toggle */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Grid Settings</span>
              </h2>

              {/* Manual Adjustment Mode Toggle Switch */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <span className="text-xs font-semibold text-slate-300 group-hover:text-amber-300 transition-colors">
                  Manual Adjustment Mode
                </span>
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={manualAdjustmentMode}
                    onChange={(e) => setManualAdjustmentMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 border border-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 peer-checked:after:bg-slate-950 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-400 peer-checked:border-amber-400 shadow-inner"></div>
                </div>
              </label>
            </div>

            {/* Manual Mode Active Notice */}
            {manualAdjustmentMode && (
              <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/30 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                    <Scissors className="w-3.5 h-3.5 text-amber-400" />
                    <span>Manual Drag Handles Active</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetBoundaries}
                    className="flex items-center gap-1 px-2 py-0.5 bg-slate-950 hover:bg-slate-800 border border-amber-400/30 rounded text-[10px] text-amber-300 transition-colors"
                    title="Reset vertical and horizontal cut lines to equal proportions"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Grid</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Drag the yellow circular nodes or vertical grid lines in the preview area to freely adjust individual cell widths and heights. Great for extending space around character weapons and attack effects without clipping!
                </p>
              </div>
            )}

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

            {/* Automatic Cell Dimensions Controls (dimmed/secondary in manual mode) */}
            <div className={`space-y-2 pt-2 border-t border-slate-800 ${manualAdjustmentMode ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Base Cell Sizing</span>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={manualAdjustmentMode}
                    checked={autoFit}
                    onChange={(e) => setAutoFit(e.target.checked)}
                    className="accent-amber-400 rounded"
                  />
                  <span>Auto-Divide</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Default Width (px)</label>
                  <input
                    type="number"
                    disabled={autoFit || manualAdjustmentMode}
                    value={cellWidth}
                    onChange={(e) => setCellWidth(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white disabled:opacity-50 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Default Height (px)</label>
                  <input
                    type="number"
                    disabled={autoFit || manualAdjustmentMode}
                    value={cellHeight}
                    onChange={(e) => setCellHeight(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white disabled:opacity-50 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Offsets (Padding/Margins) */}
            <div className={`space-y-2 pt-2 border-t border-slate-800 ${manualAdjustmentMode ? 'opacity-60' : ''}`}>
              <span className="text-xs font-semibold text-slate-300">Offsets & Padding</span>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Offset X</label>
                  <input
                    type="number"
                    disabled={manualAdjustmentMode}
                    value={offsetX}
                    onChange={(e) => setOffsetX(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white font-mono disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Offset Y</label>
                  <input
                    type="number"
                    disabled={manualAdjustmentMode}
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white font-mono disabled:opacity-50"
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
                    handleResetBoundaries();
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
                    handleResetBoundaries();
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
                    handleResetBoundaries();
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
              disabled={slicedFrames.length === 0 || isProcessing}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-700 disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Download Sliced Frames (.ZIP)</span>
            </button>

            <button
              onClick={handleApplyToStudio}
              disabled={!uploadedImageUrl || isProcessing}
              className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-400/10 disabled:opacity-50"
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
            <div className="px-5 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">Visual Grid Cutter Preview</span>
                {manualAdjustmentMode && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                    <span>Interactive Handles Active</span>
                  </span>
                )}
              </div>
              {uploadedImageUrl && (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-400 text-[11px]">
                    Source: {imageDimensions.width}×{imageDimensions.height} px
                  </span>
                </div>
              )}
            </div>

            <div className="p-6 overflow-auto max-h-[520px] flex items-center justify-center bg-[#13161c] relative select-none">
              {uploadedImageUrl ? (
                <div
                  ref={previewContainerRef}
                  className="relative inline-block border border-slate-700 shadow-xl select-none"
                >
                  <img
                    src={uploadedImageUrl}
                    alt="Uploaded sprite sheet"
                    className="max-w-none block select-none pointer-events-none"
                    style={{ maxHeight: '420px', width: 'auto' }}
                  />

                  {/* Standard Static Grid Overlay when Manual Mode is OFF */}
                  {!manualAdjustmentMode && (
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
                  )}

                  {/* Interactive Drag Handles & Lines Overlay when Manual Mode is ON */}
                  {manualAdjustmentMode && (
                    <div className="absolute inset-0 w-full h-full">
                      {/* Vertical Cut Lines & Drag Handles */}
                      {colBoundaries.map((pos, i) => {
                        // Skip outer 0% and 100% edges from dragging to preserve frame bounds, or internal lines
                        const isInternal = i > 0 && i < cols;
                        const isDragging = draggingLine?.type === 'col' && draggingLine.index === i;

                        return (
                          <React.Fragment key={`v-slice-${i}`}>
                            {/* The line itself */}
                            <div
                              className={`absolute top-0 bottom-0 pointer-events-none transition-colors ${
                                isDragging
                                  ? 'bg-amber-400 w-[2px] shadow-[0_0_12px_rgba(245,158,11,1)] z-20'
                                  : isInternal
                                  ? 'bg-amber-400/90 w-[1.5px] border-r border-dashed border-amber-300 z-10'
                                  : 'bg-amber-500/50 w-[1px]'
                              }`}
                              style={{ left: `${pos * 100}%` }}
                            />

                            {/* Interactive Grab Handle & Hit Zone for internal cut lines */}
                            {isInternal && (
                              <div
                                onPointerDown={(e) => startDrag('col', i, e)}
                                className="absolute top-0 bottom-0 -ml-3 w-6 cursor-col-resize z-20 flex items-center justify-center group touch-none"
                                style={{ left: `${pos * 100}%` }}
                                title={`Drag vertical slice line ${i} to adjust frame boundaries`}
                              >
                                {/* Center Circular Drag Handle Node */}
                                <div
                                  className={`w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg border-2 border-slate-950 font-bold transition-transform ${
                                    isDragging
                                      ? 'scale-125 bg-amber-300 ring-4 ring-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.9)]'
                                      : 'group-hover:scale-115 group-hover:bg-amber-300'
                                  }`}
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>

                                {/* Dragging coordinate tooltip */}
                                {isDragging && (
                                  <div className="absolute top-3 -translate-x-1/2 left-1/2 px-2 py-0.5 rounded bg-slate-950/95 border border-amber-400 text-[10px] font-mono text-amber-300 whitespace-nowrap shadow-2xl z-40 pointer-events-none">
                                    X: {Math.round(pos * imageDimensions.width)}px ({(pos * 100).toFixed(1)}%)
                                  </div>
                                )}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* Horizontal Cut Lines & Drag Handles */}
                      {rowBoundaries.map((pos, j) => {
                        const isInternal = j > 0 && j < rows;
                        const isDragging = draggingLine?.type === 'row' && draggingLine.index === j;

                        return (
                          <React.Fragment key={`h-slice-${j}`}>
                            {/* The line itself */}
                            <div
                              className={`absolute left-0 right-0 pointer-events-none transition-colors ${
                                isDragging
                                  ? 'bg-amber-400 h-[2px] shadow-[0_0_12px_rgba(245,158,11,1)] z-20'
                                  : isInternal
                                  ? 'bg-amber-400/90 h-[1.5px] border-b border-dashed border-amber-300 z-10'
                                  : 'bg-amber-500/50 h-[1px]'
                              }`}
                              style={{ top: `${pos * 100}%` }}
                            />

                            {/* Interactive Grab Handle & Hit Zone for internal cut lines */}
                            {isInternal && (
                              <div
                                onPointerDown={(e) => startDrag('row', j, e)}
                                className="absolute left-0 right-0 -mt-3 h-6 cursor-row-resize z-20 flex items-center justify-center group touch-none"
                                style={{ top: `${pos * 100}%` }}
                                title={`Drag horizontal slice line ${j} to adjust frame boundaries`}
                              >
                                {/* Center Circular Drag Handle Node */}
                                <div
                                  className={`w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg border-2 border-slate-950 font-bold transition-transform ${
                                    isDragging
                                      ? 'scale-125 bg-amber-300 ring-4 ring-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.9)]'
                                      : 'group-hover:scale-115 group-hover:bg-amber-300'
                                  }`}
                                >
                                  <GripHorizontal className="w-3.5 h-3.5" />
                                </div>

                                {/* Dragging coordinate tooltip */}
                                {isDragging && (
                                  <div className="absolute left-3 -translate-y-1/2 top-1/2 px-2 py-0.5 rounded bg-slate-950/95 border border-amber-400 text-[10px] font-mono text-amber-300 whitespace-nowrap shadow-2xl z-40 pointer-events-none">
                                    Y: {Math.round(pos * imageDimensions.height)}px ({(pos * 100).toFixed(1)}%)
                                  </div>
                                )}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* Cell Frame Label Badges */}
                      {Array.from({ length: rows }).map((_, r) =>
                        Array.from({ length: cols }).map((_, c) => {
                          const idx = r * cols + c;
                          if (idx >= totalFrames) return null;
                          const name = frameNames[idx]?.trim();

                          return (
                            <div
                              key={`badge-${r}-${c}`}
                              className="absolute pointer-events-none text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950/80 text-amber-300 border border-amber-400/30 m-1.5 shadow-sm"
                              style={{
                                left: `${colBoundaries[c] * 100}%`,
                                top: `${rowBoundaries[r] * 100}%`,
                              }}
                            >
                              {name || `F${idx + 1}`}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
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

            {/* Helpful instructions bar */}
            <div className="px-5 py-2.5 bg-slate-900/90 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {manualAdjustmentMode
                    ? 'Tip: Drag the amber handles or vertical/horizontal grid lines to widen frames around swinging weapons or accessories.'
                    : 'Enable "Manual Adjustment Mode" in Grid Settings to drag and adjust cut lines individually.'}
                </span>
              </span>
              <span className="font-mono text-slate-500">
                {slicedFrames.length} of {totalFrames} Frames Ready
              </span>
            </div>
          </div>

          {/* Sliced Output Filmstrip & Extracted Frames with Custom Names */}
          {slicedFrames.length > 0 && (
            <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-b border-slate-800 pb-3">
                <div>
                  <span className="font-semibold text-white">
                    Extracted Frames ({slicedFrames.length} Frames)
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Assign custom animation labels (e.g., Idle, Attack, Windup) to each frame below:
                  </p>
                </div>

                {/* Quick Naming Helpers */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
                    <Tag className="w-3 h-3 text-amber-400" />
                    <span>Quick Names:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleApplyNamingPattern('attack')}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-[10px] text-slate-300 transition-colors"
                  >
                    Attack 1..8
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyNamingPattern('idle')}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-[10px] text-slate-300 transition-colors"
                  >
                    Idle 1..8
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyNamingPattern('run')}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-[10px] text-slate-300 transition-colors"
                  >
                    Run 1..8
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyNamingPattern('clear')}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Grid of Extracted Frames with editable text input fields under each frame */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 overflow-x-auto p-1">
                {slicedFrames.map((url, i) => (
                  <div
                    key={i}
                    className="border border-slate-800 rounded-lg p-2 bg-slate-950 flex flex-col items-center shadow-md hover:border-slate-700 transition-all"
                  >
                    {/* Frame image preview on checkerboard */}
                    <div className="w-full aspect-[3/4] relative rounded overflow-hidden canvas-checkerboard border border-slate-800/80 flex items-center justify-center p-1 bg-slate-900/50">
                      <img
                        src={url}
                        alt={`Extracted Frame ${i + 1}`}
                        className="max-h-full max-w-full object-contain pixelated"
                      />
                      {/* Frame index pill */}
                      <span className="absolute top-1 left-1 px-1 py-0.2 bg-slate-950/80 rounded text-[9px] font-mono text-amber-400 border border-slate-800">
                        #{String(i + 1).padStart(2, '0')}
                      </span>
                    </div>

                    {/* Frame pixel size indicator */}
                    <div className="w-full flex items-center justify-between text-[9px] font-mono text-slate-500 mt-1.5 px-0.5">
                      <span>{frameDimensions[i] ? `${frameDimensions[i].w}×${frameDimensions[i].h}` : `${cellWidth}×${cellHeight}`}</span>
                      <span>px</span>
                    </div>

                    {/* Editable custom frame name text input */}
                    <div className="w-full mt-1.5">
                      <input
                        type="text"
                        value={frameNames[i] ?? ''}
                        onChange={(e) => handleFrameNameChange(i, e.target.value)}
                        placeholder="e.g., Idle, Attack"
                        className="w-full bg-slate-900 hover:bg-slate-850 focus:bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 rounded px-1.5 py-1 text-[11px] text-amber-100 placeholder:text-slate-600 text-center font-medium focus:outline-none transition-all shadow-inner"
                        title={`Rename Frame ${i + 1} (placeholder: e.g., Idle, Attack)`}
                      />
                    </div>
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
