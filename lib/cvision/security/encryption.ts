import crypto from 'crypto';
import { logger } from '@/lib/monitoring/logger';

const ALGORITHM = 'aes-256-gcm';

/**
 * Prefix used to identify ciphertext produced by this module.
 * Using a versioned prefix avoids false-positive detection based on
 * the presence of `:` alone (e.g. phone numbers, IBANs, URLs).
 */
const CIPHER_PREFIX = 'enc_v1:';

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ENCRYPTION_KEY environment variable is not set. ' +
          'Refusing to use the insecure development fallback key in production.'
      );
    }
    // Development fallback — never use in production.
    logger.warn(
      '[cvision/encryption] WARNING: ENCRYPTION_KEY is not set. ' +
        'Using the insecure development fallback key. ' +
        'Set ENCRYPTION_KEY to a 64-character hex string before deploying.'
    );
    return crypto.scryptSync('cvision-dev-key-not-for-production', 'salt', 32);
  }
  return Buffer.from(keyHex, 'hex');
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  // Format: enc_v1:<ivHex>:<tagHex>:<ciphertextHex>
  return `${CIPHER_PREFIX}${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText.startsWith(CIPHER_PREFIX)) {
    throw new Error('Invalid encrypted text format: missing enc_v1: prefix');
  }
  // Strip the versioned prefix before splitting on `:`.
  const body = encryptedText.slice(CIPHER_PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted text format');
  const [ivHex, tagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Fields that must be encrypted at rest.
 * Map of collection name → array of dot-notated paths.
 */
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  cvision_employees: ['nationalId', 'bankIBAN', 'phone'],
  cvision_employee_insurance: ['membershipNumber', 'cardNumber'],
  cvision_paycards: ['cardNumber'],
  cvision_insurance_providers: ['apiIntegration.apiKey'],
  cvision_integrations: ['config.apiKey', 'config.clientSecret'],
};

/**
 * Get a nested value from an object using dot notation.
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Set a nested value on an object using dot notation.
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce((o, k) => {
    if (!o[k]) o[k] = {};
    return o[k];
  }, obj);
  target[last] = value;
}

/**
 * Encrypt sensitive fields in a document before storing.
 */
export function encryptDocument(collection: string, doc: any): any {
  const fields = ENCRYPTED_FIELDS[collection];
  if (!fields) return doc;

  const copy = { ...doc };
  for (const field of fields) {
    const val = getNestedValue(copy, field);
    if (val && typeof val === 'string' && !val.startsWith(CIPHER_PREFIX)) {
      // Only encrypt if not already in encrypted format
      setNestedValue(copy, field, encrypt(val));
    }
  }
  return copy;
}

/**
 * Decrypt sensitive fields in a document after reading.
 */
export function decryptDocument(collection: string, doc: any): any {
  const fields = ENCRYPTED_FIELDS[collection];
  if (!fields || !doc) return doc;

  const copy = { ...doc };
  for (const field of fields) {
    const val = getNestedValue(copy, field);
    if (val && typeof val === 'string' && val.startsWith(CIPHER_PREFIX)) {
      try {
        setNestedValue(copy, field, decrypt(val));
      } catch {
        // If decryption fails, leave as-is (might be plaintext from before encryption was enabled)
      }
    }
  }
  return copy;
}

/**
 * Hash a value (one-way) for lookups without revealing data.
 */
export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
