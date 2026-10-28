import { describe, expect, it } from 'vitest';
import { isChiefAccountantTitle } from '../../app/utils/companyWideVacationViewer';

describe('isChiefAccountantTitle', () => {
  it('совпадает с вариантами «Главный бухгалтер»', () => {
    for (const t of ['Главный бухгалтер', ' главный  бухгалтер ', 'ГЛАВНЫЙ БУХГАЛТЕР', 'Гл. бухгалтер', 'гл.бухгалтер']) {
      expect(isChiefAccountantTitle(t)).toBe(true);
    }
  });
  it('не совпадает с другими должностями', () => {
    for (const t of ['Бухгалтер', 'Заместитель главного бухгалтера', 'Главный бухгалтер-аналитик', 'Главный специалист', '', null, undefined]) {
      expect(isChiefAccountantTitle(t)).toBe(false);
    }
  });
});
