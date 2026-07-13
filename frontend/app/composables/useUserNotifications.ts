export type UserNotification = {
  id: string;
  kind:
    | 'vacation_submitted'
    | 'vacation_updated'
    | 'vacation_deleted'
    | 'vacation_approved'
    | 'vacation_rejected'
    | 'vacation_next_stage'
    | 'vacation_reservation_updated'
    | 'vacation_reservation_expiring'
    | 'vacation_reservation_expiring_manager';
  recipient_user_id: number;
  vacation_request_id: number;
  employee_name: string;
  start: string;
  end: string;
  stage_label?: string;
  created_at: string;
  seen: boolean;
};

const formatPeriod = (start: string, end: string) => {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  };
  if (start === end) return fmt(start);
  return `${fmt(start)}–${fmt(end)}`;
};

export function useUserNotifications() {
  const notifications = useState<UserNotification[]>('user-notifications', () => []);
  const unseenCount = useState<number>('user-notifications-unseen', () => 0);
  const loading = useState<boolean>('user-notifications-loading', () => false);
  const error = useState<string | null>('user-notifications-error', () => null);

  const loadNotifications = async (filters?: { unseen?: boolean }) => {
    loading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      if (filters?.unseen) params.set('unseen', '1');
      const qs = params.toString();
      const data = await $fetch<{ notifications: UserNotification[]; unseen_count: number }>(
        `/api/notifications${qs ? `?${qs}` : ''}`
      );
      notifications.value = data.notifications;
      unseenCount.value = data.unseen_count;
    } catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string }; message?: string };
      error.value = err.data?.statusMessage ?? err.message ?? 'Ошибка загрузки уведомлений';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const markSeen = async (id: string) => {
    await $fetch(`/api/notifications/${id}/seen`, { method: 'PATCH' });
    await loadNotifications();
  };

  const markAllSeen = async () => {
    await $fetch('/api/notifications/seen-all', { method: 'PATCH' });
    await loadNotifications();
  };

  const dismiss = async (id: string) => {
    await $fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    notifications.value = notifications.value.filter((item) => item.id !== id);
    unseenCount.value = notifications.value.filter((item) => !item.seen).length;
  };

  const notificationLink = (item: UserNotification) =>
    isManagerAction(item) ? '/vacations?tab=approval' : '/vacations';

  const formatNotificationTitle = (item: UserNotification) => {
    switch (item.kind) {
      case 'vacation_submitted':
        return 'Заявка на отпуск';
      case 'vacation_updated':
        return 'Заявка изменена';
      case 'vacation_deleted':
        return 'Заявка удалена';
      case 'vacation_approved':
        return 'Отпуск согласован';
      case 'vacation_rejected':
        return 'Отпуск отклонён';
      case 'vacation_next_stage':
        return 'Следующий этап согласования';
      case 'vacation_reservation_updated':
        return 'Предварительная бронь изменена';
      case 'vacation_reservation_expiring':
        return 'Срок предварительной брони';
      case 'vacation_reservation_expiring_manager':
        return 'Бронь сотрудника истекает';
      default:
        return 'Отпуска';
    }
  };

  const formatNotificationBody = (item: UserNotification) => {
    const period = formatPeriod(item.start, item.end);
    switch (item.kind) {
      case 'vacation_submitted':
        return `${item.employee_name} подал(а) заявку на ${period}.`;
      case 'vacation_updated':
        return `${item.employee_name} изменил(а) даты отпуска: ${period}.`;
      case 'vacation_deleted':
        return `${item.employee_name} удалил(а) заявку на ${period}.`;
      case 'vacation_approved':
        return `Ваш отпуск ${period} согласован.`;
      case 'vacation_rejected':
        return `Заявка на отпуск ${period} отклонена.`;
      case 'vacation_next_stage':
        return item.stage_label
          ? `Заявка на ${period}: ${item.stage_label}.`
          : `Заявка на ${period} перешла на следующий этап согласования.`;
      case 'vacation_reservation_updated':
        return item.stage_label
          ? `${item.employee_name} изменил(а) детали предварительной брони: ${item.stage_label}.`
          : `${item.employee_name} изменил(а) детали предварительной брони.`;
      case 'vacation_reservation_expiring':
        return item.stage_label
          ? `Сегодня последний день брони (${item.stage_label}). Создайте заявку на отпуск, иначе бронь будет снята.`
          : 'Сегодня последний день предварительной брони. Создайте заявку на отпуск, иначе бронь будет снята.';
      case 'vacation_reservation_expiring_manager':
        return item.stage_label
          ? `У ${item.employee_name} сегодня истекает предварительная бронь (${item.stage_label}). Напомните создать заявку, иначе бронь снимется.`
          : `У ${item.employee_name} сегодня истекает предварительная бронь. Напомните создать заявку.`;
      default:
        return period;
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const isManagerAction = (item: UserNotification) =>
    item.kind === 'vacation_submitted' ||
    item.kind === 'vacation_updated' ||
    item.kind === 'vacation_deleted' ||
    item.kind === 'vacation_reservation_updated' ||
    item.kind === 'vacation_reservation_expiring_manager';

  return {
    notifications,
    unseenCount,
    loading,
    error,
    loadNotifications,
    markSeen,
    markAllSeen,
    dismiss,
    notificationLink,
    formatNotificationTitle,
    formatNotificationBody,
    formatDate,
    isManagerAction
  };
}
