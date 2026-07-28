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
  'Благополучие',
  'Другое'
] as const;

export const IDEA_CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Удалённо'] as const;

const STORAGE_KEY = 'vbi-ideas-bank-v2';
const VOTES_KEY = 'vbi-ideas-votes-v1';

type IdeasStore = { ideas: Idea[] };
type VotesStore = Record<string, 'up' | 'down'>;

const STATUS_LABELS: Record<IdeaStatus, string> = {
  review: 'На рассмотрении',
  implementation: 'Реализация',
  done: 'Реализовано',
  rejected: 'Отклонено'
};

const seedIdeas = (): Idea[] => [
  {
    id: 'idea-1',
    authorUserId: 100,
    authorName: 'Иванова А.',
    title: 'Оптимизация процессов через Six Sigma',
    description:
      'Предлагаю внедрить короткий цикл улучшений для повторяющихся задач отдела — с еженедельным ревью узких мест.',
    category: 'Процессы',
    city: 'Москва',
    status: 'review',
    createdAt: '2026-07-10',
    votesUp: 12,
    votesDown: 1
  },
  {
    id: 'idea-2',
    authorUserId: 200,
    authorName: 'Петров К.',
    title: 'Зона отдыха с кофемашиной',
    description: 'Переставить переговорку у окна и добавить уютную зону с кофе, чаем и мягким светом.',
    category: 'Офисная среда',
    city: 'Санкт-Петербург',
    status: 'implementation',
    createdAt: '2026-06-18',
    votesUp: 34,
    votesDown: 2
  },
  {
    id: 'idea-3',
    authorUserId: 300,
    authorName: 'Сидорова М.',
    title: 'Еженедельный демо-день команд',
    description: 'Короткие 15-минутные демо по пятницам — видимость результатов между отделами без лишних встреч.',
    category: 'Культура',
    city: 'Москва',
    status: 'done',
    createdAt: '2026-05-02',
    votesUp: 51,
    votesDown: 0
  },
  {
    id: 'idea-4',
    authorUserId: 9100,
    authorName: 'Юбилеев Тест',
    title: 'Шаблоны заявок в HR-боте',
    description: 'Частые вопросы (справки, Day Off) — кнопками в боте, без поиска по чатам.',
    category: 'Процессы',
    city: 'Москва',
    status: 'review',
    createdAt: '2026-07-20',
    votesUp: 7,
    votesDown: 0
  },
  {
    id: 'idea-5',
    authorUserId: 400,
    authorName: 'Козлов Д.',
    title: 'Подсветка свободных переговорок',
    description: 'Табло у входа: какая комната свободна в ближайший час — меньше беготни по этажу.',
    category: 'Офисная среда',
    city: 'Москва',
    status: 'rejected',
    createdAt: '2026-04-11',
    votesUp: 3,
    votesDown: 8
  },
  {
    id: 'idea-6',
    authorUserId: 500,
    authorName: 'Новикова Е.',
    title: 'Единый календарь дедлайнов проектов',
    description: 'Сводный вид по командам в одном месте — чтобы видеть пересечения и «узкие» недели заранее.',
    category: 'IT и инструменты',
    city: 'Казань',
    status: 'review',
    createdAt: '2026-07-05',
    votesUp: 19,
    votesDown: 1
  },
  {
    id: 'idea-7',
    authorUserId: 600,
    authorName: 'Орлов П.',
    title: 'Пятничные безмитинговые слоты',
    description: 'Забронировать 14:00–17:00 по пятницам как время без созвонов — для глубокой работы.',
    category: 'Культура',
    city: 'Удалённо',
    status: 'review',
    createdAt: '2026-06-28',
    votesUp: 42,
    votesDown: 3
  },
  {
    id: 'idea-8',
    authorUserId: 700,
    authorName: 'Федорова Л.',
    title: 'Корпоративный сад на крыше',
    description: 'Небольшие грядки и зона отдыха на крыше — для перезагрузки и неформального общения.',
    category: 'Благополучие',
    city: 'Санкт-Петербург',
    status: 'implementation',
    createdAt: '2026-05-20',
    votesUp: 28,
    votesDown: 4
  }
];

const readStore = (): IdeasStore => {
  if (!import.meta.client) return { ideas: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ideas: [] };
    const parsed = JSON.parse(raw) as Partial<IdeasStore>;
    const ideas = Array.isArray(parsed.ideas) ? parsed.ideas : [];
    return {
      ideas: ideas.map((idea) => ({
        ...idea,
        votesDown: typeof idea.votesDown === 'number' ? idea.votesDown : 0
      }))
    };
  } catch {
    return { ideas: [] };
  }
};

