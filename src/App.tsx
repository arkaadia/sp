/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Smartphone, Download, Monitor, Tablet } from 'lucide-react';
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
import { PhysicsHitboxEditor } from './components/PhysicsHitboxEditor';
import { EnvironmentParallaxView } from './components/EnvironmentParallaxView';
import { MotionLibraryView } from './components/MotionLibraryView';
import { MotionRetargetingView } from './components/MotionRetargetingView';
import { AndroidApkCenter } from './components/AndroidApkCenter';
import { MobileBottomNav, StudioTab } from './components/MobileBottomNav';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

const WORKSPACE_TABS: { id: StudioTab; label: string }[] = [
  { id: 'studio', label: 'Studio Player' },
  { id: 'android', label: 'Android & APK' },
  { id: 'physics', label: 'Action Arena' },
  { id: 'generator', label: 'Asset Studio' },
  { id: 'slicer', label: 'Sprite Slicer' },
  { id: 'hitbox', label: 'Hitbox Editor' },
  { id: 'retargeting', label: 'Motion Retargeting' },
  { id: 'motion', label: 'Motion Library' },
  { id: 'tileset', label: 'Tileset Matrix' },
  { id: 'parallax', label: 'Parallax View' },
  { id: 'inspector', label: 'Frame Inspector' },
  { id: 'library', label: 'Asset Library' },
  { id: 'github', label: 'GitHub & Setup' },
];

