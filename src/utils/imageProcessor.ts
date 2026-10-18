import JSZip from 'jszip';
import { CharacterPack, ExportSettings, FrameDefinition, SpriteAction } from '../types/sprites';

const imageCache = new Map<string, HTMLImageElement>();

export const ALL_SPRITE_ACTIONS: SpriteAction[] = [
  'idle',
  'run',
  'jump',
  'attack',
  'climb',
  'defense',
];

export async function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return imageCache.get(src)!;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (err) => reject(new Error(`Failed to load image at ${src}: ${err}`));
    img.src = src;
  });
}

/**
 * Extracts and optionally applies chroma-key background removal to a single frame.
 */
export function processFrameCanvas(
  sourceImg: HTMLImageElement,
  frame: FrameDefinition,
  removeBg: boolean = true,
  tolerance: number = 36,
  smoothness: number = 18,
  targetW?: number,
  targetH?: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const outW = targetW || frame.sw;
  const outH = targetH || frame.sh;
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  // Draw source crop onto canvas
  ctx.drawImage(
    sourceImg,
    frame.sx,
    frame.sy,
    frame.sw,
    frame.sh,
    0,
    0,
    outW,
    outH
  );

  if (!removeBg) {
    return canvas;
  }

  // Background removal via Euclidean color distance and edge feathering
  const imgData = ctx.getImageData(0, 0, outW, outH);
  const data = imgData.data;

  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];

  const featherRange = Math.max(1, smoothness);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) continue;

    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist <= tolerance) {
      data[i + 3] = 0; // 100% transparent
    } else if (dist < tolerance + featherRange) {
      const factor = (dist - tolerance) / featherRange;
      data[i + 3] = Math.round(factor * 255);

      // Despill
      data[i] = Math.min(255, Math.round(r + (1 - factor) * 15));
      data[i + 1] = Math.min(255, Math.round(g + (1 - factor) * 15));
      data[i + 2] = Math.min(255, Math.round(b + (1 - factor) * 15));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Builds a composite tileset canvas containing all available frames (Idle, Run, Jump, Attack, Climb, Defense).
 */
export async function buildTilesetCanvas(
  pack: CharacterPack,
  settings: ExportSettings
): Promise<{ canvas: HTMLCanvasElement; dataUrl: string; width: number; height: number }> {
  const actions = ALL_SPRITE_ACTIONS.filter((act) => pack.actions[act]);
  const framesPerAction = 8;

  // Load source images for available actions
  const loadedImages: Partial<Record<SpriteAction, HTMLImageElement>> = {};
  for (const act of actions) {
    loadedImages[act] = await loadImage(pack.actions[act].sheetUrl);
  }

  const cellW = settings.targetCellSize || 256;
  const cellH = settings.targetCellSize || 256;

  let totalCols = 8;
  let totalRows = actions.length;

  if (settings.layout === 'horizontal_strip') {
    totalCols = actions.length * framesPerAction;
    totalRows = 1;
  }

  const canvas = document.createElement('canvas');
  canvas.width = totalCols * cellW;
  canvas.height = totalRows * cellH;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2d context');

  // Background fill
  if (settings.backgroundColor === 'dark') {
    ctx.fillStyle = '#1c1f26';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (settings.backgroundColor === 'black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (settings.backgroundColor === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Draw frames
  actions.forEach((actionKey, actionIdx) => {
    const actionDef = pack.actions[actionKey];
    const sourceImg = loadedImages[actionKey];
    if (!actionDef || !sourceImg) return;

    actionDef.frames.slice(0, framesPerAction).forEach((frame, frameIdx) => {
      const frameCanvas = processFrameCanvas(
        sourceImg,
        frame,
        settings.removeBackground,
        settings.bgTolerance,
        settings.bgSmoothness,
        cellW,
        cellH
      );

      let destX = 0;
      let destY = 0;

      if (settings.layout === 'horizontal_strip') {
        const globalIdx = actionIdx * framesPerAction + frameIdx;
        destX = globalIdx * cellW;
        destY = 0;
      } else {
        destX = frameIdx * cellW;
        destY = actionIdx * cellH;
      }

      ctx.drawImage(frameCanvas, destX, destY);
    });
  });

  const dataUrl = canvas.toDataURL('image/png');
  return { canvas, dataUrl, width: canvas.width, height: canvas.height };
}

/**
 * Builds separate 8x1 horizontal strips for each action.
 */
export async function buildSeparateStrips(
  pack: CharacterPack,
  settings: ExportSettings
): Promise<Partial<Record<SpriteAction, { canvas: HTMLCanvasElement; dataUrl: string }>>> {
  const actions = ALL_SPRITE_ACTIONS.filter((act) => pack.actions[act]);
  const cellW = settings.targetCellSize || 256;
  const cellH = settings.targetCellSize || 256;

  const results: Partial<Record<SpriteAction, { canvas: HTMLCanvasElement; dataUrl: string }>> = {};

  for (const actionKey of actions) {
    const actionDef = pack.actions[actionKey];
    if (!actionDef) continue;
    const sourceImg = await loadImage(actionDef.sheetUrl);

    const stripCanvas = document.createElement('canvas');
    stripCanvas.width = 8 * cellW;
    stripCanvas.height = cellH;

    const ctx = stripCanvas.getContext('2d');
    if (!ctx) continue;

    if (settings.backgroundColor === 'dark') {
      ctx.fillStyle = '#1c1f26';
      ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
    } else if (settings.backgroundColor === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
    } else if (settings.backgroundColor === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
    } else {
      ctx.clearRect(0, 0, stripCanvas.width, stripCanvas.height);
    }

    actionDef.frames.slice(0, 8).forEach((frame, idx) => {
      const frameCanvas = processFrameCanvas(
        sourceImg,
        frame,
        settings.removeBackground,
        settings.bgTolerance,
        settings.bgSmoothness,
        cellW,
        cellH
      );
      ctx.drawImage(frameCanvas, idx * cellW, 0);
    });

    results[actionKey] = {
      canvas: stripCanvas,
      dataUrl: stripCanvas.toDataURL('image/png'),
    };
  }

  return results;
}

/**
 * Packages all frames across all 6 actions into a clean ZIP.
 */
export async function generateZipPackage(
  pack: CharacterPack,
  settings: ExportSettings
): Promise<Blob> {
  const zip = new JSZip();
  const actions = ALL_SPRITE_ACTIONS.filter((act) => pack.actions[act]);
  const cellW = settings.targetCellSize || 256;
  const cellH = settings.targetCellSize || 256;

  // 1. Add individual frames folders
  for (const actionKey of actions) {
    const folder = zip.folder(actionKey);
    const actionDef = pack.actions[actionKey];
    if (!actionDef) continue;
    const sourceImg = await loadImage(actionDef.sheetUrl);

    for (let i = 0; i < 8; i++) {
      const frame = actionDef.frames[i];
      if (!frame) continue;
      const frameCanvas = processFrameCanvas(
        sourceImg,
        frame,
        settings.removeBackground,
        settings.bgTolerance,
        settings.bgSmoothness,
        cellW,
        cellH
      );

      const frameBase64 = frameCanvas.toDataURL('image/png').split(',')[1];
      const padNum = String(i + 1).padStart(2, '0');
      folder?.file(`${actionKey}_frame_${padNum}.png`, frameBase64, { base64: true });
    }
  }

  // 2. Add combined master tileset
  const { canvas: tilesetCanvas } = await buildTilesetCanvas(pack, settings);
  const tilesetBase64 = tilesetCanvas.toDataURL('image/png').split(',')[1];
  zip.file(`${pack.id}_master_tileset_clean.png`, tilesetBase64, { base64: true });

  // 3. Add engine metadata files
  zip.file('phaser3_atlas.json', generateEngineMetadata(pack, 'phaser', settings));
  zip.file('unity_spritesheet.json', generateEngineMetadata(pack, 'unity', settings));
  zip.file('godot_spriteframes.json', generateEngineMetadata(pack, 'godot', settings));
  zip.file('spritesheet_animation.css', generateEngineMetadata(pack, 'css', settings));

  // 4. README
  const readme = `# ${pack.name} - 2D Sprite Sheet & Tileset Package
Created with Elysian Sprite Studio

## Included Animations (8 Frames Each, 48 Frames Total):
1. **Idle**: 8-frame hovering floating loop (8 FPS)
2. **Run**: 8-frame forward sprinting cycle (10 FPS)
3. **Jump**: 8-frame crouch, wing thrust leap, apex glide, landing (9 FPS)
4. **Attack**: 8-frame curved dagger cleave with chain whip extension (12 FPS)
5. **Climb**: 8-frame vertical ascension cycle with wing assist (9 FPS)
6. **Defense**: 8-frame protective wing shield & dagger parry guard (8 FPS)

## Specifications:
- Frame Size: ${cellW}x${cellH} px
- Total Dimensions: ${tilesetCanvas.width}x${tilesetCanvas.height} px (${actions.length} rows × 8 columns)
- Background: ${settings.removeBackground ? 'Transparent PNG (Clean Alpha)' : settings.backgroundColor}
`;
  zip.file('README.md', readme);

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Generates game engine specific metadata or CSS code for all 6 actions.
 */
export function generateEngineMetadata(
  pack: CharacterPack,
  engine: 'unity' | 'godot' | 'phaser' | 'css',
  settings: ExportSettings
): string {
  const actions = ALL_SPRITE_ACTIONS.filter((act) => pack.actions[act]);
  const cellW = settings.targetCellSize || 256;
  const cellH = settings.targetCellSize || 256;
  const totalW = 8 * cellW;
  const totalH = actions.length * cellH;

  if (engine === 'phaser') {
    const framesData: Record<string, any> = {};
    const animsMeta: Record<string, any> = {};

    actions.forEach((act, rowIdx) => {
      for (let i = 0; i < 8; i++) {
        const frameName = `${act}_${String(i + 1).padStart(2, '0')}`;
        framesData[frameName] = {
          frame: { x: i * cellW, y: rowIdx * cellH, w: cellW, h: cellH },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: cellW, h: cellH },
          sourceSize: { w: cellW, h: cellH },
          pivot: { x: 0.5, y: 0.9 },
        };
      }
      animsMeta[act] = {
        start: `${act}_01`,
        end: `${act}_08`,
        fps: pack.actions[act].fps,
        repeat: pack.actions[act].loop ? -1 : 0,
      };
    });

    return JSON.stringify(
      {
        frames: framesData,
        meta: {
          app: 'Elysian Sprite Studio',
          version: '2.0',
          image: `${pack.id}_master_tileset_clean.png`,
          format: 'RGBA8888',
          size: { w: totalW, h: totalH },
          scale: '1',
          animations: animsMeta,
        },
      },
      null,
      2
    );
  }

  if (engine === 'godot') {
    const godotData = {
      animations: actions.map((act, rowIdx) => ({
        name: act,
        speed: pack.actions[act].fps,
        loop: pack.actions[act].loop,
        frames: Array.from({ length: 8 }, (_, i) => ({
          region: [i * cellW, rowIdx * cellH, cellW, cellH],
          duration: 1.0,
        })),
      })),
      texture: `${pack.id}_master_tileset_clean.png`,
      frame_size: [cellW, cellH],
      sheet_size: [totalW, totalH],
    };

    return JSON.stringify(godotData, null, 2);
  }

  if (engine === 'unity') {
    const unitySprites = actions.flatMap((act, rowIdx) =>
      Array.from({ length: 8 }, (_, i) => ({
        name: `${act}_${i + 1}`,
        rect: {
          x: i * cellW,
          y: totalH - (rowIdx + 1) * cellH,
          width: cellW,
          height: cellH,
        },
        alignment: 7,
        pivot: { x: 0.5, y: 0.1 },
        border: { x: 0, y: 0, z: 0, w: 0 },
      }))
    );

    return JSON.stringify(
      {
        textureName: `${pack.id}_master_tileset_clean`,
        spriteMode: 2,
        pixelsPerUnit: 100,
        sprites: unitySprites,
      },
      null,
      2
    );
  }

  // CSS Keyframes
  return `/* 2D 6-Action Sprite Sheet Animation CSS - Elysian Studio */
:root {
  --sprite-w: ${cellW}px;
  --sprite-h: ${cellH}px;
}

.sprite-actor {
  width: var(--sprite-w);
  height: var(--sprite-h);
  background-image: url('${pack.id}_master_tileset_clean.png');
  background-repeat: no-repeat;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

${actions
  .map(
    (act, i) => `/* Row ${i + 1}: ${act.toUpperCase()} */
.sprite-actor.${act} {
  background-position-y: -${i * cellH}px;
  animation: sprite-${act} ${(8 / pack.actions[act].fps).toFixed(2)}s steps(8) ${
      pack.actions[act].loop ? 'infinite' : 'forwards'
    };
}
@keyframes sprite-${act} {
  from { background-position-x: 0px; }
  to { background-position-x: -${8 * cellW}px; }
}`
  )
  .join('\n\n')}
`;
}
