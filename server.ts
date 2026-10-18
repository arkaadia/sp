import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import multer from 'multer';
import { getProvider, getProviders } from './src/utils/providers.js';
import { AssetLibrary } from './src/utils/AssetLibrary';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB limit to match DALL-E 2 variation limits
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

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


// Provider connection verification
app.get('/api/providers/verify', async (req, res) => {
  const providerId = req.query.provider as string || 'openai';
  const provider = getProvider(providerId);

  if (!provider) {
    return res.status(404).json({ error: `Provider ${providerId} not found` });
  }

  if (!provider.isConfigured()) {
    return res.status(503).json({ error: `${provider.name} is not configured.` });
  }

  const isConnected = await provider.verifyConnection();
  if (isConnected) {
    res.json({ status: 'ok', message: `Successfully connected to ${provider.name}` });
  } else {
    res.status(500).json({ error: `Failed to verify connection to ${provider.name}` });
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
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Shared generation logic
async function processGeneration(req: express.Request, res: express.Response) {
  try {
    const { prompt } = req.body;
    const providerId = req.body.provider || 'openai';

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Valid prompt string is required' });
    }

    const provider = getProvider(providerId);
    if (!provider) {
      return res.status(400).json({ error: `Provider ${providerId} is not supported.` });
    }

    if (!provider.isConfigured()) {
      return res.status(503).json({ error: `${provider.name} API key is not configured on this server.` });
    }

    let imageFile: File | undefined = undefined;
    if (req.file) {
      const buffer = req.file.buffer as any;
      imageFile = new File([buffer], req.file.originalname, { type: req.file.mimetype });
    }

    const { imageUrl, modelUsed } = await provider.generateImage({
      prompt,
      image: imageFile
    });

    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to download generated image: ${imageRes.statusText}`);
    }
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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
        provider: provider.name,
        model: modelUsed,
        generationSettings: rawSettings,
        imageDimensions: { width: 1024, height: 1024 },
        originalId: req.body.originalId
      },
      buffer
    );

    res.json({ imageUrl: assetMetadata.assetLocation, asset: assetMetadata });

  } catch (err: any) {
    console.error('Generation error:', err);
    let errorMsg = err.message || 'Failed to generate image';
    if (err.status === 401) errorMsg = 'Authentication failed. Please check your API key.';
    else if (err.status === 429) errorMsg = 'Rate limit exceeded or insufficient quota.';
    else if (err.status >= 500) errorMsg = 'Provider API server error. Please try again later.';

    res.status(err.status || 500).json({ error: errorMsg });
  }
}

// Endpoint for generic asset generation
app.post('/api/generate-image', upload.single('image'), processGeneration);

// Alias for backwards compatibility with test scripts
app.post('/api/openai/generate-character', upload.single('image'), (req, res) => {
  req.body.provider = 'openai';
  return processGeneration(req, res);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
