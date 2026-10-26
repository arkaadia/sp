import React, { useState } from 'react';
import {
  Play,
  Gamepad2,
  Paintbrush,
  Smartphone,
  Menu,
  X,
  Download,
  Scissors,
  Grid,
  Shield,
  Layers,
  Sparkles,
  FolderOpen,
  GitBranch,
  Film,
  Repeat
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export type StudioTab =
  | 'studio'
  | 'retargeting'
  | 'motion'
  | 'slicer'
  | 'inspector'
  | 'tileset'
  | 'physics'
  | 'hitbox'
  | 'parallax'
  | 'generator'
  | 'library'
  | 'android'
  | 'github';

interface MobileBottomNavProps {
  activeTab: StudioTab;
  setActiveTab: (tab: StudioTab) => void;
  onOpenExport: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenExport,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const allModules: { id: StudioTab; label: string; sub: string; icon: React.ReactNode }[] = [
    { id: 'studio', label: 'Studio Player', sub: 'پخش‌کننده ۸ فریم', icon: <Play className="w-4 h-4 text-amber-400" /> },
    { id: 'android', label: 'Android APK', sub: 'دانلود APK و تنظیمات موبایل', icon: <Smartphone className="w-4 h-4 text-emerald-400" /> },
    { id: 'physics', label: 'Action Arena', sub: 'تست بازی ۶۰ فریم با گیم‌پد لمسی', icon: <Gamepad2 className="w-4 h-4 text-amber-400" /> },
    { id: 'generator', label: 'Asset Studio & Canvas', sub: 'طراحی پیکسلی و هوش مصنوعی', icon: <Paintbrush className="w-4 h-4 text-rose-400" /> },
    { id: 'slicer', label: 'Upload & Slicer', sub: 'برش اسپرایت‌شیت از گالری', icon: <Scissors className="w-4 h-4 text-sky-400" /> },
    { id: 'hitbox', label: 'Hitbox & Pivot Editor', sub: 'ویرایشگر لمسی برخورد و مرکز ثقل', icon: <Shield className="w-4 h-4 text-emerald-400" /> },
    { id: 'retargeting', label: 'Motion Retargeting', sub: 'انتقال حرکت ۱۰ فریمی', icon: <Repeat className="w-4 h-4 text-amber-400" /> },
    { id: 'motion', label: 'Motion Library', sub: 'کتابخانه الگوهای انیمیشن', icon: <Film className="w-4 h-4 text-purple-400" /> },
    { id: 'tileset', label: 'Tileset Matrix', sub: 'خروجی تایل‌ست موتورهای بازی', icon: <Grid className="w-4 h-4 text-amber-400" /> },
    { id: 'parallax', label: 'Parallax Preview', sub: 'پیش‌نمایش محیط چندلایه', icon: <Layers className="w-4 h-4 text-sky-400" /> },
    { id: 'inspector', label: 'Frame Inspector', sub: 'بررسی دقیق تک‌فریم‌ها', icon: <Sparkles className="w-4 h-4 text-amber-400" /> },
    { id: 'library', label: 'Asset Library', sub: 'آرشیو کاراکترها و آیتم‌ها', icon: <FolderOpen className="w-4 h-4 text-emerald-400" /> },
    { id: 'github', label: 'GitHub & Rules', sub: 'سورس‌کد و مستندات', icon: <GitBranch className="w-4 h-4 text-slate-300" /> },
  ];

  const handleSelectTab = (tab: StudioTab) => {
    setActiveTab(tab);
    setIsDrawerOpen(false);
  };

  return (
    <>
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#12151b]/95 backdrop-blur-md border-t border-slate-800/90 grid grid-cols-5 items-center h-16 px-1 select-none"
      >
        <button
          onClick={() => handleSelectTab('studio')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
            activeTab === 'studio' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Play className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-1 whitespace-nowrap">Studio</span>
        </button>

        <button
          onClick={() => handleSelectTab('physics')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
            activeTab === 'physics' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gamepad2 className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-1 whitespace-nowrap">Arena</span>
        </button>

        <button
          onClick={() => handleSelectTab('generator')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
            activeTab === 'generator' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Paintbrush className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-1 whitespace-nowrap">Canvas</span>
        </button>

        <button
          onClick={() => handleSelectTab('android')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
            activeTab === 'android' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-5 h-5" />
          <span className="text-[10px] font-bold tracking-tight mt-1 whitespace-nowrap">دانلود APK</span>
        </button>

        <button
          onClick={() => setIsDrawerOpen(true)}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
            isDrawerOpen ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-1 whitespace-nowrap">همه ابزارها</span>
        </button>
      </nav>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end lg:hidden"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="bg-[#141820] border-t border-slate-800 rounded-t-3xl p-5 max-h-[82vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white">ابزارهای استودیو و دانلود اندروید</h3>
                <p className="text-[11px] text-slate-400">Elysian Sprite Studio · Mobile & Tablet</p>
              </div>
              <div className="flex items-center gap-2">
                <PWAInstallButton
                  compact
                  onOpenApkCenter={() => handleSelectTab('android')}
                />
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800/80 text-slate-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto py-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {allModules.map((mod) => {
                const isSelected = activeTab === mod.id;
                return (
                  <button
                    key={mod.id}
                    onClick={() => handleSelectTab(mod.id)}
                    className={`min-h-[56px] px-4 py-2.5 rounded-2xl border flex items-center justify-between text-left transition-all ${
                      isSelected
                        ? 'bg-amber-400/15 border-amber-400 text-white'
                        : 'bg-slate-950/90 border-slate-800/90 text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                        {mod.icon}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold truncate">{mod.label}</div>
                        <div className="text-[11px] text-slate-400 truncate">{mod.sub}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-mono text-amber-400 shrink-0 ml-2">ACTIVE</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2.5 shrink-0">
              <a
                href="/api/android/download-apk?profile=universal"
                download="ElysianSpriteStudio-v2.4.0-android-universal.apk"
                className="min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>دانلود مستقیم APK</span>
              </a>

              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  onOpenExport();
                }}
                className="min-h-[46px] px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>خروجی تایل‌ست PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
