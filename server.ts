import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import multer from 'multer';
import { AssetLibrary } from './src/utils/AssetLibrary.ts';


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

// Endpoint for generating character via OpenAI
app.post('/api/openai/generate-character', upload.single('image'), async (req, res) => {
  if (!openai) {
    return res.status(503).json({
      error: 'OPENAI_API_KEY is not configured on this server. Please provide it in .env to use the Character Generator.',
    });
  }

  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Valid prompt string is required' });
    }

    let imageUrl = '';

    if (req.file) {
      // If reference image is provided, use dall-e-2 createVariation or edit
      // Note: OpenAI image variation requires a square PNG file less than 4MB
      // Converting any image to square PNG in memory is complex, so we will pass it
      // directly but catch errors if it fails validation on OpenAI side.
      // Need to convert buffer properly
      const buffer = req.file.buffer as any;
      const imageFile = new File([buffer], req.file.originalname, { type: req.file.mimetype });

      const response = await openai.images.createVariation({
        image: imageFile,
        n: 1,
        size: '1024x1024',
      });
      imageUrl = (response.data && response.data[0]?.url) || '';
    } else {
      // Standard text to image using DALL-E 3
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url',
      });
      imageUrl = (response.data && response.data[0]?.url) || '';
    }

    if (!imageUrl) {
      throw new Error('No usable image was returned by the API');
    }

    // Fetch the image from the URL and save it to the Asset Library
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to download generated image: ${imageRes.statusText}`);
    }
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const assetMetadata = await AssetLibrary.saveAsset(
      {
        name: req.body.name || 'Generated Character',
        prompt,
        provider: 'OpenAI',
        model: req.file ? 'dall-e-2' : 'dall-e-3',
        generationSettings: {
          style: req.body.style,
          type: req.body.type
        },
        imageDimensions: { width: 1024, height: 1024 },
        originalId: req.body.originalId
      },
      buffer
    );

    res.json({ imageUrl: assetMetadata.assetLocation, asset: assetMetadata });

  } catch (err: any) {
    console.error('OpenAI error:', err);
    // Provide meaningful error messages based on OpenAI error types if possible
    let errorMsg = err.message || 'Failed to generate character';
    if (err.status === 401) errorMsg = 'Authentication failed. Please check your API key.';
    else if (err.status === 429) errorMsg = 'Rate limit exceeded or insufficient quota.';
    else if (err.status >= 500) errorMsg = 'OpenAI API server error. Please try again later.';

    res.status(err.status || 500).json({ error: errorMsg });
  }
});

// API endpoint for AI prompt assistant or generating additional sprite actions
app.post('/api/gemini/describe-action', async (req, res) => {
  if (!ai) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on this server. AI action breakdown is optional and requires an API key in .env.',
    });
  }

  try {
    const { actionName, characterStyle } = req.body;
    if (!actionName) {
      return res.status(400).json({ error: 'Action name is required' });
    }

    const prompt = `You are a professional 2D pixel art and sprite animation director.
Break down an 8-frame 2D animation sequence for a chibi winged dark fantasy elf rogue/assassin performing: "${actionName}".
Character description: ${characterStyle || 'Chibi winged elf rogue with long white hair, pointed ears, serene closed eyes, hooded cowl scarf, dark tattered tunic with belts, curved silver dagger with chain, majestic white feathered wings.'}

Provide a JSON object with:
- "actionName": "${actionName}",
- "fps": 10,
- "description": "Brief description of the motion curve",
- "frames": an array of 8 frame descriptions (frame 1 to 8), each with "index" (1-8), "phase" (e.g. Anticipation, Windup, Strike, Apex, Follow-through, Recovery), and "visualPose" (detailed pose of wings, body, legs, arms, and weapon)`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    res.json({ result: JSON.parse(response.text || '{}') });
  } catch (err: any) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: err.message || 'Failed to process AI prompt' });
  }
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
