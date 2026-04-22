import type { IdentityLookupPayload } from '@/lib/identity/contract';
import type { IdentityProviderRequest, IdentityProviderResult } from './types';

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000;
  }
  return Math.abs(hash);
}

function buildMockName(seed: number) {
  const first = ['Ahmed', 'Sara', 'Omar', 'Lina', 'Hassan', 'Noor', 'Yousef', 'Mona'];
  const last = ['Al Saud', 'Al Farsi', 'Al Amri', 'Al Harbi', 'Al Mutairi', 'Al Qahtani'];
  const f = first[seed % first.length];
  const l = last[seed % last.length];
  return { fullNameEn: `${f} ${l}`, fullNameAr: null };
}

function buildMockDob(seed: number) {
  const year = 1970 + (seed % 35);
  const month = String(((seed % 12) + 1)).padStart(2, '0');
  const day = String(((seed % 27) + 1)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function lookupIdentityMock(req: IdentityProviderRequest): Promise<IdentityProviderResult> {
  const normalized = String(req.identityValue || '').replace(/\D/g, '');
  if (!normalized || normalized.length < 6) {
    return { payload: null };
  }
  const seed = hashSeed(normalized);
  const shouldMatch = seed % 7 !== 0;
  if (!shouldMatch) {
    return { payload: null };
  }
  const names = buildMockName(seed);
  const gender = seed % 2 === 0 ? 'MALE' : 'FEMALE';
  const dob = buildMockDob(seed);
  const payload: IdentityLookupPayload = {
    ...names,
    gender,
    dob,
    nationality: 'Saudi',
  };
  return { payload };
}
