export type SalesBestAwardRow = {
  id: string;
  period: string;
  employee_id: number;
  employee_name: string;
  selected_at: string;
  reveal_on: string;
};

export function useSalesBest() {
  const revealedCount = useState<number>('sales-best-revealed-count', () => 0);
  const revealedAwards = useState<SalesBestAwardRow[]>('sales-best-revealed', () => []);
  const hydrated = useState<boolean>('sales-best-hydrated', () => false);

  const hydrate = async () => {
    try {
      const data = await $fetch<{ count: number; awards: SalesBestAwardRow[] }>('/api/sales-best/mine');
      revealedCount.value = data.count || 0;
      revealedAwards.value = Array.isArray(data.awards) ? data.awards : [];
      hydrated.value = true;
    } catch {
      revealedCount.value = 0;
      revealedAwards.value = [];
      hydrated.value = true;
    }
  };

  return { revealedCount, revealedAwards, hydrated, hydrate };
}
