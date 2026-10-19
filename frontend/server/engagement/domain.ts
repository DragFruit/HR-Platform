import {
  engagementState,
  pitStopPairs,
  pitStopPlayers,
  pitStopRaceRecords,
  pitStopRaceVisits,
  pitStopRaceWinners
} from '../db/schema';
import { isBool, isInt, isoTimestamp, isStr, type FieldSpecs } from '../db/fieldMapping';
import { arrayPart, isPlainObject, type KeyedStateDef } from '../db/repositories/keyedState';
import { dbFlag, flatListDef } from '../db/repositories/stateFile';

/**
 * Этап 8: пит-стоп (server/data/pit-stop-14.json, pit-stop-race.json) → схема engagement.
 * Маппинг «объект ↔ строка» (source_keys + extra). Нормализация и бизнес-логика: в
 * pitStopStore / pitStopRaceStore, одна на оба бэкенда. Фото кофе: файлы, не сюда.
 */

/** DB_ENGAGEMENT=1 и задан DATABASE_URL → Postgres. Флаг стоит только на стейдже. */
export const engagementDbFlag = dbFlag('DB_ENGAGEMENT');

/** pg_advisory_xact_lock на запись каждого файла (свои, не пересекаются с этапами 1–7). */
export const PIT_STOP_LOCK_KEY = 72_461_021;
export const PIT_STOP_RACE_LOCK_KEY = 72_461_022;

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const isPositiveKeyInt = (v: unknown) => isInt(v);
const isNonEmptyStr = (v: unknown) => typeof v === 'string' && v.length > 0;

const PAIR_FIELDS: FieldSpecs = {
  userIdA: { col: 'userIdA', ok: isInt },
  userIdB: { col: 'userIdB', ok: isInt },
  nameA: { col: 'nameA', ok: isStr },
  nameB: { col: 'nameB', ok: isStr },
  cipher: { col: 'cipher', ok: isStr },
  assemblyTurn: { col: 'assemblyTurn', ok: isStr },
  assemblyStep: { col: 'assemblyStep', ok: isInt },
  ignitionHeldBy: { col: 'ignitionHeldBy', ok: isArr },
  blindRoleA: { col: 'blindRoleA', ok: isStr },
  blindX: { col: 'blindX', ok: isNum },
  blindY: { col: 'blindY', ok: isNum },
  blindStartedAt: isoTimestamp('blindStartedAt'),
  puzzleGlowA: { col: 'puzzleGlowA', ok: isArr },
  puzzleGlowB: { col: 'puzzleGlowB', ok: isArr },
  puzzlePressedA: { col: 'puzzlePressedA', ok: isArr },
  puzzlePressedB: { col: 'puzzlePressedB', ok: isArr }
};

const PLAYER_FIELDS: FieldSpecs = {
  name: { col: 'name', ok: isStr },
  pairId: { col: 'pairId', ok: isStr },
  role: { col: 'role', ok: isStr },
  isRemote: { col: 'isRemote', ok: isBool },
  checkpoints: { col: 'checkpoints', ok: isPlainObject },
  coffeePhotoPath: { col: 'coffeePhotoPath', ok: isStr },
  coffeeApproved: { col: 'coffeeApproved', ok: isBool },
  completedAt: isoTimestamp('completedAt'),
  rewardsGranted: { col: 'rewardsGranted', ok: isBool }
};

export const PIT_STOP_PAIR_DEF = flatListDef({
  table: pitStopPairs,
  keyField: 'id',
  keyOk: isNonEmptyStr,
  fields: PAIR_FIELDS,
  lockKey: PIT_STOP_LOCK_KEY,
  auditEntity: 'engagement.pit_stop_pair',
  logTag: 'pit-stop',
  touchUpdatedAt: true
});

