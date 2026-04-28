import type { IdentityProviderRequest, IdentityProviderResult } from './types';

export async function lookupIdentityAbsher(_req: IdentityProviderRequest): Promise<IdentityProviderResult> {
  const error: any = new Error('NOT_CONFIGURED');
  error.code = 'NOT_CONFIGURED';
  throw error;
}
