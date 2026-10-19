import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Paintbrush,
  Eraser,
  PaintBucket,
  Pipette,
  Layers,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Undo2,
  Redo2,
  Grid,
  Download,
  Sparkles,
  Gamepad2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Sliders,
  Check,
  SplitSquareVertical,
  Maximize2,
  Minimize2,
  Minus,
  ZoomIn,
  ZoomOut,
  FolderPlus,
  Loader2,
  Info
} from 'lucide-react';

export interface CanvasLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  canvas: HTMLCanvasElement;
}

interface PaintingCanvasProps {
  onUseAsGameAsset: (dataUrl: string, assetName: string, category: string) => Promise<void> | void;
  onEnhanceWithAI: (imageFile: File, dataUrl: string) => void;
  onSendToSlicer?: (url: string) => void;
  initialImageUrl?: string | null;
}

const PALETTE_COLORS = [
  // Golden & Amber
  '#f59e0b', '#fbbf24', '#d97706', '#b45309', '#78350f',
  // Crimson & Ruby
  '#ef4444', '#dc2626', '#b91c1c', '#7f1d1d',
  // Emerald & Forest
  '#10b981', '#059669', '#047857', '#064e3b',
  // Sky & Mana Blue
  '#38bdf8', '#0ea5e9', '#0284c7', '#1e40af',
  // Arcane Purple
  '#a855f7', '#9333ea', '#7e22ce', '#581c87',
  // Parchment, Peach & Skin tones
  '#fef3c7', '#fde68a', '#fbcfe8', '#fca5a5', '#e0a96d', '#854d0e',
  // Dark Slate, Metallics & Neutrals
  '#000000', '#0f172a', '#1e293b', '#334155', '#64748b', '#94a3b8', '#cbd5e1', '#ffffff',
];

const BRUSH_PRESETS = [1, 2, 4, 8, 16, 32];
const RESOLUTION_OPTIONS = [
  { label: '512 × 512 (Standard)', width: 512, height: 512 },
  { label: '256 × 256 (Sprite)', width: 256, height: 256 },
  { label: '64 × 64 (Pixel Icon)', width: 64, height: 64 },
  { label: '1024 × 1024 (HD Canvas)', width: 1024, height: 1024 },
];

