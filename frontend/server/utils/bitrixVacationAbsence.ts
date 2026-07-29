import type { VacationRequest, VacationStoreState } from './vacationsStore';
import { bitrixRest, bitrixWebhookRest } from './bitrixClient';
import { isBitrixWebhookConfigured, getBitrixWebhookUrl } from './bitrixConfig';
import { findEmployeeByName, readEmployees } from './employeesStore';
import {
  getBitrixServiceAccessToken,
  hasBitrixOAuthServiceToken
} from './bitrixOAuthServiceToken';

export type BitrixVacationSyncStatus = 'synced' | 'failed' | 'skipped';

type BitrixListRow = {
  ID?: string | number;
  NAME?: string;
  IBLOCK_TYPE_ID?: string;
};

type BitrixFieldMeta = {
  FIELD_ID?: string;
  NAME?: string;
  TYPE?: string;
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

const absenceUserPropertyEnv = () =>
  String(process.env.BITRIX_ABSENCE_PROPERTY_USER || '').trim();

const absenceTypePropertyEnv = () =>
  String(process.env.BITRIX_ABSENCE_PROPERTY_TYPE || '').trim();

/** Подпись в графике отсутствий Bitrix — не comment заявки (там «Импорт из Excel» и служебное). */
export const BITRIX_ABSENCE_DISPLAY_NAME = 'Отпуск ежегодный (VBI HR)';

/** Владелец входящего вебхука (`/rest/{userId}/…`) — сюда ошибочно падали calendar.event.add. */
export function webhookOwnerUserId(): number | null {
  try {
    const url = getBitrixWebhookUrl();
    const match = url.match(/\/rest\/(\d+)\//);
    const id = Number(match?.[1]);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * Один канал на всех сотрудников: OAuth приложения (как колокольчик) или входящий вебхук.
 * Не нужен вебхук на каждого — в lists.element.add передаём PROPERTY_USER = bitrix_user_id.
 */
async function bitrixCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const errors: string[] = [];

  if (await hasBitrixOAuthServiceToken()) {
    const token = await getBitrixServiceAccessToken();
    if (token) {
      try {
        return await bitrixRest<T>(method, params, token);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    } else {
      errors.push('OAuth service token недоступен');
    }
  }

  if (isBitrixWebhookConfigured()) {
    try {
      return await bitrixWebhookRest<T>(method, params);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(
    errors.length
      ? errors.join(' | ')
      : 'Нет Bitrix OAuth service token и BITRIX_WEBHOOK_URL'
  );
}

let cachedAbsenceIblockId: number | null | undefined;
let cachedUserProperty: string | null = null;
let cachedTypeProperty: string | null = null;

export async function resolveAbsenceIblockId(): Promise<number | null> {
  if (cachedAbsenceIblockId !== undefined) return cachedAbsenceIblockId;

  const fromEnv = Number(process.env.BITRIX_ABSENCE_IBLOCK_ID);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    cachedAbsenceIblockId = fromEnv;
    return fromEnv;
  }

  try {
    const lists = await bitrixCall<BitrixListRow[]>('lists.get', {
      IBLOCK_TYPE_ID: absenceIblockTypeId()
    });
    const found = lists.find((row) => /график.*отсутств/i.test(String(row.NAME || '')));
    const id = Number(found?.ID);
    cachedAbsenceIblockId = Number.isFinite(id) && id > 0 ? id : null;
  } catch (error) {
    console.warn(
      '[bitrix-vacation] lists.get failed:',
      error instanceof Error ? error.message : String(error)
    );
    cachedAbsenceIblockId = null;
  }

  return cachedAbsenceIblockId;
}

async function resolveAbsencePropertyCodes(iblockId: number): Promise<{
  userProperty: string;
  typeProperty: string;
}> {
  const fromEnvUser = absenceUserPropertyEnv();
  const fromEnvType = absenceTypePropertyEnv();
  if (fromEnvUser && fromEnvType) {
    return { userProperty: fromEnvUser, typeProperty: fromEnvType };
  }
  if (cachedUserProperty && cachedTypeProperty) {
    return { userProperty: cachedUserProperty, typeProperty: cachedTypeProperty };
  }

  let userProperty = fromEnvUser || 'PROPERTY_USER';
  let typeProperty = fromEnvType || 'PROPERTY_ABSENCE_TYPE';

  try {
    const fields = await bitrixCall<Record<string, BitrixFieldMeta>>('lists.field.get', {
      IBLOCK_TYPE_ID: absenceIblockTypeId(),
      IBLOCK_ID: iblockId
    });
    for (const [code, meta] of Object.entries(fields || {})) {
      const name = String(meta?.NAME || '').toLowerCase();
      if (!fromEnvUser && /сотрудник|пользователь|user/.test(name) && /PROPERTY_/i.test(code)) {
        userProperty = code;
      }
      if (!fromEnvType && /тип.*отсутств|absence.?type|тип отсутствия/.test(name)) {
        typeProperty = code;
      }
    }
  } catch (error) {
    console.warn(
      '[bitrix-vacation] lists.field.get failed, using defaults:',
      error instanceof Error ? error.message : String(error)
    );
  }

  cachedUserProperty = userProperty;
  cachedTypeProperty = typeProperty;
  return { userProperty, typeProperty };
}

const createViaAbsenceIblock = async (params: {
  bitrixUserId: number;
  start: string;
  end: string;
  requestId: number;
}): Promise<number> => {
  const iblockId = await resolveAbsenceIblockId();
  if (!iblockId) {
    throw new Error(
      'Не найден инфоблок графика отсутствий. Задайте BITRIX_ABSENCE_IBLOCK_ID и право lists у OAuth/вебхука.'
    );
  }

  const { userProperty, typeProperty } = await resolveAbsencePropertyCodes(iblockId);

  const fields: Record<string, unknown> = {
    NAME: BITRIX_ABSENCE_DISPLAY_NAME,
    ACTIVE_FROM: toBitrixDateTime(params.start, false),
    ACTIVE_TO: toBitrixDateTime(params.end, true),
    [userProperty]: params.bitrixUserId,
    [typeProperty]: absenceTypeEnum()
  };

  return bitrixCall<number>('lists.element.add', {
    IBLOCK_TYPE_ID: absenceIblockTypeId(),
    IBLOCK_ID: iblockId,
    ELEMENT_CODE: `vbi-hr-vac-${params.requestId}`,
    FIELDS: fields
  });
};

const updateViaAbsenceIblock = async (params: {
  absenceId: number;
  bitrixUserId: number;
  start: string;
  end: string;
}): Promise<void> => {
  const iblockId = await resolveAbsenceIblockId();
  if (!iblockId) {
    throw new Error(
      'Не найден инфоблок графика отсутствий. Задайте BITRIX_ABSENCE_IBLOCK_ID и право lists у OAuth/вебхука.'
    );
  }

  const { userProperty, typeProperty } = await resolveAbsencePropertyCodes(iblockId);

  await bitrixCall('lists.element.update', {
    IBLOCK_TYPE_ID: absenceIblockTypeId(),
    IBLOCK_ID: iblockId,
    ELEMENT_ID: params.absenceId,
    FIELDS: {
      NAME: BITRIX_ABSENCE_DISPLAY_NAME,
      ACTIVE_FROM: toBitrixDateTime(params.start, false),
      ACTIVE_TO: toBitrixDateTime(params.end, true),
      [userProperty]: params.bitrixUserId,
      [typeProperty]: absenceTypeEnum()
    }
  });
};

const deleteViaAbsenceIblock = async (absenceId: number): Promise<void> => {
  const iblockId = await resolveAbsenceIblockId();
  if (!iblockId) {
    throw new Error(
      'Не найден инфоблок графика отсутствий. Задайте BITRIX_ABSENCE_IBLOCK_ID и право lists у OAuth/вебхука.'
    );
  }

  await bitrixCall('lists.element.delete', {
    IBLOCK_TYPE_ID: absenceIblockTypeId(),
    IBLOCK_ID: iblockId,
    ELEMENT_ID: absenceId
  });
};

const deleteViaCalendarEvent = async (eventId: number): Promise<void> => {
  const ownerUserId = webhookOwnerUserId();
  if (!ownerUserId) {
    throw new Error('Не удалось определить владельца вебхука для calendar.event.delete');
  }
  await bitrixCall('calendar.event.delete', {
    type: 'user',
    ownerId: ownerUserId,
    id: eventId
  });
};

const clearBitrixSyncFields = (): Partial<VacationRequest> => ({
  bitrix_absence_id: undefined,
  bitrix_sync_status: undefined,
  bitrix_sync_method: undefined,
  bitrix_synced_at: undefined,
  bitrix_sync_error: undefined
});

const resolveBitrixUserId = async (employeeName: string): Promise<number> => {
  const employee = await findEmployeeByName(employeeName);
  const bitrixUserId = employee?.bitrix_user_id ?? employee?.platform_user_id ?? employee?.id;
  if (!bitrixUserId) {
    throw new Error(`У сотрудника «${employeeName}» нет bitrix_user_id`);
  }
  return bitrixUserId;
};

/** Удалить пальму в Bitrix (lists или legacy calendar). */
export const removeVacationAbsenceFromBitrix = async (
  request: VacationRequest
): Promise<void> => {
  const absenceId = Number(request.bitrix_absence_id);
  if (!Number.isFinite(absenceId) || absenceId <= 0) return;

  if (request.bitrix_sync_method === 'calendar.event.add') {
    await deleteViaCalendarEvent(absenceId);
    return;
  }

  await deleteViaAbsenceIblock(absenceId);
};

export const pushVacationToBitrixAbsence = async (
  request: VacationRequest
): Promise<{
  absenceId: number;
  method: string;
}> => {
  const bitrixUserId = await resolveBitrixUserId(request.employee);

  // Только инфоблок «График отсутствий» — пишет пальму нужному сотруднику.
  // calendar.event.add через входящий вебхук кладёт события владельцу вебхука (у нас 2684),
  // а не в ownerId — поэтому запасной путь отключён намеренно.
  const absenceId = await createViaAbsenceIblock({
    bitrixUserId,
    start: request.start,
    end: request.end,
    requestId: request.id
  });
  return { absenceId, method: 'lists.element.add' };
};

const updateVacationAbsenceInBitrix = async (
  request: VacationRequest
): Promise<{ absenceId: number; method: string }> => {
  const absenceId = Number(request.bitrix_absence_id);
  if (!Number.isFinite(absenceId) || absenceId <= 0) {
    return pushVacationToBitrixAbsence(request);
  }

  // Legacy calendar — удаляем и создаём правильную запись в графике отсутствий.
  if (request.bitrix_sync_method === 'calendar.event.add') {
    try {
      await deleteViaCalendarEvent(absenceId);
    } catch (error) {
      console.warn(
        `[bitrix-vacation] calendar delete before update failed for #${request.id}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
    return pushVacationToBitrixAbsence(request);
  }

  const bitrixUserId = await resolveBitrixUserId(request.employee);
  await updateViaAbsenceIblock({
    absenceId,
    bitrixUserId,
    start: request.start,
    end: request.end
  });
  return { absenceId, method: 'lists.element.update' };
};

const needsBitrixCreate = (request: VacationRequest, previous?: VacationRequest): boolean => {
  if (request.status !== 'approved') return false;
  if (request.bitrix_sync_status === 'synced' && request.bitrix_absence_id) return false;
  if (!previous) return true;
  return previous.status !== 'approved';
};

const needsBitrixDateUpdate = (request: VacationRequest, previous?: VacationRequest): boolean => {
  if (!previous) return false;
  if (request.status !== 'approved' || previous.status !== 'approved') return false;
  if (!request.bitrix_absence_id) return false;
  return request.start !== previous.start || request.end !== previous.end;
};

const needsBitrixRemove = (request: VacationRequest, previous?: VacationRequest): boolean => {
  if (!previous) return false;
  if (previous.status !== 'approved') return false;
  if (request.status === 'approved') return false;
  return Boolean(previous.bitrix_absence_id || request.bitrix_absence_id);
};

export const syncApprovedVacationsToBitrix = async (
  previous: VacationStoreState,
  next: VacationStoreState
): Promise<VacationStoreState> => {
  if (!(await hasBitrixOAuthServiceToken()) && !isBitrixWebhookConfigured()) return next;

  await readEmployees();

  const prevMap = new Map(flattenRequests(previous).map((item) => [item.id, item]));
  let state = next;

  for (const request of flattenRequests(next)) {
    const prev = prevMap.get(request.id);

    if (needsBitrixRemove(request, prev)) {
      const absenceSource = {
        ...request,
        bitrix_absence_id: request.bitrix_absence_id ?? prev?.bitrix_absence_id,
        bitrix_sync_method: request.bitrix_sync_method ?? prev?.bitrix_sync_method
      };
      try {
        await removeVacationAbsenceFromBitrix(absenceSource);
        state = updateRequestInState(state, request.id, clearBitrixSyncFields());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[bitrix-vacation] remove failed for request #${request.id}:`, message);
        state = updateRequestInState(state, request.id, {
          bitrix_sync_status: 'failed',
          bitrix_sync_error: `remove: ${message}`,
          bitrix_synced_at: new Date().toISOString()
        });
      }
      continue;
    }

    if (needsBitrixDateUpdate(request, prev)) {
      try {
        const { absenceId, method } = await updateVacationAbsenceInBitrix(request);
        state = updateRequestInState(state, request.id, {
          bitrix_absence_id: absenceId,
          bitrix_sync_status: 'synced',
          bitrix_sync_method: method,
          bitrix_synced_at: new Date().toISOString(),
          bitrix_sync_error: undefined
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[bitrix-vacation] update failed for request #${request.id}:`, message);
        state = updateRequestInState(state, request.id, {
          bitrix_sync_status: 'failed',
          bitrix_sync_error: `update: ${message}`,
          bitrix_synced_at: new Date().toISOString()
        });
      }
      continue;
    }

    if (!needsBitrixCreate(request, prev)) continue;

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
        bitrix_sync_status: 'failed',
        bitrix_sync_error: message,
        bitrix_synced_at: new Date().toISOString()
      });
    }
  }

  return state;
};

export type BitrixAbsenceRepairResult = {
  deletedCalendarEvents: Array<{ requestId: number; eventId: number; ok: boolean; error?: string }>;
  resynced: Array<{ requestId: number; employee: string; ok: boolean; absenceId?: number; error?: string }>;
  webhookOwnerUserId: number | null;
};

/**
 * Удаляет ошибочно созданные calendar.event у владельца вебхука и заново
 * пушит через lists.element.add нужному сотруднику.
 */
export async function repairMisplacedCalendarAbsences(
  state: VacationStoreState,
  options: { ownerUserId?: number | null; resync?: boolean } = {}
): Promise<{ state: VacationStoreState; result: BitrixAbsenceRepairResult }> {
  const ownerUserId = options.ownerUserId ?? webhookOwnerUserId();
  const resync = options.resync !== false;
  await readEmployees();

  const result: BitrixAbsenceRepairResult = {
    deletedCalendarEvents: [],
    resynced: [],
    webhookOwnerUserId: ownerUserId
  };

  let next = state;
  const misplaced = flattenRequests(state).filter(
    (row) => row.bitrix_sync_method === 'calendar.event.add' && row.bitrix_absence_id
  );

  for (const request of misplaced) {
    const eventId = Number(request.bitrix_absence_id);
    let ok = false;
    let error: string | undefined;

    if (!ownerUserId) {
      error = 'Не удалось определить владельца вебхука для calendar.event.delete';
    } else {
      try {
        await bitrixCall('calendar.event.delete', {
          type: 'user',
          ownerId: ownerUserId,
          id: eventId
        });
        ok = true;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
    }

    result.deletedCalendarEvents.push({ requestId: request.id, eventId, ok, error });

    next = updateRequestInState(next, request.id, {
      bitrix_absence_id: undefined,
      bitrix_sync_status: undefined,
      bitrix_sync_method: undefined,
      bitrix_synced_at: undefined,
      bitrix_sync_error: undefined
    });
  }

  if (resync) {
    for (const request of flattenRequests(next)) {
      const wasMisplaced = misplaced.some((row) => row.id === request.id);
      if (!wasMisplaced || request.status !== 'approved') continue;

      try {
        const { absenceId, method } = await pushVacationToBitrixAbsence(request);
        next = updateRequestInState(next, request.id, {
          bitrix_absence_id: absenceId,
          bitrix_sync_status: 'synced',
          bitrix_sync_method: method,
          bitrix_synced_at: new Date().toISOString(),
          bitrix_sync_error: undefined
        });
        result.resynced.push({
          requestId: request.id,
          employee: request.employee,
          ok: true,
          absenceId
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        next = updateRequestInState(next, request.id, {
          bitrix_sync_status: 'failed',
          bitrix_sync_error: message,
          bitrix_synced_at: new Date().toISOString()
        });
        result.resynced.push({
          requestId: request.id,
          employee: request.employee,
          ok: false,
          error: message
        });
      }
    }
  }

  return { state: next, result };
}
