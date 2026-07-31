import type { VacationRequest, VacationStoreState } from './vacationsStore';
import { bitrixWebhookRest } from './bitrixClient';
import { isBitrixWebhookConfigured } from './bitrixConfig';
import { findEmployeeByName, readEmployees } from './employeesStore';

export type BitrixVacationSyncStatus = 'synced' | 'failed' | 'skipped';

type BitrixListRow = {
  ID?: string | number;
  NAME?: string;
  IBLOCK_TYPE_ID?: string;
};

const flattenRequests = (state: VacationStoreState): VacationRequest[] =>
  Object.values(state.requestsByYear).flat();

const updateRequestInState = (
  state: VacationStoreState,
  requestId: number,
  patch: Partial<VacationRequest>
): VacationStoreState => {
  const next: VacationStoreState = {
    ...state,
    requestsByYear: { ...state.requestsByYear }
  };

  for (const yearKey of Object.keys(next.requestsByYear)) {
    const list = next.requestsByYear[yearKey];
    if (!list) continue;
    const index = list.findIndex((item) => item.id === requestId);
    if (index === -1) continue;
    const updated = [...list];
    updated[index] = { ...updated[index], ...patch };
    next.requestsByYear[yearKey] = updated;
    return next;
  }

  return state;
};

export const toBitrixDateTime = (isoDate: string, endOfDay = false): string => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d)}.${pad(m)}.${y} ${endOfDay ? '23:59:59' : '00:00:00'}`;
};

const absenceIblockTypeId = () =>
  String(process.env.BITRIX_ABSENCE_IBLOCK_TYPE_ID || 'structure').trim();

const absenceTypeEnum = () => String(process.env.BITRIX_ABSENCE_TYPE_ENUM || '1').trim();

const absenceUserProperty = () =>
  String(process.env.BITRIX_ABSENCE_PROPERTY_USER || 'PROPERTY_USER').trim();

const absenceTypeProperty = () =>
  String(process.env.BITRIX_ABSENCE_PROPERTY_TYPE || 'PROPERTY_ABSENCE_TYPE').trim();

let cachedAbsenceIblockId: number | null | undefined;

export async function resolveAbsenceIblockId(): Promise<number | null> {
  if (cachedAbsenceIblockId !== undefined) return cachedAbsenceIblockId;

  const fromEnv = Number(process.env.BITRIX_ABSENCE_IBLOCK_ID);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    cachedAbsenceIblockId = fromEnv;
    return fromEnv;
  }

  if (!isBitrixWebhookConfigured()) {
    cachedAbsenceIblockId = null;
    return null;
  }

  try {
    const lists = await bitrixWebhookRest<BitrixListRow[]>('lists.get', {
      IBLOCK_TYPE_ID: absenceIblockTypeId()
    });
    const found = lists.find((row) => /график.*отсутств/i.test(String(row.NAME || '')));
    const id = Number(found?.ID);
    cachedAbsenceIblockId = Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    cachedAbsenceIblockId = null;
  }

  return cachedAbsenceIblockId;
}

const createViaAbsenceIblock = async (params: {
  bitrixUserId: number;
  start: string;
  end: string;
  comment: string;
  requestId: number;
}): Promise<number> => {
  const iblockId = await resolveAbsenceIblockId();
  if (!iblockId) {
    throw new Error('Не найден инфоблок графика отсутствий (BITRIX_ABSENCE_IBLOCK_ID)');
  }

  const fields: Record<string, unknown> = {
    NAME: params.comment?.trim() || 'Отпуск ежегодный (VBI HR)',
    ACTIVE_FROM: toBitrixDateTime(params.start, false),
    ACTIVE_TO: toBitrixDateTime(params.end, true),
    [absenceUserProperty()]: params.bitrixUserId,
    [absenceTypeProperty()]: absenceTypeEnum()
  };

  return bitrixWebhookRest<number>('lists.element.add', {
    IBLOCK_TYPE_ID: absenceIblockTypeId(),
    IBLOCK_ID: iblockId,
    ELEMENT_CODE: `vbi-hr-vac-${params.requestId}`,
    FIELDS: fields
  });
};

const createViaCalendarAbsent = async (params: {
  bitrixUserId: number;
  start: string;
  end: string;
  comment: string;
}): Promise<number> =>
  bitrixWebhookRest<number>('calendar.event.add', {
    type: 'user',
    ownerId: params.bitrixUserId,
    name: 'Отпуск ежегодный (VBI HR)',
    description: params.comment?.trim() || 'Согласовано в VBI HR',
    from: params.start,
    to: params.end,
    skip_time: 'Y',
    accessibility: 'absent',
    auto_detect_section: 'Y'
  });

export const pushVacationToBitrixAbsence = async (request: VacationRequest): Promise<{
  absenceId: number;
  method: string;
}> => {
  if (!isBitrixWebhookConfigured()) {
    throw new Error('BITRIX_WEBHOOK_URL не настроен');
  }

  const employee = await findEmployeeByName(request.employee);
  const bitrixUserId = employee?.bitrix_user_id ?? employee?.platform_user_id ?? employee?.id;
  if (!bitrixUserId) {
    throw new Error(`У сотрудника «${request.employee}» нет bitrix_user_id`);
  }

  const payload = {
    bitrixUserId,
    start: request.start,
    end: request.end,
    comment: request.comment,
    requestId: request.id
  };

  let absenceId: number;
  let method: string;

  try {
    absenceId = await createViaAbsenceIblock(payload);
    method = 'lists.element.add';
  } catch (iblockError) {
    const message = iblockError instanceof Error ? iblockError.message : String(iblockError);
    console.warn('[bitrix-vacation] iblock sync failed, trying calendar.event.add:', message);
    absenceId = await createViaCalendarAbsent(payload);
    method = 'calendar.event.add';
    return { absenceId, method };
  }

  // Пальма в графике отсутствий + событие в календаре Bitrix (как раньше визуально на сетке).
  // Ошибка календаря не откатывает lists — предупреждение во встречах уже даёт iblock.
  try {
    const calendarEventId = await createViaCalendarAbsent(payload);
    method = `lists.element.add+calendar.event.add:${calendarEventId}`;
  } catch (calendarError) {
    const message = calendarError instanceof Error ? calendarError.message : String(calendarError);
    console.warn(
      `[bitrix-vacation] calendar.event.add failed for request #${request.id}:`,
      message
    );
  }

  return { absenceId, method };
};

