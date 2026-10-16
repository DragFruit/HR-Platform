import type { VacationRequest, VacationStoreState } from './vacationsStore';
import { bitrixRest, bitrixWebhookRest } from './bitrixClient';
import { getBitrixWebhookUrl, isBitrixWebhookConfigured } from './bitrixConfig';
import { findEmployeeByName, readEmployees } from './employeesStore';
import { getBitrixServiceAccessToken, hasBitrixOAuthServiceToken } from './bitrixOAuthServiceToken';
import { createBitrixVacationSyncFailedNotification } from './adminNotificationsStore';
import {
  BitrixWriteBlockedError,
  bitrixWritesBlockedMessage,
  bitrixWritesBlockedNow,
  currentBitrixStand,
  isBitrixWritesBlockedMessage
} from './bitrixWriteGuard';

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

/**
 * Необязательные свойства — только если ключ env задан явно.
 * В настоящем «Графике отсутствий» (инфоблок 3, structure) их НЕТ: там только NAME,
 * ACTIVE_FROM/ACTIVE_TO, PROPERTY_1 «Пользователь», PROPERTY_7 «Тип отсутствия».
 * PROPERTY_1551/1548/1549 («Информация»/«Начало»/«Конец») — поля ошибочного списка 313
 * (lists_socnet), куда 15–16.10.2026 по ошибке писал бой. По умолчанию не отправляем.
 */
const optionalAbsenceProperty = (key: string): string | null => {
  const value = String(process.env[key] || '').trim();
  return value || null;
};

/** Инфоблок «График отсутствий» на crm.vbi.ru (IBLOCK_TYPE_ID=structure, CODE=absence). */
export const DEFAULT_ABSENCE_IBLOCK_ID = 3;

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

/**
 * Кешируем только УСПЕШНЫЙ результат (реальный positive ID), на весь процесс.
 * Неудачу (сетевой сбой/ошибка lists.get/инфоблок не найден) НЕ кешируем —
 * иначе один транзиентный сбой навсегда «залипает» в cachedAbsenceIblockId = null,
 * и весь синк отпусков→Bitrix для ВСЕХ сотрудников ломается до перезапуска процесса.
 * При неудаче возвращаем null на этот вызов, следующий вызов пробует снова (env + lists.get).
 */
let cachedAbsenceIblockId: number | undefined;

/**
 * Возвращает ID инфоблока + (при неудаче) НАСТОЯЩУЮ причину — реальный ответ Bitrix
 * (lists.get вернул ошибку/пустой список/нет совпадения по имени), а не шаблонную
 * фразу. Вызывающий код вплетает `error` в итоговое сообщение, показанное админу.
 */
export async function resolveAbsenceIblockId(): Promise<{ id: number | null; error?: string }> {
  // Явный BITRIX_ABSENCE_IBLOCK_ID всегда главнее (читаем env на каждом вызове, не кешируем).
  const fromEnv = Number(process.env.BITRIX_ABSENCE_IBLOCK_ID);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return { id: fromEnv };

  // structure: lists.get с IBLOCK_TYPE_ID=structure на портале отвечает «Неверный тип
  // информационного блока» — автопоиск не работает, график отсутствий там = инфоблок 3.
  if (absenceIblockTypeId() === 'structure') return { id: DEFAULT_ABSENCE_IBLOCK_ID };

  if (cachedAbsenceIblockId !== undefined) return { id: cachedAbsenceIblockId };

  try {
    const { result: lists } = await bitrixVacationRest<BitrixListRow[]>('lists.get', {
      IBLOCK_TYPE_ID: absenceIblockTypeId()
    });
    const found = lists.find((row) => /график.*отсутств/i.test(String(row.NAME || '')));
    const id = Number(found?.ID);
    if (Number.isFinite(id) && id > 0) {
      cachedAbsenceIblockId = id;
      return { id };
    }
    const names = (lists || [])
      .map((row) => String(row.NAME || '').trim())
      .filter(Boolean)
      .join(', ');
    const error = names
      ? `lists.get (IBLOCK_TYPE_ID=${absenceIblockTypeId()}) вернул ${lists.length} список(ов), ` +
        `но ни один не похож на «График отсутствий» (имена: ${names})`
      : `lists.get (IBLOCK_TYPE_ID=${absenceIblockTypeId()}) вернул пустой список`;
    return { id: null, error };
  } catch (err) {
    const error = errorMessage(err) || 'lists.get завершился с ошибкой без текста';
    return { id: null, error };
  }
}

