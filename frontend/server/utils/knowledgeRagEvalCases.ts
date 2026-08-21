/**
 * Кейсы для проверки RAG на перефразах.
 * expectAny — достаточно попадания любой из статей в топ выдачи.
 * nearMiss — близкая тема, но НЕ должна быть единственным/первым хитом вместо expectAny (мягкая проверка).
 */
export type KnowledgeRagEvalCase = {
  id: string;
  /** Каноническая формулировка (как в статье / близко). */
  canonical: string;
  /** Другими словами — тот же смысл. */
  paraphrases: string[];
  /** Ожидаемые id статей (хотя бы одна в топ-3). */
  expectAny: string[];
  note?: string;
};

export const KNOWLEDGE_RAG_EVAL_CASES: KnowledgeRagEvalCase[] = [
  {
    id: 'vacation-digital',
    canonical: 'регламент ухода в отпуск digital',
    paraphrases: [
      'как в диджитале оформить отпуск',
      'хочу уйти в отпуск какие правила в digital',
      'отпуск в отделе digital что нужно сделать'
    ],
    expectAny: ['kb-21301'],
    note: 'Смысл без точного «регламент ухода»'
  },
  {
    id: 'vacation-seo',
    canonical: 'правила ухода в отпуск SEO',
    paraphrases: ['как сеошнику уйти в отпуск', 'отпуск в SEO SERM какие правила'],
    expectAny: ['kb-24611']
  },
  {
    id: 'dayoff',
    canonical: 'DayOff дейофф',
    paraphrases: ['как взять отгул', 'что такое day off у нас', 'дей офф как оформить'],
    expectAny: ['kb-27877']
  },
  {
    id: 'afina-first',
    canonical: 'Доступы первое знакомство с AFINA CRM',
    paraphrases: ['как зайти в афину первый раз', 'где взять доступы к afina', 'первое знакомство с CRM'],
    expectAny: ['kb-20520']
  },
  {
    id: 'afina-sites',
    canonical: 'указание сайтов клиента в карточке проекта AFINA',
    paraphrases: ['куда в афине писать сайты клиента', 'сайт клиента в карточке проекта'],
    expectAny: ['kb-30878']
  },
  {
    id: 'it-security',
    canonical: 'базовый регламент ИТ-безопасности',
    paraphrases: ['правила ит безопасности', 'что нельзя делать с паролями по регламенту'],
    expectAny: ['kb-22595']
  },
  {
    id: 'contacts',
    canonical: 'контакты',
    paraphrases: ['где найти телефоны и контакты', 'кому звонить справочник'],
    expectAny: ['kb-20409']
  },
  {
    id: 'hiring',
    canonical: 'регламент найма сотрудников VBI',
    paraphrases: ['как у нас нанимают людей', 'процесс найма в компании'],
    expectAny: ['kb-29011']
  },
  {
    id: 'offtopic-weather',
    canonical: 'какая погода завтра в Москве',
    paraphrases: ['расскажи анекдот', 'кто выиграл футбол'],
    expectAny: [],
    note: 'Не должно находить рабочие статьи как «ответ» — пустая выдача или низкая уверенность ок'
  }
];
