import type { MotivationBlock } from '~/composables/useMockData';

export type TaskStatus = 'pool' | 'active' | 'completed' | 'cancelled';

export type Task = {
  id: number;
  title: string;
  motivation_block: MotivationBlock;
  reward_amount: number;
  deadline: string;
  difficulty: 'easy' | 'medium' | 'hard';
  status: TaskStatus;
  assignee_id?: number;
  taken_at?: string;
  completed_at?: string;
};

const STORAGE_KEY = 'vbi-tasks-state';

const defaultTasks: Task[] = [
  {
    id: 1,
    title: 'Провести внутренний митап по best practices',
    motivation_block: 'personal_brand',
    reward_amount: 300,
    deadline: '2026-05-25',
    difficulty: 'medium',
    status: 'active',
    assignee_id: 1,
    taken_at: '2026-05-10'
  },
  {
    id: 2,
    title: 'Оптимизировать weekly-отчет команды',
    motivation_block: 'more_free_time',
    reward_amount: 260,
    deadline: '2026-05-18',
    difficulty: 'easy',
    status: 'completed',
    assignee_id: 1,
    taken_at: '2026-04-28',
    completed_at: '2026-05-12'
  },
  {
    id: 3,
    title: 'Завершить курс по leadership',
    motivation_block: 'learning',
    reward_amount: 250,
    deadline: '2026-05-29',
    difficulty: 'medium',
    status: 'pool'
  },
  {
    id: 4,
    title: 'Протестировать новую гипотезу роста',
    motivation_block: 'new_interesting',
    reward_amount: 340,
    deadline: '2026-06-02',
    difficulty: 'hard',
    status: 'pool'
  },
  {
    id: 5,
    title: 'Подготовить кейс для внутреннего блога',
    motivation_block: 'personal_brand',
    reward_amount: 220,
    deadline: '2026-06-08',
    difficulty: 'easy',
    status: 'pool'
  },
  {
    id: 6,
    title: 'Автоматизировать еженедельный отчет KPI',
    motivation_block: 'more_money',
    reward_amount: 380,
    deadline: '2026-06-15',
    difficulty: 'hard',
    status: 'pool'
  },
  {
    id: 7,
    title: 'Согласовать план развития на квартал',
    motivation_block: 'learning',
    reward_amount: 200,
    deadline: '2026-04-20',
    difficulty: 'medium',
    status: 'cancelled',
    assignee_id: 1,
    taken_at: '2026-04-01'
  }
];

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

export function useTasks() {
  const { user } = useAuth();
  const tasks = useState<Task[]>('vbi-tasks', () => structuredClone(defaultTasks));
  const hydrated = useState<boolean>('vbi-tasks-hydrated', () => false);

  const persist = () => {
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.value));
  };

  const hydrate = () => {
    if (!import.meta.client || hydrated.value) return;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        tasks.value = JSON.parse(raw) as Task[];
      } catch {
        tasks.value = structuredClone(defaultTasks);
      }
    }

    hydrated.value = true;
  };

  const poolTasks = computed(() => tasks.value.filter((task) => task.status === 'pool'));

  const myTasks = computed(() => {
    const userId = user.value?.id;
    if (!userId) return [];
    return tasks.value.filter((task) => task.assignee_id === userId && task.status !== 'pool');
  });

  const myActiveTasks = computed(() => myTasks.value.filter((task) => task.status === 'active'));

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
    hydrate,
    takeTask,
    completeTask,
    filterByMotivation,
    filterByStatus,
    taskStatusLabels,
    motivationLabels,
    difficultyLabels
  };
}
