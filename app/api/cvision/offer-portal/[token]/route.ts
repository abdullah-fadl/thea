import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Offer Portal API (Public)
 * GET /api/cvision/offer-portal/:token?tenantId=<id> - Get offer details by token
 * POST /api/cvision/offer-portal/:token?tenantId=<id> - Respond to offer (accept/reject/negotiate)
 *
 * This is a PUBLIC endpoint - candidates access it via unique token link.
 * tenantId MUST be supplied as a query parameter so every lookup is
 * scoped to the owning tenant (prevents cross-tenant token enumeration).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformClient } from '@/lib/db/mongo';
import { createCVisionNotification } from '@/lib/cvision/notifications';
import { validateOfferToken } from '@/lib/cvision/offerToken';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Response schema
const offerResponseSchema = z.object({
  action: z.enum(['accept', 'reject', 'negotiate']),
  notes: z.string().max(2000).optional(),
  requestedSalary: z.number().optional(), // For negotiation
  requestedBenefits: z.array(z.string()).optional(),
});

// GET - Get offer details by token (PUBLIC)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params;
    const token = params.token;

    if (!token || token.length < 20) {
      return NextResponse.json(
        { error: 'Invalid offer token' },
        { status: 400 }
      );
    }

    // tenantId is required — prevents cross-tenant token lookup
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId parameter' },
        { status: 400 }
      );
    }

    // Validate token with tenant isolation enforced
    const tokenDoc = await validateOfferToken(tenantId, token);

    if (!tokenDoc) {
      return NextResponse.json(
        { error: 'Offer not found or link has expired' },
        { status: 404 }
      );
    }

    // Get candidate details from tenant database
    const { client } = await getPlatformClient();
    const tenantDb = client.db(`cvision_${tokenDoc.tenantId}`);
    const candidatesCollection = tenantDb.collection('candidates');

    const candidate = await candidatesCollection.findOne({
      id: tokenDoc.candidateId,
      tenantId: tokenDoc.tenantId,
    });

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Return offer details (safe for public viewing)
    const offer = candidate.offer || {
      totalSalary: candidate.offerAmount || 0,
      currency: candidate.offerCurrency || 'SAR',
    };

    return NextResponse.json({
      success: true,
      candidate: {
        name: candidate.fullName,
        email: candidate.email,
      },
      jobTitle: candidate.jobTitleName || 'Position',
      offer: {
        totalSalary: offer.totalSalary,
        basicSalary: offer.basicSalary,
        housingAllowance: offer.housingAllowance,
        transportAllowance: offer.transportAllowance,
        otherAllowances: offer.otherAllowances,
        currency: offer.currency,
        startDate: offer.startDate,
        contractType: offer.contractType,
        probationPeriod: offer.probationPeriod,
        benefits: offer.benefits || [],
        expiryDate: offer.expiryDate,
        status: offer.status,
        candidateResponse: offer.candidateResponse,
      },
      company: {
        name: tokenDoc.companyName || 'Company',
        logo: tokenDoc.companyLogo,
      },
      // Has candidate already responded?
      hasResponded: !!offer.candidateResponse,
      respondedAt: offer.candidateResponseAt,
    });
  } catch (error: any) {
    logger.error('[Offer Portal GET]', error?.message || String(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Respond to offer (PUBLIC)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params;
    const token = params.token;

    if (!token || token.length < 20) {
      return NextResponse.json(
        { error: 'Invalid offer token' },
        { status: 400 }
      );
    }

    // tenantId is required — prevents cross-tenant token lookup
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId parameter' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = offerResponseSchema.parse(body);

    // Validate token with tenant isolation enforced
    const tokenDoc = await validateOfferToken(tenantId, token);

    if (!tokenDoc) {
      return NextResponse.json(
        { error: 'Offer not found or link has expired' },
        { status: 404 }
      );
    }

    // Get candidate from the owning tenant's database
    const { client } = await getPlatformClient();
    const tenantDb = client.db(`cvision_${tokenDoc.tenantId}`);
    const candidatesCollection = tenantDb.collection('candidates');

    const candidate = await candidatesCollection.findOne({
      id: tokenDoc.candidateId,
      tenantId: tokenDoc.tenantId,
    });

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Check if already responded
    if (candidate.offer?.candidateResponse) {
      return NextResponse.json(
        { error: 'You have already responded to this offer', previousResponse: candidate.offer.candidateResponse },
        { status: 400 }
      );
    }

    const now = new Date();

    // Build updated offer
    let updatedOffer = candidate.offer || {
      id: 'legacy',
      totalSalary: candidate.offerAmount || 0,
      currency: candidate.offerCurrency || 'SAR',
      status: 'sent',
    };

    let newCandidateStatus = candidate.status;
    let notificationType: 'OFFER_ACCEPTED' | 'OFFER_REJECTED' | 'OFFER_NEGOTIATING';

    switch (data.action) {
      case 'accept':
        updatedOffer = {
          ...updatedOffer,
          candidateResponse: 'accepted',
          candidateResponseAt: now.toISOString(),
          candidateResponseNotes: data.notes || null,
          status: 'accepted_pending_approval',
        };
        notificationType = 'OFFER_ACCEPTED';
        break;

      case 'reject':
        updatedOffer = {
          ...updatedOffer,
          candidateResponse: 'rejected',
          candidateResponseAt: now.toISOString(),
          candidateResponseNotes: data.notes || null,
          status: 'rejected',
        };
        newCandidateStatus = 'rejected';
        notificationType = 'OFFER_REJECTED';
        break;

      case 'negotiate':
        updatedOffer = {
          ...updatedOffer,
          candidateResponse: 'negotiating',
          candidateResponseAt: now.toISOString(),
          candidateResponseNotes: data.notes || null,
          status: 'negotiating',
          negotiationRequest: {
            requestedSalary: data.requestedSalary,
            requestedBenefits: data.requestedBenefits,
            requestedAt: now.toISOString(),
          },
        };
        notificationType = 'OFFER_NEGOTIATING';
        break;
    }

    // Update candidate
    await candidatesCollection.updateOne(
      { id: tokenDoc.candidateId, tenantId: tokenDoc.tenantId },
      {
        $set: {
          offer: updatedOffer,
          status: newCandidateStatus,
          statusChangedAt: now,
          updatedAt: now,
        },
      }
    );

    // Deactivate token after response (one-time use).
    // Filter includes both token AND tenantId to prevent cross-tenant writes.
    const tokensCollection = client.db('cvision_offer_tokens').collection('tokens');
    await tokensCollection.updateOne(
      { token, tenantId: tokenDoc.tenantId },
      { $set: { active: false, usedAt: now } }
    );

    // Create notification for HR
    await createCVisionNotification(tokenDoc.tenantId, notificationType, {
      candidateId: tokenDoc.candidateId,
      candidateName: candidate.fullName,
      jobTitleId: candidate.jobTitleId,
      jobTitleName: candidate.jobTitleName,
      meta: {
        response: data.action,
        notes: data.notes,
        requestedSalary: data.requestedSalary,
      },
    });

    // Response messages
    const messages = {
      accept: 'Thank you! Your acceptance has been recorded. The HR team will review and finalize your onboarding.',
      reject: 'Your response has been recorded. Thank you for your consideration.',
      negotiate: 'Your negotiation request has been submitted. The HR team will review and get back to you.',
    };

    return NextResponse.json({
      success: true,
      action: data.action,
      message: messages[data.action],
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    logger.error('[Offer Portal POST]', error?.message || String(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