export const PIT_STOP_PLAYER_DEF = flatListDef({
  table: pitStopPlayers,
  keyField: 'userId',
  keyOk: isPositiveKeyInt,
  fields: PLAYER_FIELDS,
  lockKey: PIT_STOP_LOCK_KEY,
  auditEntity: 'engagement.pit_stop_player',
  logTag: 'pit-stop',
  touchUpdatedAt: true
});

/** Строки state для pit-stop-14.json; normalize добавляет pitStopStore. */
export const PIT_STOP_STATE_DEF: Omit<KeyedStateDef, 'normalize'> = {
  lockKey: PIT_STOP_LOCK_KEY,
  logTag: 'pit-stop',
  auditEntity: 'engagement.pit_stop_state',
  metaTable: engagementState,
  metaId: 1,
  metaFields: {
    easterCode: { col: 'easterCode', ok: isStr },
    finalizedAt: isoTimestamp('finalizedAt')
  },
  parts: [arrayPart('players', PIT_STOP_PLAYER_DEF), arrayPart('pairs', PIT_STOP_PAIR_DEF)]
};

const RACE_RECORD_FIELDS: FieldSpecs = {
  name: { col: 'name', ok: isStr },
  department: { col: 'department', ok: isStr },
  bestMs: { col: 'bestMs', ok: isNum },
  color: { col: 'color', ok: isStr },
  laps: { col: 'laps', ok: isInt },
  bestAt: isoTimestamp('bestAt'),
  updatedAt: isoTimestamp('updatedAt'),
  history: { col: 'history', ok: isArr },
  cheat: { col: 'cheat', ok: isPlainObject }
};

export const PIT_STOP_RACE_RECORD_DEF = flatListDef({
  table: pitStopRaceRecords,
  keyField: 'userId',
  keyOk: isPositiveKeyInt,
  fields: RACE_RECORD_FIELDS,
  lockKey: PIT_STOP_RACE_LOCK_KEY,
  auditEntity: 'engagement.pit_stop_race_record',
  logTag: 'pit-stop-race',
  // updatedAt: поле рекорда (данные), служебной колонки нет
  touchUpdatedAt: false
});

export const PIT_STOP_RACE_VISIT_DEF = flatListDef({
  table: pitStopRaceVisits,
  keyField: 'userId',
  keyOk: isPositiveKeyInt,
  fields: { name: { col: 'name', ok: isStr }, at: isoTimestamp('at') },
  lockKey: PIT_STOP_RACE_LOCK_KEY,
  auditEntity: 'engagement.pit_stop_race_visit',
  logTag: 'pit-stop-race',
  touchUpdatedAt: true
});

export const PIT_STOP_RACE_WINNER_DEF = flatListDef({
  table: pitStopRaceWinners,
  keyField: 'rank',
  keyOk: isPositiveKeyInt,
  fields: {
    userId: { col: 'userId', ok: isInt },
    name: { col: 'name', ok: isStr },
    bestMs: { col: 'bestMs', ok: isNum }
  },
  lockKey: PIT_STOP_RACE_LOCK_KEY,
  auditEntity: 'engagement.pit_stop_race_winner',
  logTag: 'pit-stop-race',
  touchUpdatedAt: true
});

/** Строка state для pit-stop-race.json; normalize добавляет pitStopRaceStore. */
export const PIT_STOP_RACE_STATE_DEF: Omit<KeyedStateDef, 'normalize'> = {
  lockKey: PIT_STOP_RACE_LOCK_KEY,
  logTag: 'pit-stop-race',
  auditEntity: 'engagement.pit_stop_race_state',
  metaTable: engagementState,
  metaId: 2,
  metaFields: { finalizedAt: isoTimestamp('finalizedAt') },
  parts: [
    arrayPart('records', PIT_STOP_RACE_RECORD_DEF),
    arrayPart('visits', PIT_STOP_RACE_VISIT_DEF),
    arrayPart('winners', PIT_STOP_RACE_WINNER_DEF)
  ]
};
