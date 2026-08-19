/** Каталог материалов базы знаний (сид для UI). */

export type KnowledgeCardTone = 'violet' | 'lime' | 'ink' | 'plum' | 'doc' | 'placeholder';

export type KnowledgeArticleType = 'regulation' | 'faq';

/** Пока все сиды — всей компании. Отделы появятся на странице редактуры. */
export type KnowledgeVisibility = 'all';

export type KnowledgeCard = {
  id: string;
  category: string;
  title: string;
  description: string;
  author?: string;
  tone: KnowledgeCardTone;
  /** Для tone=doc — пункты превью оглавления */
  previewItems?: string[];
  /** Абзацы статьи на странице материала (plain text) */
  body?: string[];
  /** HTML-контент статьи (приоритет над body) */
  bodyHtml?: string;
  /** Путь в иерархии регламентов (хлебные крошки) */
  breadcrumbs?: string[];
  type?: KnowledgeArticleType;
  publishedAt?: string;
  visibility?: KnowledgeVisibility;
};

export const KNOWLEDGE_TYPE_LABEL: Record<KnowledgeArticleType, string> = {
  regulation: 'Регламент',
  faq: 'FAQ'
};

export const knowledgeBaseCards: KnowledgeCard[] = [];

export const findKnowledgeCard = (id: string) =>
  knowledgeBaseCards.find((card) => card.id === id && card.tone !== 'placeholder');

export const knowledgeArticles = () =>
  knowledgeBaseCards.filter((card) => card.tone !== 'placeholder');

export const knowledgeCategories = () => {
  const set = new Set<string>();
  for (const card of knowledgeArticles()) {
    if (card.category) set.add(card.category);
  }
  return [...set];
};

export const knowledgeAuthors = () => {
  const set = new Set<string>();
  for (const card of knowledgeArticles()) {
    if (card.author) set.add(card.author);
  }
  return [...set];
};
