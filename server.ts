import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API endpoint for AI prompt assistant or generating additional sprite actions
app.post('/api/gemini/describe-action', async (req, res) => {
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
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
