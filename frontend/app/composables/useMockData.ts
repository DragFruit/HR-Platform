export type MotivationBlock =
  | 'personal_brand'
  | 'more_money'
  | 'more_free_time'
  | 'new_interesting'
  | 'learning';

export type StoreItem = {
  id: number;
  name: string;
  category: 'time' | 'merch' | 'money' | 'growth';
  price: number;
  monthly_limit: number;
  image: string;
};

const storeItems: StoreItem[] = [
  {
    id: 1,
    name: 'Day Off',
    category: 'time',
    price: 1000,
    monthly_limit: 1,
    image: '🧘'
  },
  {
    id: 2,
    name: 'Merch Pack',
    category: 'merch',
    price: 450,
    monthly_limit: 2,
    image: '🎁'
  },
  {
    id: 3,
    name: 'Learning Budget',
    category: 'growth',
    price: 700,
    monthly_limit: 1,
    image: '📚'
  }
];

export function useMockData() {
  const { balance, walletTransactions } = useWallet();
  const { myActiveTasks } = useTasks();
  const levelProgress = computed(() => 68);

  return {
    myActiveTasks,
    storeItems,
    walletTransactions,
    balance,
    levelProgress
  };
}