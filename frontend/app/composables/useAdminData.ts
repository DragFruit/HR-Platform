export type OrgMember = {
  id: number;
  name: string;
  title: string;
};

export type Department = {
  id: number;
  name: string;
  head: string;
  head_user_id: number | null;
  employees: number;
  members: OrgMember[];
};

export type CompanyLeader = {
  name: string;
  title: string;
};

export type HierarchyLink = {
  id: number;
  employee: string;
  manager: string;
  department: string;
};

export type PlatformUser = {
  id: number;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'hr' | 'admin';
  department: string;
  status: 'active' | 'blocked';
};

export type StoreReward = {
  id: number;
  name: string;
  category: string;
  price: number;
  monthly_limit: number;
  active: boolean;
};

const companyLeader = ref<CompanyLeader>({
  name: 'Алексей В.',
  title: 'Генеральный директор'
});

const departments = ref<Department[]>([
  {
    id: 1,
    name: 'Product',
    head: 'Анна С.',
    head_user_id: 2,
    employees: 18,
    members: [
      { id: 101, name: 'Стас', title: 'Product Developer' },
      { id: 102, name: 'Алина К.', title: 'Product Analyst' }
    ]
  },
  {
    id: 2,
    name: 'Engineering',
    head: 'Игорь М.',
    head_user_id: null,
    employees: 42,
    members: [
      { id: 201, name: 'Дмитрий Л.', title: 'Backend Developer' },
      { id: 202, name: 'Елена Р.', title: 'QA Engineer' }
    ]
  },
  {
    id: 3,
    name: 'Sales',
    head: 'Мария К.',
    head_user_id: null,
    employees: 26,
    members: [{ id: 301, name: 'Павел Н.', title: 'Account Manager' }]
  },
  {
    id: 4,
    name: 'HR',
    head: 'Ольга П.',
    head_user_id: 3,
    employees: 8,
    members: [{ id: 401, name: 'Кира Т.', title: 'HR Specialist' }]
  }
]);

const hierarchy = ref<HierarchyLink[]>([
  { id: 1, employee: 'Стас', manager: 'Анна С.', department: 'Product' },
  { id: 2, employee: 'Алина К.', manager: 'Анна С.', department: 'Product' },
  { id: 3, employee: 'Игорь М.', manager: 'CEO Office', department: 'Engineering' }
]);

const users = ref<PlatformUser[]>([
  {
    id: 1,
    name: 'Стас',
    email: 'stas@vbi.local',
    role: 'admin',
    department: 'HR',
    status: 'active'
  },
  {
    id: 2,
    name: 'Костя',
    email: 'kostya@vbi.local',
    role: 'manager',
    department: 'Команда',
    status: 'active'
  },
  {
    id: 3,
    name: 'Катя',
    email: 'katya@vbi.local',
    role: 'employee',
    department: 'Команда',
    status: 'active'
  },
  {
    id: 4,
    name: 'Вася',
    email: 'vasya@vbi.local',
    role: 'employee',
    department: 'Команда',
    status: 'active'
  },
  {
    id: 5,
    name: 'Маша',
    email: 'masha@vbi.local',
    role: 'employee',
    department: 'Команда',
    status: 'active'
  }
]);

const storeRewards = ref<StoreReward[]>([
  { id: 1, name: 'Day Off', category: 'time', price: 1000, monthly_limit: 1, active: true },
  { id: 2, name: 'Merch Pack', category: 'merch', price: 450, monthly_limit: 2, active: true },
  { id: 3, name: 'Learning Budget', category: 'growth', price: 700, monthly_limit: 1, active: false }
]);

export function useAdminData() {
  const managerCandidates = computed(() =>
    users.value.filter((u) => u.role === 'manager' || u.role === 'admin')
  );

  const assignDepartmentHead = (departmentId: number, userId: number | null) => {
    const dep = departments.value.find((d) => d.id === departmentId);
    if (!dep) return;

    if (!userId) {
      dep.head = '';
      dep.head_user_id = null;
      return;
    }

    const user = users.value.find((u) => u.id === userId);
    if (!user) return;

    dep.head = user.name;
    dep.head_user_id = user.id;
    user.role = 'manager';
    user.department = dep.name;
  };

  const addDepartment = () => {
    const nextId = Math.max(...departments.value.map((d) => d.id), 0) + 1;
    departments.value.push({
      id: nextId,
      name: `Новый отдел ${nextId}`,
      head: '',
      head_user_id: null,
      employees: 0,
      members: []
    });
  };

  const reorderDepartments = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const list = [...departments.value];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    departments.value = list;
  };

  const addMemberToDepartment = (departmentId: number, name: string) => {
    const dep = departments.value.find((d) => d.id === departmentId);
    if (!dep || !name.trim()) return;

    const nextId = Date.now();
    dep.members.push({
      id: nextId,
      name: name.trim(),
      title: 'Сотрудник'
    });
    dep.employees = dep.members.length + (dep.head ? 1 : 0);
  };

  return {
    companyLeader,
    departments,
    hierarchy,
    users,
    storeRewards,
    managerCandidates,
    assignDepartmentHead,
    addDepartment,
    reorderDepartments,
    addMemberToDepartment
  };
}
