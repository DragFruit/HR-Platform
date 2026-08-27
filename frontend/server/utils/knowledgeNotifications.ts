import { notifyBitrixSystemUser } from './bitrixVacationNotify';
import {
  employeeNotificationUserId,
  findEmployeeByName,
  findEmployeeByPlatformUserId,
  findEmployeeForSession,
  readEmployees,
  type ServerEmployee
} from './employeesStore';
import { createUserNotification } from './userNotificationsStore';
import type { SessionUser } from './credentials';
import type { KnowledgeArticle } from './knowledgeArticlesStore';

export type KnowledgeNotifyEvent =
  | 'submitted'
  | 'accepted'
  | 'revision_requested'
  | 'rejected';

const knowledgeUrl = (): string | null => {
  const candidates = [
    String(process.env.APP_PUBLIC_URL || '').trim(),
    String(process.env.BITRIX_REDIRECT_URI || '').trim()
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      return `${new URL(raw).origin}/knowledge`;
    } catch {
      /* next */
    }
  }
  return null;
};

const bitrixUserIdOf = (employee: ServerEmployee): number | null => {
  const id = employee.bitrix_user_id ?? employee.platform_user_id ?? employee.id;
  return typeof id === 'number' && id > 0 ? id : null;
};

const nameKeys = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** Прямой руководитель автора из справочника (поле manager = ФИО). */
export async function findManagerForAuthor(
  author: ServerEmployee
): Promise<ServerEmployee | null> {
  const managerName = author.manager?.trim();
  if (!managerName) return null;
  const byExact = await findEmployeeByName(managerName);
  if (byExact) return byExact;

  const list = await readEmployees();
  const key = nameKeys(managerName);
  return (
    list.find((emp) => nameKeys(emp.name) === key) ||
    list.find((emp) => nameKeys(emp.name).includes(key) || key.includes(nameKeys(emp.name))) ||
    null
  );
}

export async function resolveAuthorEmployee(
  article: KnowledgeArticle,
  sessionFallback?: SessionUser | null
): Promise<ServerEmployee | null> {
  if (article.authorUserId) {
    const byPlatform = await findEmployeeByPlatformUserId(article.authorUserId);
    if (byPlatform) return byPlatform;
    const list = await readEmployees();
    const byBitrix = list.find(
      (e) => e.bitrix_user_id === article.authorUserId || e.id === article.authorUserId
    );
    if (byBitrix) return byBitrix;
  }
  if (article.authorName.trim()) {
    const byName = await findEmployeeByName(article.authorName.trim());
    if (byName) return byName;
  }
  if (sessionFallback) return findEmployeeForSession(sessionFallback);
  return null;
}

/** Может ли сессия модерировать статью (прямой руководитель автора / admin / hr). */
export async function canModerateKnowledgeArticle(
  session: SessionUser,
  article: KnowledgeArticle
): Promise<boolean> {
  if (session.role === 'admin' || session.role === 'hr') return true;

  const author = await resolveAuthorEmployee(article);
  if (!author) return false;

  const manager = await findManagerForAuthor(author);
  if (!manager) return false;

  const sessionEmp = await findEmployeeForSession(session);
  if (sessionEmp) {
    if (sessionEmp.id === manager.id) return true;
    if (
      sessionEmp.platform_user_id &&
      manager.platform_user_id &&
      sessionEmp.platform_user_id === manager.platform_user_id
    ) {
      return true;
    }
    if (
      sessionEmp.bitrix_user_id &&
      manager.bitrix_user_id &&
      sessionEmp.bitrix_user_id === manager.bitrix_user_id
    ) {
      return true;
    }
    if (nameKeys(sessionEmp.name) === nameKeys(manager.name)) return true;
  }

  if (nameKeys(session.name) === nameKeys(manager.name)) return true;
  if (session.id === manager.platform_user_id || session.id === manager.bitrix_user_id) {
    return true;
  }
  return false;
}

/** Автор статьи для текущей сессии. */
export async function isKnowledgeArticleAuthor(
  session: SessionUser,
  article: KnowledgeArticle
): Promise<boolean> {
  if (article.authorUserId && article.authorUserId === session.id) return true;
  if (session.bitrix_user_id && article.authorUserId === session.bitrix_user_id) return true;

  const emp = await findEmployeeForSession(session);
  if (!emp) {
    return Boolean(article.authorName && nameKeys(article.authorName) === nameKeys(session.name));
  }
  if (article.authorUserId) {
    if (emp.platform_user_id === article.authorUserId) return true;
    if (emp.bitrix_user_id === article.authorUserId) return true;
    if (emp.id === article.authorUserId) return true;
  }
  return nameKeys(emp.name) === nameKeys(article.authorName);
}

