export type VacationTrainingStepId =
  | 'balance'
  | 'projection'
  | 'manage-request'
  | 'reservation-book'
  | 'reservation-clarify'
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
  action?: 'acknowledge' | 'calendar-range' | 'create-request' | 'create-reservation';
};

/** Декабрь в учебном квесте брони (month 1–12) */
export const VACATION_TRAINING_RESERVATION_MONTH = 12;

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
    title: 'Баланс',
    text: 'Здесь видно, сколько дней отпуска доступно прямо сейчас. Руководитель ориентируется на эти цифры при согласовании.',
    kind: 'none',
    action: 'acknowledge'
  },
  {
    id: 'projection',
    target: 'vac-projection',
    title: 'Расчёт к дате',
    text: 'Раскройте блок и выберите дату — система покажет, сколько дней отпуска будет доступно к этому дню. Удобно, если отпуск планируете заранее.',
    kind: 'underline',
    action: 'acknowledge'
  },
  {
    id: 'manage-request',
    target: 'vac-my-requests',
    title: 'Редактирование заявки',
    text: 'В блоке «Мои заявки» у заявки есть кнопка «⋯»: можно изменить даты или удалить заявку, пока отпуск ещё не начался. У отгуленного отпуска эти функции недоступны.',
    kind: 'underline',
    action: 'acknowledge'
  },
  {
    id: 'reservation-book',
    target: 'vac-reservation-dec',
    title: 'Предварительная бронь',
    text: 'Эту бронь можно поставить, когда точные даты отпуска ещё неизвестны, но с месяцем уже определились. Такие брони не вычитаются из доступных дней — это пометка для себя и команды.\n\nДля создания брони нажмите «+бронь». Она учебная и удалится после завершения квеста.',
    kind: 'circle',
    action: 'create-reservation'
  },
  {
    id: 'reservation-clarify',
    target: 'vac-reservations-block',
    title: 'Создать заявку',
    text: 'Когда даты станут ясны, нажмите «Создать заявку» — бронь превратится в обычную заявку на отпуск. Учебная бронь исчезнет после завершения квеста.',
    kind: 'underline',
    action: 'acknowledge'
  },
  {
    id: 'calendar',
    target: 'vac-calendar',
    title: 'Календарь',
    text: 'Кликните день начала отпуска, затем день окончания — даты подставятся в форму автоматически.',
    kind: 'none',
    action: 'calendar-range'
  },
  {
    id: 'create',
    target: 'vac-create-form',
    title: 'Заявка',
    text: 'Проверьте даты и нажмите «Создать заявку». Это учебная заявка — руководитель её не увидит.',
    kind: 'underline',
    action: 'create-request'
  },
  {
    id: 'warnings',
    target: null,
    title: 'Предупреждения',
    text: '',
    kind: 'none',
    action: 'acknowledge'
  },
  {
    id: 'requests',
    target: 'vac-my-requests',
    title: 'Мои заявки',
    text: 'Здесь отражаются все заявки и их статусы. Учебная заявка из квеста помечена отдельной плашкой.',
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
    title: 'Согласование',
    text: 'Откройте вкладку «Согласование»: здесь вы подтверждаете или отклоняете заявки сотрудников.',
    action: 'open-approval-tab'
  },
  {
    id: 'warnings',
    target: null,
    title: 'Плашки-предупреждения',
    text: 'Плашки в очереди помогают принять решение быстрее: видно риски по остаткам, пересечениям и этапам.',
    action: 'acknowledge'
  },
  {
    id: 'calendar-view',
    target: 'vac-calendar-view-toggle',
    title: 'Виды календаря',
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

