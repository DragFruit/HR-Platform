/**
 * Точка-индикатор на пункте меню квеста: есть доступная мини-игра дня.
 * В колокольчик платформы уведомления не дублируем (раздел 7 спеки).
 */
export function useNokturnBadge() {
  const dot = useState<boolean>('nokturn-nav-dot', () => false);
  const hydrated = useState<boolean>('nokturn-nav-dot-hydrated', () => false);
  const { isAuthenticated } = useAuth();
  const { isPathAllowed } = useLaunchScope();

  const refresh = async () => {
    if (!import.meta.client) return;
    if (!isAuthenticated.value || !isPathAllowed('/event/nokturn')) {
      dot.value = false;
      return;
    }
    try {
      const res = await $fetch<{ dot: boolean }>('/api/event/nokturn/badge');
      dot.value = Boolean(res?.dot);
    } catch {
      dot.value = false;
    }
  };

  onMounted(() => {
    if (hydrated.value) return;
    hydrated.value = true;
    void refresh();
  });

  return { dot, refresh };
}
