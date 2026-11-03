import type { OgonekObjectName } from './sprites';

export type OgonekDayId = number; // 1..19

/** Что лежит внутри окна. От этого зависит, какую форму рисует клиент. */
export type OgonekDayKind =
  | 'song'       // назови песню года
  | 'avatar'     // новогодний аксессуар на аватарку
  | 'merch'      // показ мерча
  | 'plug'       // вилка в розетку: выключатель декора
  | 'skating'    // запись на каток
  | 'toy'        // нарисуй игрушку на ёлку
  | 'numbers'    // год компании в цифрах
  | 'dresscode'  // дресс-код и конкурс костюмов
  | 'reels'      // штаб конкурса рилсов
  | 'tictactoe'  // крестики-нолики (игра живёт отдельно)
  | 'photoyear'  // фотолента года
  | 'snowflake'  // вырежи снежинку
  | 'thanks'     // анонимное спасибо коллеге
  | 'teamphoto'  // фото отдела
  | 'minigame'   // мини-игра «лови подарки»
  | 'letter'     // письмо себе с доставкой 30 июня
  | 'olivier'    // рецепты и голосование
  | 'program'    // программа вечера
  | 'final';     // финал

export type OgonekDay = {
  id: OgonekDayId;
  dateIso: string;
  weekday: string;
  title: string;
  object: OgonekObjectName;
  kind: OgonekDayKind;
  /** Текст окна. */
  lead: string[];
  /** Что окно производит — микротекст под заголовком. */
  produces?: string;
  /**
   * Окно ждёт данные от заказчика: вместо содержимого показываем честную
   * подпись, а не выдуманные цифры и программу.
   */
  awaiting?: string;
  /** Текст написан нами в тон спеки и до сдачи заказчику считается черновиком. */
  draft?: boolean;
};

/** Состояние окна для клиента. Закрытое окно приезжает без содержимого. */
export type OgonekDayView = {
  id: OgonekDayId;
  dateIso: string;
  weekday: string;
  title: string;
  object: OgonekObjectName;
  kind: OgonekDayKind;
  /** Календарь: 10:00 своего дня наступило. */
  scheduleOpen: boolean;
  /** Человек уже распечатал окно. */
  opened: boolean;
  /** Можно открыть прямо сейчас. */
  openable: boolean;
  /** Окно сегодняшнего дня — отдельное состояние листка. */
  today: boolean;
  /** Действие окна выполнено — горит огонёк на гирлянде. */
  done: boolean;
  /** День прошёл, а листок не оторван. */
  missed: boolean;
  opensAt: string;
  /** Какое предыдущее окно держит это. */
  blockedBy: OgonekDayId | null;
  lead: string[];
  produces?: string;
  awaiting?: string;
  draft?: boolean;
};

export type OgonekToy = {
  id: string;
  userId: number;
  name: string;
  department: string;
  /** 16×16 сетка символов палитры. */
  pixels: string[];
  wish: string;
  /** Место на ёлке, доли 0..1. */
  x: number;
  y: number;
  createdAt: string;
  demo?: boolean;
};

export type OgonekSnowflake = {
  id: string;
  userId: number;
  name: string;
  /** Четверть 5×5 из `1` и `.`; полный рисунок отражается из неё. */
  pixels: string[];
  createdAt: string;
  demo?: boolean;
};

export type OgonekRecipe = {
  id: string;
  userId: number;
  name: string;
  department: string;
  title: string;
  text: string;
  votes: number;
  /** Этот рецепт выбрал сам смотрящий. */
  myVote?: boolean;
  createdAt: string;
  demo?: boolean;
};

export type OgonekThanks = {
  id: string;
  toUserId: number;
  toName: string;
  text: string;
  createdAt: string;
  demo?: boolean;
};

export type OgonekFeedKind =
  | 'toy'
  | 'snowflake'
  | 'thanks'
  | 'window'
  | 'recipe'
  | 'letter'
  | 'plug'
  | 'skating'
  | 'song';

export type OgonekFeedItem = {
  id: string;
  kind: OgonekFeedKind;
  /** У «спасибо» имени нет: открытка анонимная (спека, раздел 4b). */
  name: string | null;
  department: string | null;
  text: string;
  at: string;
};

export type OgonekRank = {
  from: number;
  title: string;
};
