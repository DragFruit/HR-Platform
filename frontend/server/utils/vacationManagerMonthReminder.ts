import type { VacationRequest } from '../../app/composables/useVacations';
import { isDigitalDepartment } from '../../app/utils/vacationApproval';
import { sendBitrixImbotMessage, isBitrixImbotConfigured } from './bitrixImbot';
import { readEmployees, type ServerEmployee } from './employeesStore';
import {
  hasManagerMonthReminder,
  managerMonthReminderKey,
  recordManagerMonthReminder
} from './vacationManagerMonthReminderStore';
import { readVacations } from './vacationsStore';

/** Гендир — бот не пишет. */
export const MANAGER_MONTH_REMINDER_NEVER = new Set(['Юдин Вадим']);

/**
 * Руководители отделов: вся зона отдела (не только прямые подчинённые).
 * Лашин в справочнике в «Дирекции», но команда — «Отдел продаж».
 */
export const DEPARTMENT_SCOPE_BY_MANAGER: Record<string, string> = {
  'Ревзина Ксения': 'Digital',
  'Музыка Сергей': 'DEV',
  'Трубицына Анна': 'SEO / ORM',
  'Волдайский Кирилл': 'Маркетинг',
  'Малиновская Евгения': 'Бухгалтерия',
  'Лашин Владислав': 'Отдел продаж'
};

const formatDateRu = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

/** YYYY-MM следующего календарного месяца относительно today. */
export const nextMonthKey = (today = new Date()): string => {
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-based
  const next = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 };
  return `${next.y}-${String(next.m + 1).padStart(2, '0')}`;
};

export const parseYearMonth = (ym: string): { year: number; month: number } | null => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
};

export const startInYearMonth = (startIso: string, ym: string): boolean => {
  const parsed = parseYearMonth(ym);
  if (!parsed) return false;
  const [y, m] = startIso.split('-').map(Number);
  return y === parsed.year && m === parsed.month;
};

const employeeInDepartmentScope = (employee: ServerEmployee, department: string): boolean => {
  if (department === 'Digital' || isDigitalDepartment(department)) {
    return isDigitalDepartment(employee.department);
  }
  return employee.department.trim() === department.trim();
};

/**
 * Кого руководитель видит в напоминании.
 * Отдел (Ксения и др.) — весь отдел; остальные — прямые подчинённые.
 * Самого руководителя в список не включаем.
 */
export const teamScopeForManager = (
  manager: ServerEmployee,
  all: ServerEmployee[]
): ServerEmployee[] => {
  const name = manager.name.trim();
  if (MANAGER_MONTH_REMINDER_NEVER.has(name)) return [];

  const dept = DEPARTMENT_SCOPE_BY_MANAGER[name];
  if (dept) {
    return all.filter(
      (e) => e.name.trim() !== name && employeeInDepartmentScope(e, dept)
    );
  }

  return all.filter((e) => (e.manager || '').trim() === name);
};

export type ManagerMonthVacationLine = {
  employee: string;
  start: string;
  end: string;
};

export const buildManagerMonthReminderMessage = (
  targetMonth: string,
  lines: ManagerMonthVacationLine[]
): string => {
  const sorted = [...lines].sort((a, b) => {
    const byStart = a.start.localeCompare(b.start);
    if (byStart !== 0) return byStart;
    return a.employee.localeCompare(b.employee, 'ru');
  });

  const body = sorted.map(
    (row) => `• ${row.employee} — ${formatDateRu(row.start)} — ${formatDateRu(row.end)}`
  );

  return [
    'В следующем месяце в отпуск из вашей команды идут:',
    '',
    ...body,
    '',
    'Имеет смысл заранее спланировать передачу дел.'
  ].join('\n');
};

export type ManagerMonthReminderRunResult = {
  ran: boolean;
  reason?: string;
  target_month: string;
  recipients: number;
  sent: number;
  skipped: number;
  empty: number;
  errors: Array<{ manager: string; error: string }>;
  dry_run: boolean;
  bot_configured: boolean;
  /** В dry_run — превью по руководителям с отпусками. */
  preview?: Array<{ manager: string; count: number; sample: string }>;
};

