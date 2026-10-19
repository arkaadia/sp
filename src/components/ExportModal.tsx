import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Archive,
  ImageIcon,
  Check,
  Copy,
  Sliders,
  Sparkles,
  FileCode,
  Box,
  Layers,
  RefreshCw,
  Eye,
  FileJson
} from 'lucide-react';
import JSZip from 'jszip';
import { CharacterPack, FrameDefinition, SpriteAction } from '../types/sprites';
import { loadImage, processFrameCanvas } from '../utils/imageProcessor';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPack: CharacterPack;
  removeBg: boolean;
  bgTolerance: number;
  bgSmoothness: number;
}

export type ExportPreset = 'generic' | 'godot' | 'unity';

interface ProcessedFrameItem {
  action: SpriteAction;
  index: number;
  id: string;
  name: string;
  originalCanvas: HTMLCanvasElement;
  sourceW: number;
  sourceH: number;
  trimX: number;
  trimY: number;
  w: number;
  h: number;
  packedX?: number;
  packedY?: number;
}

// Trims transparent borders around a canvas by finding the alpha bounding box
function trimTransparentBorders(canvas: HTMLCanvasElement): {
  canvas: HTMLCanvasElement;
  trimX: number;
  trimY: number;
  w: number;
  h: number;
} {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { canvas, trimX: 0, trimY: 0, w: canvas.width, h: canvas.height };
  }

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  let hasPixel = false;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha > 8) {
        hasPixel = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPixel) {
    return { canvas, trimX: 0, trimY: 0, w: canvas.width, h: canvas.height };
  }

  const w = Math.max(8, maxX - minX + 1);
  const h = Math.max(8, maxY - minY + 1);

  const trimmed = document.createElement('canvas');
  trimmed.width = w;
  trimmed.height = h;
  const tCtx = trimmed.getContext('2d');
  if (tCtx) {
    tCtx.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
  }

  return { canvas: trimmed, trimX: minX, trimY: minY, w, h };
}

// 2D Shelf/Bin-Packing algorithm: packs trimmed frames tightly into a minimal-area atlas
function packSpriteFrames(
  items: ProcessedFrameItem[],
  padding: number = 2,
  powerOfTwo: boolean = true
): { atlasCanvas: HTMLCanvasElement; atlasWidth: number; atlasHeight: number } {
  // Sort items by height descending for optimal shelf layout
  const sorted = [...items].sort((a, b) => b.h - a.h);

  // Estimate total pixel area to choose an appropriate target width
  const totalArea = sorted.reduce((sum, item) => sum + (item.w + padding) * (item.h + padding), 0);
  let targetWidth = Math.max(512, Math.ceil(Math.sqrt(totalArea * 1.25)));
  if (powerOfTwo) {
    targetWidth = Math.pow(2, Math.ceil(Math.log2(targetWidth)));
  }

  let currentX = padding;
  let currentY = padding;
  let shelfHeight = 0;
  let maxW = 0;
  let maxH = 0;

  for (const item of sorted) {
    if (currentX + item.w + padding > targetWidth) {
      // Advance to next shelf row
      currentX = padding;
      currentY += shelfHeight + padding;
      shelfHeight = 0;
    }

    item.packedX = currentX;
    item.packedY = currentY;

    currentX += item.w + padding;
    if (item.h > shelfHeight) {
      shelfHeight = item.h;
    }

    if (currentX > maxW) maxW = currentX;
    if (currentY + item.h + padding > maxH) maxH = currentY + item.h + padding;
  }

  let finalW = maxW + padding;
  let finalH = maxH + padding;

  if (powerOfTwo) {
    finalW = Math.pow(2, Math.ceil(Math.log2(Math.max(128, finalW))));
    finalH = Math.pow(2, Math.ceil(Math.log2(Math.max(128, finalH))));
  }

  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = Math.max(128, finalW);
  atlasCanvas.height = Math.max(128, finalH);
  const ctx = atlasCanvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    for (const item of sorted) {
      if (item.packedX !== undefined && item.packedY !== undefined) {
        ctx.drawImage(item.originalCanvas, item.packedX, item.packedY);
      }
    }
  }

  return { atlasCanvas, atlasWidth: atlasCanvas.width, atlasHeight: atlasCanvas.height };
}

