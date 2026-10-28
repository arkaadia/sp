import React, { useState } from 'react';
import { Download, Smartphone, Monitor, Apple, Check, X, Sparkles, HelpCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // If the app is already installed and running standalone, suppress the install button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (!outcome) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 active:scale-[0.98] shadow-sm whitespace-nowrap shrink-0"
        title="Install as native PWA app on Mobile (Android/iOS) or Desktop (Windows/Mac/Linux)"
      >
        <Smartphone className="w-3.5 h-3.5 text-amber-400" />
        <span>Install App</span>
      </button>

      {/* Cross-Platform App Installation Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-[#0f131a] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-[#141824] via-[#0f131a] to-[#141824]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Install Elysian Sprite Studio
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400 text-slate-950">
                      PWA & Native
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Standalone app with offline caching for Android, iOS, Windows & Mac
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
              {/* Option 1: Instant PWA Home Screen Installation */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    1. Instant Installation (Recommended)
                  </span>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono">
                    Zero Download
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Install directly from your browser as a standalone application with its own window, dock/home-screen icon, and offline asset caching:
                </p>

                {isIOS ? (
                  <div className="p-3 bg-black/40 rounded-lg border border-slate-800 text-[11px] space-y-1.5 text-slate-200">
                    <div className="flex items-center gap-2 text-amber-300 font-semibold">
                      <Apple className="w-4 h-4" />
                      <span>iOS (iPhone / iPad) Safari:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-400">
                      <li>Tap the <strong>Share</strong> button (box with upward arrow) in the Safari toolbar.</li>
                      <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                      <li>Confirm by tapping <strong>"Add"</strong> in the top right.</li>
                    </ol>
                  </div>
                ) : (
                  <div className="p-3 bg-black/40 rounded-lg border border-slate-800 text-[11px] space-y-1.5 text-slate-200">
                    <div className="flex items-center gap-2 text-amber-300 font-semibold">
                      <Smartphone className="w-4 h-4" />
                      <span>Android (Chrome / Samsung Internet / Edge):</span>
                    </div>
                    <p className="text-slate-400">
                      Tap the browser menu <strong>(⋮)</strong> and select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                    </p>
                    <div className="flex items-center gap-2 text-amber-300 font-semibold pt-1">
                      <Monitor className="w-4 h-4" />
                      <span>Desktop (Chrome / Edge):</span>
                    </div>
                    <p className="text-slate-400">
                      Click the <strong>Install</strong> icon in the browser address bar (top right) or menu <strong>(⋮) &gt; Save and share &gt; Install Elysian Sprite Studio</strong>.
                    </p>
                  </div>
                )}

                {isInstallable && (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await install();
                      if (res) setShowGuideModal(false);
                    }}
                    className="w-full mt-2 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-400/20 transition-all"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>Launch Browser Install Prompt</span>
                  </button>
                )}
              </div>

              {/* Option 2: Native Android APK (Capacitor) */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    2. Native Android Package (APK / AAB)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Capacitor</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Build a real Android Studio project and generate signed `.apk` / `.aab` bundles using Capacitor:
                </p>
                <div className="p-2.5 bg-black/60 rounded-lg font-mono text-[10px] text-emerald-400 border border-slate-800 space-y-1 overflow-x-auto">
                  <p>npm install @capacitor/core @capacitor/cli @capacitor/android</p>
                  <p>npx cap init "Elysian Sprite Studio" "com.elysian.spritestudio"</p>
                  <p>npm run build</p>
                  <p>npx cap add android &amp;&amp; npx cap sync</p>
                  <p>npx cap open android # (Build APK in Android Studio)</p>
                </div>
              </div>

              {/* Option 3: Native Desktop App (Electron) */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-sky-400" />
                    3. Native Desktop Application (Win / Mac / Linux)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Electron</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Package the studio as a native executable (`.exe` on Windows, `.dmg` on macOS, `.AppImage` on Linux) with full local file access:
                </p>
                <div className="p-2.5 bg-black/60 rounded-lg font-mono text-[10px] text-sky-400 border border-slate-800 space-y-1 overflow-x-auto">
                  <p>npm install -D electron electron-builder</p>
                  <p>npm run build</p>
                  <p>npx electron-builder --windows --mac --linux</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-800 bg-[#0c0f16] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
