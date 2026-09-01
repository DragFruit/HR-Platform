/** Слот правого нижнего угла: один оверлей поверх страницы. */

const SLOT_KEY = 'vbi-bottom-right-slot';

export const BOTTOM_RIGHT_SLOT = {
  postVacationMemo: 'post-vacation-memo'
} as const;

export function useBottomRightSlot() {
  const occupants = useState<string[]>(SLOT_KEY, () => []);

  const isOccupied = computed(() => occupants.value.length > 0);

  const claim = (id: string) => {
    if (!id || occupants.value.includes(id)) return;
    occupants.value = [...occupants.value, id];
  };

  const release = (id: string) => {
    if (!occupants.value.includes(id)) return;
    occupants.value = occupants.value.filter((item) => item !== id);
  };

  return { occupants, isOccupied, claim, release };
}
