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
    bitrixPortalUrl: process.env.BITRIX_PORTAL_URL || '',
    bitrixClientId: process.env.BITRIX_CLIENT_ID || '',
    bitrixClientSecret: process.env.BITRIX_CLIENT_SECRET || '',
    bitrixRedirectUri: process.env.BITRIX_REDIRECT_URI || '',
    bitrixAdminGroupIds: process.env.BITRIX_ADMIN_GROUP_IDS || '1',
    bitrixHrGroupIds: process.env.BITRIX_HR_GROUP_IDS || '',
    bitrixManagerGroupIds: process.env.BITRIX_MANAGER_GROUP_IDS || '',
    public: {
      /** development | staging | production — для плашки стенда и логики окружения */
      appEnv: process.env.NUXT_PUBLIC_APP_ENV || 'development',
      /** `vacations` — только график отпусков; `full` — вся платформа */
      launchScope: process.env.NUXT_PUBLIC_LAUNCH_SCOPE || 'full',
      /** Соцсети агентства VBI — переопределяются через NUXT_PUBLIC_SOCIAL_* */
      socialVkUrl: process.env.NUXT_PUBLIC_SOCIAL_VK_URL || 'https://vk.com/vbi.agency',
      socialTelegramUrl: process.env.NUXT_PUBLIC_SOCIAL_TELEGRAM_URL || 'https://t.me/vbi_agency'
    }
  }
})
