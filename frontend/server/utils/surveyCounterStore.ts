import type { KeyedStateDef, RawState } from '../db/repositories/keyedState';
import { defineStateFile } from '../db/repositories/stateFile';
import { surveysJsonImports } from '../db/schema';
import { surveyCounterStateDef, surveysDbFlag } from '../surveys/domain';

/**
 * Общая фабрика для простых identity-free счётчиков воронки опроса
 * (визиты, начало ответа) — каждый живёт в своём flat-JSON файле вида
 * `{ "<key>": { "<surveyId>": <count> } }`. Никакой идентифицирующей
 * информации (IP/session/fingerprint/timestamp визита) не хранится —
 * только суммарное число событий на survey.id.
 *
 * Этап 8: DB_SURVEYS=1 → Postgres (surveys.start_counts / surveys.visit_counts: survey_id + count,
 * без времени и без аудита на каждое событие), иначе тот же файл.
 */
export type CounterStoreState = Record<string, Record<string, number>>;

export function createSurveyCounterStore(fileName: string, key: 'started' | 'visited') {
  const defaultState = (): CounterStoreState => ({ [key]: {} });

  function normalize(raw: unknown): CounterStoreState {
    const result: CounterStoreState = { [key]: {} };
    const bucket = (raw as Record<string, unknown> | undefined)?.[key];
    if (bucket && typeof bucket === 'object') {
      for (const [surveyId, count] of Object.entries(bucket as Record<string, unknown>)) {
        const n = Number(count);
        if (surveyId.trim() && Number.isFinite(n) && n >= 0) {
          result[key]![surveyId.trim()] = Math.floor(n);
        }
      }
    }
    return result;
  }

  const def: KeyedStateDef = { ...surveyCounterStateDef(key === 'started' ? 'starts' : 'visits'), normalize };

  const file = defineStateFile({
    fileName,
    label: key === 'started' ? 'счётчик «начали отвечать»' : 'счётчик визитов опросов',
    logTag: key === 'started' ? 'survey-starts' : 'survey-visits',
    flag: surveysDbFlag,
    def,
    jsonImports: surveysJsonImports,
    defaultRaw: () => defaultState() as unknown as RawState
  });

  async function read(): Promise<CounterStoreState> {
    return normalize(await (await file.repo()).read());
  }

  /** Очередь репозитория (в Postgres ещё транзакция под своим advisory lock). */
  async function mutate(mutator: (state: CounterStoreState) => CounterStoreState): Promise<CounterStoreState> {
    return (await file.repo()).mutate(async (raw) => {
      const next = normalize(mutator(normalize(raw)));
      return { next: next as unknown as RawState, result: next };
    });
  }

  async function write(state: CounterStoreState): Promise<CounterStoreState> {
    return mutate(() => state);
  }

  function countFor(state: CounterStoreState, surveyId: string): number {
    return state[key]![surveyId] ?? 0;
  }

  async function record(surveyId: string): Promise<void> {
    await mutate((current) => {
      current[key]![surveyId] = (current[key]![surveyId] || 0) + 1;
      return current;
    });
  }

  return { read, write, mutate, countFor, record, file, def };
}
