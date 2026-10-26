import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { CharacterPack, SpriteAction } from '../types/sprites';
import { loadImage, processFrameCanvas } from '../utils/imageProcessor';

interface ActionArenaProps {
  currentPack: CharacterPack;
  removeBg: boolean;
  bgTolerance: number;
  bgSmoothness: number;
}

export const ActionArena: React.FC<ActionArenaProps> = ({
  currentPack,
  removeBg,
  bgTolerance,
  bgSmoothness,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Character state
  const [characterState, setCharacterState] = useState<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    isGrounded: boolean;
    facingLeft: boolean;
    currentAction: SpriteAction;
    frameIndex: number;
  }>({
    x: 400,
    y: 350,
    vx: 0,
    vy: 0,
    isGrounded: true,
    facingLeft: false,
    currentAction: 'idle',
    frameIndex: 0,
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Pre-cached frame canvases for high 60fps rendering performance
  const cachedFramesRef = useRef<Record<SpriteAction, HTMLCanvasElement[]>>({
    idle: [],
    run: [],
    jump: [],
    attack: [],
    climb: [],
    defense: [],
  });
  const [isAssetsReady, setIsAssetsReady] = useState<boolean>(false);

  // Key tracking
  const keysPressed = useRef<{
    left: boolean;
    right: boolean;
    jump: boolean;
    attack: boolean;
    defense: boolean;
    climb: boolean;
  }>({
    left: false,
    right: false,
    jump: false,
    attack: false,
    defense: false,
    climb: false,
  });

  // Sound generator via Web Audio API
  const playSfx = (type: 'jump' | 'land' | 'step' | 'slash' | 'shield') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'jump') {
        osc.frequency.setValueAtTime(260, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(520, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
      } else if (type === 'slash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.14);
      } else if (type === 'shield') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(330, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else if (type === 'land') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      }
    } catch (e) {
      // Audio context might be restricted
    }
  };

  // Pre-process frames into offscreen canvases
  useEffect(() => {
    let cancelled = false;

    async function cacheAll() {
      setIsAssetsReady(false);
      try {
        const actions: SpriteAction[] = ['idle', 'run', 'jump', 'attack', 'climb', 'defense'];
        const newCache: Record<SpriteAction, HTMLCanvasElement[]> = {
          idle: [],
          run: [],
          jump: [],
          attack: [],
          climb: [],
          defense: [],
        };

        for (const act of actions) {
          const actionDef = currentPack.actions[act];
          if (!actionDef) continue;
          const img = await loadImage(actionDef.sheetUrl);

          for (let i = 0; i < 8; i++) {
            const frame = actionDef.frames[i];
            const processed = processFrameCanvas(
              img,
              frame,
              removeBg,
              bgTolerance,
              bgSmoothness,
              180,
              240
            );
            newCache[act].push(processed);
          }
        }

        if (!cancelled) {
          cachedFramesRef.current = newCache;
          setIsAssetsReady(true);
        }
      } catch (err) {
        console.error('Failed to pre-render arena frames:', err);
      }
    }

    cacheAll();

    return () => {
      cancelled = true;
    };
  }, [currentPack, removeBg, bgTolerance, bgSmoothness]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        keysPressed.current.left = true;
      }
      if (['ArrowRight', 'KeyD'].includes(e.code)) {
        keysPressed.current.right = true;
      }
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        keysPressed.current.jump = true;
      }
      if (['KeyZ', 'KeyJ'].includes(e.code)) {
        keysPressed.current.attack = true;
        playSfx('slash');
      }
      if (['KeyX', 'KeyK'].includes(e.code)) {
        keysPressed.current.defense = true;
        playSfx('shield');
      }
      if (['KeyC', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        keysPressed.current.climb = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        keysPressed.current.left = false;
      }
      if (['ArrowRight', 'KeyD'].includes(e.code)) {
        keysPressed.current.right = false;
      }
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        keysPressed.current.jump = false;
      }
      if (['KeyZ', 'KeyJ'].includes(e.code)) {
        keysPressed.current.attack = false;
      }
      if (['KeyX', 'KeyK'].includes(e.code)) {
        keysPressed.current.defense = false;
      }
      if (['KeyC', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        keysPressed.current.climb = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main 60 FPS Game Loop
  useEffect(() => {
    if (!isAssetsReady) return;

    let animId: number;
    let frameTimer = 0;
    const groundY = 360;

    const platforms = [
      { x: 120, y: 260, w: 180, h: 16 },
      { x: 500, y: 230, w: 220, h: 16 },
      { x: 300, y: 150, w: 200, h: 16 },
    ];

    const loop = (timestamp: number) => {
      setCharacterState((prev) => {
        let vx = prev.vx;
        let vy = prev.vy + 0.6; // Gravity
        let x = prev.x;
        let y = prev.y;
        let facingLeft = prev.facingLeft;
        let isGrounded = false;

        // Horizontal movement
        const speed = 4.8;
        if (keysPressed.current.left) {
          vx = -speed;
          facingLeft = true;
        } else if (keysPressed.current.right) {
          vx = speed;
          facingLeft = false;
        } else {
          vx *= 0.7; // friction
          if (Math.abs(vx) < 0.1) vx = 0;
        }

        // Jump trigger
        if (keysPressed.current.jump && prev.isGrounded) {
          vy = -12;
          playSfx('jump');
        }

        x += vx;
        y += vy;

        // Ground check
        if (y >= groundY) {
          y = groundY;
          vy = 0;
          isGrounded = true;
          if (!prev.isGrounded) playSfx('land');
        }

        // Platform collisions (falling down only)
        if (vy >= 0) {
          for (const plat of platforms) {
            if (
              x + 40 >= plat.x &&
              x - 40 <= plat.x + plat.w &&
              prev.y <= plat.y &&
              y >= plat.y
            ) {
              y = plat.y;
              vy = 0;
              isGrounded = true;
              break;
            }
          }
        }

        // Screen boundaries
        if (x < 60) x = 60;
        if (x > 740) x = 740;

        // Determine action
        let action: SpriteAction = 'idle';
        if (keysPressed.current.attack) {
          action = 'attack';
        } else if (keysPressed.current.defense) {
          action = 'defense';
        } else if (keysPressed.current.climb) {
          action = 'climb';
          vy = -3; // Climb upwards
          isGrounded = false;
        } else if (!isGrounded) {
          action = 'jump';
        } else if (Math.abs(vx) > 0.4) {
          action = 'run';
        } else {
          action = 'idle';
        }

        // Frame advancement
        frameTimer++;
        const frameSpeed = action === 'attack' ? 4 : action === 'run' ? 5 : 7;
        let frameIndex = prev.frameIndex;

        if (action !== prev.currentAction) {
          frameIndex = 0;
          frameTimer = 0;
        } else if (frameTimer >= frameSpeed) {
          frameTimer = 0;
          if (action === 'jump') {
            if (vy < -6) frameIndex = 1;
            else if (vy < -2) frameIndex = 2;
            else if (vy >= -2 && vy <= 2) frameIndex = 3;
            else if (vy > 2 && vy < 6) frameIndex = 4;
            else if (vy >= 6) frameIndex = 5;
            else frameIndex = 6;
          } else {
            frameIndex = (frameIndex + 1) % 8;
          }
        }

        return {
          x,
          y,
          vx,
          vy,
          isGrounded,
          facingLeft,
          currentAction: action,
          frameIndex: Math.min(7, frameIndex),
        };
      });

      // Render to canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // 1. Draw Arena Backdrop
          const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
          grad.addColorStop(0, '#0f131a');
          grad.addColorStop(1, '#191e28');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Subtle stars / sparkles in background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.fillRect(100, 60, 2, 2);
          ctx.fillRect(240, 110, 2, 2);
          ctx.fillRect(680, 75, 3, 3);
          ctx.fillRect(450, 90, 2, 2);
          ctx.fillRect(380, 40, 2, 2);

          // 2. Draw Ground
          ctx.fillStyle = '#222733';
          ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
          ctx.strokeStyle = '#3b4252';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, groundY, canvas.width, canvas.height - groundY);

          // 3. Draw Platforms
          platforms.forEach((plat) => {
            ctx.fillStyle = '#2c3342';
            ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
            ctx.strokeStyle = '#4c566a';
            ctx.lineWidth = 2;
            ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

            // Platform top highlight
            ctx.fillStyle = '#d8dee9';
            ctx.fillRect(plat.x, plat.y, plat.w, 2);
          });

          // 4. Draw Character Sprite
          const actionFrames = cachedFramesRef.current[characterState.currentAction];
          const frameCanvas = actionFrames?.[characterState.frameIndex];

          if (frameCanvas) {
            ctx.save();
            ctx.translate(characterState.x, characterState.y);

            if (characterState.facingLeft) {
              ctx.scale(-1, 1);
            }

            // Draw with pivot at feet
            const drawW = 120;
            const drawH = 160;
            ctx.drawImage(frameCanvas, -drawW / 2, -drawH + 10, drawW, drawH);

            ctx.restore();
          }

          // 5. Draw Shadow
          ctx.save();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.beginPath();
          ctx.ellipse(characterState.x, characterState.y, 28, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animId);
  }, [isAssetsReady, characterState.currentAction, characterState.frameIndex]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Action Arena - 60 FPS Sandbox
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Playable Character Controller</span>
            <span aria-hidden="true">·</span>
            <span>Seamless 8-Frame State Transitions</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-400">Arrow Keys / A-D + Space</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
            title="Toggle Synthesized SFX"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>SFX</span>
          </button>

          <button
            onClick={() =>
              setCharacterState((p) => ({ ...p, x: 400, y: 350, vx: 0, vy: 0 }))
            }
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Position</span>
          </button>
        </div>
      </div>

      {/* Main Sandbox Canvas */}
      <div className="relative border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-2xl flex flex-col items-center">
        {/* HUD Info Header */}
        <div className="w-full px-5 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              State: <strong className="text-amber-400 uppercase">{characterState.currentAction}</strong>
            </span>
            <span className="text-slate-400">
              Frame: <strong className="text-white">{characterState.frameIndex + 1} / 8</strong>
            </span>
            <span className="text-slate-400">
              Grounded: <strong className={characterState.isGrounded ? 'text-emerald-400' : 'text-amber-400'}>{characterState.isGrounded ? 'YES' : 'AIRBORNE'}</strong>
            </span>
          </div>

          <div className="text-slate-400 text-[11px]">
            Controls: <span className="text-slate-200">A/D/Left/Right</span> = Run · <span className="text-slate-200">Space/Up</span> = Jump
          </div>
        </div>

        {/* 800x420 Game Canvas */}
        <div className="p-4 flex justify-center w-full">
          <canvas
            ref={canvasRef}
            width={800}
            height={420}
            className="rounded-lg shadow-inner border border-slate-800 bg-[#12151b] max-w-full"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Ergonomic Android Phone & Tablet Touch Gamepad */}
        <div className="w-full px-4 sm:px-6 py-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 select-none touch-manipulation">
          {/* Left Thumb Zone: Directional Pad */}
          <div className="grid grid-cols-3 gap-2.5 sm:flex sm:items-center">
            <button
              onPointerDown={() => {
                keysPressed.current.left = true;
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
              }}
              onPointerUp={() => (keysPressed.current.left = false)}
              onPointerLeave={() => (keysPressed.current.left = false)}
              onPointerCancel={() => (keysPressed.current.left = false)}
              className="min-h-[48px] px-4 py-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-400 active:text-slate-950 text-slate-100 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Run L</span>
            </button>

            <button
              onPointerDown={() => {
                keysPressed.current.right = true;
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
              }}
              onPointerUp={() => (keysPressed.current.right = false)}
              onPointerLeave={() => (keysPressed.current.right = false)}
              onPointerCancel={() => (keysPressed.current.right = false)}
              className="min-h-[48px] px-4 py-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-400 active:text-slate-950 text-slate-100 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-slate-700"
            >
              <span>Run R</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onPointerDown={() => {
                keysPressed.current.jump = true;
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25);
              }}
              onPointerUp={() => (keysPressed.current.jump = false)}
              onPointerLeave={() => (keysPressed.current.jump = false)}
              onPointerCancel={() => (keysPressed.current.jump = false)}
              className="min-h-[48px] px-4 py-3 bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 active:bg-amber-400 active:text-slate-950 text-amber-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowUp className="w-4 h-4" />
              <span>Jump</span>
            </button>
          </div>

          {/* Right Thumb Zone: Combat & Action Buttons */}
          <div className="grid grid-cols-3 gap-2.5 sm:flex sm:items-center">
            <button
              onPointerDown={() => {
                keysPressed.current.attack = true;
                playSfx('slash');
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
              }}
              onPointerUp={() => (keysPressed.current.attack = false)}
              onPointerLeave={() => (keysPressed.current.attack = false)}
              onPointerCancel={() => (keysPressed.current.attack = false)}
              className="min-h-[48px] px-4 py-3 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 active:scale-95 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1"
            >
              <span>Attack (Z)</span>
            </button>

            <button
              onPointerDown={() => {
                keysPressed.current.defense = true;
                playSfx('shield');
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
              }}
              onPointerUp={() => (keysPressed.current.defense = false)}
              onPointerLeave={() => (keysPressed.current.defense = false)}
              onPointerCancel={() => (keysPressed.current.defense = false)}
              className="min-h-[48px] px-4 py-3 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 active:scale-95 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1"
            >
              <span>Defense (X)</span>
            </button>

            <button
              onPointerDown={() => {
                keysPressed.current.climb = true;
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
              }}
              onPointerUp={() => (keysPressed.current.climb = false)}
              onPointerLeave={() => (keysPressed.current.climb = false)}
              onPointerCancel={() => (keysPressed.current.climb = false)}
              className="min-h-[48px] px-4 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 active:scale-95 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1"
            >
              <span>Climb (C)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
