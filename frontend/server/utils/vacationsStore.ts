import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { VacationRequest } from '../../app/composables/useVacations';
import type { VacationReservation } from '../../app/utils/vacationReservations';
import {
  mergeQaTestVacationState,
  stripQaTestVacationRequests,
  stripQaTestVacationReservations
} from '../../app/data/qaTestVacationSeed';

export type { VacationRequest, VacationReservation };

export type VacationStoreState = {
  primaryYear: number;
  requestsByYear: Record<string, VacationRequest[]>;
  nextRequestId: number;
  reservationsByYear: Record<string, VacationReservation[]>;
  nextReservationId: number;
};

const DATA_FILE = join(process.cwd(), 'server/data/vacations.json');

export const defaultVacationState = (): VacationStoreState => ({
  primaryYear: new Date().getFullYear(),
  requestsByYear: {},
  nextRequestId: 1,
  reservationsByYear: {},
  nextReservationId: 1
});

export function normalizeVacationStoreState(raw: Partial<VacationStoreState>): VacationStoreState {
  const base = defaultVacationState();
  return {
    primaryYear: typeof raw.primaryYear === 'number' ? raw.primaryYear : base.primaryYear,
    requestsByYear: raw.requestsByYear ?? base.requestsByYear,
    nextRequestId: typeof raw.nextRequestId === 'number' ? raw.nextRequestId : base.nextRequestId,
    reservationsByYear: raw.reservationsByYear ?? base.reservationsByYear,
    nextReservationId:
      typeof raw.nextReservationId === 'number' ? raw.nextReservationId : base.nextReservationId
  };
}

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
  return mergeQaTestVacationState(normalizeVacationStoreState(JSON.parse(raw) as Partial<VacationStoreState>));
}

function stripQaFromVacationState(state: VacationStoreState): VacationStoreState {
  const requestsByYear = Object.fromEntries(
    Object.entries(state.requestsByYear).map(([year, rows]) => [
      year,
      stripQaTestVacationRequests(rows)
    ])
  );
  const reservationsByYear = Object.fromEntries(
    Object.entries(state.reservationsByYear).map(([year, rows]) => [
      year,
      stripQaTestVacationReservations(rows)
    ])
  );
  return { ...state, requestsByYear, reservationsByYear };
}

export async function writeVacations(state: VacationStoreState): Promise<VacationStoreState> {
  await ensureFile();
  const persisted = stripQaFromVacationState(state);
  await writeFile(DATA_FILE, JSON.stringify(persisted, null, 2), 'utf8');
  return state;
}

/** Сериализует все правки отпусков — без гонок при параллельных POST/PATCH. */
let mutationQueue: Promise<unknown> = Promise.resolve();

export async function mutateVacations(
  mutator: (state: VacationStoreState) => VacationStoreState | Promise<VacationStoreState>
): Promise<VacationStoreState> {
  const run = mutationQueue.then(async () => {
    const current = await readVacations();
    const next = await mutator(current);
    return writeVacations(next);
  });
  mutationQueue = run.catch(() => {});
  return run;
}
