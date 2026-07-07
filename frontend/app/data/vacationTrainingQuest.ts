export type VacationTrainingStepId =
  | 'balance'
  | 'projection'
  | 'calendar'
  | 'create'
  | 'warnings'
  | 'requests';

export type ManagerVacationTrainingStepId = 'approval' | 'warnings' | 'calendar-view';

export type VacationTrainingHighlightKind = 'outline' | 'underline' | 'circle' | 'none';

export type VacationTrainingStep = {
  id: VacationTrainingStepId;
  /** Значение атрибута data-tour на целевом элементе */
  target: string | null;
  title: string;
  text: string;
  kind: VacationTrainingHighlightKind;
  /** Шаг засчитывается после действия пользователя */
  action?: 'acknowledge' | 'calendar-range' | 'create-request';
};

export type ManagerVacationTrainingStepAction = 'acknowledge' | 'open-approval-tab';

export type ManagerVacationTrainingStep = {
  id: ManagerVacationTrainingStepId;
  target: string | null;
  title: string;
  text: string;
  action?: ManagerVacationTrainingStepAction;
};

export const EMPLOYEE_VACATION_TRAINING_STEPS: VacationTrainingStep[] = [
  {
    id: 'balance',
    target: 'vac-balance',
    title: 'Квест 1 · Баланс',
    text: 'Здесь видно, сколько дней отпуска доступно прямо сейчас. Руководитель ориентируется на эти цифры при согласовании.',
    kind: 'none',
    action: 'acknowledge'
  },
  {
    id: 'projection',
    target: 'vac-projection',
    title: 'Квест 2 · Расчёт к дате',
    text: 'Раскройте блок и выберите дату — система покажет, сколько дней отпуска будет доступно к этому дню. Удобно, если отпуск планируете заранее.',
    kind: 'underline',
    action: 'acknowledge'
  },
  {
    id: 'calendar',
    target: 'vac-calendar',
    title: 'Квест 3 · Календарь',
    text: 'Кликните день начала отпуска, затем день окончания — даты подставятся в форму автоматически.',
    kind: 'none',
    action: 'calendar-range'
  },
  {
    id: 'create',
    target: 'vac-create-form',
    title: 'Квест 4 · Заявка',
    text: 'Проверьте даты и нажмите «Создать заявку». Это учебная заявка — руководитель её не увидит.',
    kind: 'underline',
    action: 'create-request'
  },
  {
    id: 'warnings',
    target: null,
    title: 'Квест 5 · Предупреждения',
    text: '',
    kind: 'none',
    action: 'acknowledge'
  },
  {
    id: 'requests',
    target: 'vac-my-requests',
    title: 'Квест 6 · Мои заявки',
    text: 'Здесь отражаются все заявки и их статусы. Заявку можно отредактировать или удалить.',
    kind: 'none',
    action: 'acknowledge'
  }
];

export const VACATION_TRAINING_REQUEST_STATUS_ITEMS = [
  {
    title: 'Согласован',
    status: 'approved'
  },
  {
    title: 'На согласовании',
    status: 'pending'
  }
] as const;

export const VACATION_TRAINING_ACHIEVEMENT = {
  id: 'kalendar-otpuskov',
  title: 'Календарь отпусков',
  subtitle: 'Пройдено обучение по заявкам на отпуск',
  imageSrc: '/achievements/kalendar-otpuskov.png',
  tier: 1
} as const;

export const VACATION_TRAINING_WARNING_ITEMS = [
  {
    title: 'Не хватает дней',
    badgeClass: 'vac-training-warnings__badge--advance',
    text:
      'Заявку можно подать, но руководитель увидит предупреждение, что дней для отпуска не хватает.'
  },
  {
    title: 'Пересечение',
    badgeClass: 'vac-training-warnings__badge--overlap',
    text: 'На выбранные даты у вас уже есть другой отпуск — система не даст создать второй.'
  },
  {
    title: 'Ошибка дат',
    badgeClass: 'vac-training-warnings__badge--error',
    text: 'Если не заполнены даты или конец раньше начала — заявка не отправится.'
  }
] as const;

export const MANAGER_VACATION_TRAINING_STEPS: ManagerVacationTrainingStep[] = [
  {
    id: 'approval',
    target: 'vac-approval-tab',
    title: 'Квест руководителя 1 · Согласование',
    text: 'Откройте вкладку «Согласование»: здесь вы подтверждаете или отклоняете заявки сотрудников.',
    action: 'open-approval-tab'
  },
  {
    id: 'warnings',
    target: null,
    title: 'Квест руководителя 2 · Плашки-предупреждения',
    text: 'Плашки в очереди помогают принять решение быстрее: видно риски по остаткам, пересечениям и этапам.',
    action: 'acknowledge'
  },
  {
    id: 'calendar-view',
    target: 'vac-calendar-view-toggle',
    title: 'Квест руководителя 3 · Виды календаря',
    text: 'Переключатель «Детально / По месяцам» — попробуйте оба вида. Когда посмотрите, нажмите «Завершить».',
    action: 'acknowledge'
  }
];

export const MANAGER_VACATION_TRAINING_WARNING_ITEMS = [
  {
    id: 'advance',
    title: 'Не хватает дней',
    badgeClass: 'vac-training-warnings__badge--advance',
    text: 'Сотрудник запрашивает отпуск авансом — можно согласовать, но это риск перерасхода баланса.'
  },
  {
    id: 'overlap',
    title: 'Пересечение с коллегами',
    badgeClass: 'vac-training-warnings__badge--overlap',
    text: 'На эти даты есть пересечения в команде — проверьте нагрузку и заменяемость перед согласованием.'
  },
  {
    id: 'next-stage',
    title: 'Следующий этап',
    badgeClass: 'vac-training-warnings__badge--pending',
    text: 'После вашего согласования заявка может уйти на следующий этап (директору отдела).',
    groupLeadsOnly: true
  }
] as const;

