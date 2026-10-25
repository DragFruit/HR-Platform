import { sql } from 'drizzle-orm';
import {
  bigserial,
  date,
  doublePrecision,
  boolean,
  index,
  integer,
  json,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

/**
 * Схема `core` — справочник сотрудников, overlay руководителей и оргструктура.
 * Этап 3 миграции с JSON (раньше server/data/employees.json, employee-managers.json,
 * org-structure.json). Включается флагом DB_CORE=1 (сейчас только стейдж), см. docs/ARCHITECTURE.md.
 */
export const coreSchema = pgSchema('core');

/**
 * Сотрудник. id — тот же, что в employees.json (для Bitrix-сотрудников = bitrix_user_id),
 * на него ссылаются отпуска, уведомления, адаптация. ФИО ключом не является.
 */
export const employees = coreSchema.table(
  'employees',
  {
    id: integer('id').primaryKey(),
    name: text('name').notNull().default(''),
    title: text('title').notNull().default(''),
    /** Название отдела, как в справочнике (строка из Bitrix department.get или ручной ввод). */
    department: text('department').notNull().default(''),
    /** ФИО руководителя для UI; связь — manager_id. */
    manager: text('manager').notNull().default(''),
    managerId: integer('manager_id'),
    /** null — дата не задана или не YYYY-MM-DD (исходная строка тогда в extra.hired_at). */
    hiredAt: date('hired_at', { mode: 'string' }),
    /** `YYYY-MM-DD` или `MM-DD` — поэтому text. */
    birthday: text('birthday'),
    platformUserId: integer('platform_user_id'),
    bitrixUserId: integer('bitrix_user_id'),
    email: text('email'),
    accountRole: text('account_role'),
    vacationOpeningBalance: doublePrecision('vacation_opening_balance'),
    legalEntity: text('legal_entity'),
    contractForm: text('contract_form'),
    /** Порядок в справочнике (как в массиве JSON). */
    position: integer('position').notNull().default(0),
    /**
     * Набор и порядок ключей исходного JSON-объекта: API отдаёт ровно те же поля
     * (отсутствующее поле ≠ null), как и до переезда.
     */
    sourceKeys: text('source_keys').array(),
    /** Поля из JSON, которых нет в колонках, и значения, не влезшие в тип колонки. */
    extra: jsonb('extra').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('employees_bitrix_user_id_idx').on(t.bitrixUserId),
    index('employees_platform_user_id_idx').on(t.platformUserId),
    index('employees_manager_id_idx').on(t.managerId),
    index('employees_email_idx').on(sql`lower(${t.email})`)
  ]
);

/**
 * История отдела / должности / руководителя. Пишется только с момента переезда в Postgres:
 * при импорте — текущее состояние с valid_from = null («было так уже на момент импорта, с какого
 * числа — неизвестно»), дальше каждое изменение закрывает строку (valid_to) и открывает новую.
 * Прошлое не выдумываем.
 */
export const employeeAssignmentHistory = coreSchema.table(
  'employee_assignment_history',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    employeeId: integer('employee_id').notNull(),
    department: text('department').notNull().default(''),
    title: text('title').notNull().default(''),
    manager: text('manager').notNull().default(''),
    managerId: integer('manager_id'),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    /** null — текущая запись. */
    validTo: timestamp('valid_to', { withTimezone: true }),
    /** import | write | added | removed. */
    source: text('source').notNull()
  },
  (t) => [
    index('employee_assignment_history_employee_idx').on(t.employeeId, t.validFrom),
    uniqueIndex('employee_assignment_history_open_uq').on(t.employeeId).where(sql`${t.validTo} is null`)
  ]
);

