export type WalletTransaction = {
  idempotency_key: string;
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  created_at: string;
  counterparty?: string;
};

const CURRENT_USER_ID = 1;

const walletByUser = ref<Record<number, WalletTransaction[]>>({
  1: [
    {
      idempotency_key: 'demo-credit-1',
      type: 'credit',
      amount: 550,
      reason: 'Стартовый баланс',
      created_at: '2026-04-20'
    },
    {
      idempotency_key: 'demo-debit-1',
      type: 'debit',
      amount: 450,
      reason: 'Покупка: Merch Pack',
      created_at: '2026-04-19'
    }
  ],
  2: [{ idempotency_key: 'u2-seed', type: 'credit', amount: 320, reason: 'Стартовый баланс', created_at: '2026-04-18' }],
  3: [{ idempotency_key: 'u3-seed', type: 'credit', amount: 210, reason: 'Стартовый баланс', created_at: '2026-04-18' }],
  4: [{ idempotency_key: 'u4-seed', type: 'credit', amount: 480, reason: 'Стартовый баланс', created_at: '2026-04-18' }],
  5: [{ idempotency_key: 'u5-seed', type: 'credit', amount: 390, reason: 'Стартовый баланс', created_at: '2026-04-18' }]
});

function calcBalance(userId: number): number {
  const txs = walletByUser.value[userId] ?? [];
  return txs.reduce((acc, tx) => acc + (tx.type === 'credit' ? tx.amount : -tx.amount), 0);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useWallet() {
  const { users } = useAdminData();

  const currentUserId = CURRENT_USER_ID;

  const balance = computed(() => calcBalance(currentUserId));

  const walletTransactions = computed(() => walletByUser.value[currentUserId] ?? []);

  const giftRecipients = computed(() =>
    users.value.filter((u) => u.id !== currentUserId && u.status === 'active')
  );

  const monthTurnover = computed(() => {
    const txs = walletTransactions.value;
    const credited = txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const debited = txs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    return { credited, debited };
  });

  const giftToColleague = (toUserId: number, amount: number, comment = '') => {
    const recipient = users.value.find((u) => u.id === toUserId);
    if (!recipient) {
      return { ok: false, error: 'Получатель не найден' };
    }
    if (toUserId === currentUserId) {
      return { ok: false, error: 'Нельзя отправить подарок самому себе' };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Укажите сумму больше 0' };
    }
    if (amount > balance.value) {
      return { ok: false, error: 'Недостаточно валюты на балансе' };
    }

    const key = `gift-${currentUserId}-${toUserId}-${Date.now()}`;
    const note = comment.trim() ? ` (${comment.trim()})` : '';

    if (!walletByUser.value[currentUserId]) {
      walletByUser.value[currentUserId] = [];
    }
    if (!walletByUser.value[toUserId]) {
      walletByUser.value[toUserId] = [];
    }

    walletByUser.value[currentUserId].unshift({
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
      reason: `Подарок от коллеги: Стас${note}`,
      created_at: today(),
      counterparty: 'Стас'
    });

    return { ok: true };
  };

  return {
    currentUserId,
    balance,
    walletTransactions,
    giftRecipients,
    monthTurnover,
    giftToColleague
  };
}
