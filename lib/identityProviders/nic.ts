import { v4 as uuidv4 } from 'uuid';
import type { IdentityProviderRequest, IdentityProviderResult } from './types';

export async function lookupIdentityNic(_req: IdentityProviderRequest): Promise<IdentityProviderResult> {
  return {
    status: 'NOT_CONFIGURED',
    reasonCode: 'NIC_NOT_CONFIGURED',
    providerTraceId: uuidv4(),
    payload: null,
  };
}
