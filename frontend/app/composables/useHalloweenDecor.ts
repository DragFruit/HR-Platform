/**
 * Хеллоуинский декор платформы: 28 октября — 6 ноября 2026 включительно.
 *
 * Украшения только меняют внешний вид. Они ничего не считают, не двигают
 * геометрию и не перехватывают клики: график отпусков это рабочий инструмент
 * и единственный раздел, открытый на бою.
 *
 * Вне окна композабл возвращает false, и ни один декоративный слой не
 * монтируется. Человек может выключить декор для себя: ключ
 * `vbi-halloween-decor` = `off`. Значение `force` включает декор вне окна —
 * нужно, чтобы прогонять оформление на стейдже до начала сезона.
 */

export const HALLOWEEN_DECOR_FROM = '2026-10-28T00:00:00+03:00';
export const HALLOWEEN_DECOR_UNTIL = '2026-11-07T00:00:00+03:00';

const DECOR_PREF_KEY = 'vbi-halloween-decor';

type DecorPref = 'on' | 'off' | 'force';

function readPref(): DecorPref {
  if (!import.meta.client) return 'on';
  try {
    const raw = localStorage.getItem(DECOR_PREF_KEY);
    return raw === 'off' || raw === 'force' ? raw : 'on';
  } catch {
    return 'on';
  }
}

export function isHalloweenSeason(now: Date = new Date()): boolean {
  const ms = now.getTime();
  return ms >= Date.parse(HALLOWEEN_DECOR_FROM) && ms < Date.parse(HALLOWEEN_DECOR_UNTIL);
}

export function useHalloweenDecor() {
  const pref = useState<DecorPref>('halloween-decor-pref', () => 'on');
  const hydrated = useState<boolean>('halloween-decor-hydrated', () => false);
  const { isProduction } = useAppEnv();

  /**
   * На сервере всегда false: иначе разметка с декором приедет в HTML и
   * моргнёт у того, кто декор выключил.
   */
  const enabled = computed(() => {
    if (!hydrated.value) return false;
    if (pref.value === 'off') return false;
    if (pref.value === 'force') return true;
    // Даты держим только на бою. Стейдж и локалка показывают декор всегда —
    // иначе его нельзя отлаживать до начала сезона.
    if (!isProduction.value) return true;
    return isHalloweenSeason();
  });

  /** Движение (призраки) — только если человек не просил его убрать. */
  const motionAllowed = computed(() => {
    if (!enabled.value || !import.meta.client) return false;
    try {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return true;
    }
  });

  const setEnabled = (on: boolean) => {
    pref.value = on ? 'on' : 'off';
    if (!import.meta.client) return;
    try {
      localStorage.setItem(DECOR_PREF_KEY, on ? 'on' : 'off');
    } catch {
      /* приватный режим — настройка не переживёт перезагрузку */
    }
  };

  /*
   * Класс на <html> — чтобы оформление вешалось стилями и ни один рабочий
   * компонент не пришлось трогать. Снимается сам, когда декор выключен или
   * сезон кончился.
   */
  if (import.meta.client) {
    watchEffect(() => {
      document.documentElement.classList.toggle('halloween', enabled.value);
      document.documentElement.classList.toggle('halloween-motion', motionAllowed.value);
    });
  }

  onMounted(() => {
    if (hydrated.value) return;
    pref.value = readPref();
    hydrated.value = true;
  });

  return { enabled, motionAllowed, setEnabled, pref };
}