const writeStore = (data: IdeasStore) => {
  if (!import.meta.client) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const readVotes = (userId: number): VotesStore => {
  if (!import.meta.client) return {};
  try {
    const raw = localStorage.getItem(`${VOTES_KEY}-${userId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as VotesStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeVotes = (userId: number, votes: VotesStore) => {
  if (!import.meta.client) return;
  localStorage.setItem(`${VOTES_KEY}-${userId}`, JSON.stringify(votes));
};

export function useIdeasBank() {
  const { user } = useAuth();
  const ideas = useState<Idea[]>('vbi-ideas-bank', () => []);
  const userVotes = useState<VotesStore>('vbi-ideas-user-votes', () => ({}));
  const hydrated = useState('vbi-ideas-bank-hydrated', () => false);

  const hydrate = () => {
    if (!import.meta.client) return;
    const store = readStore();
    if (!store.ideas.length) {
      const seeded = seedIdeas();
      writeStore({ ideas: seeded });
      ideas.value = seeded;
    } else {
      ideas.value = store.ideas;
    }
    if (user.value?.id) {
      userVotes.value = readVotes(user.value.id);
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
    return [...IDEA_CATEGORIES, ...fromData.filter((c) => !IDEA_CATEGORIES.includes(c as (typeof IDEA_CATEGORIES)[number]))];
  });

  const cities = computed(() => {
    const fromData = [...new Set(ideas.value.map((i) => i.city))];
    return [...IDEA_CITIES, ...fromData.filter((c) => !IDEA_CITIES.includes(c as (typeof IDEA_CITIES)[number]))];
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

  const createIdea = (input: CreateIdeaInput): Idea | null => {
    const currentUser = user.value;
    if (!currentUser) return null;

    const title = input.title.trim();
    const description = input.description.trim();
    if (title.length < 3 || description.length < 10) return null;

    const idea: Idea = {
      id: `idea-${Date.now()}`,
      authorUserId: currentUser.id,
      authorName: currentUser.name,
      title,
      description,
      category: input.category,
      city: input.city,
      status: 'review',
      createdAt: new Date().toISOString().slice(0, 10),
      votesUp: 0,
      votesDown: 0,
      ...(input.attachmentName ? { attachmentName: input.attachmentName } : {})
    };

    const next = [idea, ...ideas.value];
    ideas.value = next;
    writeStore({ ideas: next });

    if (import.meta.client) {
      $fetch('/api/ideas/notify', {
        method: 'POST',
        body: {
          idea_id: idea.id,
          idea_title: idea.title,
          employee_id: currentUser.id,
          employee_name: currentUser.name
        }
      }).catch(() => {});
    }

    return idea;
  };

  const voteIdea = (ideaId: string, direction: 'up' | 'down') => {
    const currentUser = user.value;
    if (!currentUser) return;

    const previous = userVotes.value[ideaId];
    const nextVotes = { ...userVotes.value };

    const nextIdeas = ideas.value.map((idea) => {
      if (idea.id !== ideaId) return idea;
      let votesUp = idea.votesUp;
      let votesDown = idea.votesDown;

      if (previous === 'up') votesUp = Math.max(0, votesUp - 1);
      if (previous === 'down') votesDown = Math.max(0, votesDown - 1);

      if (previous === direction) {
        delete nextVotes[ideaId];
        return { ...idea, votesUp, votesDown };
      }

      if (direction === 'up') votesUp += 1;
      else votesDown += 1;

      nextVotes[ideaId] = direction;
      return { ...idea, votesUp, votesDown };
    });

    ideas.value = nextIdeas;
    userVotes.value = nextVotes;
    writeStore({ ideas: nextIdeas });
    writeVotes(currentUser.id, nextVotes);
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

  const setIdeaStatus = (
    ideaId: string,
    status: IdeaStatus,
    comment = ''
  ): { ok: true } | { ok: false; error: string } => {
    if (!canManageIdeaStatus()) {
      return { ok: false, error: 'Недостаточно прав' };
    }
    const idea = ideas.value.find((item) => item.id === ideaId);
    if (!idea) return { ok: false, error: 'Идея не найдена' };

    const trimmed = comment.trim();
    if (status === 'rejected' && trimmed.length < 3) {
      return { ok: false, error: 'Укажите причину отклонения (минимум 3 символа).' };
    }

    const previousStatus = idea.status;
    if (previousStatus === status) {
      return { ok: true };
    }

    const next = ideas.value.map((item) =>
      item.id === ideaId
        ? {
            ...item,
            status,
            statusComment: trimmed || undefined,
            statusChangedAt: new Date().toISOString()
          }
        : item
    );
    ideas.value = next;
    writeStore({ ideas: next });

    if (import.meta.client) {
      $fetch('/api/ideas/status-notify', {
        method: 'POST',
        body: {
          idea_id: idea.id,
          idea_title: idea.title,
          author_user_id: idea.authorUserId,
          author_name: idea.authorName,
          status,
          previous_status: previousStatus,
          comment: trimmed || undefined
        }
      }).catch(() => {});
    }

    return { ok: true };
  };

  const deleteIdea = (ideaId: string): boolean => {
    const idea = ideas.value.find((item) => item.id === ideaId);
    if (!idea || !canDeleteIdea(idea)) return false;

    const next = ideas.value.filter((item) => item.id !== ideaId);
    ideas.value = next;
    writeStore({ ideas: next });
    return true;
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
