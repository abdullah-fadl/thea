import crypto from 'crypto';

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashIdentityValue(value: string): string {
  const pepper = String(process.env.IDENTITY_HASH_PEPPER || '');
  return sha256(`${pepper}${value}`);
}
