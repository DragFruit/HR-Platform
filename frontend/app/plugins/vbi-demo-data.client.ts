/** Сброс устаревших localStorage и ранняя загрузка справочника отпусков */
const DEMO_PLATFORM_VERSION = '4';
const VERSION_KEY = 'vbi-platform-demo-version';

const LEGACY_STORAGE_KEYS = [
  'vbi-employees',
  'vbi-employees-v2',
  'vbi-employees-v3',
  'vbi-vacations-state',
  'vbi-vacations-state-v2',
  'vbi-vacations-state-v3',
  'vbi-org-structure-v2'
];

export default defineNuxtPlugin(() => {
  if (localStorage.getItem(VERSION_KEY) !== DEMO_PLATFORM_VERSION) {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(VERSION_KEY, DEMO_PLATFORM_VERSION);
    useState<boolean>('vbi-employees-hydrated').value = false;
    useState<boolean>('vbi-vacations-hydrated').value = false;
  }

  useEmployees().hydrate();
  useVacations().hydrate();
  useOrgStructure().hydrate();
});
