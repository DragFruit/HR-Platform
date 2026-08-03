import type { VacationRequest, VacationStoreState } from './vacationsStore';
import { bitrixRest, bitrixWebhookRest } from './bitrixClient';
import { isBitrixWebhookConfigured } from './bitrixConfig';
import { findEmployeeByName, readEmployees } from './employeesStore';
import { getBitrixServiceAccessToken, hasBitrixOAuthServiceToken } from './bitrixOAuthServiceToken';

export type BitrixVacationSyncStatus = 'synced' | 'failed' | 'skipped';

type BitrixListRow = {
  ID?: string | number;
  NAME?: string;
  IBLOCK_TYPE_ID?: string;
};

const errorMessage = (err: unknown): string => {
  if (err && typeof err === 'object' && 'statusMessage' in err) {
    return String((err as { statusMessage?: string }).statusMessage || '');
  }
  return err instanceof Error ? err.message : String(err);
};

/** Битый/отозванный входящий вебхук Bitrix. */
const isCredentialsError = (message: string): boolean => {
  const m = message.toLowerCase();
  return (
    m.includes('invalid request credentials') ||
    m.includes('invalid_credentials') ||
    m.includes('no_auth_found') ||
    m.includes('expired_token') ||
    m.includes('invalid_token')
  );
};

/**
 * Сначала входящий вебхук; при ошибке credentials — OAuth service token
 * (тот же, что для im.notify). Иначе отпуск «согласован», а в Bitrix пусто.
 */
const bitrixVacationRest = async <T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> => {
  if (isBitrixWebhookConfigured()) {
    try {
      return await bitrixWebhookRest<T>(method, params);
    } catch (err) {
      const message = errorMessage(err);
      if (!isCredentialsError(message)) throw err;
      console.warn(
        `[bitrix-vacation] webhook credentials failed for ${method}, trying OAuth service token`
      );
    }
  }

  const accessToken = await getBitrixServiceAccessToken();
  if (!accessToken) {
    throw new Error(
      `${method}: вебхук Bitrix недоступен (Invalid credentials) и нет OAuth service token — ` +
        'админу нужен повторный вход через Битрикс24 или актуальный BITRIX_WEBHOOK_URL'
    );
  }

  return bitrixRest<T>(method, params, accessToken);
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
    const lists = await bitrixVacationRest<BitrixListRow[]>('lists.get', {
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

  return bitrixVacationRest<number>('lists.element.add', {
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
  bitrixVacationRest<number>('calendar.event.add', {
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
    // Вебхука нет — всё равно пробуем OAuth (админский service token).
    const token = await getBitrixServiceAccessToken();
    if (!token) {
      throw new Error('BITRIX_WEBHOOK_URL не настроен и нет OAuth service token');
    }
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
  let iblockErrorMessage = '';

  try {
    absenceId = await createViaAbsenceIblock(payload);
    method = 'lists.element.add';
  } catch (iblockError) {
    iblockErrorMessage = errorMessage(iblockError);
    console.warn('[bitrix-vacation] iblock sync failed, trying calendar.event.add:', iblockErrorMessage);
    try {
      absenceId = await createViaCalendarAbsent(payload);
      method = 'calendar.event.add';
      return { absenceId, method };
    } catch (calendarError) {
      const calendarMessage = errorMessage(calendarError);
      throw new Error(
        `iblock: ${iblockErrorMessage || 'unknown'}; calendar.event.add: ${calendarMessage}`
      );
    }
  }

  // Пальма в графике отсутствий + событие в календаре Bitrix (как раньше визуально на сетке).
  // Ошибка календаря не откатывает lists — предупреждение во встречах уже даёт iblock.
  try {
    const calendarEventId = await createViaCalendarAbsent(payload);
    method = `lists.element.add+calendar.event.add:${calendarEventId}`;
  } catch (calendarError) {
    const message = errorMessage(calendarError);
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
  const hasWebhook = isBitrixWebhookConfigured();
  const hasOAuth = await hasBitrixOAuthServiceToken();
  if (!hasWebhook && !hasOAuth) return next;

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
      const message = errorMessage(error);
      console.error(`[bitrix-vacation] sync failed for request #${request.id}:`, message);
      state = updateRequestInState(state, request.id, {
        bitrix_sync_status:
          message.includes('не настроен') && message.includes('нет OAuth') ? 'skipped' : 'failed',
        bitrix_sync_error: message,
        bitrix_synced_at: new Date().toISOString()
      });
    }
  }

  return state;
};
