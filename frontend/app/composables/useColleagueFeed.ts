export type ColleagueFeedItemType = 'gift' | 'achievement' | 'task' | 'welcome' | 'vacation' | 'event';

export type ColleagueFeedItem = {
  id: string;
  type: ColleagueFeedItemType;
  text: string;
  time: string;
  icon?: string;
};

const feedIconByType: Record<ColleagueFeedItemType, string> = {
  gift: '🎁',
  achievement: '🏆',
  task: '✅',
  welcome: '👋',
  vacation: '🏖️',
  event: '🎤'
};

const demoFeedItems: ColleagueFeedItem[] = [
  {
    id: 'feed-1',
    type: 'gift',
    text: 'Костя подарил 50 монет Маше — «Спасибо за помощь с релизом!»',
    time: '12 мин назад'
  },
  {
    id: 'feed-2',
    type: 'event',
    text: 'Алина выступила на внутреннем митапе «Как мы строим HR-продукт»',
    time: '1 ч назад'
  },
  {
    id: 'feed-3',
    type: 'task',
    text: 'Вася завершил задачу «Онбординг нового стажёра» — +120 монет',
    time: '2 ч назад'
  },
  {
    id: 'feed-4',
    type: 'welcome',
    text: 'Анастасия присоединилась к команде маркетинга — добро пожаловать!',
    time: 'вчера'
  },
  {
    id: 'feed-5',
    type: 'vacation',
    text: 'Отпуск Маши с 24 по 28 июня согласован — команда в курсе',
    time: 'вчера'
  },
  {
    id: 'feed-6',
    type: 'achievement',
    text: 'Костя получил бейдж «Наставник месяца» за поддержку новичков',
    time: '2 дня назад'
  },
  {
    id: 'feed-7',
    type: 'gift',
    text: 'Алина отправила 30 монет Васе — «За быстрый фикс в проде»',
    time: '3 дня назад'
  },
  {
    id: 'feed-8',
    type: 'task',
    text: 'Анастасия закрыла 5 задач адаптации за первую неделю',
    time: 'на прошлой неделе'
  }
];

export function useColleagueFeed() {
  const items = computed(() =>
    demoFeedItems.map((item) => ({
      ...item,
      icon: item.icon ?? feedIconByType[item.type]
    }))
  );

  return { items };
}
