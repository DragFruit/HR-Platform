import { canApproverReviewRequest } from '~/utils/vacationApproval';
import { listDepartmentsForUi } from '~/data/departments';
import { dedupeEmployeeList } from '~/utils/employeeDedupe';
import { normalizeEmployeeNameKey, resolveManagerFromList } from '~/utils/employeeName';

export type AccountRole = 'employee' | 'manager' | 'hr' | 'admin';

export type Employee = {
  id: number;
  name: string;
  title: string;
  department: string;
  manager: string;
  hired_at: string;
  platform_user_id: number | null;
  bitrix_user_id?: number | null;
  email: string;
  account_role: AccountRole | '';
  vacation_opening_balance?: number | null;
};

/** Данные входа (синхрон с useAuth / server credentials) */
export const PLATFORM_ACCOUNTS: Record<
  number,
  { email: string; account_role: AccountRole; name: string }
> = {
  1: { email: 'stas@vbi.local', account_role: 'admin', name: 'Стас' },
  2: { email: 'kostya@vbi.local', account_role: 'manager', name: 'Костя' },
  3: { email: 'katya@vbi.local', account_role: 'employee', name: 'Катя' },
  4: { email: 'vasya@vbi.local', account_role: 'employee', name: 'Вася' },
  5: { email: 'masha@vbi.local', account_role: 'employee', name: 'Маша' },
  6: { email: 'alina@vbi.local', account_role: 'employee', name: 'Алина' },
  9100: { email: 'jubilee@vbi.local', account_role: 'employee', name: 'Юбилеев Тест' }
};

export type EmployeeDepartment = {
  name: string;
  employees: Employee[];
};

const STORAGE_KEY = 'vbi-employees-v5';

export type EmployeeSyncResult = { ok: true } | { ok: false; error: string };
export type EmployeeSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const EMAIL_TO_EMPLOYEE: Record<string, string> = Object.fromEntries(
  Object.values(PLATFORM_ACCOUNTS).map((a) => [a.email.toLowerCase(), a.name])
);

export const buildDefaultEmployees = (): Employee[] => [];

const accountIdByEmail = (email: string): number | null => {
  const normalized = email.trim().toLowerCase();
  const entry = Object.entries(PLATFORM_ACCOUNTS).find(
    ([, acc]) => acc.email.toLowerCase() === normalized
  );
  return entry ? Number(entry[0]) : null;
};

const enrichEmployeeRecord = (emp: Employee): Employee => {
  if (emp.email.trim()) {
    const userId = accountIdByEmail(emp.email);
    if (userId) {
      const acc = PLATFORM_ACCOUNTS[userId];
      return {
        ...emp,
        platform_user_id: userId,
        account_role: emp.account_role || acc.account_role,
        name: emp.name.trim() || acc.name
      };
    }
  }
  return emp;
};