/** Overlay руководителей по id сотрудника (бывш. employee-managers.json → byId). */
export const managerAssignments = coreSchema.table('manager_assignments', {
  employeeId: integer('employee_id').primaryKey(),
  managerName: text('manager_name').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * Legacy-fallback overlay по нормализованному ФИО (бывш. byName). Ключ — не идентификатор
 * сотрудника, а запасной матч для строк без id; сохранён, чтобы не поменялось поведение.
 */
export const managerAssignmentsByName = coreSchema.table('manager_assignments_by_name', {
  nameKey: text('name_key').primaryKey(),
  managerName: text('manager_name').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Оргструктура (редактор /org-structure): руководители верхнего уровня — корни дерева. */
export const orgExecutives = coreSchema.table('org_executives', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default(''),
  person: text('person').notNull().default(''),
  sortOrder: doublePrecision('sort_order').notNull().default(0),
  gridCol: doublePrecision('grid_col'),
  gridRow: doublePrecision('grid_row'),
  x: doublePrecision('x'),
  y: doublePrecision('y'),
  position: integer('position').notNull().default(0),
  extra: jsonb('extra').$type<Record<string, unknown>>()
});

/** Рамка-блок внутри руководителя (группа отделов). */
export const orgGroups = coreSchema.table(
  'org_groups',
  {
    id: text('id').primaryKey(),
    executiveId: text('executive_id').notNull(),
    label: text('label').notNull().default(''),
    sortOrder: doublePrecision('sort_order').notNull().default(0),
    labelX: doublePrecision('label_x'),
    labelY: doublePrecision('label_y'),
    gridCol: doublePrecision('grid_col'),
    gridRow: doublePrecision('grid_row'),
    x: doublePrecision('x'),
    y: doublePrecision('y'),
    width: doublePrecision('width'),
    height: doublePrecision('height'),
    position: integer('position').notNull().default(0),
    extra: jsonb('extra').$type<Record<string, unknown>>()
  },
  (t) => [index('org_groups_executive_idx').on(t.executiveId)]
);

/** Отдел: executive → (group) → unit; stack_id — колонка-стопка на холсте. */
export const orgUnits = coreSchema.table(
  'org_units',
  {
    id: text('id').primaryKey(),
    executiveId: text('executive_id').notNull(),
    groupId: text('group_id'),
    stackId: text('stack_id'),
    name: text('name').notNull().default(''),
    head: text('head').notNull().default(''),
    sortOrder: doublePrecision('sort_order').notNull().default(0),
    employeesCount: integer('employees_count').notNull().default(0),
    /** Состав карточки отдела, как в редакторе (OrgMember[]). */
    members: jsonb('members').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    gridCol: doublePrecision('grid_col'),
    gridRow: doublePrecision('grid_row'),
    x: doublePrecision('x'),
    y: doublePrecision('y'),
    width: doublePrecision('width'),
    height: doublePrecision('height'),
    position: integer('position').notNull().default(0),
    extra: jsonb('extra').$type<Record<string, unknown>>()
  },
  (t) => [index('org_units_executive_idx').on(t.executiveId), index('org_units_group_idx').on(t.groupId)]
);

/** Стрелки на холсте оргструктуры. */
export const orgLinks = coreSchema.table('org_links', {
  id: text('id').primaryKey(),
  fromKind: text('from_kind').notNull(),
  fromId: text('from_id').notNull(),
  fromSide: text('from_side').notNull(),
  toKind: text('to_kind').notNull(),
  toId: text('to_id').notNull(),
  toSide: text('to_side').notNull(),
  mid: doublePrecision('mid'),
  position: integer('position').notNull().default(0),
  extra: jsonb('extra').$type<Record<string, unknown>>()
});

/**
 * Стоп-лист доступа: сотрудник удалён из справочника → вход закрыт, данные чистятся по срокам.
 * Этап 5 (раньше server/data/employee-access-denylist.json), флаг DB_CORE=1. Читается на каждом
 * запросе с сессией — через кэш процесса; JSON-файл обновляется зеркалом после каждой записи
 * (запасной вариант при недоступной базе, см. docs/ARCHITECTURE.md «Этап 5»).
 * Естественного ключа нет (bitrix id / email / employee_id бывают пустыми) — суррогатный id.
 */
export const accessDenylist = coreSchema.table(
  'access_denylist',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    position: integer('position').notNull().default(0),
    bitrixUserId: integer('bitrix_user_id'),
    platformUserId: integer('platform_user_id'),
    email: text('email'),
    name: text('name'),
    employeeId: integer('employee_id'),
    /** Время отзыва (ISO как в JSON). */
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    /** Метка «почему»: removed-from-roster и т.п. */
    reason: text('reason'),
    avatarPurgeAt: timestamp('avatar_purge_at', { withTimezone: true, mode: 'date' }),
    vacationsPurgeAt: timestamp('vacations_purge_at', { withTimezone: true, mode: 'date' }),
    walletPurgeAt: timestamp('wallet_purge_at', { withTimezone: true, mode: 'date' }),
    purchasesPurgeAt: timestamp('purchases_purge_at', { withTimezone: true, mode: 'date' }),
    avatarPurged: boolean('avatar_purged'),
    vacationsPurged: boolean('vacations_purged'),
    sourceKeys: text('source_keys').array(),
    extra: json('extra').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('access_denylist_bitrix_idx').on(t.bitrixUserId),
    index('access_denylist_employee_idx').on(t.employeeId),
    index('access_denylist_email_idx').on(t.email)
  ]
);

/** Разовые импорты из JSON домена core: строка есть → импорт уже был. */
export const coreJsonImports = coreSchema.table('json_imports', {
  source: text('source').primaryKey(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  fileCount: integer('file_count').notNull(),
  inserted: integer('inserted').notNull(),
  skipped: integer('skipped').notNull()
});
