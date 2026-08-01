/**
 * services/pdfImageInliner.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Rewrites every <img> in a PDF's HTML whose src is a RELATIVE path (e.g.
 * `/api/german/images/...`) into a base64 data URI, so Puppeteer renders the
 * image without needing to resolve a public URL / <base href>.
 *
 * Preferred path: the src URL is mapped back to its S3 object key and the
 * bytes are read DIRECTLY from the object store (MinIO or AWS S3) using the
 * same S3 client the app already uses — no HTTP round-trip through Express,
 * so it is immune to nginx/proxy/protocol/public-IP problems.
 *
 * Fallback: if the URL is not an S3 proxy URL (or the store is unreachable),
 * the image is fetched over HTTP from the backend itself (127.0.0.1).
 */

const storage = require('./storage');

async function fetchDataUri(src, baseUrl) {
  // 1) Direct object-store read (Express proxy URLs AND direct MinIO URLs).
  const objectKey = storage.getKeyFromUrl(src);
  if (objectKey !== null) {
    try {
      const { buffer, contentType } = await storage.getImageBuffer(objectKey);
      if (buffer && buffer.length > 0) {
        return `data:${contentType};base64,${buffer.toString('base64')}`;
      }
    } catch (_) {
      // fall through to HTTP fallback
    }
  }

  // 2) HTTP fallback (non-store relative URLs or store read failure).
  if (!baseUrl || /^[a-z][a-z0-9+.-]*:/i.test(src)) return null;
  let url;
  try {
    url = new URL(src, baseUrl).toString();
  } catch (_) {
    return null;
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (_) {
    return null;
  }
}

async function inlineImages(html, baseUrl) {
  if (!html || typeof html !== 'string') return html;

  const imgTagRe = /<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi;
  const replacements = [];
  const cache = new Map(); // src → data URI (same image may appear in several <img> tags)

  let match;
  while ((match = imgTagRe.exec(html)) !== null) {
    const full = match[0];
    const src = match[1];

    // Skip empty and data-URI URLs. Absolute non-store URLs are left as-is.
    if (!src || src.startsWith('data:')) continue;
    if (storage.getKeyFromUrl(src) === null && /^[a-z][a-z0-9+.-]*:/i.test(src)) continue;

    let dataUri = cache.get(src);
    if (dataUri === undefined) {
      dataUri = await fetchDataUri(src, baseUrl);
      if (!dataUri) continue; // leave the original src on failure
      cache.set(src, dataUri);
    }
    replacements.push({ index: match.index, length: full.length, replacement: full.replace(src, dataUri) });
  }

  // Apply replacements from the end so earlier indexes stay valid.
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    html = html.slice(0, r.index) + r.replacement + html.slice(r.index + r.length);
  }

  return html;
}

module.exports = { inlineImages };