type AbsenceListElement = {
  ID?: string | number;
  CODE?: string;
  ACTIVE_FROM?: string;
  ACTIVE_TO?: string;
  PROPERTY_1?: Record<string, string>;
  PROPERTY_USER?: Record<string, string> | string | number;
  [property: string]: unknown;
};

export const absenceElementUserId = (el: AbsenceListElement): number | null => {
  const raw = (el[absenceUserProperty()] ?? el.PROPERTY_1 ?? el.PROPERTY_USER) as
    | Record<string, string>
    | string
    | number
    | undefined;
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
  const { id: iblockId, error: iblockError } = await resolveAbsenceIblockId();
  if (!iblockId) {
    if (iblockError) {
      console.warn('[bitrix-vacation] resolveAbsenceIblockId failed (findExistingAbsenceElement):', iblockError);
    }
    return null;
  }

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
}): Record<string, unknown> => {
  const fields: Record<string, unknown> = {
    NAME: params.comment?.trim() || `Отпуск: ${params.employeeName} (VBI HR)`,
    ACTIVE_FROM: toBitrixDateTime(params.start, false),
    ACTIVE_TO: toBitrixDateTime(params.end, true),
    [absenceUserProperty()]: params.bitrixUserId,
    [absenceTypeProperty()]: absenceTypeEnum()
  };
  const startProp = optionalAbsenceProperty('BITRIX_ABSENCE_PROPERTY_START');
  if (startProp) fields[startProp] = toBitrixDateTime(params.start, false);
  const endProp = optionalAbsenceProperty('BITRIX_ABSENCE_PROPERTY_END');
  if (endProp) fields[endProp] = toBitrixDateTime(params.end, true);
  const infoProp = optionalAbsenceProperty('BITRIX_ABSENCE_PROPERTY_INFO');
  if (infoProp) {
    fields[infoProp] =
      `Отпуск с ${params.start} по ${params.end}` +
      (params.comment?.trim() ? ` — ${params.comment.trim()}` : '');
  }
  return fields;
};

/** lists.element.update/get по ID, которого нет в этом инфоблоке (проверено на crm.vbi.ru: ERROR_ELEMENT_NOT_FOUND). */
export const isElementNotFoundError = (message: string): boolean =>
  /element_not_found|element not found/i.test(message);

