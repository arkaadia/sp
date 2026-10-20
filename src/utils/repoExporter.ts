import JSZip from 'jszip';

/**
 * Packages the entire Elysian Sprite Studio project source code into a clean GitHub-ready repository ZIP file.
 */
export async function downloadGitHubRepoZip(): Promise<void> {
  const zip = new JSZip();

  // Root files
  zip.file(
    'package.json',
    JSON.stringify(
      {
        name: 'elysian-sprite-studio',
        private: true,
        version: '1.0.0',
        type: 'module',
        description: '2D Sprite Sheet & Tileset Generator Studio for Game Engines',
        scripts: {
          dev: 'tsx server.ts',
          build: 'vite build',
          start: 'node server.ts',
          preview: 'vite preview',
          clean: 'rm -rf dist server.js',
          lint: 'tsc --noEmit',
        },
        dependencies: {
          '@google/genai': '^2.4.0',
          '@tailwindcss/vite': '^4.3.3',
          '@vitejs/plugin-react': '^6.1.1',
          dotenv: '^17.2.3',
          express: '^4.21.2',
          jszip: '^3.10.1',
          'lucide-react': '^0.546.0',
          motion: '^12.23.24',
          react: '^19.0.1',
          'react-dom': '^19.0.1',
          vite: '^8.3.0',
        },
        devDependencies: {
          '@types/express': '^4.17.21',
          '@types/jszip': '^3.4.1',
          '@types/node': '^22.14.0',
          '@types/react': '^19.3.0',
          '@types/react-dom': '^19.3.0',
          autoprefixer: '^10.4.21',
          esbuild: '^0.25.0',
          tailwindcss: '^4.3.3',
          tsx: '^4.21.0',
          typescript: '^7.0.2',
        },
      },
      null,
      2
    )
  );

  zip.file(
    '.gitignore',
    `node_modules/
dist/
.env
.DS_Store
*.log
`
  );

  zip.file(
    '.env.example',
    `# Optional Gemini API key for AI-assisted animation breakdowns
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
PORT=3000
`
  );

  zip.file(
    'tsconfig.json',
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          strict: true,
          skipLibCheck: true,
          paths: { '@/*': ['./*'] },
          noEmit: true,
        },
      },
      null,
      2
    )
  );

  zip.file(
    'vite.config.ts',
    `import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
  },
});
`
  );

  zip.file(
    'server.ts',
    `import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json({ limit: '15mb' }));

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
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(\`Elysian Sprite Studio running at http://\${HOST}:\${PORT}\`);
  });
}

startServer();
`
  );

  // Documentation
  zip.file(
    'README.md',
    `# Elysian Sprite Studio
2D Sprite Sheet & Tileset Generator for Game Developers

## Quickstart:
1. \`npm install\`
2. \`bash setup.sh\`
3. \`npm run dev\`
`
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'elysian-sprite-studio-repository.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
