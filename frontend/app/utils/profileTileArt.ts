/**
 * Иллюстрации плиток профиля (сгенерированы, стикеры с белой обводкой, прозрачный фон).
 * Замена картинки — одна строка: новый файл в public/images/profile/ и поднять ?v=.
 */

export type ProfileTileArt = {
  /** webp — в <source type="image/webp"> */
  webp: string | null;
  /** png — основной src и фолбэк */
  src: string;
};

/** «Скоро в отпуск»: кот в шезлонге и капибара в панамке (слева в плитке). */
export const VACATION_SOON_ART: ProfileTileArt = {
  webp: '/images/profile/vacation-soon.webp?v=1',
  src: '/images/profile/vacation-soon.png?v=1'
};

/** «График отпусков / Пройти обучение»: календарь, книга, шапочка (справа-внизу). */
export const VACATION_TRAINING_ART: ProfileTileArt = {
  webp: '/images/profile/vacation-training.webp?v=1',
  src: '/images/profile/vacation-training.png?v=1'
};
