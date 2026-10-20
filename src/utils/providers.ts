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
// OpenAI Client Setup with Security & Timeouts & Proxy Routing
// -------------------------------------------------------------
let defaultOpenai: OpenAI | null = null;
const openaiApiKey = process.env.OPENAI_API_KEY;

function getOrCreateDefaultOpenai(): OpenAI | null {
  if (!openaiApiKey || openaiApiKey === 'MY_OPENAI_API_KEY' || openaiApiKey.trim().length === 0) {
    return null;
  }
  return new OpenAI({
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
  return getOrCreateDefaultOpenai();
}

export const OpenAIProvider: Provider = {
  id: 'openai',
  name: 'OpenAI (DALL-E)',
  defaultModel: 'dall-e-3',
  isConfigured: () => getOrCreateDefaultOpenai() !== null,
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
// Google AI Studio (Imagen 3 Native REST API)
// -------------------------------------------------------------
const googleApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_STUDIO_API_KEY;

export const GoogleImagenProvider: Provider = {
  id: 'google-imagen',
  name: 'Google AI (Imagen 3)',
  defaultModel: 'imagen-3.0-generate-001',
  isConfigured: () => Boolean(googleApiKey && googleApiKey !== 'MY_GEMINI_API_KEY' && googleApiKey.trim().length > 0),
  checkCapabilities: (model?: string) => getModelCapability('google-imagen', model || 'imagen-3.0-generate-001'),

  verifyConnection: async (config?: { apiKey?: string; baseUrl?: string }) => {
    const key = config?.apiKey?.trim() || googleApiKey;
    if (!key || key === 'MY_GEMINI_API_KEY') return false;
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: {
          'x-goog-api-key': key,
        },
        signal: AbortSignal.timeout(10000),
      });
      return res.ok;
    } catch (err: any) {
      console.error('Google AI verification failed:', redactSecrets(err?.message || 'Error'));
      return false;
    }
  },

  listModels: async (config?: { apiKey?: string; baseUrl?: string }) => {
    const key = config?.apiKey?.trim() || googleApiKey;
    if (key && key !== 'MY_GEMINI_API_KEY') {
      try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
          headers: {
            'x-goog-api-key': key,
          },
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const data: any = await res.json();
          const models = (data.models || [])
            .map((m: any) => (m.name || '').replace(/^models\//, ''))
            .filter((name: string) => name.toLowerCase().includes('imagen'));
          if (models.length > 0) return models;
        }
      } catch {
        // Fall back to default known models
      }
    }
    return ['imagen-3.0-generate-001', 'imagen-3.0-generate-002'];
  },

  generateImage: async (options: GenerationOptions) => {
    const apiKey = options.apiKey?.trim() || googleApiKey;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      const err: any = new Error(
        'Google AI Studio API Key is not configured. Please enter your Google AI Studio API Key (starts with AIzaSy...) in the AI Model & API Configuration panel or configure GEMINI_API_KEY on the server.'
      );
      err.status = 503;
      throw err;
    }

    const targetModel = options.model?.trim() || 'imagen-3.0-generate-001';

    if (options.image) {
      const err: any = new Error(
        `Model '${targetModel}' does not support reference-image editing or variations. Please select a model supporting image editing (e.g. OpenAI 'dall-e-2') or clear the reference image.`
      );
      err.status = 400;
      throw err;
    }

    // Build the native REST endpoint
    let endpointUrl = options.baseUrl?.trim();
    if (!endpointUrl) {
      endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:predict`;
    } else if (!endpointUrl.includes(':predict')) {
      endpointUrl = endpointUrl.replace(/\/+$/, '') + `/models/${targetModel}:predict`;
    }

    const validation = validateEndpointUrl(endpointUrl);
    if (!validation.valid) {
      const err: any = new Error(`Endpoint URL validation failed: ${validation.error}`);
      err.status = 400;
      throw err;
    }

    // Google's native Imagen 3 JSON payload structure: instances, prompt, parameters
    const payload = {
      instances: [
        {
          prompt: options.prompt,
        },
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: '1:1',
        outputMimeType: 'image/png',
      },
    };

    try {
      // Pass the API key securely in the 'x-goog-api-key' header
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
          'User-Agent': 'ElysianSpriteStudio/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000), // 60s timeout for image synthesis
      });

      if (!response.ok) {
        const errorBody: any = await response.json().catch(() => null);
        const rawMessage = errorBody?.error?.message || `Google Imagen API returned status ${response.status} ${response.statusText}`;
        const message = redactSecrets(rawMessage);
        const status = response.status;

        if (status === 400 && (message.includes('API key') || message.includes('API_KEY_INVALID'))) {
          const err: any = new Error('Authentication failed (400 Bad Request): Invalid Google AI Studio API Key.');
          err.status = 401;
          throw err;
        }
        if (status === 401 || status === 403) {
          const err: any = new Error(`Authentication failed (${status}): Invalid or unauthorized Google AI Studio API Key.`);
          err.status = 401;
          throw err;
        }
        if (status === 429) {
          const err: any = new Error(`Google Imagen Quota Exceeded (429): ${message}`);
          err.status = 429;
          throw err;
        }
        if (status === 404) {
          const err: any = new Error(`Model endpoint not found (404): ${message}. Verify model name '${targetModel}' or custom endpoint.`);
          err.status = 404;
          throw err;
        }

        const err: any = new Error(`Google Imagen 3 API Error (${status}): ${message}`);
        err.status = status;
        throw err;
      }

      const data: any = await response.json();
      const prediction = data.predictions?.[0];
      const base64Bytes = prediction?.bytesBase64Encoded || 
                          prediction?.image?.imageBytes || 
                          prediction?.image?.bytesBase64Encoded || 
                          prediction?.imageBytes;

      if (!base64Bytes) {
        throw new Error('Google Imagen 3 API did not return image data in the predictions array.');
      }

      const mimeType = prediction?.mimeType || 'image/png';
      const imageUrl = `data:${mimeType};base64,${base64Bytes}`;

      return {
        imageUrl,
        modelUsed: targetModel,
      };
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.code === 'ETIMEDOUT') {
        const error: any = new Error('Google Imagen 3 request timed out after 60 seconds.');
        error.status = 504;
        throw error;
      }
      throw err;
    }
  },
};

export const GeminiProvider = GoogleImagenProvider;

// -------------------------------------------------------------
// Providers Registry
// -------------------------------------------------------------
export const getProviders = (): Provider[] => {
  return [GoogleImagenProvider, OpenAIProvider];
};

export const getProvider = (id: string): Provider | undefined => {
  if (id === 'gemini' || id === 'google-imagen') {
    return GoogleImagenProvider;
  }
  return getProviders().find(p => p.id === id);
};
