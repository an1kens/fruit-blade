#!/usr/bin/env node
/**
 * VFX splats, power-up badges, and HUD icons — same cute-juicy-flat language as fruit sprites.
 * Run: node scripts/generate-vfx-sprites.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'assets');

const PAL = {
  outline: '#5D4037',
  outlineW: 2,
  shine: 'rgba(255,255,255,0.75)',
};

function wrap(id, defs, shapes, size = 128) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${id}">
  <defs>${defs}</defs>
  <g>${shapes}</g>
</svg>`;
}

const stroke = `stroke="${PAL.outline}" stroke-width="${PAL.outlineW}" stroke-linejoin="round" stroke-linecap="round"`;

/** Juice splats — irregular blobs with soft inner glow */
const splats = {
  'splat-1': {
    defs: `<radialGradient id="g" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FF8A80"/>
      <stop offset="100%" stop-color="#E53935"/>
    </radialGradient>`,
    shapes: `
      <path d="M64 20 C88 28 108 48 104 72 C100 96 82 108 64 112 C46 108 28 96 24 72 C20 48 40 28 64 20 Z"
        fill="url(#g)" opacity="0.92"/>
      <ellipse cx="52" cy="48" rx="14" ry="10" fill="${PAL.shine}" opacity="0.5"/>`,
  },
  'splat-2': {
    defs: `<radialGradient id="g" cx="35%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#FFCC80"/>
      <stop offset="100%" stop-color="#FF6F00"/>
    </radialGradient>`,
    shapes: `
      <path d="M30 58 C34 34 58 22 78 30 C102 38 112 62 100 82 C88 102 62 108 42 98 C22 88 26 72 30 58 Z"
        fill="url(#g)" opacity="0.9"/>
      <circle cx="48" cy="52" r="8" fill="${PAL.shine}" opacity="0.45"/>`,
  },
  'splat-3': {
    defs: `<radialGradient id="g" cx="45%" cy="38%" r="68%">
      <stop offset="0%" stop-color="#CE93D8"/>
      <stop offset="100%" stop-color="#8E24AA"/>
    </radialGradient>`,
    shapes: `
      <path d="M64 26 C92 32 110 54 106 78 C102 102 78 114 58 110 C38 106 18 88 22 62 C26 36 48 22 64 26 Z"
        fill="url(#g)" opacity="0.88"/>
      <ellipse cx="70" cy="50" rx="10" ry="7" fill="${PAL.shine}" opacity="0.4"/>`,
  },
  'splat-4': {
    defs: `<radialGradient id="g" cx="38%" cy="32%" r="72%">
      <stop offset="0%" stop-color="#A5D6A7"/>
      <stop offset="100%" stop-color="#43A047"/>
    </radialGradient>`,
    shapes: `
      <path d="M64 18 C86 24 114 42 108 68 C102 94 80 112 58 108 C36 104 18 82 22 56 C26 30 48 14 64 18 Z"
        fill="url(#g)" opacity="0.9"/>
      <circle cx="50" cy="44" r="7" fill="${PAL.shine}" opacity="0.5"/>`,
  },
  'flesh-edge': {
    defs: `<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFEBEE"/>
      <stop offset="50%" stop-color="#FFCDD2"/>
      <stop offset="100%" stop-color="#EF5350"/>
    </linearGradient>`,
    shapes: `
      <rect x="60" y="16" width="8" height="96" rx="4" fill="url(#g)" ${stroke}/>
      <ellipse cx="64" cy="64" rx="3" ry="40" fill="rgba(255,255,255,0.35)"/>`,
  },
};

/** Power-up banana badges */
const powerups = {
  freeze: {
    defs: `<linearGradient id="g" x1="20%" y1="10%" x2="80%" y2="90%">
      <stop offset="0%" stop-color="#81D4FA"/>
      <stop offset="100%" stop-color="#0288D1"/>
    </linearGradient>`,
    shapes: `
      <path d="M28 82 C34 36 62 26 90 46 C86 86 54 102 28 82 Z" fill="#FFEB3B" ${stroke}/>
      <circle cx="64" cy="64" r="22" fill="url(#g)" ${stroke}/>
      <path d="M64 50 L64 78 M50 64 L78 64 M54 54 L74 74 M74 54 L54 74"
        fill="none" stroke="#E1F5FE" stroke-width="3.5" stroke-linecap="round"/>`,
  },
  frenzy: {
    defs: `<linearGradient id="g" x1="25%" y1="15%" x2="75%" y2="85%">
      <stop offset="0%" stop-color="#FF8A80"/>
      <stop offset="100%" stop-color="#D50000"/>
    </linearGradient>`,
    shapes: `
      <path d="M28 82 C34 36 62 26 90 46 C86 86 54 102 28 82 Z" fill="#FFEB3B" ${stroke}/>
      <circle cx="64" cy="64" r="22" fill="url(#g)" ${stroke}/>
      <path d="M64 48 L72 68 L58 60 L70 72 L54 68 L66 78 L64 48 Z"
        fill="#FFEB3B" ${stroke}/>`,
  },
  double: {
    defs: `<linearGradient id="g" x1="20%" y1="10%" x2="80%" y2="90%">
      <stop offset="0%" stop-color="#B9F6CA"/>
      <stop offset="100%" stop-color="#00C853"/>
    </linearGradient>`,
    shapes: `
      <path d="M28 82 C34 36 62 26 90 46 C86 86 54 102 28 82 Z" fill="#FFEB3B" ${stroke}/>
      <circle cx="64" cy="64" r="22" fill="url(#g)" ${stroke}/>
      <text x="64" y="72" text-anchor="middle" font-family="Segoe UI, sans-serif"
        font-size="22" font-weight="bold" fill="#E8F5E9">×2</text>`,
  },
};

