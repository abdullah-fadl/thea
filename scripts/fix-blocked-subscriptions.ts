/**
 * Fix blocked subscription contracts — reset status to 'active'
 * Run: npx tsx scripts/fix-blocked-subscriptions.ts
 */
import { prisma } from '../lib/db/prisma';

async function main() {
  const contracts = await prisma.subscriptionContract.findMany({
    where: { status: 'blocked' },
    select: { id: true, tenantId: true, status: true, subscriptionEndsAt: true },
  });

  console.log(`Found ${contracts.length} blocked contract(s):`);
  console.log(JSON.stringify(contracts, null, 2));

  for (const c of contracts) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: c.tenantId },
      select: { subscriptionEndsAt: true, tenantId: true, name: true },
    });
    console.log(`\nTenant: ${tenant?.name} (${tenant?.tenantId}), subscriptionEndsAt: ${tenant?.subscriptionEndsAt}`);

    await prisma.subscriptionContract.update({
      where: { id: c.id },
      data: {
        status: 'active',
        ...(tenant?.subscriptionEndsAt ? { subscriptionEndsAt: tenant.subscriptionEndsAt } : {}),
      },
    });
    console.log(`✓ Contract ${c.id} → status: active`);
  }

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
