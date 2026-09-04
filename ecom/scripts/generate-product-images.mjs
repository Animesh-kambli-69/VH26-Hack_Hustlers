// Generates simple, self-contained SVG product images (offline-friendly).
// Run with: npm run generate:images
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'client', 'public', 'products');
fs.mkdirSync(outDir, { recursive: true });

const products = [
  { file: 'headphones.svg', emoji: '🎧', c1: '#6366f1', c2: '#a855f7' },
  { file: 'smartwatch.svg', emoji: '⌚', c1: '#0ea5e9', c2: '#6366f1' },
  { file: 'speaker.svg', emoji: '🔊', c1: '#f59e0b', c2: '#ef4444' },
  { file: 'powerbank.svg', emoji: '🔋', c1: '#10b981', c2: '#0ea5e9' },
  { file: 'camera.svg', emoji: '📷', c1: '#334155', c2: '#64748b' },
  { file: 'sneakers.svg', emoji: '👟', c1: '#ef4444', c2: '#f97316' },
  { file: 'jacket.svg', emoji: '🧥', c1: '#1d4ed8', c2: '#0ea5e9' },
  { file: 'sunglasses.svg', emoji: '🕶️', c1: '#f59e0b', c2: '#84cc16' },
  { file: 'coffee.svg', emoji: '☕', c1: '#92400e', c2: '#d97706' },
  { file: 'pillow.svg', emoji: '🛏️', c1: '#8b5cf6', c2: '#d946ef' },
  { file: 'plant.svg', emoji: '🪴', c1: '#16a34a', c2: '#65a30d' },
  { file: 'book1.svg', emoji: '📚', c1: '#0f766e', c2: '#14b8a6' },
  { file: 'book2.svg', emoji: '📖', c1: '#be123c', c2: '#f43f5e' },
  { file: 'yogamat.svg', emoji: '🧘', c1: '#7c3aed', c2: '#c084fc' },
  { file: 'bottle.svg', emoji: '🥤', c1: '#0284c7', c2: '#38bdf8' },
];

const svg = (emoji, c1, c2) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <circle cx="400" cy="430" r="250" fill="rgba(255,255,255,0.30)"/>
  <circle cx="400" cy="430" r="190" fill="rgba(255,255,255,0.25)"/>
  <text x="400" y="430" font-size="250" text-anchor="middle" dominant-baseline="central">${emoji}</text>
</svg>
`;

for (const p of products) {
  fs.writeFileSync(path.join(outDir, p.file), svg(p.emoji, p.c1, p.c2));
}

console.log(`Generated ${products.length} product images in ${outDir}`);
