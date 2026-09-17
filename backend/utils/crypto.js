const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size in bytes

const CURRENT_FALLBACK = 'evolvio_default_encryption_secret_key_12345';
// Historical fallback secrets used in earlier EC2 deployments.
// Each entry allows data encrypted with that key to still be decrypted.
// DO NOT remove these — removing them will permanently break old stored passwords.
const LEGACY_FALLBACKS = [
  // Used in setup-server.sh initial EC2 provisioning (before proper key was set)
  '32_char_encryption_key_for_testing',
  // Used from .env.example placeholder on some deployments
  'your_32_char_encryption_key_here_',
  // Typo-era fallback (before commit 5003def)
  'evolvia_default_encryption_secret_key_12345',
];

function getSecret() {
  return process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || CURRENT_FALLBACK;
}

function deriveKey(secret) {
  // Derive a solid 32-byte key from the secret via SHA-256
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function getKey() {
  return deriveKey(getSecret());
}

function getLegacyKeys() {
  const current = getSecret();
  return LEGACY_FALLBACKS.filter(s => s !== current).map(deriveKey);
}

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(text) {
  if (!text) return '';
  const textParts = text.split(':');
  if (textParts.length !== 2) return '';
  const iv = Buffer.from(textParts[0], 'hex');
  const encryptedText = Buffer.from(textParts[1], 'hex');

  for (const key of [getKey(), ...getLegacyKeys()]) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      // Wrong key or corrupted data — try the next candidate key.
    }
  }

  console.error('[Crypto] Decryption failed: no matching key');
  return '[Decryption Error]';
}

module.exports = { encrypt, decrypt };
