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

export interface AssetMetadata {
  id: string;
  name: string;
  prompt: string;
  provider: string;
  model: string;
  generationSettings: any;
  creationTimestamp: string;
  imageDimensions: { width: number; height: number };
  assetLocation: string;
  originalId?: string;
}

export type BoxType = 'hurtbox' | 'hitbox' | 'collision';

export interface HitboxRect {
  id: string;
  name: string;
  type: BoxType;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface FramePhysicsData {
  frameId: string;
  frameIndex: number;
  frameLabel: string;
  frameWidth: number;
  frameHeight: number;
  pivot: {
    x: number;
    y: number;
    normalizedX: number;
    normalizedY: number;
  };
  boxes: HitboxRect[];
}

