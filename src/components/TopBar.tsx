import React from 'react';
import { Download } from 'lucide-react';

import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  activeTab: 'studio' | 'motion' | 'slicer' | 'inspector' | 'tileset' | 'physics' | 'hitbox' | 'parallax' | 'generator' | 'library' | 'github';
  setActiveTab: (tab: 'studio' | 'motion' | 'slicer' | 'inspector' | 'tileset' | 'physics' | 'hitbox' | 'parallax' | 'generator' | 'library' | 'github') => void;
  onOpenExport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeTab, setActiveTab, onOpenExport }) => {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#12151b]/95 backdrop-blur-md border-b border-slate-800/80">
      {/* Zone 1: Brand Wordmark (Single text element) */}
      <a
        href="#studio"
        onClick={(e) => {
          e.preventDefault();
          setActiveTab('studio');
        }}
        className="text-base font-bold tracking-tight text-white hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
      >
        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 rotate-45 inline-block" />
        Elysian Sprite Studio
      </a>

      {/* Zone 2: Navigation links */}
      <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-300 overflow-x-auto">
        <button
          onClick={() => setActiveTab('studio')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'studio' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Studio Player
        </button>
        <button
          onClick={() => setActiveTab('motion')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'motion' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Motion Library
        </button>
        <button
          onClick={() => setActiveTab('slicer')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'slicer' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Upload & Slicer
        </button>
        <button
          onClick={() => setActiveTab('parallax')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'parallax' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Environment & Parallax
        </button>
        <button
          onClick={() => setActiveTab('hitbox')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'hitbox' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Physics & Hitbox Editor
        </button>
        <button
          onClick={() => setActiveTab('tileset')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'tileset' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Tileset Matrix
        </button>
        <button
          onClick={() => setActiveTab('physics')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'physics' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Action Arena
        </button>
        <button
          onClick={() => setActiveTab('generator')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'generator' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Asset Studio
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'library' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Asset Library
        </button>
        <button
          onClick={() => setActiveTab('github')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'github' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          GitHub & Install
        </button>
      </nav>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        <PWAInstallButton />
        <button
          onClick={onOpenExport}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all rounded-md shadow-sm whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Clean Tileset</span>
        </button>
      </div>
    </header>
  );
};
