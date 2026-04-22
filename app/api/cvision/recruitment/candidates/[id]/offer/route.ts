import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Candidate Offer Management API
 * POST /api/cvision/recruitment/candidates/:id/offer - Send offer
 * PUT /api/cvision/recruitment/candidates/:id/offer - Update offer response/approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { createCVisionNotification } from '@/lib/cvision/notifications';
import { generateOfferToken, getOfferPortalUrl } from '@/lib/cvision/offerToken';
import { sendOfferEmail } from '@/lib/cvision/email/send';
import { getTenant } from '@/lib/cvision/saas';
import { z } from 'zod';
import type { CVisionCandidate } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Validation schemas
const sendOfferSchema = z.object({
  basicSalary: z.number().min(0),
  housingAllowance: z.number().min(0).optional(),
  transportAllowance: z.number().min(0).optional(),
  otherAllowances: z.number().min(0).optional(),
  currency: z.string().default('SAR'),
  startDate: z.string(),
  contractType: z.enum(['full_time', 'part_time', 'contract', 'internship']),
  probationPeriod: z.number().min(0).max(365),
  benefits: z.array(z.string()).optional(),
  expiryDate: z.string(),
  notes: z.string().optional(),
  sendEmail: z.boolean().default(true),
});

const updateOfferSchema = z.object({
  action: z.enum(['candidate_accept', 'candidate_reject', 'candidate_negotiate', 'hr_approve', 'hr_reject', 'resend']),
  notes: z.string().optional(),
  updatedSalary: z.number().optional(), // For negotiation
});

