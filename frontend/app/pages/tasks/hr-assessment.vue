<template>
  <section class="creative-hero profile-hero">
    <div>
      <p class="eyebrow">Задачи · обучение</p>
      <h2>Тест на оценку HR-знаний</h2>
      <p class="muted">
        Ответьте на ситуационные вопросы по блокам компетенций — кейсы адаптированы под VBI: digital-агентство,
        ~69 сотрудников, офис в Москве, удалённая команда по России. Баллы попадут в матрицу оценки.
      </p>
    </div>
  </section>

  <section class="card section-card">
    <HrKnowledgeQuiz :task-id="taskId" @cancel="goBack" @done="goBack" />
  </section>
</template>

<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const { hydrate: hydrateTest } = useHrKnowledgeTest();
const { hydrate: hydrateTasks, takeTask, HR_KNOWLEDGE_TASK_ID, tasks } = useTasks();
const { user } = useAuth();

const taskId = computed(() => {
  const raw = route.query.taskId;
  const parsed = typeof raw === 'string' ? Number(raw) : HR_KNOWLEDGE_TASK_ID;
  return Number.isFinite(parsed) ? parsed : HR_KNOWLEDGE_TASK_ID;
});

const goBack = () => {
  router.push('/tasks');
};

onMounted(() => {
  hydrateTasks();
  hydrateTest();

  const id = taskId.value;
  const task = tasks.value.find((t) => t.id === id);
  if (task?.status === 'pool' && user.value?.id) {
    takeTask(id);
  }
});
</script>
