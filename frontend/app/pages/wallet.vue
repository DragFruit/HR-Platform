<template>
  <section class="grid-two">
    <article class="card">
      <p class="soft">Текущий баланс</p>
      <p class="stat-value">{{ balance }}</p>
      <p class="muted">Доступно для обмена в магазине и подарков коллегам</p>
    </article>
    <article class="card">
      <p class="soft">Оборот за месяц</p>
      <p class="stat-value">+{{ monthTurnover.credited }} / -{{ monthTurnover.debited }}</p>
      <p class="muted">Начисления и списания в вашем кошельке</p>
    </article>
  </section>

  <section class="card gift-card">
    <h2 class="section-title">Подарить валюту коллеге</h2>
    <p class="muted">Перевод внутренней валюты другому сотруднику. Операция сразу отразится в истории.</p>

    <form class="gift-form" @submit.prevent="submitGift">
      <label class="gift-field">
        <span>Коллега</span>
        <select v-model="recipientId" class="org-select" required>
          <option disabled value="">Выберите получателя</option>
          <option v-for="user in giftRecipients" :key="user.id" :value="user.id">
            {{ formatEmployeeShortName(user.name) }} · {{ user.department }}
          </option>
        </select>
      </label>

      <label class="gift-field">
        <span>Сумма</span>
        <input
          v-model.number="amount"
          class="org-input"
          type="number"
          min="1"
          :max="balance"
          placeholder="Например, 50"
          required
        />
      </label>

      <label class="gift-field">
        <span>Комментарий (необязательно)</span>
        <input v-model="comment" class="org-input" type="text" placeholder="Спасибо за помощь!" />
      </label>

      <p v-if="giftError" class="gift-error">{{ giftError }}</p>
      <p v-if="giftSuccess" class="gift-success">{{ giftSuccess }}</p>

      <button class="button primary" type="submit" :disabled="!canSubmit">
        Подарить валюту
      </button>
    </form>
  </section>

  <section v-if="walletTransactions.length === 0" class="card state-box">
    <h3>Операций пока нет</h3>
    <p>Когда появятся начисления, покупки или подарки, здесь отобразится история.</p>
  </section>

  <section v-else class="card">
    <h2 class="section-title">История транзакций</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Дата</th>
          <th>Тип</th>
          <th>Операция</th>
          <th>Сумма</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tx in walletTransactions" :key="tx.idempotency_key">
          <td>{{ tx.created_at }}</td>
          <td>
            <span class="status-chip" :class="tx.type === 'credit' ? 'done' : 'pending'">
              {{ tx.type === 'credit' ? 'Начисление' : 'Списание' }}
            </span>
          </td>
          <td>{{ tx.reason }}</td>
          <td :class="tx.type === 'credit' ? 'amount-plus' : 'amount-minus'">
            {{ tx.type === 'credit' ? `+${tx.amount}` : `-${tx.amount}` }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
import { formatEmployeeShortName } from '~/utils/employeeName';

const { balance, walletTransactions, giftRecipients, monthTurnover, giftToColleague, hydrateWallets } =
  useWallet();

onMounted(() => {
  hydrateWallets();
});

const recipientId = ref<number | ''>('');
const amount = ref<number | null>(null);
const comment = ref('');
const giftError = ref('');
const giftSuccess = ref('');

const canSubmit = computed(() => {
  return Boolean(recipientId.value) && amount.value && amount.value > 0 && amount.value <= balance.value;
});

const submitGift = () => {
  giftError.value = '';
  giftSuccess.value = '';

  if (!recipientId.value || !amount.value) {
    giftError.value = 'Заполните получателя и сумму';
    return;
  }

  const result = giftToColleague(Number(recipientId.value), amount.value, comment.value);
  if (!result.ok) {
    giftError.value = result.error ?? 'Не удалось выполнить перевод';
    return;
  }

  const recipient = giftRecipients.value.find((u) => u.id === Number(recipientId.value));
  giftSuccess.value = `Успешно отправлено ${amount.value} монет сотруднику ${formatEmployeeShortName(recipient?.name ?? '')}`;
  recipientId.value = '';
  amount.value = null;
  comment.value = '';
};
</script>
