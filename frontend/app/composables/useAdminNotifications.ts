export type AdminNotification = {
  id: string;
  kind: 'bitrix_employee_name' | 'bitrix_employee_title';
  employee_id: number;
  bitrix_user_id: number;
  employee_name: string;
  field: 'name' | 'title';
  platform_value: string;
  bitrix_value: string;
  created_at: string;
  admin_seen: boolean;
};

const fieldLabels: Record<AdminNotification['field'], string> = {
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
    const label = fieldLabels[item.field];
    return `Изменение ${label} в Битрикс24`;
  };

  const formatNotificationBody = (item: AdminNotification) => {
    const label = fieldLabels[item.field];
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
    formatDate
  };
}
