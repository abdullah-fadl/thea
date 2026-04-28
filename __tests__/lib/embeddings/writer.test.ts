/**
 * Phase 5.2 — CoreDepartment embedding writer tests
 *
 * Cases:
 * 10.  Flag OFF → embedCoreDepartment() returns skipped:true (no DB calls)
 * 11.  Flag ON  → dept not found → skipped:true
 * 12.  Flag ON  → happy path: UPDATE called with correct vector literal
 * 13.  Flag ON  → second call (idempotent): UPDATE called again, same result
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { EMBEDDING_DIMENSIONS } from '@/lib/embeddings/provider';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockEmbed = vi.fn();
const mockFindUnique = vi.fn();
const mockExecuteRawUnsafe = vi.fn();

vi.mock('@/lib/embeddings/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/embeddings/provider')>();
  return {
    ...actual,
    getDefaultProvider: vi.fn(() => ({ embed: mockEmbed })),
  };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    coreDepartment: { findUnique: mockFindUnique },
    $executeRawUnsafe: mockExecuteRawUnsafe,
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const { getDefaultProvider } = await import('@/lib/embeddings/provider');

function fakeVector(len = EMBEDDING_DIMENSIONS): number[] {
  return Array.from({ length: len }, (_, i) => i / len);
}

const DEPT_ID = '550e8400-e29b-41d4-a716-446655440001';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('embedCoreDepartment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED];
  });
  afterEach(() => { delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED]; });

  it('Case 10: flag OFF → returns skipped:true without any DB or OpenAI call', async () => {
    // Flag is NOT set — isEnabled returns false inside the writer
    delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED];
    const { embedCoreDepartment } = await import('@/lib/embeddings/writers/coreDepartment');
    const result = await embedCoreDepartment(DEPT_ID);
    expect(result.skipped).toBe(true);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
  });

  it('Case 11: flag ON, dept not found → skipped:true', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockFindUnique.mockResolvedValue(null);

    const { embedCoreDepartment } = await import('@/lib/embeddings/writers/coreDepartment');
    const result = await embedCoreDepartment(DEPT_ID);
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toMatch(/not found/i);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
  });

  it('Case 12: flag ON, happy path → UPDATE called with vector literal', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    const vec = fakeVector();
    mockEmbed.mockResolvedValue({ embedding: vec, model: 'text-embedding-3-large', totalTokens: 7 });
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockFindUnique.mockResolvedValue({ id: DEPT_ID, name: 'Emergency', nameAr: 'طوارئ' });
    mockExecuteRawUnsafe.mockResolvedValue(1);

    const { embedCoreDepartment } = await import('@/lib/embeddings/writers/coreDepartment');
    const result = await embedCoreDepartment(DEPT_ID);

    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.totalTokens).toBe(7);
      expect(result.model).toBe('text-embedding-3-large');
    }
    expect(mockExecuteRawUnsafe).toHaveBeenCalledOnce();
    const [sql, vectorArg, idArg] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toMatch(/UPDATE core_departments/);
    expect(sql).toMatch(/\$1::vector/);
    expect(vectorArg).toMatch(/^\[/);
    expect(idArg).toBe(DEPT_ID);
  });

  it('Case 13: idempotent — second call overwrites with same result', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    const vec = fakeVector();
    mockEmbed.mockResolvedValue({ embedding: vec, model: 'text-embedding-3-large', totalTokens: 7 });
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockFindUnique.mockResolvedValue({ id: DEPT_ID, name: 'Emergency', nameAr: null });
    mockExecuteRawUnsafe.mockResolvedValue(1);

    const { embedCoreDepartment } = await import('@/lib/embeddings/writers/coreDepartment');
    await embedCoreDepartment(DEPT_ID);
    await embedCoreDepartment(DEPT_ID);

    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(2);
  });
});
