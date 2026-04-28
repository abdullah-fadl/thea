import fs from 'fs';
import path from 'path';
import { vi } from 'vitest';
import { theaEngineSearch } from '@/lib/sam/theaEngineGateway';

describe('Policy engine gateway', () => {
  it('injects tenantId into search body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    // @ts-expect-error - test mock
    global.fetch = fetchMock;

    const req = new Request('http://localhost:3000/api/sam/library/list');
    await theaEngineSearch(req, 'tenant-123', { query: 'test', topK: 5 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const parsed = JSON.parse(init.body);
    expect(parsed.tenantId).toBe('tenant-123');
  });

  it('library list uses gateway search helper', () => {
    const filePath = path.join(process.cwd(), 'app', 'api', 'sam', 'library', 'list', 'route.ts');
    const code = fs.readFileSync(filePath, 'utf-8');
    expect(code).toContain('theaEngineSearch');
  });

  it('bulk delete uses gateway delete helper', () => {
    const filePath = path.join(process.cwd(), 'app', 'api', 'sam', 'library', 'bulk-action', 'route.ts');
    const code = fs.readFileSync(filePath, 'utf-8');
    expect(code).toContain('theaEngineDeletePolicy');
  });
});
