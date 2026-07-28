import {
  TENURE_GIFT_SETS,
  type TenureGiftSet,
  type TenureGiftYears
} from '~/utils/tenureAnniversary';

export type TenureCouponStatus = 'available' | 'used';

export type TenureCoupon = {
  id: string;
  userId: number;
  employeeId: number;
  years: TenureGiftYears;
  sku: string;
  title: string;
  status: TenureCouponStatus;
  createdAt: string;
  usedAt?: string;
};

export type TenureGiftOrder = {
  id: string;
  couponId: string;
  userId: number;
  employeeId: number;
  employeeName: string;
  years: TenureGiftYears;
  sku: string;
  createdAt: string;
  status: 'pending' | 'fulfilled';
};

const COUPONS_KEY = 'vbi-tenure-coupons-v1';
const ORDERS_KEY = 'vbi-tenure-gift-orders-v1';

type CouponsStore = { coupons: TenureCoupon[] };
type OrdersStore = { orders: TenureGiftOrder[] };

const readCoupons = (): CouponsStore => {
  if (!import.meta.client) return { coupons: [] };
  try {
    const raw = localStorage.getItem(COUPONS_KEY);
    if (!raw) return { coupons: [] };
    const parsed = JSON.parse(raw) as Partial<CouponsStore>;
    return { coupons: Array.isArray(parsed.coupons) ? parsed.coupons : [] };
  } catch {
    return { coupons: [] };
  }
};

const writeCoupons = (data: CouponsStore) => {
  if (!import.meta.client) return;
  localStorage.setItem(COUPONS_KEY, JSON.stringify(data));
};

const readOrders = (): OrdersStore => {
  if (!import.meta.client) return { orders: [] };
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return { orders: [] };
    const parsed = JSON.parse(raw) as Partial<OrdersStore>;
    return { orders: Array.isArray(parsed.orders) ? parsed.orders : [] };
  } catch {
    return { orders: [] };
  }
};

const writeOrders = (data: OrdersStore) => {
  if (!import.meta.client) return;
  localStorage.setItem(ORDERS_KEY, JSON.stringify(data));
};

export const tenureCouponId = (employeeId: number, years: number) =>
  `tenure-coupon-${employeeId}-${years}y`;

export type TenureUseMessage = {
  userId: number;
  text: string;
};

export function useTenureCoupons() {
  const { user } = useAuth();
  const coupons = useState<TenureCoupon[]>('tenure-coupons', () => []);
  const orders = useState<TenureGiftOrder[]>('tenure-gift-orders', () => []);
  /** Плашка только для userId, который использовал купон — не протекает на других. */
  const useMessageRaw = useState<TenureUseMessage | null>('tenure-coupon-use-message', () => null);

  const hydrate = () => {
    if (!import.meta.client) return;
    coupons.value = readCoupons().coupons;
    orders.value = readOrders().orders;
  };

  const persistCoupons = () => writeCoupons({ coupons: coupons.value });
  const persistOrders = () => writeOrders({ orders: orders.value });

  const myCoupons = computed(() => {
    if (!user.value) return [] as TenureCoupon[];
    return coupons.value.filter((c) => c.userId === user.value!.id);
  });

  const useMessage = computed(() => {
    if (!user.value || !useMessageRaw.value) return null;
    if (useMessageRaw.value.userId !== user.value.id) return null;
    return useMessageRaw.value.text;
  });

  const setUseMessage = (text: string | null) => {
    if (!text || !user.value) {
      useMessageRaw.value = null;
      return;
    }
    useMessageRaw.value = { userId: user.value.id, text };
  };

  const availableCouponForYears = (years: TenureGiftYears) =>
    myCoupons.value.find((c) => c.years === years && c.status === 'available') ?? null;

  const hasAvailableCoupon = (years: TenureGiftYears) => Boolean(availableCouponForYears(years));

  const grantCoupon = (input: {
    userId: number;
    employeeId: number;
    years: TenureGiftYears;
    /** Только для теста: вернуть использованный купон в available */
    reviveUsed?: boolean;
  }): TenureCoupon => {
    hydrate();
    const id = tenureCouponId(input.employeeId, input.years);
    const existing = coupons.value.find((c) => c.id === id);
    if (existing) {
      if (existing.status === 'used' && input.reviveUsed) {
        const revived: TenureCoupon = {
          ...existing,
          status: 'available',
          usedAt: undefined,
          createdAt: new Date().toISOString()
        };
        coupons.value = coupons.value.map((c) => (c.id === id ? revived : c));
        persistCoupons();
        return revived;
      }
      return existing;
    }
    const gift: TenureGiftSet = TENURE_GIFT_SETS[input.years];
    const row: TenureCoupon = {
      id,
      userId: input.userId,
      employeeId: input.employeeId,
      years: input.years,
      sku: gift.shopSku,
      title: gift.couponTitle,
      status: 'available',
      createdAt: new Date().toISOString()
    };
    coupons.value = [...coupons.value, row];
    persistCoupons();
    return row;
  };

  const useCoupon = async (
    years: TenureGiftYears
  ): Promise<{ ok: true; order: TenureGiftOrder } | { ok: false; error: string }> => {
    if (!user.value) return { ok: false, error: 'Нет сессии' };
    hydrate();
    const coupon = availableCouponForYears(years);
    if (!coupon) return { ok: false, error: 'Нет активного купона' };

    const now = new Date().toISOString();
    coupons.value = coupons.value.map((c) =>
      c.id === coupon.id ? { ...c, status: 'used' as const, usedAt: now } : c
    );
    persistCoupons();

    const order: TenureGiftOrder = {
      id: `tenure-order-${coupon.employeeId}-${years}y-${Date.now()}`,
      couponId: coupon.id,
      userId: user.value.id,
      employeeId: coupon.employeeId,
      employeeName: user.value.name,
      years,
      sku: coupon.sku,
      createdAt: now,
      status: 'pending'
    };
    orders.value = [order, ...orders.value];
    persistOrders();

    try {
      await $fetch('/api/tenure/gift-orders', {
        method: 'POST',
        body: {
          employee_id: order.employeeId,
          employee_name: order.employeeName,
          years: order.years,
          sku: order.sku,
          order_id: order.id
        }
      });
    } catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string }; message?: string };
      setUseMessage(
        err.data?.statusMessage ?? err.message ?? 'Купон использован, но уведомление HR не отправилось'
      );
      return { ok: true, order };
    }

    setUseMessage(`Заявка на набор «${years} лет» отправлена в HR`);
    return { ok: true, order };
  };

  const pendingHrOrders = computed(() => orders.value.filter((o) => o.status === 'pending'));

  const clearUseMessage = () => {
    useMessageRaw.value = null;
  };

  /** Сброс UI-состояния при выходе / смене пользователя. */
  const resetSessionUi = () => {
    useMessageRaw.value = null;
  };

  if (import.meta.client) {
    watch(
      () => user.value?.id ?? null,
      (next, prev) => {
        if (prev != null && next !== prev) {
          resetSessionUi();
        }
        if (useMessageRaw.value && next != null && useMessageRaw.value.userId !== next) {
          resetSessionUi();
        }
      }
    );
  }

  if (import.meta.client && coupons.value.length === 0) {
    hydrate();
  }

  return {
    coupons,
    orders,
    myCoupons,
    useMessage,
    hydrate,
    grantCoupon,
    availableCouponForYears,
    hasAvailableCoupon,
    useCoupon,
    pendingHrOrders,
    clearUseMessage,
    resetSessionUi,
    setUseMessage
  };
}

