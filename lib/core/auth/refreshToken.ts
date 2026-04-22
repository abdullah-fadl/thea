/**
 * Refresh Token Management
 *
 * Implements Access Token + Refresh Token pattern with:
 * - HttpOnly cookies
 * - Secure (production)
 * - SameSite=Strict
 * - Path=/
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { generateToken } from '@/lib/auth';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { v4 as uuidv4 } from 'uuid';
import { serialize } from 'cookie';

export interface RefreshToken {
  id: string; // UUID
  userId: string;
  token: string; // Hashed token
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  userAgent?: string;
  ip?: string;
  revoked: boolean;
}

const REFRESH_TOKEN_DURATION_DAYS = 30;
const ACCESS_TOKEN_DURATION_HOURS = 1;

/**
 * Create a refresh token for a user
 */
export async function createRefreshToken(
  userId: string,
  userAgent?: string,
  ip?: string
): Promise<string> {
  const token = uuidv4(); // Generate random token
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_DURATION_DAYS * 24 * 60 * 60 * 1000);

  // Hash token before storing (use simple hash for now, can be enhanced)
  const hashedToken = await hashToken(token);

  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashedToken,
      expiresAt,
      lastUsedAt: now,
      userAgent,
      ip,
      revoked: false,
    },
  });

  return token; // Return plain token (will be hashed when stored)
}

/**
 * Verify and use refresh token to generate new access token.
 * Implements token rotation: the used refresh token is revoked and a new one is issued.
 */
export async function refreshAccessToken(
  refreshToken: string,
  request: NextRequest
): Promise<{ userId: string; newRefreshToken: string } | null> {
  const hashedToken = await hashToken(refreshToken);

  const tokenDoc = await prisma.refreshToken.findFirst({
    where: {
      token: hashedToken,
      revoked: false,
    },
  });

  if (!tokenDoc) {
    // If a revoked token is reused, it may indicate token theft.
    // Revoke ALL tokens for the user associated with this token hash as a precaution.
    const revokedDoc = await prisma.refreshToken.findFirst({
      where: { token: hashedToken, revoked: true },
    });
    if (revokedDoc) {
      // Token reuse detected — revoke all tokens for this user (security measure)
      await prisma.refreshToken.updateMany({
        where: { userId: revokedDoc.userId, revoked: false },
        data: { revoked: true },
      });
    }
    return null;
  }

  // Check expiration
  if (new Date() > tokenDoc.expiresAt) {
    await prisma.refreshToken.update({
      where: { id: tokenDoc.id },
      data: { revoked: true },
    });
    return null;
  }

  // Rotate: revoke the current token
  await prisma.refreshToken.update({
    where: { id: tokenDoc.id },
    data: { revoked: true },
  });

  // Issue a new refresh token
  const userAgent = request.headers.get('user-agent') || undefined;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || undefined;
  const newRefreshToken = await createRefreshToken(tokenDoc.userId, userAgent, ip);

  return { userId: tokenDoc.userId, newRefreshToken };
}

/**
 * Revoke a refresh token
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  const hashedToken = await hashToken(token);

  await prisma.refreshToken.updateMany({
    where: { token: hashedToken },
    data: { revoked: true },
  });
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
}

/**
 * Hash token (simple implementation, can be enhanced)
 */
async function hashToken(token: string): Promise<string> {
  // Use Web Crypto API for hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Set refresh token cookie
 */
export function setRefreshTokenCookie(
  response: NextResponse,
  token: string,
  isProduction: boolean = false
): void {
  const cookieOptions: any = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: REFRESH_TOKEN_DURATION_DAYS * 24 * 60 * 60, // 30 days
  };

  // Don't set domain in development (allows localhost)
  // In production, domain should be set explicitly if needed
  if (isProduction && process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  response.headers.append(
    'Set-Cookie',
    serialize('refresh-token', token, cookieOptions)
  );
}

/**
 * Set access token cookie
 */
export function setAccessTokenCookie(
  response: NextResponse,
  token: string,
  isProduction: boolean = false
): void {
  const cookieOptions: any = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: ACCESS_TOKEN_DURATION_HOURS * 60 * 60, // 1 hour
  };

  // Don't set domain in development (allows localhost)
  // In production, domain should be set explicitly if needed
  if (isProduction && process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  response.headers.append(
    'Set-Cookie',
    serialize('auth-token', token, cookieOptions)
  );
}
