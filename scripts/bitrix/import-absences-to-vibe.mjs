#!/usr/bin/env node
/**
 * Мост до восстановления бэкапа: отпуска из графика отсутствий Bitrix (инфоблок 3),
 * которых нет в Vibe, → согласованные заявки в Postgres (vacations.requests), привязанные
 * к тому же элементу Bitrix. См. docs/BITRIX.md «Импорт отсутствий из Bitrix в Vibe».
 *
 * Bitrix: ТОЛЬКО чтение (lists.element.get, user.get, department.get) через сервисный OAuth-токен
 * приложения (server/data/bitrix-oauth-service.json, как bitrixOAuthServiceToken.ts; при refresh
 * новый refresh_token пишется обратно в тот же файл). Никаких add/update/delete, уведомлений, чат-бота.
 * Запись в БД: как writeVacationDiff приложения (create + история + audit) под тем же
 * pg_advisory_xact_lock(72461004), чтобы не гоняться с процессом vbi-hr.
 *
 * Импортированные заявки: status=approved, bitrix_sync_status=synced,
 * bitrix_sync_method=bitrix-import (не «lists.element*»): ежедневная сверка дат и перенос между
 * инфоблоками их не трогают, т.е. элемент в Bitrix не переписывается. Повторный запуск
 * идемпотентен: уже привязанные элементы (bitrix_absence_id и отрезки bitrix_absence_parts в extra:
 * отпуск, разрезанный праздником, в Bitrix — несколько элементов на одну заявку) пропускаются.
 *
 * Запуск на сервере (по умолчанию dry-run):
 *   sudo bash -c 'set -a; . /etc/vbi-hr/bitrix-production.env; set +a; \
 *     node /var/www/vbi-hr/deploy-scripts/import-absences-to-vibe.mjs [--apply] [--from=2026-01-01]'
 * Пакет postgres берётся из /var/www/vbi-hr/.output/server/node_modules (или VBI_NODE_MODULES).
 */
import { chmodSync, chownSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
/** Заявки Vibe «на согласовании» с теми же датами, что элемент в графике Bitrix → approved + привязка. */
const APPROVE_PENDING = args.includes('--approve-pending');
const FROM = (args.find((a) => a.startsWith('--from=')) || '--from=2026-01-01').slice(7);
const idList = (flag) =>
  (args.find((a) => a.startsWith(`--${flag}=`)) || '').slice(flag.length + 3).split(',').map(Number).filter((n) => n > 0);
/** Добавить в справочник сотрудников Bitrix с этими id (как импорт новых в bitrixSync.ts). Только по решению заказчика. */
const ADD_EMPLOYEES = idList('add-employees');
/** Ограничить импорт отпусков этими пользователями Bitrix. */
const ONLY_USERS = idList('only-users');
const CORE_WRITE_LOCK_KEY = 72_461_003;
const TODAY = new Date().toISOString().slice(0, 10);
const REASON = `bitrix-import-${TODAY}`;
const METHOD = 'bitrix-import';

const IBLOCK_ID = Number(process.env.BITRIX_ABSENCE_IBLOCK_ID || 3);
const IBLOCK_TYPE = process.env.BITRIX_ABSENCE_IBLOCK_TYPE_ID || 'structure';
const TYPE_ENUM = String(process.env.BITRIX_ABSENCE_TYPE_ENUM || '1');
const USER_PROP = process.env.BITRIX_ABSENCE_PROPERTY_USER || 'PROPERTY_1';
const TYPE_PROP = process.env.BITRIX_ABSENCE_PROPERTY_TYPE || 'PROPERTY_7';
const VACATIONS_WRITE_LOCK_KEY = 72_461_004;
/** QA-отдел «Тестировщики» (app/data/qaTestDepartment.ts). */
const QA_IDS = new Set([9001, 9002, 9003, 9004, 9005, 9006, 9100, ...Array.from({ length: 24 }, (_, i) => 9201 + i)]);

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан');

// ---------- Bitrix: OAuth service token приложения (как server/utils/bitrixOAuthServiceToken.ts) ----------
// Вебхук на бою мёртвый; используем refresh_token, сохранённый приложением при входе админа.
const PORTAL = String(process.env.BITRIX_PORTAL_URL || 'https://crm.vbi.ru').trim().replace(/\/+$/, '');
const CLIENT_ID = String(process.env.BITRIX_CLIENT_ID || '').trim();
const CLIENT_SECRET = String(process.env.BITRIX_CLIENT_SECRET || '').trim();
const ENV_REFRESH = String(process.env.BITRIX_SERVICE_REFRESH_TOKEN || '').trim();
const TOKEN_FILES = [
  String(process.env.BITRIX_OAUTH_SERVICE_FILE || '').trim(),
  '/var/www/vbi-hr/server/data/bitrix-oauth-service.json',
  join(process.cwd(), 'server/data/bitrix-oauth-service.json'),
  '/etc/vbi-hr/bitrix-oauth-service.json'
].filter(Boolean);

let tokenFile = null;
let tokenState = null;
function readTokenState() {
  if (ENV_REFRESH) return { refresh_token: ENV_REFRESH };
  for (const path of [...new Set(TOKEN_FILES)]) {
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8'));
      if (parsed?.refresh_token?.trim()) {
        tokenFile = path;
        return parsed;
      }
    } catch {
      /* следующий путь */
    }
  }
  return null;
}