const MESSAGES: Record<KnowledgeNotifyEvent, (opts: { reason?: string; title?: string }) => string> = {
  submitted: () =>
    'Ваш сотрудник подготовил материал для статьи в Базу знаний. Вам нужно проверить его на экспертность и полезность',
  accepted: () => 'Поздравляем! Ваша статья прошла проверку и опубликована в Базе знаний.',
  revision_requested: () =>
    'К сожалению, подготовленный материал не прошел проверку и вернулся обратно для редактирования.',
  rejected: ({ reason }) =>
    `Материал отклонён и закрыт. Причина: ${reason?.trim() || 'не указана'}`
};

const KIND_BY_EVENT: Record<
  KnowledgeNotifyEvent,
  | 'knowledge_article_submitted'
  | 'knowledge_article_accepted'
  | 'knowledge_article_revision'
  | 'knowledge_article_rejected'
> = {
  submitted: 'knowledge_article_submitted',
  accepted: 'knowledge_article_accepted',
  revision_requested: 'knowledge_article_revision',
  rejected: 'knowledge_article_rejected'
};

async function notifyRecipient(input: {
  event: KnowledgeNotifyEvent;
  recipient: ServerEmployee;
  article: KnowledgeArticle;
  reason?: string;
}): Promise<void> {
  const recipientUserId = employeeNotificationUserId(input.recipient);
  if (!recipientUserId) return;

  const message = MESSAGES[input.event]({
    reason: input.reason,
    title: input.article.title
  });

  await createUserNotification({
    kind: KIND_BY_EVENT[input.event],
    recipient_user_id: recipientUserId,
    employee_name: input.article.authorName,
    idea_title: input.article.title,
    idea_id: input.article.id,
    status_comment: input.reason?.trim() || undefined,
    stage_label:
      input.event === 'submitted'
        ? 'На проверке'
        : input.event === 'accepted'
          ? 'Опубликовано'
          : input.event === 'revision_requested'
            ? 'На доработку'
            : 'Отклонено'
  });

  const bitrixUserId = bitrixUserIdOf(input.recipient);
  const url = knowledgeUrl();
  if (!bitrixUserId || !url) return;

  const bbLines = [
    message,
    '',
    `Статья: «${input.article.title}»`,
    '',
    `[URL=${url}]Открыть базу знаний в Vibe[/URL]`
  ];

  await notifyBitrixSystemUser({
    bitrixUserId,
    message: bbLines.join('\n'),
    tag: `VBI_HR_KB_${input.article.id}_${input.event}`,
    subTag: `VBI_HR|kb|${input.article.id}|${input.event}`,
    logLabel: `kb ${input.article.id} event=${input.event}`
  });
}

export async function notifyKnowledgeArticleEvent(input: {
  event: KnowledgeNotifyEvent;
  article: KnowledgeArticle;
  reason?: string;
  /** Для submitted — сессия автора (если author ещё не в справочнике). */
  authorSession?: SessionUser | null;
}): Promise<{ ok: true; warned?: string }> {
  const author = await resolveAuthorEmployee(input.article, input.authorSession ?? null);

  if (input.event === 'submitted') {
    if (!author) {
      console.warn('[kb-notify] author not found, skip manager notify', input.article.id);
      return { ok: true, warned: 'author_missing' };
    }
    const manager = await findManagerForAuthor(author);
    if (!manager) {
      console.warn('[kb-notify] manager missing for', author.name, input.article.id);
      return { ok: true, warned: 'manager_missing' };
    }
    await notifyRecipient({
      event: 'submitted',
      recipient: manager,
      article: input.article
    });
    return { ok: true };
  }

  if (!author) {
    console.warn('[kb-notify] author missing for', input.event, input.article.id);
    return { ok: true, warned: 'author_missing' };
  }

  await notifyRecipient({
    event: input.event,
    recipient: author,
    article: input.article,
    reason: input.reason
  });
  return { ok: true };
}

/** Прямые подчинённые по ФИО руководителя (как в справочнике). */
export async function listDirectReportEmployees(
  manager: ServerEmployee
): Promise<ServerEmployee[]> {
  const list = await readEmployees();
  const key = nameKeys(manager.name);
  return list.filter(
    (emp) => nameKeys(emp.manager) === key && nameKeys(emp.name) !== key
  );
}

export function authorUserIdsOf(employee: ServerEmployee): number[] {
  const ids = new Set<number>();
  if (employee.platform_user_id && employee.platform_user_id > 0) {
    ids.add(employee.platform_user_id);
  }
  if (employee.bitrix_user_id && employee.bitrix_user_id > 0) {
    ids.add(employee.bitrix_user_id);
  }
  if (employee.id > 0) ids.add(employee.id);
  return [...ids];
}
