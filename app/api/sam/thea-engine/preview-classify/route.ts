import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { matchDepartment, matchTaxonomyItem } from '@/lib/utils/taxonomyMatching';
import { buildOrgProfileRequiredResponse, requireTenantContext, OrgProfileRequiredError } from '@/lib/tenant/getTenantContext';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
  try {
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

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    const theaEngineFormData = new FormData();
    theaEngineFormData.append('tenantId', tenantId);
    theaEngineFormData.append('uploaderUserId', userId);
    theaEngineFormData.append('orgProfile', JSON.stringify(orgProfile));
    theaEngineFormData.append('contextRules', JSON.stringify(contextRules));

    for (const file of files) {
      theaEngineFormData.append('files', file);
    }

    for (const [key, value] of formData.entries()) {
      if (key === 'files' || key === 'tenantId' || key === 'uploaderUserId') {
        continue;
      }
      if (value instanceof File) {
        continue;
      }
      theaEngineFormData.append(key, value);
    }

    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/ingest/preview-classify`;

    let response: Response;
    try {
      response = await fetch(theaEngineUrl, {
        method: 'POST',
        body: theaEngineFormData,
      });
    } catch (fetchError) {
      logger.error('Failed to connect to thea-engine:', { error: fetchError });
      return NextResponse.json(
        // [SEC-10]
        { error: 'Document engine is not available. Please ensure the document engine is running.' },
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

    let availableDepartments: Array<{ id: string; name: string; label?: string }> = [];

    const orgNodes = await prisma.orgNode.findMany({
      where: {
        tenantId,
        type: 'department',
        isActive: true,
      },
      take: 500,
    });
    const orgDepts = orgNodes.map((node: any) => ({
      id: node.id,
      name: node.name || '',
      label: node.name || node.label || '',
    }));

    let floorDepts: Array<{ id: string; name: string; label?: string }> = [];
    try {
      const floorDocs = await prisma.floorDepartment.findMany({
        where: {
          tenantId,
          isActive: true,
        },
        take: 500,
      });
      floorDepts = floorDocs.map((d: any) => ({
        id: d.id || d.departmentId,
        name: d.label_en || d.name || d.departmentName || '',
        label: d.label_en || d.name || d.departmentName || d.label || '',
      }));
    } catch (err) {
      logger.warn('[Preview Classify] floor_departments not available:', { error: err });
    }

    const uniqueDepartments = new Map<string, { id: string; name: string; label?: string }>();
    orgDepts.forEach((dept: any) => {
      if (dept.id && (dept.name || dept.label)) {
        uniqueDepartments.set(dept.id, dept);
      }
    });
    floorDepts.forEach((dept: any) => {
      if (dept.id && (dept.name || dept.label) && !uniqueDepartments.has(dept.id)) {
        uniqueDepartments.set(dept.id, dept);
      }
    });
    availableDepartments = Array.from(uniqueDepartments.values());

    const taxonomyOperations = await prisma.taxonomyOperation.findMany({
      where: { tenantId, isActive: true },
      take: 500,
    });
    const availableOperations = taxonomyOperations
      .map((op: any) => ({ id: op.id, name: op.name || '' }))
      .filter((op: any) => op.id && op.name);

    const taxonomyFunctions = await prisma.taxonomyFunction.findMany({
      where: { tenantId, isActive: true },
      take: 500,
    });
    const availableFunctions = taxonomyFunctions
      .map((func: any) => ({ id: func.id, name: func.name || '' }))
      .filter((func: any) => func.id && func.name);

    const taxonomyRiskDomains = await prisma.taxonomyRiskDomain.findMany({
      where: { tenantId, isActive: true },
      take: 500,
    });
    const availableRiskDomains = taxonomyRiskDomains
      .map((rd: any) => ({ id: rd.id, name: rd.name || '' }))
      .filter((rd: any) => rd.id && rd.name);

    const taxonomyEntityTypes = await prisma.taxonomyEntityType.findMany({
      where: { tenantId, isActive: true },
      take: 500,
    });
    const availableEntityTypes = taxonomyEntityTypes
      .map((item: any) => ({ id: item.id, name: item.name || '' }))
      .filter((item: any) => item.id && item.name);

    const taxonomyScopes = await prisma.taxonomyScope.findMany({
      where: { tenantId, isActive: true },
      take: 500,
    });
    const availableScopes = taxonomyScopes
      .map((item: any) => ({ id: item.id, name: item.name || '' }))
      .filter((item: any) => item.id && item.name);

    const taxonomySectors = await prisma.taxonomySector.findMany({
      where: { tenantId, isActive: true },
      take: 500,
    });
    const availableSectors = taxonomySectors
      .map((item: any) => ({ id: item.id, name: item.name || '' }))
      .filter((item: any) => item.id && item.name);

    const resolveList = (
      suggestions: Array<{ name?: string; confidence?: number }> | undefined,
      candidates: Array<{ id: string; name: string }>
    ) => {
      const mappedItems: Array<any> = [];
      const resolvedIds: string[] = [];
      let mappingStatus: 'AUTO_MATCHED' | 'NEEDS_REVIEW' | 'MISSING' = 'MISSING';
      let mappingConfidence = 0;

      if (!suggestions || suggestions.length === 0) {
        return { mappedItems, resolvedIds, mappingStatus, mappingConfidence };
      }

      suggestions.forEach((suggestion) => {
        const name = suggestion?.name || '';
        if (!name) return;
        const match = matchTaxonomyItem(name, candidates);
        if (match.matched && match.matchedItem) {
          const autoMatched = !match.requiresConfirmation;
          mappedItems.push({
            id: match.matchedItem.id,
            name: match.matchedItem.name,
            isNew: false,
            autoMatched,
            requiresConfirmation: match.requiresConfirmation,
            confidence: match.matchedItem.similarity,
          });
          mappingConfidence = Math.max(mappingConfidence, match.matchedItem.similarity);
          if (autoMatched) {
            resolvedIds.push(match.matchedItem.id);
          } else {
            mappingStatus = 'NEEDS_REVIEW';
          }
        } else {
          mappedItems.push({
            id: '',
            name,
            isNew: true,
            autoMatched: false,
            requiresConfirmation: false,
            confidence: suggestion?.confidence || 0.5,
          });
          mappingStatus = mappingStatus === 'NEEDS_REVIEW' ? mappingStatus : 'MISSING';
          mappingConfidence = Math.max(mappingConfidence, suggestion?.confidence || 0);
        }
      });

      if (mappedItems.length > 0 && mappingStatus === 'MISSING') {
        mappingStatus = resolvedIds.length > 0 ? 'AUTO_MATCHED' : 'MISSING';
      }

      return { mappedItems, resolvedIds, mappingStatus, mappingConfidence };
    };

    const resolveFunction = (
      suggestion: { value?: string; confidence?: number } | undefined,
      candidates: Array<{ id: string; name: string }>
    ) => {
      if (!suggestion?.value) {
        return {
          mapped: undefined,
          resolvedId: undefined,
          mappingStatus: 'MISSING' as const,
          mappingConfidence: 0,
        };
      }
      const match = matchTaxonomyItem(suggestion.value, candidates);
      if (match.matched && match.matchedItem) {
        const autoMatched = !match.requiresConfirmation;
        return {
          mapped: {
            id: match.matchedItem.id,
            name: match.matchedItem.name,
            isNew: false,
            autoMatched,
            requiresConfirmation: match.requiresConfirmation,
            confidence: match.matchedItem.similarity,
          },
          resolvedId: autoMatched ? match.matchedItem.id : undefined,
          mappingStatus: autoMatched ? 'AUTO_MATCHED' : 'NEEDS_REVIEW',
          mappingConfidence: match.matchedItem.similarity,
        };
      }
      return {
        mapped: {
          id: '',
          name: suggestion.value,
          isNew: true,
          autoMatched: false,
          requiresConfirmation: false,
          confidence: suggestion.confidence || 0.5,
        },
        resolvedId: undefined,
        mappingStatus: 'MISSING',
        mappingConfidence: suggestion.confidence || 0.5,
      };
    };

    const resolveSingle = (
      suggestion: { value?: string; confidence?: number } | undefined,
      candidates: Array<{ id: string; name: string }>
    ) => {
      if (!suggestion?.value) {
        return {
          suggestedName: undefined,
          matchedId: undefined,
          matchedName: undefined,
          status: 'needs_review' as const,
          confidence: 0,
        };
      }
      const match = matchTaxonomyItem(suggestion.value, candidates);
      if (match.matched && match.matchedItem) {
        const autoMatched = !match.requiresConfirmation;
        return {
          suggestedName: suggestion.value,
          matchedId: match.matchedItem.id,
          matchedName: match.matchedItem.name,
          status: autoMatched ? 'mapped' : 'needs_review',
          confidence: match.matchedItem.similarity,
        };
      }
      return {
        suggestedName: suggestion.value,
        matchedId: undefined,
        matchedName: undefined,
        status: 'needs_review',
        confidence: suggestion.confidence || 0.5,
      };
    };

    if (data && Array.isArray(data.results)) {
      data.results = data.results.map((result: any, index: number) => {
        const suggestions = result?.suggestions || {};
        const entityTypeMatch = resolveSingle(suggestions?.entityType, availableEntityTypes);
        const scopeMatch = resolveSingle(suggestions?.scope, availableScopes);
        const sectorMatch = resolveSingle(suggestions?.sector, availableSectors);

        const mappedDepartments: Array<any> = [];
        const resolvedDepartmentIds: string[] = [];
        let suggestedDepartmentName: string | undefined;

        if (Array.isArray(suggestions.departments) && suggestions.departments.length > 0) {
          suggestions.departments.forEach((dept: any) => {
            const deptName = dept?.name || '';
            if (!deptName) return;
            const match = matchDepartment(deptName, availableDepartments);
            if (match.matched && match.matchedItem) {
              const autoMatched = !match.requiresConfirmation;
              mappedDepartments.push({
                id: match.matchedItem.id,
                label: match.matchedItem.name,
                confidence: dept?.confidence || match.matchedItem.similarity || 0.7,
                autoMatched,
                requiresConfirmation: match.requiresConfirmation,
              });
              if (autoMatched) {
                resolvedDepartmentIds.push(match.matchedItem.id);
              }
            } else if (!suggestedDepartmentName) {
              suggestedDepartmentName = deptName;
            }
          });
        }

        const operationsResolution = resolveList(suggestions.operations, availableOperations);
        const functionResolution = resolveFunction(suggestions.function, availableFunctions);
        const riskDomainResolution = resolveList(suggestions.riskDomains, availableRiskDomains);

        return {
          ...result,
          filename: result?.filename || files[index]?.name,
          entityType: entityTypeMatch,
          scope: scopeMatch,
          sector: sectorMatch,
          entityTypeId: entityTypeMatch.matchedId,
          scopeId: scopeMatch.matchedId,
          sectorId: sectorMatch.matchedId,
          departments: mappedDepartments,
          departmentIds: resolvedDepartmentIds,
          suggestedDepartmentName,
          operationIds: operationsResolution.resolvedIds,
          functionId: functionResolution.resolvedId,
          riskDomainIds: riskDomainResolution.resolvedIds,
          mappingStatus: {
            operations: operationsResolution.mappingStatus,
            function: functionResolution.mappingStatus,
            riskDomains: riskDomainResolution.mappingStatus,
          },
          mappingConfidence: {
            operations: operationsResolution.mappingConfidence,
            function: functionResolution.mappingConfidence,
            riskDomains: riskDomainResolution.mappingConfidence,
          },
          suggestions: {
            ...suggestions,
            departments: mappedDepartments.length > 0 ? mappedDepartments : suggestions.departments,
            classification: {
              ...(suggestions.classification || {}),
              operations: operationsResolution.mappedItems,
              function: functionResolution.mapped || suggestions.function,
              riskDomains: riskDomainResolution.mappedItems,
            },
          },
        };
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    logger.error('Preview classify error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.upload.create' });
