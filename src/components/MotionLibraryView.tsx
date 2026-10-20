import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Layers,
  Sparkles,
  Download,
  Upload,
  ArrowRight,
  Sliders,
  Check,
  RotateCcw,
  FileJson,
  Grid,
  Film,
  Zap,
  Info,
  X,
  ExternalLink,
  GripVertical,
  ChevronLeft,
  Images,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';
import {
  CharacterPack,
  FrameDefinition,
  MotionTemplate,
  RetargetingResult,
  AnimationAction,
} from '../types/sprites';
import {
  DEFAULT_MOTION_TEMPLATES,
  INITIAL_CUSTOM_TEMPLATES,
} from '../data/defaultMotionTemplates';
import {
  extractTemplatePoses,
  generateRetargetedSheet,
  ExtractedPose,
  TemplateExtractionResult,
} from '../utils/retargetingEngine';

// Sample reference images for quick testing
import sampleAttackSheet from '../assets/images/elf_white_wings_attack_1792304222679.jpg';
import sampleClimbSheet from '../assets/images/elf_white_wings_climb_1792304222903.jpg';
import sampleRunSheet from '../assets/images/elf_run_spritesheet_1792302153432.jpg';
import sampleJumpSheet from '../assets/images/elf_jump_spritesheet_1792302152918.jpg';

interface MotionLibraryViewProps {
  currentPack: CharacterPack;
  packList: CharacterPack[];
  onApplyRetargetedAction: (actionKey: string, actionDef: AnimationAction) => void;
  onSendToSlicer: (imageUrl: string) => void;
  onNavigateToStudio: () => void;
  onNavigateToRetargeting?: () => void;
  removeBg: boolean;
  bgTolerance: number;
  bgSmoothness: number;
}

