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
  const storeRevision = useState<number>('vbi-avatars-revision', () => 0);

  const bump = () => {
    storeRevision.value += 1;
  };

  const getAvatarId = (userId: number | null | undefined): AvatarCharacterId | null => {
    void storeRevision.value;
    if (!userId || !import.meta.client) return null;
    const stored = readStore()[String(userId)];
    if (stored && isAvatarCharacterId(stored)) {
      return stored;
    }
    return null;
  };

  const getAvatarUrl = (userId: number | null | undefined): string | null => {
    const id = getAvatarId(userId);
    return id ? avatarImageUrl(id) : null;
  };

  const setAvatarId = (userId: number, characterId: AvatarCharacterId) => {
    if (!import.meta.client) return;
    const store = readStore();
    store[String(userId)] = characterId;
    writeStore(store);
    bump();
  };

  const hasAvatar = (userId: number | null | undefined): boolean => Boolean(getAvatarId(userId));

  return {
    AVATAR_CHARACTER_IDS,
    avatarImageUrl,
    getAvatarId,
    getAvatarUrl,
    setAvatarId,
    hasAvatar
  };
}
