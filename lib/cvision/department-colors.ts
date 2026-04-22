// Shared department color and status color utilities
// Extracted from ProfileHeader.tsx for reuse across the app

const BG_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
];

const BG_LIGHT = [
  'bg-blue-50', 'bg-emerald-50', 'bg-purple-50', 'bg-rose-50',
  'bg-amber-50', 'bg-cyan-50', 'bg-indigo-50', 'bg-teal-50',
];

const TEXT_COLORS = [
  'text-blue-700', 'text-emerald-700', 'text-purple-700', 'text-rose-700',
  'text-amber-700', 'text-cyan-700', 'text-indigo-700', 'text-teal-700',
];

const BORDER_COLORS = [
  'border-blue-200', 'border-emerald-200', 'border-purple-200', 'border-rose-200',
  'border-amber-200', 'border-cyan-200', 'border-indigo-200', 'border-teal-200',
];

function hashDeptId(deptId: string): number {
  let hash = 0;
  for (let i = 0; i < deptId.length; i++) {
    hash = ((hash << 5) - hash) + deptId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % BG_COLORS.length;
}

/** Solid background color for avatars (e.g. bg-blue-500) */
export function getDeptColor(deptId?: string): string {
  if (!deptId) return BG_COLORS[0];
  return BG_COLORS[hashDeptId(deptId)];
}

/** Light background for badges (e.g. bg-blue-50) */
export function getDeptBgLight(deptId?: string): string {
  if (!deptId) return BG_LIGHT[0];
  return BG_LIGHT[hashDeptId(deptId)];
}

/** Text color matching department (e.g. text-blue-700) */
export function getDeptTextColor(deptId?: string): string {
  if (!deptId) return TEXT_COLORS[0];
  return TEXT_COLORS[hashDeptId(deptId)];
}

/** Border color matching department (e.g. border-blue-200) */
export function getDeptBorderColor(deptId?: string): string {
  if (!deptId) return BORDER_COLORS[0];
  return BORDER_COLORS[hashDeptId(deptId)];
}

/** Status badge classes: background + text + border */
export function getStatusColor(status: string): string {
  const s = status?.toUpperCase();
  switch (s) {
    case 'ACTIVE': return 'bg-green-100 text-green-800 border-green-200';
    case 'PROBATION': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'ON_ANNUAL_LEAVE': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'ON_SICK_LEAVE': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'ON_MATERNITY_LEAVE': return 'bg-pink-100 text-pink-800 border-pink-200';
    case 'ON_UNPAID_LEAVE': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'SUSPENDED':
    case 'SUSPENDED_WITHOUT_PAY': return 'bg-red-100 text-red-800 border-red-200';
    case 'NOTICE_PERIOD': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'TERMINATED': return 'bg-red-100 text-red-800 border-red-200';
    case 'RESIGNED': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'END_OF_CONTRACT': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'RETIRED': return 'bg-slate-100 text-slate-800 border-slate-200';
    case 'DECEASED': return 'bg-gray-900 text-white border-gray-700';
    default: break;
  }
  // Legacy lowercase fallback
  const lower = status?.toLowerCase();
  if (lower === 'active') return 'bg-green-100 text-green-800 border-green-200';
  if (lower === 'probation') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (lower === 'suspended') return 'bg-red-100 text-red-800 border-red-200';
  if (lower === 'terminated') return 'bg-red-100 text-red-800 border-red-200';
  if (lower === 'resigned') return 'bg-gray-100 text-gray-800 border-gray-200';
  if (lower === 'on_leave') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
}

/** Solid dot color for status indicators (e.g. "bg-green-500") */
export function getStatusDotColor(status: string): string {
  const s = status?.toUpperCase();
  switch (s) {
    case 'ACTIVE': return 'bg-green-500';
    case 'PROBATION': return 'bg-amber-500';
    case 'ON_ANNUAL_LEAVE': return 'bg-blue-500';
    case 'ON_SICK_LEAVE': return 'bg-purple-500';
    case 'ON_MATERNITY_LEAVE': return 'bg-pink-500';
    case 'ON_UNPAID_LEAVE': return 'bg-gray-500';
    case 'SUSPENDED':
    case 'SUSPENDED_WITHOUT_PAY':
    case 'TERMINATED': return 'bg-red-500';
    case 'NOTICE_PERIOD': return 'bg-orange-500';
    case 'RESIGNED':
    case 'END_OF_CONTRACT': return 'bg-gray-400';
    case 'RETIRED': return 'bg-slate-500';
    case 'DECEASED': return 'bg-black';
    default: break;
  }
  return 'bg-gray-400';
}
