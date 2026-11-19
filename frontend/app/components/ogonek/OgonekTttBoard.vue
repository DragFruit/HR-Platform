<template>
  <div class="ttt" :class="{ 'is-locked': !canPlay }" role="grid" aria-label="Доска ultimate-крестиков-ноликов">
    <div
      v-for="big in 9"
      :key="big"
      class="ttt__small"
      :class="{
        'is-active': canPlay && activeBoards.has(big - 1),
        'is-won': !!state.smallResults[big - 1],
        [`is-${(state.smallResults[big - 1] ?? '').toLowerCase()}`]: !!state.smallResults[big - 1]
      }"
    >
      <button
        v-for="small in 9"
        :key="small"
        type="button"
        class="ttt__cell"
        :class="{
          [`is-${(state.smallBoards[big - 1]![small - 1] ?? '').toLowerCase()}`]: !!state.smallBoards[big - 1]![small - 1],
          'is-last': lastMove && lastMove.big === big - 1 && lastMove.small === small - 1
        }"
        :disabled="!canPlay || !legal.has(`${big - 1}:${small - 1}`)"
        :aria-label="cellLabel(big - 1, small - 1)"
        @click="$emit('move', { big: big - 1, small: small - 1 })"
      >
        {{ state.smallBoards[big - 1]![small - 1] ?? '' }}
      </button>
      <span v-if="state.smallResults[big - 1]" class="ttt__mark" aria-hidden="true">
        {{ state.smallResults[big - 1] === 'draw' ? '=' : state.smallResults[big - 1] }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Доска ultimate-крестиков-ноликов: 9 маленьких полей 3×3. Поля, куда сейчас
 * можно ходить, подсвечены; выигранное поле закрыто крупным символом.
 */
import { tttLegalMoves, type TttMove, type TttState } from '~/events/ogonek/ttt/engine';

const props = defineProps<{ state: TttState; canPlay: boolean; lastMove?: TttMove | null }>();
defineEmits<{ move: [m: TttMove] }>();

const moves = computed(() => tttLegalMoves(props.state));
const legal = computed(() => new Set(moves.value.map((m) => `${m.big}:${m.small}`)));
const activeBoards = computed(() => new Set(moves.value.map((m) => m.big)));

function cellLabel(big: number, small: number) {
  const v = props.state.smallBoards[big]![small];
  return `Поле ${big + 1}, клетка ${small + 1}${v ? `: ${v}` : ''}`;
}
</script>

<style scoped>
.ttt {
  --x: #ff6b6b;
  --o: #7ad8cf;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  width: min(100%, 540px);
  aspect-ratio: 1;
  padding: 8px;
  background: rgba(30, 12, 14, 0.55);
  box-shadow: 6px 6px 0 var(--og-shade, #1c0307);
}

.ttt__small {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.04);
  outline: 2px solid transparent;
  transition: outline-color 0.15s ease, background-color 0.15s ease;
}
.ttt__small.is-active { outline-color: var(--og-gold, #ffcf4a); background: rgba(255, 207, 74, 0.1); }

.ttt__cell {
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: var(--og-paper, #f3efe9);
  font-family: var(--og-pixel);
  font-size: clamp(10px, 2.2vw, 18px);
  line-height: 1;
  color: #2a1216;
  cursor: pointer;
}
.ttt__cell:disabled { cursor: default; }
.ttt__small.is-active .ttt__cell:not(:disabled):hover { background: #fff6d6; }
.ttt__cell.is-x { color: #c4302b; }
.ttt__cell.is-o { color: #1f7a73; }
.ttt__cell.is-last { box-shadow: inset 0 0 0 3px var(--og-gold, #ffcf4a); }

.ttt__small.is-won .ttt__cell { opacity: 0.35; }
.ttt__mark {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--og-pixel);
  font-size: clamp(36px, 9vw, 84px);
  pointer-events: none;
  text-shadow: 4px 4px 0 rgba(0, 0, 0, 0.35);
}
.ttt__small.is-x .ttt__mark { color: var(--x); }
.ttt__small.is-o .ttt__mark { color: var(--o); }
.ttt__small.is-draw .ttt__mark { color: #d8c39b; }

.ttt.is-locked .ttt__cell { cursor: default; }
</style>
