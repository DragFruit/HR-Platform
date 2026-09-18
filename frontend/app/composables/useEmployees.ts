import { canApproverReviewRequest } from '~/utils/vacationApproval';
import { departmentScopeForManager } from '~/utils/departmentTeamScope';
import { listDepartmentsForUi } from '~/data/departments';
import { dedupeEmployeeList } from '~/utils/employeeDedupe';
import { normalizeEmployeeNameKey, resolveManagerFromList, employeeNamesMatch } from '~/utils/employeeName';
import { ensureEmployeeManagerIds } from '~/utils/employeeManagerRef';

export type AccountRole = 'employee' | 'manager' | 'hr' | 'admin';

export type Employee = {
  id: number;
  name: string;
  title: string;
  department: string;
  /** ФИО руководителя — для отображения/админки. */
  manager: string;
  /** id руководителя из справочника — для иерархии и календаря. */
  manager_id?: number | null;
  hired_at: string;
  /** День рождения: `YYYY-MM-DD` или `MM-DD` (год опционален). */
  birthday?: string | null;
  platform_user_id: number | null;
  bitrix_user_id?: number | null;
  email: string;
  account_role: AccountRole | '';
  vacation_opening_balance?: number | null;
  legal_entity: string;
  contract_form: string;
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
  6: { email: 'alina@vbi.local', account_role: 'manager', name: 'Алина' },
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
    manager_id: emp.manager_id ?? null,
    hired_at: emp.hired_at,
    birthday: emp.birthday || undefined,
    platform_user_id: emp.platform_user_id,
    // Явно шлём null, чтобы админ мог очистить ID в UI.
    bitrix_user_id:
      emp.bitrix_user_id ??
      (emp.platform_user_id && emp.id === emp.platform_user_id ? emp.id : null),
    email: emp.email || undefined,
    account_role: emp.account_role || undefined,
    vacation_opening_balance: emp.vacation_opening_balance ?? undefined,
    legal_entity: (emp.legal_entity ?? '').trim() || undefined,
    contract_form: (emp.contract_form ?? '').trim() || undefined
  });

  const fromServerShape = (row: {
    id: number;
    name: string;
    title: string;
    department: string;
    manager: string;
    manager_id?: number | null;
    hired_at: string;
    birthday?: string | null;
    platform_user_id: number | null;
    bitrix_user_id?: number | null;
    email?: string;
    account_role?: string;
    vacation_opening_balance?: number | null;
    legal_entity?: string;
    contract_form?: string;
  }): Employee =>
    enrichEmployeeRecord({
      id: row.id,
      name: row.name,
      title: row.title,
      department: row.department,
      manager: row.manager,
      manager_id: row.manager_id ?? null,
      hired_at: row.hired_at,
      birthday: row.birthday ?? null,
      platform_user_id: row.platform_user_id,
      bitrix_user_id:
        row.bitrix_user_id ??
        (row.platform_user_id && row.id === row.platform_user_id ? row.id : null),
      email: row.email ?? '',
      account_role: (row.account_role as AccountRole) ?? '',
      vacation_opening_balance: row.vacation_opening_balance ?? null,
      legal_entity: row.legal_entity?.trim() ?? '',
      contract_form: row.contract_form?.trim() ?? ''
    });

  const applyEmployeeList = (list: Employee[]) => {
    employeesRaw.value = ensureEmployeeManagerIds(dedupeEmployeeList(list));
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
      const managerEmp = resolved
        ? employeesRaw.value.find((row) => employeeNamesMatch(row.name, resolved))
        : null;
      patch = {
        ...patch,
        manager: resolved,
        manager_id: managerEmp?.id ?? null
      };
    }

    Object.assign(emp, patch);
    const enriched = enrichEmployeeRecord(emp);
    Object.assign(emp, enriched);
    employeesRaw.value = ensureEmployeeManagerIds(employeesRaw.value);
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
      manager_id: null,
      hired_at: new Date().toISOString().slice(0, 10),
      platform_user_id: null,
      email: '',
      account_role: '',
      legal_entity: '',
      contract_form: ''
    });
    persist();
  };

  const removeEmployee = async (id: number) => {
    const target = employeesRaw.value.find((emp) => emp.id === id);
    if (target?.account_role === 'admin') return { ok: false as const, error: 'Админа удалить нельзя' };
    const prev = employeesRaw.value.slice();
    employeesRaw.value = employeesRaw.value.filter((emp) => emp.id !== id);
    applyEmployeeList(employeesRaw.value);
    const result = await syncToServer();
    if (!result.ok) {
      applyEmployeeList(prev);
      return result;
    }
    return { ok: true as const };
  };

  const findByUserId = (userId: number | undefined) => {
    if (!userId) return null;
    return employees.value.find((emp) => emp.platform_user_id === userId) ?? null;
  };

  const findByName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    return employees.value.find((emp) => employeeNamesMatch(emp.name, trimmed)) ?? null;
  };
  const findById = (id: number) => employees.value.find((emp) => emp.id === id) ?? null;

  /** Руководитель сотрудника — из manager_id (fallback: поле manager). */
  const managerForEmployee = (emp: Employee | null | undefined): Employee | null => {
    if (!emp) return null;
    if (emp.manager_id) {
      const byId = findById(emp.manager_id);
      if (byId) return byId;
    }
    const mgrName = emp.manager?.trim();
    if (!mgrName) return null;
    return findByName(mgrName);
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

  const directReports = (managerRef: string | number | null | undefined) => {
    if (managerRef == null || managerRef === '') return [];

    let managerId: number | null = null;
    if (typeof managerRef === 'number') {
      managerId = Number.isFinite(managerRef) && managerRef > 0 ? managerRef : null;
    } else {
      const trimmed = managerRef.trim();
      if (!trimmed) return [];
      managerId = findByName(trimmed)?.id ?? null;
    }
    if (!managerId) return [];

    return employees.value.filter(
      (emp) => emp.manager_id === managerId && emp.id !== managerId
    );
  };

  /** Прямые и косвенные подчинённые (вся цепочка manager_id → …). */
  const allReports = (managerRef: string | number | null | undefined) => {
    const roots = directReports(managerRef);
    if (!roots.length) return [];

    const result: Employee[] = [];
    const seen = new Set<number>();

    const walk = (managerId: number) => {
      for (const emp of directReports(managerId)) {
        if (seen.has(emp.id)) continue;
        seen.add(emp.id);
        result.push(emp);
        walk(emp.id);
      }
    };

    for (const root of roots) {
      if (seen.has(root.id)) continue;
      seen.add(root.id);
      result.push(root);
      walk(root.id);
    }
    return result;
  };

  const managerProfileName = (
    user: { id: number; email: string; name: string } | null | undefined
  ) => {
    if (!user) return '';
    const linked = findByUserForAuth(user);
    return (linked?.name.trim() || user.name.trim());
  };

  const managerProfileEmployee = (
    user: { id: number; email: string; name: string } | null | undefined
  ) => findByUserForAuth(user);

  const directReportsForAuthUser = (
    user: { id: number; email: string; name: string } | null | undefined
  ) => {
    const me = findByUserForAuth(user);
    return me ? directReports(me.id) : [];
  };

  const allReportsForAuthUser = (
    user: { id: number; email: string; name: string } | null | undefined
  ) => {
    const me = findByUserForAuth(user);
    return me ? allReports(me.id) : [];
  };

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
      return Boolean(myName && employeeNamesMatch(emp.name, myName));
    };

    if (isManager && me) {
      const deptScope = departmentScopeForManager(me, employees.value);
      if (deptScope) {
        const members = employeesInDepartment(deptScope)
          .filter((emp) => !isSelf(emp))
          .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        return {
          mode: 'department',
          department: deptScope,
          members
        };
      }

      const members = directReports(me.id)
        .filter((emp) => emp.name.trim() && !isSelf(emp))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      return {
        mode: 'reports',
        department: me.department.trim() || user.department.trim(),
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
      { id: findByName(managerProfileName)?.id ?? null, name: managerProfileName },
      { status: 'pending', employee: employeeName, employee_id: employee.id },
      employee,
      (name) => findByName(name)?.id ?? null
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
    findById,
    managerForEmployee,
    directReports,
    allReports,
    directReportsForAuthUser,
    allReportsForAuthUser,
    employeesInDepartment,
    managerProfileName,
    managerProfileEmployee,
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
