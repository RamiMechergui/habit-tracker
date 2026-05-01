import sharp from 'sharp';

async function analyze() {
  try {
    const meta = await sharp('C:/Users/Mechergui Rami/.gemini/antigravity/brain/tempmediaStorage/media__1777676920779.png').metadata();
    console.log("Dimensions:", meta.width, "x", meta.height);
  } catch(e) {
    console.error(e);
  }
}
analyze();