// Generate Generic JSON (TexturePacker / PixiJS hash format with UVs)
function buildGenericJson(
  items: ProcessedFrameItem[],
  atlasWidth: number,
  atlasHeight: number,
  characterName: string,
  imageName: string
): string {
  const framesObj: Record<string, any> = {};

  items.forEach((item) => {
    const px = item.packedX || 0;
    const py = item.packedY || 0;
    const frameKey = item.name;

    framesObj[frameKey] = {
      frame: { x: px, y: py, w: item.w, h: item.h },
      rotated: false,
      trimmed: item.trimX > 0 || item.trimY > 0 || item.w !== item.sourceW || item.h !== item.sourceH,
      spriteSourceSize: { x: item.trimX, y: item.trimY, w: item.w, h: item.h },
      sourceSize: { w: item.sourceW, h: item.sourceH },
      uv: {
        u0: Number((px / atlasWidth).toFixed(4)),
        v0: Number((py / atlasHeight).toFixed(4)),
        u1: Number(((px + item.w) / atlasWidth).toFixed(4)),
        v1: Number(((py + item.h) / atlasHeight).toFixed(4)),
      },
      pivot: { x: 0.5, y: 0.95 },
    };
  });

  return JSON.stringify(
    {
      frames: framesObj,
      meta: {
        app: 'Elysian Sprite Studio - Advanced Game Engine Exporter',
        version: '2.0',
        image: imageName,
        format: 'RGBA8888',
        size: { w: atlasWidth, h: atlasHeight },
        scale: 1,
        character: characterName,
      },
    },
    null,
    2
  );
}

// Generate Godot 4 .tres SpriteFrames resource format
function buildGodotSpriteFrames(
  items: ProcessedFrameItem[],
  imageFileName: string
): string {
  const actionsMap = new Map<string, ProcessedFrameItem[]>();
  items.forEach((item) => {
    if (!actionsMap.has(item.action)) actionsMap.set(item.action, []);
    actionsMap.get(item.action)!.push(item);
  });

  let subResources = '';
  let animBlocks = '';

  actionsMap.forEach((frames, action) => {
    const frameRefs: string[] = [];

    frames.sort((a, b) => a.index - b.index).forEach((f) => {
      const subId = `AtlasTexture_${action}_${f.index}`;
      subResources += `[sub_resource type="AtlasTexture" id="${subId}"]\n`;
      subResources += `atlas = ExtResource("1_atlas")\n`;
      subResources += `region = Rect2(${f.packedX || 0}, ${f.packedY || 0}, ${f.w}, ${f.h})\n\n`;

      frameRefs.push(`{\n"duration": 1.0,\n"texture": SubResource("${subId}")\n}`);
    });

    const isLoop = action !== 'attack' && action !== 'jump';
    const fps = action === 'run' ? 12.0 : 10.0;

    animBlocks += `{\n"frames": [\n${frameRefs.join(',\n')}\n],\n"loop": ${isLoop},\n"name": &"${action}",\n"speed": ${fps.toFixed(1)}\n},\n`;
  });

  return `[gd_resource type="SpriteFrames" load_steps=${items.length + 2} format=3]

[ext_resource type="Texture2D" path="res://${imageFileName}" id="1_atlas"]

${subResources}[resource]
animations = [
${animBlocks.replace(/,\n$/, '')}
]
`;
}

