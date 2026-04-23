import sharp from 'sharp';

async function makeCircularFavicon() {
  try {
    const size = 120;
    
    // Create a circular SVG mask
    const circleSvg = `<svg width="${size}" height="${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white" />
    </svg>`;

    await sharp('./public/logo.png')
      .resize(size, size)
      // Composite the image with the circular mask in dest-in mode
      .composite([{
        input: Buffer.from(circleSvg),
        blend: 'dest-in'
      }])
      .png()
      .toFile('./public/logo_circle.png');

    console.log('Successfully created circular favicon.');
  } catch (error) {
    console.error('Error creating circular favicon:', error);
  }
}

makeCircularFavicon();
