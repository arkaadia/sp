import React, { useEffect, useState } from 'react';
import { Download, ZoomIn, Eye, Sparkles } from 'lucide-react';
import { CharacterPack, FrameDefinition, SpriteAction } from '../types/sprites';
import { loadImage, processFrameCanvas } from '../utils/imageProcessor';

interface FrameInspectorProps {
  currentPack: CharacterPack;
  selectedAction: SpriteAction;
  setSelectedAction: (act: SpriteAction) => void;
  removeBg: boolean;
  bgTolerance: number;
  bgSmoothness: number;
}

export const FrameInspector: React.FC<FrameInspectorProps> = ({
  currentPack,
  selectedAction,
  setSelectedAction,
  removeBg,
  bgTolerance,
  bgSmoothness,
}) => {
  const [frameDataUrls, setFrameDataUrls] = useState<Record<number, string>>({});
  const [inspectModalFrame, setInspectModalFrame] = useState<FrameDefinition | null>(null);

  const activeActionDef = currentPack.actions[selectedAction];
  const frames = activeActionDef.frames.slice(0, 8);

  // Generate frame preview data URLs
  useEffect(() => {
    let cancelled = false;

    async function loadPreviews() {
      try {
        const sourceImg = await loadImage(activeActionDef.sheetUrl);
        const map: Record<number, string> = {};

        for (let i = 0; i < 8; i++) {
          const f = frames[i];
          const canvas = processFrameCanvas(
            sourceImg,
            f,
            removeBg,
            bgTolerance,
            bgSmoothness,
            300,
            400
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
  }, [currentPack, selectedAction, removeBg, bgTolerance, bgSmoothness]);

  const handleDownloadSingleFrame = (frame: FrameDefinition, idx: number) => {
    const dataUrl = frameDataUrls[idx];
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${currentPack.id}_${selectedAction}_frame_${String(idx + 1).padStart(2, '0')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Individual Frame Inspector
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>High-Definition Frame Breakdown</span>
            <span aria-hidden="true">·</span>
            <span>Alpha Transparency Inspection</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-400">8 Individual PNG Targets</span>
          </p>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
          {(['idle', 'run', 'jump'] as SpriteAction[]).map((act) => (
            <button
              key={act}
              onClick={() => setSelectedAction(act)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                selectedAction === act
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {act} (8 Frames)
            </button>
          ))}
        </div>
      </div>

      {/* 8-Frame Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
        {frames.map((frame, idx) => {
          const previewUrl = frameDataUrls[idx];
          return (
            <div
              key={frame.id}
              className="group border border-slate-800 rounded-xl bg-slate-900/70 hover:border-slate-700 transition-all overflow-hidden flex flex-col"
            >
              {/* Image Preview Container */}
              <div className="relative aspect-[3/4] canvas-checkerboard flex items-center justify-center p-4 overflow-hidden border-b border-slate-800">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={frame.label}
                    className="max-h-full object-contain transition-transform group-hover:scale-105 pixelated"
                  />
                ) : (
                  <div className="font-mono text-xs text-slate-500">Processing...</div>
                )}

                {/* Inspect Button Overlay */}
                <button
                  onClick={() => setInspectModalFrame(frame)}
                  className="absolute top-2.5 right-2.5 p-1.5 bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white rounded-md border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Inspect Fullscreen"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 bg-slate-950/80 backdrop-blur rounded text-[11px] font-mono text-amber-400 border border-slate-800">
                  Frame 0{idx + 1}
                </div>
              </div>

              {/* Meta & Details */}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-white leading-snug">
                    {frame.phaseLabel}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span>
                      {frame.sw}×{frame.sh}px
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{(1000 / activeActionDef.fps).toFixed(0)}ms</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDownloadSingleFrame(frame, idx)}
                  className="w-full mt-2 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-700/60"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Frame PNG</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Frame Zoom Modal */}
      {inspectModalFrame && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setInspectModalFrame(null)}
        >
          <div
            className="border border-slate-800 rounded-2xl bg-slate-950 p-6 max-w-lg w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white capitalize">
                  {selectedAction} · {inspectModalFrame.phaseLabel}
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  Frame {inspectModalFrame.index + 1} of 8
                </span>
              </div>
              <button
                onClick={() => setInspectModalFrame(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-900 border border-slate-800"
              >
                Close
              </button>
            </div>

            <div className="h-96 canvas-checkerboard rounded-xl flex items-center justify-center p-6 overflow-hidden border border-slate-800">
              <img
                src={frameDataUrls[inspectModalFrame.index]}
                alt="Zoomed frame"
                className="max-h-full object-contain pixelated scale-110"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() =>
                  handleDownloadSingleFrame(inspectModalFrame, inspectModalFrame.index)
                }
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save Frame 0{inspectModalFrame.index + 1} PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
