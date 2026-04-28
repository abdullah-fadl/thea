/**
 * scripts/backfill-portal-slugs.ts
 *
 * Idempotent backfill: assigns a unique portalSlug to every tenant that doesn't
 * have one yet.  Running it twice produces the same result.
 *
 * Usage:
 *   npx tsx scripts/backfill-portal-slugs.ts
 *
 * Requires DATABASE_URL / DIRECT_URL in .env.local (or environment).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      // Basic Latin-only: strip non-ASCII (covers Arabic, accented chars, etc.)
      .replace(/[^\u0000-\u007F]/g, '')
      // Keep only alphanumeric, spaces, and hyphens
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-') || 'tenant'
  );
}

async function main(): Promise<void> {
  // Collect slugs already in use to guarantee uniqueness across the batch.
  const existing = await prisma.tenant.findMany({
    where: { portalSlug: { not: null } },
    select: { portalSlug: true },
  });
  const usedSlugs = new Set<string>(existing.map((t) => t.portalSlug as string));

  // Only process tenants that don't have a slug yet.
  const tenants = await prisma.tenant.findMany({
    where: { portalSlug: null },
    select: { id: true, tenantId: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (tenants.length === 0) {
    console.log('All tenants already have a portalSlug. Nothing to do.');
    return;
  }

  console.log(`Backfilling ${tenants.length} tenant(s)…`);

  for (const tenant of tenants) {
    const base = slugify(tenant.name ?? tenant.tenantId);
    let slug = base;
    let suffix = 2;
    while (usedSlugs.has(slug)) {
      slug = `${base}-${suffix++}`;
    }
    usedSlugs.add(slug);

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { portalSlug: slug },
    });

    console.log(`  ${tenant.tenantId} → ${slug}`);
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
