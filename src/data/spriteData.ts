import { CharacterPack, FrameDefinition, SpriteAction } from '../types/sprites';

// Primary Pack images
import idleSheetUrl from '../assets/images/elf_idle_spritesheet_1792302152477.jpg';
import runSheetUrl from '../assets/images/elf_white_wings_run_1792302187930.jpg';
import jumpSheetUrl from '../assets/images/elf_white_wings_jump_1792302189913.jpg';
import attackSheetUrl from '../assets/images/elf_white_wings_attack_1792304222679.jpg';
import climbSheetUrl from '../assets/images/elf_white_wings_climb_1792304222903.jpg';
import defenseSheetUrl from '../assets/images/elf_white_wings_defense_1792304222179.jpg';

// Variant Pack images
import shadowRunSheetUrl from '../assets/images/elf_run_spritesheet_1792302153432.jpg';
import shadowJumpSheetUrl from '../assets/images/elf_jump_spritesheet_1792302152918.jpg';

const createGridFrames = (
  prefix: string,
  totalCols: number = 4,
  totalRows: number = 2,
  cropHeightOffset: number = 0,
  rowLabels: string[] = []
): FrameDefinition[] => {
  const cellWidth = 300;
  const rawCellHeight = 448;
  const activeCellHeight = rawCellHeight - cropHeightOffset;

  const frames: FrameDefinition[] = [];
  let index = 0;

  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < totalCols; c++) {
      const sx = c * cellWidth;
      const sy = r * rawCellHeight;
      frames.push({
        id: `${prefix}_frame_${index + 1}`,
        index,
        label: `Frame ${index + 1}`,
        phaseLabel: rowLabels[index] || `Phase ${index + 1}`,
        sx,
        sy,
        sw: cellWidth,
        sh: activeCellHeight,
        durationMs: 100,
      });
      index++;
    }
  }

  return frames;
};

const idlePhaseLabels = [
  'Hover Rest & Inhale',
  'Gentle Wing Lift',
  'Wing Apex Expansion',
  'Downward Feather Push',
  'Floating Crest & Drift',
  'Wing Inward Sweep',
  'Descent Settling',
  'Neutral Hover Loop',
];

const runPhaseLabels = [
  'Right Foot Strike & Dagger Lead',
  'Push-Off & Wings Stream Back',
  'Mid-Air Stride Extension',
  'Forward Momentum Glide',
  'Left Foot Contact & Counter-Balance',
  'Secondary Push-Off & Wing Flap',
  'High-Speed Follow Through',
  'Stride Cycle Recovery',
];

const jumpPhaseLabels = [
  'Preparation & Ground Crouch',
  'Explosive Takeoff & Wing Thrust',
  'Ascending Trajectory & Blade Ready',
  'Mid-Air Apex & Wings Fully Flared',
  'Apex Hover & Feather Flutter',
  'Diving Descent Transition',
  'Impact Buffer & Wing Flare',
  'Soft Ground Landing Recovery',
];

const attackPhaseLabels = [
  'Weapon Grip Anticipation',
  'Chain Release & Slash Windup',
  'Swift Arc Strike (Active 1)',
  'Flared Wing Cleave (Active 2)',
  'Chain Whip Follow-Through',
  'Extended Blade Flourish',
  'Chain Retraction & Spin',
  'Combat Stance Recovery',
];

const climbPhaseLabels = [
  'Right Hand Reach Upward',
  'Left Leg Push & Wing Assist',
  'Vertical Body Elevation',
  'Wings Flap Apex Lift',
  'Left Hand Reach Upward',
  'Right Leg Push & Wing Assist',
  'Upper Wall Grip Transition',
  'Continuous Climb Cycle Loop',
];

const defensePhaseLabels = [
  'Bracing Guard Stance',
  'Dagger Parry Raise',
  'Wings Folding Forward',
  'Feather Shield Cocoon (Impact Absorption)',
  'Full Guard Fortress Loop',
  'Controlled Wing Extension',
  'Defensive Parry Buffer',
  'Return to Combat Stance',
];

