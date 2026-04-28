const DEFAULT_REQUIRED_TYPES = ['Policy', 'SOP', 'Workflow'];

const DEPARTMENT_REQUIRED_TYPES: Record<string, string[]> = {
  // Example override (keep empty for now, add later)
  // 'department-id': ['Policy', 'SOP', 'Workflow', 'Manual'],
};

export const getRequiredTypesForDepartment = (departmentId: string) => {
  return DEPARTMENT_REQUIRED_TYPES[departmentId] || DEFAULT_REQUIRED_TYPES;
};

export const getRequiredTypesForOperation = (params: {
  departmentId: string;
  operationId: string;
}) => {
  return getRequiredTypesForDepartment(params.departmentId);
};
