import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS_CATALOG,
  earnedAchievementSections,
  type AchievementCatalogItem
} from '../../app/data/achievementsCatalog';
import { publicAchievementsForEmployee } from '../../app/utils/employeePublicCard';
import type { Employee } from '../../app/composables/useEmployees';

const withEarned = (ids: string[]): AchievementCatalogItem[] =>
  ACHIEVEMENTS_CATALOG.map((a) => ({ ...a, earned: ids.includes(a.id) }));

describe('earnedAchievementSections — витрина только полученных', () => {
  it('ничего не получено — ни одного раздела', () => {
    expect(earnedAchievementSections(withEarned([]))).toEqual([]);
  });

  it('разделы без полученных не возвращаются, внутри только полученные', () => {
    const sections = earnedAchievementSections(withEarned(['tenure-1y', 'idea-done-1']));
    expect(sections.map((s) => s.section)).toEqual(['tenure-career', 'leadership']);
    for (const group of sections) {
      expect(group.items.length).toBeGreaterThan(0);
      expect(group.items.every((item) => item.earned)).toBe(true);
      expect(group.earnedCount).toBe(group.items.length);
    }
    expect(sections.flatMap((s) => s.items.map((i) => i.id)).sort()).toEqual([
      'idea-done-1',
      'tenure-1y'
    ]);
  });
});

describe('publicAchievementsForEmployee — визитка коллеги', () => {
  const base = { id: 1, name: 'Тест Тестов' } as unknown as Employee;

  it('новичок без идей — пусто (никаких пустых слотов)', () => {
    const hiredRecently = new Date();
    hiredRecently.setMonth(hiredRecently.getMonth() - 2);
    const emp = { ...base, hired_at: hiredRecently.toISOString().slice(0, 10) } as Employee;
    expect(publicAchievementsForEmployee(emp, 0)).toEqual([]);
  });

  it('только публичные полученные: стаж и реализованные идеи', () => {
    const emp = { ...base, hired_at: '2015-01-10' } as Employee;
    const ids = publicAchievementsForEmployee(emp, 1).map((a) => a.id);
    expect(ids).toContain('tenure-1y');
    expect(ids).toContain('tenure-5y');
    expect(ids).toContain('idea-done-1');
    expect(ids).not.toContain('idea-done-5');
    expect(ids).not.toContain('kalendar-otpuskov');
  });
});
