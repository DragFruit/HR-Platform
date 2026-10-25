#!/usr/bin/env node
/**
 * Перенос остатков отпуска на новый учётный год (31.12.N → 01.01.N+1).
 *
 * Usage: node scripts/rollover-vacation-year.mjs <fromYear> <toYear>
 * Example: node scripts/rollover-vacation-year.mjs 2026 2027
 *
 * УСТАРЕЛО. Только для JSON-хранилища (server/data/*.json), например локально.
 * На стейдже и проде переход года делает сам сервер 1 января (плагин vacation-year-rollover),
 * вручную: POST /api/admin/vacations/rollover. С Postgres (DATABASE_URL + DB_VACATIONS=1)
 * скрипт отказывается работать: он перезаписал бы файл, которым база уже не пользуется.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from '../frontend/node_modules/jiti/lib/jiti.mjs';

if (String(process.env.DATABASE_URL || '').trim() && String(process.env.DB_VACATIONS || '').trim() === '1') {
  console.error(
    'Отпуска хранятся в Postgres (DATABASE_URL + DB_VACATIONS=1): скрипт работает только с JSON. ' +
      'Переход года делается автоматически 1 января или через POST /api/admin/vacations/rollover.'
  );
  process.exit(1);
}

const [fromYearArg, toYearArg] = process.argv.slice(2);
const fromYear = Number(fromYearArg);
const toYear = Number(toYearArg);

if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || toYear !== fromYear + 1) {
  console.error('Usage: node scripts/rollover-vacation-year.mjs <fromYear> <toYear>  (toYear = fromYear + 1)');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const frontend = join(root, 'frontend');
const jiti = createJiti(import.meta.url, {
  alias: {
    '~': join(frontend, 'app'),
    '~~': frontend
  }
});
const { applyVacationYearRollover } = jiti(join(frontend, 'server/utils/vacationYearRollover.ts'));

const employeesPath = join(frontend, 'server/data/employees.json');
const vacationsPath = join(frontend, 'server/data/vacations.json');

const employees = JSON.parse(await readFile(employeesPath, 'utf8'));
const vacations = JSON.parse(await readFile(vacationsPath, 'utf8'));

if (vacations.primaryYear !== fromYear) {
  console.error(
    `Ошибка: primaryYear в vacations.json = ${vacations.primaryYear}, ожидался ${fromYear}`
  );
  process.exit(1);
}

const result = applyVacationYearRollover(employees, vacations, fromYear, toYear);

await writeFile(employeesPath, `${JSON.stringify(result.employees, null, 2)}\n`, 'utf8');
await writeFile(vacationsPath, `${JSON.stringify(result.vacations, null, 2)}\n`, 'utf8');

console.log(`Переход ${fromYear} → ${toYear}: обновлено ${result.updates.length} сотрудников`);
if (result.skipped.length) {
  console.log(`  пропущено (нет даты приёма): ${result.skipped.join(', ')}`);
}
console.log('  primaryYear:', result.vacations.primaryYear);
