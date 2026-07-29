export type AdminNotificationKind =
  | 'bitrix_employee_name'
  | 'bitrix_employee_title'
  | 'tenure_gift_order'
  | 'idea_submitted'
  | 'bitrix_vacation_absence_failed';

export type AdminNotification = {
  id: string;
  kind: AdminNotificationKind;
  employee_id: number;
  employee_name: string;
  created_at: string;
  admin_seen: boolean;
  bitrix_user_id?: number;
  field?: 'name' | 'title';
  platform_value?: string;
  bitrix_value?: string;
  years?: number;
  sku?: string;
  order_id?: string;
  idea_id?: string;
  idea_title?: string;
  vacation_request_id?: number;
  vacation_start?: string;
  vacation_end?: string;
  absence_action?: 'create' | 'update' | 'remove';
  error_message?: string;
};

const fieldLabels: Record<'name' | 'title', string> = {
  name: 'ФИО',
  title: 'должность'
};

export function useAdminNotifications() {
  const notifications = useState<AdminNotification[]>('admin-notifications', () => []);
  const unseenCount = useState<number>('admin-notifications-unseen', () => 0);
  const loading = useState<boolean>('admin-notifications-loading', () => false);
  const error = useState<string | null>('admin-notifications-error', () => null);

  const loadNotifications = async (filters?: { unseen?: boolean }) => {
    loading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      if (filters?.unseen) params.set('unseen', '1');
      const qs = params.toString();
      const data = await $fetch<{ notifications: AdminNotification[]; unseen_count: number }>(
        `/api/admin/notifications${qs ? `?${qs}` : ''}`
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
    await $fetch(`/api/admin/notifications/${id}/seen`, { method: 'PATCH' });
    await loadNotifications();
  };

  const markAllSeen = async () => {
    await $fetch('/api/admin/notifications/seen-all', { method: 'PATCH' });
    await loadNotifications();
  };

  const formatNotificationTitle = (item: AdminNotification) => {
    if (item.kind === 'tenure_gift_order') {
      return `Собрать юбилейный набор (${item.years ?? '—'} лет)`;
    }
    if (item.kind === 'idea_submitted') {
      return 'Новая идея в банке';
    }
    if (item.kind === 'bitrix_vacation_absence_failed') {
      if (item.absence_action === 'remove') return 'Не снялась пальма в Bitrix';
      if (item.absence_action === 'update') return 'Не обновилась пальма в Bitrix';
      return 'Не создалась пальма в Bitrix';
    }
    const label = item.field ? fieldLabels[item.field] : 'данные';
    return `Изменение ${label} в Битрикс24`;
  };

  const formatIsoDateRu = (iso?: string) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}.${m}.${y}` : iso;
  };

  const formatNotificationBody = (item: AdminNotification) => {
    if (item.kind === 'tenure_gift_order') {
      return `${item.employee_name} использовал(а) купон на набор «${item.years} лет». Соберите подарок: медаль, вино ${item.years} лет выдержки и премию.`;
    }
    if (item.kind === 'idea_submitted') {
      return `${item.employee_name} предложил(а): «${item.idea_title || 'идея'}». Рассмотрите заявку в банке идей.`;
    }
    if (item.kind === 'bitrix_vacation_absence_failed') {
      const dates = `${formatIsoDateRu(item.vacation_start)} — ${formatIsoDateRu(item.vacation_end)}`;
      const action =
        item.absence_action === 'remove'
          ? 'снять'
          : item.absence_action === 'update'
            ? 'обновить'
            : 'создать';
      return `${item.employee_name}, ${dates}: не удалось ${action} отсутствие в Bitrix. ${item.error_message || 'Проверьте вручную в графике отсутствий.'}`;
    }
    const label = item.field ? fieldLabels[item.field] : 'поле';
    return `${item.employee_name}: на платформе «${item.platform_value || '—'}», в Битрикс «${item.bitrix_value || '—'}». Обновите вручную в справочнике сотрудников.`;
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

  const notificationActionLabel = (item: AdminNotification) => {
    if (item.kind === 'tenure_gift_order') return 'К уведомлению';
    if (item.kind === 'idea_submitted') return 'Банк идей';
    if (item.kind === 'bitrix_vacation_absence_failed') return 'Отпуска';
    return 'Справочник';
  };

  const notificationActionTo = (item: AdminNotification) => {
    if (item.kind === 'tenure_gift_order') return '/admin/notifications';
    if (item.kind === 'idea_submitted') return '/admin/ideas';
    if (item.kind === 'bitrix_vacation_absence_failed') return '/admin/vacations';
    return '/admin/employees';
  };

  return {
    notifications,
    unseenCount,
    loading,
    error,
    loadNotifications,
    markSeen,
    markAllSeen,
    formatNotificationTitle,
    formatNotificationBody,
    formatDate,
    notificationActionLabel,
    notificationActionTo
  };
}
