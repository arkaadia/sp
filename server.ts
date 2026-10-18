import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

app.use(express.json({ limit: '15mb' }));

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
