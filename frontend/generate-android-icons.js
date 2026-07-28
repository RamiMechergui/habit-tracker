/**
 * generate-android-icons.js
 * Generates all Android mipmap icons from logo_circle.png using sharp.
 * Run with: node generate-android-icons.js
 */
import sharp from 'sharp';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOURCE = join(__dirname, 'public', 'logo_circle.png');
const RES_DIR = join(__dirname, 'android', 'app', 'src', 'main', 'res');

// Android mipmap densities: name -> size in px
const MIPMAP_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

// Adaptive icon foreground sizes (108dp * density multiplier)
const ADAPTIVE_FG_SIZES = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

const circleSvg = (size) => `<svg width="${size}" height="${size}">
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white" />
</svg>`;

async function generate() {
  console.log('Generating Android icons from logo_circle.png...\n');

  for (const [density, size] of Object.entries(MIPMAP_SIZES)) {
    const dir = join(RES_DIR, `mipmap-${density}`);
    if (!existsSync(dir)) continue;

    // ic_launcher.png — full icon with white circle background
    const bgPad = Math.round(size * 0.1);
    const innerSize = size - bgPad * 2;
    const logoBuffer = await sharp(SOURCE)
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .composite([{
        input: Buffer.from(circleSvg(innerSize)),
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    await sharp(logoBuffer)
      .extend({
        top: bgPad, bottom: bgPad, left: bgPad, right: bgPad,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .resize(size, size)
      .png()
      .toFile(join(dir, 'ic_launcher.png'));
    console.log(`  [${density}] ic_launcher.png (${size}x${size})`);

    // ic_launcher_round.png — same as ic_launcher (logo is already circular)
    await sharp(join(dir, 'ic_launcher.png'))
      .png()
      .toFile(join(dir, 'ic_launcher_round.png'));
    console.log(`  [${density}] ic_launcher_round.png (${size}x${size})`);

    // ic_launcher_foreground.png — logo only, no background padding, for adaptive icon
    const fgSize = ADAPTIVE_FG_SIZES[density];
    await sharp(SOURCE)
      .resize(fgSize, fgSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(join(dir, 'ic_launcher_foreground.png'));
    console.log(`  [${density}] ic_launcher_foreground.png (${fgSize}x${fgSize})`);
  }

  // Also put a copy in drawable/ for the adaptive icon foreground reference
  const drawableDir = join(RES_DIR, 'drawable');
  if (existsSync(drawableDir)) {
    await sharp(SOURCE)
      .resize(432, 432, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(join(drawableDir, 'ic_launcher_foreground.png'));
    console.log(`  [drawable] ic_launcher_foreground.png (432x432)`);
  }

  console.log('\nAll Android icons generated successfully!');
}

generate().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
