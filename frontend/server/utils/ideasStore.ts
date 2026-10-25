import { isDbEnabled } from '../db/client';
import type { KeyedListWriteContext } from '../db/repositories/keyedList';
import { createJsonStateRepo, createStateGate, type KeyedStateDef, type RawState } from '../db/repositories/keyedState';
import { IDEAS_STATE_DEF, ideasJsonIo } from '../ideas/domain';
import { normalizeIdeaCategory, type Idea } from '../../app/composables/useIdeasBank';

export type IdeaVoteDirection = 'up' | 'down';
export type IdeaVotesByUser = Record<string, IdeaVoteDirection>;

export type IdeasStoreState = {
  ideas: Idea[];
  nextIdeaId: number;
  /** userId → ideaId → vote */
  votesByUserId: Record<string, IdeaVotesByUser>;
};

export const defaultIdeasState = (): IdeasStoreState => ({
  ideas: [],
  nextIdeaId: 1,
  votesByUserId: {}
});

const normalizeIdea = (raw: Partial<Idea>): Idea | null => {
  if (!raw || typeof raw.id !== 'string' || !raw.id.trim()) return null;
  const authorUserId = Number(raw.authorUserId);
  if (!Number.isFinite(authorUserId) || authorUserId <= 0) return null;
  const status = raw.status;
  if (
    status !== 'review' &&
    status !== 'implementation' &&
    status !== 'done' &&
    status !== 'rejected'
  ) {
    return null;
  }
  return {
    id: raw.id.trim(),
    authorUserId,
    authorName: String(raw.authorName || '').trim() || 'Сотрудник',
    title: String(raw.title || '').trim(),
    description: String(raw.description || '').trim(),
    category: normalizeIdeaCategory(String(raw.category || '')),
    city: String(raw.city || '').trim() || 'Москва',
    status,
    createdAt: String(raw.createdAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    votesUp: typeof raw.votesUp === 'number' && raw.votesUp >= 0 ? raw.votesUp : 0,
    votesDown: typeof raw.votesDown === 'number' && raw.votesDown >= 0 ? raw.votesDown : 0,
    ...(raw.attachmentName ? { attachmentName: String(raw.attachmentName) } : {}),
    attachmentStored: Boolean(raw.attachmentStored),
    ...(raw.statusComment ? { statusComment: String(raw.statusComment) } : {}),
    ...(raw.statusChangedAt ? { statusChangedAt: String(raw.statusChangedAt) } : {})
  };
};

export function normalizeIdeasStoreState(raw: Partial<IdeasStoreState>): IdeasStoreState {
  const base = defaultIdeasState();
  const ideas = Array.isArray(raw.ideas)
    ? raw.ideas.map((item) => normalizeIdea(item as Partial<Idea>)).filter((item): item is Idea => Boolean(item))
    : [];
  const votesByUserId: Record<string, IdeaVotesByUser> = {};
  if (raw.votesByUserId && typeof raw.votesByUserId === 'object') {
    for (const [userId, votes] of Object.entries(raw.votesByUserId)) {
      if (!votes || typeof votes !== 'object') continue;
      const cleaned: IdeaVotesByUser = {};
      for (const [ideaId, direction] of Object.entries(votes)) {
        if (direction === 'up' || direction === 'down') cleaned[ideaId] = direction;
      }
      votesByUserId[userId] = cleaned;
    }
  }
  return {
    ideas,
    nextIdeaId:
      typeof raw.nextIdeaId === 'number' && raw.nextIdeaId >= 1 ? raw.nextIdeaId : base.nextIdeaId,
    votesByUserId
  };
}

/**
 * Этап 7: DB_IDEAS=1 и задан DATABASE_URL → Postgres (схема ideas), иначе server/data/ideas.json.
 * Флаг стоит только на стейдже; на проде DATABASE_URL есть, но флага нет → JSON.
 * Вложения остаются на диске (server/data/idea-attachments/<id>/). Публичный API не менялся.
 */
export function ideasDbFlag(): boolean {
  return String(process.env.DB_IDEAS || '').trim() === '1' && isDbEnabled();
}

export const IDEAS_STATE_FULL_DEF: KeyedStateDef = {
  ...IDEAS_STATE_DEF,
  normalize: (raw) => normalizeIdeasStoreState(raw as Partial<IdeasStoreState>)
};

const gate = createStateGate({
  label: 'банк идей',
  logTag: 'ideas',
  flag: ideasDbFlag,
  def: IDEAS_STATE_FULL_DEF,
  makeJson: () => createJsonStateRepo(ideasJsonIo())
});

/** Вызывает плагин db-migrate после разового импорта ideas.json. */
export const setIdeasPgReady = gate.setReady;

export async function getIdeasBackend(): Promise<'json' | 'postgres'> {
  return (await gate.repo()).backend;
}

async function withAttachmentFlags(state: IdeasStoreState): Promise<IdeasStoreState> {
  const { ideaAttachmentExists } = await import('./ideaAttachments');
  for (const idea of state.ideas) {
    if (idea.attachmentName && !idea.attachmentStored) {
      idea.attachmentStored = await ideaAttachmentExists(idea.id);
    }
  }
  return state;
}

export async function readIdeas(): Promise<IdeasStoreState> {
  const raw = await (await gate.repo()).read();
  return withAttachmentFlags(normalizeIdeasStoreState(raw as Partial<IdeasStoreState>));
}

export async function writeIdeas(state: IdeasStoreState, ctx: KeyedListWriteContext = {}): Promise<IdeasStoreState> {
  return mutateIdeas(() => state, ctx);
}

/**
 * Сериализует все правки идей — без гонок при параллельных POST/PATCH (очередь репозитория;
 * в Postgres ещё и транзакция под advisory lock). ctx — кто и почему (аудит).
 */
export async function mutateIdeas(
  mutator: (state: IdeasStoreState) => IdeasStoreState | Promise<IdeasStoreState>,
  ctx: KeyedListWriteContext = {}
): Promise<IdeasStoreState> {
  return (await gate.repo()).mutate(async (raw) => {
    const current = await withAttachmentFlags(normalizeIdeasStoreState(raw as Partial<IdeasStoreState>));
    const next = normalizeIdeasStoreState(await mutator(current));
    return { next: next as unknown as RawState, result: next };
  }, ctx);
}

export function votesForUser(state: IdeasStoreState, userId: number): IdeaVotesByUser {
  return { ...(state.votesByUserId[String(userId)] || {}) };
}
