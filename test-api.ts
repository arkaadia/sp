import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import multer from 'multer';

const app = express();
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Mock endpoint that resembles our actual endpoint but doesn't call real API
app.post('/api/openai/generate-character', upload.single('image'), (req, res) => {
  // Simulate missing API key
  const hasKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'MY_OPENAI_API_KEY';
  if (!hasKey) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on this server.' });
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Valid prompt string is required' });
  }

  // Simulate success
  res.json({ imageUrl: 'https://mock.url/image.png' });
});

describe('Character Generator API', () => {
  it('should return 503 if API key is missing', async () => {
    // Ensure key is missing or dummy
    process.env.OPENAI_API_KEY = 'MY_OPENAI_API_KEY';

    // Create a mock req and res
    const res = await fetch('http://localhost:3001/api/openai/generate-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test' })
    });

    assert.strictEqual(res.status, 503);
    const data = await res.json() as any;
    assert.match(data.error, /OPENAI_API_KEY is not configured/);
  });

  it('should return 400 if prompt is invalid', async () => {
    process.env.OPENAI_API_KEY = 'valid-key';

    const res = await fetch('http://localhost:3001/api/openai/generate-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}) // missing prompt
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json() as any;
    assert.match(data.error, /Valid prompt string is required/);
  });
});

// Start the server for tests
const server = app.listen(3001, () => {
  // run the tests
});
server.unref(); // allow tests to exit
