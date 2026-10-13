import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeJsonAtomic } from './atomicJson';

/**
 * Общая фабрика для простых identity-free счётчиков воронки опроса
 * (визиты, начало ответа) — каждый живёт в своём flat-JSON файле вида
 * `{ "<key>": { "<surveyId>": <count> } }`. Никакой идентифицирующей
 * информации (IP/session/fingerprint/timestamp визита) не хранится —
 * только суммарное число событий на survey.id.
 */
export type CounterStoreState = Record<string, Record<string, number>>;

export function createSurveyCounterStore(fileName: string, key: string) {
  const DATA_FILE = join(process.cwd(), 'server/data', fileName);

  const defaultState = (): CounterStoreState => ({ [key]: {} });

  function normalize(raw: unknown): CounterStoreState {
    const result: CounterStoreState = { [key]: {} };
    const bucket = (raw as Record<string, unknown> | undefined)?.[key];
    if (bucket && typeof bucket === 'object') {
      for (const [surveyId, count] of Object.entries(bucket as Record<string, unknown>)) {
        const n = Number(count);
        if (surveyId.trim() && Number.isFinite(n) && n >= 0) {
          result[key][surveyId.trim()] = Math.floor(n);
        }
      }
    }
    return result;
  }

  async function ensureFile() {
    await mkdir(dirname(DATA_FILE), { recursive: true });
    try {
      await readFile(DATA_FILE, 'utf8');
    } catch {
      await writeJsonAtomic(DATA_FILE, defaultState());
    }
  }

  async function read(): Promise<CounterStoreState> {
    await ensureFile();
    const raw = await readFile(DATA_FILE, 'utf8');
    return normalize(JSON.parse(raw));
  }

  async function write(state: CounterStoreState): Promise<CounterStoreState> {
    await ensureFile();
    const normalized = normalize(state);
    await writeJsonAtomic(DATA_FILE, normalized);
    return normalized;
  }

  let mutationQueue: Promise<unknown> = Promise.resolve();
  async function mutate(mutator: (state: CounterStoreState) => CounterStoreState): Promise<CounterStoreState> {
    const run = mutationQueue.then(async () => {
      const current = await read();
      return write(mutator(current));
    });
    mutationQueue = run.catch(() => {});
    return run;
  }

  function countFor(state: CounterStoreState, surveyId: string): number {
    return state[key][surveyId] ?? 0;
  }

  async function record(surveyId: string): Promise<void> {
    await mutate((current) => {
      current[key][surveyId] = (current[key][surveyId] || 0) + 1;
      return current;
    });
  }

  return { read, write, mutate, countFor, record };
}
