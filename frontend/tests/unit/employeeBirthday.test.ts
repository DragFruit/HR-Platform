import { describe, expect, it } from 'vitest';
import { birthdayWithoutYear, normalizeBitrixBirthday } from '../../server/utils/bitrixBirthday';
import { formatBirthdayCard, isBirthdayToday } from '../../app/utils/tenureAnniversary';

const NOW = new Date(2026, 9, 20, 12);

describe('normalizeBitrixBirthday (PERSONAL_BIRTHDAY)', () => {
  it('ISO со временем и зоной: дата берётся строкой, без сдвига по зоне', () => {
    expect(normalizeBitrixBirthday('1990-03-12T03:00:00+03:00', NOW)).toBe('1990-03-12');
    expect(normalizeBitrixBirthday('1990-03-12T00:00:00+05:00', NOW)).toBe('1990-03-12');
    expect(normalizeBitrixBirthday('1990-03-12', NOW)).toBe('1990-03-12');
  });

  it('dd.mm.yyyy и dd.mm', () => {
    expect(normalizeBitrixBirthday('12.03.1990', NOW)).toBe('1990-03-12');
    expect(normalizeBitrixBirthday('5.7.1988', NOW)).toBe('1988-07-05');
    expect(normalizeBitrixBirthday('12.03', NOW)).toBe('03-12');
  });

  it('скрытый год (0000, 1900, без года, из будущего) → только MM-DD', () => {
    expect(normalizeBitrixBirthday('0000-03-12', NOW)).toBe('03-12');
    expect(normalizeBitrixBirthday('1900-03-12T00:00:00+03:00', NOW)).toBe('03-12');
    expect(normalizeBitrixBirthday('12.03.1900', NOW)).toBe('03-12');
    expect(normalizeBitrixBirthday('--03-12', NOW)).toBe('03-12');
    expect(normalizeBitrixBirthday('2099-03-12', NOW)).toBe('03-12');
  });

  it('пусто и мусор → null', () => {
    expect(normalizeBitrixBirthday('', NOW)).toBeNull();
    expect(normalizeBitrixBirthday(null, NOW)).toBeNull();
    expect(normalizeBitrixBirthday(undefined, NOW)).toBeNull();
    expect(normalizeBitrixBirthday(false, NOW)).toBeNull();
    expect(normalizeBitrixBirthday('не помню', NOW)).toBeNull();
    expect(normalizeBitrixBirthday('1990-13-01', NOW)).toBeNull();
    expect(normalizeBitrixBirthday('31.04.1990', NOW)).toBeNull();
    expect(normalizeBitrixBirthday('1990-02-29', NOW)).toBeNull();
  });

  it('29 февраля: в високосный год и без года', () => {
    expect(normalizeBitrixBirthday('1992-02-29', NOW)).toBe('1992-02-29');
    expect(normalizeBitrixBirthday('0000-02-29', NOW)).toBe('02-29');
  });

  it('birthdayWithoutYear срезает год для API', () => {
    expect(birthdayWithoutYear('1990-03-12')).toBe('03-12');
    expect(birthdayWithoutYear('03-12')).toBe('03-12');
    expect(birthdayWithoutYear(null)).toBeNull();
  });
});

describe('визитка: показ дня рождения', () => {
  it('только день и месяц, без года', () => {
    expect(formatBirthdayCard('1990-03-12')).toBe('12 марта');
    expect(formatBirthdayCard('03-12')).toBe('12 марта');
    expect(formatBirthdayCard('2001-01-01')).toBe('1 января');
    expect(formatBirthdayCard('1990-12-31')).not.toContain('1990');
  });

  it('пусто → пустая строка (строка в визитке скрыта)', () => {
    expect(formatBirthdayCard('')).toBe('');
    expect(formatBirthdayCard(null)).toBe('');
    expect(formatBirthdayCard(undefined)).toBe('');
    expect(formatBirthdayCard('мусор')).toBe('');
  });

  it('сегодня день рождения', () => {
    expect(isBirthdayToday('1990-10-20', NOW)).toBe(true);
    expect(isBirthdayToday('10-20', NOW)).toBe(true);
    expect(isBirthdayToday('1990-10-21', NOW)).toBe(false);
    expect(isBirthdayToday(null, NOW)).toBe(false);
    expect(isBirthdayToday('02-29', new Date(2027, 1, 28, 12))).toBe(true);
    expect(isBirthdayToday('02-29', new Date(2028, 1, 28, 12))).toBe(false);
  });
});
