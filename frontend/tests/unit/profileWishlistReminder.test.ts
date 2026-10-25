import { describe, expect, it } from 'vitest';
import { shouldShowWishlistReminder } from '../../app/utils/profileWishlistReminder';

describe('shouldShowWishlistReminder', () => {
  it('показывает на своём профиле при пустом загруженном вишлисте', () => {
    expect(shouldShowWishlistReminder({ isOwnProfile: true, loaded: true, itemsCount: 0 })).toBe(true);
  });

  it('скрывает, когда в вишлисте есть хотя бы один пункт', () => {
    expect(shouldShowWishlistReminder({ isOwnProfile: true, loaded: true, itemsCount: 1 })).toBe(false);
  });

  it('не показывает на чужом профиле', () => {
    expect(shouldShowWishlistReminder({ isOwnProfile: false, loaded: true, itemsCount: 0 })).toBe(false);
  });

  it('не показывает, пока вишлист не загружен (или загрузка упала)', () => {
    expect(shouldShowWishlistReminder({ isOwnProfile: true, loaded: false, itemsCount: 0 })).toBe(false);
  });
});
