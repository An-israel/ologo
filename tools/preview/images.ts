/** Draws simple flat garment illustrations for the preview server (no real photos needed). */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SHAPES: Record<string, string> = {
  jumper: 'M468 520 L640 440 Q768 520 896 440 L1068 520 L1300 900 L1170 980 L1080 820 L1080 1640 L456 1640 L456 820 L366 980 L236 900 Z',
  hoodie: 'M468 560 L600 470 Q600 300 768 300 Q936 300 936 470 L1068 560 L1300 940 L1170 1020 L1080 860 L1080 1640 L456 1640 L456 860 L366 1020 L236 940 Z M620 1180 L916 1180 L956 1400 L580 1400 Z',
  jeans: 'M520 400 L1016 400 L1060 1700 L840 1700 L768 820 L696 1700 L476 1700 Z',
  dress: 'M640 380 Q768 450 896 380 L960 700 L1180 1720 L356 1720 L576 700 Z M560 420 L460 760 L540 780 L620 520 Z M976 420 L1076 760 L996 780 L916 520 Z',
  jacket: 'M468 540 L620 440 Q768 520 916 440 L1068 540 L1300 940 L1170 1020 L1080 860 L1080 1600 L456 1600 L456 860 L366 1020 L236 940 Z M766 520 L770 1600',
  scarf: 'M560 380 L976 380 L976 560 L860 560 L900 1700 L700 1700 L740 560 L560 560 Z',
  beanie: 'M468 1240 Q468 700 768 700 Q1068 700 1068 1240 Z M440 1240 L1096 1240 L1096 1420 L440 1420 Z',
  brushes: 'M520 1700 L560 900 L600 1700 Z M680 1700 L720 760 L760 1700 Z M840 1700 L880 820 L920 1700 Z M1000 1700 L1030 980 L1060 1700 Z',
  detail: 'M300 400 L1236 400 L1236 1650 L300 1650 Z',
};

export async function ensureImage(dir: string, name: string, shape: string, colour: string): Promise<string> {
  const file = path.join(dir, `${name}.jpg`);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(dir, { recursive: true });
  const d = SHAPES[shape] ?? SHAPES.detail;
  const pattern = shape === 'detail' || shape === 'jumper'
    ? `<pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M0 40 Q20 0 40 40 T80 40" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="6"/></pattern>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="2048" viewBox="0 0 1536 2048">
    <defs>${pattern}<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f4ef"/><stop offset="1" stop-color="#ebe7df"/></linearGradient></defs>
    <rect width="1536" height="2048" fill="url(#bg)"/>
    <ellipse cx="768" cy="1790" rx="460" ry="40" fill="rgba(0,0,0,0.06)"/>
    <path d="${d}" fill="${colour}" fill-rule="evenodd"/>
    ${pattern ? `<path d="${d}" fill="url(#p)" fill-rule="evenodd"/>` : ''}
  </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 78, mozjpeg: true }).toFile(file);
  return file;
}
