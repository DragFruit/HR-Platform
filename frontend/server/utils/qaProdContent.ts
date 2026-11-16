import {
  isQaTestDepartmentEnabledFromEnv,
  isQaTestEmployeeId,
  isQaTestPersonName
} from '../../app/data/qaTestDepartment';

/**
 * Контент QA-отдела «Тестировщики» (идеи, заявки на отпуск, лента активности) в сидах git.
 * На localhost/стейдже (QA-флаг включён) — как есть. На бою (QA-флаг выключен) вырезаем
 * при импорте JSON → Postgres и при чтении, чтобы тестовые записи не доехали до прода
 * (сбой 2026-11: пустая база нового прода импортировала ideas.json/vacations.json из git).
 * Признак — фиксированные id и ФИО QA-сотрудников, не слова «тест/demo».
 */

type Env = Record<string, string | undefined>;

const hasQaEmployeeId = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return false;
  const id = Number(value);
  return Number.isSafeInteger(id) && isQaTestEmployeeId(id);
};

/** Заявка/бронь отпуска QA-сотрудника: по employee_id или точному ФИО. */
export function isQaPersonVacationRow(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return hasQaEmployeeId(r.employee_id) || isQaTestPersonName(r.employee);
}

/** Идея, автор которой QA-сотрудник (ФИО из состава QA-отдела). */
export function isQaAuthoredIdea(idea: unknown): boolean {
  if (!idea || typeof idea !== 'object') return false;
  return isQaTestPersonName((idea as Record<string, unknown>).authorName);
}

function stripByYear(map: unknown): unknown {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return map;
  return Object.fromEntries(
    Object.entries(map as Record<string, unknown>).map(([year, rows]) => [
      year,
      Array.isArray(rows) ? rows.filter((row) => !isQaPersonVacationRow(row)) : rows
    ])
  );
}

/** Состояние отпусков без заявок и броней QA-сотрудников (только при выключенном QA-флаге). */
export function stripQaPersonVacations<T extends object>(state: T, env: Env = process.env): T {
  if (isQaTestDepartmentEnabledFromEnv(env) || !state) return state;
  const s = state as Record<string, unknown>;
  const out: Record<string, unknown> = { ...s };
  if ('requestsByYear' in s) out.requestsByYear = stripByYear(s.requestsByYear);
  if ('reservationsByYear' in s) out.reservationsByYear = stripByYear(s.reservationsByYear);
  return out as T;
}

/** Банк идей без идей QA-сотрудников и без голосов за них (только при выключенном QA-флаге). */
export function stripQaAuthoredIdeas<T extends object>(state: T, env: Env = process.env): T {
  if (isQaTestDepartmentEnabledFromEnv(env) || !state) return state;
  const s = state as Record<string, unknown>;
  if (!Array.isArray(s.ideas)) return state;
  const removed = new Set<string>();
  const ideas = s.ideas.filter((idea) => {
    if (!isQaAuthoredIdea(idea)) return true;
    removed.add(String((idea as Record<string, unknown>).id));
    return false;
  });
  if (!removed.size) return state;
  const out: Record<string, unknown> = { ...s, ideas };
  const votes = s.votesByUserId;
  if (votes && typeof votes === 'object' && !Array.isArray(votes)) {
    out.votesByUserId = Object.fromEntries(
      Object.entries(votes as Record<string, unknown>).map(([userId, map]) => {
        if (!map || typeof map !== 'object' || Array.isArray(map)) return [userId, map];
        return [userId, Object.fromEntries(Object.entries(map).filter(([ideaId]) => !removed.has(ideaId)))];
      })
    );
  }
  return out as T;
}

/** Лента активности без записей QA-сотрудников (юбиляр 9100 и т.п.), только при выключенном QA-флаге. */
export function stripQaProfileActivity<T>(items: T[], env: Env = process.env): T[] {
  if (isQaTestDepartmentEnabledFromEnv(env)) return items;
  return items.filter((row) => !(row && typeof row === 'object' && hasQaEmployeeId((row as Record<string, unknown>).employee_id)));
}
