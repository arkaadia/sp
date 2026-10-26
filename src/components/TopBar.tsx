import React from 'react';
import { Download } from 'lucide-react';
import { StudioTab } from './MobileBottomNav';

interface TopBarProps {
  activeTab: StudioTab;
  setActiveTab: (tab: StudioTab) => void;
  onOpenExport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeTab, setActiveTab, onOpenExport }) => {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-4 sm:px-6 py-3 bg-[#12151b]/95 backdrop-blur-md border-b border-slate-800/80">
      <a
        href="#studio"
        onClick={(e) => {
          e.preventDefault();
          setActiveTab('studio');
        }}
        className="text-base font-bold tracking-tight text-white hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
      >
        Elysian Sprite Studio
      </a>

      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
        <button
          onClick={() => setActiveTab('studio')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'studio' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Studio Player
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
          onClick={() => setActiveTab('slicer')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'slicer' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Sprite Slicer
        </button>
        <button
          onClick={() => setActiveTab('android')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'android' ? 'text-amber-400 border-b-2 border-amber-400 font-semibold' : ''
          }`}
        >
          Android APK
        </button>
      </nav>

      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenExport}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all rounded-lg shadow-sm whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Tileset</span>
        </button>
      </div>
    </header>
  );
};
