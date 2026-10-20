import {
  CharacterPack,
  FrameDefinition,
  MotionTemplate,
  RetargetingResult,
  AnimationAction,
} from '../types/sprites';
import { loadImage, processFrameCanvas } from './imageProcessor';
import { get10FrameAttackSheetUrl } from './motion10FrameGenerator';

export interface ExtractedPose {
  frameIndex: number;
  label: string;
  phaseLabel: string;
  col: number;
  row: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dataUrl: string;
  canvas: HTMLCanvasElement;
  bounds?: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
}

export interface TemplateExtractionResult {
  template: MotionTemplate;
  naturalWidth: number;
  naturalHeight: number;
  cellWidth: number;
  cellHeight: number;
  cols: number;
  rows: number;
  totalFrames: number;
  poses: ExtractedPose[];
}

export interface RetargetingOptions {
  customActionName?: string;
  removeBg?: boolean;
  bgTolerance?: number;
  bgSmoothness?: number;
  targetCellWidth?: number;
  targetCellHeight?: number;
  tintModifier?: string;
  customCharacterImage?: string;
  customCharacterName?: string;
  sourceActionKey?: string;
}

/**
 * Reads a MotionTemplate's specific row, column, and totalFrame data
 * and cleanly extracts all individual sequential poses with optional alpha transparency.
 */
