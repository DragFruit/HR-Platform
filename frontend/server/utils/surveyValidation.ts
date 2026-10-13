import type { Survey, SurveyAnswerValue, SurveyQuestion } from '../../app/composables/useSurveys';

export type ValidatedAnswers = Record<string, SurveyAnswerValue>;

/**
 * Серверная валидация ответа респондента: не доверяем клиенту.
 * - вопрос должен существовать в опросе;
 * - обязательные вопросы должны быть отвечены;
 * - тип значения должен соответствовать типу вопроса (choice-варианты входят в options).
 */
export function validateSurveyAnswers(
  survey: Survey,
  rawAnswers: unknown
): { ok: true; answers: ValidatedAnswers } | { ok: false; error: string } {
  if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) {
    return { ok: false, error: 'Нужны ответы (answers)' };
  }
  const input = rawAnswers as Record<string, unknown>;
  const answers: ValidatedAnswers = {};

  for (const question of survey.questions) {
    if (question.type === 'info') continue;
    const value = input[question.id];
    const hasValue = value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);

    if (question.required && !hasValue) {
      return { ok: false, error: `Обязательный вопрос без ответа: ${question.id}` };
    }
    if (!hasValue) continue;

    const validated = validateOne(question, value);
    if (validated === undefined) {
      return { ok: false, error: `Некорректный ответ на вопрос: ${question.id}` };
    }
    answers[question.id] = validated;
  }

  // Ответы на id, которых нет в опросе, в answers не попадают — проходим только по survey.questions.
  return { ok: true, answers };
}

function validateOne(question: SurveyQuestion, value: unknown): SurveyAnswerValue | undefined {
  switch (question.type) {
    case 'single': {
      const str = String(value);
      if (!question.options?.includes(str)) return undefined;
      return str;
    }
    case 'multi': {
      if (!Array.isArray(value)) return undefined;
      const options = question.options || [];
      const cleaned = value.map((v) => String(v)).filter((v) => options.includes(v));
      if (!cleaned.length) return undefined;
      return cleaned;
    }
    case 'yesno': {
      if (typeof value === 'boolean') return value;
      if (value === 'yes' || value === 'true') return true;
      if (value === 'no' || value === 'false') return false;
      return undefined;
    }
    case 'smiley': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 5) return undefined;
      return n;
    }
    case 'nps': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 10) return undefined;
      return n;
    }
    case 'scale': {
      const n = Number(value);
      const min = question.scaleMin ?? 1;
      const max = question.scaleMax ?? 10;
      if (!Number.isFinite(n) || n < min || n > max) return undefined;
      return n;
    }
    case 'text_short': {
      const str = String(value).trim().slice(0, 500);
      return str || undefined;
    }
    case 'text_long': {
      const str = String(value).trim().slice(0, 5000);
      return str || undefined;
    }
    default:
      return undefined;
  }
}
