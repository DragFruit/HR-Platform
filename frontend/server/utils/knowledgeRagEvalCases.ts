/**
 * Кейсы для проверки RAG на перефразах.
 * expectAny — достаточно попадания любой из статей в топ выдачи.
 * expectAll — все перечисленные id должны быть в топ (Bitrix+Vibe и т.п.).
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
  /** Все id должны попасть в топ (строже expectAny). */
  expectAll?: string[];
  /** Отдел/роль для фильтра аудитории и sense отпуска. */
  viewer?: { role: string; department: string };
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
    expectAny: ['kb-21301', 'kb-vibe-vacations-digital'],
    expectAll: ['kb-21301', 'kb-vibe-vacations-digital'],
    note: 'Bitrix Digital + Vibe Digital'
  },
  {
    id: 'vacation-digital-viewer',
    canonical: 'как уйти в отпуск',
    paraphrases: ['как взять отпуск', 'как поставить отпуск', 'как оформить отпуск'],
    expectAny: ['kb-21301', 'kb-vibe-vacations-digital'],
    expectAll: ['kb-21301', 'kb-vibe-vacations-digital'],
    viewer: { role: 'employee', department: 'Digital' },
    note: 'Без слова Digital — sense по отделу юзера'
  },
  {
    id: 'vacation-seo',
    canonical: 'правила ухода в отпуск SEO',
    paraphrases: ['как сеошнику уйти в отпуск', 'отпуск в SEO SERM какие правила'],
    expectAny: ['kb-24611', 'kb-vibe-vacations-other'],
    expectAll: ['kb-24611', 'kb-vibe-vacations-other'],
    note: 'Bitrix SEO + Vibe (не-Digital)'
  },
  {
    id: 'vacation-other-viewer',
    canonical: 'как уйти в отпуск',
    paraphrases: ['как оформить отпуск', 'как взять отпуск'],
    expectAny: ['kb-vibe-vacations-other'],
    expectAll: ['kb-vibe-vacations-other'],
    viewer: { role: 'employee', department: 'DEV' },
    note: 'Не-Digital без Bitrix-регламента отдела — только Vibe'
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
    id: 'access-guest',
    canonical: 'гостевые доступы',
    paraphrases: [
      'как выдать гостевой доступ в Директ',
      'гостевой доступ к Метрике',
      'как дать гостевой доступ в Calltouch'
    ],
    expectAny: ['kb-29864'],
    note: 'Гостевые, не отдел продаж и не AFINA'
  },
  {
    id: 'access-sales',
    canonical: 'доступы отдела продаж',
    paraphrases: ['доступы директ вк', 'на какую почту открывать доступы продажам'],
    expectAny: ['kb-25590'],
    note: 'Короткая памятка ОП, не гостевая инструкция'
  },
  {
    id: 'utm-regulation',
    canonical: 'регламент UTM тегирования',
    paraphrases: [
      'как размечать UTM',
      'регламент utm',
      'когда UIS Roistat Calltouch',
      'когда ставить UIS а когда Calltouch'
    ],
    expectAny: ['kb-23420'],
    note: 'Длинная статья; не найм/Контакты/гостевые Calltouch'
  },
  {
    id: 'acts-rp',
    canonical: 'акты от рекламных площадок',
    paraphrases: ['акты яндекс', 'акты VKR', 'как смотреть акты в YDirect'],
    expectAny: ['kb-31980'],
    note: 'Не Контакты про менеджера Яндекса'
  },
  {
    id: 'writeoffs-afina',
    canonical: 'списания в AFINA комиссии прочее',
    paraphrases: ['списания в afina', 'прочее ppc комиссии', 'какое правило списания прочее'],
    expectAny: ['kb-28468'],
    note: 'Не доступы к AFINA'
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
    id: 'corp-fonts',
    canonical: 'корпоративные шрифты VBI',
    paraphrases: [
      'шрифты компании',
      'какой шрифт у компании',
      'tt hoves pro',
      'фирменный шрифт vbi',
      'где скачать шрифты'
    ],
    expectAny: ['kb-corp-fonts-vbi'],
    note: 'TT Hoves Pro Trial — не отпуск и не HR'
  },
  {
    id: 'offtopic-weather',
    canonical: 'какая погода завтра в Москве',
    paraphrases: ['расскажи анекдот', 'кто выиграл футбол'],
    expectAny: [],
    note: 'Не должно находить рабочие статьи как «ответ» — пустая выдача или низкая уверенность ок'
  }
];
