export type WalletTransaction = {
  idempotency_key: string;
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  created_at: string;
  counterparty?: string;
};

export type GiftRecipient = {
  id: number;
  name: string;
  department: string;
};

const WALLET_STORAGE_KEY = 'vbi-wallet-state-v1';

const defaultWalletByUser = (): Record<number, WalletTransaction[]> => ({});

function calcBalance(userId: number, wallets: Record<number, WalletTransaction[]>): number {
  const txs = wallets[userId] ?? [];
  return txs.reduce((acc, tx) => acc + (tx.type === 'credit' ? tx.amount : -tx.amount), 0);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useWallet() {
  const { user } = useAuth();
  const { employees } = useEmployees();

  const walletByUser = useState<Record<number, WalletTransaction[]>>('vbi-wallet-by-user', () =>
    defaultWalletByUser()
  );
  const walletHydrated = useState<boolean>('vbi-wallet-hydrated', () => false);

  const persistWallets = () => {
    if (!import.meta.client) return;
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(walletByUser.value));
  };

  const hydrateWallets = () => {
    if (!import.meta.client || walletHydrated.value) return;
    const raw = localStorage.getItem(WALLET_STORAGE_KEY);
    if (raw) {
      try {
        walletByUser.value = { ...defaultWalletByUser(), ...(JSON.parse(raw) as Record<number, WalletTransaction[]>) };
      } catch {
        walletByUser.value = defaultWalletByUser();
      }
    }
    walletHydrated.value = true;
  };

  const currentUserId = computed(() => user.value?.id ?? 0);

  const balance = computed(() => {
    const id = currentUserId.value;
    if (!id) return 0;
    return calcBalance(id, walletByUser.value);
  });

  const walletTransactions = computed(() => {
    const id = currentUserId.value;
    if (!id) return [];
    return walletByUser.value[id] ?? [];
  });

  const giftRecipients = computed((): GiftRecipient[] =>
    employees.value
      .filter((emp) => emp.platform_user_id && emp.platform_user_id !== currentUserId.value)
      .map((emp) => ({
        id: emp.platform_user_id!,
        name: emp.name,
        department: emp.department
      }))
  );

  const monthTurnover = computed(() => {
    const txs = walletTransactions.value;
    const credited = txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const debited = txs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    return { credited, debited };
  });

  const giftToColleague = (toUserId: number, amount: number, comment = '') => {
    const fromId = currentUserId.value;
    if (!fromId) {
      return { ok: false, error: 'Войдите в аккаунт' };
    }

    const recipient = giftRecipients.value.find((r) => r.id === toUserId);
    const senderName = user.value?.name ?? 'Коллега';
    if (!recipient) {
      return { ok: false, error: 'Получатель не найден' };
    }
    if (toUserId === fromId) {
      return { ok: false, error: 'Нельзя отправить подарок самому себе' };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Укажите сумму больше 0' };
    }
    if (amount > balance.value) {
      return { ok: false, error: 'Недостаточно валюты на балансе' };
    }

    const key = `gift-${fromId}-${toUserId}-${Date.now()}`;
    const note = comment.trim() ? ` (${comment.trim()})` : '';

    if (!walletByUser.value[fromId]) {
      walletByUser.value[fromId] = [];
    }
    if (!walletByUser.value[toUserId]) {
      walletByUser.value[toUserId] = [];
    }

    walletByUser.value[fromId].unshift({
      idempotency_key: `${key}-debit`,
      type: 'debit',
      amount,
      reason: `Подарок коллеге: ${recipient.name}${note}`,
      created_at: today(),
      counterparty: recipient.name
    });

    walletByUser.value[toUserId].unshift({
      idempotency_key: `${key}-credit`,
      type: 'credit',
      amount,
      reason: `Подарок от коллеги: ${senderName}${note}`,
      created_at: today(),
      counterparty: senderName
    });

    persistWallets();
    return { ok: true };
  };

  const creditUser = (userId: number, amount: number, reason: string) => {
    if (!userId || amount <= 0) return;
    if (!walletByUser.value[userId]) walletByUser.value[userId] = [];
    walletByUser.value[userId].unshift({
      idempotency_key: `credit-${userId}-${Date.now()}`,
      type: 'credit',
      amount,
      reason,
      created_at: today()
    });
    persistWallets();
  };

  const debitUser = (
    userId: number,
    amount: number,
    reason: string
  ): { ok: true } | { ok: false; error: string } => {
    if (!userId || amount <= 0) return { ok: false, error: 'Некорректная сумма' };
    if (calcBalance(userId, walletByUser.value) < amount) {
      return { ok: false, error: 'Недостаточно валюты' };
    }
    if (!walletByUser.value[userId]) walletByUser.value[userId] = [];
    walletByUser.value[userId].unshift({
      idempotency_key: `debit-${userId}-${Date.now()}`,
      type: 'debit',
      amount,
      reason,
      created_at: today()
    });
    persistWallets();
    return { ok: true };
  };

  /** Начисление один раз по стабильному ключу (повторный вызов — no-op). */
  const creditUserOnce = (
    userId: number,
    amount: number,
    reason: string,
    idempotencyKey: string
  ): boolean => {
    if (!userId || amount <= 0 || !idempotencyKey) return false;
    if (!walletByUser.value[userId]) walletByUser.value[userId] = [];
    const exists = walletByUser.value[userId].some((tx) => tx.idempotency_key === idempotencyKey);
    if (exists) return false;
    walletByUser.value[userId].unshift({
      idempotency_key: idempotencyKey,
      type: 'credit',
      amount,
      reason,
      created_at: today()
    });
    persistWallets();
    return true;
  };

  return {
    currentUserId,
    balance,
    walletTransactions,
    giftRecipients,
    monthTurnover,
    giftToColleague,
    creditUser,
    debitUser,
    creditUserOnce,
    hydrateWallets,
    persistWallets
  };
}
