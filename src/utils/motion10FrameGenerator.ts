import { MotionTemplate } from '../types/sprites';
import attackSheetUrl from '../assets/images/elf_white_wings_attack_1792304222679.jpg';
import { loadImage, processFrameCanvas } from './imageProcessor';

let cached10FrameAttackUrl: string | null = null;

/**
 * Dynamically synthesizes a high-fidelity 5 columns x 2 rows (10 frames)
 * Melee Cleave & Slash reference sprite sheet from the core attack assets.
 */
export async function get10FrameAttackSheetUrl(): Promise<string> {
  if (cached10FrameAttackUrl) {
    return cached10FrameAttackUrl;
  }

  try {
    const sourceImg = await loadImage(attackSheetUrl);
    const cellWidth = 300;
    const cellHeight = 448;
    const cols = 5;
    const rows = 2;
    const totalFrames = 10;

    const masterCanvas = document.createElement('canvas');
    masterCanvas.width = cols * cellWidth;
    masterCanvas.height = rows * cellHeight;
    const masterCtx = masterCanvas.getContext('2d');
    if (!masterCtx) return attackSheetUrl;

    // Fill with transparent or subtle dark backing matching sprite style
    masterCtx.fillStyle = '#0f1115';
    masterCtx.fillRect(0, 0, masterCanvas.width, masterCanvas.height);

    // Map the 10 distinct attack phases across the 8 source attack frames
    // 0: Anticipation, 1: Prep, 2: Windup, 3: Charge, 4: Strike 1, 5: Apex Cleave, 6: Follow-through, 7: Flourish, 8: Spin, 9: Recovery
    const frameMapping = [
      { srcIdx: 0, dx: 0, dy: 0, scaleX: 1.0, scaleY: 1.0, rot: 0, flare: 0 },
      { srcIdx: 1, dx: -6, dy: 8, scaleX: 1.04, scaleY: 0.96, rot: -0.04, flare: 0 },
      { srcIdx: 1, dx: -12, dy: 14, scaleX: 1.06, scaleY: 0.94, rot: -0.07, flare: 0.1 },
      { srcIdx: 2, dx: 10, dy: -4, scaleX: 0.98, scaleY: 1.03, rot: 0.05, flare: 0.2 },
      { srcIdx: 2, dx: 24, dy: -8, scaleX: 0.96, scaleY: 1.06, rot: 0.09, flare: 0.4 },
      { srcIdx: 3, dx: 18, dy: -6, scaleX: 1.02, scaleY: 1.04, rot: 0.06, flare: 0.5 },
      { srcIdx: 4, dx: 12, dy: 0, scaleX: 1.0, scaleY: 1.0, rot: 0.02, flare: 0.2 },
      { srcIdx: 5, dx: 6, dy: 4, scaleX: 1.02, scaleY: 0.98, rot: -0.02, flare: 0.1 },
      { srcIdx: 6, dx: 2, dy: 8, scaleX: 1.04, scaleY: 0.96, rot: -0.04, flare: 0 },
      { srcIdx: 7, dx: 0, dy: 0, scaleX: 1.0, scaleY: 1.0, rot: 0, flare: 0 },
    ];

    for (let i = 0; i < totalFrames; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const destX = col * cellWidth;
      const destY = row * cellHeight;

      const mapping = frameMapping[i];
      const srcCol = mapping.srcIdx % 4;
      const srcRow = Math.floor(mapping.srcIdx / 4);
      const srcX = srcCol * cellWidth;
      const srcY = srcRow * cellHeight;

      // Render cell
      masterCtx.save();
      masterCtx.beginPath();
      masterCtx.rect(destX, destY, cellWidth, cellHeight);
      masterCtx.clip();

      const cx = destX + cellWidth / 2 + mapping.dx;
      const cy = destY + cellHeight / 2 + mapping.dy;

      masterCtx.translate(cx, cy);
      masterCtx.rotate(mapping.rot);
      masterCtx.scale(mapping.scaleX, mapping.scaleY);

      // Draw source frame centered
      masterCtx.drawImage(
        sourceImg,
        srcX,
        srcY,
        cellWidth,
        cellHeight,
        -cellWidth / 2,
        -cellHeight / 2,
        cellWidth,
        cellHeight
      );

      // Add kinematic attack slash energy flare on active impact frames
      if (mapping.flare > 0) {
        masterCtx.save();
        masterCtx.globalAlpha = mapping.flare * 0.4;
        masterCtx.strokeStyle = '#f59e0b';
        masterCtx.lineWidth = 6;
        masterCtx.beginPath();
        masterCtx.arc(20, -10, cellWidth * 0.38, -0.6, 1.2);
        masterCtx.stroke();
        masterCtx.restore();
      }

      masterCtx.restore();
    }

    cached10FrameAttackUrl = masterCanvas.toDataURL('image/png');
    return cached10FrameAttackUrl;
  } catch (err) {
    console.warn('Could not generate 10-frame attack sheet dynamically, falling back to attackSheetUrl:', err);
    return attackSheetUrl;
  }
}

export const TEMPLATE_ATTACK_10_FRAME: MotionTemplate = {
  id: 'template_attack_10f',
  name: 'Heavy Blade Cleave & Slash (10-Frame)',
  category: 'default',
  description: '10-frame high-kinetic melee attack: windup, deep crouch charge, chain release, high-speed slashing arc, winged apex cleave, kinetic follow-through, and combat recovery.',
  sheetUrl: attackSheetUrl, // Will be replaced at runtime by get10FrameAttackSheetUrl()
  cols: 5,
  rows: 2,
  totalFrames: 10,
  frameWidth: 300,
  frameHeight: 448,
  fps: 12,
  loop: false,
  tags: ['Combat', 'Attack', '10-Frame', 'Melee', 'Arc', 'Cinematic'],
  phaseLabels: [
    'P1: Weapon Grip Anticipation',
    'P2: Crouch Charge & Stance Prep',
    'P3: Chain Whip Windup & Lean',
    'P4: Explosive Forward Lunge',
    'P5: High-Speed Slashing Arc (Impact 1)',
    'P6: Wing Flared Apex Cleave (Impact 2)',
    'P7: Extended Blade Follow-Through',
    'P8: Kinetic Deceleration & Spin',
    'P9: Foot Plant & Impact Buffer',
    'P10: Combat Stance Recovery',
  ],
  sourceAction: 'attack',
};