export interface FrameItem {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

export function calculateOptimalGrid(totalFrames: number): { cols: number; rows: number } {
  if (totalFrames <= 0) return { cols: 1, rows: 1 };
  if (totalFrames <= 4) return { cols: totalFrames, rows: 1 };
  if (totalFrames <= 6) return { cols: Math.min(6, totalFrames), rows: Math.ceil(totalFrames / 6) };
  if (totalFrames <= 8) return { cols: 4, rows: 2 };
  if (totalFrames <= 10) return { cols: 5, rows: 2 };
  if (totalFrames <= 12) return { cols: 4, rows: 3 };
  if (totalFrames <= 16) return { cols: 4, rows: 4 };
  const cols = Math.ceil(Math.sqrt(totalFrames));
  const rows = Math.ceil(totalFrames / cols);
  return { cols, rows };
}

const STORAGE_KEY = 'elysian_custom_motion_templates_v1';

export const MotionLibraryView: React.FC<MotionLibraryViewProps> = ({
  currentPack,
  packList,
  onApplyRetargetedAction,
  onSendToSlicer,
  onNavigateToStudio,
  onNavigateToRetargeting,
  removeBg,
  bgTolerance,
  bgSmoothness,
}) => {
  // 1. Template state
  const [customTemplates, setCustomTemplates] = useState<MotionTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved custom templates:', e);
    }
    return INITIAL_CUSTOM_TEMPLATES;
  });

  // Save to localStorage when custom templates change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));
    } catch (e) {
      console.warn('Failed to persist custom templates to localStorage:', e);
    }
  }, [customTemplates]);

  // Active selected template
  const [selectedTemplate, setSelectedTemplate] = useState<MotionTemplate>(
    DEFAULT_MOTION_TEMPLATES[0]
  );

  // Collapsible gallery sections
  const [isDefaultSectionOpen, setIsDefaultSectionOpen] = useState<boolean>(true);
  const [isCustomSectionOpen, setIsCustomSectionOpen] = useState<boolean>(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Modal form fields
  const [formName, setFormName] = useState<string>('');
  const [formCols, setFormCols] = useState<number>(4);
  const [formRows, setFormRows] = useState<number>(2);
  const [formTotalFrames, setFormTotalFrames] = useState<number>(8);
  const [formFps, setFormFps] = useState<number>(10);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formSheetUrl, setFormSheetUrl] = useState<string>('');
  const [formImageDimensions, setFormImageDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 896,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Upload mode: 'sheet' (single sprite sheet) or 'frames' (multiple individual frame images)
  const [uploadMode, setUploadMode] = useState<'sheet' | 'frames'>('sheet');
  const [frameItems, setFrameItems] = useState<FrameItem[]>([]);
  const [isStitching, setIsStitching] = useState<boolean>(false);
  const [draggedFrameIdx, setDraggedFrameIdx] = useState<number | null>(null);
  const [dragOverFrameIdx, setDragOverFrameIdx] = useState<number | null>(null);
  const [isDropzoneDragging, setIsDropzoneDragging] = useState<boolean>(false);
  const framesInputRef = useRef<HTMLInputElement | null>(null);

  // Pose Extraction State
  const [extractionResult, setExtractionResult] = useState<TemplateExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [activePoseIdx, setActivePoseIdx] = useState<number>(0);
  const [isPlayingPoseAnim, setIsPlayingPoseAnim] = useState<boolean>(true);
  const [animSpeedFps, setAnimSpeedFps] = useState<number>(10);
  const [showOnionSkin, setShowOnionSkin] = useState<boolean>(false);

  // Retargeting Engine State
  const [selectedTargetPackId, setSelectedTargetPackId] = useState<string>(currentPack.id);
  const [customActionName, setCustomActionName] = useState<string>('');
  const [isRetargeting, setIsRetargeting] = useState<boolean>(false);
  const [retargetResult, setRetargetResult] = useState<RetargetingResult | null>(null);
  const [retargetSuccessMessage, setRetargetSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animIntervalRef = useRef<number | null>(null);

  // Auto-sync custom action name placeholder with selected template
  useEffect(() => {
    setCustomActionName(selectedTemplate.name);
    setRetargetResult(null);
    setRetargetSuccessMessage(null);
  }, [selectedTemplate]);

  // Extract poses whenever selected template or chroma settings change
  useEffect(() => {
    let cancelled = false;
    async function loadPoses() {
      setIsExtracting(true);
      try {
        const result = await extractTemplatePoses(selectedTemplate, {
          removeBg,
          bgTolerance,
          bgSmoothness,
        });
        if (!cancelled) {
          setExtractionResult(result);
          setActivePoseIdx(0);
          setAnimSpeedFps(selectedTemplate.fps || 10);
        }
      } catch (err) {
        console.error('Failed to extract poses from template:', err);
      } finally {
        if (!cancelled) setIsExtracting(false);
      }
    }

    loadPoses();
    return () => {
      cancelled = true;
    };
  }, [selectedTemplate, removeBg, bgTolerance, bgSmoothness]);

  // Animation Loop for Template Pose Viewer
  useEffect(() => {
    if (!isPlayingPoseAnim || !extractionResult || extractionResult.poses.length === 0) {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
      return;
    }

    const intervalMs = Math.max(25, Math.round(1000 / animSpeedFps));
    animIntervalRef.current = window.setInterval(() => {
      setActivePoseIdx((prev) => (prev + 1) % extractionResult.poses.length);
    }, intervalMs);

    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [isPlayingPoseAnim, animSpeedFps, extractionResult]);

  // Open Modal for New Template
  const handleOpenNewModal = () => {
    setEditingTemplateId(null);
    setUploadMode('sheet');
    setFrameItems([]);
    setFormName('');
    setFormCols(4);
    setFormRows(2);
    setFormTotalFrames(8);
    setFormFps(10);
    setFormDescription('');
    setFormSheetUrl(sampleClimbSheet);
    setFormImageDimensions({ width: 1200, height: 896 });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Modal to Edit Existing Custom Template
  const handleOpenEditModal = (tmpl: MotionTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTemplateId(tmpl.id);
    setUploadMode('sheet');
    setFrameItems([]);
    setFormName(tmpl.name);
    setFormCols(tmpl.cols);
    setFormRows(tmpl.rows);
    setFormTotalFrames(tmpl.totalFrames);
    setFormFps(tmpl.fps || 10);
    setFormDescription(tmpl.description || '');
    setFormSheetUrl(tmpl.sheetUrl);
    setFormImageDimensions({
      width: tmpl.frameWidth ? tmpl.frameWidth * tmpl.cols : 1200,
      height: tmpl.frameHeight ? tmpl.frameHeight * tmpl.rows : 896,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Delete Custom Template
  const handleDeleteTemplate = (tmplId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this custom motion template?')) {
      setCustomTemplates((prev) => prev.filter((t) => t.id !== tmplId));
      if (selectedTemplate.id === tmplId) {
        setSelectedTemplate(DEFAULT_MOTION_TEMPLATES[0]);
      }
    }
  };

  // Auto-Stitch uploaded individual frames into a single uniform grid sprite sheet
  const stitchFrames = async (
    frames: FrameItem[],
    desiredCols?: number,
    desiredRows?: number
  ) => {
    if (frames.length === 0) {
      setFormSheetUrl('');
      setFormTotalFrames(0);
      return;
    }

    setIsStitching(true);
    try {
      const totalFrames = frames.length;
      let cols = desiredCols;
      let rows = desiredRows;

      if (!cols || !rows || cols * rows < totalFrames) {
        const optimal = calculateOptimalGrid(totalFrames);
        cols = optimal.cols;
        rows = optimal.rows;
      }

      // Determine uniform frame cell size based on largest individual frame
      const cellW = Math.max(...frames.map((f) => f.width || 64), 64);
      const cellH = Math.max(...frames.map((f) => f.height || 64), 64);

      const totalW = cols * cellW;
      const totalH = rows * cellH;

      const canvas = document.createElement('canvas');
      canvas.width = totalW;
      canvas.height = totalH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, totalW, totalH);

      // Draw all frames onto the uniform grid
      await Promise.all(
        frames.map((frame, index) => {
          return new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const col = index % cols!;
              const row = Math.floor(index / cols!);
              const cellX = col * cellW;
              const cellY = row * cellH;

              // Center frame within cell to keep alignment consistent
              const offsetX = Math.round((cellW - frame.width) / 2);
              const offsetY = Math.round((cellH - frame.height) / 2);

              ctx.drawImage(img, cellX + offsetX, cellY + offsetY, frame.width, frame.height);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = frame.dataUrl;
          });
        })
      );

      const stitchedUrl = canvas.toDataURL('image/png');
      setFormSheetUrl(stitchedUrl);
      setFormImageDimensions({ width: totalW, height: totalH });
      setFormTotalFrames(totalFrames);
      setFormCols(cols);
      setFormRows(rows);
    } catch (err) {
      console.error('Failed to stitch frames:', err);
    } finally {
      setIsStitching(false);
    }
  };

  // Handle uploading multiple individual frame image files
  const handleMultipleFramesUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    // Natural alphanumeric sort by filename (e.g. frame_1.png, frame_2.png, frame_10.png)
    fileArray.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    const loadedItems: FrameItem[] = await Promise.all(
      fileArray.map((file, idx) => {
        return new Promise<FrameItem>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const img = new Image();
            img.onload = () => {
              resolve({
                id: `frame_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
                name: file.name,
                dataUrl,
                width: img.naturalWidth || 64,
                height: img.naturalHeight || 64,
              });
            };
            img.onerror = () => {
              resolve({
                id: `frame_${Date.now()}_${idx}`,
                name: file.name,
                dataUrl,
                width: 64,
                height: 64,
              });
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
        });
      })
    );

    const newFrames = [...frameItems, ...loadedItems];
    setFrameItems(newFrames);

    // Auto-suggest template name from filename if empty
    if (!formName.trim() || formName === 'New Motion Template') {
      const cleanName = fileArray[0].name
        .replace(/\.[^/.]+$/, '')
        .replace(/[_\-\d]+$/, '')
        .trim();
      if (cleanName.length > 1) {
        setFormName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    }

    await stitchFrames(newFrames);
  };

  // Reorder frames via button actions
  const handleMoveFrame = (idx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= frameItems.length) return;
    const reordered = [...frameItems];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);
    setFrameItems(reordered);
    stitchFrames(reordered, formCols, formRows);
  };

  const handleRemoveFrame = (idx: number) => {
    const updated = frameItems.filter((_, i) => i !== idx);
    setFrameItems(updated);
    stitchFrames(updated);
  };

  const handleReverseFrames = () => {
    if (frameItems.length <= 1) return;
    const reversed = [...frameItems].reverse();
    setFrameItems(reversed);
    stitchFrames(reversed, formCols, formRows);
  };

  const handleClearFrames = () => {
    setFrameItems([]);
    setFormSheetUrl('');
    setFormTotalFrames(0);
  };

  // Drag and Drop reordering handlers for thumbnail gallery
  const handleFrameDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedFrameIdx(idx);
  };

  const handleFrameDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverFrameIdx !== idx) {
      setDragOverFrameIdx(idx);
    }
  };

  const handleFrameDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDragOverFrameIdx(null);
    if (draggedFrameIdx === null || draggedFrameIdx === targetIdx) {
      setDraggedFrameIdx(null);
      return;
    }
    const reordered = [...frameItems];
    const [moved] = reordered.splice(draggedFrameIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setDraggedFrameIdx(null);
    setFrameItems(reordered);
    stitchFrames(reordered, formCols, formRows);
  };

  // Handle Single Image Sprite Sheet Upload
  const handleSingleSheetFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        setFormImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        setFormSheetUrl(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleSingleSheetFile(file);
  };

  // Handle Preset Reference Selector inside Modal
  const handleSelectSamplePreset = (presetKey: 'climb' | 'dash' | 'jump' | 'attack') => {
    let url = sampleClimbSheet;
    let name = 'Climb / Traverse';
    if (presetKey === 'dash') {
      url = sampleRunSheet;
      name = 'Phase Dash & Evade';
    } else if (presetKey === 'jump') {
      url = sampleJumpSheet;
      name = 'Air Leap / Flip';
    } else if (presetKey === 'attack') {
      url = sampleAttackSheet;
      name = 'Cast Spell / Burst';
    }

    setFormSheetUrl(url);
    if (!formName.trim() || formName === 'New Motion Template') {
      setFormName(name);
    }
    const img = new Image();
    img.onload = () => {
      setFormImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
  };

  // Save / Update Template
  const handleSaveTemplate = () => {
    if (!formName.trim()) {
      setFormError('Please enter a Template Name.');
      return;
    }
    if (!formSheetUrl) {
      setFormError('Please upload or select a reference sprite sheet.');
      return;
    }
    if (formCols < 1 || formRows < 1) {
      setFormError('Number of columns and rows must be at least 1.');
      return;
    }
    if (formTotalFrames < 1 || formTotalFrames > formCols * formRows) {
      setFormError(`Total frames must be between 1 and ${formCols * formRows}.`);
      return;
    }

    const calculatedCellWidth = Math.floor(formImageDimensions.width / formCols);
    const calculatedCellHeight = Math.floor(formImageDimensions.height / formRows);

    if (editingTemplateId) {
      // Update existing
      setCustomTemplates((prev) =>
        prev.map((t) => {
          if (t.id === editingTemplateId) {
            const updated: MotionTemplate = {
              ...t,
              name: formName.trim(),
              cols: formCols,
              rows: formRows,
              totalFrames: formTotalFrames,
              fps: formFps,
              description: formDescription.trim(),
              sheetUrl: formSheetUrl,
              frameWidth: calculatedCellWidth,
              frameHeight: calculatedCellHeight,
            };
            if (selectedTemplate.id === editingTemplateId) {
              setSelectedTemplate(updated);
            }
            return updated;
          }
          return t;
        })
      );
    } else {
      // Create new
      const newTemplate: MotionTemplate = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: formName.trim(),
        category: 'custom',
        description:
          formDescription.trim() ||
          `Custom user template with ${formTotalFrames} frames arranged in ${formCols}×${formRows} grid.`,
        sheetUrl: formSheetUrl,
        cols: formCols,
        rows: formRows,
        totalFrames: formTotalFrames,
        fps: formFps,
        loop: true,
        frameWidth: calculatedCellWidth,
        frameHeight: calculatedCellHeight,
        createdAt: new Date().toISOString(),
        tags: ['Custom', `${formCols}x${formRows}`, `${formTotalFrames} Frames`],
      };

      setCustomTemplates((prev) => [newTemplate, ...prev]);
      setSelectedTemplate(newTemplate);
    }

    setIsModalOpen(false);
  };

  // Run Retargeting Generation
  const handleExecuteRetargeting = async () => {
    setIsRetargeting(true);
    setRetargetError(null);
    setRetargetSuccessMessage(null);

    const targetPack =
      packList.find((p) => p.id === selectedTargetPackId) || currentPack;

    try {
      const result = await generateRetargetedSheet(selectedTemplate, targetPack, {
        customActionName: customActionName.trim() || selectedTemplate.name,
        removeBg,
        bgTolerance,
        bgSmoothness,
      });

      setRetargetResult(result);
      setRetargetSuccessMessage(
        `Successfully retargeted "${result.templateName}" onto ${result.targetCharacterName} in a ${result.cols}×${result.rows} uniform grid!`
      );
    } catch (err: any) {
      console.error('Failed to generate retargeted sheet:', err);
      setRetargetError(err?.message || 'Failed to retarget animation poses.');
    } finally {
      setIsRetargeting(false);
    }
  };

  const [retargetError, setRetargetError] = useState<string | null>(null);

  // Apply to Active Character Pack & Navigate
  const handleApplyToStudioPlayer = () => {
    if (!retargetResult) return;
    onApplyRetargetedAction(retargetResult.actionDef.action, retargetResult.actionDef);
    onNavigateToStudio();
  };

  // Download Retargeted PNG
  const handleDownloadSheetPng = () => {
    if (!retargetResult) return;
    const a = document.createElement('a');
    a.href = retargetResult.sheetDataUrl;
    a.download = `${retargetResult.targetCharacterId}_${retargetResult.actionDef.action}_${retargetResult.cols}x${retargetResult.rows}_retargeted.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download JSON Metadata
  const handleDownloadMetadataJson = () => {
    if (!retargetResult) return;
    const metadata = {
      generator: 'Elysian Sprite Studio - Motion Retargeting Engine',
      character: retargetResult.targetCharacterName,
      template: retargetResult.templateName,
      layout: {
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
        index: f.index,
        label: f.label,
        phase: f.phaseLabel,
        uv: {
          x: f.sx,
          y: f.sy,
          width: f.sw,
          height: f.sh,
          normalizedX: f.sx / retargetResult.totalWidth,
          normalizedY: f.sy / retargetResult.totalHeight,
          normalizedW: f.sw / retargetResult.totalWidth,
          normalizedH: f.sh / retargetResult.totalHeight,
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
    a.download = `${retargetResult.targetCharacterId}_${retargetResult.actionDef.action}_metadata.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* 1. Top Header & Prominent Action Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 rotate-45 inline-block" />
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Motion Templates Library
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Dynamic, user-expandable kinematic animation system. Upload your own reference sprite
            sheets, extract sequential poses, and seamlessly retarget motions into uniform grid
            tilesets.
          </p>
        </div>

        {/* HEADER ACTIONS */}
        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigateToRetargeting && (
            <button
              onClick={onNavigateToRetargeting}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] transition-all whitespace-nowrap"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Launch Motion Retargeting (10F)</span>
            </button>
          )}

          <button
            onClick={handleOpenNewModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg border border-slate-700 active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Custom Template</span>
          </button>
        </div>
      </div>

      {/* 2. Gallery UI: Collapsible Sections */}
      <div className="space-y-6">
        {/* Section A: Default Actions */}
        <div className="border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden transition-all">
          <button
            onClick={() => setIsDefaultSectionOpen(!isDefaultSectionOpen)}
            className="w-full flex items-center justify-between p-4 bg-slate-900/90 hover:bg-slate-800/80 transition-colors border-b border-slate-800/80 text-left"
          >
            <div className="flex items-center gap-3">
              {isDefaultSectionOpen ? (
                <ChevronDown className="w-4 h-4 text-amber-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-sm font-bold text-white tracking-wide">
                Default Actions
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {DEFAULT_MOTION_TEMPLATES.length} Built-in Kinematic Cycles
              </span>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Core combat & locomotion references
            </span>
          </button>

          {isDefaultSectionOpen && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
              {DEFAULT_MOTION_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate.id === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl)}
                    className={`group relative rounded-lg border p-3 cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-400 shadow-md ring-1 ring-amber-400/50'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                    }`}
                  >
                    <div>
                      {/* Image Thumbnail Preview */}
                      <div className="relative aspect-[4/3] rounded bg-slate-900 overflow-hidden mb-2.5 border border-slate-800/70">
                        <img
                          src={tmpl.sheetUrl}
                          alt={tmpl.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-mono text-amber-300">
                          {tmpl.totalFrames}F
                        </div>
                      </div>

                      {/* Title & Metadata */}
                      <h2 className="text-xs font-bold text-white truncate group-hover:text-amber-400 transition-colors">
                        {tmpl.name}
                      </h2>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono text-slate-400">
                        <span>{tmpl.cols}×{tmpl.rows} Grid</span>
                        <span>·</span>
                        <span>{tmpl.fps || 10} FPS</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Default</span>
                      {isSelected ? (
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Selected
                        </span>
                      ) : (
                        <span className="text-slate-400 group-hover:text-amber-300 transition-colors">
                          Select →
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section B: Custom Actions (Uploaded by user) */}
        <div className="border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden transition-all">
          <button
            onClick={() => setIsCustomSectionOpen(!isCustomSectionOpen)}
            className="w-full flex items-center justify-between p-4 bg-slate-900/90 hover:bg-slate-800/80 transition-colors border-b border-slate-800/80 text-left"
          >
            <div className="flex items-center gap-3">
              {isCustomSectionOpen ? (
                <ChevronDown className="w-4 h-4 text-amber-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-sm font-bold text-white tracking-wide">
                Custom Actions
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {customTemplates.length} Custom Templates
              </span>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              User-uploaded reference sprite sheets & motions
            </span>
          </button>

          {isCustomSectionOpen && (
            <div className="p-4">
              {customTemplates.length === 0 ? (
                <div className="text-center py-10 px-4 border border-dashed border-slate-800 rounded-lg">
                  <Film className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-300">
                    No custom motion templates uploaded yet.
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Click "Add Custom Motion Template" above to upload your own reference sprite
                    sheets for Dash, Swim, Cast Spell, or custom actions.
                  </p>
                  <button
                    onClick={handleOpenNewModal}
                    className="mt-4 px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-md shadow transition-all"
                  >
                    Upload First Custom Template
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {customTemplates.map((tmpl) => {
                    const isSelected = selectedTemplate.id === tmpl.id;
                    return (
                      <div
                        key={tmpl.id}
                        onClick={() => setSelectedTemplate(tmpl)}
                        className={`group relative rounded-lg border p-3.5 cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-400 shadow-lg ring-1 ring-amber-400/50'
                            : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                        }`}
                      >
                        {/* Action management icons (Edit & Delete) */}
                        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-sm rounded-md p-1 border border-slate-800 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleOpenEditModal(tmpl, e)}
                            title="Edit Custom Template"
                            className="p-1 hover:text-amber-400 text-slate-400 transition-colors rounded"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteTemplate(tmpl.id, e)}
                            title="Delete Custom Template"
                            className="p-1 hover:text-rose-400 text-slate-400 transition-colors rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div>
                          {/* Image Thumbnail Preview */}
                          <div className="relative aspect-[4/3] rounded bg-slate-900 overflow-hidden mb-3 border border-slate-800">
                            <img
                              src={tmpl.sheetUrl}
                              alt={tmpl.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute bottom-1.5 left-1.5 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-mono text-amber-300">
                              {tmpl.cols}×{tmpl.rows} · {tmpl.totalFrames} Frames
                            </div>
                          </div>

                          <div className="flex items-center justify-between pr-14">
                            <h2 className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors">
                              {tmpl.name}
                            </h2>
                          </div>

                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {tmpl.description || `Custom action with ${tmpl.totalFrames} frames.`}
                          </p>
                        </div>

                        <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="font-mono text-[10px] text-slate-400">
                            {tmpl.fps || 10} FPS
                          </span>
                          {isSelected ? (
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Active Template
                            </span>
                          ) : (
                            <span className="text-slate-400 group-hover:text-amber-300 font-medium transition-colors">
                              Select & Retarget →
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Retargeting Engine: Kinematics Inspector & Synthesis Studio */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/80 overflow-hidden shadow-2xl">
        {/* Section Header */}
        <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/70">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white">
                Kinematic Retargeting Engine
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Active Template:</span>
              <span className="font-bold text-amber-300">{selectedTemplate.name}</span>
              <span>·</span>
              <span className="font-mono">
                {selectedTemplate.cols} Cols (X) × {selectedTemplate.rows} Rows (Y)
              </span>
              <span>·</span>
              <span className="font-mono text-amber-400">
                {selectedTemplate.totalFrames} Total Frames
              </span>
            </p>
          </div>

          {/* Quick Target Character Picker */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 whitespace-nowrap">Target Character:</span>
            <select
              value={selectedTargetPackId}
              onChange={(e) => setSelectedTargetPackId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-1.5 focus:border-amber-400 focus:outline-none font-medium"
            >
              {packList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Sub-Section 1: Extracted Poses & Real-time Kinematic Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Grid className="w-3.5 h-3.5 text-amber-400" />
                Extracted Poses ({extractionResult?.poses.length || 0} Frames)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlayingPoseAnim(!isPlayingPoseAnim)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 font-medium transition-colors"
                >
                  {isPlayingPoseAnim ? (
                    <>
                      <Pause className="w-3 h-3 text-amber-400" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 text-emerald-400" /> Play Preview
                    </>
                  )}
                </button>
                <div className="flex items-center gap-1 font-mono text-slate-400 text-[11px] bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  <span>Speed:</span>
                  <input
                    type="range"
                    min="4"
                    max="24"
                    value={animSpeedFps}
                    onChange={(e) => setAnimSpeedFps(parseInt(e.target.value, 10))}
                    className="w-16 accent-amber-400 cursor-pointer"
                  />
                  <span className="text-amber-400 w-7 text-right">{animSpeedFps} FPS</span>
                </div>
              </div>
            </div>

            {/* Pose Frames Strip */}
            {isExtracting ? (
              <div className="h-32 flex items-center justify-center bg-slate-950/60 rounded-lg border border-slate-800 text-slate-400 text-xs">
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin mr-2" />
                Extracting poses from {selectedTemplate.name}...
              </div>
            ) : extractionResult && extractionResult.poses.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
                {extractionResult.poses.map((pose, idx) => {
                  const isActive = activePoseIdx === idx;
                  return (
                    <button
                      key={pose.frameIndex}
                      onClick={() => {
                        setActivePoseIdx(idx);
                        setIsPlayingPoseAnim(false);
                      }}
                      className={`p-2 rounded-lg border text-left flex flex-col items-center transition-all ${
                        isActive
                          ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40 shadow-md'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-full aspect-[3/4] bg-slate-900 rounded flex items-center justify-center overflow-hidden mb-1.5 relative border border-slate-800/80">
                        <img
                          src={pose.dataUrl}
                          alt={pose.label}
                          className="w-full h-full object-contain"
                        />
                        <span className="absolute top-1 left-1 bg-black/70 px-1 py-0.2 rounded font-mono text-[9px] text-amber-300">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-300 truncate w-full text-center">
                        {pose.phaseLabel}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        {pose.sx},{pose.sy}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-slate-950 rounded-lg text-xs text-slate-400">
                No poses extracted.
              </div>
            )}
          </div>

          {/* Sub-Section 2: Retargeting Synthesis Action */}
          <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Generate Retargeted Sprite Sheet
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Synthesize the selected character's visual anatomy onto the motion kinematics of{' '}
                  <span className="text-amber-300 font-semibold">{selectedTemplate.name}</span>. The
                  resulting sprite sheet will match the exact uniform grid format (
                  {selectedTemplate.cols} cols × {selectedTemplate.rows} rows).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={customActionName}
                  onChange={(e) => setCustomActionName(e.target.value)}
                  placeholder="Action Name (e.g. Dash)"
                  className="bg-slate-900 border border-slate-700 text-white text-xs rounded-md px-3 py-2 focus:border-amber-400 focus:outline-none font-medium min-w-[180px]"
                />
                <button
                  onClick={handleExecuteRetargeting}
                  disabled={isRetargeting || isExtracting}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 text-slate-950 disabled:text-slate-400 font-bold text-xs uppercase tracking-wider rounded-md shadow-md active:scale-[0.98] transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  {isRetargeting ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      Retargeting...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Execute Retargeting
                    </>
                  )}
                </button>
              </div>
            </div>

            {retargetError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 text-xs">
                {retargetError}
              </div>
            )}

            {retargetSuccessMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{retargetSuccessMessage}</span>
              </div>
            )}
          </div>

          {/* Sub-Section 3: Retargeted Output Matrix & Engine Export Actions */}
          {retargetResult && (
            <div className="border border-slate-800 rounded-xl p-5 bg-slate-950/80 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    Retargeted Uniform Grid Sheet ({retargetResult.cols} × {retargetResult.rows})
                  </h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Resolution: {retargetResult.totalWidth} × {retargetResult.totalHeight} px ·{' '}
                    {retargetResult.totalFrames} Frames · Cell:{' '}
                    {retargetResult.cellWidth} × {retargetResult.cellHeight} px
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleApplyToStudioPlayer}
                    className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-md transition-all flex items-center gap-1.5 shadow"
                  >
                    <span>Apply to Studio Player</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onSendToSlicer(retargetResult.sheetDataUrl)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-md transition-all flex items-center gap-1.5 border border-slate-700"
                  >
                    <Grid className="w-3.5 h-3.5 text-amber-400" />
                    <span>Send to Slicer</span>
                  </button>

                  <button
                    onClick={handleDownloadSheetPng}
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs rounded-md transition-all flex items-center gap-1.5 shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </button>

                  <button
                    onClick={handleDownloadMetadataJson}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-md transition-all flex items-center gap-1.5 border border-slate-700"
                  >
                    <FileJson className="w-3.5 h-3.5 text-amber-400" />
                    <span>JSON Metadata</span>
                  </button>
                </div>
              </div>

              {/* Master Sheet Graphic Preview */}
              <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-[#090b0e] p-2">
                <img
                  src={retargetResult.sheetDataUrl}
                  alt="Retargeted Sprite Sheet"
                  className="w-full max-h-[460px] object-contain rounded"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Custom Template Uploader Modal / Panel */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-[#12151b] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 font-bold">
                  {editingTemplateId ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingTemplateId ? 'Edit Motion Template' : 'Add Custom Motion Template'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Upload reference sprite sheet and configure grid kinematics metadata.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              {/* Step 1: Upload or Choose Reference Sheet / Individual Frames */}
              <div className="space-y-3">
                {/* 1. Upload Mode Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-slate-800/80">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Reference Animation Source
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Choose single sprite sheet or multiple individual frame images
                    </span>
                  </div>

                  <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setUploadMode('sheet')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        uploadMode === 'sheet'
                          ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>Upload Sprite Sheet</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUploadMode('frames')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        uploadMode === 'frames'
                          ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Images className="w-3.5 h-3.5" />
                      <span>Upload Individual Frames</span>
                    </button>
                  </div>
                </div>

                {/* Hidden File Inputs */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={framesInputRef}
                  multiple
                  onChange={(e) => {
                    if (e.target.files) handleMultipleFramesUpload(e.target.files);
                  }}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />

                {/* Upload Mode Content */}
                {uploadMode === 'sheet' ? (
                  /* 1. Existing Single Sprite Sheet Upload */
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Drop zone / Upload trigger */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDropzoneDragging(true);
                      }}
                      onDragLeave={() => setIsDropzoneDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDropzoneDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleSingleSheetFile(file);
                      }}
                      className={`md:col-span-7 border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group ${
                        isDropzoneDragging
                          ? 'border-amber-400 bg-amber-500/10 shadow-lg'
                          : 'border-slate-700 hover:border-amber-400/80 bg-slate-950/50 hover:bg-slate-900/50'
                      }`}
                    >
                      <Upload className="w-7 h-7 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-white">
                        Click or drag & drop reference sheet here
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        PNG, JPG, or WebP (e.g. Climb, Dash, Swim, Cast Spell)
                      </span>
                    </div>

                    {/* Quick sample presets picker */}
                    <div className="md:col-span-5 p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
                      <span className="block font-semibold text-slate-300 text-[11px]">
                        Or pick a starter reference sheet:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectSamplePreset('climb')}
                          className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-[11px] font-medium text-left truncate"
                        >
                          🧗 Wall Climb
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectSamplePreset('dash')}
                          className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-[11px] font-medium text-left truncate"
                        >
                          ⚡ Shadow Dash
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectSamplePreset('jump')}
                          className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-[11px] font-medium text-left truncate"
                        >
                          🦘 Air Leap / Dive
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectSamplePreset('attack')}
                          className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-[11px] font-medium text-left truncate"
                        >
                          ✨ Cast Spell
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 2. New Multi-Frame Upload Mode */
                  <div className="space-y-4">
                    {/* Multi-frame dropzone */}
                    <div
                      onClick={() => framesInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDropzoneDragging(true);
                      }}
                      onDragLeave={() => setIsDropzoneDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDropzoneDragging(false);
                        if (e.dataTransfer.files) handleMultipleFramesUpload(e.dataTransfer.files);
                      }}
                      className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group ${
                        isDropzoneDragging
                          ? 'border-amber-400 bg-amber-500/10 shadow-lg'
                          : 'border-slate-700 hover:border-amber-400/80 bg-slate-950/50 hover:bg-slate-900/50'
                      }`}
                    >
                      <Images className="w-8 h-8 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-white">
                        Click or drag & drop multiple frame images simultaneously
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1 max-w-md">
                        Drop individual PNG or JPG animation frames (e.g. <code>walk_01.png</code>, <code>walk_02.png</code>...).
                        Frames are automatically sorted and stitched into a uniform grid below.
                      </span>
                    </div>

                    {/* Sortable Thumbnail Gallery */}
                    {frameItems.length > 0 && (
                      <div className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-800 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              Sequence Frames ({frameItems.length})
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Grid: {formCols} × {formRows}
                            </span>
                            {isStitching && (
                              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Stitching...
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-xs">
                            <button
                              type="button"
                              onClick={() => framesInputRef.current?.click()}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add More</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleReverseFrames}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
                              title="Reverse animation frame order"
                            >
                              <ArrowUpDown className="w-3 h-3" />
                              <span>Reverse</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleClearFrames}
                              className="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 text-[11px] font-medium flex items-center gap-1 transition-colors"
                              title="Clear all frames"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Clear</span>
                            </button>
                          </div>
                        </div>

                        {/* Drag and drop sortable frames strip */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
                          {frameItems.map((frame, index) => {
                            const isBeingDragged = draggedFrameIdx === index;
                            const isDragOver = dragOverFrameIdx === index;

                            return (
                              <div
                                key={frame.id}
                                draggable
                                onDragStart={(e) => handleFrameDragStart(e, index)}
                                onDragOver={(e) => handleFrameDragOver(e, index)}
                                onDrop={(e) => handleFrameDrop(e, index)}
                                className={`group relative shrink-0 w-24 p-1.5 rounded-xl border bg-slate-900/80 transition-all cursor-grab active:cursor-grabbing select-none ${
                                  isBeingDragged
                                    ? 'opacity-40 scale-95 border-amber-400'
                                    : isDragOver
                                    ? 'border-amber-400 bg-amber-500/10 shadow-md ring-2 ring-amber-400/30'
                                    : 'border-slate-800 hover:border-amber-400/60 hover:bg-slate-900'
                                }`}
                              >
                                {/* Card Top: Index and Drag Handle */}
                                <div className="flex items-center justify-between px-1 mb-1 text-[10px]">
                                  <span className="font-mono font-bold text-amber-400">
                                    #{index + 1}
                                  </span>
                                  <GripVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                                </div>

                                {/* Thumbnail image */}
                                <div className="w-full aspect-square rounded-lg overflow-hidden bg-[#0a0d14] border border-slate-800 flex items-center justify-center relative">
                                  <img
                                    src={frame.dataUrl}
                                    alt={frame.name}
                                    className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
                                  />
                                </div>

                                {/* Frame name label */}
                                <p className="text-[10px] text-slate-400 truncate mt-1 text-center font-mono">
                                  {frame.name}
                                </p>

                                {/* Quick reorder and delete controls */}
                                <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-slate-800/80">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveFrame(index, 'left')}
                                    disabled={index === 0}
                                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                                    title="Move frame left"
                                  >
                                    <ChevronLeft className="w-3 h-3" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFrame(index)}
                                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30"
                                    title="Remove this frame"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleMoveFrame(index, 'right')}
                                    disabled={index === frameItems.length - 1}
                                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                                    title="Move frame right"
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-slate-500 text-center italic">
                          Tip: Drag and drop cards to reorder frame sequence, or use the arrow controls.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Stitched / Detected Preview Thumbnail with metadata */}
                {formSheetUrl && (
                  <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 px-1">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <Grid className="w-3.5 h-3.5 text-amber-400" />
                        {uploadMode === 'frames'
                          ? `Auto-Stitched Sprite Sheet Preview (${formCols}×${formRows} Grid)`
                          : 'Reference Sprite Sheet Preview'}
                      </span>
                      <span className="font-mono text-amber-300">
                        {formImageDimensions.width} × {formImageDimensions.height} px
                      </span>
                    </div>

                    <div className="relative max-h-48 overflow-hidden rounded-lg bg-[#080b10] border border-slate-800/80 flex items-center justify-center p-2">
                      <img
                        src={formSheetUrl}
                        alt="Reference Preview"
                        className="max-h-44 object-contain"
                      />
                      {isStitching && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-amber-400 text-xs font-semibold">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Re-stitching Grid...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Input Fields for Required Kinematic Parameters */}
              <div className="space-y-4">
                {/* 1. Template Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Climb, Dash, Swim, Cast Spell, Evade"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
                  />
                </div>

                {/* Grid Inputs: Number of Columns (X), Number of Rows (Y), Total Frames */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* 2. Number of Columns (X) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Number of Columns (X)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      value={formCols}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                        setFormCols(val);
                        if (formTotalFrames > val * formRows) {
                          setFormTotalFrames(val * formRows);
                        }
                        if (uploadMode === 'frames' && frameItems.length > 0) {
                          stitchFrames(frameItems, val, formRows);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>

                  {/* 3. Number of Rows (Y) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Number of Rows (Y)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      value={formRows}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                        setFormRows(val);
                        if (formTotalFrames > formCols * val) {
                          setFormTotalFrames(formCols * val);
                        }
                        if (uploadMode === 'frames' && frameItems.length > 0) {
                          stitchFrames(frameItems, formCols, val);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>

                  {/* 4. Total Frames */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Total Frames
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={formCols * formRows}
                      value={formTotalFrames}
                      onChange={(e) => {
                        const maxF = formCols * formRows;
                        const val = Math.max(1, Math.min(maxF, parseInt(e.target.value, 10) || 1));
                        setFormTotalFrames(val);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                </div>

                {/* Secondary helper info */}
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>
                    Computed Cell Size: ~{Math.floor(formImageDimensions.width / formCols)} ×{' '}
                    {Math.floor(formImageDimensions.height / formRows)} px
                  </span>
                  <span className="text-amber-400 font-mono">
                    Capacity: {formTotalFrames} / {formCols * formRows} cells
                  </span>
                </div>

                {/* Optional Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Description & Kinematic Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief notes about motion timing, apex position, or contact phases..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer with "Save as Reusable Template" button */}
            <div className="p-5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveTemplate}
                className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Save as Reusable Template</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