export const PaintingCanvas: React.FC<PaintingCanvasProps> = ({
  onUseAsGameAsset,
  onEnhanceWithAI,
  onSendToSlicer,
  initialImageUrl,
}) => {
  // Canvas settings
  const [resolution, setResolution] = useState({ width: 512, height: 512 });
  const [zoom, setZoom] = useState(1);
  const [gridSize, setGridSize] = useState<0 | 16 | 32>(0);
  const [symmetryEnabled, setSymmetryEnabled] = useState(false);

  // Active Tool states
  const [activeTool, setActiveTool] = useState<'brush' | 'eraser' | 'fill' | 'pipette'>('brush');
  const [color, setColor] = useState('#f59e0b');
  const [recentColors, setRecentColors] = useState<string[]>([
    '#f59e0b', '#fbbf24', '#ef4444', '#10b981', '#38bdf8', '#ffffff', '#000000'
  ]);
  const [brushSize, setBrushSize] = useState(4);
  const [brushOpacity, setBrushOpacity] = useState(100);

  // Layer State
  const [layers, setLayers] = useState<CanvasLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string>('');
  const [isLayersOpen, setIsLayersOpen] = useState(true);

  // History for Undo / Redo
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Main interactive preview canvas & cursor state
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Modal for "Use as Game Asset"
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [assetName, setAssetName] = useState('New Character Asset');
  const [assetCategory, setAssetCategory] = useState<'character' | 'prop' | 'environment'>('character');
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Initialize first layer
  useEffect(() => {
    const layer1Canvas = document.createElement('canvas');
    layer1Canvas.width = resolution.width;
    layer1Canvas.height = resolution.height;

    // If initial image is provided, draw it onto layer 1
    if (initialImageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const ctx = layer1Canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, resolution.width, resolution.height);
          renderComposite();
        }
      };
      img.src = initialImageUrl;
    }

    const firstLayer: CanvasLayer = {
      id: 'layer-1',
      name: 'Layer 1 (Base)',
      visible: true,
      opacity: 1,
      canvas: layer1Canvas,
    };

    setLayers([firstLayer]);
    setActiveLayerId(firstLayer.id);
  }, [resolution.width, resolution.height]);

  // Composite all visible layers onto the display canvas
  const renderComposite = useCallback(() => {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;
    const ctx = mainCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

    layers.forEach((layer) => {
      if (layer.visible && layer.opacity > 0) {
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(layer.canvas, 0, 0);
      }
    });

    ctx.globalAlpha = 1;

    // Draw pixel grid overlay if enabled
    if (gridSize > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = gridSize; x < mainCanvas.width; x += gridSize) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, mainCanvas.height);
      }
      for (let y = gridSize; y < mainCanvas.height; y += gridSize) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(mainCanvas.width, y + 0.5);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw symmetry vertical guideline if enabled
    if (symmetryEnabled) {
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const midX = mainCanvas.width / 2;
      ctx.moveTo(midX, 0);
      ctx.lineTo(midX, mainCanvas.height);
      ctx.stroke();
      ctx.restore();
    }
  }, [layers, gridSize, symmetryEnabled]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  // Add recent color helper
  const addRecentColor = (newColor: string) => {
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c.toLowerCase() !== newColor.toLowerCase());
      return [newColor, ...filtered].slice(0, 8);
    });
  };

  const getActiveLayer = (): CanvasLayer | undefined => {
    return layers.find((l) => l.id === activeLayerId);
  };

  // Push history snapshot for active layer
  const pushUndoState = () => {
    const active = getActiveLayer();
    if (!active) return;
    const ctx = active.canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, active.canvas.width, active.canvas.height);
    undoStackRef.current.push(imgData);
    if (undoStackRef.current.length > 20) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  const handleUndo = () => {
    const active = getActiveLayer();
    if (!active || undoStackRef.current.length === 0) return;
    const ctx = active.canvas.getContext('2d');
    if (!ctx) return;

    // Save current state to redo
    const currentImgData = ctx.getImageData(0, 0, active.canvas.width, active.canvas.height);
    redoStackRef.current.push(currentImgData);

    const prevImgData = undoStackRef.current.pop();
    if (prevImgData) {
      ctx.putImageData(prevImgData, 0, 0);
      renderComposite();
    }

    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  };

  const handleRedo = () => {
    const active = getActiveLayer();
    if (!active || redoStackRef.current.length === 0) return;
    const ctx = active.canvas.getContext('2d');
    if (!ctx) return;

    const currentImgData = ctx.getImageData(0, 0, active.canvas.width, active.canvas.height);
    undoStackRef.current.push(currentImgData);

    const nextImgData = redoStackRef.current.pop();
    if (nextImgData) {
      ctx.putImageData(nextImgData, 0, 0);
      renderComposite();
    }

    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  };

  // Coordinates from mouse/touch event mapped to canvas coordinates
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Convert hex color to RGBA
  const hexToRgba = (hex: string, alphaPercent: number) => {
    const cleanHex = hex.replace('#', '');
    let r = 0, g = 0, b = 0;
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else if (cleanHex.length === 6) {
      r = parseInt(cleanHex.substring(0, 2), 16);
      g = parseInt(cleanHex.substring(2, 4), 16);
      b = parseInt(cleanHex.substring(4, 6), 16);
    }
    return { r, g, b, a: Math.round((alphaPercent / 100) * 255) };
  };

  // Fast flood fill implementation
  const performFloodFill = (startX: number, startY: number) => {
    const active = getActiveLayer();
    if (!active) return;
    const ctx = active.canvas.getContext('2d');
    if (!ctx) return;

    pushUndoState();

    const w = active.canvas.width;
    const h = active.canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const px = Math.floor(startX);
    const py = Math.floor(startY);
    if (px < 0 || px >= w || py < 0 || py >= h) return;

    const targetIdx = (py * w + px) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];

    const fillRgba = hexToRgba(color, brushOpacity);
    if (
      targetR === fillRgba.r &&
      targetG === fillRgba.g &&
      targetB === fillRgba.b &&
      targetA === fillRgba.a
    ) {
      return;
    }

    const matchColor = (idx: number) => {
      // Tolerance check
      const dr = Math.abs(data[idx] - targetR);
      const dg = Math.abs(data[idx + 1] - targetG);
      const db = Math.abs(data[idx + 2] - targetB);
      const da = Math.abs(data[idx + 3] - targetA);
      return dr + dg + db + da <= 32;
    };

    const queue: [number, number][] = [[px, py]];
    const visited = new Uint8Array(w * h);
    visited[py * w + px] = 1;

    while (queue.length > 0) {
      const [curX, curY] = queue.pop()!;
      const curIdx = (curY * w + curX) * 4;

      data[curIdx] = fillRgba.r;
      data[curIdx + 1] = fillRgba.g;
      data[curIdx + 2] = fillRgba.b;
      data[curIdx + 3] = fillRgba.a;

      // 4 directions
      const neighbors: [number, number][] = [
        [curX + 1, curY],
        [curX - 1, curY],
        [curX, curY + 1],
        [curX, curY - 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nVisitedIdx = ny * w + nx;
          if (!visited[nVisitedIdx]) {
            visited[nVisitedIdx] = 1;
            const nIdx = (ny * w + nx) * 4;
            if (matchColor(nIdx)) {
              queue.push([nx, ny]);
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    renderComposite();
    addRecentColor(color);
  };

  // Eyedropper pixel sampler
  const sampleColorAt = (x: number, y: number) => {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;
    const ctx = mainCanvas.getContext('2d');
    if (!ctx) return;

    const px = Math.floor(x);
    const py = Math.floor(y);
    const pixel = ctx.getImageData(px, py, 1, 1).data;
    if (pixel[3] > 0) {
      const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
      setColor(hex);
      addRecentColor(hex);
      setActiveTool('brush');
    }
  };

  // Draw stroke on the active layer
  const drawStrokeSegment = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    isErasing: boolean
  ) => {
    const active = getActiveLayer();
    if (!active) return;
    const ctx = active.canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    if (isErasing) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = brushOpacity / 100;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = brushOpacity / 100;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
    }

    ctx.lineWidth = brushSize;
    ctx.lineCap = brushSize <= 2 ? 'square' : 'round';
    ctx.lineJoin = brushSize <= 2 ? 'miter' : 'round';

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Fill round caps
    if (brushSize > 2) {
      ctx.beginPath();
      ctx.arc(toX, toY, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Symmetry mirror drawing
    if (symmetryEnabled) {
      const midX = active.canvas.width / 2;
      const symFromX = midX + (midX - fromX);
      const symToX = midX + (midX - toX);

      ctx.beginPath();
      ctx.moveTo(symFromX, fromY);
      ctx.lineTo(symToX, toY);
      ctx.stroke();

      if (brushSize > 2) {
        ctx.beginPath();
        ctx.arc(symToX, toY, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  };

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    if (activeTool === 'pipette') {
      sampleColorAt(coords.x, coords.y);
      return;
    }

    if (activeTool === 'fill') {
      performFloodFill(coords.x, coords.y);
      return;
    }

    isDrawingRef.current = true;
    lastPointRef.current = coords;
    pushUndoState();

    // Draw single point click
    drawStrokeSegment(coords.x, coords.y, coords.x, coords.y, activeTool === 'eraser');
    renderComposite();
    if (activeTool === 'brush') {
      addRecentColor(color);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const coords = getCanvasCoords(e);
    drawStrokeSegment(
      lastPointRef.current.x,
      lastPointRef.current.y,
      coords.x,
      coords.y,
      activeTool === 'eraser'
    );
    lastPointRef.current = coords;
    renderComposite();
  };

  const handlePointerUp = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
    }
  };

  // Layer manipulation handlers
  const handleAddLayer = () => {
    const newCanvas = document.createElement('canvas');
    newCanvas.width = resolution.width;
    newCanvas.height = resolution.height;
    const newLayerId = `layer-${Date.now()}`;
    const newLayer: CanvasLayer = {
      id: newLayerId,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      opacity: 1,
      canvas: newCanvas,
    };
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayerId);
  };

  const handleDeleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    setLayers((prev) => prev.filter((l) => l.id !== id));
    if (activeLayerId === id) {
      const remaining = layers.filter((l) => l.id !== id);
      setActiveLayerId(remaining[remaining.length - 1].id);
    }
  };

  const handleToggleVisibility = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  };

  const handleLayerOpacityChange = (id: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity } : l))
    );
  };

  const handleClearActiveLayer = () => {
    const active = getActiveLayer();
    if (!active) return;
    pushUndoState();
    const ctx = active.canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
      renderComposite();
    }
  };

  const handleMoveLayer = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index + 1 : index - 1;
    if (targetIndex < 0 || targetIndex >= layers.length) return;
    const newLayers = [...layers];
    const temp = newLayers[index];
    newLayers[index] = newLayers[targetIndex];
    newLayers[targetIndex] = temp;
    setLayers(newLayers);
  };

  // Export merged canvas data URL
  const getMergedCanvasDataUrl = (): string => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = resolution.width;
    exportCanvas.height = resolution.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return '';

    layers.forEach((l) => {
      if (l.visible && l.opacity > 0) {
        ctx.globalAlpha = l.opacity;
        ctx.drawImage(l.canvas, 0, 0);
      }
    });

    return exportCanvas.toDataURL('image/png');
  };

  // Convert merged canvas to File object
  const getMergedCanvasFile = async (): Promise<File> => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = resolution.width;
    exportCanvas.height = resolution.height;
    const ctx = exportCanvas.getContext('2d');

    if (ctx) {
      layers.forEach((l) => {
        if (l.visible && l.opacity > 0) {
          ctx.globalAlpha = l.opacity;
          ctx.drawImage(l.canvas, 0, 0);
        }
      });
    }

    return new Promise((resolve) => {
      exportCanvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `${assetName.trim().replace(/\s+/g, '_') || 'canvas_drawing'}.png`, {
            type: 'image/png',
          });
          resolve(file);
        }
      }, 'image/png');
    });
  };

  // "Use as Game Asset" handler
  const handleConfirmUseAsGameAsset = async (destination: 'library' | 'slicer' | 'download') => {
    const dataUrl = getMergedCanvasDataUrl();
    if (!dataUrl) return;

    if (destination === 'download') {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${assetName.trim().replace(/\s+/g, '_') || 'sprite_asset'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setIsAssetModalOpen(false);
      return;
    }

    if (destination === 'slicer') {
      if (onSendToSlicer) {
        onSendToSlicer(dataUrl);
      }
      setIsAssetModalOpen(false);
      return;
    }

    if (destination === 'library') {
      setIsSavingAsset(true);
      setSaveSuccessMsg(null);
      try {
        const file = await getMergedCanvasFile();
        const formData = new FormData();
        formData.append('image', file);
        formData.append('name', assetName.trim() || 'Custom Painted Asset');
        formData.append('category', assetCategory);
        formData.append('width', String(resolution.width));
        formData.append('height', String(resolution.height));

        const res = await fetch('/api/assets', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to save asset to library.');
        }

        setSaveSuccessMsg('Successfully saved canvas artwork to Asset Library!');
        setTimeout(() => {
          setIsAssetModalOpen(false);
          setSaveSuccessMsg(null);
        }, 1200);
      } catch (err: any) {
        alert(err.message || 'Error saving asset');
      } finally {
        setIsSavingAsset(false);
      }
    }
  };

  // "Enhance with AI Tools" handler
  const handleEnhanceClick = async () => {
    const file = await getMergedCanvasFile();
    const dataUrl = getMergedCanvasDataUrl();
    onEnhanceWithAI(file, dataUrl);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Bar for Painting & Creation Canvas */}
      <div className="bg-[#141820] border border-slate-800/80 rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Paintbrush className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Painting & Creation Canvas
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                {resolution.width}×{resolution.height}px
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Interactive pixel & digital art workstation for creating game characters, sprites, and tilesets
            </p>
          </div>
        </div>

        {/* Viewport & Canvas Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Canvas Resolution Select */}
          <div className="flex items-center gap-1.5 bg-[#0e1117] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
            <span className="text-slate-500 text-[11px]">Size:</span>
            <select
              value={`${resolution.width}x${resolution.height}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                setResolution({ width: w, height: h });
              }}
              className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
            >
              {RESOLUTION_OPTIONS.map((opt) => (
                <option key={opt.label} value={`${opt.width}x${opt.height}`} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Grid Toggle */}
          <button
            onClick={() => setGridSize((prev) => (prev === 0 ? 16 : prev === 16 ? 32 : 0))}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              gridSize > 0
                ? 'bg-amber-400/10 border-amber-400/40 text-amber-300 font-semibold'
                : 'bg-[#0e1117] border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle pixel grid overlay (16px / 32px / Off)"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grid {gridSize > 0 ? `${gridSize}px` : 'Off'}</span>
          </button>

          {/* Symmetry Mirror Toggle */}
          <button
            onClick={() => setSymmetryEnabled(!symmetryEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              symmetryEnabled
                ? 'bg-amber-400/10 border-amber-400/40 text-amber-300 font-semibold'
                : 'bg-[#0e1117] border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle horizontal mirror symmetry drawing"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>Symmetry</span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 bg-[#0e1117] border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors rounded"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors rounded"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-[#0e1117] border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-1.5 text-slate-400 hover:text-white transition-colors rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] text-slate-300 px-1 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="p-1.5 text-slate-400 hover:text-white transition-colors rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-2 py-1 text-[10px] text-slate-400 hover:text-white transition-colors font-mono"
              title="Reset Zoom to 100%"
            >
              1:1
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Digital Art Tool Panel (col-span-3) */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          {/* Primary Drawing Tools */}
          <div className="bg-[#141820] border border-slate-800/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Drawing Tools
              </span>
              <button
                onClick={handleClearActiveLayer}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                title="Clear pixels on active layer"
              >
                <RotateCcw className="w-3 h-3" />
                Clear Layer
              </button>
            </div>

            {/* Tool buttons grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveTool('brush')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  activeTool === 'brush'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-[#0d1015] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                <Paintbrush className="w-4 h-4" />
                <span>Brush</span>
              </button>

              <button
                onClick={() => setActiveTool('eraser')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  activeTool === 'eraser'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-[#0d1015] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                <Eraser className="w-4 h-4" />
                <span>Eraser</span>
              </button>

              <button
                onClick={() => setActiveTool('fill')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  activeTool === 'fill'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-[#0d1015] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                <PaintBucket className="w-4 h-4" />
                <span>Fill Bucket</span>
              </button>

              <button
                onClick={() => setActiveTool('pipette')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  activeTool === 'pipette'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-[#0d1015] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                <Pipette className="w-4 h-4" />
                <span>Eyedropper</span>
              </button>
            </div>

            {/* Brush Size Slider & Presets */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Brush Size</span>
                <span className="font-mono text-amber-400 font-semibold">{brushSize}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="48"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex items-center justify-between gap-1 pt-1">
                {BRUSH_PRESETS.map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setBrushSize(sz)}
                    className={`px-2 py-1 text-[11px] font-mono rounded border transition-colors ${
                      brushSize === sz
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold'
                        : 'bg-[#0d1015] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sz}p
                  </button>
                ))}
              </div>
            </div>

            {/* Brush Opacity Slider */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Brush Opacity</span>
                <span className="font-mono text-amber-400 font-semibold">{brushOpacity}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={brushOpacity}
                onChange={(e) => setBrushOpacity(Number(e.target.value))}
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Color Palette & Swatches */}
          <div className="bg-[#141820] border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Color Palette
              </span>
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-md border border-slate-600 shadow-inner"
                  style={{ backgroundColor: color }}
                />
                <span className="font-mono text-xs text-slate-200">{color}</span>
              </div>
            </div>

            {/* Custom Color Native Picker */}
            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#0d1015] border border-slate-800 hover:border-slate-700 rounded-lg text-xs text-slate-300 cursor-pointer transition-colors">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    addRecentColor(e.target.value);
                  }}
                  className="sr-only"
                />
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Custom Color Picker</span>
              </label>
            </div>

            {/* Curated Swatches Grid */}
            <div>
              <span className="text-[11px] text-slate-500 font-medium mb-1.5 block">
                Sprite & Fantasy Swatches
              </span>
              <div className="grid grid-cols-8 gap-1.5">
                {PALETTE_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    onClick={() => {
                      setColor(swatch);
                      addRecentColor(swatch);
                    }}
                    className={`w-6 h-6 rounded border transition-transform hover:scale-110 active:scale-95 ${
                      color.toLowerCase() === swatch.toLowerCase()
                        ? 'border-white ring-2 ring-amber-400'
                        : 'border-slate-800/80 hover:border-slate-400'
                    }`}
                    style={{ backgroundColor: swatch }}
                    title={swatch}
                  />
                ))}
              </div>
            </div>

            {/* Recent Colors Strip */}
            {recentColors.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-500 font-medium mb-1.5 block">
                  Recent Colors
                </span>
                <div className="flex items-center gap-1.5">
                  {recentColors.map((rc, i) => (
                    <button
                      key={rc + i}
                      onClick={() => setColor(rc)}
                      className={`w-5 h-5 rounded border ${
                        color.toLowerCase() === rc.toLowerCase()
                          ? 'border-white ring-1 ring-amber-400'
                          : 'border-slate-800'
                      }`}
                      style={{ backgroundColor: rc }}
                      title={rc}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Layer Management Panel */}
          <div className="bg-[#141820] border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5" />
                <span>Layers ({layers.length})</span>
              </div>
              <button
                onClick={handleAddLayer}
                className="p-1 rounded bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 transition-colors flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 border border-amber-400/30"
                title="Add New Layer"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>

            {/* Layer Stack */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {[...layers].reverse().map((layer, reverseIndex) => {
                const actualIndex = layers.length - 1 - reverseIndex;
                const isActive = layer.id === activeLayerId;

                return (
                  <div
                    key={layer.id}
                    onClick={() => setActiveLayerId(layer.id)}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#1e2430] border-amber-400/60 shadow-sm'
                        : 'bg-[#0d1015] border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleVisibility(layer.id);
                        }}
                        className={`p-0.5 rounded transition-colors ${
                          layer.visible ? 'text-slate-300 hover:text-white' : 'text-slate-600'
                        }`}
                        title={layer.visible ? 'Hide layer' : 'Show layer'}
                      >
                        {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <span className={`font-medium truncate ${isActive ? 'text-amber-300 font-bold' : ''}`}>
                        {layer.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Reorder Buttons */}
                      <button
                        onClick={() => handleMoveLayer(actualIndex, 'up')}
                        disabled={actualIndex === layers.length - 1}
                        className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-20"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveLayer(actualIndex, 'down')}
                        disabled={actualIndex === 0}
                        className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-20"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {/* Delete Layer */}
                      {layers.length > 1 && (
                        <button
                          onClick={() => handleDeleteLayer(layer.id)}
                          className="p-0.5 text-red-500/70 hover:text-red-400"
                          title="Delete Layer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Layer Opacity */}
            {getActiveLayer() && (
              <div className="pt-2 border-t border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Layer Opacity</span>
                  <span className="font-mono text-slate-200">
                    {Math.round((getActiveLayer()?.opacity || 1) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round((getActiveLayer()?.opacity || 1) * 100)}
                  onChange={(e) =>
                    handleLayerOpacityChange(activeLayerId, Number(e.target.value) / 100)
                  }
                  className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Central Area: Large Interactive Drawing Canvas (col-span-9) */}
        <div className="lg:col-span-9 flex flex-col gap-4">
          <div className="bg-[#141820] border border-slate-800/80 rounded-xl p-6 flex flex-col items-center justify-center min-h-[560px] relative overflow-hidden">
            {/* Checkerboard Background Canvas Container */}
            <div
              className="relative rounded-lg shadow-2xl overflow-hidden border border-slate-800 transition-transform duration-100 ease-out"
              style={{
                width: `${resolution.width * zoom}px`,
                height: `${resolution.height * zoom}px`,
                maxWidth: '100%',
                maxHeight: '75vh',
                backgroundImage: `
                  linear-gradient(45deg, #181c24 25%, transparent 25%),
                  linear-gradient(-45deg, #181c24 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #181c24 75%),
                  linear-gradient(-45deg, transparent 75%, #181c24 75%)
                `,
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                backgroundColor: '#0c0e12',
                cursor:
                  activeTool === 'brush'
                    ? 'crosshair'
                    : activeTool === 'eraser'
                    ? 'cell'
                    : activeTool === 'fill'
                    ? 'copy'
                    : 'pointer',
              }}
            >
              <canvas
                ref={mainCanvasRef}
                width={resolution.width}
                height={resolution.height}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="w-full h-full block touch-none select-none"
                style={{
                  imageRendering: resolution.width <= 256 ? 'pixelated' : 'auto',
                }}
              />
            </div>

            {/* Canvas Bottom Sub-Bar: Info & Hotkeys */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 w-full text-xs text-slate-500 pt-3 border-t border-slate-800/80">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Info className="w-3.5 h-3.5 text-amber-400" />
                  Active Layer: <strong className="text-white">{getActiveLayer()?.name || 'None'}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-700">·</span>
                <span>Click & drag to paint</span>
                <span aria-hidden="true" className="text-slate-700">·</span>
                <span>Transparent PNG output</span>
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                <span>Hold mouse for smooth stroke</span>
              </div>
            </div>
          </div>

          {/* Prominent Action Buttons below Canvas */}
          <div className="bg-[#141820] border border-slate-800/80 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Workflow Pipeline Actions
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Turn your drawn artwork into game sprite sheets or enhance it with AI generation
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Prominent Button 1: "Use as Game Asset" */}
              <button
                type="button"
                onClick={() => setIsAssetModalOpen(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all rounded-lg shadow-md hover:shadow-amber-400/20 whitespace-nowrap cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Use as Game Asset</span>
              </button>

              {/* Prominent Button 2: "Enhance with AI Tools" */}
              <button
                type="button"
                onClick={handleEnhanceClick}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] transition-all rounded-lg shadow-md hover:shadow-amber-400/20 whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Enhance with AI Tools</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal / Dialog for "Use as Game Asset" */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141820] border border-amber-500/30 rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-amber-400" />
                Use Canvas Artwork as Game Asset
              </h3>
              <button
                onClick={() => setIsAssetModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 my-5">
              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Asset Name
                </label>
                <input
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="e.g. Hero Knight Front Pose"
                  className="w-full bg-[#0d1015] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Asset Category
                </label>
                <select
                  value={assetCategory}
                  onChange={(e) => setAssetCategory(e.target.value as any)}
                  className="w-full bg-[#0d1015] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="character">Character Sprite / Hero</option>
                  <option value="prop">Game Prop & Inventory Item</option>
                  <option value="environment">Tileset & Environment Block</option>
                </select>
              </div>

              <div className="p-3 rounded-lg bg-[#0e1117] border border-slate-800 flex items-center gap-3">
                <div
                  className="w-16 h-16 rounded border border-slate-700 shrink-0 overflow-hidden"
                  style={{
                    backgroundImage: 'linear-gradient(45deg, #1e2430 25%, transparent 25%), linear-gradient(-45deg, #1e2430 25%, transparent 25%)',
                    backgroundSize: '10px 10px',
                    backgroundColor: '#0c0e12',
                  }}
                >
                  <img
                    src={getMergedCanvasDataUrl()}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-white">{assetName || 'Untitled Artwork'}</p>
                  <p className="text-slate-400 font-mono text-[11px]">
                    {resolution.width} × {resolution.height}px · 32-bit Alpha PNG
                  </p>
                  <p className="text-amber-400 text-[11px]">Ready for export, slicer, or library</p>
                </div>
              </div>
            </div>

            {/* Destination Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleConfirmUseAsGameAsset('slicer')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#1e2430] hover:bg-[#283040] border border-amber-500/30 text-amber-300 font-semibold text-xs transition-colors gap-1.5 text-center cursor-pointer"
              >
                <Grid className="w-4 h-4 text-amber-400" />
                <span>Send to Slicer</span>
              </button>

              <button
                type="button"
                disabled={isSavingAsset}
                onClick={() => handleConfirmUseAsGameAsset('library')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#1e2430] hover:bg-[#283040] border border-amber-500/30 text-amber-300 font-semibold text-xs transition-colors gap-1.5 text-center cursor-pointer disabled:opacity-50"
              >
                {isSavingAsset ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <FolderPlus className="w-4 h-4 text-amber-400" />
                )}
                <span>Save to Library</span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmUseAsGameAsset('download')}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors gap-1.5 text-center cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
