/**
 * services/storage.js
 * ─────────────────────────────────────────────────────────────────────────────
 * S3-compatible object storage service abstraction.
 *
 * Supports MinIO (local development) and AWS S3 (future production).
 * Switching between them requires only environment variable changes —
 * no business logic modifications.
 *
 * Integration points:
 *   - Routes call storage.uploadImage() / deleteImage() / getImageUrl()
 *   - Server.js initialises the bucket on startup
 *   - Environment variables in .env / docker-compose
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Expected environment variables:
 *   STORAGE_ENDPOINT   – e.g. http://minio:9000 (MinIO) or https://s3.amazonaws.com (AWS)
 *   STORAGE_ACCESS_KEY – access key ID
 *   STORAGE_SECRET_KEY – secret access key
 *   STORAGE_BUCKET     – bucket name, e.g. learning-german-images
 *   STORAGE_REGION     – region, e.g. us-east-1 (default)
 *   USE_PATH_STYLE     – true for MinIO / false for AWS S3
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListBucketsCommand, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');

// ── Configuration (read from environment) ──────────────────────────────────
const ENDPOINT     = process.env.STORAGE_ENDPOINT;
const ACCESS_KEY   = process.env.STORAGE_ACCESS_KEY;
const SECRET_KEY   = process.env.STORAGE_SECRET_KEY;
const BUCKET       = process.env.STORAGE_BUCKET || 'learning-german-images';
const REGION       = process.env.STORAGE_REGION || 'us-east-1';
const USE_PATH_STYLE = process.env.USE_PATH_STYLE === 'true';
const PUBLIC_ENDPOINT = (process.env.PUBLIC_STORAGE_ENDPOINT || '').replace(/\/+$/, '');
const PUBLIC_READ = process.env.STORAGE_PUBLIC_READ === 'true';

let client = null;
let bucketReady = false;

// Allowed MIME types for image uploads
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const EXT_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/**
 * Get (or lazily create) the S3 client.
 */
function getClient() {
  if (client) return client;
  if (!ENDPOINT || !ACCESS_KEY || !SECRET_KEY) {
    console.warn('[Storage] Missing STORAGE_ENDPOINT, STORAGE_ACCESS_KEY, or STORAGE_SECRET_KEY — storage service disabled');
    return null;
  }
  client = new S3Client({
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
    },
    region: REGION,
    forcePathStyle: USE_PATH_STYLE,
    requestHandler: {
      requestTimeout: 15000,
      connectionTimeout: 10000,
    },
  });
  return client;
}

/**
 * Initialise the storage service: verify connection and create bucket if needed.
 * Called once from server.js on startup.
 */
