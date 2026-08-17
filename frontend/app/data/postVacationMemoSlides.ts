/** Квадратные слайды «с возвращением» — тон HR, без канцелярита. */

export type PostVacationMemoSlide = {
  id: string;
  kicker?: string;
  title: string;
  body?: string;
  bullets?: string[];
  coverSrc?: string;
  cta: string;
};

export const POST_VACATION_MEMO_SLIDES: PostVacationMemoSlide[] = [
  {
    id: 'cover',
    kicker: 'После отпуска',
    title: 'С возвращением',
    body: 'Ресурс ещё с тобой. Не отдай его первому понедельнику.',
    coverSrc: '/memos/post-vacation-cover.png',
    cta: 'Дальше'
  },
  {
    id: 'pace',
    title: 'Не наверстывай',
    bullets: [
      'Первый день — почта и план на неделю.',
      'Одно важное дело, не три «как до отпуска».',
      'Остальное подождёт до вторника.'
    ],
    cta: 'Дальше'
  },
  {
    id: 'body',
    title: 'Телу тоже надо приземлиться',
    bullets: [
      'Сон и еда ещё пару дней как в отпуске.',
      'Рывок с 9 до 21 ничего не догонит.',
      'Короткий перерыв днём — нормально.'
    ],
    cta: 'Дальше'
  },
  {
    id: 'team',
    title: 'Можно медленнее',
    bullets: [
      'Если завал — скажи руководителю в первый день.',
      'Не копи до среды, когда уже поздно.',
      'Бережно к себе — это тоже работа.'
    ],
    cta: 'Понятно'
  }
];

/** Минимум календарных дней отпуска, чтобы показать памятку (летний, не отгул). */
export const POST_VACATION_MEMO_MIN_DAYS = 7;

/** Показывать не позже стольких суток после последнего дня отпуска. */
export const POST_VACATION_MEMO_WINDOW_DAYS = 7;
