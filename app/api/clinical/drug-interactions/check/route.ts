import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';
import interactionData from '@/data/drug-interactions.json';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';

const drugInteractionsSchema = z.object({
  medications: z.array(z.object({ name: z.string() }).passthrough()).default([]),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeName(value: string) {
  return String(value || '').trim().toLowerCase();
}

export const POST = withAuthTenant(async (req) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, drugInteractionsSchema);
  if ('error' in v) return v.error;

  const medications = v.data.medications;
  const interactions: any[] = [];
  const aliases = (interactionData as Record<string, unknown>).drugAliases as Record<string, string[]> || {};

  const normalizeWithAliases = (name: string) => {
    const normalized = normalizeName(name);
    const aliasList = Object.entries(aliases).find(([, list]: any) =>
      Array.isArray(list) && list.some((alias: string) => normalized.includes(normalizeName(alias)))
    );
    return aliasList ? normalizeName(aliasList[0]) : normalized;
  };

  for (let i = 0; i < medications.length; i += 1) {
    for (let j = i + 1; j < medications.length; j += 1) {
      const drug1 = normalizeWithAliases(medications[i].name || '');
      const drug2 = normalizeWithAliases(medications[j].name || '');

      const interaction = ((interactionData as Record<string, unknown>).interactions as Array<Record<string, string>>).find((int) => {
        const d1 = normalizeName(int.drug1);
        const d2 = normalizeName(int.drug2);
        return (
          (drug1.includes(d1) || drug1.includes(d2)) &&
          (drug2.includes(d1) || drug2.includes(d2))
        );
      });

      if (interaction) {
        interactions.push({
          drug1: medications[i].name,
          drug2: medications[j].name,
          severity: interaction.severity,
          description: interaction.description,
          descriptionAr: interaction.descriptionAr,
        });
      }
    }
  }

  const severityOrder: Record<string, number> = { major: 0, moderate: 1, minor: 2 };
  interactions.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  return NextResponse.json({
    hasInteractions: interactions.length > 0,
    hasMajor: interactions.some((i) => i.severity === 'major'),
    interactions,
  });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.view' });
