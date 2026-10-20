export interface ModelCapability {
  supportsTextToImage: boolean;
  supportsImageEditing: boolean;
  description: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  defaultModel: string;
  knownModels: string[];
  description: string;
}

export const AVAILABLE_PROVIDERS: ProviderInfo[] = [
  {
    id: 'google-imagen',
    name: 'Google AI (Imagen 3)',
    defaultModel: 'imagen-3.0-generate-001',
    knownModels: ['imagen-3.0-generate-001', 'imagen-3.0-generate-002'],
    description: 'Google state-of-the-art text-to-image generator via native Imagen 3 REST API.'
  },
  {
    id: 'openai',
    name: 'OpenAI (DALL-E)',
    defaultModel: 'dall-e-3',
    knownModels: ['dall-e-3', 'dall-e-2'],
    description: 'Industry-standard high-fidelity image generator (DALL-E 3 & DALL-E 2).'
  }
];

export function getModelCapability(providerId: string, modelId?: string): ModelCapability {
  const model = (modelId || '').trim().toLowerCase();

  if (providerId === 'gemini' || providerId === 'google-imagen') {
    if (!model || model.includes('imagen')) {
      return {
        supportsTextToImage: true,
        supportsImageEditing: false,
        description: 'Google Imagen 3 generates photorealistic & stylized 2D assets from text prompts. (Reference-image editing is not supported).'
      };
    }
    return {
      supportsTextToImage: false,
      supportsImageEditing: false,
      description: `Model '${modelId}' is not an image generation model.`
    };
  }

  // OpenAI or OpenAI-compatible
  if (!model || model.includes('dall-e-3')) {
    return {
      supportsTextToImage: true,
      supportsImageEditing: false,
      description: 'DALL-E 3 excels at prompt accuracy and detail. (Does not support reference-image variations or editing).'
    };
  }

  if (model.includes('dall-e-2')) {
    return {
      supportsTextToImage: true,
      supportsImageEditing: true,
      description: 'DALL-E 2 supports both text-to-image prompt generation and reference-image variations or editing.'
    };
  }

  // Non-image models (language, chat, audio, embeddings)
  const nonImagePatterns = [
    'gpt-', 'claude', 'deepseek', 'llama', 'mistral', 'qwen', 'embed', 
    'whisper', 'tts', 'o1', 'o3', 'text-embedding', 'text-davinci', 'babbage'
  ];
  if (nonImagePatterns.some(p => model.startsWith(p) || model.includes(p))) {
    return {
      supportsTextToImage: false,
      supportsImageEditing: false,
      description: `Model '${modelId}' is a language, chat, or embedding model and cannot generate images.`
    };
  }

  // Custom model on custom base URL (e.g. Stable Diffusion, Flux, Midjourney proxy, etc.)
  const isEditCapable = model.includes('edit') || model.includes('inpaint') || model.includes('variation') || model.includes('img2img');
  return {
    supportsTextToImage: true,
    supportsImageEditing: isEditCapable,
    description: isEditCapable
      ? `Custom model '${modelId}' configured with image editing and variation support.`
      : `Custom model '${modelId}' configured for text-to-image prompt generation.`
  };
}
