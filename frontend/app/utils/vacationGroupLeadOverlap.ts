import {
  findVacationOverlapDetails,
  type VacationOverlapDetail
} from '~/utils/vacationCalendar';
import {
  getVacationDepartmentLayout,
  isVacationGroupLead
} from '~/utils/vacationDepartmentGroups';

export const GROUP_LEAD_OVERLAP_BADGE_LABEL = 'Пересечение с отпуском другого групхеда';

export const GROUP_LEAD_OVERLAP_POPOVER_TITLE = 'Отпуск другого руководителя группы';

export const GROUP_LEAD_OVERLAP_BLOCKED_MESSAGE =
  'В этот период уже отсутствует другой руководитель группы. Выберите другие даты или согласуйтесь с коллегами.';

type VacationRequestRow = {
  id: number;
  employee: string;
  start: string;
  end: string;
  status: string;
};

/** Имена руководителей групп (type: lead) в grouped-отделе. */
export function listVacationGroupLeadNames(department: string): string[] {
  const layout = getVacationDepartmentLayout(department);
  if (!layout) return [];

  const names = layout.groups
    .filter((def) => def.type === 'lead')
    .map((def) => def.leadName.trim())
    .filter(Boolean);

  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'ru'));
}

/** Пересечения заявки групхеда с отпусками других групхедов того же отдела. */
export function findGroupLeadVacationOverlaps(params: {
  employeeName: string;
  department: string;
  start: string;
  end: string;
  allRequests: VacationRequestRow[];
  excludeRequestId?: number;
}): VacationOverlapDetail[] {
  const employee = params.employeeName.trim();
  const department = params.department.trim();
  if (!employee || !department) return [];
  if (!isVacationGroupLead(employee, department)) return [];

  const otherGroupLeads = listVacationGroupLeadNames(department).filter((name) => name !== employee);
  if (!otherGroupLeads.length) return [];

  return findVacationOverlapDetails(
    {
      id: params.excludeRequestId ?? -1,
      employee,
      start: params.start,
      end: params.end
    },
    params.allRequests,
    otherGroupLeads
  );
}

export function hasGroupLeadVacationOverlap(params: {
  employeeName: string;
  department: string;
  start: string;
  end: string;
  allRequests: VacationRequestRow[];
  excludeRequestId?: number;
}): boolean {
  return findGroupLeadVacationOverlaps(params).length > 0;
}
