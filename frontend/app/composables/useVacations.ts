import {
  canApproverReviewRequest,
  initialApprovalStep,
  isHandedOffToDirectorForGroupLead,
  nextStateAfterApproval,
  resolveRequestApprovalStep,
  vacationPendingStatusLabel,
  type VacationApprovalStep
} from '~/utils/vacationApproval';
import { isPastApprovedVacationRequest } from '~/utils/vacationCalendar';

export type VacationStatus = 'pending' | 'approved' | 'rejected';

export type BitrixVacationSyncStatus = 'synced' | 'failed' | 'skipped';

export type VacationRequest = {
  id: number;
  employee: string;
  start: string;
  end: string;
  status: VacationStatus;
  /** Шаг согласования, пока status === pending */
  approval_step?: VacationApprovalStep;
  comment: string;
  createdAt: string;
  bitrix_absence_id?: number;
  bitrix_sync_status?: BitrixVacationSyncStatus;
  bitrix_sync_method?: string;
  bitrix_synced_at?: string;
  bitrix_sync_error?: string;
};

export type VacationState = {
  primaryYear: number;
  requestsByYear: Record<string, VacationRequest[]>;
  nextRequestId: number;
};

const STORAGE_KEY = 'vbi-vacations-state-v5';

const defaultState = (): VacationState => ({
  primaryYear: new Date().getFullYear(),
  requestsByYear: {},
  nextRequestId: 1
});

export const vacationStatusLabels: Record<VacationStatus, string> = {
  pending: 'На согласовании',
  approved: 'Согласован',
  rejected: 'Отклонён'
};

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const parseIso = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

