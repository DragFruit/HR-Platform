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
  name: '',
  title: ''
});

const departments = ref<Department[]>([]);
const hierarchy = ref<HierarchyLink[]>([]);

/** Legacy-справочник для редактора отделов в useAdminData; сотрудники — useEmployees */
const users = ref<PlatformUser[]>([]);

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
