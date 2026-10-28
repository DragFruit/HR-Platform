import { describe, expect, it } from 'vitest';
import {
  expandQuestionFromHistory,
  isKbClarifyingFollowUp,
  isKbTopicShift,
  kbTopicsOf
} from '../../app/utils/knowledgeAiIntent';

const vacationHistory = [
  { role: 'user', text: 'где взять заявление на отпуск' },
  { role: 'assistant', text: 'Заявление на отпуск скачивается в разделе «Отпуска».' }
];

describe('kbTopicsOf', () => {
  it('различает увольнение и отпуск', () => {
    expect(kbTopicsOf('заявление на увольнение')).toContain('dismissal');
    expect(kbTopicsOf('заявление на увольнение')).not.toContain('vacation');
    expect(kbTopicsOf('график отпусков')).toContain('vacation');
  });

  it('у чистого уточнения тем нет', () => {
    expect(kbTopicsOf('а подробнее?')).toEqual([]);
  });
});

describe('isKbTopicShift', () => {
  it('новая тема в уточнении — смена темы', () => {
    expect(isKbTopicShift('а если мне нужно заявление на увольнение?', 'где взять заявление на отпуск')).toBe(true);
  });

  it('та же тема — не смена', () => {
    expect(isKbTopicShift('а сколько дней отпуска?', 'где взять заявление на отпуск')).toBe(false);
    expect(isKbTopicShift('а подробнее?', 'где взять заявление на отпуск')).toBe(false);
  });
});

describe('expandQuestionFromHistory', () => {
  it('не склеивает «заявление на увольнение» с вопросом про отпуск', () => {
    const q = 'а если мне нужно заявление на увольнение?';
    expect(expandQuestionFromHistory(q, vacationHistory)).toBe(q);
  });

  it('обычное уточнение по-прежнему склеивает', () => {
    const out = expandQuestionFromHistory('а подробнее?', vacationHistory);
    expect(out).toContain('где взять заявление на отпуск');
    expect(out).toContain('Уточнение: а подробнее?');
  });

  it('кириллическое «а если …» ловится как уточнение', () => {
    expect(isKbClarifyingFollowUp('а если я не успел подать заявку')).toBe(true);
    expect(isKbClarifyingFollowUp('ещё варианты')).toBe(true);
  });
});
