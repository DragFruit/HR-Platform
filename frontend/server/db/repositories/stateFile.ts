import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Db } from '../client';
import { isDbEnabled } from '../client';
import { writeJsonAtomic } from '../../utils/atomicJson';
import { mapFromColumns, mapToColumns, nullColumns, type FieldSpecs } from '../fieldMapping';
import type { KeyedListDef } from './keyedList';
import {
  createJsonStateRepo,
  createStateGate,
  importStateFromJson,
  isPlainObject,
  type KeyedStateDef,
  type RawState,
  type StateImportResult,
  type StateRepo
} from './keyedState';

/**
 * Этап 8: обвязка «один JSON-файл ↔ один KeyedStateDef» для доменов пит-стопа, опросов,
 * адаптации и VPN. Всё то же, что у этапа 7 (ideas/knowledge), только без копипасты:
 * - флаг стенда (DB_<ДОМЕН>=1 + DATABASE_URL) и своя готовность у каждого файла;
 * - JSON-бэкенд: чтение/запись файла с тем же поведением, что у стора до переезда
 *   (нет файла → создать пустой; битый JSON → ошибка или запасное значение стора);
 * - разовый импорт с маркером в <схема>.json_imports и сверкой поле-в-поле (importStateFromJson).
 */

export const DATA_DIR = () => join(process.cwd(), 'server/data');

/** Флаг домена: DB_<NAME>=1 и база включена. На проде флага нет → JSON. */
export const dbFlag = (envName: string) => (): boolean =>
  String(process.env[envName] || '').trim() === '1' && isDbEnabled();

/** Простая запись с ключом: известные поля → колонки, остальное → extra, порядок ключей → source_keys. */
export function flatListDef(opts: {
  table: PgTable;
  /** Свойство в объекте файла с ключом. */
  keyField: string;
  /** Свойство строки Drizzle с ключом (по умолчанию = keyField). */
  keyProp?: string;
  keyOk: (v: unknown) => boolean;
  fields: FieldSpecs;
  lockKey: number;
  auditEntity: string;
  logTag: string;
  touchUpdatedAt: boolean;
  audit?: KeyedListDef<Record<string, unknown>>['audit'];
}): KeyedListDef<Record<string, unknown>> {
  const keyProp = opts.keyProp ?? opts.keyField;
  return {
    table: opts.table,
    keyProp,
    lockKey: opts.lockKey,
    auditEntity: opts.auditEntity,
    logTag: opts.logTag,
    touchUpdatedAt: opts.touchUpdatedAt,
    audit: opts.audit,
    toRow: (item, position) => {
      if (!isPlainObject(item) || !opts.keyOk(item[opts.keyField])) return null;
      const { cols, sourceKeys, extra } = mapToColumns(item, opts.fields, [opts.keyField]);
      return { ...nullColumns(opts.fields), ...cols, [keyProp]: item[opts.keyField], position, sourceKeys, extra };
    },
    fromRow: (r) =>
      mapFromColumns(r, opts.fields, r.sourceKeys as string[] | null, r.extra as Record<string, unknown> | null, {
        [opts.keyField]: r[keyProp]
      })
  };
}

/**
 * Карта { "<ключ>": <значение> } ↔ строки (ключ, значение). Пример: счётчики визитов опроса
 * { "survey-1": 3 }. Если хоть одно значение не подходит: часть не список (лежит в extra как есть).
 */
export function mapPart<V>(opts: {
  prop: string;
  def: KeyedListDef<{ key: string; value: V }>;
  valueOk: (v: unknown) => v is V;
}) {
  return {
    prop: opts.prop,
    def: opts.def as KeyedListDef<any>,
    toItems: (v: unknown) =>
      isPlainObject(v) && Object.values(v).every(opts.valueOk) ? Object.entries(v).map(([key, value]) => ({ key, value })) : null,
    fromItems: (items: unknown[]) => {
      const out: Record<string, unknown> = {};
      for (const e of items as { key: string; value: V }[]) out[e.key] = e.value;
      return out;
    }
  };
}

export type StateFileOptions = {
  /** Имя файла в server/data и метка импорта в json_imports. */
  fileName: string;
  label: string;
  logTag: string;
  flag: () => boolean;
  def: KeyedStateDef;
  jsonImports: PgTable;
  defaultRaw: () => RawState;
  /** Нет файла при чтении → создать с defaultRaw (как ensureFile у стора). По умолчанию да. */
  createIfMissing?: boolean;
  /** Битый JSON при чтении: что отдавал стор до переезда. Нет: ошибка (как JSON.parse). */
  onBadJson?: () => RawState;
  /** Проверка перед импортом (VPN: нет секретов). Ошибка → импорт не идёт, домен остаётся на файле. */
  beforeImport?: (raw: unknown) => void;
};

export function jsonStateIo(opts: Pick<StateFileOptions, 'defaultRaw' | 'createIfMissing' | 'onBadJson'>, file: string) {
  const create = opts.createIfMissing ?? true;
  return {
    async read(): Promise<RawState> {
      let text: string;
      try {
        text = await readFile(file, 'utf8');
      } catch {
        const value = opts.defaultRaw();
        if (create) {
          await mkdir(dirname(file), { recursive: true });
          await writeJsonAtomic(file, value);
        }
        return value;
      }
      try {
        return JSON.parse(text) as RawState;
      } catch (err) {
        if (opts.onBadJson) return opts.onBadJson();
        throw err;
      }
    },
    async write(raw: RawState) {
      await mkdir(dirname(file), { recursive: true });
      await writeJsonAtomic(file, raw);
    }
  };
}

export function defineStateFile(opts: StateFileOptions) {
  const file = () => join(DATA_DIR(), opts.fileName);
  const gate = createStateGate({
    label: opts.label,
    logTag: opts.logTag,
    flag: opts.flag,
    def: opts.def,
    makeJson: () => createJsonStateRepo(jsonStateIo(opts, file()))
  });

  /** Нет файла → импорт пустого состояния; битый JSON → ошибка (домен остаётся на файле). */
  async function readForImport(path: string): Promise<unknown> {
    let text: string;
    try {
      text = await readFile(path, 'utf8');
    } catch {
      return opts.defaultRaw();
    }
    return JSON.parse(text);
  }

  return {
    ...opts,
    file,
    gate,
    repo: (): Promise<StateRepo> => gate.repo(),
    setReady: gate.setReady,
    backend: async (): Promise<'json' | 'postgres'> => (await gate.repo()).backend,
    jsonRepo: (path = file()) => createJsonStateRepo(jsonStateIo(opts, path)),
    async importFromJson(db: Db, path = file()): Promise<StateImportResult> {
      const raw = await readForImport(path);
      opts.beforeImport?.(raw);
      return importStateFromJson(db, opts.def, { source: opts.fileName, jsonImports: opts.jsonImports, raw });
    }
  };
}

export type StateFile = ReturnType<typeof defineStateFile>;
