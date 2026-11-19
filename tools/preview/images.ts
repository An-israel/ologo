/** Draws sample garment images for the preview server (no real photos available in development). */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SHAPES: Record<string, string> = {
  jumper: 'M468 520 L640 440 Q768 520 896 440 L1068 520 L1300 900 L1170 980 L1080 820 L1080 1640 L456 1640 L456 820 L366 980 L236 900 Z',
  hoodie: 'M468 560 L600 470 Q600 300 768 300 Q936 300 936 470 L1068 560 L1300 940 L1170 1020 L1080 860 L1080 1640 L456 1640 L456 860 L366 1020 L236 940 Z',
  jeans: 'M520 400 L1016 400 L1060 1700 L840 1700 L768 820 L696 1700 L476 1700 Z',
  dress: 'M640 380 Q768 450 896 380 L960 700 L1180 1720 L356 1720 L576 700 Z M560 420 L460 760 L540 780 L620 520 Z M976 420 L1076 760 L996 780 L916 520 Z',
  jacket: 'M468 540 L620 440 Q768 520 916 440 L1068 540 L1300 940 L1170 1020 L1080 860 L1080 1600 L456 1600 L456 860 L366 1020 L236 940 Z',
  scarf: 'M560 380 L976 380 L976 560 L860 560 L900 1700 L700 1700 L740 560 L560 560 Z',
  beanie: 'M468 1240 Q468 700 768 700 Q1068 700 1068 1240 Z M440 1240 L1096 1240 L1096 1420 L440 1420 Z',
  brushes: 'M520 1700 L560 900 L600 1700 Z M680 1700 L720 760 L760 1700 Z M840 1700 L880 820 L920 1700 Z M1000 1700 L1030 980 L1060 1700 Z',
  detail: 'M300 400 L1236 400 L1236 1650 L300 1650 Z',
};

const DETAILS: Record<string, string> = {
  hoodie: '<path d="M620 1180 L916 1180 L956 1400 L580 1400 Z" fill="rgba(0,0,0,0.14)"/><path d="M700 470 L720 760 M836 470 L816 760" stroke="rgba(255,255,255,0.55)" stroke-width="10" stroke-linecap="round"/>',
  jacket: '<path d="M766 520 L770 1600" stroke="rgba(0,0,0,0.25)" stroke-width="10"/><path d="M520 1000 L680 1000 M860 1000 L1020 1000" stroke="rgba(0,0,0,0.18)" stroke-width="12" stroke-linecap="round"/>',
  jumper: '<path d="M456 1560 L1080 1560" stroke="rgba(0,0,0,0.15)" stroke-width="40"/><path d="M640 440 Q768 520 896 440" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="22"/>',
  jeans: '<path d="M768 420 L768 820" stroke="rgba(255,255,255,0.35)" stroke-width="8"/><path d="M560 470 Q620 540 700 470" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="8"/>',
  beanie: '<path d="M440 1300 L1096 1300 M440 1360 L1096 1360" stroke="rgba(0,0,0,0.12)" stroke-width="14"/>',
};

const shade = (colour: string, id: string) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colour}"/><stop offset="1" stop-color="${colour}" stop-opacity="0.82"/></linearGradient>`;

function garment(shape: string, colour: string, id: string): string {
  const d = SHAPES[shape] ?? SHAPES.detail;
  const knit = shape === 'jumper' || shape === 'detail' || shape === 'scarf' || shape === 'beanie';
  return `<g>
    <path d="${d}" fill="${colour}" fill-rule="evenodd"/>
    <path d="${d}" fill="url(#${id}-s)" fill-rule="evenodd" opacity="0.35"/>
    ${knit ? `<path d="${d}" fill="url(#${id}-k)" fill-rule="evenodd"/>` : ''}
    ${DETAILS[shape] ?? ''}
  </g>`;
}

const defs = (id: string) => `
  <linearGradient id="${id}-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></linearGradient>
  <pattern id="${id}-k" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M0 28 Q14 0 28 28 T56 28" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="5"/></pattern>`;

export async function ensureImage(dir: string, name: string, shape: string, colour: string): Promise<string> {
  const file = path.join(dir, `${name}.jpg`);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(dir, { recursive: true });
  let svg: string;
  if (name === 'hero') svg = heroScene();
  else if (name === 'editorial') svg = editorialScene();
  else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="2048" viewBox="0 0 1536 2048">
      <defs>${defs('g')}${shade(colour, 'unused')}<radialGradient id="bg" cx="0.5" cy="0.42" r="0.75"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF"/></radialGradient></defs>
      <rect width="1536" height="2048" fill="url(#bg)"/>
      <ellipse cx="768" cy="1790" rx="470" ry="40" fill="rgba(15,23,42,0.06)"/>
      ${garment(shape, colour, 'g')}
    </svg>`;
  }
  const size = name === 'hero' ? { w: 1600, h: 1000 } : name === 'editorial' ? { w: 1600, h: 1200 } : null;
  let img = sharp(Buffer.from(svg));
  if (size) img = img.resize(size.w, size.h);
  await img.jpeg({ quality: 82, mozjpeg: true }).toFile(file);
  return file;
}

/** Landscape banner: warm backdrop, products arranged on the right so the text side stays calm. */
function heroScene(): string {
  const place = (shape: string, colour: string, id: string, x: number, y: number, s: number, r: number) =>
    `<g transform="translate(${x - 768 * s} ${y - 1024 * s}) scale(${s}) rotate(${r} 768 1024)">${garment(shape, colour, id)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1500" viewBox="0 0 2400 1500">
    <defs>${defs('a')}${defs('b')}${defs('c')}${defs('d')}
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F3F7F5"/></linearGradient>
    </defs>
    <rect width="2400" height="1500" fill="url(#bg)"/>
    <circle cx="1200" cy="760" r="600" fill="#E3F4EC"/>
    <ellipse cx="1200" cy="1330" rx="900" ry="60" fill="rgba(15,23,42,0.06)"/>
    ${place('scarf', '#F5EBDD', 'b', 640, 760, 0.62, -10)}
    ${place('jumper', '#047857', 'a', 1200, 700, 0.78, 0)}
    ${place('beanie', '#FB923C', 'c', 1800, 960, 0.5, 8)}
    ${place('jeans', '#1F2937', 'd', 1850, 560, 0.42, 12)}
  </svg>`;
}

function editorialScene(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
    <defs>${defs('e')}${defs('f')}<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DDE7F7"/><stop offset="1" stop-color="#C7D7F2"/></linearGradient></defs>
    <rect width="1600" height="1200" fill="url(#bg)"/>
    <circle cx="1250" cy="260" r="200" fill="#fff" opacity="0.5"/>
    <g transform="translate(200 40) scale(0.62)">${garment('jacket', '#5D6532', 'e')}</g>
    <g transform="translate(760 180) scale(0.52)">${garment('hoodie', '#C2491D', 'f')}</g>
  </svg>`;
}
