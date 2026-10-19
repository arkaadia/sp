import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { getModelCapability, ModelCapability } from '../types/providers';
import { validateEndpointUrl, redactSecrets } from './security';

export interface GenerationOptions {
  prompt: string;
  image?: File;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface Provider {
  id: string;
  name: string;
  defaultModel: string;
  isConfigured: () => boolean;
  verifyConnection: (config?: { apiKey?: string; baseUrl?: string }) => Promise<boolean>;
  listModels?: (config?: { apiKey?: string; baseUrl?: string }) => Promise<string[]>;
  checkCapabilities?: (model?: string) => ModelCapability;
  generateImage: (options: GenerationOptions) => Promise<{ imageUrl: string; modelUsed: string }>;
}

// -------------------------------------------------------------
// OpenAI Client Setup with Security & Timeouts
// -------------------------------------------------------------
let defaultOpenai: OpenAI | null = null;
const openaiApiKey = process.env.OPENAI_API_KEY;
if (openaiApiKey && openaiApiKey !== 'MY_OPENAI_API_KEY' && openaiApiKey.trim().length > 0) {
  defaultOpenai = new OpenAI({
    apiKey: openaiApiKey,
    timeout: 30000,
    maxRetries: 1,
  });
}

function createOpenAIClient(config?: { apiKey?: string; baseUrl?: string }, timeoutMs: number = 30000): OpenAI | null {
  if (config?.apiKey || config?.baseUrl) {
    if (config.baseUrl) {
      const validation = validateEndpointUrl(config.baseUrl);
      if (!validation.valid) {
        const err: any = new Error(`Endpoint URL validation failed: ${validation.error}`);
        err.status = 400;
        throw err;
      }
    }
    return new OpenAI({
      apiKey: config.apiKey || (openaiApiKey && openaiApiKey !== 'MY_OPENAI_API_KEY' ? openaiApiKey : 'dummy-key'),
      baseURL: config.baseUrl ? config.baseUrl.trim() : undefined,
      timeout: timeoutMs,
      maxRetries: 1,
    });
  }
  return defaultOpenai;
}

export const OpenAIProvider: Provider = {
  id: 'openai',
  name: 'OpenAI (DALL-E)',
  defaultModel: 'dall-e-3',
  isConfigured: () => defaultOpenai !== null,
  checkCapabilities: (model?: string) => getModelCapability('openai', model || 'dall-e-3'),

  verifyConnection: async (config?: { apiKey?: string; baseUrl?: string }) => {
    const client = createOpenAIClient(config, 10000); // 10s timeout for test connection
    if (!client) return false;
    try {
      await client.models.list();
      return true;
    } catch (error: any) {
      const sanitized = redactSecrets(error?.message || 'Connection test failed');
      console.error('OpenAI verification failed:', sanitized);
      return false;
    }
  },

  listModels: async (config?: { apiKey?: string; baseUrl?: string }) => {
    const client = createOpenAIClient(config, 15000); // 15s timeout for model discovery
    if (!client) {
      throw new Error('OpenAI client is not configured.');
    }
    try {
      const response = await client.models.list();
      const models: string[] = [];
      for await (const m of response) {
        if (m && m.id) {
          models.push(m.id);
        }
      }
      models.sort((a, b) => a.localeCompare(b));
      return models;
    } catch (err: any) {
      const message = redactSecrets(err?.message || 'Failed to list models');
      const error: any = new Error(message);
      error.status = err?.status || 500;
      throw error;
    }
  },

  generateImage: async (options: GenerationOptions) => {
    const client = createOpenAIClient({ apiKey: options.apiKey, baseUrl: options.baseUrl }, 45000); // 45s timeout for image generation
    if (!client) {
      const err: any = new Error('OpenAI API key is not configured on this server and no custom API Key was provided.');
      err.status = 503;
      throw err;
    }

    // Determine target model WITHOUT silent fallbacks
    const targetModel = (options.model?.trim()) || (options.image ? 'dall-e-2' : 'dall-e-3');
    const capabilities = getModelCapability('openai', targetModel);

    // Validate model capabilities strictly
    if (!capabilities.supportsTextToImage) {
      const err: any = new Error(
        `Model '${targetModel}' is not supported for image generation. Please select a valid image model such as 'dall-e-3' or 'dall-e-2'.`
      );
      err.status = 400;
      throw err;
    }

    if (options.image && !capabilities.supportsImageEditing) {
      const err: any = new Error(
        `Model '${targetModel}' does not support reference-image editing or variations. Please select a model supporting image editing (such as 'dall-e-2') or clear the reference image to generate from prompt only.`
      );
      err.status = 400;
      throw err;
    }

    try {
      let imageUrl = '';

      if (options.image) {
        // Reference image variation
        const response = await client.images.createVariation({
          image: options.image,
          model: targetModel,
          n: 1,
          size: '1024x1024',
        });
        imageUrl = (response.data && response.data[0]?.url) || 
          (response.data && response.data[0]?.b64_json ? `data:image/png;base64,${response.data[0].b64_json}` : '');
      } else {
        // Text-to-image prompt generation
        const response = await client.images.generate({
          model: targetModel,
          prompt: options.prompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          response_format: 'url',
        });
        imageUrl = (response.data && response.data[0]?.url) || 
          (response.data && response.data[0]?.b64_json ? `data:image/png;base64,${response.data[0].b64_json}` : '');
      }

      if (!imageUrl) {
        throw new Error('No usable image URL or data returned by the API');
      }

      return { imageUrl, modelUsed: targetModel };
    } catch (err: any) {
      // Normalize errors with clear messages, redacted secrets, and status codes
      const status = err?.status || err?.statusCode || 500;
      const rawMessage = err?.message || 'Image generation failed';
      const message = redactSecrets(rawMessage);
      const code = err?.code;

      if (status === 401 || message.includes('API key') || code === 'invalid_api_key') {
        const error: any = new Error(`Authentication failed (401 Unauthorized): Invalid API key for ${options.baseUrl ? 'Custom API' : 'OpenAI'}. Please check your credentials.`);
        error.status = 401;
        throw error;
      }

      if (status === 429 || message.includes('quota') || message.includes('rate limit') || code === 'insufficient_quota') {
        const error: any = new Error(`Quota or Rate Limit Exceeded (429): You have exceeded your API quota or rate limit. ${message}`);
        error.status = 429;
        throw error;
      }

      if (status === 404 || code === 'model_not_found') {
        const error: any = new Error(`Model '${targetModel}' was not found or is unsupported on the target API endpoint.`);
        error.status = 404;
        throw error;
      }

      if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || message.includes('timeout') || message.includes('timed out')) {
        const error: any = new Error(`Request timed out: The AI provider took too long to generate the image (timeout exceeded).`);
        error.status = 504;
        throw error;
      }

      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
        const error: any = new Error(`Connection failed: Unable to connect to API endpoint. Please check your network and Base URL.`);
        error.status = 502;
        throw error;
      }

      const error: any = new Error(`OpenAI Provider Error: ${message}`);
      error.status = status;
      throw error;
    }
  }
};

