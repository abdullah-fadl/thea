import crypto from 'crypto';

const RAW_STORE_ENABLED = String(process.env.IDENTITY_STORE_RAW || '0') === '1';
const RAW_STORE_KEY = String(process.env.IDENTITY_STORE_RAW_KEY || '');

type EncryptedIdentityValue = {
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
};

function getKeyBuffer(): Buffer | null {
  if (!RAW_STORE_ENABLED || !RAW_STORE_KEY) return null;
  const key = RAW_STORE_KEY.length >= 32 ? RAW_STORE_KEY.slice(0, 32) : RAW_STORE_KEY.padEnd(32, '0');
  return Buffer.from(key, 'utf8');
}

export function maybeEncryptIdentityValue(value: string): EncryptedIdentityValue | null {
  const key = getKeyBuffer();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value || ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}
