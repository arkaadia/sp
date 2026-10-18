import React, { useState } from 'react';
import {
  Download,
  Terminal,
  Copy,
  Check,
  BookOpen,
  Code,
  FileText,
  ExternalLink,
  ShieldCheck,
  Package
} from 'lucide-react';
import { downloadGitHubRepoZip } from '../utils/repoExporter';

export const GithubGuideView: React.FC = () => {
  const [activeDocTab, setActiveDocTab] = useState<'rules' | 'install'>('rules');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isExportingRepo, setIsExportingRepo] = useState<boolean>(false);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownloadRepo = async () => {
    setIsExportingRepo(true);
    try {
      await downloadGitHubRepoZip();
    } catch (err) {
      console.error('Error generating repo ZIP:', err);
    } finally {
      setIsExportingRepo(false);
    }
  };

  const installSteps = [
    {
      title: '⚡ 1-Command Automated Linux Installer (Ubuntu / Debian)',
      desc: 'Deploy the complete production service with systemd daemon, auto-restart, and global CLI:',
      code: 'git clone https://github.com/arkaadia/sp.git\ncd sp\nsudo bash install.sh',
    },
    {
      title: '🛠️ Production CLI Service Control',
      desc: 'Manage the background service anytime using the global sprite-studio command:',
      code: 'sprite-studio status    # Check service and port\nsprite-studio logs -f   # Stream real-time logs\nsprite-studio restart   # Restart production service\nsprite-studio update    # Pull git updates & rebuild',
    },
    {
      title: '1. Manual Git Clone (Development)',
      desc: 'Clone the repository to your local computer using Git:',
      code: 'git clone https://github.com/arkaadia/sp.git\ncd sp',
    },
    {
      title: '2. Install Dependencies from Lockfile',
      desc: 'Reproducibly install packages using Bun or npm:',
      code: 'bun install --frozen-lockfile\n# or\nnpm install',
    },
    {
      title: '3. Start Local Development Server',
      desc: 'Run the Vite dev server with TypeScript hot-reloading:',
      code: 'npm run dev',
    },
    {
      title: '4. Production Build & Optimization',
      desc: 'Compile production-grade static assets and bundle for web hosting:',
      code: 'npm run build\nnpm start',
    },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Banner */}
      <div className="border border-slate-800 rounded-2xl p-6 bg-gradient-to-br from-slate-900 to-[#141822] space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Package className="w-6 h-6 text-amber-400" />
              <span>GitHub Export & Setup Center</span>
            </h1>
            <p className="text-xs text-slate-400">
              Download the complete source code, review animation standards, and follow setup steps.
            </p>
          </div>

          <button
            onClick={handleDownloadRepo}
            disabled={isExportingRepo}
            className="px-5 py-3 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-400/10 transition-all whitespace-nowrap self-start md:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingRepo ? 'Bundling Source...' : 'Download Full GitHub Repo (.ZIP)'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
          <span className="flex items-center gap-1.5 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Apache 2.0 Open Source</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>Node 18+ / React 19 / Vite 8</span>
          <span aria-hidden="true">·</span>
          <span>Full-Stack Ready (Express + TSX)</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-400 font-mono">SPRITE_RULES.md Included</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveDocTab('rules')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeDocTab === 'rules'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Rules & Architecture (SPRITE_RULES.md)</span>
        </button>

        <button
          onClick={() => setActiveDocTab('install')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeDocTab === 'install'
              ? 'bg-amber-400 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Installation & CLI Guide</span>
        </button>
      </div>

      {/* Tab 1: SPRITE_RULES.md Content */}
      {activeDocTab === 'rules' && (
        <div className="space-y-6">
          <div className="border border-slate-800 rounded-xl p-6 bg-slate-900/60 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>SPRITE_RULES.md · Standard Conventions</span>
              </h2>
              <span className="text-xs font-mono text-slate-400">Fixed Pipeline Rules</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              These guidelines define character resolution, timing curves, ground anchor points,
              and naming structures. Keeping these rules uniform ensures exported tilesets plug directly
              into Godot, Unity, or Phaser without needing manual offset recalculations.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                  1. Timing & Framerates
                </h3>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• <strong>Idle</strong>: 8 Frames @ 8 FPS (Loop)</li>
                  <li>• <strong>Run</strong>: 8 Frames @ 11 FPS (Loop)</li>
                  <li>• <strong>Jump</strong>: 8 Frames @ 9 FPS (Once)</li>
                  <li>• <strong>Melee</strong>: 6-8 Frames @ 14 FPS</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                  2. Grid Matrix Standards
                </h3>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• <strong>Layout</strong>: 8 Columns × 3 Rows</li>
                  <li>• <strong>Cell Sizes</strong>: 128px, 256px, 320px</li>
                  <li>• <strong>Row 1</strong>: Idle</li>
                  <li>• <strong>Row 2</strong>: Run</li>
                  <li>• <strong>Row 3</strong>: Jump</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                  3. Ground Pivot Line
                </h3>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• <strong>Pivot X</strong>: 0.5 (Center)</li>
                  <li>• <strong>Pivot Y</strong>: 0.9 (Feet level)</li>
                  <li>• Prevents foot sliding & jittering</li>
                  <li>• Cross-engine standard coordinate</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl p-6 bg-slate-900/60 space-y-3">
            <h3 className="text-sm font-bold text-white">Asset Naming Architecture</h3>
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto">
{`# Standard Production Output Tree:
assets/
  ├── elysian_rogue_tileset_8x3_256.png   # Master 24-frame PNG tileset (transparent)
  ├── elysian_rogue_idle_strip.png        # 8x1 horizontal strip
  ├── elysian_rogue_run_strip.png         # 8x1 horizontal strip
  ├── elysian_rogue_jump_strip.png        # 8x1 horizontal strip
  ├── phaser3_atlas.json                  # TexturePacker JSON
  ├── godot_spriteframes.json             # Godot 4 Animation spec
  └── unity_spritesheet.meta.json         # Unity Multi-Sprite metadata`}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 2: Installation CLI Steps */}
      {activeDocTab === 'install' && (
        <div className="space-y-4">
          {installSteps.map((step, idx) => (
            <div
              key={idx}
              className="border border-slate-800 rounded-xl p-5 bg-slate-900/60 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                <button
                  onClick={() => copyToClipboard(step.code, idx)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-400">{step.desc}</p>

              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-amber-300 overflow-x-auto">
                {step.code}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
