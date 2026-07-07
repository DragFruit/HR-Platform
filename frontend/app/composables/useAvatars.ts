/** Идентификаторы персонажей из `public/avatars/character_XX.png` */
export const AVATAR_CHARACTER_IDS = Array.from({ length: 40 }, (_, index) => {
  const num = String(index + 1).padStart(2, '0');
  return `character_${num}`;
});

export type AvatarCharacterId = (typeof AVATAR_CHARACTER_IDS)[number];

const STORAGE_KEY = 'vbi-user-avatars-v1';

export function avatarImageUrl(characterId: string): string {
  return `/avatars/${characterId}.png`;
}

export function isAvatarCharacterId(value: string): value is AvatarCharacterId {
  return AVATAR_CHARACTER_IDS.includes(value as AvatarCharacterId);
}

function readStore(): Record<string, string> {
  if (!import.meta.client) return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, string>) {
  if (!import.meta.client) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function useAvatars() {
  const serverStore = useState<Record<string, string>>('vbi-avatars-server', () => ({}));
  const hydrated = useState<boolean>('vbi-avatars-hydrated', () => false);
  const storeRevision = useState<number>('vbi-avatars-revision', () => 0);

  const bump = () => {
    storeRevision.value += 1;
  };

  const hydrateFromServer = async () => {
    if (!import.meta.client) return;
    try {
      const res = await $fetch<{ avatars: Record<string, string> }>('/api/avatars');
      serverStore.value = res.avatars ?? {};

      const local = readStore();
      const { user } = useAuth();
      const userId = user.value?.id;
      if (userId) {
        const key = String(userId);
        const localAvatar = local[key];
        if (localAvatar && isAvatarCharacterId(localAvatar) && !serverStore.value[key]) {
          try {
            const uploaded = await $fetch<{ avatars: Record<string, string> }>('/api/avatars/me', {
              method: 'PUT',
              body: { characterId: localAvatar }
            });
            serverStore.value = uploaded.avatars ?? serverStore.value;
          } catch {
            /* сохраним локально, синхронизируем позже */
          }
        }
      }

      writeStore({ ...local, ...serverStore.value });
      hydrated.value = true;
      bump();
    } catch {
      hydrated.value = false;
    }
  };

  const resetHydration = () => {
    hydrated.value = false;
    serverStore.value = {};
  };

  const getAvatarId = (userId: number | null | undefined): AvatarCharacterId | null => {
    void storeRevision.value;
    if (!userId) return null;

    const key = String(userId);
    const fromServer = serverStore.value[key];
    if (fromServer && isAvatarCharacterId(fromServer)) {
      return fromServer;
    }

    if (!import.meta.client) return null;
    const stored = readStore()[key];
    if (stored && isAvatarCharacterId(stored)) {
      return stored;
    }
    return null;
  };

  const getAvatarUrl = (userId: number | null | undefined): string | null => {
    const id = getAvatarId(userId);
    return id ? avatarImageUrl(id) : null;
  };

  const setAvatarId = async (userId: number, characterId: AvatarCharacterId) => {
    if (!import.meta.client) return;

    const key = String(userId);
    const store = readStore();
    store[key] = characterId;
    writeStore(store);
    serverStore.value = { ...serverStore.value, [key]: characterId };
    bump();

    try {
      const res = await $fetch<{ avatars: Record<string, string> }>('/api/avatars/me', {
        method: 'PUT',
        body: { characterId }
      });
      serverStore.value = res.avatars ?? serverStore.value;
      writeStore({ ...readStore(), ...serverStore.value });
      bump();
    } catch {
      /* офлайн или нет сессии */
    }
  };

  const hasAvatar = (userId: number | null | undefined): boolean => Boolean(getAvatarId(userId));

  return {
    AVATAR_CHARACTER_IDS,
    avatarImageUrl,
    getAvatarId,
    getAvatarUrl,
    setAvatarId,
    hasAvatar,
    hydrateFromServer,
    resetHydration,
    avatarsHydrated: hydrated
  };
}