/** Как writeJsonAtomic приложения (tmp + rename), с тем же владельцем и правами, что у файла. */
function writeTokenState(state) {
  const st = statSync(tokenFile);
  const tmp = `${tokenFile}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: st.mode & 0o777 });
  chmodSync(tmp, st.mode & 0o777); // umask не должен срезать права
  try {
    chownSync(tmp, st.uid, st.gid);
  } catch {
    /* не root: владелец и так наш */
  }
  renameSync(tmp, tokenFile);
}

async function accessToken(force = false) {
  tokenState = readTokenState();
  if (!tokenState) throw new Error('нет refresh_token сервисного OAuth (bitrix-oauth-service.json)');
  if (!force && tokenState.access_token && Number(tokenState.expires_at) > Date.now() + 60_000) {
    return tokenState.access_token;
  }
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('BITRIX_CLIENT_ID / BITRIX_CLIENT_SECRET не заданы');
  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: tokenState.refresh_token.trim()
  });
  // Как refreshBitrixToken приложения: POST form на портал. Если портал отвечает 5xx,
  // повтор GET с параметрами в query (так описано в документации Bitrix OAuth).
  let res = await fetch(`${PORTAL}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(30_000)
  });
  let text = await res.text();
  if (res.status >= 500) {
    console.log(`OAuth refresh POST: HTTP ${res.status} ${text.replace(/[A-Za-z0-9]{24,}/g, '***').slice(0, 200).replace(/\s+/g, ' ')}`);
    res = await fetch(`${PORTAL}/oauth/token/?${form}`, { signal: AbortSignal.timeout(30_000) });
    text = await res.text();
  }
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* не JSON */
  }
  if (!res.ok || !data.access_token) {
    const snippet = text.replace(/[A-Za-z0-9]{24,}/g, '***').slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(`Bitrix OAuth refresh: ${data.error_description || data.error || `HTTP ${res.status}`} ${snippet}`);
  }
  const next = {
    refresh_token: String(data.refresh_token || tokenState.refresh_token).trim(),
    access_token: data.access_token,
    expires_at: Date.now() + Number(data.expires_in || 3600) * 1000,
    updated_at: new Date().toISOString(),
    saved_by_user_id: tokenState.saved_by_user_id
  };
  // refresh_token мог смениться: сохраняем туда же, иначе приложение потеряет токен
  if (!ENV_REFRESH && tokenFile) writeTokenState(next);
  tokenState = next;
  console.log(`OAuth: access_token обновлён${tokenFile ? `, файл ${tokenFile} перезаписан` : ''}`);
  return next.access_token;
}