export const formatMonthVacationRange = (
  startIso: string,
  endIso: string,
  month: number,
  year: number
): string => {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  if (start.getFullYear() > year || end.getFullYear() < year) return '';
  if (start.getMonth() > month || end.getMonth() < month) return '';

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month, daysInMonth(year, month));
  const from = start < monthStart ? monthStart : start;
  const to = end > monthEnd ? monthEnd : end;
  if (from > to) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (date: Date) => `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
  if (from.getTime() === to.getTime()) return fmt(from);
  return `${fmt(from)}-${fmt(to)}`;
};

export function requestStatusLabel(
  request: Pick<VacationRequest, 'status' | 'approval_step'>,
  employee?: { department: string; manager: string }
): string {
  if (request.status === 'pending') {
    return vacationPendingStatusLabel(resolveRequestApprovalStep(request, employee), employee);
  }
  return vacationStatusLabels[request.status];
}

export function useVacations() {
  const { findByName } = useEmployees();
  const state = useState<VacationState>('vbi-vacations', defaultState);
  const viewYear = useState<number>('vbi-vacations-year', () => new Date().getFullYear());
  const hydrated = useState<boolean>('vbi-vacations-hydrated', () => false);

  const persist = () => {
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
    syncToServer();
  };

  const syncToServer = async () => {
    if (!import.meta.client) return;
    try {
      const saved = await $fetch<VacationState>('/api/vacations', {
        method: 'PUT',
        body: state.value
      });
      state.value = saved;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
    } catch {
      /* нет прав или офлайн */
    }
  };

  const applyVacationState = (next: VacationState) => {
    state.value = next;
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
  };

  const syncViewYearToData = () => {
    const current = requestsForYear(viewYear.value);
    if (current.length > 0) return;

    const yearsWithData = Object.entries(state.value.requestsByYear)
      .filter(([, list]) => list.length > 0)
      .map(([year]) => Number(year))
      .filter((year) => !Number.isNaN(year))
      .sort((a, b) => b - a);

    if (yearsWithData.length) {
      viewYear.value = yearsWithData[0];
    } else {
      viewYear.value = state.value.primaryYear;
    }
  };

  const hydrate = async () => {
    if (!import.meta.client) return;
    if (hydrated.value) {
      syncViewYearToData();
      return;
    }

    let loaded = false;
    try {
      const fromServer = await $fetch<VacationState>('/api/vacations');
      if (fromServer && typeof fromServer === 'object') {
        applyVacationState(fromServer);
        loaded = true;
      }
    } catch {
      /* нет сессии */
    }

    if (!loaded) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          applyVacationState(JSON.parse(raw) as VacationState);
        } catch {
          state.value = defaultState();
        }
      } else {
        state.value = defaultState();
      }
      if (Object.keys(state.value.requestsByYear).length) syncToServer();
    }

    syncViewYearToData();
    migratePendingApprovalSteps();
    hydrated.value = true;
  };

  const reloadFromServer = async () => {
    if (!import.meta.client) return;
    hydrated.value = false;
    await hydrate();
    migratePendingApprovalSteps();
  };

  const requestsForYear = (year = viewYear.value) =>
    state.value.requestsByYear[String(year)] ?? [];

  const yearRequests = computed(() => requestsForYear(viewYear.value));

  const pendingRequests = computed(() =>
    yearRequests.value.filter((item) => item.status === 'pending')
  );

  const migratePendingApprovalSteps = () => {
    let changed = false;
    for (const list of Object.values(state.value.requestsByYear)) {
      for (const req of list) {
        if (req.status !== 'pending' || req.approval_step !== undefined) continue;
        const employee = findByName(req.employee);
        if (!employee) continue;
        req.approval_step = initialApprovalStep(employee);
        changed = true;
      }
    }
    if (changed) persist();
  };

  const pendingRequestsForApprover = (
    approverEmployeeName: string | null,
    seeAll: boolean
  ) => {
    const pending = pendingRequests.value;
    if (seeAll || !approverEmployeeName) return pending;
    return pending.filter((request) => {
      const employee = findByName(request.employee);
      return canApproverReviewRequest(approverEmployeeName, request, employee);
    });
  };

  const handedOffRequestsForApprover = (
    approverEmployeeName: string | null,
    seeAll: boolean
  ) => {
    if (seeAll || !approverEmployeeName) return [];
    return pendingRequests.value.filter((request) => {
      const employee = findByName(request.employee);
      return isHandedOffToDirectorForGroupLead(approverEmployeeName, request, employee);
    });
  };

  const addRequest = (payload: {
    employee: string;
    start: string;
    end: string;
    comment?: string;
  }) => {
    const yearKey = String(viewYear.value);
    const list = state.value.requestsByYear[yearKey] ?? [];
    const employee = findByName(payload.employee);
    const request: VacationRequest = {
      id: state.value.nextRequestId++,
      employee: payload.employee,
      start: payload.start,
      end: payload.end,
      status: 'pending',
      approval_step: employee ? initialApprovalStep(employee) : 'manager',
      comment: payload.comment?.trim() || 'Заявка из платформы',
      createdAt: new Date().toLocaleDateString('ru-RU')
    };
    state.value.requestsByYear[yearKey] = [...list, request];
    persist();
    return request;
  };

  const setRequestStatus = (id: number, status: VacationStatus) => {
    const found = findRequestById(id);
    if (!found) return false;
    found.item.status = status;
    if (status !== 'pending') {
      delete found.item.approval_step;
    }
    persist();
    return true;
  };

  const approveRequest = (
    id: number,
    approverEmployeeName: string | null,
    options?: { force?: boolean }
  ) => {
    const found = findRequestById(id);
    if (!found || found.item.status !== 'pending') return false;

    const employee = findByName(found.item.employee);
    if (!employee) return false;

    if (
      !options?.force &&
      (!approverEmployeeName ||
        !canApproverReviewRequest(approverEmployeeName, found.item, employee))
    ) {
      return false;
    }

    if (options?.force) {
      found.item.status = 'approved';
      delete found.item.approval_step;
    } else {
      const step = resolveRequestApprovalStep(found.item, employee);
      if (!step) return false;
      const next = nextStateAfterApproval(employee, step);
      found.item.status = next.status;
      if (next.approval_step) {
        found.item.approval_step = next.approval_step;
      } else {
        delete found.item.approval_step;
      }
    }

    persist();
    return true;
  };

  const findRequestById = (id: number) => {
    for (const [yearKey, list] of Object.entries(state.value.requestsByYear)) {
      const item = list.find((r) => r.id === id);
      if (item) return { item, yearKey };
    }
    return null;
  };

  const updateRequestDates = (id: number, start: string, end: string) => {
    const found = findRequestById(id);
    if (!found || isPastApprovedVacationRequest(found.item)) return false;
    found.item.start = start;
    found.item.end = end;
    persist();
    return true;
  };

  const deleteRequest = (id: number) => {
    const found = findRequestById(id);
    if (!found || isPastApprovedVacationRequest(found.item)) return false;

    let removed = false;
    Object.keys(state.value.requestsByYear).forEach((yearKey) => {
      const list = state.value.requestsByYear[yearKey];
      const next = list.filter((r) => r.id !== id);
      if (next.length !== list.length) {
        state.value.requestsByYear[yearKey] = next;
        removed = true;
      }
    });
    if (removed) persist();
    return removed;
  };

  const getMonthEntries = (employeeName: string, month: number, year = viewYear.value) => {
    return requestsForYear(year)
      .filter((r) => r.employee === employeeName && (r.status === 'approved' || r.status === 'pending'))
      .map((r) => ({
        status: r.status,
        label: formatMonthVacationRange(r.start, r.end, month, year)
      }))
      .filter((x) => x.label !== '');
  };

  const employeeRequests = (employeeName: string, year = viewYear.value) =>
    requestsForYear(year).filter((r) => r.employee === employeeName);

  return {
    state,
    viewYear,
    yearRequests,
    pendingRequests,
    pendingRequestsForApprover,
    handedOffRequestsForApprover,
    migratePendingApprovalSteps,
    hydrate,
    reloadFromServer,
    persist,
    requestsForYear,
    addRequest,
    approveRequest,
    setRequestStatus,
    updateRequestDates,
    deleteRequest,
    findRequestById,
    getMonthEntries,
    employeeRequests,
    vacationStatusLabels,
    requestStatusLabel,
    MONTHS_RU
  };
}
