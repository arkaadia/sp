import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate brand SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#141822"/>
      <stop offset="50%" stop-color="#0c0f16"/>
      <stop offset="100%" stop-color="#07090e"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>
  <rect x="16" y="16" width="480" height="480" rx="92" fill="none" stroke="#f59e0b" stroke-opacity="0.25" stroke-width="6"/>
  <!-- Glowing Diamond Core -->
  <g transform="translate(256,256) rotate(45)" filter="url(#glow)">
    <rect x="-96" y="-96" width="192" height="192" rx="28" fill="url(#gold)"/>
    <rect x="-64" y="-64" width="128" height="128" rx="18" fill="#0f131a"/>
    <rect x="-36" y="-36" width="72" height="72" rx="10" fill="url(#gold)"/>
  </g>
  <!-- Accent Sprite Pixels -->
  <rect x="110" y="110" width="28" height="28" rx="6" fill="#fbbf24" fill-opacity="0.8"/>
  <rect x="374" y="110" width="28" height="28" rx="6" fill="#fbbf24" fill-opacity="0.8"/>
  <rect x="110" y="374" width="28" height="28" rx="6" fill="#fbbf24" fill-opacity="0.8"/>
  <rect x="374" y="374" width="28" height="28" rx="6" fill="#fbbf24" fill-opacity="0.8"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

function crc32(buf, offset = 0, length = buf.length - offset) {
  let crc = 0xffffffff;
  for (let i = offset; i < offset + length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  const crcBuf = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcBuf);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

function renderSpriteIconPNG(size, isMaskable = false) {
  // Generates crisp RGBA buffer
  const rawData = Buffer.alloc(size * (size * 4 + 1));
  const center = size / 2;
  const radius = isMaskable ? size * 0.38 : size * 0.44;
  const diamondSize = isMaskable ? size * 0.22 : size * 0.28;

  let pos = 0;
  for (let y = 0; y < size; y++) {
    rawData[pos++] = 0; // Filter byte 0 (None)
    for (let x = 0; x < size; x++) {
      // Background: dark slate gradient
      const bgR = 14 + Math.round((y / size) * 8);
      const bgG = 17 + Math.round((y / size) * 8);
      const bgB = 25 + Math.round((y / size) * 8);

      // Distance from center
      const dx = x - center;
      const dy = y - center;

      // Rotated 45-deg diamond check: |dx| + |dy| <= diamondSize * sqrt(2)
      const diamondDist = Math.abs(dx * 0.7071 - dy * 0.7071) + Math.abs(dx * 0.7071 + dy * 0.7071);

      let r = bgR;
      let g = bgG;
      let b = bgB;
      let a = 255;

      // Outer rounded rect border for non-maskable
      const cornerDist = Math.max(Math.abs(dx), Math.abs(dy));
      if (!isMaskable && cornerDist > radius) {
        a = 0; // Transparent outside bounds
      } else if (!isMaskable && Math.abs(cornerDist - radius) < 2) {
        // Subtle golden border
        r = 245; g = 158; b = 11; a = 120;
      }

      // Golden diamond core
      if (a > 0 && diamondDist <= diamondSize) {
        if (diamondDist > diamondSize * 0.75) {
          // Outer gold bevel
          r = 251; g = 191; b = 36;
        } else if (diamondDist > diamondSize * 0.42) {
          // Inner dark core
          r = 16; g = 20; b = 28;
        } else {
          // Center gold crest
          r = 245; g = 158; b = 11;
        }
      }

      rawData[pos++] = r;
      rawData[pos++] = g;
      rawData[pos++] = b;
      rawData[pos++] = a;
    }
  }

  // Compress with zlib
  const compressedData = zlib.deflateSync(rawData, { level: 9 });

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate PWA icons
console.log('Writing PWA icons...');
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), renderSpriteIconPNG(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), renderSpriteIconPNG(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), renderSpriteIconPNG(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), renderSpriteIconPNG(180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), renderSpriteIconPNG(32, false));

console.log('PWA icon generation complete!');
