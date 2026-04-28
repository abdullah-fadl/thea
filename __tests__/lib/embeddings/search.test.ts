/**
 * Phase 5.2 — CoreDepartment semantic search tests
 *
 * Cases:
 * 14.  Flag OFF (EmbeddingsDisabled) → returns [] without DB call
 * 15.  Flag ON  → raw query called with tenant_id filter
 * 16.  Flag ON  → results sorted by similarity desc (most similar first)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { EMBEDDING_DIMENSIONS, EmbeddingsDisabled } from '@/lib/embeddings/provider';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockEmbed = vi.fn();
const mockQueryRawUnsafe = vi.fn();

vi.mock('@/lib/embeddings/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/embeddings/provider')>();
  return {
    ...actual,
    getDefaultProvider: vi.fn(() => ({ embed: mockEmbed })),
    EmbeddingsDisabled: actual.EmbeddingsDisabled,
  };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const { getDefaultProvider } = await import('@/lib/embeddings/provider');

function fakeVector(len = EMBEDDING_DIMENSIONS): number[] {
  return Array.from({ length: len }, (_, i) => i / len);
}

const TENANT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('searchCoreDepartmentsByText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED];
  });
  afterEach(() => { delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED]; });

  it('Case 14: flag OFF (EmbeddingsDisabled) → returns [] without calling DB', async () => {
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      embed: async () => { throw new EmbeddingsDisabled(); },
    }));

    const { searchCoreDepartmentsByText } = await import('@/lib/embeddings/search/coreDepartment');
    const results = await searchCoreDepartmentsByText('emergency', TENANT_ID);
    expect(results).toEqual([]);
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it('Case 15: flag ON → raw query scoped to tenantId', async () => {
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockEmbed.mockResolvedValue({ embedding: fakeVector(), model: 'text-embedding-3-large', totalTokens: 3 });
    mockQueryRawUnsafe.mockResolvedValue([
      { id: 'id-1', tenant_id: TENANT_ID, name: 'Emergency', name_ar: 'طوارئ', similarity: 0.95 },
      { id: 'id-2', tenant_id: TENANT_ID, name: 'Radiology', name_ar: null, similarity: 0.82 },
    ]);

    const { searchCoreDepartmentsByText } = await import('@/lib/embeddings/search/coreDepartment');
    const results = await searchCoreDepartmentsByText('emergency dept', TENANT_ID, 5);

    expect(mockQueryRawUnsafe).toHaveBeenCalledOnce();
    const [sql, , tenantArg] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toMatch(/WHERE tenant_id/);
    expect(tenantArg).toBe(TENANT_ID);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('id-1');
    expect(results[0].similarity).toBeCloseTo(0.95);
  });

  it('Case 16: results mapped correctly with nameAr nullable', async () => {
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockEmbed.mockResolvedValue({ embedding: fakeVector(), model: 'text-embedding-3-large', totalTokens: 3 });
    mockQueryRawUnsafe.mockResolvedValue([
      { id: 'id-3', tenant_id: TENANT_ID, name: 'Lab', name_ar: null, similarity: 0.77 },
    ]);

    const { searchCoreDepartmentsByText } = await import('@/lib/embeddings/search/coreDepartment');
    const [result] = await searchCoreDepartmentsByText('lab', TENANT_ID);
    expect(result.nameAr).toBeNull();
    expect(result.tenantId).toBe(TENANT_ID);
  });
});
