import type { adminNotifications } from '../db/schema';
import {
  isBool,
  isInt,
  isoTimestamp,
  isStr,
  isStrArray,
  mapFromColumns,
  mapToColumns,
  nullColumns,
  type FieldSpecs
} from '../db/fieldMapping';
import type { AdminNotification } from './types';

export type AdminNotificationRow = typeof adminNotifications.$inferInsert;
type AdminNotificationSelect = typeof adminNotifications.$inferSelect;

const text = (col: string) => ({ col, ok: isStr });
const int = (col: string) => ({ col, ok: isInt });

/** Поле JSON → колонка (id и kind обрабатываются отдельно: это ключ и обязательное поле). */
export const ADMIN_NOTIFICATION_FIELDS: FieldSpecs = {
  employee_id: int('employeeId'),
  employee_name: text('employeeName'),
  created_at: isoTimestamp('createdAt'),
  admin_seen: { col: 'adminSeen', ok: isBool },
  bitrix_user_id: int('bitrixUserId'),
  field: text('field'),
  platform_value: text('platformValue'),
  bitrix_value: text('bitrixValue'),
  years: int('years'),
  sku: text('sku'),
  order_id: text('orderId'),
  idea_id: text('ideaId'),
  idea_title: text('ideaTitle'),
  vacation_request_id: int('vacationRequestId'),
  vacation_start: text('vacationStart'),
  vacation_end: text('vacationEnd'),
  error_message: text('errorMessage'),
  vpn_peer_names: { col: 'vpnPeerNames', ok: isStrArray },
  vpn_panel: text('vpnPanel'),
  sales_period: text('salesPeriod'),
  sales_period_label: text('salesPeriodLabel'),
  stars: int('stars'),
  comment: text('comment'),
  page: text('page'),
  photo_id: text('photoId'),
  photo_ids: { col: 'photoIds', ok: isStrArray }
};

/**
 * Объект из файла / из бизнес-логики → строка. null — без непустого строкового id или kind
 * (ключ и тип не выдумываем; при импорте такие считаются skipped).
 * seen_at здесь не заполняется — его ставит репозиторий при смене admin_seen.
 */
export function adminNotificationToRow(item: Record<string, unknown>, position: number): AdminNotificationRow | null {
  if (!isStr(item.id) || !item.id) return null;
  if (!isStr(item.kind) || !item.kind) return null;
  const { cols, sourceKeys, extra } = mapToColumns(item, ADMIN_NOTIFICATION_FIELDS, ['id', 'kind']);
  return {
    ...(nullColumns(ADMIN_NOTIFICATION_FIELDS) as Partial<AdminNotificationRow>),
    ...(cols as Partial<AdminNotificationRow>),
    id: item.id,
    kind: item.kind,
    position,
    sourceKeys,
    extra
  } as AdminNotificationRow;
}

/** Строка → тот же объект, что лежал в файле (те же ключи, тот же порядок). */
export function rowToAdminNotification(row: AdminNotificationSelect | AdminNotificationRow): AdminNotification {
  return mapFromColumns(
    row as Record<string, unknown>,
    ADMIN_NOTIFICATION_FIELDS,
    row.sourceKeys,
    row.extra as Record<string, unknown> | null,
    { id: row.id, kind: row.kind }
  ) as AdminNotification;
}

/** Как объект выглядит в файле: JSON.stringify выкидывает undefined. */
export const asStored = <T>(item: T): T => JSON.parse(JSON.stringify(item)) as T;
