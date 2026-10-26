import React, { useState } from 'react';
import { Smartphone, Download, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenApkCenter?: () => void;
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenApkCenter,
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold shadow-sm transition-all whitespace-nowrap shrink-0 min-h-[40px] ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-xs'
        }`}
        title="Install Android / Web App directly to Home Screen"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          if (onOpenApkCenter) {
            onOpenApkCenter();
          } else {
            setShowGuideModal(true);
          }
        }}
        className={`flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-[0.98] text-emerald-300 font-semibold transition-all whitespace-nowrap shrink-0 min-h-[40px] ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs'
        }`}
        title="Download Android APK or Install on Mobile/Tablet"
      >
        <Download className="w-3.5 h-3.5 text-emerald-400" />
        <span>{isIOS ? 'Install on iOS' : 'Android APK'}</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141820] border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <span>نصب در گوشی و تبلت (Android / iOS)</span>
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed" dir="rtl">
              <p>
                می‌توانید فایل نصبی <strong>.APK</strong> را مستقیماً برای گوشی یا تبلت اندروید دانلود کنید و یا نسخه وب‌اپلیکیشن (PWA) را به صفحه اصلی اضافه نمایید:
              </p>
              <a
                href="/api/android/download-apk?profile=universal"
                download="ElysianSpriteStudio-v2.4.0-android-universal.apk"
                className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <Download className="w-4 h-4" />
                <span>دانلود مستقیم فایل APK اندروید (Universal)</span>
              </a>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>نصب سریع از طریق مرورگر (Add to Home Screen):</span>
                </div>
                <p className="text-slate-400">
                  در مرورگر Chrome اندروید روی منوی سه‌نقطه بالا ضربه بزنید و گزینه <strong>Install App</strong> یا <strong>Add to Home Screen</strong> را انتخاب کنید.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-semibold text-slate-200 transition-colors"
            >
              بستن (Close)
            </button>
          </div>
        </div>
      )}
    </>
  );
};