const createViaAbsenceIblock = async (params: {
  bitrixUserId: number;
  start: string;
  end: string;
  comment: string;
  requestId: number;
  employeeName: string;
}): Promise<{ absenceId: number; auth: AuthMode }> => {
  const { id: iblockId, error: iblockError } = await resolveAbsenceIblockId();
  if (!iblockId) {
    throw new Error(
      `Не найден инфоблок графика отсутствий (BITRIX_ABSENCE_IBLOCK_ID)` +
        (iblockError ? `: ${iblockError}` : '')
    );
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
  const { id: iblockId, error: iblockError } = await resolveAbsenceIblockId();
  if (!iblockId) {
    throw new Error(
      `Не найден инфоблок графика отсутствий (BITRIX_ABSENCE_IBLOCK_ID)` +
        (iblockError ? `: ${iblockError}` : '')
    );
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

/**
 * Update элемента; если Bitrix ответил «Element not found» (элемента нет в ЭТОМ инфоблоке —
 * например, он был записан в другой список), создаём новый в текущем графике отсутствий.
 */
const updateOrAddAbsence = async (
  absenceId: number,
  payload: Parameters<typeof createViaAbsenceIblock>[0],
  tag: string
): Promise<{ absenceId: number; method: string }> => {
  try {
    const updated = await updateViaAbsenceIblock({ absenceId, ...payload });
    return { absenceId: updated.absenceId, method: `lists.element.update${tag}:${updated.auth}` };
  } catch (err) {
    if (!isElementNotFoundError(errorMessage(err))) throw err;
    console.warn(
      `[bitrix-vacation] #${payload.requestId}: элемент ${absenceId} не найден в графике отсутствий — создаём заново`
    );
    const created = await createViaAbsenceIblock(payload);
    return { absenceId: created.absenceId, method: `lists.element.add-after-not-found:${created.auth}` };
  }
};

export const pushVacationToBitrixAbsence = async (request: VacationRequest): Promise<{
  absenceId: number;
  method: string;
  iblockId: number | null;
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

  const { id: targetIblockId } = await resolveAbsenceIblockId();
  const storedIblockId = Number(request.bitrix_absence_iblock_id) > 0 ? Number(request.bitrix_absence_iblock_id) : null;
  const storedAbsenceId = Number(request.bitrix_absence_id) > 0 ? Number(request.bitrix_absence_id) : null;
  // ID из ДРУГОГО инфоблока (например, ошибочного списка 313) — не наш элемент: не ищем и не апдейтим его.
  const knownAbsenceId =
    storedAbsenceId && (storedIblockId == null || storedIblockId === targetIblockId) ? storedAbsenceId : null;
  // Слепой update по известному ID — только если точно знаем, что он в текущем инфоблоке.
  const knownIdConfirmedInTarget = Boolean(knownAbsenceId && storedIblockId != null && storedIblockId === targetIblockId);

  let absenceId: number;
  let method: string;

  const existing = await findExistingAbsenceElement({
    bitrixUserId,
    start: request.start,
    end: request.end,
    requestId: request.id,
    knownAbsenceId
  });
  if (existing) {
    // Даты сменились после согласования — обновляем тот же элемент (пальма переезжает).
    // Не delete+add: CODE уже занят → Element already exists.
    if (existing.upToDate) {
      absenceId = existing.absenceId;
      method = `lists.element.existing:${existing.auth}`;
    } else {
      ({ absenceId, method } = await updateOrAddAbsence(existing.absenceId, payload, ''));
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
          knownAbsenceId
        });
        if (recovered) {
          if (recovered.upToDate) {
            absenceId = recovered.absenceId;
            method = `lists.element.existing-after-add-conflict:${recovered.auth}`;
          } else {
            const updated = await updateViaAbsenceIblock({ absenceId: recovered.absenceId, ...payload });
            absenceId = updated.absenceId;
            method = `lists.element.update-after-add-conflict:${updated.auth}`;
          }
        } else if (knownIdConfirmedInTarget && knownAbsenceId) {
          const updated = await updateViaAbsenceIblock({ absenceId: knownAbsenceId, ...payload });
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

  return { absenceId, method, iblockId: targetIblockId };
};

const deleteViaAbsenceIblock = async (absenceId: number): Promise<void> => {
  const { id: iblockId, error: iblockError } = await resolveAbsenceIblockId();
  if (!iblockId) {
    throw new Error(
      'Не найден инфоблок графика отсутствий. Задайте BITRIX_ABSENCE_IBLOCK_ID и право lists у OAuth/вебхука.' +
        (iblockError ? ` Причина: ${iblockError}` : '')
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

  // Стейдж/локалка: не удаляем в реальном портале. Бросаем, чтобы вызывающий НЕ стёр bitrix_absence_id
  // (отметка в Bitrix осталась) и не создавал админу алерт — см. isBitrixWriteBlockedError.
  if (bitrixWritesBlockedNow()) {
    console.warn(`[bitrix] ${currentBitrixStand() ?? 'unknown'}: write blocked lists.element.delete`);
    throw new BitrixWriteBlockedError('lists.element.delete', currentBitrixStand());
  }

  if (String(request.bitrix_sync_method || '').startsWith('calendar.event.add')) {
    await deleteViaCalendarEvent(absenceId);
    return;
  }

  // Элемент записан в другой инфоблок (ошибочный список 313) — там ничего не удаляем без явного решения.
  const storedIblockId = Number(request.bitrix_absence_iblock_id);
  if (storedIblockId > 0) {
    const { id: targetIblockId } = await resolveAbsenceIblockId();
    if (targetIblockId && storedIblockId !== targetIblockId) {
      console.warn(
        `[bitrix-vacation] #${request.id}: отметка ${absenceId} в инфоблоке ${storedIblockId}, не в графике ` +
          `отсутствий ${targetIblockId} — не удаляем`
      );
      return;
    }
  }

  try {
    await deleteViaAbsenceIblock(absenceId);
  } catch (err) {
    // Нет в графике отсутствий (удалили руками или запись была в другом списке) — снимать нечего.
    if (isElementNotFoundError(errorMessage(err))) {
      console.warn(`[bitrix-vacation] #${request.id}: отметки ${absenceId} нет в графике отсутствий`);
      return;
    }
    throw err;
  }
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

/** Заявка уже помечена «стенд не пишет в Bitrix» — повторно не трогаем. */
const isMarkedWritesBlocked = (request: VacationRequest): boolean =>
  request.bitrix_sync_status === 'skipped' && isBitrixWritesBlockedMessage(request.bitrix_sync_error);

/**
 * Стейдж/локалка: вместо записи в Bitrix честно помечаем skipped + «<стенд>: запись в Bitrix отключена».
 * Без сетевых вызовов, без алертов админу, без фейковых absence id. Уже помеченные не переписываем,
 * поэтому mutateVacations не гоняет синк по всей базе на каждой правке.
 */
export const markBitrixVacationSyncsBlocked = (
  state: VacationStoreState,
  requests: VacationRequest[]
): { state: VacationStoreState; marked: number } => {
  const message = bitrixWritesBlockedMessage();
  let next = state;
  let marked = 0;
  for (const request of requests) {
    if (isMarkedWritesBlocked(request)) continue;
    next = updateRequestInState(next, request.id, {
      bitrix_sync_status: 'skipped',
      bitrix_sync_error: message,
      bitrix_synced_at: new Date().toISOString()
    });
    marked += 1;
  }
  if (marked > 0) {
    console.warn(
      `[bitrix] ${currentBitrixStand() ?? 'unknown'}: write blocked lists.element.add (заявок → skipped: ${marked})`
    );
  }
  return { state: next, marked };
};

/** Согласованная заявка, уже синкнутая через lists (calendar.event.add — legacy, не трогаем). */
const isListsSynced = (r: VacationRequest): boolean =>
  r.status === 'approved' &&
  r.bitrix_sync_status === 'synced' &&
  Number(r.bitrix_absence_id) > 0 &&
  String(r.bitrix_sync_method || '').startsWith('lists.element');

/** Какие из ids есть в инфоблоке (FILTER ID массивом, по 50). null — запрос не удался (ничего не решаем). */
const absenceIdsPresentInIblock = async (iblockId: number, ids: number[]): Promise<Set<number> | null> => {
  const found = new Set<number>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const { result } = await bitrixVacationRest<AbsenceListElement[]>('lists.element.get', {
        IBLOCK_TYPE_ID: absenceIblockTypeId(),
        IBLOCK_ID: iblockId,
        FILTER: { ID: chunk }
      });
      for (const el of result || []) {
        const id = Number(el.ID);
        if (id > 0) found.add(id);
      }
    } catch (err) {
      console.warn('[bitrix-vacation] lists.element.get by ID batch failed:', errorMessage(err));
      return null;
    }
  }
  return found;
};

/**
 * Перенос отметок, записанных НЕ в текущий график отсутствий (15–16.10.2026 бой писал в список 313).
 * - bitrix_absence_iblock_id есть и != целевому → создаём элемент в целевом инфоблоке;
 * - поля нет (записи до 16.10.2026) → проверяем пачкой, есть ли ID в целевом инфоблоке:
 *   есть → только проставляем bitrix_absence_iblock_id; нет → создаём заново.
 * Только отпуска, которые ещё не закончились (end >= сегодня). Старые элементы в чужом списке
 * НЕ удаляем. Стейдж/локалка — no-op (запись выключена).
 */
export const relocateAbsencesToTargetIblock = async (
  state: VacationStoreState
): Promise<{ state: VacationStoreState; stamped: number; relocated: number; failedIds: number[] }> => {
  const none = { state, stamped: 0, relocated: 0, failedIds: [] as number[] };
  if (bitrixWritesBlockedNow()) return none;

  const { id: targetIblockId, error } = await resolveAbsenceIblockId();
  if (!targetIblockId) {
    if (error) console.warn('[bitrix-vacation] relocate: инфоблок не определён:', error);
    return none;
  }

  // Прошедшие отпуска не воскрешаем: их отметку могли осознанно убрать в Bitrix руками
  // (на бою так с #1014, элемент 32099 за июль 2026 в графике отсутствий отсутствует).
  const today = new Date().toISOString().slice(0, 10);
  const candidates = flattenRequests(state).filter(
    (r) =>
      isListsSynced(r) &&
      Number(r.bitrix_absence_iblock_id) !== targetIblockId &&
      String(r.end || '') >= today
  );
  if (!candidates.length) return none;

  const unstamped = candidates.filter((r) => !(Number(r.bitrix_absence_iblock_id) > 0));
  const present = unstamped.length
    ? await absenceIdsPresentInIblock(
        targetIblockId,
        unstamped.map((r) => Number(r.bitrix_absence_id))
      )
    : new Set<number>();

  await readEmployees();
  let next = state;
  let stamped = 0;
  let relocated = 0;
  const failedIds: number[] = [];

  for (const request of candidates) {
    const isUnstamped = !(Number(request.bitrix_absence_iblock_id) > 0);
    if (isUnstamped) {
      // Не смогли проверить — не рискуем дублем, попробуем при следующем запуске.
      if (!present) continue;
      if (present.has(Number(request.bitrix_absence_id))) {
        next = updateRequestInState(next, request.id, { bitrix_absence_iblock_id: targetIblockId });
        stamped += 1;
        continue;
      }
    }

    try {
      const { absenceId, method, iblockId } = await pushVacationToBitrixAbsence(request);
      next = updateRequestInState(next, request.id, {
        bitrix_absence_id: absenceId,
        bitrix_absence_iblock_id: iblockId ?? undefined,
        bitrix_sync_status: 'synced',
        bitrix_sync_method: method,
        bitrix_synced_at: new Date().toISOString(),
        bitrix_sync_error: undefined
      });
      relocated += 1;
      console.info(
        `[bitrix-vacation] #${request.id}: отметка ${request.bitrix_absence_id} ` +
          `(инфоблок ${request.bitrix_absence_iblock_id ?? 'не записан'}) → ${absenceId} в инфоблоке ${iblockId}`
      );
    } catch (err) {
      const message = errorMessage(err);
      console.error(`[bitrix-vacation] relocate failed for request #${request.id}:`, message);
      // failed → подхватит обычный повтор; bitrix_absence_id не трогаем (элемент в старом списке остался).
      next = updateRequestInState(next, request.id, {
        bitrix_sync_status: 'failed',
        bitrix_sync_error: message,
        bitrix_synced_at: new Date().toISOString()
      });
      failedIds.push(request.id);
    }
  }

  return { state: next, stamped, relocated, failedIds };
};

/**
 * Повторный синк заявок со статусом failed/skipped — без дублей, если отсутствие уже в Bitrix.
 * Плюс перенос отметок из чужого инфоблока в текущий график отсутствий (relocateAbsencesToTargetIblock).
 */
export const retryFailedBitrixVacationSyncs = async (
  state: VacationStoreState
): Promise<VacationStoreState> => {
  const hasWebhook = isBitrixWebhookConfigured();
  const hasOAuth = await hasBitrixOAuthServiceToken();
  if (!hasWebhook && !hasOAuth) return state;

  if (bitrixWritesBlockedNow()) {
    const pending = flattenRequests(state).filter(
      (r) =>
        r.status === 'approved' &&
        (r.bitrix_sync_status === 'failed' || r.bitrix_sync_status === 'skipped')
    );
    return markBitrixVacationSyncsBlocked(state, pending).state;
  }

  const relocation = await relocateAbsencesToTargetIblock(state);
  if (relocation.stamped || relocation.relocated || relocation.failedIds.length) {
    console.info(
      `[bitrix-vacation] relocate: stamped=${relocation.stamped} relocated=${relocation.relocated} ` +
        `failed=${relocation.failedIds.length}`
    );
  }
  const relocateFailed = new Set(relocation.failedIds);

  await readEmployees();
  let next = relocation.state;

  for (const request of flattenRequests(relocation.state)) {
    // Только что упали при переносе — не долбим портал второй раз в том же проходе.
    if (relocateFailed.has(request.id)) continue;
    if (request.status !== 'approved') continue;
    if (request.bitrix_sync_status !== 'failed' && request.bitrix_sync_status !== 'skipped') {
      continue;
    }

    const employee = await findEmployeeByName(request.employee);
    try {
      const { absenceId, method, iblockId } = await pushVacationToBitrixAbsence(request);
      next = updateRequestInState(next, request.id, {
        bitrix_absence_id: absenceId,
        bitrix_absence_iblock_id: iblockId ?? undefined,
        bitrix_sync_status: 'synced',
        bitrix_sync_method: method,
        bitrix_synced_at: new Date().toISOString(),
        bitrix_sync_error: undefined
      });
    } catch (error) {
      const message = errorMessage(error);
      console.error(`[bitrix-vacation] retry failed for request #${request.id}:`, message);
      next = updateRequestInState(next, request.id, {
        bitrix_sync_status:
          message.includes('не настроен') || isBitrixWritesBlockedMessage(message) ? 'skipped' : 'failed',
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

  const prevMap = new Map(flattenRequests(previous).map((item) => [item.id, item]));

  if (bitrixWritesBlockedNow()) {
    const due = flattenRequests(next).filter((r) => needsBitrixSync(r, prevMap.get(r.id)));
    return markBitrixVacationSyncsBlocked(next, due).state;
  }

  await readEmployees();

  let state = next;

  for (const request of flattenRequests(next)) {
    const prev = prevMap.get(request.id);
    if (!needsBitrixSync(request, prev)) continue;

    const employee = await findEmployeeByName(request.employee);

    try {
      const { absenceId, method, iblockId } = await pushVacationToBitrixAbsence(request);
      state = updateRequestInState(state, request.id, {
        bitrix_absence_id: absenceId,
        bitrix_absence_iblock_id: iblockId ?? undefined,
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
          message.includes('не настроен') || isBitrixWritesBlockedMessage(message) ? 'skipped' : 'failed',
        bitrix_sync_error: message,
        bitrix_synced_at: new Date().toISOString()
      });

      if (!message.includes('не настроен') && !isBitrixWritesBlockedMessage(message)) {
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
