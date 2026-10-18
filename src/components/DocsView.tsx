import React from 'react';
import { BookOpen, Code, Terminal, Layers } from 'lucide-react';
import { CharacterPack } from '../types/sprites';

interface DocsViewProps {
  currentPack: CharacterPack;
}

export const DocsView: React.FC<DocsViewProps> = ({ currentPack }) => {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Title */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-amber-400" />
          <span>Game Engine Integration Guide</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
          <span>8-Frame Animation Kinematics</span>
          <span aria-hidden="true">·</span>
          <span>Godot 4, Unity, Phaser 3, and CSS</span>
        </p>
      </div>

      {/* Frame Timing Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Animation Timing & Parameters</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">Total: 24 Frames</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Frames</th>
                <th className="px-5 py-3">Default Speed</th>
                <th className="px-5 py-3">Frame Duration</th>
                <th className="px-5 py-3">Loop Behavior</th>
                <th className="px-5 py-3">Tileset Row</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              <tr className="hover:bg-slate-800/40">
                <td className="px-5 py-3.5 font-bold text-amber-400">Idle Hover</td>
                <td className="px-5 py-3.5">8 Frames</td>
                <td className="px-5 py-3.5">8 FPS</td>
                <td className="px-5 py-3.5">125 ms</td>
                <td className="px-5 py-3.5 text-emerald-400">Continuous Loop</td>
                <td className="px-5 py-3.5">Row 1 (y: 0)</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-5 py-3.5 font-bold text-amber-400">Sprint Cycle</td>
                <td className="px-5 py-3.5">8 Frames</td>
                <td className="px-5 py-3.5">10 - 12 FPS</td>
                <td className="px-5 py-3.5">83 - 100 ms</td>
                <td className="px-5 py-3.5 text-emerald-400">Continuous Loop</td>
                <td className="px-5 py-3.5">Row 2 (y: 1)</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-5 py-3.5 font-bold text-amber-400">Wing Leap & Land</td>
                <td className="px-5 py-3.5">8 Frames</td>
                <td className="px-5 py-3.5">9 FPS</td>
                <td className="px-5 py-3.5">111 ms</td>
                <td className="px-5 py-3.5 text-rose-400">Play Once (Clamp at apex/landing)</td>
                <td className="px-5 py-3.5">Row 3 (y: 2)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Engine Guides */}
      <div className="space-y-6">
        {/* Godot 4 */}
        <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/60 space-y-3">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Godot 4.x (AnimatedSprite2D)</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            1. Drag the exported <code className="text-amber-400 font-mono">{currentPack.id}_tileset_clean.png</code> into your Godot project filesystem.<br />
            2. Add an <strong className="text-slate-200">AnimatedSprite2D</strong> node to your Player scene.<br />
            3. Under <strong className="text-slate-200">Frames</strong>, create a new <strong>SpriteFrames</strong> resource.<br />
            4. Click the grid icon to add frames from a sprite sheet, set <strong className="text-slate-200">Horizontal: 8</strong> and <strong className="text-slate-200">Vertical: 3</strong>.<br />
            5. Select row 0 for "idle", row 1 for "run", and row 2 for "jump".
          </p>
          <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
{`# Player.gd script snippet
extends CharacterBody2D

@onready var anim = $AnimatedSprite2D

func _physics_process(delta):
    if not is_on_floor():
        anim.play("jump")
    elif velocity.x != 0:
        anim.play("run")
    else:
        anim.play("idle")`}
          </pre>
        </div>

        {/* Unity */}
        <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/60 space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Unity 2D (Sprite Editor)</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            1. In Unity Inspector, select the imported PNG and set <strong className="text-slate-200">Sprite Mode</strong> to <strong>Multiple</strong>.<br />
            2. Set <strong className="text-slate-200">Filter Mode</strong> to <strong>Point (no filter)</strong> and Compression to <strong>None</strong> for pixel sharpness.<br />
            3. Open <strong>Sprite Editor</strong> &gt; Slice &gt; Type: <strong>Grid by Cell Count</strong> (Columns: 8, Rows: 3).<br />
            4. Click Slice and Apply. Drag the generated frame sets into your Animator Controller.
          </p>
        </div>

        {/* Phaser 3 */}
        <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/60 space-y-3">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Phaser 3 / Pixi.js</h3>
          </div>
          <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
{`// preload()
this.load.spritesheet('elysian_rogue', 'assets/${currentPack.id}_tileset_clean.png', {
  frameWidth: 256,
  frameHeight: 256
});

// create()
this.anims.create({
  key: 'idle',
  frames: this.anims.generateFrameNumbers('elysian_rogue', { start: 0, end: 7 }),
  frameRate: 8,
  repeat: -1
});

this.anims.create({
  key: 'run',
  frames: this.anims.generateFrameNumbers('elysian_rogue', { start: 8, end: 15 }),
  frameRate: 11,
  repeat: -1
});

this.anims.create({
  key: 'jump',
  frames: this.anims.generateFrameNumbers('elysian_rogue', { start: 16, end: 23 }),
  frameRate: 9,
  repeat: 0
});`}
          </pre>
        </div>
      </div>
    </div>
  );
};