// -------------------------------------------------------------
// Google Gemini (Imagen 3) Setup
// -------------------------------------------------------------
let defaultGemini: GoogleGenAI | null = null;
const geminiApiKey = process.env.GEMINI_API_KEY;
if (geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY' && geminiApiKey.trim().length > 0) {
  defaultGemini = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function createGeminiClient(config?: { apiKey?: string }): GoogleGenAI | null {
  if (config?.apiKey) {
    return new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return defaultGemini;
}

export const GeminiProvider: Provider = {
  id: 'gemini',
  name: 'Google Gemini (Imagen 3)',
  defaultModel: 'imagen-3.0-generate-002',
  isConfigured: () => defaultGemini !== null,
  checkCapabilities: (model?: string) => getModelCapability('gemini', model || 'imagen-3.0-generate-002'),

  verifyConnection: async (config?: { apiKey?: string; baseUrl?: string }) => {
    const client = createGeminiClient({ apiKey: config?.apiKey });
    if (!client) return false;
    try {
      await client.models.list();
      return true;
    } catch (error: any) {
      console.error('Gemini verification failed:', redactSecrets(error?.message || 'Error'));
      return false;
    }
  },

  listModels: async () => {
    return ['imagen-3.0-generate-002'];
  },

  generateImage: async (options: GenerationOptions) => {
    const client = createGeminiClient({ apiKey: options.apiKey });
    if (!client) {
      const err: any = new Error('Gemini API key is not configured on this server (GEMINI_API_KEY missing) and no custom key was provided.');
      err.status = 503;
      throw err;
    }

    const targetModel = (options.model?.trim()) || 'imagen-3.0-generate-002';
    const capabilities = getModelCapability('gemini', targetModel);

    if (!capabilities.supportsTextToImage) {
      const err: any = new Error(
        `Model '${targetModel}' does not support image generation. Please select 'imagen-3.0-generate-002'.`
      );
      err.status = 400;
      throw err;
    }

    if (options.image) {
      const err: any = new Error(
        `Model '${targetModel}' does not support reference-image editing or variations. Please select a model supporting image editing (e.g. OpenAI 'dall-e-2') or clear the reference image.`
      );
      err.status = 400;
      throw err;
    }

    try {
      const response = await client.models.generateImages({
        model: targetModel,
        prompt: options.prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: '1:1',
        },
      });

      const generated = response.generatedImages?.[0];
      const base64Bytes = generated?.image?.imageBytes;
      if (!base64Bytes) {
        throw new Error('No image bytes were returned by the Gemini Imagen model.');
      }

      return {
        imageUrl: `data:image/png;base64,${base64Bytes}`,
        modelUsed: targetModel
      };
    } catch (err: any) {
      const status = err?.status || err?.statusCode || 500;
      const rawMessage = err?.message || 'Gemini image generation failed';
      const message = redactSecrets(rawMessage);

      if (status === 401 || status === 403 || message.includes('API key') || message.includes('API_KEY_INVALID')) {
        const error: any = new Error(`Authentication failed: Invalid or unauthorized Gemini API key.`);
        error.status = 401;
        throw error;
      }

      if (status === 429 || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
        const error: any = new Error(`Quota or Rate Limit Exceeded: Gemini API quota exhausted. ${message}`);
        error.status = 429;
        throw error;
      }

      const error: any = new Error(`Gemini Imagen Error: ${message}`);
      error.status = status;
      throw error;
    }
  }
};

// -------------------------------------------------------------
// Providers Registry
// -------------------------------------------------------------
export const getProviders = (): Provider[] => {
  return [OpenAIProvider, GeminiProvider];
};

export const getProvider = (id: string): Provider | undefined => {
  return getProviders().find(p => p.id === id);
};
