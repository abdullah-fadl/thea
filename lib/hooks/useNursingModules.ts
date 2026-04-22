import { useMemo } from 'react';
import { getModulesForDepartment, type DepartmentType, type NursingModuleConfig } from '@/lib/clinical/departmentNursingConfig';

export function useNursingModules(dept: DepartmentType) {
  const modules = useMemo(() => getModulesForDepartment(dept), [dept]);
  const show = (key: keyof NursingModuleConfig) => modules[key];
  return { modules, show };
}
