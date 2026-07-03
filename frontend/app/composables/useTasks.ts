import type { MotivationBlock } from '~/composables/useMockData';

export type TaskStatus = 'pool' | 'active' | 'completed' | 'cancelled';

export type TaskKind = 'standard' | 'hr_knowledge_quiz';

export const HR_KNOWLEDGE_TASK_ID = 9001;

export type Task = {
  id: number;
  title: string;
  motivation_block: MotivationBlock;
  reward_amount: number;
  deadline: string;
  difficulty: 'easy' | 'medium' | 'hard';
  status: TaskStatus;
  task_kind?: TaskKind;
  assignee_id?: number;
  taken_at?: string;
  completed_at?: string;
};

const DEFAULT_HR_KNOWLEDGE_TASK: Task = {
  id: HR_KNOWLEDGE_TASK_ID,
  title: 'Тест на оценку HR-знаний',
  motivation_block: 'learning',
  reward_amount: 150,
  deadline: '2026-12-31',
  difficulty: 'medium',
  status: 'pool',
  task_kind: 'hr_knowledge_quiz'
};

const STORAGE_KEY = 'vbi-tasks-state';

export const taskStatusLabels: Record<TaskStatus, string> = {
  pool: 'Доступна',
  active: 'В работе',
  completed: 'Завершена',
  cancelled: 'Отменена'
};

export const motivationLabels: Record<MotivationBlock, string> = {
  personal_brand: 'Личный бренд',
  more_money: 'Деньги',
  more_free_time: 'Свободное время',
  new_interesting: 'Новое',
  learning: 'Обучение'
};

const difficultyLabels = {
  easy: 'Лёгкая',
  medium: 'Средняя',
  hard: 'Сложная'
} as const;

export type NewTaskInput = {
  title: string;
  motivation_block: MotivationBlock;
  reward_amount: number;
  deadline: string;
  difficulty: Task['difficulty'];
};

export function useTasks() {
  const { user } = useAuth();
  const { creditUser } = useWallet();
  const tasks = useState<Task[]>('vbi-tasks', () => []);
  const hydrated = useState<boolean>('vbi-tasks-hydrated', () => false);

  const persist = () => {
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.value));
  };

  const ensureHrKnowledgeTask = () => {
    const existing = tasks.value.find((t) => t.id === HR_KNOWLEDGE_TASK_ID);
    if (!existing) {
      tasks.value.push({ ...DEFAULT_HR_KNOWLEDGE_TASK });
      persist();
      return;
    }
    if (!existing.task_kind) {
      existing.task_kind = 'hr_knowledge_quiz';
      persist();
    }
  };

  const isHrKnowledgeTask = (task: Task) =>
    task.task_kind === 'hr_knowledge_quiz' ||
    task.id === HR_KNOWLEDGE_TASK_ID ||
    task.title.trim().toLowerCase() === DEFAULT_HR_KNOWLEDGE_TASK.title.trim().toLowerCase();

  const hydrate = () => {
    if (!import.meta.client || hydrated.value) return;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        tasks.value = JSON.parse(raw) as Task[];
      } catch {
        tasks.value = [];
      }
    }

    ensureHrKnowledgeTask();
    hydrated.value = true;
  };

  const poolTasks = computed(() => tasks.value.filter((task) => task.status === 'pool'));

  const myTasks = computed(() => {
    const userId = user.value?.id;
    if (!userId) return [];
    return tasks.value.filter((task) => task.assignee_id === userId && task.status !== 'pool');
  });

  const myActiveTasks = computed(() => myTasks.value.filter((task) => task.status === 'active'));

  const completedCount = computed(() => tasks.value.filter((t) => t.status === 'completed').length);

  const addTask = (input: NewTaskInput) => {
    const nextId = Math.max(0, ...tasks.value.map((t) => t.id)) + 1;
    tasks.value.push({
      id: nextId,
      title: input.title.trim(),
      motivation_block: input.motivation_block,
      reward_amount: input.reward_amount,
      deadline: input.deadline,
      difficulty: input.difficulty,
      status: 'pool'
    });
    persist();
    return nextId;
  };

  const takeTask = (taskId: number) => {
    const userId = user.value?.id;
    if (!userId) return false;

    const task = tasks.value.find((item) => item.id === taskId && item.status === 'pool');
    if (!task) return false;

    task.status = 'active';
    task.assignee_id = userId;
    task.taken_at = new Date().toISOString().slice(0, 10);
    persist();
    return true;
  };

  const completeTask = (taskId: number) => {
    const userId = user.value?.id;
    if (!userId) return false;

    const task = tasks.value.find(
      (item) => item.id === taskId && item.assignee_id === userId && item.status === 'active'
    );
    if (!task) return false;

    task.status = 'completed';
    task.completed_at = new Date().toISOString().slice(0, 10);
    creditUser(userId, task.reward_amount, `Награда за задачу: ${task.title}`);
    persist();
    return true;
  };

  const filterByMotivation = (list: Task[], block: 'all' | MotivationBlock) =>
    block === 'all' ? list : list.filter((task) => task.motivation_block === block);

  const filterByStatus = (list: Task[], status: 'all' | TaskStatus) =>
    status === 'all' ? list : list.filter((task) => task.status === status);

  return {
    tasks,
    poolTasks,
    myTasks,
    myActiveTasks,
    completedCount,
    hydrate,
    addTask,
    takeTask,
    completeTask,
    filterByMotivation,
    filterByStatus,
    isHrKnowledgeTask,
    HR_KNOWLEDGE_TASK_ID,
    taskStatusLabels,
    motivationLabels,
    difficultyLabels
  };
}
