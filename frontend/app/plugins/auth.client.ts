/** Восстановление сессии до первого рендера — убирает зависание на «Загрузка...» */
export default defineNuxtPlugin(() => {
  useAuth().restoreSession();
});
