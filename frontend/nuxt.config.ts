// https://nuxt.com/docs/api/configuration/nuxt-config
import { buildYandexMetrikaHead, resolveYandexMetrikaId, YANDEX_METRIKA_FRAME_ANCESTORS_CSP } from './app/utils/yandexMetrika';

const yandexMetrikaId = resolveYandexMetrikaId(process.env.NUXT_PUBLIC_YANDEX_METRIKA_ID);
const metrikaHead = buildYandexMetrikaHead(yandexMetrikaId);

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/main.css'],
  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy': YANDEX_METRIKA_FRAME_ANCESTORS_CSP
      }
    }
  },
  app: {
    head: {
      title: 'VIBE VBI',
      script: metrikaHead.script,
      noscript: metrikaHead.noscript,
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
      /** Связи между блоками оргструктуры (рисование линий) — на бое пока выключено */
      orgLinksEnabled:
        process.env.NUXT_PUBLIC_ORG_LINKS_ENABLED === 'true' ||
        (process.env.NUXT_PUBLIC_ORG_LINKS_ENABLED !== 'false' &&
          (process.env.NUXT_PUBLIC_APP_ENV || 'development') !== 'production'),
      /** `vacations` — только график отпусков; `full` — вся платформа */
      launchScope: process.env.NUXT_PUBLIC_LAUNCH_SCOPE || 'full',
      /** QA-отдел «Тестировщики» для локальной проверки согласования (не для production) */
      qaTestDepartment:
        process.env.NUXT_PUBLIC_QA_TEST_DEPARTMENT === '1' ||
        (process.env.NUXT_PUBLIC_QA_TEST_DEPARTMENT !== '0' &&
          process.env.NODE_ENV === 'development'),
      /** Квест-обучение по отпускам — включено везде; отключить: NUXT_PUBLIC_VACATION_TRAINING_ENABLED=false */
      vacationTrainingEnabled: process.env.NUXT_PUBLIC_VACATION_TRAINING_ENABLED !== 'false',
      /** Базовый URL портала Bitrix (ссылки на профили сотрудников) */
      bitrixPortalUrl: process.env.NUXT_PUBLIC_BITRIX_PORTAL_URL || process.env.BITRIX_PORTAL_URL || 'https://crm.vbi.ru',
      /** Соцсети агентства VBI — переопределяются через NUXT_PUBLIC_SOCIAL_* */
      socialVkUrl: process.env.NUXT_PUBLIC_SOCIAL_VK_URL || 'https://vk.com/vbi.agency',
      socialTelegramUrl: process.env.NUXT_PUBLIC_SOCIAL_TELEGRAM_URL || 'https://t.me/vbi_agency',
      /** Яндекс Метрика (SPA). По умолчанию 110244372 */
      yandexMetrikaId: process.env.NUXT_PUBLIC_YANDEX_METRIKA_ID || yandexMetrikaId
    }
  }
});
