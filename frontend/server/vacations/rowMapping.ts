import type { vacationRequests, vacationReservations, vacationState } from '../db/schema';
import type { VacationRequest, VacationReservation, VacationStoreState } from '../utils/vacationsStore';

export type RequestRow = typeof vacationRequests.$inferInsert;
export type ReservationRow = typeof vacationReservations.$inferInsert;
export type StateRow = typeof vacationState.$inferInsert;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidIsoDate = (v: unknown) => {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const str = (v: unknown) => typeof v === 'string';
const int = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Значение «как его увидит JSON.stringify» (undefined внутри объектов пропадает, NaN → null). */
const asJson = (v: unknown): unknown => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

type FieldSpec<R> = { col: keyof R; ok: (v: unknown) => boolean };

export const REQUEST_FIELDS: Record<string, FieldSpec<RequestRow>> = {
  employee: { col: 'employee', ok: str },
  employee_id: { col: 'employeeId', ok: int },
  start: { col: 'startDate', ok: isValidIsoDate },
  end: { col: 'endDate', ok: isValidIsoDate },
  status: { col: 'status', ok: str },
  approval_step: { col: 'approvalStep', ok: str },
  comment: { col: 'comment', ok: str },
  createdAt: { col: 'createdAtText', ok: str },
  bitrix_absence_id: { col: 'bitrixAbsenceId', ok: int },
  bitrix_absence_iblock_id: { col: 'bitrixAbsenceIblockId', ok: int },
  bitrix_sync_status: { col: 'bitrixSyncStatus', ok: str },
  bitrix_sync_method: { col: 'bitrixSyncMethod', ok: str },
  bitrix_synced_at: { col: 'bitrixSyncedAt', ok: str },
  bitrix_sync_error: { col: 'bitrixSyncError', ok: str }
};

export const RESERVATION_FIELDS: Record<string, FieldSpec<ReservationRow>> = {
  employee: { col: 'employee', ok: str },
  employee_id: { col: 'employeeId', ok: int },
  year: { col: 'year', ok: int },
  month: { col: 'month', ok: int },
  durationDays: { col: 'durationDays', ok: num },
  comment: { col: 'comment', ok: str },
  createdAt: { col: 'createdAtText', ok: str },
  expiry_notice_sent_at: { col: 'expiryNoticeSentAt', ok: str }
};

type BaseRow = { id: number; bucketYear: string; position: number; sourceKeys?: string[] | null; extra?: Record<string, unknown> | null };

/**
 * Объект JSON → строка. null — нет целого id (ключ не выдумываем).
 * Ключи со значением undefined не сохраняются: JSON.stringify их тоже выбрасывает
 * (мутации делают `item.bitrix_sync_status = undefined`).
 */
function toRow<R extends BaseRow>(
  item: Record<string, unknown>,
  fields: Record<string, FieldSpec<R>>,
  bucketYear: string,
  position: number
): R | null {
  if (!item || typeof item !== 'object' || !int(item.id)) return null;
  const keys = Object.keys(item).filter((k) => item[k] !== undefined);
  const row = { id: item.id as number, bucketYear, position, sourceKeys: keys } as unknown as R;
  const extra: Record<string, unknown> = {};
  for (const key of keys) {
    if (key === 'id') continue;
    const value = item[key];
    const spec = fields[key];
    if (!spec) {
      extra[key] = asJson(value);
      continue;
    }
    if (value === null) continue; // null в колонке; присутствие ключа — в sourceKeys
    if (spec.ok(value)) (row as Record<string, unknown>)[spec.col as string] = value;
    else extra[key] = asJson(value);
  }
  row.extra = Object.keys(extra).length ? extra : null;
  return row;
}

/** Строка → объект JSON: те же ключи в том же порядке, отсутствующие — отсутствуют. */
function fromRow<R extends BaseRow>(row: R, fields: Record<string, FieldSpec<R>>): Record<string, unknown> {
  const extra = (row.extra ?? {}) as Record<string, unknown>;
  const hasKeys = Array.isArray(row.sourceKeys);
  const keys = hasKeys ? row.sourceKeys! : ['id', ...Object.keys(fields)];
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key === 'id') {
      out.id = row.id;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(extra, key)) {
      out[key] = extra[key];
      continue;
    }
    const spec = fields[key];
    if (!spec) continue;
    const value = (row as Record<string, unknown>)[spec.col as string];
    if (value == null && !hasKeys) continue;
    out[key] = value ?? null;
  }
  for (const [key, value] of Object.entries(extra)) {
    if (!(key in out)) out[key] = value;
  }
  return out;
}

export const requestToRow = (item: VacationRequest, bucketYear: string, position: number) =>
  toRow<RequestRow & BaseRow>(item as unknown as Record<string, unknown>, REQUEST_FIELDS as never, bucketYear, position);
export const rowToRequest = (row: RequestRow) =>
  fromRow(row as RequestRow & BaseRow, REQUEST_FIELDS as never) as unknown as VacationRequest;
export const reservationToRow = (item: VacationReservation, bucketYear: string, position: number) =>
  toRow<ReservationRow & BaseRow>(item as unknown as Record<string, unknown>, RESERVATION_FIELDS as never, bucketYear, position);
export const rowToReservation = (row: ReservationRow) =>
  fromRow(row as ReservationRow & BaseRow, RESERVATION_FIELDS as never) as unknown as VacationReservation;

