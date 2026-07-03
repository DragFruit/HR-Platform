/** Загрузка client-side данных после авторизации (демо + Bitrix OAuth). */
export async function bootstrapAppData() {
  if (!import.meta.client) return;

  useState<boolean>('vbi-employees-hydrated').value = false;
  await useEmployees().hydrate();
  await useVacations().hydrate();
  useTasks().hydrate();
  useWallet().hydrateWallets();

  const { user } = useAuth();
  const { isAdmin } = usePlatformContext();
  if (!isAdmin.value) {
    useUserNotifications().loadNotifications().catch(() => {});
  }
  if (user.value?.role === 'admin' || user.value?.role === 'hr') {
    useAdminNotifications().loadNotifications().catch(() => {});
  }
}
