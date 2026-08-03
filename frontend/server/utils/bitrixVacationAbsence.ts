import type { VacationRequest, VacationStoreState } from './vacationsStore';
import { bitrixRest, bitrixWebhookRest } from './bitrixClient';
import { isBitrixWebhookConfigured } from './bitrixConfig';
import { findEmployeeByName, readEmployees } from './employeesStore';
import { getBitrixServiceAccessToken, hasBitrixOAuthServiceToken } from './bitrixOAuthServiceToken';
import { createBitrixVacationSyncFailedNotification } from './adminNotificationsStore';

export type BitrixVacationSyncStatus = 'synced' | 'failed' | 'skipped';

type BitrixListRow = {
  ID?: string | number;
  NAME?: string;
  IBLOCK_TYPE_ID?: string;
};

type AuthMode = 'webhook' | 'oauth';

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
 * Сначала входящий вебхук; при ошибке credentials — OAuth service token.
 * Возвращает режим auth: OAuth-токен часто принадлежит HR, который вошёл в платформу —
 * calendar.event.add с таким токеном может писать в календарь HR, а не сотрудника.
 */
const bitrixVacationRest = async <T>(
  method: string,
  params: Record<string, unknown>
): Promise<{ result: T; auth: AuthMode }> => {
  if (isBitrixWebhookConfigured()) {
    try {
      const result = await bitrixWebhookRest<T>(method, params);
      return { result, auth: 'webhook' };
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

  const result = await bitrixRest<T>(method, params, accessToken);
  return { result, auth: 'oauth' };
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

  try {
    const { result: lists } = await bitrixVacationRest<BitrixListRow[]>('lists.get', {
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

type AbsenceListElement = {
  ID?: string | number;
  CODE?: string;
  ACTIVE_FROM?: string;
  ACTIVE_TO?: string;
  PROPERTY_1?: Record<string, string>;
  PROPERTY_USER?: Record<string, string> | string | number;
};

const absenceElementUserId = (el: AbsenceListElement): number | null => {
  const raw = el.PROPERTY_1 || el.PROPERTY_USER;
  if (raw == null) return null;
  if (typeof raw === 'object') {
    const first = Object.values(raw)[0];
    const n = Number(first);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** ДД.ММ.ГГГГ → ГГГГ-ММ-ДД */
const bitrixDateToIso = (value: string | undefined): string => {
  const m = String(value || '')
    .trim()
    .match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
};

/**
 * Уже есть в графике отсутствий (ручной ввод или прошлый синк) —
 * не плодим дубликат, а привязываем заявку к существующему ID.
 */
const findExistingAbsenceElement = async (params: {
  bitrixUserId: number;
  start: string;
  end: string;
  requestId: number;
}): Promise<{ absenceId: number; auth: AuthMode } | null> => {
  const iblockId = await resolveAbsenceIblockId();
  if (!iblockId) return null;

  const code = `vbi-hr-vac-${params.requestId}`;
  try {
    const { result, auth } = await bitrixVacationRest<AbsenceListElement[]>('lists.element.get', {
      IBLOCK_TYPE_ID: absenceIblockTypeId(),
      IBLOCK_ID: iblockId,
      FILTER: { CODE: code }
    });
    const hit = (result || []).find((el) => Number(el.ID) > 0);
    if (hit) return { absenceId: Number(hit.ID), auth };
  } catch (err) {
    console.warn('[bitrix-vacation] lists.element.get by CODE failed:', errorMessage(err));
  }

  try {
    const { result, auth } = await bitrixVacationRest<AbsenceListElement[]>('lists.element.get', {
      IBLOCK_TYPE_ID: absenceIblockTypeId(),
      IBLOCK_ID: iblockId,
      FILTER: { [absenceUserProperty()]: params.bitrixUserId }
    });
    const hit = (result || []).find((el) => {
      if (absenceElementUserId(el) !== params.bitrixUserId) return false;
      return bitrixDateToIso(el.ACTIVE_FROM) === params.start && bitrixDateToIso(el.ACTIVE_TO) === params.end;
    });
    if (hit) return { absenceId: Number(hit.ID), auth };
  } catch (err) {
    console.warn('[bitrix-vacation] lists.element.get by user/dates failed:', errorMessage(err));
  }

  return null;
};

const createViaAbsenceIblock = async (params: {
  bitrixUserId: number;
  start: string;
  end: string;
  comment: string;
  requestId: number;
  employeeName: string;
}): Promise<{ absenceId: number; auth: AuthMode }> => {
  const iblockId = await resolveAbsenceIblockId();
  if (!iblockId) {
    throw new Error('Не найден инфоблок графика отсутствий (BITRIX_ABSENCE_IBLOCK_ID)');
  }

  const fields: Record<string, unknown> = {
    NAME: params.comment?.trim() || `Отпуск: ${params.employeeName} (VBI HR)`,
    ACTIVE_FROM: toBitrixDateTime(params.start, false),
    ACTIVE_TO: toBitrixDateTime(params.end, true),
    [absenceUserProperty()]: params.bitrixUserId,
    [absenceTypeProperty()]: absenceTypeEnum()
  };

  const { result, auth } = await bitrixVacationRest<number>('lists.element.add', {
    IBLOCK_TYPE_ID: absenceIblockTypeId(),
    IBLOCK_ID: iblockId,
    ELEMENT_CODE: `vbi-hr-vac-${params.requestId}`,
    FIELDS: fields
  });
  return { absenceId: result, auth };
};

export const pushVacationToBitrixAbsence = async (request: VacationRequest): Promise<{
  absenceId: number;
  method: string;
}> => {
  if (!isBitrixWebhookConfigured()) {
    const token = await getBitrixServiceAccessToken();
    if (!token) {
      throw new Error('BITRIX_WEBHOOK_URL не настроен и нет OAuth service token');
    }
  }

  const employee = await findEmployeeByName(request.employee);
  const bitrixUserId = employee?.bitrix_user_id ?? null;
  if (!bitrixUserId) {
    throw new Error(
      `У сотрудника «${request.employee}» нет bitrix_user_id — не создаём отсутствие (риск чужого календаря)`
    );
  }

  const payload = {
    bitrixUserId,
    start: request.start,
    end: request.end,
    comment: request.comment,
    requestId: request.id,
    employeeName: request.employee
  };

  let absenceId: number;
  let method: string;

  const existing = await findExistingAbsenceElement({
    bitrixUserId,
    start: request.start,
    end: request.end,
    requestId: request.id
  });
  if (existing) {
    absenceId = existing.absenceId;
    method = `lists.element.existing:${existing.auth}`;
  } else {
    try {
      const iblock = await createViaAbsenceIblock(payload);
      absenceId = iblock.absenceId;
      method = `lists.element.add:${iblock.auth}`;
    } catch (iblockError) {
      // Не падаем в calendar.event.add: вебхук/OAuth = CREATED_BY HR (Драго),
      // и Bitrix показывает такие absence-события в «Отсутствиях» у автора, даже при верном ownerId.
      throw new Error(
        `lists.element.add не удался: ${errorMessage(iblockError)}. ` +
          `calendar.event.add отключён (чужие отпуска в профиле владельца вебхука/токена).`
      );
    }
  }

  // Календарную отметку не пишем: CREATED_BY всегда = владелец вебхука (Драго),
  // из‑за этого чужие отпуска появляются в блоке «Отсутствия» у HR.
  // Пальма/график отсутствий — через lists (PROPERTY_USER = сотрудник).

  return { absenceId, method };
};

const needsBitrixSync = (request: VacationRequest, previous?: VacationRequest): boolean => {
  if (request.status !== 'approved') return false;
  if (request.bitrix_sync_status === 'synced' && request.bitrix_absence_id) return false;
  if (!previous) return true;
  return previous.status !== 'approved';
};

/** Повторный синк заявок со статусом failed/skipped — без дублей, если отсутствие уже в Bitrix. */
export const retryFailedBitrixVacationSyncs = async (
  state: VacationStoreState
): Promise<VacationStoreState> => {
  const hasWebhook = isBitrixWebhookConfigured();
  const hasOAuth = await hasBitrixOAuthServiceToken();
  if (!hasWebhook && !hasOAuth) return state;

  await readEmployees();
  let next = state;

  for (const request of flattenRequests(state)) {
    if (request.status !== 'approved') continue;
    if (request.bitrix_sync_status !== 'failed' && request.bitrix_sync_status !== 'skipped') {
      continue;
    }

    const employee = await findEmployeeByName(request.employee);
    try {
      const { absenceId, method } = await pushVacationToBitrixAbsence(request);
      next = updateRequestInState(next, request.id, {
        bitrix_absence_id: absenceId,
        bitrix_sync_status: 'synced',
        bitrix_sync_method: method,
        bitrix_synced_at: new Date().toISOString(),
        bitrix_sync_error: undefined
      });
    } catch (error) {
      const message = errorMessage(error);
      console.error(`[bitrix-vacation] retry failed for request #${request.id}:`, message);
      next = updateRequestInState(next, request.id, {
        bitrix_sync_status: message.includes('не настроен') ? 'skipped' : 'failed',
        bitrix_sync_error: message,
        bitrix_synced_at: new Date().toISOString()
      });
    }
  }

  return next;
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

    const employee = await findEmployeeByName(request.employee);

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
        bitrix_sync_status: message.includes('не настроен') ? 'skipped' : 'failed',
        bitrix_sync_error: message,
        bitrix_synced_at: new Date().toISOString()
      });

      if (!message.includes('не настроен')) {
        try {
          await createBitrixVacationSyncFailedNotification({
            employee_id: employee?.id ?? 0,
            employee_name: request.employee,
            bitrix_user_id: employee?.bitrix_user_id ?? undefined,
            request_id: request.id,
            start: request.start,
            end: request.end,
            error: message
          });
        } catch (notifyError) {
          console.error('[bitrix-vacation] admin notify failed:', notifyError);
        }
      }
    }
  }

  return state;
};