export const PRIMARY_CHARACTER_PACK: CharacterPack = {
  id: 'elysian_rogue',
  name: 'Elysian Rogue (White Wings)',
  shortDesc: 'Celestial dark-assassin elf with feathered white wings, curved hooked dagger, and 6 core animations.',
  avatarUrl: idleSheetUrl,
  actions: {
    idle: {
      action: 'idle',
      title: 'Idle Hover (8 Frames)',
      fps: 8,
      loop: true,
      sheetUrl: idleSheetUrl,
      cols: 4,
      rows: 2,
      totalFrames: 8,
      frameWidth: 300,
      frameHeight: 400,
      frames: createGridFrames('idle', 4, 2, 48, idlePhaseLabels),
      description: 'Serene aerial hovering loop with subtle wing flutters and breathing cloth movement.',
    },
    run: {
      action: 'run',
      title: 'Sprint Cycle (8 Frames)',
      fps: 10,
      loop: true,
      sheetUrl: runSheetUrl,
      cols: 4,
      rows: 2,
      totalFrames: 8,
      frameWidth: 300,
      frameHeight: 448,
      frames: createGridFrames('run', 4, 2, 0, runPhaseLabels),
      description: 'Dynamic forward running stride with swept-back wings, hair billow, and dagger grip.',
    },
    jump: {
      action: 'jump',
      title: 'Wing Leap & Land (8 Frames)',
      fps: 9,
      loop: false,
      sheetUrl: jumpSheetUrl,
      cols: 4,
      rows: 2,
      totalFrames: 8,
      frameWidth: 300,
      frameHeight: 400,
      frames: createGridFrames('jump', 4, 2, 48, jumpPhaseLabels),
      description: 'Full vertical arc starting from crouch, powerful wing thrust ascent, apex glide, and cushioned touchdown.',
    },
    attack: {
      action: 'attack',
      title: 'Blade & Chain Slash (8 Frames)',
      fps: 12,
      loop: false,
      sheetUrl: attackSheetUrl,
      cols: 4,
      rows: 2,
      totalFrames: 8,
      frameWidth: 300,
      frameHeight: 448,
      frames: createGridFrames('attack', 4, 2, 0, attackPhaseLabels),
      description: 'Fast-paced curved dagger cleave with swinging chain and wing flare.',
    },
    climb: {
      action: 'climb',
      title: 'Vertical Climb (8 Frames)',
      fps: 9,
      loop: true,
      sheetUrl: climbSheetUrl,
      cols: 4,
      rows: 2,
      totalFrames: 8,
      frameWidth: 300,
      frameHeight: 448,
      frames: createGridFrames('climb', 4, 2, 0, climbPhaseLabels),
      description: 'Smooth vertical ascension with alternating hand grasps and rhythmic wing flutter.',
    },
    defense: {
      action: 'defense',
      title: 'Wing Shield & Parry (8 Frames)',
      fps: 8,
      loop: true,
      sheetUrl: defenseSheetUrl,
      cols: 4,
      rows: 2,
      totalFrames: 8,
      frameWidth: 300,
      frameHeight: 448,
      frames: createGridFrames('defense', 4, 2, 0, defensePhaseLabels),
      description: 'Braced parry stance with large feathered wings folding forward to shield the body.',
    },
  },
};

export const SHADOW_CHARACTER_PACK: CharacterPack = {
  id: 'shadow_infiltrator',
  name: 'Shadow Infiltrator (Masked Variant)',
  shortDesc: 'Stealth combat variation equipped with assassin mask, dual daggers, and midnight plumage.',
  avatarUrl: shadowRunSheetUrl,
  actions: {
    idle: {
      ...PRIMARY_CHARACTER_PACK.actions.idle,
    },
    run: {
      action: 'run',
      title: 'Shadow Sprint (8 Frames)',
      fps: 11,
      loop: true,
      sheetUrl: shadowRunSheetUrl,
      cols: 4,
      rows: 2,
      totalFrames: 8,
      frameWidth: 300,
      frameHeight: 448,
      frames: createGridFrames('shadow_run', 4, 2, 0, runPhaseLabels),
      description: 'Masked dual-blade dash with aerodynamic wing tuck and red optics.',
    },
    jump: {
      action: 'jump',
      title: 'Midnight Raven Leap (8 Frames)',
      fps: 9,
      loop: false,
      sheetUrl: shadowJumpSheetUrl,
      cols: 4,
      rows: 2,
      totalFrames: 8,
      frameWidth: 300,
      frameHeight: 400,
      frames: createGridFrames('shadow_jump', 4, 2, 48, jumpPhaseLabels),
      description: 'Midnight winged leap sequence with dual drawn daggers and stone impact effect.',
    },
    attack: {
      ...PRIMARY_CHARACTER_PACK.actions.attack,
    },
    climb: {
      ...PRIMARY_CHARACTER_PACK.actions.climb,
    },
    defense: {
      ...PRIMARY_CHARACTER_PACK.actions.defense,
    },
  },
};

export const CHARACTER_PACKS: CharacterPack[] = [
  PRIMARY_CHARACTER_PACK,
  SHADOW_CHARACTER_PACK,
];
