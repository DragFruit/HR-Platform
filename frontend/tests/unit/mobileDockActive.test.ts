import { describe, expect, it } from 'vitest';
import { findActiveDockItem, isDockItemActive } from '~/utils/mobileDockActive';

const employeeTabs = [
  { to: '/knowledge' },
  { to: '/vacations' },
  { to: '/' },
  { to: '/ideas' },
  { to: '/store' }
];

const adminTabs = [
  { to: '/admin/knowledge' },
  { to: '/admin/vacations' },
  { to: '/admin' },
  { to: '/admin/ideas' },
  { to: '/admin/employees' }
];

describe('mobile dock active item', () => {
  it('admin dock on /vacations highlights nothing (not «Знания»)', () => {
    expect(findActiveDockItem(adminTabs, '/vacations')).toBeNull();
  });

  it('admin root is exact, sections are prefix', () => {
    expect(findActiveDockItem(adminTabs, '/admin')?.to).toBe('/admin');
    expect(findActiveDockItem(adminTabs, '/admin/')?.to).toBe('/admin');
    expect(findActiveDockItem(adminTabs, '/admin/vacations')?.to).toBe('/admin/vacations');
    expect(findActiveDockItem(adminTabs, '/admin/employees/42')?.to).toBe('/admin/employees');
    expect(findActiveDockItem(adminTabs, '/admin/surveys')).toBeNull();
  });

  it('employee home is exact', () => {
    expect(findActiveDockItem(employeeTabs, '/')?.to).toBe('/');
    expect(findActiveDockItem(employeeTabs, '/profile')).toBeNull();
  });

  it('employee sections match by prefix, not by substring', () => {
    expect(findActiveDockItem(employeeTabs, '/knowledge/article-1')?.to).toBe('/knowledge');
    expect(isDockItemActive('/ideas', '/ideas-archive')).toBe(false);
    expect(findActiveDockItem(employeeTabs, '/vacations?tab=team')?.to).toBe('/vacations');
  });

  it('wallet belongs to store', () => {
    expect(findActiveDockItem(employeeTabs, '/wallet')?.to).toBe('/store');
    expect(findActiveDockItem(employeeTabs, '/store/item/5')?.to).toBe('/store');
  });
});