async function initBucket() {
  const c = getClient();
  if (!c) {
    console.warn('[Storage] Skipping bucket init — client not configured');
    return false;
  }
  try {
    console.log(`[Storage] Checking bucket "${BUCKET}" at ${ENDPOINT} ...`);
    try {
      await c.send(new HeadBucketCommand({ Bucket: BUCKET }));
      console.log(`[Storage] Bucket "${BUCKET}" already exists`);
    } catch (err) {
      if (err.name === 'NotFound' || err.name === 'NoSuchBucket') {
        console.log(`[Storage] Creating bucket "${BUCKET}" ...`);
        await c.send(new CreateBucketCommand({ Bucket: BUCKET }));
        console.log(`[Storage] Bucket "${BUCKET}" created successfully`);
      } else if (err.$metadata?.httpStatusCode === 403 || err.name === 'AccessDenied' || err.name === 'Forbidden') {
        console.log(`[Storage] Bucket "${BUCKET}" returned 403 Forbidden on HeadBucket — assuming bucket exists with object-level permissions.`);
      } else {
        throw err;
      }
    }
    bucketReady = true;
    if (PUBLIC_READ) {
      try {
        await c.send(new PutBucketPolicyCommand({
          Bucket: BUCKET,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${BUCKET}/*`],
            }],
          }),
        }));
        console.log(`[Storage] Bucket "${BUCKET}" set to public-read (anonymous GET allowed)`);
      } catch (err) {
        console.error(`[Storage] Failed to apply public-read policy to "${BUCKET}":`, err.message);
      }
    }
    return true;
  } catch (err) {
    console.error(`[Storage] Failed to initialise bucket "${BUCKET}":`, err.message);
    if (err.$metadata) {
      console.error(`[Storage] Request ID: ${err.$metadata.requestId}, HTTP status: ${err.$metadata.httpStatusCode}`);
    }
    bucketReady = false;
    return false;
  }
}

// ── Helper: validate image type ────────────────────────────────────────────
function validateMime(mimetype) {
  return ALLOWED_MIME.has(mimetype);
}

function extFromMime(mimetype) {
  return EXT_MAP[mimetype] || '.jpg';
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Upload an image to the object store.
 *
 * @param {string}  objectKey  – unique key / path inside the bucket
 * @param {Buffer}  buffer     – raw file bytes
 * @param {string}  mimetype   – MIME type for Content-Type header
 * @returns {{ key: string, url: string }}  object key + accessible URL
 */
async function uploadImage(objectKey, buffer, mimetype) {
  if (!validateMime(mimetype)) {
    throw new Error(`Unsupported image type: ${mimetype}. Allowed: ${[...ALLOWED_MIME].join(', ')}`);
  }
  const c = getClient();
  if (!c) throw new Error('Storage service is not configured');

  await c.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
    Body: buffer,
    ContentType: mimetype,
  }));
  console.log(`[Storage] Uploaded: ${objectKey} (${(buffer.length / 1024).toFixed(1)} KB)`);
  return { key: objectKey, url: getImageUrl(objectKey) };
}

/**
 * Delete an image from the object store.
 *
 * @param {string} objectKey
 */
async function deleteImage(objectKey) {
  if (!objectKey) return;
  const c = getClient();
  if (!c) return;
  try {
    await c.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey }));
    console.log(`[Storage] Deleted: ${objectKey}`);
  } catch (err) {
    console.error(`[Storage] Failed to delete "${objectKey}":`, err.message);
  }
}

/**
 * Get the URL a browser can use to load the object.
 *
 * When PUBLIC_STORAGE_ENDPOINT is set, a direct object-store URL is returned
 * (e.g. http://host:9000/<bucket>/<key>) so the web app fetches images straight
 * from MinIO. The bucket must allow anonymous GET (public-read policy).
 *
 * Otherwise it falls back to the Express image-proxy path for compatibility.
 *
 * @param {string} objectKey
 * @returns {string} URL for <img> tags
 */
function getImageUrl(objectKey) {
  if (!objectKey) return '';
  if (PUBLIC_ENDPOINT) {
    const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');
    return `${PUBLIC_ENDPOINT}/${BUCKET}/${encodedKey}`;
  }
  return `/api/german/images/${encodeURIComponent(objectKey)}`;
}

/**
 * Resolve an object key from any stored image URL shape:
 *  - Express proxy: /api/{area}/images/{encodedKey}
 *  - Direct MinIO:  {PUBLIC_ENDPOINT}/{BUCKET}/{key}
 *
 * @param {string} url
 * @returns {string|null} object key, or null if the URL is not a known shape
 */
function getKeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const proxyPrefixes = [
    '/api/german/images/',
    '/api/notes/images/',
    '/api/wishlist/images/',
    '/api/avatar/images/',
  ];
  for (const prefix of proxyPrefixes) {
    if (url.startsWith(prefix)) {
      try {
        return decodeURIComponent(url.slice(prefix.length));
      } catch (_) {
        return null;
      }
    }
  }
  if (PUBLIC_ENDPOINT && url.startsWith(PUBLIC_ENDPOINT)) {
    const rest = url.slice(PUBLIC_ENDPOINT.length).replace(/^\//, '');
    if (rest === BUCKET) return '';
    if (rest.startsWith(BUCKET + '/')) {
      const key = rest.slice(BUCKET.length + 1);
      try {
        return key.split('/').map(decodeURIComponent).join('/');
      } catch (_) {
        return null;
      }
    }
  }

  // Fallback: match a direct MinIO/S3 URL shape ({host}/{bucket}/{key}) on any
  // host. This keeps URLs resolvable even if PUBLIC_STORAGE_ENDPOINT changed
  // after the image was uploaded.
  if (/^https?:\/\//i.test(url)) {
    const match = url.match(/^https?:\/\/[^/]+(?::\d+)?\/([^/?#]+)\/(.+)$/i);
    if (match && decodeURIComponent(match[1]) === BUCKET) {
      try {
        return match[2].split('?')[0].split('/').map(decodeURIComponent).join('/');
      } catch (_) {
        return null;
      }
    }
  }
  return null;
}

/**
 * Replace an existing image with a new one (upload then delete old).
 *
 * @param {string|null} oldKey   – previous object key (null if first upload)
 * @param {Buffer}      buffer   – new file bytes
 * @param {string}      mimetype – MIME type
 * @param {string}      newKey   – new object key (generated if omitted)
 * @returns {{ key: string, url: string }}
 */
async function updateImage(oldKey, buffer, mimetype, newKey) {
  if (oldKey) {
    // Silently delete the old object (best-effort)
    try { await deleteImage(oldKey); } catch (_) {}
  }
  return uploadImage(newKey, buffer, mimetype);
}

/**
 * Fetch an object's raw bytes + content type directly from the object store.
 *
 * Used by the PDF exporters to embed images as data URIs WITHOUT an HTTP
 * round-trip through the Express image-proxy route. Works with both MinIO
 * and real AWS S3 (same client / credentials as the rest of the service).
 *
 * @param {string} objectKey
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
async function getImageBuffer(objectKey) {
  const c = getClient();
  if (!c) throw new Error('Storage service is not configured');

  const data = await c.send(new GetObjectCommand({ Bucket: BUCKET, Key: objectKey }));
  const contentType = data.ContentType || 'image/jpeg';
  const body = data.Body;
  if (!body) throw new Error('Empty object body');

  let buffer;
  if (typeof body.transformToByteArray === 'function') {
    buffer = Buffer.from(await body.transformToByteArray());
  } else if (typeof body.transformToString === 'function') {
    buffer = Buffer.from(await body.transformToString(), 'binary');
  } else if (Buffer.isBuffer(body)) {
    buffer = body;
  } else {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  }

  return { buffer, contentType };
}

/**
 * Stream an object's content to an Express response.
 * Used by the GET /api/german/images/:key proxy route.
 *
 * @param {string}   objectKey
 * @param {object}   res – Express response object
 */
async function streamImage(objectKey, res) {
  const c = getClient();
  if (!c) {
    res.status(503).json({ message: 'Storage service not available' });
    return;
  }
  try {
    const data = await c.send(new GetObjectCommand({ Bucket: BUCKET, Key: objectKey }));
    if (data.ContentType) res.setHeader('Content-Type', data.ContentType);
    if (data.ContentLength) res.setHeader('Content-Length', data.ContentLength);
    // Stream the object body to the response
    const stream = data.Body;
    if (stream && typeof stream.pipe === 'function') {
      stream.pipe(res);
    } else if (stream) {
      // Some SDK versions return a readable stream or a Blob
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      res.end(Buffer.concat(chunks));
    } else {
      res.status(404).json({ message: 'Image not found' });
    }
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      res.status(404).json({ message: 'Image not found' });
    } else {
      console.error(`[Storage] Error streaming "${objectKey}":`, err.message);
      res.status(500).json({ message: 'Failed to retrieve image' });
    }
  }
}

/**
 * Check whether the storage service is ready.
 */
function isReady() {
  return bucketReady;
}

module.exports = {
  initBucket,
  uploadImage,
  deleteImage,
  getImageUrl,
  getKeyFromUrl,
  updateImage,
  getImageBuffer,
  streamImage,
  isReady,
  validateMime,
  extFromMime,
};