/** HUD icons — 64px viewBox for crisp small rendering */
const icons = {
  heart: {
    size: 64,
    defs: `<linearGradient id="g" x1="30%" y1="20%" x2="70%" y2="90%">
      <stop offset="0%" stop-color="#FF8A80"/>
      <stop offset="100%" stop-color="#E53935"/>
    </linearGradient>`,
    shapes: `
      <path d="M32 54 C18 42 10 32 14 22 C18 12 28 12 32 18 C36 12 46 12 50 22 C54 32 46 42 32 54 Z"
        fill="url(#g)" ${stroke}/>`,
  },
  timer: {
    size: 64,
    defs: '',
    shapes: `
      <circle cx="32" cy="34" r="22" fill="rgba(42,38,64,0.35)" ${stroke}/>
      <circle cx="32" cy="34" r="18" fill="none" stroke="#FFE566" stroke-width="3"/>
      <path d="M32 34 L32 22" stroke="#FFFAF5" stroke-width="3" stroke-linecap="round"/>
      <path d="M32 34 L42 38" stroke="#FFFAF5" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="28" y="8" width="8" height="6" rx="2" fill="#8D6E63"/>`,
  },
  combo: {
    size: 64,
    defs: `<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF176"/>
      <stop offset="100%" stop-color="#FFB300"/>
    </linearGradient>`,
    shapes: `
      <circle cx="32" cy="32" r="24" fill="url(#g)" ${stroke}/>
      <path d="M22 32 L28 38 L42 24" fill="none" stroke="#5D4037" stroke-width="3.5"
        stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="46" cy="18" r="8" fill="#FF5252" ${stroke}/>
      <text x="46" y="22" text-anchor="middle" font-family="Segoe UI, sans-serif"
        font-size="10" font-weight="bold" fill="#FFFAF5">!</text>`,
  },
  bomb: {
    size: 64,
    defs: `<radialGradient id="g" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#78909C"/>
      <stop offset="100%" stop-color="#37474F"/>
    </radialGradient>`,
    shapes: `
      <circle cx="32" cy="36" r="18" fill="url(#g)" ${stroke}/>
      <circle cx="26" cy="32" r="3" fill="#ECEFF1"/>
      <circle cx="38" cy="32" r="3" fill="#ECEFF1"/>
      <path d="M32 18 L32 10" stroke="#8D6E63" stroke-width="3" stroke-linecap="round"/>
      <circle cx="32" cy="8" r="4" fill="#FF9800" ${stroke}/>`,
  },
  pause: {
    size: 64,
    defs: '',
    shapes: `
      <circle cx="32" cy="32" r="26" fill="rgba(42,38,64,0.5)" ${stroke}/>
      <rect x="24" y="22" width="6" height="20" rx="2" fill="#FFFAF5"/>
      <rect x="34" y="22" width="6" height="20" rx="2" fill="#FFFAF5"/>`,
  },
};

async function writeSprites(dir, sprites, defaultSize = 128) {
  await mkdir(dir, { recursive: true });
  for (const [name, art] of Object.entries(sprites)) {
    const size = art.size || defaultSize;
    const { defs, shapes } = art;
    await writeFile(join(dir, `${name}.svg`), wrap(name, defs, shapes, size), 'utf8');
    console.log(`Wrote ${join(dir, `${name}.svg`)}`);
  }
}

await writeSprites(join(ROOT, 'vfx'), splats);
await writeSprites(join(ROOT, 'powerups'), powerups);
await writeSprites(join(ROOT, 'icons'), icons, 64);

const total = Object.keys(splats).length + Object.keys(powerups).length + Object.keys(icons).length;
console.log(`\nGenerated ${total} VFX/HUD sprites.`);