/** Сохраняемое состояние (как в файле) → строки таблиц. */
export type VacationRows = {
  state: StateRow;
  requests: RequestRow[];
  reservations: ReservationRow[];
  /** Записи без целого id или с дублем id — не кладём. */
  skipped: { kind: 'request' | 'reservation'; bucket: string; id: unknown }[];
};

const TOP_KEYS = [
  'primaryYear',
  'requestsByYear',
  'nextRequestId',
  'reservationsByYear',
  'nextReservationId',
  'qaDemoSuppressed',
  'reservationMonthlyCapsByGroup'
];

export function stateToRows(raw: Partial<VacationStoreState>): VacationRows {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const skipped: VacationRows['skipped'] = [];
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (!TOP_KEYS.includes(k) && v !== undefined) extra[k] = asJson(v);
  }
  const intOrExtra = (key: string): number | null => {
    const v = src[key];
    if (v === undefined || v === null) return null;
    if (int(v)) return v as number;
    extra[key] = asJson(v);
    return null;
  };

  const buckets = <T>(key: 'requestsByYear' | 'reservationsByYear') => {
    const value = src[key];
    if (value === undefined || value === null) return { years: [] as string[], lists: [] as [string, T[]][] };
    if (typeof value !== 'object' || Array.isArray(value)) {
      extra[key] = asJson(value);
      return { years: [] as string[], lists: [] as [string, T[]][] };
    }
    const lists: [string, T[]][] = [];
    for (const [year, list] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(list)) lists.push([year, list as T[]]);
      else extra[`${key}.${year}`] = asJson(list); // не массив — так в файле не бывает; не теряем
    }
    return { years: lists.map(([y]) => y), lists };
  };

  const req = buckets<VacationRequest>('requestsByYear');
  const res = buckets<VacationReservation>('reservationsByYear');

  const requests: RequestRow[] = [];
  const reqIds = new Set<number>();
  for (const [year, list] of req.lists) {
    list.forEach((item, position) => {
      const row = requestToRow(item, year, position);
      if (!row || reqIds.has(row.id)) return void skipped.push({ kind: 'request', bucket: year, id: (item as { id?: unknown })?.id });
      reqIds.add(row.id);
      requests.push(row);
    });
  }
  const reservations: ReservationRow[] = [];
  const resIds = new Set<number>();
  for (const [year, list] of res.lists) {
    list.forEach((item, position) => {
      const row = reservationToRow(item, year, position);
      if (!row || resIds.has(row.id)) return void skipped.push({ kind: 'reservation', bucket: year, id: (item as { id?: unknown })?.id });
      resIds.add(row.id);
      reservations.push(row);
    });
  }

  const blob = (key: string) => (src[key] === undefined || src[key] === null ? null : asJson(src[key]));
  const state: StateRow = {
    id: 1,
    primaryYear: intOrExtra('primaryYear'),
    nextRequestId: intOrExtra('nextRequestId'),
    nextReservationId: intOrExtra('nextReservationId'),
    requestYears: req.years,
    reservationYears: res.years,
    qaDemoSuppressed: blob('qaDemoSuppressed'),
    reservationMonthlyCapsByGroup: blob('reservationMonthlyCapsByGroup'),
    extra: null
  };
  state.extra = Object.keys(extra).length ? extra : null;
  return { state, requests, reservations, skipped };
}

/** Строки → сохраняемое состояние в форме файла (до normalizeVacationStoreState). */
export function rowsToState(
  state: StateRow | null | undefined,
  requests: RequestRow[],
  reservations: ReservationRow[]
): Partial<VacationStoreState> {
  if (!state) return {};
  const extra = (state.extra ?? {}) as Record<string, unknown>;
  const byBucket = <R extends { bucketYear: string; position?: number; id: number }, T>(
    years: string[],
    rows: R[],
    map: (r: R) => T
  ): Record<string, T[]> => {
    const out: Record<string, T[]> = {};
    for (const y of years) out[y] = [];
    const sorted = [...rows].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
    for (const r of sorted) (out[r.bucketYear] ??= []).push(map(r));
    return out;
  };
  const out: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (Object.prototype.hasOwnProperty.call(extra, key)) out[key] = extra[key];
    else if (value !== null && value !== undefined) out[key] = value;
  };
  put('primaryYear', state.primaryYear);
  out.requestsByYear = byBucket(state.requestYears ?? [], requests as (RequestRow & { id: number })[], rowToRequest);
  put('nextRequestId', state.nextRequestId);
  out.reservationsByYear = byBucket(
    state.reservationYears ?? [],
    reservations as (ReservationRow & { id: number })[],
    rowToReservation
  );
  put('nextReservationId', state.nextReservationId);
  put('qaDemoSuppressed', state.qaDemoSuppressed);
  put('reservationMonthlyCapsByGroup', state.reservationMonthlyCapsByGroup);
  for (const [k, v] of Object.entries(extra)) if (!(k in out) && !k.includes('.')) out[k] = v;
  return out as Partial<VacationStoreState>;
}

/** Строка заявки «как объект JSON» — для сравнения при diff-записи. */
export const requestKey = (r: RequestRow) => JSON.stringify(rowToRequest(r));
export const reservationKey = (r: ReservationRow) => JSON.stringify(rowToReservation(r));
