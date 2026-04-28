import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { PolicyDocument } from '@/lib/models/Policy';
import { replaceOperationLinks } from '@/lib/sam/operationLinks';
import { buildOrgProfileRequiredResponse, requireTenantContext, OrgProfileRequiredError } from '@/lib/tenant/getTenantContext';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId }) => {
  try {
    // Get form data from request
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    try {
      await requireTenantContext(req, tenantId);
    } catch (error) {
      if (error instanceof OrgProfileRequiredError) {
        return buildOrgProfileRequiredResponse();
      }
    }

    // Add metadata if provided (supporting both old and new formats)
    const scope = formData.get('scope');
    const scopeId = formData.get('scopeId');
    const departments = formData.getAll('departments[]');
    const entityType = formData.get('entityType');
    const entityTypeId = formData.get('entityTypeId');
    const sectorId = formData.get('sectorId');
    const creationContextRaw = formData.get('creationContext');
    let creationContext: Record<string, unknown> | null = null;
    if (creationContextRaw && typeof creationContextRaw === 'string') {
      try {
        creationContext = JSON.parse(creationContextRaw);
      } catch (error) {
        logger.warn('[API /ingest] Invalid creationContext JSON:', { error: error });
      }
    }

    // LOG: API route at start - log body.entityType
    logger.info(`[API /ingest] Received entityType from body:`, { entityType, ...{
      type: typeof entityType,
      isString: typeof entityType === 'string',
      isEmpty: entityType === '' || entityType === null || entityType === undefined,
      files: files.map(f => f.name),
      scope,
      departments: departments.length,
    } });

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Create new FormData for thea-engine
    const theaEngineFormData = new FormData();

    // Add tenantId (required by backend as Form field)
    theaEngineFormData.append('tenantId', tenantId);
    // Add uploaderUserId
    theaEngineFormData.append('uploaderUserId', userId);
    theaEngineFormData.append('orgProfile', JSON.stringify(orgProfile));
    theaEngineFormData.append('contextRules', JSON.stringify(contextRules));

    // Add files (File objects can be appended directly)
    for (const file of files) {
      theaEngineFormData.append('files', file);
    }
    const sector = formData.get('sector');
    const country = formData.get('country');
    const reviewCycle = formData.get('reviewCycle');
    const reviewCycleMonths = formData.get('reviewCycleMonths');
    const nextReviewDate = formData.get('nextReviewDate');
    const expiryDate = formData.get('expiryDate');
    const effectiveDate = formData.get('effectiveDate');
    const parseDateValue = (value: FormDataEntryValue | null) => {
      if (!value || typeof value !== 'string') return undefined;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return undefined;
      return parsed;
    };
    const effectiveDateValue = parseDateValue(effectiveDate);
    const expiryDateValue = parseDateValue(expiryDate);

    logger.info(`[API /ingest] Dates received:`, {
      effectiveDate,
      expiryDate,
      effectiveDateValue,
      expiryDateValue,
    });

    // Smart Classification fields
    const classification = formData.get('classification');
    const function_ = formData.get('function');
    const riskDomains = formData.getAll('riskDomains[]');
    const operations = formData.getAll('operations[]');
    const regulators = formData.getAll('regulators[]');
    const stage = formData.get('stage');

    // Status and lifecycle
    const status = formData.get('status');
    const version = formData.get('version');
    const source = formData.get('source');

    if (scope) theaEngineFormData.append('scope', scope as string);
    if (departments && departments.length > 0) {
      departments.forEach(dept => theaEngineFormData.append('departments[]', dept as string));
    }
    if (entityType) theaEngineFormData.append('entityType', entityType as string);
    if (scopeId) theaEngineFormData.append('scopeId', scopeId as string);
    if (entityTypeId) theaEngineFormData.append('entityTypeId', entityTypeId as string);
    if (sectorId) theaEngineFormData.append('sectorId', sectorId as string);
    if (sector) theaEngineFormData.append('sector', sector as string);
    if (country) theaEngineFormData.append('country', country as string);
    if (reviewCycle) theaEngineFormData.append('reviewCycle', reviewCycle as string);
    if (reviewCycleMonths) theaEngineFormData.append('reviewCycleMonths', reviewCycleMonths as string);
    if (nextReviewDate) theaEngineFormData.append('nextReviewDate', nextReviewDate as string);
    if (expiryDate) theaEngineFormData.append('expiryDate', expiryDate as string);
    if (effectiveDate) theaEngineFormData.append('effectiveDate', effectiveDate as string);

    // Smart Classification
    if (classification) theaEngineFormData.append('classification', classification as string);
    if (function_) theaEngineFormData.append('function', function_ as string);
    if (riskDomains && riskDomains.length > 0) {
      riskDomains.forEach(rd => theaEngineFormData.append('riskDomains[]', rd as string));
    }
    if (operations && operations.length > 0) {
      operations.forEach(op => theaEngineFormData.append('operations[]', op as string));
    }
    if (regulators && regulators.length > 0) {
      regulators.forEach(reg => theaEngineFormData.append('regulators[]', reg as string));
    }
    if (stage) theaEngineFormData.append('stage', stage as string);

    // Status and lifecycle
    if (status) theaEngineFormData.append('status', status as string);
    if (version) theaEngineFormData.append('version', version as string);
    if (source) theaEngineFormData.append('source', source as string);

    // Forward to thea-engine
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/ingest`;

    let response;
    try {
      response = await fetch(theaEngineUrl, {
        method: 'POST',
        body: theaEngineFormData,
      });
    } catch (fetchError) {
      logger.error('Failed to connect to thea-engine:', { error: fetchError });
      return NextResponse.json(
        // [SEC-10]
        { error: 'Document engine is not available. Please ensure the document engine is running on port 8001.' },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Policy engine error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // CRITICAL: Extract metadata from formData FIRST (before validation)
    const normalizeRequiredType = (value?: string | null) => {
      if (!value) return undefined;
      if (value === 'Policy') return 'policy';
      if (value === 'SOP') return 'sop';
      if (value === 'Workflow') return 'workflow';
      return undefined;
    };
    let entityTypeValue = entityType as string | null;
    let scopeValue = scope as string | null;
    let operationsArray = operations as string[] | null;
    const normalizeToken = (value: string) => value.trim().toLowerCase();

    // CRITICAL: Extract and validate departmentIds BEFORE using them
    // First, validate format (UUID/ObjectId/valid ID)
    let departmentsArray = (departments as string[] | null)?.filter((dept: string) => {
      // Must be a non-empty string
      if (!dept || typeof dept !== 'string' || dept.trim() === '') {
        return false;
      }
      // Should look like a UUID or valid ID (not a department name)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dept);
      const isObjectId = /^[0-9a-f]{24}$/i.test(dept);
      const isSimpleId = /^[a-z0-9_-]{8,}$/i.test(dept);

      const isValid = isUUID || isObjectId || isSimpleId;

      if (!isValid) {
        logger.warn(`[API /ingest] Invalid department ID format (may be a name instead of ID): "${dept}"`);
      }

      return isValid;
    }) || null;

    if (creationContext && creationContext.source === 'gap_modal') {
      const pinnedEntityType = normalizeRequiredType(creationContext.requiredType as string);
      if (pinnedEntityType) {
        entityTypeValue = pinnedEntityType;
      }
      if (creationContext.scope) {
        scopeValue = creationContext.scope as string;
      }
      if (creationContext.operationId) {
        const merged = new Set([...(operationsArray || []), creationContext.operationId as string]);
        operationsArray = Array.from(merged);
      }
      if (creationContext.departmentId) {
        const merged = new Set([...(departmentsArray || []), creationContext.departmentId as string]);
        departmentsArray = Array.from(merged);
      }
      if (process.env.NODE_ENV !== 'production') {
        logger.info('[API /ingest] creationContext enforced', {
          tenantId,
          creationContext,
          entityTypeValue,
          scopeValue,
          operationsArray,
          departmentsArray,
        });
      }
    }

    // CRITICAL: Validate departmentIds exist and are active in the database
    // CRITICAL ARCHITECTURAL RULE: Read departments from Prisma (FloorDepartment + OrgNode)
    if (departmentsArray && departmentsArray.length > 0) {
      logger.info(`[API /ingest] Validating departmentIds from Prisma`);

      // Fetch all active departments to validate against
      const [validDeptDocs, validNodeDocs] = await Promise.all([
        prisma.floorDepartment.findMany({
          where: {
            tenantId: tenantId,
            isActive: true,
          },
          select: { id: true },
          take: 500,
        }),
        prisma.orgNode.findMany({
          where: {
            tenantId: tenantId,
            type: 'department',
            isActive: true,
          },
          select: { id: true },
          take: 500,
        }),
      ]);

      const validDeptIds = new Set([
        ...validDeptDocs.map((d) => d.id),
        ...validNodeDocs.map((d) => d.id),
      ]);

      // Filter out invalid department IDs
      const invalidDeptIds = departmentsArray.filter((deptId: string) => !validDeptIds.has(deptId));

      if (invalidDeptIds.length > 0) {
        logger.error(`[API /ingest] CRITICAL: Invalid departmentIds detected:`, {
          invalidIds: invalidDeptIds,
          validIds: Array.from(validDeptIds),
          allReceived: departmentsArray,
        });

        // Remove invalid IDs
        departmentsArray = departmentsArray.filter((deptId: string) => validDeptIds.has(deptId));

        // If scope is 'department' and no valid departments remain, this is an error
        if (scopeValue === 'department' && departmentsArray.length === 0) {
          return NextResponse.json(
            {
              error: 'DEPARTMENT_NOT_FOUND',
              message: `One or more department IDs are invalid or inactive: ${invalidDeptIds.join(', ')}. Please select valid departments.`,
              invalidDepartmentIds: invalidDeptIds,
            },
            { status: 400 }
          );
        }
      }

      logger.info(`[API /ingest] Validated departmentIds:`, {
        valid: departmentsArray,
        invalid: invalidDeptIds,
        totalReceived: (departments as string[]).length,
      });
    }

    // CRITICAL: Create or update documents with entityType, scope, departmentIds IMMEDIATELY after thea-engine ingest
    // This ensures entityType is saved correctly
    if (data.jobs && Array.isArray(data.jobs) && data.jobs.length > 0) {
      // Helper function to calculate file hash
      const calculateFileHash = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return crypto.createHash('sha256').update(buffer).digest('hex');
      };

      // CRITICAL LOG: Verify entityTypeValue
      logger.info(`[API /ingest] entityTypeValue:`, {
        entityTypeValue,
        type: typeof entityTypeValue,
        isString: typeof entityTypeValue === 'string',
        isEmpty: !entityTypeValue || entityTypeValue === '' || entityTypeValue === null || entityTypeValue === undefined,
        rawEntityType: entityType,
        filesCount: files.length,
        jobs: data.jobs.map((j: Record<string, unknown>) => ({ jobId: j.jobId, policyId: j.policyId, filename: j.filename })),
      });

      // Resolve entityType: ONLY from body.entityType (from Step 4 resolvedContext)
      // NO filename inference - content-based classification only
      type SamEntityType = 'policy' | 'sop' | 'workflow' | 'playbook';

      const resolveEntityType = (fileName: string): SamEntityType => {
        // Use entityType from body (finalResolvedContext from frontend Step 4)
        // CRITICAL: Check for any truthy value, including 'manual', 'playbook', 'workflow', 'sop', etc.
        // Must check for string type and non-empty string
        if (entityTypeValue && typeof entityTypeValue === 'string' && entityTypeValue.trim() !== '') {
          const raw = entityTypeValue.trim().toLowerCase();
          if (raw === 'policy' || raw === 'sop' || raw === 'workflow' || raw === 'playbook') {
            logger.info(`[resolveEntityType] Using body.entityType: "${raw}" for ${fileName}`);
            return raw;
          }
          logger.warn(`[resolveEntityType] Unknown entityType "${raw}" for ${fileName}. Falling back to 'policy'.`);
          return 'policy';
        }

        // Log if entityTypeValue is invalid
        if (entityTypeValue !== null && entityTypeValue !== undefined) {
          logger.warn(`[resolveEntityType] entityTypeValue is invalid for ${fileName}:`, {
            value: entityTypeValue,
            type: typeof entityTypeValue,
            isEmpty: entityTypeValue === '',
            isWhitespace: typeof entityTypeValue === 'string' && entityTypeValue.trim() === '',
          });
        }

        // NO filename inference - this should not happen if Step 4 hard gate is working
        // Default to "policy" only as last resort (should be rare)
        logger.warn(`[resolveEntityType] No entityType provided for ${fileName}. Using default 'policy' (this should not happen if Step 4 validation is working).`);
        return 'policy';
      };

      // Resolve operationIds from incoming tokens (ids/names/codes)
      const resolveOperationIds = async (tokens: string[] | null) => {
        if (!tokens || tokens.length === 0) return { resolvedIds: [], unresolvedCount: 0 };
        const allOperations = await prisma.taxonomyOperation.findMany({
          where: { tenantId, isActive: true },
          take: 500,
        });
        type TaxOp = typeof allOperations[number] & { normalizedName?: string };
        const operationsById = new Map<string, TaxOp>();
        const operationsByNormalizedName = new Map<string, TaxOp>();
        const operationsByCode = new Map<string, TaxOp>();
        const operationsByName = new Map<string, TaxOp>();
        allOperations.forEach((op: TaxOp) => {
          if (!op) return;
          const opId = op.id;
          if (opId) operationsById.set(opId, op);
          if (op.normalizedName) operationsByNormalizedName.set(op.normalizedName, op);
          if (op.code) operationsByCode.set(op.code, op);
          if (op.name) operationsByName.set(op.name.toLowerCase(), op);
        });

        const resolvedIds: string[] = [];
        let unresolvedCount = 0;
        tokens.forEach((token) => {
          if (!token || typeof token !== 'string') return;
          if (operationsById.has(token)) {
            resolvedIds.push(token);
            return;
          }
          const normalized = normalizeToken(token);
          if (operationsByNormalizedName.has(normalized)) {
            resolvedIds.push(operationsByNormalizedName.get(normalized).id);
            return;
          }
          if (operationsByCode.has(token)) {
            resolvedIds.push(operationsByCode.get(token).id);
            return;
          }
          if (operationsByName.has(normalized)) {
            resolvedIds.push(operationsByName.get(normalized).id);
            return;
          }
          unresolvedCount += 1;
        });

        return {
          resolvedIds: Array.from(new Set(resolvedIds)),
          unresolvedCount,
        };
      };

      // Helper: build the where clause for finding policy documents (backward-compat OR logic)
      const buildDocWhere = (theaEngineId: string) => ({
        tenantId: tenantId,
        isActive: true,
        deletedAt: null,
        OR: [
          { theaEngineId: theaEngineId },
          { policyEngineId: theaEngineId },
          { id: theaEngineId },
        ],
      });

      // Helper: build update data with classification JSON merge
      const buildClassificationMerge = async (
        existingClassification: Record<string, unknown> | null,
        resolvedOperationIds: string[],
        operationsArrayLocal: string[] | null,
        unresolvedCount: number,
      ) => {
        const classificationUpdates: Record<string, unknown> = {};
        if (resolvedOperationIds.length > 0) {
          classificationUpdates.operations = resolvedOperationIds;
        } else if (operationsArrayLocal && operationsArrayLocal.length > 0) {
          classificationUpdates.operations = operationsArrayLocal;
        }
        if (unresolvedCount > 0) {
          classificationUpdates.needsReview = true;
        } else {
          classificationUpdates.needsReview = false;
        }
        if (Object.keys(classificationUpdates).length > 0) {
          return {
            ...(existingClassification || {}),
            ...classificationUpdates,
          };
        }
        return undefined;
      };

      // Helper function to update document with retries
      const updateDocumentWithRetries = async (
        fileName: string,
        resolvedEntityType: SamEntityType,
        policyId?: string,
        maxRetries: number = 5
      ): Promise<boolean> => {
        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
          entityType: resolvedEntityType,
          orgProfileSnapshot: orgProfile,
          contextRulesSnapshot: contextRules,
        };

      if (creationContext && creationContext.source === 'gap_modal') {
        updateData.creationContext = creationContext;
      }

        if (entityTypeId) updateData.entityTypeId = entityTypeId;

        if (scopeValue) updateData.scope = scopeValue;
        if (scopeId) updateData.scopeId = scopeId;
        if (departmentsArray && departmentsArray.length > 0) {
          updateData.departmentIds = departmentsArray;
          // LOG: Log persisted departmentIds
          logger.info(`[API /ingest] Persisting departmentIds for ${fileName}:`, {
            departmentIds: departmentsArray,
            count: departmentsArray.length,
            tenantId: tenantId,
          });
        }
        let resolvedOperationIds: string[] = [];
        if (operationsArray && operationsArray.length > 0) {
          const { resolvedIds, unresolvedCount } = await resolveOperationIds(operationsArray);
          resolvedOperationIds = resolvedIds;
          if (resolvedIds.length > 0) {
            updateData.operationIds = resolvedIds;
          }
          updateData.operationalMappingNeedsReview = unresolvedCount > 0;

          // Read existing classification, merge operations into it
          let existingClassification: Record<string, unknown> | null = null;
          if (policyId) {
            const existingDoc = await prisma.policyDocument.findFirst({
              where: buildDocWhere(policyId),
              select: { classification: true },
            });
            existingClassification = (existingDoc?.classification as Record<string, unknown>) || {};
          }
          const mergedClassification = await buildClassificationMerge(
            existingClassification,
            resolvedIds,
            operationsArray,
            unresolvedCount,
          );
          if (mergedClassification) {
            updateData.classification = mergedClassification;
          }

          if (process.env.NODE_ENV !== 'production') {
            logger.info('[ingest] operations resolved', {
              tenantId,
              fileName,
              input: operationsArray,
              resolvedIds,
              unresolvedCount,
            });
          }
        }
        if (effectiveDateValue) updateData.effectiveDate = effectiveDateValue;
        if (expiryDateValue) updateData.expiryDate = expiryDateValue;
        if (sectorId) updateData.sectorId = sectorId;
        if (reviewCycleMonths) updateData.reviewCycleMonths = Number(reviewCycleMonths);
        if (nextReviewDate) updateData.nextReviewDate = nextReviewDate as string;

        if (effectiveDateValue || expiryDateValue) {
          logger.info(`[API /ingest] Persisting dates for ${fileName}:`, {
            effectiveDate: effectiveDateValue,
            expiryDate: expiryDateValue,
          });
        }

        // Strategy 1: Try by policyId if available (most reliable)
        if (policyId) {
          const result = await prisma.policyDocument.updateMany({
            where: buildDocWhere(policyId),
            data: updateData as Prisma.PolicyDocumentUncheckedUpdateManyInput,
          });
          if (result.count > 0) {
            logger.info(`Updated by policyId for ${fileName}: entityType="${resolvedEntityType}"`);
            return true;
          }
        }

        // Strategy 2: Match by originalFileName
        let result = await prisma.policyDocument.updateMany({
          where: {
            originalFileName: fileName,
            isActive: true,
            tenantId: tenantId,
            deletedAt: null,
          },
          data: updateData as Prisma.PolicyDocumentUncheckedUpdateManyInput,
        });

        // Strategy 3: If not found, try matching by storedFileName (case-insensitive contains)
        if (result.count === 0) {
          const escapedFileName = fileName.replace(/[%_]/g, '\\$&');
          result = await prisma.policyDocument.updateMany({
            where: {
              filename: { contains: escapedFileName, mode: 'insensitive' as const },
              isActive: true,
              tenantId: tenantId,
              deletedAt: null,
            },
            data: updateData as Prisma.PolicyDocumentUncheckedUpdateManyInput,
          });
        }

        // Strategy 4: If still not found, try matching by title
        if (result.count === 0) {
          const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/i, '');
          const escapedName = fileNameWithoutExt.replace(/[%_]/g, '\\$&');
          result = await prisma.policyDocument.updateMany({
            where: {
              OR: [
                { title: { contains: escapedName, mode: 'insensitive' as const } },
                { originalFileName: { contains: escapedName, mode: 'insensitive' as const } },
              ],
              isActive: true,
              tenantId: tenantId,
              deletedAt: null,
            },
            data: updateData as Prisma.PolicyDocumentUncheckedUpdateManyInput,
          });
        }

        if (result.count > 0) {
          logger.info(`Updated metadata for ${fileName}: entityType="${resolvedEntityType}"`);
          if (resolvedOperationIds.length > 0 || (operationsArray && operationsArray.length > 0)) {
            const currentDoc = await prisma.policyDocument.findFirst({
              where: {
                tenantId: tenantId,
                isActive: true,
                deletedAt: null,
                OR: [
                  { originalFileName: fileName },
                  ...(policyId ? [{ theaEngineId: policyId }, { policyEngineId: policyId }, { id: policyId }] : []),
                ],
              },
              select: { theaEngineId: true, id: true },
            });
            const documentId = currentDoc?.theaEngineId || currentDoc?.id || policyId || fileName;
            const linkDepartmentId = (creationContext?.departmentId as string | undefined) || (departmentsArray && departmentsArray.length > 0 ? departmentsArray[0] : undefined);
            await replaceOperationLinks(req, tenantId, documentId, resolvedOperationIds, resolvedEntityType, linkDepartmentId);
          }
          return true;
        }

        // If not found, retry with delays
        if (result.count === 0) {
          logger.info(`No document found to update for ${fileName} - will retry with delays`);
          const retryDelays = [1000, 2000, 3000, 5000, 10000];

          for (let retryIndex = 0; retryIndex < maxRetries; retryIndex++) {
            await new Promise(resolve => setTimeout(resolve, retryDelays[retryIndex]));

            try {
              // Try by policyId first if available
              if (policyId) {
                const retryResult = await prisma.policyDocument.updateMany({
                  where: buildDocWhere(policyId),
                  data: { entityType: resolvedEntityType, updatedAt: new Date() },
                });
                if (retryResult.count > 0) {
                  logger.info(`Retry ${retryIndex + 1}: Updated entityType to "${resolvedEntityType}" for ${fileName} (by policyId)`);
                  return true;
                }
              }

              // Try by originalFileName
              let retryResult = await prisma.policyDocument.updateMany({
                where: {
                  originalFileName: fileName,
                  isActive: true,
                  tenantId: tenantId,
                  deletedAt: null,
                },
                data: { entityType: resolvedEntityType, updatedAt: new Date() },
              });

              if (retryResult.count === 0) {
                // Try storedFileName (case-insensitive contains)
                const escapedFileName = fileName.replace(/[%_]/g, '\\$&');
                retryResult = await prisma.policyDocument.updateMany({
                  where: {
                    filename: { contains: escapedFileName, mode: 'insensitive' as const },
                    isActive: true,
                    tenantId: tenantId,
                    deletedAt: null,
                  },
                  data: { entityType: resolvedEntityType, updatedAt: new Date() },
                });
              }

              if (retryResult.count > 0) {
                logger.info(`Retry ${retryIndex + 1}: Updated entityType to "${resolvedEntityType}" for ${fileName}`);
                return true;
              }
            } catch (retryError) {
              logger.warn(`Retry ${retryIndex + 1} failed for ${fileName}:`, { error: retryError });
            }
          }

          logger.warn(`All retries failed for ${fileName}. Document may not exist yet.`);
          return false;
        }

        return false;
      };

      // Create or update documents - match files with jobs by index
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        const fileName = file.name;
        const job = data.jobs[fileIndex];
        const policyId = job?.policyId;

        try {
          // CRITICAL: Resolve entityType properly - DO NOT hardcode "policy"
          const resolvedEntityType = resolveEntityType(fileName);

          // CRITICAL LOG: Verify entityType before saving
          logger.info(`[API /ingest] EntityType resolution for ${fileName}:`, {
            fromBody: entityTypeValue,
            inferred: resolveEntityType(fileName),
            final: resolvedEntityType,
            willSave: resolvedEntityType,
            policyId,
            jobId: job?.jobId,
            entityTypeValueType: typeof entityTypeValue,
            entityTypeValueEmpty: !entityTypeValue || entityTypeValue === '' || entityTypeValue === null || entityTypeValue === undefined,
          });

          // Try to find existing document first
          let existingDoc: Awaited<ReturnType<typeof prisma.policyDocument.findFirst>> = null;
          if (policyId) {
            // CRITICAL: Look up by theaEngineId first (unified system)
            existingDoc = await prisma.policyDocument.findFirst({
              where: {
                theaEngineId: policyId,
                isActive: true,
                tenantId: tenantId,
              },
            });

            // Fallback: try by id (legacy)
            if (!existingDoc) {
              existingDoc = await prisma.policyDocument.findFirst({
                where: {
                  id: policyId,
                  isActive: true,
                  tenantId: tenantId,
                },
              });
            }
          }

          if (!existingDoc) {
            // Try by originalFileName
            existingDoc = await prisma.policyDocument.findFirst({
              where: {
                originalFileName: fileName,
                isActive: true,
                tenantId: tenantId,
              },
            });
          }

          if (!existingDoc) {
            // Document doesn't exist - create it
            logger.info(`[API /ingest] Creating new document for ${fileName} with entityType="${resolvedEntityType}"`);

            const fileHash = await calculateFileHash(file);
            const year = new Date().getFullYear();
            const documentId = `POL-${year}-${uuidv4().substring(0, 8).toUpperCase()}`;
            const newPolicyId = policyId || uuidv4();

            const newDocData: Record<string, unknown> = {
              theaEngineId: policyId, // CRITICAL: Link to thea-engine (source of truth)
              title: fileName.replace(/\.[^/.]+$/i, '').replace(/_/g, ' '),
              originalFileName: fileName,
              storedFileName: `${documentId}-${fileName}`,
              fileType: (file.type || 'application/octet-stream'),
              status: (status as string) || 'draft',
              uploadedBy: userId || 'system',
              tenantId,
              isActive: true,
              entityType: resolvedEntityType, // CRITICAL: Set entityType immediately
            };

            if (scopeValue === 'department' || scopeValue === 'shared' || scopeValue === 'enterprise') {
              newDocData.scope = scopeValue;
            }
            if (departmentsArray && departmentsArray.length > 0) {
              newDocData.departmentIds = departmentsArray;
              // LOG: Log persisted departmentIds
              logger.info(`[API /ingest] Persisting departmentIds for ${fileName}:`, {
                departmentIds: departmentsArray,
                count: departmentsArray.length,
                tenantId: tenantId,
              });
            }
            if (operationsArray && operationsArray.length > 0) {
              newDocData.classification = { operations: operationsArray };
            }
            if (effectiveDateValue) newDocData.effectiveDate = effectiveDateValue;
            if (expiryDateValue) newDocData.expiryDate = expiryDateValue;
            if (reviewCycleMonths) newDocData.reviewCycleMonths = Number(reviewCycleMonths);
            if (nextReviewDate) {
              const parsed = new Date(String(nextReviewDate));
              if (!Number.isNaN(parsed.getTime())) {
                newDocData.nextReviewDate = parsed;
              }
            }
            if (version) newDocData.version = Number(version) || 1;
            if (source) newDocData.source = source as string;

            try {
              await prisma.policyDocument.create({
                data: newDocData as Prisma.PolicyDocumentUncheckedCreateInput,
              });
              logger.info(`Created document for ${fileName} with entityType="${resolvedEntityType}"`);
            } catch (insertError: unknown) {
              // If insert fails (e.g., duplicate), try to update instead
              const prismaError = insertError as { code?: string; message?: string };
              if (prismaError.code === 'P2002' || prismaError.message?.includes('Unique constraint')) {
                logger.info(`[API /ingest] Document already exists for ${fileName}, updating instead...`);
                await updateDocumentWithRetries(fileName, resolvedEntityType, policyId);
              } else {
                logger.error(`[API /ingest] Failed to create document for ${fileName}:`, { error: insertError });
              }
            }
          } else {
            // Document exists - update it with theaEngineId if missing
            logger.info(`[API /ingest] Updating existing document for ${fileName} with entityType="${resolvedEntityType}"`);

            // CRITICAL: Ensure theaEngineId is set (link to thea-engine)
            if (policyId && !existingDoc.theaEngineId) {
              await prisma.policyDocument.updateMany({
                where: { id: existingDoc.id, tenantId },
                data: { theaEngineId: policyId, updatedAt: new Date() },
              });
            }

            await updateDocumentWithRetries(fileName, resolvedEntityType, policyId || existingDoc.id);
          }
        } catch (updateError) {
          logger.warn(`Failed to create/update metadata for ${fileName}:`, { error: updateError });
          // Don't fail - thea-engine ingest was successful
        }
      }
    }

    // Trigger continuous integrity run (best-effort)
    try {
      const documentIds = (data.jobs || [])
        .map((job: Record<string, unknown>) => job.policyId || job.id)
        .filter(Boolean);
      if (documentIds.length > 0) {
        await fetch(new URL('/api/sam/integrity/runs', req.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
          body: JSON.stringify({
            type: 'issues',
            documentIds,
            scope: { type: 'selection' },
          }),
        });
      }
    } catch (integrityError) {
      logger.warn('Failed to trigger integrity run on ingest:', { error: integrityError });
    }

    return NextResponse.json(data);

  } catch (error) {
    logger.error('Ingest error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.upload.create' });
