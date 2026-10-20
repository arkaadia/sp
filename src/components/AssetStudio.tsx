import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Wand2, Image as ImageIcon, AlertCircle, Grid, Settings2, ChevronDown, ChevronUp, Eye, EyeOff, CheckCircle2, Cpu, Globe, Key, ShieldCheck, X, Sparkles, Check, Info, Paintbrush, Gamepad2, Layers, Sun, Zap, Network } from 'lucide-react';
import { AVAILABLE_PROVIDERS, getModelCapability } from '../types/providers';
import { PaintingCanvas } from './PaintingCanvas';
import { ProxySettingsModal } from './ProxySettingsModal';
import sampleAttackSheet from '../assets/images/elf_white_wings_attack_1792304222679.jpg';

// Generate 2D Tangent-Space Normal Map (Standard Purplish-Blue #8080FF)
export async function generateNormalMapFromUrl(sourceUrl: string, strength: number = 3.0): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 512;
      canvas.height = img.naturalHeight || img.height || 512;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve('');
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const w = canvas.width;
      const h = canvas.height;

      // Calculate luminance heightmap
      const heights = new Float32Array(w * h);
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) {
          heights[i / 4] = 0;
        } else {
          heights[i / 4] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255.0;
        }
      }

      const outData = ctx.createImageData(w, h);
      const out = outData.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const alpha = data[idx + 3];

          // Transparent background: output flat tangent space normal (128, 128, 255)
          if (alpha === 0) {
            out[idx] = 128;
            out[idx + 1] = 128;
            out[idx + 2] = 255;
            out[idx + 3] = 0;
            continue;
          }

          const x0 = Math.max(0, x - 1);
          const x1 = Math.min(w - 1, x + 1);
          const y0 = Math.max(0, y - 1);
          const y1 = Math.min(h - 1, y + 1);

          const tl = heights[y0 * w + x0];
          const t  = heights[y0 * w + x];
          const tr = heights[y0 * w + x1];
          const l  = heights[y * w + x0];
          const r  = heights[y * w + x1];
          const bl = heights[y1 * w + x0];
          const b  = heights[y1 * w + x];
          const br = heights[y1 * w + x1];

          // 3x3 Sobel convolution
          const dX = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
          const dY = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);

          const nx = -dX * strength;
          const ny = -dY * strength;
          const nz = 1.0;

          const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
          const normX = nx * invLen;
          const normY = ny * invLen;
          const normZ = nz * invLen;

          // Standard tangent-space mapping: (128, 128, 255) purplish-blue
          out[idx] = Math.round((normX * 0.5 + 0.5) * 255);
          out[idx + 1] = Math.round((normY * 0.5 + 0.5) * 255);
          out[idx + 2] = Math.round((normZ * 0.5 + 0.5) * 255);
          out[idx + 3] = alpha;
        }
      }

      ctx.putImageData(outData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = sourceUrl;
  });
}

// Generate 2D Emission & Glow Mask for self-illumination shaders
export async function generateEmissionMapFromUrl(sourceUrl: string, threshold: number = 0.52): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 512;
      canvas.height = img.naturalHeight || img.height || 512;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve('');
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const w = canvas.width;
      const h = canvas.height;

      const outData = ctx.createImageData(w, h);
      const out = outData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a === 0) {
          out[i] = 0;
          out[i + 1] = 0;
          out[i + 2] = 0;
          out[i + 3] = 0;
          continue;
        }

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
        const sat = max === 0 ? 0 : (max - min) / max;

        // Isolate bright highlights, magic effects, glowing runes and blade reflections
        const score = lum * 0.65 + sat * 0.35;

        if (score >= threshold) {
          const factor = Math.min(2.5, 1.0 + (score - threshold) * 3.0);
          out[i] = Math.min(255, Math.round(r * factor));
          out[i + 1] = Math.min(255, Math.round(g * factor));
          out[i + 2] = Math.min(255, Math.round(b * factor));
          out[i + 3] = 255;
        } else {
          // Dark background for emission mask
          out[i] = 0;
          out[i + 1] = 0;
          out[i + 2] = 0;
          out[i + 3] = 255;
        }
      }

      ctx.putImageData(outData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = sourceUrl;
  });
}

