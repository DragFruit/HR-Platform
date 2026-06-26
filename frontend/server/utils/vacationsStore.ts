import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { VacationRequest } from '../../app/composables/useVacations';

export type VacationStoreState = {
  primaryYear: number;
  requestsByYear: Record<string, VacationRequest[]>;
  nextRequestId: number;
};

const DATA_FILE = join(process.cwd(), 'server/data/vacations.json');

export const defaultVacationState = (): VacationStoreState => ({
  primaryYear: new Date().getFullYear(),
  requestsByYear: {},
  nextRequestId: 1
});

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(defaultVacationState(), null, 2), 'utf8');
  }
}

export async function readVacations(): Promise<VacationStoreState> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw) as VacationStoreState;
}

export async function writeVacations(state: VacationStoreState): Promise<VacationStoreState> {
  await ensureFile();
  await writeFile(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  return state;
}
