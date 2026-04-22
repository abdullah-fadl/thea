import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Offer Token Generator
 * Creates unique tokens for candidate offer portal access
 */

import { getPlatformClient } from '@/lib/db/mongo';
import { randomBytes } from 'crypto';

export interface OfferToken {
  token: string;
  tenantId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitleName: string;
  companyName: string;
  companyLogo?: string;
  offerAmount: number;
  offerCurrency: string;
  expiresAt: Date;
  active: boolean;
  createdAt: Date;
  createdBy: string;
  usedAt?: Date;
}

/**
 * Validate an offer token, enforcing tenant isolation.
 * Returns the token document only when the token belongs to the given tenant,
 * is still active, and has not expired.
 *
 * @param tenantId - The tenant that owns the token (must match the stored tenantId)
 * @param token    - The raw token string from the portal URL
 */
export async function validateOfferToken(
  tenantId: string,
  token: string
): Promise<OfferToken | null> {
  try {
    const { client } = await getPlatformClient();
    const tokensCollection = client.db('cvision_offer_tokens').collection('tokens');

    const tokenDoc = await tokensCollection.findOne({
      token,
      tenantId,   // <-- tenant isolation: cross-tenant tokens will never match
      active: true,
      expiresAt: { $gt: new Date() },
    });

    return (tokenDoc as unknown as OfferToken) ?? null;
  } catch (error) {
    logger.error('[validateOfferToken Error]', error);
    return null;
  }
}

/**
 * Generate a unique offer token for a candidate
 */
export async function generateOfferToken(
  tenantId: string,
  data: {
    candidateId: string;
    candidateName: string;
    candidateEmail: string;
    jobTitleName: string;
    companyName: string;
    companyLogo?: string;
    offerAmount: number;
    offerCurrency: string;
    expiryDays?: number;
    createdBy: string;
  }
): Promise<{ token: string; portalUrl: string }> {
  const { client } = await getPlatformClient();

  // Use a separate database for offer tokens (cross-tenant)
  const offerTokensDb = client.db('cvision_offer_tokens');
  const tokensCollection = offerTokensDb.collection('tokens');

  // Create index if not exists
  await tokensCollection.createIndex({ token: 1 }, { unique: true });
  await tokensCollection.createIndex({ candidateId: 1, tenantId: 1 });
  await tokensCollection.createIndex({ expiresAt: 1 });

  // Deactivate any previous tokens for this candidate
  await tokensCollection.updateMany(
    { candidateId: data.candidateId, tenantId, active: true },
    { $set: { active: false } }
  );

  // Generate secure token
  const token = randomBytes(32).toString('hex');

  // Calculate expiry (default 7 days)
  const expiryDays = data.expiryDays || 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const tokenDoc: OfferToken = {
    token,
    tenantId,
    candidateId: data.candidateId,
    candidateName: data.candidateName,
    candidateEmail: data.candidateEmail,
    jobTitleName: data.jobTitleName,
    companyName: data.companyName,
    companyLogo: data.companyLogo,
    offerAmount: data.offerAmount,
    offerCurrency: data.offerCurrency,
    expiresAt,
    active: true,
    createdAt: new Date(),
    createdBy: data.createdBy,
  };

  await tokensCollection.insertOne(tokenDoc as any);

  // Build portal URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const portalUrl = `${baseUrl}/offer-portal/${token}`;

  return { token, portalUrl };
}

/**
 * Get the portal URL for an existing active token
 */
export async function getOfferPortalUrl(
  tenantId: string,
  candidateId: string
): Promise<string | null> {
  try {
    const { client } = await getPlatformClient();
    const offerTokensDb = client.db('cvision_offer_tokens');
    const tokensCollection = offerTokensDb.collection('tokens');

    const tokenDoc = await tokensCollection.findOne({
      tenantId,
      candidateId,
      active: true,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) return null;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return `${baseUrl}/offer-portal/${tokenDoc.token}`;
  } catch (error) {
    logger.error('[getOfferPortalUrl Error]', error);
    return null;
  }
}

/**
 * Invalidate/deactivate an offer token
 */
export async function invalidateOfferToken(
  tenantId: string,
  candidateId: string
): Promise<boolean> {
  const { client } = await getPlatformClient();
  const offerTokensDb = client.db('cvision_offer_tokens');
  const tokensCollection = offerTokensDb.collection('tokens');

  const result = await tokensCollection.updateMany(
    { tenantId, candidateId, active: true },
    { $set: { active: false } }
  );

  return result.modifiedCount > 0;
}
