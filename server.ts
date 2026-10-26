import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import multer from 'multer';
import { getProvider, getProviders } from './src/utils/providers.js';
import { AssetLibrary } from './src/utils/AssetLibrary.js';
import { validateEndpointUrl, redactSecrets, createRateLimiter, fetchSafeImage } from './src/utils/security.js';
import {
  loadProxyConfig,
  getProxyConfig,
  saveProxyConfig,
  testProxyConnection,
  isProxyActive,
} from './src/utils/proxyService.js';
import { generateSignedAndroidApk } from './src/utils/apkGeneratorServer.js';

dotenv.config({ override: true });

// Initialize proxy routing if configured from previous session
loadProxyConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security & Rate Limiting instances
const generateRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 30,     // 30 requests per minute
  message: 'Rate limit exceeded: Too many image generation requests. Please wait a minute before retrying.'
});

const discoveryRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 60,     // 60 requests per minute
  message: 'Rate limit exceeded: Too many provider discovery requests. Please wait a moment.'
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB limit to match DALL-E 2 variation limits
});

const app = express();
const HOST = process.env.HOST || '0.0.0.0';
let PORT = Number(process.env.PORT) || 3000;
// When running in development, if PORT is set to 8080 (Cloud Run container port occupied by nginx), fallback to 3000
if (PORT === 8080 && process.env.NODE_ENV !== 'production') {
  PORT = 3000;
}

app.use(express.json({ limit: '15mb' }));
app.use('/api/assets/images', express.static(path.join(__dirname, 'data/assets')));


// Gracefully handle optional Gemini API key
let ai: GoogleGenAI | null = null;
const geminiApiKey = process.env.GEMINI_API_KEY;
if (geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY' && geminiApiKey.trim().length > 0) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

let openai: OpenAI | null = null;
const openaiApiKey = process.env.OPENAI_API_KEY;
if (openaiApiKey && openaiApiKey !== 'MY_OPENAI_API_KEY' && openaiApiKey.trim().length > 0) {
  openai = new OpenAI({
    apiKey: openaiApiKey,
  });
}


// Retrieve all generated assets from the local library
app.get('/api/assets', async (_req, res) => {
  try {
    const assets = await AssetLibrary.getAssets();
    res.json(assets);
  } catch (err: any) {
    console.error('Failed to get assets:', err);
    res.status(500).json({ error: 'Failed to retrieve assets' });
  }
});

// Save custom canvas artwork directly to local asset library
app.post('/api/assets', upload.single('image') as any, async (req: any, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    const name = req.body.name || 'Custom Painted Canvas Asset';
    const category = req.body.category || 'character';
    const style = req.body.style || 'Pixel Art';
    const width = parseInt(req.body.width, 10) || 512;
    const height = parseInt(req.body.height, 10) || 512;

    const assetMetadata = await AssetLibrary.saveAsset(
      {
        name,
        prompt: req.body.prompt || `Custom painted ${category} asset created in Asset Studio Canvas`,
        provider: 'Elysian Canvas Studio',
        model: 'Interactive Digital Paint Engine',
        generationSettings: {
          category,
          style,
          workflow: req.body.workflow || 'Custom Artwork',
        },
        imageDimensions: { width, height },
      },
      req.file.buffer
    );

    res.json({ success: true, asset: assetMetadata });
  } catch (err: any) {
    console.error('Failed to save canvas asset:', err);
    res.status(500).json({ error: err.message || 'Failed to save asset' });
  }
});



// Retrieve all configured providers
app.get('/api/providers', (_req, res) => {
  const providers = getProviders().map(p => ({
    id: p.id,
    name: p.name,
    defaultModel: p.defaultModel,
    isConfigured: p.isConfigured()
  }));
  res.json({ providers });
});

// Provider connection verification (GET for simple check, POST for custom credentials)
app.get('/api/providers/verify', async (req, res) => {
  const providerId = req.query.provider as string || 'openai';
  const provider = getProvider(providerId);

  if (!provider) {
    return res.status(404).json({ error: `Provider ${providerId} not found` });
  }

  if (!provider.isConfigured()) {
    return res.status(503).json({ error: `${provider.name} is not configured on this server.` });
  }

  const isConnected = await provider.verifyConnection();
  if (isConnected) {
    res.json({ status: 'ok', message: `Successfully connected to ${provider.name}` });
  } else {
    res.status(500).json({ error: `Failed to verify connection to ${provider.name}` });
  }
});

