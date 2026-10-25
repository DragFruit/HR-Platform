import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { writeAudit, type AuditEntry } from '../audit';
import { vacationRequestHistory, vacationRequests, vacationReservations, vacationState } from '../schema';
import { chunks, excludedSet } from './core';
import { createMutationQueue } from '../../utils/atomicJson';
import {
  requestKey,
  reservationKey,
  rowToRequest,
  rowToReservation,
  rowsToState,
  stateToRows,
  type RequestRow,
  type ReservationRow,
  type StateRow
} from '../../vacations/rowMapping';
import type { PersistedVacationState, VacationsRepo, VacationWriteContext } from '../../vacations/types';

/** pg_advisory_xact_lock на запись домена vacations (несколько процессов на одной базе). */
export const VACATIONS_WRITE_LOCK_KEY = 72_461_004;

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Q = Pick<Db, 'select'>;

export type VacationDbRows = { state: StateRow | null; requests: RequestRow[]; reservations: ReservationRow[] };

export async function loadVacationRows(q: Q): Promise<VacationDbRows> {
  const [stateRows, requests, reservations] = await Promise.all([
    q.select().from(vacationState).where(eq(vacationState.id, 1)),
    q.select().from(vacationRequests).orderBy(asc(vacationRequests.bucketYear), asc(vacationRequests.position), asc(vacationRequests.id)),
    q
      .select()
      .from(vacationReservations)
      .orderBy(asc(vacationReservations.bucketYear), asc(vacationReservations.position), asc(vacationReservations.id))
  ]);
  return { state: stateRows[0] ?? null, requests, reservations };
}

