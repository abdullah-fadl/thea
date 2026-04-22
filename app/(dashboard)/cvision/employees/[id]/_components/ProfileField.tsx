'use client';

import type { ProfileFieldDefinition, ReferenceData } from './types';
import { CONTRACT_TYPES } from '@/lib/cvision/constants';
import { useLang } from '@/hooks/use-lang';

const CONTRACT_TYPE_MAP: Record<string, string> = {};
for (const ct of CONTRACT_TYPES) {
  CONTRACT_TYPE_MAP[ct.value] = ct.label;
}

const currencyFmt = new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 });

interface ProfileFieldProps {
  field: ProfileFieldDefinition;
  value: any;
  sectionKey: string;
  referenceData: ReferenceData;
}

export default function ProfileField({ field, value, sectionKey, referenceData }: ProfileFieldProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const isEmpty = value === null || value === undefined || value === '';

  if (isEmpty) {
    return <span className="text-sm text-gray-400 italic">{tr('غير محدد', 'Not set')}</span>;
  }

  // UUID reference fields → resolve to display name
  if (field.key === 'departmentId') {
    const dept = referenceData.departments.find(d => d.id === value);
    return <span className="text-sm text-gray-900">{dept ? `${dept.name}${dept.code ? ` (${dept.code})` : ''}` : value}</span>;
  }

  if (field.key === 'jobTitleId') {
    const jt = referenceData.jobTitles.find(j => j.id === value);
    return <span className="text-sm text-gray-900">{jt?.name || value}</span>;
  }

  if (field.key === 'positionId') {
    const pos = referenceData.positions.find(p => p.id === value);
    return <span className="text-sm text-gray-900">{pos ? (pos.title || pos.positionCode) : value}</span>;
  }

  if (field.key === 'managerEmployeeId') {
    const mgr = referenceData.employees.find(e => e.id === value);
    return <span className="text-sm text-gray-900">{mgr ? `${mgr.firstName} ${mgr.lastName}` : value}</span>;
  }

  if (field.key === 'unitId') {
    const unit = referenceData.units.find(u => u.id === value);
    return <span className="text-sm text-gray-900">{unit?.name || value}</span>;
  }

  if (field.key === 'gradeId') {
    const grade = referenceData.grades.find(g => g.id === value);
    return <span className="text-sm text-gray-900">{grade?.name || value}</span>;
  }

  if (field.key === 'contractType') {
    return <span className="text-sm text-gray-900">{CONTRACT_TYPE_MAP[value] || value}</span>;
  }

  // Date fields
  if (field.type === 'date' && value) {
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return <span className="text-sm text-gray-900">{d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>;
      }
    } catch {
      // fall through
    }
    return <span className="text-sm text-gray-900">{String(value)}</span>;
  }

  // Currency fields (FINANCIAL section)
  if (sectionKey === 'FINANCIAL' && field.type === 'number' && typeof value === 'number') {
    return <span className="text-sm text-gray-900 font-medium">{currencyFmt.format(value)}</span>;
  }

  // Number fields
  if (field.type === 'number') {
    return <span className="text-sm text-gray-900">{String(value)}</span>;
  }

  // Email
  if (field.type === 'email') {
    return <a href={`mailto:${value}`} className="text-sm text-blue-600 hover:underline">{value}</a>;
  }

  // Phone
  if (field.type === 'phone' || field.key === 'phone') {
    return <a href={`tel:${value}`} className="text-sm text-blue-600 hover:underline">{value}</a>;
  }

  // Gender - capitalize
  if (field.key === 'gender') {
    const str = String(value);
    return <span className="text-sm text-gray-900">{str.charAt(0).toUpperCase() + str.slice(1)}</span>;
  }

  // Default text
  return <span className="text-sm text-gray-900">{String(value)}</span>;
}
