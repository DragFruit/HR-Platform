import type { VacationRequest, VacationStoreState } from './vacationsStore';
import type { VacationBitrixAbsencePart } from '../../app/composables/useVacations';
import { splitVacationByHolidays } from '../../app/utils/vacationCalendar';
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
  isBitrixWriteBlockedError,
  isBitrixWritesBlockedMessage
} from './bitrixWriteGuard';

export type BitrixVacationSyncStatus = 'synced' | 'failed' | 'skipped';

type BitrixListRow = {
  ID?: string | number;
  NAME?: string;
  IBLOCK_TYPE_ID?: string;
};

type AuthMode = 'webhook' | 'oauth';

/**
 * CODE элемента графика отсутствий. Первый отрезок заявки (и все старые заявки) — vbi-hr-vac-<id>,
 * следующие отрезки, если отпуск разрезан праздником, — vbi-hr-vac-<id>-p2, -p3 …
 */
export const absenceCode = (requestId: number, partIndex = 0): string =>
  partIndex > 0 ? `vbi-hr-vac-${requestId}-p${partIndex + 1}` : `vbi-hr-vac-${requestId}`;

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

/**
 * Календарная дата отпуска → «ДД.ММ.ГГГГ» (только перестановка строки, без Date/UTC,
 * результат одинаков в любом часовом поясе сервера). Сама по себе нужна для FILTER ACTIVE_FROM;
 * в FIELDS идёт через toBitrixDateTime с явным временем.
 */
