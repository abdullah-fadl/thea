const DEFAULT_REQUIRED_TYPES = ['Policy', 'SOP', 'Workflow'];

export const getRequiredTypesForOperation = (_params: {
  departmentId: string;
  operationId: string;
}) => {
  return [...DEFAULT_REQUIRED_TYPES];
};
