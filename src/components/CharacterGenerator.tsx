import React, { useState, useEffect } from 'react';
import { Grid, Download, RefreshCw, Wand2, Image as ImageIcon, AlertCircle } from 'lucide-react';

export const CharacterGenerator: React.FC<{ initialAsset?: any; onSendToSlicer?: (url: string) => void }> = ({ initialAsset, onSendToSlicer }) => {
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
    background: 'Transparent'
  });

  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialAsset) {
      setPromptData(prev => ({
        ...prev,
        description: initialAsset.prompt,
        name: initialAsset.name,
      }));
      // Fetch image as blob to set as referenceImage
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

    // Inject workflow specific prefix
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
      formData.append('background', promptData.background);
      formData.append('name', promptData.name);
      formData.append('type', promptData.type);
      formData.append('style', promptData.style);
      formData.append('workflow', promptData.workflow);
      if (initialAsset && initialAsset.id) {
        formData.append('originalId', initialAsset.id);
      }

      const res = await fetch('/api/openai/generate-character', {
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
    a.download = `${promptData.name || 'character'}_generated.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Configuration */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-[#141820] border border-slate-800/80 rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-amber-400" />
            Character Configuration
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-amber-400 mb-1">Generation Workflow</label>
              <select
                name="workflow"
                value={promptData.workflow}
                onChange={handleInputChange}
                className="w-full bg-[#1e232d] border border-amber-500/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none shadow-sm"
              >
                <option value="Concept Art">Concept Art (Single Character Image)</option>
                <option value="Views">Views (Front, Side, Back)</option>
                <option value="Turnaround Sheet">Turnaround Sheet</option>
                <option value="Expression Sheet">Facial Expression Sheet</option>
                <option value="Pose Sheet">Action Pose Sheet</option>
                <option value="Sprite Sheet">2D Sprite Sheet Grid</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Note: AI generations do not guarantee perfect character consistency across separate prompts, and raw sprite sheets may require manual slicing alignment.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Character Name (Optional)</label>
              <input
                type="text"
                name="name"
                value={promptData.name}
                onChange={handleInputChange}
                className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                placeholder="e.g. Elysia"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                  <option value="Fairy">Fairy</option>
                  <option value="Creature">Creature</option>
                  <option value="Monster">Monster</option>
                  <option value="Animal">Animal</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
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
                  <option value="Cartoon">Cartoon</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Description & Personality</label>
              <textarea
                name="description"
                value={promptData.description}
                onChange={handleInputChange}
                rows={2}
                className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                placeholder="e.g. A brave knight with a strong sense of justice"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Appearance (Hair, Eyes, Body)</label>
              <input
                type="text"
                name="appearance"
                value={promptData.appearance}
                onChange={handleInputChange}
                className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                placeholder="e.g. Silver hair, blue eyes, tall"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Clothing & Armor</label>
              <input
                type="text"
                name="clothing"
                value={promptData.clothing}
                onChange={handleInputChange}
                className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                placeholder="e.g. Heavy steel armor with gold trim"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Mood & Pose</label>
              <input
                type="text"
                name="mood"
                value={promptData.mood}
                onChange={handleInputChange}
                className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                placeholder="e.g. Confident, standing proudly"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Background</label>
              <select
                name="background"
                value={promptData.background}
                onChange={handleInputChange}
                className="w-full bg-[#0f1115] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
              >
                <option value="Transparent">Transparent</option>
                <option value="White">White</option>
                <option value="Plain Color">Plain Color</option>
                <option value="Detailed">Detailed Environment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Reference Image (Optional, for DALL-E 2 variations)</label>
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
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Generate Character
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
                <span className="text-sm font-medium animate-pulse">Summoning character...</span>
              </div>
            ) : generatedImageUrl ? (
              <img
                src={generatedImageUrl}
                alt="Generated Character"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-600">
                <ImageIcon className="w-12 h-12" />
                <p className="text-sm font-medium">Your character will appear here</p>
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
                Download
              </button>
              {promptData.workflow === 'Sprite Sheet' && onSendToSlicer && (
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
