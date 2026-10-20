import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Zap,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Grid,
  Check,
  Download,
  FileJson,
  Upload,
  ArrowRight,
  Layers,
  Sliders,
  ChevronRight,
  User,
  Film,
  Eye,
  RefreshCw,
  Info,
  Maximize2,
} from 'lucide-react';
import {
  CharacterPack,
  MotionTemplate,
  RetargetingResult,
  AnimationAction,
} from '../types/sprites';
import {
  DEFAULT_MOTION_TEMPLATES,
} from '../data/defaultMotionTemplates';
import {
  extractTemplatePoses,
  generateRetargetedSheet,
  TemplateExtractionResult,
} from '../utils/retargetingEngine';
import { get10FrameAttackSheetUrl, TEMPLATE_ATTACK_10_FRAME } from '../utils/motion10FrameGenerator';

interface MotionRetargetingViewProps {
  currentPack: CharacterPack;
  packList: CharacterPack[];
  onApplyRetargetedAction: (actionKey: string, actionDef: AnimationAction) => void;
  onSendToSlicer: (imageUrl: string) => void;
  onNavigateToStudio: () => void;
  removeBg: boolean;
  bgTolerance: number;
  bgSmoothness: number;
}

export const MotionRetargetingView: React.FC<MotionRetargetingViewProps> = ({
  currentPack,
  packList,
  onApplyRetargetedAction,
  onSendToSlicer,
  onNavigateToStudio,
  removeBg: initialRemoveBg,
  bgTolerance: initialTolerance,
  bgSmoothness: initialSmoothness,
}) => {
  // -------------------------------------------------------------
  // 1. INPUT A: CHARACTER DESIGN STATE
  // -------------------------------------------------------------
  const [characterMode, setCharacterMode] = useState<'pack' | 'upload'>('pack');
  const [selectedPackId, setSelectedPackId] = useState<string>(currentPack.id);
  const [selectedSourceAction, setSelectedSourceAction] = useState<string>('idle');
  const [uploadedCharacterImage, setUploadedCharacterImage] = useState<string | null>(null);
  const [uploadedCharacterName, setUploadedCharacterName] = useState<string>('Custom Character');
  const customCharInputRef = useRef<HTMLInputElement | null>(null);

  // -------------------------------------------------------------
  // 2. INPUT B: MOTION TEMPLATE STATE
  // -------------------------------------------------------------
  // Default to the custom 10-frame Attack animation requested
  const [allTemplates, setAllTemplates] = useState<MotionTemplate[]>(() => {
    // Ensure 10-frame attack is at the top
    const list = [...DEFAULT_MOTION_TEMPLATES];
    if (!list.some((t) => t.id === 'template_attack_10f')) {
      list.unshift(TEMPLATE_ATTACK_10_FRAME);
    }
    return list;
  });

  const [selectedTemplate, setSelectedTemplate] = useState<MotionTemplate>(() => {
    return allTemplates.find((t) => t.id === 'template_attack_10f') || allTemplates[0];
  });

  // Template Preview / Pose Extraction
  const [templateExtraction, setTemplateExtraction] = useState<TemplateExtractionResult | null>(null);
  const [isExtractingTemplate, setIsExtractingTemplate] = useState<boolean>(false);
  const [templatePreviewIdx, setTemplatePreviewIdx] = useState<number>(0);
  const [isPlayingTemplate, setIsPlayingTemplate] = useState<boolean>(true);
  const templateTimerRef = useRef<number | null>(null);

  // -------------------------------------------------------------
  // 3. EXECUTION & DATA MAPPING SETTINGS
  // -------------------------------------------------------------
  const [customActionName, setCustomActionName] = useState<string>('');
  const [removeBg, setRemoveBg] = useState<boolean>(initialRemoveBg);
  const [bgTolerance, setBgTolerance] = useState<number>(initialTolerance);
  const [bgSmoothness, setBgSmoothness] = useState<number>(initialSmoothness);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // -------------------------------------------------------------
  // 4. OUTPUT / RESULT PANEL STATE
  // -------------------------------------------------------------
  const [retargetResult, setRetargetResult] = useState<RetargetingResult | null>(null);
  const [resultFrameIdx, setResultFrameIdx] = useState<number>(0);
  const [isPlayingResult, setIsPlayingResult] = useState<boolean>(true);
  const [resultFps, setResultFps] = useState<number>(12);
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(true);
  const [showOnionSkin, setShowOnionSkin] = useState<boolean>(false);
  const [resultBg, setResultBg] = useState<'checker' | 'dark' | 'black'>('checker');
  const resultTimerRef = useRef<number | null>(null);

  // Keep action name updated when template changes
  useEffect(() => {
    const defaultName = `${selectedTemplate.name.replace(/[^a-zA-Z0-9 ]/g, '')} Retargeted`;
    setCustomActionName(defaultName);
  }, [selectedTemplate]);

  // Extract template poses for Input B preview
  useEffect(() => {
    let active = true;
    async function loadPoses() {
      setIsExtractingTemplate(true);
      try {
        const res = await extractTemplatePoses(selectedTemplate, {
          removeBg,
          bgTolerance,
          bgSmoothness,
        });
        if (active) {
          setTemplateExtraction(res);
          setTemplatePreviewIdx(0);
        }
      } catch (err) {
        console.error('Failed to extract template poses:', err);
      } finally {
        if (active) setIsExtractingTemplate(false);
      }
    }
    loadPoses();
    return () => {
      active = false;
    };
  }, [selectedTemplate, removeBg, bgTolerance, bgSmoothness]);

  // Animation loop for Input B Motion Template preview
  useEffect(() => {
    if (!isPlayingTemplate || !templateExtraction || templateExtraction.poses.length === 0) {
      if (templateTimerRef.current) clearInterval(templateTimerRef.current);
      return;
    }
    const interval = Math.max(30, Math.round(1000 / (selectedTemplate.fps || 12)));
    templateTimerRef.current = window.setInterval(() => {
      setTemplatePreviewIdx((prev) => (prev + 1) % templateExtraction.poses.length);
    }, interval);

    return () => {
      if (templateTimerRef.current) clearInterval(templateTimerRef.current);
    };
  }, [isPlayingTemplate, templateExtraction, selectedTemplate.fps]);

  // Animation loop for Result Panel output player
  useEffect(() => {
    if (!isPlayingResult || !retargetResult || retargetResult.frames.length === 0) {
      if (resultTimerRef.current) clearInterval(resultTimerRef.current);
      return;
    }
    const totalFrames = retargetResult.totalFrames;
    const interval = Math.max(25, Math.round(1000 / resultFps));
    resultTimerRef.current = window.setInterval(() => {
      setResultFrameIdx((prev) => (prev + 1) % totalFrames);
    }, interval);

    return () => {
      if (resultTimerRef.current) clearInterval(resultTimerRef.current);
    };
  }, [isPlayingResult, retargetResult, resultFps]);

  // Sync result FPS when result is produced
  useEffect(() => {
    if (retargetResult) {
      setResultFps(retargetResult.actionDef.fps || 12);
      setResultFrameIdx(0);
      setIsPlayingResult(true);
    }
  }, [retargetResult]);

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------
  const selectedPack = packList.find((p) => p.id === selectedPackId) || currentPack;

  const handleCustomCharacterUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setUploadedCharacterImage(e.target.result as string);
        const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setUploadedCharacterName(name || 'Uploaded Character');
        setCharacterMode('upload');
      }
    };
    reader.readAsDataURL(file);
  };

  // CORE DATA MAPPING & EXECUTION
  const handleApplyMotionToCharacter = async () => {
    setIsExecuting(true);
    setExecutionError(null);
    setSuccessNotice(null);

    try {
      // 1. Read exact metadata of selected Motion Template
      const templateTotalFrames = selectedTemplate.totalFrames;
      const templateCols = selectedTemplate.cols;
      const templateRows = selectedTemplate.rows;

      console.log(
        `[MotionRetargeting] Applying Motion Template "${selectedTemplate.name}" -> Metadata: ${templateTotalFrames} frames (${templateCols} cols x ${templateRows} rows)`
      );

      // 2. Map custom character strictly following sequence and frame count
      const result = await generateRetargetedSheet(selectedTemplate, selectedPack, {
        customActionName: customActionName.trim() || selectedTemplate.name,
        removeBg,
        bgTolerance,
        bgSmoothness,
        customCharacterImage: characterMode === 'upload' ? uploadedCharacterImage || undefined : undefined,
        customCharacterName: characterMode === 'upload' ? uploadedCharacterName : selectedPack.name,
        sourceActionKey: characterMode === 'pack' ? selectedSourceAction : undefined,
      });

      // 3. Store Result & notify
      setRetargetResult(result);
      setSuccessNotice(
        `Retargeting complete: Generated exactly ${result.totalFrames} frames in a ${result.cols}×${result.rows} unified sprite sheet!`
      );
    } catch (err: any) {
      console.error('Retargeting execution failed:', err);
      setExecutionError(err?.message || 'Failed to apply motion to character.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Save to active character pack
  const handleApplyToActivePack = () => {
    if (!retargetResult) return;
    onApplyRetargetedAction(retargetResult.actionDef.action, retargetResult.actionDef);
    onNavigateToStudio();
  };

  // Download Output PNG
  const handleDownloadSheet = () => {
    if (!retargetResult) return;
    const a = document.createElement('a');
    a.href = retargetResult.sheetDataUrl;
    a.download = `${retargetResult.targetCharacterName.toLowerCase().replace(/\s+/g, '_')}_${retargetResult.actionDef.action}_${retargetResult.cols}x${retargetResult.rows}_${retargetResult.totalFrames}F.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Export JSON Metadata
  const handleExportJson = () => {
    if (!retargetResult) return;
    const metadata = {
      engine: 'Elysian Sprite Studio - Motion Retargeting Bridge',
      targetCharacter: retargetResult.targetCharacterName,
      templateName: retargetResult.templateName,
      templateId: retargetResult.templateId,
      grid: {
        cols: retargetResult.cols,
        rows: retargetResult.rows,
        totalFrames: retargetResult.totalFrames,
        cellWidth: retargetResult.cellWidth,
        cellHeight: retargetResult.cellHeight,
        sheetWidth: retargetResult.totalWidth,
        sheetHeight: retargetResult.totalHeight,
      },
      action: retargetResult.actionDef.action,
      fps: retargetResult.actionDef.fps,
      loop: retargetResult.actionDef.loop,
      frames: retargetResult.frames.map((f) => ({
        frameIndex: f.index,
        label: f.label,
        phase: f.phaseLabel,
        coordinates: {
          x: f.sx,
          y: f.sy,
          width: f.sw,
          height: f.sh,
        },
      })),
      timestamp: retargetResult.createdAt,
    };

    const blob = new Blob([JSON.stringify(metadata, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${retargetResult.actionDef.action}_metadata.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* ------------------------------------------------------------- */}
      {/* 1. SECTION HEADER */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded bg-amber-400 rotate-45 inline-block shadow-sm shadow-amber-400/30" />
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Motion Retargeting
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">
                Kinematic Bridge
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Apply motion kinematics from any library template onto your custom character design.
            The output strictly preserves the template&apos;s exact frame count, grid dimensions, and motion timing.
          </p>
        </div>

        {/* Quick stats badge */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="text-slate-300">Target Grid:</span>
          <span className="text-amber-400 font-bold">{selectedTemplate.cols}×{selectedTemplate.rows}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-300">Frames:</span>
          <span className="text-amber-400 font-bold">{selectedTemplate.totalFrames} Total</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. INPUT SELECTION WORKFLOW (Input A & Input B) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================= */}
        {/* INPUT A: CHARACTER DESIGN */}
        {/* ========================================================= */}
        <div className="border border-slate-800 rounded-2xl bg-slate-900/70 p-6 flex flex-col justify-between space-y-5 shadow-lg">
          <div className="space-y-4">
            {/* Header & Source Mode Switcher */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-xs">
                  A
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Input A: Character Design
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    Select character pack or upload custom artwork
                  </span>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px]">
                <button
                  onClick={() => setCharacterMode('pack')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    characterMode === 'pack'
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Character Pack
                </button>
                <button
                  onClick={() => setCharacterMode('upload')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    characterMode === 'upload'
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Upload Custom
                </button>
              </div>
            </div>

            {/* Mode A: Select from Character Pack */}
            {characterMode === 'pack' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {packList.map((pack) => {
                    const isSelected = selectedPackId === pack.id;
                    const primaryAction = pack.actions['idle'] || Object.values(pack.actions)[0];
                    return (
                      <button
                        key={pack.id}
                        onClick={() => setSelectedPackId(pack.id)}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          isSelected
                            ? 'bg-sky-500/10 border-sky-500/60 ring-1 ring-sky-500/40 shadow'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center relative">
                          {primaryAction?.sheetUrl ? (
                            <img
                              src={primaryAction.sheetUrl}
                              alt={pack.name}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <User className="w-6 h-6 text-slate-500" />
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <span className="block text-xs font-bold text-white truncate">
                            {pack.name}
                          </span>
                          <span className="block text-[10px] text-slate-400 truncate">
                            {pack.shortDesc || 'Custom Character Design'}
                          </span>
                          <span className="inline-block mt-0.5 text-[9px] font-mono text-sky-400">
                            {Object.keys(pack.actions).length} actions available
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Stance / Action selector */}
                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Base Visual Stance:</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(selectedPack.actions).map((actKey) => (
                      <button
                        key={actKey}
                        onClick={() => setSelectedSourceAction(actKey)}
                        className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors ${
                          selectedSourceAction === actKey
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {actKey}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Mode B: Upload Custom Character */
              <div className="space-y-3">
                <input
                  type="file"
                  ref={customCharInputRef}
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleCustomCharacterUpload(e.target.files[0]);
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => customCharInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-sky-400 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-950/60 transition-all group"
                >
                  <Upload className="w-7 h-7 text-sky-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-semibold text-white">
                    Click to upload custom character PNG/JPG
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Single character illustration, avatar, or custom sheet
                  </span>
                </div>

                {uploadedCharacterImage && (
                  <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <img
                      src={uploadedCharacterImage}
                      alt="Uploaded Character"
                      className="w-12 h-12 object-contain rounded bg-slate-900 border border-slate-800"
                    />
                    <div className="flex-1">
                      <input
                        type="text"
                        value={uploadedCharacterName}
                        onChange={(e) => setUploadedCharacterName(e.target.value)}
                        placeholder="Character Name"
                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs px-2.5 py-1 rounded focus:outline-none focus:border-sky-400 font-medium"
                      />
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1 font-mono">
                        <Check className="w-3 h-3" /> Custom Character Loaded
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Character Summary Preview Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
              <div>
                <span className="text-slate-400 text-[11px]">Target Character:</span>
                <span className="block font-bold text-white">
                  {characterMode === 'upload' ? uploadedCharacterName : selectedPack.name}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
              {characterMode === 'upload' ? 'Custom Artwork' : `Source: ${selectedSourceAction.toUpperCase()}`}
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* INPUT B: MOTION TEMPLATE */}
        {/* ========================================================= */}
        <div className="border border-slate-800 rounded-2xl bg-slate-900/70 p-6 flex flex-col justify-between space-y-5 shadow-lg">
          <div className="space-y-4">
            {/* Header & Template count */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                  B
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Input B: Motion Template
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    Pick a kinematic sample from Motion Library
                  </span>
                </div>
              </div>

              <span className="text-[11px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                {selectedTemplate.totalFrames} Frames ({selectedTemplate.cols}×{selectedTemplate.rows})
              </span>
            </div>

            {/* Template Card Carousel / Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {allTemplates.map((template) => {
                const isSelected = selectedTemplate.id === template.id;
                const isTenFrame = template.totalFrames === 10;
                return (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all relative ${
                      isSelected
                        ? 'bg-amber-400/10 border-amber-400/60 ring-1 ring-amber-400/40 shadow'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {isTenFrame && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow">
                        10-Frame Sample
                      </span>
                    )}

                    <div className="w-10 h-10 rounded bg-slate-900 border border-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                      <Film className={`w-5 h-5 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                    </div>

                    <div className="overflow-hidden">
                      <span className="block text-xs font-bold text-white truncate">
                        {template.name}
                      </span>
                      <span className="block text-[10px] text-slate-400 truncate">
                        {template.description || `${template.totalFrames} frame motion`}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 font-mono text-[9px]">
                        <span className="text-amber-400 font-semibold">{template.totalFrames}F</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-300">{template.cols}×{template.rows}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-400">{template.fps || 12} FPS</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Template Motion Visualizer & Kinematic Breakdown */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  Motion Preview ({selectedTemplate.totalFrames} Frames)
                </span>
                <button
                  onClick={() => setIsPlayingTemplate(!isPlayingTemplate)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] flex items-center gap-1 font-medium transition-colors"
                >
                  {isPlayingTemplate ? (
                    <>
                      <Pause className="w-3 h-3 text-amber-400" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 text-emerald-400" /> Play
                    </>
                  )}
                </button>
              </div>

              {/* Sequential Pose Filmstrip */}
              {isExtractingTemplate ? (
                <div className="h-16 flex items-center justify-center text-xs text-slate-400">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-spin mr-2" />
                  Reading template frames...
                </div>
              ) : templateExtraction && templateExtraction.poses.length > 0 ? (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {templateExtraction.poses.map((pose, idx) => {
                    const isActive = templatePreviewIdx === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setTemplatePreviewIdx(idx);
                          setIsPlayingTemplate(false);
                        }}
                        className={`shrink-0 w-12 h-16 rounded border flex flex-col items-center justify-between p-1 transition-all ${
                          isActive
                            ? 'bg-amber-400/20 border-amber-400 ring-1 ring-amber-400/40'
                            : 'bg-slate-900 border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={pose.dataUrl}
                          alt={pose.label}
                          className="w-full h-10 object-contain"
                        />
                        <span className="font-mono text-[8px] text-amber-300">
                          #{idx + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {/* Active Template Metadata Badge */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <div>
                <span className="text-slate-400 text-[11px]">Selected Motion:</span>
                <span className="block font-bold text-white">{selectedTemplate.name}</span>
              </div>
            </div>
            <div className="text-right font-mono text-[11px]">
              <span className="text-amber-400 font-bold">{selectedTemplate.totalFrames} Frames</span>
              <span className="text-slate-400 block text-[10px]">Grid: {selectedTemplate.cols}×{selectedTemplate.rows}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. DATA MAPPING & EXECUTION BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="border border-amber-500/30 rounded-2xl bg-amber-500/5 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                Data Mapping & Retargeting Synthesis
              </h3>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              When triggered, the system reads the exact metadata of{' '}
              <span className="text-amber-300 font-bold">{selectedTemplate.name}</span> (
              <span className="font-mono font-bold text-amber-400">{selectedTemplate.totalFrames} total frames</span> in a{' '}
              <span className="font-mono text-amber-400">{selectedTemplate.cols}×{selectedTemplate.rows}</span> grid).
              The custom character will be processed to strictly match this sequence and frame count.
            </p>
          </div>

          {/* Execution Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={customActionName}
              onChange={(e) => setCustomActionName(e.target.value)}
              placeholder="Action Name (e.g. 10F Attack)"
              className="bg-slate-900 border border-slate-700 text-white text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:border-amber-400 font-medium min-w-[200px]"
            />

            <button
              onClick={handleApplyMotionToCharacter}
              disabled={isExecuting}
              className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 text-slate-950 disabled:text-slate-400 font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg hover:shadow-amber-400/20 active:scale-[0.98] transition-all flex items-center gap-2 whitespace-nowrap"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing {selectedTemplate.totalFrames} Frames...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Apply Motion to Character</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Chroma Background Removal Configuration */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={removeBg}
              onChange={(e) => setRemoveBg(e.target.checked)}
              className="rounded accent-amber-400"
            />
            <span className="font-medium">Remove Background (Alpha PNG-32)</span>
          </label>

          {removeBg && (
            <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <span>Tolerance:</span>
                <input
                  type="range"
                  min="10"
                  max="80"
                  value={bgTolerance}
                  onChange={(e) => setBgTolerance(parseInt(e.target.value, 10))}
                  className="w-16 accent-amber-400"
                />
                <span className="text-amber-400">{bgTolerance}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Feather:</span>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={bgSmoothness}
                  onChange={(e) => setBgSmoothness(parseInt(e.target.value, 10))}
                  className="w-16 accent-amber-400"
                />
                <span className="text-amber-400">{bgSmoothness}</span>
              </div>
            </div>
          )}
        </div>

        {/* Notices */}
        {executionError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
            {executionError}
          </div>
        )}
        {successNotice && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successNotice}</span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. RESULT PANEL (OUTPUT GENERATION) */}
      {/* ------------------------------------------------------------- */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/80 p-6 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 rotate-45 inline-block" />
              <h2 className="text-base font-bold text-white tracking-wide">
                Result Panel: Unified Sprite Sheet & Animation Preview
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strictly rendered using the exact frame count and timing derived from the selected Motion Template.
            </p>
          </div>

          {/* Action triggers */}
          {retargetResult && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleApplyToActivePack}
                className="px-3.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow"
              >
                <span>Apply to Studio Player</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleDownloadSheet}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </button>

              <button
                onClick={handleExportJson}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-all flex items-center gap-1.5 border border-slate-700"
              >
                <FileJson className="w-3.5 h-3.5 text-amber-400" />
                <span>Export JSON</span>
              </button>

              <button
                onClick={() => onSendToSlicer(retargetResult.sheetDataUrl)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-all flex items-center gap-1.5 border border-slate-700"
              >
                <Grid className="w-3.5 h-3.5 text-sky-400" />
                <span>Send to Slicer</span>
              </button>
            </div>
          )}
        </div>

        {/* Result Content */}
        {!retargetResult ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/40">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Zap className="w-6 h-6 text-amber-400/60" />
            </div>
            <div className="max-w-md">
              <span className="text-sm font-semibold text-slate-200 block">
                No Retargeted Output Generated Yet
              </span>
              <p className="text-xs text-slate-400 mt-1">
                Configure Character Design (Input A) and Motion Template (Input B) above, then click{' '}
                <strong className="text-amber-300">Apply Motion to Character</strong> to synthesize the unified sprite sheet.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 1. Animation Preview Player (lg:col-span-5) */}
            <div className="lg:col-span-5 border border-slate-800 rounded-xl bg-slate-950 p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                {/* Viewport Top Bar */}
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-white truncate">
                      {retargetResult.targetCharacterName}
                    </span>
                  </div>
                  <span className="font-mono text-amber-400 text-[11px]">
                    Frame {resultFrameIdx + 1} / {retargetResult.totalFrames}
                  </span>
                </div>

                {/* Viewport Canvas Frame */}
                <div
                  className={`w-full aspect-[3/4] max-h-[360px] rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden relative ${
                    resultBg === 'checker' ? 'canvas-checkerboard bg-slate-900/60' : resultBg === 'black' ? 'bg-black' : 'bg-[#141820]'
                  }`}
                >
                  {/* Onion Skin Ghost */}
                  {showOnionSkin && retargetResult.frames.length > 1 && (
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25"
                    >
                      {(() => {
                        const ghostIdx = (resultFrameIdx - 1 + retargetResult.totalFrames) % retargetResult.totalFrames;
                        const ghostFrame = retargetResult.frames[ghostIdx];
                        return (
                          <div
                            style={{
                              backgroundImage: `url(${retargetResult.sheetDataUrl})`,
                              backgroundPosition: `-${ghostFrame.sx}px -${ghostFrame.sy}px`,
                              backgroundSize: `${retargetResult.totalWidth}px ${retargetResult.totalHeight}px`,
                              width: `${retargetResult.cellWidth}px`,
                              height: `${retargetResult.cellHeight}px`,
                              transform: `scale(${340 / retargetResult.cellHeight})`,
                            }}
                          />
                        );
                      })()}
                    </div>
                  )}

                  {/* Active Frame */}
                  {retargetResult.frames[resultFrameIdx] && (
                    <div
                      style={{
                        backgroundImage: `url(${retargetResult.sheetDataUrl})`,
                        backgroundPosition: `-${retargetResult.frames[resultFrameIdx].sx}px -${retargetResult.frames[resultFrameIdx].sy}px`,
                        backgroundSize: `${retargetResult.totalWidth}px ${retargetResult.totalHeight}px`,
                        width: `${retargetResult.cellWidth}px`,
                        height: `${retargetResult.cellHeight}px`,
                        transform: `scale(${340 / retargetResult.cellHeight})`,
                      }}
                      className="transition-transform duration-75"
                    />
                  )}

                  {/* Phase Label Floating Tag */}
                  <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded text-[10px] font-mono text-amber-300 border border-slate-800">
                    {retargetResult.frames[resultFrameIdx]?.phaseLabel || `Phase ${resultFrameIdx + 1}`}
                  </div>
                </div>

                {/* Player Controls */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setIsPlayingResult(false);
                          setResultFrameIdx((prev) => (prev - 1 + retargetResult.totalFrames) % retargetResult.totalFrames);
                        }}
                        className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300"
                        title="Previous Frame"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setIsPlayingResult(!isPlayingResult)}
                        className="px-3.5 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow"
                      >
                        {isPlayingResult ? (
                          <>
                            <Pause className="w-3.5 h-3.5" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" /> Play
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setIsPlayingResult(false);
                          setResultFrameIdx((prev) => (prev + 1) % retargetResult.totalFrames);
                        }}
                        className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300"
                        title="Next Frame"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Speed Slider */}
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                      <span>FPS:</span>
                      <input
                        type="range"
                        min="4"
                        max="24"
                        value={resultFps}
                        onChange={(e) => setResultFps(parseInt(e.target.value, 10))}
                        className="w-16 accent-amber-400"
                      />
                      <span className="text-amber-400 w-6 text-right">{resultFps}</span>
                    </div>
                  </div>

                  {/* Scrubber */}
                  <input
                    type="range"
                    min="0"
                    max={retargetResult.totalFrames - 1}
                    value={resultFrameIdx}
                    onChange={(e) => {
                      setIsPlayingResult(false);
                      setResultFrameIdx(parseInt(e.target.value, 10));
                    }}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Viewport Toggles */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowOnionSkin(!showOnionSkin)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                    showOnionSkin ? 'bg-amber-400/20 text-amber-300 font-semibold' : 'hover:text-white'
                  }`}
                >
                  <Layers className="w-3 h-3" /> Onion Skin
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setResultBg('checker')}
                    className={`px-1.5 py-0.5 rounded ${resultBg === 'checker' ? 'bg-slate-800 text-white font-bold' : ''}`}
                  >
                    Alpha
                  </button>
                  <button
                    onClick={() => setResultBg('dark')}
                    className={`px-1.5 py-0.5 rounded ${resultBg === 'dark' ? 'bg-slate-800 text-white font-bold' : ''}`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setResultBg('black')}
                    className={`px-1.5 py-0.5 rounded ${resultBg === 'black' ? 'bg-slate-800 text-white font-bold' : ''}`}
                  >
                    Black
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Unified Master Sprite Sheet Matrix (lg:col-span-7) */}
            <div className="lg:col-span-7 border border-slate-800 rounded-xl bg-slate-950 p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Grid className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white">
                      Unified Sprite Sheet ({retargetResult.cols} Cols × {retargetResult.rows} Rows)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowGridOverlay(!showGridOverlay)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                        showGridOverlay
                          ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                          : 'border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Grid Overlay
                    </button>
                    <span className="font-mono text-slate-400 text-[11px]">
                      {retargetResult.totalWidth}×{retargetResult.totalHeight} px
                    </span>
                  </div>
                </div>

                {/* Master Canvas with Interactive Grid Overlay */}
                <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-[#090b0e] p-2 max-h-[380px] flex items-center justify-center">
                  <div className="relative inline-block">
                    <img
                      src={retargetResult.sheetDataUrl}
                      alt="Unified Retargeted Sprite Sheet"
                      className="max-h-[360px] object-contain rounded"
                    />

                    {/* Grid Overlay Lines & Cell Indicators */}
                    {showGridOverlay && (
                      <div className="absolute inset-0 pointer-events-none grid"
                        style={{
                          gridTemplateColumns: `repeat(${retargetResult.cols}, 1fr)`,
                          gridTemplateRows: `repeat(${retargetResult.rows}, 1fr)`,
                        }}
                      >
                        {Array.from({ length: retargetResult.cols * retargetResult.rows }).map((_, cellIdx) => {
                          const isOccupied = cellIdx < retargetResult.totalFrames;
                          const isCurrentActive = resultFrameIdx === cellIdx;
                          return (
                            <div
                              key={cellIdx}
                              className={`border ${
                                isCurrentActive
                                  ? 'border-amber-400 bg-amber-400/20 ring-2 ring-amber-400/50'
                                  : isOccupied
                                  ? 'border-amber-500/30 bg-transparent'
                                  : 'border-slate-800/40 bg-black/40'
                              } relative flex items-start justify-start p-1`}
                            >
                              {isOccupied && (
                                <span className={`text-[9px] font-mono font-bold px-1 rounded ${
                                  isCurrentActive ? 'bg-amber-400 text-slate-950' : 'bg-black/70 text-slate-300'
                                }`}>
                                  #{cellIdx + 1}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Master Sheet Metadata Footer */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                <span className="font-mono">
                  {retargetResult.totalFrames} Total Frames · Cell: {retargetResult.cellWidth}×{retargetResult.cellHeight} px
                </span>
                <span className="text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                  <Check className="w-3.5 h-3.5" /> Ready for Unity, Godot & Phaser Engine Export
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
