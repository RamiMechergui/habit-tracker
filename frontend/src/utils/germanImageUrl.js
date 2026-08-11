/**
 * germanImageUrl.js
 *
 * Normalises any stored German-module image URL into something the browser can
 * always load.
 *
 * Stored photoUrl values can be:
 *   - an Express proxy path  (/api/german/images/<encoded-key>)
 *   - a direct MinIO/S3 URL  ({PUBLIC_STORAGE_ENDPOINT}/{bucket}/<key>)
 *   - a data:/blob: URI (in-memory uploads)
 *
 * Direct MinIO hosts are often NOT reachable from the user's browser (e.g.
 * localhost / private IP / blocked port), which silently breaks <img> tags and
 * the PDF image fetch. We route those through the backend proxy at
 * /api/german/images/url?u=... which resolves the stored URL back to its object
 * key and streams it over HTTPS from the API server.
 *
 * Express proxy-path URLs are also normalised to the /url?u=... resolver. This
 * keeps the requested URI free of trailing image extensions so nginx (or any
 * static/CDN layer) cannot intercept the request via a regex location for
 * static assets (.jpg/.png/...) before it reaches the API.
 */
export function germanImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) {
    return `/api/german/images/url?u=${encodeURIComponent(url)}`;
  }
  if (url.startsWith('/api/german/images/url?')) {
    return url;
  }
  if (url.startsWith('/api/german/images/')) {
    return `/api/german/images/url?u=${encodeURIComponent(url)}`;
  }
  return url;
}