app.post('/api/providers/verify', discoveryRateLimiter, async (req, res) => {
  const providerId = req.body.provider as string || 'openai';
  const { mode, apiKey, baseUrl } = req.body;
  const provider = getProvider(providerId);

  if (!provider) {
    return res.status(404).json({ error: `Provider ${providerId} not found` });
  }

  if (mode === 'custom') {
    if (!apiKey && !baseUrl) {
      return res.status(400).json({ error: 'Custom API requires an API Key or Base URL.' });
    }

    if (baseUrl) {
      const urlValidation = validateEndpointUrl(baseUrl);
      if (!urlValidation.valid) {
        return res.status(400).json({ error: urlValidation.error });
      }
    }

    try {
      const isConnected = await provider.verifyConnection({ apiKey: apiKey?.trim(), baseUrl: baseUrl?.trim() });
      if (isConnected) {
        return res.json({ status: 'ok', message: 'Successfully connected to Custom API endpoint.' });
      } else {
        return res.status(500).json({ error: 'Failed to verify connection to Custom API endpoint.' });
      }
    } catch (err: any) {
      let errMsg = redactSecrets(err?.message || 'Connection failed');
      if (err?.status === 401) errMsg = 'Authentication failed (401 Unauthorized). Please check your API key.';
      else if (err?.status === 404) errMsg = 'Endpoint not found (404). Please verify your Base URL.';
      return res.status(err?.status || 500).json({ error: errMsg });
    }
  }

  // Built-in mode
  if (!provider.isConfigured()) {
    return res.status(503).json({ error: `${provider.name} is not configured on this server (API key missing).` });
  }

  try {
    const isConnected = await provider.verifyConnection();
    if (isConnected) {
      res.json({ status: 'ok', message: `Successfully connected to ${provider.name}` });
    } else {
      res.status(500).json({ error: `Failed to verify connection to ${provider.name}` });
    }
  } catch (err: any) {
    const errorMsg = redactSecrets(err?.message || 'Connection verification failed');
    res.status(500).json({ error: errorMsg });
  }
});

// Fetch models endpoint with SSRF check and rate limiting
app.post('/api/providers/models', discoveryRateLimiter, async (req, res) => {
  const providerId = req.body.provider as string || 'openai';
  const { mode, apiKey, baseUrl } = req.body;
  const provider = getProvider(providerId);

  if (!provider) {
    return res.status(404).json({ error: `Provider ${providerId} not found` });
  }

  if (mode === 'custom') {
    if (!apiKey && !baseUrl) {
      return res.status(400).json({ error: 'API Key or Base URL is required to fetch models from Custom API.' });
    }
    if (baseUrl) {
      const urlValidation = validateEndpointUrl(baseUrl);
      if (!urlValidation.valid) {
        return res.status(400).json({ error: urlValidation.error });
      }
    }
  }

  if (mode !== 'custom' && !provider.isConfigured()) {
    return res.status(503).json({ error: `${provider.name} is not configured on this server.` });
  }

  try {
    if (!provider.listModels) {
      return res.status(400).json({ error: `Model listing is not supported by ${provider.name}.` });
    }
    const models = await provider.listModels({
      apiKey: mode === 'custom' ? apiKey?.trim() : undefined,
      baseUrl: mode === 'custom' ? baseUrl?.trim() : undefined,
    });
    res.json({ models });
  } catch (err: any) {
    let errMsg = redactSecrets(err?.message || 'Failed to fetch models');
    if (err?.status === 401) errMsg = 'Authentication failed (401). Invalid API key.';
    else if (err?.status === 404) errMsg = 'Models endpoint not found (404) at the specified Base URL.';
    res.status(err?.status || 500).json({ error: errMsg });
  }
});

