<template>
  <section class="nk-ballot" aria-labelledby="nk-ballot-title">
    <header class="nk-ballot__head">
      <h2 id="nk-ballot-title" class="nk-ballot__title">
        Бюллетень · этап {{ stage.id }}, {{ stage.weekday.toLowerCase() }}
      </h2>
      <p class="nk-ballot__sub">
        Ставка этапа: {{ stage.stake }}
        <template v-if="late"> · окно полной ставки закрыто, этап считается догнанным: {{ halfStake }}</template>
      </p>
    </header>

    <div class="nk-ballot__grid" role="radiogroup" aria-label="Подозреваемые">
      <button
        v-for="s in suspects"
        :key="s.id"
        type="button"
        role="radio"
        class="nk-ballot__card"
        :class="{ 'is-on': picked === s.id, 'is-chosen': stage.vote?.suspectId === s.id }"
        :aria-checked="picked === s.id"
        :disabled="locked"
        @click="picked = s.id"
      >
        <img class="nk-ballot__photo" :src="s.photo" :alt="s.name" draggable="false" />
        <span class="nk-ballot__name">{{ s.name }}</span>
        <span class="nk-ballot__role">{{ s.role }}</span>
      </button>
    </div>

    <footer class="nk-ballot__foot">
      <p v-if="stage.vote" class="nk-ballot__note" role="status">
        {{ micro.voteDone }}. Ваш выбор: {{ suspectName(stage.vote.suspectId) }}.
      </p>
      <p v-else-if="closed" class="nk-ballot__note" role="status">
        Голосование закрыто: срок задержания истёк.
      </p>
      <button
        v-else
        type="button"
        class="nk-btn nk-btn--primary"
        :disabled="!picked || pending"
        @click="submit"
      >
        {{ pending ? 'Отправляем...' : micro.voteButton }}
      </button>
      <p v-if="error" class="nk-ballot__error" role="alert">{{ error }}</p>
    </footer>

    <section v-if="showMechanics" class="nk-mech">
      <h3 class="nk-mech__title">{{ mechanics.question }} <span class="nk-mech__stake">+3</span></h3>
      <div v-if="mechanics.answered" class="nk-mech__done" role="status">
        {{ micro.voteRepeat }}. Ваш вариант: №{{ mechanics.answered.optionId }}.
      </div>
      <template v-else>
        <label v-for="o in mechanics.options" :key="o.id" class="nk-mech__opt">
          <input v-model="mechPick" type="radio" :value="o.id" name="nk-mech" />
          <span>{{ o.text }}</span>
        </label>
        <button
          type="button"
          class="nk-btn nk-btn--primary"
          :disabled="!mechPick || mechPending"
          @click="submitMechanics"
        >
          {{ mechPending ? 'Отправляем...' : 'Ответить на вопрос о механике' }}
        </button>
      </template>
    </section>
  </section>
</template>

<script setup lang="ts">
import type { NokturnStageView, NokturnSuspect, NokturnSuspectId } from '~/events/nokturn/types';

const props = defineProps<{
  stage: NokturnStageView;
  suspects: NokturnSuspect[];
  micro: Record<string, string>;
  closed: boolean;
  late: boolean;
  mechanics: {
    question: string;
    options: { id: number; text: string }[];
    answered: { optionId: number; points: number; at: string } | null;
  };
}>();

const emit = defineEmits<{
  vote: [NokturnSuspectId];
  mechanics: [number];
}>();

const picked = ref<NokturnSuspectId | null>(null);
const pending = ref(false);
const error = ref('');
const mechPick = ref<number | null>(null);
const mechPending = ref(false);

const locked = computed(() => Boolean(props.stage.vote) || props.closed);
const halfStake = computed(() => Math.ceil(props.stage.stake / 2));
const showMechanics = computed(() => props.stage.id === 5 && props.stage.open);

const suspectName = (id: string) => props.suspects.find((s) => s.id === id)?.name ?? id;

async function submit() {
  if (!picked.value) return;
  pending.value = true;
  error.value = '';
  try {
    emit('vote', picked.value);
  } finally {
    pending.value = false;
  }
}

async function submitMechanics() {
  if (!mechPick.value) return;
  mechPending.value = true;
  try {
    emit('mechanics', mechPick.value);
  } finally {
    mechPending.value = false;
  }
}

defineExpose({
  setError(msg: string) {
    error.value = msg;
  }
});
</script>
