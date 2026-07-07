import { QA_DEMO_ACCOUNT_HINTS } from '~/data/qaTestDepartment';
import type { PlatformRole } from '~/composables/usePlatformContext';

export type AuthSessionUser = {
  id: number;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'hr' | 'admin';
  department: string;
  bitrix_user_id?: number | null;
  auth_source?: 'demo' | 'bitrix';
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
  },
  {
    id: 6,
    name: 'Алина',
    email: 'alina@vbi.local',
    password: 'employee123',
    role: 'employee',
    department: 'Команда',
    description: 'Новичок — трек адаптации и тесты'
  }
];

const SESSION_KEY = 'vbi-auth-session';
const WELCOMED_KEY = 'vbi-welcomed-users';

let restoreSessionPromise: Promise<void> | null = null;

export type OnboardingStep = 'welcome' | 'avatar';

export function useAuth() {
  const user = useState<AuthSessionUser | null>('auth-user', () => null);
  const showOnboarding = useState<boolean>('auth-show-onboarding', () => false);
  const onboardingStep = useState<OnboardingStep>('auth-onboarding-step', () => 'welcome');
  const authReady = useState<boolean>('auth-ready', () => false);

  const isAuthenticated = computed(() => Boolean(user.value));

  const restoreSession = async () => {
    if (!import.meta.client) return;
    if (restoreSessionPromise) return restoreSessionPromise;

    restoreSessionPromise = (async () => {
      try {
        const server = await $fetch<{ ok: boolean; user: AuthSessionUser | null }>('/api/auth/session');
        if (server.ok && server.user) {
          user.value = server.user;
          localStorage.setItem(SESSION_KEY, JSON.stringify(server.user));
          syncOnboardingState(server.user.id);
          authReady.value = true;
          return;
        }
      } catch {
        /* cookie expired — fall through to localStorage */
      }

      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        authReady.value = true;
        return;
      }

      try {
        const parsed = JSON.parse(raw) as AuthSessionUser;

        if (parsed.auth_source === 'bitrix') {
          user.value = null;
          localStorage.removeItem(SESSION_KEY);
          authReady.value = true;
          return;
        }

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
          await $fetch('/api/auth/session', {
            method: 'POST',
            body: { email: match.email, password: match.password }
          }).catch(() => {});
          syncOnboardingState(match.id);
        } else {
          user.value = null;
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }

      authReady.value = true;
    })();

    try {
      await restoreSessionPromise;
    } finally {
      restoreSessionPromise = null;
    }
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
  };

  const syncOnboardingState = (userId: number) => {
    if (!import.meta.client) return;
    const { hasAvatar } = useAvatars();
    const welcomed = getWelcomedUsers().includes(userId);
    const avatarChosen = hasAvatar(userId);

    if (!welcomed) {
      showOnboarding.value = true;
      onboardingStep.value = 'welcome';
      return;
    }

    if (!avatarChosen) {
      showOnboarding.value = true;
      onboardingStep.value = 'avatar';
      return;
    }

    showOnboarding.value = false;
  };

  const finishOnboarding = (userId: number, characterId: import('~/composables/useAvatars').AvatarCharacterId) => {
    const { setAvatarId } = useAvatars();
    setAvatarId(userId, characterId);
    markWelcomed(userId);
    showOnboarding.value = false;
  };

  const loginWithBitrix = () => {
    if (!import.meta.client) return;
    window.location.href = '/api/auth/bitrix';
  };

  const login = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const found = credentials.find(
      (item) => item.email.toLowerCase() === normalizedEmail && item.password === password
    );

    if (!found) {
      return { ok: false as const, error: 'Неверный логин или пароль' };
    }

    try {
      const res = await $fetch<{ ok: boolean; user: AuthSessionUser }>('/api/auth/session', {
        method: 'POST',
        body: { email: normalizedEmail, password }
      });
      user.value = res.user;
    } catch {
      return { ok: false as const, error: 'Ошибка входа на сервер' };
    }

    const sessionUser = user.value!;

    if (import.meta.client) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      syncOnboardingState(sessionUser.id);
    }

    return {
      ok: true as const,
      user: sessionUser,
      isFirstLogin: showOnboarding.value
    };
  };

  const logout = async () => {
    user.value = null;
    showOnboarding.value = false;
    if (import.meta.client) {
      useAdaptation().resetUserSession();
      useState<PlatformRole>('platform-role', () => 'employee').value = 'employee';
      localStorage.removeItem(SESSION_KEY);
      await $fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});

      const router = useRouter();
      const route = useRoute();
      if (route.query.auth || route.query.auth_error) {
        await router.replace({ path: route.path, query: {} });
      }
    }
  };

  const runtimeConfig = useRuntimeConfig();

  const demoAccounts = computed(() =>
    credentials.map(({ email, role, password, description, name }) => {
      const qaHint = runtimeConfig.public.qaTestDepartment
        ? QA_DEMO_ACCOUNT_HINTS[email.toLowerCase()]
        : undefined;
      return {
        email,
        role,
        password,
        description: qaHint ?? description,
        name
      };
    })
  );

  return {
    user,
    showOnboarding,
    onboardingStep,
    authReady,
    isAuthenticated,
    restoreSession,
    login,
    loginWithBitrix,
    logout,
    finishOnboarding,
    demoAccounts
  };
}
