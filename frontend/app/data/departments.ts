const BASE_DEPARTMENTS = [
  'Digital',
  'HR',
  'Команда'
] as const;

export const listDepartmentsForUi = (includeQaTestDepartment: boolean): string[] => {
  if (!includeQaTestDepartment) return [...BASE_DEPARTMENTS];
  return [...BASE_DEPARTMENTS, 'Тестировщики'];
};
