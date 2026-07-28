<template>
  <div class="store-page">
    <p v-if="actionError" class="tenure-store-toast tenure-store-toast--error" role="alert">
      {{ actionError }}
      <button type="button" class="button ghost" @click="actionError = null">Ок</button>
    </p>

    <section
      v-if="redeemNotice"
      class="store-page__redeemed"
      role="status"
      aria-live="polite"
    >
      <div>
        <p class="store-page__redeemed-title">Заявка ушла в HR</p>
        <p class="muted store-page__redeemed-text">
          Соберём набор «{{ redeemNotice.years }} лет» — медаль, вино и премию.
        </p>
      </div>
      <button type="button" class="button ghost" @click="dismissRedeemNotice">Понятно</button>
    </section>

    <section class="store-page__catalog" aria-labelledby="store-catalog-title">
      <div class="store-page__catalog-head">
        <h2 id="store-catalog-title" class="store-page__catalog-title">Каталог</h2>
        <p class="muted store-page__catalog-lead">Обмен валюты на бенефиты</p>
      </div>

      <div class="store-page__filters" role="group" aria-label="Фильтр по стоимости">
        <span class="store-page__filters-label">Стоимость</span>
        <div class="filters">
          <button
            v-for="option in priceFilterOptions"
            :key="option.value"
            type="button"
            class="filter-btn"
            :class="{ active: priceFilter === option.value }"
            @click="priceFilter = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div v-if="filteredCatalogItems.length" class="grid-three store-page__grid">
        <article
          v-if="activePack && priceFilter === 'all'"
          class="card task-item store-page__item store-page__item--tenure"
          aria-label="Юбилейный набор"
        >
          <span class="store-page__tenure-badge">Награда</span>
          <TenureGiftBanner
            :years="activePack.years"
            :disabled="usingCoupon"
            @use="onUseCoupon(activePack.years)"
          />
        </article>

        <article
          v-for="item in filteredCatalogItems"
          :key="item.id"
          class="card task-item store-page__item"
        >
          <div class="row">
            <h3>{{ item.image }} {{ item.name }}</h3>
            <span class="tag learning">{{ item.category }}</span>
          </div>
          <p class="muted">Лимит: {{ item.monthly_limit }} / месяц</p>
          <p class="stat-value store-page__price">{{ item.price }}</p>
          <button
            class="button"
            :class="balance >= item.price ? 'primary' : 'ghost'"
            :disabled="buyingId === item.id || balance < item.price"
            @click="onBuy(item)"
          >
            {{
              buyingId === item.id
                ? 'Покупка…'
                : balance >= item.price
                  ? 'Купить'
                  : 'Недостаточно валюты'
            }}
          </button>
        </article>
      </div>
      <p v-else class="muted store-page__empty">Нет товаров в этом диапазоне цен.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { TENURE_GIFT_SETS, type TenureGiftYears } from '~/utils/tenureAnniversary';
import { recordStorePurchase } from '~/composables/useAchievements';
import type { StoreItem } from '~/composables/useMockData';

const { storeItems } = useMockData();
const { balance, debitUser, hydrateWallets } = useWallet();
const { user } = useAuth();
const { hydrate, grantCoupon, myCoupons, useCoupon, clearUseMessage } = useTenureCoupons();
const { findByUserForAuth, findByUserId } = useEmployees();
const { isAdmin } = usePlatformContext();

const usingCoupon = ref(false);
const buyingId = ref<number | null>(null);
const actionError = ref<string | null>(null);
const redeemNotice = ref<{ years: TenureGiftYears } | null>(null);

type PriceFilter = 'all' | 'to500' | '500to800' | 'from800';

const priceFilter = ref<PriceFilter>('all');

const priceFilterOptions: { value: PriceFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'to500', label: 'до 500' },
  { value: '500to800', label: '500–800' },
  { value: 'from800', label: 'от 800' }
];

const matchesPriceFilter = (price: number) => {
  if (priceFilter.value === 'to500') return price <= 500;
  if (priceFilter.value === '500to800') return price > 500 && price <= 800;
  if (priceFilter.value === 'from800') return price > 800;
  return true;
};

/** Только актуальный набор с активным купоном. Не для админ-режима. */
const activePack = computed(() => {
  if (isAdmin.value) return null;
  if (redeemNotice.value) return null;
  const available = myCoupons.value.find((c) => c.status === 'available');
  if (!available) return null;
  return TENURE_GIFT_SETS[available.years];
});

/** При активном купоне первая карточка — баннер, Day Off уступаем ему. */
const catalogItems = computed(() => {
  if (activePack.value) return storeItems.filter((item) => item.id !== 1);
  return storeItems;
});

const filteredCatalogItems = computed(() =>
  catalogItems.value.filter((item) => matchesPriceFilter(item.price))
);

/**
 * Тестовый юбиляр: выдать купон один раз, если его ещё нет.
 * Не возвращаем used → available после «Использовать».
 */
const ensureTestCoupon = () => {
  if (!import.meta.client || !user.value || isAdmin.value) return;
  hydrate();
  const emp = findByUserForAuth(user.value) ?? findByUserId(user.value.id);
  if (!emp) return;
  const isJubilee =
    emp.id === 9100 || user.value.email?.toLowerCase() === 'jubilee@vbi.local';
  if (!isJubilee) return;
  if (myCoupons.value.some((c) => c.years === 5)) return;
  grantCoupon({
    userId: user.value.id,
    employeeId: emp.id,
    years: 5
  });
};

const dismissRedeemNotice = () => {
  redeemNotice.value = null;
};

const onUseCoupon = async (years: TenureGiftYears) => {
  usingCoupon.value = true;
  actionError.value = null;
  try {
    const res = await useCoupon(years);
    clearUseMessage();
    if (!res.ok) {
      actionError.value = res.error;
      return;
    }
    redeemNotice.value = { years };
  } finally {
    usingCoupon.value = false;
  }
};

const onBuy = (item: StoreItem) => {
  if (!user.value || isAdmin.value) return;
  actionError.value = null;
  buyingId.value = item.id;
  try {
    const res = debitUser(user.value.id, item.price, `Магазин: ${item.name}`);
    if (!res.ok) {
      actionError.value = res.error;
      return;
    }
    recordStorePurchase({
      userId: user.value.id,
      itemId: item.id,
      itemName: item.name
    });
  } finally {
    buyingId.value = null;
  }
};

onMounted(() => {
  hydrateWallets();
  hydrate();
  ensureTestCoupon();
});

onBeforeUnmount(() => {
  clearUseMessage();
});
</script>
