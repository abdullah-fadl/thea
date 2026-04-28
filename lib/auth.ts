/**
 * Node.js Runtime authentication functions
 * Uses Node.js specific libraries (jsonwebtoken, bcryptjs)
 *
 * JWT Key Rotation: Signs with current secret, verifies against current + previous.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { TokenPayload } from './auth/edge';
import { env } from './env';

const JWT_EXPIRES_IN = '1h';

// Re-export TokenPayload for convenience
export type { TokenPayload } from './auth/edge';

export function generateToken(payload: TokenPayload): string {
  // Always sign with CURRENT secret
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  // Try current secret first
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    // If current fails and previous secret exists, try previous
    if (env.JWT_SECRET_PREVIOUS) {
      try {
        return jwt.verify(token, env.JWT_SECRET_PREVIOUS) as TokenPayload;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
