/** Миграция localStorage при смене версии платформы */
const DEMO_PLATFORM_VERSION = '5';
const VERSION_KEY = 'vbi-platform-demo-version';

const LEGACY_STORAGE_KEYS = [
  'vbi-employees',
  'vbi-employees-v2',
  'vbi-employees-v3',
  'vbi-vacations-state',
  'vbi-vacations-state-v2',
  'vbi-vacations-state-v3',
  'vbi-org-structure-v1',
  'vbi-org-structure-v2',
  'vbi-tasks-state',
  'vbi-wallet-state-v1'
];

export default defineNuxtPlugin(() => {
  if (localStorage.getItem(VERSION_KEY) !== DEMO_PLATFORM_VERSION) {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(VERSION_KEY, DEMO_PLATFORM_VERSION);
    useState<boolean>('vbi-employees-hydrated').value = false;
    useState<boolean>('vbi-vacations-hydrated').value = false;
    useState<boolean>('vbi-tasks-hydrated').value = false;
    useState<boolean>('vbi-org-hydrated').value = false;
    useState<boolean>('vbi-wallet-hydrated').value = false;
    useState<unknown[]>('vbi-employees').value = [];
    useState<unknown[]>('vbi-tasks').value = [];
  }

  useEmployees().hydrate();
  useVacations().hydrate();
  useOrgStructure().hydrate();
  useTasks().hydrate();
  useWallet().hydrateWallets();
});
