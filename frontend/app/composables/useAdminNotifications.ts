export type AdminNotificationKind =
  | 'bitrix_employee_name'
  | 'bitrix_employee_title'
  | 'bitrix_vacation_sync_failed'
  | 'tenure_gift_order'
  | 'idea_submitted'
  | 'vpn_peer_delete_failed'
  | 'sales_best_pick_due'
  | 'page_feedback'
  | 'knowledge_ai_degraded'
  | 'bitrix_notify_failed';

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
  error_message?: string;
  vpn_peer_names?: string[];
  vpn_panel?: string;
  sales_period?: string;
  sales_period_label?: string;
  stars?: number;
  comment?: string;
  page?: string;
  photo_id?: string;
};

const fieldLabels: Record<'name' | 'title', string> = {
  name: 'ФИО',
  title: 'должность'
};

const PAGE_FEEDBACK_LABELS: Record<string, string> = {
  '/knowledge': 'База знаний',
  '/vacations': 'Отпуска',
  '/ideas': 'Банк идей',
  '/vpn': 'VPN',
  '/profile': 'Профиль'
};

function pageFeedbackLabel(page?: string) {
  if (!page) return 'Раздел';
  return PAGE_FEEDBACK_LABELS[page] || page;
}

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
    if (item.kind === 'sales_best_pick_due') {
      return 'Выберите лучшего специалиста продаж';
    }
    if (item.kind === 'tenure_gift_order') {
      return `Собрать юбилейный набор (${item.years ?? '—'} лет)`;
    }
    if (item.kind === 'idea_submitted') {
      return 'Новая идея в банке';
    }
    if (item.kind === 'bitrix_vacation_sync_failed') {
      return 'Отпуск не ушёл в Bitrix';
    }
    if (item.kind === 'vpn_peer_delete_failed') {
      return 'Не удалось удалить VPN-ключи';
    }
    if (item.kind === 'page_feedback') {
      const section = pageFeedbackLabel(item.page);
      return `Оценка «${section}»: ${item.stars ?? '—'}/5`;
    }
    if (item.kind === 'knowledge_ai_degraded') {
      return 'ИИ базы знаний: сбой Yandex';
    }
    if (item.kind === 'bitrix_notify_failed') {
      return 'Bitrix: колокольчик не создан';
    }
    const label = item.field ? fieldLabels[item.field] : 'данные';
    return `Изменение ${label} в Битрикс24`;
  };

  const formatNotificationBody = (item: AdminNotification) => {
    if (item.kind === 'sales_best_pick_due') {
      const period = item.sales_period_label || item.sales_period || 'текущий месяц';
      return (
        `Напоминание: выберите лучшего специалиста продаж за ${period}. ` +
        'Лучший — тот, кто выше всех перевыполнил план. ' +
        'Ачивка у победителя появится в первый рабочий день следующего месяца (интрига до reveal). Можно перевыбрать.'
      );
    }
    if (item.kind === 'tenure_gift_order') {
      return `${item.employee_name} использовал(а) купон на набор «${item.years} лет». Соберите подарок: медаль, вино ${item.years} лет выдержки и премию.`;
    }
    if (item.kind === 'idea_submitted') {
      return `${item.employee_name} предложил(а): «${item.idea_title || 'идея'}». Рассмотрите заявку в банке идей.`;
    }
    if (item.kind === 'bitrix_vacation_sync_failed') {
      const period =
        item.vacation_start && item.vacation_end
          ? `${item.vacation_start} — ${item.vacation_end}`
          : 'даты неизвестны';
      return `${item.employee_name}: ${period}. ${item.error_message || 'Ошибка синка'}. Проверьте вебхук / добавьте отсутствие вручную.`;
    }
    if (item.kind === 'vpn_peer_delete_failed') {
      const peers = (item.vpn_peer_names || []).join(', ') || 'пиры';
      const panel = item.vpn_panel ? ` (${item.vpn_panel})` : '';
      return `${item.employee_name}: удалите вручную в админке VPN${panel}: ${peers}. ${item.error_message || ''}`.trim();
    }
    if (item.kind === 'page_feedback') {
      const note = item.comment?.trim();
      const photo = item.photo_id ? ' + фото' : '';
      return note
        ? `${item.employee_name}: «${note}»${photo}`
        : `${item.employee_name} оценил(а) страницу${photo ? ' (есть фото)' : ', комментария нет'}.`;
    }
    if (item.kind === 'knowledge_ai_degraded') {
      const q = item.comment?.trim();
      return (
        `${item.employee_name}: помощник БЗ перешёл в упрощённый режим. ` +
        `${item.error_message || 'Ошибка Yandex'}` +
        (q ? ` Вопрос: «${q}».` : '')
      );
    }
    if (item.kind === 'bitrix_notify_failed') {
      return (
        `Согласующему «${item.employee_name}» (Bitrix id ${item.bitrix_user_id ?? '—'}) ` +
        `не ушёл колокольчик в Bitrix. В Vibe уведомление есть. ` +
        `${item.error_message || ''} ` +
        `Нужен мост vbihr|vacation или проверка учётки на crm.vbi.ru (см. docs/BITRIX.md).`
      ).trim();
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
    if (item.kind === 'sales_best_pick_due') return 'Выбрать';
    if (item.kind === 'tenure_gift_order') return 'К уведомлению';
    if (item.kind === 'idea_submitted') return 'Банк идей';
    if (item.kind === 'bitrix_vacation_sync_failed') return 'Отпуска';
    if (item.kind === 'vpn_peer_delete_failed') return 'Уведомления';
    if (item.kind === 'page_feedback') return pageFeedbackLabel(item.page);
    if (item.kind === 'knowledge_ai_degraded') return 'База знаний';
    if (item.kind === 'bitrix_notify_failed') return 'Отпуска';
    return 'Справочник';
  };

  const notificationActionTo = (item: AdminNotification) => {
    if (item.kind === 'sales_best_pick_due') {
      const q = item.sales_period ? `?period=${encodeURIComponent(item.sales_period)}` : '';
      return `/admin/sales-best${q}`;
    }
    if (item.kind === 'tenure_gift_order') return '/admin/notifications';
    if (item.kind === 'idea_submitted') return '/admin/ideas';
    if (item.kind === 'bitrix_vacation_sync_failed') return '/admin/vacations';
    if (item.kind === 'vpn_peer_delete_failed') return '/admin/notifications';
    if (item.kind === 'page_feedback') return item.page || '/knowledge';
    if (item.kind === 'knowledge_ai_degraded') return '/admin/knowledge';
    if (item.kind === 'bitrix_notify_failed') return '/admin/vacations';
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
