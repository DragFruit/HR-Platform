// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/main.css'],
  runtimeConfig: {
    public: {
      /** development | staging | production — для плашки стенда и логики окружения */
      appEnv: process.env.NUXT_PUBLIC_APP_ENV || 'development',
      /** `vacations` — только график отпусков; `full` — вся платформа */
      launchScope: process.env.NUXT_PUBLIC_LAUNCH_SCOPE || 'full'
    }
  }
})
