export type Employee = {
  id: number;
  name: string;
  title: string;
  department: string;
  manager: string;
  hired_at: string;
  platform_user_id: number | null;
};

export type EmployeeDepartment = {
  name: string;
  employees: Employee[];
};

const STORAGE_KEY = 'vbi-employees-v3';

/** id аккаунта → ФИО в справочнике отпусков */
const TEST_ACCOUNT_LINKS: Record<number, string> = {
  2: 'Костя',
  3: 'Катя',
  4: 'Вася',
  5: 'Маша'
};

const EMAIL_TO_EMPLOYEE: Record<string, string> = {
  'katya@vbi.local': 'Катя',
  'vasya@vbi.local': 'Вася',
  'masha@vbi.local': 'Маша',
  'kostya@vbi.local': 'Костя',
  'stas@vbi.local': 'Стас'
};

export const buildDefaultEmployees = (): Employee[] => [
  {
    id: 1,
    name: 'Катя',
    title: 'Сотрудник',
    department: 'Команда',
    manager: 'Костя',
    hired_at: '2022-03-15',
    platform_user_id: 3
  },
  {
    id: 2,
    name: 'Вася',
    title: 'Сотрудник',
    department: 'Команда',
    manager: 'Костя',
    hired_at: '2023-06-01',
    platform_user_id: 4
  },
  {
    id: 3,
    name: 'Маша',
    title: 'Сотрудник',
    department: 'Команда',
    manager: 'Костя',
    hired_at: '2024-01-10',
    platform_user_id: 5
  },
  {
    id: 4,
    name: 'Костя',
    title: 'Руководитель',
    department: 'Команда',
    manager: '',
    hired_at: '2020-05-20',
    platform_user_id: 2
  }
];

export function useEmployees() {
  const employees = useState<Employee[]>('vbi-employees', () => buildDefaultEmployees());
  const hydrated = useState<boolean>('vbi-employees-hydrated', () => false);

  const persist = () => {
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(employees.value));
  };

  const applyTestAccountLinks = () => {
    Object.entries(TEST_ACCOUNT_LINKS).forEach(([userId, name]) => {
      const emp = employees.value.find((item) => item.name === name);
      if (emp) emp.platform_user_id = Number(userId);
    });
  };

  const ensureDemoTeam = () => {
    const katya = employees.value.find((item) => item.name === 'Катя');
    const linksOk = katya?.platform_user_id === 3;
    if (!katya || !linksOk) {
      employees.value = buildDefaultEmployees();
      persist();
    }
    applyTestAccountLinks();
  };

  const hydrate = () => {
    if (!import.meta.client) return;
    if (hydrated.value) {
      ensureDemoTeam();
      return;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        employees.value = JSON.parse(raw) as Employee[];
      } catch {
        employees.value = buildDefaultEmployees();
      }
    } else {
      employees.value = buildDefaultEmployees();
      persist();
    }

    ensureDemoTeam();
    hydrated.value = true;
  };

  const departmentsGrouped = computed<EmployeeDepartment[]>(() => {
    const map = new Map<string, Employee[]>();
    employees.value.forEach((emp) => {
      const bucket = map.get(emp.department) ?? [];
      bucket.push(emp);
      map.set(emp.department, bucket);
    });
    return [...map.entries()].map(([name, group]) => ({
      name,
      employees: group.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    }));
  });

  const hierarchyLinks = computed(() =>
    employees.value
      .filter((emp) => emp.manager.trim())
      .map((emp, index) => ({
        id: index + 1,
        employee: emp.name,
        manager: emp.manager,
        department: emp.department
      }))
  );

  const updateEmployee = (id: number, patch: Partial<Employee>) => {
    const emp = employees.value.find((item) => item.id === id);
    if (!emp) return;
    Object.assign(emp, patch);
    persist();
  };

  const addEmployee = () => {
    const nextId = Math.max(0, ...employees.value.map((e) => e.id)) + 1;
    employees.value.push({
      id: nextId,
      name: 'Новый сотрудник',
      title: 'Должность',
      department: 'Команда',
      manager: 'Костя',
      hired_at: '',
      platform_user_id: null
    });
    persist();
  };

  const removeEmployee = (id: number) => {
    employees.value = employees.value.filter((emp) => emp.id !== id);
    persist();
  };

  const findByUserId = (userId: number | undefined) => {
    if (!userId) return null;
    return employees.value.find((emp) => emp.platform_user_id === userId) ?? null;
  };

  const findByName = (name: string) => employees.value.find((emp) => emp.name === name) ?? null;

  const findByUserForAuth = (user: { id: number; email: string; name?: string } | null | undefined) => {
    if (!user) return null;
    const linked = findByUserId(user.id);
    if (linked) return linked;
    const emailName = EMAIL_TO_EMPLOYEE[user.email.toLowerCase()];
    if (emailName) return findByName(emailName);
    if (user.name) return findByName(user.name);
    return null;
  };

  const directReports = (managerName: string) =>
    employees.value.filter((emp) => emp.manager === managerName);

  const canManagerApproveRequest = (managerProfileName: string, employeeName: string) => {
    const employee = findByName(employeeName);
    if (!employee) return false;
    return employee.manager === managerProfileName;
  };

  const managerOptions = computed(() => {
    const names = new Set<string>();
    employees.value.forEach((emp) => {
      if (emp.name.trim()) names.add(emp.name);
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
  });

  const departmentOptions = computed(() => {
    const names = new Set(employees.value.map((e) => e.department).filter(Boolean));
    return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
  });

  return {
    employees,
    departmentsGrouped,
    hierarchyLinks,
    hydrate,
    persist,
    updateEmployee,
    addEmployee,
    removeEmployee,
    findByUserId,
    findByUserForAuth,
    findByName,
    applyTestAccountLinks,
    ensureDemoTeam,
    directReports,
    canManagerApproveRequest,
    managerOptions,
    departmentOptions
  };
}
