/**
 * Navigation Integrity Tests
 *
 * Guards against the class of bug where lib/navigation.ts entries point at
 * a route that has no matching app/**\/page.tsx — those land on a 404 from
 * the welcome tile grid.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NAVIGATION_MODULES } from '@/lib/navigation';

const ROOT = process.cwd();

function pageExists(href: string): { exists: boolean; tried: string[] } {
  const segs = href.split('?')[0].replace(/^\/+/, '');
  const candidates = [
    join(ROOT, 'app', '(dashboard)', segs, 'page.tsx'),
    join(ROOT, 'app', '(dashboard)', segs, 'page.ts'),
    join(ROOT, 'app', segs, 'page.tsx'),
    join(ROOT, 'app', segs, 'page.ts'),
    join(ROOT, 'app', '(portal)', segs, 'page.tsx'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return { exists: true, tried: candidates };
  }
  return { exists: false, tried: candidates };
}

describe('NAVIGATION_MODULES integrity', () => {
  it('every nav entry has an existing page.tsx', () => {
    const broken: { id: string; href: string }[] = [];
    for (const mod of NAVIGATION_MODULES) {
      const { exists } = pageExists(mod.href);
      if (!exists) broken.push({ id: mod.id, href: mod.href });
    }
    if (broken.length) {
      const summary = broken.map((b) => `  - ${b.id} -> ${b.href}`).join('\n');
      throw new Error(`Broken navigation entries (no matching page.tsx):\n${summary}`);
    }
    expect(broken).toHaveLength(0);
  });

  it('every nav entry has a non-empty requiredPermission', () => {
    const empty = NAVIGATION_MODULES.filter((m) => !m.requiredPermission);
    expect(empty).toHaveLength(0);
  });

  it('module ids are unique', () => {
    const ids = NAVIGATION_MODULES.map((m) => m.id);
    const dup: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) dup.push(id);
      seen.add(id);
    }
    expect(dup).toEqual([]);
  });
});
