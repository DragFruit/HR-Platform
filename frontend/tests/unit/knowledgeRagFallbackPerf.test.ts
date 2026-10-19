import { describe, expect, it } from 'vitest';
import { retrieveKnowledgeLexicalFallback } from '../../server/utils/knowledgeRag';
import { stemRu, textCoversToken, tokensMatchMorph, uniqueRagWords } from '../../server/utils/knowledgeRagLexical';

/**
 * Регрессия инцидента стейджа 2026-10-19: Yandex GPT ответил 403 → yandex-ask ушёл в лексический
 * фолбэк по всей базе знаний; стеммер гонялся по каждому слову каждой статьи заново (~40 с
 * синхронного CPU), event loop стоял, nginx отдавал 504 на все страницы стенда.
 */
describe('knowledge RAG lexical fallback не вешает сервер', () => {
  it('вопрос из инцидента: быстро и с отдачей event loop', async () => {
    let maxGap = 0;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      maxGap = Math.max(maxGap, now - last);
      last = now;
    }, 10);
    const started = Date.now();
    try {
      const hits = await retrieveKnowledgeLexicalFallback('привет какие контакты юристов?', {
        viewer: { role: 'admin', department: '' }
      });
      expect(hits.length).toBeGreaterThan(0);
    } finally {
      clearInterval(timer);
    }
    const took = Date.now() - started;
    // До фикса — 35–40 с на M-серии и больше на сервере.
    expect(took).toBeLessThan(15_000);
    // Другие запросы должны обслуживаться во время подбора.
    expect(maxGap).toBeLessThan(1_500);
  }, 60_000);

  it('кэши не меняют результат матчинга', () => {
    expect(stemRu('юристов')).toBe(stemRu('юристов'));
    expect(tokensMatchMorph('юристов', 'юрист')).toBe(true);
    expect(tokensMatchMorph('юристов', 'юрист')).toBe(true);
    expect(tokensMatchMorph('привет', 'приветствие')).toBe(false);
    expect(uniqueRagWords('юрист юрист контакты')).toEqual(['юрист', 'контакты']);
    expect(textCoversToken('Контакты юристов компании', 'юрист')).toBe(true);
    expect(textCoversToken('Контакты юристов компании', 'бухгалтер')).toBe(false);
  });
});
