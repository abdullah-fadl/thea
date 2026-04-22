/**
 * Organization Design Analysis Engine
 * Compares current vs proposed structures.
 */

export interface OrgDept {
  deptId: string;
  name: string;
  nameAr: string;
  parentDeptId?: string;
  headId?: string;
  headName?: string;
  positions: OrgPosition[];
  isNew?: boolean;
  isRemoved?: boolean;
  isModified?: boolean;
}

export interface OrgPosition {
  positionId: string;
  title: string;
  titleAr: string;
  gradeId?: string;
  isNew?: boolean;
  isRemoved?: boolean;
  isModified?: boolean;
}

export interface StructureAnalysis {
  currentAvgSpan: number;
  proposedAvgSpan: number;
  currentLayers: number;
  proposedLayers: number;
  currentHeadcount: number;
  proposedHeadcount: number;
  newPositions: number;
  removedPositions: number;
  movedPositions: number;
  currentMonthlyCost: number;
  proposedMonthlyCost: number;
  costDifference: number;
  managerToStaffRatio: { current: number; proposed: number };
  supportToLineRatio: { current: number; proposed: number };
  duplicateRoles: string[];
  singlePointsOfFailure: string[];
}

export function calculateSpanOfControl(departments: OrgDept[]): { avg: number; perDept: Record<string, number> } {
  const perDept: Record<string, number> = {};
  let totalManagers = 0; let totalStaff = 0;
  for (const dept of departments) {
    if (dept.isRemoved) continue;
    const activePositions = dept.positions.filter(p => !p.isRemoved).length;
    perDept[dept.deptId] = activePositions;
    if (dept.headId) { totalManagers++; totalStaff += activePositions; }
  }
  return { avg: totalManagers > 0 ? Math.round((totalStaff / totalManagers) * 10) / 10 : 0, perDept };
}

export function calculateLayers(departments: OrgDept[]): number {
  const activeDepts = departments.filter(d => !d.isRemoved);
  const parentMap = new Map(activeDepts.map(d => [d.deptId, d.parentDeptId]));
  let maxDepth = 0;
  for (const [id] of parentMap) {
    let depth = 0; let cur: string | undefined = id;
    while (cur && depth < 20) { cur = parentMap.get(cur); if (cur) depth++; }
    if (depth > maxDepth) maxDepth = depth;
  }
  return maxDepth + 1;
}

export function findDuplicateRoles(departments: OrgDept[]): string[] {
  const titleCounts: Record<string, number> = {};
  for (const dept of departments) {
    if (dept.isRemoved) continue;
    for (const pos of dept.positions) {
      if (pos.isRemoved) continue;
      const key = pos.title.toLowerCase().trim();
      titleCounts[key] = (titleCounts[key] || 0) + 1;
    }
  }
  return Object.entries(titleCounts).filter(([, count]) => count > 2).map(([title]) => title);
}

export function findSinglePointsOfFailure(departments: OrgDept[]): string[] {
  const spof: string[] = [];
  for (const dept of departments) {
    if (dept.isRemoved) continue;
    const activePositions = dept.positions.filter(p => !p.isRemoved);
    if (activePositions.length === 1) spof.push(`${dept.name}: ${activePositions[0].title}`);
  }
  return spof;
}

export function compareStructures(current: OrgDept[], proposed: OrgDept[], costPerPosition = 8000): StructureAnalysis {
  const currentSpan = calculateSpanOfControl(current);
  const proposedSpan = calculateSpanOfControl(proposed);
  const currentLayers = calculateLayers(current);
  const proposedLayers = calculateLayers(proposed);

  const currentPositions = current.flatMap(d => d.positions.filter(p => !p.isRemoved));
  const proposedPositions = proposed.flatMap(d => d.positions.filter(p => !p.isRemoved));
  const newPositions = proposedPositions.filter(p => p.isNew).length;
  const removedPositions = current.flatMap(d => d.positions).filter(p => p.isRemoved).length + proposed.flatMap(d => d.positions).filter(p => p.isRemoved).length;
  const movedPositions = proposedPositions.filter(p => p.isModified).length;

  const currentCost = currentPositions.length * costPerPosition;
  const proposedCost = proposedPositions.length * costPerPosition;

  const currentManagers = current.filter(d => !d.isRemoved && d.headId).length;
  const proposedManagers = proposed.filter(d => !d.isRemoved && d.headId).length;

  return {
    currentAvgSpan: currentSpan.avg,
    proposedAvgSpan: proposedSpan.avg,
    currentLayers, proposedLayers,
    currentHeadcount: currentPositions.length,
    proposedHeadcount: proposedPositions.length,
    newPositions, removedPositions, movedPositions,
    currentMonthlyCost: currentCost,
    proposedMonthlyCost: proposedCost,
    costDifference: proposedCost - currentCost,
    managerToStaffRatio: {
      current: currentManagers > 0 ? Math.round((currentPositions.length / currentManagers) * 10) / 10 : 0,
      proposed: proposedManagers > 0 ? Math.round((proposedPositions.length / proposedManagers) * 10) / 10 : 0,
    },
    supportToLineRatio: { current: 0, proposed: 0 },
    duplicateRoles: findDuplicateRoles(proposed),
    singlePointsOfFailure: findSinglePointsOfFailure(proposed),
  };
}
