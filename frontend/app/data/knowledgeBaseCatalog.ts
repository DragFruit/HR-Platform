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

export const knowledgeBaseCards: KnowledgeCard[] = [
  {
    id: 'kb-30878',
    category: 'CRM',
    breadcrumbs: ['Общие по компании', 'AFINA CRM', 'Регламенты'],
    title: 'Указание сайтов клиента в карточке проекта AFINA',
    description:
      'Как правильно заполнить сайты клиента в карточке проекта CRM — ответственные, порядок действий и поля.',
    author: 'Операционный отдел',
    tone: 'doc',
    type: 'regulation',
    publishedAt: '2025-01-17',
    visibility: 'all',
    bodyHtml: `
<p><strong>Ответственные за внесение сайта в карточку проекта:</strong></p>
<p><em>МОП (менеджер отдела продаж)</em> — на этапе создания проекта в AFINA CRM/продажи новой услуги к созданному проекту.<br>
<em>Тех. специалист проекта</em> — поддержание актуальных сайтов в карточке проекта (добавление новых сайтов или изменение текущих).</p>

<p>Для того, чтобы указать сайт клиента по услугам проекта, нужно:</p>

<p><strong>1. Провалиться в карточку проекта (id)</strong><br>
пример: <a href="https://crm-afina.ru/projects/show/941/main/" target="_blank">https://crm-afina.ru/projects/show/941/main/</a></p>

<p><strong>2. Сверху из активных услуг выбрать необходимую карточку отдела</strong> (CPC / SMM / SEO / SERM / DEV).</p>
<p>примеры карточек проекта по отделам:<br>
<a href="https://crm-afina.ru/projects/show/941/cpc/" target="_blank">https://crm-afina.ru/projects/show/941/cpc/</a><br>
<a href="https://crm-afina.ru/projects/show/941/smm/" target="_blank">https://crm-afina.ru/projects/show/941/smm/</a>&nbsp; (если у клиента совсем нет сайта, то указать продвигаемую соц сеть ссылкой)<br>
<a href="https://crm-afina.ru/projects/show/734/seo/" target="_blank">https://crm-afina.ru/projects/show/734/seo/</a><br>
<a href="https://crm-afina.ru/projects/show/807/serm/" target="_blank">https://crm-afina.ru/projects/show/807/serm/</a><br>
<a href="https://crm-afina.ru/projects/show/734/dev/" target="_blank">https://crm-afina.ru/projects/show/734/dev/</a></p>

<figure class="kb-figure">
  <img src="/knowledge/article-30878/screen-1.png" alt="Карточка проекта в AFINA — выбор отдела и общие поля">
  <figcaption>Карточка проекта: общие данные и выбор отдела услуги</figcaption>
</figure>

<p><strong>3. В выбранной карточке отдела</strong> (CPC / SMM / SEO / SERM / DEV) <strong>заполнить поля сайта:</strong></p>
<ul>
  <li>Сайты (указать основной сайт по выбранной услуге);</li>
  <li>Другие сайты (для CPC) (указать другие сайты клиента по выбранной услуге через точку запятую site.ru; site1.com; …).</li>
</ul>

<figure class="kb-figure">
  <img src="/knowledge/article-30878/screen-2.png" alt="Поля «Сайты» и «Другие сайты» в карточке отдела CPC">
  <figcaption>Карточка отдела CPC: поля «Сайты» и «Другие сайты»</figcaption>
</figure>
`
  },
  {
    id: 'kb-more',
    category: '',
    title: '+ новые материалы',
    description: 'Каждый месяц добавляем гайды по процессам и ответы на частые вопросы команды.',
    tone: 'placeholder'
  }
];

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
