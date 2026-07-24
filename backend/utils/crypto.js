const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size in bytes

function getKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'evolvio_default_encryption_secret_key_12345';
  // Derive a solid 32-byte key from the secret via SHA-256
  return crypto.createHash('sha256').update(String(secret)).digest();
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
  try {
    const textParts = text.split(':');
    if (textParts.length !== 2) return '';
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[Crypto] Decryption failed:', err.message);
    return '[Decryption Error]';
  }
}

module.exports = { encrypt, decrypt };
