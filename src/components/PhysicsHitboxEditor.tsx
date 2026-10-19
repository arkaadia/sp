import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Crosshair,
  Square,
  Shield,
  Sword,
  Box,
  MousePointer,
  Download,
  Copy,
  Check,
  Trash2,
  Eye,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileJson,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import {
  CharacterPack,
  FrameDefinition,
  SpriteAction,
  HitboxRect,
  BoxType,
  FramePhysicsData
} from '../types/sprites';
import { loadImage, processFrameCanvas } from '../utils/imageProcessor';

interface PhysicsHitboxEditorProps {
  currentPack: CharacterPack;
  selectedAction: SpriteAction;
  setSelectedAction: (act: SpriteAction) => void;
  removeBg: boolean;
  bgTolerance: number;
  bgSmoothness: number;
}

type EditorTool = 'pivot' | 'box_hurtbox' | 'box_hitbox' | 'box_collision' | 'select';

const BOX_COLOR_CONFIG: Record<BoxType, { label: string; stroke: string; fill: string; border: string; bg: string; text: string; badge: string }> = {
  hurtbox: {
    label: 'Hurtbox (Body)',
    stroke: '#10b981',
    fill: 'rgba(16, 185, 129, 0.25)',
    border: 'border-emerald-500',
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  hitbox: {
    label: 'Hitbox (Attack)',
    stroke: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.28)',
    border: 'border-rose-500',
    bg: 'bg-rose-500/20',
    text: 'text-rose-300',
    badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
  collision: {
    label: 'Collision (Solid)',
    stroke: '#38bdf8',
    fill: 'rgba(56, 189, 248, 0.25)',
    border: 'border-sky-500',
    bg: 'bg-sky-500/20',
    text: 'text-sky-300',
    badge: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  },
};

export const PhysicsHitboxEditor: React.FC<PhysicsHitboxEditorProps> = ({
  currentPack,
  selectedAction,
  setSelectedAction,
  removeBg,
  bgTolerance,
  bgSmoothness,
}) => {
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);
  const [activeTool, setActiveTool] = useState<EditorTool>('box_hurtbox');
  const [zoomLevel, setZoomLevel] = useState<number>(1.5);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);

  // Frame previews storage
  const [frameDataUrls, setFrameDataUrls] = useState<Record<number, string>>({});

  // Active frames
  const actionDef = currentPack.actions[selectedAction] || currentPack.actions.idle;
  const frames = actionDef.frames.slice(0, 8);
  const currentFrameDef = frames[selectedFrameIndex] || frames[0];

  const frameWidth = currentFrameDef?.sw || 300;
  const frameHeight = currentFrameDef?.sh || 400;

  // Multi-frame physics data dictionary: frameIndex -> FramePhysicsData
  const [physicsStore, setPhysicsStore] = useState<Record<number, FramePhysicsData>>({});

  // Active selected box id for transformation
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Mouse interaction state for drawing & dragging
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrawRect, setCurrentDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Dragging existing box or resize handle
  const [draggingBox, setDraggingBox] = useState<{
    id: string;
    mode: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w';
    startX: number;
    startY: number;
    initialBox: HitboxRect;
  } | null>(null);

  // Dragging pivot
  const [isDraggingPivot, setIsDraggingPivot] = useState<boolean>(false);

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize physics store with smart defaults when pack/action changes
  useEffect(() => {
    setPhysicsStore((prev) => {
      const nextStore = { ...prev };
      frames.forEach((frame, idx) => {
        if (!nextStore[idx]) {
          const defaultW = frame.sw || 300;
          const defaultH = frame.sh || 400;

          // Default pivot: character feet (center X, 92% Y)
          const pivotX = Math.round(defaultW * 0.5);
          const pivotY = Math.round(defaultH * 0.92);

          // Default initial hurtbox around character body
          const bodyHurtbox: HitboxRect = {
            id: `hurtbox_body_${idx}_${Date.now()}`,
            name: `Body Hurtbox`,
            type: 'hurtbox',
            x: Math.round(defaultW * 0.3),
            y: Math.round(defaultH * 0.25),
            width: Math.round(defaultW * 0.4),
            height: Math.round(defaultH * 0.65),
          };

          const boxes: HitboxRect[] = [bodyHurtbox];

          // If action is attack, pre-seed an attack hitbox
          if (selectedAction === 'attack' && idx >= 2 && idx <= 5) {
            boxes.push({
              id: `hitbox_slash_${idx}_${Date.now() + 1}`,
              name: `Weapon Strike`,
              type: 'hitbox',
              x: Math.round(defaultW * 0.6),
              y: Math.round(defaultH * 0.2),
              width: Math.round(defaultW * 0.35),
              height: Math.round(defaultH * 0.4),
            });
          }

          nextStore[idx] = {
            frameId: frame.id,
            frameIndex: idx,
            frameLabel: frame.label || `Frame ${idx + 1}`,
            frameWidth: defaultW,
            frameHeight: defaultH,
            pivot: {
              x: pivotX,
              y: pivotY,
              normalizedX: Number((pivotX / defaultW).toFixed(3)),
              normalizedY: Number((pivotY / defaultH).toFixed(3)),
            },
            boxes,
          };
        }
      });
      return nextStore;
    });
  }, [currentPack, selectedAction, frames]);

  // Load isolated frame images
  useEffect(() => {
    let cancelled = false;

    async function loadPreviews() {
      try {
        const sourceImg = await loadImage(actionDef.sheetUrl);
        const map: Record<number, string> = {};

        for (let i = 0; i < frames.length; i++) {
          const f = frames[i];
          const canvas = processFrameCanvas(
            sourceImg,
            f,
            removeBg,
            bgTolerance,
            bgSmoothness,
            f.sw || 300,
            f.sh || 400
          );
          map[i] = canvas.toDataURL('image/png');
        }

        if (!cancelled) {
          setFrameDataUrls(map);
        }
      } catch (err) {
        console.error('Failed to generate frame previews:', err);
      }
    }

    loadPreviews();
    return () => {
      cancelled = true;
    };
  }, [actionDef, frames, removeBg, bgTolerance, bgSmoothness]);

  // Current frame physics data
  const currentPhysics: FramePhysicsData = physicsStore[selectedFrameIndex] || {
    frameId: currentFrameDef?.id || 'frame_0',
    frameIndex: selectedFrameIndex,
    frameLabel: currentFrameDef?.label || `Frame ${selectedFrameIndex + 1}`,
    frameWidth,
    frameHeight,
    pivot: {
      x: Math.round(frameWidth * 0.5),
      y: Math.round(frameHeight * 0.92),
      normalizedX: 0.5,
      normalizedY: 0.92,
    },
    boxes: [],
  };

  // Update pivot for current frame
  const updatePivot = useCallback((newX: number, newY: number) => {
    const clampedX = Math.max(0, Math.min(frameWidth, Math.round(newX)));
    const clampedY = Math.max(0, Math.min(frameHeight, Math.round(newY)));

    setPhysicsStore((prev) => ({
      ...prev,
      [selectedFrameIndex]: {
        ...prev[selectedFrameIndex],
        pivot: {
          x: clampedX,
          y: clampedY,
          normalizedX: Number((clampedX / frameWidth).toFixed(3)),
          normalizedY: Number((clampedY / frameHeight).toFixed(3)),
        },
      },
    }));
  }, [frameWidth, frameHeight, selectedFrameIndex]);

  // Preset pivot points
  const applyPivotPreset = (preset: 'feet' | 'center' | 'head' | 'bottom_left') => {
    if (preset === 'feet') {
      updatePivot(frameWidth * 0.5, frameHeight * 0.95);
    } else if (preset === 'center') {
      updatePivot(frameWidth * 0.5, frameHeight * 0.5);
    } else if (preset === 'head') {
      updatePivot(frameWidth * 0.5, frameHeight * 0.15);
    } else if (preset === 'bottom_left') {
      updatePivot(0, frameHeight);
    }
  };

  // Convert client pointer coordinates to frame canvas space
  const getCanvasCoords = (e: React.PointerEvent | MouseEvent) => {
    if (!canvasContainerRef.current) return { x: 0, y: 0 };
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / zoomLevel;
    const rawY = (e.clientY - rect.top) / zoomLevel;
    return {
      x: Math.max(0, Math.min(frameWidth, Math.round(rawX))),
      y: Math.max(0, Math.min(frameHeight, Math.round(rawY))),
    };
  };

  // Pointer down on main canvas
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // Left mouse click only
    if (e.button !== 0) return;
    const { x, y } = getCanvasCoords(e);

    if (activeTool === 'pivot') {
      updatePivot(x, y);
      setIsDraggingPivot(true);
      return;
    }

    if (activeTool.startsWith('box_')) {
      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentDrawRect({ x, y, w: 0, h: 0 });
      setSelectedBoxId(null);
    } else if (activeTool === 'select') {
      // Clicked on empty space: deselect
      setSelectedBoxId(null);
    }
  };

  // Global mouse move & up listeners
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingPivot) {
        if (!canvasContainerRef.current) return;
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const rawX = (e.clientX - rect.left) / zoomLevel;
        const rawY = (e.clientY - rect.top) / zoomLevel;
        updatePivot(rawX, rawY);
        return;
      }

      if (isDrawing && drawStart) {
        if (!canvasContainerRef.current) return;
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const curX = Math.max(0, Math.min(frameWidth, Math.round((e.clientX - rect.left) / zoomLevel)));
        const curY = Math.max(0, Math.min(frameHeight, Math.round((e.clientY - rect.top) / zoomLevel)));

        const rx = Math.min(drawStart.x, curX);
        const ry = Math.min(drawStart.y, curY);
        const rw = Math.abs(curX - drawStart.x);
        const rh = Math.abs(curY - drawStart.y);

        setCurrentDrawRect({ x: rx, y: ry, w: rw, h: rh });
        return;
      }

      if (draggingBox) {
        if (!canvasContainerRef.current) return;
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const curX = (e.clientX - rect.left) / zoomLevel;
        const curY = (e.clientY - rect.top) / zoomLevel;
        const dx = Math.round(curX - draggingBox.startX);
        const dy = Math.round(curY - draggingBox.startY);
        const initial = draggingBox.initialBox;

        let newX = initial.x;
        let newY = initial.y;
        let newW = initial.width;
        let newH = initial.height;

        if (draggingBox.mode === 'move') {
          newX = Math.max(0, Math.min(frameWidth - initial.width, initial.x + dx));
          newY = Math.max(0, Math.min(frameHeight - initial.height, initial.y + dy));
        } else if (draggingBox.mode === 'se') {
          newW = Math.max(10, Math.min(frameWidth - initial.x, initial.width + dx));
          newH = Math.max(10, Math.min(frameHeight - initial.y, initial.height + dy));
        } else if (draggingBox.mode === 'e') {
          newW = Math.max(10, Math.min(frameWidth - initial.x, initial.width + dx));
        } else if (draggingBox.mode === 's') {
          newH = Math.max(10, Math.min(frameHeight - initial.y, initial.height + dy));
        } else if (draggingBox.mode === 'nw') {
          const clampedDx = Math.min(initial.width - 10, Math.max(-initial.x, dx));
          const clampedDy = Math.min(initial.height - 10, Math.max(-initial.y, dy));
          newX = initial.x + clampedDx;
          newY = initial.y + clampedDy;
          newW = initial.width - clampedDx;
          newH = initial.height - clampedDy;
        } else if (draggingBox.mode === 'ne') {
          const clampedDy = Math.min(initial.height - 10, Math.max(-initial.y, dy));
          newY = initial.y + clampedDy;
          newW = Math.max(10, Math.min(frameWidth - initial.x, initial.width + dx));
          newH = initial.height - clampedDy;
        } else if (draggingBox.mode === 'sw') {
          const clampedDx = Math.min(initial.width - 10, Math.max(-initial.x, dx));
          newX = initial.x + clampedDx;
          newW = initial.width - clampedDx;
          newH = Math.max(10, Math.min(frameHeight - initial.y, initial.height + dy));
        }

        setPhysicsStore((prev) => {
          const frameData = prev[selectedFrameIndex];
          if (!frameData) return prev;
          const updatedBoxes = frameData.boxes.map((b) =>
            b.id === draggingBox.id
              ? { ...b, x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) }
              : b
          );
          return {
            ...prev,
            [selectedFrameIndex]: { ...frameData, boxes: updatedBoxes },
          };
        });
      }
    };

    const handlePointerUp = () => {
      if (isDraggingPivot) {
        setIsDraggingPivot(false);
      }

      if (isDrawing && currentDrawRect) {
        if (currentDrawRect.w >= 8 && currentDrawRect.h >= 8) {
          const boxType: BoxType = activeTool === 'box_hitbox' ? 'hitbox' : activeTool === 'box_collision' ? 'collision' : 'hurtbox';
          const typeName = boxType === 'hitbox' ? 'Attack Hitbox' : boxType === 'collision' ? 'Solid Collision' : 'Hurtbox';

          const newBox: HitboxRect = {
            id: `box_${Date.now()}`,
            name: `${typeName} ${currentPhysics.boxes.length + 1}`,
            type: boxType,
            x: currentDrawRect.x,
            y: currentDrawRect.y,
            width: currentDrawRect.w,
            height: currentDrawRect.h,
          };

          setPhysicsStore((prev) => {
            const frameData = prev[selectedFrameIndex];
            return {
              ...prev,
              [selectedFrameIndex]: {
                ...frameData,
                boxes: [...frameData.boxes, newBox],
              },
            };
          });

          setSelectedBoxId(newBox.id);
        }
        setIsDrawing(false);
        setDrawStart(null);
        setCurrentDrawRect(null);
      }

      if (draggingBox) {
        setDraggingBox(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    isDraggingPivot,
    isDrawing,
    drawStart,
    currentDrawRect,
    draggingBox,
    zoomLevel,
    frameWidth,
    frameHeight,
    activeTool,
    currentPhysics.boxes.length,
    selectedFrameIndex,
    updatePivot,
  ]);

  // Start dragging or resizing a box
  const handleBoxPointerDown = (
    e: React.PointerEvent,
    box: HitboxRect,
    mode: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w'
  ) => {
    e.stopPropagation();
    if (activeTool === 'pivot') return;

    setSelectedBoxId(box.id);
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const curX = (e.clientX - rect.left) / zoomLevel;
    const curY = (e.clientY - rect.top) / zoomLevel;

    setDraggingBox({
      id: box.id,
      mode,
      startX: curX,
      startY: curY,
      initialBox: { ...box },
    });
  };

  // Delete box
  const handleDeleteBox = (boxId: string) => {
    setPhysicsStore((prev) => {
      const frameData = prev[selectedFrameIndex];
      if (!frameData) return prev;
      return {
        ...prev,
        [selectedFrameIndex]: {
          ...frameData,
          boxes: frameData.boxes.filter((b) => b.id !== boxId),
        },
      };
    });
    if (selectedBoxId === boxId) {
      setSelectedBoxId(null);
    }
  };

  // Update box properties directly from sidebar inputs
  const handleUpdateBoxProp = (boxId: string, field: keyof HitboxRect, value: any) => {
    setPhysicsStore((prev) => {
      const frameData = prev[selectedFrameIndex];
      if (!frameData) return prev;
      return {
        ...prev,
        [selectedFrameIndex]: {
          ...frameData,
          boxes: frameData.boxes.map((b) => (b.id === boxId ? { ...b, [field]: value } : b)),
        },
      };
    });
  };

  // Copy current frame's boxes and pivot to all frames in the action
  const handleCopyPhysicsToAllFrames = () => {
    setPhysicsStore((prev) => {
      const source = prev[selectedFrameIndex];
      if (!source) return prev;
      const next = { ...prev };

      frames.forEach((f, idx) => {
        next[idx] = {
          ...next[idx],
          pivot: { ...source.pivot },
          boxes: source.boxes.map((b) => ({
            ...b,
            id: `box_${idx}_${Math.random().toString(36).substring(2, 7)}`,
          })),
        };
      });

      return next;
    });

    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  // Generate full physics data payload
  const generateExportPayload = () => {
    const framesExport = frames.map((frame, idx) => {
      const p = physicsStore[idx] || {
        frameId: frame.id,
        frameIndex: idx,
        frameLabel: frame.label || `Frame ${idx + 1}`,
        frameWidth: frame.sw || 300,
        frameHeight: frame.sh || 400,
        pivot: {
          x: Math.round((frame.sw || 300) * 0.5),
          y: Math.round((frame.sh || 400) * 0.95),
          normalizedX: 0.5,
          normalizedY: 0.95,
        },
        boxes: [],
      };

      return {
        frameIndex: idx,
        frameId: frame.id,
        frameLabel: frame.label || `Frame ${idx + 1}`,
        frameWidth: p.frameWidth,
        frameHeight: p.frameHeight,
        pivot: p.pivot,
        boxes: p.boxes.map((b) => ({
          id: b.id,
          name: b.name,
          type: b.type,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          normalizedX: Number((b.x / p.frameWidth).toFixed(3)),
          normalizedY: Number((b.y / p.frameHeight).toFixed(3)),
          normalizedWidth: Number((b.width / p.frameWidth).toFixed(3)),
          normalizedHeight: Number((b.height / p.frameHeight).toFixed(3)),
        })),
      };
    });

    return {
      characterId: currentPack.id,
      characterName: currentPack.name,
      action: selectedAction,
      engineCompatibility: ['Unity (2D BoxCollider/Physics)', 'Godot 4 (CollisionShape2D)', 'Phaser 3', 'Custom Engine'],
      exportedAt: new Date().toISOString(),
      sourceSheetUrl: actionDef.sheetUrl,
      defaultCellSize: {
        width: frameWidth,
        height: frameHeight,
      },
      totalFrames: frames.length,
      frames: framesExport,
    };
  };

  // Download JSON file
  const handleExportPhysicsJson = () => {
    const payload = generateExportPayload();
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPack.id}_${selectedAction}_physics_data.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy JSON to clipboard
  const handleCopyJsonToClipboard = () => {
    const payload = generateExportPayload();
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  const selectedBox = currentPhysics.boxes.find((b) => b.id === selectedBoxId) || null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-amber-400" />
            <span>Physics & Hitbox Editor</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
            <span>Per-Frame Pivot & Origin Tuning</span>
            <span aria-hidden="true">·</span>
            <span>Damage Hitboxes & Hurtboxes</span>
            <span aria-hidden="true">·</span>
            <span>Real-time Coordinates</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-400">Export Physics JSON</span>
          </p>
        </div>

        {/* Action Selection Tabs & Export Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
            {(['idle', 'run', 'jump', 'attack', 'climb', 'defense'] as SpriteAction[]).map((act) => (
              <button
                key={act}
                onClick={() => {
                  setSelectedAction(act);
                  setSelectedFrameIndex(0);
                  setSelectedBoxId(null);
                }}
                className={`px-2.5 py-1 text-xs rounded font-medium capitalize transition-all ${
                  selectedAction === act
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {act}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportPhysicsJson}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-md transition-all active:scale-95"
            title="Download engine-ready physics JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Physics Data</span>
          </button>
        </div>
      </div>

      {/* Frame Selection Filmstrip */}
      <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/90 shadow-md">
        <div className="flex items-center justify-between mb-2 px-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">Animation Filmstrip:</span>
            <span className="font-mono text-amber-400 capitalize">
              {selectedAction} Action ({frames.length} frames)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedFrameIndex((prev) => Math.max(0, prev - 1))}
              disabled={selectedFrameIndex === 0}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors"
              title="Previous Frame (Left Arrow)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-xs text-slate-300">
              Frame {selectedFrameIndex + 1} / {frames.length}
            </span>
            <button
              onClick={() => setSelectedFrameIndex((prev) => Math.min(frames.length - 1, prev + 1))}
              disabled={selectedFrameIndex === frames.length - 1}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors"
              title="Next Frame (Right Arrow)"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
          {frames.map((frame, idx) => {
            const isSelected = idx === selectedFrameIndex;
            const pData = physicsStore[idx];
            const boxCount = pData?.boxes?.length || 0;

            return (
              <button
                key={frame.id}
                onClick={() => {
                  setSelectedFrameIndex(idx);
                  setSelectedBoxId(null);
                }}
                className={`relative rounded-lg p-1.5 flex flex-col items-center border transition-all text-left ${
                  isSelected
                    ? 'border-amber-400 bg-amber-400/10 ring-2 ring-amber-400/40 shadow-lg'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                }`}
              >
                <div className="w-full aspect-[3/4] relative rounded overflow-hidden canvas-checkerboard flex items-center justify-center bg-slate-900/60">
                  {frameDataUrls[idx] ? (
                    <img
                      src={frameDataUrls[idx]}
                      alt={frame.label}
                      className="max-h-full max-w-full object-contain pixelated"
                    />
                  ) : (
                    <div className="text-[10px] text-slate-500 font-mono">Loading...</div>
                  )}

                  {/* Frame index pill */}
                  <span className="absolute top-1 left-1 px-1 py-0.2 bg-slate-950/80 rounded text-[9px] font-mono text-amber-300 border border-slate-800">
                    0{idx + 1}
                  </span>

                  {/* Box Count Badge */}
                  {boxCount > 0 && (
                    <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-slate-950/90 rounded text-[8px] font-mono text-emerald-400 border border-emerald-500/40">
                      {boxCount} {boxCount === 1 ? 'box' : 'boxes'}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-300 mt-1 truncate w-full text-center">
                  {frame.label || `Frame ${idx + 1}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Center / Left Viewport Canvas (Col 8) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Canvas Toolbar */}
          <div className="border border-slate-800 rounded-xl px-4 py-2.5 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Tools Palette */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold mr-1">Tool:</span>

              {/* Set Pivot Tool */}
              <button
                onClick={() => {
                  setActiveTool('pivot');
                  setSelectedBoxId(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTool === 'pivot'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
                title="Click anywhere to set character pivot / ground point"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Set Pivot (Origin)</span>
              </button>

              {/* Draw Hurtbox Tool */}
              <button
                onClick={() => {
                  setActiveTool('box_hurtbox');
                  setSelectedBoxId(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTool === 'box_hurtbox'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800'
                }`}
                title="Click and drag to draw a body Hurtbox"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>+ Hurtbox</span>
              </button>

              {/* Draw Hitbox Tool */}
              <button
                onClick={() => {
                  setActiveTool('box_hitbox');
                  setSelectedBoxId(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTool === 'box_hitbox'
                    ? 'bg-rose-500 text-white font-bold shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-rose-300 border border-slate-800'
                }`}
                title="Click and drag to draw an attack damage Hitbox"
              >
                <Sword className="w-3.5 h-3.5" />
                <span>+ Hitbox</span>
              </button>

              {/* Draw Collision Tool */}
              <button
                onClick={() => {
                  setActiveTool('box_collision');
                  setSelectedBoxId(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTool === 'box_collision'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-sky-300 border border-slate-800'
                }`}
                title="Click and drag to draw a solid terrain boundary"
              >
                <Box className="w-3.5 h-3.5" />
                <span>+ Collision</span>
              </button>

              {/* Select Tool */}
              <button
                onClick={() => setActiveTool('select')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                  activeTool === 'select'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
                title="Select and resize existing boxes"
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span>Select</span>
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Zoom:</span>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => setZoomLevel((prev) => Math.max(1, prev - 0.25))}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono text-[11px] text-amber-300 font-semibold min-w-[48px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((prev) => Math.min(3, prev + 0.25))}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Frame Viewport */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-2xl relative">
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">Frame Viewport:</span>
                <span className="font-mono text-amber-400">
                  {currentFrameDef?.label || `Frame ${selectedFrameIndex + 1}`} ({frameWidth}×{frameHeight} px)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span>
                  Pivot: ({currentPhysics.pivot.x}, {currentPhysics.pivot.y})
                </span>
                <span aria-hidden="true">·</span>
                <span>Boxes: {currentPhysics.boxes.length}</span>
              </div>
            </div>

            {/* Scrollable Viewport Area */}
            <div className="p-8 overflow-auto min-h-[520px] max-h-[620px] flex items-center justify-center bg-[#11141a] relative select-none">
              <div
                ref={canvasContainerRef}
                onPointerDown={handleCanvasPointerDown}
                className="relative border border-slate-700/80 shadow-2xl canvas-checkerboard select-none touch-none"
                style={{
                  width: `${frameWidth * zoomLevel}px`,
                  height: `${frameHeight * zoomLevel}px`,
                  cursor:
                    activeTool === 'pivot'
                      ? 'crosshair'
                      : activeTool.startsWith('box_')
                      ? 'crosshair'
                      : 'default',
                }}
              >
                {/* Character Frame Graphic */}
                {frameDataUrls[selectedFrameIndex] && (
                  <img
                    src={frameDataUrls[selectedFrameIndex]}
                    alt="Character Frame"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none pixelated"
                    style={{
                      imageRendering: 'pixelated',
                    }}
                  />
                )}

                {/* Drawn Hitbox Rectangles */}
                {currentPhysics.boxes.map((box) => {
                  const isSelected = box.id === selectedBoxId;
                  const cfg = BOX_COLOR_CONFIG[box.type] || BOX_COLOR_CONFIG.hurtbox;

                  return (
                    <div
                      key={box.id}
                      onPointerDown={(e) => handleBoxPointerDown(e, box, 'move')}
                      className={`absolute transition-shadow group ${
                        isSelected
                          ? 'ring-2 ring-white/90 shadow-[0_0_15px_rgba(255,255,255,0.4)] z-20 cursor-move'
                          : 'hover:ring-1 hover:ring-white/50 z-10 cursor-pointer'
                      }`}
                      style={{
                        left: `${box.x * zoomLevel}px`,
                        top: `${box.y * zoomLevel}px`,
                        width: `${box.width * zoomLevel}px`,
                        height: `${box.height * zoomLevel}px`,
                        backgroundColor: cfg.fill,
                        border: `2px solid ${cfg.stroke}`,
                      }}
                    >
                      {/* Box Label Tag */}
                      <div
                        className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold leading-none pointer-events-none select-none shadow-md ${cfg.badge}`}
                      >
                        {box.name} ({box.width}×{box.height})
                      </div>

                      {/* 8 Resize Handles (Visible when selected) */}
                      {isSelected && (
                        <>
                          {/* NW */}
                          <div
                            onPointerDown={(e) => handleBoxPointerDown(e, box, 'nw')}
                            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-slate-900 rounded-sm cursor-nwse-resize shadow-md"
                          />
                          {/* N */}
                          <div
                            onPointerDown={(e) => handleBoxPointerDown(e, box, 'n')}
                            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-slate-900 rounded-sm cursor-ns-resize shadow-md"
                          />
                          {/* NE */}
                          <div
                            onPointerDown={(e) => handleBoxPointerDown(e, box, 'ne')}
                            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-slate-900 rounded-sm cursor-nesw-resize shadow-md"
                          />
                          {/* E */}
                          <div
                            onPointerDown={(e) => handleBoxPointerDown(e, box, 'e')}
                            className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-white border border-slate-900 rounded-sm cursor-ew-resize shadow-md"
                          />
                          {/* SE */}
                          <div
                            onPointerDown={(e) => handleBoxPointerDown(e, box, 'se')}
                            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-slate-900 rounded-sm cursor-nwse-resize shadow-md"
                          />
                          {/* S */}
                          <div
                            onPointerDown={(e) => handleBoxPointerDown(e, box, 's')}
                            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-slate-900 rounded-sm cursor-ns-resize shadow-md"
                          />
                          {/* SW */}
                          <div
                            onPointerDown={(e) => handleBoxPointerDown(e, box, 'sw')}
                            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-slate-900 rounded-sm cursor-nesw-resize shadow-md"
                          />
                          {/* W */}
                          <div
                            onPointerDown={(e) => handleBoxPointerDown(e, box, 'w')}
                            className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-white border border-slate-900 rounded-sm cursor-ew-resize shadow-md"
                          />
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Temporary rectangle while drawing */}
                {isDrawing && currentDrawRect && (
                  <div
                    className="absolute border-2 border-dashed border-amber-400 bg-amber-400/20 pointer-events-none z-30"
                    style={{
                      left: `${currentDrawRect.x * zoomLevel}px`,
                      top: `${currentDrawRect.y * zoomLevel}px`,
                      width: `${currentDrawRect.w * zoomLevel}px`,
                      height: `${currentDrawRect.h * zoomLevel}px`,
                    }}
                  >
                    <div className="absolute -top-5 left-0 px-1 py-0.5 bg-slate-950 text-amber-300 text-[9px] font-mono rounded">
                      {currentDrawRect.w}×{currentDrawRect.h} px
                    </div>
                  </div>
                )}

                {/* Pivot (Origin) Crosshair Marker */}
                <div
                  className="absolute pointer-events-none z-40 select-none"
                  style={{
                    left: `${currentPhysics.pivot.x * zoomLevel}px`,
                    top: `${currentPhysics.pivot.y * zoomLevel}px`,
                  }}
                >
                  {/* Subtle crosshair guide lines */}
                  <div className="absolute top-0 -left-[1000px] w-[2000px] h-[1px] bg-amber-400/40 pointer-events-none -translate-y-1/2" />
                  <div className="absolute left-0 -top-[1000px] h-[2000px] w-[1px] bg-amber-400/40 pointer-events-none -translate-x-1/2" />

                  {/* Concentric Bullseye Marker */}
                  <div className="relative -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-amber-400 flex items-center justify-center bg-slate-950/40 shadow-[0_0_10px_rgba(245,158,11,0.8)]">
                    <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,1)]" />
                  </div>

                  {/* Pivot coordinate badge */}
                  <div className="absolute top-3 left-3 px-1.5 py-0.5 rounded bg-slate-950/90 border border-amber-400 text-[10px] font-mono text-amber-300 whitespace-nowrap shadow-xl">
                    Origin: ({currentPhysics.pivot.x}, {currentPhysics.pivot.y})
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Status / Instructions Bar */}
            <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {activeTool === 'pivot'
                    ? 'Click anywhere on the character (or drag) to position the physics pivot / foot ground origin.'
                    : activeTool.startsWith('box_')
                    ? 'Click and drag on the frame to draw a box. Release to place.'
                    : 'Click a box to select. Drag edges or corners to resize, drag center to move.'}
                </span>
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-slate-500">
                  Frame: {frameWidth}×{frameHeight} px
                </span>
                <button
                  onClick={() => setShowJsonModal(true)}
                  className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>View Raw JSON</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Real-time Coordinates & Properties Inspector (Col 4) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Section 1: Pivot (Origin) Controls */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/90 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-amber-400" />
                <span>Pivot (Origin) Coordinates</span>
              </h2>
              <span className="font-mono text-xs text-amber-400">
                ({currentPhysics.pivot.normalizedX * 100}%, {currentPhysics.pivot.normalizedY * 100}%)
              </span>
            </div>

            {/* Exact X & Y pixel inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 flex items-center justify-between">
                  <span>Pivot X (px)</span>
                  <span className="text-[10px] text-slate-500 font-mono">0 – {frameWidth}</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={frameWidth}
                  value={currentPhysics.pivot.x}
                  onChange={(e) => updatePivot(parseInt(e.target.value, 10) || 0, currentPhysics.pivot.y)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded px-2.5 py-1.5 text-xs text-amber-200 font-mono focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 flex items-center justify-between">
                  <span>Pivot Y (px)</span>
                  <span className="text-[10px] text-slate-500 font-mono">0 – {frameHeight}</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={frameHeight}
                  value={currentPhysics.pivot.y}
                  onChange={(e) => updatePivot(currentPhysics.pivot.x, parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded px-2.5 py-1.5 text-xs text-amber-200 font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Quick Pivot Presets */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-slate-400">Quick Pivot Presets:</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => applyPivotPreset('feet')}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-medium text-left flex items-center justify-between transition-colors"
                >
                  <span>Feet (Ground)</span>
                  <span className="font-mono text-[10px] text-amber-400">50%, 95%</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPivotPreset('center')}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-medium text-left flex items-center justify-between transition-colors"
                >
                  <span>Center</span>
                  <span className="font-mono text-[10px] text-amber-400">50%, 50%</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPivotPreset('head')}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-medium text-left flex items-center justify-between transition-colors"
                >
                  <span>Head</span>
                  <span className="font-mono text-[10px] text-amber-400">50%, 15%</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPivotPreset('bottom_left')}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-medium text-left flex items-center justify-between transition-colors"
                >
                  <span>Bottom-Left</span>
                  <span className="font-mono text-[10px] text-amber-400">0%, 100%</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Selected Box Real-time Inspector */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/90 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Square className="w-4 h-4 text-amber-400" />
                <span>Box Inspector</span>
              </h2>
              {selectedBox && (
                <button
                  onClick={() => handleDeleteBox(selectedBox.id)}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                  title="Delete this box"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>

            {selectedBox ? (
              <div className="space-y-3">
                {/* Name & Type */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Box Name</label>
                  <input
                    type="text"
                    value={selectedBox.name}
                    onChange={(e) => handleUpdateBoxProp(selectedBox.id, 'name', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Box Role / Type</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['hurtbox', 'hitbox', 'collision'] as BoxType[]).map((t) => {
                      const cfg = BOX_COLOR_CONFIG[t];
                      const active = selectedBox.type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleUpdateBoxProp(selectedBox.id, 'type', t)}
                          className={`py-1.5 px-2 rounded text-xs font-semibold border capitalize transition-all ${
                            active
                              ? `${cfg.badge} border-current ring-1 ring-current`
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Real-time Dimensions: X, Y, Width, Height */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Position X (px)</label>
                    <input
                      type="number"
                      min="0"
                      max={frameWidth}
                      value={selectedBox.x}
                      onChange={(e) =>
                        handleUpdateBoxProp(selectedBox.id, 'x', Math.max(0, parseInt(e.target.value, 10) || 0))
                      }
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded px-2 py-1 text-xs text-amber-200 font-mono focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Position Y (px)</label>
                    <input
                      type="number"
                      min="0"
                      max={frameHeight}
                      value={selectedBox.y}
                      onChange={(e) =>
                        handleUpdateBoxProp(selectedBox.id, 'y', Math.max(0, parseInt(e.target.value, 10) || 0))
                      }
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded px-2 py-1 text-xs text-amber-200 font-mono focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Width (px)</label>
                    <input
                      type="number"
                      min="8"
                      max={frameWidth}
                      value={selectedBox.width}
                      onChange={(e) =>
                        handleUpdateBoxProp(
                          selectedBox.id,
                          'width',
                          Math.max(8, parseInt(e.target.value, 10) || 8)
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded px-2 py-1 text-xs text-amber-200 font-mono focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Height (px)</label>
                    <input
                      type="number"
                      min="8"
                      max={frameHeight}
                      value={selectedBox.height}
                      onChange={(e) =>
                        handleUpdateBoxProp(
                          selectedBox.id,
                          'height',
                          Math.max(8, parseInt(e.target.value, 10) || 8)
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded px-2 py-1 text-xs text-amber-200 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                <MousePointer className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p>No box selected.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Click a box on the canvas or choose a tool above to draw a new one.
                </p>
              </div>
            )}
          </div>

          {/* Section 3: List of all boxes on current frame */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/90 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Frame Boxes ({currentPhysics.boxes.length})</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const newBox: HitboxRect = {
                    id: `box_${Date.now()}`,
                    name: `Hurtbox ${currentPhysics.boxes.length + 1}`,
                    type: 'hurtbox',
                    x: Math.round(frameWidth * 0.35),
                    y: Math.round(frameHeight * 0.3),
                    width: Math.round(frameWidth * 0.3),
                    height: Math.round(frameHeight * 0.5),
                  };
                  setPhysicsStore((prev) => ({
                    ...prev,
                    [selectedFrameIndex]: {
                      ...prev[selectedFrameIndex],
                      boxes: [...prev[selectedFrameIndex].boxes, newBox],
                    },
                  }));
                  setSelectedBoxId(newBox.id);
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-medium"
              >
                + Add Box
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {currentPhysics.boxes.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2 text-center">No boxes drawn on this frame.</p>
              ) : (
                currentPhysics.boxes.map((b) => {
                  const isSelected = b.id === selectedBoxId;
                  const cfg = BOX_COLOR_CONFIG[b.type] || BOX_COLOR_CONFIG.hurtbox;

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBoxId(b.id)}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400/10'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.bg} border ${cfg.border}`} />
                        <span className="font-medium text-slate-200 truncate">{b.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-[10px] text-slate-400">
                          {b.width}×{b.height}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBox(b.id);
                          }}
                          className="text-slate-500 hover:text-rose-400 p-0.5"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Multi-frame Replication Helpers */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={handleCopyPhysicsToAllFrames}
                className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {copiedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied to All {frames.length} Frames!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Copy Setup to All Frames</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Raw JSON Inspection Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#12151b] border border-slate-800 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Physics & Hitbox Data JSON</h3>
              </div>
              <button
                onClick={() => setShowJsonModal(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-slate-950 font-mono text-xs text-amber-300/90 leading-relaxed">
              <pre>{JSON.stringify(generateExportPayload(), null, 2)}</pre>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
              <button
                onClick={handleCopyJsonToClipboard}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs flex items-center gap-1.5 transition-colors font-medium"
              >
                {copiedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSuccess ? 'Copied to Clipboard!' : 'Copy JSON'}</span>
              </button>

              <button
                onClick={handleExportPhysicsJson}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
