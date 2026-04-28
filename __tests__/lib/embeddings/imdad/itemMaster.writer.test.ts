/**
 * Phase 7.2 — ImdadItemMaster embedding writer tests
 *
 * Cases:
 *  1. Flag OFF → embedImdadItemMaster() returns skipped:true (no DB / OpenAI calls)
 *  2. Flag ON, happy path → UPDATE called with vector literal + correct id
 *  3. Flag ON, idempotent → second call writes again with same vector
 *  4. Flag ON, provider error → error propagates (caller decides to retry)
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
    imdadItemMaster: { findUnique: mockFindUnique },
    $executeRawUnsafe: mockExecuteRawUnsafe,
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const { getDefaultProvider } = await import('@/lib/embeddings/provider');

function fakeVector(len = EMBEDDING_DIMENSIONS): number[] {
  return Array.from({ length: len }, (_, i) => i / len);
}

const ITEM_ID = '550e8400-e29b-41d4-a716-446655440020';

const SAMPLE_ITEM = {
  id: ITEM_ID,
  code: 'MED-12345',
  name: 'Paracetamol 500mg Tablet',
  nameAr: 'باراسيتامول 500 ملغ',
  description: 'Analgesic and antipyretic, oral tablet',
  descriptionAr: 'مسكن وخافض للحرارة، قرص فموي',
  genericName: 'Paracetamol',
  brandName: 'Panadol',
  manufacturer: 'GSK',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('embedImdadItemMaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED];
  });
  afterEach(() => { delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED]; });

  it('Case 1: flag OFF → returns skipped:true without any DB or OpenAI call', async () => {
    delete process.env[FLAGS.FF_EMBEDDINGS_ENABLED];
    const { embedImdadItemMaster } = await import('@/lib/embeddings/writers/imdadItemMaster');
    const result = await embedImdadItemMaster(ITEM_ID);
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toMatch(/FF_EMBEDDINGS_ENABLED is OFF/);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  it('Case 2: flag ON, happy path → UPDATE called with vector literal targeting embeddingVec column', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    const vec = fakeVector();
    mockEmbed.mockResolvedValue({ embedding: vec, model: 'text-embedding-3-large', totalTokens: 24 });
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockFindUnique.mockResolvedValue(SAMPLE_ITEM);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    const { embedImdadItemMaster } = await import('@/lib/embeddings/writers/imdadItemMaster');
    const result = await embedImdadItemMaster(ITEM_ID);

    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.totalTokens).toBe(24);
      expect(result.model).toBe('text-embedding-3-large');
      expect(result.id).toBe(ITEM_ID);
    }
    expect(mockExecuteRawUnsafe).toHaveBeenCalledOnce();
    const [sql, vectorArg, idArg] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toMatch(/UPDATE "imdad_item_masters"/);
    expect(sql).toMatch(/"embeddingVec"/);
    expect(sql).toMatch(/\$1::vector/);
    expect(vectorArg).toMatch(/^\[/);
    expect(vectorArg).toContain(',');
    expect(idArg).toBe(ITEM_ID);

    // Combined input feeds the embedder (formula sanity check)
    const embedInput = mockEmbed.mock.calls[0][0] as string;
    expect(embedInput).toContain('Code: MED-12345');
    expect(embedInput).toContain('Paracetamol 500mg Tablet');
    expect(embedInput).toContain('باراسيتامول');
    expect(embedInput).toContain('Generic: Paracetamol');
    expect(embedInput).toContain('Brand: Panadol');
    expect(embedInput).toContain('Manufacturer: GSK');
  });

  it('Case 3: idempotent — second call overwrites with same vector', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    const vec = fakeVector();
    mockEmbed.mockResolvedValue({ embedding: vec, model: 'text-embedding-3-large', totalTokens: 24 });
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockFindUnique.mockResolvedValue(SAMPLE_ITEM);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    const { embedImdadItemMaster } = await import('@/lib/embeddings/writers/imdadItemMaster');
    const r1 = await embedImdadItemMaster(ITEM_ID);
    const r2 = await embedImdadItemMaster(ITEM_ID);

    expect(r1.skipped).toBe(false);
    expect(r2.skipped).toBe(false);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(2);
    const arg1 = mockExecuteRawUnsafe.mock.calls[0][1];
    const arg2 = mockExecuteRawUnsafe.mock.calls[1][1];
    expect(arg1).toBe(arg2);
  });

  it('Case 4: flag ON, provider throws → error propagates (no UPDATE executed)', async () => {
    process.env[FLAGS.FF_EMBEDDINGS_ENABLED] = 'true';
    mockEmbed.mockRejectedValue(new Error('OpenAI rate limit'));
    (getDefaultProvider as ReturnType<typeof vi.fn>).mockReturnValue({ embed: mockEmbed });
    mockFindUnique.mockResolvedValue(SAMPLE_ITEM);

    const { embedImdadItemMaster } = await import('@/lib/embeddings/writers/imdadItemMaster');
    await expect(embedImdadItemMaster(ITEM_ID)).rejects.toThrow(/OpenAI rate limit/);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
  });
});