export default function App() {
  const [selectedAssetForVariation, setSelectedAssetForVariation] = useState<any>(null);
  const [slicerInitialImage, setSlicerInitialImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>('studio');
  const [packList, setPackList] = useState<CharacterPack[]>(CHARACTER_PACKS);
  const [currentPackIndex, setCurrentPackIndex] = useState<number>(0);
  const [selectedAction, setSelectedAction] = useState<SpriteAction>('idle');
  const [devicePreviewMode, setDevicePreviewMode] = useState<'auto' | 'phone' | 'tablet'>('auto');

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

  const handleApplyRetargetedAction = (actionKey: string, actionDef: any) => {
    setPackList((prevPacks) => {
      const updated = [...prevPacks];
      const target = updated[currentPackIndex] || updated[0];
      if (target) {
        updated[currentPackIndex] = {
          ...target,
          actions: {
            ...target.actions,
            [actionKey]: actionDef,
          },
        };
      }
      return updated;
    });
    setSelectedAction(actionKey as SpriteAction);
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

      {/* Secondary Workspace Bar: Active Sprite Pack, Mobile/Tablet Simulator & Direct APK Download */}
      <div className="bg-[#141820] border-b border-slate-800/80 px-4 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Active Character Pack Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-medium">Sprite Pack:</span>
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
                {packList.map((pack, idx) => (
                  <button
                    key={pack.id + idx}
                    onClick={() => {
                      setCurrentPackIndex(idx);
                      setSelectedAction('idle');
                    }}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all whitespace-nowrap shrink-0 min-h-[34px] ${
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

            {/* Android APK Direct Action + Viewport Simulator Controls + PWA Install */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Viewport Mode Switcher (Auto / Phone / Tablet) */}
              <div className="hidden sm:flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
                <button
                  onClick={() => setDevicePreviewMode('auto')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                    devicePreviewMode === 'auto'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Responsive Full Viewport"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Full</span>
                </button>
                <button
                  onClick={() => setDevicePreviewMode('tablet')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                    devicePreviewMode === 'tablet'
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Android Tablet Viewport (1024px)"
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span>Tablet</span>
                </button>
                <button
                  onClick={() => setDevicePreviewMode('phone')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                    devicePreviewMode === 'phone'
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Android Phone Viewport (430px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Phone</span>
                </button>
              </div>

              <a
                href="/api/android/download-apk?profile=universal"
                download="ElysianSpriteStudio-v2.4.0-android-universal.apk"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 font-semibold text-xs transition-all whitespace-nowrap shrink-0 min-h-[40px]"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>دانلود مستقیم APK</span>
              </a>

              <PWAInstallButton
                compact
                onOpenApkCenter={() => setActiveTab('android')}
              />
            </div>
          </div>

          {/* Touch-Friendly Scrollable Studio Modules Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-800/60 no-scrollbar">
            {WORKSPACE_TABS.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                    isSelected
                      ? 'bg-slate-800 text-amber-400 font-semibold border border-amber-400/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area (Supports Auto Fullscreen, Android Tablet 1024px, or Android Phone 430px frame) */}
      <main
        className={`flex-1 pb-24 lg:pb-16 transition-all duration-200 ${
          devicePreviewMode === 'phone'
            ? 'max-w-[430px] w-full mx-auto my-4 border-2 border-slate-800 rounded-3xl bg-[#0f1115] shadow-2xl overflow-x-hidden'
            : devicePreviewMode === 'tablet'
            ? 'max-w-[1024px] w-full mx-auto my-4 border-2 border-slate-800 rounded-3xl bg-[#0f1115] shadow-2xl overflow-x-hidden'
            : 'w-full'
        }`}
      >
        {devicePreviewMode !== 'auto' && (
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-amber-400 uppercase">
              Android {devicePreviewMode} Touch Viewport
            </span>
            <button
              onClick={() => setDevicePreviewMode('auto')}
              className="text-slate-300 hover:text-white underline text-xs"
            >
              Exit Device Frame
            </button>
          </div>
        )}

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

        {activeTab === 'android' && (
          <AndroidApkCenter
            devicePreviewMode={devicePreviewMode}
            setDevicePreviewMode={setDevicePreviewMode}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'retargeting' && (
          <MotionRetargetingView
            currentPack={currentPack}
            packList={packList}
            onApplyRetargetedAction={handleApplyRetargetedAction}
            onSendToSlicer={(url) => {
              setSlicerInitialImage(url);
              setActiveTab('slicer');
            }}
            onNavigateToStudio={() => {
              setActiveTab('studio');
            }}
            removeBg={removeBg}
            bgTolerance={bgTolerance}
            bgSmoothness={bgSmoothness}
          />
        )}

        {activeTab === 'motion' && (
          <MotionLibraryView
            currentPack={currentPack}
            packList={packList}
            onApplyRetargetedAction={handleApplyRetargetedAction}
            onSendToSlicer={(url) => {
              setSlicerInitialImage(url);
              setActiveTab('slicer');
            }}
            onNavigateToStudio={() => {
              setActiveTab('studio');
            }}
            onNavigateToRetargeting={() => {
              setActiveTab('retargeting');
            }}
            removeBg={removeBg}
            bgTolerance={bgTolerance}
            bgSmoothness={bgSmoothness}
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

        {activeTab === 'parallax' && (
          <EnvironmentParallaxView currentPack={currentPack} />
        )}

        {activeTab === 'hitbox' && (
          <PhysicsHitboxEditor
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
          <AssetLibraryView
            onGenerateVariation={(asset) => {
              setSelectedAssetForVariation(asset);
              setActiveTab('generator');
            }}
          />
        )}

        {activeTab === 'github' && <GithubGuideView />}
      </main>

      {/* Clean Editorial Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0c0e12] py-6 px-6 pb-24 lg:pb-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Elysian Sprite Studio</span>
            <span aria-hidden="true">·</span>
            <span>2D Character Animation & Tileset Generator</span>
            <span aria-hidden="true">·</span>
            <span>Android Phone & Tablet Edition</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setActiveTab('android')}
              className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
            >
              Download Android .APK
            </button>
            <span aria-hidden="true">·</span>
            <span>Godot 4</span>
            <span aria-hidden="true">·</span>
            <span>Unity 2D</span>
            <span aria-hidden="true">·</span>
            <span>Phaser 3</span>
          </div>
        </div>
      </footer>

      {/* Mobile & Tablet Fixed Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenExport={() => setIsExportModalOpen(true)}
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />

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
