import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Developer Override API
 * 
 * DEV-ONLY endpoints for role/scope impersonation.
 * Only enabled when CVISION_DEV_OVERRIDE=1 and NODE_ENV !== 'production'
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withAuthTenant } from '@/lib/cvision/infra';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { CVISION_ROLES } from '@/lib/cvision/roles';
import { requireCtx } from '@/lib/cvision/authz/enforce';

const DEV_OVERRIDE_ENABLED = process.env.CVISION_DEV_OVERRIDE === '1' && process.env.NODE_ENV !== 'production';

interface ImpersonationData {
  role: string;
  departmentIds?: string[];
  employeeId?: string;
}

// GET - Get current impersonation state
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    // Log for debugging
    logger.info('[CVision Dev Override GET] Request received', {
      tenantId,
      userId,
      role,
      userRole: user.role,
      devOverrideEnabled: DEV_OVERRIDE_ENABLED,
    });

    if (!DEV_OVERRIDE_ENABLED) {
      // Return 200 OK with active: false to avoid console errors
      // Browser logs 4xx/5xx as errors, but this is expected behavior
      return NextResponse.json({
        success: true,
        active: false,
        impersonation: null,
        reason: 'Developer override is disabled',
      });
    }

    // Build authz context to check CVision roles
    let ctx;
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        logger.info('[CVision Dev Override GET] requireCtx returned NextResponse', {
          status: ctxResult.status,
          tenantId,
          userId,
        });
        return ctxResult; // 401 or 403
      }
      ctx = ctxResult;
    } catch (error: any) {
      logger.error('[CVision Dev Override GET] requireCtx error', {
        error: error.message || String(error),
        stack: error.stack,
        tenantId,
        userId,
      });
      return NextResponse.json(
        { 
          error: 'Authorization error', 
          message: error.message || 'Failed to build authorization context',
          code: 'AUTHZ_ERROR' 
        },
        { status: 500 }
      );
    }

    // Check if user is OWNER (platform role or CVision role)
    const isOwner = role === 'thea-owner' || 
                    role === 'owner' || 
                    ctx.roles.includes(CVISION_ROLES.OWNER) ||
                    ctx.roles.includes(CVISION_ROLES.THEA_OWNER) ||
                    ctx.isOwner;
    
    logger.info('[CVision Dev Override GET] Owner check', {
      tenantId,
      userId,
      role,
      userRole: user.role,
      ctxRoles: ctx.roles,
      ctxIsOwner: ctx.isOwner,
      isOwner,
      CVISION_ROLES_OWNER: CVISION_ROLES.OWNER,
      CVISION_ROLES_THEA_OWNER: CVISION_ROLES.THEA_OWNER,
    });
    
    if (!isOwner) {
      // Return 200 OK with active: false to avoid console errors
      // Browser logs 4xx/5xx as errors, but this is expected behavior
      return NextResponse.json({
        success: true,
        active: false,
        impersonation: null,
        reason: 'Only OWNER can use developer override',
        debug: process.env.NODE_ENV === 'development' ? {
          role,
          userRole: user.role,
          ctxRoles: ctx.roles,
          ctxIsOwner: ctx.isOwner,
        } : undefined,
      });
    }

    try {
      const cookieStore = await cookies();
      const overrideCookie = cookieStore.get(`cvision_dev_override_${tenantId}`);
      
      if (!overrideCookie) {
        return NextResponse.json({
          success: true,
          active: false,
          impersonation: null,
        });
      }

      const impersonation: ImpersonationData = JSON.parse(overrideCookie.value);
      
      return NextResponse.json({
        success: true,
        active: true,
        impersonation,
      });
    } catch (error: any) {
      logger.error('[CVision Dev Override GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message, code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision' } // No permissionKey - we check OWNER role inside the handler
);

// POST - Set impersonation
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    if (!DEV_OVERRIDE_ENABLED) {
      // Return 200 OK with active: false to avoid console errors
      return NextResponse.json({
        success: true,
        active: false,
        impersonation: null,
        reason: 'Developer override is disabled',
      });
    }

    // Build authz context to check CVision roles
    const ctxResult = await requireCtx(request);
    if (ctxResult instanceof NextResponse) {
      return ctxResult; // 401 or 403
    }
    const ctx = ctxResult;

    // Check if user is OWNER (platform role or CVision role)
    const isOwner = role === 'thea-owner' || 
                    role === 'owner' || 
                    ctx.roles.includes(CVISION_ROLES.OWNER) ||
                    ctx.roles.includes(CVISION_ROLES.THEA_OWNER) ||
                    ctx.isOwner;
    
    if (!isOwner) {
      // Return 200 OK with active: false to avoid console errors
      return NextResponse.json({
        success: true,
        active: false,
        impersonation: null,
        reason: 'Only OWNER can use developer override',
      });
    }

    try {
      const body = await request.json();
      const { role: impersonateRole, departmentIds, employeeId } = body;

      // Validate role
      const allowedRoles = [
        CVISION_ROLES.HR_ADMIN,
        CVISION_ROLES.HR_MANAGER,
        CVISION_ROLES.EMPLOYEE,
        CVISION_ROLES.AUDITOR,
      ];

      if (!impersonateRole || !allowedRoles.includes(impersonateRole)) {
        return NextResponse.json(
          { error: 'Invalid role', code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }

      const impersonation: ImpersonationData = {
        role: impersonateRole,
        departmentIds: departmentIds || [],
        employeeId: employeeId || undefined,
      };

      const cookieStore = await cookies();
      cookieStore.set(`cvision_dev_override_${tenantId}`, JSON.stringify(impersonation), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });

      return NextResponse.json({
        success: true,
        active: true,
        impersonation,
      });
    } catch (error: any) {
      logger.error('[CVision Dev Override POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message, code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision' } // No permissionKey - we check OWNER role inside the handler
);

// DELETE - Clear impersonation
export const DELETE = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    if (!DEV_OVERRIDE_ENABLED) {
      // Return 200 OK with active: false to avoid console errors
      return NextResponse.json({
        success: true,
        active: false,
        impersonation: null,
        reason: 'Developer override is disabled',
      });
    }

    // Build authz context to check CVision roles
    const ctxResult = await requireCtx(request);
    if (ctxResult instanceof NextResponse) {
      return ctxResult; // 401 or 403
    }
    const ctx = ctxResult;

    // Check if user is OWNER (platform role or CVision role)
    const isOwner = role === 'thea-owner' || 
                    role === 'owner' || 
                    ctx.roles.includes(CVISION_ROLES.OWNER) ||
                    ctx.roles.includes(CVISION_ROLES.THEA_OWNER) ||
                    ctx.isOwner;
    
    if (!isOwner) {
      // Return 200 OK with active: false to avoid console errors
      return NextResponse.json({
        success: true,
        active: false,
        impersonation: null,
        reason: 'Only OWNER can use developer override',
      });
    }

    try {
      const cookieStore = await cookies();
      cookieStore.delete(`cvision_dev_override_${tenantId}`);

      return NextResponse.json({
        success: true,
        active: false,
        impersonation: null,
      });
    } catch (error: any) {
      logger.error('[CVision Dev Override DELETE]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message, code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision' } // No permissionKey - we check OWNER role inside the handler
);