export function useEmployees() {
  const employeesRaw = useState<Employee[]>('vbi-employees', () => []);
  const employees = computed(() => dedupeEmployeeList(employeesRaw.value));
  const hydrated = useState<boolean>('vbi-employees-hydrated', () => false);
  const saveStatus = useState<EmployeeSaveStatus>('vbi-employees-save-status', () => 'idle');
  const saveError = useState<string>('vbi-employees-save-error', () => '');
  const reloadLoading = useState<boolean>('vbi-employees-reload-loading', () => false);

  const platformAccounts = computed(() =>
    Object.entries(PLATFORM_ACCOUNTS).map(([id, acc]) => ({
      id: Number(id),
      ...acc,
      linked: employeesRaw.value.some((e) => e.platform_user_id === Number(id))
    }))
  );

  const toServerShape = (emp: Employee) => ({
    id: emp.id,
    name: emp.name,
    title: emp.title,
    department: emp.department,
    manager: emp.manager,
    hired_at: emp.hired_at,
    platform_user_id: emp.platform_user_id,
    bitrix_user_id:
      emp.bitrix_user_id ??
      (emp.platform_user_id && emp.id === emp.platform_user_id ? emp.id : undefined),
    email: emp.email || undefined,
    account_role: emp.account_role || undefined,
    vacation_opening_balance: emp.vacation_opening_balance ?? undefined
  });

  const fromServerShape = (row: {
    id: number;
    name: string;
    title: string;
    department: string;
    manager: string;
    hired_at: string;
    platform_user_id: number | null;
    bitrix_user_id?: number | null;
    email?: string;
    account_role?: string;
    vacation_opening_balance?: number | null;
  }): Employee =>
    enrichEmployeeRecord({
      id: row.id,
      name: row.name,
      title: row.title,
      department: row.department,
      manager: row.manager,
      hired_at: row.hired_at,
      platform_user_id: row.platform_user_id,
      bitrix_user_id:
        row.bitrix_user_id ??
        (row.platform_user_id && row.id === row.platform_user_id ? row.id : null),
      email: row.email ?? '',
      account_role: (row.account_role as AccountRole) ?? '',
      vacation_opening_balance: row.vacation_opening_balance ?? null
    });

  const applyEmployeeList = (list: Employee[]) => {
    employeesRaw.value = dedupeEmployeeList(list);
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(employeesRaw.value));
  };

  const syncToServer = async (): Promise<EmployeeSyncResult> => {
    if (!import.meta.client) return { ok: true };
    saveStatus.value = 'saving';
    saveError.value = '';
    try {
      const saved = await $fetch<
        {
          id: number;
          name: string;
          title: string;
          department: string;
          manager: string;
          hired_at: string;
          platform_user_id: number | null;
          bitrix_user_id?: number | null;
          email?: string;
          account_role?: string;
        }[]
      >('/api/employees', {
        method: 'PUT',
        body: employeesRaw.value.map(toServerShape)
      });
      if (Array.isArray(saved)) {
        applyEmployeeList(saved.map(fromServerShape));
      }
      saveStatus.value = 'saved';
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'statusMessage' in err
            ? String((err as { statusMessage?: string }).statusMessage)
            : 'Не удалось сохранить на сервер';
      saveStatus.value = 'error';
      saveError.value = message;
      return { ok: false, error: message };
    }
  };

  const persist = () => {
    if (!import.meta.client) return;
    applyEmployeeList(employeesRaw.value);
    syncToServer();
  };

  const hydrate = async () => {
    if (!import.meta.client) return;
    if (hydrated.value) return;

    let loaded = false;
    try {
      const fromServer = await $fetch<
        {
          id: number;
          name: string;
          title: string;
          department: string;
          manager: string;
          hired_at: string;
          platform_user_id: number | null;
          email?: string;
          account_role?: string;
        }[]
      >('/api/employees');
      if (Array.isArray(fromServer)) {
        applyEmployeeList(fromServer.map(fromServerShape));
        loaded = true;
      }
    } catch {
      /* нет сессии */
    }

    if (!loaded) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          applyEmployeeList((JSON.parse(raw) as Employee[]).map(enrichEmployeeRecord));
        } catch {
          employeesRaw.value = [];
        }
      }
      if (employeesRaw.value.length) syncToServer();
    }

    hydrated.value = true;
  };

  const reloadFromServer = async () => {
    if (!import.meta.client) return;
    reloadLoading.value = true;
    try {
      hydrated.value = false;
      await hydrate();
    } finally {
      reloadLoading.value = false;
    }
  };

  const departmentsGrouped = computed<EmployeeDepartment[]>(() => {
    const map = new Map<string, Employee[]>();
    employees.value.forEach((emp) => {
      const dept = emp.department.trim() || 'Без отдела';
      const bucket = map.get(dept) ?? [];
      bucket.push(emp);
      map.set(dept, bucket);
    });
    return [...map.entries()].map(([name, group]) => ({
      name,
      employees: group.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    }));
  });

  const isAllowedManager = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return true;
    return managerOptions.value.some(
      (option) => normalizeEmployeeNameKey(option) === normalizeEmployeeNameKey(trimmed)
    );
  };

  const updateEmployee = (id: number, patch: Partial<Employee>) => {
    const emp = employeesRaw.value.find((item) => item.id === id);
    if (!emp) return;

    if (patch.manager !== undefined) {
      const resolved = resolveManagerFromList(String(patch.manager), managerOptions.value);
      if (resolved === null) {
        saveStatus.value = 'error';
        saveError.value = `«${patch.manager}» нет в списке руководителей`;
        return;
      }
      patch = { ...patch, manager: resolved };
    }

    Object.assign(emp, patch);
    const enriched = enrichEmployeeRecord(emp);
    Object.assign(emp, enriched);
    persist();
  };

  const linkEmployeeToAccount = (employeeId: number, platformUserId: number | null) => {
    const emp = employeesRaw.value.find((item) => item.id === employeeId);
    if (!emp) return;
    if (!platformUserId) {
      emp.platform_user_id = null;
      persist();
      return;
    }
    const acc = PLATFORM_ACCOUNTS[platformUserId];
    if (!acc) return;
    employeesRaw.value.forEach((row) => {
      if (row.id !== employeeId && row.platform_user_id === platformUserId) {
        row.platform_user_id = null;
        row.email = '';
        row.account_role = '';
      }
    });
    emp.platform_user_id = platformUserId;
    emp.email = acc.email;
    emp.account_role = acc.account_role;
    if (!emp.name.trim()) emp.name = acc.name;
    persist();
  };

  const addEmployee = () => {
    const nextId = Math.max(0, ...employeesRaw.value.map((e) => e.id)) + 1;
    employeesRaw.value.push({
      id: nextId,
      name: '',
      title: '',
      department: '',
      manager: '',
      hired_at: new Date().toISOString().slice(0, 10),
      platform_user_id: null,
      email: '',
      account_role: ''
    });
    persist();
  };

  const removeEmployee = (id: number) => {
    employeesRaw.value = employeesRaw.value.filter((emp) => emp.id !== id);
    persist();
  };

  const findByUserId = (userId: number | undefined) => {
    if (!userId) return null;
    return employees.value.find((emp) => emp.platform_user_id === userId) ?? null;
  };

  const findByName = (name: string) => employees.value.find((emp) => emp.name === name) ?? null;

  /** Руководитель сотрудника — из поля manager справочника (актуальная версия на платформе). */
  const managerForEmployee = (emp: Employee | null | undefined): Employee | null => {
    const mgrName = emp?.manager?.trim();
    if (!mgrName) return null;
    const key = normalizeEmployeeNameKey(mgrName);
    return employees.value.find((e) => normalizeEmployeeNameKey(e.name) === key) ?? null;
  };

  const findByUserForAuth = (user: { id: number; email: string; name?: string } | null | undefined) => {
    if (!user) return null;
    const linked = findByUserId(user.id);
    if (linked) return linked;
    const emailName = EMAIL_TO_EMPLOYEE[user.email.toLowerCase()];
    if (emailName) return findByName(emailName);
    if (user.name) return findByName(user.name);
    return null;
  };

  const directReports = (managerName: string) => {
    const normalized = managerName.trim();
    if (!normalized) return [];
    return employees.value.filter(
      (emp) => emp.manager.trim() === normalized && emp.name.trim() !== normalized
    );
  };

  /** Прямые и косвенные подчинённые (вся цепочка manager → …). */
  const allReports = (managerName: string) => {
    const normalized = managerName.trim();
    if (!normalized) return [];

    const result: Employee[] = [];
    const seen = new Set<number>();

    const walk = (leadName: string) => {
      for (const emp of directReports(leadName)) {
        if (seen.has(emp.id)) continue;
        seen.add(emp.id);
        result.push(emp);
        walk(emp.name.trim());
      }
    };

    walk(normalized);
    return result;
  };

  const managerProfileName = (
    user: { id: number; email: string; name: string } | null | undefined
  ) => {
    if (!user) return '';
    const linked = findByUserForAuth(user);
    return (linked?.name.trim() || user.name.trim());
  };

  const directReportsForAuthUser = (
    user: { id: number; email: string; name: string } | null | undefined
  ) => directReports(managerProfileName(user));

  const allReportsForAuthUser = (
    user: { id: number; email: string; name: string } | null | undefined
  ) => allReports(managerProfileName(user));

  const employeesInDepartment = (department: string) => {
    const normalized = department.trim();
    if (!normalized) return [];
    return employees.value
      .filter((emp) => emp.department.trim() === normalized && emp.name.trim())
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  };

  type ProfileTeamContext = {
    mode: 'reports' | 'department';
    department: string;
    members: Employee[];
  };

  const profileTeamForUser = (
    user: { id: number; email: string; name: string; role: string; department: string } | null
  ): ProfileTeamContext => {
    if (!user) {
      return { mode: 'department', department: '', members: [] };
    }

    const me = findByUserForAuth(user);
    const myName = me?.name.trim() || user.name.trim();
    const isManager = user.role === 'manager' || me?.account_role === 'manager';

    const isSelf = (emp: Employee) => {
      if (emp.platform_user_id === user.id) return true;
      if (me && emp.id === me.id) return true;
      return Boolean(myName && emp.name.trim() === myName);
    };

    if (isManager && myName) {
      const members = directReports(myName)
        .filter((emp) => emp.name.trim() && !isSelf(emp))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      return {
        mode: 'reports',
        department: me?.department.trim() || user.department.trim(),
        members
      };
    }

    const department = (me?.department || user.department || '').trim();
    if (!department) {
      return { mode: 'department', department: '', members: [] };
    }

    const members = employees.value
      .filter(
        (emp) =>
          emp.department.trim() === department && emp.name.trim() && !isSelf(emp)
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    return { mode: 'department', department, members };
  };

  const canManagerApproveRequest = (managerProfileName: string, employeeName: string) => {
    const employee = findByName(employeeName);
    if (!employee) return false;
    return canApproverReviewRequest(
      managerProfileName,
      { status: 'pending', employee: employeeName },
      employee
    );
  };

  const managerOptions = computed(() => {
    const names = new Set<string>();
    for (const emp of employees.value) {
      const name = emp.name.trim();
      if (!name) continue;
      const role = emp.account_role;
      if (role === 'manager' || role === 'admin' || role === 'hr') {
        names.add(name);
      }
    }
    for (const emp of employees.value) {
      const manager = emp.manager.trim();
      if (manager) names.add(manager);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
  });

  const departmentOptions = computed(() => {
    const config = useRuntimeConfig();
    return listDepartmentsForUi(Boolean(config.public.qaTestDepartment));
  });

  const employeeCount = computed(() => employees.value.length);

  const linkedCount = computed(
    () => employees.value.filter((e) => e.platform_user_id && e.name.trim()).length
  );

  return {
    employees,
    employeesRaw,
    departmentsGrouped,
    platformAccounts,
    employeeCount,
    linkedCount,
    hydrate,
    reloadFromServer,
    persist,
    updateEmployee,
    linkEmployeeToAccount,
    addEmployee,
    removeEmployee,
    findByUserId,
    findByUserForAuth,
    findByName,
    managerForEmployee,
    directReports,
    allReports,
    directReportsForAuthUser,
    allReportsForAuthUser,
    employeesInDepartment,
    managerProfileName,
    profileTeamForUser,
    canManagerApproveRequest,
    managerOptions,
    isAllowedManager,
    departmentOptions,
    syncToServer,
    saveStatus,
    saveError,
    reloadLoading
  };
}
