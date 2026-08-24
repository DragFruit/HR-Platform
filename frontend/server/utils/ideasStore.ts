import { readFile, mkdir } from 'node:fs/promises';
import { writeJsonAtomic } from './atomicJson';
import { dirname, join } from 'node:path';
import { normalizeIdeaCategory, type Idea } from '../../app/composables/useIdeasBank';

export type IdeaVoteDirection = 'up' | 'down';
export type IdeaVotesByUser = Record<string, IdeaVoteDirection>;

export type IdeasStoreState = {
  ideas: Idea[];
  nextIdeaId: number;
  /** userId → ideaId → vote */
  votesByUserId: Record<string, IdeaVotesByUser>;
};

const DATA_FILE = join(process.cwd(), 'server/data/ideas.json');

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

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeJsonAtomic(DATA_FILE, defaultIdeasState());
  }
}

export async function readIdeas(): Promise<IdeasStoreState> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  const state = normalizeIdeasStoreState(JSON.parse(raw) as Partial<IdeasStoreState>);
  const { ideaAttachmentExists } = await import('./ideaAttachments');
  for (const idea of state.ideas) {
    if (idea.attachmentName && !idea.attachmentStored) {
      idea.attachmentStored = await ideaAttachmentExists(idea.id);
    }
  }
  return state;
}

export async function writeIdeas(state: IdeasStoreState): Promise<IdeasStoreState> {
  await ensureFile();
  const normalized = normalizeIdeasStoreState(state);
  await writeJsonAtomic(DATA_FILE, normalized);
  return normalized;
}

/** Сериализует все правки идей — без гонок при параллельных POST/PATCH. */
let mutationQueue: Promise<unknown> = Promise.resolve();

export async function mutateIdeas(
  mutator: (state: IdeasStoreState) => IdeasStoreState | Promise<IdeasStoreState>
): Promise<IdeasStoreState> {
  const run = mutationQueue.then(async () => {
    const current = await readIdeas();
    const next = await mutator(current);
    return writeIdeas(next);
  });
  mutationQueue = run.catch(() => {});
  return run;
}

export function votesForUser(state: IdeasStoreState, userId: number): IdeaVotesByUser {
  return { ...(state.votesByUserId[String(userId)] || {}) };
}