export async function extractTemplatePoses(
  template: MotionTemplate,
  options?: {
    removeBg?: boolean;
    bgTolerance?: number;
    bgSmoothness?: number;
  }
): Promise<TemplateExtractionResult> {
  const removeBg = options?.removeBg ?? true;
  const bgTolerance = options?.bgTolerance ?? 36;
  const bgSmoothness = options?.bgSmoothness ?? 18;

  let resolvedSheetUrl = template.sheetUrl;
  // If this is the 10-frame attack template, ensure the true 5x2 synthesized sheet is loaded
  if (
    template.id === 'template_attack_10f' ||
    (template.totalFrames === 10 && template.cols === 5 && template.rows === 2)
  ) {
    resolvedSheetUrl = await get10FrameAttackSheetUrl();
  }

  const sourceImg = await loadImage(resolvedSheetUrl);
  const naturalWidth = sourceImg.naturalWidth || sourceImg.width;
  const naturalHeight = sourceImg.naturalHeight || sourceImg.height;

  const cols = Math.max(1, template.cols);
  const rows = Math.max(1, template.rows);
  const totalFrames = Math.max(1, Math.min(template.totalFrames, cols * rows));

  const cellWidth = Math.floor(naturalWidth / cols);
  const cellHeight = Math.floor(naturalHeight / rows);

  const poses: ExtractedPose[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const sx = col * cellWidth;
    const sy = row * cellHeight;

    const frameDef: FrameDefinition = {
      id: `${template.id}_frame_${i + 1}`,
      index: i,
      label: `Frame ${i + 1}`,
      phaseLabel: template.phaseLabels?.[i] || `${template.name} P${i + 1}`,
      sx,
      sy,
      sw: cellWidth,
      sh: cellHeight,
      durationMs: Math.round(1000 / (template.fps || 10)),
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

    // Calculate bounding box of non-transparent pixels
    let bounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } | undefined = undefined;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        const imgData = ctx.getImageData(0, 0, cellWidth, cellHeight);
        const data = imgData.data;
        let minX = cellWidth, minY = cellHeight, maxX = 0, maxY = 0;
        let hasPixels = false;

        for (let y = 0; y < cellHeight; y += 4) {
          for (let x = 0; x < cellWidth; x += 4) {
            const idx = (y * cellWidth + x) * 4;
            if (data[idx + 3] > 30) {
              hasPixels = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (hasPixels) {
          bounds = {
            minX,
            minY,
            maxX,
            maxY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
          };
        }
      } catch (e) {
        // Ignored if tainted
      }
    }

    poses.push({
      frameIndex: i,
      label: `Frame ${i + 1}`,
      phaseLabel: frameDef.phaseLabel,
      col,
      row,
      sx,
      sy,
      sw: cellWidth,
      sh: cellHeight,
      dataUrl: canvas.toDataURL('image/png'),
      canvas,
      bounds,
    });
  }

  return {
    template,
    naturalWidth,
    naturalHeight,
    cellWidth,
    cellHeight,
    cols,
    rows,
    totalFrames,
    poses,
  };
}

/**
 * Retargeting Engine Core:
 * Generates a full retargeted sprite sheet in the EXACT same uniform grid format (cols x rows)
 * and EXACT frame count as the source Motion Template.
 *
 * Strictly maps custom character visuals onto the sequential kinematic phases of the template.
 */
export async function generateRetargetedSheet(
  template: MotionTemplate,
  targetCharacter: CharacterPack,
  options?: RetargetingOptions
): Promise<RetargetingResult> {
  const removeBg = options?.removeBg ?? true;
  const bgTolerance = options?.bgTolerance ?? 36;
  const bgSmoothness = options?.bgSmoothness ?? 18;

  // 1. Extract reference motion poses strictly following template metadata
  const extracted = await extractTemplatePoses(template, {
    removeBg,
    bgTolerance,
    bgSmoothness,
  });

  const cols = extracted.cols;
  const rows = extracted.rows;
  const totalFrames = extracted.totalFrames;

  const outCellWidth = options?.targetCellWidth || extracted.cellWidth || 300;
  const outCellHeight = options?.targetCellHeight || extracted.cellHeight || 448;

  const totalWidth = cols * outCellWidth;
  const totalHeight = rows * outCellHeight;

  // Create Master Canvas with exact grid dimensions (cols * cellWidth, rows * cellHeight)
  const masterCanvas = document.createElement('canvas');
  masterCanvas.width = totalWidth;
  masterCanvas.height = totalHeight;
  const masterCtx = masterCanvas.getContext('2d')!;

  // Clear to full transparency
  masterCtx.clearRect(0, 0, totalWidth, totalHeight);

  // 2. Resolve Custom Character Visual Source
  let customUploadedImg: HTMLImageElement | null = null;
  if (options?.customCharacterImage) {
    try {
      customUploadedImg = await loadImage(options.customCharacterImage);
    } catch (err) {
      console.warn('Could not load customCharacterImage:', err);
    }
  }

  // Load target character source sheet if available
  const preferredActionKey = options?.sourceActionKey
    || (template.sourceAction && targetCharacter.actions[template.sourceAction] ? template.sourceAction : null)
    || (targetCharacter.actions['attack'] ? 'attack' : Object.keys(targetCharacter.actions)[0]);

  const targetActionDef = (preferredActionKey && targetCharacter.actions[preferredActionKey])
    || Object.values(targetCharacter.actions)[0];

  let targetSourceImg: HTMLImageElement | null = null;
  if (targetActionDef?.sheetUrl) {
    try {
      targetSourceImg = await loadImage(targetActionDef.sheetUrl);
    } catch (err) {
      console.warn('Could not load target character primary action sheet:', err);
    }
  }

  const generatedFrames: FrameDefinition[] = [];

  // Compute reference pose baseline for kinematic deformation
  const neutralPose = extracted.poses[0];
  const neutralHeight = neutralPose?.bounds?.height || outCellHeight * 0.7;
  const neutralCenterY = neutralPose?.bounds ? (neutralPose.bounds.minY + neutralPose.bounds.maxY) / 2 : outCellHeight / 2;
  const neutralFeetY = neutralPose?.bounds?.maxY || outCellHeight * 0.88;

  // 3. Sequential Pose Processing: STRICTLY for 0 to totalFrames - 1
  for (let i = 0; i < totalFrames; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const destX = col * outCellWidth;
    const destY = row * outCellHeight;

    const pose = extracted.poses[i];

    // Individual cell canvas
    const cellCanvas = document.createElement('canvas');
    cellCanvas.width = outCellWidth;
    cellCanvas.height = outCellHeight;
    const cellCtx = cellCanvas.getContext('2d')!;
    cellCtx.clearRect(0, 0, outCellWidth, outCellHeight);

    // Kinematic parameters from template pose
    const poseBounds = pose.bounds;
    const currentHeight = poseBounds?.height || neutralHeight;
    const currentFeetY = poseBounds?.maxY || neutralFeetY;
    const currentCenterX = poseBounds ? (poseBounds.minX + poseBounds.maxX) / 2 : outCellWidth / 2;

    // Kinematic squash & stretch
    const stretchY = Math.max(0.88, Math.min(1.15, currentHeight / neutralHeight));
    const squashX = 1 / Math.sqrt(stretchY);

    // Kinematic translation offsets (lunge / elevation)
    const deltaY = (currentFeetY - neutralFeetY) * 0.45;
    const deltaX = (currentCenterX - outCellWidth / 2) * 0.35;

    // Kinematic rotation lean based on frame progression
    const progress = totalFrames > 1 ? i / (totalFrames - 1) : 0;
    let rotation = 0;
    if (progress > 0.1 && progress < 0.45) {
      rotation = -0.05; // Windup anticipation lean
    } else if (progress >= 0.45 && progress < 0.75) {
      rotation = 0.08; // Explosive strike forward lunge
    } else if (progress >= 0.75 && progress < 0.9) {
      rotation = 0.03; // Follow-through
    }

    if (customUploadedImg) {
      // User uploaded a custom character illustration / sprite!
      const procCanvas = document.createElement('canvas');
      procCanvas.width = outCellWidth;
      procCanvas.height = outCellHeight;
      const procCtx = procCanvas.getContext('2d')!;

      // Center fit the uploaded character
      const uW = customUploadedImg.naturalWidth || customUploadedImg.width;
      const uH = customUploadedImg.naturalHeight || customUploadedImg.height;
      const scale = Math.min((outCellWidth * 0.8) / uW, (outCellHeight * 0.8) / uH);
      const drawW = uW * scale;
      const drawH = uH * scale;
      const drawX = (outCellWidth - drawW) / 2;
      const drawY = outCellHeight * 0.88 - drawH;

      procCtx.drawImage(customUploadedImg, drawX, drawY, drawW, drawH);

      // Render character with kinematic pose transformation
      cellCtx.save();
      const pivotX = outCellWidth / 2 + deltaX;
      const pivotY = outCellHeight * 0.88 + deltaY;

      cellCtx.translate(pivotX, pivotY);
      cellCtx.rotate(rotation);
      cellCtx.scale(squashX, stretchY);
      cellCtx.translate(-outCellWidth / 2, -outCellHeight * 0.88);

      cellCtx.drawImage(procCanvas, 0, 0);
      cellCtx.restore();

      // Kinematic action silhouette guidance overlay
      cellCtx.save();
      cellCtx.globalAlpha = 0.28;
      cellCtx.globalCompositeOperation = 'source-atop';
      cellCtx.drawImage(pose.canvas, 0, 0, outCellWidth, outCellHeight);
      cellCtx.restore();

      // Action dynamic energy trail on impact frames
      if (progress >= 0.4 && progress <= 0.7) {
        cellCtx.save();
        cellCtx.globalAlpha = 0.35;
        cellCtx.strokeStyle = '#f59e0b';
        cellCtx.lineWidth = 5;
        cellCtx.beginPath();
        cellCtx.arc(outCellWidth * 0.58 + deltaX, outCellHeight * 0.45 + deltaY, outCellWidth * 0.32, -0.6, 1.2);
        cellCtx.stroke();
        cellCtx.restore();
      }

    } else if (targetSourceImg && targetActionDef?.frames && targetActionDef.frames.length > 0) {
      // Proportional mapping across source action frames to strictly cover 0 to totalFrames - 1
      const targetRatio = totalFrames > 1 ? i / (totalFrames - 1) : 0;
      const targetFrameIdx = Math.min(
        targetActionDef.frames.length - 1,
        Math.round(targetRatio * (targetActionDef.frames.length - 1))
      );
      const targetFrameDef = targetActionDef.frames[targetFrameIdx];

      const processedTarget = processFrameCanvas(
        targetSourceImg,
        targetFrameDef,
        removeBg,
        bgTolerance,
        bgSmoothness,
        outCellWidth,
        outCellHeight
      );

      // Render character with kinematic pose transformation
      cellCtx.save();
      const pivotX = outCellWidth / 2 + deltaX;
      const pivotY = outCellHeight * 0.88 + deltaY;

      cellCtx.translate(pivotX, pivotY);
      cellCtx.rotate(rotation);
      cellCtx.scale(squashX, stretchY);
      cellCtx.translate(-outCellWidth / 2, -outCellHeight * 0.88);

      cellCtx.drawImage(processedTarget, 0, 0, outCellWidth, outCellHeight);
      cellCtx.restore();

      // Kinematic silhouette alignment with template pose
      cellCtx.save();
      cellCtx.globalAlpha = 0.26;
      cellCtx.globalCompositeOperation = 'source-atop';
      cellCtx.drawImage(pose.canvas, 0, 0, outCellWidth, outCellHeight);
      cellCtx.restore();

      // Dynamic action energy trail during active swing phases
      if (progress >= 0.35 && progress <= 0.72) {
        cellCtx.save();
        cellCtx.globalAlpha = 0.4;
        cellCtx.strokeStyle = '#f59e0b';
        cellCtx.lineWidth = 6;
        cellCtx.beginPath();
        cellCtx.arc(outCellWidth * 0.55 + deltaX, outCellHeight * 0.42 + deltaY, outCellWidth * 0.35, -0.5, 1.3);
        cellCtx.stroke();
        cellCtx.restore();
      }
    } else {
      // High-fidelity direct pose canvas
      cellCtx.drawImage(pose.canvas, 0, 0, outCellWidth, outCellHeight);
    }

    // Paint into master uniform grid sheet
    masterCtx.drawImage(cellCanvas, destX, destY);

    const frameName = `${template.name}_${String(i + 1).padStart(2, '0')}`;
    generatedFrames.push({
      id: `${template.id}_retarget_${i + 1}`,
      index: i,
      label: frameName,
      phaseLabel: pose.phaseLabel || `Pose ${i + 1}`,
      sx: destX,
      sy: destY,
      sw: outCellWidth,
      sh: outCellHeight,
      durationMs: Math.round(1000 / (template.fps || 12)),
      cachedCanvasUrl: cellCanvas.toDataURL('image/png'),
      cachedTransparentUrl: cellCanvas.toDataURL('image/png'),
    });
  }

  const sheetDataUrl = masterCanvas.toDataURL('image/png');
  const actionKey = (options?.customActionName || template.name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || `retargeted_${template.id}`;

  const characterDisplayName = options?.customCharacterName || targetCharacter.name;

  const actionDef: AnimationAction = {
    action: actionKey,
    title: options?.customActionName || `${template.name} (${totalFrames}F)`,
    fps: template.fps || 12,
    loop: template.loop ?? (template.sourceAction === 'idle' || template.sourceAction === 'run'),
    sheetUrl: sheetDataUrl,
    cols,
    rows,
    totalFrames,
    frameWidth: outCellWidth,
    frameHeight: outCellHeight,
    frames: generatedFrames,
    description: `Retargeted ${template.name} motion applied to ${characterDisplayName}. Exactly ${totalFrames} frames arranged in a ${cols}x${rows} uniform grid.`,
  };

  return {
    templateId: template.id,
    templateName: template.name,
    targetCharacterId: targetCharacter.id,
    targetCharacterName: characterDisplayName,
    sheetDataUrl,
    cols,
    rows,
    totalFrames,
    cellWidth: outCellWidth,
    cellHeight: outCellHeight,
    totalWidth,
    totalHeight,
    frames: generatedFrames,
    actionDef,
    createdAt: new Date().toISOString(),
  };
}
