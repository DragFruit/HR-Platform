import { requireRole } from '../../utils/requireRole';
import { readEmployees, type ServerEmployee } from '../../utils/employeesStore';
import { readOgonekState } from '../../utils/ogonekStore';
import { getDeployAppEnv } from '../../utils/appEnv';
import { isQaTestEmployeeId, QA_TEST_DEPARTMENT_NAME } from '../../../app/data/qaTestDepartment';
import { ogonekClock } from '../../utils/ogonekClock';
import { OGONEK_DAYS, OGONEK_RANKS, ogonekRankFor } from '../../../app/events/ogonek/content';
import { OGONEK_DAY_DATES } from '../../../app/events/ogonek/timeline';

/**
 * Статистика «Огонька» для админа — как была у гонки Pit Stop: итоги
 * сверху и все сотрудники справочника с их прогрессом. Только чтение.
 * Демо-данные стенда сюда не попадают: считаем по файлу ивента.
 */

/** Возможные id сессии сотрудника в данных ивента. */
function sessionIds(emp: ServerEmployee): number[] {
  const ids = new Set<number>();
  if (emp.platform_user_id != null && emp.platform_user_id > 0) ids.add(emp.platform_user_id);
  if (emp.bitrix_user_id != null && emp.bitrix_user_id > 0) ids.add(emp.bitrix_user_id);
  if (emp.id > 0) ids.add(emp.id);
  return [...ids];
}

/** На бою не показываем QA/демо со стейджа, даже если остались в файле. */
function isStagingTestEmployee(emp: ServerEmployee): boolean {
  if (isQaTestEmployeeId(emp.id)) return true;
  if (emp.department === QA_TEST_DEPARTMENT_NAME) return true;
  const email = emp.email?.trim().toLowerCase() ?? '';
  return email.endsWith('@vbi.local');
}

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin']);
  const [employees, state] = await Promise.all([readEmployees(), readOgonekState()]);
  const { now } = ogonekClock(event);
  const playerById = new Map(state.players.map((p) => [p.userId, p]));
  const hideStagingTests = getDeployAppEnv() === 'production';

  const rows = employees
    .filter((emp) => !(hideStagingTests && isStagingTestEmployee(emp)))
    .map((emp) => {
      const p = sessionIds(emp).map((id) => playerById.get(id)).find(Boolean);
      return {
        employeeId: emp.id,
        name: emp.name,
        department: emp.department || '',
        opened: p?.opened.length ?? 0,
        done: p?.done.length ?? 0,
        santa: p?.santa ?? '',
        plugged: Boolean(p?.plugged),
        entered: Boolean(p)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const players = state.players;
  const todayIso = now.toISOString().slice(0, 10);
  const todayId = OGONEK_DAYS.find((d) => (OGONEK_DAY_DATES[d.id] ?? '').slice(0, 10) === todayIso)?.id ?? null;

  // По каждому окну: сколько открыли и сколько выполнили
  const byDay = OGONEK_DAYS.map((d) => ({
    id: d.id,
    title: d.title,
    opened: players.filter((p) => p.opened.includes(d.id)).length,
    done: players.filter((p) => p.done.includes(d.id)).length
  }));

  const dresscode: Record<string, number> = {};
  for (const p of players) if (p.dresscode) dresscode[p.dresscode] = (dresscode[p.dresscode] ?? 0) + 1;

  // Сколько участников в каждом звании — по числу открытых окон
  const ranks = OGONEK_RANKS.map((r) => ({
    title: r.title,
    from: r.from,
    count: players.filter((p) => ogonekRankFor(p.opened.length) === r.title).length
  }));

  type Person = { name: string; department: string };
  const who = (list: typeof players): Person[] =>
    list.map((p) => ({ name: p.name, department: p.department })).sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  // Списки для карточек. «Спасибо» анонимные, письма запечатаны — только числа.
  const lists = {
    plugged: who(players.filter((p) => p.plugged)),
    hats: who(players.filter((p) => p.hat)),
    skating: who(players.filter((p) => p.skating)),
    santaClassic: who(players.filter((p) => p.santa === 'classic')),
    santaElephant: who(players.filter((p) => p.santa === 'elephant')),
    dresscode: Object.fromEntries(
      Object.keys(dresscode).map((look) => [look, who(players.filter((p) => p.dresscode === look))])
    ) as Record<string, Person[]>,
    recipes: [...state.recipes]
      .sort((a, b) => b.voters.length - a.voters.length)
      .map((r) => ({ title: r.title, text: r.text, name: r.name, department: r.department, votes: r.voters.length })),
    toys: state.toys.map((t) => ({ name: t.name, department: t.department, wish: t.wish }))
  };

  return {
    summary: {
      employees: rows.length,
      entered: rows.filter((r) => r.entered).length,
      players: players.length,
      openedToday: todayId ? players.filter((p) => p.opened.includes(todayId)).length : 0,
      todayId,
      allDone: players.filter((p) => p.done.length >= OGONEK_DAYS.length).length,
      plugged: players.filter((p) => p.plugged).length,
      hats: players.filter((p) => p.hat).length,
      santaClassic: players.filter((p) => p.santa === 'classic').length,
      santaElephant: players.filter((p) => p.santa === 'elephant').length,
      skating: players.filter((p) => p.skating).length,
      toys: state.toys.length,
      snowflakes: state.snowflakes.length,
      thanks: state.thanks.length,
      letters: state.letters.length,
      recipes: state.recipes.length,
      recipeVotes: state.recipes.reduce((s, r) => s + r.voters.length, 0)
    },
    byDay,
    dresscode,
    ranks,
    lists,
    rows
  };
});
