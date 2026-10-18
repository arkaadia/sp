/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CHARACTER_PACKS } from './data/spriteData';
import { CharacterPack, SpriteAction } from './types/sprites';
import { TopBar } from './components/TopBar';
import { StudioPlayer } from './components/StudioPlayer';
import { FrameInspector } from './components/FrameInspector';
import { TilesetMatrix } from './components/TilesetMatrix';
import { ActionArena } from './components/ActionArena';
import { SpriteSlicer } from './components/SpriteSlicer';
import { GithubGuideView } from './components/GithubGuideView';
import { ExportModal } from './components/ExportModal';
import { AssetStudio } from './components/AssetStudio';
import { AssetLibraryView } from './components/AssetLibraryView';

export default function App() {
  const [selectedAssetForVariation, setSelectedAssetForVariation] = useState<any>(null);
  const [slicerInitialImage, setSlicerInitialImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'studio' | 'slicer' | 'inspector' | 'tileset' | 'physics' | 'generator' | 'library' | 'github'>('studio');
  const [packList, setPackList] = useState<CharacterPack[]>(CHARACTER_PACKS);
  const [currentPackIndex, setCurrentPackIndex] = useState<number>(0);
  const [selectedAction, setSelectedAction] = useState<SpriteAction>('idle');

  // Background removal & chroma settings
  const [removeBg, setRemoveBg] = useState<boolean>(true);
  const [bgTolerance, setBgTolerance] = useState<number>(36);
  const [bgSmoothness, setBgSmoothness] = useState<number>(18);

  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const handleApplyCustomPack = (newPack: CharacterPack) => {
    setPackList((prev) => [newPack, ...prev]);
    setCurrentPackIndex(0);
    setActiveTab('studio');
  };

  const currentPack: CharacterPack = packList[currentPackIndex] || packList[0];

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-300">
      {/* 3-Zone Top Bar */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenExport={() => setIsExportModalOpen(true)}
      />

      {/* Character Pack Selection Strip */}
      <div className="bg-[#141820] border-b border-slate-800/80 px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-medium">Active Sprite Pack:</span>
            <div className="flex flex-wrap items-center gap-1.5 p-0.5 bg-slate-900 rounded-lg border border-slate-800">
              {packList.map((pack, idx) => (
                <button
                  key={pack.id + idx}
                  onClick={() => {
                    setCurrentPackIndex(idx);
                    setSelectedAction('idle');
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    currentPackIndex === idx
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {pack.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <span>Idle</span>
            <span aria-hidden="true">·</span>
            <span>Run</span>
            <span aria-hidden="true">·</span>
            <span>Jump</span>
            <span aria-hidden="true">·</span>
            <span>Attack</span>
            <span aria-hidden="true">·</span>
            <span>Climb</span>
            <span aria-hidden="true">·</span>
            <span>Defense</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400">48 Total Frames</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'studio' && (
          <StudioPlayer
            currentPack={currentPack}
            selectedAction={selectedAction}
            setSelectedAction={setSelectedAction}
            removeBg={removeBg}
            setRemoveBg={setRemoveBg}
            bgTolerance={bgTolerance}
            setBgTolerance={setBgTolerance}
            bgSmoothness={bgSmoothness}
            setBgSmoothness={setBgSmoothness}
            onOpenExport={() => setIsExportModalOpen(true)}
          />
        )}

        {activeTab === 'slicer' && (
          <SpriteSlicer
            initialImageUrl={slicerInitialImage}
            onApplyCustomPack={handleApplyCustomPack}
            removeBg={removeBg}
            bgTolerance={bgTolerance}
            bgSmoothness={bgSmoothness}
          />
        )}

        {activeTab === 'inspector' && (
          <FrameInspector
            currentPack={currentPack}
            selectedAction={selectedAction}
            setSelectedAction={setSelectedAction}
            removeBg={removeBg}
            bgTolerance={bgTolerance}
            bgSmoothness={bgSmoothness}
          />
        )}

        {activeTab === 'tileset' && (
          <TilesetMatrix
            currentPack={currentPack}
            removeBg={removeBg}
            bgTolerance={bgTolerance}
            bgSmoothness={bgSmoothness}
          />
        )}

        {activeTab === 'physics' && (
          <ActionArena
            currentPack={currentPack}
            removeBg={removeBg}
            bgTolerance={bgTolerance}
            bgSmoothness={bgSmoothness}
          />
        )}


        {activeTab === 'generator' && (
          <AssetStudio
            initialAsset={selectedAssetForVariation}
            onSendToSlicer={(url) => {
              setSlicerInitialImage(url);
              setActiveTab('slicer');
            }}
          />
        )}

        {activeTab === 'library' && (
          <AssetLibraryView onGenerateVariation={(asset) => {
            setSelectedAssetForVariation(asset);
            setActiveTab('generator');
          }} />
        )}


        {activeTab === 'github' && <GithubGuideView />}
      </main>

      {/* Clean Editorial Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0c0e12] py-6 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-amber-500 rotate-45" />
            <span className="font-semibold text-slate-300">Elysian Sprite Studio</span>
            <span aria-hidden="true">·</span>
            <span>2D Character Animation & Tileset Generator</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>PNG-32 Alpha Supported</span>
            <span aria-hidden="true">·</span>
            <span>Godot 4</span>
            <span aria-hidden="true">·</span>
            <span>Unity 2D</span>
            <span aria-hidden="true">·</span>
            <span>Phaser 3</span>
          </div>
        </div>
      </footer>

      {/* Global Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentPack={currentPack}
        removeBg={removeBg}
        bgTolerance={bgTolerance}
        bgSmoothness={bgSmoothness}
      />
    </div>
  );
}
