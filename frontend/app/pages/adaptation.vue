<template>
  <section class="page-hero creative-hero">
    <div>
      <p class="eyebrow">Адаптация новых сотрудников</p>
      <h2>Запусти onboarding-трек за 10 минут</h2>
      <p class="muted">
        Настрой направления, назначь buddy и отслеживай прогресс адаптации в одном ярком рабочем пространстве.
      </p>
      <div class="hero-actions">
        <button class="button primary">Создать трек</button>
        <button class="button ghost">Шаблоны HR</button>
      </div>
    </div>
    <div class="hero-illus" aria-hidden="true">
      <div class="blob blob-a" />
      <div class="blob blob-b" />
      <span class="illus-emoji">🚀</span>
    </div>
  </section>

  <section class="card section-card">
    <div class="section-head">
      <h3>Выберите направления адаптации</h3>
      <p class="muted">Включите блоки, которые важны для роли новичка. За каждый блок — внутренняя валюта.</p>
    </div>

    <div class="direction-grid">
      <article
        v-for="direction in directions"
        :key="direction.id"
        class="direction-card"
        :class="{ active: direction.enabled }"
      >
        <label class="toggle-wrap">
          <input v-model="direction.enabled" type="checkbox" class="toggle-input" />
          <span class="toggle-ui" />
        </label>
        <h4>{{ direction.title }}</h4>
        <p class="muted">{{ direction.description }}</p>
        <div class="direction-footer">
          <span class="illus-mini">{{ direction.illustration }}</span>
          <span class="reward-pill">+{{ direction.reward }}</span>
        </div>
      </article>

      <button class="direction-card add-card" type="button">
        <span class="add-icon">+</span>
        <span>Добавить направление</span>
      </button>
    </div>
  </section>

  <section class="card section-card">
    <div class="section-head">
      <h3>Как подбирать коллег и buddy?</h3>
      <p class="muted">Выберите модель подбора наставника и диапазон коллег для знакомства.</p>
    </div>

    <div class="mode-grid">
      <button
        class="mode-card"
        :class="{ active: buddyMode === 'auto' }"
        type="button"
        @click="buddyMode = 'auto'"
      >
        <span class="mode-illus">🤖</span>
        <div>
          <strong>Автоматически</strong>
          <p class="muted">Система предложит buddy по роли и загрузке</p>
        </div>
      </button>

      <button
        class="mode-card"
        :class="{ active: buddyMode === 'manager_review' }"
        type="button"
        @click="buddyMode = 'manager_review'"
      >
        <span class="mode-illus">👥</span>
        <div>
          <strong>С согласованием руководителя</strong>
          <p class="muted">Список коллег отправляется менеджеру на проверку</p>
          <div class="inline-controls">
            <label>
              От
              <input v-model.number="colleaguesFrom" type="number" min="1" max="10" />
            </label>
            <label>
              До
              <input v-model.number="colleaguesTo" type="number" min="1" max="10" />
            </label>
          </div>
          <label class="check-row">
            <input type="checkbox" checked />
            <span>Отправить список коллег на согласование руководителю</span>
          </label>
        </div>
      </button>
    </div>
  </section>

  <section class="grid-two">
    <article class="card section-card">
      <h3 class="section-title">Трек адаптации (30 дней)</h3>
      <ul class="timeline list-reset">
        <li v-for="step in steps" :key="step.id" class="timeline-item" :class="step.status">
          <div class="timeline-dot" />
          <div>
            <strong>{{ step.title }}</strong>
            <p class="muted">День {{ step.due_day }} · {{ ownerLabels[step.owner] }}</p>
          </div>
          <span class="status-chip" :class="step.status">{{ statusLabels[step.status] }}</span>
        </li>
      </ul>
    </article>

    <article class="card section-card">
      <h3 class="section-title">Новые сотрудники</h3>
      <ul class="list-reset newcomer-list">
        <li v-for="person in newcomers" :key="person.id" class="newcomer-card">
          <div class="row">
            <strong>{{ person.name }}</strong>
            <span class="tag learning">{{ person.progress }}%</span>
          </div>
          <p class="muted">{{ person.role }} · старт {{ person.start_date }}</p>
          <p class="soft">Buddy: {{ person.buddy }}</p>
          <div class="progress"><span :style="{ width: `${person.progress}%` }" /></div>
        </li>
      </ul>
    </article>
  </section>

</template>

<script setup lang="ts">
const {
  directions,
  steps,
  newcomers,
  buddyMode,
  colleaguesFrom,
  colleaguesTo
} = useAdaptationData();

const ownerLabels = {
  employee: 'Сотрудник',
  manager: 'Руководитель',
  buddy: 'Buddy'
};

const statusLabels = {
  done: 'Готово',
  active: 'В работе',
  pending: 'Скоро'
};
</script>