// Generate Unity Sprite Data (.json / .meta structure)
function buildUnitySpriteData(
  items: ProcessedFrameItem[],
  atlasWidth: number,
  atlasHeight: number,
  imageFileName: string
): string {
  const spriteRects = items.map((f) => {
    const px = f.packedX || 0;
    // Unity uses bottom-left as origin (Y inverted)
    const unityY = atlasHeight - (f.packedY || 0) - f.h;

    return {
      name: f.name,
      rect: {
        x: px,
        y: Math.max(0, unityY),
        width: f.w,
        height: f.h,
      },
      alignment: 7, // BottomCenter pivot
      pivot: { x: 0.5, y: 0.05 },
      border: { x: 0, y: 0, z: 0, w: 0 },
      sourceSize: { x: f.sourceW, y: f.sourceH },
      trimOffset: { x: f.trimX, y: f.trimY },
    };
  });

  return JSON.stringify(
    {
      TextureImporter: {
        spriteMode: 2, // Multiple sprites
        spritePixelsPerUnit: 100,
        spriteExtrude: 1,
        spriteMeshType: 0,
        alignment: 7,
        spritePivot: { x: 0.5, y: 0.05 },
        sprites: spriteRects,
      },
      meta: {
        textureFile: imageFileName,
        generator: 'Elysian Sprite Studio - Advanced Game Engine Exporter',
        atlasSize: { width: atlasWidth, height: atlasHeight },
      },
    },
    null,
    2
  );
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  currentPack,
  removeBg,
  bgTolerance,
  bgSmoothness,
}) => {
  // Texture Packer configuration
  const [packStrategy, setPackStrategy] = useState<'texture_packer' | 'grid'>('texture_packer');
  const [trimEmptySpace, setTrimEmptySpace] = useState<boolean>(true);
  const [powerOfTwo, setPowerOfTwo] = useState<boolean>(true);
  const [exportMetadataJson, setExportMetadataJson] = useState<boolean>(true);
  const [selectedPreset, setSelectedPreset] = useState<ExportPreset>('generic');
  const [actionScope, setActionScope] = useState<'all' | 'primary'>('all');

  // Preview & Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [atlasPreviewUrl, setAtlasPreviewUrl] = useState<string | null>(null);
  const [atlasStats, setAtlasStats] = useState<{ width: number; height: number; frameCount: number } | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [generatedMetaCode, setGeneratedMetaCode] = useState<string>('');

  // Extract frames and generate atlas preview when configuration changes
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function generateAtlas() {
      setIsProcessing(true);
      try {
        const actionsToProcess: SpriteAction[] =
          actionScope === 'all'
            ? (['idle', 'run', 'jump', 'attack', 'climb', 'defense'] as SpriteAction[])
            : (['idle', 'run', 'jump'] as SpriteAction[]);

        const processedItems: ProcessedFrameItem[] = [];

        for (const act of actionsToProcess) {
          const actionDef = currentPack.actions[act];
          if (!actionDef) continue;

          const sourceImg = await loadImage(actionDef.sheetUrl);
          const frames = actionDef.frames.slice(0, 8);

          frames.forEach((frameDef, idx) => {
            const rawCanvas = processFrameCanvas(
              sourceImg,
              frameDef,
              removeBg,
              bgTolerance,
              bgSmoothness,
              frameDef.sw,
              frameDef.sh
            );

            const sourceW = rawCanvas.width;
            const sourceH = rawCanvas.height;

            if (trimEmptySpace) {
              const trimmed = trimTransparentBorders(rawCanvas);
              processedItems.push({
                action: act,
                index: idx,
                id: `${act}_${idx + 1}`,
                name: `${currentPack.id}_${act}_${String(idx + 1).padStart(2, '0')}`,
                originalCanvas: trimmed.canvas,
                sourceW,
                sourceH,
                trimX: trimmed.trimX,
                trimY: trimmed.trimY,
                w: trimmed.w,
                h: trimmed.h,
              });
            } else {
              processedItems.push({
                action: act,
                index: idx,
                id: `${act}_${idx + 1}`,
                name: `${currentPack.id}_${act}_${String(idx + 1).padStart(2, '0')}`,
                originalCanvas: rawCanvas,
                sourceW,
                sourceH,
                trimX: 0,
                trimY: 0,
                w: sourceW,
                h: sourceH,
              });
            }
          });
        }

        const { atlasCanvas, atlasWidth, atlasHeight } = packSpriteFrames(processedItems, 2, powerOfTwo);
        const dataUrl = atlasCanvas.toDataURL('image/png');

        const imageFileName = `${currentPack.id}_packed_spritesheet.png`;
        let metaText = '';

        if (selectedPreset === 'godot') {
          metaText = buildGodotSpriteFrames(processedItems, imageFileName);
        } else if (selectedPreset === 'unity') {
          metaText = buildUnitySpriteData(processedItems, atlasWidth, atlasHeight, imageFileName);
        } else {
          metaText = buildGenericJson(processedItems, atlasWidth, atlasHeight, currentPack.name, imageFileName);
        }

        if (!cancelled) {
          setAtlasPreviewUrl(dataUrl);
          setAtlasStats({ width: atlasWidth, height: atlasHeight, frameCount: processedItems.length });
          setGeneratedMetaCode(metaText);
        }
      } catch (err) {
        console.error('Error packing atlas:', err);
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    }

    generateAtlas();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    currentPack,
    packStrategy,
    trimEmptySpace,
    powerOfTwo,
    selectedPreset,
    actionScope,
    removeBg,
    bgTolerance,
    bgSmoothness,
  ]);

  if (!isOpen) return null;

  // Execute full ZIP download containing both optimized PNG and corresponding data file
  const handleDownloadFullBundle = async () => {
    if (!atlasPreviewUrl || !generatedMetaCode) return;
    setIsProcessing(true);

    try {
      const zip = new JSZip();
      const baseName = `${currentPack.id}_packed`;
      const pngFileName = `${baseName}_spritesheet.png`;

      // 1. Add PNG Texture
      const base64Png = atlasPreviewUrl.split(',')[1];
      zip.file(pngFileName, base64Png, { base64: true });

      // 2. Add Metadata File according to preset
      let metaFileName = `${baseName}_metadata.json`;
      if (selectedPreset === 'godot') {
        metaFileName = `${currentPack.id}_spriteframes.tres`;
      } else if (selectedPreset === 'unity') {
        metaFileName = `${currentPack.id}_unity_sprites.json`;
      }

      zip.file(metaFileName, generatedMetaCode);

      // 3. Add Quick Engine Import Guide
      const readmeText = `# ${currentPack.name} - 2D Engine Sprite Sheet Export\n\n` +
        `Generated by Elysian Sprite Studio\n\n` +
        `## Files Included:\n` +
        `- **${pngFileName}**: Optimized transparent PNG sprite sheet (${atlasStats?.width}x${atlasStats?.height} px)\n` +
        `- **${metaFileName}**: Format preset: ${selectedPreset.toUpperCase()}\n\n` +
        `## Engine Setup:\n` +
        (selectedPreset === 'godot'
          ? `### Godot 4:\n1. Drag both files into your Godot project 'res://' directory.\n2. In Godot, assign the .tres file to an 'AnimatedSprite2D' node.\n`
          : selectedPreset === 'unity'
          ? `### Unity 2D:\n1. Place '${pngFileName}' in your Assets folder.\n2. Set Texture Type to 'Sprite (2D and UI)' -> Sprite Mode 'Multiple'.\n3. Use the Unity Sprite Importer or json data to slice automatically.\n`
          : `### Generic JSON / Web:\n1. Use UV coordinates and frame rectangles for PixiJS, Phaser 3, or custom WebGL/Canvas shaders.\n`);

      zip.file('README.md', readmeText);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentPack.id}_${selectedPreset}_game_export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export ZIP package:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Direct PNG Download
  const handleDownloadPngOnly = () => {
    if (!atlasPreviewUrl) return;
    const a = document.createElement('a');
    a.href = atlasPreviewUrl;
    a.download = `${currentPack.id}_packed_spritesheet.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Copy Metadata to clipboard
  const handleCopyMetadata = () => {
    if (!generatedMetaCode) return;
    navigator.clipboard.writeText(generatedMetaCode);
    setCopiedType('meta');
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="border border-slate-800 rounded-2xl bg-slate-950 max-w-4xl w-full p-6 space-y-6 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Box className="w-5 h-5 text-amber-400" />
              <span>Advanced Game Engine Export</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Bin-packed transparent PNG sprite sheets with UV coordinates and engine-specific metadata.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configurations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Packing Options & Framework Presets (Col 5) */}
          <div className="md:col-span-5 space-y-5">
            {/* Texture Packer Configuration */}
            <div className="border border-slate-800/80 rounded-xl p-4 bg-slate-900/60 space-y-3.5">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>1. Texture Packer Optimization</span>
              </span>

              {/* Trim Empty Space Toggle */}
              <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors select-none">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Trim Empty Whitespace</div>
                  <div className="text-[10px] text-slate-500">Tight bounding boxes remove wasted transparent space</div>
                </div>
                <input
                  type="checkbox"
                  checked={trimEmptySpace}
                  onChange={(e) => setTrimEmptySpace(e.target.checked)}
                  className="accent-amber-400 rounded w-4 h-4 cursor-pointer"
                />
              </label>

              {/* Power of Two (POT) Dimensions */}
              <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors select-none">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Power of 2 Dimensions</div>
                  <div className="text-[10px] text-slate-500">512, 1024, 2048 (Optimizes GPU mipmaps & VRAM)</div>
                </div>
                <input
                  type="checkbox"
                  checked={powerOfTwo}
                  onChange={(e) => setPowerOfTwo(e.target.checked)}
                  className="accent-amber-400 rounded w-4 h-4 cursor-pointer"
                />
              </label>

              {/* Animation Scope */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300">Animation Scope</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setActionScope('all')}
                    className={`py-1.5 px-2 rounded-lg border transition-all ${
                      actionScope === 'all'
                        ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    All 6 Actions (48f)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionScope('primary')}
                    className={`py-1.5 px-2 rounded-lg border transition-all ${
                      actionScope === 'primary'
                        ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    Primary 3 (24f)
                  </button>
                </div>
              </div>
            </div>

            {/* Framework-Specific Presets (Radio Buttons) */}
            <div className="border border-slate-800/80 rounded-xl p-4 bg-slate-900/60 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>2. Framework-Specific Presets</span>
                </span>
              </div>

              <div className="space-y-2">
                {/* Preset 1: Generic JSON */}
                <label
                  onClick={() => setSelectedPreset('generic')}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedPreset === 'generic'
                      ? 'border-amber-400 bg-amber-400/10 text-white shadow-sm ring-1 ring-amber-400/30'
                      : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportPreset"
                    value="generic"
                    checked={selectedPreset === 'generic'}
                    onChange={() => setSelectedPreset('generic')}
                    className="mt-0.5 accent-amber-400"
                  />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>Generic JSON</span>
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded">
                        .JSON
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Normalized UV coordinates, frame rects, and original trim offsets for PixiJS, Phaser 3, or custom 2D engines.
                    </p>
                  </div>
                </label>

                {/* Preset 2: Godot Engine */}
                <label
                  onClick={() => setSelectedPreset('godot')}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedPreset === 'godot'
                      ? 'border-amber-400 bg-amber-400/10 text-white shadow-sm ring-1 ring-amber-400/30'
                      : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportPreset"
                    value="godot"
                    checked={selectedPreset === 'godot'}
                    onChange={() => setSelectedPreset('godot')}
                    className="mt-0.5 accent-amber-400"
                  />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>Godot Engine .tres / SpriteFrames</span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-400/10 px-1.5 py-0.2 rounded">
                        .TRES
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Ready for Godot 4 AnimatedSprite2D with named animations, frame durations, loops, and AtlasTexture sub-resources.
                    </p>
                  </div>
                </label>

                {/* Preset 3: Unity Sprite Data */}
                <label
                  onClick={() => setSelectedPreset('unity')}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedPreset === 'unity'
                      ? 'border-amber-400 bg-amber-400/10 text-white shadow-sm ring-1 ring-amber-400/30'
                      : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportPreset"
                    value="unity"
                    checked={selectedPreset === 'unity'}
                    onChange={() => setSelectedPreset('unity')}
                    className="mt-0.5 accent-amber-400"
                  />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>Unity Sprite Data</span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.2 rounded">
                        .JSON / .META
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Unity 2D Multi-Sprite slice coordinates, bottom-center pivot definitions, and TextureImporter rects.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Live Atlas & Metadata Preview (Col 7) */}
          <div className="md:col-span-7 flex flex-col space-y-4">
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 flex-1 flex flex-col">
              {/* Tabs for Live Atlas Preview vs Generated Code */}
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                      activeTab === 'preview' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Packed Texture Atlas
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('code')}
                    className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                      activeTab === 'code' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Engine Metadata Preview
                  </button>
                </div>

                {atlasStats && (
                  <span className="font-mono text-amber-400 text-[11px]">
                    {atlasStats.width}×{atlasStats.height} px ({atlasStats.frameCount} frames)
                  </span>
                )}
              </div>

              {/* Viewport content */}
              <div className="p-4 flex-1 flex items-center justify-center min-h-[340px] max-h-[420px] overflow-auto bg-[#0c0e14] relative">
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-3 text-amber-400">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-semibold">Tightly bin-packing frames into atlas...</span>
                  </div>
                ) : activeTab === 'preview' ? (
                  atlasPreviewUrl ? (
                    <div className="canvas-checkerboard p-2 rounded-lg border border-slate-800 max-h-full flex items-center justify-center">
                      <img
                        src={atlasPreviewUrl}
                        alt="Packed Atlas"
                        className="max-h-[320px] max-w-full object-contain pixelated shadow-xl"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Generating preview...</span>
                  )
                ) : (
                  <div className="w-full h-full p-2 bg-slate-950 font-mono text-[11px] text-amber-300/90 leading-relaxed overflow-auto max-h-[320px] rounded-lg border border-slate-800">
                    <pre>{generatedMetaCode}</pre>
                  </div>
                )}
              </div>

              {/* Viewport Info Strip */}
              <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>
                  {trimEmptySpace
                    ? 'Tight Packing: 0% redundant whitespace inside sprite frames'
                    : 'Fixed Sizing: Uncropped frame bounds'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyMetadata}
                  className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  {copiedType === 'meta' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'meta' ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            </div>

            {/* Primary Action Button: Complete ZIP Bundle Export */}
            <div className="space-y-2">
              <button
                onClick={handleDownloadFullBundle}
                disabled={isProcessing || !atlasPreviewUrl}
                className="w-full py-3.5 px-4 bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2.5 shadow-xl shadow-amber-400/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Packing Texture & Building ZIP...</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 fill-current" />
                    <span>Download Complete Game Engine Bundle (.ZIP)</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Includes packed transparent PNG + {selectedPreset.toUpperCase()} metadata file</span>
                <button
                  type="button"
                  onClick={handleDownloadPngOnly}
                  className="text-slate-300 hover:text-amber-400 underline cursor-pointer text-[11px]"
                >
                  Download PNG sheet only
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
