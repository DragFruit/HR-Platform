/**
 * Плитка-напоминание «Хочешь подарок? / Заполни вишлист» на своём профиле.
 * Встаёт на место плитки «мои идеи», пока вишлист пуст.
 */

/**
 * Иллюстрация плитки (Gemini): public/images/profile/wishlist-reminder.webp (+ .jpg фолбэк),
 * класс .profile-stat-tile--wish-reminder-art в main.css. false — фон целиком на CSS
 * (крем, круги, флажки и подарок inline-SVG).
 */
export const WISHLIST_REMINDER_ART_ENABLED = true;

export type WishlistReminderState = {
  isOwnProfile: boolean;
  /** Вишлист загружен без ошибки (до загрузки/при ошибке плитку не показываем — не мигаем). */
  loaded: boolean;
  itemsCount: number;
};

export function shouldShowWishlistReminder(state: WishlistReminderState): boolean {
  return state.isOwnProfile && state.loaded && state.itemsCount === 0;
}
