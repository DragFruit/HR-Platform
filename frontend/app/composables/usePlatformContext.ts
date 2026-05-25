export type PlatformRole = 'employee' | 'admin';

export type NavItem = {
  to: string;
  label: string;
};

const employeeNav: NavItem[] = [
  { to: '/', label: 'Главная' },
  { to: '/adaptation', label: 'Адаптация' },
  { to: '/organization', label: 'Структура' },
  { to: '/vacations', label: 'График отпусков' },
  { to: '/tasks', label: 'Задачи' },
  { to: '/store', label: 'Магазин' },
  { to: '/wallet', label: 'Кошелек' },
  { to: '/profile', label: 'Профиль' }
];

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Панель' },
  { to: '/admin/organization', label: 'Структура' },
  { to: '/admin/employees', label: 'Сотрудники' },
  { to: '/admin/hierarchy', label: 'Подчинение' },
  { to: '/admin/vacations', label: 'График отпусков' },
  { to: '/admin/users', label: 'Аккаунты' },
  { to: '/admin/store', label: 'Магазин' },
  { to: '/admin/adaptation', label: 'Адаптация' }
];

export function usePlatformContext() {
  const role = useState<PlatformRole>('platform-role', () => 'employee');
  const router = useRouter();
  const route = useRoute();
  const { user } = useAuth();

  const isAdmin = computed(() => role.value === 'admin');
  const navItems = computed(() => (isAdmin.value ? adminNav : employeeNav));
  const canSwitchRole = computed(() => user.value?.role === 'admin');

  const syncRoleFromAuth = () => {
    if (!user.value) return;
    role.value = user.value.role === 'admin' ? 'admin' : 'employee';
  };

  const switchRole = (next: PlatformRole) => {
    if (!canSwitchRole.value && next === 'admin') return;

    role.value = next;
    if (next === 'admin') {
      router.push('/admin');
      return;
    }
    router.push('/');
  };

  const guardRoute = () => {
    const adminOnly = route.path.startsWith('/admin');
    if (adminOnly && role.value !== 'admin') {
      router.replace('/');
    }
  };

  watch([role, () => route.path], guardRoute, { immediate: true });

  const pageTitle = computed(() => {
    const current = navItems.value.find((item) => item.to === route.path);
    return current?.label ?? (isAdmin.value ? 'Администрирование' : 'Платформа');
  });

  return {
    role,
    isAdmin,
    navItems,
    canSwitchRole,
    syncRoleFromAuth,
    switchRole,
    pageTitle
  };
}
