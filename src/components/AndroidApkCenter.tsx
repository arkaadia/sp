import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Tablet,
  Download,
  CheckCircle2,
  ShieldCheck,
  Settings2,
  Package,
  Cpu,
  Gamepad2,
  PenTool,
  Copy,
  Check,
  RefreshCw,
  Layers,
  Sparkles,
  Monitor
} from 'lucide-react';
import {
  downloadAndroidApkFile,
  downloadAndroidStudioProjectZip,
  ClientApkOptions,
} from '../utils/androidProjectExporter';
import { usePWAInstall } from '../utils/usePWAInstall';

interface AndroidApkCenterProps {
  devicePreviewMode: 'auto' | 'phone' | 'tablet';
  setDevicePreviewMode: (mode: 'auto' | 'phone' | 'tablet') => void;
  onNavigateTab: (tab: any) => void;
}

export const AndroidApkCenter: React.FC<AndroidApkCenterProps> = ({
  devicePreviewMode,
  setDevicePreviewMode,
  onNavigateTab,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const [apkInfo, setApkInfo] = useState<{
    filename: string;
    sha256: string;
    sizeBytes: number;
  } | null>(null);

  const [isBuildingApk, setIsBuildingApk] = useState(false);
  const [buildSuccessMessage, setBuildSuccessMessage] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);

  // Custom APK Builder State
  const [customConfig, setCustomConfig] = useState<ClientApkOptions>({
    appName: 'Elysian Sprite Studio',
    packageId: 'com.arkaadia.elysianspritestudio',
    versionName: '2.4.0',
    serverUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    orientation: 'sensor',
    deviceProfile: 'universal',
    enableHaptics: true,
    enableStylus: true,
    fullscreen: true,
  });

  useEffect(() => {
    fetch('/api/android/apk-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.sha256) {
          setApkInfo(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleDownloadPresetApk = async (
    profile: 'universal' | 'tablet' | 'phone',
    orientation: 'sensor' | 'landscape' | 'portrait'
  ) => {
    setIsBuildingApk(true);
    setBuildSuccessMessage(null);
    try {
      const result = await downloadAndroidApkFile({
        ...customConfig,
        deviceProfile: profile,
        orientation,
      });
      setBuildSuccessMessage(
        `فایل ${result.filename} (${(result.sizeBytes / 1024).toFixed(1)} KB) با موفقیت ساخته و دانلود شد.`
      );
      if (result.sha256) {
        setApkInfo({
          filename: result.filename,
          sha256: result.sha256,
          sizeBytes: result.sizeBytes,
        });
      }
    } finally {
      setIsBuildingApk(false);
    }
  };

  const handleBuildCustomApk = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBuildingApk(true);
    setBuildSuccessMessage(null);
    try {
      const result = await downloadAndroidApkFile(customConfig);
      setBuildSuccessMessage(
        `پکیج سفارشی اندروید (${result.filename}) با امضای دیجیتال RSA-2048 آماده و دانلود شد.`
      );
      if (result.sha256) {
        setApkInfo({
          filename: result.filename,
          sha256: result.sha256,
          sizeBytes: result.sizeBytes,
        });
      }
    } finally {
      setIsBuildingApk(false);
    }
  };

  const copySha = () => {
    if (!apkInfo?.sha256) return;
    navigator.clipboard.writeText(apkInfo.sha256);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8">
      {/* Hero Section: Direct Android APK Download & Mobile/Tablet Readiness */}
      <div className="border border-slate-800 rounded-2xl p-6 md:p-8 bg-gradient-to-br from-[#141923] via-[#11151d] to-[#0d1016] shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-400 font-mono">
              <span>ANDROID PHONE & TABLET EDITION</span>
              <span aria-hidden="true">·</span>
              <span>API 26–35 (Android 8.0 to 15)</span>
              <span aria-hidden="true">·</span>
              <span>SIGNED .APK</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              مرکز دانلود APK و نسخه موبایل و تبلت اندروید
            </h1>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              پروژه <strong>Elysian Sprite Studio (arkaadia/sp)</strong> به طور کامل برای نمایشگرهای لمسی گوشی و تبلت‌های اندرویدی بهینه‌سازی شده است. فایل <strong>.APK</strong> امضاشده را مستقیماً دانلود و نصب کنید یا تنظیمات ساخت APK را سفارشی‌سازی نمایید.
            </p>
          </div>

          {/* Primary Download CTA Cluster */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <button
              onClick={() => handleDownloadPresetApk('universal', 'sensor')}
              disabled={isBuildingApk}
              className="px-6 py-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-amber-400/15 transition-all cursor-pointer min-h-[52px]"
            >
              {isBuildingApk ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              <span>دانلود مستقیم فایل APK اندروید (Universal)</span>
            </button>

            <div className="flex items-center gap-2">
              {isInstallable && !isInstalled && (
                <button
                  onClick={install}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all min-h-[44px]"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>نصب مستقیم وب‌اپ (Install PWA)</span>
                </button>
              )}

              <button
                onClick={() => downloadAndroidStudioProjectZip(customConfig)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all min-h-[44px]"
              >
                <Package className="w-4 h-4 text-amber-400" />
                <span>دانلود سورس پروژه Android Studio (.ZIP)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Toast when APK is downloaded */}
        {buildSuccessMessage && (
          <div
            dir="rtl"
            className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{buildSuccessMessage}</span>
          </div>
        )}

        {/* Package Verification Metadata Bar */}
        <div className="pt-4 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>امضای دیجیتال RSA-2048 (META-INF/CERT.RSA)</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-300">com.arkaadia.elysianspritestudio</span>
            <span aria-hidden="true">·</span>
            <span>نسخه v2.4.0 (Build 24)</span>
            {apkInfo && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-amber-300">
                  {(apkInfo.sizeBytes / 1024).toFixed(1)} KB
                </span>
              </>
            )}
          </div>

          {apkInfo?.sha256 && (
            <button
              onClick={copySha}
              className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 hover:text-amber-300 transition-colors"
              title="Copy SHA-256 Checksum"
            >
              <span>SHA-256: {apkInfo.sha256.slice(0, 16)}...</span>
              {copiedSha ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 3 Pre-Built Android APK Editions (Universal, Tablet Pro, Phone Touch) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Universal Phone & Tablet */}
        <div className="border border-slate-800 rounded-2xl p-5 bg-[#141820] flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-amber-400">پیشنهادی · Universal</span>
            </div>
            <h2 className="text-base font-bold text-white">
              نسخه جامع گوشی و تبلت (Universal APK)
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              مناسب برای تمام گوشی‌ها و تبلت‌های اندرویدی (چرخش خودکار صفحه، نوار ابزار پایین لمسی و گیم‌پد مجازی Action Arena).
            </p>
            <div className="text-[11px] font-mono text-slate-400 space-y-1 pt-1">
              <div>• Architecture: Universal (ARM64 / ARMv7 / x86_64)</div>
              <div>• Orientation: Auto-Rotate Sensor</div>
              <div>• Touch Hitboxes: ≥ 44px Ergonomic</div>
            </div>
          </div>

          <button
            onClick={() => handleDownloadPresetApk('universal', 'sensor')}
            disabled={isBuildingApk}
            className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span>دانلود APK نسخه Universal</span>
          </button>
        </div>

        {/* Card 2: Android Tablet Edition */}
        <div className="border border-slate-800 rounded-2xl p-5 bg-[#141820] flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-sky-400/15 border border-sky-400/30 flex items-center justify-center text-sky-400">
                <Tablet className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-sky-400">Tablet Pro · 7"–13"</span>
            </div>
            <h2 className="text-base font-bold text-white">
              نسخه ویژه تبلت اندروید (Tablet Landscape APK)
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              بهینه‌شده برای تبلت‌های Samsung Galaxy Tab، Xiaomi Pad و Lenovo با پشتیبانی از قلم لمسی (S-Pen / Stylus) در بوم نقاشی و ویرایشگر Hitbox.
            </p>
            <div className="text-[11px] font-mono text-slate-400 space-y-1 pt-1">
              <div>• Display: Multi-Column Split Studio</div>
              <div>• Orientation: Landscape Widescreen</div>
              <div>• Input: S-Pen / Stylus + Multi-Touch</div>
            </div>
          </div>

          <button
            onClick={() => handleDownloadPresetApk('tablet', 'landscape')}
            disabled={isBuildingApk}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-[44px]"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>دانلود APK ویژه تبلت (Tablet)</span>
          </button>
        </div>

        {/* Card 3: Android Smartphone Compact Edition */}
        <div className="border border-slate-800 rounded-2xl p-5 bg-[#141820] flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-emerald-400">Phone Touch · One-Hand</span>
            </div>
            <h2 className="text-base font-bold text-white">
              نسخه ویژه گوشی موبایل (Phone Portrait APK)
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              طراحی‌شده برای استفاده راحت با یک دست روی گوشی‌های اندرویدی، همراه با منوی کشویی پایین صفحه و کنترل‌های لمسی با بازخورد لرزشی (Haptic).
            </p>
            <div className="text-[11px] font-mono text-slate-400 space-y-1 pt-1">
              <div>• Display: Thumb-Zone Bottom Navigation</div>
              <div>• Orientation: Portrait / Sensor</div>
              <div>• Haptics: Vibration Feedback Active</div>
            </div>
          </div>

          <button
            onClick={() => handleDownloadPresetApk('phone', 'portrait')}
            disabled={isBuildingApk}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-[44px]"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>دانلود APK ویژه موبایل (Phone)</span>
          </button>
        </div>
      </div>

      {/* Interactive Device Simulator Mode & Custom APK Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Custom APK Builder Form */}
        <form
          onSubmit={handleBuildCustomApk}
          className="lg:col-span-7 border border-slate-800 rounded-2xl p-6 bg-[#141820] space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Settings2 className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white">
                ساخت APK سفارشی (Custom Android APK Builder)
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">Android Manifest Config</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                نام برنامه در اندروید (App Name)
              </label>
              <input
                type="text"
                value={customConfig.appName}
                onChange={(e) => setCustomConfig({ ...customConfig, appName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                شناسه پکیج (Android Package ID)
              </label>
              <input
                type="text"
                value={customConfig.packageId}
                onChange={(e) => setCustomConfig({ ...customConfig, packageId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-amber-300 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                پروفایل دستگاه (Target Device)
              </label>
              <select
                value={customConfig.deviceProfile}
                onChange={(e) =>
                  setCustomConfig({
                    ...customConfig,
                    deviceProfile: e.target.value as 'universal' | 'tablet' | 'phone',
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="universal">Universal (همه گوشی‌ها و تبلت‌ها)</option>
                <option value="tablet">Android Tablet (تبلت ۷ تا ۱۳ اینچ)</option>
                <option value="phone">Android Smartphone (گوشی موبایل)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                جهت چرخش تصویر (Screen Orientation)
              </label>
              <select
                value={customConfig.orientation}
                onChange={(e) =>
                  setCustomConfig({
                    ...customConfig,
                    orientation: e.target.value as 'sensor' | 'landscape' | 'portrait',
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="sensor">Auto Sensor (چرخش خودکار گوشی و تبلت)</option>
                <option value="landscape">Landscape (افقی - مناسب تبلت و بازی)</option>
                <option value="portrait">Portrait (عمودی - مناسب کار با یک دست)</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                آدرس سرور استودیو (Server / Cloud Endpoint URL)
              </label>
              <input
                type="url"
                value={customConfig.serverUrl}
                onChange={(e) => setCustomConfig({ ...customConfig, serverUrl: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Hardware Capabilities Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={customConfig.enableHaptics}
                onChange={(e) =>
                  setCustomConfig({ ...customConfig, enableHaptics: e.target.checked })
                }
                className="accent-amber-400 w-4 h-4"
              />
              <span>لرزش لمسی (Haptics)</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={customConfig.enableStylus}
                onChange={(e) =>
                  setCustomConfig({ ...customConfig, enableStylus: e.target.checked })
                }
                className="accent-amber-400 w-4 h-4"
              />
              <span>پشتیبانی قلم (S-Pen)</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={customConfig.fullscreen}
                onChange={(e) =>
                  setCustomConfig({ ...customConfig, fullscreen: e.target.checked })
                }
                className="accent-amber-400 w-4 h-4"
              />
              <span>تمام‌صفحه (Immersive)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isBuildingApk}
            className="w-full py-3.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all min-h-[48px]"
          >
            <Download className="w-4 h-4" />
            <span>
              {isBuildingApk
                ? 'در حال کامپایل و امضای پکیج اندروید...'
                : 'ساخت و دانلود فایل APK با تنظیمات بالا'}
            </span>
          </button>
        </form>

        {/* Right 5 Columns: Live Mobile & Tablet Viewport Simulator & Touch Tools */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="border border-slate-800 rounded-2xl p-6 bg-[#141820] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Monitor className="w-4 h-4 text-amber-400" />
                <span>پیش‌نمایش زنده ابعاد گوشی و تبلت</span>
              </h2>
              <span className="text-xs font-mono text-amber-400 uppercase">
                {devicePreviewMode}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed" dir="rtl">
              برای تست نحوه نمایش و عملکرد لمسی استودیو در ابعاد گوشی اندروید یا تبلت ۱۰.۵ اینچی، حالت نمایش محیط کاری را تغییر دهید:
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setDevicePreviewMode('auto')}
                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all min-h-[68px] justify-center ${
                  devicePreviewMode === 'auto'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>تمام‌صفحه خودکار</span>
              </button>

              <button
                onClick={() => setDevicePreviewMode('phone')}
                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all min-h-[68px] justify-center ${
                  devicePreviewMode === 'phone'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>گوشی اندروید</span>
              </button>

              <button
                onClick={() => setDevicePreviewMode('tablet')}
                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all min-h-[68px] justify-center ${
                  devicePreviewMode === 'tablet'
                    ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <Tablet className="w-4 h-4" />
                <span>تبلت اندروید</span>
              </button>
            </div>
          </div>

          {/* Quick Jump to Touch-Optimized Studio Modules */}
          <div className="border border-slate-800 rounded-2xl p-6 bg-[#141820] space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>بخش‌های بهینه‌شده برای لمس و قلم اندروید</span>
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => onNavigateTab('physics')}
                className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 flex items-center justify-between text-xs transition-colors"
              >
                <span className="flex items-center gap-2.5 font-semibold text-white">
                  <Gamepad2 className="w-4 h-4 text-amber-400" />
                  <span>Action Arena (با گیم‌پد لمسی اندروید و ویبره)</span>
                </span>
                <span className="text-amber-400 font-mono">60 FPS →</span>
              </button>

              <button
                onClick={() => onNavigateTab('generator')}
                className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 flex items-center justify-between text-xs transition-colors"
              >
                <span className="flex items-center gap-2.5 font-semibold text-white">
                  <PenTool className="w-4 h-4 text-emerald-400" />
                  <span>Asset Studio & Painting Canvas (قلم و لمس)</span>
                </span>
                <span className="text-emerald-400 font-mono">Open →</span>
              </button>

              <button
                onClick={() => onNavigateTab('slicer')}
                className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 flex items-center justify-between text-xs transition-colors"
              >
                <span className="flex items-center gap-2.5 font-semibold text-white">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>Sprite Slicer (آپلود از گالری گوشی/تبلت)</span>
                </span>
                <span className="text-sky-400 font-mono">Slice →</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
