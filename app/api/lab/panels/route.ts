import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getAllPanels, getPanelByCode, getPanelsByDepartment, getDepartments, getRequiredTubes } from '@/lib/lab/panels';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/lab/panels?code=CBC&department=Hematology
 *
 * Returns lab panel definitions. Can filter by code or department.
 * Returns tube requirements when multiple panel codes are provided.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest) => {
    const code = req.nextUrl.searchParams.get('code');
    const department = req.nextUrl.searchParams.get('department');
    const tubesFor = req.nextUrl.searchParams.get('tubesFor');

    // Single panel lookup
    if (code) {
      const panel = getPanelByCode(code);
      if (!panel) {
        return NextResponse.json({ error: 'Panel not found' }, { status: 404 });
      }
      return NextResponse.json({ panel });
    }

    // Tube requirements for multiple panels
    if (tubesFor) {
      const codes = tubesFor.split(',').map((c) => c.trim()).filter(Boolean);
      const tubes = getRequiredTubes(codes);
      return NextResponse.json({ tubes });
    }

    // Filter by department
    if (department) {
      const panels = getPanelsByDepartment(department);
      return NextResponse.json({ panels, departments: getDepartments() });
    }

    // All panels
    return NextResponse.json({ panels: getAllPanels(), departments: getDepartments() });
  }),
  { tenantScoped: true, permissionKey: 'lab.results.view' },
);
