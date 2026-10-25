import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createMutationQueue, writeJsonAtomic } from '../utils/atomicJson';
import type { PersistedVacationState, VacationsRepo } from './types';

export const VACATIONS_JSON_FILE = join(process.cwd(), 'server/data/vacations.json');

/** Как раньше: файла нет → создаём его с пустым состоянием графика. */
export async function readVacationsJson(
  file: string,
  init: () => PersistedVacationState = () => ({})
): Promise<PersistedVacationState> {
  await mkdir(dirname(file), { recursive: true });
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    const value = init();
    await writeJsonAtomic(file, value);
    return value;
  }
  return JSON.parse(raw) as PersistedVacationState;
}

/** server/data/vacations.json — поведение до этапа 4 (прод и локалка). */
export function createJsonVacationsRepo(
  file: string = VACATIONS_JSON_FILE,
  init: () => PersistedVacationState = () => ({})
): VacationsRepo {
  const enqueue = createMutationQueue();
  const readRaw = () => readVacationsJson(file, init);
  const writeRaw = async (state: PersistedVacationState) => {
    await mkdir(dirname(file), { recursive: true });
    await writeJsonAtomic(file, state);
  };
  return {
    backend: 'json',
    readRaw,
    writeRaw,
    mutateRaw: (fn) => enqueue(async () => writeRaw(await fn(await readRaw())))
  };
}
