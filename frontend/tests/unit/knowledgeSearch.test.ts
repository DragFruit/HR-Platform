import { describe, expect, it } from 'vitest';
import type { KnowledgeCard } from '../../app/data/knowledgeBaseCatalog';
import {
  emptyKnowledgeFilters,
  isKnowledgeStopWord,
  isStopWordsOnlyQuery,
  meaningfulQueryWords,
  parseKnowledgeQuery,
  searchKnowledgeArticles
} from '../../app/utils/knowledgeSearch';

const card = (id: string, title: string, bodyHtml: string, tags: string[] = []): KnowledgeCard => ({
  id,
  category: tags[0] ?? '',
  tags,
  title,
  description: '',
  tone: 'doc',
  type: 'regulation',
  publishedAt: '2026-10-01',
  bodyHtml
});

/** Форма как у реальных статей прода (заголовки и обрывки текстов). */
const CARDS: KnowledgeCard[] = [
  card(
    'kb-vac',
    'Отпуска в Vibe',
    '<p>Как оформить отпуск: заявление в разделе «График отпусков». Отпуск за свой счёт согласуется с руководителем.</p>',
    ['отпуска', 'согласование']
  ),
  card('kb-vac-rules', '[DIGITAL] Регламент ухода в отпуск', '<p>Перед уходом в отпуск передай проекты коллеге.</p>'),
  card('kb-fire', 'Регламент увольнения сотрудника', '<p>При увольнении сотрудника HR закрывает доступы.</p>'),
  card(
    'kb-acc',
    '8. Заведение выставленных счетов на проект в AFINA CRM',
    '<p>Счета клиенту выставляются в AFINA. Оплата на счет агентства.</p>'
  ),
  card('kb-law', 'Регламент постановки задач на юристов', '<p>Задачи юристам ставятся в Bitrix.</p>'),
  card('kb-contacts', 'Контакты', '<p>Юристы: Иванова. Бухгалтерия: Петрова. Дизайн: Сидоров.</p>'),
  card('kb-zp', '[Как проверить ЗП]', '<p>Заработная плата приходит 10 и 25 числа.</p>')
];

const top = (q: string, n = 3) =>
  searchKnowledgeArticles(CARDS, q, emptyKnowledgeFilters())
    .slice(0, n)
    .map((h) => h.card.id);

describe('knowledgeSearch: токенизация и служебные слова', () => {
  it('предлоги, союзы, частицы и вопросительные слова — служебные', () => {
    for (const w of ['в', 'на', 'по', 'для', 'и', 'или', 'не', 'как', 'что', 'это', 'где', 'когда', 'свой', 'за'])
      expect(isKnowledgeStopWord(w)).toBe(true);
    for (const w of ['отпуск', 'зп', 'вк', 'тп', 'кп', 'vpn']) expect(isKnowledgeStopWord(w)).toBe(false);
  });

  it('из запроса остаются только смысловые слова', () => {
    expect(meaningfulQueryWords('Как оформить отпуск за свой счёт?')).toEqual(['оформить', 'отпуск', 'счет']);
    expect(parseKnowledgeQuery('где взять доступ к VPN').soft).toEqual(['взять', 'доступ', 'vpn']);
  });

  it('запрос только из служебных слов не фильтрует список', () => {
    expect(isStopWordsOnlyQuery('и на по')).toBe(true);
    expect(isStopWordsOnlyQuery('отпуск')).toBe(false);
    expect(searchKnowledgeArticles(CARDS, 'в', emptyKnowledgeFilters())).toHaveLength(CARDS.length);
  });
});

describe('knowledgeSearch: словоформы и ранжирование', () => {
  it('«отпуска», «отпуском», «отпуск» находят одни и те же статьи', () => {
    const base = top('отпуск', 5).sort();
    expect(base).toEqual(['kb-vac', 'kb-vac-rules']);
    expect(top('отпуска', 5).sort()).toEqual(base);
    expect(top('отпуском', 5).sort()).toEqual(base);
  });

  it('«в» в запросе не тянет все статьи: «уход в отпуск» — про отпуск', () => {
    const hits = searchKnowledgeArticles(CARDS, 'уход в отпуск', emptyKnowledgeFilters());
    expect(hits.map((h) => h.card.id)).toEqual(['kb-vac-rules', 'kb-vac']);
  });

  it('все смысловые слова важнее одного: «отпуск за свой счёт» — статья про отпуск выше счетов', () => {
    const ids = top('отпуск за свой счет', 5);
    expect(ids[0]).toBe('kb-vac');
    expect(ids.indexOf('kb-acc')).toBeGreaterThan(ids.indexOf('kb-vac'));
  });

  it('заголовок весомее текста: «контакты юристов»', () => {
    expect(top('контакты юристов', 2).sort()).toEqual(['kb-contacts', 'kb-law']);
  });

  it('глагол и существительное одной основы: «как уволить сотрудника»', () => {
    expect(top('как уволить сотрудника', 1)).toEqual(['kb-fire']);
  });

  it('узкие синонимы: «зарплата» находит ЗП', () => {
    expect(top('зарплата когда приходит', 1)).toEqual(['kb-zp']);
  });

  it('подсветка — только смысловые слова заголовка, без «в»', () => {
    const hit = searchKnowledgeArticles(CARDS, 'уход в отпуск', emptyKnowledgeFilters())[0]!;
    expect(hit.titleParts.filter((p) => p.hit).map((p) => p.text)).toEqual(['ухода', 'отпуск']);
  });

  it('"фраза" и !слово продолжают работать', () => {
    expect(top('"свой счёт"', 5)).toEqual(['kb-vac']);
    expect(top('!юристов', 5)).toEqual(['kb-law']);
  });
});
