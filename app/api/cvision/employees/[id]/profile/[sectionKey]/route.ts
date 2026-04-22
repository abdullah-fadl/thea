import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Employee Profile Section API
 * PATCH /api/cvision/employees/[id]/profile/[sectionKey] - Update a profile section
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
import type { CVisionEmployee, CVisionProfileSectionSchema, CVisionEmployeeProfileSection, ProfileSectionKey, CVisionBaseRecord } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canReadEmployee, canEditProfileSection } from '@/lib/cvision/authz/policy';
import { ensureProfileSchemas } from '@/lib/cvision/profileSchemas';
import { getProfileSectionSchema, employeeEmploymentSchema } from '@/lib/cvision/profileSectionValidation';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

/**
 * Check if a string is a valid UUID format
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updateProfileSectionSchema = z.object({
  dataJson: z.record(z.string(), z.any()),
  changeReason: z.string().optional().nullable(),
});

// PATCH - Update a profile section
export const PATCH = withAuthTenant(
  async (request, { tenantId, userId }, params) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      const resolvedParams = await params;
      const id = resolvedParams?.id as string;
      const sectionKey = resolvedParams?.sectionKey as ProfileSectionKey;

      if (!id) {
        return NextResponse.json(
          { error: 'Employee ID is required' },
          { status: 400 }
        );
      }

      if (!sectionKey || !['PERSONAL', 'EMPLOYMENT', 'FINANCIAL', 'CONTRACT'].includes(sectionKey)) {
        return NextResponse.json(
          { error: 'Invalid section key. Must be PERSONAL, EMPLOYMENT, FINANCIAL, or CONTRACT' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { dataJson, changeReason } = updateProfileSectionSchema.parse(body);

      // Log incoming data for debugging (dev mode)
      if (process.env.NODE_ENV === 'development' && sectionKey === 'EMPLOYMENT') {
        logger.info('[CVision Profile Section] EMPLOYMENT save request:', {
          employeeId: id,
          sectionKey,
          dataJson: {
            departmentId: dataJson.departmentId,
            positionId: dataJson.positionId,
            jobTitleId: dataJson.jobTitleId,
            managerEmployeeId: dataJson.managerEmployeeId,
            hiredAt: dataJson.hiredAt,
          },
        });
      }

      // Get employee
      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      const employee = await findById(employeeCollection, tenantId, id);
      if (!employee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      // Enforce read policy
      const readPolicy = canReadEmployee(ctx, employee);
      const readEnforceResult = await enforce(readPolicy, request, ctx);
      if (readEnforceResult) {
        return readEnforceResult; // 403
      }

      // Ensure profile schemas exist (bootstrap if missing)
      await ensureProfileSchemas(tenantId, ctx.userId);

      // Enforce profile section edit policy
      // Note: OWNER override is handled in enforce() function (central override)
      const editPolicy = canEditProfileSection(ctx, employee, sectionKey);
      const editEnforceResult = await enforce(editPolicy, request, ctx);
      if (editEnforceResult) {
        // Map policy reason codes to user-friendly error messages
        let errorMessage = 'Access denied';
        const errorCode = editPolicy.reason || 'FORBIDDEN';
        
        switch (editPolicy.reason) {
          case 'FORBIDDEN_SECTION':
            errorMessage = `You do not have permission to edit ${sectionKey} section`;
            break;
          case 'FORBIDDEN_EMPLOYEE':
            errorMessage = 'You can only edit your own profile';
            break;
          case 'FORBIDDEN_SCOPE':
            errorMessage = 'You do not have access to employees in this department';
            break;
          case 'EMPLOYEE_STATUS_BLOCKED':
            errorMessage = `Cannot update profile for ${employee.status} employee`;
            break;
          case 'SECTION_READONLY':
            errorMessage = `${sectionKey} section is read-only for your role`;
            break;
          case 'TERMINATED_ACCESS_BLOCKED':
            errorMessage = 'Terminated employees cannot access this resource';
            break;
          case 'RESIGNED_READONLY':
            errorMessage = 'Resigned employees have read-only access';
            break;
          case 'DEPARTMENT_MISMATCH':
            errorMessage = 'You do not have access to employees in this department';
            break;
          default:
            errorMessage = editEnforceResult.json ? (await editEnforceResult.json()).message || 'Access denied' : 'Access denied';
        }
        
        return NextResponse.json(
          { 
            error: errorMessage,
            code: errorCode,
          },
          { status: 403 }
        );
      }

      // Get active schema for this section
      const schemaCollection = await getCVisionCollection<CVisionProfileSectionSchema>(
        tenantId,
        'profileSectionSchemas'
      );

      const activeSchema = await schemaCollection.findOne(
        createTenantFilter(tenantId, { sectionKey, isActive: true })
      );

      if (!activeSchema) {
        return NextResponse.json(
          { error: `No active schema found for section ${sectionKey}` },
          { status: 404 }
        );
      }

      // Validate using Zod schema if available (strict validation)
      const zodSchema = getProfileSectionSchema(sectionKey);
      if (zodSchema) {
        // Use safeParse for better error handling
        const parsed = zodSchema.safeParse(dataJson);
        if (!parsed.success) {
          const validationErrors: Record<string, string> = {};
          (parsed.error.issues ?? (parsed.error as any).errors ?? []).forEach((err: any) => {
            const path = err.path.join('.');
            // Provide more helpful error messages
            let errorMessage = err.message;
            if (path === 'contractType' && sectionKey === 'CONTRACT') {
              errorMessage = `Invalid contract type. Must be one of: PERMANENT, FIXED_TERM, LOCUM, PART_TIME, INTERN. Received: "${dataJson.contractType || 'empty'}"`;
            } else if (path === 'departmentId' && sectionKey === 'EMPLOYMENT') {
              errorMessage = `Invalid department ID format. Must be a valid UUID. Received: "${dataJson.departmentId || 'empty'}"`;
            } else if (path === 'jobTitleId' && sectionKey === 'EMPLOYMENT') {
              errorMessage = `Invalid job title ID format. Must be a valid UUID. Received: "${dataJson.jobTitleId || 'empty'}"`;
            } else if (path === 'managerEmployeeId' && sectionKey === 'EMPLOYMENT') {
              errorMessage = `Invalid manager ID format. Must be a valid UUID or empty. Received: "${dataJson.managerEmployeeId || 'empty'}"`;
            }
            validationErrors[path] = errorMessage;
          });
          
          // Log validation errors for debugging
          if (process.env.NODE_ENV === 'development') {
            logger.error('[CVision Profile Section] Validation failed:', {
              sectionKey,
              errors: parsed.error.issues,
              dataJson,
            });
          }
          
          return NextResponse.json(
            { 
              error: 'Validation failed', 
              code: 'VALIDATION_ERROR',
              details: validationErrors,
              message: 'Profile section data does not match required schema',
            },
            { status: 400 }
          );
        }
        // Replace dataJson with validated data (ensures correct types and formats)
        Object.assign(dataJson, parsed.data);
        
        // Additional validation for EMPLOYMENT section
        if (sectionKey === 'EMPLOYMENT') {
          // Validate department exists
          if (parsed.data.departmentId) {
            const deptCollection = await getCVisionCollection(tenantId, 'departments');
            const dept = await deptCollection.findOne(
              createTenantFilter(tenantId, {
                id: parsed.data.departmentId,
              })
            );
            
            if (!dept) {
              return NextResponse.json(
                { 
                  error: 'Department not found', 
                  code: 'INVALID_DEPARTMENT',
                  message: `Department with ID "${parsed.data.departmentId}" does not exist`,
                },
                { status: 400 }
              );
            }
          }
          
          // Validate job title belongs to department (if provided)
          if (parsed.data.jobTitleId && parsed.data.departmentId) {
            interface JobTitleRecord extends CVisionBaseRecord {
              departmentId?: string;
              name?: string;
            }
            const jobTitlesCollection = await getCVisionCollection<JobTitleRecord>(tenantId, 'jobTitles');
            const jobTitle = await jobTitlesCollection.findOne(
              createTenantFilter(tenantId, {
                id: parsed.data.jobTitleId,
              })
            );

            if (!jobTitle) {
              return NextResponse.json(
                {
                  error: 'Job title not found',
                  code: 'INVALID_JOB_TITLE',
                  message: `Job title with ID "${parsed.data.jobTitleId}" does not exist`,
                },
                { status: 400 }
              );
            }

            // Validate job title belongs to the selected department (soft check — warns but allows)
            if (jobTitle.departmentId && parsed.data.departmentId && jobTitle.departmentId !== parsed.data.departmentId) {
              logger.warn(
                `[Profile] Job title "${jobTitle.name || jobTitle.id}" (dept: ${jobTitle.departmentId}) ` +
                `assigned to different department: ${parsed.data.departmentId}`
              );
            }
          }
          
          // Position is optional - no need to validate department-position link
          // This allows employees to be assigned without strict budget constraints
        }
      } else {
        // Fallback: Basic validation against schema fields (lightweight)
        const schemaFields = activeSchema.schemaJson?.fields || [];
        const validationErrors: Record<string, string> = {};

        for (const field of schemaFields) {
          const value = dataJson[field.key];
          
          if (field.required && (value === undefined || value === null || value === '')) {
            validationErrors[field.key] = `${field.label} is required`;
            continue;
          }

          if (value !== undefined && value !== null && value !== '') {
            // Type validation
            if (field.type === 'number' && typeof value !== 'number') {
              validationErrors[field.key] = `${field.label} must be a number`;
            } else if (field.type === 'email' && typeof value === 'string' && !value.includes('@')) {
              validationErrors[field.key] = `${field.label} must be a valid email`;
            } else if (field.type === 'date' && typeof value === 'string') {
              // Validate date format
              const date = new Date(value);
              if (isNaN(date.getTime())) {
                validationErrors[field.key] = `${field.label} must be a valid date`;
              }
            }
          }
        }

        if (Object.keys(validationErrors).length > 0) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationErrors },
            { status: 400 }
          );
        }
      }

      // Get existing section (if any)
      const sectionCollection = await getCVisionCollection<CVisionEmployeeProfileSection>(
        tenantId,
        'employeeProfileSections'
      );

      const existingSection = await sectionCollection.findOne(
        createTenantFilter(tenantId, { employeeId: id, sectionKey })
      );

      const now = new Date();
      const prevDataJson = existingSection?.dataJson || {};

      // Write history entry
      const historyCollection = await getCVisionCollection<any>(
        tenantId,
        'employeeProfileSectionHistory'
      );

      await historyCollection.insertOne({
        id: uuidv4(),
        tenantId,
        employeeId: id,
        sectionKey,
        schemaVersion: activeSchema.version,
        prevDataJson,
        nextDataJson: dataJson,
        changedByUserId: userId,
        changeReason: changeReason || null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        createdBy: userId,
        updatedBy: userId,
      });

      // Update or create section
      if (existingSection) {
        await sectionCollection.updateOne(
          createTenantFilter(tenantId, { employeeId: id, sectionKey }),
          {
            $set: {
              schemaVersion: activeSchema.version,
              dataJson,
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );
      } else {
        await sectionCollection.insertOne({
          id: uuidv4(),
          tenantId,
          employeeId: id,
          sectionKey,
          schemaVersion: activeSchema.version,
          dataJson,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          createdBy: userId,
          updatedBy: userId,
        });
      }

      // CRITICAL: Write-through to employee root fields for EMPLOYMENT section
      // This ensures single source of truth - root fields are canonical
      if (sectionKey === 'EMPLOYMENT') {
        const rootUpdateFields: any = {
          updatedAt: now,
          updatedBy: userId,
        };

        // Extract canonical fields from dataJson and write to root
        // Handle empty strings as null (UI might send "" for cleared fields)
        // CRITICAL: Validate that IDs are UUIDs, reject non-ID strings (like "nursing")
        if (dataJson.departmentId !== undefined) {
          // Handle null/undefined/empty values
          if (dataJson.departmentId === null || dataJson.departmentId === undefined || dataJson.departmentId === '') {
            rootUpdateFields.departmentId = null;
          } else {
            const deptIdValue = String(dataJson.departmentId).trim();
            if (deptIdValue && deptIdValue !== '' && deptIdValue !== 'null') {
              // Validate UUID format - reject non-ID strings
              if (!isValidUUID(deptIdValue)) {
                return NextResponse.json(
                  {
                    error: 'Invalid departmentId format',
                    code: 'INVALID_DEPARTMENT_ID',
                    message: `departmentId must be a valid UUID. Received: "${deptIdValue}".`,
                  },
                  { status: 400 }
                );
              }
              rootUpdateFields.departmentId = deptIdValue;
            } else {
              rootUpdateFields.departmentId = null;
            }
          }
        }
        if (dataJson.positionId !== undefined) {
          // Handle null/undefined/empty values
          if (dataJson.positionId === null || dataJson.positionId === undefined || dataJson.positionId === '' || dataJson.positionId === 'none') {
            rootUpdateFields.positionId = null;
          } else {
            const posIdValue = String(dataJson.positionId).trim();
            if (posIdValue && posIdValue !== '' && posIdValue !== 'null' && posIdValue !== 'none') {
              // Validate UUID format - reject non-ID strings
              if (!isValidUUID(posIdValue)) {
                return NextResponse.json(
                  {
                    error: 'Invalid positionId format',
                    code: 'INVALID_POSITION_ID',
                    message: `positionId must be a valid UUID. Received: "${posIdValue}".`,
                  },
                  { status: 400 }
                );
              }
              rootUpdateFields.positionId = posIdValue;
            } else {
              rootUpdateFields.positionId = null;
            }
          }
        }
        if (dataJson.unitId !== undefined) {
          if (dataJson.unitId === null || dataJson.unitId === undefined || dataJson.unitId === '') {
            rootUpdateFields.unitId = null;
          } else {
            const unitIdValue = String(dataJson.unitId).trim();
            if (unitIdValue && unitIdValue !== '' && unitIdValue !== 'null') {
              if (!isValidUUID(unitIdValue)) {
                return NextResponse.json(
                  {
                    error: 'Invalid unitId format',
                    code: 'INVALID_UNIT_ID',
                    message: `unitId must be a valid UUID. Received: "${unitIdValue}".`,
                  },
                  { status: 400 }
                );
              }
              rootUpdateFields.unitId = unitIdValue;
            } else {
              rootUpdateFields.unitId = null;
            }
          }
        }
        if (dataJson.jobTitleId !== undefined) {
          if (dataJson.jobTitleId === null || dataJson.jobTitleId === undefined || dataJson.jobTitleId === '') {
            rootUpdateFields.jobTitleId = null;
          } else {
            rootUpdateFields.jobTitleId = String(dataJson.jobTitleId).trim() || null;
          }
        }
        if (dataJson.managerEmployeeId !== undefined) {
          if (dataJson.managerEmployeeId === null || dataJson.managerEmployeeId === undefined || dataJson.managerEmployeeId === '') {
            rootUpdateFields.managerEmployeeId = null;
          } else {
            rootUpdateFields.managerEmployeeId = String(dataJson.managerEmployeeId).trim() || null;
          }
        }
        if (dataJson.branchId !== undefined) {
          rootUpdateFields.branchId = dataJson.branchId || null;
        }
        if (dataJson.workLocation !== undefined) {
          rootUpdateFields.workLocation = dataJson.workLocation || null;
        }
        if (dataJson.hiredAt !== undefined) {
          rootUpdateFields.hiredAt = dataJson.hiredAt ? new Date(dataJson.hiredAt) : null;
        }

        // Validate department exists if provided (non-null, non-empty)
        // Note: This validation is already done earlier after Zod parsing, but we keep it here
        // as a safety check in case the write-through logic is called without Zod validation
        if (rootUpdateFields.departmentId) {
          const deptCollection = await getCVisionCollection(tenantId, 'departments');
          const department = await deptCollection.findOne(
            createTenantFilter(tenantId, { 
              id: rootUpdateFields.departmentId,
              isActive: true,
            })
          );
          if (!department) {
            // Log detailed error for debugging
            logger.error('[CVision Profile Section] Department validation failed:', {
              employeeId: id,
              departmentId: rootUpdateFields.departmentId,
              departmentIdType: typeof rootUpdateFields.departmentId,
              dataJsonDepartmentId: dataJson.departmentId,
              dataJsonDepartmentIdType: typeof dataJson.departmentId,
              message: 'Department ID not found in database or not active',
            });
            
            return NextResponse.json(
              { 
                error: 'Department not found', 
                code: 'DEPARTMENT_NOT_FOUND',
                message: `Department with ID "${rootUpdateFields.departmentId}" does not exist or is not active. Please select a valid department from the dropdown.`,
                details: process.env.NODE_ENV === 'development' ? {
                  receivedDepartmentId: rootUpdateFields.departmentId,
                  receivedType: typeof rootUpdateFields.departmentId,
                  originalDataJson: dataJson.departmentId,
                } : undefined,
              },
              { status: 400 }
            );
          }
        } else if (dataJson.departmentId !== undefined && !rootUpdateFields.departmentId) {
          // Department is required but was cleared/empty
          // Check if it's required in the schema
          const deptField = activeSchema.schemaJson?.fields?.find((f: any) => f.key === 'departmentId');
          if (deptField?.required) {
            return NextResponse.json(
              { 
                error: 'Department is required', 
                code: 'DEPARTMENT_REQUIRED',
                message: 'Department field is required and cannot be empty.',
              },
              { status: 400 }
            );
          }
        }

        // Position-department link check: Log warning but don't block (flexibility for various org structures)
        // Position is optional and some organizations may have employees without formal budget positions
        if (rootUpdateFields.positionId && rootUpdateFields.departmentId) {
          const departmentPositionsCollection = await getCVisionCollection(tenantId, 'departmentPositions');
          const link = await departmentPositionsCollection.findOne(
            createTenantFilter(tenantId, {
              departmentId: rootUpdateFields.departmentId,
              positionId: rootUpdateFields.positionId,
              isActive: true,
            })
          );

          if (!link && process.env.NODE_ENV === 'development') {
            // Log warning but allow the save to proceed
            logger.warn('[CVision Profile Section] Position not formally linked to department (allowed):', {
              employeeId: id,
              positionId: rootUpdateFields.positionId,
              departmentId: rootUpdateFields.departmentId,
            });
          }
        }

        // Write-through to employee root
        await employeeCollection.updateOne(
          createTenantFilter(tenantId, { id }),
          { $set: rootUpdateFields }
        );

        if (process.env.NODE_ENV === 'development') {
          logger.info('[CVision Profile Section] Write-through to root:', {
            employeeId: id,
            sectionKey,
            rootFields: rootUpdateFields,
          });
        }
      }

      // Write-through to employee root fields for PERSONAL section (demographics)
      if (sectionKey === 'PERSONAL') {
        const personalRootFields: any = {
          updatedAt: now,
          updatedBy: userId,
        };

        if (dataJson.gender !== undefined) {
          // PG enum CvisionGender expects MALE/FEMALE/OTHER (uppercase)
          if (dataJson.gender) {
            const g = String(dataJson.gender).toUpperCase();
            const VALID_GENDERS = ['MALE', 'FEMALE', 'OTHER'];
            personalRootFields.gender = VALID_GENDERS.includes(g) ? g : 'OTHER';
          } else {
            personalRootFields.gender = null;
          }
        }
        if (dataJson.nationality !== undefined) {
          personalRootFields.nationality = dataJson.nationality || null;
        }
        if (dataJson.dob !== undefined) {
          personalRootFields.dateOfBirth = dataJson.dob ? new Date(dataJson.dob) : null;
        }
        if (dataJson.fullName !== undefined) {
          personalRootFields.fullName = dataJson.fullName || null;
        }
        if (dataJson.email !== undefined) {
          personalRootFields.email = dataJson.email || null;
        }
        if (dataJson.phone !== undefined) {
          personalRootFields.phone = dataJson.phone || null;
        }

        await employeeCollection.updateOne(
          createTenantFilter(tenantId, { id }),
          { $set: personalRootFields }
        );

        if (process.env.NODE_ENV === 'development') {
          logger.info('[CVision Profile Section] PERSONAL write-through to root:', {
            employeeId: id,
            sectionKey,
            personalRootFields,
          });
        }
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: ctx.cvisionRole, tenantId, user: ctx.user }, request),
        'employee_profile_update',
        'employee_profile',
        {
          resourceId: id,
          changes: {
            before: prevDataJson,
            after: dataJson,
          },
          metadata: { changeReason, section: sectionKey },
        }
      );

      const updatedSection = await sectionCollection.findOne(
        createTenantFilter(tenantId, { employeeId: id, sectionKey })
      );

      return NextResponse.json({
        success: true,
        section: {
          sectionKey,
          schemaVersion: activeSchema.version,
          dataJson: updatedSection?.dataJson || {},
          updatedAt: updatedSection?.updatedAt,
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors, code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }
      
      // Check if it's an authz error that wasn't caught
      if (error.message?.includes('FORBIDDEN') || error.message?.includes('UNAUTHORIZED')) {
        return NextResponse.json(
          { error: error.message || 'Access denied', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
      
      logger.error('[CVision Employee Profile Section PATCH]', error?.message || String(error), error?.stack);
      return NextResponse.json(
        { error: 'Internal server error', message: error.message, code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