/** Только чтение: любой другой метод сразу даёт ошибку, до сетевого вызова. */
const READ_ONLY = new Set(['lists.element.get', 'user.get', 'department.get']);
async function bitrix(method, params, retried = false) {
  if (!READ_ONLY.has(method)) throw new Error(`метод ${method} запрещён (скрипт только читает Bitrix)`);
  const auth = await accessToken(retried);
  const res = await fetch(`${PORTAL}/rest/${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, auth }),
    signal: AbortSignal.timeout(60_000)
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!retried && (data.error === 'expired_token' || data.error === 'invalid_token')) return bitrix(method, params, true);
  if (data.error) throw new Error(`Bitrix ${method}: ${data.error_description || data.error}`);
  return data;
}

async function bitrixAll(method, params) {
  const out = [];
  for (let start = 0; ; ) {
    const data = await bitrix(method, { ...params, start });
    const batch = Array.isArray(data.result) ? data.result : [];
    out.push(...batch);
    if (data.next === undefined || !batch.length) break;
    start = data.next;
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
}

const firstValue = (v) => {
  if (v == null) return null;
  if (typeof v === 'object') return Object.values(v)[0] ?? null;
  return v;
};
const isoFromBitrix = (v) => {
  const m = String(v || '').trim().match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};
const ruFromIso = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const days = (s, e) => Math.round((Date.parse(`${e}T00:00:00Z`) - Date.parse(`${s}T00:00:00Z`)) / 86400000) + 1;
/** Все элементы Bitrix, привязанные к заявкам: bitrix_absence_id + extra.bitrix_absence_parts[].absence_id. */
const linkedAbsenceIds = (rows) => {
  const ids = new Set();
  for (const r of rows) {
    if (Number(r.bitrix_absence_id) > 0) ids.add(Number(r.bitrix_absence_id));
    const parts = Array.isArray(r.extra?.bitrix_absence_parts) ? r.extra.bitrix_absence_parts : [];
    for (const p of parts) if (Number(p?.absence_id) > 0) ids.add(Number(p.absence_id));
  }
  return ids;
};
const nameKey = (n) => String(n || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

async function loadPostgres() {
  const dirs = [process.env.VBI_NODE_MODULES, '/var/www/vbi-hr/.output/server/node_modules', join(process.cwd(), 'frontend/node_modules')].filter(Boolean);
  for (const dir of dirs) {
    const pkgDir = join(dir, 'postgres');
    if (!existsSync(join(pkgDir, 'package.json'))) continue;
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    const entry = pkg.exports?.['.']?.import?.default || pkg.exports?.['.']?.import || pkg.module || pkg.main || 'src/index.js';
    const mod = await import(pathToFileURL(join(pkgDir, typeof entry === 'string' ? entry : 'src/index.js')).href);
    return mod.default || mod;
  }
  throw new Error('пакет postgres не найден (VBI_NODE_MODULES)');
}

// ---------- 1. Bitrix: все элементы графика отсутствий ----------
const elements = await bitrixAll('lists.element.get', {
  IBLOCK_TYPE_ID: IBLOCK_TYPE,
  IBLOCK_ID: IBLOCK_ID,
  ELEMENT_ORDER: { ID: 'ASC' }
});

const absences = elements.map((el) => ({
  id: Number(el.ID),
  code: String(el.CODE || ''),
  userId: Number(firstValue(el[USER_PROP])) || null,
  type: String(firstValue(el[TYPE_PROP]) ?? ''),
  start: isoFromBitrix(el.ACTIVE_FROM),
  end: isoFromBitrix(el.ACTIVE_TO),
  created: isoFromBitrix(el.DATE_CREATE)
}));
const typeCounts = {};
for (const a of absences) typeCounts[a.type || '(пусто)'] = (typeCounts[a.type || '(пусто)'] || 0) + 1;
const vacations = absences.filter((a) => a.type === TYPE_ENUM && a.start && a.end);
const inScope = vacations.filter((a) => a.start >= FROM && (!ONLY_USERS.length || ONLY_USERS.includes(a.userId)));
const earlier = vacations.filter((a) => a.start < FROM && (!ONLY_USERS.length || ONLY_USERS.includes(a.userId))).length;

// ---------- Сотрудники: добавление выбранных людей из Bitrix ----------
/** PERSONAL_BIRTHDAY → YYYY-MM-DD или MM-DD (как normalizeBitrixBirthday в server/utils/bitrixBirthday.ts). */
function normalizeBirthday(raw, now = new Date()) {
  const value = raw == null || raw === false ? '' : String(raw).trim();
  if (!value) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const dim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const build = (y, m, d) => {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= dim[m - 1])) return null;
    if (y != null && y > 1900 && y <= now.getFullYear()) {
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      if (m === 2 && d === 29 && !leap) return null;
      return `${y}-${pad(m)}-${pad(d)}`;
    }
    return `${pad(m)}-${pad(d)}`;
  };
  let m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (m) return build(+m[1], +m[2], +m[3]);
  m = value.match(/^--(\d{1,2})-(\d{1,2})$/);
  if (m) return build(null, +m[1], +m[2]);
  m = value.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?(?:$|\s)/);
  if (m) return build(m[3] ? +m[3] : null, +m[2], +m[1]);
  return null;
}

/**
 * Новый сотрудник в форме импорта bitrixSync.ts (ветка importNew): id = bitrix id, ФИО «Фамилия Имя»,
 * должность, руководитель = UF_HEAD отдела, дата приёма = DATE_REGISTER, email, день рождения,
 * account_role ''. Отдел: в Vibe отделы свои («Digital», «DEV», «SEO / ORM»), а не названия Bitrix,
 * и от них зависят группы отпусков и лимиты. Поэтому берём отдел коллег с тем же руководителем
 * (или отдел самого руководителя); если таких нет, название из Bitrix, как в приложении.
 * Остаток на 01.01, юрлицо и форма договора не заполняются (в Bitrix их нет).
 */
async function addEmployees(users, departments) {
  const deptName = new Map(departments.map((d) => [Number(d.ID), String(d.NAME || '').trim() || `Отдел ${d.ID}`]));
  const deptHead = new Map(departments.filter((d) => Number(d.UF_HEAD) > 0).map((d) => [Number(d.ID), Number(d.UF_HEAD)]));
  const deptParent = new Map(departments.filter((d) => Number(d.PARENT) > 0).map((d) => [Number(d.ID), Number(d.PARENT)]));
  /** Руководитель: UF_HEAD отдела; нет его (или это сам человек) → вверх по PARENT. */
  const headFor = (deptId, self) => {
    for (let id = deptId, guard = 0; id && guard < 20; id = deptParent.get(id), guard += 1) {
      const h = deptHead.get(id);
      if (h && h !== self) return h;
    }
    return null;
  };
  const primaryDept = (u) => (Array.isArray(u?.UF_DEPARTMENT) && u.UF_DEPARTMENT.length ? Number(u.UF_DEPARTMENT[0]) : null);
  const userById = new Map(users.map((u) => [Number(u.ID), u]));
  const userName = new Map(users.map((u) => [Number(u.ID), [u.LAST_NAME, u.NAME].map((x) => String(x || '').trim()).filter(Boolean).join(' ')]));
  const current = await sql`select id, name, department, manager, bitrix_user_id from core.employees`;
  const denied = await sql`select bitrix_user_id, platform_user_id, employee_id, name from core.access_denylist`;
  const rows = [];
  for (const bid of ADD_EMPLOYEES) {
    const u = users.find((x) => Number(x.ID) === bid);
    if (!u) throw new Error(`пользователь Bitrix ${bid} не найден среди активных`);
    if (current.some((e) => Number(e.bitrix_user_id) === bid || Number(e.id) === bid)) {
      console.log(`  = ${bid} ${userName.get(bid)}: уже в справочнике`);
      continue;
    }
    if (denied.some((d) => [d.bitrix_user_id, d.platform_user_id, d.employee_id].map(Number).includes(bid))) {
      throw new Error(`${bid} ${userName.get(bid)} в стоп-листе доступа: добавление только через приложение`);
    }
    const deptId = primaryDept(u);
    const headId = deptId ? headFor(deptId, bid) : null;
    const manager = headId ? userName.get(headId) || '' : '';
    const bitrixDept = deptId ? deptName.get(deptId) || '' : '';
    const majority = (list) => {
      const counts = {};
      for (const e of list) if (e.department) counts[e.department] = (counts[e.department] || 0) + 1;
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    };
    // коллеги по тому же отделу Bitrix, затем по тому же руководителю
    const sameDept = majority(current.filter((e) => e.bitrix_user_id && primaryDept(userById.get(Number(e.bitrix_user_id))) === deptId));
    const sameManager = majority(current.filter((e) => manager && nameKey(e.manager) === nameKey(manager)));
    const head = current.find((e) => manager && nameKey(e.name) === nameKey(manager));
    const peerDept = sameDept || sameManager;
    const department = peerDept || head?.department || bitrixDept;
    const item = {
      id: bid,
      bitrix_user_id: bid,
      name: userName.get(bid) || `Сотрудник ${bid}`,
      title: String(u.WORK_POSITION || '').trim(),
      department,
      manager,
      hired_at: String(u.DATE_REGISTER || '').slice(0, 10) || TODAY,
      platform_user_id: bid,
      email: String(u.EMAIL || '').trim().toLowerCase(),
      birthday: normalizeBirthday(u.PERSONAL_BIRTHDAY),
      account_role: ''
    };
    rows.push(item);
    console.log(
      `  + ${bid} ${item.name} | ${item.title} | отдел ${department} (Bitrix: ${bitrixDept}; ${peerDept ? 'как у коллег' : head ? 'как у руководителя' : 'из Bitrix'}) | рук. ${manager || '-'} | приём ${item.hired_at}`
    );
  }
  if (!APPLY || !rows.length) return;
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${CORE_WRITE_LOCK_KEY})`;
    const [{ max }] = await tx`select coalesce(max(position), -1) as max from core.employees`;
    let position = Number(max);
    for (const item of rows) {
      const [exists] = await tx`select id from core.employees where id = ${item.id} or bitrix_user_id = ${item.id}`;
      if (exists) continue;
      position += 1;
      await tx`insert into core.employees ${tx({
        id: item.id,
        name: item.name,
        title: item.title,
        department: item.department,
        manager: item.manager,
        hired_at: item.hired_at,
        birthday: item.birthday,
        platform_user_id: item.platform_user_id,
        bitrix_user_id: item.bitrix_user_id,
        email: item.email,
        account_role: item.account_role,
        position,
        source_keys: Object.keys(item)
      })}`;
      await tx`insert into core.employee_assignment_history ${tx({
        employee_id: item.id,
        department: item.department,
        title: item.title,
        manager: item.manager,
        manager_id: null,
        valid_from: new Date(),
        source: 'added'
      })}`;
      await tx`insert into audit.audit_log ${tx({
        action: 'create',
        entity: 'core.employee',
        entity_id: String(item.id),
        after: tx.json({ reason: `bitrix-add-employee-${TODAY}`, ...item })
      })}`;
    }
  });
  console.log(`Сотрудников добавлено: ${rows.length}`);
}

