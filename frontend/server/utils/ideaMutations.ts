import type { SessionUser } from './credentials';
import type { CreateIdeaInput, Idea, IdeaStatus } from '../../app/composables/useIdeasBank';
import { createIdeaSubmittedNotification } from './adminNotificationsStore';
import { notifyIdeaAuthorStatusChanged } from './ideaNotifications';
import {
  mutateIdeas,
  votesForUser,
  type IdeaVoteDirection,
  type IdeasStoreState
} from './ideasStore';

const cloneState = (state: IdeasStoreState): IdeasStoreState =>
  JSON.parse(JSON.stringify(state)) as IdeasStoreState;

/** Убрать HTML из пользовательского текста (идеи рендерятся как текст, но не храним разметку). */
function stripUserHtml(value: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const isAdminOrHr = (session: SessionUser) =>
  session.role === 'admin' || session.role === 'hr';

export type IdeasClientPayload = {
  ideas: Idea[];
  myVotes: Record<string, IdeaVoteDirection>;
  createdId?: string;
};

export function toClientPayload(
  state: IdeasStoreState,
  userId: number,
  extra?: { createdId?: string }
): IdeasClientPayload {
  return {
    ideas: state.ideas,
    myVotes: votesForUser(state, userId),
    ...(extra?.createdId ? { createdId: extra.createdId } : {})
  };
}

export async function createIdeaForUser(
  session: SessionUser,
  input: CreateIdeaInput
): Promise<IdeasClientPayload> {
  const title = stripUserHtml(String(input.title || ''));
  const description = stripUserHtml(String(input.description || ''));
  if (title.length < 3 || description.length < 10) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Заполните заголовок (от 3 символов) и описание (от 10 символов).'
    });
  }

  let createdId = '';
  let createdTitle = '';

  const state = await mutateIdeas((current) => {
    const next = cloneState(current);
    const idea: Idea = {
      id: `idea-${next.nextIdeaId}`,
      authorUserId: session.id,
      authorName: session.name,
      title,
      description,
      category: String(input.category || '').trim() || 'Другое',
      city: String(input.city || '').trim() || 'Москва',
      status: 'review',
      createdAt: new Date().toISOString().slice(0, 10),
      votesUp: 0,
      votesDown: 0,
      ...(input.attachmentName ? { attachmentName: String(input.attachmentName).trim() } : {})
    };
    next.nextIdeaId += 1;
    next.ideas = [idea, ...next.ideas];
    createdId = idea.id;
    createdTitle = idea.title;
    return next;
  });

  if (createdId) {
    await createIdeaSubmittedNotification({
      employee_id: session.id,
      employee_name: session.name,
      idea_id: createdId,
      idea_title: createdTitle
    }).catch(() => {});
  }

  return toClientPayload(state, session.id, { createdId });
}

export async function voteIdeaForUser(
  session: SessionUser,
  ideaId: string,
  direction: IdeaVoteDirection
): Promise<IdeasClientPayload> {
  const id = String(ideaId || '').trim();
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен id идеи' });
  }
  if (direction !== 'up' && direction !== 'down') {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный голос' });
  }

  const userKey = String(session.id);

  const state = await mutateIdeas((current) => {
    const next = cloneState(current);
    const idea = next.ideas.find((item) => item.id === id);
    if (!idea) {
      throw createError({ statusCode: 404, statusMessage: 'Идея не найдена' });
    }

    const userVotes = { ...(next.votesByUserId[userKey] || {}) };
    const previous = userVotes[id];

    if (previous === 'up') idea.votesUp = Math.max(0, idea.votesUp - 1);
    if (previous === 'down') idea.votesDown = Math.max(0, idea.votesDown - 1);

    if (previous === direction) {
      delete userVotes[id];
    } else {
      if (direction === 'up') idea.votesUp += 1;
      else idea.votesDown += 1;
      userVotes[id] = direction;
    }

    next.votesByUserId[userKey] = userVotes;
    return next;
  });

  return toClientPayload(state, session.id);
}

export async function setIdeaStatusForUser(
  session: SessionUser,
  ideaId: string,
  status: IdeaStatus,
  comment = ''
): Promise<IdeasClientPayload> {
  if (!isAdminOrHr(session)) {
    throw createError({ statusCode: 403, statusMessage: 'Только admin/HR' });
  }

  const id = String(ideaId || '').trim();
  const trimmed = String(comment || '').trim();
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен id идеи' });
  }
  if (
    status !== 'review' &&
    status !== 'implementation' &&
    status !== 'done' &&
    status !== 'rejected'
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный status' });
  }
  if (status === 'rejected' && trimmed.length < 3) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Укажите причину отклонения (минимум 3 символа).'
    });
  }

  let previousStatus: IdeaStatus | null = null;
  let notifiedIdea: Idea | null = null;

  const state = await mutateIdeas((current) => {
    const next = cloneState(current);
    const idea = next.ideas.find((item) => item.id === id);
    if (!idea) {
      throw createError({ statusCode: 404, statusMessage: 'Идея не найдена' });
    }
    previousStatus = idea.status;
    if (previousStatus === status) {
      notifiedIdea = null;
      return next;
    }
    idea.status = status;
    idea.statusComment = trimmed || undefined;
    idea.statusChangedAt = new Date().toISOString();
    notifiedIdea = { ...idea };
    return next;
  });

  if (notifiedIdea && previousStatus && previousStatus !== status) {
    await notifyIdeaAuthorStatusChanged({
      author_user_id: notifiedIdea.authorUserId,
      author_name: notifiedIdea.authorName,
      idea_id: notifiedIdea.id,
      idea_title: notifiedIdea.title,
      status,
      comment: trimmed || undefined
    }).catch(() => {});
  }

  return toClientPayload(state, session.id);
}

export async function deleteIdeaForUser(
  session: SessionUser,
  ideaId: string
): Promise<IdeasClientPayload> {
  const id = String(ideaId || '').trim();
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен id идеи' });
  }

  const state = await mutateIdeas((current) => {
    const next = cloneState(current);
    const idea = next.ideas.find((item) => item.id === id);
    if (!idea) {
      throw createError({ statusCode: 404, statusMessage: 'Идея не найдена' });
    }
    const canDelete = isAdminOrHr(session) || idea.authorUserId === session.id;
    if (!canDelete) {
      throw createError({ statusCode: 403, statusMessage: 'Недостаточно прав' });
    }

    next.ideas = next.ideas.filter((item) => item.id !== id);
    for (const userKey of Object.keys(next.votesByUserId)) {
      const votes = next.votesByUserId[userKey];
      if (!votes) continue;
      if (id in votes) {
        delete votes[id];
      }
    }
    return next;
  });

  return toClientPayload(state, session.id);
}