export const AssetStudio: React.FC<{ initialAsset?: any; onSendToSlicer?: (url: string) => void }> = ({ initialAsset, onSendToSlicer }) => {
  // Studio navigation mode: 'canvas' for Painting & Creation Canvas, 'generator' for AI Model & Generator Studio
  const [studioView, setStudioView] = useState<'canvas' | 'generator'>('canvas');
  const [canvasInitialImage, setCanvasInitialImage] = useState<string | null>(null);
  const [canvasEnhanceNotice, setCanvasEnhanceNotice] = useState<boolean>(false);
  const [isProxyModalOpen, setIsProxyModalOpen] = useState<boolean>(false);
  const [isProxyActive, setIsProxyActive] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/proxy')
      .then((res) => res.json())
      .then((data) => {
        if (data.isProxyActive) {
          setIsProxyActive(true);
        }
      })
      .catch(() => {});
  }, []);

  const [category, setCategory] = useState<'character' | 'prop' | 'environment'>('character');

  const [promptData, setPromptData] = useState({
    name: '',
    workflow: 'Concept Art',
    description: '',
    personality: '',
    type: 'Human',
    style: 'Pixel Art',
    appearance: '',
    clothing: '',
    mood: '',
    background: 'Transparent',
    // Prop specific
    itemType: 'Weapon',
    material: 'Steel',
    // Environment specific
    biome: 'Forest',
    lighting: 'Daylight',
    provider: 'openai'
  });

  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [lastGeneratedAsset, setLastGeneratedAsset] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Material & Shader Maps state
  const [normalMapUrl, setNormalMapUrl] = useState<string | null>(null);
  const [emissionMapUrl, setEmissionMapUrl] = useState<string | null>(null);
  const [isProcessingMap, setIsProcessingMap] = useState<boolean>(false);
  const [activeMapGeneratingType, setActiveMapGeneratingType] = useState<'normal' | 'emission' | null>(null);
  const [activeComparisonType, setActiveComparisonType] = useState<'normal' | 'emission'>('normal');

  // Trigger generation of Normal or Emission map with realistic shader synthesis delay
  const handleGenerateMap = async (type: 'normal' | 'emission') => {
    const source = generatedImageUrl || sampleAttackSheet;
    if (!source) return;

    setIsProcessingMap(true);
    setActiveMapGeneratingType(type);
    setActiveComparisonType(type);

    try {
      // Realistic shader compilation delay (750ms) for UI feedback
      await new Promise((r) => setTimeout(r, 750));

      if (type === 'normal') {
        const url = await generateNormalMapFromUrl(source, 3.2);
        setNormalMapUrl(url);
      } else {
        const url = await generateEmissionMapFromUrl(source, 0.52);
        setEmissionMapUrl(url);
      }
    } catch (err) {
      console.error('Failed to generate map:', err);
    } finally {
      setIsProcessingMap(false);
      setActiveMapGeneratingType(null);
    }
  };

  // Download specific material map as PNG
  const handleDownloadMap = (mapUrl: string, type: 'normal' | 'emission') => {
    if (!mapUrl) return;
    const baseName = (promptData.name || lastGeneratedAsset?.name || 'sprite').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const a = document.createElement('a');
    a.href = mapUrl;
    a.download = `${baseName}_${type}_map.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Collapsible AI Model & API Configuration state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState({
    mode: 'builtin' as 'builtin' | 'custom',
    baseUrl: '',
    apiKey: '',
    model: 'dall-e-3',
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelsStatus, setFetchModelsStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string | null;
  }>({ type: null, message: null });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string | null;
  }>({ type: null, message: null });

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus({ type: null, message: null });
    try {
      const res = await fetch('/api/providers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: promptData.provider,
          mode: apiConfig.mode,
          apiKey: apiConfig.mode === 'custom' ? apiConfig.apiKey : undefined,
          baseUrl: apiConfig.mode === 'custom' ? apiConfig.baseUrl : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Connection failed.');
      }
      setConnectionStatus({
        type: 'success',
        message: data.message || 'Connection verified successfully (200 OK).'
      });
    } catch (err: any) {
      setConnectionStatus({
        type: 'error',
        message: err.message || 'Connection test failed.'
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setFetchModelsStatus({ type: null, message: null });
    try {
      const res = await fetch('/api/providers/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: promptData.provider,
          mode: apiConfig.mode,
          apiKey: apiConfig.mode === 'custom' ? apiConfig.apiKey : undefined,
          baseUrl: apiConfig.mode === 'custom' ? apiConfig.baseUrl : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch models from endpoint.');
      }
      const models = Array.isArray(data.models) ? data.models : [];
      setFetchedModels(models);
      setFetchModelsStatus({
        type: 'success',
        message: `Successfully retrieved ${models.length} model${models.length === 1 ? '' : 's'}.`
      });
      if (models.length > 0 && !apiConfig.model) {
        setApiConfig(prev => ({ ...prev, model: models[0] }));
      }
    } catch (err: any) {
      setFetchModelsStatus({
        type: 'error',
        message: err.message || 'Failed to fetch models.'
      });
    } finally {
      setIsFetchingModels(false);
    }
  };

  useEffect(() => {
    if (initialAsset) {
      setStudioView('generator');
      // Determine category based on metadata if possible, otherwise default
      const prevCategory = initialAsset.generationSettings?.category || 'character';
      setCategory(prevCategory);
      setPromptData(prev => ({
        ...prev,
        description: initialAsset.prompt,
        name: initialAsset.name,
        provider: initialAsset.provider?.toLowerCase().includes('gemini') ? 'gemini' : 'openai',
        ...initialAsset.generationSettings
      }));

      // If initial asset specifies model, preserve it; if generating variation with reference image, recommend dall-e-2 for OpenAI
      if (initialAsset.model) {
        setApiConfig(prev => ({ ...prev, model: initialAsset.model }));
      } else if (initialAsset.assetLocation) {
        setApiConfig(prev => ({ ...prev, model: 'dall-e-2' }));
      }

      if (initialAsset.assetLocation) {
        fetch(initialAsset.assetLocation)
          .then(res => res.blob())
          .then(blob => {
             const file = new File([blob], 'reference.png', { type: 'image/png' });
             setReferenceImage(file);
             setReferencePreview(URL.createObjectURL(file));
          })
          .catch(console.error);
      }
    }
  }, [initialAsset]);

  const handleEnhanceWithAI = (file: File, dataUrl: string) => {
    setReferenceImage(file);
    setReferencePreview(dataUrl);
    setErrorMsg(null);
    setCanvasEnhanceNotice(true);
    // If provider is OpenAI, set model to dall-e-2 which supports reference-image variations
    if (promptData.provider === 'openai') {
      setApiConfig(prev => ({ ...prev, model: 'dall-e-2' }));
    }
    setStudioView('generator');
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPromptData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReferenceImage(file);
      setReferencePreview(URL.createObjectURL(file));
      setErrorMsg(null);
    }
  };

  // Model capability resolver based on current provider and model
  const currentCapability = getModelCapability(promptData.provider, apiConfig.model);

  const buildPrompt = () => {
    const parts = [];

    if (category === 'character') {
      if (promptData.workflow === 'Views') {
        parts.push('A character design sheet showing clear front, side, and back views.');
      } else if (promptData.workflow === 'Turnaround Sheet') {
        parts.push('A professional character turnaround reference sheet.');
      } else if (promptData.workflow === 'Expression Sheet') {
        parts.push('A facial expression sheet showing various emotions and reactions.');
      } else if (promptData.workflow === 'Pose Sheet') {
        parts.push('An action pose sheet showing the character in multiple dynamic combat or movement poses.');
      } else if (promptData.workflow === 'Sprite Sheet') {
        parts.push('A 2D game asset sprite sheet containing multiple frames of animation aligned on a grid layout.');
      } else {
        parts.push('A high-quality character concept art illustration.');
      }

      if (promptData.style) parts.push(`Style: ${promptData.style}.`);
      if (promptData.type) parts.push(`Type: ${promptData.type}.`);
      if (promptData.description) parts.push(`Description: ${promptData.description}.`);
      if (promptData.appearance) parts.push(`Appearance: ${promptData.appearance}.`);
      if (promptData.clothing) parts.push(`Clothing: ${promptData.clothing}.`);
      if (promptData.mood && promptData.workflow !== 'Expression Sheet') parts.push(`Mood: ${promptData.mood}.`);
      if (promptData.background) parts.push(`Background: ${promptData.background}.`);
    } else if (category === 'prop') {
      if (promptData.workflow === 'Sprite Sheet') {
         parts.push(`A 2D game asset sprite sheet for an animated prop on a grid layout.`);
      } else if (promptData.workflow === 'Icon') {
         parts.push(`A square game UI inventory icon for an item.`);
      } else {
         parts.push(`Concept art for a game prop or item.`);
      }

      if (promptData.style) parts.push(`Style: ${promptData.style}.`);
      if (promptData.itemType) parts.push(`Item Type: ${promptData.itemType}.`);
      if (promptData.material) parts.push(`Material/Element: ${promptData.material}.`);
      if (promptData.description) parts.push(`Description: ${promptData.description}.`);
      if (promptData.background) parts.push(`Background: ${promptData.background}.`);
    } else if (category === 'environment') {
      if (promptData.workflow === 'Tileset') {
         parts.push(`A 2D game tileset grid for building environments.`);
      } else if (promptData.workflow === 'Background') {
         parts.push(`A 2D side-scrolling parallax background layer.`);
      } else {
         parts.push(`Environment concept art landscape.`);
      }
      if (promptData.style) parts.push(`Style: ${promptData.style}.`);
      if (promptData.biome) parts.push(`Biome: ${promptData.biome}.`);
      if (promptData.lighting) parts.push(`Lighting/Atmosphere: ${promptData.lighting}.`);
      if (promptData.description) parts.push(`Description: ${promptData.description}.`);
    }

    return parts.join(' ');
  };

  const handleGenerate = async () => {
    // Validate capabilities strictly without silent model switching
    if (!currentCapability.supportsTextToImage) {
      setErrorMsg(`Model '${apiConfig.model}' is not supported for image generation. Please select a valid image model such as 'dall-e-3' or 'dall-e-2'.`);
      return;
    }

    if (referenceImage && !currentCapability.supportsImageEditing) {
      setErrorMsg(`Model '${apiConfig.model}' does not support reference-image editing or variations. Please select a model supporting image editing (e.g. 'dall-e-2') or clear the reference image.`);
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setGeneratedImageUrl(null);

    try {
      const formData = new FormData();
      formData.append('prompt', buildPrompt());
      if (referenceImage) {
        formData.append('image', referenceImage);
      }
      formData.append('name', promptData.name);
      formData.append('provider', promptData.provider);
      formData.append('model', apiConfig.model);

      const settingsObj: any = {
         category,
         workflow: promptData.workflow,
         style: promptData.style,
      };

      if (category === 'character') {
         settingsObj.type = promptData.type;
      } else if (category === 'prop') {
         settingsObj.itemType = promptData.itemType;
         settingsObj.material = promptData.material;
      } else if (category === 'environment') {
         settingsObj.biome = promptData.biome;
         settingsObj.lighting = promptData.lighting;
      }

      formData.append('settings', JSON.stringify(settingsObj));

      if (initialAsset && initialAsset.id) {
        formData.append('originalId', initialAsset.id);
      }

      // Pass custom AI model and API configuration securely to backend proxy
      if (apiConfig.mode === 'custom' || apiConfig.model) {
        formData.append('customConfig', JSON.stringify({
          mode: apiConfig.mode,
          baseUrl: apiConfig.baseUrl?.trim() || undefined,
          apiKey: apiConfig.mode === 'custom' ? apiConfig.apiKey?.trim() || undefined : undefined,
          model: apiConfig.model?.trim() || undefined,
        }));
      }

      const res = await fetch('/api/generate-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }

      setGeneratedImageUrl(data.imageUrl);
      setLastGeneratedAsset(data.asset);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImageUrl) return;
    const a = document.createElement('a');
    a.href = generatedImageUrl;
    a.download = `${promptData.name || 'asset'}_generated.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      {/* Top Header & Workstation Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 rotate-45 inline-block" />
            Asset Studio Workstation
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive digital art canvas and AI-powered sprite generation suite
          </p>
        </div>

        {/* View Mode Segmented Selector */}
        <div className="flex flex-wrap items-center p-1 bg-[#141820] border border-slate-800 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setStudioView('canvas')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              studioView === 'canvas'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Paintbrush className="w-4 h-4" />
            <span>Painting & Creation Canvas</span>
          </button>

          <button
            type="button"
            onClick={() => setIsProxyModalOpen(true)}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all border ${
              isProxyActive
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 shadow-sm'
                : 'border-slate-800 bg-[#10141d] text-slate-300 hover:text-white hover:border-slate-700'
            }`}
            title="Configure network proxy (MTPROTO, SOCKS5, HTTP, WEB)"
          >
            <Network className="w-4 h-4 text-amber-400" />
            <span>Proxy Settings</span>
            {isProxyActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" title="Proxy Active" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setStudioView('generator')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              studioView === 'generator'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            <span>AI Model & Generator Studio</span>
          </button>
        </div>
      </div>

      {/* Render Canvas or Generator depending on mode */}
      {studioView === 'canvas' ? (
        <PaintingCanvas
          onUseAsGameAsset={() => {}}
          onEnhanceWithAI={handleEnhanceWithAI}
          onSendToSlicer={onSendToSlicer}
          initialImageUrl={canvasInitialImage}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Canvas Enhance Notice Banner */}
          {canvasEnhanceNotice && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-200">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Canvas artwork loaded as reference image!</strong> Tweak your generation prompt, workflow, or AI provider model below to create enhanced variations.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCanvasEnhanceNotice(false)}
                className="text-amber-400 hover:text-white p-1 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Configuration */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-[#141820] border border-slate-800/80 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-amber-400" />
                    AI Asset Studio
                  </h2>
                  <select
                    value={category}
                    onChange={(e) => {
                       setCategory(e.target.value as any);
                       setPromptData(p => ({ ...p, workflow: 'Concept Art' }));
                    }}
                    className="bg-[#0a0c10] border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-300"
                  >
                    <option value="character">Character Art</option>
                    <option value="prop">Props & Icons</option>
                    <option value="environment">Environment & Tilesets</option>
                  </select>
                </div>


          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-amber-400 mb-1">Generation Workflow</label>
              <select
                name="workflow"
                value={promptData.workflow}
                onChange={handleInputChange}
                className="w-full bg-[#1e232d] border border-amber-500/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none shadow-sm"
              >
                {category === 'character' && (
                  <>
                    <option value="Concept Art">Concept Art (Single Character Image)</option>
                    <option value="Views">Views (Front, Side, Back)</option>
                    <option value="Turnaround Sheet">Turnaround Sheet</option>
                    <option value="Expression Sheet">Facial Expression Sheet</option>
                    <option value="Pose Sheet">Action Pose Sheet</option>
                    <option value="Sprite Sheet">2D Sprite Sheet Grid</option>
                  </>
                )}
                {category === 'prop' && (
                  <>
                    <option value="Concept Art">Concept Art</option>
                    <option value="Icon">Inventory Icon</option>
                    <option value="Sprite Sheet">Animated Prop Sprite Sheet</option>
                  </>
                )}
                {category === 'environment' && (
                  <>
                    <option value="Concept Art">Landscape Concept Art</option>
                    <option value="Background">Parallax Background Layer</option>
                    <option value="Tileset">2D Grid Tileset</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Asset Name</label>
              <input
                type="text"
                name="name"
                value={promptData.name}
                onChange={handleInputChange}
                className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                placeholder="e.g. Elysia or Iron Sword"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {category === 'character' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
                  <select
                    name="type"
                    value={promptData.type}
                    onChange={handleInputChange}
                    className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                  >
                    <option value="Human">Human</option>
                    <option value="Elf">Elf</option>
                    <option value="Monster">Monster</option>
                  </select>
                </div>
              )}
              {category === 'prop' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Item Type</label>
                  <input
                    type="text"
                    name="itemType"
                    value={promptData.itemType}
                    onChange={handleInputChange}
                    className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                    placeholder="Weapon, Potion..."
                  />
                </div>
              )}
              {category === 'environment' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Biome</label>
                  <input
                    type="text"
                    name="biome"
                    value={promptData.biome}
                    onChange={handleInputChange}
                    className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                    placeholder="Forest, Cyberpunk City..."
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Style</label>
                <select
                  name="style"
                  value={promptData.style}
                  onChange={handleInputChange}
                  className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                >
                  <option value="Pixel Art">Pixel Art</option>
                  <option value="2D Game Art">2D Game Art</option>
                  <option value="Hand-Drawn">Hand-Drawn</option>
                  <option value="Anime">Anime</option>
                </select>
              </div>
            </div>

            {category === 'character' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Appearance</label>
                    <input
                      type="text"
                      name="appearance"
                      value={promptData.appearance}
                      onChange={handleInputChange}
                      className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                      placeholder="Silver hair, blue eyes"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Clothing</label>
                    <input
                      type="text"
                      name="clothing"
                      value={promptData.clothing}
                      onChange={handleInputChange}
                      className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                      placeholder="Heavy steel armor"
                    />
                  </div>
                </div>
              </>
            )}

            {category === 'prop' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Material / Element</label>
                <input
                  type="text"
                  name="material"
                  value={promptData.material}
                  onChange={handleInputChange}
                  className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                  placeholder="Steel, Fire, Wood..."
                />
              </div>
            )}

            {category === 'environment' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Lighting / Atmosphere</label>
                <input
                  type="text"
                  name="lighting"
                  value={promptData.lighting}
                  onChange={handleInputChange}
                  className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                  placeholder="Daylight, Gloomy, Neon..."
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Description Details</label>
              <textarea
                name="description"
                value={promptData.description}
                onChange={handleInputChange}
                rows={2}
                className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                placeholder="Specific details about the asset..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">AI Provider</label>
              <select
                  name="provider"
                  value={promptData.provider}
                  onChange={(e) => {
                    const newProviderId = e.target.value;
                    const p = AVAILABLE_PROVIDERS.find(item => item.id === newProviderId);
                    setPromptData(prev => ({ ...prev, provider: newProviderId }));
                    if (p) {
                      setApiConfig(prev => ({ ...prev, model: p.defaultModel }));
                    }
                    setConnectionStatus({ type: null, message: null });
                    setFetchModelsStatus({ type: null, message: null });
                    setErrorMsg(null);
                  }}
                  className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                >
                  {AVAILABLE_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Collapsible AI Model & API Configuration */}
            <div className="border border-slate-800 bg-[#0e1117] rounded-lg overflow-hidden transition-all shadow-sm">
              <button
                type="button"
                onClick={() => setIsConfigOpen(!isConfigOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-slate-200">AI Model & API Configuration</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                    apiConfig.mode === 'custom' 
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {apiConfig.mode === 'custom' ? 'Custom API' : 'Built-in'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  {connectionStatus.type === 'success' && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected
                    </span>
                  )}
                  {isConfigOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {isConfigOpen && (
                <div className="p-4 pt-2 space-y-4 border-t border-slate-800/80 bg-[#0b0d12]">
                  {/* Provider Mode: Built-in / Custom API */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Provider Mode</label>
                    <div className="grid grid-cols-2 gap-2 bg-[#141820] p-1 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setApiConfig(prev => ({ ...prev, mode: 'builtin' }));
                          setConnectionStatus({ type: null, message: null });
                          setFetchModelsStatus({ type: null, message: null });
                        }}
                        className={`text-xs py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer ${
                          apiConfig.mode === 'builtin'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Built-in (Server)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setApiConfig(prev => ({ ...prev, mode: 'custom' }));
                          setConnectionStatus({ type: null, message: null });
                          setFetchModelsStatus({ type: null, message: null });
                        }}
                        className={`text-xs py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer ${
                          apiConfig.mode === 'custom'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Custom API
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      {apiConfig.mode === 'builtin'
                        ? 'Uses pre-configured server environment variables (OPENAI_API_KEY).'
                        : 'Connect to your own OpenAI-compatible endpoint or custom model.'}
                    </p>
                  </div>

                  {/* API Base URL */}
                  {apiConfig.mode === 'custom' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-400" />
                          API Base URL
                        </label>
                        <button
                          type="button"
                          onClick={() => setApiConfig(prev => ({ ...prev, baseUrl: 'https://api.openai.com/v1' }))}
                          className="text-[10px] text-amber-400/80 hover:text-amber-300 underline cursor-pointer"
                        >
                          Reset to OpenAI default
                        </button>
                      </div>
                      <input
                        type="text"
                        value={apiConfig.baseUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setApiConfig(prev => ({ ...prev, baseUrl: val }));
                          setConnectionStatus({ type: null, message: null });
                        }}
                        className="w-full bg-[#141820] border border-slate-700/60 rounded-md px-3 py-1.5 text-xs text-white focus:border-amber-500/50 focus:outline-none font-mono"
                        placeholder="https://api.openai.com/v1"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Supports OpenAI, Groq, OpenRouter, Ollama, or custom OpenAI-compatible gateways.
                      </p>
                    </div>
                  )}

                  {/* API Key (masked input with show/hide) */}
                  {apiConfig.mode === 'custom' && (
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                        <Key className="w-3 h-3 text-slate-400" />
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiConfig.apiKey}
                          onChange={(e) => {
                            const val = e.target.value;
                            setApiConfig(prev => ({ ...prev, apiKey: val }));
                            setConnectionStatus({ type: null, message: null });
                          }}
                          className="w-full bg-[#141820] border border-slate-700/60 rounded-md pl-3 pr-10 py-1.5 text-xs text-white focus:border-amber-500/50 focus:outline-none font-mono"
                          placeholder="sk-..."
                          autoComplete="off"
                          spellCheck="false"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                          title={showApiKey ? 'Hide API key' : 'Show API key'}
                        >
                          {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-500/70 shrink-0" />
                        Never stored in browser storage. Transmitted securely to server proxy.
                      </p>
                    </div>
                  )}

                  {/* Model ID (manual entry) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-slate-400" />
                        Model ID (Manual Entry)
                      </label>
                      {apiConfig.model && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Selected: <strong className="text-amber-300">{apiConfig.model}</strong>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={apiConfig.model}
                      onChange={(e) => setApiConfig(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full bg-[#141820] border border-slate-700/60 rounded-md px-3 py-1.5 text-xs text-white focus:border-amber-500/50 focus:outline-none font-mono"
                      placeholder="e.g. dall-e-3, dall-e-2, or custom-model"
                    />

                    {/* Fetched Models Picker */}
                    {fetchedModels.length > 0 && (
                      <div className="mt-2">
                        <label className="block text-[10px] text-slate-400 mb-1">
                          Or select from fetched models ({fetchedModels.length} available):
                        </label>
                        <select
                          value={fetchedModels.includes(apiConfig.model) ? apiConfig.model : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              setApiConfig(prev => ({ ...prev, model: e.target.value }));
                            }
                          }}
                          className="w-full bg-[#141820] border border-slate-700/60 rounded-md px-2 py-1 text-xs text-slate-200 focus:border-amber-500/50 focus:outline-none font-mono"
                        >
                          <option value="">-- Choose a fetched model --</option>
                          {fetchedModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Capability Badges and description */}
                    <div className="mt-2 p-2.5 rounded-lg bg-[#141820] border border-slate-800 text-[11px] space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          currentCapability.supportsTextToImage
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-300 border border-red-500/30'
                        }`}>
                          {currentCapability.supportsTextToImage ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              Text-to-Image Supported
                            </>
                          ) : (
                            <>
                              <X className="w-3 h-3 text-red-400" />
                              No Image Generation
                            </>
                          )}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          currentCapability.supportsImageEditing
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}>
                          {currentCapability.supportsImageEditing ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              Reference Editing / Variations
                            </>
                          ) : (
                            <>
                              <Info className="w-3 h-3 text-amber-400" />
                              Text Prompt Only (No Variations)
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{currentCapability.description}</p>
                    </div>
                  </div>

                  {/* Action Buttons: Test Connection & Fetch Models */}
                  <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection || (apiConfig.mode === 'custom' && !apiConfig.apiKey && !apiConfig.baseUrl)}
                      className="flex-1 min-w-[120px] bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-xs py-2 px-3 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isTestingConnection ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Test Connection</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleFetchModels}
                      disabled={isFetchingModels || (apiConfig.mode === 'custom' && !apiConfig.apiKey && !apiConfig.baseUrl)}
                      className="flex-1 min-w-[120px] bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-xs py-2 px-3 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isFetchingModels ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <Cpu className="w-3.5 h-3.5 text-amber-400" />
                          <span>Fetch Models</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Clear loading, success, and error states */}
                  {connectionStatus.type && (
                    <div className={`p-2.5 rounded-md text-xs flex items-start justify-between gap-2 border ${
                      connectionStatus.type === 'success'
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                        : 'bg-red-950/40 text-red-300 border-red-500/30'
                    }`}>
                      <div className="flex items-start gap-2">
                        {connectionStatus.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        )}
                        <span>{connectionStatus.message}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConnectionStatus({ type: null, message: null })}
                        className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {fetchModelsStatus.type && (
                    <div className={`p-2.5 rounded-md text-xs flex items-start justify-between gap-2 border ${
                      fetchModelsStatus.type === 'success'
                        ? 'bg-blue-950/40 text-blue-300 border-blue-500/30'
                        : 'bg-red-950/40 text-red-300 border-red-500/30'
                    }`}>
                      <div className="flex items-start gap-2">
                        {fetchModelsStatus.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        )}
                        <span>{fetchModelsStatus.message}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFetchModelsStatus({ type: null, message: null })}
                        className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-400">Reference Image (For Variations)</label>
                {referencePreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setReferenceImage(null);
                      setReferencePreview(null);
                      setErrorMsg(null);
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300 underline cursor-pointer"
                  >
                    Clear Reference
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer bg-[#0f1115] border border-slate-700/50 hover:bg-slate-800 transition-colors rounded-md px-4 py-2 flex items-center gap-2 text-sm text-slate-300">
                  <ImageIcon className="w-4 h-4" />
                  <span>{referenceImage ? 'Change Image' : 'Upload Image'}</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                {referencePreview && (
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded overflow-hidden border border-slate-700/50">
                      <img src={referencePreview} alt="Reference" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                      {referenceImage?.name || 'reference.png'}
                    </span>
                  </div>
                )}
              </div>

              {/* Explicit warning and quick-action if model does not support variations */}
              {referenceImage && !currentCapability.supportsImageEditing && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div className="space-y-1 text-[11px]">
                    <p className="font-semibold text-amber-200">
                      Model '{apiConfig.model}' does not support reference-image editing or variations.
                    </p>
                    <p className="text-amber-300/80">
                      {promptData.provider === 'openai' 
                        ? "DALL-E 3 only generates from text prompts. Switch to DALL-E 2 for image variations."
                        : "Imagen 3 only generates from text prompts. Clear the reference image or use OpenAI DALL-E 2 for variations."}
                    </p>
                    {promptData.provider === 'openai' && (
                      <button
                        type="button"
                        onClick={() => {
                          setApiConfig(prev => ({ ...prev, model: 'dall-e-2' }));
                          setErrorMsg(null);
                        }}
                        className="mt-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Switch to dall-e-2 (Supports Variations)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800">
              <label className="block text-xs font-medium text-slate-400 mb-2">Live Prompt Preview</label>
              <div className="bg-[#0a0c10] border border-slate-800 rounded-md p-3 text-xs text-slate-300 font-mono break-words min-h-[60px]">
                {buildPrompt() || 'Your prompt will appear here...'}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full mt-6 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold py-3 rounded-lg shadow-sm transition-all flex justify-center items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generating Asset...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Generate {category === 'character' ? 'Character' : category === 'prop' ? 'Prop' : 'Environment'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Result */}
      <div className="lg:col-span-7">
        <div className="bg-[#141820] border border-slate-800/80 rounded-xl p-6 h-full flex flex-col">
          <h2 className="text-lg font-bold text-slate-100 mb-4">Result</h2>

          {errorMsg && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{errorMsg}</p>
            </div>
          )}

          {/* Generation Metadata Info */}
          {generatedImageUrl && (
            <div className="mb-4 px-3 py-2 bg-[#0b0d12] border border-slate-800 rounded-lg flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Provider:</span>
                <span className="font-semibold text-amber-400">{lastGeneratedAsset?.provider || promptData.provider}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Model:</span>
                <span className="font-mono font-semibold text-white bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">{lastGeneratedAsset?.model || apiConfig.model}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {lastGeneratedAsset?.imageDimensions?.width || 1024}x{lastGeneratedAsset?.imageDimensions?.height || 1024} PNG
              </div>
            </div>
          )}

          <div className="flex-1 bg-[#0a0c10] border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center relative min-h-[400px]">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-4 text-amber-500">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span className="text-sm font-medium animate-pulse">Generating asset...</span>
              </div>
            ) : generatedImageUrl ? (
              <img
                src={generatedImageUrl}
                alt="Generated Asset"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-600">
                <ImageIcon className="w-12 h-12" />
                <p className="text-sm font-medium">Your asset will appear here</p>
              </div>
            )}
          </div>

          {generatedImageUrl && (
            <div className="mt-6 flex flex-wrap items-center gap-4 justify-end">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Original
              </button>
              <button
                onClick={() => {
                  setCanvasInitialImage(generatedImageUrl);
                  setStudioView('canvas');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-md text-sm font-medium transition-colors"
                title="Open this generated asset in the Painting & Creation Canvas to paint, sketch, or edit"
              >
                <Paintbrush className="w-4 h-4 text-amber-400" />
                Open in Canvas
              </button>
              {(promptData.workflow === 'Sprite Sheet' || promptData.workflow === 'Tileset') && onSendToSlicer && (
                <button
                  onClick={() => onSendToSlicer(generatedImageUrl)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md text-sm font-bold transition-colors"
                >
                  <Grid className="w-4 h-4" />
                  Send to Slicer
                </button>
              )}
            </div>
          )}

          {/* Material & Shader Maps Section under the generated asset preview */}
          <div className="mt-8 border-t border-slate-800/90 pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Material & Shader Maps</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Generate 2D Tangent-Space Normal Maps and Emission Illumination Masks for 2D dynamic lighting shaders (Unity URP, Godot 4).
                </p>
              </div>

              {/* Action Buttons: Generate Normal Map & Generate Emission Map */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerateMap('normal')}
                  disabled={isProcessingMap}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Generate standard purplish-blue 2D normal map for directional lighting"
                >
                  {isProcessingMap && activeMapGeneratingType === 'normal' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-200" />
                      <span>Computing Normals...</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-3.5 h-3.5 text-indigo-200" />
                      <span>Generate Normal Map</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateMap('emission')}
                  disabled={isProcessingMap}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Generate glowing emission mask for self-illumination and bloom"
                >
                  {isProcessingMap && activeMapGeneratingType === 'emission' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                      <span>Extracting Glow...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                      <span>Generate Emission Map</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Simulated UI Loading State */}
            {isProcessingMap && (
              <div className="p-6 rounded-xl border border-indigo-500/30 bg-indigo-950/20 flex flex-col items-center justify-center gap-3 text-center animate-pulse">
                <RefreshCw className="w-7 h-7 animate-spin text-indigo-400" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-indigo-200">
                    {activeMapGeneratingType === 'normal'
                      ? 'Synthesizing 2D Tangent-Space Normal Map...'
                      : 'Synthesizing 2D Emission & Glow Map...'}
                  </p>
                  <p className="text-[11px] text-indigo-300/70 font-mono">
                    {activeMapGeneratingType === 'normal'
                      ? 'Applying 3×3 Sobel surface height filters and encoding RGB vectors (128, 128, 255)...'
                      : 'Isolating high-luminance weapon glints, magical particles, and bloom highlights...'}
                  </p>
                </div>
              </div>
            )}

            {/* Side-by-side Visual Comparison Display */}
            {(normalMapUrl || emissionMapUrl) && !isProcessingMap && (
              <div className="space-y-3 pt-1">
                {/* Switcher & Download Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-[#0c0e14] rounded-lg border border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px] font-medium mr-1">View Comparison:</span>
                    {normalMapUrl && (
                      <button
                        type="button"
                        onClick={() => setActiveComparisonType('normal')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                          activeComparisonType === 'normal'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Normal Map (Purplish-Blue)
                      </button>
                    )}
                    {emissionMapUrl && (
                      <button
                        type="button"
                        onClick={() => setActiveComparisonType('emission')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                          activeComparisonType === 'emission'
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Emission Map (Glow)
                      </button>
                    )}
                  </div>

                  {/* Export / Download Buttons for specific maps */}
                  <div className="flex items-center gap-2">
                    {activeComparisonType === 'normal' && normalMapUrl && (
                      <button
                        type="button"
                        onClick={() => handleDownloadMap(normalMapUrl, 'normal')}
                        className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Download Normal Map as PNG"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Normal Map (.PNG)</span>
                      </button>
                    )}
                    {activeComparisonType === 'emission' && emissionMapUrl && (
                      <button
                        type="button"
                        onClick={() => handleDownloadMap(emissionMapUrl, 'emission')}
                        className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Download Emission Map as PNG"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Emission Map (.PNG)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Side-by-Side Visual Comparison (Original Sprite vs. Normal/Emission Map) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Left: Original Sprite */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0a0c10] flex flex-col shadow-inner">
                    <div className="px-3 py-1.5 bg-[#12151c] border-b border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-300">Original Sprite (Albedo / Diffuse)</span>
                      <span className="font-mono text-slate-500 text-[10px]">Source RGB</span>
                    </div>
                    <div className="p-4 flex-1 flex items-center justify-center min-h-[220px] max-h-[300px] canvas-checkerboard">
                      <img
                        src={generatedImageUrl || sampleAttackSheet}
                        alt="Original Sprite"
                        className="max-h-[220px] max-w-full object-contain pixelated"
                      />
                    </div>
                  </div>

                  {/* Right: Normal Map or Emission Map */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0a0c10] flex flex-col shadow-inner">
                    <div className="px-3 py-1.5 bg-[#12151c] border-b border-slate-800 flex items-center justify-between text-[11px]">
                      <span className={`font-semibold ${activeComparisonType === 'normal' ? 'text-indigo-300' : 'text-amber-300'}`}>
                        {activeComparisonType === 'normal' ? 'Normal Map (Tangent-Space)' : 'Emission & Illumination Map'}
                      </span>
                      <span className="font-mono text-slate-500 text-[10px]">
                        {activeComparisonType === 'normal' ? '#8080FF (Purplish-Blue)' : 'Glow Channel'}
                      </span>
                    </div>
                    <div className="p-4 flex-1 flex items-center justify-center min-h-[220px] max-h-[300px] bg-[#0c0e14] relative">
                      <img
                        src={activeComparisonType === 'normal' ? normalMapUrl || '' : emissionMapUrl || ''}
                        alt={activeComparisonType === 'normal' ? 'Normal Map' : 'Emission Map'}
                        className="max-h-[220px] max-w-full object-contain pixelated shadow-lg"
                      />
                    </div>
                    {/* Visual details footer */}
                    <div className="px-3 py-1.5 bg-[#0e1117] border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                      {activeComparisonType === 'normal' ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#8080FF] border border-white/20 shrink-0" />
                          <span className="truncate">Standard Purplish-Blue: R=X normal, G=Y normal, B=Z perpendicular depth</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                          <span className="truncate">Emission Mask: Pure black base + luminous highlights for game engine bloom</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hint when no maps generated yet */}
            {!normalMapUrl && !emissionMapUrl && !isProcessingMap && (
              <div className="p-4 rounded-lg bg-[#0b0d12] border border-slate-800/80 text-center text-xs text-slate-500">
                <p>
                  Click <strong className="text-indigo-400">"Generate Normal Map"</strong> or{' '}
                  <strong className="text-amber-400">"Generate Emission Map"</strong> above to compute 2D lighting textures
                  {generatedImageUrl ? ' for your generated asset' : ' using the sample character'}.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
      )}

      {/* Network Proxy Configuration Modal */}
      <ProxySettingsModal
        isOpen={isProxyModalOpen}
        onClose={() => setIsProxyModalOpen(false)}
        onProxySaved={(config) => setIsProxyActive(config.enabled && Boolean(config.hostname))}
      />
    </div>
  );
};

