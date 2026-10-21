/**
 * Плитка-напоминание «Хочешь подарок? / Заполни вишлист» на своём профиле.
 * Встаёт на место плитки «мои идеи», пока вишлист пуст.
 */

/**
 * Иллюстрация плитки (Gemini). Пока false — фон рисуется CSS (крем, круги, флажки, подарок-SVG).
 * Когда файлы лягут в public/images/profile/wishlist-reminder.webp (+ .png фолбэк) — поставить true:
 * класс .profile-stat-tile--wish-reminder-art в main.css подставит их фоном (cover, справа).
 */
export const WISHLIST_REMINDER_ART_ENABLED = false;

export type WishlistReminderState = {
  isOwnProfile: boolean;
  /** Вишлист загружен без ошибки (до загрузки/при ошибке плитку не показываем — не мигаем). */
  loaded: boolean;
  itemsCount: number;
};

export function shouldShowWishlistReminder(state: WishlistReminderState): boolean {
  return state.isOwnProfile && state.loaded && state.itemsCount === 0;
}
