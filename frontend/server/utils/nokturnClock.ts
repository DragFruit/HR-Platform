import { getDeployAppEnv } from './appEnv';

/**
 * «Сейчас» для квеста. На localhost и стейдже можно сдвинуть время
 * переменной `NOKTURN_DEV_NOW` (ISO с зоной, например `2026-10-26T11:00:00+03:00`),
 * чтобы прогонять дни квеста до их наступления. На бою переменная игнорируется.
 */
export function nokturnNow(): Date {
  if (getDeployAppEnv() !== 'production') {
    const raw = String(process.env.NOKTURN_DEV_NOW || '').trim();
    if (raw) {
      const ms = Date.parse(raw);
      if (Number.isFinite(ms)) return new Date(ms);
    }
  }
  return new Date();
}
