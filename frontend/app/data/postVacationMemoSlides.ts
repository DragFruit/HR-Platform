/** Слайды «с возвращением»: спокойный тон статьи, цельные абзацы, ты, без тире.
 * Design C: текст в Vue, иллюстрации отдельно (`/memos/pvm-c-art-*.png`). */

export type PostVacationMemoParagraphSegment =
  | { kind: 'text'; value: string }
  | { kind: 'inline'; src: string; alt?: string };

export type PostVacationMemoParagraph = string | PostVacationMemoParagraphSegment[];

export type PostVacationMemoSlide = {
  id: string;
  kicker?: string;
  title: string;
  /** Переносы как на эскизе series-c; если нет — рендерим title целиком. */
  titleLines?: string[];
  paragraphs: PostVacationMemoParagraph[];
  points?: string[];
  coverSrc?: string;
  cta: string;
  laterCta?: string;
};

const ART_V = 'art-c-v18';

export const POST_VACATION_INLINE_FLOWER_SRC = `/memos/pvm-inline-flower-pot.png?v=${ART_V}`;

/** Первый экран: тепло, без акцента что выход = хандра. */
export const POST_VACATION_WELCOME: PostVacationMemoSlide = {
  id: 'welcome',
  kicker: 'После отпуска',
  title: 'С возвращением!',
  titleLines: ['С возвращением!'],
  paragraphs: [
    'Надеемся, твой отпуск прошёл успешно! Пусть первые дни будут спокойными и лёгкими',
    'Собрали несколько советов, как вернуться к работе после отпуска и не поймать выгорание.',
    'К ним можно будет вернуться позже.'
  ],
  coverSrc: `/memos/pvm-c-art-welcome.png?v=${ART_V}`,
  laterCta: 'Позже',
  cta: 'Прочитать'
};

/** Чип (свёрнутая памятка): кот + чемодан, без растения. */
export const POST_VACATION_CHIP_SRC = `/memos/pvm-c-art-chip.png?v=${ART_V}`;

export const POST_VACATION_DOCK = {
  title: 'Советы после отпуска',
  label: 'Открыть'
} as const;

export const POST_VACATION_MEMO_SLIDES: PostVacationMemoSlide[] = [
  {
    id: 'intro',
    kicker: 'Советы',
    title: 'Вот четыре совета',
    titleLines: ['Вот четыре', 'совета'],
    paragraphs: [
      'После отпуска мы полны сил, но не стоит сразу набрасываться на работу. Если резко войти в задачи в первый день, легко растерять ресурсы и поймать выгорание.',
      'Пока тебя не было, ситуация на проектах и в команде могла измениться. Узнай у коллег, какая сейчас обстановка. В первые дни просто войди в курс дела, а важные решения лучше отложи на несколько дней.'
    ],
    coverSrc: `/memos/pvm-c-art-intro.png?v=${ART_V}`,
    cta: 'Дальше'
  },
  {
    id: 'pace',
    kicker: 'Совет',
    title: 'Войди в ритм плавно',
    titleLines: ['Войди в ритм', 'плавно'],
    paragraphs: [
      [
        {
          kind: 'text',
          value:
            'Первые дни после отпуска - отличное время, чтобы посмотреть на привычные вещи под новым углом и сделать работу интереснее! Можно иначе выстроить рутину, изменить распорядок дня или просто переставить вещи на столе '
        },
        { kind: 'inline', src: POST_VACATION_INLINE_FLOWER_SRC, alt: '' }
      ],
      'Так ты не игнорируешь потребность в изменениях, а находишь полезное применение, и на работу захочется приходить охотнее.'
    ],
    coverSrc: `/memos/pvm-c-art-tip1.png?v=${ART_V}`,
    cta: 'Дальше'
  },
  {
    id: 'fresh',
    kicker: 'Совет',
    title: 'Посмотри на работу свежим взглядом',
    titleLines: ['Посмотри на работу', 'свежим взглядом'],
    paragraphs: [
      'Первые дни после отпуска отличное время, чтобы посмотреть на привычные дела под новым углом и сделать работу интереснее. Можно иначе выстроить работу, изменить распорядок дня или просто переставить вещи на столе',
      'Так потребность в изменениях не игнорируется, а находит полезное применение, и на работу хочется приходить чуть охотнее.'
    ],
    coverSrc: `/memos/pvm-c-art-tip2.png?v=${ART_V}`,
    cta: 'Дальше'
  },
  {
    id: 'weekend',
    kicker: 'Совет',
    title: 'Пусть впечатления не обрываются',
    titleLines: ['Пусть впечатления', 'не обрываются'],
    paragraphs: [
      'Смена режима утомляет тело и мозги. Вчера были яркие впечатления, а сегодня рабочая атмосфера.',
      'Поэтому практичный совет: на выходных устраивай маленький отпуск - кино, боулинг или долгая прогулка по новым местам. Когда после рабочей недели тебя ждёт маленькое приключение, будни наполняются приятным предвкушением.'
    ],
    coverSrc: `/memos/pvm-c-art-tip3.png?v=${ART_V}`,
    cta: 'Дальше'
  },
  {
    id: 'triggers',
    kicker: 'Совет',
    title: 'Если всё равно тяжело',
    titleLines: ['Если всё равно', 'тяжело'],
    paragraphs: [
      'Если совсем ничего не помогает, присмотрись к своей работе: может быть, в целом всё нормально, но отдельные моменты триггерят. Например, не очень приятный клиент или чат, в котором ничего не найдёшь.',
      'Подумай, на что ты можешь повлиять. Составь план и сделай первый шаг. Свежий взгляд после отпуска идеально для этого подходит!'
    ],
    coverSrc: `/memos/pvm-c-art-tip4.png?v=${ART_V}`,
    cta: 'Спасибо'
  }
];

/** Минимум календарных дней отпуска, чтобы показать памятку (летний, не отгул). */
export const POST_VACATION_MEMO_MIN_DAYS = 7;

/** Показывать не позже стольких суток после последнего дня отпуска. */
export const POST_VACATION_MEMO_WINDOW_DAYS = 7;

/** Сколько рабочих дней чип живёт в углу после «Позже». */
export const POST_VACATION_MEMO_DOCK_WORKING_DAYS = 10;
