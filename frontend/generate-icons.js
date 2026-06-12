/**
 * generate-icons.js
 * Generates all required PWA icon sizes from logo.png using sharp.
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

async function generate() {
  console.log('🎨 Generating PWA icons from logo.png...\n');

  for (const size of SIZES) {
    const outPath = join(OUT_DIR, `icon-${size}x${size}.png`);
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 8, g: 10, b: 14, alpha: 1 } })
      .png()
      .toFile(outPath);
    console.log(`  ✅ icon-${size}x${size}.png`);
  }

  // Maskable icon — with 10% safe-zone padding (background fill)
  const maskablePath = join(OUT_DIR, 'icon-512x512-maskable.png');
  await sharp(SOURCE)
    .resize(410, 410, { fit: 'contain', background: { r: 8, g: 10, b: 14, alpha: 1 } })
    .extend({ top: 51, bottom: 51, left: 51, right: 51, background: { r: 8, g: 10, b: 14, alpha: 1 } })
    .resize(512, 512)
    .png()
    .toFile(maskablePath);
  console.log('  ✅ icon-512x512-maskable.png');

  // Apple touch icon (180x180)
  const applePath = join(OUT_DIR, 'apple-touch-icon.png');
  await sharp(SOURCE)
    .resize(180, 180, { fit: 'contain', background: { r: 8, g: 10, b: 14, alpha: 1 } })
    .png()
    .toFile(applePath);
  console.log('  ✅ apple-touch-icon.png');

  console.log('\n✨ All icons generated successfully!');
}

generate().catch((err) => {
  console.error('❌ Icon generation failed:', err);
  process.exit(1);
});
