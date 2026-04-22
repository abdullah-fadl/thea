import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Smart Recommender & Talent Pool API
 *
 * GET  ?action=recommend&candidateId=xxx
 * GET  ?action=cross-fit
 * GET  ?action=talent-pool            (+ optional filters)
 * GET  ?action=talent-pool-stats
 * GET  ?action=talent-pool-search&requisitionId=xxx
 *
 * POST action=add-to-pool
 * POST action=update-pool-entry
 * POST action=auto-populate
 * POST action=remove-from-pool
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import type { CVisionCandidate } from '@/lib/cvision/types';
import {
  recommendJobsForCandidate,
  detectCrossFitCandidates,
  addToTalentPool,
  updateTalentPoolEntry,
  searchTalentPool,
  getTalentPoolStats,
  searchTalentPoolForJob,
  autoPopulateTalentPool,
  type CandidateProfile,
} from '@/lib/cvision/ai/recommender-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function buildProfileFromCandidate(
  tenantId: string,
  candidateId: string,
): Promise<CandidateProfile | null> {
  const candColl = await getCVisionCollection<CVisionCandidate>(tenantId, 'candidates');
  const cand = await candColl.findOne(createTenantFilter(tenantId, { id: candidateId }));
  if (!cand) return null;

  const parseColl = await getCVisionCollection<any>(tenantId, 'cvParseJobs');
  const parseJob = await parseColl.findOne({ tenantId, candidateId });
  const extracted = parseJob?.extractedJson || parseJob?.metaJson || cand.metadata || {};

  const skills = (extracted.skills || (cand.metadata as Record<string, unknown> | undefined)?.skills || [])
    .map((s: string) => ({ name: s }));

  const experience = (extracted.experience || []).map((e: any) => ({
    title: String(e.title || e.jobTitle || ''),
    years: parseDuration(e.duration as string | undefined),
    company: e.company || e.employer,
  }));

  const education = (extracted.education || []).map((e: any) => ({
    degree: String(e.degree || ''),
    field: String(e.field || e.major || ''),
    institution: e.institution || e.university,
  }));

  const totalYears = Number(
    extracted.yearsOfExperience ||
    (cand.metadata as Record<string, unknown> | undefined)?.yearsOfExperience ||
    experience.reduce((s: number, e: { years?: number }) => s + (e.years || 0), 0),
  ) || 0;

  return {
    candidateId: cand.id,
    name: cand.fullName || 'Unknown',
    skills,
    experience,
    education,
    expectedSalary: cand.offerAmount || undefined,
    location: (cand.metadata as Record<string, unknown> | undefined)?.location as string,
    languages: extracted.languages || (cand.metadata as Record<string, unknown> | undefined)?.languages as string,
    totalYearsExperience: totalYears,
  };
}

function parseDuration(dur: string | undefined | null): number {
  if (!dur) return 1;
  const s = String(dur).trim();
  const rangeMatch = s.match(/(\d{4})\s*[-–]\s*(\d{4}|present|current|now)/i);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = rangeMatch[2].match(/\d{4}/) ? parseInt(rangeMatch[2]) : new Date().getFullYear();
    return Math.max(1, end - start);
  }
  const num = s.match(/(\d+)/);
  return num ? Math.max(1, parseInt(num[1])) : 1;
}

// ─── GET ────────────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get('action') || 'recommend';

      switch (action) {
        case 'recommend': {
          const candidateId = url.searchParams.get('candidateId');
          if (!candidateId) return NextResponse.json({ error: 'candidateId required' }, { status: 400 });
          const profile = await buildProfileFromCandidate(tenantId, candidateId);
          if (!profile) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
          const recs = await recommendJobsForCandidate(tenantId, profile);
          return NextResponse.json({ data: recs, profile: { name: profile.name, skills: profile.skills.length, experience: profile.totalYearsExperience } });
        }

        case 'cross-fit': {
          const results = await detectCrossFitCandidates(tenantId);
          return NextResponse.json({ data: results });
        }

        case 'talent-pool': {
          const filters = {
            skills: url.searchParams.get('skills')?.split(',').filter(Boolean),
            minExperience: url.searchParams.get('minExperience') ? Number(url.searchParams.get('minExperience')) : undefined,
            maxSalary: url.searchParams.get('maxSalary') ? Number(url.searchParams.get('maxSalary')) : undefined,
            tags: url.searchParams.get('tags')?.split(',').filter(Boolean),
            status: url.searchParams.get('status') || undefined,
            search: url.searchParams.get('search') || undefined,
          };
          const entries = await searchTalentPool(tenantId, filters);
          return NextResponse.json({ data: entries });
        }

        case 'talent-pool-stats': {
          const stats = await getTalentPoolStats(tenantId);
          return NextResponse.json({ data: stats });
        }

        case 'talent-pool-search': {
          const requisitionId = url.searchParams.get('requisitionId');
          if (!requisitionId) return NextResponse.json({ error: 'requisitionId required' }, { status: 400 });
          const matches = await searchTalentPoolForJob(tenantId, requisitionId);
          return NextResponse.json({ data: matches });
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err: unknown) {
      logger.error('[Recommender GET]', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.view' },
);

// ─── POST ───────────────────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (request, { tenantId, userId }) => {
    try {
      const body = await request.json();
      const { action } = body;

      switch (action) {
        case 'add-to-pool': {
          const entry = await addToTalentPool(tenantId, body, userId);
          return NextResponse.json({ data: entry });
        }

        case 'update-pool-entry': {
          const { id, ...updates } = body;
          if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
          const updated = await updateTalentPoolEntry(tenantId, id, updates);
          if (!updated) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
          return NextResponse.json({ data: updated });
        }

        case 'auto-populate': {
          const result = await autoPopulateTalentPool(tenantId, userId);
          return NextResponse.json({ data: result });
        }

        case 'remove-from-pool': {
          const { id } = body;
          if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
          const archived = await updateTalentPoolEntry(tenantId, id, { status: 'ARCHIVED' });
          return NextResponse.json({ data: { success: !!archived } });
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err: unknown) {
      logger.error('[Recommender POST]', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.view' },
);
