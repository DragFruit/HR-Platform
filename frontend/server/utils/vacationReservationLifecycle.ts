import type { VacationReservation } from '../../app/utils/vacationReservations';
import {
  isReservationMonthLastDay,
  isReservationMonthPast
} from '../../app/utils/vacationReservations';
import { notifyVacationReservationExpiring } from './vacationReservationNotifications';
import { mutateVacations, readVacations, type VacationStoreState } from './vacationsStore';

function reservationLifecycleNeedsUpdate(state: VacationStoreState, now = new Date()): boolean {
  for (const list of Object.values(state.reservationsByYear)) {
    for (const res of list) {
      if (isReservationMonthPast(res.year, res.month, now)) return true;
      if (isReservationMonthLastDay(res.year, res.month, now) && !res.expiry_notice_sent_at) {
        return true;
      }
    }
  }
  return false;
}

/** Удаляет просроченные брони; в последний день месяца шлёт напоминание сотруднику и руководителю. */
export async function applyReservationLifecycle(): Promise<VacationStoreState> {
  const current = await readVacations();
  if (!reservationLifecycleNeedsUpdate(current)) {
    return current;
  }

  const toNotify: VacationReservation[] = [];

  const result = await mutateVacations((state) => {
    for (const [yearKey, list] of Object.entries(state.reservationsByYear)) {
      const kept: VacationReservation[] = [];
      for (const res of list) {
        if (isReservationMonthPast(res.year, res.month)) {
          continue;
        }
        if (isReservationMonthLastDay(res.year, res.month) && !res.expiry_notice_sent_at) {
          toNotify.push({ ...res });
          res.expiry_notice_sent_at = new Date().toISOString();
        }
        kept.push(res);
      }
      state.reservationsByYear[yearKey] = kept;
    }
    return state;
  }, { reason: 'reservation-lifecycle' });

  for (const reservation of toNotify) {
    await notifyVacationReservationExpiring(reservation);
  }

  return result;
}
