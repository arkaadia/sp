export type SpriteAction = 'idle' | 'run' | 'jump' | 'attack' | 'climb' | 'defense';

export interface FrameDefinition {
  id: string;
  index: number;
  label: string;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  phaseLabel: string;
  durationMs: number;
  cachedCanvasUrl?: string;
  cachedTransparentUrl?: string;
}

export interface AnimationAction {
  action: SpriteAction;
  title: string;
  fps: number;
  loop: boolean;
  sheetUrl: string;
  cols: number;
  rows: number;
  totalFrames: number;
  frameWidth: number;
  frameHeight: number;
  frames: FrameDefinition[];
  description: string;
}

export interface CharacterPack {
  id: string;
  name: string;
  shortDesc: string;
  avatarUrl: string;
  actions: Record<SpriteAction, AnimationAction>;
}

export interface ExportSettings {
  layout: 'grid' | 'horizontal_strip' | 'separate_strips' | 'individual_zip';
  removeBackground: boolean;
  bgTolerance: number;
  bgSmoothness: number;
  targetCellSize: number; // e.g. 256x256 or 300x448
  backgroundColor: 'transparent' | 'dark' | 'black' | 'white';
  format: 'png' | 'metadata_only';
  enginePreset: 'unity' | 'godot' | 'phaser' | 'css';
}

export interface HitboxConfig {
  enabled: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}