const needsBitrixSync = (request: VacationRequest, previous?: VacationRequest): boolean => {
  if (request.status !== 'approved') return false;
  if (request.bitrix_sync_status === 'synced' && request.bitrix_absence_id) return false;
  if (!previous) return true;
  return previous.status !== 'approved';
};

export const syncApprovedVacationsToBitrix = async (
  previous: VacationStoreState,
  next: VacationStoreState
): Promise<VacationStoreState> => {
  if (!isBitrixWebhookConfigured()) return next;

  await readEmployees();

  const prevMap = new Map(flattenRequests(previous).map((item) => [item.id, item]));
  let state = next;

  for (const request of flattenRequests(next)) {
    const prev = prevMap.get(request.id);
    if (!needsBitrixSync(request, prev)) continue;

    try {
      const { absenceId, method } = await pushVacationToBitrixAbsence(request);
      state = updateRequestInState(state, request.id, {
        bitrix_absence_id: absenceId,
        bitrix_sync_status: 'synced',
        bitrix_sync_method: method,
        bitrix_synced_at: new Date().toISOString(),
        bitrix_sync_error: undefined
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[bitrix-vacation] sync failed for request #${request.id}:`, message);
      state = updateRequestInState(state, request.id, {
        bitrix_sync_status: message.includes('не настроен') ? 'skipped' : 'failed',
        bitrix_sync_error: message,
        bitrix_synced_at: new Date().toISOString()
      });
    }
  }

  return state;
};
