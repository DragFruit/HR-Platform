export type AdaptationDirection = {
  id: string;
  title: string;
  description: string;
  illustration: string;
  enabled: boolean;
  reward: number;
};

export type AdaptationStep = {
  id: number;
  title: string;
  due_day: number;
  status: 'done' | 'active' | 'pending';
  owner: 'employee' | 'manager' | 'buddy';
};

export type NewEmployee = {
  id: number;
  name: string;
  role: string;
  start_date: string;
  progress: number;
  buddy: string;
};

const directions = ref<AdaptationDirection[]>([
  {
    id: 'intro',
    title: 'Знакомство с компанией',
    description: 'Миссия, ценности, оргструктура и ключевые процессы',
    illustration: '🏢',
    enabled: true,
    reward: 120
  },
  {
    id: 'tools',
    title: 'Рабочие инструменты',
    description: 'Доступы, почта, CRM, внутренние сервисы и безопасность',
    illustration: '💻',
    enabled: true,
    reward: 150
  },
  {
    id: 'team',
    title: 'Команда и наставник',
    description: '1:1 с руководителем, buddy-программа, карта стейкхолдеров',
    illustration: '🤝',
    enabled: true,
    reward: 180
  },
  {
    id: 'goals',
    title: 'Цели на испытательный срок',
    description: 'KPI на 30/60/90 дней и план развития',
    illustration: '🎯',
    enabled: false,
    reward: 200
  }
]);

const steps: AdaptationStep[] = [
  { id: 1, title: 'Welcome-сессия и welcome-pack', due_day: 1, status: 'done', owner: 'manager' },
  { id: 2, title: 'Настройка рабочего места и доступов', due_day: 2, status: 'done', owner: 'employee' },
  { id: 3, title: 'Встреча с buddy и командой', due_day: 5, status: 'active', owner: 'buddy' },
  { id: 4, title: 'Первый мини-проект с обратной связью', due_day: 14, status: 'pending', owner: 'manager' },
  { id: 5, title: 'Ретро адаптации и план роста', due_day: 30, status: 'pending', owner: 'manager' }
];

const newcomers: NewEmployee[] = [
  {
    id: 1,
    name: 'Алина К.',
    role: 'Product Analyst',
    start_date: '2026-04-14',
    progress: 62,
    buddy: 'Стас'
  },
  {
    id: 2,
    name: 'Игорь М.',
    role: 'Backend Developer',
    start_date: '2026-04-21',
    progress: 18,
    buddy: 'Мария'
  }
];

export function useAdaptationData() {
  const buddyMode = ref<'auto' | 'manager_review'>('manager_review');
  const colleaguesFrom = ref(2);
  const colleaguesTo = ref(5);

  const enabledDirections = computed(() => directions.value.filter((d) => d.enabled));
  const totalReward = computed(() =>
    enabledDirections.value.reduce((sum, d) => sum + d.reward, 0)
  );

  return {
    directions,
    steps,
    newcomers,
    buddyMode,
    colleaguesFrom,
    colleaguesTo,
    enabledDirections,
    totalReward
  };
}
