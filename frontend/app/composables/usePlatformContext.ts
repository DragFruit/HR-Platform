import { findKnowledgeCard } from '~/data/knowledgeBaseCatalog';

export type PlatformRole = 'employee' | 'admin';

export type NavItem = {
  to: string;
  label: string;
  locked?: boolean;
};

const profileNavItem: NavItem = { to: '/profile', label: 'Профиль' };

const employeeNav: NavItem[] = [
  { to: '/', label: 'Главная' },
  { to: '/adaptation', label: 'Адаптация' },
  { to: '/organization', label: 'Структура' },
  { to: '/vacations', label: 'График отпусков' },
  { to: '/vpn', label: 'VPN' },
  { to: '/knowledge', label: 'База знаний' },
  { to: '/notifications', label: 'Уведомления' },
  { to: '/tasks', label: 'Задачи' },
  { to: '/store', label: 'Магазин · кошелёк' },
  { to: '/ideas', label: 'Банк идей' },
  profileNavItem
];

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Панель' },
  { to: '/admin/notifications', label: 'Уведомления' },
  { to: '/admin/organization', label: 'Структура' },
  { to: '/admin/employees', label: 'Сотрудники' },
  { to: '/admin/tasks', label: 'Задачи' },
  { to: '/admin/vacations', label: 'График отпусков' },
  { to: '/admin/how-it-looks', label: 'Как выглядит' },
  { to: '/admin/store', label: 'Магазин' },
  { to: '/admin/adaptation', label: 'Адаптация' },
  { to: '/admin/activity', label: 'Активность' },
  { to: '/admin/ideas', label: 'Банк идей' },
  profileNavItem
];

export function usePlatformContext() {
  const role = useState<PlatformRole>('platform-role', () => 'employee');
  const router = useRouter();
  const route = useRoute();
  const { user, authReady } = useAuth();
  const { isVacationsOnly, isPathAllowed, homePath, isNavPathUnlocked } = useLaunchScope();

  const isAdmin = computed(() => role.value === 'admin');
  const navItems = computed<NavItem[]>(() => {
    const base = isAdmin.value ? adminNav : employeeNav;
    if (!isVacationsOnly.value) {
      return base.map((item) => ({ ...item, locked: false }));
    }
    return base.map((item) => ({
      ...item,
      locked: !isNavPathUnlocked(item.to)
    }));
  });
  const canSwitchRole = computed(() => user.value?.role === 'admin');

  const syncRoleFromAuth = () => {
    if (!user.value) return;
    role.value = user.value.role === 'admin' ? 'admin' : 'employee';
  };

  const switchRole = (next: PlatformRole) => {
    if (!canSwitchRole.value && next === 'admin') return;

    role.value = next;
    if (next === 'admin') {
      router.push(isVacationsOnly.value ? '/admin/employees' : '/admin');
      return;
    }
    router.push(isVacationsOnly.value ? homePath(false) : '/');
  };

  const guardRoute = () => {
    if (!authReady.value) return;

    const canAccessAdmin = role.value === 'admin' || user.value?.role === 'admin';
    const adminOnly = route.path.startsWith('/admin');

    if (adminOnly && !canAccessAdmin) {
      router.replace(isVacationsOnly.value ? homePath(false) : '/');
      return;
    }

    if (isVacationsOnly.value && !isPathAllowed(route.path)) {
      router.replace(homePath(canAccessAdmin && role.value === 'admin'));
    }
  };

  watch(authReady, (ready) => {
    if (ready) syncRoleFromAuth();
  });

  // authReady в зависимостях: иначе после восстановления сессии роль
  // может остаться той же ('employee') и watcher на role не сработает —
  // замок меню не сработает на прямой ссылке.
  watch([role, () => route.path, authReady], guardRoute, { immediate: true });

  const profilePageTitles: Record<string, string> = {
    '/profile': 'Профиль',
    '/profile/assessment': 'Оценка',
    '/profile/development': 'Развитие'
  };

  const pageTitle = computed(() => {
    if (route.path.startsWith('/profile')) {
      return profilePageTitles[route.path] ?? 'Профиль';
    }
    if (route.path.startsWith('/tasks/hr-assessment')) {
      return 'HR-тест';
    }
    if (route.path.startsWith('/notifications')) {
      return 'Уведомления';
    }
    if (route.path.startsWith('/vpn')) {
      return 'VPN';
    }
    if (route.path.startsWith('/wallet')) {
      return 'Кошелёк';
    }
    if (route.path.startsWith('/ideas') || route.path.startsWith('/admin/ideas')) {
      return 'Банк идей';
    }
    if (route.path.startsWith('/knowledge/')) {
      const id = route.path.slice('/knowledge/'.length).split('/')[0] ?? '';
      return findKnowledgeCard(id)?.title ?? 'База знаний';
    }
    if (route.path.startsWith('/knowledge')) {
      return 'База знаний';
    }
    if (route.path === '/admin/how-it-looks') {
      return 'Как выглядит';
    }
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
    pageTitle,
    isVacationsOnly
  };
}