// ---------- 2. Vibe: сотрудники и заявки ----------
const postgres = await loadPostgres();
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  const [users, departments] = await Promise.all([
    bitrixAll('user.get', {
      filter: { ACTIVE: true },
      select: ['ID', 'NAME', 'LAST_NAME', 'EMAIL', 'WORK_POSITION', 'DATE_REGISTER', 'PERSONAL_BIRTHDAY', 'UF_DEPARTMENT']
    }),
    bitrixAll('department.get', { select: ['ID', 'NAME', 'UF_HEAD', 'PARENT'] })
  ]);
  if (ADD_EMPLOYEES.length) await addEmployees(users, departments);
  if (args.includes('--skip-vacations')) {
    console.log('--skip-vacations: отпуска не трогаем');
  } else {
  const employees = await sql`select id, name, bitrix_user_id from core.employees`;
  const byBitrix = new Map();
  for (const e of employees) if (e.bitrix_user_id) byBitrix.set(Number(e.bitrix_user_id), e);

  // Сверка справочника (только отчёт; новых людей не добавляем, решает заказчик)
  const deptName = new Map(departments.map((d) => [String(d.ID), String(d.NAME || '')]));
  const activeIds = new Set(users.map((u) => Number(u.ID)));
  const notInVibe = users.filter((u) => !byBitrix.has(Number(u.ID)));
  const goneFromBitrix = employees.filter((e) => e.bitrix_user_id && !activeIds.has(Number(e.bitrix_user_id)));
  console.log(`Bitrix: активных пользователей ${users.length}; нет в Vibe ${notInVibe.length}; в Vibe, но не активны в Bitrix ${goneFromBitrix.length}`);
  for (const u of notInVibe) {
    const dep = (Array.isArray(u.UF_DEPARTMENT) ? u.UF_DEPARTMENT : []).map((d) => deptName.get(String(d)) || d).join(', ');
    const own = absences.filter((a) => a.userId === Number(u.ID) && a.start).map((a) => a.start).sort();
    const reg = String(u.DATE_REGISTER || '').slice(0, 10);
    console.log(`  ? ${u.ID} ${[u.LAST_NAME, u.NAME].filter(Boolean).join(' ')} | ${u.WORK_POSITION || ''} | ${dep || 'без отдела'} | рег. ${reg || '?'} | первое отсутствие ${own[0] || 'нет'} (всего ${own.length})`);
  }
  for (const e of goneFromBitrix) console.log(`  ~ ${e.id} ${e.name} (bitrix ${e.bitrix_user_id})`);

  const requests = await sql`
    select id, employee, employee_id, start_date::text as start, end_date::text as "end", status, bitrix_absence_id, extra
    from vacations.requests`;
  const linked = linkedAbsenceIds(requests);
  const usedIds = new Set(requests.map((r) => Number(r.id)));
  const sameOwner = (r, emp) => (r.employee_id != null ? Number(r.employee_id) === Number(emp.id) : nameKey(r.employee) === nameKey(emp.name));
  const live = (r) => !['rejected', 'cancelled', 'canceled'].includes(String(r.status));

  const already = [];
  const missing = [];
  const toApprove = [];
  const skipped = [];
  const seenKey = new Set();
  for (const a of inScope) {
    if (linked.has(a.id)) {
      already.push({ a, how: 'id' });
      continue;
    }
    const emp = a.userId ? byBitrix.get(a.userId) : null;
    if (!emp) {
      const u = users.find((x) => Number(x.ID) === a.userId);
      const who = u ? [u.LAST_NAME, u.NAME].filter(Boolean).join(' ') : 'не активен в Bitrix';
      skipped.push({ a, why: `сотрудник Bitrix ${a.userId ?? '?'} (${who}) не найден в Vibe` });
      continue;
    }
    if (QA_IDS.has(Number(emp.id))) {
      skipped.push({ a, why: `QA-сотрудник ${emp.name}` });
      continue;
    }
    const same = requests.find((r) => sameOwner(r, emp) && r.start === a.start && r.end === a.end);
    if (same) {
      already.push({ a, how: `даты, заявка #${same.id} (${same.status})` });
      if (same.status === 'pending' && !(Number(same.bitrix_absence_id) > 0)) toApprove.push({ a, req: same, emp });
      continue;
    }
    const overlap = requests.find((r) => sameOwner(r, emp) && live(r) && r.start <= a.end && r.end >= a.start);
    if (overlap) {
      skipped.push({ a, why: `${emp.name}: пересекается с заявкой #${overlap.id} ${overlap.start}–${overlap.end} (${overlap.status})` });
      continue;
    }
    const key = `${emp.id}:${a.start}:${a.end}`;
    if (seenKey.has(key)) {
      skipped.push({ a, why: `${emp.name}: дубль элемента в Bitrix с теми же датами` });
      continue;
    }
    seenKey.add(key);
    missing.push({ a, emp });
  }

  console.log(`Bitrix инфоблок ${IBLOCK_ID}: элементов ${absences.length}, по типам ${JSON.stringify(typeCounts)}`);
  console.log(`Отпусков (тип ${TYPE_ENUM}): ${vacations.length}; с началом с ${FROM}: ${inScope.length}; раньше: ${earlier}`);
  console.log(`Vibe: заявок ${requests.length}, сотрудников ${employees.length} (с bitrix id ${byBitrix.size})`);
  console.log(`Уже в Vibe: ${already.length} (по id ${already.filter((x) => x.how === 'id').length}, по датам ${already.filter((x) => x.how !== 'id').length})`);
  for (const x of already.filter((x) => x.how !== 'id')) console.log(`  = ${x.a.id} ${x.a.start}–${x.a.end}: ${x.how}`);
  console.log(`Пропущено: ${skipped.length}`);
  for (const s of skipped) console.log(`  - ${s.a.id} ${s.a.start}–${s.a.end}: ${s.why}`);
  console.log(`Нет в Vibe (к импорту): ${missing.length}`);
  for (const m of missing) {
    console.log(`  + ${m.emp.name} | ${m.a.start}–${m.a.end} | ${days(m.a.start, m.a.end)} дн. | Bitrix ${m.a.id}${m.a.code ? ` (${m.a.code})` : ''}`);
  }

  console.log(`На согласовании в Vibe, но уже в графике Bitrix: ${toApprove.length}${APPROVE_PENDING ? '' : ' (согласовать: --approve-pending)'}`);
  for (const x of toApprove) console.log(`  ✓ #${x.req.id} ${x.req.employee} ${x.a.start}–${x.a.end} ← Bitrix ${x.a.id}`);

  if (!APPLY) {
    console.log('dry-run: ничего не записано (запись: --apply)');
  } else if (missing.length || (APPROVE_PENDING && toApprove.length)) {
    const inserted = await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${VACATIONS_WRITE_LOCK_KEY})`;
      // Перечитываем под lock: процесс vbi-hr мог успеть записать
      const fresh = await tx`select id, bucket_year, position, bitrix_absence_id, extra from vacations.requests`;
      const freshLinked = linkedAbsenceIds(fresh);
      const ids = new Set(fresh.map((r) => Number(r.id)));
      const pos = {};
      for (const r of fresh) pos[r.bucket_year] = Math.max(pos[r.bucket_year] ?? -1, Number(r.position));
      const [state] = await tx`select next_request_id, request_years from vacations.state where id = 1 for update`;
      if (!state) throw new Error('нет строки vacations.state id=1');
      let nextId = Number(state.next_request_id) || 1;
      const years = [...(state.request_years || [])];
      const now = new Date().toISOString();
      const done = [];
      for (const { a, emp } of missing) {
        if (freshLinked.has(a.id)) continue;
        // CODE vbi-hr-vac-<id> → вернуть заявке её прежний id, если он свободен
        const codeId = Number((a.code.match(/^vbi-hr-vac-(\d+)$/) || [])[1]);
        let id;
        if (codeId > 0 && !ids.has(codeId)) id = codeId;
        else {
          while (ids.has(nextId)) nextId += 1;
          id = nextId++;
        }
        ids.add(id);
        const bucket = a.start.slice(0, 4);
        if (!years.includes(bucket)) years.push(bucket);
        const position = (pos[bucket] = (pos[bucket] ?? -1) + 1);
        const item = {
          id,
          employee: emp.name,
          employee_id: Number(emp.id),
          start: a.start,
          end: a.end,
          status: 'approved',
          comment: '', // видимых пометок не ставим; источник виден по bitrix_sync_method и истории
          createdAt: ruFromIso(a.created || TODAY),
          bitrix_absence_id: a.id,
          bitrix_absence_iblock_id: IBLOCK_ID,
          bitrix_sync_status: 'synced',
          bitrix_sync_method: METHOD,
          bitrix_synced_at: now
        };
        await tx`insert into vacations.requests ${tx({
          id,
          bucket_year: bucket,
          position,
          employee: item.employee,
          employee_id: item.employee_id,
          start_date: item.start,
          end_date: item.end,
          status: item.status,
          comment: item.comment,
          created_at_text: item.createdAt,
          bitrix_absence_id: item.bitrix_absence_id,
          bitrix_absence_iblock_id: item.bitrix_absence_iblock_id,
          bitrix_sync_status: item.bitrix_sync_status,
          bitrix_sync_method: item.bitrix_sync_method,
          bitrix_synced_at: item.bitrix_synced_at,
          source_keys: Object.keys(item)
        })}`;
        await tx`insert into vacations.request_status_history ${tx({
          request_id: id,
          kind: 'create',
          reason: REASON,
          status_after: 'approved',
          start_after: item.start,
          end_after: item.end
        })}`;
        await tx`insert into audit.audit_log ${tx({
          action: 'create',
          entity: 'vacations.request',
          entity_id: String(id),
          after: tx.json({ reason: REASON, ...item })
        })}`;
        done.push(item);
      }
      // pending → approved, как PATCH приложения (status, без approval_step), но без синка в Bitrix
      // и без уведомлений: элемент уже в графике, привязываем его.
      const approved = [];
      for (const { a, req } of APPROVE_PENDING ? toApprove : []) {
        if (freshLinked.has(a.id)) continue;
        const [row] = await tx`
          select id, employee, employee_id, start_date::text as start_date, end_date::text as end_date, status,
            approval_step, comment, created_at_text, source_keys, bitrix_absence_id
          from vacations.requests where id = ${req.id} for update`;
        if (!row || row.status !== 'pending' || row.start_date !== a.start || row.end_date !== a.end || row.bitrix_absence_id) continue;
        const keys = (row.source_keys || []).filter((k) => k !== 'approval_step');
        for (const k of ['bitrix_absence_id', 'bitrix_absence_iblock_id', 'bitrix_sync_status', 'bitrix_sync_method', 'bitrix_synced_at']) {
          if (!keys.includes(k)) keys.push(k);
        }
        const before = { id: row.id, employee: row.employee, employee_id: row.employee_id, start: row.start_date, end: row.end_date, status: row.status, approval_step: row.approval_step, comment: row.comment, createdAt: row.created_at_text };
        const after = { ...before, status: 'approved', bitrix_absence_id: a.id, bitrix_absence_iblock_id: IBLOCK_ID, bitrix_sync_status: 'synced', bitrix_sync_method: METHOD, bitrix_synced_at: now };
        delete after.approval_step;
        await tx`update vacations.requests set status = 'approved', approval_step = null, source_keys = ${keys},
          bitrix_absence_id = ${a.id}, bitrix_absence_iblock_id = ${IBLOCK_ID}, bitrix_sync_status = 'synced',
          bitrix_sync_method = ${METHOD}, bitrix_synced_at = ${now}, bitrix_sync_error = null, updated_at = now()
          where id = ${row.id}`;
        await tx`insert into vacations.request_status_history ${tx({
          request_id: row.id,
          kind: 'update',
          reason: REASON,
          status_before: 'pending',
          status_after: 'approved',
          approval_step_before: row.approval_step,
          approval_step_after: null,
          start_before: row.start_date,
          start_after: row.start_date,
          end_before: row.end_date,
          end_after: row.end_date
        })}`;
        await tx`insert into audit.audit_log ${tx({
          action: 'update',
          entity: 'vacations.request',
          entity_id: String(row.id),
          before: tx.json(before),
          after: tx.json({ reason: REASON, ...after })
        })}`;
        approved.push(after);
      }
      console.log(`Согласовано: ${approved.length}`);
      for (const r of approved) console.log(`  #${r.id} ${r.employee} ${r.start}–${r.end} ← Bitrix ${r.bitrix_absence_id}`);
      if (!done.length) return done;

      const maxId = Math.max(0, ...ids);
      const newNext = Math.max(nextId, maxId + 1);
      const newYears = years;
      await tx`update vacations.state set next_request_id = ${newNext}, request_years = ${newYears}, updated_at = now() where id = 1`;
      await tx`insert into audit.audit_log ${tx({
        action: 'update',
        entity: 'vacations.state',
        entity_id: '1',
        after: tx.json({
          reason: REASON,
          nextRequestId: { before: Number(state.next_request_id), after: newNext },
          requestYears: { before: state.request_years, after: newYears }
        })
      })}`;
      return done;
    });
    console.log(`Записано: ${inserted.length}`);
    for (const r of inserted) console.log(`  #${r.id} ${r.employee} ${r.start}–${r.end} ← Bitrix ${r.bitrix_absence_id}`);
  } else {
    console.log('Нечего импортировать');
  }
  }
} finally {
  await sql.end();
}
