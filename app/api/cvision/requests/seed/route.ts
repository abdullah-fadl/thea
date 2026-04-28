import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Seed Requests Helper API (Dev Only)
 * POST /api/cvision/requests/seed
 *
 * Creates 4 sample HR requests for testing.
 * Dev-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
  generateSequenceNumber,
} from '@/lib/cvision/db';
import {
  CVISION_PERMISSIONS,
  SEQUENCE_PREFIXES,
  REQUEST_SLA_HOURS,
  CONFIDENTIALITY_INITIAL_OWNER,
  HR_REQUIRED_REQUEST_TYPES,
} from '@/lib/cvision/constants';
import type {
  CVisionRequest,
  CVisionRequestEvent,
  CVisionEmployee,
  RequestOwnerRole,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SEED_REQUESTS = [
  {
    type: 'salary_certificate' as const,
    title: 'Salary Certificate for Bank Loan',
    description: 'I need a salary certificate to submit to Al Rajhi Bank for a home loan application. Please include my basic salary, allowances, and total compensation.',
    priority: 'high' as const,
    confidentiality: 'normal' as const,
    status: 'open' as const,
  },
  {
    type: 'employment_letter' as const,
    title: 'Employment Verification Letter',
    description: 'Requesting an official employment verification letter for visa processing at the embassy. The letter should include my position, department, and dates of employment.',
    priority: 'medium' as const,
    confidentiality: 'normal' as const,
    status: 'in_review' as const,
  },
  {
    type: 'training' as const,
    title: 'Advanced Leadership Training Program',
    description: 'I would like to enroll in the Advanced Leadership Training Program offered by the management institute. This 3-day program covers strategic thinking and team management.',
    priority: 'low' as const,
    confidentiality: 'normal' as const,
    status: 'approved' as const,
  },
  {
    type: 'equipment' as const,
    title: 'Laptop Replacement Request',
    description: 'My current laptop has frequent hardware issues and crashes. Requesting a replacement to maintain work productivity. Current device: Dell Latitude 5520, Asset Tag: IT-2021-0456.',
    priority: 'urgent' as const,
    confidentiality: 'normal' as const,
    status: 'open' as const,
  },
];

function determineInitialOwner(type: string, confidentiality: string): RequestOwnerRole {
  if (HR_REQUIRED_REQUEST_TYPES.includes(type)) {
    return 'hr';
  }
  return (CONFIDENTIALITY_INITIAL_OWNER[confidentiality] || 'manager') as RequestOwnerRole;
}

// POST - Create seed requests
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development' },
        { status: 403 }
      );
    }

    try {
      const requestCollection = await getCVisionCollection<CVisionRequest>(
        tenantId,
        'requests'
      );

      // Check if seed data already exists
      const existingCount = await requestCollection.countDocuments(
        createTenantFilter(tenantId)
      );

      if (existingCount > 0) {
        return NextResponse.json({
          success: true,
          message: `Requests already exist (${existingCount} found). Skipping seed.`,
          count: existingCount,
        });
      }

      // Get employees for requester assignment
      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );
      const employees = await employeeCollection
        .find(createTenantFilter(tenantId, { isArchived: { $ne: true } } as Record<string, unknown>))
        .limit(10)
        .toArray();

      if (employees.length < 1) {
        return NextResponse.json(
          { error: 'No employees found. Seed employees first.' },
          { status: 404 }
        );
      }

      const eventCollection = await getCVisionCollection<CVisionRequestEvent>(
        tenantId,
        'requestEvents'
      );

      const createdRequests: CVisionRequest[] = [];
      const now = new Date();

      for (let i = 0; i < SEED_REQUESTS.length; i++) {
        const seed = SEED_REQUESTS[i];
        const employee = employees[i % employees.length];

        const requestNumber = await generateSequenceNumber(
          tenantId,
          SEQUENCE_PREFIXES.request
        );

        const slaHours = REQUEST_SLA_HOURS[seed.type] || REQUEST_SLA_HOURS.other;
        const slaDueAt = new Date(now.getTime() + slaHours * 60 * 60 * 1000);
        const initialOwner = determineInitialOwner(seed.type, seed.confidentiality);

        // Adjust SLA for non-open statuses (make them earlier to show variety)
        const adjustedSlaDueAt = seed.status === 'approved'
          ? new Date(now.getTime() - 24 * 60 * 60 * 1000) // Past due (completed)
          : slaDueAt;

        const requestDoc: CVisionRequest = {
          id: uuidv4(),
          tenantId,
          requestNumber,
          type: seed.type,
          priority: seed.priority,
          title: seed.title,
          description: seed.description,
          confidentiality: seed.confidentiality,
          requesterEmployeeId: employee.id,
          targetManagerEmployeeId: null,
          departmentId: employee.departmentId,
          status: seed.status,
          statusChangedAt: now,
          currentOwnerRole: initialOwner,
          slaDueAt: adjustedSlaDueAt,
          slaBreached: seed.status === 'approved', // The approved one has past SLA
          isArchived: false,
          createdAt: new Date(now.getTime() - (SEED_REQUESTS.length - i) * 24 * 60 * 60 * 1000), // Stagger creation dates
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
          metadata: { seeded: true },
        };

        await requestCollection.insertOne(requestDoc);

        // Create initial event
        const createdEvent: CVisionRequestEvent = {
          id: uuidv4(),
          tenantId,
          requestId: requestDoc.id,
          actorUserId: userId,
          actorRole: role,
          eventType: 'created',
          payloadJson: {
            type: seed.type,
            title: seed.title,
            confidentiality: seed.confidentiality,
            priority: seed.priority,
            initialOwner,
            slaDueAt: adjustedSlaDueAt,
          },
          createdAt: requestDoc.createdAt,
          updatedAt: requestDoc.createdAt,
          createdBy: userId,
          updatedBy: userId,
        };
        await eventCollection.insertOne(createdEvent);

        // Add status change event for non-open requests
        if (seed.status !== 'open') {
          const statusEvent: CVisionRequestEvent = {
            id: uuidv4(),
            tenantId,
            requestId: requestDoc.id,
            actorUserId: userId,
            actorRole: role,
            eventType: 'status_change',
            payloadJson: {
              from: 'open',
              to: seed.status,
              reason: seed.status === 'in_review' ? 'Under review by HR department' : 'Request approved by management',
            },
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
          };
          await eventCollection.insertOne(statusEvent);
        }

        createdRequests.push(requestDoc);
      }

      logger.info('[CVision Seed Requests] Created:', {
        tenantId,
        count: createdRequests.length,
        requestNumbers: createdRequests.map(r => r.requestNumber),
      });

      return NextResponse.json({
        success: true,
        message: `Created ${createdRequests.length} seed requests`,
        requests: createdRequests.map(r => ({
          id: r.id,
          requestNumber: r.requestNumber,
          type: r.type,
          title: r.title,
          status: r.status,
          priority: r.priority,
        })),
      });
    } catch (error: any) {
      logger.error('[CVision Seed Requests POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.REQUESTS_WRITE }
);