export async function lockVacations(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(${VACATIONS_WRITE_LOCK_KEY})`);
}

/** Строка состояния без служебного updated_at — для сравнения. */
const stateKey = (s: StateRow | null) =>
  s
    ? JSON.stringify([
        s.primaryYear ?? null,
        s.nextRequestId ?? null,
        s.nextReservationId ?? null,
        s.requestYears ?? [],
        s.reservationYears ?? [],
        s.qaDemoSuppressed ?? null,
        s.reservationMonthlyCapsByGroup ?? null,
        s.extra ?? null
      ])
    : '';

/** Что, кроме счётчиков id, поменялось в состоянии (для аудита). */
function stateChanges(prev: StateRow | null, next: StateRow): Record<string, { before: unknown; after: unknown }> {
  const out: Record<string, { before: unknown; after: unknown }> = {};
  const fields: [string, (s: StateRow | null) => unknown][] = [
    ['primaryYear', (s) => s?.primaryYear ?? null],
    ['requestYears', (s) => s?.requestYears ?? []],
    ['reservationYears', (s) => s?.reservationYears ?? []],
    ['qaDemoSuppressed', (s) => s?.qaDemoSuppressed ?? null],
    ['reservationMonthlyCapsByGroup', (s) => s?.reservationMonthlyCapsByGroup ?? null],
    ['extra', (s) => s?.extra ?? null]
  ];
  for (const [name, get] of fields) {
    const a = get(prev);
    const b = get(next);
    if (JSON.stringify(a) !== JSON.stringify(b)) out[name] = { before: a, after: b };
  }
  return out;
}

const textOrNull = (v: unknown): string | null => (v === undefined || v === null ? null : typeof v === 'string' ? v : JSON.stringify(v));

/**
 * Записать новое сохраняемое состояние поверх prev (уже прочитанного в этой же транзакции под lock):
 * меняются только изменившиеся строки, лишние удаляются; аудит и история статусов — в той же транзакции.
 */
export async function writeVacationDiff(
  tx: Tx,
  prev: VacationDbRows,
  next: PersistedVacationState,
  ctx: VacationWriteContext = {}
): Promise<{ changed: boolean }> {
  const rows = stateToRows(next);
  if (rows.skipped.length) {
    const s = rows.skipped.map((x) => `${x.kind}:${x.bucket}:${String(x.id)}`).join(', ');
    throw new Error(`[vacations] запись отменена: записи без целого id или с дублем id (${s})`);
  }
  const actor = { actorEmployeeId: ctx.actorEmployeeId ?? null };
  const reason = ctx.reason ?? null;
  const audits: AuditEntry[] = [];
  const history: (typeof vacationRequestHistory.$inferInsert)[] = [];
  let changed = false;

  // ---------- заявки ----------
  const prevReq = new Map(prev.requests.map((r) => [r.id, r]));
  const nextReqIds = new Set(rows.requests.map((r) => r.id));
  const reqUpserts: RequestRow[] = [];
  for (const row of rows.requests) {
    const old = prevReq.get(row.id);
    const after = rowToRequest(row);
    if (!old) {
      reqUpserts.push(row);
      audits.push({ ...actor, action: 'create', entity: 'vacations.request', entityId: String(row.id), after: { reason, ...after } });
      history.push({
        requestId: row.id,
        kind: 'create',
        ...actor,
        reason,
        statusAfter: textOrNull(after.status),
        approvalStepAfter: textOrNull(after.approval_step),
        startAfter: textOrNull(after.start),
        endAfter: textOrNull(after.end)
      });
      continue;
    }
    const sameContent = requestKey(old) === requestKey(row);
    if (sameContent && old.bucketYear === row.bucketYear && old.position === row.position) continue;
    reqUpserts.push(row);
    const before = rowToRequest(old);
    if (!sameContent || old.bucketYear !== row.bucketYear) {
      audits.push({
        ...actor,
        action: 'update',
        entity: 'vacations.request',
        entityId: String(row.id),
        before: old.bucketYear !== row.bucketYear ? { bucketYear: old.bucketYear, ...before } : before,
        after: { reason, ...(old.bucketYear !== row.bucketYear ? { bucketYear: row.bucketYear } : {}), ...after }
      });
    }
    if (
      before.status !== after.status ||
      before.approval_step !== after.approval_step ||
      before.start !== after.start ||
      before.end !== after.end
    ) {
      history.push({
        requestId: row.id,
        kind: 'update',
        ...actor,
        reason,
        statusBefore: textOrNull(before.status),
        statusAfter: textOrNull(after.status),
        approvalStepBefore: textOrNull(before.approval_step),
        approvalStepAfter: textOrNull(after.approval_step),
        startBefore: textOrNull(before.start),
        startAfter: textOrNull(after.start),
        endBefore: textOrNull(before.end),
        endAfter: textOrNull(after.end)
      });
    }
  }
  const reqDeletes = prev.requests.filter((r) => !nextReqIds.has(r.id));
  for (const r of reqDeletes) {
    const before = rowToRequest(r);
    audits.push({ ...actor, action: 'delete', entity: 'vacations.request', entityId: String(r.id), before, after: reason ? { reason } : null });
    history.push({
      requestId: r.id,
      kind: 'delete',
      ...actor,
      reason,
      statusBefore: textOrNull(before.status),
      approvalStepBefore: textOrNull(before.approval_step),
      startBefore: textOrNull(before.start),
      endBefore: textOrNull(before.end)
    });
  }

  // ---------- брони ----------
  const prevRes = new Map(prev.reservations.map((r) => [r.id, r]));
  const nextResIds = new Set(rows.reservations.map((r) => r.id));
  const resUpserts: ReservationRow[] = [];
  for (const row of rows.reservations) {
    const old = prevRes.get(row.id);
    if (!old) {
      resUpserts.push(row);
      audits.push({ ...actor, action: 'create', entity: 'vacations.reservation', entityId: String(row.id), after: { reason, ...rowToReservation(row) } });
      continue;
    }
    const sameContent = reservationKey(old) === reservationKey(row);
    if (sameContent && old.bucketYear === row.bucketYear && old.position === row.position) continue;
    resUpserts.push(row);
    if (!sameContent || old.bucketYear !== row.bucketYear) {
      audits.push({
        ...actor,
        action: 'update',
        entity: 'vacations.reservation',
        entityId: String(row.id),
        before: rowToReservation(old),
        after: { reason, ...rowToReservation(row) }
      });
    }
  }
  const resDeletes = prev.reservations.filter((r) => !nextResIds.has(r.id));
  for (const r of resDeletes) {
    audits.push({ ...actor, action: 'delete', entity: 'vacations.reservation', entityId: String(r.id), before: rowToReservation(r), after: reason ? { reason } : null });
  }

  // ---------- применяем ----------
  for (const part of chunks(reqDeletes.map((r) => r.id), 1000)) {
    await tx.delete(vacationRequests).where(inArray(vacationRequests.id, part));
  }
  for (const part of chunks(reqUpserts)) {
    await tx
      .insert(vacationRequests)
      .values(part.map((r) => ({ ...r, updatedAt: new Date() })))
      .onConflictDoUpdate({ target: vacationRequests.id, set: excludedSet(vacationRequests, ['id', 'createdAt']) });
  }
  for (const part of chunks(resDeletes.map((r) => r.id), 1000)) {
    await tx.delete(vacationReservations).where(inArray(vacationReservations.id, part));
  }
  for (const part of chunks(resUpserts)) {
    await tx
      .insert(vacationReservations)
      .values(part.map((r) => ({ ...r, updatedAt: new Date() })))
      .onConflictDoUpdate({ target: vacationReservations.id, set: excludedSet(vacationReservations, ['id', 'createdAt']) });
  }
  if (stateKey(prev.state) !== stateKey(rows.state)) {
    await tx
      .insert(vacationState)
      .values({ ...rows.state, updatedAt: new Date() })
      .onConflictDoUpdate({ target: vacationState.id, set: excludedSet(vacationState, ['id']) });
    const diff = stateChanges(prev.state, rows.state);
    if (Object.keys(diff).length) {
      audits.push({ ...actor, action: 'update', entity: 'vacations.state', entityId: '1', after: { reason, ...diff } });
    }
    changed = true;
  }
  for (const part of chunks(history)) await tx.insert(vacationRequestHistory).values(part);
  for (const part of chunks(audits, 200)) await writeAudit(tx, part);
  changed ||= reqUpserts.length + reqDeletes.length + resUpserts.length + resDeletes.length > 0;
  return { changed };
}

/**
 * Postgres-реализация хранилища отпусков.
 * Чтение — один снимок (repeatable read): счётчики и заявки всегда согласованы.
 * Мутация — как в JSON: строго по очереди внутри процесса, и плюс транзакция под
 * pg_advisory_xact_lock(VACATIONS_WRITE_LOCK_KEY), поэтому синк/сверка Bitrix внутри
 * mutateVacations видит последнее состояние и пишет поверх него, а не поверх устаревшего.
 * Без кэша: ~сотни строк, чтение ~1–3 мс.
 */
export function createPgVacationsRepo(db: Db): VacationsRepo {
  const enqueue = createMutationQueue();

  const readRaw = () =>
    db.transaction(async (tx) => {
      const r = await loadVacationRows(tx);
      return rowsToState(r.state, r.requests, r.reservations);
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' });

  const writeRaw = (state: PersistedVacationState, ctx?: VacationWriteContext) =>
    enqueue(() =>
      db.transaction(async (tx) => {
        await lockVacations(tx);
        await writeVacationDiff(tx, await loadVacationRows(tx), state, ctx);
      })
    );

  const mutateRaw: VacationsRepo['mutateRaw'] = (fn, ctx) =>
    enqueue(() =>
      db.transaction(async (tx) => {
        await lockVacations(tx);
        const prev = await loadVacationRows(tx);
        const current = structuredClone(rowsToState(prev.state, prev.requests, prev.reservations));
        const next = await fn(current);
        await writeVacationDiff(tx, prev, next, ctx);
      })
    );

  return { backend: 'postgres', readRaw, writeRaw, mutateRaw };
}
