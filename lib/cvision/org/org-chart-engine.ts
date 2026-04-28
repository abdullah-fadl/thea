/**
 * Org Chart Engine — builds employee hierarchy trees, detects issues,
 * and provides reporting-chain queries.
 */

import { getCVisionCollection } from '@/lib/cvision/db';
import type { CVisionEmployee } from '@/lib/cvision/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgNode {
  id: string;
  employeeId?: string;
  name: string;
  jobTitle: string;
  department: string;
  departmentId?: string;
  avatar?: string;
  avatarColor: string;
  status: string;
  email?: string;
  phone?: string;
  hireDate?: string;
  managerId?: string;
  managerName?: string;
  level: number;
  directReports: number;
  totalReports: number;
  children: OrgNode[];
}

export interface OrgChartData {
  root: OrgNode;
  totalNodes: number;
  levels: number;
  departments: { name: string; count: number; color: string; id: string }[];
  unassigned: OrgNode[];
}

export interface OrgIssues {
  orphanedEmployees: OrgNode[];
  circularReporting: string[];
  tooManyDirectReports: { manager: string; managerId: string; count: number }[];
  singlePointOfFailure: OrgNode[];
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const DEPT_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % DEPT_COLORS.length;
}

export function getDepartmentColor(department: string): string {
  if (!department) return DEPT_COLORS[0];
  return DEPT_COLORS[hashStr(department)];
}

// ---------------------------------------------------------------------------
// Data loading helpers
// ---------------------------------------------------------------------------

interface DeptRecord { id: string; name: string; isArchived?: boolean }
interface JTRecord { id: string; name: string }

async function loadLookups(tenantId: string) {
  const [deptColl, jtColl] = await Promise.all([
    getCVisionCollection<any>(tenantId, 'departments'),
    getCVisionCollection<any>(tenantId, 'jobTitles'),
  ]);

  const [depts, jts] = await Promise.all([
    deptColl.find({ tenantId }).toArray(),
    jtColl.find({ tenantId }).toArray(),
  ]);

  const deptMap = new Map<string, DeptRecord>();
  for (const d of depts) deptMap.set(d.id, d);

  const jtMap = new Map<string, JTRecord>();
  for (const j of jts) jtMap.set(j.id, j);

  return { deptMap, jtMap };
}

async function loadActiveEmployees(tenantId: string) {
  const coll = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
  return coll.find({
    tenantId,
    isArchived: { $ne: true },
  }).toArray();
}

// ---------------------------------------------------------------------------
// Node builder
// ---------------------------------------------------------------------------

function buildNode(
  emp: CVisionEmployee,
  deptMap: Map<string, DeptRecord>,
  jtMap: Map<string, JTRecord>,
): OrgNode {
  const dept = deptMap.get(emp.departmentId);
  const jt = jtMap.get(emp.jobTitleId);
  const name = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Unknown';

  return {
    id: emp.id,
    employeeId: emp.id,
    name,
    jobTitle: jt?.name ?? '—',
    department: dept?.name ?? '—',
    departmentId: emp.departmentId,
    avatar: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    avatarColor: getDepartmentColor(emp.departmentId),
    status: emp.status,
    email: emp.email ?? undefined,
    phone: emp.phone ?? undefined,
    hireDate: emp.hiredAt ? new Date(emp.hiredAt).toISOString().slice(0, 10) : undefined,
    managerId: emp.managerEmployeeId ?? undefined,
    managerName: undefined,
    level: 0,
    directReports: 0,
    totalReports: 0,
    children: [],
  };
}

// ---------------------------------------------------------------------------
// Tree assembly
// ---------------------------------------------------------------------------

function setLevels(node: OrgNode, level: number): number {
  node.level = level;
  let maxDepth = level;
  for (const child of node.children) {
    maxDepth = Math.max(maxDepth, setLevels(child, level + 1));
  }
  return maxDepth;
}

