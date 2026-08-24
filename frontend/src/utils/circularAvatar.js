/**
 * circularAvatar.js — browser-only.
 *
 * pdfmake has no native border-radius / circular-clip support for images, so
 * the standard approach is to pre-clip the photo into a circular PNG (with
 * transparent corners) and embed that. Both PDF builders run client-side, so we
 * can use <canvas> freely.
 */

const DATA_IMG = /^data:image\/(png|jpe?g|gif|webp);/i;

let sharedCanvas = null;
function getCanvas() {
  if (typeof document === "undefined") return null;
  if (!sharedCanvas) sharedCanvas = document.createElement("canvas");
  return sharedCanvas;
}

/**
 * Clip a data-URL image into a circular PNG of the given size.
 * Falls back to the original data URL on any failure (no image support, decode
 * error, missing canvas, tainted source, ...).
 *
 * @param {string} dataUrl
 * @param {number} [size]  Output edge length in pixels (square).
 * @returns {Promise<string>} Circular PNG data URL (or the original input).
 */
export async function toCircularAvatar(dataUrl, size = 96) {
  if (!dataUrl || !DATA_IMG.test(dataUrl)) return dataUrl;
  const c = getCanvas();
  if (!c || typeof Image === "undefined") return dataUrl;

  const img = new Image();
  const loaded = new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("image decode failed"));
  });
  img.src = dataUrl;
  try {
    await loaded;
  } catch (e) {
    return dataUrl;
  }

  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, 0, 0, size, size);

  try {
    return c.toDataURL("image/png");
  } catch (e) {
    return dataUrl;
  }
}

/**
 * Replace each dialogue/story participant's photoBase64 with a circular PNG
 * version. Returns a shallow-copied record array — the input is never mutated.
 *
 * @param {Array} data  Flat record array (schema from buildReportData).
 * @returns {Promise<Array>}
 */
export async function withCircularAvatars(data) {
  const out = Array.isArray(data)
    ? data.map(r => (r && (r.type === "dialogue" || r.type === "story")) ? { ...r } : r)
    : data;
  if (!Array.isArray(out)) return out;

  await Promise.all(out.map(async r => {
    if (!r || (r.type !== "dialogue" && r.type !== "story") || !Array.isArray(r.participants)) return;
    const participants = await Promise.all(r.participants.map(async p => {
      if (!p || !p.photoBase64) return p;
      const avatar = await toCircularAvatar(p.photoBase64);
      return avatar === p.photoBase64 ? p : { ...p, photoBase64: avatar };
    }));
    r.participants = participants;
  }));
  return out;
}
