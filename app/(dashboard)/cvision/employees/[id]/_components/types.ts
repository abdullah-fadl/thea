// Shared types for Employee Profile page components

import type { ReactNode } from 'react';
import type { ProfileSectionKey, ProfileFieldDefinition } from '@/lib/cvision/types';
import type { LucideIcon } from 'lucide-react';

export type { ProfileSectionKey, ProfileFieldDefinition };

export interface Employee {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status: string;
  departmentId: string;
  jobTitleId: string;
  positionId?: string | null;
  managerEmployeeId?: string | null;
  gradeId?: string | null;
  hiredAt?: Date | null;
  branchId?: string | null;
  workLocation?: string | null;
  unitId?: string | null;
}

export interface ProfileSection {
  schemaVersion: number | null;
  schemaJson: { fields: ProfileFieldDefinition[] } | null;
  dataJson: Record<string, any>;
  updatedAt: string | null;
  canEdit: boolean;
  editReason: string | null;
  history: Array<{
    id: string;
    schemaVersion: number;
    prevDataJson: Record<string, any>;
    nextDataJson: Record<string, any>;
    changedByUserId: string;
    changeReason: string | null;
    createdAt: string;
  }>;
}

export interface ProfileResponse {
  success: boolean;
  employee: Employee;
  sections: {
    PERSONAL: ProfileSection;
    EMPLOYMENT: ProfileSection;
    FINANCIAL: ProfileSection;
    CONTRACT: ProfileSection;
  };
  _diagnostics?: {
    roles: string[];
    employeeId: string | null;
    departmentIds: string[];
    isOwner?: boolean;
    canEditFlags: Record<string, boolean>;
    editReasons?: Record<string, string | null>;
  };
}

// Reference data types
export interface DepartmentRef { id: string; name: string; code?: string }
export interface JobTitleRef { id: string; name: string; code?: string }
export interface PositionRef { id: string; title?: string; positionCode: string; departmentId?: string }
export interface EmployeeRef { id: string; firstName: string; lastName: string }
export interface UnitRef { id: string; name: string }
export interface GradeRef { id: string; name: string; code?: string; level?: number; minSalary?: number; maxSalary?: number }
export interface BranchRef { id: string; name: string; isHeadquarters?: boolean }

export interface ReferenceData {
  departments: DepartmentRef[];
  jobTitles: JobTitleRef[];
  positions: PositionRef[];
  employees: EmployeeRef[];
  units: UnitRef[];
  grades: GradeRef[];
  branches: BranchRef[];
}

// Editable card shared props
export interface EditableCardProps {
  profile: ProfileResponse;
  sectionKey: ProfileSectionKey;
  editData: Record<string, Record<string, any>>;
  saving: Record<string, boolean>;
  changeReason: Record<string, string>;
  historyOpen: Record<string, boolean>;
  isEditing: boolean;
  onToggleEdit: () => void;
  onEditDataChange: (sectionKey: string, data: Record<string, any>) => void;
  onSaveSection: (sectionKey: ProfileSectionKey) => Promise<void>;
  onCancelEdit: () => void;
  onChangeReasonUpdate: (sectionKey: string, reason: string) => void;
  onHistoryToggle: (sectionKey: string, open: boolean) => void;
  onFixProfile: () => void;
  fixingProfile: boolean;
  renderField: (field: ProfileFieldDefinition, sectionKey: ProfileSectionKey, value: any, disabled: boolean) => ReactNode;
  referenceData: ReferenceData;
}

export interface ProfileCompletenessData {
  filled: number;
  total: number;
  percentage: number;
}
