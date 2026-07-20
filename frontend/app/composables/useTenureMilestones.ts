import {
  dueTenureMilestones,
  tenureMilestoneIdempotencyKey,
  tenureMilestoneReason
} from '~/utils/tenureMilestones';

/**
 * Начисляет валюту за достигнутые юбилеи 5/10/15/20 лет (idempotent).
 * Суммы — в TENURE_MILESTONE_AMOUNTS; пока null — ничего не капает.
 */
export function applyTenureMilestoneRewards(): number {
  if (!import.meta.client) return 0;

  const { user } = useAuth();
  const { findByUserForAuth } = useEmployees();
  const { creditUserOnce, hydrateWallets } = useWallet();

  hydrateWallets();

  const authUser = user.value;
  if (!authUser?.id) return 0;

  const employee = findByUserForAuth(authUser);
  const hiredAt = employee?.hired_at?.trim();
  if (!hiredAt) return 0;

  let credited = 0;
  for (const { years, amount } of dueTenureMilestones(hiredAt)) {
    const ok = creditUserOnce(
      authUser.id,
      amount,
      tenureMilestoneReason(years),
      tenureMilestoneIdempotencyKey(authUser.id, years)
    );
    if (ok) credited += 1;
  }
  return credited;
}