// Health check endpoint for system monitoring, status scripts, and systemd
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Elysian Sprite Studio',
    mode: process.env.NODE_ENV || 'development',
    host: HOST,
    port: PORT,
    aiAvailable: ai !== null,
    proxyActive: isProxyActive(),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// -------------------------------------------------------------
// Android APK Package Build & Direct Download Endpoints
// -------------------------------------------------------------
app.get('/api/android/apk-info', async (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || `${HOST}:${PORT}`;
    const originUrl = `${protocol}://${hostHeader}`;
    const apk = await generateSignedAndroidApk({ serverUrl: originUrl });
    res.json({
      filename: apk.filename,
      sha256: apk.sha256,
      sizeBytes: apk.sizeBytes,
      metadata: apk.metadata,
      downloadUrl: '/api/android/download-apk',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get APK metadata' });
  }
});

app.get('/api/android/download-apk', async (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || `${HOST}:${PORT}`;
    const originUrl = `${protocol}://${hostHeader}`;

    const profile = (req.query.profile as any) || 'universal';
    const orientation = (req.query.orientation as any) || 'sensor';

    const apk = await generateSignedAndroidApk({
      serverUrl: (req.query.serverUrl as string) || originUrl,
      deviceProfile: profile,
      orientation,
    });

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${apk.filename}"`);
    res.setHeader('Content-Length', String(apk.sizeBytes));
    res.setHeader('X-APK-SHA256', apk.sha256);
    res.send(apk.buffer);
  } catch (err: any) {
    console.error('APK Download error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate Android APK' });
  }
});

app.post('/api/android/build-apk', async (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || `${HOST}:${PORT}`;
    const originUrl = `${protocol}://${hostHeader}`;

    const {
      appName,
      packageId,
      versionName,
      serverUrl,
      orientation,
      deviceProfile,
      enableHaptics,
      enableStylus,
      fullscreen,
    } = req.body || {};

    const apk = await generateSignedAndroidApk({
      appName,
      packageId,
      versionName,
      serverUrl: serverUrl || originUrl,
      orientation,
      deviceProfile,
      enableHaptics,
      enableStylus,
      fullscreen,
    });

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${apk.filename}"`);
    res.setHeader('Content-Length', String(apk.sizeBytes));
    res.setHeader('X-APK-SHA256', apk.sha256);
    res.send(apk.buffer);
  } catch (err: any) {
    console.error('Custom APK Build error:', err);
    res.status(500).json({ error: err.message || 'Failed to build custom Android APK' });
  }
});

