import type { VacationRequest, VacationStoreState } from './vacationsStore';
import { bitrixRest, bitrixWebhookRest } from './bitrixClient';
import { getBitrixWebhookUrl, isBitrixWebhookConfigured } from './bitrixConfig';
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

/**
 * На crm.vbi.ru поле «Пользователь» — PROPERTY_1 (CODE=USER).
 * Ключ PROPERTY_USER в FIELDS не принимается → «Пользователь is required».
 */
const absenceUserProperty = () =>
  String(process.env.BITRIX_ABSENCE_PROPERTY_USER || 'PROPERTY_1').trim();

const absenceTypeProperty = () =>
  String(process.env.BITRIX_ABSENCE_PROPERTY_TYPE || 'PROPERTY_7').trim();

/** ДД.ММ.ГГГГ для FILTER ACTIVE_FROM (без времени — иначе lists может не найти). */
const toBitrixDate = (isoDate: string): string => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d)}.${pad(m)}.${y}`;
};

const isElementAlreadyExistsError = (message: string): boolean =>
  /element already exists/i.test(message);

const isCodeFilterNotAllowed = (message: string): boolean =>
  /filter field not allowed:\s*code/i.test(message);

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

const elementMatchesDates = (
  el: AbsenceListElement,
  start: string,
  end: string
): boolean =>
  bitrixDateToIso(el.ACTIVE_FROM) === start && bitrixDateToIso(el.ACTIVE_TO) === end;

const pickAbsenceHit = (
  rows: AbsenceListElement[] | undefined,
  params: { bitrixUserId: number; start: string; end: string; requestId: number }
): AbsenceListElement | undefined => {
  const code = `vbi-hr-vac-${params.requestId}`;
  const list = rows || [];
  const withCode = list.find((el) => String(el.CODE || '') === code && Number(el.ID) > 0);
  if (withCode) return withCode;

  return list.find((el) => {
    if (!(Number(el.ID) > 0)) return false;
    if (absenceElementUserId(el) !== params.bitrixUserId) return false;
    return elementMatchesDates(el, params.start, params.end);
  });
};

/**
 * Уже есть в графике отсутствий (ручной ввод или прошлый синк) —
 * не плодим дубликат, а привязываем заявку к существующему ID.
 *
 * Важно (crm.vbi.ru):
 * - FILTER по CODE запрещён («Filter field not allowed: CODE»);
 * - FILTER только по пользователю отдаёт ≤50 строк и может не найти свежие отпуска
 *   → тогда lists.element.add падает с «Element already exists».
 */
const findExistingAbsenceElement = async (params: {
  bitrixUserId: number;
  start: string;
  end: string;
  requestId: number;
  knownAbsenceId?: number | null;
}): Promise<{ absenceId: number; auth: AuthMode; upToDate: boolean } | null> => {
  const iblockId = await resolveAbsenceIblockId();
  if (!iblockId) return null;

  const code = `vbi-hr-vac-${params.requestId}`;

  if (params.knownAbsenceId && params.knownAbsenceId > 0) {
    try {
      const { result, auth } = await bitrixVacationRest<AbsenceListElement[]>('lists.element.get', {
        IBLOCK_TYPE_ID: absenceIblockTypeId(),
        IBLOCK_ID: iblockId,
        FILTER: { ID: params.knownAbsenceId }
      });
      const hit = (result || []).find((el) => Number(el.ID) === params.knownAbsenceId);
      if (hit) {
        return {
          absenceId: Number(hit.ID),
          auth,
          upToDate: elementMatchesDates(hit, params.start, params.end)
        };
      }
    } catch (err) {
      console.warn('[bitrix-vacation] lists.element.get by ID failed:', errorMessage(err));
    }
  }

  // FILTER по CODE на crm.vbi.ru запрещён, но ELEMENT_CODE (без FILTER) работает —
  // нужен при переносе дат: старый ACTIVE_FROM уже не совпадает с заявкой.
  try {
    const { result, auth } = await bitrixVacationRest<AbsenceListElement[]>('lists.element.get', {
      IBLOCK_TYPE_ID: absenceIblockTypeId(),
      IBLOCK_ID: iblockId,
      ELEMENT_CODE: code
    });
    const hit = (result || []).find((el) => Number(el.ID) > 0);
    if (hit) {
      return {
        absenceId: Number(hit.ID),
        auth,
        upToDate: elementMatchesDates(hit, params.start, params.end)
      };
    }
  } catch (err) {
    console.warn('[bitrix-vacation] lists.element.get by ELEMENT_CODE failed:', errorMessage(err));
  }

  try {
    const { result, auth } = await bitrixVacationRest<AbsenceListElement[]>('lists.element.get', {
      IBLOCK_TYPE_ID: absenceIblockTypeId(),
      IBLOCK_ID: iblockId,
      FILTER: { CODE: code }
    });
    const hit = pickAbsenceHit(result, params);
    if (hit) {
      return {
        absenceId: Number(hit.ID),
        auth,
        upToDate: elementMatchesDates(hit, params.start, params.end)
      };
    }
  } catch (err) {
    const message = errorMessage(err);
    if (!isCodeFilterNotAllowed(message)) {
      console.warn('[bitrix-vacation] lists.element.get by CODE failed:', message);
    }
  }

  // С датой старта — не упираемся в лимит 50 «всех отсутствий пользователя».
  try {
    const { result, auth } = await bitrixVacationRest<AbsenceListElement[]>('lists.element.get', {
      IBLOCK_TYPE_ID: absenceIblockTypeId(),
      IBLOCK_ID: iblockId,
      FILTER: {
        [absenceUserProperty()]: params.bitrixUserId,
        ACTIVE_FROM: toBitrixDate(params.start)
      }
    });
    const hit = pickAbsenceHit(result, params);
    if (hit) {
      return {
        absenceId: Number(hit.ID),
        auth,
        upToDate: elementMatchesDates(hit, params.start, params.end)
      };
    }
  } catch (err) {
    console.warn('[bitrix-vacation] lists.element.get by user/dates failed:', errorMessage(err));
  }

  return null;
};

const absenceFields = (params: {
  bitrixUserId: number;
  start: string;
  end: string;
  comment: string;
  employeeName: string;
}): Record<string, unknown> => ({
  NAME: params.comment?.trim() || `Отпуск: ${params.employeeName} (VBI HR)`,
  ACTIVE_FROM: toBitrixDateTime(params.start, false),
  ACTIVE_TO: toBitrixDateTime(params.end, true),
  [absenceUserProperty()]: params.bitrixUserId,
  [absenceTypeProperty()]: absenceTypeEnum()
});

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

  const { result, auth } = await bitrixVacationRest<number>('lists.element.add', {
    IBLOCK_TYPE_ID: absenceIblockTypeId(),
    IBLOCK_ID: iblockId,
    ELEMENT_CODE: `vbi-hr-vac-${params.requestId}`,
    FIELDS: absenceFields(params)
  });
  return { absenceId: result, auth };
};

/** Перенос дат / правка пальмы без delete+add (иначе Element already exists). */
const updateViaAbsenceIblock = async (params: {
  absenceId: number;
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

  const { auth } = await bitrixVacationRest<boolean>('lists.element.update', {
    IBLOCK_TYPE_ID: absenceIblockTypeId(),
    IBLOCK_ID: iblockId,
    ELEMENT_ID: params.absenceId,
    // CODE иначе стирается после update — следующий перенос не найдёт элемент по ELEMENT_CODE.
    FIELDS: {
      ...absenceFields(params),
      CODE: `vbi-hr-vac-${params.requestId}`
    }
  });
  return { absenceId: params.absenceId, auth };
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
    requestId: request.id,
    knownAbsenceId: request.bitrix_absence_id ?? null
  });
  if (existing) {
    // Даты сменились после согласования — обновляем тот же элемент (пальма переезжает).
    // Не delete+add: CODE уже занят → Element already exists.
    if (existing.upToDate) {
      absenceId = existing.absenceId;
      method = `lists.element.existing:${existing.auth}`;
    } else {
      const updated = await updateViaAbsenceIblock({
        absenceId: existing.absenceId,
        ...payload
      });
      absenceId = updated.absenceId;
      method = `lists.element.update:${updated.auth}`;
    }
  } else {
    try {
      const iblock = await createViaAbsenceIblock(payload);
      absenceId = iblock.absenceId;
      method = `lists.element.add:${iblock.auth}`;
    } catch (iblockError) {
      const message = errorMessage(iblockError);
      // CODE уже занят, а FILTER по CODE на портале запрещён — достаём элемент и при необходимости update.
      if (isElementAlreadyExistsError(message)) {
        const recovered = await findExistingAbsenceElement({
          bitrixUserId,
          start: request.start,
          end: request.end,
          requestId: request.id,
          knownAbsenceId: request.bitrix_absence_id ?? null
        });
        if (recovered) {
          if (recovered.upToDate) {
            absenceId = recovered.absenceId;
            method = `lists.element.existing-after-add-conflict:${recovered.auth}`;
          } else {
            const updated = await updateViaAbsenceIblock({
              absenceId: recovered.absenceId,
              ...payload
            });
            absenceId = updated.absenceId;
            method = `lists.element.update-after-add-conflict:${updated.auth}`;
          }
        } else if (request.bitrix_absence_id && request.bitrix_absence_id > 0) {
          const updated = await updateViaAbsenceIblock({
            absenceId: request.bitrix_absence_id,
            ...payload
          });
          absenceId = updated.absenceId;
          method = `lists.element.update-known-id:${updated.auth}`;
        } else {
          throw new Error(
            `lists.element.add не удался: ${message}. ` +
              `calendar.event.add отключён (чужие отпуска в профиле владельца вебхука/токена).`
          );
        }
      } else {
        // Не падаем в calendar.event.add: вебхук/OAuth = CREATED_BY HR (Драго),
        // и Bitrix показывает такие absence-события в «Отсутствиях» у автора, даже при верном ownerId.
        throw new Error(
          `lists.element.add не удался: ${message}. ` +
            `calendar.event.add отключён (чужие отпуска в профиле владельца вебхука/токена).`
        );
      }
    }
  }

  // Календарную отметку не пишем: CREATED_BY всегда = владелец вебхука (Драго),
  // из‑за этого чужие отпуска появляются в блоке «Отсутствия» у HR.
  // Пальма/график отсутствий — через lists (PROPERTY_1 = сотрудник).

  return { absenceId, method };
};

const deleteViaAbsenceIblock = async (absenceId: number): Promise<void> => {
  const iblockId = await resolveAbsenceIblockId();
  if (!iblockId) {
    throw new Error(
      'Не найден инфоблок графика отсутствий. Задайте BITRIX_ABSENCE_IBLOCK_ID и право lists у OAuth/вебхука.'
    );
  }

  await bitrixVacationRest<boolean>('lists.element.delete', {
    IBLOCK_TYPE_ID: absenceIblockTypeId(),
    IBLOCK_ID: iblockId,
    ELEMENT_ID: absenceId
  });
};

/** Владелец входящего вебхука: /rest/<userId>/<secret>/ */
const webhookOwnerUserId = (): number | null => {
  const match = getBitrixWebhookUrl().match(/\/rest\/(\d+)\//);
  const id = Number(match?.[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
};

/** Legacy-записи, созданные когда пальму писали через calendar.event.add. */
const deleteViaCalendarEvent = async (eventId: number): Promise<void> => {
  const ownerUserId = webhookOwnerUserId();
  if (!ownerUserId) {
    throw new Error('Не удалось определить владельца вебхука для calendar.event.delete');
  }
  await bitrixVacationRest<boolean>('calendar.event.delete', {
    type: 'user',
    ownerId: ownerUserId,
    id: eventId
  });
};

/** Снять отметку об отпуске в Bitrix при удалении/отмене заявки. */
export const removeVacationAbsenceFromBitrix = async (request: VacationRequest): Promise<void> => {
  const absenceId = Number(request.bitrix_absence_id);
  if (!Number.isFinite(absenceId) || absenceId <= 0) return;

  if (String(request.bitrix_sync_method || '').startsWith('calendar.event.add')) {
    await deleteViaCalendarEvent(absenceId);
    return;
  }

  await deleteViaAbsenceIblock(absenceId);
};

const needsBitrixSync = (request: VacationRequest, previous?: VacationRequest): boolean => {
  if (request.status !== 'approved') return false;
  if (!previous) return true;

  const datesChanged = previous.start !== request.start || previous.end !== request.end;
  const newlyApproved = previous.status !== 'approved';
  if (newlyApproved || datesChanged) return true;

  // Уже согласовано и даты те же: синкаем только если прошлый раз failed/skipped
  // или ещё ни разу не синкнули. Не гоняем всю базу при каждом чужом approve.
  if (request.bitrix_sync_status === 'failed' || request.bitrix_sync_status === 'skipped') {
    return true;
  }
  if (!request.bitrix_absence_id || request.bitrix_sync_status !== 'synced') {
    return true;
  }

  return false;
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
