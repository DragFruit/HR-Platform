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
import {
  canManageReservationMonth,
  formatReservationLabel,
  type VacationMonthEntry,
  type VacationReservation
} from '~/utils/vacationReservations';

export type { VacationReservation, VacationMonthEntry };

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
  reservationsByYear: Record<string, VacationReservation[]>;
  nextReservationId: number;
  reservationMonthlyCapsByGroup?: Record<string, number>;
};

const STORAGE_KEY = 'vbi-vacations-state-v6';
const LEGACY_STORAGE_KEY = 'vbi-vacations-state-v5';

const defaultState = (): VacationState => ({
  primaryYear: new Date().getFullYear(),
  requestsByYear: {},
  nextRequestId: 1,
  reservationsByYear: {},
  nextReservationId: 1
});

const normalizeState = (raw: Partial<VacationState>): VacationState => {
  const base = defaultState();
  return {
    primaryYear: typeof raw.primaryYear === 'number' ? raw.primaryYear : base.primaryYear,
    requestsByYear: raw.requestsByYear ?? base.requestsByYear,
    nextRequestId: typeof raw.nextRequestId === 'number' ? raw.nextRequestId : base.nextRequestId,
    reservationsByYear: raw.reservationsByYear ?? base.reservationsByYear,
    nextReservationId:
      typeof raw.nextReservationId === 'number' ? raw.nextReservationId : base.nextReservationId,
    reservationMonthlyCapsByGroup: raw.reservationMonthlyCapsByGroup
  };
};

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

  const persistLocal = () => {
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
  };

  const applyServerState = (saved: VacationState | Partial<VacationState>) => {
    state.value = normalizeState(saved);
    persistLocal();
  };

  const syncCreateRequest = async (payload: {
    employee: string;
    start: string;
    end: string;
    comment?: string;
    year?: number;
  }) => {
    if (!import.meta.client) return null;
    const { year: requestYear, ...rest } = payload;
    const saved = await $fetch<VacationState>('/api/vacations/requests', {
      method: 'POST',
      body: {
        year: requestYear ?? viewYear.value,
        ...rest
      }
    });
    applyServerState(saved);
    return saved;
  };

  const syncPatchRequest = async (
    id: number,
    patch: {
      start?: string;
      end?: string;
      status?: VacationStatus;
      approval_step?: VacationApprovalStep | null;
    }
  ) => {
    if (!import.meta.client) return null;
    const saved = await $fetch<VacationState>(`/api/vacations/requests/${id}`, {
      method: 'PATCH',
      body: patch
    });
    applyServerState(saved);
    return saved;
  };

  const syncDeleteRequest = async (id: number) => {
    if (!import.meta.client) return null;
    const saved = await $fetch<VacationState>(`/api/vacations/requests/${id}`, {
      method: 'DELETE'
    });
    applyServerState(saved);
    return saved;
  };

  const syncCreateReservation = async (payload: {
    year: number;
    month: number;
    durationDays: number;
    employee?: string;
    comment?: string;
  }) => {
    if (!import.meta.client) return null;
    const saved = await $fetch<VacationState>('/api/vacations/reservations', {
      method: 'POST',
      body: payload
    });
    applyServerState(saved);
    return saved;
  };

  const syncDeleteReservation = async (id: number) => {
    if (!import.meta.client) return null;
    const saved = await $fetch<VacationState>(`/api/vacations/reservations/${id}`, {
      method: 'DELETE'
    });
    applyServerState(saved);
    return saved;
  };

  const syncPatchReservation = async (
    id: number,
    patch: { durationDays?: number; comment?: string }
  ) => {
    if (!import.meta.client) return null;
    const saved = await $fetch<VacationState>(`/api/vacations/reservations/${id}`, {
      method: 'PATCH',
      body: patch
    });
    applyServerState(saved);
    return saved;
  };

  const syncPatchReservationCap = async (groupId: string, cap: number) => {
    if (!import.meta.client) return null;
    const saved = await $fetch<VacationState>('/api/vacations/reservation-caps', {
      method: 'PATCH',
      body: { groupId, cap }
    });
    applyServerState(saved);
    return saved;
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
        applyServerState(fromServer);
        loaded = true;
      }
    } catch {
      /* нет сессии */
    }

    if (!loaded) {
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        try {
          applyServerState(JSON.parse(raw) as Partial<VacationState>);
        } catch {
          state.value = defaultState();
        }
      } else {
        state.value = defaultState();
      }
    }

    syncViewYearToData();
    await migratePendingApprovalSteps();
    hydrated.value = true;
  };

  const reloadFromServer = async () => {
    if (!import.meta.client) return;
    hydrated.value = false;
    await hydrate();
  };

  const requestsForYear = (year = viewYear.value) =>
    state.value.requestsByYear[String(year)] ?? [];

  const reservationsForYear = (year = viewYear.value) =>
    (state.value.reservationsByYear[String(year)] ?? []).filter((r) =>
      canManageReservationMonth(r.year, r.month)
    );

  const yearRequests = computed(() => requestsForYear(viewYear.value));

  const yearReservations = computed(() => reservationsForYear(viewYear.value));

  const pendingRequests = computed(() =>
    yearRequests.value.filter((item) => item.status === 'pending')
  );

  const migratePendingApprovalSteps = async () => {
    const patches: { id: number; approval_step: VacationApprovalStep }[] = [];
    for (const list of Object.values(state.value.requestsByYear)) {
      for (const req of list) {
        if (req.status !== 'pending' || req.approval_step !== undefined) continue;
        const employee = findByName(req.employee);
        if (!employee) continue;
        patches.push({ id: req.id, approval_step: initialApprovalStep(employee, req.employee) });
      }
    }
    for (const patch of patches) {
      try {
        await syncPatchRequest(patch.id, { approval_step: patch.approval_step });
      } catch {
        /* офлайн или нет сессии */
      }
    }
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

  const addRequest = async (payload: {
    employee: string;
    start: string;
    end: string;
    comment?: string;
    year?: number;
  }) => {
    const beforeIds = new Set(
      Object.values(state.value.requestsByYear)
        .flat()
        .map((item) => item.id)
    );
    await syncCreateRequest(payload);
    const created = Object.values(state.value.requestsByYear)
      .flat()
      .find((item) => !beforeIds.has(item.id));
    return created ?? null;
  };

  const setRequestStatus = async (id: number, status: VacationStatus) => {
    const found = findRequestById(id);
    if (!found) return false;
    try {
      await syncPatchRequest(id, { status });
      return true;
    } catch {
      return false;
    }
  };

  const approveRequest = async (
    id: number,
    approverEmployeeName: string | null,
    options?: { force?: boolean; elevated?: boolean }
  ) => {
    const found = findRequestById(id);
    if (!found || found.item.status !== 'pending') return false;

    const employee = findByName(found.item.employee);
    if (!employee) return false;

    if (
      !options?.force &&
      !options?.elevated &&
      (!approverEmployeeName ||
        !canApproverReviewRequest(approverEmployeeName, found.item, employee))
    ) {
      return false;
    }

    let status: VacationStatus;
    let approval_step: VacationApprovalStep | null = null;

    if (options?.force) {
      status = 'approved';
    } else {
      const step = resolveRequestApprovalStep(found.item, employee);
      if (!step) return false;
      const next = nextStateAfterApproval(employee, step);
      status = next.status;
      approval_step = next.approval_step ?? null;
    }

    try {
      await syncPatchRequest(id, { status, approval_step });
      return true;
    } catch {
      return false;
    }
  };

  const findRequestById = (id: number) => {
    for (const [yearKey, list] of Object.entries(state.value.requestsByYear)) {
      const item = list.find((r) => r.id === id);
      if (item) return { item, yearKey };
    }
    return null;
  };

  const updateRequestDates = async (id: number, start: string, end: string) => {
    const found = findRequestById(id);
    if (!found || isPastApprovedVacationRequest(found.item)) return false;
    try {
      await syncPatchRequest(id, { start, end });
      return true;
    } catch {
      return false;
    }
  };

  const deleteRequest = async (id: number) => {
    const found = findRequestById(id);
    if (!found || isPastApprovedVacationRequest(found.item)) return false;
    try {
      await syncDeleteRequest(id);
      return true;
    } catch {
      return false;
    }
  };

  const findReservationById = (id: number) => {
    for (const [yearKey, list] of Object.entries(state.value.reservationsByYear)) {
      const item = list.find((r) => r.id === id);
      if (item) return { item, yearKey };
    }
    return null;
  };

  const addReservation = async (payload: {
    year: number;
    month: number;
    durationDays: number;
    employee?: string;
    comment?: string;
  }) => {
    const beforeIds = new Set(
      Object.values(state.value.reservationsByYear)
        .flat()
        .map((item) => item.id)
    );
    await syncCreateReservation(payload);
    const created = Object.values(state.value.reservationsByYear)
      .flat()
      .find((item) => !beforeIds.has(item.id));
    return created ?? null;
  };

  const deleteReservation = async (id: number) => {
    const found = findReservationById(id);
    if (!found) return false;
    try {
      await syncDeleteReservation(id);
      return true;
    } catch {
      return false;
    }
  };

  const updateReservation = async (
    id: number,
    patch: { durationDays?: number; comment?: string }
  ) => {
    const found = findReservationById(id);
    if (!found) return null;
    try {
      await syncPatchReservation(id, patch);
      return findReservationById(id)?.item ?? null;
    } catch {
      return null;
    }
  };

  const getMonthEntries = (
    employeeName: string,
    month: number,
    year = viewYear.value
  ): VacationMonthEntry[] => {
    const dated = requestsForYear(year)
      .filter((r) => r.employee === employeeName && (r.status === 'approved' || r.status === 'pending'))
      .map((r) => ({
        kind: 'dated' as const,
        status: r.status,
        label: formatMonthVacationRange(r.start, r.end, month, year)
      }))
      .filter((x) => x.label !== '');

    const reserved = reservationsForYear(year)
      .filter((r) => r.employee === employeeName && r.month === month + 1)
      .map((r) => ({
        kind: 'reservation' as const,
        status: 'reservation' as const,
        label: formatReservationLabel(r.durationDays)
      }));

    return [...dated, ...reserved];
  };

  const employeeRequests = (employeeName: string, year = viewYear.value) =>
    requestsForYear(year).filter((r) => r.employee === employeeName);

  const employeeReservations = (employeeName: string, year = viewYear.value) =>
    reservationsForYear(year).filter((r) => r.employee === employeeName);

  const allReservations = computed(() =>
    Object.values(state.value.reservationsByYear).flat()
  );

  const updateReservationMonthlyCap = async (groupId: string, cap: number) => {
    try {
      await syncPatchReservationCap(groupId, cap);
      return true;
    } catch {
      return false;
    }
  };

  return {
    state,
    viewYear,
    yearRequests,
    yearReservations,
    pendingRequests,
    pendingRequestsForApprover,
    handedOffRequestsForApprover,
    migratePendingApprovalSteps,
    hydrate,
    reloadFromServer,
    persistLocal,
    requestsForYear,
    reservationsForYear,
    addRequest,
    addReservation,
    updateReservation,
    approveRequest,
    setRequestStatus,
    updateRequestDates,
    deleteRequest,
    deleteReservation,
    findRequestById,
    findReservationById,
    getMonthEntries,
    employeeRequests,
    employeeReservations,
    allReservations,
    updateReservationMonthlyCap,
    vacationStatusLabels,
    requestStatusLabel,
    MONTHS_RU
  };
}
