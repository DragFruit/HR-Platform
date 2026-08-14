export type IdeaStatus = 'review' | 'implementation' | 'done' | 'rejected';

export type Idea = {
  id: string;
  authorUserId: number;
  authorName: string;
  title: string;
  description: string;
  category: string;
  city: string;
  status: IdeaStatus;
  createdAt: string;
  votesUp: number;
  votesDown: number;
  attachmentName?: string;
  /** Комментарий админа при последней смене этапа */
  statusComment?: string;
  statusChangedAt?: string;
};

export type CreateIdeaInput = {
  title: string;
  description: string;
  category: string;
  city: string;
  attachmentName?: string;
};

export const IDEA_CATEGORIES = [
  'Офисная среда',
  'Процессы',
  'Культура',
  'IT и инструменты',
  'Корпоративы и развлечения',
  'Другое'
] as const;

const IDEA_CATEGORY_RENAMES: Record<string, string> = {
  Благополучие: 'Корпоративы и развлечения'
};

export function normalizeIdeaCategory(raw: string): string {
  const trimmed = raw.trim() || 'Другое';
  return IDEA_CATEGORY_RENAMES[trimmed] ?? trimmed;
}

export const IDEA_CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Удалённо'] as const;

type VotesStore = Record<string, 'up' | 'down'>;

type IdeasApiPayload = {
  ideas: Idea[];
  myVotes: VotesStore;
  createdId?: string;
};

const STATUS_LABELS: Record<IdeaStatus, string> = {
  review: 'На рассмотрении',
  implementation: 'Реализация',
  done: 'Реализовано',
  rejected: 'Отклонено'
};

export function useIdeasBank() {
  const { user } = useAuth();
  const ideas = useState<Idea[]>('vbi-ideas-bank', () => []);
  const userVotes = useState<VotesStore>('vbi-ideas-user-votes', () => ({}));
  const hydrated = useState('vbi-ideas-bank-hydrated', () => false);

  const applyPayload = (payload: IdeasApiPayload) => {
    ideas.value = Array.isArray(payload.ideas) ? payload.ideas : [];
    userVotes.value =
      payload.myVotes && typeof payload.myVotes === 'object' ? { ...payload.myVotes } : {};
  };

  const hydrate = async () => {
    if (!import.meta.client) return;
    try {
      const payload = await $fetch<IdeasApiPayload>('/api/ideas');
      applyPayload(payload);
    } catch {
      ideas.value = [];
      userVotes.value = {};
    }
    hydrated.value = true;
  };

  const totalCount = computed(() => ideas.value.length);

  const myIdeas = computed(() => {
    const userId = user.value?.id;
    if (!userId) return [];
    return ideas.value.filter((idea) => idea.authorUserId === userId);
  });

  const myCount = computed(() => myIdeas.value.length);

  const stats = computed(() => ({
    total: ideas.value.length,
    review: ideas.value.filter((i) => i.status === 'review').length,
    implementation: ideas.value.filter((i) => i.status === 'implementation').length,
    done: ideas.value.filter((i) => i.status === 'done').length,
    rejected: ideas.value.filter((i) => i.status === 'rejected').length
  }));

  const categories = computed(() => {
    const fromData = [...new Set(ideas.value.map((i) => i.category))];
    return [
      ...IDEA_CATEGORIES,
      ...fromData.filter((c) => !IDEA_CATEGORIES.includes(c as (typeof IDEA_CATEGORIES)[number]))
    ];
  });

  const cities = computed(() => {
    const fromData = [...new Set(ideas.value.map((i) => i.city))];
    return [
      ...IDEA_CITIES,
      ...fromData.filter((c) => !IDEA_CITIES.includes(c as (typeof IDEA_CITIES)[number]))
    ];
  });

  const topAuthors = computed(() => {
    const map = new Map<number, { userId: number; name: string; count: number }>();
    for (const idea of ideas.value) {
      if (idea.status !== 'done') continue;
      const current = map.get(idea.authorUserId) ?? {
        userId: idea.authorUserId,
        name: idea.authorName,
        count: 0
      };
      current.count += 1;
      map.set(idea.authorUserId, current);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  });

  const statusLabel = (status: IdeaStatus) => STATUS_LABELS[status];

  const createIdea = async (input: CreateIdeaInput): Promise<Idea | null> => {
    if (!user.value) return null;
    const title = input.title.trim();
    const description = input.description.trim();
    if (title.length < 3 || description.length < 10) return null;

    try {
      const payload = await $fetch<IdeasApiPayload>('/api/ideas', {
        method: 'POST',
        body: input
      });
      applyPayload(payload);
      if (payload.createdId) {
        return ideas.value.find((idea) => idea.id === payload.createdId) ?? null;
      }
      return ideas.value[0] ?? null;
    } catch {
      return null;
    }
  };

  const voteIdea = async (ideaId: string, direction: 'up' | 'down') => {
    if (!user.value) return;
    try {
      const payload = await $fetch<IdeasApiPayload>(`/api/ideas/${encodeURIComponent(ideaId)}/vote`, {
        method: 'POST',
        body: { direction }
      });
      applyPayload(payload);
    } catch {
      /* ignore */
    }
  };

  const userVoteFor = (ideaId: string) => userVotes.value[ideaId];

  const canDeleteIdea = (idea: Idea) => {
    const currentUser = user.value;
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'hr') return true;
    return idea.authorUserId === currentUser.id;
  };

  const canManageIdeaStatus = () => {
    const currentUser = user.value;
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.role === 'hr';
  };

  const setIdeaStatus = async (
    ideaId: string,
    status: IdeaStatus,
    comment = ''
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!canManageIdeaStatus()) {
      return { ok: false, error: 'Недостаточно прав' };
    }

    const trimmed = comment.trim();
    if (status === 'rejected' && trimmed.length < 3) {
      return { ok: false, error: 'Укажите причину отклонения (минимум 3 символа).' };
    }

    try {
      const payload = await $fetch<IdeasApiPayload>(
        `/api/ideas/${encodeURIComponent(ideaId)}/status`,
        {
          method: 'PATCH',
          body: { status, comment: trimmed }
        }
      );
      applyPayload(payload);
      return { ok: true };
    } catch (error: unknown) {
      const statusMessage =
        error && typeof error === 'object' && 'data' in error
          ? String((error as { data?: { statusMessage?: string } }).data?.statusMessage || '')
          : '';
      return {
        ok: false,
        error: statusMessage || 'Не удалось сменить этап'
      };
    }
  };

  const deleteIdea = async (ideaId: string): Promise<boolean> => {
    const idea = ideas.value.find((item) => item.id === ideaId);
    if (!idea || !canDeleteIdea(idea)) return false;

    try {
      const payload = await $fetch<IdeasApiPayload>(`/api/ideas/${encodeURIComponent(ideaId)}`, {
        method: 'DELETE'
      });
      applyPayload(payload);
      return true;
    } catch {
      return false;
    }
  };

  return {
    ideas,
    hydrated,
    hydrate,
    totalCount,
    myIdeas,
    myCount,
    stats,
    categories,
    cities,
    topAuthors,
    statusLabel,
    createIdea,
    voteIdea,
    userVoteFor,
    canDeleteIdea,
    canManageIdeaStatus,
    setIdeaStatus,
    deleteIdea,
    IDEA_CATEGORIES,
    IDEA_CITIES
  };
}
