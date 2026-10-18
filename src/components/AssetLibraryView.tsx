import React, { useEffect, useState } from 'react';
import { AssetMetadata } from '../types/sprites';
import { Download, Search, Image as ImageIcon, Sparkles, Clock, AlertCircle } from 'lucide-react';

interface AssetLibraryViewProps {
  onGenerateVariation: (asset: AssetMetadata) => void;
}

export const AssetLibraryView: React.FC<AssetLibraryViewProps> = ({ onGenerateVariation }) => {
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<AssetMetadata | null>(null);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await fetch('/api/assets');
        if (!res.ok) {
          throw new Error('Failed to fetch assets');
        }
        const data = await res.json();
        // Sort newest first
        setAssets(data.sort((a: AssetMetadata, b: AssetMetadata) =>
          new Date(b.creationTimestamp).getTime() - new Date(a.creationTimestamp).getTime()
        ));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAssets();
  }, []);

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = (asset: AssetMetadata) => {
    const a = document.createElement('a');
    a.href = asset.assetLocation;
    a.download = `${asset.name || 'character'}_${asset.id.slice(0,8)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-amber-400" />
            Generated Asset Library
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage and reuse your AI-generated character sprites.</p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or prompt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141820] border border-slate-700/50 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="bg-[#141820] border border-slate-800/80 rounded-xl p-12 text-center flex flex-col items-center">
          <ImageIcon className="w-12 h-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-300">No assets found</h3>
          <p className="text-slate-500 mt-2">Generate some characters to see them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredAssets.map(asset => (
            <div
              key={asset.id}
              className="bg-[#141820] border border-slate-800/80 rounded-xl overflow-hidden hover:border-amber-500/50 transition-colors cursor-pointer group flex flex-col"
              onClick={() => setSelectedAsset(asset)}
            >
              <div className="aspect-square bg-[#0a0c10] relative overflow-hidden">
                <img
                  src={asset.assetLocation}
                  alt={asset.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-semibold bg-black/80 px-3 py-1.5 rounded-full">View Details</span>
                </div>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-semibold text-slate-200 truncate">{asset.name || 'Unnamed Character'}</h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(asset.creationTimestamp).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f1115] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl">
            {/* Image Preview */}
            <div className="md:w-1/2 bg-[#0a0c10] flex items-center justify-center p-6 relative border-r border-slate-800">
              <img
                src={selectedAsset.assetLocation}
                alt={selectedAsset.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>

            {/* Metadata Panel */}
            <div className="md:w-1/2 flex flex-col h-full max-h-[50vh] md:max-h-none overflow-y-auto">
              <div className="p-6 flex-1 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">{selectedAsset.name || 'Unnamed Character'}</h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-2 py-1 bg-slate-800 rounded text-xs font-medium text-slate-300 border border-slate-700">
                      {selectedAsset.model}
                    </span>
                    <span className="px-2 py-1 bg-slate-800 rounded text-xs font-medium text-slate-300 border border-slate-700">
                      {selectedAsset.imageDimensions.width}x{selectedAsset.imageDimensions.height}
                    </span>
                    <span className="px-2 py-1 bg-slate-800 rounded text-xs font-medium text-slate-300 border border-slate-700">
                      {new Date(selectedAsset.creationTimestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-400 mb-2">Prompt</h3>
                  <div className="bg-[#141820] p-4 rounded-lg border border-slate-800/80 text-sm text-slate-300 break-words leading-relaxed">
                    {selectedAsset.prompt}
                  </div>
                </div>

                {selectedAsset.generationSettings && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-400 mb-2">Settings</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(selectedAsset.generationSettings as Record<string, unknown>).map(([key, val]) => (
                        Boolean(val) && (
                          <div key={key} className="bg-[#141820] p-3 rounded-lg border border-slate-800/80">
                            <span className="block text-[10px] uppercase tracking-wider text-slate-500">{key}</span>
                            <span className="text-sm text-slate-300">{String(val)}</span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-800 bg-[#141820] flex items-center justify-end gap-3 sticky bottom-0">
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="px-4 py-2 bg-transparent hover:bg-slate-800 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => handleDownload(selectedAsset)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors border border-slate-700"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => {
                    onGenerateVariation(selectedAsset);
                    setSelectedAsset(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-sm font-bold transition-colors shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Variation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