export const toBitrixDate = (isoDate: string): string => {
  const m = String(isoDate || '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw new Error(`toBitrixDate: ожидалась дата YYYY-MM-DD, получено «${isoDate}»`);
  return `${m[3]}.${m[2]}.${m[1]}`;
};

/**
 * ACTIVE_FROM/ACTIVE_TO для графика отсутствий: «ДД.ММ.ГГГГ 00:00:00» и «ДД.ММ.ГГГГ 23:59:59».
 * Время литералом в строке, без Date/UTC: Bitrix читает его в поясе пользователя токена,
 * поэтому получается ровно 00:00–23:59:59 нужных суток (как у корректных элементов вида 33212).
 * Дата без времени в ACTIVE_TO НЕ годится: Bitrix ставит 00:00:00 последнего дня,
 * и последний день отпуска в график не попадает (так было 19.10.2026 после d7b8911).
 */
export const toBitrixDateTime = (isoDate: string, endOfDay = false): string =>
  `${toBitrixDate(isoDate)} ${endOfDay ? '23:59:59' : '00:00:00'}`;

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

/** Время из «ДД.ММ.ГГГГ ЧЧ:ММ[:СС]»; для даты без времени '' (Bitrix трактует как 00:00:00). */
const bitrixTimePart = (value: string | undefined): string => {
  const m = String(value || '')
    .trim()
    .match(/^\d{2}\.\d{2}\.\d{4}[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return '';
  return `${m[1]}:${m[2]}:${m[3] ?? '00'}`;
};

/**
 * Элемент актуален, только если начало в нужный день, а конец в нужный день в 23:59:59.
 * Конец «ДД.ММ.ГГГГ» без времени или «… 00:00:00» = отпуск обрывается в начале последнего дня
 * → считаем расхождением, сверка перезапишет элемент.
 */
export const elementMatchesDates = (
  el: Pick<AbsenceListElement, 'ACTIVE_FROM' | 'ACTIVE_TO'>,
  start: string,
  end: string
): boolean =>
  bitrixDateToIso(el.ACTIVE_FROM) === start &&
  bitrixDateToIso(el.ACTIVE_TO) === end &&
  bitrixTimePart(el.ACTIVE_TO) === '23:59:59';

const pickAbsenceHit = (
  rows: AbsenceListElement[] | undefined,
  params: { bitrixUserId: number; start: string; end: string; requestId: number; partIndex?: number }
): AbsenceListElement | undefined => {
  const code = absenceCode(params.requestId, params.partIndex);
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
  partIndex?: number;
  knownAbsenceId?: number | null;
}): Promise<{ absenceId: number; auth: AuthMode; upToDate: boolean } | null> => {
  const { id: iblockId, error: iblockError } = await resolveAbsenceIblockId();
  if (!iblockId) {
    if (iblockError) {
      console.warn('[bitrix-vacation] resolveAbsenceIblockId failed (findExistingAbsenceElement):', iblockError);
    }
    return null;
  }

  const code = absenceCode(params.requestId, params.partIndex);

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

/** CODE наших элементов: vbi-hr-vac-<id заявки>. */
const ABSENCE_CODE_RE = /^vbi-hr-vac-(\d+)(?:-p\d+)?$/;

/**
 * Что знает платформа о своих заявках — нужно, чтобы отличить «сироту» (элемент с нашим CODE,
 * заявки которого больше нет) от элемента живой заявки.
 */
export type AbsenceAdoptionContext = {
  /** id всех заявок в vacations.json (любой статус). */
  knownRequestIds: Set<number>;
  /** bitrix_absence_id, уже привязанные к какой-либо заявке. */
  linkedAbsenceIds: Set<number>;
};

/** Все id элементов, привязанных к заявке: bitrix_absence_id и отрезки bitrix_absence_parts. */
export const linkedAbsenceIdsOf = (r: VacationRequest): number[] => {
  const ids = new Set<number>();
  const main = Number(r.bitrix_absence_id);
  if (main > 0) ids.add(main);
  for (const part of r.bitrix_absence_parts ?? []) {
    const id = Number(part?.absence_id);
    if (id > 0) ids.add(id);
  }
  return [...ids];
};

export const absenceAdoptionContext = (state: VacationStoreState): AbsenceAdoptionContext => {
  const knownRequestIds = new Set<number>();
  const linkedAbsenceIds = new Set<number>();
  for (const r of flattenRequests(state)) {
    knownRequestIds.add(Number(r.id));
    for (const absenceId of linkedAbsenceIdsOf(r)) linkedAbsenceIds.add(absenceId);
  }
  return { knownRequestIds, linkedAbsenceIds };
};

/**
 * Сирота того же сотрудника, которую можно взять вместо нового элемента (без дубля в графике):
 * CODE vbi-hr-vac-<id>, заявки <id> в vacations.json нет, элемент ни к одной заявке не привязан,
 * даты (только дата, без времени) пересекаются с новой заявкой. Берём только если такая ровно одна.
 * Пример: 32167 (vbi-hr-vac-1147, 16.11–23.11 02:59) у Трифонова и его новая заявка 16–22.11.
 */
const findAdoptableOrphanElement = async (
  params: { bitrixUserId: number; start: string; end: string; requestId: number },
  ctx: AbsenceAdoptionContext
): Promise<AbsenceListElement | null> => {
  const { id: iblockId } = await resolveAbsenceIblockId();
  if (!iblockId) return null;
  let rows: AbsenceListElement[] = [];
  try {
    const { result } = await bitrixVacationRest<AbsenceListElement[]>('lists.element.get', {
      IBLOCK_TYPE_ID: absenceIblockTypeId(),
      IBLOCK_ID: iblockId,
      FILTER: { [absenceUserProperty()]: params.bitrixUserId },
      // Bitrix отдаёт ≤50 строк: свежие сироты — среди последних ID.
      ELEMENT_ORDER: { ID: 'DESC' }
    });
    rows = result || [];
  } catch (err) {
    console.warn('[bitrix-vacation] lists.element.get by user (orphan check) failed:', errorMessage(err));
    return null;
  }

  const candidates = rows.filter((el) => {
    const id = Number(el.ID);
    if (!(id > 0) || ctx.linkedAbsenceIds.has(id)) return false;
    if (absenceElementUserId(el) !== params.bitrixUserId) return false;
    const m = String(el.CODE || '').match(ABSENCE_CODE_RE);
    if (!m) return false;
    const codeRequestId = Number(m[1]);
    if (codeRequestId === params.requestId || ctx.knownRequestIds.has(codeRequestId)) return false;
    const from = bitrixDateToIso(el.ACTIVE_FROM);
    const to = bitrixDateToIso(el.ACTIVE_TO);
    if (!from || !to) return false;
    return from <= params.end && to >= params.start;
  });
  if (candidates.length !== 1) {
    if (candidates.length > 1) {
      console.warn(
        `[bitrix-vacation] #${params.requestId}: несколько сирот (${candidates.map((el) => el.ID).join(', ')}) — ` +
          'не выбираем, создаём новый элемент'
      );
    }
    return null;
  }
  return candidates[0];
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
  partIndex?: number;
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
    ELEMENT_CODE: absenceCode(params.requestId, params.partIndex),
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
  partIndex?: number;
  employeeName: string;
}): Promise<{ absenceId: number; auth: AuthMode; codeSet: boolean }> => {
  const { id: iblockId, error: iblockError } = await resolveAbsenceIblockId();
  if (!iblockId) {
    throw new Error(
      `Не найден инфоблок графика отсутствий (BITRIX_ABSENCE_IBLOCK_ID)` +
        (iblockError ? `: ${iblockError}` : '')
    );
  }

  // codeSet: update прошёл с ELEMENT_CODE (код у элемента есть). false: обновили только по ELEMENT_ID,
  // CODE не установлен (19.10.2026 на бою: пустой CODE update не восстанавливает ни так, ни руками в форме).
  const code = absenceCode(params.requestId, params.partIndex);
  const base = {
    IBLOCK_TYPE_ID: absenceIblockTypeId(),
    IBLOCK_ID: iblockId,
    ELEMENT_ID: params.absenceId,
    // FIELDS.CODE Bitrix игнорирует (19.10.2026 на crm.vbi.ru: update с FIELDS.CODE и только ELEMENT_ID
    // стёр CODE «vbi-hr-vac-3» у 32095). Оставляем как безвредную подстраховку.
    FIELDS: { ...absenceFields(params), CODE: code }
  };

  // lists.element.update «перезаписывает элемент полностью»; символьный код, как и в lists.element.add,
  // берётся из параметра ELEMENT_CODE, поэтому без него CODE очищается. Но ELEMENT_CODE ещё и
  // идентифицирует элемент, и документация не говорит, что главнее при ELEMENT_ID + ELEMENT_CODE.
  // Поэтому сначала читаем, кому принадлежит код: чужой элемент никогда не адресуем по коду.
  const holder = await findAbsenceIdByCode(iblockId, code);
  if (holder === undefined || (holder !== null && holder !== params.absenceId)) {
    console.warn(
      `[bitrix-vacation] #${params.requestId}: ` +
        (holder === undefined ? `не удалось проверить владельца CODE ${code}` : `CODE ${code} уже у элемента ${holder}`) +
        `, обновляем ${params.absenceId} только по ELEMENT_ID (CODE не трогаем)`
    );
    const { auth } = await bitrixVacationRest<boolean>('lists.element.update', base);
    return { absenceId: params.absenceId, auth, codeSet: false };
  }

  try {
    const { auth } = await bitrixVacationRest<boolean>('lists.element.update', {
      ...base,
      ELEMENT_CODE: code
    });
    return { absenceId: params.absenceId, auth, codeSet: true };
  } catch (err) {
    // Код ещё ни у кого (стёрт прошлым update), и Bitrix ищет элемент по ELEMENT_CODE → not found.
    // Не уходим в add (был бы дубль), повторяем по одному ELEMENT_ID. CODE так не ставится (факт с боя
    // 19.10.2026), элемент остаётся с пустым кодом; платформа опирается на bitrix_absence_id.
    if (holder !== null || !isElementNotFoundError(errorMessage(err))) throw err;
    console.warn(
      `[bitrix-vacation] #${params.requestId}: update с ELEMENT_CODE ${code} → not found, повтор только по ELEMENT_ID ${params.absenceId}, ` +
        `CODE не установлен (Bitrix не меняет код через update)`
    );
    const { auth } = await bitrixVacationRest<boolean>('lists.element.update', base);
    return { absenceId: params.absenceId, auth, codeSet: false };
  }
};

/** ID элемента с символьным кодом code (lists.element.get + ELEMENT_CODE); null: нет, undefined: ошибка чтения. */
const findAbsenceIdByCode = async (iblockId: number, code: string): Promise<number | null | undefined> => {
  try {
    const { result } = await bitrixVacationRest<AbsenceListElement[]>('lists.element.get', {
      IBLOCK_TYPE_ID: absenceIblockTypeId(),
      IBLOCK_ID: iblockId,
      ELEMENT_CODE: code
    });
    const hit = (result || []).find((el) => Number(el.ID) > 0 && String(el.CODE || '') === code);
    return hit ? Number(hit.ID) : null;
  } catch (err) {
    console.warn('[bitrix-vacation] lists.element.get by ELEMENT_CODE (update) failed:', errorMessage(err));
    return undefined;
  }
};

/**
 * Update элемента; если Bitrix ответил «Element not found» (элемента нет в ЭТОМ инфоблоке —
 * например, он был записан в другой список), создаём новый в текущем графике отсутствий.
 */
const updateOrAddAbsence = async (
  absenceId: number,
  payload: Parameters<typeof createViaAbsenceIblock>[0],
  tag: string
): Promise<{ absenceId: number; method: string; codeSet: boolean }> => {
  try {
    const updated = await updateViaAbsenceIblock({ absenceId, ...payload });
    return {
      absenceId: updated.absenceId,
      method: `lists.element.update${tag}:${updated.auth}`,
      codeSet: updated.codeSet
    };
  } catch (err) {
    if (!isElementNotFoundError(errorMessage(err))) throw err;
    console.warn(
      `[bitrix-vacation] #${payload.requestId}: элемент ${absenceId} не найден в графике отсутствий — создаём заново`
    );
    const created = await createViaAbsenceIblock(payload);
    return {
      absenceId: created.absenceId,
      method: `lists.element.add-after-not-found:${created.auth}`,
      codeSet: true
    };
  }
};

/** Отрезок заявки для отдельного элемента графика отсутствий. */
export type AbsencePartTarget = {
  start: string;
  end: string;
  partIndex: number;
  /** Уже привязанный к этому отрезку элемент (null — ищем по CODE/датам или создаём). */
  absenceId: number | null;
};

export const pushVacationToBitrixAbsence = async (
  request: VacationRequest,
  ctx?: AbsenceAdoptionContext,
  part?: AbsencePartTarget
): Promise<{
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

  const start = part?.start ?? request.start;
  const end = part?.end ?? request.end;
  const partIndex = part?.partIndex ?? 0;
  const payload = {
    bitrixUserId,
    start,
    end,
    comment: request.comment,
    requestId: request.id,
    partIndex,
    employeeName: request.employee
  };

  const { id: targetIblockId } = await resolveAbsenceIblockId();
  const storedIblockId = Number(request.bitrix_absence_iblock_id) > 0 ? Number(request.bitrix_absence_iblock_id) : null;
  const storedRaw = part ? Number(part.absenceId) : Number(request.bitrix_absence_id);
  const storedAbsenceId = storedRaw > 0 ? storedRaw : null;
  // ID из ДРУГОГО инфоблока (например, ошибочного списка 313) — не наш элемент: не ищем и не апдейтим его.
  const knownAbsenceId =
    storedAbsenceId && (storedIblockId == null || storedIblockId === targetIblockId) ? storedAbsenceId : null;
  // Слепой update по известному ID — только если точно знаем, что он в текущем инфоблоке.
  const knownIdConfirmedInTarget = Boolean(knownAbsenceId && storedIblockId != null && storedIblockId === targetIblockId);

  let absenceId: number;
  let method: string;

  const existing = await findExistingAbsenceElement({
    bitrixUserId,
    start,
    end,
    requestId: request.id,
    partIndex,
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
    const orphan = ctx ? await findAdoptableOrphanElement(payload, ctx) : null;
    if (orphan) {
      console.info(
        `[bitrix-vacation] #${request.id}: берём сироту ${orphan.ID} (CODE ${orphan.CODE}, ` +
          `${orphan.ACTIVE_FROM} – ${orphan.ACTIVE_TO}) вместо нового элемента`
      );
      const adopted = await updateOrAddAbsence(Number(orphan.ID), payload, '-adopted');
      return { absenceId: adopted.absenceId, method: adopted.method, iblockId: targetIblockId };
    }
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
          start,
          end,
          requestId: request.id,
          partIndex,
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

/**
 * Новая логика (с 19.11.2026): заявка ведётся по отрезкам, если у неё уже есть bitrix_absence_parts
 * (пусть пустой) или она ещё ни разу не попадала в Bitrix. Старые синкнутые заявки с одним
 * bitrix_absence_id без списка — по-старому, одним элементом (повтор/сверка их не пересоздают).
 */
export const usesSegmentedAbsences = (request: VacationRequest): boolean =>
  Array.isArray(request.bitrix_absence_parts) || !(Number(request.bitrix_absence_id) > 0);

/** Известные элементы по порядку отрезков; у старой заявки — один bitrix_absence_id. */
const knownPartAbsenceIds = (request: VacationRequest): number[] => {
  const parts = request.bitrix_absence_parts ?? [];
  if (parts.length) return parts.map((p) => Number(p.absence_id) || 0);
  const main = Number(request.bitrix_absence_id);
  return main > 0 ? [main] : [];
};

/**
 * Согласованная заявка → по элементу графика отсутствий на каждый отрезок без праздников
 * (праздник внутри отпуска отсутствием не помечается). Существующие элементы обновляются по
 * порядку (первый отрезок берёт старый bitrix_absence_id), недостающие создаются, лишние удаляются.
 */
export const pushVacationSegmentsToBitrix = async (
  request: VacationRequest,
  ctx?: AbsenceAdoptionContext
): Promise<{ parts: VacationBitrixAbsencePart[]; method: string; iblockId: number | null }> => {
  const segments = splitVacationByHolidays(request.start, request.end);
  if (!segments.length) {
    throw new Error('Все дни заявки — праздники: отсутствие в Bitrix не ставим');
  }
  const known = knownPartAbsenceIds(request);
  const parts: VacationBitrixAbsencePart[] = [];
  const methods: string[] = [];
  let iblockId: number | null = null;
  for (const [partIndex, segment] of segments.entries()) {
    const res = await pushVacationToBitrixAbsence(request, ctx, {
      start: segment.start,
      end: segment.end,
      partIndex,
      absenceId: known[partIndex] || null
    });
    parts.push({ start: segment.start, end: segment.end, absence_id: res.absenceId });
    methods.push(res.method);
    iblockId = res.iblockId;
  }

  const kept = new Set(parts.map((p) => p.absence_id));
  for (const staleId of known.slice(segments.length)) {
    if (!(staleId > 0) || kept.has(staleId)) continue;
    try {
      await deleteViaAbsenceIblock(staleId);
      console.info(`[bitrix-vacation] #${request.id}: лишний отрезок ${staleId} удалён из графика отсутствий`);
    } catch (err) {
      if (!isElementNotFoundError(errorMessage(err))) throw err;
    }
  }

  return { parts, method: [...new Set(methods)].join(','), iblockId };
};

/** Синк одной заявки: по отрезкам (новая логика) или одним элементом (старые заявки). */
const pushApprovedRequest = async (
  request: VacationRequest,
  ctx: AbsenceAdoptionContext,
  segmented: boolean
): Promise<Partial<VacationRequest>> => {
  if (segmented) {
    const { parts, method, iblockId } = await pushVacationSegmentsToBitrix(request, ctx);
    return {
      bitrix_absence_id: parts[0]!.absence_id,
      bitrix_absence_parts: parts,
      bitrix_absence_iblock_id: iblockId ?? undefined,
      bitrix_sync_status: 'synced',
      bitrix_sync_method: method,
      bitrix_synced_at: new Date().toISOString(),
      bitrix_sync_error: undefined
    };
  }
  const { absenceId, method, iblockId } = await pushVacationToBitrixAbsence(request, ctx);
  return {
    bitrix_absence_id: absenceId,
    bitrix_absence_iblock_id: iblockId ?? undefined,
    bitrix_sync_status: 'synced',
    bitrix_sync_method: method,
    bitrix_synced_at: new Date().toISOString(),
    bitrix_sync_error: undefined
  };
};

/** Ошибка синка по отрезкам: фиксируем режим (пустой список), чтобы повтор шёл тоже по отрезкам. */
const segmentedFailurePatch = (request: VacationRequest, segmented: boolean): Partial<VacationRequest> =>
  segmented ? { bitrix_absence_parts: request.bitrix_absence_parts ?? [] } : {};

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
  const ids = linkedAbsenceIdsOf(request);
  if (!ids.length) return;
  const absenceId = ids[0]!;

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

  // Отпуск, разрезанный праздниками, — снимаем все отрезки.
  for (const id of ids) {
    try {
      await deleteViaAbsenceIblock(id);
    } catch (err) {
      // Нет в графике отсутствий (удалили руками или запись была в другом списке) — снимать нечего.
      if (isElementNotFoundError(errorMessage(err))) {
        console.warn(`[bitrix-vacation] #${request.id}: отметки ${id} нет в графике отсутствий`);
        continue;
      }
      throw err;
    }
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
      !r.bitrix_absence_parts?.length &&
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
  const ctx = absenceAdoptionContext(state);
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
      const { absenceId, method, iblockId } = await pushVacationToBitrixAbsence(request, ctx);
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
  const ctx = absenceAdoptionContext(relocation.state);
  let next = relocation.state;

  for (const request of flattenRequests(relocation.state)) {
    // Только что упали при переносе — не долбим портал второй раз в том же проходе.
    if (relocateFailed.has(request.id)) continue;
    if (request.status !== 'approved') continue;
    if (request.bitrix_sync_status !== 'failed' && request.bitrix_sync_status !== 'skipped') {
      continue;
    }

    const segmented = usesSegmentedAbsences(request);
    try {
      next = updateRequestInState(next, request.id, await pushApprovedRequest(request, ctx, segmented));
    } catch (error) {
      const message = errorMessage(error);
      console.error(`[bitrix-vacation] retry failed for request #${request.id}:`, message);
      next = updateRequestInState(next, request.id, {
        ...segmentedFailurePatch(request, segmented),
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
  const ctx = absenceAdoptionContext(next);

  let state = next;

  for (const request of flattenRequests(next)) {
    const prev = prevMap.get(request.id);
    if (!needsBitrixSync(request, prev)) continue;

    const employee = await findEmployeeByName(request.employee);
    // Новое согласование или новые даты → по отрезкам без праздников. Старую согласованную заявку
    // с одним элементом (повтор после failed/skipped) не пересобираем.
    const segmented =
      !prev ||
      prev.status !== 'approved' ||
      prev.start !== request.start ||
      prev.end !== request.end ||
      usesSegmentedAbsences(request);

    try {
      state = updateRequestInState(state, request.id, await pushApprovedRequest(request, ctx, segmented));
    } catch (error) {
      const message = errorMessage(error);
      console.error(`[bitrix-vacation] sync failed for request #${request.id}:`, message);
      state = updateRequestInState(state, request.id, {
        ...segmentedFailurePatch(request, segmented),
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

/** Элементы инфоблока по ID (FILTER ID массивом, по 50 — одна страница на пачку). null — чтение не удалось. */
const fetchAbsenceElementsByIds = async (
  iblockId: number,
  ids: number[]
): Promise<Map<number, AbsenceListElement> | null> => {
  const found = new Map<number, AbsenceListElement>();
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
        if (id > 0) found.set(id, el);
      }
    } catch (err) {
      console.warn('[bitrix-vacation] reconcile: lists.element.get by ID batch failed:', errorMessage(err));
      return null;
    }
  }
  return found;
};

export type ReconcileAbsencesResult = {
  state: VacationStoreState;
  checked: number;
  fixed: number;
  readded: number;
  adopted: number;
  failed: number;
  /** Стенд не пишет в Bitrix: только посчитали и залогировали, что сделали бы. */
  dryRun: boolean;
};

/** Небольшой пул: не больше `limit` запросов к порталу одновременно. */
const runWithConcurrency = async <T>(items: T[], limit: number, fn: (item: T) => Promise<void>) => {
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor++] as T;
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

/** Что сверяем: элемент старой заявки (весь период) или отрезок заявки, разрезанной праздниками. */
type ReconcileUnit = {
  request: VacationRequest;
  absenceId: number;
  start: string;
  end: string;
  partIndex: number;
  segmented: boolean;
};

const reconcileUnitsOf = (request: VacationRequest): ReconcileUnit[] => {
  const parts = request.bitrix_absence_parts ?? [];
  if (!parts.length) {
    return [
      {
        request,
        absenceId: Number(request.bitrix_absence_id),
        start: request.start,
        end: request.end,
        partIndex: 0,
        segmented: false
      }
    ];
  }
  return parts.map((part, partIndex) => ({
    request,
    absenceId: Number(part.absence_id),
    start: part.start,
    end: part.end,
    partIndex,
    segmented: true
  }));
};

const unitTag = (unit: ReconcileUnit): string =>
  unit.segmented ? `#${unit.request.id} (отрезок ${unit.partIndex + 1})` : `#${unit.request.id}`;

type ReconcileAction =
  | { kind: 'ok' }
  | { kind: 'fix'; absenceId: number; reasons: string[]; codeMismatch: boolean; expectedCode: string }
  | { kind: 'readd' }
  | { kind: 'conflict'; reason: string };

const RECONCILE_CONCURRENCY = 2;

/**
 * Ежедневная сверка: согласованные и синкнутые заявки, которые ещё не закончились (end >= сегодня),
 * против их элементов в графике отсутствий (инфоблок 3). Читаем пачками по ID.
 * - начало не тот день, конец не «последний день 23:59:59» (дата без времени и 00:00:00 тоже расхождение),
 *   пользователь не совпадает → update тем же путём, что и перенос дат
 *   (00:00:00 – 23:59:59, ELEMENT_CODE vbi-hr-vac-<id>, если получится);
 * - расхождение одного CODE (пустой или другой) поводом для update НЕ является: Bitrix не меняет код
 *   через update (бой, 19.10.2026), иначе сверка переписывала бы такие элементы каждую ночь;
 * - элемента нет → как «не найден»: обычная логика синка (поиск по CODE/датам, сирота, иначе add);
 * - CODE элемента принадлежит другой заявке → не трогаем, только лог.
 * Ничего не удаляет; элементы, не привязанные к заявкам, не трогает (кроме усыновления сироты
 * в pushVacationToBitrixAbsence). Стейдж/локалка: только чтение + лог «что сделали бы», state не меняется,
 * статусы failed и алерты админу не появляются.
 */
export const reconcileFutureAbsences = async (
  state: VacationStoreState
): Promise<ReconcileAbsencesResult> => {
  const dryRun = bitrixWritesBlockedNow();
  const result: ReconcileAbsencesResult = {
    state,
    checked: 0,
    fixed: 0,
    readded: 0,
    adopted: 0,
    failed: 0,
    dryRun
  };
  const summary = (note = '') =>
    console.info(
      `[bitrix-vacation] reconcile: checked=${result.checked} fixed=${result.fixed} readded=${result.readded} ` +
        `adopted=${result.adopted} failed=${result.failed}` +
        (dryRun ? ` (dry-run: ${bitrixWritesBlockedMessage()})` : '') +
        note
    );

  const hasWebhook = isBitrixWebhookConfigured();
  const hasOAuth = hasWebhook ? true : await hasBitrixOAuthServiceToken();
  if (!hasWebhook && !hasOAuth) {
    summary('; нет доступа к Bitrix, пропуск');
    return result;
  }

  const { id: targetIblockId, error } = await resolveAbsenceIblockId();
  if (!targetIblockId) {
    summary(`; инфоблок не определён: ${error || 'неизвестно'}`);
    return result;
  }

  const today = new Date().toISOString().slice(0, 10);
  const candidates = flattenRequests(state).filter(
    (r) =>
      isListsSynced(r) &&
      Number(r.bitrix_absence_iblock_id) === targetIblockId &&
      String(r.end || '') >= today
  );
  if (!candidates.length) {
    summary();
    return result;
  }

  // Элемент на проверку: у старой заявки один (весь период), у разрезанной праздниками — по отрезку.
  const units = candidates
    .flatMap((request) => reconcileUnitsOf(request))
    .filter((u) => u.absenceId > 0 && u.end >= today);

  const elements = await fetchAbsenceElementsByIds(
    targetIblockId,
    units.map((u) => u.absenceId)
  );
  if (!elements) {
    // Не смогли прочитать — ничего не решаем (иначе всё ушло бы в «re-add» с дублями).
    summary('; чтение графика не удалось, пропуск');
    return result;
  }

  await readEmployees();
  const ctx = absenceAdoptionContext(state);

  const plan: Array<{ unit: ReconcileUnit; action: ReconcileAction }> = [];
  for (const unit of units) {
    const { request, absenceId } = unit;
    result.checked += 1;
    const el = elements.get(absenceId);
    if (!el) {
      plan.push({ unit, action: { kind: 'readd' } });
      continue;
    }
    const expectedCode = absenceCode(request.id, unit.partIndex);
    const code = String(el.CODE || '').trim();
    const codeMatch = code.match(ABSENCE_CODE_RE);
    if (code && code !== expectedCode && codeMatch && ctx.knownRequestIds.has(Number(codeMatch[1]))) {
      plan.push({
        unit,
        action: { kind: 'conflict', reason: `элемент ${absenceId} с CODE ${code} принадлежит другой заявке` }
      });
      continue;
    }
    const reasons: string[] = [];
    if (!elementMatchesDates(el, unit.start, unit.end)) {
      reasons.push(`даты ${el.ACTIVE_FROM ?? '?'} – ${el.ACTIVE_TO ?? '?'} ≠ ${unit.start} – ${unit.end}`);
    }
    const employee = await findEmployeeByName(request.employee);
    const expectedUser = employee?.bitrix_user_id ?? null;
    const actualUser = absenceElementUserId(el);
    if (expectedUser && actualUser !== expectedUser) {
      reasons.push(`пользователь ${actualUser ?? 'пусто'} ≠ ${expectedUser}`);
    }
    // CODE сам по себе не повод для update: Bitrix его так не ставит (см. updateViaAbsenceIblock).
    plan.push({
      unit,
      action: reasons.length
        ? { kind: 'fix', absenceId, reasons, codeMismatch: code !== expectedCode, expectedCode }
        : { kind: 'ok' }
    });
  }

  if (dryRun) {
    for (const { unit, action } of plan) {
      const tag = unitTag(unit);
      if (action.kind === 'fix') {
        result.fixed += 1;
        console.info(
          `[bitrix-vacation] reconcile dry-run ${tag}: обновили бы ${action.absenceId} (${action.reasons.join('; ')})`
        );
      } else if (action.kind === 'readd') {
        result.readded += 1;
        console.info(
          `[bitrix-vacation] reconcile dry-run ${tag}: элемента ${unit.absenceId} нет в графике, создали бы заново`
        );
      } else if (action.kind === 'conflict') {
        result.failed += 1;
        console.warn(`[bitrix-vacation] reconcile dry-run ${tag}: ${action.reason}`);
      }
    }
    summary();
    return result;
  }

  type RequestPatch = { fields: Partial<VacationRequest>; failed: boolean; parts?: VacationBitrixAbsencePart[] };
  const patches = new Map<number, RequestPatch>();
  const patchOf = (unit: ReconcileUnit): RequestPatch => {
    let entry = patches.get(unit.request.id);
    if (!entry) {
      entry = {
        fields: {},
        failed: false,
        parts: unit.segmented ? (unit.request.bitrix_absence_parts ?? []).map((p) => ({ ...p })) : undefined
      };
      patches.set(unit.request.id, entry);
    }
    return entry;
  };
  const markSynced = (unit: ReconcileUnit, absenceId: number, method: string, iblockId: number | null) => {
    const entry = patchOf(unit);
    if (entry.parts) entry.parts[unit.partIndex] = { ...entry.parts[unit.partIndex]!, absence_id: absenceId };
    else entry.fields.bitrix_absence_id = absenceId;
    if (entry.failed) return;
    Object.assign(entry.fields, {
      bitrix_absence_iblock_id: iblockId ?? undefined,
      bitrix_sync_status: 'synced',
      bitrix_sync_method: method,
      bitrix_synced_at: new Date().toISOString(),
      bitrix_sync_error: undefined
    });
  };

  const work = plan.filter((p) => p.action.kind !== 'ok');
  await runWithConcurrency(work, RECONCILE_CONCURRENCY, async ({ unit, action }) => {
    const { request } = unit;
    const tag = unitTag(unit);
    if (action.kind === 'ok') return;
    if (action.kind === 'conflict') {
      result.failed += 1;
      console.warn(`[bitrix-vacation] reconcile ${tag}: ${action.reason}, не трогаем`);
      return;
    }
    try {
      if (action.kind === 'fix') {
        const employee = await findEmployeeByName(request.employee);
        const bitrixUserId = employee?.bitrix_user_id ?? null;
        if (!bitrixUserId) {
          throw new Error(`У сотрудника «${request.employee}» нет bitrix_user_id — не обновляем отсутствие`);
        }
        const { absenceId, method, codeSet } = await updateOrAddAbsence(
          action.absenceId,
          {
            bitrixUserId,
            start: unit.start,
            end: unit.end,
            comment: request.comment,
            requestId: request.id,
            partIndex: unit.partIndex,
            employeeName: request.employee
          },
          '-reconcile'
        );
        markSynced(unit, absenceId, method, targetIblockId);
        if (method.includes('add-after-not-found')) result.readded += 1;
        else result.fixed += 1;
        const codeNote = !action.codeMismatch
          ? ''
          : codeSet
            ? `; CODE ${action.expectedCode} установлен`
            : '; CODE не установлен (Bitrix не меняет код через update)';
        console.info(
          `[bitrix-vacation] reconcile ${tag}: ${action.absenceId} обновлён (${action.reasons.join('; ')})${codeNote}`
        );
        return;
      }
      // readd: элемента нет в графике — обычный путь синка (найдёт по CODE/датам, сироту или создаст).
      console.warn(
        `[bitrix-vacation] reconcile ${tag}: элемента ${unit.absenceId} нет в графике отсутствий, восстанавливаем`
      );
      const { absenceId, method, iblockId } = unit.segmented
        ? await pushVacationToBitrixAbsence(request, ctx, {
            start: unit.start,
            end: unit.end,
            partIndex: unit.partIndex,
            absenceId: unit.absenceId
          })
        : await pushVacationToBitrixAbsence(request, ctx);
      markSynced(unit, absenceId, method, iblockId);
      if (method.includes('-adopted')) result.adopted += 1;
      else result.readded += 1;
    } catch (err) {
      const message = errorMessage(err);
      if (isBitrixWriteBlockedError(err) || isBitrixWritesBlockedMessage(message)) {
        // Гвард стенда — не ошибка заявки: статус не трогаем.
        console.warn(`[bitrix-vacation] reconcile ${tag}: ${message}`);
        return;
      }
      result.failed += 1;
      console.error(`[bitrix-vacation] reconcile failed for request ${tag}:`, message);
      // failed → подхватит обычный повтор; bitrix_absence_id не трогаем. Без алерта админу.
      const entry = patchOf(unit);
      entry.failed = true;
      entry.fields = {
        ...(entry.fields.bitrix_absence_id ? { bitrix_absence_id: entry.fields.bitrix_absence_id } : {}),
        bitrix_sync_status: 'failed',
        bitrix_sync_error: message,
        bitrix_synced_at: new Date().toISOString()
      };
    }
  });

  let next = state;
  for (const [requestId, entry] of patches) {
    const patch: Partial<VacationRequest> = { ...entry.fields };
    if (entry.parts) {
      patch.bitrix_absence_parts = entry.parts;
      if (entry.parts[0]?.absence_id) patch.bitrix_absence_id = entry.parts[0].absence_id;
    }
    next = updateRequestInState(next, requestId, patch);
  }
  result.state = next;
  summary();
  return result;
};

/**
 * Полный проход обслуживания (старт процесса, раз в сутки, POST /api/bitrix/sync-vacations):
 * повтор failed/skipped + перенос из чужого инфоблока, затем сверка будущих отпусков.
 */
export const runBitrixVacationMaintenance = async (
  state: VacationStoreState
): Promise<{ state: VacationStoreState; reconcile: Omit<ReconcileAbsencesResult, 'state'> }> => {
  const afterRetry = await retryFailedBitrixVacationSyncs(state);
  const { state: reconciled, ...reconcile } = await reconcileFutureAbsences(afterRetry);
  return { state: reconciled, reconcile };
};
