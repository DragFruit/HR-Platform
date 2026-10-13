import type { Survey, SurveyQuestion, SurveyResponse } from '../../app/composables/useSurveys';
import { SMILEY_LABELS } from '../../app/composables/useSurveys';

export type DistributionBucket = { label: string; count: number; percent: number };

export type QuestionReport =
  | {
      questionId: string;
      type: SurveyQuestion['type'];
      text: string;
      kind: 'distribution';
      answered: number;
      buckets: DistributionBucket[];
      average?: number;
    }
  | {
      questionId: string;
      type: SurveyQuestion['type'];
      text: string;
      kind: 'text';
      answered: number;
      values: string[];
    }
  | {
      questionId: string;
      type: SurveyQuestion['type'];
      text: string;
      kind: 'info';
    };

export type SurveyResultsSummary = {
  /** Посещения публичной страницы опроса (/s/[slug]) — survey-visits.json. */
  visited: number;
  /** Реально зафиксированное первое взаимодействие с вопросом — survey-starts.json. */
  started: number;
  completed: number;
  /** started - completed (обе величины реально отслеживаются, не инференс). */
  startedButNotCompleted: number;
  completionRate: number;
  questions: QuestionReport[];
};

/**
 * Честная 3-стадийная воронка — Посещения → Начали отвечать → Завершили:
 * - visited — счётчик загрузок публичной страницы (survey-visits.json,
 *   пишет /api/public/surveys/:slug/visit при onMounted).
 * - started — счётчик РЕАЛЬНОГО первого взаимодействия с вопросом
 *   (survey-starts.json, пишет /api/public/surveys/:slug/start при первом
 *   изменении любого ответа на публичной странице — см. watch(answers) в
 *   app/pages/s/[slug].vue). Это не инференс и не производная величина.
 * - completed — "завершил" = ответил на все required-вопросы (есть submit).
 *
 * "Не закончили" = started - completed — оба слагаемых реально отслеживаются,
 * поэтому это не фикция, а честная разность двух настоящих счётчиков.
 */
export function buildSurveyResults(
  survey: Survey,
  responses: SurveyResponse[],
  visited: number,
  started: number
): SurveyResultsSummary {
  const requiredIds = survey.questions.filter((q) => q.required).map((q) => q.id);
  const completed = responses.filter((r) =>
    requiredIds.every((id) => {
      const v = r.answers[id];
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
    })
  ).length;

  const questions: QuestionReport[] = survey.questions.map((question) => {
    if (question.type === 'info') {
      return { questionId: question.id, type: question.type, text: question.text, kind: 'info' };
    }

    if (question.type === 'text_short' || question.type === 'text_long') {
      const values = responses
        .map((r) => r.answers[question.id])
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
      return {
        questionId: question.id,
        type: question.type,
        text: question.text,
        kind: 'text',
        answered: values.length,
        values
      };
    }

    // DISTRIBUTION_TYPES: single, multi, yesno, smiley, nps, scale
    const answeredValues = responses
      .map((r) => r.answers[question.id])
      .filter((v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0));

    const counts = new Map<string, number>();
    let sum = 0;
    let numericCount = 0;

    const bump = (label: string) => counts.set(label, (counts.get(label) || 0) + 1);

    for (const value of answeredValues) {
      if (question.type === 'multi' && Array.isArray(value)) {
        value.forEach((v) => bump(String(v)));
        continue;
      }
      if (question.type === 'yesno') {
        bump(value ? 'Да' : 'Нет');
        continue;
      }
      if (question.type === 'smiley') {
        const n = Number(value);
        const labels = question.smileyLabels?.length ? question.smileyLabels : [...SMILEY_LABELS];
        bump(labels[n - 1] || String(n));
        sum += n;
        numericCount += 1;
        continue;
      }
      if (question.type === 'nps' || question.type === 'scale') {
        const n = Number(value);
        bump(String(n));
        sum += n;
        numericCount += 1;
        continue;
      }
      bump(String(value));
    }

    // Процент считаем от числа ответивших, не от суммы выборов (важно для multi).
    const total = answeredValues.length;

    let labelOrder: string[];
    if (question.type === 'single' || question.type === 'multi') {
      labelOrder = question.options || [...counts.keys()];
    } else if (question.type === 'yesno') {
      labelOrder = ['Да', 'Нет'];
    } else if (question.type === 'smiley') {
      labelOrder = question.smileyLabels?.length ? [...question.smileyLabels] : [...SMILEY_LABELS];
    } else {
      const min = question.type === 'scale' ? question.scaleMin ?? 1 : 0;
      const max = question.type === 'scale' ? question.scaleMax ?? 10 : 10;
      labelOrder = [];
      for (let i = min; i <= max; i += 1) labelOrder.push(String(i));
    }

    const buckets: DistributionBucket[] = labelOrder.map((label) => {
      const count = counts.get(label) || 0;
      return {
        label,
        count,
        percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0
      };
    });

    const report: QuestionReport = {
      questionId: question.id,
      type: question.type,
      text: question.text,
      kind: 'distribution',
      answered: answeredValues.length,
      buckets
    };
    if (numericCount > 0) {
      (report as { average?: number }).average = Math.round((sum / numericCount) * 10) / 10;
    }
    return report;
  });

  // Логически visited >= started >= completed (нельзя завершить без старта,
  // нельзя начать без загрузки страницы), но если /visit или /start не
  // долетел из-за сетевой ошибки на клиенте, а submit всё равно прошёл —
  // реальные счётчики могут временно разойтись. Подстраховываемся снизу,
  // чтобы не показывать отрицательные "не закончили" или >100% конверсию;
  // сами счётчики (visited/started) при этом не подделываются и не инферятся.
  const effectiveStarted = Math.max(started, completed);
  const effectiveVisited = Math.max(visited, effectiveStarted);

  return {
    visited: effectiveVisited,
    started: effectiveStarted,
    completed,
    startedButNotCompleted: Math.max(0, effectiveStarted - completed),
    completionRate: effectiveVisited > 0 ? Math.round((completed / effectiveVisited) * 1000) / 10 : 0,
    questions
  };
}