const isRunDay = (today: Date): boolean => today.getDate() === 15;

/**
 * 15-го числа: руководителям — approved-отпуска команды со стартом в следующем месяце.
 */
export async function runVacationManagerMonthReminders(options?: {
  dryRun?: boolean;
  today?: Date;
  /** Игнорировать проверку «только 15-е» (ручной прогон / тест). */
  force?: boolean;
}): Promise<ManagerMonthReminderRunResult> {
  const dryRun = Boolean(options?.dryRun);
  const force = Boolean(options?.force);
  const today = options?.today ?? new Date();
  const targetMonth = nextMonthKey(today);
  const botConfigured = isBitrixImbotConfigured();

  const result: ManagerMonthReminderRunResult = {
    ran: false,
    target_month: targetMonth,
    recipients: 0,
    sent: 0,
    skipped: 0,
    empty: 0,
    errors: [],
    dry_run: dryRun,
    bot_configured: botConfigured,
    preview: dryRun ? [] : undefined
  };

  if (!force && !isRunDay(today)) {
    result.reason = 'not_the_15th';
    return result;
  }

  result.ran = true;

  const employees = await readEmployees();
  const vacations = await readVacations();
  const requests = Object.values(vacations.requestsByYear).flat() as VacationRequest[];

  const dueByEmployee = new Map<string, ManagerMonthVacationLine[]>();
  for (const request of requests) {
    if (request.status !== 'approved') continue;
    if (!startInYearMonth(request.start, targetMonth)) continue;
    const name = request.employee.trim();
    const list = dueByEmployee.get(name) ?? [];
    list.push({ employee: name, start: request.start, end: request.end });
    dueByEmployee.set(name, list);
  }

  const managers = employees.filter((e) => {
    const name = e.name.trim();
    if (!name || MANAGER_MONTH_REMINDER_NEVER.has(name)) return false;
    if (!e.bitrix_user_id) return false;
    return teamScopeForManager(e, employees).length > 0 || Boolean(DEPARTMENT_SCOPE_BY_MANAGER[name]);
  });

  for (const manager of managers) {
    const scope = teamScopeForManager(manager, employees);
    const scopeNames = new Set(scope.map((e) => e.name.trim()));
    const lines: ManagerMonthVacationLine[] = [];
    for (const name of scopeNames) {
      const rows = dueByEmployee.get(name);
      if (rows) lines.push(...rows);
    }

    if (lines.length === 0) {
      result.empty += 1;
      continue;
    }

    result.recipients += 1;
    const bitrixUserId = Number(manager.bitrix_user_id);
    const key = managerMonthReminderKey(bitrixUserId, targetMonth);

    if (await hasManagerMonthReminder(key)) {
      result.skipped += 1;
      continue;
    }

    const message = buildManagerMonthReminderMessage(targetMonth, lines);

    if (dryRun) {
      result.sent += 1;
      result.preview?.push({
        manager: manager.name,
        count: lines.length,
        sample: message.slice(0, 240)
      });
      continue;
    }

    if (!botConfigured) {
      result.errors.push({
        manager: manager.name,
        error: 'BITRIX_IMBOT_ID не задан'
      });
      continue;
    }

    try {
      const { messageId, channel } = await sendBitrixImbotMessage({
        bitrixUserId,
        message
      });
      await recordManagerMonthReminder({
        key,
        kind: 'mgr_next_month',
        target_month: targetMonth,
        manager: manager.name,
        bitrix_user_id: bitrixUserId,
        vacation_count: lines.length,
        sent_at: new Date().toISOString(),
        channel,
        message_id: messageId
      });
      result.sent += 1;
    } catch (err) {
      const text =
        err && typeof err === 'object' && 'statusMessage' in err
          ? String((err as { statusMessage?: string }).statusMessage || '')
          : err instanceof Error
            ? err.message
            : String(err);
      result.errors.push({ manager: manager.name, error: text });
    }
  }

  return result;
}