// POST - Send offer to candidate
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const candidateId = resolvedParams?.id as string;

      if (!candidateId) {
        return NextResponse.json(
          { error: 'Candidate ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = sendOfferSchema.parse(body);

      const collection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      const candidate = await findById(collection, tenantId, candidateId);
      if (!candidate) {
        return NextResponse.json(
          { error: 'Candidate not found' },
          { status: 404 }
        );
      }

      // Calculate total salary
      const totalSalary =
        data.basicSalary +
        (data.housingAllowance || 0) +
        (data.transportAllowance || 0) +
        (data.otherAllowances || 0);

      // Create offer object
      const offer = {
        id: crypto.randomUUID(),
        basicSalary: data.basicSalary,
        housingAllowance: data.housingAllowance || 0,
        transportAllowance: data.transportAllowance || 0,
        otherAllowances: data.otherAllowances || 0,
        totalSalary,
        currency: data.currency,
        startDate: data.startDate,
        contractType: data.contractType,
        probationPeriod: data.probationPeriod,
        benefits: data.benefits || [],
        expiryDate: data.expiryDate,
        notes: data.notes,
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
        sentBy: userId,
        // Response tracking
        candidateResponse: null as null | 'accepted' | 'rejected' | 'negotiating',
        candidateResponseAt: null as string | null,
        candidateResponseNotes: null as string | null,
        // Approval tracking
        hrApprovalStatus: 'pending' as 'pending' | 'approved' | 'rejected',
        hrApprovedBy: null as string | null,
        hrApprovedAt: null as string | null,
        hrApprovalNotes: null as string | null,
      };

      const now = new Date();

      await collection.updateOne(
        createTenantFilter(tenantId, { id: candidateId }),
        {
          $set: {
            status: 'offer',
            offer,
            offerExtendedAt: now,
            offerAmount: totalSalary,
            offerCurrency: data.currency,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // Fetch company name from tenant settings
      let companyName = 'Company';
      try {
        const tenant = await getTenant(tenantId);
        if (tenant?.companyName) {
          companyName = tenant.companyName;
        }
      } catch (tenantError) {
        logger.error('[Offer Tenant Lookup]', tenantError);
      }

      // Generate offer portal token and link
      let portalUrl = '';
      try {
        const tokenResult = await generateOfferToken(tenantId, {
          candidateId,
          candidateName: candidate.fullName,
          candidateEmail: candidate.email || '',
          jobTitleName: ((candidate as Record<string, unknown>).jobTitleName as string) || 'Position',
          companyName,
          offerAmount: totalSalary,
          offerCurrency: data.currency,
          expiryDays: 7, // Token expires when offer expires
          createdBy: userId,
        });
        portalUrl = tokenResult.portalUrl;
      } catch (tokenError) {
        logger.error('[Offer Token Error]', tokenError);
      }

      // Send email notification if enabled
      let emailSent = false;
      if (data.sendEmail && candidate.email) {
        try {
          const emailResult = await sendOfferEmail({
            to: candidate.email,
            candidateName: candidate.fullName,
            position: ((candidate as Record<string, unknown>).jobTitleName as string) || 'Position',
            salary: totalSalary,
            currency: data.currency,
            startDate: data.startDate,
            expiryDate: data.expiryDate,
            benefits: data.benefits,
            portalUrl,
            companyName,
          });
          emailSent = emailResult.sent || emailResult.fallback;
        } catch (emailError) {
          logger.error('[Offer Email Error]', emailError);
        }
      }

      // Create notification for tracking (non-blocking)
      try {
        await createCVisionNotification(tenantId, 'OFFER_SENT', {
          candidateId,
          candidateName: candidate.fullName,
          jobTitleId: candidate.jobTitleId,
          jobTitleName: (candidate as Record<string, unknown>).jobTitleName as string,
          createdBy: userId,
          meta: { totalSalary, currency: data.currency, portalUrl },
        });
      } catch (notifError) {
        logger.error('[Offer Notification Error]', notifError);
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'candidate_update',
        'candidate',
        {
          resourceId: candidateId,
          changes: {
            after: {
              action: 'offer_sent',
              totalSalary,
              startDate: data.startDate,
              expiryDate: data.expiryDate,
              emailSent,
            },
          },
        }
      );

      return NextResponse.json({
        success: true,
        offer,
        emailSent,
        portalUrl,
        message: `Offer sent to ${candidate.fullName}${emailSent ? ' (email notification sent)' : ''}`,
      }, { status: 201 });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Offer POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);

// PUT - Update offer (candidate response or HR approval)
export const PUT = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const candidateId = resolvedParams?.id as string;

      if (!candidateId) {
        return NextResponse.json(
          { error: 'Candidate ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = updateOfferSchema.parse(body);

      const collection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      const candidate = await findById(collection, tenantId, candidateId);
      if (!candidate) {
        return NextResponse.json(
          { error: 'Candidate not found' },
          { status: 404 }
        );
      }

      const now = new Date();
      let newCandidateStatus = candidate.status;
      let message = '';
      let notificationType: 'OFFER_ACCEPTED' | 'OFFER_REJECTED' | 'OFFER_NEGOTIATING' | 'OFFER_HR_APPROVED' | 'OFFER_HR_REJECTED' | null = null;

      // Handle legacy offers (without structured offer object)
      let updatedOffer = candidate.offer ? { ...candidate.offer } : {
        id: crypto.randomUUID(),
        basicSalary: candidate.offerAmount || 0,
        housingAllowance: 0,
        transportAllowance: 0,
        otherAllowances: 0,
        totalSalary: candidate.offerAmount || 0,
        currency: candidate.offerCurrency || 'SAR',
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        contractType: 'full_time' as const,
        probationPeriod: 90,
        benefits: [],
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '',
        status: 'sent' as const,
        sentAt: candidate.offerExtendedAt?.toISOString() || now.toISOString(),
        sentBy: userId,
        candidateResponse: null as null | 'accepted' | 'rejected' | 'negotiating',
        candidateResponseAt: null as string | null,
        candidateResponseNotes: null as string | null,
        hrApprovalStatus: 'pending' as 'pending' | 'approved' | 'rejected',
        hrApprovedBy: null as string | null,
        hrApprovedAt: null as string | null,
        hrApprovalNotes: null as string | null,
      };

      switch (data.action) {
        case 'candidate_accept':
          updatedOffer.candidateResponse = 'accepted';
          updatedOffer.candidateResponseAt = now.toISOString();
          updatedOffer.candidateResponseNotes = data.notes || null;
          updatedOffer.status = 'accepted_pending_approval';
          message = `${candidate.fullName} accepted the offer. Pending HR approval.`;
          notificationType = 'OFFER_ACCEPTED';
          break;

        case 'candidate_reject':
          updatedOffer.candidateResponse = 'rejected';
          updatedOffer.candidateResponseAt = now.toISOString();
          updatedOffer.candidateResponseNotes = data.notes || null;
          updatedOffer.status = 'rejected';
          newCandidateStatus = 'rejected';
          message = `${candidate.fullName} rejected the offer.`;
          notificationType = 'OFFER_REJECTED';
          break;

        case 'candidate_negotiate':
          updatedOffer.candidateResponse = 'negotiating';
          updatedOffer.candidateResponseAt = now.toISOString();
          updatedOffer.candidateResponseNotes = data.notes || null;
          updatedOffer.status = 'negotiating';
          if (data.updatedSalary) {
            updatedOffer.totalSalary = data.updatedSalary;
          }
          message = `${candidate.fullName} wants to negotiate the offer.`;
          notificationType = 'OFFER_NEGOTIATING';
          break;

        case 'hr_approve':
          if (updatedOffer.candidateResponse !== 'accepted') {
            return NextResponse.json(
              { error: 'Cannot approve - candidate has not accepted the offer yet' },
              { status: 400 }
            );
          }
          updatedOffer.hrApprovalStatus = 'approved';
          updatedOffer.hrApprovedBy = userId;
          updatedOffer.hrApprovedAt = now.toISOString();
          updatedOffer.hrApprovalNotes = data.notes || null;
          updatedOffer.status = 'approved';
          // Don't auto-hire, keep in offer stage until manual hire
          message = `Offer approved! Ready to complete hiring for ${candidate.fullName}.`;
          notificationType = 'OFFER_HR_APPROVED';
          break;

        case 'hr_reject':
          updatedOffer.hrApprovalStatus = 'rejected';
          updatedOffer.hrApprovedBy = userId;
          updatedOffer.hrApprovedAt = now.toISOString();
          updatedOffer.hrApprovalNotes = data.notes || null;
          updatedOffer.status = 'hr_rejected';
          message = `Offer approval rejected for ${candidate.fullName}.`;
          notificationType = 'OFFER_HR_REJECTED';
          break;

        case 'resend':
          updatedOffer.status = 'sent';
          updatedOffer.sentAt = now.toISOString();
          updatedOffer.sentBy = userId;
          updatedOffer.candidateResponse = null;
          updatedOffer.candidateResponseAt = null;
          message = `Offer resent to ${candidate.fullName}.`;
          break;
      }

      await collection.updateOne(
        createTenantFilter(tenantId, { id: candidateId }),
        {
          $set: {
            offer: updatedOffer,
            status: newCandidateStatus,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // Create notification if action triggered one (non-blocking)
      if (notificationType) {
        try {
          await createCVisionNotification(tenantId, notificationType, {
            candidateId,
            candidateName: candidate.fullName,
            jobTitleId: candidate.jobTitleId,
            jobTitleName: (candidate as Record<string, unknown>).jobTitleName as string,
            createdBy: userId,
            meta: {
              action: data.action,
              notes: data.notes,
            },
          });
        } catch (notifError) {
          logger.error('[Offer Update Notification Error]', notifError);
        }
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'candidate_update',
        'candidate',
        {
          resourceId: candidateId,
          changes: {
            before: { offerStatus: candidate.offer?.status || 'unknown' },
            after: { offerStatus: updatedOffer.status, action: data.action },
          },
        }
      );

      return NextResponse.json({
        success: true,
        offer: updatedOffer,
        candidateStatus: newCandidateStatus,
        message,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Offer PUT]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);

// GET - Get offer details
export const GET = withAuthTenant(
  async (request, { tenantId }, params) => {
    try {
      const resolvedParams = await params;
      const candidateId = resolvedParams?.id as string;

      if (!candidateId) {
        return NextResponse.json(
          { error: 'Candidate ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      const candidate = await findById(collection, tenantId, candidateId);
      if (!candidate) {
        return NextResponse.json(
          { error: 'Candidate not found' },
          { status: 404 }
        );
      }

      // Build offer object - support both new structured offers and legacy offers
      let offer = candidate.offer;

      // If no structured offer but candidate has legacy offer data (offerAmount)
      // This works for any candidate status (offer, hired, etc.)
      if (!offer && candidate.offerAmount) {
        offer = {
          id: 'legacy',
          basicSalary: candidate.offerAmount || 0,
          housingAllowance: 0,
          transportAllowance: 0,
          otherAllowances: 0,
          totalSalary: candidate.offerAmount || 0,
          currency: candidate.offerCurrency || 'SAR',
          startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          contractType: 'full_time',
          probationPeriod: 90,
          benefits: [],
          expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          notes: '',
          status: candidate.status === 'hired' ? 'approved' : 'sent',
          sentAt: candidate.offerExtendedAt?.toISOString() || new Date().toISOString(),
          sentBy: '',
          candidateResponse: candidate.status === 'hired' ? 'accepted' : null,
          candidateResponseAt: null,
          candidateResponseNotes: null,
          hrApprovalStatus: candidate.status === 'hired' ? 'approved' : 'pending',
          hrApprovedBy: null,
          hrApprovedAt: null,
          hrApprovalNotes: null,
        };
      }

      // Get portal URL if offer exists
      let portalUrl = null;
      if (offer) {
        portalUrl = await getOfferPortalUrl(tenantId, candidateId);
      }

      return NextResponse.json({
        success: true,
        offer: offer || null,
        portalUrl,
        candidate: {
          id: candidate.id,
          fullName: candidate.fullName,
          email: candidate.email,
          status: candidate.status,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Offer GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);