function countReports(node: OrgNode): number {
  let total = 0;
  node.directReports = node.children.length;
  for (const child of node.children) {
    total += 1 + countReports(child);
  }
  node.totalReports = total;
  return total;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function buildOrgChart(tenantId: string): Promise<OrgChartData> {
  const [employees, { deptMap, jtMap }] = await Promise.all([
    loadActiveEmployees(tenantId),
    loadLookups(tenantId),
  ]);

  if (employees.length === 0) {
    const emptyRoot: OrgNode = {
      id: '__root__', name: 'Organization', jobTitle: '', department: '',
      avatarColor: 'bg-primary', status: 'ACTIVE', level: 0,
      directReports: 0, totalReports: 0, children: [],
    };
    return { root: emptyRoot, totalNodes: 0, levels: 0, departments: [], unassigned: [] };
  }

  const nodeMap = new Map<string, OrgNode>();
  for (const emp of employees) {
    nodeMap.set(emp.id, buildNode(emp, deptMap, jtMap));
  }

  // Fill in managerName
  for (const node of nodeMap.values()) {
    if (node.managerId) {
      const mgr = nodeMap.get(node.managerId);
      if (mgr) node.managerName = mgr.name;
    }
  }

  // Build parent→children
  const rootNodes: OrgNode[] = [];
  const unassigned: OrgNode[] = [];

  for (const node of nodeMap.values()) {
    if (!node.managerId) {
      rootNodes.push(node);
    } else {
      const parent = nodeMap.get(node.managerId);
      if (parent) {
        parent.children.push(node);
      } else {
        unassigned.push(node);
        rootNodes.push(node);
      }
    }
  }

  let root: OrgNode;
  if (rootNodes.length === 1) {
    root = rootNodes[0];
  } else {
    root = {
      id: '__root__', name: 'Organization',
      jobTitle: '', department: '', avatarColor: 'bg-primary', status: 'ACTIVE',
      level: 0, directReports: rootNodes.length, totalReports: 0, children: rootNodes,
    };
  }

  const maxLevel = setLevels(root, 0);
  countReports(root);

  // Department stats
  const deptCount = new Map<string, number>();
  for (const emp of employees) {
    deptCount.set(emp.departmentId, (deptCount.get(emp.departmentId) || 0) + 1);
  }
  const departments = Array.from(deptCount.entries()).map(([id, count]) => {
    const d = deptMap.get(id);
    return { id, name: d?.name ?? id, count, color: getDepartmentColor(id) };
  }).sort((a, b) => b.count - a.count);

  return { root, totalNodes: employees.length, levels: maxLevel, departments, unassigned };
}

export async function getSubtree(tenantId: string, managerId: string): Promise<OrgNode | null> {
  const chart = await buildOrgChart(tenantId);
  function find(node: OrgNode): OrgNode | null {
    if (node.id === managerId) return node;
    for (const child of node.children) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  }
  return find(chart.root);
}

export async function getReportingChain(tenantId: string, employeeId: string): Promise<OrgNode[]> {
  const chart = await buildOrgChart(tenantId);
  const chain: OrgNode[] = [];

  function findPath(node: OrgNode, target: string, path: OrgNode[]): boolean {
    path.push(node);
    if (node.id === target) return true;
    for (const child of node.children) {
      if (findPath(child, target, path)) return true;
    }
    path.pop();
    return false;
  }

  findPath(chart.root, employeeId, chain);
  return chain.reverse(); // employee → manager → ... → root
}

export async function getDirectReports(tenantId: string, managerId: string): Promise<OrgNode[]> {
  const sub = await getSubtree(tenantId, managerId);
  return sub ? sub.children : [];
}

export async function detectOrgIssues(tenantId: string): Promise<OrgIssues> {
  const [employees, { deptMap, jtMap }] = await Promise.all([
    loadActiveEmployees(tenantId),
    loadLookups(tenantId),
  ]);

  const nodeMap = new Map<string, OrgNode>();
  for (const emp of employees) {
    nodeMap.set(emp.id, buildNode(emp, deptMap, jtMap));
  }

  // Orphaned: manager references a non-existent employee
  const orphaned: OrgNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.managerId && !nodeMap.has(node.managerId)) {
      orphaned.push(node);
    }
  }

  // Circular reporting
  const circular: string[] = [];
  for (const node of nodeMap.values()) {
    const visited = new Set<string>();
    let cur: OrgNode | undefined = node;
    while (cur && cur.managerId) {
      if (visited.has(cur.id)) {
        circular.push(`${node.name} (${node.id})`);
        break;
      }
      visited.add(cur.id);
      cur = nodeMap.get(cur.managerId);
    }
  }

  // Too many direct reports (> 10)
  const childCount = new Map<string, number>();
  for (const node of nodeMap.values()) {
    if (node.managerId && nodeMap.has(node.managerId)) {
      childCount.set(node.managerId, (childCount.get(node.managerId) || 0) + 1);
    }
  }
  const tooMany = Array.from(childCount.entries())
    .filter(([, c]) => c > 10)
    .map(([id, count]) => ({ manager: nodeMap.get(id)?.name ?? id, managerId: id, count }));

  // Single point of failure: only one person with >3 reports and no peer
  const spof: OrgNode[] = [];
  for (const [id, count] of childCount.entries()) {
    if (count >= 3) {
      const node = nodeMap.get(id)!;
      const siblings = Array.from(nodeMap.values()).filter(
        n => n.managerId === node.managerId && n.id !== node.id
      );
      if (siblings.length === 0) spof.push(node);
    }
  }

  return { orphanedEmployees: orphaned, circularReporting: circular, tooManyDirectReports: tooMany, singlePointOfFailure: spof };
}

export function getOrgStats(chart: OrgChartData) {
  const spanOfControl: number[] = [];
  function walk(node: OrgNode) {
    if (node.directReports > 0) spanOfControl.push(node.directReports);
    for (const child of node.children) walk(child);
  }
  walk(chart.root);

  const avgSpan = spanOfControl.length > 0
    ? Math.round((spanOfControl.reduce((a, b) => a + b, 0) / spanOfControl.length) * 10) / 10
    : 0;

  return {
    totalEmployees: chart.totalNodes,
    totalLevels: chart.levels,
    totalDepartments: chart.departments.length,
    avgSpanOfControl: avgSpan,
    maxSpanOfControl: spanOfControl.length > 0 ? Math.max(...spanOfControl) : 0,
    managersCount: spanOfControl.length,
    departmentBreakdown: chart.departments,
  };
}
