import { auditLog } from './schema';
import type { Db } from './client';

type Tx = Pick<Db, 'insert'>;

export type AuditEntry = {
  action: string;
  entity: string;
  entityId?: string | null;
  /** id сотрудника (не ФИО); null — система / cron / интеграция. */
  actorEmployeeId?: number | null;
  before?: unknown;
  after?: unknown;
};

/** Запись в audit.audit_log; вызывать внутри той же транзакции, что и сама мутация. */
export async function writeAudit(tx: Tx, entries: AuditEntry | AuditEntry[]): Promise<void> {
  const list = Array.isArray(entries) ? entries : [entries];
  if (!list.length) return;
  await tx.insert(auditLog).values(
    list.map((e) => ({
      action: e.action,
      entity: e.entity,
      entityId: e.entityId ?? null,
      actorEmployeeId: e.actorEmployeeId ?? null,
      before: e.before ?? null,
      after: e.after ?? null
    }))
  );
}
