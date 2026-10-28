# Elysian Sprite Studio ⚔️✨
### Professional 2D Sprite Sheet & Tileset Generator for Game Developers

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg)](https://tailwindcss.com/)

A modern, high-performance web studio designed for indie game developers, pixel artists, and technical animators to slice, inspect, preview in 60 FPS physics, remove backgrounds, and export production-ready 2D sprite sheets into clean PNG tilesets, horizontal strips, and engine-ready metadata (Godot 4, Unity, Phaser 3, CSS).

---

## 🐧 Linux 1-Command Automated Production Installation

On Ubuntu (20.04+) or Debian (11+), deploy the production service with automated runtime provisioning, systemd daemon, and global CLI:

```bash
git clone https://github.com/arkaadia/sp.git
cd sp
sudo bash install.sh
```

After installation finishes, access the application in your browser at **`http://127.0.0.1:3000`**.

### Service Management CLI
```bash
sprite-studio status    # Check service and health endpoint
sprite-studio restart   # Restart production service
sprite-studio logs      # View recent application logs
sprite-studio update    # Pull git updates, rebuild, and reload
sprite-studio stop      # Stop service
```

- 📖 **Full Linux Guide**: [LINUX_INSTALL.md](LINUX_INSTALL.md) (Nginx reverse proxy, LAN binding, firewall, uninstaller)
- 🔧 **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md) (Port conflicts, logs, memory limits)
- 📐 **Animation Conventions**: [SPRITE_RULES.md](SPRITE_RULES.md) (Standard 8-frame rules, pivot lines, engine specs)

---

## 🚀 Local Development Quick Start
- **Node.js** (v18.0.0 or higher recommended, Node 20 LTS preferred)
- **npm** (v9.0.0+) or **pnpm** / **yarn**

Verify your environment:
```bash
node -v
npm -v
```

### 2. Clone the Repository
```bash
git clone https://github.com/your-username/elysian-sprite-studio.git
cd elysian-sprite-studio
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env
```
*(Optional: Provide `GEMINI_API_KEY` in `.env` if using AI animation breakdown extensions).*
*(Optional: Provide `OPENAI_API_KEY` in `.env` if using the AI Character Generator).*

### 5. Launch the Development Server
```bash
npm run dev
```
Open your browser and navigate to:
```
http://localhost:3000
```

### 6. Production Build & Deployment
To create an optimized production build:
```bash
npm run build
npm start
```

---

## 🎮 Core Features

| Feature | Description |
| :--- | :--- |
| **8-Frame Sequence Engine** | Optimized for standard 8-frame walk/run/jump/idle cycles with sub-millisecond precision. |
| **Custom Upload & Grid Slicer** | Drag-and-drop your own sprite sheets (PNG, JPG, WebP) with configurable column/row slicing, offset, and cell dimensions. |
| **Alpha Transparency Masking** | Smart Euclidean color distance chroma-keying with configurable edge feathering and despill filters to extract clean sprites without halo artifacts. |
| **Interactive 60 FPS Arena** | Playable physics platformer sandbox. Test character animations seamlessly with keyboard controls (`A`/`D`/Arrows + `Space`/`Up`) and Web Audio SFX. |
| **Multi-Engine Export** | 1-Click exports for Godot 4 `SpriteFrames`, Unity 2D Sprite Editor, Phaser 3 Texture Atlas, and CSS `@keyframes`. |
| **Batch ZIP Packaging** | Download master 8x3 PNG tilesets, 24 individual transparent PNGs, or 3 single-action horizontal strips. |

---

## 📁 Project Structure

```
elysian-sprite-studio/
├── .env.example              # Template environment variables
├── index.html                # Single Page App HTML entry point
├── metadata.json             # AI Studio and platform capabilities
├── package.json              # Project dependencies & scripts
├── tsconfig.json             # TypeScript compiler settings
├── vite.config.ts            # Vite & Tailwind CSS bundler configuration
├── server.ts                 # Full-stack Express server with Vite middleware
├── SPRITE_RULES.md           # Game animation conventions & standard rules
├── ARCHITECTURE.md           # System design & component interaction docs
└── src/
    ├── main.tsx              # React entry root
    ├── App.tsx               # Main application controller
    ├── index.css             # Tailwind v4 theme & canvas patterns
    ├── types/
    │   └── sprites.ts        # TypeScript interfaces & definitions
    ├── data/
    │   └── spriteData.ts     # Default character animation packs
    ├── utils/
    │   ├── imageProcessor.ts # Canvas slicing, chroma-keying, and ZIP builder
    │   └── repoExporter.ts   # GitHub project exporter & source downloader
    └── components/
        ├── TopBar.tsx          # 3-Zone top navigation header
        ├── StudioPlayer.tsx    # Playback scrubber, filmstrip, & onion skin
        ├── SpriteSlicer.tsx    # Upload & interactive grid slicing editor
        ├── TilesetMatrix.tsx   # Master tileset compiler & engine code viewer
        ├── ActionArena.tsx     # 60 FPS playable physics arena
        ├── FrameInspector.tsx  # Frame-by-frame zoom & single-frame download
        ├── ExportModal.tsx     # Quick download modal (PNG / ZIP / Strips)
        └── GithubGuideView.tsx # Repository export, install guide, & rules
```

---

## 🛠️ Supported Game Engines

### Godot 4.x
- Standard `AnimatedSprite2D` workflow.
- Direct JSON / `.tres` import support with configurable frame speeds.

### Unity 2022+ / 6
- 2D Sprite Multi-Slice compatible.
- Bottom-Center pivot point alignment for standard 2D Character Controllers.

### Phaser 3 & PixiJS
- Standard TexturePacker JSON Hash and Array format.
- Pre-built `this.anims.create` configuration snippets.

### Web & HTML5 Canvas
- Pure CSS `@keyframes` with `steps(8)` and `image-rendering: pixelated;`.

---

## 📜 License
This project is licensed under the Apache 2.0 License.
