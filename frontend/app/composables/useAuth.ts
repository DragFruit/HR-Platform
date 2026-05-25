export type AuthSessionUser = {
  id: number;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'hr' | 'admin';
  department: string;
};

type Credential = AuthSessionUser & {
  password: string;
  description: string;
};

/** Демо-команда: Стас (админ), Костя (руководитель), Катя / Вася / Маша (сотрудники) */
const credentials: Credential[] = [
  {
    id: 1,
    name: 'Стас',
    email: 'stas@vbi.local',
    password: 'admin123',
    role: 'admin',
    department: 'HR',
    description: 'Администратор платформы'
  },
  {
    id: 2,
    name: 'Костя',
    email: 'kostya@vbi.local',
    password: 'manager123',
    role: 'manager',
    department: 'Команда',
    description: 'Руководитель — согласует отпуска команды'
  },
  {
    id: 3,
    name: 'Катя',
    email: 'katya@vbi.local',
    password: 'employee123',
    role: 'employee',
    department: 'Команда',
    description: 'Сотрудник — график отпусков и заявки'
  },
  {
    id: 4,
    name: 'Вася',
    email: 'vasya@vbi.local',
    password: 'employee123',
    role: 'employee',
    department: 'Команда',
    description: 'Сотрудник — график отпусков и заявки'
  },
  {
    id: 5,
    name: 'Маша',
    email: 'masha@vbi.local',
    password: 'employee123',
    role: 'employee',
    department: 'Команда',
    description: 'Сотрудник — график отпусков и заявки'
  }
];

const SESSION_KEY = 'vbi-auth-session';
const WELCOMED_KEY = 'vbi-welcomed-users';

export function useAuth() {
  const user = useState<AuthSessionUser | null>('auth-user', () => null);
  const showWelcome = useState<boolean>('auth-show-welcome', () => false);
  const authReady = useState<boolean>('auth-ready', () => false);

  const isAuthenticated = computed(() => Boolean(user.value));

  const restoreSession = () => {
    if (!import.meta.client) return;

    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      authReady.value = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AuthSessionUser;
      const match = credentials.find(
        (item) => item.id === parsed.id && item.email.toLowerCase() === parsed.email.toLowerCase()
      );
      if (match) {
        user.value = {
          id: match.id,
          name: match.name,
          email: match.email,
          role: match.role,
          department: match.department
        };
      } else {
        user.value = null;
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }

    authReady.value = true;
  };

  const getWelcomedUsers = (): number[] => {
    if (!import.meta.client) return [];
    const raw = localStorage.getItem(WELCOMED_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as number[];
    } catch {
      return [];
    }
  };

  const markWelcomed = (userId: number) => {
    if (!import.meta.client) return;
    const welcomed = new Set(getWelcomedUsers());
    welcomed.add(userId);
    localStorage.setItem(WELCOMED_KEY, JSON.stringify([...welcomed]));
    showWelcome.value = false;
  };

  const login = (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const found = credentials.find(
      (item) => item.email.toLowerCase() === normalizedEmail && item.password === password
    );

    if (!found) {
      return { ok: false as const, error: 'Неверный логин или пароль' };
    }

    const sessionUser: AuthSessionUser = {
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
      department: found.department
    };

    user.value = sessionUser;

    if (import.meta.client) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      const welcomed = getWelcomedUsers();
      showWelcome.value = !welcomed.includes(sessionUser.id);
    }

    return { ok: true as const, user: sessionUser, isFirstLogin: showWelcome.value };
  };

  const logout = () => {
    user.value = null;
    showWelcome.value = false;
    if (import.meta.client) {
      localStorage.removeItem(SESSION_KEY);
    }
  };

  const demoAccounts = credentials.map(({ email, role, password, description, name }) => ({
    email,
    role,
    password,
    description,
    name
  }));

  return {
    user,
    showWelcome,
    authReady,
    isAuthenticated,
    restoreSession,
    login,
    logout,
    markWelcomed,
    demoAccounts
  };
}
