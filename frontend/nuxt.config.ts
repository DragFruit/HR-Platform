// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/main.css'],
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&family=Unbounded:wght@500;600;700;800&display=swap'
        }
      ]
    }
  },
  runtimeConfig: {
    public: {
      /** development | staging | production — для плашки стенда и логики окружения */
      appEnv: process.env.NUXT_PUBLIC_APP_ENV || 'development',
      /** `vacations` — только график отпусков; `full` — вся платформа */
      launchScope: process.env.NUXT_PUBLIC_LAUNCH_SCOPE || 'full'
    }
  }
})
