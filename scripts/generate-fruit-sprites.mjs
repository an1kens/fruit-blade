#!/usr/bin/env node
/**
 * Cute juicy fruit sprites — clean flat shapes, saturated candy colour, soft inner glow.
 * Run: node scripts/generate-fruit-sprites.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'assets', 'fruits');

const PAL = {
  outline: '#5D4037',
  outlineW: 2,
  shine: 'rgba(255,255,255,0.82)',
  shineSm: 'rgba(255,255,255,0.5)',
  leaf: '#5FD068',
  stem: '#8D6E63',
};

function wrap(id, defs, shapes) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="${id}">
  <defs>${defs}</defs>
  <g>${shapes}</g>
</svg>`;
}

const stroke = `stroke="${PAL.outline}" stroke-width="${PAL.outlineW}" stroke-linejoin="round" stroke-linecap="round"`;

/** Big friendly gloss — same spot on every fruit */
const shine = (cx = 47, cy = 54, r = 9) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${PAL.shine}"/>
   <circle cx="${cx + 6}" cy="${cy + 5}" r="${r * 0.32}" fill="${PAL.shineSm}"/>`;

/** One soft inner warmth — reads juicy without extra detail */
const juice = (cx, cy, rx, ry, color, opacity = 0.38) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${opacity}"/>`;

