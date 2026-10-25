export type PlatformRole = 'employee' | 'admin';

export type NavItem = {
  to: string;
  label: string;
  locked?: boolean;
  /** Точка-индикатор: у квеста «Синий Ноктюрн» — доступная мини-игра дня. */
  dot?: boolean;
};

const profileNavItem: NavItem = { to: '/profile', label: 'Профиль' };

/** Выбранный админом режим «Я / Админ» — переживает навигацию и перезагрузку. */
export const PLATFORM_ROLE_STORAGE_KEY = 'vbi-platform-role';

const readSavedPlatformRole = (): PlatformRole | null => {
  if (!import.meta.client) return null;
  try {
    const raw = localStorage.getItem(PLATFORM_ROLE_STORAGE_KEY);
    return raw === 'admin' || raw === 'employee' ? raw : null;
  } catch {
    return null;
  }
};

const savePlatformRole = (next: PlatformRole) => {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(PLATFORM_ROLE_STORAGE_KEY, next);
  } catch {
    /* private mode — режим просто не запомнится */
  }
};

const employeeNav: NavItem[] = [
  { to: '/', label: 'Главная' },
  { to: '/event/nokturn', label: 'Синий Ноктюрн' },
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
  { to: '/admin/sales-best', label: 'Лучший ОП' },
  { to: '/admin/ideas', label: 'Банк идей' },
  { to: '/admin/knowledge', label: 'База знаний' },
  { to: '/admin/surveys', label: 'Опросы' },
  profileNavItem
];

export function usePlatformContext() {
  const role = useState<PlatformRole>('platform-role', () => 'employee');
  const router = useRouter();
  const route = useRoute();
  const { user, authReady } = useAuth();
  const { isVacationsOnly, isPathAllowed, homePath, isNavPathUnlocked } = useLaunchScope();

  const isAdmin = computed(() => role.value === 'admin');
  const { dot: nokturnDot } = useNokturnBadge();
  const withDot = (item: NavItem): boolean =>
    item.to === '/event/nokturn' && nokturnDot.value;
  const navItems = computed<NavItem[]>(() => {
    const base = isAdmin.value ? adminNav : employeeNav;
    if (!isVacationsOnly.value) {
      return base.map((item) => ({ ...item, locked: false, dot: withDot(item) }));
    }
    // Пилот: все пункты видны; закрытые — с замком, не кликабельны
    return base.map((item) => ({
      ...item,
      locked: !isNavPathUnlocked(item.to),
      dot: withDot(item) && isNavPathUnlocked(item.to)
    }));
  });
  const canSwitchRole = computed(() => user.value?.role === 'admin');

  const syncRoleFromAuth = () => {
    if (!user.value) return;
    if (user.value.role !== 'admin') {
      role.value = 'employee';
      return;
    }
    // Админ: помним выбранный режим «Я / Админ» (десктоп и мобилка одинаково).
    // Прямая ссылка в /admin всегда открывает админку.
    const saved = readSavedPlatformRole();
    role.value = route.path.startsWith('/admin') ? 'admin' : saved ?? 'admin';
  };

  const switchRole = (next: PlatformRole) => {
    if (!canSwitchRole.value && next === 'admin') return;

    role.value = next;
    savePlatformRole(next);
    if (next === 'admin') {
      // Уже в админке — остаёмся на текущем экране
      if (route.path.startsWith('/admin')) return;
      router.push(isVacationsOnly.value ? '/admin/employees' : '/admin');
      return;
    }
    // Режим «Я»: если текущий путь доступен сотруднику — не уводим на главную
    // (важно для /vacations: админ смотрит свой график без прыжка на /)
    if (!route.path.startsWith('/admin') && isPathAllowed(route.path)) return;
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
    if (route.path.startsWith('/knowledge')) {
      return 'База знаний';
    }
    if (route.path.startsWith('/admin/surveys')) {
      return 'Опросы';
    }
    if (route.path.startsWith('/event/nokturn')) {
      return 'Синий Ноктюрн';
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
