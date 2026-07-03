/** Подгрузка аватаров с сервера — видны всем авторизованным пользователям. */
export default defineNuxtPlugin(() => {
  const { user, authReady } = useAuth();
  const { hydrateFromServer, resetHydration } = useAvatars();

  watch(
    () => (authReady.value ? user.value?.id : null),
    (userId) => {
      if (userId) {
        void hydrateFromServer();
        return;
      }
      resetHydration();
    },
    { immediate: true }
  );
});
