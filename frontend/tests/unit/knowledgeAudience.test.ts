import { describe, expect, it } from 'vitest';
import {
  canUserSeeArticle,
  canonicalKnowledgeDepartment,
  filterArticlesForUser,
  knowledgeViewerFrom
} from '../../server/utils/knowledgeAudience';
import { emptyKnowledgeFilters, searchKnowledgeArticles } from '../../app/utils/knowledgeSearch';
import type { KnowledgeCard } from '../../app/data/knowledgeBaseCatalog';

/** Разметка статей как на бою (knowledge.articles.departments). */
const ARTICLES = [
  { id: 'kb-digital', title: '[DIGITAL] Регламент ухода в отпуск', departments: ['Digital'] },
  { id: 'kb-digital-buh', title: 'Акты от рекламных площадок', departments: ['Digital', 'Бухгалтерия'] },
  { id: 'kb-digital-sales', title: 'Доступы AFINA', departments: ['Digital', 'Отдел продаж'] },
  { id: 'kb-all', title: 'Базовый регламент ИТ-безопасности', departments: [] as string[] },
  { id: 'kb-seo', title: '[SEO] Регламент ухода в отпуск', departments: ['SEO / ORM'] },
  { id: 'kb-sales', title: 'Памятка отдела продаж', departments: ['Отдел продаж'] }
];

const DIGITAL_IDS = ['kb-digital', 'kb-digital-buh', 'kb-digital-sales', 'kb-all'];

const ids = (list: { id: string }[]) => list.map((a) => a.id).sort();

describe('canonicalKnowledgeDepartment', () => {
  it('Bitrix-имена отделов сводятся к справочнику', () => {
    expect(canonicalKnowledgeDepartment('Digital отдел')).toBe('Digital');
    expect(canonicalKnowledgeDepartment('digital')).toBe('Digital');
    expect(canonicalKnowledgeDepartment('Диджитал')).toBe('Digital');
    expect(canonicalKnowledgeDepartment('SEO отдел')).toBe('SEO / ORM');
    expect(canonicalKnowledgeDepartment('SEO&SERM')).toBe('SEO / ORM');
    expect(canonicalKnowledgeDepartment('ORM отдел')).toBe('SEO / ORM');
    expect(canonicalKnowledgeDepartment('Отдел разработки')).toBe('DEV');
    expect(canonicalKnowledgeDepartment('Отдел маркетинга')).toBe('Маркетинг');
    expect(canonicalKnowledgeDepartment('Отдел внутренних проектов')).toBe('Внутренние проекты');
  });
  it('неизвестное — как есть, пустое — пусто', () => {
    expect(canonicalKnowledgeDepartment('Юристы')).toBe('Юристы');
    expect(canonicalKnowledgeDepartment('  ')).toBe('');
  });
});

describe('видимость статей для отдела Digital', () => {
  it('отдел из справочника — видны свои статьи и общие', () => {
    const viewer = knowledgeViewerFrom({ role: 'employee', department: 'Digital' }, { department: 'Digital' });
    expect(ids(filterArticlesForUser(ARTICLES, viewer))).toEqual([...DIGITAL_IDS].sort());
  });

  it('вход через Bitrix: в сессии подотдел, в справочнике Digital — статьи не пропадают (баг)', () => {
    for (const bitrixDept of ['Отдел контекстной и медийной рекламы', 'Отдел аналитики', 'Отдел SMM & Influence & Таргета', '']) {
      const viewer = knowledgeViewerFrom({ role: 'employee', department: bitrixDept }, { department: 'Digital' });
      expect(viewer.department).toBe('Digital');
      expect(ids(filterArticlesForUser(ARTICLES, viewer))).toEqual([...DIGITAL_IDS].sort());
    }
  });

  it('в сессии «Digital отдел» и сотрудника нет в справочнике — всё равно Digital', () => {
    const viewer = knowledgeViewerFrom({ role: 'employee', department: 'Digital отдел' }, null);
    expect(ids(filterArticlesForUser(ARTICLES, viewer))).toEqual([...DIGITAL_IDS].sort());
  });

  it('чужие отделы по-прежнему не видят Digital-статьи', () => {
    const seo = knowledgeViewerFrom({ role: 'employee', department: 'SEO отдел' }, { department: 'SEO / ORM' });
    expect(ids(filterArticlesForUser(ARTICLES, seo))).toEqual(['kb-all', 'kb-seo']);
    const nobody = knowledgeViewerFrom({ role: 'employee', department: '' }, null);
    expect(ids(filterArticlesForUser(ARTICLES, nobody))).toEqual(['kb-all']);
  });

  it('admin/hr видят всё', () => {
    expect(canUserSeeArticle(['Digital'], { role: 'hr', department: '' })).toBe(true);
    expect(canUserSeeArticle(['Digital'], { role: 'admin', department: 'Дирекция' })).toBe(true);
  });

  it('обычный поиск находит Digital-статью для сотрудника Digital, вошедшего через Bitrix', () => {
    const viewer = knowledgeViewerFrom({ role: 'employee', department: 'Отдел аналитики' }, { department: 'Digital' });
    const cards: KnowledgeCard[] = filterArticlesForUser(ARTICLES, viewer).map((a) => ({
      id: a.id,
      category: '',
      title: a.title,
      description: '',
      tone: 'doc',
      type: 'regulation',
      departments: a.departments
    }));
    const hits = searchKnowledgeArticles(cards, 'отпуск', emptyKnowledgeFilters());
    expect(hits.map((h) => h.card.id)).toEqual(['kb-digital']);
  });
});
