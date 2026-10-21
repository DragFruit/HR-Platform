import { describe, expect, it } from 'vitest';
import { formatVacationStartDdMmYy } from '../../app/utils/profileSpotlight';

describe('formatVacationStartDdMmYy', () => {
  it('ДД.ММ.ГГ с ведущими нулями', () => {
    expect(formatVacationStartDdMmYy('2026-02-23')).toBe('23.02.26');
    expect(formatVacationStartDdMmYy('2027-01-05')).toBe('05.01.27');
  });

  it('понимает дату со временем', () => {
    expect(formatVacationStartDdMmYy('2026-11-03T00:00:00Z')).toBe('03.11.26');
  });
});
