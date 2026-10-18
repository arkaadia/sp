import OpenAI from 'openai';

export interface GenerationOptions {
  prompt: string;
  image?: File;
}

export interface Provider {
  id: string;
  name: string;
  isConfigured: () => boolean;
  verifyConnection: () => Promise<boolean>;
  generateImage: (options: GenerationOptions) => Promise<{ imageUrl: string, modelUsed: string }>;
}

let openai: OpenAI | null = null;
const openaiApiKey = process.env.OPENAI_API_KEY;
if (openaiApiKey && openaiApiKey !== 'MY_OPENAI_API_KEY' && openaiApiKey.trim().length > 0) {
  openai = new OpenAI({
    apiKey: openaiApiKey,
  });
}

export const OpenAIProvider: Provider = {
  id: 'openai',
  name: 'OpenAI (DALL-E)',
  isConfigured: () => openai !== null,
  verifyConnection: async () => {
    if (!openai) return false;
    try {
      // Use a lightweight API call to verify the connection
      await openai.models.list();
      return true;
    } catch (error) {
      console.error('OpenAI verification failed:', error);
      return false;
    }
  },
  generateImage: async (options: GenerationOptions) => {
    if (!openai) {
      throw new Error('OPENAI_API_KEY is not configured on this server.');
    }

    let imageUrl = '';
    let modelUsed = '';

    if (options.image) {
      // DALL-E 2 variation
      const response = await openai.images.createVariation({
        image: options.image,
        n: 1,
        size: '1024x1024',
      });
      imageUrl = (response.data && response.data[0]?.url) || '';
      modelUsed = 'dall-e-2';
    } else {
      // DALL-E 3 text to image
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: options.prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url',
      });
      imageUrl = (response.data && response.data[0]?.url) || '';
      modelUsed = 'dall-e-3';
    }

    if (!imageUrl) {
      throw new Error('No usable image was returned by the API');
    }

    return { imageUrl, modelUsed };
  }
};

export const getProviders = (): Provider[] => {
  return [OpenAIProvider];
};

export const getProvider = (id: string): Provider | undefined => {
  return getProviders().find(p => p.id === id);
};