const sprites = {
  apple: {
    defs: `<radialGradient id="g" cx="38%" cy="30%" r="68%">
      <stop offset="0%" stop-color="#FF8A8A"/>
      <stop offset="55%" stop-color="#FF4757"/>
      <stop offset="100%" stop-color="#E8293F"/>
    </radialGradient>`,
    shapes: `
      <circle cx="64" cy="68" r="40" fill="url(#g)" ${stroke}/>
      ${juice(72, 78, 16, 12, '#FF1744')}
      <rect x="61" y="24" width="6" height="11" rx="3" fill="${PAL.stem}"/>
      <ellipse cx="78" cy="32" rx="11" ry="6" fill="${PAL.leaf}" ${stroke}/>
      ${shine(46, 56)}`,
  },

  banana: {
    defs: `<linearGradient id="g" x1="18%" y1="12%" x2="82%" y2="88%">
      <stop offset="0%" stop-color="#FFF176"/>
      <stop offset="50%" stop-color="#FFEB3B"/>
      <stop offset="100%" stop-color="#FFC107"/>
    </linearGradient>`,
    shapes: `
      <path d="M30 84 C36 34 66 24 94 46 C90 88 56 104 30 84 Z" fill="url(#g)" ${stroke}/>
      <path d="M40 74 C56 58 74 48 86 44" fill="none" stroke="${PAL.shine}" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
      <circle cx="92" cy="42" r="6" fill="#A1887F" ${stroke}/>`,
  },

  orange: {
    defs: `<radialGradient id="g" cx="36%" cy="32%" r="66%">
      <stop offset="0%" stop-color="#FFD180"/>
      <stop offset="50%" stop-color="#FF9800"/>
      <stop offset="100%" stop-color="#F57C00"/>
    </radialGradient>`,
    shapes: `
      <circle cx="64" cy="68" r="40" fill="url(#g)" ${stroke}/>
      ${juice(70, 76, 14, 11, '#FF6D00')}
      <circle cx="64" cy="30" r="4" fill="${PAL.stem}" opacity="0.45"/>
      ${shine(46, 56)}`,
  },

  watermelon: {
    defs: `<radialGradient id="g" cx="45%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#FF8A80"/>
      <stop offset="100%" stop-color="#FF5252"/>
    </radialGradient>`,
    shapes: `
      <circle cx="64" cy="68" r="42" fill="url(#g)" ${stroke}/>
      <path d="M24 68 A40 40 0 0 1 104 68" fill="none" stroke="#43A047" stroke-width="11" stroke-linecap="round"/>
      <path d="M24 68 A40 40 0 0 1 104 68" fill="none" stroke="#69F0AE" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
      <circle cx="52" cy="62" r="2.5" fill="#5D4037" opacity="0.28"/>
      <circle cx="74" cy="66" r="2.5" fill="#5D4037" opacity="0.28"/>
      <circle cx="62" cy="78" r="2.5" fill="#5D4037" opacity="0.28"/>
      ${shine(46, 56)}`,
  },

  pineapple: {
    defs: `<linearGradient id="g" x1="30%" y1="15%" x2="70%" y2="95%">
      <stop offset="0%" stop-color="#FFEE58"/>
      <stop offset="100%" stop-color="#FFB300"/>
    </linearGradient>`,
    shapes: `
      <ellipse cx="64" cy="74" rx="32" ry="36" fill="url(#g)" ${stroke}/>
      ${juice(68, 82, 14, 10, '#FF8F00', 0.32)}
      <path d="M42 40 L50 24 L58 40 Z" fill="${PAL.leaf}" ${stroke}/>
      <path d="M54 38 L64 20 L74 38 Z" fill="${PAL.leaf}" ${stroke}/>
      <path d="M66 40 L74 24 L82 40 Z" fill="${PAL.leaf}" ${stroke}/>
      ${shine(50, 60, 8)}`,
  },

  strawberry: {
    defs: `<radialGradient id="g" cx="50%" cy="32%" r="72%">
      <stop offset="0%" stop-color="#FF80AB"/>
      <stop offset="100%" stop-color="#F50057"/>
    </radialGradient>`,
    shapes: `
      <path d="M64 34 L92 70 L80 100 L48 100 L36 70 Z" fill="url(#g)" ${stroke}/>
      ${juice(68, 82, 12, 10, '#C51162', 0.3)}
      <path d="M46 40 L56 28 L64 34 L72 28 L82 40 Z" fill="${PAL.leaf}" ${stroke}/>
      <circle cx="54" cy="64" r="2.2" fill="#FFEB3B"/>
      <circle cx="64" cy="58" r="2.2" fill="#FFEB3B"/>
      <circle cx="74" cy="64" r="2.2" fill="#FFEB3B"/>
      ${shine(50, 54, 8)}`,
  },

  mango: {
    defs: `<radialGradient id="g" cx="34%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#FFE082"/>
      <stop offset="45%" stop-color="#FFB300"/>
      <stop offset="100%" stop-color="#FF6F00"/>
    </radialGradient>`,
    shapes: `
      <path d="M88 46 C102 62 100 92 76 104 C50 112 30 90 32 64 C34 38 56 26 78 32 Z"
        fill="url(#g)" ${stroke}/>
      ${juice(74, 80, 16, 12, '#FF3D00', 0.35)}
      ${shine(44, 50, 8)}`,
  },

  kiwi: {
    defs: `<radialGradient id="flesh" cx="42%" cy="38%" r="58%">
      <stop offset="0%" stop-color="#C5E1A5"/>
      <stop offset="100%" stop-color="#7CB342"/>
    </radialGradient>`,
    shapes: `
      <circle cx="64" cy="68" r="40" fill="#A1887F" ${stroke}/>
      <circle cx="64" cy="68" r="30" fill="url(#flesh)" ${stroke}/>
      ${juice(70, 74, 12, 10, '#558B2F', 0.28)}
      <circle cx="64" cy="68" r="9" fill="#FFF9C4" ${stroke}/>
      <circle cx="64" cy="54" r="2.2" fill="#5D4037" opacity="0.25"/>
      <circle cx="76" cy="62" r="2.2" fill="#5D4037" opacity="0.25"/>
      <circle cx="72" cy="76" r="2.2" fill="#5D4037" opacity="0.25"/>
      <circle cx="52" cy="76" r="2.2" fill="#5D4037" opacity="0.25"/>
      <circle cx="48" cy="62" r="2.2" fill="#5D4037" opacity="0.25"/>
      ${shine(46, 56)}`,
  },

  coconut: {
    defs: `<radialGradient id="g" cx="35%" cy="30%" r="68%">
      <stop offset="0%" stop-color="#D7CCC8"/>
      <stop offset="100%" stop-color="#8D6E63"/>
    </radialGradient>`,
    shapes: `
      <circle cx="64" cy="68" r="40" fill="url(#g)" ${stroke}/>
      <circle cx="52" cy="60" r="6" fill="#5D4037" ${stroke}/>
      <circle cx="76" cy="60" r="6" fill="#5D4037" ${stroke}/>
      <circle cx="64" cy="82" r="6" fill="#5D4037" ${stroke}/>
      ${shine(46, 56)}`,
  },

  peach: {
    defs: `<radialGradient id="g" cx="38%" cy="28%" r="68%">
      <stop offset="0%" stop-color="#FFCCBC"/>
      <stop offset="50%" stop-color="#FF8A65"/>
      <stop offset="100%" stop-color="#FF5722"/>
    </radialGradient>`,
    shapes: `
      <circle cx="64" cy="68" r="40" fill="url(#g)" ${stroke}/>
      ${juice(72, 76, 14, 11, '#E64A19', 0.32)}
      <path d="M64 28 C66 50 66 86 64 106" fill="none" stroke="#FF7043" stroke-width="2.5" stroke-linecap="round" opacity="0.65"/>
      <ellipse cx="64" cy="28" rx="7" ry="4" fill="${PAL.leaf}" ${stroke}/>
      ${shine(46, 56)}`,
  },

  bomb: {
    defs: `<radialGradient id="g" cx="34%" cy="28%" r="70%">
      <stop offset="0%" stop-color="#78909C"/>
      <stop offset="100%" stop-color="#37474F"/>
    </radialGradient>`,
    shapes: `
      <circle cx="64" cy="72" r="36" fill="url(#g)" ${stroke}/>
      <circle cx="54" cy="64" r="6" fill="#ECEFF1" ${stroke}/>
      <circle cx="74" cy="64" r="6" fill="#ECEFF1" ${stroke}/>
      <circle cx="54" cy="65" r="2.2" fill="#5D4037" opacity="0.45"/>
      <circle cx="74" cy="65" r="2.2" fill="#5D4037" opacity="0.45"/>
      <path d="M58 76 Q64 82 70 76" fill="none" stroke="#ECEFF1" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M64 36 L64 22" stroke="${PAL.stem}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="64" cy="18" r="6" fill="#FF9800" ${stroke}/>
      <circle cx="64" cy="18" r="3" fill="#FFEB3B"/>`,
  },
};

await mkdir(OUT_DIR, { recursive: true });

for (const [name, art] of Object.entries(sprites)) {
  await writeFile(join(OUT_DIR, `${name}.svg`), wrap(name, art.defs, art.shapes), 'utf8');
  console.log(`Wrote ${join(OUT_DIR, `${name}.svg`)}`);
}

console.log(`\nGenerated ${Object.keys(sprites).length} juicy-minimal sprites.`);
