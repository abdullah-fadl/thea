import type { IdentityProviderId, IdentityProviderRequest, IdentityProviderResult } from './types';
import { lookupIdentityMock } from './mock';
import { lookupIdentityNic } from './nic';

export type IdentityProviderLookupResult = IdentityProviderResult & { provider: IdentityProviderId };

export async function lookupIdentityProvider(req: IdentityProviderRequest): Promise<IdentityProviderLookupResult> {
  const provider = String(process.env.IDENTITY_PROVIDER || 'mock').toLowerCase() as IdentityProviderId;
  if (provider === 'nic') {
    const result = await lookupIdentityNic(req);
    return { provider, ...result };
  }
  const result = await lookupIdentityMock(req);
  return { provider: 'mock', ...result };
}
