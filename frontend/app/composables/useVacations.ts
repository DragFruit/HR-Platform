export type VacationStatus = 'pending' | 'approved' | 'rejected';

export type VacationRequest = {
  id: number;
  employee: string;
  start: string;
  end: string;
  status: VacationStatus;
  comment: string;
  createdAt: string;
};

type VacationState = {
  primaryYear: number;
  requestsByYear: Record<string, VacationRequest[]>;
  nextRequestId: number;
};

const STORAGE_KEY = 'vbi-vacations-state-v3';

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

  const fmt = (date: Date) => `${date.getDate()} ${MONTHS_RU[date.getMonth()].slice(0, 3).toLowerCase()}.`;
  if (from.getTime() === to.getTime()) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
};

export function useVacations() {
  const { canManagerApproveRequest } = useEmployees();
  const state = useState<VacationState>('vbi-vacations', defaultState);
  const viewYear = useState<number>('vbi-vacations-year', () => new Date().getFullYear());
  const hydrated = useState<boolean>('vbi-vacations-hydrated', () => false);

  const persist = () => {
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

  const hydrate = () => {
    if (!import.meta.client) return;
    if (hydrated.value) {
      syncViewYearToData();
      return;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        state.value = JSON.parse(raw) as VacationState;
      } catch {
        state.value = defaultState();
      }
    } else {
      state.value = defaultState();
    }

    syncViewYearToData();
    hydrated.value = true;
  };

  const requestsForYear = (year = viewYear.value) =>
    state.value.requestsByYear[String(year)] ?? [];

  const yearRequests = computed(() => requestsForYear(viewYear.value));

  const pendingRequests = computed(() =>
    yearRequests.value.filter((item) => item.status === 'pending')
  );

  const pendingRequestsForApprover = (
    approverEmployeeName: string | null,
    seeAll: boolean
  ) => {
    const pending = pendingRequests.value;
    if (seeAll || !approverEmployeeName) return pending;
    return pending.filter((request) =>
      canManagerApproveRequest(approverEmployeeName, request.employee)
    );
  };

  const addRequest = (payload: {
    employee: string;
    start: string;
    end: string;
    comment?: string;
  }) => {
    const yearKey = String(viewYear.value);
    const list = state.value.requestsByYear[yearKey] ?? [];
    const request: VacationRequest = {
      id: state.value.nextRequestId++,
      employee: payload.employee,
      start: payload.start,
      end: payload.end,
      status: 'pending',
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
    if (!found) return false;
    found.item.start = start;
    found.item.end = end;
    persist();
    return true;
  };

  const deleteRequest = (id: number) => {
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
    hydrate,
    persist,
    requestsForYear,
    addRequest,
    setRequestStatus,
    updateRequestDates,
    deleteRequest,
    findRequestById,
    getMonthEntries,
    employeeRequests,
    vacationStatusLabels,
    MONTHS_RU
  };
}
