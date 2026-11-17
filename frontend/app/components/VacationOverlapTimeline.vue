<template>
  <div
    class="vac-ovl-tl"
    :style="{ '--vac-ovl-days': days.length }"
    role="group"
    aria-label="Пересечения отпусков по дням"
  >
    <div class="vac-ovl-tl__scroll">
      <div class="vac-ovl-tl__row vac-ovl-tl__row--head">
        <span class="vac-ovl-tl__name vac-ovl-tl__name--head">{{ monthLabel }}</span>
        <span
          v-for="(day, idx) in days"
          :key="`h-${day.iso}`"
          class="vac-ovl-tl__day"
          :class="[{ 'is-weekend': day.weekend, 'is-month-start': day.monthStart }, clashEdge(idx)]"
        >{{ day.day }}</span>
      </div>

      <div class="vac-ovl-tl__row vac-ovl-tl__row--self">
        <span class="vac-ovl-tl__name" :title="request.employee">{{ shortName(request.employee) }}</span>
        <span
          v-for="(state, idx) in selfCells"
          :key="`s-${days[idx]!.iso}`"
          class="vac-ovl-tl__cell"
          :class="[state ? `is-${state}` : '', edgeClass(selfCells, idx), clashEdge(idx), { 'is-weekend': days[idx]!.weekend }]"
          :title="cellTitle(days[idx]!.iso, state)"
        />
      </div>

      <div v-for="row in rows" :key="row.employee" class="vac-ovl-tl__row">
        <span class="vac-ovl-tl__name" :title="`${row.employee}: ${row.status === 'approved' ? 'согласован' : 'на согласовании'}`">
          <span class="vac-ovl-tl__status" :class="`is-${row.status}`" aria-hidden="true" />{{ shortName(row.employee) }}
        </span>
        <span
          v-for="(state, idx) in row.cells"
          :key="`${row.employee}-${days[idx]!.iso}`"
          class="vac-ovl-tl__cell"
          :class="[state ? `is-${state}` : '', edgeClass(row.cells, idx), clashEdge(idx), { 'is-weekend': days[idx]!.weekend }]"
          :title="cellTitle(days[idx]!.iso, state)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatEmployeeShortName } from '~/utils/employeeName';
import { isRuHoliday, MONTHS_RU } from '~/utils/vacationCalendar';
import { isoDaysBetween, type VacationOverlapEntry } from '~/utils/vacationOverlaps';

type CellState = '' | 'approved' | 'pending' | 'self';

const props = defineProps<{
  request: { employee: string; start: string; end: string };
  entries: VacationOverlapEntry[];
}>();

/** Поля по краям окна, чтобы было видно начало/конец чужих отпусков рядом. */
const PAD_DAYS = 2;

const shiftIso = (iso: string, delta: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + delta)).toISOString().slice(0, 10);
};

const reqRange = computed(() =>
  props.request.start <= props.request.end
    ? [props.request.start, props.request.end]
    : [props.request.end, props.request.start]
);

const days = computed(() =>
  isoDaysBetween(shiftIso(reqRange.value[0]!, -PAD_DAYS), shiftIso(reqRange.value[1]!, PAD_DAYS)).map(
    (iso) => {
      const date = new Date(`${iso}T00:00:00`);
      const wd = date.getDay();
      return {
        iso,
        day: date.getDate(),
        weekend: wd === 0 || wd === 6 || isRuHoliday(iso),
        monthStart: date.getDate() === 1
      };
    }
  )
);

const monthLabel = computed(() => {
  const first = days.value[0];
  const last = days.value[days.value.length - 1];
  if (!first || !last) return '';
  const m0 = Number(first.iso.slice(5, 7)) - 1;
  const m1 = Number(last.iso.slice(5, 7)) - 1;
  const short = (m: number) => (MONTHS_RU[m] ?? '').slice(0, 3).toLowerCase();
  return m0 === m1 ? short(m0) : `${short(m0)}–${short(m1)}`;
});

const inRequest = (iso: string) => iso >= reqRange.value[0]! && iso <= reqRange.value[1]!;

const rows = computed(() => {
  const byPerson = new Map<string, VacationOverlapEntry[]>();
  for (const entry of props.entries) {
    const list = byPerson.get(entry.employee) ?? [];
    list.push(entry);
    byPerson.set(entry.employee, list);
  }
  return [...byPerson.entries()].map(([employee, list]) => ({
    employee,
    status: list.some((e) => e.status === 'approved') ? ('approved' as const) : ('pending' as const),
    cells: days.value.map(({ iso }): CellState => {
      const hit = list.filter((e) => iso >= e.start && iso <= e.end);
      if (!hit.length) return '';
      return hit.some((e) => e.status === 'approved') ? 'approved' : 'pending';
    })
  }));
});

/** Заявка всегда своим цветом (на согласовании), без красного: статус должен читаться. */
const selfCells = computed(() =>
  days.value.map(({ iso }): CellState => (inRequest(iso) ? 'self' : ''))
);

/** Дни пересечения: внутри заявки и кто-то из коллег тоже отсутствует. */
const clashDays = computed(() =>
  days.value.map(({ iso }, idx) => inRequest(iso) && rows.value.some((row) => Boolean(row.cells[idx])))
);

/** Границы зоны пересечения: вертикальный пунктир через все строки. */
const clashEdge = (idx: number) => {
  const flags = clashDays.value;
  if (!flags[idx]) return '';
  return ['is-clash-col', !flags[idx - 1] ? 'is-clash-start' : '', !flags[idx + 1] ? 'is-clash-end' : ''].join(' ');
};

/** Скругление краёв непрерывного отрезка. */
const edgeClass = (cells: CellState[], idx: number) => {
  const cur = cells[idx];
  if (!cur) return '';
  const prev = cells[idx - 1];
  const next = cells[idx + 1];
  return [!prev ? 'is-run-start' : '', !next ? 'is-run-end' : ''].join(' ');
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

const cellTitle = (iso: string, state: CellState) => {
  const label: Record<Exclude<CellState, ''>, string> = {
    approved: 'согласованный отпуск',
    pending: 'заявка на согласовании',
    self: 'эта заявка'
  };
  const clash = days.value.findIndex((d) => d.iso === iso);
  const suffix = clash >= 0 && clashDays.value[clash] ? ', пересечение' : '';
  return state ? `${fmtDate(iso)}: ${label[state]}${suffix}` : fmtDate(iso);
};

const shortName = (name: string) => formatEmployeeShortName(name);
</script>
