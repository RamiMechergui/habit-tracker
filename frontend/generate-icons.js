/**
 * generate-icons.js
 * Generates all required PWA icon sizes from logo.png using sharp.
 * Crops the icons into clean circles to remove any black rectangular borders.
 * Run with: node generate-icons.js
 */
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOURCE = join(__dirname, 'public', 'logo.png');
const OUT_DIR = join(__dirname, 'public', 'icons');

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

const circleSvg = (size) => `<svg width="${size}" height="${size}">
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white" />
</svg>`;

async function generate() {
  console.log('🎨 Generating circular PWA icons from logo.png...\n');

  for (const size of SIZES) {
    const outPath = join(OUT_DIR, `icon-${size}x${size}.png`);
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .composite([{
        input: Buffer.from(circleSvg(size)),
        blend: 'dest-in'
      }])
      .png()
      .toFile(outPath);
    console.log(`  ✅ icon-${size}x${size}.png (transparent circle)`);
  }

  // Maskable icon — with 10% safe-zone padding (background fill)
  const maskablePath = join(OUT_DIR, 'icon-512x512-maskable.png');
  const innerSize = 410;
  
  const croppedLogo = await sharp(SOURCE)
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .composite([{
      input: Buffer.from(circleSvg(innerSize)),
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();

  const pad = Math.floor((512 - innerSize) / 2); // 51px padding on all sides
  await sharp(croppedLogo)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 8, g: 10, b: 14, alpha: 1 } // Dark background (#080a0e)
    })
    .resize(512, 512)
    .png()
    .toFile(maskablePath);
  console.log('  ✅ icon-512x512-maskable.png (opaque padded circle)');

  // Apple touch icon (180x180)
  const applePath = join(OUT_DIR, 'apple-touch-icon.png');
  const appleInnerSize = 144; // ~80% of 180
  
  const appleCroppedLogo = await sharp(SOURCE)
    .resize(appleInnerSize, appleInnerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .composite([{
      input: Buffer.from(circleSvg(appleInnerSize)),
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();

  const applePad = Math.floor((180 - appleInnerSize) / 2);
  await sharp(appleCroppedLogo)
    .extend({
      top: applePad,
      bottom: applePad,
      left: applePad,
      right: applePad,
      background: { r: 8, g: 10, b: 14, alpha: 1 }
    })
    .resize(180, 180)
    .png()
    .toFile(applePath);
  console.log('  ✅ apple-touch-icon.png (opaque padded circle)');

  console.log('\n✨ All circular icons generated successfully!');
}

generate().catch((err) => {
  console.error('❌ Icon generation failed:', err);
  process.exit(1);
});
