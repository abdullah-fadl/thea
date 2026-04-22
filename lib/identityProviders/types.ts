import type { IdentityLookupPayload, IdentityLookupRequest } from '@/lib/identity/contract';

export type IdentityProviderId = 'mock' | 'nic';

export type IdentityProviderResult = {
  payload?: IdentityLookupPayload | null;
  status?: 'NOT_CONFIGURED' | 'ERROR';
  reasonCode?: string | null;
  providerTraceId?: string | null;
};

export type IdentityProviderRequest = IdentityLookupRequest;
