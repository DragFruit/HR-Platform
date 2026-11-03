/**
 * Дресс-код Огонька (окно 8). Источник — таблица заказчика «корпорат Огонёк
 * 2027 НГ», лист с дресс-кодом; картинки оттуда же, сжатые в
 * `public/events/ogonek/dresscode/`.
 *
 * Отдельным файлом, а не в content.ts: дресс-код не сюрприз и может жить
 * в клиентском бандле, а тексты остальных окон — нет.
 */

const img = (name: string) => `/events/ogonek/dresscode/${name}.jpg`;

export type OgonekLook = {
  id: string;
  title: string;
  text: string;
  images: string[];
};

/** Правила поверх образов. */
export const OGONEK_DRESSCODE_RULES = [
  'Без костюма не пускаем.',
  'Дедом Морозом быть нельзя.'
];

/** Общая картинка настроения — утренник целиком. */
export const OGONEK_DRESSCODE_COVER = img('utrennik');

export const OGONEK_LOOKS: OgonekLook[] = [
  {
    id: 'star',
    title: 'Звезда',
    text: 'Платье в пайетках, штаны или пиджак с блёстками.',
    images: [img('sequins'), img('star-hood')]
  },
  {
    id: 'beast',
    title: 'Зверь',
    text: 'Зайцы, белки и все остальные: кигуруми, хвосты, уши. У кого ушей не найдётся — дадим на корпоративе.',
    images: [img('bunny'), img('fox-owl')]
  },
  {
    id: 'snowflake',
    title: 'Снежинка',
    // Картинки к снежинке в таблице нет — не подставляем чужую.
    text: '',
    images: []
  },
  {
    id: 'tree',
    title: 'Ёлка или снеговик',
    text: 'Зелёный наряд с яркими украшениями — или весь белый, и с морковкой.',
    images: [img('tree-tulle'), img('tree-ornaments')]
  },
  {
    id: 'grinch',
    title: 'Гринч',
    text: '',
    images: [img('grinch')]
  },
  {
    id: 'snegurochka',
    title: 'Снегурочка',
    text: '',
    images: [img('snegurochka')]
  }
];
