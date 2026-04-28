/**
 * FHIR Route Helpers
 *
 * Shared utilities for FHIR API route handlers.
 * Reduces boilerplate across the 20+ FHIR resource routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fhirRead, fhirSearch, fhirCreate, fhirUpdate } from './server';

/**
 * Handle GET /api/fhir/{ResourceType} — search
 */
export async function handleFhirSearch(
  req: NextRequest,
  tenantId: string,
  resourceType: string,
): Promise<NextResponse> {
  const baseUrl = new URL(req.url).origin;
  const searchParams = new URL(req.url).searchParams;
  const bundle = await fhirSearch(tenantId, resourceType, searchParams, baseUrl);

  return NextResponse.json(bundle, {
    headers: { 'Content-Type': 'application/fhir+json' },
  });
}

/**
 * Handle POST /api/fhir/{ResourceType} — create
 */
export async function handleFhirCreate(
  req: NextRequest,
  tenantId: string,
  resourceType: string,
  transformer?: (body: any) => Record<string, unknown>,
): Promise<NextResponse> {
  const body = await req.json();

  if (body.resourceType && body.resourceType !== resourceType) {
    return NextResponse.json(
      {
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'invalid',
          diagnostics: `Expected resourceType ${resourceType}`,
        }],
      },
      { status: 400, headers: { 'Content-Type': 'application/fhir+json' } },
    );
  }

  const theaData = transformer ? transformer(body) : body;
  const result = await fhirCreate(tenantId, resourceType, theaData);

  if ('issue' in result) {
    return NextResponse.json(result, {
      status: 400,
      headers: { 'Content-Type': 'application/fhir+json' },
    });
  }

  return NextResponse.json(result.resource, {
    status: 201,
    headers: {
      'Content-Type': 'application/fhir+json',
      Location: `/api/fhir/${resourceType}/${result.id}`,
    },
  });
}

/**
 * Handle GET /api/fhir/{ResourceType}/[id] — read
 */
export async function handleFhirRead(
  tenantId: string,
  resourceType: string,
  id: string,
): Promise<NextResponse> {
  const resource = await fhirRead(tenantId, resourceType, id);

  if ('issue' in resource) {
    const status = resource.issue[0]?.code === 'not-found' ? 404 : 400;
    return NextResponse.json(resource, {
      status,
      headers: { 'Content-Type': 'application/fhir+json' },
    });
  }

  return NextResponse.json(resource, {
    headers: { 'Content-Type': 'application/fhir+json' },
  });
}

/**
 * Handle PUT /api/fhir/{ResourceType}/[id] — update
 */
export async function handleFhirUpdate(
  req: NextRequest,
  tenantId: string,
  resourceType: string,
  id: string,
  transformer?: (body: any) => Record<string, unknown>,
): Promise<NextResponse> {
  const body = await req.json();
  const theaData = transformer ? transformer(body) : body;
  const result = await fhirUpdate(tenantId, resourceType, id, theaData);

  if ('issue' in result) {
    const status = result.issue[0]?.code === 'not-found' ? 404 : 400;
    return NextResponse.json(result, {
      status,
      headers: { 'Content-Type': 'application/fhir+json' },
    });
  }

  return NextResponse.json(result, {
    headers: { 'Content-Type': 'application/fhir+json' },
  });
}
