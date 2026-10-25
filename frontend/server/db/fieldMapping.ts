/**
 * Общий маппинг «объект из JSON-файла ↔ строка таблицы» для простых плоских записей
 * (уведомления админа, журналы напоминаний, стоп-лист доступа).
 *
 * Правила (те же, что у сотрудников и отпусков):
 * - известное поле нужного типа → своя колонка; не того типа → `extra` как есть (ничего не теряем);
 * - неизвестное поле → `extra`;
 * - `source_keys` — набор и порядок ключей исходного объекта: отсутствующее поле ≠ null,
 *   поэтому объект из базы сериализуется байт-в-байт как из файла;
 * - значения `undefined` в файл не попадали (JSON.stringify их выкидывает) — их не храним.
 */
export type FieldSpec = {
  /** Имя свойства строки Drizzle. */
  col: string;
  /** Подходит ли значение для колонки (иначе — в extra). */
  ok: (v: unknown) => boolean;
  /** JSON → колонка (по умолчанию как есть). */
  toDb?: (v: unknown) => unknown;
  /** Колонка → JSON (по умолчанию как есть). */
  fromDb?: (v: unknown) => unknown;
};

export type FieldSpecs = Record<string, FieldSpec>;

export const isStr = (v: unknown): v is string => typeof v === 'string';
export const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
export const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
export const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** ISO-время, которое переживает timestamptz без изменений (`2026-06-30T10:32:30.065Z`). */
export const isExactIso = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime()) && d.toISOString() === v;
};

/** Спека для timestamptz-колонки (mode: 'date'): в колонку — только точно восстановимое ISO. */
export const isoTimestamp = (col: string): FieldSpec => ({
  col,
  ok: isExactIso,
  toDb: (v) => new Date(v as string),
  fromDb: (v) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
});

export type MappedFields = {
  cols: Record<string, unknown>;
  sourceKeys: string[];
  extra: Record<string, unknown> | null;
};

/** Объект → колонки + source_keys + extra. Ключи из `skip` (например, первичный ключ) обрабатывает вызывающий. */
export function mapToColumns(item: Record<string, unknown>, specs: FieldSpecs, skip: string[] = []): MappedFields {
  const cols: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};
  const sourceKeys: string[] = [];
  for (const [key, value] of Object.entries(item)) {
    if (value === undefined) continue;
    sourceKeys.push(key);
    if (skip.includes(key)) continue;
    const spec = specs[key];
    if (!spec) {
      extra[key] = value;
      continue;
    }
    if (value === null) continue; // колонка null; присутствие ключа — в source_keys
    if (spec.ok(value)) cols[spec.col] = spec.toDb ? spec.toDb(value) : value;
    else extra[key] = value;
  }
  return { cols, sourceKeys, extra: Object.keys(extra).length ? extra : null };
}

/** Колонки + source_keys + extra → объект с теми же ключами в том же порядке. */
export function mapFromColumns(
  row: Record<string, unknown>,
  specs: FieldSpecs,
  sourceKeys: string[] | null | undefined,
  extra: Record<string, unknown> | null | undefined,
  fixed: Record<string, unknown> = {}
): Record<string, unknown> {
  const ex = extra ?? {};
  const keys = sourceKeys?.length ? sourceKeys : [...Object.keys(fixed), ...Object.keys(specs)];
  const strict = Boolean(sourceKeys?.length);
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(ex, key)) {
      out[key] = ex[key];
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(fixed, key)) {
      out[key] = fixed[key];
      continue;
    }
    const spec = specs[key];
    if (!spec) continue;
    const value = row[spec.col];
    if (value === null || value === undefined) {
      if (strict) out[key] = null;
      continue;
    }
    out[key] = spec.fromDb ? spec.fromDb(value) : value;
  }
  for (const [key, value] of Object.entries(ex)) {
    if (!(key in out)) out[key] = value;
  }
  return out;
}

/** Все колонки из спеки со значением null (для upsert: «не задано» должно стирать старое). */
export function nullColumns(specs: FieldSpecs): Record<string, null> {
  const out: Record<string, null> = {};
  for (const spec of Object.values(specs)) out[spec.col] = null;
  return out;
}
