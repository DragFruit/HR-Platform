/**
 * Новогодний декор платформы «Огонёк 2027».
 *
 * Выключателя в настройках нет: декор включается вилкой из окна 1 и гаснет,
 * когда вилку вынули (спека, раздел 4). Поэтому состояние живёт на сервере,
 * а не в localStorage — иначе на другом устройстве человек снова получил бы
 * мигающую гирлянду, которую только что выключил.
 *
 * Декор ничего не считает и не перехватывает клики: это только внешний вид.
 */

import { OGONEK_AVATAR_HAT } from '~/events/ogonek/avatarHat';
import { ogonekSpriteUrl } from '~/utils/ogonekRender';

export type OgonekDecorState = {
  seasonOn: boolean;
  plugged: boolean;
  hat: boolean;
  /** Вилку хоть раз втыкали: отличаем «ещё не дошёл до окна 1» от «вынул сам». */
  everPlugged: boolean;
  /** Кто надел колпак в окне 3: он рисуется только на их аватарках. */
  hatUserIds: number[];
  /** Авторские снежинки: подмешиваются в снегопад с 16 декабря. */
  authorFlakes: string[][];
};

/**
 * `effects: false` — только читать состояние (так зовёт каждая аватарка):
 * без наблюдателя за классами на <html>, иначе их было бы по одному на
 * каждую аватарку на странице.
 */
export function useOgonekDecor(opts: { effects?: boolean } = {}) {
  const effects = opts.effects ?? true;
  const state = useState<OgonekDecorState>('ogonek-decor', () => ({
    seasonOn: false,
    plugged: false,
    hat: false,
    everPlugged: false,
    hatUserIds: [],
    authorFlakes: []
  }));
  const loaded = useState<boolean>('ogonek-decor-loaded', () => false);

  /**
   * На сервере всегда false: иначе разметка с декором приедет в HTML
   * и моргнёт у того, у кого вилка вынута.
   */
  const enabled = computed(() => loaded.value && state.value.seasonOn && state.value.plugged);

  /**
   * Человек сам вынул вилку. Тогда гаснет всё новогоднее: и декор платформы,
   * и снег над календарём, и колпак на аватарке. Кто до окна 1 ещё не дошёл,
   * вилку не вынимал: у него снег над календарём идёт с 1 декабря, как в спеке.
   */
  const pulledOut = computed(() => state.value.everPlugged && !state.value.plugged);
  const festive = computed(() => loaded.value && state.value.seasonOn && !pulledOut.value);
  const hatEnabled = computed(() => festive.value && state.value.hat);

  /** На этой аватарке колпак: её владелец надел его, а у смотрящего декор не выключен. */
  const hatOn = (userId: number | null | undefined) =>
    Boolean(userId) && festive.value && state.value.hatUserIds.includes(Number(userId));

  /** Снег: с 1 декабря, без вилки, пока человек её не вынул и не просил меньше движения. */
  const snowAllowed = computed(() => {
    if (!festive.value || !import.meta.client) return false;
    try {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return true;
    }
  });

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
      state.value = { seasonOn: false, plugged: false, hat: false, everPlugged: false, hatUserIds: [], authorFlakes: [] };
    } finally {
      loaded.value = true;
    }
  }

  /** Локальное обновление после щелчка вилкой — без второго запроса. */
  function setPlugged(on: boolean) {
    state.value = {
      ...state.value,
      plugged: on,
      everPlugged: state.value.everPlugged || on
    };
  }

  function setHat(on: boolean, userId?: number) {
    const ids = state.value.hatUserIds.filter((id) => id !== userId);
    state.value = {
      ...state.value,
      hat: on,
      hatUserIds: on && userId ? [...ids, userId] : ids
    };
  }

  if (import.meta.client && effects) {
    watchEffect(() => {
      // Колпак — пиксельный спрайт, а не файл в public: кладём его картинку
      // в CSS-переменную, стили берут её оттуда.
      // Картинку колпака держим всегда, когда идёт сезон: аватарка сама
      // решает, надет ли он на её владельца.
      if (festive.value) {
        const url = ogonekSpriteUrl(OGONEK_AVATAR_HAT);
        if (url) document.documentElement.style.setProperty('--og-hat', `url(${url})`);
      } else {
        document.documentElement.style.removeProperty('--og-hat');
      }
      document.documentElement.classList.toggle('ogonek', enabled.value);
      document.documentElement.classList.toggle('ogonek-motion', motionAllowed.value);
    });
  }

  return { state, enabled, festive, snowAllowed, hatEnabled, hatOn, motionAllowed, refresh, setPlugged, setHat };
}