// -------------------------------------------------------------
// Network Proxy Configuration & Diagnostics Endpoints
// -------------------------------------------------------------
app.get('/api/proxy', (_req, res) => {
  try {
    const config = getProxyConfig();
    res.json({
      config,
      isProxyActive: isProxyActive(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve proxy configuration' });
  }
});

app.post('/api/proxy/test', async (req, res) => {
  try {
    const { type, hostname, port, secret, username, password } = req.body;
    const testResult = await testProxyConnection({
      enabled: true,
      type: type || 'HTTP',
      hostname: hostname || '',
      port: Number(port) || 8080,
      secret: secret || '',
      username: username || '',
      password: password || '',
    });
    res.json(testResult);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: `Proxy test failed with internal error: ${err.message}`,
    });
  }
});

app.post('/api/proxy/save', async (req, res) => {
  try {
    const { enabled, type, hostname, port, secret, username, password } = req.body;
    const saved = saveProxyConfig({
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      type: type || 'HTTP',
      hostname: hostname ? String(hostname).trim() : '',
      port: Number(port) || 8080,
      secret: secret ? String(secret).trim() : '',
      username: username ? String(username).trim() : '',
      password: password ? String(password) : '',
    });
    res.json({
      success: true,
      config: saved,
      isProxyActive: isProxyActive(),
      message: saved.enabled
        ? `Outbound traffic successfully routed through ${saved.type} proxy (${saved.hostname}:${saved.port}).`
        : 'Proxy disabled. Direct internet traffic restored.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to save proxy configuration: ${err.message}`,
    });
  }
});

app.post('/api/proxy/disable', (_req, res) => {
  try {
    const saved = saveProxyConfig({ enabled: false });
    res.json({
      success: true,
      config: saved,
      isProxyActive: false,
      message: 'Proxy disabled. Restored direct connection for all outbound traffic.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to disable proxy: ${err.message}`,
    });
  }
});

// Shared generation logic
async function processGeneration(req: any, res: any) {
  try {
    const { prompt } = req.body;
    const providerId = req.body.provider || 'openai';

    let customConfig: {
      mode?: 'builtin' | 'custom';
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    } | undefined = undefined;

    if (req.body.customConfig) {
      try {
        customConfig = typeof req.body.customConfig === 'string'
          ? JSON.parse(req.body.customConfig)
          : req.body.customConfig;
      } catch (e) {
        console.warn('Failed to parse customConfig:', e);
      }
    }

    if (customConfig?.baseUrl) {
      const urlValidation = validateEndpointUrl(customConfig.baseUrl);
      if (!urlValidation.valid) {
        return res.status(400).json({ error: urlValidation.error });
      }
    }

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Valid prompt string is required' });
    }

    const provider = getProvider(providerId);
    if (!provider) {
      return res.status(400).json({ error: `Provider ${providerId} is not supported.` });
    }

    const isCustom = customConfig?.mode === 'custom';
    if (!isCustom && !provider.isConfigured() && !customConfig?.apiKey) {
      return res.status(503).json({ error: `${provider.name} API key is not configured on this server.` });
    }

    let imageFile: File | undefined = undefined;
    if (req.file) {
      const buffer = req.file.buffer as any;
      imageFile = new File([buffer], req.file.originalname, { type: req.file.mimetype });
    }

    const requestedModel = req.body.model?.trim() || customConfig?.model?.trim() || undefined;

    const { imageUrl, modelUsed } = await provider.generateImage({
      prompt,
      image: imageFile,
      model: requestedModel,
      apiKey: customConfig?.apiKey?.trim() || undefined,
      baseUrl: customConfig?.baseUrl?.trim() || undefined,
    });

    let buffer: Buffer;
    if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > 25 * 1024 * 1024) {
        return res.status(413).json({ error: 'Generated image exceeds the 25MB response-size limit.' });
      }
    } else {
      // Safe image download: validates URL with SSRF protection, enforces 25MB limit, and 15s timeout
      buffer = await fetchSafeImage(imageUrl, 25 * 1024 * 1024);
    }

    let rawSettings = {};
    if (req.body.settings) {
       rawSettings = typeof req.body.settings === 'string' ? JSON.parse(req.body.settings) : req.body.settings;
    } else {
       // Support backward compatible structure
       rawSettings = {
         style: req.body.style,
         type: req.body.type,
         workflow: req.body.workflow
       };
    }

    const assetMetadata = await AssetLibrary.saveAsset(
      {
        name: req.body.name || 'Generated Asset',
        prompt,
        provider: isCustom ? `Custom (${provider.name})` : provider.name,
        model: modelUsed,
        generationSettings: rawSettings,
        imageDimensions: { width: 1024, height: 1024 },
        originalId: req.body.originalId
      },
      buffer
    );

    res.json({ imageUrl: assetMetadata.assetLocation, asset: assetMetadata });

  } catch (err: any) {
    const status = err.status || 500;
    const errorMsg = redactSecrets(err.message || 'Failed to generate image');
    console.error('Generation error:', errorMsg);
    res.status(status).json({ error: errorMsg });
  }
}

// Endpoint for generic asset generation with rate limiting
app.post('/api/generate-image', generateRateLimiter, upload.single('image') as any, processGeneration);

// Alias for backwards compatibility with test scripts with rate limiting
app.post('/api/openai/generate-character', generateRateLimiter, upload.single('image') as any, (req: any, res: any) => {
  req.body.provider = 'openai';
  return processGeneration(req, res);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: HOST,
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(__dirname, 'dist'))
      ? path.join(__dirname, 'dist')
      : path.resolve(__dirname);

    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`Elysian Sprite Studio running at http://${HOST}:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('Received shutdown signal. Stopping server gracefully...');
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
