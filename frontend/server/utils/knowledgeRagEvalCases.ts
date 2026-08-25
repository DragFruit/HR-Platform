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
    id: 'dayoff-leave-sense',
    canonical: 'как взять дейоф',
    paraphrases: ['хочу взять day off', 'как оформить дейоф'],
    expectAny: ['kb-30077'],
    note: 'Общий смысл = отгул, не SaaS'
  },
  {
    id: 'dayoff-saas-sense',
    canonical: 'как войти в дейоф',
    paraphrases: ['логин в dayofff', 'авторизация DayOFFF'],
    expectAny: ['kb-27877'],
    note: 'Общий смысл = SaaS'
  },
  {
    id: 'dayoff-ambiguous',
    canonical: 'дейоф',
    paraphrases: ['что такое дейоф', 'day off'],
    expectAny: ['kb-27877', 'kb-30077'],
    note: 'Сомнение — ок любая из двух или обе; UI даёт два ответа'
  },
  {
    id: 'otgul-explicit',
    canonical: 'регламент оформления отгулов',
    paraphrases: ['как взять отгул', 'оформить отгул digital'],
    expectAny: ['kb-30077']
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
    id: 'contacts-programmatic',
    canonical: 'Какие есть Programmatic и кому лучше писать для расчетов?',
    paraphrases: [
      'программатики контакты',
      'кому писать по programmatic',
      'площадки programmatic и контакты менеджеров'
    ],
    expectAny: ['kb-20409'],
    note: 'Блок Programmatic в Контактах, не DayOfff/AFINA'
  },
  {
    id: 'contacts-lawyers',
    canonical: 'кому писать юристу',
    paraphrases: [
      'контакты юристов',
      'юридическая поддержка к кому обратиться',
      'телефон юриста в контактах'
    ],
    expectAny: ['kb-20409'],
    note: 'Блок Юристы в Контактах'
  },
  {
    id: 'contacts-yandex',
    canonical: 'контакты менеджера Яндекса',
    paraphrases: [
      'кому писать в яндекс по рекламе',
      'яндекс менеджер агентства vbi',
      'контакт яндекс тим'
    ],
    expectAny: ['kb-20409'],
    note: 'Блок Яндекс в Контактах'
  },
  {
    id: 'contacts-google360',
    canonical: 'контакты Google 360',
    paraphrases: ['кому писать по google 360', 'google 360 закупка контакт'],
    expectAny: ['kb-20409']
  },
  {
    id: 'contacts-designers',
    canonical: 'контакты дизайнеров',
    paraphrases: ['кому писать дизайнеру', 'дизайнеры цены контакты'],
    expectAny: ['kb-20409']
  },
  {
    id: 'contacts-translators',
    canonical: 'бюро переводов контакты',
    paraphrases: ['кому писать переводчику', 'переводчики elefteria'],
    expectAny: ['kb-20409']
  },
  {
    id: 'contacts-clickru',
    canonical: 'контакты Click.ru',
    paraphrases: ['кому писать в click ru', 'click.ru менеджер'],
    expectAny: ['kb-20409']
  },
  {
    id: 'contacts-outdoor-tv',
    canonical: 'наружная реклама в аэропортах контакты',
    paraphrases: ['реклама на ТВ контакт', 'кому писать по рекламе в аэропорту'],
    expectAny: ['kb-20409']
  },
  {
    id: 'hiring',
    canonical: 'регламент найма сотрудников VBI',
    paraphrases: ['как у нас нанимают людей', 'процесс найма в компании'],
    expectAny: ['kb-29011']
  },
  {
    id: 'resignation',
    canonical: 'увольнение сотрудника',
    paraphrases: [
      'как уволиться',
      'хочу уволиться что нужно',
      'процесс увольнения',
      'как уволится',
      'хочу уволится'
    ],
    expectAny: ['kb-20175', 'kb-24927'],
    note: '«уволиться» = та же тема, что «увольнение»'
  },
  {
    id: 'offtopic-weather',
    canonical: 'какая погода завтра в Москве',
    paraphrases: ['расскажи анекдот', 'кто выиграл футбол'],
    expectAny: [],
    note: 'Не должно находить рабочие статьи как «ответ» — пустая выдача или низкая уверенность ок'
  }
];
