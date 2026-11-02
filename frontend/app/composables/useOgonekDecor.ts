/**
 * Новогодний декор платформы «Огонёк 2027».
 *
 * Выключателя в настройках нет: декор включается вилкой из окна 4 и гаснет,
 * когда вилку вынули (спека, раздел 4). Поэтому состояние живёт на сервере,
 * а не в localStorage — иначе на другом устройстве человек снова получил бы
 * мигающую гирлянду, которую только что выключил.
 *
 * Декор ничего не считает и не перехватывает клики: это только внешний вид.
 */

import { OGONEK_OBJECTS } from '~/events/ogonek/sprites';
import { ogonekSpriteUrl } from '~/utils/ogonekRender';

export type OgonekDecorState = {
  seasonOn: boolean;
  plugged: boolean;
  hat: boolean;
  /** Авторские снежинки: подмешиваются в снегопад с 16 декабря. */
  authorFlakes: string[][];
};

export function useOgonekDecor() {
  const state = useState<OgonekDecorState>('ogonek-decor', () => ({
    seasonOn: false,
    plugged: false,
    hat: false,
    authorFlakes: []
  }));
  const loaded = useState<boolean>('ogonek-decor-loaded', () => false);

  /**
   * На сервере всегда false: иначе разметка с декором приедет в HTML
   * и моргнёт у того, у кого вилка вынута.
   */
  const enabled = computed(() => loaded.value && state.value.seasonOn && state.value.plugged);
  const hatEnabled = computed(() => loaded.value && state.value.seasonOn && state.value.hat);

  const motionAllowed = computed(() => {
    if (!enabled.value || !import.meta.client) return false;
    try {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return true;
    }
  });

  async function refresh() {
    if (!import.meta.client) return;
    try {
      state.value = await $fetch<OgonekDecorState>('/api/event/ogonek/decor');
    } catch {
      // Гость или сеть отвалилась — декора просто нет, это не ошибка экрана.
      state.value = { seasonOn: false, plugged: false, hat: false, authorFlakes: [] };
    } finally {
      loaded.value = true;
    }
  }

  /** Локальное обновление после щелчка вилкой — без второго запроса. */
  function setPlugged(on: boolean) {
    state.value = { ...state.value, plugged: on };
  }

  function setHat(on: boolean) {
    state.value = { ...state.value, hat: on };
  }

  if (import.meta.client) {
    watchEffect(() => {
      // Колпак — пиксельный спрайт, а не файл в public: кладём его картинку
      // в CSS-переменную, стили берут её оттуда.
      if (hatEnabled.value) {
        const url = ogonekSpriteUrl(OGONEK_OBJECTS.hat);
        if (url) document.documentElement.style.setProperty('--og-hat', `url(${url})`);
      } else {
        document.documentElement.style.removeProperty('--og-hat');
      }
      document.documentElement.classList.toggle('ogonek', enabled.value);
      document.documentElement.classList.toggle('ogonek-motion', motionAllowed.value);
      document.documentElement.classList.toggle('ogonek-hat', hatEnabled.value);
    });
  }

  return { state, enabled, hatEnabled, motionAllowed, refresh, setPlugged, setHat };
}
