/** Восстановление сессии после mount — до гидрации SSR payload может сбросить authReady. */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    void useAuth().restoreSession();
  });
});
