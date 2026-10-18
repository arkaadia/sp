import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Wand2, Image as ImageIcon, AlertCircle, Grid, Settings2 } from 'lucide-react';

export const AssetStudio: React.FC<{ initialAsset?: any; onSendToSlicer?: (url: string) => void }> = ({ initialAsset, onSendToSlicer }) => {
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialAsset) {
      // Determine category based on metadata if possible, otherwise default
      const prevCategory = initialAsset.generationSettings?.category || 'character';
      setCategory(prevCategory);
      setPromptData(prev => ({
        ...prev,
        description: initialAsset.prompt,
        name: initialAsset.name,
        ...initialAsset.generationSettings
      }));

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPromptData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReferenceImage(file);
      setReferencePreview(URL.createObjectURL(file));
    }
  };

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

      const res = await fetch('/api/generate-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }

      setGeneratedImageUrl(data.imageUrl);
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
    <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
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
                  onChange={handleInputChange}
                  className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                >
                  <option value="openai">OpenAI (DALL-E)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Reference Image (For Variations)</label>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer bg-[#0f1115] border border-slate-700/50 hover:bg-slate-800 transition-colors rounded-md px-4 py-2 flex items-center gap-2 text-sm text-slate-300">
                  <ImageIcon className="w-4 h-4" />
                  <span>Upload Image</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                {referencePreview && (
                  <div className="w-10 h-10 rounded overflow-hidden border border-slate-700/50">
                    <img src={referencePreview} alt="Reference" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
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
        </div>
      </div>
    </div>
  );
};
