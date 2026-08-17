/** Слайды «с возвращением»: прямой тон, без воды и без повторов вроде «чуть». */

export type PostVacationMemoSlide = {
  id: string;
  kicker?: string;
  title: string;
  paragraphs: string[];
  points?: string[];
  coverSrc?: string;
  cta: string;
  laterCta?: string;
};

/** Первый экран: тепло, без акцента что выход = хандра. */
export const POST_VACATION_WELCOME: PostVacationMemoSlide = {
  id: 'welcome',
  kicker: 'После отпуска',
  title: 'С возвращением!',
  paragraphs: [
    'Надеемся, твой отпуск прошёл успешно! Пусть первые дни будут спокойными и лёгкими',
    'Собрали несколько советов о том, как вернуться к работе после отпуска и не поймать выгорание. К ним можно будет вернуться позже.'
  ],
  coverSrc: '/memos/post-vacation-cover.png',
  laterCta: 'Позже',
  cta: 'Прочитать'
};

export const POST_VACATION_DOCK = {
  title: 'Советы после отпуска',
  label: 'Открыть'
} as const;

export const POST_VACATION_MEMO_SLIDES: PostVacationMemoSlide[] = [
  {
    id: 'pace',
    kicker: 'Совет',
    title: 'Не закрывай всё в понедельник',
    paragraphs: [
      'После отпуска хочется сразу разобрать завал. Если ввалить это в первый день, к среде уже пусто: силы ушли, а толку меньше, чем казалось.',
      'Спроси коллег, что изменилось, пока тебя не было. Пару дней только войти в курс. Крупные решения подождут.'
    ],
    coverSrc: '/memos/post-vacation-pace.png',
    cta: 'Дальше'
  },
  {
    id: 'fresh',
    kicker: 'Совет',
    title: 'Поменяй одну вещь',
    paragraphs: [
      'Пока взгляд ещё отпускной, привычное видно острее. Это не повод ломать всё, а повод сдвинуть одну конкретную штуку.',
      'Другой порядок дня. Другое место для кружки. Чтобы на работу тянуло не только по привычке.'
    ],
    coverSrc: '/memos/post-vacation-fresh.png',
    cta: 'Дальше'
  },
  {
    id: 'weekend',
    kicker: 'Совет',
    title: 'Оставь себе кусок отпуска',
    paragraphs: [
      'Работа тут ни при чём. Ломает обрыв: вчера новые места, сегодня тот же стол.',
      'Запиши на выходные кино, длинную прогулку или странный ужин. Когда впереди есть своё событие, будни перестают выглядеть наказанием.'
    ],
    coverSrc: '/memos/post-vacation-weekend.png',
    cta: 'Дальше'
  },
  {
    id: 'triggers',
    kicker: 'Совет',
    title: 'Если бесит уже конкретное',
    paragraphs: [
      'Иногда место в целом нормальное, а выводит из себя одно: клиент, чат, в котором ничего не найти.',
      'Назови это. Напиши три шага. Сделай первый, пока голова ещё не въехала в старый режим.'
    ],
    coverSrc: '/memos/post-vacation-triggers.png',
    cta: 'Понятно'
  }
];

/** Минимум календарных дней отпуска, чтобы показать памятку (летний, не отгул). */
export const POST_VACATION_MEMO_MIN_DAYS = 7;

/** Показывать не позже стольких суток после последнего дня отпуска. */
export const POST_VACATION_MEMO_WINDOW_DAYS = 7;

/** Сколько рабочих дней чип живёт в углу после «Позже». */
export const POST_VACATION_MEMO_DOCK_WORKING_DAYS = 10;
