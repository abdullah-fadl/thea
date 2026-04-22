import { getOrgContextSnapshot } from '@/lib/sam/contextRules';

type GatewayQuery = Record<string, string | number | boolean | undefined | null>;

const buildGatewayUrl = (req: Request, path: string, query?: GatewayQuery) => {
  const origin = new URL(req.url).origin;
  const url = new URL(path, origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
};

const forwardGatewayRequest = async (req: Request, input: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  const cookie = req.headers.get('cookie');
  if (cookie && !headers.has('cookie')) {
    headers.set('cookie', cookie);
  }
  return fetch(input, { ...init, headers });
};

const attachContextHeaders = (headers: Headers, orgProfile: any, contextRules: any) => {
  try {
    headers.set('x-org-profile', JSON.stringify(orgProfile));
    headers.set('x-context-rules', JSON.stringify(contextRules));
  } catch {
    // Best-effort only
  }
};

export async function theaEngineSearch(req: Request, tenantId: string, body: Record<string, any>) {
  const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);
  const url = buildGatewayUrl(req, '/api/sam/thea-engine/search');
  const response = await forwardGatewayRequest(req, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, tenantId, orgProfile, contextRules }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Policy engine search failed');
  }
  return response.json();
}

export async function theaEngineListPolicies(
  req: Request,
  tenantId: string,
  queryParams?: GatewayQuery
) {
  const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);
  const url = buildGatewayUrl(req, '/api/sam/thea-engine/policies', queryParams);
  const headers = new Headers({ 'Content-Type': 'application/json', 'x-tenant-id': tenantId });
  attachContextHeaders(headers, orgProfile, contextRules);
  const response = await forwardGatewayRequest(req, url, {
    method: 'GET',
    headers,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Policy engine list failed');
  }
  return response.json();
}

export async function theaEngineGetFile(req: Request, tenantId: string, policyId: string) {
  const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);
  const url = buildGatewayUrl(req, `/api/sam/thea-engine/policies/${policyId}/file`);
  const headers = new Headers({ 'x-tenant-id': tenantId });
  attachContextHeaders(headers, orgProfile, contextRules);
  return forwardGatewayRequest(req, url, {
    method: 'GET',
    headers,
  });
}

export async function theaEngineDeletePolicy(req: Request, tenantId: string, policyId: string) {
  const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);
  const url = buildGatewayUrl(req, `/api/sam/thea-engine/policies/${policyId}`);
  const headers = new Headers({ 'x-tenant-id': tenantId });
  attachContextHeaders(headers, orgProfile, contextRules);
  const response = await forwardGatewayRequest(req, url, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Policy engine delete failed');
  }
  return response.json().catch(() => ({}));
}

export async function theaEngineReprocessPolicy(
  req: Request,
  tenantId: string,
  policyId: string,
  mode?: string
) {
  const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);
  const url = buildGatewayUrl(req, `/api/sam/thea-engine/policies/${policyId}/reprocess`);
  const response = await forwardGatewayRequest(req, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ mode, orgProfile, contextRules }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Policy engine reprocess failed');
  }
  return response.json();
}

export async function theaEngineRewritePolicy(
  req: Request,
  tenantId: string,
  policyId: string,
  payload: Record<string, any>
) {
  const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);
  const url = buildGatewayUrl(req, `/api/sam/thea-engine/policies/${policyId}/rewrite`);
  const response = await forwardGatewayRequest(req, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ ...payload, orgProfile, contextRules }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Policy engine rewrite failed');
  }
  return response.json();
}
