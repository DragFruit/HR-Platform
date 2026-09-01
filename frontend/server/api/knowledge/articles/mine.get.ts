import { requireVbiSession } from '../../../utils/session';
import {
  articleNeedsManagerReview,
  readKnowledgeArticles,
  type KnowledgeArticle
} from '../../../utils/knowledgeArticlesStore';
import {
  authorUserIdsOf,
  isKnowledgeArticleAuthor,
  listDirectReportEmployees
} from '../../../utils/knowledgeNotifications';
import { findEmployeeForSession } from '../../../utils/employeesStore';

const sortByUpdated = (a: KnowledgeArticle, b: KnowledgeArticle) =>
  b.updatedAt.localeCompare(a.updatedAt);

/** Свои статьи + (для руководителя) статьи прямых подчинённых. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const state = await readKnowledgeArticles();
  const me = await findEmployeeForSession(session);

  const own: KnowledgeArticle[] = [];
  const reports: KnowledgeArticle[] = [];

  const myIds = new Set<number>([session.id]);
  if (session.bitrix_user_id) myIds.add(session.bitrix_user_id);
  if (me) authorUserIdsOf(me).forEach((id) => myIds.add(id));

  const reportIds = new Set<number>();
  const reportNames = new Set<string>();
  if (me) {
    const directs = await listDirectReportEmployees(me);
    for (const emp of directs) {
      authorUserIdsOf(emp).forEach((id) => reportIds.add(id));
      reportNames.add(emp.name.trim().toLowerCase());
    }
  }

  for (const article of state.articles) {
    const isOwn =
      (article.authorUserId != null && myIds.has(article.authorUserId)) ||
      (await isKnowledgeArticleAuthor(session, article));

    if (isOwn) {
      own.push(article);
      continue;
    }

    const isReport =
      (article.authorUserId != null && reportIds.has(article.authorUserId)) ||
      reportNames.has(article.authorName.trim().toLowerCase());

    if (isReport) {
      reports.push(article);
    }
  }

  const reviewQueue = [...reports, ...own]
    .filter((a) => articleNeedsManagerReview(a))
    .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)
    .sort(sortByUpdated);

  return {
    own: own.sort(sortByUpdated),
    reports: reports.sort(sortByUpdated),
    reviewQueue,
    hasDirectReports: reportIds.size > 0 || reportNames.size > 0
  };
});
