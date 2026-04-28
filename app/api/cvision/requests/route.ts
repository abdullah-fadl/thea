import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Requests API
 * GET /api/cvision/requests - List requests
 * POST /api/cvision/requests - Create request
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  paginatedList,
  createTenantFilter,
  generateSequenceNumber,
  findById,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import {
  createRequestSchema,
  paginationSchema,
} from '@/lib/cvision/validation';
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

/**
 * Calculate SLA due date based on request type
 */
function calculateSlaDueAt(type: string): Date {
  const hours = REQUEST_SLA_HOURS[type] || REQUEST_SLA_HOURS.other;
  const dueAt = new Date();
  dueAt.setHours(dueAt.getHours() + hours);
  return dueAt;
}

/**
 * Determine initial owner role based on confidentiality and type
 */
function determineInitialOwner(type: string, confidentiality: string): RequestOwnerRole {
  // Complaints and payroll issues always go to HR
  if (HR_REQUIRED_REQUEST_TYPES.includes(type)) {
    return 'hr';
  }
  return (CONFIDENTIALITY_INITIAL_OWNER[confidentiality] || 'manager') as RequestOwnerRole;
}

// GET - List requests
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const { searchParams } = new URL(request.url);
      const params = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        search: searchParams.get('search'),
        sortBy: searchParams.get('sortBy') || 'createdAt',
        sortOrder: searchParams.get('sortOrder') || 'desc',
        includeDeleted: searchParams.get('includeDeleted'),
      });

      const collection = await getCVisionCollection<CVisionRequest>(
        tenantId,
        'requests'
      );

      // Build additional filter
      const additionalFilter: Record<string, any> = {};
      
      const type = searchParams.get('type');
      const status = searchParams.get('status');
      const departmentId = searchParams.get('departmentId');
      const confidentiality = searchParams.get('confidentiality');
      const requesterEmployeeId = searchParams.get('requesterEmployeeId');

      if (type) additionalFilter.type = type;
      if (status) additionalFilter.status = status;
      if (departmentId) additionalFilter.departmentId = departmentId;
      if (confidentiality) additionalFilter.confidentiality = confidentiality;
      if (requesterEmployeeId) additionalFilter.requesterEmployeeId = requesterEmployeeId;

      // Role-based access control
      // Supervisors/managers can only see their department's non-confidential requests
      if (role === 'supervisor' || role === 'manager') {
        if (user.department) {
          additionalFilter.departmentId = user.department;
        }
        // Managers cannot see anonymous/confidential unless they're HR
        additionalFilter.confidentiality = 'normal';
      }

      // Filter out archived unless explicitly requested
      if (!params.includeDeleted) {
        additionalFilter.isArchived = { $ne: true };
      }

      const result = await paginatedList(
        collection,
        tenantId,
        params,
        Object.keys(additionalFilter).length > 0 ? additionalFilter : undefined
      );

      // Check and update SLA breaches for returned requests
      const now = new Date();
      const requestsToUpdate: string[] = [];
      
      for (const req of result.data) {
        if (req.slaDueAt && new Date(req.slaDueAt) < now && !req.slaBreached) {
          requestsToUpdate.push(req.id);
        }
      }

      // Batch update SLA breaches
      if (requestsToUpdate.length > 0) {
        await collection.updateMany(
          createTenantFilter(tenantId, { id: { $in: requestsToUpdate } }),
          {
            $set: {
              slaBreached: true,
              updatedAt: now,
              updatedBy: 'system-sla-check',
            },
          }
        );
        
        // Refresh data to include updated slaBreached flags
        const refreshedData = await collection
          .find(createTenantFilter(tenantId, { id: { $in: requestsToUpdate } }))
          .toArray();
        
        // Update result.data with refreshed records
        for (let i = 0; i < result.data.length; i++) {
          const refreshed = refreshedData.find((r) => r.id === result.data[i].id);
          if (refreshed) {
            result.data[i] = refreshed;
          }
        }
      }

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      logger.error('[CVision Requests GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.REQUESTS_READ }
);

// POST - Create request
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const data = createRequestSchema.parse(body);

      // Find the employee record for the current user
      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );
      
      // Try to find employee by userId (linked account) or by email
      let requesterEmployee = await employeeCollection.findOne(
        createTenantFilter(tenantId, { userId })
      );
      
      if (!requesterEmployee && user.email) {
        requesterEmployee = await employeeCollection.findOne(
          createTenantFilter(tenantId, { email: user.email })
        );
      }

      if (!requesterEmployee) {
        return NextResponse.json(
          { error: 'Employee record not found for current user. Please ensure your user account is linked to an employee record.' },
          { status: 400 }
        );
      }

      // Generate request number
      const requestNumber = await generateSequenceNumber(
        tenantId,
        SEQUENCE_PREFIXES.request
      );

      const now = new Date();
      const initialOwner = determineInitialOwner(data.type, data.confidentiality);
      const slaDueAt = calculateSlaDueAt(data.type);

      const requestDoc: CVisionRequest = {
        id: uuidv4(),
        tenantId,
        requestNumber,
        type: data.type,
        priority: data.priority || 'medium',
        title: data.title,
        description: data.description,
        confidentiality: data.confidentiality,
        
        // Requester info
        requesterEmployeeId: requesterEmployee.id,
        targetManagerEmployeeId: data.targetManagerEmployeeId || null,
        departmentId: requesterEmployee.departmentId,
        
        // Status
        status: 'open',
        statusChangedAt: now,
        
        // Ownership
        currentOwnerRole: initialOwner,
        
        // SLA
        slaDueAt,
        slaBreached: false,
        
        // System fields
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        
        metadata: data.metadata,
      };

      const collection = await getCVisionCollection<CVisionRequest>(
        tenantId,
        'requests'
      );
      await collection.insertOne(requestDoc);

      // Create initial event
      const eventCollection = await getCVisionCollection<CVisionRequestEvent>(
        tenantId,
        'requestEvents'
      );
      
      const createdEvent: CVisionRequestEvent = {
        id: uuidv4(),
        tenantId,
        requestId: requestDoc.id,
        actorUserId: userId,
        actorRole: role,
        eventType: 'created',
        payloadJson: {
          type: data.type,
          title: data.title,
          confidentiality: data.confidentiality,
          initialOwner,
          slaDueAt,
        },
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };
      await eventCollection.insertOne(createdEvent);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'request_create',
        'request',
        {
          resourceId: requestDoc.id,
          changes: {
            after: {
              requestNumber,
              type: data.type,
              title: data.title,
              confidentiality: data.confidentiality,
              initialOwner,
            },
          },
        }
      );

      return NextResponse.json(
        { success: true, request: requestDoc },
        { status: 201 }
      );
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Requests POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.REQUESTS_WRITE }
);
