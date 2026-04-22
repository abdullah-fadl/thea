/**
 * Field-Level Encryption — AES-256-GCM
 *
 * Application-level encryption for sensitive patient data (PHI/PII).
 * Uses AES-256-GCM with authenticated encryption.
 *
 * Backward compatible: plain string fields (old data) are returned as-is.
 * In development mode (no FIELD_ENCRYPTION_KEY): data stored unencrypted.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

interface EncryptedField {
  __enc: true;        // marker to identify encrypted fields
  alg: 'aes-256-gcm';
  iv: string;         // base64
  tag: string;        // base64
  data: string;       // base64
}

function getKey(): Buffer {
  const keyStr = process.env.FIELD_ENCRYPTION_KEY || '';
  if (!keyStr || keyStr.length < 32) {
    // In development, allow unencrypted operation with warning
    if (process.env.NODE_ENV === 'development') {
      return Buffer.alloc(0);
    }
    throw new Error('FIELD_ENCRYPTION_KEY must be set with at least 32 characters for production');
  }
  return Buffer.from(keyStr.slice(0, 32), 'utf8');
}

export function isEncryptionEnabled(): boolean {
  const keyStr = process.env.FIELD_ENCRYPTION_KEY || '';
  return keyStr.length >= 32;
}

export function encryptField(value: string): EncryptedField | string {
  const key = getKey();
  if (key.length === 0) return value; // dev mode — store plain

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const enc: EncryptedField = {
    __enc: true,
    alg: ALGORITHM,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
  // Serialize to string for Prisma/PostgreSQL String columns
  return JSON.stringify(enc);
}

export function decryptField(field: EncryptedField | string | null | undefined): string {
  // If null/undefined, return empty
  if (field == null) return '';
  // If string: may be plain (dev/old) or JSON-serialized encrypted
  if (typeof field === 'string') {
    const raw = field;
    try {
      const parsed = JSON.parse(raw) as EncryptedField;
      if (parsed?.__enc) field = parsed;
      else return raw; // plain string
    } catch {
      return raw; // plain string
    }
  }
  if (!field || typeof field !== 'object' || !('__enc' in field) || !field.__enc) return String(field);

  const key = getKey();
  if (key.length === 0) return '[encrypted]'; // can't decrypt without key

  try {
    const iv = Buffer.from(field.iv, 'base64');
    const tag = Buffer.from(field.tag, 'base64');
    const data = Buffer.from(field.data, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    // Decryption failure — return placeholder rather than crash
    return '[decryption_error]';
  }
}

// ── Per-collection sensitive field definitions ──

const SENSITIVE_FIELDS: Record<string, string[]> = {
  patients: ['firstName', 'middleName', 'lastName', 'phone', 'email', 'nationalId', 'insuranceId'],
  patient_master: ['firstName', 'middleName', 'lastName', 'mobile', 'email'],
  // Add more collections as needed
};

// Fields inside nested 'identifiers' object
const SENSITIVE_IDENTIFIER_FIELDS = ['nationalId', 'iqama', 'passport', 'insuranceId'];

/**
 * Encrypt sensitive fields in a document before saving to DB
 */
export function encryptDocument<T extends Record<string, unknown>>(
  collection: string,
  doc: T
): T {
  const fields = SENSITIVE_FIELDS[collection];
  if (!fields || !isEncryptionEnabled()) return doc;

  const encrypted: Record<string, unknown> = { ...doc };

  // Top-level fields
  for (const field of fields) {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      encrypted[field] = encryptField(encrypted[field] as string);
    }
  }

  // Nested identifiers object
  if (encrypted.identifiers && typeof encrypted.identifiers === 'object') {
    const ids: Record<string, unknown> = { ...(encrypted.identifiers as Record<string, unknown>) };
    for (const field of SENSITIVE_IDENTIFIER_FIELDS) {
      if (ids[field] && typeof ids[field] === 'string') {
        ids[field] = encryptField(ids[field] as string);
      }
    }
    encrypted.identifiers = ids;
  }

  // Store search hashes for searchable encrypted fields
  const docRecord = doc as Record<string, unknown>;
  const identifiers = docRecord.identifiers as Record<string, unknown> | undefined;
  if (identifiers) {
    if (identifiers.nationalId && typeof identifiers.nationalId === 'string') {
      encrypted.nationalId_hash = hashForSearch(identifiers.nationalId);
    }
    if (identifiers.iqama && typeof identifiers.iqama === 'string') {
      encrypted.iqama_hash = hashForSearch(identifiers.iqama);
    }
    if (identifiers.passport && typeof identifiers.passport === 'string') {
      encrypted.passport_hash = hashForSearch(identifiers.passport);
    }
  }

  // Store name hash for search
  if (docRecord.fullName && typeof docRecord.fullName === 'string') {
    encrypted.fullName_hash = hashForSearch(docRecord.fullName);
  }

  return encrypted as T;
}

/**
 * Decrypt sensitive fields in a document after reading from DB
 */
export function decryptDocument<T extends Record<string, unknown>>(
  collection: string,
  doc: T | null
): T {
  if (!doc) return doc as T;
  const fields = SENSITIVE_FIELDS[collection];
  if (!fields) return doc;

  const decrypted: Record<string, unknown> = { ...doc };

  // Top-level fields
  for (const field of fields) {
    if (decrypted[field]) {
      decrypted[field] = decryptField(decrypted[field] as string);
    }
  }

  // Nested identifiers object
  if (decrypted.identifiers && typeof decrypted.identifiers === 'object') {
    const ids: Record<string, unknown> = { ...(decrypted.identifiers as Record<string, unknown>) };
    for (const field of SENSITIVE_IDENTIFIER_FIELDS) {
      if (ids[field]) {
        ids[field] = decryptField(ids[field] as string);
      }
    }
    decrypted.identifiers = ids;
  }

  return decrypted as T;
}

/**
 * Decrypt an array of documents
 */
export function decryptDocuments<T extends Record<string, unknown>>(
  collection: string,
  docs: T[]
): T[] {
  return docs.map(doc => decryptDocument(collection, doc));
}

/**
 * Encrypt a single value for search index (deterministic — same input = same output)
 * Used for creating searchable encrypted indexes (e.g., search by nationalId)
 */
export function hashForSearch(value: string): string {
  const key = getKey();
  if (key.length === 0) return value;
  return crypto.createHmac('sha256', key).update(value.toLowerCase().trim()).digest('hex');
}
